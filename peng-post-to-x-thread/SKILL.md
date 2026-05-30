---
name: peng-post-to-x-thread
description: Publishes X/Twitter threads from Markdown. Splits a Markdown file by --- separators into a chain of connected tweets, each replying to the previous one. Supports images per tweet, character validation, preview mode, and configurable delay between posts. Use when user asks to "post thread", "tweet thread", "X thread", "Twitter thread", or provides a markdown file for thread publishing.
---

# Post to X Thread

Publish a Markdown file as an X/Twitter thread — a chain of connected tweets where each replies to the previous one. Threads get more visibility than long-form articles because each tweet appears individually in timelines.

## Script Directory

`{baseDir}` = this SKILL.md's directory. Resolve `${BUN_X}`: prefer `bun`; else `npx -y bun`; else suggest `brew install oven-sh/bun/bun`.

| Script | Purpose |
|--------|---------|
| `scripts/x-thread.ts` | Post a markdown file as a thread |
| `scripts/md-to-thread.ts` | Parse and preview thread structure |

## Preferences (EXTEND.md)

Check these paths in order; first hit wins:

| Path | Scope |
|------|-------|
| `.peng-skills/peng-post-to-x-thread/EXTEND.md` | Project |
| `${XDG_CONFIG_HOME:-$HOME/.config}/peng-skills/peng-post-to-x-thread/EXTEND.md` | XDG |
| `$HOME/.peng-skills/peng-post-to-x-thread/EXTEND.md` | User home |

Found -> read, parse, apply. Not found -> use defaults.

**Supported keys**:

| Key | Default | Description |
|-----|---------|-------------|
| `default_delay_ms` | `2000` | Delay between tweets (ms) |
| `auto_submit` | `false` | `true` = post automatically; `false` = preview first tweet |
| `default_profile` | (auto) | Chrome profile directory |

**Value priority**: CLI args -> frontmatter -> EXTEND.md -> skill defaults.

## Prerequisites

- Google Chrome or Chromium installed
- `bun` runtime (`brew install oven-sh/bun/bun`)
- First run: log in to X manually in the browser (session saved)

## Markdown Format

Use `---` on its own line to separate tweets. Use `![alt](./path.png)` for images.

```markdown
---
delay_ms: 2000
---

First tweet. The hook that grabs attention.

---

Second tweet, elaborating.

![diagram](./img.png)

---

Final tweet with a call to action.
```

See `references/thread-format.md` for full spec.

## Preview Thread Structure

Before posting, preview how the markdown will be split:

```bash
${BUN_X} {baseDir}/scripts/md-to-thread.ts <file.md>
```

Output shows each tweet's text, character count, and image count.

## Post a Thread

### Preview mode (default)

```bash
${BUN_X} {baseDir}/scripts/x-thread.ts <file.md>
```

Opens Chrome, fills the **first tweet** only. You review and can manually submit. Remaining tweets are not posted.

### Auto-post full thread

```bash
${BUN_X} {baseDir}/scripts/x-thread.ts <file.md> --submit
```

Posts all tweets in sequence. Each reply chains to the previous tweet.

### With options

```bash
${BUN_X} {baseDir}/scripts/x-thread.ts <file.md> --submit --delay 3000
${BUN_X} {baseDir}/scripts/x-thread.ts <file.md> --submit --profile ~/my-chrome-profile
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| `<file.md>` | Markdown file (required) |
| `--submit` | Post all tweets (default: preview first only) |
| `--delay <ms>` | Delay between tweets (default: frontmatter or 2000) |
| `--profile <dir>` | Chrome profile directory |
| `--chrome <path>` | Chrome executable path |

## Workflow

```
1. Parse markdown: split by --- into tweets
2. Validate: each tweet <= 280 chars, max 4 images per tweet
3. Launch Chrome with CDP (persistent profile)
4. Post first tweet -> capture tweet URL
5. For each remaining tweet:
   a. Navigate to previous tweet URL
   b. Click reply button
   c. Fill text + paste images
   d. Submit -> capture new tweet URL
   e. Wait delay_ms
6. Report completion
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Chrome debug port not ready` | Kill stale Chrome: `pkill -f "Chrome.*remote-debugging-port"` |
| `Editor not found` | Log in to X manually in the browser window |
| `Reply button not found` | Tweet may not have loaded. Increase timeout or retry |
| Tweet over 280 chars | Split the tweet in your markdown file |
| Images not pasting | Run the pre-flight check (see below) |
| `bun` not found | `brew install oven-sh/bun/bun` or `npm install -g bun` |

## Pre-flight Check (Optional)

Before first use, verify the environment:

```bash
${BUN_X} {baseDir}/../baoyu-post-to-x/scripts/check-paste-permissions.ts 2>/dev/null || echo "Check not available — verify Chrome and bun are installed"
```

Checks: Chrome, profile, bun, Accessibility (macOS), clipboard, paste keystroke.

## Notes

- First run: manual login required (session persists in Chrome profile)
- All scripts only fill content into the browser; user reviews before posting
- Threads with 5+ tweets: consider `--delay 3000` or higher to avoid rate limits
- Cross-platform: macOS, Linux, Windows
