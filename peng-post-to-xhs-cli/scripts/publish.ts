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

// ── xhs CLI helpers ────────────────────────────────

function runXhs(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync("xhs", args, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: 60_000,
  });
  return {
    ok: result.status === 0 && !result.error,
    stdout: result.stdout?.trim() || "",
    stderr: result.stderr?.trim() || "",
  };
}

function checkAuth(): boolean {
  const { ok, stdout } = runXhs(["status", "--yaml"]);
  if (!ok) return false;
  // xhs status --yaml outputs login info if authenticated
  return !stdout.includes("not_authenticated") && stdout.length > 0;
}

function publishPost(
  title: string,
  content: string,
  images: string[],
  tags: string[],
): { ok: boolean; output: string } {
  const args = ["post", "--title", title, "--body", content];
  if (images.length > 0) {
    args.push("--images", ...images);
  }
  if (tags.length > 0) {
    args.push("--tags", ...tags);
  }

  const { ok, stdout, stderr } = runXhs(args);
  return { ok, output: stdout || stderr };
}

// ── Bun resolver ────────────────────────────────────

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

// ── Publish ─────────────────────────────────────────

async function publish(): Promise<void> {
  const baseDir = path.dirname(getScriptDir());
  const mainScript = path.join(baseDir, "scripts", "main.ts");
  const args = parseArgs(process.argv);

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

  if (args.title.length > 20) {
    console.error(`Title too long: ${args.title.length}/20 chars`);
    process.exit(1);
  }

  if (args.content.length > 1000) {
    console.error(`Content too long: ${args.content.length}/1000 chars`);
    process.exit(1);
  }

  const imagePaths = args.images.map((img) => path.resolve(img));
  for (const img of imagePaths) {
    if (!fs.existsSync(img)) {
      console.error(`Image not found: ${img}`);
      process.exit(1);
    }
  }

  // Step 3: Check xhs auth
  console.log("Checking xhs login status...");
  if (!checkAuth()) {
    console.error("Not logged in. Run: xhs login");
    process.exit(1);
  }
  console.log("Logged in.");

  // Step 4: Publish
  console.log("Publishing...");
  const result = publishPost(args.title, args.content, imagePaths, args.tags);

  if (args.json) {
    console.log(JSON.stringify({ ok: result.ok, output: result.output }));
  } else {
    console.log(result.output);
  }

  if (!result.ok) {
    process.exit(1);
  }
}

publish().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
