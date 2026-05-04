# Changelog

## 1.0.0

- Added Simplified Chinese report support with `locale: zh-CN` and `--locale zh-CN`.
- Added high-value engineering rules for GitHub Actions, Dockerfile, Kubernetes, Terraform, SQL migrations, and npm lifecycle scripts.
- Made npm publishing optional when `NPM_TOKEN` is not configured.
- Added SARIF output for GitHub Code Scanning.
- Added baseline creation and filtering for legacy findings.
- Added release automation, contributing guide, and security policy.
- Added `.pr-sentinel.yml` configuration.
- Added `pr-sentinel scan` CLI command with custom AI model support.
- Added OpenAI, Anthropic, and Ollama AI provider adapters.
- Added GitHub PR summary comments and Checks annotations.
- Added npm package exports for programmatic use.
