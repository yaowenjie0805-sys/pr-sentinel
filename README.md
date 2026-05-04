# PR Sentinel

PR Sentinel is a lightweight pull request risk scanner. It reads a unified diff, applies deterministic review rules, and prints a Markdown or JSON report that works locally and in GitHub Actions.

This is intentionally small for the first version: no external services, no required token, and no model dependency. It gives maintainers useful signals before a human reviewer spends time on the PR.

## What It Detects

- Possible committed secrets
- Database migration changes
- Dependency or lockfile changes
- Source changes without tests
- Public API export changes
- Very large file changes

## Quick Start

```bash
npm test
npm run scan:sample
```

Scan the current branch against the default base:

```bash
node bin/pr-sentinel.js --format markdown --fail-on high
```

Scan a saved diff:

```bash
git diff main...HEAD > pr.diff
node bin/pr-sentinel.js --diff pr.diff --format json
```

## GitHub Action

```yaml
name: PR Sentinel

on:
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: your-org/pr-sentinel@v0
        with:
          fail-on: high
          min-severity: info
```

## CLI Options

```text
--diff <path>             Read a unified diff from a file. Defaults to git diff base...HEAD.
--format <markdown|json>  Output format. Defaults to markdown.
--fail-on <severity>      Exit 1 when a finding meets this severity. Use none to never fail. Defaults to high.
--min-severity <severity> Hide findings below this severity. Defaults to info.
--exclude-rule <ids>      Comma-separated rule ids to skip.
```

Severities are `info`, `low`, `medium`, and `high`. For `--fail-on`, use `none` to report without failing.

## Roadmap

- Inline PR comments through the GitHub API
- Config file support with path-specific rule tuning
- Optional LLM review layer for semantic risk notes
- SARIF output for GitHub code scanning
- npm package publishing and versioned Action releases

## Development

```bash
npm test
npm run check
```

## License

MIT
