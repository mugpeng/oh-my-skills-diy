---
name: peng-post-to-hackernews
description: Posts URL stories to Hacker News from Markdown. Uses Chrome + CDP browser automation with env-based auth (HN_USERNAME / HN_PASSWORD). Supports preview mode (fill form) and auto-submit. Use when user asks to "post to Hacker News", "submit to HN", "share on Hacker News", or provides a markdown file for HN submission.
---

# Post to Hacker News

Post a URL story to Hacker News from a Markdown file using Chrome + CDP browser automation.

## Script Directory

`{baseDir}` = this SKILL.md's directory. Resolve `${BUN_X}`: prefer `bun`; else `npx -y bun`; else suggest `brew install oven-sh/bun/bun`.

| Script | Purpose |
|--------|---------|
| `scripts/hn-post.ts` | Post a markdown file to Hacker News |
| `scripts/md-to-hn.ts` | Parse and preview HN post structure |

## Prerequisites

- Google Chrome or Chromium installed
- `bun` runtime (`brew install oven-sh/bun/bun`)
- Environment variables set:
  - `HN_USERNAME` — your Hacker News username
  - `HN_PASSWORD` — your Hacker News password

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HN_USERNAME` | Yes | Hacker News account username |
| `HN_PASSWORD` | Yes | Hacker News account password |
| `HN_CHROME_PATH` | No | Custom Chrome executable path |
| `HN_CHROME_PROFILE_DIR` | No | Custom Chrome profile directory |

Set them in your shell:

```bash
export HN_USERNAME="your_username"
export HN_PASSWORD="your_password"
```

Or in a `.env` file in the project root.

## Markdown Format

Use YAML frontmatter with `title` and `url` fields.

See [references/hn-format.md](references/hn-format.md) for full spec.

```markdown
---
title: "Your post title"
url: "https://example.com/your-article"
auto_submit: false
---
```

## Preview Post Structure

Before posting, preview how the markdown will be parsed:

```bash
${BUN_X} {baseDir}/scripts/md-to-hn.ts <file.md>
```

## Post to Hacker News

### Preview mode (default)

```bash
${BUN_X} {baseDir}/scripts/hn-post.ts <file.md>
```

Opens Chrome, logs in (if needed), navigates to the submit page, and fills the form. **Does not submit.** You review and can manually click submit in the browser.

### Auto-submit

```bash
${BUN_X} {baseDir}/scripts/hn-post.ts <file.md> --submit
```

Fills the form and submits automatically. Waits for confirmation redirect.

### With options

```bash
${BUN_X} {baseDir}/scripts/hn-post.ts <file.md> --submit --profile ~/.chrome/hn-profile
${BUN_X} {baseDir}/scripts/hn-post.ts <file.md> --submit --chrome /path/to/chrome
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| `<file.md>` | Markdown file with frontmatter (required) |
| `--submit` | Submit automatically (default: preview mode) |
| `--profile <dir>` | Chrome profile directory |
| `--chrome <path>` | Chrome executable path |

## Workflow

```
1. Parse markdown: extract title and url from frontmatter
2. Validate: check title length, URL validity
3. Check HN_USERNAME and HN_PASSWORD env vars
4. Launch Chrome with CDP (or reuse existing)
5. Navigate to HN submit page
6. If not logged in: navigate to login, fill credentials, submit
7. Fill submit form: title + url
8. If preview mode: stop, let user review
9. If --submit: click submit, wait for redirect to item page
10. Report result (post URL or error)
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `HN_USERNAME not set` | `export HN_USERNAME="your_username"` |
| `HN_PASSWORD not set` | `export HN_PASSWORD="your_password"` |
| `Chrome not found` | Set `HN_CHROME_PATH` or install Chrome |
| `Login failed` | Check credentials; try manual login first |
| `Submit form not found` | HN page may have changed; check browser |
| `Submission failed` | Check `.err` message in browser; duplicate URL? |
| `Chrome lock error` | Kill stale Chrome: `pkill -f "Chrome.*ycombinator"` |

## Notes

- First run: Chrome will open and you may need to verify login in the browser
- Session cookies persist in the Chrome profile for subsequent runs
- Only URL posts are supported (not text posts like Ask HN)
- Cross-platform: macOS, Linux, Windows
