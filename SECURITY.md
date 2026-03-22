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

- **Gitleaks**: Secret detection in commits
- **Semgrep**: Static analysis for security vulnerabilities
- **Trivy**: Dependency and container vulnerability scanning
- **pnpm audit**: Dependency vulnerability scanning
