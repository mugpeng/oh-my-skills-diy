---
name: peng-post-to-xhs-cli
description: "Research top XHS posts, write anti-AI copy, generate image cards via Gemini, and publish to 小红书 via xhs CLI. Full pipeline: research → write → generate → publish. Use when user asks for 小红书笔记/种草文案/爆款标题/发布到小红书/XHS cards."
---

# Post to Xiaohongshu (CLI)

Research → Write → Generate → Publish — complete 小红书 workflow using `xhs` CLI and Gemini image generation.

## Prerequisites

| Dependency | Install | Check |
|---|---|---|
| **xhs** (xiaohongshu-cli) | `uv tool install xiaohongshu-cli` | `xhs --version` |
| **bun** | `brew install oven-sh/bun/bun` | `bun --version` |
| **GOOGLE_API_KEY** | Set env var | echo `$GOOGLE_API_KEY` |

### xhs Authentication

Before any publish, verify login:

```bash
xhs status          # check auth
xhs login           # auto-extract browser cookies
xhs login --qrcode  # QR code login if cookies unavailable
```

## Script Directory

`{baseDir}` = this SKILL.md's directory. Resolve `${BUN_X}`: prefer `bun`; else `npx -y bun`.

| Script | Purpose |
|--------|---------|
| `scripts/main.ts` | Generate image(s) via Gemini — single or batch |
| `scripts/publish.ts` | Validate + publish to 小红书 via `xhs` |

## Workflow Overview

```
Phase 1: Research   → find top posts, analyze patterns, extract resonance
Phase 2: Write      → craft title + body + tags (anti-AI, character limits)
Phase 3: Generate   → create image cards via Gemini (or use user images)
Phase 4: Publish    → preview → user confirm → xhs post
```

Skip Phase 1 if user provides complete content. Skip Phase 3 if user provides images.

---

## Phase 1: Research (先研究再写)

**Goal**: Find what works for this topic before writing a single word.

### Step 1: Search top posts

```bash
xhs search "<topic>" --sort popular --type image --json
```

Pick 5-10 posts with high engagement. For each, record:
- Title (original text)
- Likes / comments / bookmarks (if available)
- Body structure (1-line summary: e.g. "结论 → 清单 → 步骤 → CTA")
- Hook (the opening line that grabs attention)
- Evidence type (experience, comparison, data, before/after)
- Engagement design (question, poll, CTA, "收藏" prompt)

### Step 2: Read post details

```bash
xhs read <id> --json
```

Extract the full title and body for pattern analysis.

### Step 3: Analyze comments

```bash
xhs comments <id> --all --json
```

Look for emotional resonance triggers:
- Shared pain points ("我也是…")
- Identity recognition ("打工人/学生党/宝妈")
- Anxiety + solution ("终于有办法了")
- Aspiration ("自律/松弛感/性价比")
- Surprise ("原来这样也行")
- Copy-ability ("我也能照做")

### Step 4: Output analysis report

```text
【分析总结报告】

标题规律
- <pattern 1>
- <pattern 2>

正文规律
- <pattern 1>
- <pattern 2>

高赞原因
1. <reason + evidence>
2. <reason + evidence>
3. <reason + evidence>

共鸣点
1. <resonance point> — "<quote>"
2. <resonance point> — "<quote>"

互动设计建议
- <suggestion>
```

---

## Phase 2: Write (写文案)

### Hard limits (必须遵守)

- Title: **≤ 20 characters** (aim ≤ 18 for safety)
- Body: **≤ 1000 characters** (aim ≤ 950 for safety)
- Counting: all characters including spaces, punctuation, newlines, #tags

### Anti-AI writing rules (去AI味)

1. **Use "我" perspective**: "我发现", "我踩过的坑", "我当时" — NOT "大家/用户/建议如下"
2. **Add 2-3 specific details**: a timestamp, a scene, a before/after comparison, an exact quote
3. **Allow imperfection**: "我感觉/可能/不确定但…" — don't sound authoritative
4. **No template phrases**: avoid "总的来说/综上/因此/首先其次最后/不容错过/速速"
5. **Talk like a friend**: short sentences, line breaks every 1-3 sentences, occasional colloquialisms

### Output format

```text
标题：<title>（<char count>/20）
正文：
<body>
（<char count>/1000）

标签：#tag1 #tag2 #tag3

配图：
- 图片1：<URL or path>
- 图片2：<URL or path>（如有）
```

### Character check (mandatory)

If title > 20 chars: cut redundant words, remove subtitles, shorten.
If body > 1000 chars: remove repetition, merge sentences, compress steps.

---

## Phase 3: Generate Images (出图)

### Option A: Generate via Gemini (default)

```bash
# Single image
${BUN_X} {baseDir}/scripts/main.ts --prompt "<prompt>" --image out.png --ar 9:16 --quality 2k

# Batch from prompt directory
${BUN_X} {baseDir}/scripts/main.ts --batchdir prompts/ --images-dir output/
```

- Aspect ratio: 9:16 (portrait) preferred for XHS
- Quality: `2k` default, `normal` for speed
- Prompts: `.md` files in a directory, each becomes one image

### Option B: User-provided images

Skip generation. Use images directly in Phase 4.

### Image requirements

- At least 1 image, PNG or JPG
- 9:16 portrait ratio preferred
- Clean, high-resolution, topic-relevant

---

## Phase 4: Publish (发布)

### Step 1: Check auth

```bash
xhs status
```

If not authenticated: `xhs login` or `xhs login --qrcode`.

### Step 2: Preview for user confirmation (必须执行)

Show the complete content and wait for explicit confirmation:

```text
【待发布内容预览】

标题：<title>（<chars>/20）
正文：
<body>
（<chars>/1000）

标签：#tag1 #tag2 #tag3

配图：
- 图片1：<path>
- 图片2：<path>（如有）

---
请确认：
- "确认"或"发布" → 开始发布
- "修改"或具体意见 → 调整内容
- "取消" → 终止
```

**Do NOT publish without user confirmation.**

### Step 3: Publish via xhs

```bash
xhs post --title "<title>" --body "<body>" --images <img1> [<img2>] --tags "<tag1>" "<tag2>"
```

Or use the publish script (handles validation + generation + publish):

```bash
${BUN_X} {baseDir}/scripts/publish.ts \
  --title "<title>" \
  --content "<body>" \
  --images <img1> <img2> \
  --tags "<tag1>" "<tag2>"

# With image generation from prompts
${BUN_X} {baseDir}/scripts/publish.ts \
  --batchdir prompts/ \
  --title "<title>" \
  --content "<body>" \
  --tags "<tag1>" "<tag2>"

# Skip generation, publish existing images
${BUN_X} {baseDir}/scripts/publish.ts \
  --skip-gen \
  --images output/01.png output/02.png \
  --title "<title>" \
  --content "<body>"
```

### Step 4: Report result

Output: published link/ID (if available), title, tag count, image count.

---

## EXTEND.md (config)

Check these paths in order; first hit wins:

| Path | Scope |
|------|-------|
| `.peng-skills/peng-post-to-xhs-cli/EXTEND.md` | Project |
| `${XDG_CONFIG_HOME:-$HOME/.config}/peng-skills/peng-post-to-xhs-cli/EXTEND.md` | XDG |
| `$HOME/.peng-skills/peng-post-to-xhs-cli/EXTEND.md` | User home |

**Supported keys**:

| Key | Default | Description |
|-----|---------|-------------|
| `default_model` | `gemini-3.1-flash-image-preview` | Gemini model ID |
| `default_quality` | `2k` | `normal` or `2k` |
| `default_aspect_ratio` | `9:16` | Aspect ratio |
| `google_base_url` | (Google default) | Custom base URL for proxy |

**Value priority**: CLI args → EXTEND.md → env vars → defaults.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Google API key (required for image generation) |
| `GEMINI_API_KEY` | Alias for GOOGLE_API_KEY |
| `GOOGLE_BASE_URL` | Override base URL for proxy |

## xhs Quick Reference

| Command | Purpose |
|---------|---------|
| `xhs status` | Check auth |
| `xhs login [--qrcode]` | Authenticate |
| `xhs search "<kw>" --sort popular --type image --json` | Search posts |
| `xhs read <id> --json` | Read post detail |
| `xhs comments <id> --all --json` | Get all comments |
| `xhs post --title "..." --body "..." --images x.png` | Publish |
| `xhs topics "<kw>"` | Search hashtags |
| `xhs hot -c <category>` | Trending by category |
| `xhs whoami` | Current user info |

## Limitations

- No scheduled publish (use XHS app for timed posts)
- No video publish (images only via this skill)
- `xhs` rate limits: ~1-1.5s between requests, do not parallelize

## Examples

### Full pipeline (research → write → generate → publish)

User: "写一篇小红书：上班族快速晚餐，预算20元以内"

1. Research: `xhs search "上班族晚餐" --sort popular --type image --json`
2. Read top 5 posts + analyze comments
3. Output analysis report
4. Write title (≤20) + body (≤1000) + tags
5. Generate cover image via Gemini
6. Show preview → user confirms
7. `xhs post --title "..." --body "..." --images cover.png --tags "上班族" "快手晚餐"`

### User provides content + images

User: "用这两张图发小红书，标题是XX，正文是YY"

1. Skip research + writing
2. Validate title/body length
3. Check auth
4. Show preview → user confirms
5. Publish

### Research only (no publish)

User: "帮我分析一下'露营装备'这个话题在小红书上什么写法火"

1. Research: search + read + comment analysis
2. Output analysis report
3. Stop (no writing, no publishing)
