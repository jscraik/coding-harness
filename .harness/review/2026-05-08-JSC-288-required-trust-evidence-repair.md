---
schema_version: 1
artifact_id: jsc-288-required-trust-evidence-repair
artifact_type: he-code-review-repair
canonical_slug: jsc-288-required-trust-evidence-repair
title: JSC-288 Required Trust Evidence Repair
harness_stage: he-code-review
status: implemented
date: 2026-05-08
traceability_required: true
origin: .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
linear_issue: JSC-288
linear_milestone: Governance Trust Repair Slice
linear_status: Triage
implementation_unit: IU-288-004
---

# JSC-288 Required Trust Evidence Repair

## Table Of Contents

- [Decision Implemented](#decision-implemented)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Changed Surface](#changed-surface)
- [Why This Repairs Trust](#why-this-repairs-trust)
- [Replacement Evidence Contract](#replacement-evidence-contract)
- [Out Of Scope](#out-of-scope)
- [Validation Notes](#validation-notes)
- [Evidence](#evidence)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)

## Decision Implemented

`IU-288-004` replaces the PR-template `memory.json` shape proof with live
Project Brain and repo-memory evidence.

The required local gates now name:

- `bash scripts/validate-codestyle.sh`
- `pnpm check`
- `pnpm exec tsx src/cli.ts tooling-audit --path . --json`

The north-star learning-loop commands remain listed as explicit PR evidence.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-288` |
| Linear project | `coding-harness` |
| Linear milestone | `Governance Trust Repair Slice` |
| Plan unit | `IU-288-004` |
| Scope | Replace placeholder memory proof in the PR template. |
| Out of scope | Memory system redesign, contract schema edits, validator redesign, docs compression, and packaged skill edits. |
| Human review | Required before merge because PR evidence behavior changed. |

## Changed Surface

| File | Change | Reason |
| --- | --- | --- |
| `.github/PULL_REQUEST_TEMPLATE.md` | Removed the required `memory.json` `jq` shape check from checklist and testing evidence. | Shape-only JSON accepted bootstrap placeholders as trust evidence. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Added `pnpm exec tsx src/cli.ts tooling-audit --path . --json` as the required local Project Brain and tooling evidence command. | `tooling-audit` consumes `harness.contract.json` `toolingPolicy.projectBrainMemoryExtension.requiredPaths`, including `.harness/memory/LEARNINGS.md` and Project Brain paths. |

## Why This Repairs Trust

The old proof checked only JSON shape:

- `meta.version`
- `preamble.bootstrap`
- `preamble.search`
- `entries`

That allowed placeholder memory to satisfy required PR evidence.

The replacement proof exercises the current contract-backed Project Brain and
tooling surface. This is a better trust proxy because it checks live required
paths that agents actually use for operational memory and governance context.

## Replacement Evidence Contract

PRs now prove memory and governance context through:

- Project Brain required paths enforced by
  `pnpm exec tsx src/cli.ts tooling-audit --path . --json`
- tracked `.harness/memory/LEARNINGS.md` presence as part of the Project Brain
  memory extension
- north-star learning-loop commands when imported CodeRabbit learning evidence
  exists for changed files
- explicit `n.a.` reasons when the learning artifact is absent or the change is
  outside learning-loop scope

`memory.json` is no longer sufficient required PR evidence.

## Out Of Scope

This repair does not delete `memory.json`, redesign memory commands, or add a
new memory validator.

If `memory.json` becomes operational later, it needs a separate owner,
freshness/provenance rule, placeholder rejection, and validation command.

## Validation Notes

Required validation for this unit:

- Markdown lint for changed artifacts and PR template.
- HE artifact lints for this repair artifact and updated plan.
- `jq empty harness.contract.json` to prove aggregate JSON remains valid.
- `pnpm exec tsx src/cli.ts policy-gate --contract harness.contract.json --json`
  to prove the aggregate contract still admits policy evaluation.
- `pnpm exec tsx src/cli.ts tooling-audit --path . --json` to prove the
  replacement evidence command is runnable from the current checkout.
- `git diff --check` for changed files.

## Evidence

Facts:

- The old PR template required `test -f memory.json && jq ... memory.json`.
- `memory.json` contains bootstrap placeholder content and no accepted
  operational owner.
- `IU-288-002` accepted Project Brain, `.harness/memory/LEARNINGS.md`, and
  learning-loop evidence as the replacement trust path.
- `harness.contract.json` contains
  `toolingPolicy.projectBrainMemoryExtension.requiredPaths`, including
  `.harness/memory/LEARNINGS.md`, `.harness/knowledge/**`,
  `.harness/decisions`, `.harness/quality/criteria.md`, and
  `.harness/review-log.md`.

Interpretation:

- Requiring `tooling-audit` is more load-bearing than checking `memory.json`
  shape because it evaluates the live Project Brain memory-extension contract.

Assumption:

- PR authors must run the repo-local source-truth command
  `pnpm exec tsx src/cli.ts tooling-audit --path . --json` before package-build
  parity is needed.

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Status | Evidence |
| --- | --- | --- | --- |
| `JSC-288` | `SA-288-003` | Implemented | PR template no longer requires placeholder `memory.json` shape proof. |
| `JSC-288` | `SA-288-006` | Implemented for memory proof | Required governance evidence now has owner, enforcement path, validation command, and revisit condition. |
| `JSC-288` | `SA-288-010` | Implemented for memory proof | Retained required memory evidence maps to Project Brain and tooling-audit enforcement. |
