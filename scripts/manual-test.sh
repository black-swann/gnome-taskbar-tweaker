#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

cat <<'EOF'
Manual Test Checklist

1. Install the extension:
   ./scripts/install.sh

2. Enable it:
EOF
printf '   gnome-extensions enable %s\n\n' "$(extension_uuid)"
cat <<'EOF'

3. Open preferences:
   ./scripts/open-prefs.sh

4. Confirm:
   - movable items appear in Left, Center, and Right sections
   - the controls are limited to Refresh, Reset, Left, Up, Down, and Right
   - the live panel updates when items move
   - there are no repeated runtime errors in ./scripts/logs.sh

5. Reorder:
   - move one item left or right across sections
   - move one item up or down within its section
   - confirm the live panel updates
   - confirm live discovery agrees with the stored `panel-layout`
   - confirm there are no repeated runtime errors in ./scripts/logs.sh

6. Reset:
   - click Reset in preferences or run ./scripts/reset-layout.sh
   - confirm the panel returns to the stored baseline order

7. Disable or uninstall:
EOF
printf '   gnome-extensions disable %s\n' "$(extension_uuid)"
cat <<'EOF'
   ./scripts/uninstall.sh

8. Confirm the panel remains sane after disable/uninstall.
EOF
