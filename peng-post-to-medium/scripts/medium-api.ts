#!/usr/bin/env bun

/**
 * Medium API wrapper for post operations.
 *
 * Usage:
 *   bun scripts/medium-api.ts create <file.md> [--publish] [--draft] [--unlisted] [--pub <id>] [--notify]
 *   bun scripts/medium-api.ts list [--per-page <n>]
 *   bun scripts/medium-api.ts publications
 *   bun scripts/medium-api.ts preview <file.md>
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import matter from "gray-matter";
import { getToken } from "./token";

const API_BASE = "https://api.medium.com/v1";

async function apiCall(
  path: string,
  method: string,
  token: string,
  body?: object
) {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.errors?.[0]?.message || data?.message || `HTTP ${res.status}`;
    console.error(`\nAPI Error: ${msg}`);
    if (res.status === 401) {
      console.error("Recovery: Token is invalid or expired.");
      console.error("  Run: bun scripts/check-token.ts");
      console.error("  See: references/api-setup.md");
    } else if (res.status === 403) {
      console.error("Recovery: Token lacks required permissions.");
      console.error("  Ensure the token has 'Write' scope.");
    } else if (res.status === 422) {
      console.error("Recovery: Invalid post data.");
      console.error("  - Title is required");
      console.error("  - Content is required");
      console.error("  - Tags: max 3, each max 25 characters");
      console.error("  - publishStatus must be 'public', 'draft', or 'unlisted'");
    } else if (res.status === 429) {
      console.error("Recovery: Rate limited. Medium allows 1000 requests/hour.");
      console.error("  Wait a few minutes and retry.");
    } else if (!res.status || res.status >= 500) {
      console.error("Recovery: Medium server error or network issue.");
      console.error("  - Check https://status.medium.com for outage notices");
      console.error("  - Verify network connectivity");
    }
    process.exit(1);
  }
  return data;
}

async function getUserId(token: string): Promise<string> {
  const data = await apiCall("/me", "GET", token);
  return data.data.id;
}

function validateTags(tags: string[]): string[] {
  return tags
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 25)
    .slice(0, 3);
}

function extractTitle(content: string, fmTitle?: string): string {
  if (fmTitle) return fmTitle;
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const h2 = content.match(/^##\s+(.+)$/m);
  if (h2) return h2[1].trim();
  const first = content.split("\n").find((l) => l.trim().length > 0);
  if (first) {
    const clean = first.replace(/^#+\s*/, "").trim();
    return clean.length > 100 ? clean.slice(0, 97) + "..." : clean;
  }
  return "Untitled";
}

function buildPayload(
  filePath: string,
  overrides: { publish?: boolean; draft?: boolean; unlisted?: boolean; pub?: string; notify?: boolean }
) {
  const raw = readFileSync(resolve(filePath), "utf-8");
  const { data: fm, content } = matter(raw);

  const title = extractTitle(content, fm.title);
  const tags = validateTags(fm.tags || []);

  let publishStatus = "public";
  if (overrides.draft) publishStatus = "draft";
  else if (overrides.unlisted) publishStatus = "unlisted";
  else if (overrides.publish) publishStatus = "public";
  else if (fm.published === false) publishStatus = "draft";

  const payload: Record<string, unknown> = {
    title,
    contentFormat: "markdown",
    content: content.trimStart(),
    publishStatus,
    ...(tags.length > 0 && { tags }),
    ...(fm.canonical_url && { canonicalUrl: fm.canonical_url }),
    ...(overrides.notify && { notifyFollowers: true }),
  };

  return { payload, title, tags, publishStatus, publicationId: overrides.pub || fm.publication_id };
}

async function cmdCreate(args: string[]) {
  const fileIdx = args.findIndex((a) => !a.startsWith("-"));
  const filePath = args[fileIdx];
  if (!filePath) {
    console.error("Usage: medium-api.ts create <file.md> [--publish] [--draft] [--unlisted] [--pub <id>] [--notify]");
    process.exit(1);
  }

  const publish = args.includes("--publish");
  const draft = args.includes("--draft");
  const unlisted = args.includes("--unlisted");
  const notify = args.includes("--notify");
  const pubIdx = args.indexOf("--pub");
  const pub = pubIdx !== -1 ? args[pubIdx + 1] : undefined;

  const token = getToken();
  const userId = await getUserId(token);
  const { payload, title, tags, publishStatus, publicationId } = buildPayload(filePath, {
    publish,
    draft,
    unlisted,
    pub,
    notify,
  });

  console.log(`Creating post: "${title}"`);
  console.log(`  Tags:   ${tags.join(", ") || "none"}`);
  console.log(`  Status: ${publishStatus}`);

  const endpoint = publicationId
    ? `/publications/${publicationId}/posts`
    : `/users/${userId}/posts`;

  let data;
  try {
    data = await apiCall(endpoint, "POST", token, payload);
  } catch (err) {
    console.error("\nNetwork Error: Could not reach Medium API.");
    console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error("\n  Recovery:");
    console.error("  - Check your internet connection");
    console.error("  - If in a sandboxed environment, ensure outbound HTTPS is allowed");
    process.exit(1);
  }

  const post = data.data;
  const statusLabel =
    publishStatus === "public"
      ? "Published (PUBLIC)"
      : publishStatus === "unlisted"
        ? "Unlisted (link-only)"
        : "Draft (not public)";

  console.log(`\nMedium Post Created!`);
  console.log(`  Title:  ${post.title}`);
  console.log(`  URL:    ${post.url}`);
  console.log(`  ID:     ${post.id}`);
  console.log(`  Status: ${statusLabel}`);

  if (publishStatus === "draft") {
    console.log(`\n  This is a DRAFT — it is NOT publicly visible.`);
    console.log(`  To publish: edit it on Medium and change the status.`);
  }

  return post;
}

async function cmdList(args: string[]) {
  const token = getToken();
  const userId = await getUserId(token);

  console.log("Note: Medium API does not support listing posts directly.");
  console.log("Visit your Medium profile to see all posts:");
  console.log(`  https://medium.com/@${userId}`);
  console.log("\nAlternatively, use 'publications' command to list your publications.");
}

async function cmdPublications(args: string[]) {
  const token = getToken();
  const userId = await getUserId(token);

  console.log("Fetching your publications...\n");
  const data = await apiCall(`/users/${userId}/publications`, "GET", token);

  if (!data.data || data.data.length === 0) {
    console.log("No publications found.");
    console.log("You can still publish posts to your personal profile.");
    return;
  }

  console.log(`Found ${data.data.length} publication(s):\n`);
  for (const pub of data.data) {
    console.log(`  ${pub.name}`);
    console.log(`    ID:  ${pub.id}`);
    console.log(`    URL: ${pub.url}`);
    console.log();
  }
  return data.data;
}

function cmdPreview(filePath: string) {
  if (!filePath) {
    console.error("Usage: medium-api.ts preview <file.md>");
    process.exit(1);
  }

  const raw = readFileSync(resolve(filePath), "utf-8");
  const { data: fm, content } = matter(raw);

  const title = extractTitle(content, fm.title);
  const tags = validateTags(fm.tags || []);
  const published = fm.published !== false;
  const canonicalUrl = fm.canonical_url || "(not set)";
  const publicationId = fm.publication_id || "(not set)";

  // Detect local images in body
  const localImages: string[] = [];
  const imgRegex = /!\[.*?\]\(((?!https?:\/\/)[^\)]+)\)/g;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    localImages.push(match[1]);
  }

  console.log("=== Metadata Preview ===\n");
  console.log(`  Title:         ${title}`);
  console.log(`  Tags:          ${tags.join(", ") || "(none)"}`);
  console.log(`  PublishStatus: ${published ? "public" : "draft"}`);
  console.log(`  Canonical:     ${canonicalUrl}`);
  console.log(`  Publication:   ${publicationId}`);
  console.log(`  Body:          ${content.split("\n").length} lines`);

  if (localImages.length > 0) {
    console.log(`\n  ⚠ Local images detected (Medium needs public URLs):`);
    for (const img of localImages) {
      console.log(`    - ${img}`);
    }
    console.log(`\n  These will appear as broken images. Upload them to a hosting service`);
    console.log(`  or use GitHub raw URLs (git remote + branch + path).`);
  }

  if (tags.length === 0) {
    console.log(`\n  ⚠ No tags set. Medium allows up to 3 tags for discoverability.`);
  }

  if (tags.length > 3) {
    console.log(`\n  ⚠ Too many tags (${tags.length}). Medium allows max 3. Only the first 3 will be used.`);
  }
}

// Main
const args = process.argv.slice(2);
const cmd = args[0];

switch (cmd) {
  case "create":
    await cmdCreate(args.slice(1));
    break;
  case "list":
    await cmdList(args.slice(1));
    break;
  case "publications":
    await cmdPublications(args.slice(1));
    break;
  case "preview":
    cmdPreview(args.slice(1).find((a) => !a.startsWith("-")) || "");
    break;
  default:
    console.error("Usage: medium-api.ts <command> [options]");
    console.error("\nCommands:");
    console.error("  create <file.md> [--publish] [--draft] [--unlisted] [--pub <id>] [--notify]");
    console.error("  list [--per-page <n>]");
    console.error("  publications");
    console.error("  preview <file.md>");
    process.exit(1);
}
