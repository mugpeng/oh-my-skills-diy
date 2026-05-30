import fs from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  CHROME_CANDIDATES_FULL,
  CdpConnection,
  copyImageToClipboard,
  findExistingChromeDebugPort,
  getDefaultProfileDir,
  gracefulKillChrome,
  launchChrome,
  openPageSession,
  pasteFromClipboard,
  sleep,
  waitForXSessionPersistence,
  waitForChromeDebugPort,
} from './x-utils.js';
import { parseThread, validateTweets, type ThreadTweet, type ThreadParseResult } from './md-to-thread.js';

const X_COMPOSE_URL = 'https://x.com/compose/post';
const STATUS_URL_RE = /https?:\/\/(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)/;

interface ThreadOptions {
  filePath: string;
  submit?: boolean;
  delayMs?: number;
  profileDir?: string;
  chromePath?: string;
  timeoutMs?: number;
}

// --- CDP helpers ---

async function waitForSelector(
  cdp: CdpConnection,
  sessionId: string,
  selector: string,
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await cdp.send<{ result: { value: boolean } }>('Runtime.evaluate', {
      expression: `!!document.querySelector(${JSON.stringify(selector)})`,
      returnByValue: true,
    }, { sessionId });
    if (result.result.value) return true;
    await sleep(500);
  }
  return false;
}

async function typeText(cdp: CdpConnection, sessionId: string, text: string): Promise<void> {
  await cdp.send('Runtime.evaluate', {
    expression: `
      const editor = document.querySelector('[data-testid="tweetTextarea_0"]');
      if (editor) {
        editor.focus();
        document.execCommand('insertText', false, ${JSON.stringify(text)});
      }
    `,
  }, { sessionId });
  await sleep(500);
}

async function pasteImages(
  cdp: CdpConnection,
  sessionId: string,
  images: string[],
): Promise<void> {
  for (const imagePath of images) {
    if (!fs.existsSync(imagePath)) {
      console.warn(`  [!] Image not found: ${imagePath}`);
      continue;
    }

    console.log(`  Pasting image: ${path.basename(imagePath)}`);

    if (!copyImageToClipboard(imagePath)) {
      console.warn(`  [!] Failed to copy image to clipboard: ${imagePath}`);
      continue;
    }

    const imgCountBefore = await cdp.send<{ result: { value: number } }>('Runtime.evaluate', {
      expression: `document.querySelectorAll('img[src^="blob:"]').length`,
      returnByValue: true,
    }, { sessionId });

    await sleep(500);

    await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector('[data-testid="tweetTextarea_0"]')?.focus()`,
    }, { sessionId });
    await sleep(200);

    const pasteOk = pasteFromClipboard('Google Chrome', 5, 500);
    if (!pasteOk) {
      console.warn('  [!] Paste script failed, trying CDP fallback...');
      const modifiers = process.platform === 'darwin' ? 4 : 2;
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'v', code: 'KeyV', modifiers, windowsVirtualKeyCode: 86,
      }, { sessionId });
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'v', code: 'KeyV', modifiers, windowsVirtualKeyCode: 86,
      }, { sessionId });
    }

    const expectedCount = imgCountBefore.result.value + 1;
    let verified = false;
    const waitStart = Date.now();
    while (Date.now() - waitStart < 15_000) {
      const r = await cdp.send<{ result: { value: number } }>('Runtime.evaluate', {
        expression: `document.querySelectorAll('img[src^="blob:"]').length`,
        returnByValue: true,
      }, { sessionId });
      if (r.result.value >= expectedCount) { verified = true; break; }
      await sleep(1000);
    }

    if (verified) console.log('  Image uploaded');
    else console.warn('  [!] Image upload not detected after 15s');
  }
}

async function clickSubmit(cdp: CdpConnection, sessionId: string): Promise<void> {
  // Try primary button, then inline variant
  await cdp.send('Runtime.evaluate', {
    expression: `
      const btn = document.querySelector('[data-testid="tweetButton"]')
        || document.querySelector('[data-testid="tweetButtonInline"]');
      btn?.click();
    `,
  }, { sessionId });
}

async function waitForTweetUrl(cdp: CdpConnection, sessionId: string, timeoutMs = 30_000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
      expression: 'window.location.href',
      returnByValue: true,
    }, { sessionId });
    const match = result.result.value.match(STATUS_URL_RE);
    if (match) return match[0].replace(/twitter\.com/, 'x.com');
    await sleep(500);
  }
  return null;
}

// --- Main flow ---

async function postFirstTweet(
  cdp: CdpConnection,
  sessionId: string,
  tweet: ThreadTweet,
  submit: boolean,
  timeoutMs: number,
): Promise<string | null> {
  console.log(`\n[1/${tweet.index + 1}] Composing first tweet (${tweet.text.length} chars)...`);

  const editorReady = await waitForSelector(cdp, sessionId, '[data-testid="tweetTextarea_0"]', timeoutMs);
  if (!editorReady) {
    console.log('  Editor not found. Please log in to X in the browser window.');
    console.log('  Waiting for login...');
    const loggedIn = await waitForSelector(cdp, sessionId, '[data-testid="tweetTextarea_0"]', timeoutMs);
    if (!loggedIn) throw new Error('Timed out waiting for X editor. Please log in first.');
  }

  await typeText(cdp, sessionId, tweet.text);
  await pasteImages(cdp, sessionId, tweet.images);

  if (!submit) {
    console.log('  Preview mode: first tweet composed. Review in browser.');
    console.log('  Add --submit to post the full thread automatically.');
    return null;
  }

  console.log('  Submitting...');
  await clickSubmit(cdp, sessionId);
  const tweetUrl = await waitForTweetUrl(cdp, sessionId);
  if (!tweetUrl) throw new Error('Could not capture tweet URL after submit.');
  console.log(`  Posted: ${tweetUrl}`);
  return tweetUrl;
}

async function postReply(
  cdp: CdpConnection,
  sessionId: string,
  prevTweetUrl: string,
  tweet: ThreadTweet,
  totalTweets: number,
  submit: boolean,
  delayMs: number,
  timeoutMs: number,
): Promise<string | null> {
  console.log(`\n[${tweet.index + 1}/${totalTweets}] Reply (${tweet.text.length} chars)...`);

  // Navigate to previous tweet
  await cdp.send('Page.navigate', { url: prevTweetUrl }, { sessionId });
  await sleep(3000);

  // Wait for reply button
  const replyReady = await waitForSelector(cdp, sessionId, '[data-testid="reply"]', timeoutMs);
  if (!replyReady) throw new Error(`Reply button not found on ${prevTweetUrl}`);

  // Click reply
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('[data-testid="reply"]')?.click()`,
  }, { sessionId });
  await sleep(1000);

  // Wait for reply compose dialog
  const dialogReady = await waitForSelector(cdp, sessionId, '[data-testid="tweetTextarea_0"]', 15_000);
  if (!dialogReady) throw new Error('Reply compose dialog did not appear.');

  await typeText(cdp, sessionId, tweet.text);
  await pasteImages(cdp, sessionId, tweet.images);

  if (!submit) {
    console.log('  Preview mode: reply composed. Review in browser.');
    return null;
  }

  console.log('  Submitting reply...');
  await clickSubmit(cdp, sessionId);
  const tweetUrl = await waitForTweetUrl(cdp, sessionId);
  if (!tweetUrl) throw new Error('Could not capture reply tweet URL after submit.');
  console.log(`  Posted: ${tweetUrl}`);

  if (delayMs > 0) {
    console.log(`  Waiting ${delayMs}ms...`);
    await sleep(delayMs);
  }

  return tweetUrl;
}

export async function postThread(options: ThreadOptions): Promise<void> {
  const {
    filePath,
    submit = false,
    delayMs,
    profileDir = getDefaultProfileDir(),
    chromePath,
    timeoutMs = 120_000,
  } = options;

  // Parse markdown
  const result: ThreadParseResult = parseThread(filePath);
  const warnings = validateTweets(result.tweets);

  if (result.tweets.length === 0) {
    console.error('Error: No tweets found in the markdown file.');
    process.exit(1);
  }

  console.log(`Thread: ${result.tweets.length} tweets from ${path.basename(result.filePath)}`);
  if (warnings.length) {
    for (const w of warnings) console.warn(`  Warning: ${w}`);
  }

  const effectiveDelay = delayMs ?? result.config.delay_ms;
  const effectiveSubmit = submit || result.config.auto_submit;

  // Launch Chrome
  await mkdir(profileDir, { recursive: true });
  const existingPort = await findExistingChromeDebugPort(profileDir);
  const reusing = existingPort !== null;
  let port = existingPort ?? 0;
  let chrome: Awaited<ReturnType<typeof launchChrome>>['chrome'] | null = null;

  if (!reusing) {
    const launched = await launchChrome(X_COMPOSE_URL, profileDir, CHROME_CANDIDATES_FULL, chromePath);
    port = launched.port;
    chrome = launched.chrome;
  }

  if (reusing) console.log(`Reusing existing Chrome on port ${port}`);
  else console.log(`Launching Chrome (profile: ${profileDir})`);

  let cdp: CdpConnection | null = null;
  let sessionId: string | null = null;
  let loggedInDuringRun = false;

  try {
    const wsUrl = await waitForChromeDebugPort(port, 30_000, { includeLastError: true });
    cdp = await CdpConnection.connect(wsUrl, 30_000, { defaultTimeoutMs: 15_000 });

    const page = await openPageSession({
      cdp,
      reusing,
      url: X_COMPOSE_URL,
      matchTarget: (target) => target.type === 'page' && target.url.includes('x.com'),
      enablePage: true,
      enableRuntime: true,
      enableNetwork: true,
    });
    sessionId = page.sessionId;
    await cdp.send('Input.setIgnoreInputEvents', { ignore: false }, { sessionId });
    await sleep(3000);

    // Check if editor is ready (may need login)
    const editorReady = await waitForSelector(cdp, sessionId, '[data-testid="tweetTextarea_0"]', 5_000);
    if (!editorReady) {
      loggedInDuringRun = true;
    }

    // Post first tweet
    const firstTweet = result.tweets[0]!;
    let prevUrl = await postFirstTweet(cdp, sessionId, firstTweet, effectiveSubmit, timeoutMs);

    // Post remaining tweets as replies
    if (effectiveSubmit && prevUrl) {
      for (let i = 1; i < result.tweets.length; i++) {
        const tweet = result.tweets[i]!;
        prevUrl = await postReply(
          cdp, sessionId, prevUrl, tweet, result.tweets.length,
          effectiveSubmit, effectiveDelay, timeoutMs,
        );
        if (!prevUrl) break;
      }

      console.log(`\nThread posted: ${result.tweets.length} tweets`);
    } else if (!effectiveSubmit) {
      console.log('\nPreview complete. Review the first tweet in the browser.');
      console.log('Add --submit to post the full thread automatically.');
    }
  } finally {
    let leaveChromeOpen = !effectiveSubmit;
    if (chrome && effectiveSubmit && loggedInDuringRun && cdp && sessionId) {
      console.log('Waiting for X session cookies to persist...');
      const sessionReady = await waitForXSessionPersistence({ cdp, sessionId });
      if (!sessionReady) {
        console.warn('X session cookies not observed yet. Leaving Chrome open.');
        leaveChromeOpen = true;
      }
    }

    if (cdp) cdp.close();
    if (chrome) {
      if (leaveChromeOpen) chrome.unref();
      else await gracefulKillChrome(chrome, port);
    }
  }
}

// --- CLI ---

function printUsage(): never {
  console.log(`Post an X/Twitter thread from a Markdown file.

Usage:
  bun x-thread.ts <file.md> [options]

Options:
  --submit         Post all tweets (default: preview first tweet only)
  --delay <ms>     Delay between tweets (default: from frontmatter or 2000)
  --profile <dir>  Chrome profile directory
  --chrome <path>  Chrome executable path
  --help           Show this help

Markdown format:
  Use --- on its own line to separate tweets.
  Use ![alt](./image.png) to attach images per tweet.

Examples:
  bun x-thread.ts thread.md
  bun x-thread.ts thread.md --submit
  bun x-thread.ts thread.md --submit --delay 3000
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  let filePath: string | undefined;
  let submit = false;
  let delayMs: number | undefined;
  let profileDir: string | undefined;
  let chromePath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--submit') {
      submit = true;
    } else if (arg === '--delay' && args[i + 1]) {
      delayMs = Number(args[++i]);
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
    console.error('Example: bun x-thread.ts thread.md');
    process.exit(1);
  }

  await postThread({ filePath, submit, delayMs, profileDir, chromePath });
}

await main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
