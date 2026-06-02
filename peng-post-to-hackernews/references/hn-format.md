# Hacker News Post Markdown Format

## Frontmatter

Required YAML frontmatter at the top of the file:

```yaml
---
title: "Your post title"
url: "https://example.com/your-article"
auto_submit: false
---
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | Yes | — | Post title (max 200 chars recommended) |
| `url` | string | Yes | — | External URL to submit |
| `auto_submit` | boolean | No | `false` | `true` = submit automatically; `false` = preview mode (verify session only) |

## URL Posts Only

This skill supports **URL posts** only (title + link to external content). Text posts (Ask HN / Show HN) are not supported.

## Character Limits

| Field | HN Limit | Warning Threshold |
|-------|----------|-------------------|
| Title | ~200 chars | Warns if > 200 |
| URL | ~2048 chars | Warns if > 2048 |

## Examples

### Simple URL post

```markdown
---
title: "Let Your AI Agent Manage aweskill for You"
url: "https://aweskill.webioinfo.top/articles/let-your-ai-agent-manage-aweskill-for-you/"
---
```

### Auto-submit mode

```markdown
---
title: "My New Project"
url: "https://example.com/project"
auto_submit: true
---
```
