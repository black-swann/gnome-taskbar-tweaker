#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

make -C "${PROJECT_DIR}" package

echo "Bundles created in ${PROJECT_DIR}/dist"
echo "Release artifact:"
echo "  ${PROJECT_DIR}/dist/gnome-taskbar-tweaker-v$(extension_version).zip"
