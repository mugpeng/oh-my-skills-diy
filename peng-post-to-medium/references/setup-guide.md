# Setup Guide

## How It Works

Uses your system Chrome with `channel: 'chrome'` — no separate Chromium download needed.

**Primary mode**: Reuses your default Chrome profile. If you're logged into Medium in Chrome, it just works.

**Fallback mode**: If Chrome is running (profile locked), uses a separate profile at `~/.peng-skills/medium-chrome-profile/`.

## First-Time Setup

### 1. Install Dependencies

```bash
cd scripts
bun install
```

### 2. Check Session

```bash
bun scripts/check-session.ts
```

If you're logged into Medium in Chrome, this should pass immediately.

### 3. Test with a Draft

Create a test file `test.md`:
```markdown
---
title: "Test Post"
tags: [test]
published: false
---

This is a test post created by peng-post-to-medium.
```

Then:
```bash
bun scripts/medium-publish.ts publish test.md --draft
```

Check your Medium drafts to confirm it was created.

## If Chrome Is Running

Chrome locks its profile directory. Two options:

**Option A: Close Chrome** — The script uses your default profile directly.

**Option B: Create a separate session**:
```bash
bun scripts/medium-publish.ts login
```
This opens a new Chrome window with a separate profile. Log in to Medium, then close the browser. The session is saved to `~/.peng-skills/medium-chrome-profile/`.

## Profile Locations

| Platform | Default Chrome Profile |
|----------|----------------------|
| macOS | `~/Library/Application Support/Google/Chrome` |
| Linux | `~/.config/google-chrome` |
| Windows | `%LOCALAPPDATA%\Google\Chrome\User Data` |

## Session Management

- **Default profile**: No session file — uses Chrome's own cookies
- **Fallback profile**: `~/.peng-skills/medium-chrome-profile/`
- To clear fallback session: `rm -rf ~/.peng-skills/medium-chrome-profile`
