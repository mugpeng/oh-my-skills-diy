# CHANGELOG Format

## Structure

Each version entry has three fixed sections, in order:

```markdown
## vX.Y.Z — YYYY-MM-DD

### Fixed

- **Title**: one-line description of the bug and fix

### Features

- **Title**: one-line description of the new feature

### Changed

- **Title**: description of behavioral or architectural changes (not new features, not bug fixes)
```

## Rules

- Only use `Fixed` / `Features` / `Changed`; omit sections with no entries
- Each item starts with a bold title followed by a colon and description
- Write descriptions in plain language for end users, not developers
- Internal refactors with no behavior change go under `Changed`; behavior changes go to `Fixed` or `Features`
- Date is the release date (usually the day main is pushed)
- Leave a blank line between entries
