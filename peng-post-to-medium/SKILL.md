---
name: peng-post-to-medium
description: Posts articles to Medium via Playwright browser automation. Supports Markdown with frontmatter (title, tags, canonical_url, publication_id), draft/publish/unlisted workflow, and cross-posting with canonical URLs. Use when user mentions "post to Medium", "publish Medium", "Medium 发布", "Medium article", or provides medium.com article URLs.
---

# Post to Medium

Publish articles to Medium via Playwright browser automation. Medium's API is deprecated; this skill controls a real browser to create and publish posts.

## Script Directory

`{baseDir}` = this SKILL.md's directory. Resolve `${BUN_X}`: prefer `bun`; else `npx -y bun`; else suggest `brew install oven-sh/bun/bun`.

| Script | Purpose |
|--------|---------|
| `scripts/session.ts` | Chrome profile detection (default profile path) |
| `scripts/md-to-html.ts` | Parse Markdown + frontmatter, convert body to HTML |
| `scripts/medium-publish.ts` | Main script: publish, preview, login (fallback) |
| `scripts/check-session.ts` | Verify Chrome profile has Medium session |

## Preferences (EXTEND.md)

Check these paths in order; first hit wins:

| Path | Scope |
|------|-------|
| `.peng-skills/peng-post-to-medium/EXTEND.md` | Project |
| `${XDG_CONFIG_HOME:-$HOME/.config}/peng-skills/peng-post-to-medium/EXTEND.md` | XDG |
| `$HOME/.peng-skills/peng-post-to-medium/EXTEND.md` | User home |

Found -> read, parse, apply. Not found -> use defaults.

**Supported keys**:

| Key | Default | Description |
|-----|---------|-------------|
| `default_tags` | empty | Default tags (comma-separated) when frontmatter has none |
| `canonical_url_base` | empty | Base URL for cross-posting (e.g. `https://myblog.com`) |
| `auto_publish` | `false` | `true` = publish immediately; `false` = save as draft |
| `default_publication_id` | empty | Publication ID to publish under |

**Value priority**: CLI args -> frontmatter -> EXTEND.md -> skill defaults.

## Pre-flight Checks

Run ALL checks before first use. Stop on first failure.

### 1. Dependencies

```bash
ls {baseDir}/scripts/node_modules/playwright/package.json
```

If missing:

```bash
cd {baseDir}/scripts && bun install
```

If `bun` is not installed: `brew install oven-sh/bun/bun` or `npm install -g bun`.

### 2. Session

```bash
${BUN_X} {baseDir}/scripts/check-session.ts
```

**Primary mode**: Uses your default Chrome profile — if you're logged into Medium in Chrome, no extra setup needed.

**Fallback mode**: If Chrome is running (profile locked), uses a saved session at `~/.peng-skills/medium-chrome-profile/`. Run `login` to create one:

```bash
${BUN_X} {baseDir}/scripts/medium-publish.ts login
```

This opens Chrome with a separate profile. Log in to Medium, then close the browser.

### 3. Local Images

After parsing the markdown file, check for local image paths:

```bash
${BUN_X} {baseDir}/scripts/medium-publish.ts preview <file.md>
```

**Medium requires public URLs for all images.** Local paths will appear as broken images.

Options to fix:
- Upload to an image hosting service (imgur, Cloudinary, etc.)
- Push images to your git repo and use GitHub raw URLs:
  `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`

## Post Publishing Workflow

```
Step 1: Load preferences (EXTEND.md)
Step 2: Parse input and extract metadata
Step 3: Resolve tags, canonical URL, publication
Step 4: Preview metadata (show what will be submitted)
Step 5: Publish to Medium
Step 6: Report completion
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
2. Save to `post-to-medium/YYYY-MM-DD/<slug>.md`.
3. Continue as markdown file.

**Frontmatter fields**:

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Article title (auto-generated from first H1 if missing) |
| `tags` | No | Array of up to 3 tags (max 25 chars each) |
| `published` | No | `true` for public, `false` for draft |
| `canonical_url` | No | Original URL if cross-posting |
| `publication_id` | No | Medium publication ID to publish under |

Example frontmatter:
```yaml
---
title: "Building a CLI with Rust"
tags: [rust, cli, tutorial]
published: true
canonical_url: https://myblog.com/rust-cli
publication_id: "your-publication-id"
---
```

### Step 3: Resolve Metadata

1. **Tags**: frontmatter `tags` -> EXTEND.md `default_tags` -> ask user. Max 3, each max 25 chars.
2. **Canonical URL**: CLI `--canonical` -> frontmatter `canonical_url` -> EXTEND.md `canonical_url_base` + slug -> omit.
3. **Publish status**: CLI `--publish`/`--draft`/`--unlisted` -> frontmatter `published` -> EXTEND.md `auto_publish` -> `draft`.
4. **Publication**: CLI `--pub` -> frontmatter `publication_id` -> EXTEND.md `default_publication_id` -> personal profile.

### Step 4: Preview Metadata

Before publishing, show the user exactly what will be submitted:

```bash
${BUN_X} {baseDir}/scripts/medium-publish.ts preview <file.md>
```

**Wait for user confirmation** before proceeding to Step 5.

### Step 5: Publish

```bash
${BUN_X} {baseDir}/scripts/medium-publish.ts publish <file> [--publish] [--draft] [--unlisted] [--pub <id>]
```

### Step 6: Completion Report

```
Medium Post Created!

Input: [type] - [path]
Post:
  Title: [title]
  Tags: [tags]
  Status: [Published (PUBLIC) | Unlisted (link-only) | Draft (not public)]
  Canonical: [url or "none"]
  Publication: [name or "personal profile"]
Result:
  URL: [medium post url]

This is a DRAFT — it is NOT publicly visible.
Edit it on Medium to publish.
```

## Medium Limitations

| Feature | Medium |
|---------|--------|
| API | Deprecated — no longer supported |
| Create post | Via browser automation only |
| Update post | Not supported (edit on Medium directly) |
| Delete post | Not supported (delete on Medium directly) |
| Max tags | 3, each max 25 characters |
| Content format | Markdown (converted to HTML for paste) |

For edits or deletions, direct the user to the Medium editor URL.

## Cross-Posting Strategy

1. Publish on your blog first (canonical source)
2. Wait 1-2 days for Google to index the original
3. Cross-post to Medium with `canonical_url` pointing to your blog

## Troubleshooting

| Issue | Recovery |
|-------|----------|
| `playwright` not found / module error | `cd {baseDir}/scripts && bun install` |
| `bun` not found | `brew install oven-sh/bun/bun` or `npm install -g bun` |
| Chrome profile locked | Close Chrome, or use `login` to create a separate session |
| Not logged in | Log in to Chrome normally (medium.com), then retry |
| Login page shown after publish | Session expired. Close Chrome, run `login`, or re-login in Chrome |
| Tags not applied | Medium editor UI may have changed; tags are best-effort |
| Content not pasted | Medium editor may reject pasted HTML; try shorter content |
| Images broken | All images need public URLs. Push to git repo and use raw.githubusercontent.com |
| Browser won't launch | Chrome must be installed. Playwright uses system Chrome via `channel: 'chrome'` |
| Headless mode fails | Some actions require headful mode; try `login` first to refresh session |

## References

| File | Content |
|------|---------|
| `references/setup-guide.md` | First-time Playwright + session setup |
| `references/tag-strategy.md` | Popular tags and optimization tips |
