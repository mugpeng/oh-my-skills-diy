#!/bin/bash
# Bump version across awedot-source and awedot repos.
# Usage: ./bump-version.sh <version> [awedot-source-path] [awedot-path]
# Example: ./bump-version.sh 0.5.3

set -e

VERSION="$1"
SOURCE_DIR="${2:-$(cd "$(dirname "$0")/../../../../product/awedot/awedot-source" && pwd)}"
AWEDOT_DIR="${3:-$(cd "$(dirname "$0")/../../../../product/awedot/awedot" && pwd)}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version> [source-dir] [awedot-dir]"
  exit 1
fi

echo "==> Bumping version to $VERSION"

# --- awedot-source ---
echo "==> Updating awedot-source..."
cd "$SOURCE_DIR"

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
if (pkg.version !== '$VERSION') {
  pkg.version = '$VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log('  package.json -> $VERSION');
} else {
  console.log('  package.json already $VERSION');
}
"

npm run sync-version

git add -A
git commit -m "chore: release v$VERSION"
git push
echo "  awedot-source -> pushed"

# --- awedot ---
echo "==> Updating awedot..."
cd "$AWEDOT_DIR"

DMG_FILE="awedot_${VERSION}_universal.dmg"

node -e "
const fs = require('fs');
const vj = JSON.parse(fs.readFileSync('version.json', 'utf-8'));
vj.version = '$VERSION';
vj.filename = '$DMG_FILE';
fs.writeFileSync('version.json', JSON.stringify(vj, null, 2) + '\n');
console.log('  version.json -> $VERSION / $DMG_FILE');
"

git add -A
git commit -m "chore: release v$VERSION"
git push
echo "  awedot -> pushed"

echo ""
echo "Done. Version $VERSION synced across all repos."
