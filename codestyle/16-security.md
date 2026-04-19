# Security Standards

## Table of Contents
- [Scope](#scope)
- [Mandatory checks](#mandatory-checks)
- [Secret handling](#secret-handling)
- [Secure coding defaults](#secure-coding-defaults)
- [Incident response workflow](#incident-response-workflow)
- [Enforcement](#enforcement)

## Scope
- This module defines security expectations for code, configuration, and release surfaces.

## Mandatory checks
- Before commit/PR handoff, verify:
  - No hardcoded secrets or credentials.
  - Input validation exists at trust boundaries.
  - Auth/authz logic changes are explicitly reviewed.
  - Error outputs do not leak sensitive data.

## Secret handling
- Secrets MUST come from environment injection or a secret manager.
- Exposed secrets MUST be rotated immediately and treated as incidents.
- Do not print raw secret values in logs, test fixtures, or screenshots.

## Secure coding defaults
- Use parameterized queries for data access.
- Sanitize untrusted content before rendering/execution.
- Apply least-privilege defaults for runtime permissions and network access.

## Incident response workflow
1. Stop work on unrelated changes.
2. Classify severity and blast radius.
3. Fix CRITICAL vulnerabilities before proceeding with normal work.
4. Add regression checks that prevent reintroduction.

## Enforcement
- Security findings at CRITICAL severity are merge blockers.
- Exceptions require waiver metadata with reason, tracking issue, and expiry or ADR.
