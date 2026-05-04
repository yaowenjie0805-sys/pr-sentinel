# PR Sentinel

PR Sentinel is an enterprise pull request risk scanner. It reads a unified diff, applies deterministic review rules, optionally runs AI review, and publishes Markdown, JSON, GitHub Step Summary, PR comments, and Checks annotations.

AI review is enabled by default, but it degrades safely: if no provider credentials are configured, PR Sentinel still runs deterministic rules and reports why AI review was skipped.

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
node bin/pr-sentinel.js scan --format markdown --fail-on high
```

Scan a saved diff:

```bash
git diff main...HEAD > pr.diff
node bin/pr-sentinel.js scan --diff pr.diff --format json
```

Use a custom AI model:

```bash
node bin/pr-sentinel.js scan --diff pr.diff --ai-provider openai --ai-model gpt-5.4-mini
node bin/pr-sentinel.js scan --diff pr.diff --ai-provider anthropic --ai-model claude-sonnet-4-5
node bin/pr-sentinel.js scan --diff pr.diff --ai-provider ollama --ai-model llama3.1
```

## GitHub Action

```yaml
name: PR Sentinel

on:
  pull_request:

permissions:
  contents: read
  checks: write
  pull-requests: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: yaowenjie0805-sys/pr-sentinel@v1
        with:
          fail-on: high
          min-severity: info
          ai-provider: openai
          ai-model: gpt-5.4-mini
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Use Anthropic by setting `ai-provider: anthropic` and `ANTHROPIC_API_KEY`. Use Ollama with `ai-provider: ollama` and configure `ai.baseUrl` in `.pr-sentinel.yml` when the service is not on `http://localhost:11434`.

## Configuration

Create `.pr-sentinel.yml`:

```yaml
failOn: high
minSeverity: info

rules:
  enabled: []
  disabled:
    - large-change

paths:
  include: []
  exclude:
    - dist/**
    - coverage/**

ai:
  enabled: true
  provider: openai
  model: gpt-5.4-mini
  strict: false
  timeoutMs: 15000

github:
  comment: true
  annotations: true
```

CLI flags override the config file. The config file overrides built-in defaults.

## CLI Options

```text
--config <path>          Read .pr-sentinel.yml from a custom path.
--diff <path>            Read a unified diff from a file. Defaults to git diff base...HEAD.
--format <markdown|json> Output format. Defaults to markdown.
--fail-on <severity>     Exit 1 when a finding meets this severity. Use none to never fail.
--min-severity <level>   Hide findings below this severity.
--exclude-rule <ids>     Comma-separated rule ids to skip.
--no-ai                  Disable AI review for this run.
--ai-provider <name>     openai, anthropic, or ollama.
--ai-model <model>       Custom provider model name.
--write-report <path>    Write the report to a file.
```

Severities are `info`, `low`, `medium`, and `high`. For `--fail-on`, use `none` to report without failing.

## Roadmap

- SARIF output for GitHub code scanning
- Persistent baseline support for legacy findings
- Policy packs for common stacks

## Enterprise Rollout

- Start with `failOn: high` and keep AI `strict: false`.
- Add `paths.exclude` for generated assets and vendored code.
- Pin the Action with `@v1` for stability.
- Use provider-specific secrets rather than hardcoding credentials in config.

## Development

```bash
npm test
npm run check
```

## License

MIT
