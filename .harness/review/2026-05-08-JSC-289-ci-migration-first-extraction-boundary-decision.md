---
schema_version: 1
artifact_id: jsc-289-ci-migration-first-extraction-boundary-decision
artifact_type: he-code-review-boundary-decision
canonical_slug: jsc-289-ci-migration-first-extraction-boundary-decision
title: JSC-289 CI Migration First Extraction Boundary Decision
harness_stage: he-code-review
status: review-required
date: 2026-05-08
traceability_required: true
origin: .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md
linear_issue: JSC-289
linear_milestone: CI Migration Boundary Recovery Slice
linear_status: In Progress
implementation_unit: IU-289-004
---

# JSC-289 CI Migration First Extraction Boundary Decision

## Table Of Contents

- [Scope](#scope)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Decision](#decision)
- [Why This Boundary](#why-this-boundary)
- [Candidate Comparison](#candidate-comparison)
- [Selected Boundary Contract](#selected-boundary-contract)
- [Hidden Dependency Controls](#hidden-dependency-controls)
- [IU-289-005 Rollback File Inventory](#iu-289-005-rollback-file-inventory)
- [IU-289-005 Exact Test Gate](#iu-289-005-exact-test-gate)
- [Rejected Boundaries](#rejected-boundaries)
- [IU-289-005 Execution Guardrails](#iu-289-005-execution-guardrails)
- [Rollback Conditions](#rollback-conditions)
- [Validation Requirements](#validation-requirements)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [Evidence And Traceability](#evidence-and-traceability)
- [Review Handoff](#review-handoff)

## Scope

This artifact completes `IU-289-004` from
`.harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md`.

`IU-289-004` is a decision gate. It does not edit runtime source, tests, CI
provider behavior, branch-protection policy, generated artifacts, or command
dispatch. It selects the first extraction boundary for `IU-289-005` and defines
the constraints that must prevent the extraction from becoming a broad rewrite.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-289` |
| Linear project | `coding-harness` |
| Linear milestone | `CI Migration Boundary Recovery Slice` |
| Plan unit | `IU-289-004` |
| Scope | Select exactly one first extraction boundary or defer extraction. |
| Decision output | Select proof-pack and promotion-evidence support as the first extraction boundary. |
| Out of scope | Runtime behavior changes, provider rewrites, branch-protection mutation, break-glass policy changes, merge-queue behavior changes, snapshot/state-store extraction, and delegated registry redesign. |
| Human review | Required before `IU-289-005` source edits start. |

## Decision

Select **proof-pack and promotion-evidence support** as the first extraction
boundary for `IU-289-005`.

The first source extraction should move proof-pack/provenance parsing,
materialization, artifact collection, proof-pack generation, and promotion
evidence evaluation behind a stable internal module while preserving the
existing public `ci-migrate` command entrypoint and observable behavior.

The extraction must not move the whole `buildMigrationReport` path in the first
cut. `buildMigrationReport` should remain in `src/commands/ci-migrate-core.ts`
until proof-pack support has a stable module boundary and the existing runtime
tests prove unchanged behavior.

## Why This Boundary

This is the strongest first boundary because it has:

- dense positive and negative runtime coverage;
- real domain responsibility instead of shallow helper shape;
- a natural input/output contract around proof evidence and promotion status;
- lower policy blast radius than break-glass, merge-queue, or provider
  selection;
- a clear rollback path because the source can remain behavior-equivalent
  behind the existing `runCIMigrateCLI` entrypoint.

The extraction is still migration-risk. The proof-pack code touches signing,
policy digests, repository identity, provenance materialization, generated
artifact paths, and promotion failure classification. `IU-289-005` must stage
the move incrementally and stop if the extracted module imports
`src/commands/ci-migrate-core.ts` or requires public command behavior changes.

## Candidate Comparison

| Candidate | Decision | Evidence | Why |
| --- | --- | --- | --- |
| Proof-pack and promotion-evidence support | Selected | `src/commands/ci-migrate-core.ts:3866`, `src/commands/ci-migrate-core.ts:3926`, `src/commands/ci-migrate-core.ts:4380`, `src/commands/ci-migrate-core.ts:6826`, `src/commands/ci-migrate-core.ts:6933`, `src/commands/ci-migrate-core.ts:6997`, `src/commands/ci-migrate-core.ts:7113`, `src/commands/ci-migrate-core.ts:7368`; tests at `src/commands/ci-migrate.test.ts:5333` through `src/commands/ci-migrate.test.ts:5912`. | Strongest balance of responsibility, coverage, and isolatable contract. |
| Snapshot/state path handling | Defer | State and snapshot helpers are covered, but they bind rollback, attestation, external control-plane snapshots, and prepared-state lifecycle at `src/commands/ci-migrate-core.ts:8524` through `src/commands/ci-migrate-core.ts:9043`. | Higher lifecycle blast radius; better after the proof-pack module reduces evidence complexity. |
| Provider adapter selection | Defer | Provider constants and mismatch coverage exist, but adapter selection is smaller and already stable. | Too shallow as a first extraction; likely to create pass-through modularity. |
| Break-glass governance | Defer | Inventory records strong tests, but this area owns rollback weakening and human approval policy. | Policy-sensitive; not first unless a maintainer explicitly accepts governance blast radius. |
| Merge-queue evidence handling | Defer | Tests cover merge-queue windows and signed evidence, but code spans provider API, orchestrator execution, and external state. | Too operationally coupled for the first cut. |
| Delegated registry routing | Defer | `IU-289-002` added focused dispatch coverage, but this belongs to command-registry behavior rather than `ci-migrate-core` reduction. | Solves command truth, not the oversized runtime orchestrator. |

## Selected Boundary Contract

The first extraction boundary should target a new internal module such as:

```text
src/lib/ci/ci-migrate-promotion-evidence.ts
```

The exact filename can change during `IU-289-005`, but the boundary must keep
this ownership:

| Boundary element | Contract |
| --- | --- |
| Public entrypoint | `runCIMigrateCLI` remains the public command path. |
| Import direction | `src/commands/ci-migrate-core.ts` may import the new module; the new module must not import `src/commands/ci-migrate-core.ts`. |
| Inputs | `targetDir`, `targetProvider`, `autoGenerate`, required policy/signing/path helpers as explicit dependencies or local imports from stable library modules. |
| Outputs | Current promotion-evidence report shape, proof-pack generation result, and existing human-readable violation/error strings. |
| Runtime behavior | Exit codes, stdout/stderr text, generated artifact paths, JSON output, and report schema remain unchanged. |
| Tests | Existing `src/commands/ci-migrate.test.ts` proof-pack/runtime tests must remain green before any test split. |
| Rollback | Revert the module extraction and restore the current in-file implementation without changing public behavior. |

The boundary may include these current responsibilities:

- safe proof artifact path checks;
- proof-pack freshness checks;
- proof-pack parsing and canonicalization;
- proof-pack input/provenance parsing;
- provenance bundle/input/index materialization;
- proof artifact collection;
- repository binding and policy digest validation;
- auto-generation of proof packs and signatures;
- promotion-evidence evaluation and violation classification.

The boundary must not include these responsibilities in the first extraction:

- whole migration report construction;
- provider adapter selection;
- branch-protection satisfiability scanning;
- break-glass approval parsing or rollback weakening;
- merge-queue orchestration;
- snapshot/state read/write lifecycle;
- command registry parsing or delegated action dispatch.

## Hidden Dependency Controls

`IU-289-005` must stop before commit if any of these happen:

| Control | Required outcome |
| --- | --- |
| Reverse import check | The extracted module must not import from `src/commands/ci-migrate-core.ts`. |
| Public behavior check | Focused `ci-migrate` runtime tests must pass without snapshot ID reuse or live CI credentials. |
| Artifact shape check | Generated proof-pack, signature, provenance, report, and JSON dry-run shapes must remain unchanged. |
| Error-string check | Existing proof-pack failure tests must continue to assert the same exit/failure behavior. |
| Scope check | No edits to provider adapters, break-glass governance, merge-queue orchestration, registry dispatch, or live CI policy. |
| Rollback check | Reverting the extracted module should be a file-level/module-level rollback, not a whole-command rewrite. |

## IU-289-005 Rollback File Inventory

`IU-289-005` may only touch the files below unless human review explicitly
extends the extraction scope before implementation starts:

| File | Allowed role | Rollback action |
| --- | --- | --- |
| `src/commands/ci-migrate-core.ts` | Remove moved proof-pack/promotion-evidence helpers and import the extracted module. | Revert the import and moved-symbol call sites. |
| `src/lib/ci/ci-migrate-promotion-evidence.ts` | New internal module for the selected boundary. | Delete the new module. |
| `src/commands/ci-migrate.test.ts` | Existing focused runtime proof if expectations do not change. | Revert any test harness-only import/path updates. |
| `src/lib/ci/ci-migrate-promotion-evidence.test.ts` | Optional only if focused unit coverage is split out without weakening runtime coverage. | Delete the new split test file. |

No other files are in the default rollback set. Editing provider adapters,
governance policy files, CI provider behavior, merge-queue orchestration,
registry dispatch, generated snapshots, or branch-protection contracts means
`IU-289-005` has left the accepted boundary and must stop for review.

## IU-289-005 Exact Test Gate

Before any `IU-289-005` commit, run this focused command:

```bash
pnpm vitest run --maxWorkers=1 --dangerouslyIgnoreUnhandledErrors src/commands/ci-migrate.test.ts -t "proof pack|proof-pack|provenance bundle|artifact index|harvest manifest|parity evidence"
```

The selected run must include these existing tests by exact name:

- `fails closed on apply when required mode is set and parity proof pack is missing`
- `auto-generates signed parity proof pack evidence when requested`
- `fails auto-generation when proof-pack input is missing`
- `auto-generates proof-pack inputs from signed provenance bundle when input is missing`
- `auto-generates provenance bundle and signed proof-pack from provenance input`
- `auto-generates provenance input, bundle, and proof-pack from signed artifact index`
- `auto-generates provenance input and proof-pack from harvest manifest discovery`
- `fails auto-generation from artifact index when signature is invalid`
- `fails auto-generation from artifact index when artifact digest is invalid`
- `fails auto-generation from artifact index when artifact signature is invalid`
- `fails auto-generation from provenance bundle when artifact signature is invalid`
- `fails closed on apply when required mode parity proof pack signature sidecar is missing`
- `fails closed on apply when required mode parity proof pack provenance manifest is missing`
- `fails closed on apply when required mode parity proof pack timestamp is too far in the future`
- `fails closed on apply when required mode parity proof pack contains duplicate scenarios`
- `fails closed on apply when required mode parity proof pack artifact digest mismatches content`
- `fails closed on apply when required mode parity proof pack artifact signature mismatches hash`
- `fails closed on apply when required mode parity proof pack evidence is insufficient`
- `allows apply when required mode parity proof pack evidence is verified`
- `fails closed on required mode apply when no open PR parity evidence is available`

If `IU-289-005` changes TypeScript imports or extracted module types, also run:

```bash
pnpm typecheck
```

If any expectation or test name must change, stop and return to `IU-289-004`
review instead of treating the extraction as behavior-preserving.

## Rejected Boundaries

Snapshot/state handling is tempting because it is a coherent lifecycle concept,
but it currently touches rollback safety, external control-plane snapshots,
state attestation, state freshness, and prepared report digests. Extracting it
first would couple evidence and rollback concerns before the proof-pack domain
is compressed.

Provider adapter selection is too small and too stable to justify first. It
would likely reduce line count without reducing the hard reasoning cost.

Break-glass and merge-queue behavior are real domains, but they are governance-
and operations-sensitive. They should become later boundaries only after the
first extraction proves the command can shed a domain without drifting.

Delegated registry routing was the right `IU-289-002` test target, but it is
not the right first `ci-migrate-core.ts` extraction target.

## IU-289-005 Execution Guardrails

`IU-289-005` may start only after this decision receives human acceptance.

Recommended `IU-289-005` sequence:

1. Identify the exact proof-pack/promotion-evidence symbols to move.
2. Move only types/constants/helpers that are required by those symbols.
3. Keep `buildMigrationReport` and `runCIMigrateCLI` in
   `src/commands/ci-migrate-core.ts`.
4. Run the focused proof-pack/runtime tests after the smallest move.
5. Stop if the new module needs command-core imports, public output changes, or
   extra live-provider assumptions.

Suggested first parent issue title:

```text
[coding-harness] Extract CI migration promotion-evidence support
```

## Rollback Conditions

Rollback `IU-289-005` instead of continuing if:

- the extracted module imports `src/commands/ci-migrate-core.ts`;
- focused tests require expectation changes to pass;
- generated artifact paths or report fields change;
- JSON dry-run output changes;
- proof-pack failure classification changes;
- extraction requires touching break-glass, merge-queue, provider adapter, or
  command-registry behavior;
- validation cannot distinguish documentation artifacts from runtime behavior.

Rollback status recommendation: return the Linear parent to implementation with
the blocker label `Drift-Risk`, keep this decision artifact, and reopen
`IU-289-004` only if the selected boundary itself is proven wrong.

## Validation Requirements

Required before accepting `IU-289-004`:
`HE_TOOLING_ROOT` denotes the external HE tooling checkout used by the
operator; if it is unavailable, HE artifact validation is blocked rather than
repo-local.

| Command | Purpose |
| --- | --- |
| `pnpm markdownlint .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md .harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md .harness/review/2026-05-08-JSC-289-ci-migration-first-extraction-boundary-decision.md` | Proves the plan update and decision artifact follow markdown rules. |
| `python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/review/2026-05-08-JSC-289-ci-migration-first-extraction-boundary-decision.md` | Proves HE artifact identity is valid. |
| `python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/review/2026-05-08-JSC-289-ci-migration-first-extraction-boundary-decision.md` | Proves frontmatter safety is valid. |
| `python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/review/2026-05-08-JSC-289-ci-migration-first-extraction-boundary-decision.md` | Proves Linear traceability is valid. |
| `git diff --check` | Proves no whitespace damage. |

No runtime tests are required for `IU-289-004` because it is a docs-only
decision gate. `IU-289-005` must rerun focused runtime tests before commit.

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Plan unit | IU-289-004 status | Evidence |
| --- | --- | --- | --- | --- |
| `JSC-289` | `SA-289-004` | `IU-289-004` | `selected` | This decision defines proof-pack and promotion-evidence support as the first extraction boundary and names import-direction controls. |
| `JSC-289` | `SA-289-005` | `IU-289-004` | `preserved` | This phase is decision-only and does not edit runtime behavior before characterization acceptance. |
| `JSC-289` | `SA-289-006` | `IU-289-004` | `defined-for-next-unit` | Rollback and validation requirements are documented for `IU-289-005`. |
| `JSC-289` | `SA-289-011` | `IU-289-004` | `defined-for-next-unit` | Required validation gates and focused runtime gates are visible before extraction starts. |

## Evidence And Traceability

| Conclusion | Evidence type | File paths | Symbols / components | Confidence | Why it matters |
| --- | --- | --- | --- | --- | --- |
| Proof-pack support is the best first extraction boundary. | source-code / tests / prior artifacts | `src/commands/ci-migrate-core.ts`; `src/commands/ci-migrate.test.ts`; `.harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md`; `.harness/review/2026-05-08-JSC-289-ci-migration-runtime-lifecycle-coverage-map.md` | `parseParityProofPack`, `maybeAutoGenerateParityProofPack`, `evaluatePromotionEvidence`, proof-pack runtime tests | High | It is covered, meaningful, and separable without changing the public command. |
| Whole report generation should not move first. | source-code / interpretation | `src/commands/ci-migrate-core.ts:8423`; `src/commands/ci-migrate-core.ts:9574` | `buildMigrationReport`, `runCIMigrateCLI` report path | Medium-high | Report generation currently mixes provider adapters, required checks, satisfiability, and proof evidence; moving it all first would be too broad. |
| Break-glass and merge-queue should not be first. | source-code / prior inventory | `src/commands/ci-migrate-core.ts`; `.harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md` | break-glass policy, merge-queue windows, provider API orchestration | High | These are governance-sensitive and should not be mixed with first extraction proof. |
| Delegated registry routing should not be first. | tests / source-code | `src/cli-dispatch.test.ts`; `src/lib/cli/registry/command-specs-core.ts` | `sync-branch-protection`, `promote-mode`, `runCIMigrateCLI` dispatch | High | `IU-289-002` froze this behavior, but it does not reduce the oversized runtime core. |
| `IU-289-005` needs import-direction enforcement. | architectural coupling | future `src/lib/ci/ci-migrate-promotion-evidence.ts`; current `src/commands/ci-migrate-core.ts` | import graph | High | Prevents extracting a module that still depends back on the god orchestrator. |

## Review Handoff

Accept `IU-289-004` only if review confirms:

- exactly one boundary is selected;
- extraction has not started;
- selected boundary is not broader than proof-pack/promotion-evidence support;
- rollback files for `IU-289-005` are explicit before source edits;
- focused `IU-289-005` test selection is exact, not discretionary;
- the first extraction does not include whole report generation, state store,
  break-glass, merge-queue, provider adapter, or registry routing work;
- `IU-289-005` remains blocked on human acceptance of this decision.
