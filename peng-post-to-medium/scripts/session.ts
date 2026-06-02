/**
 * Cookie/session management for Medium browser automation.
 *
 * Cookies are saved to ~/.peng-skills/medium-cookies.json
 * so the user only needs to log in once.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import type { BrowserContext, Cookie } from "playwright";

const COOKIE_DIR = resolve(
  process.env.HOME || "~",
  ".peng-skills"
);
const COOKIE_PATH = resolve(COOKIE_DIR, "medium-cookies.json");

export function sessionExists(): boolean {
  return existsSync(COOKIE_PATH);
}

export async function saveSession(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  if (!existsSync(COOKIE_DIR)) {
    mkdirSync(COOKIE_DIR, { recursive: true });
  }
  writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2), "utf-8");
  console.log(`Session saved to ${COOKIE_PATH}`);
}

export async function loadSession(context: BrowserContext): Promise<void> {
  if (!sessionExists()) {
    console.error("No saved session found. Run 'login' first.");
    process.exit(1);
  }
  const raw = readFileSync(COOKIE_PATH, "utf-8");
  const cookies: Cookie[] = JSON.parse(raw);
  await context.addCookies(cookies);
}
