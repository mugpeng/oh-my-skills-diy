---
name: awedot-release
description: >
  Awedot desktop app release workflow. Use when the user mentions "release", "publish",
  "tag", "build DMG", "version bump", "changelog", "merge to main",
  or needs to sync versions, update CHANGELOG, create GitHub Releases, or build the DMG.
  Covers the full release flow across the awedot / awedot-source / awedot-dev repos.
---

# Awedot Release

Four phases. Pause for user confirmation between each phase.

## Repo Definitions

| Repo | Path | Branches | Role |
|------|------|----------|------|
| awedot-dev | `product/awedot/awedot-dev` | main | Backend service (CLI + Supabase Edge Functions) |
| awedot-source | `product/awedot/awedot-source` | dev / main | Tauri desktop app source |
| awedot | `product/awedot/awedot` | main | Website / CHANGELOG / version.json / GitHub Releases |

The user can trigger a release from any repo context; the skill locates all three repos automatically.

## Phase 1 — Version Sync

Goal: unify version numbers across all repos to the new version.

### 1a. Confirm new version

- Read `awedot-source/package.json` to get the current version.
- Ask the user for the new version (e.g., `0.5.3`).

### 1b. Update awedot-source

```bash
cd <awedot-source>
# 1. Run the tests — nothing on `dev` is checked by CI, and the pre-commit hook
#    (Biome, tsc, cargo fmt, clippy) runs no tests, so this is the last check
#    before Phase 2.
npm test
# 2. Edit package.json: set the "version" field
# 3. Run sync script
npm run sync-version
# 4. Commit and push
git add -A && git commit -m "chore: release vX.Y.Z"
git push
```

`sync-version` auto-updates: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src/constants.ts`.

`npm test` runs vitest and `cargo test`, but only for this machine's platform
(macOS). Windows has no local coverage at all — it is covered by the "Rust CI"
workflow, which runs automatically on PRs into `main` and on `main` pushes
whenever `src-tauri/**` changes. The release flow merges locally without a
PR, so when the release touches `src-tauri/src/platform/windows/`,
`transport/named_pipe.rs`, or anything else platform-specific, dispatch it on
`dev` first rather than finding out during Phase 2:

```bash
gh workflow run "Rust CI" --ref dev
```

### 1c. Update awedot

```bash
cd <awedot>
# 1. Edit version.json: update "version" and "filename" fields
# 2. Sync CHANGELOG.md: copy the new "## vX.Y.Z" entry (heading through the
#    blank line before the next "##") from awedot-source/docs/CHANGELOG.md
#    to just below the "# Changelog" header
git add -A && git commit -m "chore: release vX.Y.Z"
git push
```

Both files change in the same release commit — that is what the actual
`chore: release v0.7.5` commit did.

### 1d. Update awedot-dev

```bash
cd <awedot-dev>
# Commit and push any uncommitted changes
git add -A && git commit && git push
```

**Pause here. Confirm with the user before proceeding to Phase 2.**

## Phase 2 — Merge + CI + Tag

CI in awedot-source runs on `main` pushes only (ci.yml frontend job: Biome +
tsc + vitest on ubuntu; rust-ci.yml Windows build/lint/test when
`src-tauri/**` changed); pushes to `dev` trigger nothing. This push is
therefore the release's only automated check, and the order is load-bearing:
**push main, wait for green, then tag.** Tagging first would publish a tag
for a build that may not compile.

```bash
cd <awedot-source>
git checkout main && git merge dev
git checkout dev
git push origin main          # triggers CI — wait for all runs to pass

git tag vX.Y.Z main           # tag the ref CI just verified, not the branch
git push origin vX.Y.Z
```

Or use this skill's `scripts/tag-and-merge.sh`, which merges, pushes, waits
for every CI run on that SHA (frontend, plus Windows Rust when triggered),
and aborts before tagging if any run fails:

```bash
bash <skill-dir>/scripts/tag-and-merge.sh X.Y.Z
# source path defaults to product/awedot/awedot-source; pass another path
# as the second argument to override
```

If CI fails, fix it on `dev` and repeat Phase 1b then this phase. No tag was
created, so there is nothing to retract.

**Pause here. Confirm with the user before proceeding to Phase 3.**

## Phase 3 — Build DMG

```bash
cd <awedot-source>
bash scripts/build-mac-universal.sh
```

The script also ad-hoc signs the app and injects the bilingual installation
guides into the DMG; no extra steps are needed.

Output path:
```
src-tauri/target/universal-apple-darwin/release/bundle/dmg/awedot_X.Y.Z_universal.dmg
```

If the DMG was already built in a previous step, skip directly to Phase 4.

**Pause here. Confirm with the user before proceeding to Phase 4.**

## Phase 4 — Publish GitHub Release

Create a Release on the `awedot` repo:

```bash
cd <awedot>
gh release create vX.Y.Z \
  --repo mugpeng/awedot \
  --title "vX.Y.Z" \
  --notes-file /tmp/release-notes.md \
  <path-to-dmg>
```

**Release notes source**: the `## vX.Y.Z` entry in `awedot/CHANGELOG.md`
(synced in Phase 1c; mirrors `awedot-source/docs/CHANGELOG.md`) — this is
also what this skill's `scripts/publish-release.sh` extracts.

## CHANGELOG Format

See [references/changelog-format.md](references/changelog-format.md) for the full spec.

Quick reference:

```markdown
## vX.Y.Z — YYYY-MM-DD

### Fixed

- **Title**: one-line description

### Features

- **Title**: one-line description

### Changed

- **Title**: one-line description
```

## Notes

- Canonical version lives in `awedot-source/package.json`; `npm run sync-version` propagates it
- `awedot/version.json` `filename` field must match the DMG filename
- Ensure `awedot-dev` main is pushed before starting Phase 2
- `gh` CLI must be authenticated (`gh auth status`)
- awedot-source is private, so CI is billed. `ci.yml` is frontend-only
  (ubuntu) and runs on `main` pushes and PRs — it is cheap. `rust-ci.yml`
  runs on a Windows runner (bridge build + fmt + clippy + test) whenever
  `src-tauri/**` changes on `main` pushes / PRs, plus manual dispatch;
  macOS Rust is verified locally by `npm test` in Phase 1b.
