import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export interface HnSubmitOptions {
  title: string;
  url: string;
  text?: string;
  cookiesPath: string;
  proxy?: string;
  chromePath?: string;
  timeoutMs?: number;
}

export interface HnSubmitResult {
  success: boolean;
  itemId?: number;
  itemUrl?: string;
  error?: string;
}

const HN_LOGIN_URL = 'https://news.ycombinator.com/login';
const HN_SUBMIT_URL = 'https://news.ycombinator.com/submit';
const HN_SUBMIT_ACTION_URL = 'https://news.ycombinator.com/r';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function findChromeExecutable(): string | undefined {
  const candidates: string[] = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  if (process.env.HN_CHROME_PATH) {
    if (fs.existsSync(process.env.HN_CHROME_PATH)) return process.env.HN_CHROME_PATH;
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Run curl and return stdout, stderr, exitCode, and response headers.
 */
export function curl(
  args: string[],
  timeoutMs: number = 15_000,
): { stdout: string; stderr: string; exitCode: number; headers: string } {
  const headerFile = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'hn-')), 'headers.txt');
  const fullArgs = [...args, '--dump-header', headerFile];

  const result = spawnSync('curl', fullArgs, {
    encoding: 'utf-8',
    timeout: timeoutMs,
  });

  let headers = '';
  try {
    headers = fs.readFileSync(headerFile, 'utf-8');
  } catch {}
  fs.unlinkSync(headerFile);

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? -1,
    headers,
  };
}

/**
 * Extract the session cookie from Set-Cookie headers.
 * HN sets a cookie like: user=username&sessionhash
 */
export function extractSessionCookie(headers: string): string | null {
  const match = headers.match(/set-cookie:\s*(user=[^;]+)/i);
  return match ? match[1] : null;
}

/**
 * Login to HN and return the session cookie.
 */
export function login(
  username: string,
  password: string,
  proxy?: string,
  timeoutMs: number = 15_000,
): { success: boolean; cookie?: string; error?: string } {
  const goto = 'submit';
  const args = [
    '--silent',
    '--location',
    '--user-agent', USER_AGENT,
    '--data-urlencode', `acct=${username}`,
    '--data-urlencode', `pw=${password}`,
    '--data-urlencode', `goto=${goto}`,
    HN_LOGIN_URL,
  ];

  if (proxy) {
    args.unshift('--proxy', proxy);
  }

  const result = curl(args, timeoutMs);

  if (result.exitCode !== 0) {
    return { success: false, error: `curl failed: ${result.stderr.trim()}` };
  }

  const cookie = extractSessionCookie(result.headers);
  if (!cookie) {
    // Check for login error in the response body
    if (result.stdout.includes('.err')) {
      const errMatch = result.stdout.match(/<span class="err">([^<]*)<\/span>/);
      return { success: false, error: errMatch ? errMatch[1] : 'Login failed (unknown error)' };
    }
    return { success: false, error: 'No session cookie received. Check credentials.' };
  }

  return { success: true, cookie };
}

/**
 * Get the fnid (CSRF token) from the submit page.
 */
export function getFnid(cookie: string, proxy?: string, timeoutMs: number = 15_000): string | null {
  const args = [
    '--silent',
    '--cookie', cookie,
    '--user-agent', USER_AGENT,
    HN_SUBMIT_URL,
  ];

  if (proxy) {
    args.unshift('--proxy', proxy);
  }

  const result = curl(args, timeoutMs);

  if (result.exitCode !== 0) {
    return null;
  }

  const match = result.stdout.match(/name="fnid"\s+value="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Submit a story to HN.
 */
export function submitStory(
  fnid: string,
  title: string,
  url: string,
  text: string | undefined,
  cookie: string,
  proxy?: string,
  timeoutMs: number = 15_000,
): HnSubmitResult {
  const formData = new URLSearchParams();
  formData.append('fnid', fnid);
  formData.append('fnop', 'submit-page');
  formData.append('title', title);
  formData.append('url', url);
  if (text) formData.append('text', text);

  const args = [
    '--silent',
    '--location',
    '--cookie', cookie,
    '--user-agent', USER_AGENT,
    '--request', 'POST',
    '--data', formData.toString(),
    '--write-out', '\n%{url_effective}',
    HN_SUBMIT_ACTION_URL,
  ];

  if (proxy) {
    args.unshift('--proxy', proxy);
  }

  const result = curl(args, timeoutMs);

  if (result.exitCode !== 0) {
    return { success: false, error: `curl failed: ${result.stderr.trim()}` };
  }

  // The final URL is appended by --write-out
  const lines = result.stdout.split('\n');
  const finalUrl = lines[lines.length - 1]?.trim() ?? '';

  // Check for item ID in the final URL
  const idMatch = finalUrl.match(/item\?id=(\d+)/);
  if (idMatch) {
    return {
      success: true,
      itemId: Number(idMatch[1]),
      itemUrl: finalUrl,
    };
  }

  // Check for error messages in the response body
  if (result.stdout.includes('.err')) {
    const errMatch = result.stdout.match(/<span class="err">([^<]*)<\/span>/);
    return { success: false, error: errMatch ? errMatch[1] : 'Submission failed (unknown error)' };
  }

  if (result.stdout.includes('already') && result.stdout.includes('posted')) {
    return { success: false, error: 'This URL has already been posted to Hacker News.' };
  }

  return { success: false, error: 'Submission result uncertain. Check browser for confirmation.' };
}
