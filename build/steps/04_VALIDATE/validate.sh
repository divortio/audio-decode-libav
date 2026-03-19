#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$DIR/../../.." && pwd )"

echo "Validating src paths and Node execution environment..."
# In the future this might invoke linting or typescript typechecking if re-added
node -e "require('fs').existsSync('$ROOT_DIR/src/audio-decode.js') || process.exit(1)"
