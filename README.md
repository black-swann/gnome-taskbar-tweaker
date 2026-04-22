# GNOME Taskbar Tweaker

GNOME Taskbar Tweaker is a GNOME Shell 49 extension for reordering supported top-panel items across the left, center, and right sections.

It stays deliberately conservative:

- only items exposed through `Main.panel.statusArea` are movable
- unsupported panel actors are left untouched
- the extension captures a baseline layout so the panel can be reset safely
- disabling the extension restores the original captured order

## Features

- move supported panel items between left, center, and right
- reorder items within a section
- refresh panel discovery after other extensions change
- reset to the detected baseline layout
- compact preferences UI with minimal controls

## Requirements

- GNOME Shell `49`
- a local session where `gnome-extensions` and `gsettings` are available

## Install from source

```bash
make check
./scripts/install.sh
gnome-extensions enable "$(node -p "require('./metadata.json').uuid")"
./scripts/open-prefs.sh
```

If GNOME Shell does not pick up changes immediately, disable and re-enable the extension or start a fresh session.

## Development workflow

```bash
make check
./scripts/show-items.sh
./scripts/show-layout.sh
./scripts/show-status.sh
./scripts/request-sync.sh
./scripts/manual-test.sh
```

## Packaging a release

```bash
./scripts/package.sh
```

This produces:

- `dist/<uuid>.shell-extension.zip`: the raw `gnome-extensions pack` output
- `dist/gnome-taskbar-tweaker-v<version>.zip`: a versioned release artifact

## Repository layout

- `extension.js`: GNOME Shell runtime integration
- `prefs.js`: preferences window
- `layout.js`: shared layout parsing and movement logic
- `schemas/`: GSettings schema
- `scripts/`: install, package, debug, and test helpers
- `CHANGELOG.md`: release notes
- `RELEASING.md`: release checklist

## Publishing notes

Before publishing publicly, review `RELEASING.md`.

In particular:

- confirm the UUID in `metadata.json` matches the public namespace you want to keep long-term
- confirm the copyright name in `LICENSE` is the one you want to publish
- verify ignored local files stay out of the repository
