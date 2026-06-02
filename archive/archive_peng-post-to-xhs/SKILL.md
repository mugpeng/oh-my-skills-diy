---
name: peng-post-to-xhs
description: Generates Xiaohongshu image cards via Google Gemini and publishes them to 小红书. Single Gemini provider with custom GOOGLE_BASE_URL support. Combined image generation + publishing workflow. Use when user asks to create XHS cards, generate 小红书 images, or post to 小红书.
---

# Post to Xiaohongshu

Generate Xiaohongshu image cards from prompts using Google Gemini image models, then publish them to 小红书 — all in one workflow.

## Script Directory

`{baseDir}` = this SKILL.md's directory. Resolve `${BUN_X}`: prefer `bun`; else `npx -y bun`; else suggest `brew install oven-sh/bun/bun`.

| Script | Purpose |
|--------|---------|
| `scripts/main.ts` | Generate image(s) via Gemini — single or batch |
| `scripts/publish.ts` | Full workflow: generate images + publish to 小红书 |

### XHS MCP Scripts (`scripts/xhs/`)

Wraps [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) for 小红书 publish.

| Script | Purpose |
|--------|---------|
| `xhs/mcp-call.sh` | Universal MCP tool caller |
| `xhs/start-mcp.sh` | Start MCP service |
| `xhs/stop-mcp.sh` | Stop MCP service |
| `xhs/status.sh` | Check login status |
| `xhs/install-check.sh` | Check dependencies (xiaohongshu-mcp, jq) |

## Prerequisites

1. **xiaohongshu-mcp** binary: install from [GitHub Releases](https://github.com/xpzouying/xiaohongshu-mcp/releases) to `~/.local/bin/`
2. **jq**: `brew install jq`
3. **GOOGLE_API_KEY** env var set for image generation

## Preferences (EXTEND.md)

Check these paths in order; first hit wins:

| Path | Scope |
|------|-------|
| `.peng-skills/peng-post-to-xhs/EXTEND.md` | Project |
| `${XDG_CONFIG_HOME:-$HOME/.config}/peng-skills/peng-post-to-xhs/EXTEND.md` | XDG |
| `$HOME/.peng-skills/peng-post-to-xhs/EXTEND.md` | User home |

Found -> read, parse, apply. Not found -> use defaults.

**Supported keys**:

| Key | Default | Description |
|-----|---------|-------------|
| `default_model` | `gemini-3.1-flash-image-preview` | Gemini model ID |
| `default_quality` | `2k` | `normal` or `2k` |
| `default_aspect_ratio` | `9:16` | Aspect ratio (9:16 for XHS portrait cards) |
| `google_base_url` | (Google default) | Custom base URL for proxy (e.g., `https://openclaw.chatgo.best`) |

**Value priority**: CLI args -> EXTEND.md -> env vars -> defaults.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Google API key (required for image generation) |
| `GEMINI_API_KEY` | Alias for GOOGLE_API_KEY |
| `GOOGLE_BASE_URL` | Override base URL (same as EXTEND.md `google_base_url`) |
| `MCP_URL` | MCP endpoint (default `http://localhost:18060/mcp`) |

## Usage

### Image Generation Only

```bash
# Single image
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cute cat" --image out.png

# With aspect ratio and quality
${BUN_X} {baseDir}/scripts/main.ts --prompt "XHS cover card" --image cover.png --ar 9:16 --quality 2k

# Prompt from files (concatenated)
${BUN_X} {baseDir}/scripts/main.ts --promptfiles style.md content.md --image out.png

# Batch mode from a directory of prompt files
${BUN_X} {baseDir}/scripts/main.ts --batchdir prompts/ --images-dir output/
```

### Generate + Publish (recommended)

```bash
# Full workflow: generate images from prompts then publish to 小红书
${BUN_X} {baseDir}/scripts/publish.ts \
  --batchdir prompts/ \
  --title "我的小红书标题" \
  --content "正文内容，最多1000字" \
  --tags "标签1" "标签2"

# Skip image generation, publish existing images
${BUN_X} {baseDir}/scripts/publish.ts \
  --skip-gen \
  --images output/01-cover.png output/02-content.png \
  --title "标题" \
  --content "正文" \
  --tags "AI工具" "效率"

# Publish with content from a markdown file
${BUN_X} {baseDir}/scripts/publish.ts \
  --images cover.png content.png \
  --title "标题" \
  --content-file article.md \
  --tags "教程" "小红书"

# Schedule publish (1 hour ~ 14 days later)
${BUN_X} {baseDir}/scripts/publish.ts \
  --batchdir prompts/ \
  --title "标题" \
  --content "正文" \
  --schedule-at "2026-06-02T10:00:00+08:00"
```

### First-time Login

The publish script checks login automatically. If not logged in, it prompts you to scan a QR code:

```bash
# Manual login (if needed)
cd {baseDir}/scripts/xhs && ./start-mcp.sh
cd {baseDir}/scripts/xhs && ./mcp-call.sh get_login_qrcode
# → scan QR with 小红书 app
```

## Batch Mode

Place `.md` prompt files in a directory. Each file becomes one image card.

```
prompts/
├── 01-cover.md
├── 02-content-1.md
├── 03-content-2.md
├── 04-content-3.md
├── 05-content-4.md
└── 06-ending.md
```

Generate images:
```bash
${BUN_X} {baseDir}/scripts/main.ts --batchdir prompts/ --images-dir output/
```

Or generate and publish in one step:
```bash
${BUN_X} {baseDir}/scripts/publish.ts \
  --batchdir prompts/ \
  --title "标题" \
  --content "正文" \
  --tags "aweskill" "AI Agent"
```

## Publish Options

| Option | Description |
|--------|-------------|
| `--title <text>` | Post title (max 20 chars) |
| `--content <text>` | Post body (max 1000 chars) |
| `--content-file <path>` | Read body from file |
| `--images <paths...>` | Image file paths |
| `--tags <tags...>` | Topic tags |
| `--batchdir <dir>` | Generate images from prompt dir, then publish |
| `--images-dir <dir>` | Output dir for generated images (with --batchdir) |
| `--schedule-at <ISO8601>` | Schedule publish (1h~14d) |
| `--skip-gen` | Skip generation, publish existing images only |
| `--json` | JSON output |

## 小红书 Restrictions

- Title: max 20 characters
- Body: max 1000 characters
- Images: at least 1, formats PNG/JPG
- Tags: topic labels, optional
- Daily limit: 50 posts
- Schedule: 1 hour to 14 days in advance (ISO8601 format)