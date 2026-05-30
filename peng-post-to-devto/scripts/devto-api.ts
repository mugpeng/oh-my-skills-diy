#!/usr/bin/env bun

/**
 * Dev.to API wrapper for article CRUD operations.
 *
 * Usage:
 *   bun scripts/devto-api.ts create <file.md> [--publish] [--draft] [--org <id>]
 *   bun scripts/devto-api.ts update <article_id> <file.md> [--publish] [--draft]
 *   bun scripts/devto-api.ts list [--published] [--draft] [--per-page <n>]
 *   bun scripts/devto-api.ts publish <article_id>
 *   bun scripts/devto-api.ts unpublish <article_id>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, basename } from "path";
import { dirname } from "path";
import matter from "gray-matter";
import { getToken } from "./token";

const API_BASE = "https://dev.to/api";

async function apiCall(
  path: string,
  method: string,
  token: string,
  body?: object
) {
  const opts: RequestInit = {
    method,
    headers: {
      "api-key": token,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    console.error(`\nAPI Error: ${msg}`);
    if (res.status === 401) {
      console.error("Recovery: Token is invalid or expired.");
      console.error("  Run: bun scripts/check-token.ts");
      console.error("  See: references/api-setup.md");
    } else if (res.status === 422) {
      console.error("Recovery: Invalid article data.");
      console.error("  - Tags must be lowercase, alphanumeric, max 4");
      console.error("  - Title is required");
      console.error("  - cover_image must be a valid URL (not a local path)");
    } else if (res.status === 429) {
      console.error("Recovery: Rate limited. Wait a few minutes and retry.");
    } else if (!res.status || res.status >= 500) {
      console.error("Recovery: Dev.to server error or network issue.");
      console.error("  - Check https://dev.to for outage notices");
      console.error("  - Verify network connectivity");
    }
    process.exit(1);
  }
  return data;
}

function validateTags(tags: string[]): string[] {
  const validated = tags
    .map((t) => t.toLowerCase().trim().replace(/\s+/g, ""))
    .filter((t) => t.length > 0 && t.length <= 30)
    .slice(0, 4);
  return validated;
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
  overrides: { publish?: boolean; draft?: boolean; org?: string }
) {
  const raw = readFileSync(resolve(filePath), "utf-8");
  const { data: fm, content } = matter(raw);

  const title = extractTitle(content, fm.title);
  const tags = validateTags(fm.tags || []);

  let published = false;
  if (overrides.publish) published = true;
  else if (overrides.draft) published = false;
  else if (fm.published !== undefined) published = fm.published === true;

  const payload: Record<string, unknown> = {
    title,
    body_markdown: content.trimStart(),
    published,
    ...(tags.length > 0 && { tags }),
    ...(fm.series && { series: fm.series }),
    ...(fm.canonical_url && { canonical_url: fm.canonical_url }),
    ...(fm.description && { description: fm.description }),
    ...(fm.cover_image || fm.main_image
      ? { main_image: fm.cover_image || fm.main_image }
      : {}),
  };

  return { payload, title, tags, published };
}

async function cmdCreate(args: string[]) {
  const fileIdx = args.findIndex((a) => !a.startsWith("-"));
  const filePath = args[fileIdx];
  if (!filePath) {
    console.error("Usage: devto-api.ts create <file.md> [--publish] [--draft] [--org <id>]");
    process.exit(1);
  }

  const publish = args.includes("--publish");
  const draft = args.includes("--draft");
  const orgIdx = args.indexOf("--org");
  const org = orgIdx !== -1 ? args[orgIdx + 1] : undefined;

  const token = getToken();
  const { payload, title, tags, published } = buildPayload(filePath, {
    publish,
    draft,
    org,
  });

  const body: Record<string, unknown> = { article: payload };
  if (org) (body.article as Record<string, unknown>).organization_id = parseInt(org, 10);

  console.log(`Creating article: "${title}"`);
  console.log(`  Tags: ${tags.join(", ") || "none"}`);
  console.log(`  Status: ${published ? "Published" : "Draft"}`);

  let data;
  try {
    data = await apiCall("/articles", "POST", token, body);
  } catch (err) {
    console.error("\nNetwork Error: Could not reach Dev.to API.");
    console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error("\n  Recovery:");
    console.error("  - Check your internet connection");
    console.error("  - If in a sandboxed environment, ensure outbound HTTPS is allowed");
    console.error("  - If interrupted, run 'dedupe-title' before retrying to avoid duplicates");
    process.exit(1);
  }

  const statusLabel = data.published ? "Published (PUBLIC)" : "Draft (not public)";
  console.log(`\nDev.to Article Created!`);
  console.log(`  Title:  ${data.title}`);
  console.log(`  URL:    ${data.url}`);
  console.log(`  ID:     ${data.id}`);
  console.log(`  Status: ${statusLabel}`);
  if (!data.published) {
    console.log(`\n  This is a DRAFT — it is NOT publicly visible.`);
    console.log(`  To publish later: bun scripts/devto-api.ts publish ${data.id}`);
    console.log(`  To edit: ${data.url}/edit`);
  }
  return data;
}

async function cmdUpdate(args: string[]) {
  const articleId = args.find((a) => /^\d+$/.test(a));
  const filePath = args.find((a) => a.endsWith(".md") || a.endsWith(".markdown"));
  if (!articleId || !filePath) {
    console.error("Usage: devto-api.ts update <article_id> <file.md> [--publish] [--draft]");
    process.exit(1);
  }

  const publish = args.includes("--publish");
  const draft = args.includes("--draft");

  const token = getToken();
  const { payload, title } = buildPayload(filePath, { publish, draft });

  console.log(`Updating article #${articleId}: "${title}"`);

  const data = await apiCall(`/articles/${articleId}`, "PUT", token, {
    article: payload,
  });

  console.log(`\nUpdate Complete!`);
  console.log(`  Title: ${data.title}`);
  console.log(`  URL: ${data.url}`);
  console.log(`  Status: ${data.published ? "Published" : "Draft"}`);
  return data;
}

async function cmdList(args: string[]) {
  const token = getToken();
  const published = args.includes("--published");
  const draft = args.includes("--draft");
  const perPageIdx = args.indexOf("--per-page");
  const perPage = perPageIdx !== -1 ? args[perPageIdx + 1] : "10";

  let path = `/articles/me?per_page=${perPage}`;
  if (published) path = `/articles/me/published?per_page=${perPage}`;
  else if (draft) path = `/articles/me/unpublished`;

  const data = await apiCall(path, "GET", token);

  if (!Array.isArray(data) || data.length === 0) {
    console.log("No articles found.");
    return;
  }

  console.log(`Found ${data.length} article(s):\n`);
  for (const a of data) {
    const status = a.published ? "Published" : "Draft";
    console.log(`  #${a.id} [${status}] ${a.title}`);
    console.log(`    ${a.url}`);
  }
  return data;
}

async function cmdPublish(args: string[]) {
  const articleId = args.find((a) => /^\d+$/.test(a));
  if (!articleId) {
    console.error("Usage: devto-api.ts publish <article_id>");
    process.exit(1);
  }

  const token = getToken();
  console.log(`Publishing draft #${articleId}...`);
  const data = await apiCall(`/articles/${articleId}`, "PUT", token, {
    article: { published: true },
  });

  console.log(`\nPublished!`);
  console.log(`  Title: ${data.title}`);
  console.log(`  URL: ${data.url}`);
  return data;
}

async function cmdUnpublish(args: string[]) {
  const articleId = args.find((a) => /^\d+$/.test(a));
  if (!articleId) {
    console.error("Usage: devto-api.ts unpublish <article_id>");
    process.exit(1);
  }

  const token = getToken();
  console.log(`Unpublishing article #${articleId}...`);
  const data = await apiCall(`/articles/${articleId}`, "PUT", token, {
    article: { published: false },
  });

  console.log(`\nConverted to draft.`);
  console.log(`  Title: ${data.title}`);
  console.log(`  ID: ${data.id}`);
  return data;
}

async function cmdDedupeTitle(args: string[]) {
  const fileIdx = args.findIndex((a) => !a.startsWith("-"));
  const filePath = args[fileIdx];
  if (!filePath) {
    console.error("Usage: devto-api.ts dedupe-title <file.md>");
    process.exit(1);
  }

  const raw = readFileSync(resolve(filePath), "utf-8");
  const { data: fm, content } = matter(raw);
  const title = extractTitle(content, fm.title);

  const token = getToken();

  // Search drafts and published articles
  const [drafts, published] = await Promise.all([
    apiCall("/articles/me/unpublished", "GET", token) as Promise<any[]>,
    apiCall("/articles/me/published?per_page=30", "GET", token) as Promise<any[]>,
  ]);

  const all = [...(drafts || []), ...(published || [])];
  const titleLower = title.toLowerCase();
  const similar = all.filter(
    (a) => a.title && a.title.toLowerCase().trim() === titleLower
  );

  if (similar.length === 0) {
    console.log(`OK: No existing article with title "${title}".`);
    return [];
  }

  console.log(`DUPLICATE: Found ${similar.length} existing article(s) with title "${title}":\n`);
  for (const a of similar) {
    const status = a.published ? "Published" : "Draft";
    console.log(`  #${a.id} [${status}] ${a.title}`);
    console.log(`    ${a.url}`);
    console.log(`    Edit: ${a.url}/edit`);
  }
  console.log("\nUse 'update <id> <file.md>' to update an existing article, or rename the title.");
  return similar;
}

function cmdPreview(filePath: string) {
  if (!filePath) {
    console.error("Usage: devto-api.ts preview <file.md>");
    process.exit(1);
  }

  const raw = readFileSync(resolve(filePath), "utf-8");
  const { data: fm, content } = matter(raw);

  const title = extractTitle(content, fm.title);
  const tags = validateTags(fm.tags || []);
  const published = fm.published === true;
  const description = fm.description || "(not set)";
  const series = fm.series || "(not set)";
  const coverImage = fm.cover_image || fm.main_image || "(not set)";
  const canonicalUrl = fm.canonical_url || "(not set)";

  // Detect local images in body
  const localImages: string[] = [];
  const imgRegex = /!\[.*?\]\(((?!https?:\/\/)[^\)]+)\)/g;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    localImages.push(match[1]);
  }
  if (coverImage !== "(not set)" && !coverImage.startsWith("http")) {
    localImages.unshift(`[cover_image] ${coverImage}`);
  }

  console.log("=== Metadata Preview ===\n");
  console.log(`  Title:       ${title}`);
  console.log(`  Tags:        ${tags.join(", ") || "(none)"}`);
  console.log(`  Description: ${description}`);
  console.log(`  Published:   ${published ? "YES (will be public)" : "No (draft)"}`);
  console.log(`  Series:      ${series}`);
  console.log(`  Cover:       ${coverImage}`);
  console.log(`  Canonical:   ${canonicalUrl}`);
  console.log(`  Body:        ${content.split("\n").length} lines`);

  if (localImages.length > 0) {
    console.log(`\n  ⚠ Local images detected (Dev.to needs public URLs):`);
    for (const img of localImages) {
      console.log(`    - ${img}`);
    }
    console.log(`\n  These will appear as broken images. Upload them to a hosting service`);
    console.log(`  or use GitHub raw URLs (git remote + branch + path).`);
  }

  if (tags.length === 0) {
    console.log(`\n  ⚠ No tags set. Dev.to allows up to 4 tags for discoverability.`);
  }

  if (description === "(not set)") {
    console.log(`\n  ⚠ No description. Recommended for SEO and social previews.`);
  }
}

// Main
const args = process.argv.slice(2);
const cmd = args[0];

switch (cmd) {
  case "create":
    await cmdCreate(args.slice(1));
    break;
  case "update":
    await cmdUpdate(args.slice(1));
    break;
  case "list":
    await cmdList(args.slice(1));
    break;
  case "publish":
    await cmdPublish(args.slice(1));
    break;
  case "unpublish":
    await cmdUnpublish(args.slice(1));
    break;
  case "dedupe-title":
    await cmdDedupeTitle(args.slice(1));
    break;
  case "preview":
    cmdPreview(args.slice(1).find((a) => !a.startsWith("-")) || "");
    break;
  default:
    console.error("Usage: devto-api.ts <command> [options]");
    console.error("\nCommands:");
    console.error("  create <file.md> [--publish] [--draft] [--org <id>]");
    console.error("  update <article_id> <file.md> [--publish] [--draft]");
    console.error("  list [--published] [--draft] [--per-page <n>]");
    console.error("  publish <article_id>");
    console.error("  unpublish <article_id>");
    console.error("  dedupe-title <file.md>");
    console.error("  preview <file.md>");
    process.exit(1);
}
