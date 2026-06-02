#!/usr/bin/env bun

/**
 * Medium publishing via Playwright browser automation.
 *
 * Usage:
 *   bun scripts/medium-publish.ts login               # Log in and save session
 *   bun scripts/medium-publish.ts publish <file.md>   # Publish a post
 *   bun scripts/medium-publish.ts preview <file.md>   # Preview metadata
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import { sessionExists, saveSession, loadSession } from "./session";
import { parseMarkdown } from "./md-to-html";

// ─── Login ───────────────────────────────────────────────────────────

async function cmdLogin() {
  console.log("Opening Medium login page...\n");
  console.log("Steps:");
  console.log("  1. Log in to Medium in the browser window");
  console.log("  2. Once logged in, come back here and press Enter");
  console.log();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://medium.com/m/signin", { waitUntil: "domcontentloaded" });

  // Wait for user to press Enter in terminal
  console.log("Waiting for you to log in... (press Enter when done)");
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  // Check if actually logged in
  const url = page.url();
  if (url.includes("/signin") || url.includes("/oauth")) {
    console.log("\nWARNING: You still appear to be on the login page.");
    console.log("Make sure you complete the login before pressing Enter.");
    console.log("Session will be saved anyway — you can re-run 'login' if needed.\n");
  }

  await saveSession(context);
  await browser.close();
  console.log("\nDone! You can now use 'publish' to post articles.");
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

  if (!sessionExists()) {
    console.error("\nNo saved session. Run 'login' first:");
    console.error("  bun scripts/medium-publish.ts login");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await loadSession(context);
  const page = await context.newPage();

  // Navigate to new story
  const storyUrl = post.publicationId
    ? `https://medium.com/p/${post.publicationId}/new-story`
    : "https://medium.com/new-story";

  await page.goto(storyUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Check if redirected to login
  if (page.url().includes("/signin") || page.url().includes("/oauth")) {
    console.error("\nSession expired. Please log in again:");
    console.error("  bun scripts/medium-publish.ts login");
    await browser.close();
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
    // Scroll to bottom to find the publish/settings area
    await page.keyboard.press("Control+End");
    await page.waitForTimeout(500);

    // Look for tag input area
    const tagInput = page.locator('[data-testid="tagInput"], input[placeholder*="tag"], input[placeholder*="Tag"], .js-tagInput').first();
    const tagInputVisible = await tagInput.isVisible().catch(() => false);

    if (tagInputVisible) {
      for (const tag of post.tags) {
        await tagInput.fill(tag);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
      }
    } else {
      // Try clicking a "Add tag" button first
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
    // Save as draft — click "Save" or use Ctrl+S
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(2000);
    console.log("\nSaved as DRAFT.");
  } else {
    // Click Publish button
    const publishBtn = page.locator('button:has-text("Publish"), button:has-text("Publish…"), [data-testid="publishButton"]').first();
    await publishBtn.click();
    await page.waitForTimeout(1000);

    // Confirm publish dialog if it appears
    const confirmBtn = page.locator('button:has-text("Publish now"), button:has-text("Publish and share"), [data-testid="confirmPublish"]').first();
    const confirmVisible = await confirmBtn.isVisible().catch(() => false);
    if (confirmVisible) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }

    console.log("\nPublished!");
  }

  // Try to get the URL
  const finalUrl = page.url();
  console.log(`\nMedium Post Created!`);
  console.log(`  Title:  ${post.title}`);
  console.log(`  URL:    ${finalUrl}`);
  console.log(`  Status: ${post.publishStatus}`);

  if (post.publishStatus === "draft") {
    console.log(`\n  This is a DRAFT — it is NOT publicly visible.`);
    console.log(`  Edit it on Medium to publish.`);
  }

  await browser.close();
}

// ─── Preview ─────────────────────────────────────────────────────────

function cmdPreview(filePath: string) {
  if (!filePath) {
    console.error("Usage: medium-publish.ts preview <file.md>");
    process.exit(1);
  }

  const post = parseMarkdown(filePath);

  // Detect local images in the original file
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
    console.error("  login                            Log in and save session");
    console.error("  publish <file.md> [--publish|--draft|--unlisted] [--pub <id>]");
    console.error("  preview <file.md>                Preview metadata");
    process.exit(1);
}
