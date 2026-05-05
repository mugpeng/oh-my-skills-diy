---
name: peng-post-to-devto
description: Posts articles to Dev.to via REST API. Supports Markdown with frontmatter (title, tags, description, cover_image, canonical_url, series), draft/publish workflow, article management, and cross-posting with canonical URLs. Use when user mentions "post to dev.to", "publish devto", "dev.to 发布", "developer blog post", or provides dev.to article URLs.
---

# Post to Dev.to

Publish articles to Dev.to via its REST API. Supports Markdown input with frontmatter, drafts, cover images, tags, series, and cross-posting with canonical URLs.

## Script Directory

`{baseDir}` = this SKILL.md's directory. Resolve `${BUN_X}`: prefer `bun`; else `npx -y bun`; else suggest `brew install oven-sh/bun/bun`.

| Script | Purpose |
|--------|---------|
| `scripts/devto-api.ts` | Article CRUD: create, update, list, publish drafts |
| `scripts/md-to-devto.ts` | Parse Markdown + frontmatter into Dev.to API payload |
| `scripts/check-token.ts` | Verify DEVTO_TOKEN is valid |

## Preferences (EXTEND.md)

Check these paths in order; first hit wins:

| Path | Scope |
|------|-------|
| `.peng-skills/peng-post-to-devto/EXTEND.md` | Project |
| `${XDG_CONFIG_HOME:-$HOME/.config}/peng-skills/peng-post-to-devto/EXTEND.md` | XDG |
| `$HOME/.peng-skills/peng-post-to-devto/EXTEND.md` | User home |

Found -> read, parse, apply. Not found -> use defaults.

**Supported keys**:

| Key | Default | Description |
|-----|---------|-------------|
| `default_tags` | empty | Default tags (comma-separated) when frontmatter has none |
| `default_series` | empty | Default series name |
| `canonical_url_base` | empty | Base URL for cross-posting (e.g. `https://myblog.com`) |
| `auto_publish` | `false` | `true` = publish immediately; `false` = save as draft |
| `default_org` | empty | Organization ID to publish under |

**Value priority**: CLI args -> frontmatter -> EXTEND.md -> skill defaults.

## Pre-flight Check

Before first use, verify the API token:

```bash
${BUN_X} {baseDir}/scripts/check-token.ts
```

If token is missing or invalid, follow setup in `references/api-setup.md`.

## Article Posting Workflow

```
Step 1: Load preferences (EXTEND.md)
Step 2: Parse input and extract metadata
Step 3: Resolve tags, series, canonical URL
Step 4: Publish to Dev.to
Step 5: Report completion
```

### Step 1: Load Preferences

Check and load EXTEND.md. If not found, use defaults.

### Step 2: Parse Input

| Input | Detection | Action |
|-------|-----------|--------|
| Markdown file | Path ends `.md`, file exists | Parse frontmatter + body |
| Plain text | Not a file path, or file doesn't exist | Save to markdown, then parse |

**Plain-text handling**:
1. Generate slug (first 2-4 meaningful words, kebab-case).
2. Save to `post-to-devto/YYYY-MM-DD/<slug>.md`.
3. Continue as markdown file.

**Frontmatter fields**:

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Article title (auto-generated from first H1 if missing) |
| `description` | No | One-line summary for previews and SEO |
| `tags` | No | Array of up to 4 tags (lowercase, no spaces) |
| `published` | No | `true` to publish, `false` for draft |
| `cover_image` | No | Cover image URL |
| `canonical_url` | No | Original URL if cross-posting |
| `series` | No | Series name to group articles |

Example frontmatter:
```yaml
---
title: "Building a CLI with Rust"
description: "A step-by-step guide to building command-line tools in Rust"
tags: [rust, cli, tutorial, beginners]
published: false
cover_image: https://example.com/cover.png
canonical_url: https://myblog.com/rust-cli
series: "Rust Fundamentals"
---
```

### Step 3: Resolve Metadata

1. **Tags**: frontmatter `tags` -> EXTEND.md `default_tags` -> ask user. Max 4, lowercase, no spaces.
2. **Series**: CLI `--series` -> frontmatter `series` -> EXTEND.md `default_series` -> omit.
3. **Canonical URL**: CLI `--canonical` -> frontmatter `canonical_url` -> EXTEND.md `canonical_url_base` + slug -> omit.
4. **Published**: CLI `--publish`/`--draft` -> frontmatter `published` -> EXTEND.md `auto_publish` -> `false`.
5. **Cover image**: CLI `--cover` -> frontmatter `cover_image` -> omit.
6. **Org**: CLI `--org` -> EXTEND.md `default_org` -> omit.

### Step 4: Publish

```bash
${BUN_X} {baseDir}/scripts/devto-api.ts create <file> [--publish] [--draft] [--org <id>]
```

Or update existing:
```bash
${BUN_X} {baseDir}/scripts/devto-api.ts update <article_id> <file> [--publish] [--draft]
```

### Step 5: Completion Report

```
Dev.to Publishing Complete!

Input: [type] - [path]
Article:
  Title: [title]
  Tags: [tags]
  Series: [series or "none"]
  Status: [Published | Draft]
  Canonical: [url or "none"]
Result:
  URL: https://dev.to/[username]/[slug]
  ID: [article_id]
Next Steps:
  -> Edit: https://dev.to/[username]/[slug]/edit
  -> Dashboard: https://dev.to/dashboard
```

## Article Management

```bash
# List articles
${BUN_X} {baseDir}/scripts/devto-api.ts list [--published] [--draft] [--per-page 10]

# Publish a draft
${BUN_X} {baseDir}/scripts/devto-api.ts publish <article_id>

# Unpublish (convert to draft)
${BUN_X} {baseDir}/scripts/devto-api.ts unpublish <article_id>
```

## Cross-Posting Strategy

1. Publish on your blog first (canonical source)
2. Wait 1-2 days for Google to index the original
3. Cross-post to Dev.to with `canonical_url` pointing to your blog

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `401 Unauthorized` | Token invalid. Re-run setup per `references/api-setup.md` |
| `422 Unprocessable` | Check frontmatter: tags lowercase, max 4; title required |
| `429 Rate Limited` | Wait a few minutes and retry |
| Tags rejected | Lowercase, alphanumeric, no spaces, max 30 chars each |
| Cover image not showing | Must be a valid URL (not local path) |
| `bun` not found | `brew install oven-sh/bun/bun` or `npm install -g bun` |

## References

| File | Content |
|------|---------|
| `references/api-setup.md` | How to generate and configure DEVTO_TOKEN |
| `references/tag-strategy.md` | Popular tags and optimization tips |
