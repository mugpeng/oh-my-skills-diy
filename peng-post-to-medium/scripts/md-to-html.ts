/**
 * Parse a Markdown file with frontmatter and convert body to HTML
 * for pasting into Medium's editor.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import matter from "gray-matter";
import { marked } from "marked";

export interface ParsedPost {
  title: string;
  html: string;
  tags: string[];
  canonicalUrl?: string;
  publishStatus: "public" | "draft" | "unlisted";
  publicationId?: string;
}

function extractTitle(content: string, fmTitle?: string): string {
  if (fmTitle) return fmTitle;
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const first = content.split("\n").find((l) => l.trim().length > 0);
  if (first) {
    const clean = first.replace(/^#+\s*/, "").trim();
    return clean.length > 100 ? clean.slice(0, 97) + "..." : clean;
  }
  return "Untitled";
}

export function parseMarkdown(filePath: string, overrides?: {
  publish?: boolean;
  draft?: boolean;
  unlisted?: boolean;
  pub?: string;
}): ParsedPost {
  const raw = readFileSync(resolve(filePath), "utf-8");
  const { data: fm, content } = matter(raw);

  const title = extractTitle(content, fm.title);
  const tags = (fm.tags || [])
    .map((t: string) => t.trim())
    .filter((t: string) => t.length > 0 && t.length <= 25)
    .slice(0, 3);

  let publishStatus: "public" | "draft" | "unlisted" = "draft";
  if (overrides?.draft) publishStatus = "draft";
  else if (overrides?.unlisted) publishStatus = "unlisted";
  else if (overrides?.publish) publishStatus = "public";
  else if (fm.published === true) publishStatus = "public";
  else if (fm.published === false) publishStatus = "draft";

  // Remove the first H1 from body if it matches the title (avoid duplication in Medium editor)
  let body = content.trimStart();
  const h1Match = body.match(/^#\s+(.+)\n*/);
  if (h1Match && fm.title && h1Match[1].trim() === fm.title) {
    body = body.slice(h1Match[0].length);
  }

  const html = marked.parse(body) as string;

  return {
    title,
    html,
    tags,
    canonicalUrl: fm.canonical_url || undefined,
    publishStatus,
    publicationId: overrides?.pub || fm.publication_id || undefined,
  };
}
