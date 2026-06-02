/**
 * Session management for Medium browser automation.
 *
 * Two modes:
 *   1. Default Chrome profile — reuse existing login, no separate login needed
 *   2. Saved cookies fallback — for when Chrome is running
 */

import { existsSync } from "fs";
import { resolve, join } from "path";
import type { BrowserContext, Cookie } from "playwright";

/** Get the default Chrome user data directory for the current platform. */
export function getDefaultChromeProfileDir(): string {
  const home = process.env.HOME || "~";
  switch (process.platform) {
    case "darwin":
      return join(home, "Library", "Application Support", "Google", "Chrome");
    case "linux":
      return join(home, ".config", "google-chrome");
    case "win32":
      return join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"),
        "Google", "Chrome", "User Data");
    default:
      return join(home, ".config", "google-chrome");
  }
}

/** Check if the default Chrome profile directory exists. */
export function hasDefaultChromeProfile(): boolean {
  return existsSync(getDefaultChromeProfileDir());
}
