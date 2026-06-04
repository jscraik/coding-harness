---
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - docs-reviewer
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - external-state-change
  - ci-provider-change
  - tracker-state-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/lifecycle/truth-lanes.md
  - docs/domain/claim-authority.md
  - docs/agents/13-linear-production-workflow.md
---

# External state guardrail

## Table of Contents

- [Default Stance](#default-stance)
- [Allowed Exceptions](#allowed-exceptions)
- [Proof Obligations](#proof-obligations)
- [Validation](#validation)
- [Review Checklist](#review-checklist)

## Default Stance

External state must be checked from the current source before it supports PR,
CI, tracker, review, or merge-readiness claims. Prior summaries, chat context,
and copied terminal output are supporting context only.

## Allowed Exceptions

- A local-only handoff may leave external state unobserved when it says so.
- A credentialed lane may be blocked when the required token or permission is
  unavailable after the env-backed recovery check.
- Historical audits may cite older external state when they are clearly marked
  historical and do not claim current readiness.

## Proof Obligations

| Source | Evidence needed |
| --- | --- |
| GitHub PR | PR number, head SHA, branch, state, mergeability when checked |
| Required checks | Provider name, exact check name, status, timestamp or current query |
| CodeRabbit | Current review status or thread evidence |
| Semgrep Cloud | Current required external check status when branch protection requires it |
| Linear | Issue key, state, blocker, acceptance trace, mutation availability |
| CircleCI | Pipeline/job/check identity, status, branch or SHA binding |

## Validation

Use the current provider query or the harness command that wraps it. If the
provider cannot be reached, classify the lane as blocked or unobserved instead
of reusing stale evidence.

## Review Checklist

- Does the claim use current external evidence?
- Is the external source bound to the same PR, branch, issue, or head SHA?
- Are provider-specific failures separated from local validation failures?
- Are unavailable credentials reported as blockers with recovery evidence?
