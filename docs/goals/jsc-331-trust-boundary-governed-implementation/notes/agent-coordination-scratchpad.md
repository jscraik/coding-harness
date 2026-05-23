# JSC-331 Trust Boundary Coordination Scratchpad

## Table of Contents

- [Current Governor State](#current-governor-state)
- [Known Dirty Worktree](#known-dirty-worktree)
- [Anti-Loop Notes](#anti-loop-notes)
- [T002 PU-000 Seam Decisions](#t002-pu-000-seam-decisions)
- [T003 PU-001 Strict Adopted-Evidence Closeout](#t003-pu-001-strict-adopted-evidence-closeout)

## Current Governor State

- Active task: T001 governor/scout reconciliation.
- Worker implementation: blocked until T001 records board health and runtime
  readiness.
- Native goal: active in thread 019e5531-8a63-77e1-a799-1d77b5e31d23.
- External mutation: Linear destination-confirmation comment has already been
  posted; further mutation requires explicit user instruction.

## Known Dirty Worktree

- .harness/memory/LEARNINGS.md was pre-existing unrelated local work.
- .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
  was updated during the plan/spec hardening pass.
- package.json and scripts/validate-he-artifacts.sh were updated to add the
  repo-owned HE artifact validation wrapper.
- .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md
  is the active plan artifact.

## Anti-Loop Notes

- Do not retry failing validation more than twice without root-cause
  classification.
- Do not treat missing future validator scripts as proof failure before their
  owning PU creates or routes them.
- Do not treat mailbox-only reviewer messages as coverage proof.

## T002 PU-000 Seam Decisions

Timestamp: 2026-05-23T15:52:06Z.

Selected seams:

- PU-001 stays in `scripts/validate-evidence-patterns.cjs`. The current
  script owns `evidence-patterns-validation/v1`, adopted pattern validation
  commands, target-surface existence checks, and the 0/1 exit contract. It
  does not yet implement `--strict-adopted`; the current command exits 0
  because unknown flags are ignored.
- PU-002 stays in `src/lib/runtime/runtime-evidence-adapter.ts`,
  `src/lib/runtime/local-runtime-card-assembly.ts`, and
  `src/lib/runtime/local-runtime-card.test.ts`.
- PU-003 stays in `src/lib/runtime/local-runtime-card-assembly.ts`, with
  proof in `src/lib/runtime/local-runtime-card.test.ts` and
  `src/commands/runtime-card.test.ts`. The current imported Linear evidence
  comparison uses an exact issue-key match and can drop mixed-case evidence.
- PU-004 should be script-backed first at
  `scripts/validate-audit-references.cjs`. `src/lib/harness-artifact-routine.ts`
  has useful reference-integrity ideas, but it validates a different
  route-driving artifact contract.
- PU-005 should be script-backed first at
  `scripts/validate-reviewer-coverage.cjs`. `src/lib/review-gate/**` is about
  required-check manifests and decision packets, not reviewer swarm artifact
  completeness.

Rejected seams:

- No public CLI commands for PU-004 or PU-005 in the first patch.
- No ignored `artifacts/reviews/reviewer-coverage-manifest.json` as tracked
  fixture proof.
- No historical `artifacts/reviews/` reports as proof for the new reviewer
  coverage receipt.

Review stack result:

- Architecture review: pass; selected seams match current ownership.
- Simplification review: pass; no public CLI expansion or shared abstraction
  before implementation evidence.
- Language cleanup review: pass; missing validators remain implementation targets,
  not proof.
- Ubiquitous language review: pass; status names keep the plan/spec trust
  boundary vocabulary.
- Testing review: pass; each selected seam has a deterministic command or
  fixture path for the next slice.
- Docs review: pass; this receipt records both selected and rejected seams.

## T003 PU-001 Strict Adopted-Evidence Closeout

Timestamp: 2026-05-23T16:16:30Z.

Implementation summary:

- `scripts/validate-evidence-patterns.cjs --strict-adopted --json` now runs
  adopted, `enforcement_backed`, and `implementation_backed` validation
  commands instead of silently ignoring `--strict-adopted`.
- Unknown validator flags now exit 2 with `status: usage`.
- The validator report exposes `strictAdopted`, `statusSummary`,
  `declaredValidationCommand`, and `executedCommand`.
- Non-adopted statuses may omit `validationCommand`; strict executable proof is
  required only for adopted evidence classes.
- `scripts/validate-he-artifacts.sh` now fails closed when git root discovery
  fails and no longer falls back to a Jamie-machine absolute path.

Review findings handled:

- Testing review high: added timeout coverage for adopted validation commands.
- Testing review medium: added alias coverage for legacy `adopted` and
  `rejected` statuses.
- Standards review medium: added this scratchpad Table of Contents.
- Dev-tools review high: removed the non-portable HE validator bundle fallback.
- Dev-tools review medium: allowed non-adopted evidence statuses without
  executable validation commands.
- Simplicity review: retained explicit root/manifest/deep-dir options because
  they keep script behavior testable without mutating real research evidence;
  retained declared/executed command fields because the plan explicitly asks
  to preserve declared validation commands separately from executed commands.

Validation evidence:

- `pnpm vitest run src/dev/validate-evidence-patterns-script.test.ts
  src/dev/validate-he-artifacts-script.test.ts` -> pass.
- `node scripts/validate-evidence-patterns.cjs --strict-adopted --json` ->
  pass; six declared adopted validation commands executed and passed.
- `pnpm he:artifacts:validate .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md
  .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md`
  -> pass.
- `bash scripts/validate-codestyle.sh --fast` -> pass.
- Four review artifacts exist and end with their required `WROTE:` marker.
