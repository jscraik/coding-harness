---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: synaipse-cc2-optional-missing-contract-ratification
artifact_type: implementation-note
canonical_slug: synaipse-cc2-optional-missing-contract-ratification
title: SynAIpse CC2 Optional Missing Context Contract Ratification
harness_stage: implementation-notes
origin: CC2 ordered review finding reconciliation
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: src/lib/synaipse
owner: coding-harness-maintainers
date: 2026-07-20
created: 2026-07-20
last_reviewed: 2026-07-20
review_cadence: event-driven
related_plan: docs/plans/2026-07-19-synaipse-clinical-delivery-convergence-plan.md
related_spec: docs/specs/2026-07-19-synaipse-clinical-delivery-convergence-spec.md
status: active
validated_by:
  - pnpm exec vitest run src/lib/synaipse/context-contract.test.ts src/lib/synaipse/context-plane.test.ts src/commands/next.test.ts src/dev/validate-harness-decision-failures.test.ts --maxWorkers=1 --reporter=dot -> pass
depends_on:
  - .harness/implementation-notes/2026-07-19-synaipse-cc0-confirmed-brief.md
---

# SynAIpse CC2 Optional Missing Context Contract Ratification

## Finding

The confirmed CC0 decision requires every optional legacy-compatible failure to
emit both the canonical decision diagnostic and the constrained
`synaipse-state/v1.contextUnknowns` projection. Its nine-code table did not
define a truthful canonical code for the legacy `missing_context` case:
`missing_required_context` forbids optional requirement, while
`provider_unavailable` asserts an outage that an absent or explicitly
`unavailable` observation does not prove.

## Ratification

Before the new `synaipse-context-failure-envelope/v1` has shipped, add
`missing_optional_context` as the precise optional-only code. It carries an
identified `ch_context` ID, recovery `supply_optional_context`, current
freshness, and the non-blocking condition `Continue with explicit context
unknown until missing_optional_context is resolved.` The existing state-v1
projection remains `{ contextId, reason: "missing_context" }` for old readers.

Historical lifecycle context is not an optional missing-context case. It remains
a blocking lifecycle failure and normalizes to `superseded_context` with
`select_current_context`; it never enters `contextUnknowns`. A catalog bound to
another repository normalizes to `missing_context_catalog` for the actual target
and recovers through `admit_context_catalog`.

## Compatibility boundary

This is an additive correction to an unshipped nested v1 contract. It does not
widen strict `synaipse-state/v1`, change the three legacy unknown reasons, add a
command, retrieve provider bodies, or authorize hosted, merge, release, or
production claims. Old decision readers continue to ignore the additive meta
member; new readers reject unknown codes and contradictory requirement,
identity, recovery, stop, or freshness metadata.
