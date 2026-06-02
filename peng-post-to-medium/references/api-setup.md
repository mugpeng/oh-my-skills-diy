# API Token Setup

Guided setup when `MEDIUM_TOKEN` is missing. Invoked by the pre-flight check.

## Detection

Look for the token in this order:

1. Environment variable `MEDIUM_TOKEN`
2. `<cwd>/.peng-skills/.env` with `MEDIUM_TOKEN=...`
3. `$HOME/.peng-skills/.env` with `MEDIUM_TOKEN=...`

If none are present, run the guided setup below.

## Guided Setup

Show this message to the user:

```
Medium Integration Token not found.

To obtain a token:
1. Visit https://medium.com/me/settings
2. Scroll to "Integration tokens" (under "Security and apps")
3. Enter a descriptive name (e.g. "claude-code") and click "Get integration token"
4. Copy the token immediately (it won't be shown again)

Where to save?
A) Project-level: .peng-skills/.env (this project only)
B) User-level: ~/.peng-skills/.env (all projects)
```

After they choose a location, collect the value and write:

```
MEDIUM_TOKEN=<user_input>
```

Create the directory if it doesn't exist.

## Verification

After saving, run `check-token.ts` to confirm the token works.

## Token Scopes

Medium integration tokens have these permissions by default:
- **List user info** — read your profile
- **Create posts** — publish to your profile or publications
- **List publications** — see publications you contribute to

Note: Tokens cannot update or delete existing posts. Edits must be done on Medium directly.
