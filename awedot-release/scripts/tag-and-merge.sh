#!/bin/bash
# Merge dev -> main, wait for CI, then tag.
# Usage: ./tag-and-merge.sh <version> [source-path]
# Example: ./tag-and-merge.sh 0.5.3
#
# Order matters. CI in awedot-source runs on `main` pushes only — `dev` pushes
# trigger nothing — so this push is the release's first and only automated check.
# Pushing main before tagging means a failed build leaves no published tag to
# retract; the fix is just another commit on dev.
#
# Set SKIP_CI_WAIT=1 to tag without waiting, for when CI itself is unavailable.

set -e

VERSION="$1"
SOURCE_DIR="${2:-$(cd "$(dirname "$0")/../../../../product/awedot/awedot-source" && pwd)}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version> [source-dir]"
  exit 1
fi

cd "$SOURCE_DIR"

echo "==> Merging dev -> main..."
git checkout main
git merge dev
git checkout dev

echo "==> Pushing main (this is what triggers CI)..."
git push origin main

MAIN_SHA="$(git rev-parse main)"

if [ -n "$SKIP_CI_WAIT" ]; then
  echo "==> SKIP_CI_WAIT set — tagging without waiting for CI."
else
  echo "==> Waiting for CI on main ($MAIN_SHA)..."

  # The run takes a few seconds to register after the push, so poll for it.
  RUN_ID=""
  for _ in $(seq 1 20); do
    RUN_ID="$(gh run list --branch main --limit 10 --json databaseId,headSha \
      --jq "map(select(.headSha == \"$MAIN_SHA\")) | .[0].databaseId // empty")"
    [ -n "$RUN_ID" ] && break
    sleep 3
  done

  if [ -z "$RUN_ID" ]; then
    echo "ERROR: no CI run appeared for $MAIN_SHA within 60s." >&2
    echo "  Check https://github.com/mugpeng/awedot-source/actions" >&2
    echo "  To tag without CI: SKIP_CI_WAIT=1 $0 $VERSION" >&2
    exit 1
  fi

  # --exit-status turns a failed run into a non-zero exit, so `set -e` stops the
  # script here — before any tag exists.
  gh run watch "$RUN_ID" --exit-status
fi

# Tag `main` explicitly, not the checked-out branch: main is the ref CI verified,
# and a non-fast-forward merge would leave dev pointing at a different commit.
echo "==> Tagging v$VERSION on main..."
git tag "v$VERSION" main
git push origin "v$VERSION"

echo ""
echo "Done. v$VERSION tagged on a CI-verified main."
