# PR Sentinel

PR Sentinel is an enterprise pull request risk scanner. It reads a unified diff, applies deterministic review rules, optionally runs AI review, and publishes Markdown, JSON, SARIF, GitHub Step Summary, PR comments, and Checks annotations.

AI review is enabled by default, but it degrades safely: if no provider credentials are configured, PR Sentinel still runs deterministic rules and reports why AI review was skipped.

## What It Detects

- Possible committed secrets
- Database migration changes
- Dependency or lockfile changes
- Source changes without tests
- Public API export changes
- Very large file changes
- GitHub Actions broad permissions, `pull_request_target`, and unpinned third-party Actions
- Dockerfiles that run as root or pipe remote scripts into a shell
- Kubernetes privileged containers and host namespace access
- Terraform public ingress and IAM wildcard permissions
- Destructive SQL migrations
- npm install lifecycle scripts

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

Write SARIF for GitHub Code Scanning:

```bash
node bin/pr-sentinel.js scan --diff pr.diff --format sarif --write-sarif pr-sentinel.sarif --fail-on none
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
          write-sarif: pr-sentinel.sarif
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

baseline:
  path: .pr-sentinel-baseline.json
  update: false

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
--format <markdown|json|sarif> Output format. Defaults to markdown.
--fail-on <severity>     Exit 1 when a finding meets this severity. Use none to never fail.
--min-severity <level>   Hide findings below this severity.
--exclude-rule <ids>     Comma-separated rule ids to skip.
--no-ai                  Disable AI review for this run.
--ai-provider <name>     openai, anthropic, or ollama.
--ai-model <model>       Custom provider model name.
--baseline <path>        Filter findings already recorded in a baseline file.
--update-baseline        Write the current full findings to the baseline file.
--write-report <path>    Write the report to a file.
--write-sarif <path>     Write a SARIF report alongside the main report.
```

Severities are `info`, `low`, `medium`, and `high`. For `--fail-on`, use `none` to report without failing.

## Baselines

Baseline files help teams adopt PR Sentinel in repositories with known legacy findings. Existing findings in the baseline are filtered from the current report, while new findings still appear and can still fail CI.

```bash
node bin/pr-sentinel.js scan --diff pr.diff --update-baseline --fail-on none --no-ai
node bin/pr-sentinel.js scan --diff pr.diff --baseline .pr-sentinel-baseline.json
```

## Release

Publishing a GitHub Release runs the release workflow and verifies tests/checks on Node.js 22. If `NPM_TOKEN` is configured, the workflow also publishes to npm; otherwise npm publishing is skipped.

To publish the GitHub Action major version, create or move the `v1` tag to the release commit.

## Roadmap

- Policy packs for common stacks
- Duplicate PR comment updating
- AI confidence and cost reporting

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
