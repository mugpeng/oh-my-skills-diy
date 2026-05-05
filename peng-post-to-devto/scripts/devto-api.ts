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

const API_BASE = "https://dev.to/api";

function getToken(): string {
  // Check .env file in skill directory
  const skillDir = dirname(new URL(import.meta.url).pathname);
  const envPaths = [
    resolve(skillDir, "..", ".peng-skills", ".env"),
    resolve(process.env.HOME || "~", ".peng-skills", ".env"),
  ];

  for (const p of envPaths) {
    try {
      const content = readFileSync(p, "utf-8");
      const match = content.match(/DEVTO_TOKEN=(.+)/);
      if (match) return match[1].trim();
    } catch {}
  }

  // Check environment variable
  const token = process.env.DEVTO_TOKEN;
  if (!token) {
    console.error("Error: DEVTO_TOKEN not found.");
    console.error("Set it via environment variable or .peng-skills/.env file.");
    console.error("See references/api-setup.md for instructions.");
    process.exit(1);
  }
  return token;
}

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
    console.error(`API Error: ${msg}`);
    if (res.status === 401) {
      console.error("Token may be invalid. Run: bun scripts/check-token.ts");
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

  const data = await apiCall("/articles", "POST", token, body);

  console.log(`\nDev.to Publishing Complete!`);
  console.log(`  Title: ${data.title}`);
  console.log(`  URL: ${data.url}`);
  console.log(`  ID: ${data.id}`);
  console.log(`  Status: ${data.published ? "Published" : "Draft"}`);
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
  default:
    console.error("Usage: devto-api.ts <command> [options]");
    console.error("\nCommands:");
    console.error("  create <file.md> [--publish] [--draft] [--org <id>]");
    console.error("  update <article_id> <file.md> [--publish] [--draft]");
    console.error("  list [--published] [--draft] [--per-page <n>]");
    console.error("  publish <article_id>");
    console.error("  unpublish <article_id>");
    process.exit(1);
}
