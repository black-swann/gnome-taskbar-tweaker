#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

make -C "${PROJECT_DIR}" install

echo "Installed GNOME Taskbar Tweaker."
echo "Enable it with:"
echo "  gnome-extensions enable $(extension_uuid)"
