#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$DIR/../../.." && pwd )"
SRC_DIR="$ROOT_DIR/src"

echo "Installing dependecies..."
cd "$SRC_DIR"
npm install
npm install --save-dev jszip # just in case for tests

VERSION=$(node -p "require('../package.json').version")
BASE_DIST_DIR="$ROOT_DIR/dist/audio-decode-libav-$VERSION"
rm -rf "$BASE_DIST_DIR"
mkdir -p "$BASE_DIST_DIR"

LIBAV_ENGINES_DIR="$ROOT_DIR/../libav.js-audio/dist/libav-6.8.8.0-audio"

# Find each engine directory
for ENGINE_PATH in "$LIBAV_ENGINES_DIR"/*/; do
    if [ ! -d "$ENGINE_PATH" ]; then continue; fi
    ENGINE_NAME=$(basename "$ENGINE_PATH")
    echo "Structuring for engine: $ENGINE_NAME"
    
    VARIANT_DIST="$BASE_DIST_DIR/$ENGINE_NAME"
    mkdir -p "$VARIANT_DIST"
    
    # Copy JS source
    cp "$SRC_DIR/audio-decode.js" "$VARIANT_DIST/"
    cp "$SRC_DIR/audioMimeType.js" "$VARIANT_DIST/"
    cp "$SRC_DIR/audioType.js" "$VARIANT_DIST/"
    cp "$SRC_DIR/decoder.js" "$VARIANT_DIST/"
    
    cp "$SRC_DIR/audio-decode.d.ts" "$VARIANT_DIST/"
    cp "$ROOT_DIR/package.json" "$VARIANT_DIST/"
    cp "$ROOT_DIR/README.md" "$VARIANT_DIST/" || true
    
    # Check if Decoder natively injected Libav, replace its import
    if grep -q "import LibAVFactory" "$VARIANT_DIST/decoder.js"; then
        node -e "
            const fs = require('fs');
            let code = fs.readFileSync('$VARIANT_DIST/decoder.js', 'utf8');
            code = code.replace(/import LibAVFactory.*?;/g, \`import LibAVFactory from './libav.js-audio/dist/${ENGINE_NAME}';\`);
            fs.writeFileSync('$VARIANT_DIST/decoder.js', code);
        "
    fi
    
    # Copy Engine files identically into the expected sub-path for libav
    ENGINE_OUTPUT_PATH="$VARIANT_DIST/libav.js-audio"
    mkdir -p "$ENGINE_OUTPUT_PATH"
    cp -a "$ENGINE_PATH/"* "$ENGINE_OUTPUT_PATH/"
done
