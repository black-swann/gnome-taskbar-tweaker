# QA Notes

## Static validation

- `glib-compile-schemas schemas` passes
- `node --check extension.js prefs.js layout.js` passes when `node` is installed; otherwise `make check` skips syntax lint and still validates schemas
- `gnome-extensions pack` succeeds through `./scripts/package.sh`
- `./scripts/smoke-test.sh --install` verifies the installed extension is enabled, can populate live settings on the running GNOME session, and warns if GNOME Shell is still showing stale `OUT OF DATE` metadata until the next login

## Live validation

Validated in a GNOME Shell 49 session and rechecked against GNOME Shell 50 tooling on Ubuntu 26.04:

- extension installs and enables locally
- preferences window opens
- panel items are discovered
- move controls update stored layout
- persist-layout keeps saved positions for indicators that appear later in the session
- reset restores the baseline layout
- disable restores the original captured order
- metadata advertises GNOME Shell `50` compatibility
- GNOME Shell may continue showing `State: OUT OF DATE` until the session is restarted after a metadata-only compatibility update

## Known limits

- Only `statusArea` items are movable.
- Unsupported panel actors remain read-only and may still appear between movable items.
- Desktop-specific indicator behavior may still require live verification after changes.
