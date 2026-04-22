#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -eq 0 ]]; then
    echo "Usage: $0 left:activities left:appindicator@/path right:quickSettings"
    echo "This sets the stored layout across the left, center, and right panel sections."
    exit 1
fi

quoted=()
for entry in "$@"; do
    quoted+=("'${entry}'")
done

layout="[${quoted[*]}]"
layout="${layout// /, }"

gsettings set org.gnome.shell.extensions.gnome-taskbar-tweaker panel-layout "${layout}"
