#!/usr/bin/env bash
set -euo pipefail

gsettings set org.gnome.shell.extensions.gnome-taskbar-tweaker panel-layout \
  "$(gsettings get org.gnome.shell.extensions.gnome-taskbar-tweaker baseline-layout)"
