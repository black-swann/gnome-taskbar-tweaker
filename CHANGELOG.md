# Changelog

## v3

- added GNOME Shell `50` compatibility metadata and updated release docs for Ubuntu 26.04
- added a persist-layout preference so saved item ordering survives indicators appearing later in the session
- removed the helper scripts' hard dependency on `node` for metadata lookups
- added `scripts/smoke-test.sh` for live-session validation of install state, refresh behavior, and runtime health

## v2

- simplified the preferences UI to refresh, reset, and movement controls only
- removed the broken hide/show feature
- refactored shared layout helpers used by both runtime and preferences code
- cleaned public-facing docs and packaging flow
- added a versioned release artifact in `dist/`
