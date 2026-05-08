---
schema_version: 1
artifact_id: jsc-288-governance-prose-compression
artifact_type: he-code-review-repair
canonical_slug: jsc-288-governance-prose-compression
title: JSC-288 Governance Prose Compression
harness_stage: he-code-review
status: implemented
date: 2026-05-08
traceability_required: true
origin: .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
linear_issue: JSC-288
linear_milestone: Governance Trust Repair Slice
linear_status: Triage
implementation_unit: IU-288-005
---

# JSC-288 Governance Prose Compression

## Table Of Contents

- [Decision](#decision)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Changed Surface](#changed-surface)
- [Disposition Table](#disposition-table)
- [Why This Is Safe](#why-this-is-safe)
- [Validation](#validation)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)

## Decision

`docs/agents/20-project-brain-memory-extension-rollout.md` is reference-only
rollout context, not live governance authority for this repository.

The live authorities are:

- `harness.contract.json` for required Project Brain paths
- `.harness/memory/LEARNINGS.md` and `docs/agents/03-local-memory.md` for
  repo-local memory
- `docs/agents/02-tooling-policy.md` and `scripts/check-environment.sh` for
  tooling/readiness enforcement
- `docs/agents/04-validation.md` for PR closeout learning-loop evidence

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-288` |
| Linear project | `coding-harness` |
| Linear milestone | `Governance Trust Repair Slice` |
| Plan unit | `IU-288-005` |
| Scope | Compress governance prose where replacement authority is explicit. |
| Out of scope | Runtime behavior, contract schema, PR-template behavior, packaged skill edits, and broad readability cleanup. |
| Human review | Required before merge because governed docs authority changed. |

## Changed Surface

| File | Change | Reason |
| --- | --- | --- |
| `docs/agents/20-project-brain-memory-extension-rollout.md` | Added an explicit Authority section and updated `last_validated` to `2026-05-08`. | Prevents rollout prose from being mistaken for live policy. |
| `docs/agents/20-project-brain-memory-extension-rollout.md` | Clarified that source-repo proof uses `pnpm exec tsx src/cli.ts tooling-audit --path . --json` before package-build parity. | Keeps the rollout note aligned with JSC-282 source-truth validation rules and the PR template repair. |

## Disposition Table

| Surface | Disposition | Authority after IU-288-005 |
| --- | --- | --- |
| `docs/agents/20-project-brain-memory-extension-rollout.md` | Keep as reference-only migration context. | Not authoritative when it conflicts with contract, tooling policy, local-memory guidance, validation guidance, or readiness scripts. |
| `docs/agents/02-tooling-policy.md` | Keep as canonical tooling/readiness guidance. | Authoritative for tooling contract prose and rollout drift checks. |
| `docs/agents/03-local-memory.md` | Keep as canonical repo-local memory workflow. | Authoritative for `.harness/memory/LEARNINGS.md` usage. |
| `docs/agents/04-validation.md` | Keep as canonical validation/closeout guidance. | Authoritative for north-star learning-loop closeout evidence. |
| `harness.contract.json` | Keep as executable policy aggregate. | Authoritative for `toolingPolicy.projectBrainMemoryExtension.requiredPaths`. |

## Why This Is Safe

Facts:

- The inventory classified `docs/agents/20-project-brain-memory-extension-rollout.md`
  as optional/reference context for this repo.
- The file had a `last_validated` date older than the accepted JSC-288 memory
  ownership and PR-template repair decisions.
- Live required paths already exist in `harness.contract.json`.

Interpretation:

- Marking the rollout note reference-only reduces authority ambiguity without
  deleting unique migration context.
- Linking to live authorities is safer than copying the same Project Brain
  rules into another governed doc.

## Validation

Required validation for this unit:

- Markdown lint for the touched rollout note and JSC-288 artifacts.
- Docs gate because a governed `docs/agents/**` surface changed.
- Policy gate for the touched docs and PR-template evidence surfaces.
- Reviewer check that no required Project Brain guidance was orphaned.

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Status | Evidence |
| --- | --- | --- | --- |
| `JSC-288` | `SA-288-005` | Implemented | Reference-only disposition recorded for the rollout note. |
| `JSC-288` | `SA-288-006` | Implemented | Governance prose now points to executable/canonical authorities. |
| `JSC-288` | `SA-288-010` | Implemented for prose compression | Required Project Brain and memory evidence remains executable or canonical. |
