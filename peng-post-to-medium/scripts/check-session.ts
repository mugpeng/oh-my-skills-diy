#!/usr/bin/env bun

/**
 * Verify that the Medium session is available.
 *
 * Checks in order:
 *   1. Default Chrome profile (if Chrome not running)
 *   2. Saved temp profile (~/.peng-skills/medium-chrome-profile/)
 *
 * Usage: bun scripts/check-session.ts
 */

import { existsSync } from "fs";
import { join } from "path";
import { chromium } from "playwright";
import { getDefaultChromeProfileDir, hasDefaultChromeProfile } from "./session";

async function checkProfile(profileDir: string, label: string): Promise<boolean> {
  try {
    const context = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless: true,
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto("https://medium.com/me/stories", { waitUntil: "domcontentloaded" });

    const url = page.url();
    const loggedIn = !url.includes("/signin") && !url.includes("/oauth");

    await context.close();
    return loggedIn;
  } catch (err: any) {
    if (err?.message?.includes("user data directory is already in use")) {
      console.log(`  ⚠ Chrome is running — cannot check ${label} profile`);
      return false;
    }
    return false;
  }
}

async function main() {
  console.log("=== Medium Session Check ===\n");

  // Check 1: Default Chrome profile
  if (hasDefaultChromeProfile()) {
    const dir = getDefaultChromeProfileDir();
    console.log(`Checking default Chrome profile:\n  ${dir}`);
    const loggedIn = await checkProfile(dir, "default Chrome");
    if (loggedIn) {
      console.log("OK: Logged in via default Chrome profile.\n");
      console.log("All checks passed. Ready to publish!");
      return;
    }
    console.log("  Not logged in to Medium in Chrome profile.\n");
  } else {
    console.log("No default Chrome profile found.\n");
  }

  // Check 2: Saved temp profile
  const tempProfile = join(
    process.env.HOME || "~",
    ".peng-skills",
    "medium-chrome-profile"
  );
  if (existsSync(tempProfile)) {
    console.log(`Checking saved session profile:\n  ${tempProfile}`);
    const loggedIn = await checkProfile(tempProfile, "saved session");
    if (loggedIn) {
      console.log("OK: Logged in via saved session.\n");
      console.log("All checks passed. Ready to publish!");
      return;
    }
    console.log("  Saved session expired.\n");
  }

  // Neither works
  console.log("FAIL: No valid session found.\n");
  console.log("To fix:");
  console.log("  Option 1: Log in to Chrome normally and use it directly");
  console.log("  Option 2: Run 'bun scripts/medium-publish.ts login' for a separate session");
  process.exit(1);
}

main();
