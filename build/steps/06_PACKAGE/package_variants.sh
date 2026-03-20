#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$DIR/../../.." && pwd )"
VERSION=$(node -p "require('$ROOT_DIR/package.json').version")
BASE_DIST_DIR="$ROOT_DIR/dist/audio-decode-libav-$VERSION"

echo "Zipping Engine distributions..."
cd "$BASE_DIST_DIR"
for ENGINE_DIR in */; do
    if [ ! -d "$ENGINE_DIR" ]; then continue; fi
    ENGINE_NAME=$(basename "$ENGINE_DIR")
    zip -rq "${ENGINE_NAME}.zip" "$ENGINE_NAME"
    echo "Zipped $ENGINE_NAME"
done
