#!/usr/bin/env bun

/**
 * Extract Medium cookies from default Chrome profile and save as storage state.
 *
 * This allows headless mode to use the existing login without re-authenticating.
 *
 * Usage: bun scripts/extract-cookies.ts
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { chromium } from "playwright";
import { getDefaultChromeProfileDir, hasDefaultChromeProfile } from "./session";

const STORAGE_PATH = join(
  process.env.HOME || "~",
  ".peng-skills",
  "medium-storage-state.json"
);

async function main() {
  console.log("=== Extract Medium Cookies ===\n");

  if (!hasDefaultChromeProfile()) {
    console.error("No default Chrome profile found.");
    process.exit(1);
  }

  const profileDir = getDefaultChromeProfileDir();
  console.log(`Using Chrome profile:\n  ${profileDir}\n`);

  // Launch Chrome headful with default profile
  console.log("Launching Chrome (headful)...");
  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless: false,
    });
  } catch (err: any) {
    if (err?.message?.includes("user data directory is already in use")) {
      console.error("Chrome is already running. Please close Chrome first.");
      process.exit(1);
    }
    throw err;
  }

  const page = context.pages()[0] || await context.newPage();

  // Navigate to Medium to ensure cookies are loaded
  console.log("Navigating to Medium...");
  await page.goto("https://medium.com/me/stories", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);

  const url = page.url();
  const loggedIn = !url.includes("/signin") && !url.includes("/oauth");

  if (!loggedIn) {
    console.error("Not logged in to Medium in Chrome profile.");
    console.error("Please log in to Medium in Chrome first, then re-run this script.");
    await context.close();
    process.exit(1);
  }

  console.log("Logged in! Extracting cookies...");

  // Get all cookies for medium.com
  const cookies = await context.cookies("https://medium.com");

  // Get localStorage
  const localStorage = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        items[key] = window.localStorage.getItem(key) || "";
      }
    }
    return items;
  });

  // Save as Playwright storage state
  const storageState = {
    cookies,
    origins: [
      {
        origin: "https://medium.com",
        localStorage: Object.entries(localStorage).map(([name, value]) => ({
          name,
          value,
        })),
      },
    ],
  };

  // Ensure directory exists
  const dir = join(process.env.HOME || "~", ".peng-skills");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));

  console.log(`\nStorage state saved to:\n  ${STORAGE_PATH}`);
  console.log(`  Cookies: ${cookies.length}`);
  console.log(`  localStorage items: ${Object.keys(localStorage).length}`);
  console.log("\nYou can now use headless mode to publish!");

  await context.close();
}

main();
