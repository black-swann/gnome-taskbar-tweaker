#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
import ast
import json
import subprocess

schema = "org.gnome.shell.extensions.gnome-taskbar-tweaker"
raw = subprocess.check_output(
    ["gsettings", "get", schema, "available-items"],
    text=True,
).strip()

if raw.startswith("@as "):
    raw = raw[4:]

entries = ast.literal_eval(raw)
if not entries:
    print("No available items recorded.")

for entry in entries:
    item = json.loads(entry)
    print(
        f"{item['section']:<6} movable={str(item['movable']).lower():<5} "
        f"visible={str(item['visible']).lower():<5} "
        f"id={item['id']} label={item['label']}"
    )
PY
