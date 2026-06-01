import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ── Config ──────────────────────────────────────────

interface PublishArgs {
  title: string;
  content: string;
  images: string[];
  tags: string[];
  batchdir: string | null;
  imagesDir: string | null;
  scheduleAt: string | null;
  skipGen: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): PublishArgs {
  const args: PublishArgs = {
    title: "",
    content: "",
    images: [],
    tags: [],
    batchdir: null,
    imagesDir: null,
    scheduleAt: null,
    skipGen: false,
    json: false,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--title":
        args.title = argv[++i];
        break;
      case "--content":
        args.content = argv[++i];
        break;
      case "--content-file":
        args.content = fs.readFileSync(argv[++i], "utf8");
        break;
      case "--images":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.images.push(argv[++i]);
        }
        break;
      case "--tags":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.tags.push(argv[++i]);
        }
        break;
      case "--batchdir":
        args.batchdir = argv[++i];
        break;
      case "--images-dir":
        args.imagesDir = argv[++i];
        break;
      case "--schedule-at":
        args.scheduleAt = argv[++i];
        break;
      case "--skip-gen":
        args.skipGen = true;
        break;
      case "--json":
        args.json = true;
        break;
    }
  }
  return args;
}

function getScriptDir(): string {
  return path.dirname(new URL(import.meta.url).pathname);
}

function getXhsDir(): string {
  return path.join(getScriptDir(), "xhs");
}

// ── MCP helpers ─────────────────────────────────────

function ensureMcpRunning(): boolean {
  // Check if already running
  const pidFile = path.join(process.env.HOME || "~", ".xiaohongshu", "mcp.pid");
  try {
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
      try {
        process.kill(pid, 0);
        return true; // Already running
      } catch {
        // Stale PID
      }
    }
  } catch {
    // Ignore
  }

  // Start MCP
  const startScript = path.join(getXhsDir(), "start-mcp.sh");
  if (!fs.existsSync(startScript)) {
    console.error("MCP start script not found:", startScript);
    return false;
  }

  const result = spawnSync(startScript, [], {
    stdio: "inherit",
    shell: true,
  });
  return result.status === 0;
}

function callXhsTool(tool: string, argsJson: string): string {
  const mcpScript = path.join(getXhsDir(), "mcp-call.sh");
  if (!fs.existsSync(mcpScript)) {
    throw new Error(`mcp-call.sh not found at ${mcpScript}`);
  }

  const result = spawnSync("bash", [mcpScript, tool, argsJson], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.error) throw new Error(`MCP call failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(
      `MCP call failed (exit ${result.status}): ${result.stderr?.trim() || result.stdout?.trim() || "unknown error"}`,
    );
  }

  return result.stdout;
}

function checkLogin(): boolean {
  try {
    const out = callXhsTool("check_login_status", "{}");
    return !out.includes("error") && !out.includes("not logged in");
  } catch {
    return false;
  }
}

// ── Publish ─────────────────────────────────────────

async function publish(): Promise<void> {
  const baseDir = path.dirname(getScriptDir());
  const mainScript = path.join(baseDir, "scripts", "main.ts");
  const args = parseArgs(process.argv);

  // Determine bun runtime
  const bun = resolveBun();

  // Step 1: Generate images if batchdir is provided
  if (args.batchdir && !args.skipGen) {
    const imagesDir = args.imagesDir || path.resolve(args.batchdir, "..", "images");
    console.log("Generating images from prompts...");
    const genResult = spawnSync(
      bun,
      [mainScript, "--batchdir", args.batchdir, "--images-dir", imagesDir],
      { stdio: "inherit", shell: true },
    );
    if (genResult.status !== 0) {
      throw new Error("Image generation failed");
    }

    // Collect generated images
    if (args.images.length === 0 && fs.existsSync(imagesDir)) {
      args.images = fs
        .readdirSync(imagesDir)
        .filter((f) => f.endsWith(".png"))
        .sort()
        .map((f) => path.join(imagesDir, f));
    }
  }

  // Step 2: Validate
  if (!args.title || args.content.length === 0) {
    console.error("--title and --content (or --content-file) are required");
    process.exit(1);
  }

  if (args.images.length === 0) {
    console.error("No images to publish. Provide --images or --batchdir");
    process.exit(1);
  }

  // Validate title length (XHS limit: 20 chars)
  if (args.title.length > 20) {
    console.error(`Title too long: ${args.title.length}/20 chars`);
    process.exit(1);
  }

  // Validate content length (XHS limit: 1000 chars)
  if (args.content.length > 1000) {
    console.error(`Content too long: ${args.content.length}/1000 chars`);
    process.exit(1);
  }

  // Resolve absolute paths for images
  const imagePaths = args.images.map((img) => path.resolve(img));

  // Validate image files exist
  for (const img of imagePaths) {
    if (!fs.existsSync(img)) {
      console.error(`Image not found: ${img}`);
      process.exit(1);
    }
  }

  // Step 3: Ensure MCP service is running
  console.log("Checking MCP service...");
  if (!ensureMcpRunning()) {
    console.error("Failed to start MCP service");
    process.exit(1);
  }

  // Step 4: Check login
  console.log("Checking login status...");
  if (!checkLogin()) {
    console.log("Not logged in. Getting QR code...");
    const qrResult = callXhsTool("get_login_qrcode", "{}");
    console.log(qrResult);
    console.log("Scan the QR code with Xiaohongshu app, then re-run");
    process.exit(1);
  }
  console.log("Logged in.");

  // Step 5: Publish
  console.log("Publishing...");
  const publishArgs: Record<string, unknown> = {
    title: args.title,
    content: args.content,
    images: imagePaths,
  };
  if (args.tags.length > 0) publishArgs.tags = args.tags;
  if (args.scheduleAt) publishArgs.schedule_at = args.scheduleAt;

  const result = callXhsTool("publish_content", JSON.stringify(publishArgs));
  console.log(result);

  if (args.json) {
    // Extract note ID from result if possible
    console.log(result);
  }
}

function resolveBun(): string {
  try {
    const out = execSync("which bun 2>/dev/null", { encoding: "utf8" }).trim();
    if (out) return out;
  } catch {
    // Not found
  }
  try {
    const out = execSync("npx -y bun --version 2>/dev/null", {
      encoding: "utf8",
    }).trim();
    if (out) return "npx -y bun";
  } catch {
    // Not found
  }
  console.error("bun not found. Install: brew install oven-sh/bun/bun");
  process.exit(1);
}

publish().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});