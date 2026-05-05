# Platform Matrix

Use this file when adapting one article for WeChat, Xiaohongshu, X, and Dev.to.

## Platform Summary

| Platform | Best content shape | Images | Publishing skill |
|----------|--------------------|--------|------------------|
| WeChat article | Markdown long-form article | required cover for API news; inline images supported | `$baoyu-post-to-wechat` |
| WeChat image-text | short text + 1-9 images | local images | `$baoyu-post-to-wechat` |
| Xiaohongshu | short note + image cards | at least 1 image, usually 3-9 | `$xiaohongshu` |
| X regular post | short text or thread + 1-4 images | local images | `$baoyu-post-to-x` |
| X Article | Markdown long-form article | optional cover, inline images through script flow | `$baoyu-post-to-x` |
| Dev.to | Markdown article | cover must be URL | `$peng-post-to-devto` |

## Image Strategy

Create assets once and route them by platform:

| Asset | Create with | Use for |
|-------|-------------|---------|
| `assets/cover.png` | `$baoyu-cover-image` | WeChat article, X Article, optional source for public Dev.to cover |
| `assets/cards/*.png` | `$baoyu-image-cards` | Xiaohongshu, WeChat image-text, X regular post |
| `assets/inline/*.png` | `$baoyu-article-illustrator` | WeChat article, X Article, Dev.to after upload |

Do not use local image paths for Dev.to `cover_image`; upload first or omit the field.

## Draft Rules

### WeChat Article

- Draft path: `wechat/article.md`
- Keep Markdown as Markdown; `$baoyu-post-to-wechat` converts internally.
- Use `--cover <path>` or frontmatter cover fields.
- For API news articles, a cover is required.
- Inline local images are supported by the publishing skill.

### WeChat Image-Text

- Draft path: `wechat/image-text.md`
- Use concise copy and up to 9 images.
- Prefer social cards over long-form inline illustrations.

### Xiaohongshu

- Draft path: `xiaohongshu/note.md`
- Title must be no more than 20 characters.
- Content must be no more than 1000 characters.
- Images: at least 1, local path or URL.
- Tags are optional but useful.

### X Regular Post

- Draft path: `x/post.md`
- Use concise copy.
- Images: max 4 local images.
- Browser flow fills content; user reviews and posts manually.

### X Article

- Draft path: `x/article.md`
- Markdown file is accepted.
- Cover can be passed with `--cover <path>` or frontmatter `cover_image`.
- Requires X Premium.
- Browser flow fills content; user reviews and posts manually.

### Dev.to

- Draft path: `devto/article.md`
- Required: title.
- Recommended: description, tags, canonical_url.
- Tags: up to 4, lowercase, no spaces.
- `cover_image` must be a valid public URL.
- Default to draft unless user explicitly requests publish.

## Suggested Handoffs

WeChat article:

```bash
$baoyu-post-to-wechat <workdir>/wechat/article.md --cover <workdir>/assets/cover.png
```

X Article:

```bash
$baoyu-post-to-x <workdir>/x/article.md --cover <workdir>/assets/cover.png
```

Dev.to:

```bash
$peng-post-to-devto <workdir>/devto/article.md --draft
```

Xiaohongshu:

```json
{"title": "...", "content": "...", "images": ["<workdir>/assets/cards/01.png"], "tags": ["..."]}
```
