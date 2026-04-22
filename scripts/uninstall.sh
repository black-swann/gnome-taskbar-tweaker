#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

make -C "${PROJECT_DIR}" uninstall

echo "Uninstalled GNOME Taskbar Tweaker."
