#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

project_dir="${PROJECT_DIR}"
schema="org.gnome.shell.extensions.gnome-taskbar-tweaker"
uuid="$(extension_uuid)"
install_first=false

if [[ "${1-}" == "--install" ]]; then
    install_first=true
elif [[ $# -gt 0 ]]; then
    printf 'Usage: %s [--install]\n' "$0" >&2
    exit 2
fi

require_command() {
    local command="$1"
    if ! command -v "$command" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$command" >&2
        exit 1
    fi
}

print_check() {
    printf '[check] %s\n' "$1"
}

fail() {
    printf '[fail] %s\n' "$1" >&2
    exit 1
}

warn() {
    printf '[warn] %s\n' "$1" >&2
}

require_command gnome-extensions
require_command gsettings
require_command python3

if [[ -z "${DBUS_SESSION_BUS_ADDRESS-}" ]]; then
    fail 'DBUS_SESSION_BUS_ADDRESS is not set; run this inside the GNOME user session.'
fi

print_check "GNOME Shell version: $(gnome-extensions version)"
print_check "Session desktop: ${XDG_CURRENT_DESKTOP-unknown}"

python3 - "$project_dir/metadata.json" "$(gnome-extensions version)" <<'PY'
import json
import sys
from pathlib import Path

metadata_path = Path(sys.argv[1])
shell_version = sys.argv[2].strip()
major = shell_version.split(".", 1)[0]

metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
supported = metadata.get("shell-version", [])
if major not in supported:
    print(f"[fail] metadata.json does not advertise GNOME Shell {major}", file=sys.stderr)
    sys.exit(1)

print(f"[check] metadata.json advertises GNOME Shell {major}")
PY

if [[ "$install_first" == true ]]; then
    print_check "Installing current working tree into ${HOME}/.local/share/gnome-shell/extensions/${uuid}"
    "${project_dir}/scripts/install.sh"
fi

extension_info="$(gnome-extensions info "$uuid" 2>/dev/null)" || fail "Extension ${uuid} is not installed."
printf '%s\n' "$extension_info"

grep -q 'Enabled: Yes' <<<"$extension_info" || fail "Extension ${uuid} is not enabled."
if grep -q 'State: OUT OF DATE' <<<"$extension_info"; then
    installed_metadata_ok="$(python3 - "$HOME/.local/share/gnome-shell/extensions/$uuid/metadata.json" "$(gnome-extensions version)" <<'PY'
import json
import sys
from pathlib import Path

metadata_path = Path(sys.argv[1])
shell_version = sys.argv[2].strip()
major = shell_version.split(".", 1)[0]
metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
print("yes" if major in metadata.get("shell-version", []) else "no")
PY
)"
    if [[ "$installed_metadata_ok" == "yes" ]]; then
        warn "GNOME Shell still reports OUT OF DATE even though the installed metadata advertises the running shell version. Log out and back in once to clear the stale session cache."
    else
        fail "Installed extension is still OUT OF DATE for the running GNOME Shell."
    fi
fi

print_check 'Requesting a live rescan from GNOME Shell'
"${project_dir}/scripts/request-sync.sh"
sleep 1

python3 - "$schema" <<'PY'
import ast
import json
import subprocess
import sys

schema = sys.argv[1]

def get_value(key):
    return subprocess.check_output(["gsettings", "get", schema, key], text=True).strip()

last_error = get_value("last-error")
if last_error != "''":
    print(f"[fail] last-error is set to {last_error}", file=sys.stderr)
    sys.exit(1)

available_raw = get_value("available-items")
if available_raw.startswith("@as "):
    available_raw = available_raw[4:]
available_items = ast.literal_eval(available_raw)
if not available_items:
    print("[fail] available-items is empty after refresh", file=sys.stderr)
    sys.exit(1)

panel_layout_raw = get_value("panel-layout")
if panel_layout_raw.startswith("@as "):
    panel_layout_raw = panel_layout_raw[4:]
panel_layout = ast.literal_eval(panel_layout_raw)
if not panel_layout:
    print("[fail] panel-layout is empty after refresh", file=sys.stderr)
    sys.exit(1)

print(f"[check] discovered {len(available_items)} available items")
print(f"[check] stored {len(panel_layout)} panel layout entries")
print("[pass] last-error is empty and live state is populated")
PY
