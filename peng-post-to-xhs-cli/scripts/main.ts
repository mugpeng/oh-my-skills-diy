import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ── Config ──────────────────────────────────────────

interface Config {
  default_model: string;
  default_quality: "normal" | "2k";
  default_aspect_ratio: string;
  google_base_url?: string;
}

function loadExtendMd(baseDir: string): Partial<Config> {
  const candidates = [
    path.join(process.cwd(), ".peng-skills", "peng-post-to-xhs", "EXTEND.md"),
    process.env.XDG_CONFIG_HOME
      ? path.join(
          process.env.XDG_CONFIG_HOME,
          "peng-skills",
          "peng-post-to-xhs",
          "EXTEND.md",
        )
      : null,
    path.join(
      process.env.HOME || "~",
      ".peng-skills",
      "peng-post-to-xhs",
      "EXTEND.md",
    ),
    path.join(baseDir, "EXTEND.md"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      continue;
    }
  }
  return {};
}

function getGoogleBaseUrl(config: Partial<Config>): string {
  return (
    config.google_base_url ||
    process.env.GOOGLE_BASE_URL ||
    "https://generativelanguage.googleapis.com"
  );
}

function getGoogleApiKey(): string {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
}

function normalizeModel(model: string): string {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function buildGoogleUrl(baseUrl: string, model: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const modelPath = normalizeModel(model);
  // base might already include /v1beta
  if (base.endsWith("/v1beta")) return `${base}/${modelPath}:generateContent`;
  return `${base}/v1beta/${modelPath}:generateContent`;
}

// ── Arg Parsing ─────────────────────────────────────

interface CliArgs {
  prompt: string | null;
  promptFiles: string[];
  image: string | null;
  ar: string | null;
  quality: "normal" | "2k" | null;
  batchDir: string | null;
  imagesDir: string | null;
  json: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    prompt: null,
    promptFiles: [],
    image: null,
    ar: null,
    quality: null,
    batchDir: null,
    imagesDir: null,
    json: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--prompt":
      case "-p":
        args.prompt = argv[++i];
        break;
      case "--promptfiles":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.promptFiles.push(argv[++i]);
        }
        break;
      case "--image":
        args.image = argv[++i];
        break;
      case "--ar":
        args.ar = argv[++i];
        break;
      case "--quality":
        args.quality = argv[++i] as "normal" | "2k";
        break;
      case "--batchdir":
        args.batchDir = argv[++i];
        break;
      case "--images-dir":
        args.imagesDir = argv[++i];
        break;
      case "--json":
        args.json = true;
        break;
    }
  }
  return args;
}

// ── Image Generation ────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ inlineData?: { data?: string } }>;
    };
  }>;
}

async function generateImage(
  prompt: string,
  model: string,
  ar: string,
  quality: "normal" | "2k",
  baseUrl: string,
): Promise<Uint8Array> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is required");

  const url = buildGoogleUrl(baseUrl, model);

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${prompt} Aspect ratio: ${ar}.` }],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { imageSize: quality === "2k" ? "2K" : "1K" },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const data = (await res.json()) as GeminiResponse;

  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData?.data) {
        return Uint8Array.from(Buffer.from(part.inlineData.data, "base64"));
      }
    }
  }

  throw new Error("No image data in Gemini response");
}

// ── Main ────────────────────────────────────────────

async function main() {
  const baseDir = path.dirname(new URL(import.meta.url).pathname);
  const config = loadExtendMd(baseDir);

  const defaults: Config = {
    default_model: "gemini-3.1-flash-image-preview",
    default_quality: "2k",
    default_aspect_ratio: "9:16",
  };

  const model = config.default_model || defaults.default_model;
  const quality = config.default_quality || defaults.default_quality;
  const ar = config.default_aspect_ratio || defaults.default_aspect_ratio;
  const baseUrl = getGoogleBaseUrl(config);

  const args = parseArgs(process.argv);

  if (args.json) {
    console.log(
      JSON.stringify({ model, quality, aspectRatio: ar, baseUrl }),
    );
    return;
  }

  // Batch mode
  if (args.batchDir) {
    const promptDir = path.resolve(args.batchDir);
    const outDir = args.imagesDir
      ? path.resolve(args.imagesDir)
      : path.join(promptDir, "..", "images");
    fs.mkdirSync(outDir, { recursive: true });

    const files = fs
      .readdirSync(promptDir)
      .filter((f) => f.endsWith(".md"))
      .sort();

    if (files.length === 0) {
      console.error("No .md files found in", promptDir);
      process.exit(1);
    }

    const results: Array<{ file: string; status: string; error?: string }> = [];

    for (const file of files) {
      const prompt = fs.readFileSync(path.join(promptDir, file), "utf8");
      const outName = file.replace(/\.md$/, ".png");
      const outPath = path.join(outDir, outName);

      try {
        process.stdout.write(`Generating ${file}... `);
        const image = await generateImage(prompt, model, ar, quality, baseUrl);
        fs.writeFileSync(outPath, image);
        process.stdout.write("done\n");
        results.push({ file, status: "ok" });
      } catch (err) {
        process.stdout.write("FAILED\n");
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ file, status: "error", error: msg });
      }
    }

    const ok = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "error").length;
    console.log(`\nDone: ${ok} ok, ${failed} failed`);
    if (failed > 0) {
      for (const r of results.filter((r) => r.status === "error")) {
        console.error(`  ${r.file}: ${r.error}`);
      }
    }
    return;
  }

  // Single mode
  let prompt: string;

  if (args.promptFiles.length > 0) {
    prompt = args.promptFiles
      .map((f) => fs.readFileSync(path.resolve(f), "utf8"))
      .join("\n\n");
  } else if (args.prompt) {
    prompt = args.prompt;
  } else {
    // Read from stdin
    const stdin = fs.readFileSync("/dev/stdin", "utf8").trim();
    if (!stdin) {
      console.error(
        "No prompt provided. Use --prompt, --promptfiles, or pipe input.",
      );
      process.exit(1);
    }
    prompt = stdin;
  }

  const outPath = args.image || "output.png";
  const image = await generateImage(
    prompt,
    model,
    args.ar || ar,
    args.quality || quality,
    baseUrl,
  );
  fs.writeFileSync(outPath, image);
  console.log(`Image saved to ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});