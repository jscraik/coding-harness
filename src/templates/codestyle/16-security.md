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
- Before commit/PR handoff:
  - Secrets and credentials MUST NOT be hardcoded.
  - Input validation MUST exist at trust boundaries.
  - Auth/authz logic changes MUST be explicitly reviewed.
  - Error outputs MUST NOT leak sensitive data.

## Secret handling
- Secrets MUST come from environment injection or a secret manager.
- Exposed secrets MUST be rotated immediately and treated as incidents.
- Raw secret values MUST NOT be printed in logs, test fixtures, or screenshots.

## Secure coding defaults
- Data access MUST use parameterized queries.
- Untrusted content MUST be sanitized before rendering/execution.
- Runtime permissions and network access MUST default to least privilege.

## Incident response workflow
1. Work on unrelated changes MUST stop.
2. Severity and blast radius MUST be classified.
3. CRITICAL vulnerabilities MUST be fixed before proceeding with normal work.
4. Regression checks MUST be added to prevent reintroduction.

## Enforcement
- Security findings at CRITICAL severity are merge blockers.
- Exceptions MUST include waiver metadata with rule ID, reason, tracking issue, and expiry or ADR.