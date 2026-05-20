---
name: peng-dev-style
description: "CLI help format and README visual style for personal dev tools. Use when creating or updating CLI tools that need clean help output (--help), version flags (-v), or polished README files with centered hero blocks and badges. Triggers on: CLI help, --help format, README style, hero block, badges, command surface design, version flag."
---

# peng-dev-style

CLI and README conventions for personal dev tools. Derived from aweswitch; applied to aweteam.

## CLI Help Format

Match this layout exactly:

```
Usage: toolname [OPTIONS] COMMAND [ARGS]...

  One-line description of what the tool does.

Options:
  -v, --version  Show the version and exit.
  -h, --help     Show this message and exit.

Commands:
  run     One-line description, aligned to longest command name.
  status  One-line description.
  focus   One-line description.
```

Rules:
- `Usage:` line uses `[OPTIONS] COMMAND [ARGS]...` — no tool-specific variants
- Each command gets one short imperative sentence, column-aligned
- `-v` / `--version` and `-h` / `--help` are always present
- Debug/internal commands are hidden from help but remain functional
- No `Workflow:`, `Examples:`, or `Config:` sections in help — that belongs in README

### Hiding Commands

Remove debug commands from `helpText()` output. Keep the command routing code unchanged. The command still works — it just doesn't appear in `--help`.

### Version Flag

Read version from `package.json` (Node) or `__init__.py` (Python). Output format: `toolname X.Y.Z`.

## README Style

### Hero Block

```html
<div align="center">
  <h1>toolname</h1>
  <p><strong>Short tagline.</strong></p>
  <p>One sentence expanding on what it does.</p>
  <p>
    <strong>English</strong> ·
    <a href="./README_cn.md">简体中文</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-X.Y.Z-7C3AED?style=flat-square" alt="Version">
    <img src="https://img.shields.io/badge/node-%E2%89%A520-0EA5E9?style=flat-square" alt="Node">
  </p>
  <p>
    <img src="https://img.shields.io/badge/status-alpha-c96a3d?style=flat-square" alt="Status">
    <img src="https://img.shields.io/badge/provider-Claude%20%7C%20Codex-7C3AED?style=flat-square" alt="Providers">
    <img src="https://img.shields.io/badge/platform-tmux-334155?style=flat-square" alt="Platform">
  </p>
</div>

> Repeat the tagline as a blockquote.
```

Badge rows (two `<p>` blocks):
1. Version + language/runtime requirement
2. Status + providers + platform

Badge colors (flat-square): version `7C3AED`, language `0EA5E9`, status `c96a3d`, providers `7C3AED`, platform `334155`, install `22C55E`.

### Body Structure

After the hero block + tagline:

1. One paragraph — what the tool is and its intentional scope
2. `## Install` — minimal steps to get running
3. `## Quick Start` — first run
4. `## Config` — config shape with JSON example
5. `## Commands` — only user-facing commands, matching `--help` output
6. `## Development` — `npm test` or equivalent

### Commands Section

Show only user-facing commands. Match the `--help` surface:

```markdown
## Commands

\```bash
toolname --config toolname.json
toolname run "task" --config toolname.json
toolname status <id>
toolname focus <id> <target>
\```
```

No debug commands listed. If needed, mention them in one sentence below the block.

### Chinese README

Mirror the same hero block with translated tagline. Swap language toggle order:

```html
<p>
  <a href="./README.md">English</a> ·
  <strong>简体中文</strong>
</p>
```

Keep all other content in Chinese.
