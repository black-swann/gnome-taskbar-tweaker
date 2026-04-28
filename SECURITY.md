# Security Policy

## Supported Versions

Security fixes target the current `main` branch and the latest published release.

## Reporting a Vulnerability

Please report security issues privately through GitHub's security advisory flow for this repository when available.

If the advisory flow is unavailable, open a minimal public issue that says you have a security report to share, without including exploit details or private system information.

## Project Scope

GNOME Taskbar Tweaker runs locally as a GNOME Shell extension. It does not make network requests, does not collect telemetry, and does not store credentials.

Security-sensitive issues include:

- unexpected access to files, credentials, or external services
- unsafe command execution from extension or helper scripts
- layout handling that can crash GNOME Shell repeatedly
- release artifacts that include private local files

Issues caused only by unsupported GNOME Shell versions or third-party extensions may be treated as compatibility bugs rather than security vulnerabilities.
