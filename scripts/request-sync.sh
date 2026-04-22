#!/usr/bin/env bash
set -euo pipefail

schema="org.gnome.shell.extensions.gnome-taskbar-tweaker"
current="$(gsettings get "$schema" sync-generation | awk '{print $NF}')"
next="$((current + 1))"

gsettings set "$schema" sync-generation "$next"
