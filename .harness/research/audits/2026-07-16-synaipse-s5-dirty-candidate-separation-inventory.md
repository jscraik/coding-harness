---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: synaipse-s5-dirty-candidate-separation-inventory-2026-07-16
artifact_type: research-audit
canonical_slug: synaipse-s5-dirty-candidate-separation-inventory
title: SynAIpse S5 Dirty Candidate Separation Inventory
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
  - docs/plans/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-plan.md
  - docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
  - .harness/implementation-notes/2026-07-15-synaipse-slice5-packet-consolidation.md
validated_by:
  - git status --porcelain=v1
  - git diff --cached --quiet
  - pnpm docs:lint
  - pnpm docs:lifecycle
  - pnpm harness:audit-tracking
---

# SynAIpse S5 Dirty Candidate Separation Inventory

## Boundary and method

This is the first bounded transition after the supervisor accepted the S5
gates 1–9 backbrief. It records ownership without mutating, staging, rebasing,
stashing, deleting, or rewriting the existing candidate. The inventory is
path-deterministic first and hunk-deterministic where a path contains more
than one authority surface.

The complete dirty worktree contained 52 paths at the start of this transition
and contains 53 paths including this inventory itself. The inventory is
self-excluded from all counts and hashes below. The 47-path S5 candidate is the
complete pre-inventory set after excluding the three supervisor-owned control
documents and the two pre-existing review artifacts. The current content digest
is not reused: the prior digest was invalidated when the supervisor changed the
controlling audit, specification, and plan documents.

## Exact inventory evidence

- Worktree: `/private/tmp/coding-harness-jsc464-slice5-v3`
- Branch: `codex/jsc-464-synaipse-slice5-packet-consolidation-recovery`
- HEAD: `00aa738649d532c33570ff08f9c082ff7ac05175`
- Local `origin/main`: `4b9c2abe870d38bfadd5b8836c73cf7ea8af2abe`
- Full path-set SHA-256: `84b6ad8bfbf04c7bbf2c81fa19ba271e63e59e2e77847855691e8c430bcc0234`
- 47-path candidate path-set SHA-256: `581811ff47d17ce9548da5bfeffdb23d83d5572ae4914d31a4c9865a8365d1f8`
- 12-path S5-exclusive path-set SHA-256: `9699a9e4c3e9e20d38785753284cc457c8569dc8af4fe84af80bfc15c84bd1f5`
- 34-path adjacent-exclusive path-set SHA-256: `408f893c3720f8f8fef6855634ca1a73e6cb90ae9fed5130b7dfab65a1a8d90f`
- Current path count excluding this inventory: 52
- Current path count including this inventory: 53
- Candidate path count after exclusions: 47
- Real index: empty

The path-set hashes are over the sorted path names emitted by the following
read-only commands; they do not authorize deletion or delivery:

```text
git status --porcelain=v1 | sed -E 's/^.. //' | rg -v '^\.harness/research/audits/2026-07-16-synaipse-s5-dirty-candidate-separation-inventory\.md$' | LC_ALL=C sort | shasum -a 256
git status --porcelain=v1 | sed -E 's/^.. //' | rg -v '^(\.harness/research/audits/2026-07-11-synaipse-consolidation-and-codex-boundary-audit\.md|docs/plans/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-plan\.md|docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec\.md|\.harness/review/|\.harness/research/audits/2026-07-16-synaipse-s5-dirty-candidate-separation-inventory\.md$)' | LC_ALL=C sort | shasum -a 256
git diff --cached --quiet
```

## Counts by ownership class

| Class | Exclusive paths | Shared paths | Meaning |
| --- | ---: | ---: | --- |
| (a) JSC-464 S5 canonical packet-consolidation core | 12 | 1 | Packet registry, source provenance, full-SHA producer/schema proof, packet projections, and the S5 implementation note’s S5-owned sections. |
| (b) Adjacent npm audit/backend and runtime/tooling repair | 34 | 1 | Bulk-advisory client, registry/auth policy, timeout wrapper, package/CI/codestyle/eval routing, Local Memory/node-missing fallback classification, transient cleanup retry, and their tests. |
| (c) Supervisor-owned audit/spec/plan controls | 3 | 0 | The reconciled audit, canonical specification, and implementation plan. These bytes are preserved and excluded from the 47-path candidate digest. |
| (d) Review/evidence artifacts | 2 | 0 | The two earlier adversarial-review artifacts. They are preserved but excluded from the candidate digest. |

The shared path is the existing Slice 5 implementation note. Its hunk/section
ownership is recorded below; it is not assigned wholesale by convenience.

## (a) JSC-464 S5 canonical packet-consolidation core

Exclusive paths:

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

Shared S5-owned sections in the implementation note:

```text
Scope
Implemented Boundary
P1 Provenance Repair
Pattern Scope
Repair Stage Arc
Leak Guard
Validation Notes
P1 Repair Proof
Post-Repair Validation
Full-SHA Contract Repair
Four-Finding Contract Repair (packet-contract findings and focused proof only)
Final Local Validation And Limits (packet-only proof and claims limits only)
```

## (b) Adjacent npm audit/backend and runtime/tooling repair

Exclusive paths:

```text
.circleci/config.yml
CODESTYLE.md
Makefile
codestyle/05-quality-security-ops.md
codestyle/08-typescript.md
codestyle/09-web.md
codestyle/10-shell-bash-zsh.md
codestyle/11-package-managers-pnpm-npm.md
codestyle/12-swift.md
codestyle/13-git-workflow.md
codestyle/17-testing.md
codestyle/19-development-workflow.md
codestyle/CHECKSUMS.sha256
coding-policy.json
docs/architecture/validation-gate-graph.json
evals/scenarios/north-star-agent-delivery/registry.json
package.json
scripts/check
scripts/codex-preflight.sh
scripts/run-audit-with-timeout.sh
scripts/run-harness-evals.mjs
src/commands/review-context.test.ts
src/commands/validation-plan.test.ts
src/dev/codex-preflight-script.test.ts
src/dev/package-files-quality-scripts.test.ts
src/dev/validate-coding-policy-script.test.ts
src/dev/validate-prompt-context-drift-script.test.ts
src/lib/learnings/validation-plan.ts
scripts/lib/npm-bulk-audit-client.mjs
scripts/lib/npm-bulk-audit-policy.mjs
scripts/lib/npm-registry-config.mjs
scripts/lib/run-command-with-timeout.mjs
scripts/npm-bulk-audit.mjs
src/dev/npm-bulk-audit-script.test.ts
```

The backend hunk in `package.json` is the packaged script allow-list and audit
command routing. The backend hunk in `scripts/run-audit-with-timeout.sh` is the
external/portable timeout and process-group cleanup path. The backend hunk in
`scripts/run-harness-evals.mjs` is the validation-plan command assertion. These
are backend-owned seams, not packet-consolidation proof.

The three runtime/tooling repairs called out by the supervisor are adjacent
exclusive hunks: `scripts/codex-preflight.sh` only classifies the Local
Memory/node-missing blocked fallback; `src/dev/codex-preflight-script.test.ts`
only refactors the tool-path fixture for that fallback; and
`src/dev/validate-prompt-context-drift-script.test.ts` only retries transient
`ENOTEMPTY`/`EBUSY` cleanup. None of these hunks owns packet production,
canonical-record completion, or retirement evidence.

Shared backend-owned sections in the implementation note:

```text
Security Validation Backend
Audit Inventory And Scoped Registry Repair
Security Backend Proof
Recovery Review Repairs
External Timeout Escalation Repair
Audit Runtime Resolution And Policy Repair
Four-Finding Contract Repair (audit-routing finding and mixed backend proof)
Final Local Validation And Limits (audit, runtime, environment, and cleanup proof)
```

## (c) Supervisor-owned controls

These three modified paths are preserved exactly and excluded from the
47-path candidate classification:

```text
.harness/research/audits/2026-07-11-synaipse-consolidation-and-codex-boundary-audit.md
docs/plans/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-plan.md
docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
```

## (d) Review/evidence artifacts

These two artifacts are preserved exactly and excluded from the candidate
classification and any future content digest until a fresh review is run:

```text
.harness/review/2026-07-15-JSC-464-synaipse-slice5-recovery-full-diff-adversarial-review.md
.harness/review/2026-07-16-JSC-464-synaipse-slice5-full-sha-timeout-runtime-selection-policy-repair-adversarial-review.md
```

## Shared-seam and next-boundary decision

The implementation note is the only path with genuine cross-class ownership.
Its packet sections and backend sections are named above. The next S5-only
candidate boundary must retain the implementation note’s S5 sections, carry
the backend sections as a separately named proof lane, and exclude the 34
adjacent-only paths from packet-consolidation digest and retirement evidence.

The eventual final QA digest is broader than this historical 47-path
classification: it must include every audit/spec/plan control, inventory,
S5-owned implementation-note section, and S5 code byte intended to ship. It
excludes only the preserved stale review artifacts and the isolated adjacent
runtime/tooling/audit lane; supervisor-owned controls are included whenever
they are part of the intended-to-ship candidate.

No path is assigned to S5 merely because it is a registry string, test seam,
or command label. Conversely, no backend path is treated as packet proof just
because it appears in `pnpm check` or a shared implementation note.

## Validation and claims boundary

- Command: `git status --porcelain=v1` -> pass (53 paths including this inventory; 52 paths after self-exclusion).
- Command: `git diff --cached --quiet` -> pass (no bytes staged).
- Command: `pnpm docs:lint` -> pass (current transition run; 0 markdownlint errors).
- Command: `pnpm docs:lifecycle` -> pass (current transition run; 32 governed docs).
- Command: `pnpm harness:audit-tracking` -> pass (current transition run; governed audit tracking verified).
- Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> warn/exit 10 (0 errors, 4 warnings, 6 info; frontmatter and lifecycle metadata errors are cleared; required tooling/runtime and architecture authority surfaces remain warnings, along with the repository's six advisory archive-candidate warnings).

The earlier content digest and independent review are stale because the three
controlling documents changed. This inventory is an ownership receipt only. It
does not prove gates 1–9, canonical-record completion, npm audit completion,
CI, review convergence, retirement safety, delivery readiness, or Slice 5
completion.

## Proposed next S5-only candidate

1. Preserve this inventory and the three supervisor controls.
2. Keep the 34 adjacent-only paths in a separately named audit/runtime/tooling
   proof lane.
3. Work only on the 12 S5-exclusive paths plus the S5-owned implementation-
   note sections.
4. Do not begin gates 1–6 code repair until the next candidate digest excludes
   adjacent-only paths and the canonical-record, inventory, current-SHA, and
   measurement owners are explicit.
5. Re-run the aggregate docs gate after substantive authority-document
   reconciliation or after the backend lane is isolated.
