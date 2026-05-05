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
  - Secrets and credentials MUST NOT be hardcoded.
  - Input validation MUST exist at trust boundaries.
  - Auth/authz logic changes MUST be explicitly reviewed.
  - Error outputs MUST NOT leak sensitive data.

## Secret handling
- Secrets MUST come from environment injection or a secret manager.
- Exposed secrets MUST be rotated immediately and treated as incidents.
- Raw secret values MUST NOT be printed in logs, test fixtures, or screenshots.

## Secure coding defaults
- Data access MUST use parameterized queries where query parameters exist.
- Untrusted content MUST be sanitized before rendering/execution.
- Runtime permissions and network access MUST apply least-privilege defaults.

## Incident response workflow
1. Stop work on unrelated changes.
2. Classify severity and blast radius.
3. Fix CRITICAL vulnerabilities before proceeding with normal work.
4. Regression checks MUST be added to prevent reintroduction.

## Enforcement
- Security findings at CRITICAL severity MUST be merge blockers.
- Exceptions MUST include waiver metadata with rule ID, reason, tracking issue, and expiry or ADR.
