# CHANGELOG Format

## Structure

Each version entry looks like:

```markdown
## vX.Y.Z — YYYY-MM-DD

Optional one-paragraph intro, used for milestone releases (e.g. v0.7.3);
omit it for routine patches.

### Security

- Plain sentence describing the security fix.

### Features

- **Title**: one-line description of the new feature

### Fixed

- **Title**: one-line description of the bug and fix

### Changed

- **Title**: description of behavioral or architectural changes
```

## Rules

- Sections in use: `Security` / `Features` / `Fixed` / `Changed`, in that
  order (`Security` first when present, as in v0.7.5); omit empty sections
- Items are either `**Title**: description` or plain sentences — recent
  releases mix both, so use bold titles when a short label helps and plain
  sentences otherwise
- Write descriptions in plain language for end users, not developers
- Internal refactors with no behavior change go under `Changed`; behavior
  changes go to `Fixed` or `Features`; security fixes go to `Security`
- Date is the release date (usually the day main is pushed)
- Leave a blank line between entries
- Canonical file: `awedot-source/docs/CHANGELOG.md`. The `awedot` repo's
  `CHANGELOG.md` mirrors it — the new entry is copied over in Phase 1c
