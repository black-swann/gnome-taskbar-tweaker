# Releasing

Use this checklist before creating a public GitHub repository or cutting a release.

## Identity and metadata

- Confirm the published UUID in `metadata.json` is the one you want to keep long-term.
- Confirm the copyright holder in `LICENSE` is the public identity you want attached to the project.
- Check `metadata.json` version and update `CHANGELOG.md`.

## Repository hygiene

- Verify `git status --ignored` does not show any local files you intend to commit.
- Do not commit local config, editor state, generated archives, compiled schemas, or environment files.
- Review `.gitignore` before the first commit if you add new local tooling.

## Security and privacy review

- Run:

```bash
rg -n "token|secret|password|apikey|api_key|PRIVATE|ssh|BEGIN .* PRIVATE KEY" -S .
```

- Review files for personal paths, machine-specific notes, or unpublished account identifiers.
- Confirm release docs do not include local-only operational notes you do not want public.

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
