# Setup Guide

## First-Time Setup

### 1. Install Dependencies

```bash
cd scripts
bun install
npx playwright install chromium
```

### 2. Log In to Medium

```bash
bun scripts/medium-publish.ts login
```

This will:
1. Open a Chromium browser window
2. Navigate to Medium's sign-in page
3. Wait for you to log in manually
4. Save your session cookies to `~/.peng-skills/medium-cookies.json`

**Steps in the browser**:
1. Choose your login method (Google, Twitter, Facebook, or email)
2. Complete the login
3. Wait until you see your Medium homepage
4. Go back to the terminal and press Enter

### 3. Verify Session

```bash
bun scripts/check-session.ts
```

Should output: `OK: Session is valid. Logged in to Medium.`

### 4. Test with a Draft

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

## Session Management

- Cookies are saved to `~/.peng-skills/medium-cookies.json`
- Sessions typically last weeks/months
- If you get redirected to login, re-run `bun scripts/medium-publish.ts login`
- To log out: delete `~/.peng-skills/medium-cookies.json`

## Browser Requirements

Playwright downloads its own Chromium binary (~150MB). No system browser is needed.

If the download fails:
```bash
npx playwright install --with-deps chromium
```

This installs Chromium with system dependencies (useful on Linux).
