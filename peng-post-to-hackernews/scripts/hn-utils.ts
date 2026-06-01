import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export interface PlatformCandidates {
  darwin?: string[];
  win32?: string[];
  default: string[];
}

export const CHROME_CANDIDATES_BASIC: PlatformCandidates = {
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
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ],
};

export const CHROME_CANDIDATES_FULL: PlatformCandidates = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  default: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
  ],
};

const CHROME_LOCK_FILES = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'chrome.pid'] as const;

export function hasChromeLockArtifacts(entries: readonly string[]): boolean {
  return CHROME_LOCK_FILES.some((name) => entries.includes(name));
}

export function shouldRetryChromeLaunch(options: {
  lockArtifactsPresent: boolean;
  hasLiveOwner: boolean;
}): boolean {
  return options.lockArtifactsPresent && !options.hasLiveOwner;
}

export function cleanStaleLockFiles(profileDir: string): void {
  for (const name of CHROME_LOCK_FILES) {
    try { fs.unlinkSync(path.join(profileDir, name)); } catch {}
  }
}

function hasLiveChromeOwner(profileDir: string): boolean {
  if (process.platform === 'win32') return false;
  try {
    const result = spawnSync('ps', ['aux'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    if (result.status !== 0 || !result.stdout) return false;
    return result.stdout.split('\n').some((line) => line.includes(`--user-data-dir=${profileDir}`));
  } catch {
    return false;
  }
}

async function listProfileDirEntries(profileDir: string): Promise<string[]> {
  try {
    return await fs.promises.readdir(profileDir);
  } catch {
    return [];
  }
}

export async function launchChromeWithRetry(
  url: string,
  profileDir: string,
  chromePath: string,
): Promise<{ chrome: Awaited<ReturnType<typeof import('baoyu-chrome-cdp').launchChrome>>; port: number }> {
  const { launchChrome, getFreePort, killChrome, waitForChromeDebugPort } = await import('baoyu-chrome-cdp');

  const port = await getFreePort();
  const chrome = await launchChrome({
    chromePath,
    profileDir,
    port,
    url,
    extraArgs: ['--start-maximized'],
  });

  try {
    await waitForChromeDebugPort(port, 30_000, { includeLastError: true });
    return { chrome, port };
  } catch (error) {
    killChrome(chrome);
    throw error;
  }
}

export async function launchChrome(
  url: string,
  profileDir: string,
  candidates: PlatformCandidates,
  chromePathOverride?: string,
): Promise<{ chrome: Awaited<ReturnType<typeof import('baoyu-chrome-cdp').launchChrome>>; port: number }> {
  const { findChromeExecutable } = await import('baoyu-chrome-cdp');
  const chromePath = chromePathOverride?.trim() || findChromeExecutable({ candidates, envNames: ['HN_CHROME_PATH'] });
  if (!chromePath) throw new Error('Chrome not found. Set HN_CHROME_PATH env var.');

  try {
    return await launchChromeWithRetry(url, profileDir, chromePath);
  } catch (error) {
    const entries = await listProfileDirEntries(profileDir);
    if (shouldRetryChromeLaunch({
      lockArtifactsPresent: hasChromeLockArtifacts(entries),
      hasLiveOwner: hasLiveChromeOwner(profileDir),
    })) {
      cleanStaleLockFiles(profileDir);
      return await launchChromeWithRetry(url, profileDir, chromePath);
    }
    throw error;
  }
}

export function getScriptDir(): string {
  return path.dirname(new URL(import.meta.url).pathname);
}
