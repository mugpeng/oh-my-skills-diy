#!/bin/bash
# Tag release and merge dev -> main in awedot-source.
# Usage: ./tag-and-merge.sh <version> [source-path]
# Example: ./tag-and-merge.sh 0.5.3

set -e

VERSION="$1"
SOURCE_DIR="${2:-$(cd "$(dirname "$0")/../../../../product/awedot/awedot-source" && pwd)}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version> [source-dir]"
  exit 1
fi

cd "$SOURCE_DIR"

echo "==> Creating tag v$VERSION..."
git tag "v$VERSION"

echo "==> Merging dev -> main..."
git checkout main
git merge dev
git checkout dev

echo "==> Pushing main and tag..."
git push origin main
git push origin "v$VERSION"

echo ""
echo "Done. v$VERSION tagged and main updated."
