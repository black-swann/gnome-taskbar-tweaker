#!/usr/bin/env bash
set -euo pipefail

schema="org.gnome.shell.extensions.gnome-taskbar-tweaker"

echo "layout-version: $(gsettings get "$schema" layout-version)"
echo "panel-layout:   $(gsettings get "$schema" panel-layout)"
echo "baseline-layout: $(gsettings get "$schema" baseline-layout)"
echo "last-error:     $(gsettings get "$schema" last-error)"
