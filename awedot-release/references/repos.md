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
- **CI**: `.github/workflows/ci.yml` — runs on `main` pushes, pull requests into
  `main`, and manual dispatch. `dev` pushes run nothing. Docs, `**.md`,
  `.claude/**`, and `.superpowers/**` never trigger it.
- **Version source**: `package.json` `version` field
- **Sync script**: `npm run sync-version` → updates `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src/constants.ts`
- **CHANGELOG**: `docs/CHANGELOG.md`
- **DMG build**: `bash scripts/build-mac-universal.sh`
- **DMG output**: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/awedot_{version}_universal.dmg`

## awedot

- **Path**: `product/awedot/awedot`
- **Remote**: `https://github.com/mugpeng/awedot.git`
- **Branch**: `main` (single branch)
- **Version**: `version.json` — `{ "version": "X.Y.Z", "filename": "awedot_X.Y.Z_universal.dmg" }`
- **CHANGELOG**: `CHANGELOG.md`
- **Releases**: GitHub Releases, tag `vX.Y.Z`, DMG uploaded as asset
