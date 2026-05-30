# Thread Markdown Format

## Frontmatter

Optional YAML frontmatter at the top of the file:

```yaml
---
auto_submit: false
delay_ms: 2000
---
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `auto_submit` | boolean | `false` | Post automatically without preview |
| `delay_ms` | number | `2000` | Delay between tweets in milliseconds |

## Tweet Separators

Use `---` on its own line (with optional whitespace) to separate tweets.

## Images

Use standard markdown image syntax inline within any tweet:

```markdown
![diagram](./images/diagram.png)
```

- Paths are resolved relative to the markdown file's directory
- Max 4 images per tweet (X limitation)
- Remote URLs (`https://...`) are not supported — use local files only

## Character Limit

Each tweet must be **280 characters or fewer** after stripping markdown formatting and image references.

The parser warns (but does not block) if a tweet exceeds the limit. X may reject or truncate the post.

## Formatting

Markdown formatting is converted to plain text for X:

| Markdown | Result |
|----------|--------|
| `# Heading` | `Heading` |
| `**bold**` | `bold` |
| `*italic*` | `italic` |
| `` `code` `` | `code` |
| `[text](url)` | `text` |

## Examples

### Simple thread

```markdown
---
delay_ms: 2000
---

Here is a surprising fact about octopuses.

They have three hearts and blue blood.

---

Two hearts pump blood to the gills, while the third pumps it to the rest of the body.

---

The third heart actually stops beating when the octopus swims, which is why they prefer crawling.
```

### Thread with images

```markdown
---

Our new dashboard is live.

![dashboard](./screenshots/dashboard.png)

---

Here is the performance comparison:

![perf](./screenshots/performance.png)

---

Try it yourself: https://example.com/demo
```

### Long article split into a thread

```markdown
---
delay_ms: 3000
---

Most developer tools still assume the human is the operator.

But AI coding agents now run commands, inspect files, and follow conventions. The better question is: Can the agent operate the CLI by itself?

---

That is the idea behind aweskill: a CLI-first Skill package manager that AI agents can operate themselves.

---

Instead of typing commands, you can say: "Find a good code-review Skill, install it, and enable it for this agent."

The agent handles the mechanical work. You stay in the loop for judgment.
```
