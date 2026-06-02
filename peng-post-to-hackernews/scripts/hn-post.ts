#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  login,
  getFnid,
  submitStory,
  findChromeExecutable,
  type HnSubmitResult,
} from './hn-utils.js';
import { parsePost, validatePost, type HnPostParseResult } from './md-to-hn.js';

const HN_SUBMIT_URL = 'https://news.ycombinator.com/submit';

interface HnPostOptions {
  filePath: string;
  submit?: boolean;
  profileDir?: string;
  chromePath?: string;
  timeoutMs?: number;
}

async function postToHackerNews(options: HnPostOptions): Promise<void> {
  const {
    filePath,
    submit = false,
    profileDir,
    chromePath,
    timeoutMs = 30_000,
  } = options;

  const result: HnPostParseResult = parsePost(filePath);
  const warnings = validatePost(result.post);

  if (!result.post.title || !result.post.url) {
    console.error('Error: Both title and url are required for a URL post.');
    process.exit(1);
  }

  if (warnings.length) {
    for (const w of warnings) console.warn(`  Warning: ${w}`);
  }

  console.log(`Post: "${result.post.title}" → ${result.post.url}`);

  const hnUsername = process.env.HN_USERNAME;
  const hnPassword = process.env.HN_PASSWORD;

  if (!hnUsername || !hnPassword) {
    console.error('Error: HN_USERNAME and HN_PASSWORD environment variables must be set.');
    console.error('  export HN_USERNAME="your_username"');
    console.error('  export HN_PASSWORD="your_password"');
    process.exit(1);
  }

  const proxy = process.env.HN_PROXY || undefined;

  // Step 1: Login (always login to get fresh session cookie)
  console.log('  Logging in to Hacker News...');
  const loginResult = login(hnUsername, hnPassword, proxy, timeoutMs);
  if (!loginResult.success) {
    throw new Error(`Login failed: ${loginResult.error}`);
  }
  console.log('  Login successful.');

  // Step 2: Get fnid (CSRF token)
  console.log('\nFetching submit form...');
  const fnid = getFnid(loginResult.cookie!, proxy, timeoutMs);
  if (!fnid) {
    throw new Error('Could not retrieve fnid from submit page. Session may be invalid.');
  }
  console.log(`  fnid obtained.`);

  // Step 3: Preview or submit
  const effectiveSubmit = submit || result.config.auto_submit;

  if (!effectiveSubmit) {
    console.log('\nPreview mode: credentials verified, session active.');
    console.log(`  Title: "${result.post.title}"`);
    console.log(`  URL: ${result.post.url}`);
    console.log('\nAdd --submit to post automatically.');
    console.log(`  Open ${HN_SUBMIT_URL} in your browser to submit manually.`);
    return;
  }

  // Step 4: Submit the story
  console.log('\nSubmitting...');
  const submitResult: HnSubmitResult = submitStory(
    fnid,
    result.post.title,
    result.post.url,
    result.post.text,
    loginResult.cookie!,
    proxy,
    timeoutMs,
  );

  if (submitResult.success) {
    console.log(`\n✅ Posted: ${submitResult.itemUrl}`);
    if (submitResult.itemId) {
      console.log(`   Item ID: ${submitResult.itemId}`);
    }
  } else {
    console.error(`\n❌ Submission failed: ${submitResult.error}`);
    process.exit(1);
  }
}

// --- CLI ---

function printUsage(): never {
  console.log(`Post a URL story to Hacker News from a Markdown file.

Usage:
  bun hn-post.ts <file.md> [options]

Options:
  --submit         Post automatically (default: preview mode, verify session only)
  --profile <dir>  (ignored, kept for compatibility)
  --chrome <path>  (ignored, kept for compatibility)
  --help           Show this help

Environment variables:
  HN_USERNAME      Hacker News username (required)
  HN_PASSWORD      Hacker News password (required)
  HN_PROXY         HTTP proxy URL (optional, e.g. http://127.0.0.1:7890)

Markdown format:
  YAML frontmatter with title and url fields.

Examples:
  bun hn-post.ts post.md
  bun hn-post.ts post.md --submit
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  let filePath: string | undefined;
  let submit = false;
  let profileDir: string | undefined;
  let chromePath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--submit') {
      submit = true;
    } else if (arg === '--profile' && args[i + 1]) {
      profileDir = args[++i];
    } else if (arg === '--chrome' && args[i + 1]) {
      chromePath = args[++i];
    } else if (!arg.startsWith('-')) {
      filePath = arg;
    }
  }

  if (!filePath) {
    console.error('Error: Provide a markdown file path.');
    console.error('Example: bun hn-post.ts post.md');
    process.exit(1);
  }

  await postToHackerNews({ filePath, submit, profileDir, chromePath });
}

await main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
