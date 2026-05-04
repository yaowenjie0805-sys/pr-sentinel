# Security Policy

## Supported Versions

Security fixes target the latest released version of PR Sentinel.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately through GitHub Security Advisories for this repository. If advisories are unavailable, contact the maintainer listed in `package.json`.

Include:

- Affected version or commit
- Steps to reproduce
- Expected impact
- Any relevant logs, diffs, or configuration with secrets removed

Please do not open public issues for vulnerabilities until a fix or mitigation is available.

## Secret Handling

PR Sentinel scans diffs and may process sensitive code context. Never include real provider keys, npm tokens, private repository tokens, or customer secrets in examples, fixtures, reports, or issue comments.
