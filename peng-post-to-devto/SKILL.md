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
| `scripts/token.ts` | Shared token resolution (env → .peng-skills/.env) |
| `scripts/devto-api.ts` | Article CRUD: create, update, list, publish, dedupe, preview |
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

## Pre-flight Checks

Run ALL checks before first use. Stop on first failure.

### 1. Dependencies

```bash
ls {baseDir}/scripts/node_modules/gray-matter/package.json
```

If missing:

```bash
cd {baseDir}/scripts && bun install
```

If `bun` is not installed: `brew install oven-sh/bun/bun` or `npm install -g bun`.

### 2. Token

```bash
${BUN_X} {baseDir}/scripts/check-token.ts
```

Token is resolved from (in order): `DEVTO_TOKEN` env var → `<skill>/.peng-skills/.env` → `~/.peng-skills/.env`.

If token is missing or invalid, follow setup in `references/api-setup.md`.

### 3. Local Images

After parsing the markdown file, check for local image paths:

```bash
${BUN_X} {baseDir}/scripts/devto-api.ts preview <file.md>
```

The preview command scans for local images (paths not starting with `http://` or `https://`) in both `cover_image` and body `![](...)` syntax. If found, it warns and lists them.

**Dev.to requires public URLs for all images.** Local paths will appear as broken images.

Options to fix:
- Upload to an image hosting service (imgur, Cloudinary, etc.)
- Push images to your git repo and use GitHub raw URLs:
  `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`
- If in a git repo, infer the raw URL from `git remote` + current branch + file path

## Article Posting Workflow

```
Step 1: Load preferences (EXTEND.md)
Step 2: Parse input and extract metadata
Step 3: Resolve tags, series, canonical URL
Step 4: Preview metadata (show what will be submitted)
Step 5: Check for duplicates
Step 6: Publish to Dev.to
Step 7: Report completion
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
| `cover_image` | No | Cover image URL (must be a public URL, not local path) |
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

### Step 4: Preview Metadata

Before publishing, show the user exactly what will be submitted:

```bash
${BUN_X} {baseDir}/scripts/devto-api.ts preview <file.md>
```

This displays:
- Title, tags, description, series, cover, canonical URL
- Published status (with clear "PUBLIC" vs "draft" label)
- Local image warnings (if any)
- Missing tags/description warnings

**Wait for user confirmation** before proceeding to Step 5.

### Step 5: Check for Duplicates

Before creating, check if an article with the same title already exists:

```bash
${BUN_X} {baseDir}/scripts/devto-api.ts dedupe-title <file.md>
```

If duplicates found:
- Show existing article IDs, status (draft/published), and edit URLs
- Ask user: update existing article, or proceed with new creation
- If updating: use `devto-api.ts update <id> <file.md>` instead of create

This prevents duplicates from interrupted or retried operations.

### Step 6: Publish

```bash
${BUN_X} {baseDir}/scripts/devto-api.ts create <file> [--publish] [--draft] [--org <id>]
```

Or update existing:
```bash
${BUN_X} {baseDir}/scripts/devto-api.ts update <article_id> <file> [--publish] [--draft]
```

### Step 7: Completion Report

```
Dev.to Article Created!

Input: [type] - [path]
Article:
  Title: [title]
  Tags: [tags]
  Series: [series or "none"]
  Status: [Published (PUBLIC) | Draft (not public)]
  Canonical: [url or "none"]
Result:
  URL: https://dev.to/[username]/[slug]
  ID: [article_id]

This is a DRAFT — it is NOT publicly visible.
To publish later: bun scripts/devto-api.ts publish [article_id]
To edit: https://dev.to/[username]/[slug]/edit
```

**Important**: Always clarify whether the article is a draft or published. If draft, explicitly state "not public" and provide the command to publish later.

## Article Management

```bash
# List articles
${BUN_X} {baseDir}/scripts/devto-api.ts list [--published] [--draft] [--per-page 10]

# Publish a draft
${BUN_X} {baseDir}/scripts/devto-api.ts publish <article_id>

# Unpublish (convert to draft)
${BUN_X} {baseDir}/scripts/devto-api.ts unpublish <article_id>

# Check for duplicate titles
${BUN_X} {baseDir}/scripts/devto-api.ts dedupe-title <file.md>

# Preview metadata without publishing
${BUN_X} {baseDir}/scripts/devto-api.ts preview <file.md>
```

## Cross-Posting Strategy

1. Publish on your blog first (canonical source)
2. Wait 1-2 days for Google to index the original
3. Cross-post to Dev.to with `canonical_url` pointing to your blog

## Troubleshooting

| Issue | Recovery |
|-------|----------|
| `gray-matter` not found / module error | `cd {baseDir}/scripts && bun install` |
| `bun` not found | `brew install oven-sh/bun/bun` or `npm install -g bun` |
| `401 Unauthorized` | Token invalid. Run `bun scripts/check-token.ts`. See `references/api-setup.md` |
| `422 Unprocessable` | Check frontmatter: tags lowercase, max 4; title required; cover_image must be URL |
| `429 Rate Limited` | Wait a few minutes and retry |
| Network error / timeout | Check internet connection. In sandboxed env, ensure outbound HTTPS is allowed |
| Tags rejected | Lowercase, alphanumeric, no spaces, max 30 chars each |
| Cover image not showing | Must be a public URL (not local path). Upload or use GitHub raw URL |
| Duplicate article after retry | Run `dedupe-title <file.md>` to find existing, then `update <id>` instead of create |
| Images broken after publish | All images need public URLs. Push to git repo and use `raw.githubusercontent.com` URLs |
| Token check passes but create fails | Both use the same token source now. Check if token has required scopes |

## References

| File | Content |
|------|---------|
| `references/api-setup.md` | How to generate and configure DEVTO_TOKEN |
| `references/tag-strategy.md` | Popular tags and optimization tips |
