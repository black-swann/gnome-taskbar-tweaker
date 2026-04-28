# Releasing

Use this checklist before cutting a release.

## Identity and metadata

- Confirm the published UUID in `metadata.json` is the one you want to keep long-term.
- Confirm the copyright holder in `LICENSE` is the public identity you want attached to the project.
- Check `metadata.json` version and update `CHANGELOG.md`.
- Confirm `README.md` still matches the implemented feature set and supported GNOME Shell versions.

## Repository hygiene

- Verify `git status --ignored` does not show any local files you intend to commit.
- Do not commit local config, editor state, generated archives, compiled schemas, or environment files.
- Review `.gitignore` before the first commit if you add new local tooling.
- Confirm `docs/screenshot.png` is current and does not reveal private desktop content.

## Security and privacy review

- Run:

```bash
if git grep -n -i -E "token|secret|password|apikey|api_key|ssh|BEGIN .* PRIVATE KEY|github_pat|ghp_|oauth" -- ':!RELEASING.md'; then
  echo "Review the matches above before release." >&2
  exit 1
else
  echo "No obvious secret patterns found."
fi
```

- Review files for personal paths, machine-specific notes, or unpublished account identifiers.
- Confirm release docs do not include local-only operational notes you do not want public.
- Confirm generated archives contain only the extension files expected by `gnome-extensions pack`.

## Validation

- Run:

```bash
make check
./scripts/package.sh
./scripts/smoke-test.sh --install
```

- Optionally run the manual validation flow:

```bash
./scripts/manual-test.sh
```

## Publish

- Create a GitHub release for `dist/gnome-taskbar-tweaker-v<version>.zip`.
- Include the matching `CHANGELOG.md` notes.
- After publishing, install the release artifact on a clean GNOME session when possible.
