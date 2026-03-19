#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$DIR")"

echo "Executing audio-decode-libav build steps sequentially..."

# 03_BUILD
echo "--- Running Step 03_BUILD ---"
cd "$DIR/steps/03_BUILD"
if [ -f "build_variants.sh" ]; then bash build_variants.sh; fi

# 04_VALIDATE
echo "--- Running Step 04_VALIDATE ---"
if [ -d "$DIR/steps/04_VALIDATE" ]; then
    cd "$DIR/steps/04_VALIDATE"
    for script in *.sh; do [ -f "$script" ] && bash "$script"; done
fi

# 05_TEST
echo "--- Running Step 05_TEST ---"
cd "$DIR/steps/05_TEST"
if [ -f "testBuilds.sh" ]; then bash testBuilds.sh; fi

# 06_PACKAGE
echo "--- Running Step 06_PACKAGE ---"
cd "$DIR/steps/06_PACKAGE"
if [ -f "package_variants.sh" ]; then bash package_variants.sh; fi

echo "audio-decode-libav build pipeline completed successfully!"
