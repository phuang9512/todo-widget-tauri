#!/usr/bin/env bash
# Build a universal macOS app + DMG.
# Usage:  bash scripts/build-macos.sh
#         (or chmod +x scripts/build-macos.sh && ./scripts/build-macos.sh)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

for cmd in cargo rustup npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing '$cmd'. Install Xcode Command Line Tools, Rust (https://rustup.rs), and Node.js 20+." >&2
    exit 1
  fi
done

echo "Installing frontend tooling..."
npm install

echo "Adding Apple Silicon + Intel targets..."
rustup target add aarch64-apple-darwin x86_64-apple-darwin

echo "Building universal app and DMG..."
npm run tauri build -- --target universal-apple-darwin --bundles app,dmg

DIST="$ROOT/dist/macos"
APP="$ROOT/src-tauri/target/universal-apple-darwin/release/bundle/macos/待办清单.app"
if [ ! -d "$APP" ]; then
  echo "Build finished but '$APP' was not found." >&2
  exit 1
fi
mkdir -p "$DIST"
rm -rf "$DIST/待办清单.app"
cp -R "$APP" "$DIST/"

echo
echo "App:  $DIST/待办清单.app"
echo "DMG:  $ROOT/src-tauri/target/universal-apple-darwin/release/bundle/dmg"
echo "The build is unsigned; Gatekeeper may ask for confirmation on first launch."
