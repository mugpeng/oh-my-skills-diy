#!/usr/bin/env bun
import fs, { mkdir } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  CdpConnection,
  findExistingChromeDebugPort,
  getDefaultChromeUserDataDirs,
  gracefulKillChrome,
  launchChrome,
  openPageSession,
  sleep,
  waitForChromeDebugPort,
  findChromeExecutable,
} from 'baoyu-chrome-cdp';
import { parsePost, validatePost, type HnPostParseResult } from './md-to-hn.ts';

const HN_LOGIN_URL = 'https://news.ycombinator.com/login';
const HN_SUBMIT_URL = 'https://news.ycombinator.com/submit';

const CHROME_CANDIDATES: Record<string, string[]> = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
  default: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ],
};

function findLocalChrome(): string | undefined {
  const platform = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'default';
  const candidates = CHROME_CANDIDATES[platform] ?? CHROME_CANDIDATES.default;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function getDefaultProfileDir(): string {
  const defaultDirs = getDefaultChromeUserDataDirs();
  return defaultDirs[0] ?? path.join(osHomedir(), '.baoyu-skills', 'chrome-profile');
}

// Minimal os.homedir polyfill (node:os is not imported to avoid extra dependency)
function osHomedir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '';
}

interface HnPostOptions {
  filePath: string;
  submit?: boolean;
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

async function typeText(
  cdp: CdpConnection,
  sessionId: string,
  selector: string,
  text: string,
): Promise<void> {
  await cdp.send('Runtime.evaluate', {
    expression: `
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el) {
        el.focus();
        el.value = '';
        document.execCommand('insertText', false, ${JSON.stringify(text)});
      }
    `,
  }, { sessionId });
  await sleep(500);
}

async function clickSubmit(
  cdp: CdpConnection,
  sessionId: string,
  selector: string,
): Promise<void> {
  await cdp.send('Runtime.evaluate', {
    expression: `
      const btn = document.querySelector(${JSON.stringify(selector)});
      btn?.click();
    `,
  }, { sessionId });
}

async function waitForUrlChange(
  cdp: CdpConnection,
  sessionId: string,
  expectedPattern: RegExp,
  timeoutMs: number,
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
      expression: 'window.location.href',
      returnByValue: true,
    }, { sessionId });
    if (expectedPattern.test(result.result.value)) {
      return result.result.value;
    }
    await sleep(500);
  }
  return null;
}

async function checkLoginStatus(
  cdp: CdpConnection,
  sessionId: string,
): Promise<boolean> {
  const urlResult = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
    expression: 'window.location.href',
    returnByValue: true,
  }, { sessionId });
  const url = urlResult.result.value;

  if (url.includes('/submit')) return true;

  const loginForm = await cdp.send<{ result: { value: boolean } }>('Runtime.evaluate', {
    expression: '!!document.querySelector("input[name=\\"acct\\"]")',
    returnByValue: true,
  }, { sessionId });

  return !loginForm.result.value;
}

async function performLogin(
  cdp: CdpConnection,
  sessionId: string,
  username: string,
  password: string,
  timeoutMs: number,
): Promise<boolean> {
  console.log('  Not logged in. Attempting login...');

  await cdp.send('Page.navigate', { url: HN_LOGIN_URL }, { sessionId });
  await sleep(2000);

  const acctReady = await waitForSelector(cdp, sessionId, 'input[name="acct"]', timeoutMs);
  if (!acctReady) {
    console.error('  Login form not found.');
    return false;
  }

  await typeText(cdp, sessionId, 'input[name="acct"]', username);
  console.log('  Username entered.');

  await typeText(cdp, sessionId, 'input[name="pw"]', password);
  console.log('  Password entered.');

  await clickSubmit(cdp, sessionId, 'input[type="submit"]');
  console.log('  Submitting login...');

  const loginUrl = await waitForUrlChange(
    cdp,
    sessionId,
    /news\.ycombinator\.com\/(submit|news|item)/,
    15_000,
  );

  if (loginUrl) {
    console.log(`  Login redirected to: ${loginUrl}`);
    if (!loginUrl.includes('/submit')) {
      await cdp.send('Page.navigate', { url: HN_SUBMIT_URL }, { sessionId });
      await sleep(2000);
    }
    return true;
  }

  const errorResult = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
    expression: 'document.querySelector(".err")?.textContent?.trim() || ""',
    returnByValue: true,
  }, { sessionId });

  if (errorResult.result.value) {
    console.error(`  Login failed: ${errorResult.result.value}`);
    return false;
  }

  console.warn('  Login result uncertain. Check browser manually.');
  return true;
}

// --- Main flow ---

async function postToHackerNews(options: HnPostOptions): Promise<void> {
  const {
    filePath,
    submit = false,
    profileDir,
    chromePath,
    timeoutMs = 120_000,
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

  const effectiveSubmit = submit || result.config.auto_submit;
  const effectiveProfileDir = profileDir ?? getDefaultProfileDir();
  const chromePathResolved = chromePath ?? findChromeExecutable({
    candidates: CHROME_CANDIDATES,
    envNames: ['HN_CHROME_PATH'],
  }) ?? findLocalChrome();

  if (!chromePathResolved) {
    console.error('Error: Chrome not found. Install Chrome or set HN_CHROME_PATH.');
    process.exit(1);
  }

  await mkdir(effectiveProfileDir, { recursive: true });
  const existingPort = await findExistingChromeDebugPort({ profileDir: effectiveProfileDir });
  const reusing = existingPort !== null;
  let port = existingPort ?? 0;
  let chrome: Awaited<ReturnType<typeof launchChrome>> | null = null;

  if (!reusing) {
    port = await (async () => {
      const { getFreePort } = await import('baoyu-chrome-cdp');
      return await getFreePort();
    })();
    chrome = await launchChrome({
      chromePath: chromePathResolved,
      profileDir: effectiveProfileDir,
      port,
      url: HN_SUBMIT_URL,
      extraArgs: ['--start-maximized'],
    });
  }

  if (reusing) console.log(`Reusing existing Chrome on port ${port}`);
  else console.log(`Launching Chrome (profile: ${effectiveProfileDir})`);

  let cdp: CdpConnection | null = null;
  let sessionId: string | null = null;
  let loggedInDuringRun = false;

  try {
    const wsUrl = await waitForChromeDebugPort(port, 30_000, { includeLastError: true });
    cdp = await CdpConnection.connect(wsUrl, 30_000, { defaultTimeoutMs: 15_000 });

    const page = await openPageSession({
      cdp,
      reusing,
      url: HN_SUBMIT_URL,
      matchTarget: (target: any) => target.type === 'page' && target.url.includes('ycombinator.com'),
      enablePage: true,
      enableRuntime: true,
      enableNetwork: true,
    });
    sessionId = page.sessionId;
    await cdp.send('Input.setIgnoreInputEvents', { ignore: false }, { sessionId });
    await sleep(3000);

    const alreadyLoggedIn = await checkLoginStatus(cdp, sessionId);
    if (!alreadyLoggedIn) {
      loggedInDuringRun = true;
      const loginOk = await performLogin(cdp, sessionId, hnUsername, hnPassword, timeoutMs);
      if (!loginOk) {
        throw new Error('Login failed. Check your credentials and try again.');
      }
    } else {
      console.log('  Already logged in.');
    }

    const submitReady = await waitForSelector(cdp, sessionId, 'input[name="title"]', timeoutMs);
    if (!submitReady) {
      throw new Error('Hacker News submit form not found. Page may have changed.');
    }

    console.log('\nFilling submit form...');
    await typeText(cdp, sessionId, 'input[name="title"]', result.post.title);
    console.log(`  Title: "${result.post.title}"`);

    await typeText(cdp, sessionId, 'input[name="url"]', result.post.url);
    console.log(`  URL: ${result.post.url}`);

    if (!effectiveSubmit) {
      console.log('\nPreview mode: form filled. Review in browser.');
      console.log('Add --submit to post automatically.');
      return;
    }

    console.log('\nSubmitting...');
    await clickSubmit(cdp, sessionId, 'input[type="submit"]');

    const postUrl = await waitForUrlChange(
      cdp,
      sessionId,
      /news\.ycombinator\.com\/item\?id=\d+/,
      15_000,
    );

    if (postUrl) {
      console.log(`\nPosted: ${postUrl}`);
    } else {
      const errorResult = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
        expression: 'document.querySelector(".err")?.textContent?.trim() || ""',
        returnByValue: true,
      }, { sessionId });

      if (errorResult.result.value) {
        console.error(`\nSubmission failed: ${errorResult.result.value}`);
      } else {
        console.warn('\nSubmission result uncertain. Check browser for confirmation.');
      }
    }
  } finally {
    let leaveChromeOpen = !effectiveSubmit;
    if (chrome && effectiveSubmit && loggedInDuringRun && cdp && sessionId) {
      console.log('\nWaiting for HN session cookies to persist...');
      await sleep(5000);
    }

    if (cdp) cdp.close();
    if (chrome) {
      if (leaveChromeOpen) chrome.unref?.();
      else await gracefulKillChrome(chrome, port);
    }
  }
}

// --- CLI ---

function printUsage(): never {
  console.log(`Post a URL story to Hacker News from a Markdown file.

Usage:
  bun hn-post.ts <file.md> [options]

Options:
  --submit         Post automatically (default: preview mode, fill form only)
  --profile <dir>  Chrome profile directory
  --chrome <path>  Chrome executable path
  --help           Show this help

Environment variables:
  HN_USERNAME      Hacker News username (required)
  HN_PASSWORD      Hacker News password (required)

Markdown format:
  YAML frontmatter with title and url fields.

Examples:
  bun hn-post.ts post.md
  bun hn-post.ts post.md --submit
  bun hn-post.ts post.md --submit --profile ~/.chrome/hn-profile
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
