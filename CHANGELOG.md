# Changelog

## v10

- fixed GNOME Shell 50 teardown crashes by removing disable-time panel restore and avoiding retained panel actor references
- retry empty startup discovery while GNOME Shell is still rebuilding panel actors
- added fallback panel discovery and disposed-object guards for startup, refresh, and layout application
- avoid overwriting saved layout state when startup discovery temporarily finds no movable items
- restricted source installs to runtime extension files only
- added public README screenshot, security policy, and clearer source-install/troubleshooting guidance
- removed temporary live-session diagnostics from the runtime build

## v9

- reserved during GNOME Shell 50 runtime validation; superseded by v10

## v8

- reserved during GNOME Shell 50 runtime validation; superseded by v10

## v7

- reserved during GNOME Shell 50 runtime validation; superseded by v10

## v6

- reserved during GNOME Shell 50 runtime validation; superseded by v7

## v5

- reserved during GNOME Shell 50 runtime validation; superseded by v6

## v4

- reserved during GNOME Shell 50 runtime validation; superseded by v5

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
