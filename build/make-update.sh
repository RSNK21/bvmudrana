#!/bin/bash
# Builds "BV Mudrana Update <version>.exe" from dist/win-unpacked (run after electron-builder).
# The update replaces only the program files on a computer that already has BV Mudrana.
set -e
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./package.json').version")
RUNTIME=$(cat build/bvm-runtime.txt)
NSISDIR=${NSISDIR:-$(ls -d ~/.cache/electron-builder/nsis-*/nsis-*/ | head -1)}
MAKENSIS="$NSISDIR/linux/makensis"
[ -x "$MAKENSIS" ] || MAKENSIS=makensis
OUT="$PWD/dist/BV Mudrana Update $VERSION.exe"
cd build
NSISDIR="$NSISDIR" "$MAKENSIS" -V2 -DVERSION="$VERSION" -DRUNTIME="$RUNTIME" -DAPPDIR="$PWD/../dist/win-unpacked" -DOUTFILE="$OUT" update.nsi
ls -la "$OUT"
