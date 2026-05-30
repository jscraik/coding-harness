# PU-039 Review Coverage Backfill Improve-Codebase-Architecture Lens

Status: pass

## Scope

Reviewed the PU-039 implementation against the coding-harness deep-module direction: small public surface, deterministic guardrail, artifact-backed truth, and no expansion into unrelated runtime cockpit contracts.

## Findings

- No blocking findings.
- The slice turns a repeated steering failure into an executable guardrail: scripts/check-goal-review-backfill.py validates goal-review-coverage-backfill/v1 instead of relying on prose in the goal board.
- The implementation is intentionally narrow. It adds a standalone validator, a ledger, and focused dev-script tests; it does not add a public command family, delivery-truth semantics, runtime packet production, PR mutation, or Linear mutation.
- The goal-board integration keeps the specialized guard in the existing cockpit validation path: future closeout checks call scripts/check-goal-board.py and get the historical review-coverage verdict without learning another optional command.
- The ledger shape keeps historical truth separate from current enforcement. PU-001 through PU-016 are ratified as pre-R064 work with explicit not applicable results and receipt-backed accepted exceptions, while post-R064 slices still require current per-member evidence.
- Evidence references are structurally bounded: repo-relative paths only, non-zero files only, receipt fragments for pass evidence, mandatory receipt fragments for non-pass accepted exceptions, and exact source receipt mappings per lifecycle unit. Owner-only assertions no longer support historical review coverage. That is a better architecture boundary than allowing free-form text references.

## Architecture Decision

Keep this validator as a script-level goal guard for this PR. A public harness command would be premature because the contract is goal-specific and exists to close a historical JSC-363 lifecycle gap. Promotion into a shared src/lib/goal-assurance/ module requires a separate accepted design decision with a second concrete consumer.

## Validation Evidence

- PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-review-backfill.py docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json --repo . -> pass.
- pnpm vitest run src/dev/check-goal-review-backfill-script.test.ts src/dev/check-goal-board-script.test.ts --reporter=dot -> pass; 2 files, 26 tests.

## Residual Risk

The validator is currently specialized to JSC-363 constants. That is acceptable for this slice because the intent is a bounded historical ratification guard, not a repo-wide lifecycle framework.

WROTE: artifacts/reviews/pu-039-review-coverage-backfill-improve-codebase-architecture.md
