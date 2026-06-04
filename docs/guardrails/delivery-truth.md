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
  - delivery-truth-change
  - pr-closeout-change
  - merge-readiness-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/lifecycle/issue-to-main.md
  - docs/domain/context-map.md
  - .github/PULL_REQUEST_TEMPLATE.md
---

# Delivery truth guardrail

## Table of Contents

- [Default stance](#default-stance)
- [Allowed exceptions](#allowed-exceptions)
- [Proof obligations](#proof-obligations)
- [Validation](#validation)
- [Review checklist](#review-checklist)

## Default stance

Delivery truth is composed from separate lanes. Local code, local validation,
PR state, CI checks, review threads, tracker state, artifact evidence, merge
readiness, and post-merge main sync must each be checked before a closeout
claim depends on them.

One lane never proves another unless a current contract explicitly joins them.

## Allowed exceptions

- A narrow implementation handoff may say only the local lane was validated.
- A PR body may mark a lane blocked, not applicable, or unobserved when the
  blocker and next owner are concrete.
- Supporting work may link an issue without claiming acceptance completion when
  the PR states that it is preparatory or enabling.

## Proof obligations

Delivery claims require current evidence for the lanes they mention:

| Claim | Minimum evidence |
| --- | --- |
| Local behavior works | Exact local command outcomes and changed-file scope |
| PR is ready | Current PR head, template completion, required fields, branch state |
| Checks are green | Fresh required-check evidence from the configured providers |
| Reviews are resolved | Current review-thread or independent review artifact evidence |
| Tracker is complete | Current Linear or tracker state plus acceptance trace |
| Merge is allowed | Branch-protection and policy evidence for the current PR head |
| Work is complete after merge | Merge evidence plus main checkout and pull evidence |

## Validation

Use the smallest current verifier for the touched surface:

- pnpm docs:lifecycle for governed documentation lifecycle changes.
- bash scripts/run-harness-gate.sh docs-gate --mode required --json when
  docs-gate governed surfaces changed.
- harness pr-closeout --json or a source-checkout equivalent when PR closeout
  evidence changed.
- pnpm test:related when related tests and drift checks are the narrowest useful
  proof.

## Review checklist

- Does the change keep local, PR, CI, review, tracker, artifact, merge, and
  main-sync truth separate?
- Does any completion phrase overclaim a lane that was not checked?
- Does the PR template or closeout evidence classify blocked and not-applicable
  lanes explicitly?
- Did repeated feedback become a durable rule, guard, validator, skill,
  Project Brain note, or tracked exception?
