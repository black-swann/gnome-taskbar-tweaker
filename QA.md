# QA Notes

## Static validation

- `glib-compile-schemas schemas` passes
- `node --check extension.js prefs.js layout.js` passes
- `gnome-extensions pack` succeeds through `./scripts/package.sh`

## Live validation

Validated in a GNOME Shell 49 session:

- extension installs and enables locally
- preferences window opens
- panel items are discovered
- move controls update stored layout
- reset restores the baseline layout
- disable restores the original captured order

## Known limits

- Only `statusArea` items are movable.
- Unsupported panel actors remain read-only and may still appear between movable items.
- Desktop-specific indicator behavior may still require live verification after changes.
