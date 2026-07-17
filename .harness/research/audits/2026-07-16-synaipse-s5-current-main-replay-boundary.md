---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: synaipse-s5-current-main-replay-boundary-2026-07-16
artifact_type: research-audit
canonical_slug: synaipse-s5-current-main-replay-boundary
title: SynAIpse S5 Current-Main Replay Boundary
status: active
date: 2026-07-16
source_type: evidence-inventory
authority: execution-input
lifecycle_status: execution-input
canonical_destination: .harness/implementation-notes/2026-07-15-synaipse-slice5-packet-consolidation.md
owner: coding-harness-maintainers
created: 2026-07-16
last_reviewed: 2026-07-16
review_cadence: on-change
linear_issue: JSC-464
depends_on:
  - .harness/research/audits/2026-07-16-synaipse-s5-dirty-candidate-separation-inventory.md
  - docs/plans/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-plan.md
  - docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
validated_by:
  - git status --porcelain=v1
  - git diff --cached --quiet
  - git diff --check
  - pnpm docs:lint
  - pnpm docs:lifecycle
  - pnpm harness:audit-tracking
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
  - pnpm exec vitest run src/lib/synaipse/packet-consolidation.test.ts src/commands/next-agent-native-ratchets.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts src/dev/write-agent-native-ratchet-report-script.test.ts
---

# SynAIpse S5 Current-Main Replay Boundary

## Table of Contents

- [Purpose](#purpose)
- [Source and Destination](#source-and-destination)
- [Included Surfaces](#included-surfaces)
- [Excluded Surfaces](#excluded-surfaces)
- [Shared Note Treatment](#shared-note-treatment)
- [Replay Result](#replay-result)
- [Post-Replay S5 Extension](#post-replay-s5-extension)
- [Validation](#validation)
- [Claims Boundary](#claims-boundary)

## Purpose

This artifact records the governed deterministic fallback used after three
consecutive remote task-transport failures. It establishes a current-main,
S5-only replay boundary without changing or deleting the mixed recovery
worktree. It does not prove the Slice 5 behavior gates.

## Source and Destination

- Source worktree:
  `/private/tmp/coding-harness-jsc464-slice5-v3`
- Source branch:
  `codex/jsc-464-synaipse-slice5-packet-consolidation-recovery`
- Source HEAD:
  `00aa738649d532c33570ff08f9c082ff7ac05175`
- Source dirty state: preserved with 53 unstaged paths and an empty index.
- Destination worktree:
  `/private/tmp/coding-harness-jsc464-slice5-canonical-v1`
- Destination branch:
  `codex/jsc-464-synaipse-slice5-canonical-replay`
- Destination base:
  `4b9c2abe870d38bfadd5b8836c73cf7ea8af2abe`

The destination base is the refreshed `origin/main` value observed immediately
before worktree creation.

## Included Surfaces

Twelve S5-exclusive implementation paths:

```text
contracts/examples/session-distill.example.json
contracts/session-distill.schema.json
scripts/check_artifact_type_contracts.py
scripts/tests/test_agent_native_artifact_contracts.py
scripts/write-agent-native-ratchet-report.cjs
src/commands/next-agent-native-ratchets.ts
src/commands/next-agent-native-ratchets.test.ts
src/dev/validate-runtime-packet-schemas-script.test.ts
src/dev/write-agent-native-ratchet-report-script.test.ts
src/lib/synaipse/packet-consolidation-contract.ts
src/lib/synaipse/packet-consolidation.test.ts
src/lib/synaipse/packet-consolidation.ts
```

Three controlling documents:

```text
.harness/research/audits/2026-07-11-synaipse-consolidation-and-codex-boundary-audit.md
docs/plans/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-plan.md
docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
```

Governance and execution artifacts:

```text
.harness/implementation-notes/2026-07-15-synaipse-slice5-packet-consolidation.md
.harness/research/audits/2026-07-16-synaipse-s5-dirty-candidate-separation-inventory.md
```

The pre-artifact replay therefore contained seventeen intended S5 paths.

## Excluded Surfaces

- All thirty-four adjacent npm audit, backend, runtime, tooling, CI, policy,
  codestyle, eval, Local Memory fallback, and transient-cleanup paths.
- Both stale pre-reconciliation review artifacts.
- Every backend-owned paragraph and command from the shared recovery note.

The excluded bytes remain in the source recovery worktree. Exclusion from this
candidate is not deletion, rejection, or evidence that the adjacent work is
unnecessary.

## Shared Note Treatment

The mixed recovery note could not be copied wholesale. Its `Recovery Review
Repairs` section is backend-owned, while `Four-Finding Contract Repair` and
`Final Local Validation And Limits` contain both S5 and backend proof. The
destination note was therefore rewritten as a concise S5-only execution input
that preserves the packet scope, full-SHA repair, controlling gaps, validation
contract, and claims boundary without copying backend claims.

The destination separation inventory records this paragraph-level ownership
correction. The source inventory and note remain unchanged.

## Replay Result

- The eleven tracked S5/control patches passed `git apply --check` against
  current main and applied without conflicts.
- Five untracked S5/governance files were copied byte-for-byte.
- The S5-only note and this replay artifact were created in the destination.
- No adjacent path was copied.
- Pre-artifact path-set SHA-256:
  `f8c0833ba1ff93914438f90ec4e9d11977a601f1e451aea0d5a1692872f4d9fa`.
- Pre-artifact content SHA-256:
  `3faf75eb318ea081e3744b04534e0fe95550f9f47f76e6cd66b663af5bf5afe5`.

These hashes cover the seventeen replay paths before this self-describing
artifact was added. Final review must calculate a new digest over every
intended-to-ship byte, including this artifact and later S5 repairs.

## Post-Replay S5 Extension

Implementation of local gates 1–6 added thirteen S5-only paths to the original
eighteen-path replay:

```text
package.json
src/lib/cli/command-registry.test.ts
src/lib/cli/registry/agent-native-packet-command-specs.test.ts
src/lib/cli/registry/agent-native-packet-command-specs.ts
src/lib/cli/registry/command-agent-catalog-rules.ts
src/lib/synaipse/improvement-case.ts
src/lib/synaipse/packet-caller-inventory.ts
src/lib/synaipse/packet-canonicalization.ts
src/lib/synaipse/packet-consolidation-measurement.ts
src/lib/synaipse/packet-retirement.ts
src/lib/synaipse/transition.ts
src/lib/testing/README.md
src/lib/testing/behavior-test-suites.json
```

These paths implement the real command adapter, canonical owner builders,
deterministic caller inventory, SHA-bound retirement evidence, default-surface
measurement, trust-boundary registration, and packet-specific agent-rail
reduction. They do not import any of the thirty-four excluded backend/runtime
paths. The destination currently has thirty-one intended S5/control/evidence
paths and an empty index. The source recovery worktree remains unchanged.

The pre-artifact hashes above remain historical replay evidence and do not
cover this extension. A final intended-to-ship digest is deliberately deferred
until aggregate validation and the last repair are complete so fresh
independent QA can bind to immutable final bytes.

## Validation

- Command: `git fetch origin main` -> pass (refreshed remote truth before
  replay; `origin/main` is `4b9c2abe870d38bfadd5b8836c73cf7ea8af2abe`).
- Command: `git worktree add -b codex/jsc-464-synaipse-slice5-canonical-replay /private/tmp/coding-harness-jsc464-slice5-canonical-v1 4b9c2abe870d38bfadd5b8836c73cf7ea8af2abe` -> pass (fresh isolated worktree and local branch created).
- Command: tracked S5/control `git diff --binary HEAD -- <paths> | git apply --check -` -> pass (no replay conflict on current main).
- Command: `git diff --cached --quiet` -> pass (destination index is empty).
- Command: `git diff --check` -> pass (no replay whitespace errors before this artifact).
- Command: `pnpm install --offline --frozen-lockfile` -> fail (all 458
  packages were reused from the local store with zero downloads, but the
  lifecycle step could not chmod `tools/source-harness-bin/cli.js` and could
  not create the optional Vale shim; tracked files remained unchanged and the
  required Vitest and markdownlint shims are executable).
- Command: `pnpm docs:lint` -> pass (569 Markdown files; zero errors).
- Command: `pnpm docs:lifecycle` -> pass (32 governed documents).
- Command: `pnpm harness:audit-tracking` -> pass (tracked audit contract
  verified).
- Command: `pnpm exec vitest run src/lib/synaipse/packet-consolidation.test.ts src/commands/next-agent-native-ratchets.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts src/dev/write-agent-native-ratchet-report-script.test.ts --reporter=dot` -> pass (four focused files and 85 tests on the current-main replay).
- Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json`
  -> pass (zero errors, one advisory archive-candidate warning, and four
  informational findings; no tooling, security, or architecture authority
  warning remains in the isolated S5 candidate).

The install lifecycle failure is an environment/tooling limitation for a
fully materialized dependency projection. It did not prevent the narrow replay
proof and is not classified as a Slice 5 behavior failure. Aggregate and deep
validation remain outside this checkpoint.

## Claims Boundary

This artifact proves only non-destructive isolation onto current main. It does
not prove canonical-record completion, mechanical consumer migration,
retirement evidence, outcome measurement, aggregate validation, downstream
canaries, independent review, hosted CI, acceptance, release, merge readiness,
or Slice 5 completion. Nothing is staged, committed, pushed, or merged.
