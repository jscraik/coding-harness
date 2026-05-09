---
schema_version: 1
artifact_id: jsc-289-ci-migration-characterization-inventory-review
artifact_type: he-code-review-inventory
canonical_slug: jsc-289-ci-migration-characterization-inventory
title: JSC-289 CI Migration Characterization Inventory
harness_stage: he-code-review
status: review-required
date: 2026-05-08
traceability_required: true
origin: .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md
linear_issue: JSC-289
linear_milestone: CI Migration Boundary Recovery Slice
linear_status: In Progress
implementation_unit: IU-289-001
---

# JSC-289 CI Migration Characterization Inventory

## Table Of Contents

- [Scope](#scope)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Inventory Method](#inventory-method)
- [Dirty Worktree Ownership](#dirty-worktree-ownership)
- [Characterization Matrix](#characterization-matrix)
- [Gap List](#gap-list)
- [Extraction Boundary Guidance](#extraction-boundary-guidance)
- [Loophole Closure Status](#loophole-closure-status)
- [Validation Notes](#validation-notes)
- [Evidence Commands](#evidence-commands)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [Review Handoff](#review-handoff)

## Scope

This artifact completes `IU-289-001` from
`.harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md`.

The work is inventory-only. It does not change runtime behavior, command
registry behavior, CI provider semantics, generated artifact semantics,
branch-protection policy paths, tests, source code, or governance contracts.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-289` |
| Linear project | `coding-harness` |
| Linear milestone | `CI Migration Boundary Recovery Slice` |
| Plan unit | `IU-289-001` |
| Scope | Inventory and characterize current `ci-migrate` public behavior. |
| Out of scope | Runtime edits, extraction, delegated dispatch behavior changes, live branch-protection mutation, orphan workflow cleanup, and `JSC-159`/`JSC-248` work. |
| Human review | Required before `IU-289-002` starts. |

## Inventory Method

Proof-state vocabulary follows the plan exactly:

- `covered-by-existing-test`: a current test directly protects the behavior.
- `covered-by-source-inspection-only`: source behavior was found, but no direct
  test anchor was found in this inventory pass.
- `needs-focused-test`: the behavior is important enough that a later unit
  should add or strengthen a focused characterization test before extraction.
- `credential-blocked`: live execution depends on unavailable credentials.
- `external-live-blocked`: live external provider state would be required.
- `deferred-by-human-review`: the behavior is strategic or policy-sensitive and
  should not be automated before human review.
- `out-of-scope`: the behavior belongs outside `JSC-289`.

## Dirty Worktree Ownership

| Checkpoint | Observed state | Ownership conclusion |
| --- | --- | --- |
| Before `IU-289-001` edits | `git status --short --branch` showed only `## codex/jsc-248-agent-native-compression...origin/codex/jsc-248-agent-native-compression`. | Clean worktree; no user changes were present in the observed status output. |
| After `IU-289-001` edits | Explicit worktree status showed only `?? .harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md`. | Dirty state belongs to this inventory artifact only. |

Plain `git status` became unreliable during validation because the observed local
`.git/config` reported `core.worktree` as a temp harness fixture path. For
after-edit ownership in a normal checkout, run `git status --short --branch`
from the repo root. If the local checkout has `core.worktree` drift, use
`git --git-dir=$REPO_ROOT/.git --work-tree=$REPO_ROOT ...` until that separate
environment/config drift is repaired.

## Characterization Matrix

| Matrix row | Current proof state | Source anchors | Test anchors | Inventory conclusion |
| --- | --- | --- | --- | --- |
| Runtime actions: `prepare`, `commit`, `abort`, `verify`, `bootstrap` | `covered-by-existing-test` | `src/lib/ci/ci-migrate-command-contract.ts:16` defines the public action set. `src/commands/ci-migrate-core.ts:2873` normalizes actions. `src/commands/ci-migrate-core.ts:2894` maps action to mode. `src/commands/ci-migrate-core.ts:9328`, `src/commands/ci-migrate-core.ts:9409`, `src/commands/ci-migrate-core.ts:9434`, `src/commands/ci-migrate-core.ts:9450`, `src/commands/ci-migrate-core.ts:9496`, and `src/commands/ci-migrate-core.ts:9653` anchor bootstrap, stateful commit/abort/rollback, prepare, commit, abort, and verify branches. | `src/lib/ci/ci-migrate-command-contract.test.ts:17` covers the action constants. `src/commands/ci-migrate.test.ts:3862` covers prepare and commit success. `src/commands/ci-migrate.test.ts:4156` and `src/commands/ci-migrate.test.ts:4178` cover abort failure/success. `src/commands/ci-migrate.test.ts:6101` and `src/commands/ci-migrate.test.ts:6178` cover verify failure/success. `src/commands/ci-migrate.test.ts:6249` covers bootstrap. | Runtime action behavior is protected well enough for inventory. Later extraction must keep these tests green and should not merge delegated registry actions into `CIMigrateAction`. |
| Delegated registry actions: `sync-branch-protection`, `promote-mode` | `needs-focused-test` | `src/lib/cli/registry/command-specs-core.ts:2117` includes delegated actions in registry parsing only. `src/lib/cli/registry/command-specs-core.ts:2154` delegates `sync-branch-protection`. `src/lib/cli/registry/command-specs-core.ts:2157` delegates `promote-mode`. `src/commands/ci-migrate-core.ts:3404` and `src/commands/ci-migrate-core.ts:10309` define separate CLI entry points. | No direct `src/cli-dispatch.test.ts` or `src/lib/cli/registry/command-specs.test.ts` anchors were found for either delegated action. `rg` only found source definitions and runtime command strings. | This is the main `IU-289-002` gap. Add registry/dispatch tests proving delegated actions route to their helper functions and are not accepted by runtime `normalizeAction`. |
| Provider behavior: `circleci`, `github-actions`, default provider `circleci` | `covered-by-existing-test` | `src/lib/ci/ci-migrate-command-contract.ts:3` documents the default provider. `src/lib/ci/ci-migrate-command-contract.ts:8` defines the provider set. `src/commands/ci-migrate-core.ts:3015` normalizes providers. | `src/lib/ci/ci-migrate-command-contract.test.ts:9` covers the default provider. `src/lib/ci/ci-migrate-command-contract.test.ts:13` covers supported providers. `src/commands/ci-migrate.test.ts:3783` covers commit provider mismatch. `src/commands/ci-migrate.test.ts:3129` covers rollback source-provider use. | Provider constants have direct coverage. Runtime provider compatibility has representative coverage, but future extraction should keep provider constants in the contract module or a clearly owned equivalent. |
| CLI parsing: positional action, `--action`, target directory, too many targets, unsupported action | `needs-focused-test` | `src/lib/cli/registry/command-specs-core.ts:2090` defines value flags. `src/lib/cli/registry/command-specs-core.ts:2099` collects positional args. `src/lib/cli/registry/command-specs-core.ts:2126` parses `--action`. `src/lib/cli/registry/command-specs-core.ts:2135` rejects too many target dirs. `src/commands/ci-migrate-core.ts:2873` rejects unsupported runtime actions. | `src/cli-dispatch.test.ts:711` covers positional action plus target directory. `src/cli-dispatch.test.ts:764` covers explicit `--action`. `src/cli-dispatch.test.ts:808` covers missing value-flag handling. `src/cli-dispatch.test.ts:839` covers too many target dirs. `src/lib/cli/registry/command-specs.test.ts:783` covers too many positional args at registry level. No direct test anchor was found for empty `--action` or unsupported action through the registry/runtime boundary. | Existing CLI parsing coverage is useful but incomplete. `IU-289-002` should add focused tests for unsupported action and empty `--action` behavior before extraction. |
| JSON and dry-run output: exit code and output shape for representative dry-run paths | `covered-by-existing-test` | `src/commands/ci-migrate-core.ts:9704` emits explicit JSON dry-run output with `status`, `snapshotId`, `targetDir`, `sourceProvider`, `targetProvider`, `plan`, `report`, and `violations`. | `src/commands/ci-migrate.test.ts:4666` covers parity report generation during dry-run. `src/commands/ci-migrate.test.ts:4724` covers JSON dry-run output without migration artifact writes. | Representative JSON/dry-run shape is covered. Future extraction must preserve stdout JSON shape and avoid adding non-JSON output on this path. |
| Snapshot/signing: signing-key requirement, snapshot ID isolation, state/report/attestation paths | `covered-by-existing-test` | `src/commands/ci-migrate-core.ts:9434` and `src/commands/ci-migrate-core.ts:9442` reject reused prepare/apply snapshot IDs. `src/commands/ci-migrate-core.ts:9457` validates prepared-state freshness and evidence. `src/commands/ci-migrate-core.ts:9560` restores signed rollback snapshots. | `src/commands/ci-migrate.test.ts:3740` covers missing signing key. `src/commands/ci-migrate.test.ts:3802` and `src/commands/ci-migrate.test.ts:3832` cover snapshot ID reuse. `src/commands/ci-migrate.test.ts:3862` covers prepared/committed state paths. `src/commands/ci-migrate.test.ts:3910`, `src/commands/ci-migrate.test.ts:3936`, `src/commands/ci-migrate.test.ts:4046`, `src/commands/ci-migrate.test.ts:4086`, and `src/commands/ci-migrate.test.ts:4116` cover missing/tampered/stale state and report evidence. | Snapshot and signing behavior is strongly covered. Missing signing key is a credential failure path, but it is already represented by a deterministic unit test rather than live credential dependence. |
| Proof pack/reporting: report schema, proof-pack generation, related artifact paths | `covered-by-existing-test` | `src/commands/ci-migrate-core.ts:9574` imports/generates required checks and proof evidence. `src/commands/ci-migrate-core.ts:9619` builds the migration report. `src/commands/ci-migrate-core.ts:9635` rejects commit if prepared state no longer matches current report. | `src/commands/ci-migrate.test.ts:3971` covers proof-pack metadata persisted to state. `src/commands/ci-migrate.test.ts:4016` covers 40-character git SHAs. `src/commands/ci-migrate.test.ts:5333`, `src/commands/ci-migrate.test.ts:5347`, `src/commands/ci-migrate.test.ts:5402`, `src/commands/ci-migrate.test.ts:5420`, `src/commands/ci-migrate.test.ts:5497`, `src/commands/ci-migrate.test.ts:5547`, `src/commands/ci-migrate.test.ts:5584`, and `src/commands/ci-migrate.test.ts:5754` through `src/commands/ci-migrate.test.ts:5912` cover proof-pack generation, provenance, signatures, artifact indexes, and failure modes. | Proof/reporting behavior is heavily covered and is a plausible future extraction boundary after human review. |
| Break-glass/merge queue: approval, policy, roster, evidence, provider API paths | `covered-by-existing-test` | `src/commands/ci-migrate-core.ts:9358` syncs break-glass governance. `src/commands/ci-migrate-core.ts:9377` reads approval and policy. `src/commands/ci-migrate-core.ts:9515` gates rollback weakening with break-glass approval. | `src/commands/ci-migrate.test.ts:2191` through `src/commands/ci-migrate.test.ts:2885` cover active/terminal merge-queue windows, signed evidence, required-mode commit windows, executable/provider API orchestrators, and binding mismatches. `src/commands/ci-migrate.test.ts:3183` through `src/commands/ci-migrate.test.ts:3349` cover break-glass roster, policy, missing approval, allowlisted approvers, and rollback weakening. | Governance-sensitive behavior is well covered but high risk. Any extraction here should be human-reviewed and should not be first unless a maintainer explicitly chooses it. |
| Generated artifact drift: scaffold, manifest, and required-check artifacts that may change during runs | `covered-by-existing-test` | `src/commands/ci-migrate-core.ts:9339` writes bootstrap draft status. `src/commands/ci-migrate-core.ts:9578` reads or imports required checks. `src/commands/ci-migrate-core.ts:9704` avoids artifact writes on explicit JSON dry-run. | `src/commands/ci-migrate.test.ts:4263` and `src/commands/ci-migrate.test.ts:4316` cover required-check import dry-run/apply behavior. `src/commands/ci-migrate.test.ts:4724` covers JSON dry-run without migration artifact writes. `src/commands/ci-migrate.test.ts:6249` through `src/commands/ci-migrate.test.ts:6316` cover bootstrap draft creation, existing file preservation, and forced overwrite. | Generated artifact behavior has direct tests. Future extraction must keep scaffold/manifest writes isolated and must classify generated diffs before cleanup. |

## Gap List

| Gap | Proof state | Required next action |
| --- | --- | --- |
| Delegated actions lack direct dispatch tests. | `needs-focused-test` | Add focused `IU-289-002` tests proving `ci-migrate sync-branch-protection` and `ci-migrate promote-mode` route to `runSyncBranchProtectionCLI` and `runPromoteModeCLI`, both positionally and through `--action` if that syntax is intended to remain supported. |
| Unsupported action behavior is only source-inspected at runtime. | `needs-focused-test` | Add a focused `IU-289-002` or `IU-289-003` test for an unsupported action reaching `normalizeAction` and returning the documented error/exit code. |
| Empty `--action` behavior is not directly characterized. | `needs-focused-test` | Add a focused `IU-289-002` dispatch test for `--action` with no usable value, especially when combined with a target dir and `--dry-run`. |
| Live branch-protection alignment is not proven by delegated JSON success. | `external-live-blocked` | Defer live alignment proof to a human-reviewed branch-protection slice. Do not use `runSyncBranchProtectionCLI(... --json)` success as proof of live GitHub state. |
| First extraction boundary is not yet selected. | `deferred-by-human-review` | After `IU-289-002` and `IU-289-003` close characterization gaps, run `IU-289-004` as a human-reviewed decision gate. |

## Extraction Boundary Guidance

The strongest first extraction candidate is proof-pack/reporting support, not
registry dispatch or break-glass governance.

Evidence:

- Proof-pack/reporting has dense existing test anchors from
  `src/commands/ci-migrate.test.ts:3971` through
  `src/commands/ci-migrate.test.ts:5912`.
- It has real responsibility: report construction, proof-pack provenance,
  signatures, artifact indexes, and failure classification.
- It can likely expose stable inputs/outputs without changing the public
  `runCIMigrateCLI` entrypoint.

Avoid first:

- Delegated registry routing, because it currently has the clearest test gap.
- Break-glass and merge-queue governance, because coverage exists but policy
  blast radius is high.
- Provider default/contract constants, because they are already small and
  stable in `src/lib/ci/ci-migrate-command-contract.ts`.

## Loophole Closure Status

| Loophole | Status | Evidence |
| --- | --- | --- |
| Delegated action confusion | Open gap | Delegated actions are listed in registry parsing at `src/lib/cli/registry/command-specs-core.ts:2117` and delegated at `src/lib/cli/registry/command-specs-core.ts:2154`, but no direct dispatch tests were found. |
| `--action` ambiguity | Partially closed | Positional and explicit action dispatch are covered by `src/cli-dispatch.test.ts:711` and `src/cli-dispatch.test.ts:764`; empty/unsupported action still needs focused coverage. |
| Provider default drift | Closed for this unit | `src/lib/ci/ci-migrate-command-contract.test.ts:9` verifies `circleci` remains default, and `src/lib/ci/ci-migrate-command-contract.test.ts:13` verifies the provider list. |
| Credential false failure | Closed for this unit | Missing signing key is represented by deterministic test coverage at `src/commands/ci-migrate.test.ts:3740`, not by a live credential run. |
| Snapshot reuse false failure | Closed for this unit | `src/commands/ci-migrate.test.ts:3802` and `src/commands/ci-migrate.test.ts:3832` use isolated snapshot IDs and assert reuse rejection. |
| Live governance false pass | Open by design | `runSyncBranchProtectionCLI` returns success for JSON mode at `src/commands/ci-migrate-core.ts:10369` after local plan construction; this inventory does not claim live GitHub alignment. |
| Generated artifact churn | Closed for this unit | Required-check import and bootstrap draft behavior have direct tests at `src/commands/ci-migrate.test.ts:4263`, `src/commands/ci-migrate.test.ts:4316`, and `src/commands/ci-migrate.test.ts:6249`. |
| Shallow extraction risk | Deferred | No extraction is authorized in `IU-289-001`. The proof-pack/reporting candidate must still pass `IU-289-004` human review. |
| Linear scope creep | Closed for this unit | This artifact covers `JSC-289` only and does not admit `JSC-159`, `JSC-248`, or historical CI cleanup issues. |
| Validation understatement | Closed for this unit | Exact validation commands and outcomes are recorded below. |

## Validation Notes

Artifact validation passed after one metadata/table-shape correction.
`HE_TOOLING_ROOT` denotes the external HE tooling checkout used by the
operator; if it is unavailable, HE artifact validation is blocked rather than
repo-local.

| Command | Outcome |
| --- | --- |
| `python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md .harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md` | pass |
| `python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md .harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md` | pass |
| `python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md .harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md` | pass after traceability table was corrected to include `Linear issue` and `Acceptance IDs` columns |
| `pnpm markdownlint .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md .harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md` | pass |
| `git diff --check` | pass |

Phase-exit gates:

| Gate | Outcome |
| --- | --- |
| `simplify` | pass; docs-only inventory remains intentionally explicit because the matrix is the phase evidence, not duplicated architecture prose. |
| `he-fix-bugs` | skipped; no validation or regression evidence failed. |
| `he-code-review` | pass; no blocking findings found for `IU-289-001`. Human review remains required before `IU-289-002`. |

## Evidence Commands

Commands used for inventory discovery:

```text
Command: zsh -lc 'git status --short --branch' -> pass (clean branch status before edits)
Command: zsh -lc 'sed -n "1,260p" .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md' -> pass
Command: zsh -lc 'rg -n "sync-branch-protection|promote-mode|runSyncBranchProtectionCLI|runPromoteModeCLI" src/lib/cli/registry src/cli-dispatch.test.ts src/lib/cli/registry/command-specs.test.ts src/commands/ci-migrate-core.ts src/commands/ci-migrate.test.ts' -> pass
Command: zsh -lc 'rg -n "runCIMigrateCLI|prepare|commit|abort|verify|bootstrap|proof|break-glass|merge queue|JSON dry-run|snapshot|signing key|provider" src/commands/ci-migrate.test.ts src/cli-dispatch.test.ts src/lib/cli/registry/command-specs.test.ts src/lib/ci/ci-migrate-command-contract.test.ts' -> pass
Command: zsh -lc 'nl -ba src/lib/cli/registry/command-specs-core.ts | sed -n "2060,2195p"' -> pass
Command: zsh -lc 'nl -ba src/commands/ci-migrate-core.ts | sed -n "2868,3020p" && nl -ba src/commands/ci-migrate-core.ts | sed -n "9328,9735p" && nl -ba src/commands/ci-migrate-core.ts | sed -n "10300,10390p"' -> pass
Command: zsh -lc 'python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md .harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md' -> pass
Command: zsh -lc 'python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md .harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md' -> pass
Command: zsh -lc 'python3 ${HE_TOOLING_ROOT}/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md .harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md' -> pass after correcting the acceptance traceability table columns
Command: zsh -lc 'pnpm markdownlint .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md .harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md' -> pass
Command: zsh -lc 'git diff --check' -> pass
Command: zsh -lc 'git status --short --branch' -> pass; dirty state is only this new inventory artifact
```

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Inventory evidence |
| --- | --- | --- |
| `JSC-289` | `SA-289-001` | Characterization matrix maps runtime actions, delegated actions, provider behavior, CLI parsing, JSON/dry-run output, snapshot/signing, proof pack/reporting, break-glass/merge queue, and generated artifact drift. |
| `JSC-289` | `SA-289-005` | Gap list names the first extraction blocker and recommends proof-pack/reporting as the strongest later candidate. |
| `JSC-289` | `SA-289-008` | Loophole closure table explicitly separates closed, open, and deferred states. |
| `JSC-289` | `SA-289-009` | Dirty worktree ownership is recorded before edits and scoped to this artifact. |
| `JSC-289` | `SA-289-010` | Validation command outcomes are recorded in [Validation Notes](#validation-notes) and [Evidence Commands](#evidence-commands). |

## Review Handoff

Human review is required before `IU-289-002`.

Recommended next slice:

1. Add focused delegated-action dispatch tests for `sync-branch-protection` and
   `promote-mode`.
2. Add focused unsupported-action and empty-`--action` characterization tests.
3. Re-run the smallest registry/dispatch test set.
4. Only then decide whether runtime lifecycle gaps remain for `IU-289-003`.
