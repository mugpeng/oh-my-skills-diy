#!/bin/bash
# Create GitHub Release for awedot with DMG asset.
# Usage: ./publish-release.sh <version> <dmg-path> [awedot-path]
# Example: ./publish-release.sh 0.5.3 /path/to/awedot_0.5.3_universal.dmg

set -e

VERSION="$1"
DMG_PATH="$2"
AWEDOT_DIR="${3:-$(cd "$(dirname "$0")/../../../../../product/awedot/awedot" && pwd)}"

if [ -z "$VERSION" ] || [ -z "$DMG_PATH" ]; then
  echo "Usage: $0 <version> <dmg-path> [awedot-dir]"
  exit 1
fi

if [ ! -f "$DMG_PATH" ]; then
  echo "ERROR: DMG not found at $DMG_PATH"
  exit 1
fi

cd "$AWEDOT_DIR"

NOTES_FILE=$(mktemp)
# Extract lines from "## vX.Y.Z" up to (but not including) next "## "
sed -n "/^## v${VERSION} /,/^## v/p" CHANGELOG.md | sed '$d' > "$NOTES_FILE"

if [ ! -s "$NOTES_FILE" ]; then
  echo "WARNING: No changelog entry found for v$VERSION, using empty notes"
  touch "$NOTES_FILE"
fi

echo "==> Creating release v$VERSION..."
gh release create "v$VERSION" \
  --repo mugpeng/awedot \
  --title "v$VERSION" \
  --notes-file "$NOTES_FILE" \
  "$DMG_PATH"

rm "$NOTES_FILE"
echo ""
echo "Done. https://github.com/mugpeng/awedot/releases/tag/v$VERSION"
