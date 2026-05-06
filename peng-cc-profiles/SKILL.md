---
name: peng-cc-profiles
description: Create or update per-command Claude Code launchers such as cc-glm and cc-gemini using profile-specific settings.json files under /Users/peng/.cc-profiles while preserving the caller's original HOME. Use when the user asks to add a cc-* command, configure Claude Code providers/models through settings.json env, copy current Claude settings into a profile, or manage ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL, ANTHROPIC_DEFAULT_HAIKU_MODEL, ANTHROPIC_DEFAULT_SONNET_MODEL, and ANTHROPIC_DEFAULT_OPUS_MODEL for Claude Code wrappers.
---

# Peng CC Profiles

Manage Claude Code profile launchers for Peng's machine. Each profile gets its own `settings.json`, while wrapper commands preserve the caller's original `HOME` so normal shell behavior and shared Claude Code state remain unchanged.

## Paths

Use these paths unless the user explicitly asks otherwise:

| Purpose | Path |
| --- | --- |
| Profile root | `/Users/peng/.cc-profiles/<profile>` |
| Profile settings | `/Users/peng/.cc-profiles/<profile>/.claude/settings.json` |
| Launcher command | `/Users/peng/.local/bin/cc-<name>` |
| Claude executable | `/Users/peng/.deskclaw/node/bin/claude` |
| Source settings template | `/Users/peng/.claude/settings.json` |

Profile names should match the command suffix. Example: `cc-gemini` uses profile `cc-gemini`.

## Launcher Template

Create launchers as executable Bash scripts:

```bash
#!/usr/bin/env bash
set -euo pipefail

exec /Users/peng/.deskclaw/node/bin/claude \
  --settings "/Users/peng/.cc-profiles/<profile>/.claude/settings.json" \
  "$@"
```

Do not set or export `HOME` in the wrapper unless the user explicitly asks for fully isolated Claude Code state. The default design isolates only `settings.json`; sessions, cache, skills, and plugins follow the caller's normal `HOME`.

Do not unset `ANTHROPIC_AUTH_TOKEN` in the launcher. Provider credentials belong in the profile `settings.json`.

## Settings Workflow

1. Read `/Users/peng/.claude/settings.json` as the template.
2. Create `/Users/peng/.cc-profiles/<profile>/.claude/`.
3. Merge profile-specific `env` values into the template.
4. Store the profile credential in `ANTHROPIC_AUTH_TOKEN`; remove `ANTHROPIC_API_KEY` from profile env to avoid auth conflicts.
5. Write valid pretty-printed JSON to the profile settings path.
6. Create or update `/Users/peng/.local/bin/cc-<name>` without replacing the original `HOME`.
7. Run validation commands before reporting completion.

For updates to an existing profile, preserve any user-filled `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` unless the user supplies replacements. If an existing profile still has `ANTHROPIC_API_KEY`, migrate that value into `ANTHROPIC_AUTH_TOKEN` and delete `ANTHROPIC_API_KEY`.

## Env Rules

Always configure provider credentials and model routing inside `settings.json` under `env`, not in the wrapper script, unless the user explicitly asks for shell-level env exports.

Common fields:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "",
    "ANTHROPIC_BASE_URL": "",
    "ANTHROPIC_MODEL": "<main-model>",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "<haiku-model>",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "<sonnet-model>",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "<opus-model>"
  }
}
```

If the user says "API and base_url I will fill myself", leave `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` as empty strings. If they already exist in the profile, preserve them.

Do not leave both `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`; Claude Code reports an auth conflict. Prefer `ANTHROPIC_AUTH_TOKEN` for these profiles.

## Known Profiles

Use these model mappings when requested:

| Command | Main | Haiku | Sonnet | Opus |
| --- | --- | --- | --- | --- |
| `cc-glm` | `glm5.1` | preserve existing if present, otherwise `glm5.1` | `glm5.1` | `glm5.1` |
| `cc-gemini` | `gemini-3.1-pro-preview` | `gemini-3.1-flash-lite-preview` | `gemini-3.1-pro-preview` | `gemini-3.1-pro-preview` |

When the user gives different model names, use the user's values.

## Implementation Commands

Use Node for JSON-safe merges:

```bash
rtk node -e 'const fs=require("fs"); const src="/Users/peng/.claude/settings.json"; const dst="/Users/peng/.cc-profiles/<profile>/.claude/settings.json"; const cfg=JSON.parse(fs.readFileSync(src,"utf8")); cfg.env={...(cfg.env||{}), ANTHROPIC_AUTH_TOKEN:"", ANTHROPIC_BASE_URL:"", ANTHROPIC_MODEL:"<main>", ANTHROPIC_DEFAULT_HAIKU_MODEL:"<haiku>", ANTHROPIC_DEFAULT_SONNET_MODEL:"<sonnet>", ANTHROPIC_DEFAULT_OPUS_MODEL:"<opus>"}; delete cfg.env.ANTHROPIC_API_KEY; fs.writeFileSync(dst, JSON.stringify(cfg,null,2)+"\n");'
```

Use `apply_patch` for wrapper scripts when possible. Use `chmod +x` after creating launchers.

## Validation

Before claiming completion, run:

```bash
rtk which cc-<name>
rtk sed -n '1,80p' /Users/peng/.local/bin/cc-<name>
rtk node -e 'JSON.parse(require("fs").readFileSync("/Users/peng/.cc-profiles/<profile>/.claude/settings.json","utf8")); console.log("settings json valid")'
rtk node -e 'const cfg=JSON.parse(require("fs").readFileSync("/Users/peng/.cc-profiles/<profile>/.claude/settings.json","utf8")); console.log(JSON.stringify({model:cfg.env?.ANTHROPIC_MODEL,haiku:cfg.env?.ANTHROPIC_DEFAULT_HAIKU_MODEL,sonnet:cfg.env?.ANTHROPIC_DEFAULT_SONNET_MODEL,opus:cfg.env?.ANTHROPIC_DEFAULT_OPUS_MODEL,hasHooks:Boolean(cfg.hooks),hasPermissions:Boolean(cfg.permissions)},null,2))'
```

Do not print secret values. Report only whether auth token/base URL are present.
