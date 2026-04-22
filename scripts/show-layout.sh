#!/usr/bin/env bash
set -euo pipefail

schema="org.gnome.shell.extensions.gnome-taskbar-tweaker"

echo "panel-layout:   $(gsettings get "$schema" panel-layout)"
echo "baseline-layout: $(gsettings get "$schema" baseline-layout)"
