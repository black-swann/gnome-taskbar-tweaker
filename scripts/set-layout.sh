#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -eq 0 ]]; then
    echo "Usage: $0 left:activities left:appindicator@/path right:quickSettings"
    echo "This sets the stored layout across the left, center, and right panel sections."
    exit 1
fi

layout="$(
    python3 - "$@" <<'PY'
import sys

entries = sys.argv[1:]
valid_sections = {"left", "center", "right"}
quoted = []

for entry in entries:
    section, separator, item_id = entry.partition(":")
    if not separator or section not in valid_sections or not item_id:
        print(
            f"Invalid layout entry: {entry!r}. Expected section:itemId with section left, center, or right.",
            file=sys.stderr,
        )
        sys.exit(2)
    if "'" in entry:
        print(f"Invalid layout entry: {entry!r}. Single quotes are not supported.", file=sys.stderr)
        sys.exit(2)
    quoted.append(f"'{entry}'")

print(f"[{', '.join(quoted)}]")
PY
)"

gsettings set org.gnome.shell.extensions.gnome-taskbar-tweaker panel-layout "${layout}"
