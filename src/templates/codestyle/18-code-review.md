# Code Review Standards

## Table of Contents
- [Scope](#scope)
- [Mandatory review triggers](#mandatory-review-triggers)
- [Pre-review requirements](#pre-review-requirements)
- [Severity model](#severity-model)
- [Security review triggers](#security-review-triggers)
- [Approval criteria](#approval-criteria)
- [Enforcement](#enforcement)

## Scope
- This module defines consistent review criteria before merge.

## Mandatory review triggers
- Review is required for:
  - New features and bug fixes.
  - Security-sensitive surfaces.
  - Architectural or workflow-governance changes.
  - Any change that alters public behavior or release-critical scripts.

## Pre-review requirements
- Before requesting review:
  - Confirm branch is up to date with target base.
  - Resolve merge conflicts.
  - Run required validation gates and capture results.

## Severity model
- `CRITICAL`: security/data-loss risk; merge blocker.
- `HIGH`: functional correctness risk; should be fixed before merge.
- `MEDIUM`: maintainability/design risk; fix when feasible in current scope.
- `LOW`: style or minor improvement; optional unless policy demands.

## Security review triggers
- Require dedicated security review when changes involve:
  - Authentication/authorization.
  - Secrets, credentials, tokens, or key management.
  - Input handling with execution/query implications.
  - Payment or sensitive data pathways.

## Approval criteria
- Approve when no CRITICAL/HIGH unresolved findings remain.
- If HIGH findings remain by explicit decision, document risk acceptance and owner.

## Enforcement
- Review artifacts MUST reference concrete file paths and impacted behavior.
- Validation and review outcomes MUST be explicit and evidence-backed.
