# Contributing

Thanks for helping improve PR Sentinel. This project aims to keep pull request risk scanning deterministic, useful in CI, and safe when optional AI review is unavailable.

## Development

Use Node.js 22 for local development.

```bash
npm test
npm run check
npm run scan:sample
```

Before opening a pull request, run the test and check scripts and include a short description of the behavior changed. For scanner changes, add or update focused tests and fixtures that show the finding, severity, and output format impact.

## Pull Requests

- Keep changes small and scoped to one behavior where possible.
- Do not commit provider API keys, sample tokens, or generated reports with sensitive diffs.
- Update documentation when CLI flags, configuration keys, Action inputs, or output formats change.
- Prefer deterministic rules for repeatable policy checks; use AI review as an optional supplement.

## Releases

Releases are published from GitHub Releases. When a release is published, CI runs the test and check scripts on Node.js 22 before publishing the package to npm.
