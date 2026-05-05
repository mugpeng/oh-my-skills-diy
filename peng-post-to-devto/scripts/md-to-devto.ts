#!/usr/bin/env bun

/**
 * Parse a Markdown file with frontmatter into a Dev.to API payload.
 *
 * Usage:
 *   bun scripts/md-to-devto.ts <file.md> [--json] [--body-only]
 *
 * Output:
 *   JSON payload for POST /api/articles (default, compact)
 *   --json: pretty-printed JSON
 *   --body-only: just the markdown body (frontmatter stripped)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import matter from "gray-matter";

interface DevtoPayload {
  article: {
    title: string;
    body_markdown: string;
    published: boolean;
    tags?: string[];
    series?: string;
    canonical_url?: string;
    description?: string;
    main_image?: string;
    organization_id?: number;
  };
}

function parseArgs(args: string[]) {
  const flags = { json: false, bodyOnly: false, file: "" };
  for (const arg of args) {
    if (arg === "--json") flags.json = true;
    else if (arg === "--body-only") flags.bodyOnly = true;
    else if (!arg.startsWith("-") && !flags.file) flags.file = arg;
  }
  return flags;
}

function validateTags(tags: string[]): string[] {
  return tags
    .map((t) => t.toLowerCase().trim().replace(/\s+/g, ""))
    .filter((t) => t.length > 0 && t.length <= 30)
    .slice(0, 4);
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

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (!flags.file) {
    console.error("Usage: md-to-devto.ts <file.md> [--json] [--body-only]");
    process.exit(1);
  }

  const filePath = resolve(flags.file);
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file: ${filePath}`);
    process.exit(1);
  }

  const { data: fm, content } = matter(raw);

  if (flags.bodyOnly) {
    process.stdout.write(content.trimStart());
    return;
  }

  const title = extractTitle(content, fm.title);
  const tags = validateTags(fm.tags || []);
  const published = fm.published === true;
  const description = fm.description || undefined;
  const series = fm.series || undefined;
  const canonicalUrl = fm.canonical_url || undefined;
  const mainImage = fm.cover_image || fm.main_image || undefined;

  const payload: DevtoPayload = {
    article: {
      title,
      body_markdown: content.trimStart(),
      published,
      ...(tags.length > 0 && { tags }),
      ...(series && { series }),
      ...(canonicalUrl && { canonical_url: canonicalUrl }),
      ...(description && { description }),
      ...(mainImage && { main_image: mainImage }),
    },
  };

  if (flags.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(JSON.stringify(payload));
  }
}

main();
