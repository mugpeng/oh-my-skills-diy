---
name: peng-post-to-hackernews
description: Posts URL stories to Hacker News from Markdown. Uses curl-based HTTP authentication (no browser required). Supports preview mode (verify session) and auto-submit. Use when user asks to "post to Hacker News", "submit to HN", "share on Hacker News", or provides a markdown file for HN submission.
---

# Post to Hacker News

Post a URL story to Hacker News from a Markdown file using curl-based HTTP authentication. No browser required — works entirely via HTTP requests.

## Script Directory

`{baseDir}` = this SKILL.md's directory. Resolve `${BUN_X}`: prefer `bun`; else `npx -y bun`; else suggest `brew install oven-sh/bun/bun`.

| Script | Purpose |
|--------|---------|
| `scripts/hn-post.ts` | Post a markdown file to Hacker News |
| `scripts/md-to-hn.ts` | Parse and preview HN post structure |

## Prerequisites

- `bun` runtime (`brew install oven-sh/bun/bun`)
- `curl` (usually pre-installed)
- Environment variables set:
  - `HN_USERNAME` — your Hacker News username
  - `HN_PASSWORD` — your Hacker News password

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HN_USERNAME` | Yes | Hacker News account username |
| `HN_PASSWORD` | Yes | Hacker News account password |
| `HN_PROXY` | No | HTTP proxy URL (e.g. `http://127.0.0.1:7890`) |
| `HN_CHROME_PATH` | No | Chrome executable path (for profile detection only) |

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

Verifies your HN session (logs in if needed), fetches the submit form, and confirms credentials are valid. **Does not submit.** You can then manually submit via the browser.

### Auto-submit

```bash
${BUN_X} {baseDir}/scripts/hn-post.ts <file.md> --submit
```

Logs in (if needed), fetches the CSRF token (`fnid`), and submits the story automatically. Reports the posted item URL.

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
| `--profile <dir>` | Cookies/profile directory (default: `~/.baoyu-skills/hn-profile`) |
| `--chrome <path>` | Chrome executable path (for profile detection) |

## Workflow

```
1. Parse markdown: extract title and url from frontmatter
2. Validate: check title length, URL validity
3. Check HN_USERNAME and HN_PASSWORD env vars
4. Check for existing session cookies (skip login if valid)
5. If no valid session: POST to /login with credentials, save cookies
6. GET /submit to retrieve fnid (CSRF token)
7. If preview mode: stop, report session status
8. If --submit: POST to /r with fnid + title + url
9. Report result (post URL or error)
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `HN_USERNAME not set` | `export HN_USERNAME="your_username"` |
| `HN_PASSWORD not set` | `export HN_PASSWORD="your_password"` |
| `Login failed` | Check credentials; password may have changed |
| `This URL has already been posted` | HN does not allow duplicate URL submissions |
| `Could not retrieve fnid` | Session expired; delete cookies file and retry |
| `Submission failed` | Check `.err` message in response; may need to re-login |

## Notes

- Session cookies are persisted in the profile directory for subsequent runs
- HN does not allow posting the same URL twice — check if already submitted
- Only URL posts are supported (not text posts like Ask HN / Show HN)
- Cross-platform: macOS, Linux, Windows (requires curl)
