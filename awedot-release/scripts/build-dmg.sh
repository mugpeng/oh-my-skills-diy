#!/bin/bash
# Build universal macOS DMG for awedot.
# Usage: ./build-dmg.sh [source-path]
# Prints the DMG file path on success.

set -e

SOURCE_DIR="${1:-$(cd "$(dirname "$0")/../../../../../product/awedot/awedot-source" && pwd)}"

cd "$SOURCE_DIR"

echo "==> Building universal DMG..."
bash scripts/build-mac-universal.sh

DMG=$(find src-tauri/target/universal-apple-darwin/release/bundle/dmg -name "*.dmg" -type f | head -1)

if [ -z "$DMG" ]; then
  echo "ERROR: DMG not found after build"
  exit 1
fi

echo ""
echo "DMG ready: $SOURCE_DIR/$DMG"
