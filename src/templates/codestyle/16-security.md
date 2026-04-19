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
- Before commit/PR handoff, reviewers MUST verify:
  - Secrets and credentials are not hardcoded.
  - Input validation exists at trust boundaries.
  - Auth/authz logic changes are explicitly reviewed.
  - Error outputs do not leak sensitive data.

## Secret handling
- Secrets MUST come from environment injection or a secret manager.
- Exposed secrets MUST be rotated immediately and treated as incidents.
- Raw secret values MUST NOT be printed in logs, test fixtures, or screenshots.

## Secure coding defaults
- Data access MUST use parameterized queries.
- Untrusted content MUST be sanitized before rendering/execution.
- Runtime permissions and network access MUST default to least privilege.

## Incident response workflow
1. Teams MUST stop work on unrelated changes.
2. Teams MUST classify severity and blast radius.
3. Teams MUST fix CRITICAL vulnerabilities before proceeding with normal work.
4. Teams MUST add regression checks that prevent reintroduction.

## Enforcement
- Security findings at CRITICAL severity are merge blockers.
- Exceptions MUST include waiver metadata with rule ID, reason, tracking issue, and expiry or ADR.
