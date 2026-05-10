---
schema_version: 1
artifact_id: jsc-289-ci-migration-runtime-lifecycle-coverage-map
artifact_type: he-code-review-coverage-map
canonical_slug: jsc-289-ci-migration-runtime-lifecycle-coverage-map
title: JSC-289 CI Migration Runtime Lifecycle Coverage Map
harness_stage: he-code-review
status: review-required
date: 2026-05-08
traceability_required: true
origin: .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md
linear_issue: JSC-289
linear_milestone: CI Migration Boundary Recovery Slice
linear_status: In Progress
implementation_unit: IU-289-003
---

# JSC-289 CI Migration Runtime Lifecycle Coverage Map

## Table Of Contents

- [Scope](#scope)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Decision](#decision)
- [Runtime Coverage Matrix](#runtime-coverage-matrix)
- [Loophole Closure](#loophole-closure)
- [Out Of Scope](#out-of-scope)
- [Validation Plan](#validation-plan)
- [Review Handoff](#review-handoff)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)

## Scope

This artifact completes `IU-289-003` from
`.harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md`.

The approved unit is characterization-only. It may add focused runtime tests or
produce an explicit coverage map for `src/commands/ci-migrate.test.ts`. This
artifact chooses the coverage-map route because the current runtime suite
already has direct anchors for the lifecycle behaviors named by the plan.

No production source, runtime behavior, provider behavior, generated artifact
shape, or CI migration semantics were changed.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-289` |
| Linear project | `coding-harness` |
| Linear milestone | `CI Migration Boundary Recovery Slice` |
| Plan unit | `IU-289-003` |
| Scope | Runtime lifecycle coverage map for `src/commands/ci-migrate.test.ts`. |
| Out of scope | Runtime edits, CI provider changes, live branch-protection mutation, orphan workflow cleanup, extraction work, and `JSC-159`/`JSC-248` work. |
| Human review | Required before `IU-289-004` boundary selection starts. |

## Decision

`IU-289-003` does not need new tests before boundary selection.

Reason: the remaining runtime lifecycle rows from the plan are already covered
by existing `runCIMigrateCLI` tests. Adding duplicate tests would increase suite
weight without improving the migration boundary. The safe next step is
`IU-289-004`: a human-reviewed boundary selection decision.

## Runtime Coverage Matrix

| Runtime surface | Proof state | Test anchors | Coverage conclusion |
| --- | --- | --- | --- |
| Missing signing key for apply | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:3740` verifies apply fails closed when `HARNESS_CI_MIGRATE_SIGNING_KEY` is missing. | Credential failure is deterministic and does not require live secrets. |
| Apply plus dry-run conflict | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:3754` verifies `apply + dryRun` returns `EXIT_CODES.INVALID_PATH`. | Mutating and dry-run modes remain mutually exclusive. |
| Explicit abort requires snapshot | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:3763` verifies abort without `snapshot` fails closed. | Abort cannot operate without an explicit snapshot identity. |
| Explicit commit requires prepared state | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:3772` verifies commit fails when prepared state is missing. | Commit remains stateful rather than best-effort. |
| Commit provider mismatch | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:3783` prepares with `circleci` and rejects commit with `github-actions`. | Provider identity is preserved across prepare and commit. |
| Snapshot reuse isolation | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:3802` rejects reused phased artifacts for prepare; `src/commands/ci-migrate.test.ts:3832` rejects reused phased artifacts for legacy apply. | Runtime lifecycle tests already avoid false confidence from reused snapshot IDs. |
| Prepare to commit success path | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:3862` writes prepared state, commits it, and verifies `runInitCLI` receives `ciProvider: "circleci"`. | The primary phased lifecycle path is directly covered. |
| Missing or tampered prepared report | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:3910` rejects missing prepared report; `src/commands/ci-migrate.test.ts:3936` rejects tampered prepared report. | Commit remains bound to the prepared report artifact. |
| Proof-pack metadata in prepared state | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:3971` persists proof-pack metadata into prepared state; `src/commands/ci-migrate.test.ts:4046` rejects tampered proof-pack metadata. | Proof evidence is bound into phased state and checked before commit. |
| Prepared state integrity | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:4086` rejects missing prepared-state attestation signature; `src/commands/ci-migrate.test.ts:4116` rejects stale prepared state. | State freshness and attestation checks are protected before extraction. |
| Abort lifecycle | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:4156` rejects abort from a non-committed state; `src/commands/ci-migrate.test.ts:4178` marks committed state aborted. | Abort has both negative and positive lifecycle coverage. |
| JSON dry-run output | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:4666` writes a dry-run parity report; `src/commands/ci-migrate.test.ts:4724` emits JSON dry-run output without writing migration artifacts. | JSON dry-run preserves output shape and non-mutating behavior. |
| Proof-pack required-mode failures | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:5333`, `src/commands/ci-migrate.test.ts:5402`, and `src/commands/ci-migrate.test.ts:5754` through `src/commands/ci-migrate.test.ts:5877` cover missing input, missing signature/provenance, future timestamp, duplicate scenarios, artifact digest/signature drift, and insufficient evidence. | Required-mode proof-pack failures are broad enough to protect extraction. |
| Proof-pack generation success paths | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:5347`, `src/commands/ci-migrate.test.ts:5420`, `src/commands/ci-migrate.test.ts:5497`, `src/commands/ci-migrate.test.ts:5547`, and `src/commands/ci-migrate.test.ts:5584` cover auto-generation from input, provenance bundle, provenance input, signed artifact index, and harvest manifest discovery. | Proof-pack/reporting is a plausible extraction candidate because it has dense positive and negative coverage. |
| Verified required-mode apply | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:5912` verifies required-mode apply succeeds when proof-pack evidence is valid. | The required-mode happy path is protected. |
| Strict verify failures and success | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:6101`, `src/commands/ci-migrate.test.ts:6114`, and `src/commands/ci-migrate.test.ts:6130` cover verify failures; `src/commands/ci-migrate.test.ts:6178` covers strict verify success. | Verify behavior has representative failure and success coverage. |
| Bootstrap lifecycle | `covered-by-existing-test` | `src/commands/ci-migrate.test.ts:6258` creates the draft transition artifact; `src/commands/ci-migrate.test.ts:6277` preserves existing artifact without force; `src/commands/ci-migrate.test.ts:6294` overwrites with force. | Bootstrap behavior is covered and does not need additional IU-289-003 tests. |

## Loophole Closure

| Loophole | IU-289-003 closure |
| --- | --- |
| Credential false failure | Closed by the missing-signing-key matrix row; no live signing secret is required. |
| Snapshot reuse false failure | Closed by the snapshot-reuse matrix row and isolated temp-dir runtime fixtures. |
| Provider default drift | Covered by `IU-289-001` contract tests and the provider-mismatch matrix row. |
| JSON/dry-run mutation risk | Closed by the JSON dry-run matrix row. |
| Proof-pack/reporting extraction risk | Reduced by the proof-pack failure and success rows. Human review is still required before extraction. |
| Live governance false pass | Still deferred. Runtime tests do not prove live branch-protection state and must not be represented as live GitHub/CircleCI alignment evidence. |
| Shallow extraction risk | Still deferred to `IU-289-004`. This artifact only says the runtime coverage boundary is strong enough to choose a first extraction candidate. |

## Out Of Scope

This unit did not:

- edit `src/commands/ci-migrate-core.ts`;
- add or alter `runCIMigrateCLI` behavior;
- touch CI provider configuration or branch-protection policy;
- run live GitHub, CircleCI, or Semgrep operations;
- start extraction work;
- claim `JSC-289` is complete.

## Validation Plan

Required validation for this artifact:
`HE_TOOLING_ROOT` denotes the external HE tooling checkout used by the
operator; if it is unavailable, HE artifact validation is blocked rather than
repo-local.

| Command | Purpose |
| --- | --- |
| `pnpm vitest run --maxWorkers=1 --dangerouslyIgnoreUnhandledErrors src/commands/ci-migrate.test.ts` | Proves the mapped runtime lifecycle suite still passes. |
| `pnpm typecheck` | Proves no TypeScript compatibility drift after the phase. |
| `pnpm markdownlint .harness/review/2026-05-08-JSC-289-ci-migration-runtime-lifecycle-coverage-map.md` | Proves the new coverage artifact follows markdown rules. |
| `python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/review/2026-05-08-JSC-289-ci-migration-runtime-lifecycle-coverage-map.md` | Proves HE artifact identity is valid. |
| `python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/review/2026-05-08-JSC-289-ci-migration-runtime-lifecycle-coverage-map.md` | Proves HE frontmatter safety is valid. |
| `python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/review/2026-05-08-JSC-289-ci-migration-runtime-lifecycle-coverage-map.md` | Proves Linear traceability is valid. |
| `git diff --check` | Proves no whitespace damage. |

No production source changed, so `pnpm run quality:docstrings`,
`pnpm run quality:size`, and `pnpm test:deep` are not required for this unit.

## Review Handoff

`IU-289-003` should be accepted if validation passes and review confirms this
artifact accurately maps runtime lifecycle coverage without overstating live
governance proof.

Recommended next phase after acceptance:

1. Run `IU-289-004` as a decision gate.
2. Choose exactly one first extraction boundary or explicitly defer extraction.
3. Treat proof-pack/reporting as the current strongest candidate because it has
   dense existing coverage and real responsibility.

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Plan unit | IU-289-003 status | Evidence |
| --- | --- | --- | --- | --- |
| `JSC-289` | `SA-289-002` | `IU-289-003` | `covered-for-runtime-lifecycle` | Runtime lifecycle coverage map identifies deterministic existing tests for `prepare`, `commit`, `abort`, `verify`, `bootstrap`, dry-run, JSON, and proof-pack paths. |
| `JSC-289` | `SA-289-004` | `IU-289-003` | `not-claimed-deferred-to-IU-289-004` | This artifact does not define an extraction boundary. It only supplies runtime coverage evidence needed before boundary selection. |
| `JSC-289` | `SA-289-009` | `IU-289-003` | `covered-for-runtime-lifecycle` | Matrix rows classify signing-key, snapshot reuse, state/report/attestation, generated artifact, and proof-pack failure modes. |
| `JSC-289` | `SA-289-010` | `IU-289-003` | `not-claimed-covered-by-IU-289-002` | Command parsing edge cases belong to registry/dispatch characterization and were handled by `IU-289-002`; this artifact does not re-claim parsing coverage. |
