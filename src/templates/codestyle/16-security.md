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
  - Dependency, lockfile, container, or generated artifact changes have run the repository security/audit contract or record a concrete blocker.

## Secret handling
- Secrets MUST come from environment injection or a secret manager.
- Exposed secrets MUST be rotated immediately and treated as incidents.
- Raw secret values MUST NOT be printed in logs, test fixtures, or screenshots.

## Secure coding defaults
- Use parameterized queries for data access.
- Sanitize untrusted content before rendering/execution.
- Apply least-privilege defaults for runtime permissions and network access.
- Treat dependency provenance, lockfiles, SBOMs, and release attestations as security surfaces when the repository publishes packages, containers, generated installers, or downstream templates.
- Prefer deny-by-default permissions for desktop, browser, CI, GitHub, MCP, and agent-tool integrations; new egress or write scopes require reviewable rationale.
- Avoid shell interpolation for untrusted input; pass arguments as structured argv arrays or validated command contracts.
- Generated examples and scaffolds MUST be safe-by-default and must not include placeholder credentials, broad token scopes, or writable host paths.

## Incident response workflow
1. Stop work on unrelated changes.
2. Classify severity and blast radius.
3. Fix CRITICAL vulnerabilities before proceeding with normal work.
4. Add regression checks that prevent reintroduction.

## Enforcement
- Security findings at CRITICAL severity are merge blockers.
- Security-sensitive changes SHOULD run configured scans such as Semgrep, package-manager audit, secret scanning, container scanning, SBOM/provenance validation, or language-native vulnerability checks.
- Exceptions require waiver metadata with rule ID, reason, tracking issue, and expiry or ADR.
