#!/usr/bin/env bun

/**
 * Verify that the saved Medium session is still valid.
 *
 * Usage: bun scripts/check-session.ts
 */

import { chromium } from "playwright";
import { sessionExists, loadSession } from "./session";

async function main() {
  console.log("=== Medium Session Check ===\n");

  if (!sessionExists()) {
    console.log("FAIL: No saved session found.\n");
    console.log("To fix:");
    console.log("  bun scripts/medium-publish.ts login");
    process.exit(1);
  }

  console.log("OK: Session file found.");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await loadSession(context);

  const page = await context.newPage();
  await page.goto("https://medium.com/me/stories", { waitUntil: "domcontentloaded" });

  // If redirected to login, session is expired
  const url = page.url();
  if (url.includes("/signin") || url.includes("/oauth")) {
    console.log("FAIL: Session expired. Please log in again.\n");
    console.log("To fix:");
    console.log("  bun scripts/medium-publish.ts login");
    await browser.close();
    process.exit(1);
  }

  // Check for user-specific elements
  const hasAvatar = await page.locator("img[alt*='avatar'], img[alt*='Avatar'], [data-testid='headerUserAvatar']").first().isVisible().catch(() => false);
  const hasMenu = await page.locator("[data-testid='headerUserMenu'], .avatar, .js-avatar").first().isVisible().catch(() => false);

  if (hasAvatar || hasMenu) {
    console.log("OK: Session is valid. Logged in to Medium.\n");
    console.log("All checks passed. Ready to publish!");
  } else {
    // Might still be logged in, check the page content
    const bodyText = await page.textContent("body").catch(() => "");
    if (bodyText && !bodyText.includes("Sign in") && !bodyText.includes("Sign In")) {
      console.log("OK: Session appears valid.\n");
      console.log("All checks passed. Ready to publish!");
    } else {
      console.log("FAIL: Session may be expired. Please log in again.\n");
      console.log("To fix:");
      console.log("  bun scripts/medium-publish.ts login");
      await browser.close();
      process.exit(1);
    }
  }

  await browser.close();
}

main();
