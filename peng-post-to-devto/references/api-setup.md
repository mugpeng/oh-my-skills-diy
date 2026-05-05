# API Token Setup

Guided setup when `DEVTO_TOKEN` is missing. Invoked by the pre-flight check.

## Detection

Look for the token in this order:

1. Environment variable `DEVTO_TOKEN`
2. `<cwd>/.peng-skills/.env` with `DEVTO_TOKEN=...`
3. `$HOME/.peng-skills/.env` with `DEVTO_TOKEN=...`

If none are present, run the guided setup below.

## Guided Setup

Show this message to the user:

```
Dev.to API token not found.

To obtain a token:
1. Visit https://dev.to/settings/extensions
2. Scroll to "DEV Community API Keys"
3. Generate a new API key (give it a descriptive name like "claude-code")
4. Copy the key

Where to save?
A) Project-level: .peng-skills/.env (this project only)
B) User-level: ~/.peng-skills/.env (all projects)
```

After they choose a location, collect the value and write:

```
DEVTO_TOKEN=<user_input>
```

Create the directory if it doesn't exist.

## Verification

After saving, run `check-token.ts` to confirm the token works.
