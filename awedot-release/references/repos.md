# Repository Definitions

## awedot-dev

- **Path**: `product/awedot/awedot-dev`
- **Remote**: `https://github.com/mugpeng/awedot-dev.git`
- **Branch**: `main` (single branch, direct push)
- **Version**: No package.json; version managed centrally in awedot-source

## awedot-source

- **Path**: `product/awedot/awedot-source`
- **Remote**: `https://github.com/mugpeng/awedot-source.git`
- **Branches**: `dev` (development) / `main` (release)
- **CI**: two workflows, all triggered by `main` pushes, PRs into `main`, and
  manual dispatch (`workflow_dispatch` works on any branch, including `dev`).
  `dev` pushes run nothing:
  - `ci.yml` — frontend (Biome + tsc + vitest, ubuntu), always runs; docs,
    `**.md`, `.claude/**`, and `.superpowers/**` never trigger it.
  - `rust-ci.yml` — Windows runner (bridge build + fmt + clippy + test with
    `--features cursor`), runs only when `src-tauri/**` or
    `rust-toolchain.toml` changed.
- **Version source**: `package.json` `version` field
- **Sync script**: `npm run sync-version` → updates `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src/constants.ts`
- **CHANGELOG**: `docs/CHANGELOG.md`
- **DMG build**: `bash scripts/build-mac-universal.sh`
- **DMG output**: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/awedot_{version}_universal.dmg`

## awedot

- **Path**: `product/awedot/awedot`
- **Remote**: `https://github.com/mugpeng/awedot.git`
- **Branch**: `main` (single branch)
- **Version**: `version.json` — `{ "version": "X.Y.Z", "filename": "awedot_X.Y.Z_universal.dmg" }`,
  edited directly in the release commit (Phase 1c)
- **CHANGELOG**: `CHANGELOG.md` — mirrors `awedot-source/docs/CHANGELOG.md`;
  the new entry is copied over in Phase 1c
- **Releases**: GitHub Releases, tag `vX.Y.Z`, DMG uploaded as asset
- **releases/**: archive of past DMGs, maintained inconsistently (local copies
  lag `version.json`); `scripts/gen-version.sh` can regenerate `version.json`
  from the newest DMG there
