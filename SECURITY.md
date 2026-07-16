---
doc_schema: coding-harness-doc/v1
doc_type: security
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - human-operator
  - security-reporter
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - security-policy-change
  - scanner-baseline-change
  - vulnerability-reporting-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - CONTRIBUTING.md
  - docs/agents/06-security-and-governance.md
---

# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| < 0.5   | No        |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Please email **jscraik@brainwav.io** directly.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Resolution timeline**: Depends on severity; critical issues prioritized

## Security best practices

When contributing to this project:

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Report any security concerns you discover during development

## Automated security scanning

This repository uses:

- **BetterLeaks** (CI) / **Gitleaks** (local): Secret detection in commits
- **Semgrep**: Static analysis for security vulnerabilities
- **Trivy**: Dependency and container vulnerability scanning
- **`pnpm run audit`**: Governed dependency vulnerability scanning
