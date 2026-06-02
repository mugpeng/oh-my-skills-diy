#!/usr/bin/env bun

/**
 * Medium publishing via Playwright browser automation.
 *
 * Uses system Chrome with default profile — no separate login needed.
 * If Chrome is running, falls back to a temp profile (requires manual login).
 *
 * Usage:
 *   bun scripts/medium-publish.ts publish <file.md>   # Publish a post
 *   bun scripts/medium-publish.ts preview <file.md>   # Preview metadata
 *   bun scripts/medium-publish.ts login               # Fallback: manual login
 */

import { readFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { chromium } from "playwright";
import { getDefaultChromeProfileDir, hasDefaultChromeProfile } from "./session";
import { parseMarkdown } from "./md-to-html";

const STORAGE_STATE_PATH = join(
  process.env.HOME || "~",
  ".peng-skills",
  "medium-storage-state.json"
);

const TEMP_PROFILE_DIR = join(
  process.env.HOME || "~",
  ".peng-skills",
  "medium-chrome-profile"
);

// ─── Browser launch helpers ──────────────────────────────────────────

/**
 * Launch Chrome with the default profile (headful).
 * Fails if Chrome is already running with the same profile.
 */
async function launchWithDefaultProfile(headless: boolean) {
  const profileDir = getDefaultChromeProfileDir();
  if (!hasDefaultChromeProfile()) {
    console.error(`Chrome profile not found at:\n  ${profileDir}\n`);
    console.error("Install Chrome or use 'login' with a temp profile.");
    process.exit(1);
  }

  try {
    const context = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless,
    });
    return context;
  } catch (err: any) {
    if (err?.message?.includes("user data directory is already in use")) {
      console.error("Chrome is already running with the same profile.\n");
      console.error("Options:");
      console.error("  1. Close Chrome and retry");
      console.error("  2. Use 'login' to create a separate session");
      process.exit(1);
    }
    throw err;
  }
}

// ─── Login (fallback) ────────────────────────────────────────────────

async function cmdLogin() {
  console.log("Opening Medium login page...\n");
  console.log("Steps:");
  console.log("  1. Log in to Medium in the browser window");
  console.log("  2. Once logged in, close the browser window");
  console.log();

  // Use a temp profile directory for the fallback session
  const tempProfile = join(
    process.env.HOME || "~",
    ".peng-skills",
    "medium-chrome-profile"
  );

  const context = await chromium.launchPersistentContext(tempProfile, {
    channel: "chrome",
    headless: false,
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto("https://medium.com/m/signin", { waitUntil: "domcontentloaded" });

  console.log("Waiting for you to log in... (close the browser when done)");

  // Wait for the browser to close
  await new Promise<void>((resolve) => {
    context.on("close", () => resolve());
  });

  console.log("\nSession saved! You can now use 'publish' to post articles.");
}

// ─── Publish ─────────────────────────────────────────────────────────

async function cmdPublish(args: string[]) {
  const fileIdx = args.findIndex((a) => !a.startsWith("-"));
  const filePath = args[fileIdx];
  if (!filePath) {
    console.error("Usage: medium-publish.ts publish <file.md> [--publish] [--draft] [--unlisted] [--pub <id>]");
    process.exit(1);
  }

  const hasPublish = args.includes("--publish");
  const hasDraft = args.includes("--draft");
  const hasUnlisted = args.includes("--unlisted");
  const pubIdx = args.indexOf("--pub");
  const pub = pubIdx !== -1 ? args[pubIdx + 1] : undefined;

  const post = parseMarkdown(filePath, {
    publish: hasPublish,
    draft: hasDraft,
    unlisted: hasUnlisted,
    pub,
  });

  console.log(`Publishing: "${post.title}"`);
  console.log(`  Tags:   ${post.tags.join(", ") || "none"}`);
  console.log(`  Status: ${post.publishStatus}`);

  // Try default Chrome profile first; fall back to temp profile
  let context;
  let usingDefaultProfile = false;

  if (hasDefaultChromeProfile()) {
    try {
      context = await launchWithDefaultProfile(false);
      usingDefaultProfile = true;
    } catch {
      // Fall through to temp profile
    }
  }

  if (!context) {
    // Ensure temp profile directory exists
    if (!existsSync(TEMP_PROFILE_DIR)) {
      mkdirSync(TEMP_PROFILE_DIR, { recursive: true });
    }

    // Check if we have saved storage state from Chrome profile
    if (existsSync(STORAGE_STATE_PATH)) {
      console.log("Using saved login session...");
      context = await chromium.launchPersistentContext(TEMP_PROFILE_DIR, {
        channel: "chrome",
        headless: false,
        storageState: STORAGE_STATE_PATH,
      });
    } else {
      context = await chromium.launchPersistentContext(TEMP_PROFILE_DIR, {
        channel: "chrome",
        headless: false,
      });
    }
  }

  const page = context.pages()[0] || await context.newPage();

  // Navigate to new story
  const storyUrl = post.publicationId
    ? `https://medium.com/p/${post.publicationId}/new-story`
    : "https://medium.com/new-story";

  await page.goto(storyUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Check if redirected to login
  if (page.url().includes("/signin") || page.url().includes("/oauth")) {
    console.error("\nNot logged in. Options:");
    console.error("  1. Log in to Chrome normally and retry");
    console.error("  2. Run 'login' to create a separate session");
    await context.close();
    process.exit(1);
  }

  // ── Set title ──
  const titleEditor = page.locator('[data-testid="editorTitle"], .graf--title, [contenteditable="true"]').first();
  await titleEditor.waitFor({ timeout: 10000 });
  await titleEditor.click();
  await titleEditor.fill("");
  await page.keyboard.type(post.title, { delay: 10 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);

  // ── Set content (paste HTML) ──
  const bodyEditor = page.locator('[data-testid="editorBody"], .graf--p, [contenteditable="true"]').nth(1);
  await bodyEditor.waitFor({ timeout: 5000 });
  await bodyEditor.click();

  // Use clipboard to paste HTML
  await page.evaluate((html: string) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/html", html);
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData,
    });
    document.querySelector('[contenteditable="true"]')?.dispatchEvent(event);
  }, post.html);
  await page.waitForTimeout(1000);

  // ── Set tags ──
  if (post.tags.length > 0) {
    await page.keyboard.press("Control+End");
    await page.waitForTimeout(500);

    const tagInput = page.locator('[data-testid="tagInput"], input[placeholder*="tag"], input[placeholder*="Tag"], .js-tagInput').first();
    const tagInputVisible = await tagInput.isVisible().catch(() => false);

    if (tagInputVisible) {
      for (const tag of post.tags) {
        await tagInput.fill(tag);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
      }
    } else {
      const addTagBtn = page.locator('button:has-text("Add a tag"), button:has-text("Add tag"), [data-testid="addTag"]').first();
      const btnVisible = await addTagBtn.isVisible().catch(() => false);
      if (btnVisible) {
        await addTagBtn.click();
        await page.waitForTimeout(500);
        const tagInputAfter = page.locator('input[placeholder*="tag"], input[placeholder*="Tag"]').first();
        for (const tag of post.tags) {
          await tagInputAfter.fill(tag);
          await page.keyboard.press("Enter");
          await page.waitForTimeout(300);
        }
      }
    }
  }

  // ── Publish or save as draft ──
  if (post.publishStatus === "draft") {
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(2000);
    console.log("\nSaved as DRAFT.");
  } else {
    const publishBtn = page.locator('button:has-text("Publish"), button:has-text("Publish…"), [data-testid="publishButton"]').first();
    await publishBtn.click();
    await page.waitForTimeout(1000);

    const confirmBtn = page.locator('button:has-text("Publish now"), button:has-text("Publish and share"), [data-testid="confirmPublish"]').first();
    const confirmVisible = await confirmBtn.isVisible().catch(() => false);
    if (confirmVisible) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }

    console.log("\nPublished!");
  }

  const finalUrl = page.url();
  console.log(`\nMedium Post Created!`);
  console.log(`  Title:   ${post.title}`);
  console.log(`  URL:     ${finalUrl}`);
  console.log(`  Status:  ${post.publishStatus}`);
  console.log(`  Profile: ${usingDefaultProfile ? "Chrome default" : "saved session"}`);

  if (post.publishStatus === "draft") {
    console.log(`\n  This is a DRAFT — it is NOT publicly visible.`);
    console.log(`  Edit it on Medium to publish.`);
  }

  await context.close();
}

// ─── Preview ─────────────────────────────────────────────────────────

function cmdPreview(filePath: string) {
  if (!filePath) {
    console.error("Usage: medium-publish.ts preview <file.md>");
    process.exit(1);
  }

  const post = parseMarkdown(filePath);

  const raw = readFileSync(resolve(filePath), "utf-8");
  const localImages: string[] = [];
  const imgRegex = /!\[.*?\]\(((?!https?:\/\/)[^\)]+)\)/g;
  let match;
  while ((match = imgRegex.exec(raw)) !== null) {
    localImages.push(match[1]);
  }

  console.log("=== Metadata Preview ===\n");
  console.log(`  Title:         ${post.title}`);
  console.log(`  Tags:          ${post.tags.join(", ") || "(none)"}`);
  console.log(`  PublishStatus: ${post.publishStatus}`);
  console.log(`  Canonical:     ${post.canonicalUrl || "(not set)"}`);
  console.log(`  Publication:   ${post.publicationId || "(personal profile)"}`);
  console.log(`  Body:          ${post.html.split("\n").length} lines (HTML)`);

  if (localImages.length > 0) {
    console.log(`\n  ⚠ Local images detected (Medium needs public URLs):`);
    for (const img of localImages) {
      console.log(`    - ${img}`);
    }
  }

  if (post.tags.length === 0) {
    console.log(`\n  ⚠ No tags set. Medium allows up to 3 tags.`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];

switch (cmd) {
  case "login":
    await cmdLogin();
    break;
  case "publish":
    await cmdPublish(args.slice(1));
    break;
  case "preview":
    cmdPreview(args.slice(1).find((a) => !a.startsWith("-")) || "");
    break;
  default:
    console.error("Usage: medium-publish.ts <command> [options]");
    console.error("\nCommands:");
    console.error("  publish <file.md> [--publish|--draft|--unlisted] [--pub <id>]");
    console.error("  preview <file.md>                Preview metadata");
    console.error("  login                            Fallback: manual login with temp profile");
    process.exit(1);
}
