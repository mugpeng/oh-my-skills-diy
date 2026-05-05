---
name: peng-crosspost-workflow
description: Coordinate one Markdown article into platform-ready drafts and publishing steps for WeChat Official Account, Xiaohongshu/RedNote, X/Twitter, and Dev.to. Use when the user wants to cross-post or adapt an article to one or more of wechat, xiaohongshu, x, twitter, devto, or dev.to, especially when cover images, social image cards, inline illustrations, platform-specific markdown, or publishing handoff are needed.
---

# Peng Crosspost Workflow

Prepare one source article for selected platforms, generate or reuse visual assets, create platform-specific drafts, and hand off publishing to the existing platform skills.

This is an orchestration skill. Do not reimplement the publishing scripts. Use the existing skills when available:

- `$baoyu-post-to-wechat` for WeChat articles and image-text posts
- `$xiaohongshu` for Xiaohongshu image/video notes
- `$baoyu-post-to-x` for X regular posts and X Articles
- `$peng-post-to-devto` for Dev.to articles
- `$baoyu-cover-image` for article covers
- `$baoyu-image-cards` for social image card sets
- `$baoyu-article-illustrator` for long-form inline illustrations

## Input Contract

Accept at least:

- a source Markdown article path
- a target platform list, using aliases:
  - `wechat`, `wx`, `gongzhonghao`
  - `xiaohongshu`, `xhs`, `rednote`
  - `x`, `twitter`
  - `devto`, `dev.to`

If platforms are missing, ask for them. If the source article path is missing or not readable, stop and ask for a valid path.

Example request:

```text
Use $peng-crosspost-workflow for wechat,xiaohongshu,x,devto:
/Users/peng/Desktop/Project/skills/aweskill/docs/article_media/0505/let-your-ai-agent-manage-aweskill-for-you.md
```

## Output Location

Default all generated drafts and assets to the source article directory:

```text
<article_dir>/.peng-crosspost-workflow/<article_slug>/
```

Use `--out <dir>` only when the user explicitly provides an output directory.

For a source named `article.md`, create:

```text
.peng-crosspost-workflow/<article_slug>/
├── source.md
├── assets/
│   ├── cover.png
│   ├── cards/
│   └── inline/
├── wechat/
│   └── article.md
├── xiaohongshu/
│   └── note.md
├── x/
│   └── article.md
├── devto/
│   └── article.md
└── publish-plan.md
```

Keep the original Markdown read-only. Copy it to `source.md` before deriving platform drafts.

## Configuration

Use optional preferences only for defaults, never as permission to publish.

Check in order:

| Path | Scope |
|------|-------|
| `<article_dir>/.peng-crosspost-workflow/EXTEND.md` | article directory |
| `.peng-crosspost-workflow/EXTEND.md` | current project |
| `${XDG_CONFIG_HOME:-$HOME/.config}/peng-crosspost-workflow/EXTEND.md` | XDG |
| `$HOME/.peng-crosspost-workflow/EXTEND.md` | user |

Useful keys:

| Key | Meaning |
|-----|---------|
| `default_platforms` | comma-separated platform aliases |
| `default_author` | fallback author |
| `default_tags` | fallback Dev.to tags and social hashtags |
| `default_x_mode` | `post` or `article` |
| `default_wechat_mode` | `article` or `image-text` |
| `auto_publish` | default `false`; only publish when user explicitly confirms |
| `devto_cover_url` | URL to use when Dev.to needs a public cover image |

## Workflow

### Step 1: Resolve Request

Normalize the target platforms and source path. Confirm any ambiguous mode choices:

- WeChat: `article` vs `image-text`
- X: `post` vs `article`
- Xiaohongshu: always image note unless user asks for video
- Dev.to: article draft or publish

Do not publish by default. Generate drafts and a publish plan unless the user explicitly says to publish or submit.

### Step 2: Inspect Article

Read the source Markdown. Extract or infer:

- title from frontmatter or first H1
- description/summary from frontmatter or first substantial paragraph
- tags from frontmatter or content
- canonical URL if present
- existing cover fields: `cover`, `coverImage`, `featureImage`, `image`, `cover_image`
- inline image paths

If the article already has usable local images, prefer reusing them before generating new inline or social-card assets. Do not treat ordinary inline images as a replacement for a required platform cover unless the user explicitly asks to reuse that image as the cover.

### Step 3: Prepare Assets

Create the workdir and copy the source article to `source.md`.

Generate only the assets needed by selected platforms. "Preferred skill" below means the workflow must invoke or hand off to that skill when the asset is needed; do not replace it with ad hoc SVG/HTML/CSS/manual image construction unless the user explicitly asks for a non-AI/local fallback.

| Need | Preferred skill | Output |
|------|-----------------|--------|
| shared article cover | `$baoyu-cover-image` | `assets/cover.png` |
| social card set | `$baoyu-image-cards` | `assets/cards/` |
| long-form inline illustrations | `$baoyu-article-illustrator` | `assets/inline/` |

Invoke `$baoyu-cover-image` when any of these are true:

- the user explicitly asks for a cover image, cover, 封面图, or article cover
- selected platforms include WeChat article or X Article and no user-approved cover already exists
- an existing cover is missing, remote-only, or not suitable for the target platform

Invoke `$baoyu-image-cards` when any of these are true:

- selected platforms include Xiaohongshu/RedNote
- selected WeChat mode is image-text / 贴图 / 图文
- selected X mode is a regular post with images/cards
- the user asks for image cards, 图片卡片, 小红书图片, or social card series

Invoke `$baoyu-article-illustrator` only when the article needs explanatory body illustrations, has visual placeholders, or the user explicitly asks for inline article illustrations / 配图.

Use the cover for WeChat article and X Article. Use image cards for Xiaohongshu, WeChat image-text, and X regular posts. Use inline illustrations only when the source article benefits from body visuals or already has visual placeholders.

For Dev.to, do not pass local cover paths as `cover_image`; Dev.to needs a public URL. If no public cover URL is available, leave `cover_image` unset and record the required upload in `publish-plan.md`.

### Step 4: Create Platform Drafts

Create only the selected platform folders.

WeChat article:

- write `wechat/article.md`
- keep Markdown as source; do not pre-convert to HTML
- add or preserve frontmatter for title, summary, author, and cover
- point cover to `../assets/cover.png` or `assets/cover.png` as appropriate for the publishing command

WeChat image-text:

- write `wechat/image-text.md`
- summarize the article into short copy
- use up to 9 card images from `assets/cards/`

X Article:

- write `x/article.md`
- keep Markdown concise enough for X Article
- preserve title and cover metadata

X regular post:

- write `x/post.md`
- create a concise thread/post draft
- use up to 4 card images from `assets/cards/`

Xiaohongshu:

- write `xiaohongshu/note.md`
- convert the article to a short note: title <= 20 characters, content <= 1000 characters
- use 1-9 images from `assets/cards/`; the first image is the cover

Dev.to:

- write `devto/article.md`
- keep Dev.to-compatible frontmatter: `title`, `description`, `tags`, `published`, `canonical_url`, `series`, `cover_image`
- use at most 4 tags, lowercase and no spaces
- only set `cover_image` if it is a URL

For exact platform constraints, read `references/platform-matrix.md`.

### Step 5: Write Publish Plan

Always write `publish-plan.md` with:

- source article path
- selected platforms
- generated drafts
- generated or reused images
- missing prerequisites
- exact publishing commands or skill handoffs
- whether each platform is ready, blocked, or requires manual confirmation

If publishing was not explicitly requested, stop here and report the plan.

### Step 6: Publish On Explicit Request

Only publish after the user explicitly asks to publish, submit, post, or send.

Before invoking each platform skill, verify platform-specific blockers:

- WeChat API: cover exists for article mode
- Xiaohongshu: MCP service/login works and at least one image exists
- X: Chrome session/log-in is ready; X Article requires Premium
- Dev.to: token works; cover image is a public URL if set

Then invoke the platform skill using the generated draft and asset paths. If a platform opens a browser for manual review, report that publishing still requires user confirmation in the browser.

## Safety Rules

- Do not mutate the original article in place.
- Do not publish without explicit current-turn confirmation.
- Do not invent public image URLs for Dev.to.
- Do not call one platform's conversion output as another platform's input unless the target skill explicitly supports it.
- If an asset generation skill needs confirmation, complete its confirmation flow before generating images.
- If a publishing skill reports a partially filled browser editor, surface that state instead of claiming success.

## References

Read `references/platform-matrix.md` when selecting modes, preparing images, or writing platform-specific drafts.
