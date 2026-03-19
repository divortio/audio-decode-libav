#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$DIR/../../.." && pwd )"

echo "Running extensive Node:Test matrices across 6 engines and all payload fragments..."
cd "$ROOT_DIR/tests"
node --test runAll.test.js
