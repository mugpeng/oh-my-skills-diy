import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';

export interface ThreadConfig {
  auto_submit: boolean;
  delay_ms: number;
}

export interface ThreadTweet {
  text: string;
  images: string[];
  index: number;
}

export interface ThreadParseResult {
  config: ThreadConfig;
  tweets: ThreadTweet[];
  filePath: string;
}

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const MAX_CHARS = 280;
const MAX_IMAGES = 4;

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')       // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')       // italic
    .replace(/`(.+?)`/g, '$1')         // inline code
    .replace(/\[(.+?)\]\([^)]+\)/g, '$1') // links -> text
    .trim();
}

function extractImages(text: string, mdDir: string): { cleanText: string; images: string[] } {
  const images: string[] = [];
  const cleanText = text.replace(IMAGE_RE, (_match, _alt, src: string) => {
    const resolved = path.isAbsolute(src) ? src : path.resolve(mdDir, src);
    images.push(resolved);
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { cleanText, images };
}

export function parseThread(filePath: string): ThreadParseResult {
  const absPath = path.resolve(filePath);
  const raw = fs.readFileSync(absPath, 'utf-8');
  const mdDir = path.dirname(absPath);
  const { data, content } = matter(raw);

  const config: ThreadConfig = {
    auto_submit: Boolean(data.auto_submit),
    delay_ms: typeof data.delay_ms === 'number' ? data.delay_ms : 2000,
  };

  const segments = content.split(/^\s*---\s*$/m);
  const tweets: ThreadTweet[] = [];
  let index = 0;

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const { cleanText, images } = extractImages(trimmed, mdDir);
    const plainText = stripMarkdown(cleanText);
    if (!plainText) continue;

    tweets.push({ text: plainText, images, index });
    index++;
  }

  return { config, tweets, filePath: absPath };
}

export function validateTweets(tweets: ThreadTweet[]): string[] {
  const warnings: string[] = [];
  for (const tweet of tweets) {
    if (tweet.text.length > MAX_CHARS) {
      warnings.push(
        `Tweet ${tweet.index + 1}: ${tweet.text.length} chars (max ${MAX_CHARS}) — "${tweet.text.slice(0, 40)}..."`,
      );
    }
    if (tweet.images.length > MAX_IMAGES) {
      warnings.push(
        `Tweet ${tweet.index + 1}: ${tweet.images.length} images (max ${MAX_IMAGES})`,
      );
    }
  }
  return warnings;
}

function printUsage(): never {
  console.log(`Parse a markdown file into X/Twitter thread segments.

Usage:
  bun md-to-thread.ts <file.md> [options]

Options:
  --json    Output raw JSON
  --help    Show this help

Examples:
  bun md-to-thread.ts thread.md
  bun md-to-thread.ts thread.md --json
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
  const result = parseThread(filePath);
  const warnings = validateTweets(result.tweets);

  if (asJson) {
    console.log(JSON.stringify({ ...result, warnings }, null, 2));
  } else {
    console.log(`Thread: ${result.tweets.length} tweets from ${path.basename(result.filePath)}`);
    console.log(`Config: auto_submit=${result.config.auto_submit}, delay_ms=${result.config.delay_ms}\n`);
    for (const tweet of result.tweets) {
      const imgTag = tweet.images.length ? ` [${tweet.images.length} image(s)]` : '';
      console.log(`--- Tweet ${tweet.index + 1} (${tweet.text.length} chars)${imgTag} ---`);
      console.log(tweet.text);
      console.log();
    }
    if (warnings.length) {
      console.log('Warnings:');
      for (const w of warnings) console.log(`  ! ${w}`);
    }
  }
}

await main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
