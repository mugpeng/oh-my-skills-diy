import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';

export interface HnPostConfig {
  auto_submit: boolean;
}

export interface HnPost {
  title: string;
  url: string;
}

export interface HnPostParseResult {
  config: HnPostConfig;
  post: HnPost;
  filePath: string;
}

const MAX_TITLE_CHARS = 200;
const MAX_TEXT_CHARS = 65535;

export function parsePost(filePath: string): HnPostParseResult {
  const absPath = path.resolve(filePath);
  const raw = fs.readFileSync(absPath, 'utf-8');
  const { data, content } = matter(raw);

  const config: HnPostConfig = {
    auto_submit: Boolean(data.auto_submit),
  };

  const title = (data.title ?? '').toString().trim();
  const url = (data.url ?? '').toString().trim();

  if (!title) {
    throw new Error('Missing required frontmatter field: title');
  }
  if (!url) {
    throw new Error('Missing required frontmatter field: url');
  }

  return {
    config,
    post: { title, url },
    filePath: absPath,
  };
}

export function validatePost(post: HnPost): string[] {
  const warnings: string[] = [];

  if (post.title.length > MAX_TITLE_CHARS) {
    warnings.push(
      `Title: ${post.title.length} chars (max ${MAX_TITLE_CHARS}) — "${post.title.slice(0, 40)}..."`,
    );
  }

  if (post.url.length > 2048) {
    warnings.push(`URL exceeds reasonable length: ${post.url.length} chars`);
  }

  // Basic URL validation
  try {
    new URL(post.url);
  } catch {
    warnings.push(`URL is not valid: ${post.url}`);
  }

  return warnings;
}

function printUsage(): never {
  console.log(`Parse a markdown file into a Hacker News post.

Usage:
  bun md-to-hn.ts <file.md> [options]

Options:
  --json    Output raw JSON
  --help    Show this help

Examples:
  bun md-to-hn.ts post.md
  bun md-to-hn.ts post.md --json
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  const filePath = args.find((a) => !a.startsWith('-'));
  if (!filePath) {
    console.error('Error: Provide a markdown file path.');
    process.exit(1);
  }

  const asJson = args.includes('--json');
  const result = parsePost(filePath);
  const warnings = validatePost(result.post);

  if (asJson) {
    console.log(JSON.stringify({ ...result, warnings }, null, 2));
  } else {
    console.log(`Post: "${result.post.title}"`);
    console.log(`URL: ${result.post.url}`);
    console.log(`Config: auto_submit=${result.config.auto_submit}\n`);
    if (warnings.length) {
      console.log('Warnings:');
      for (const w of warnings) console.log(`  ! ${w}`);
    }
  }
}

// Do not auto-run when imported as a module
if (process.argv[1] && process.argv[1].includes('md-to-hn')) {
  await main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
