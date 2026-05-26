# GAP-002 Mainline Best-Practices Review

## Scope
- Compared `origin/main...HEAD` for the requested GAP-002 files only.
- Focused on correctness, false-success prevention, agent-native usability, and proof freshness/coverage requirements.

## Findings (Severity-Ordered)

### High: Missing required per-slice reviewer-lens coverage artifacts for closeout contract
- Evidence:
  - `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:225-230` requires post-slice validation with `$simplify`, `$unslopify`, `$he-code-review`, and `$testing`.
  - Only adversarial/agent-native GAP-002 review artifacts are present under `artifacts/reviews/*gap-002*.md` (no GAP-002 artifact proving simplify/unslopify/testing-lens or improve-codebase-architecture coverage).
- Risk:
  - The branch can claim GAP-002 implementation proof while missing part of the updated per-slice contract, creating governance-proof drift.
- Recommendation:
  - Add artifact-backed outputs for the required missing lenses (or explicit `not applicable` artifacts with evidence and rationale) before treating GAP-002 as contract-complete.

### Medium: Residual status-classification ambiguity coverage remains open for mixed payloads
- Evidence:
  - `artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-implementation-adversarial.md:15-20` flags missing tests for conflicting `conclusion` vs `state` combinations.
  - Current tests cover required/optional NEUTRAL/SKIPPED and terminal failures (`src/lib/pr-closeout.test.ts:1199-1378`) but do not explicitly pin contradictory tuples like `conclusion=SUCCESS,state=FAILED`.
- Risk:
  - Provider-specific payload variance can regress claim classification semantics without immediate detection.
- Recommendation:
  - Add one table-driven case that locks expected precedence for contradictory status pairs.

## What is correct in this slice
- Required checks no longer treat `NEUTRAL`/`SKIPPED` as passing evidence (`src/lib/pr-closeout/evidence.ts:20-25`).
- `tests_passed` and `ci_green` now scope evidence to required checks and preserve optional-check diagnostic behavior (`src/lib/pr-closeout/claim-builders.ts:71-143`).
- Regression coverage exists for required/optional NEUTRAL/SKIPPED and terminal CANCELLED/TIMED_OUT states (`src/lib/pr-closeout.test.ts:1199-1378`).

## Validation ownership classification
- `STATUS: blocked_validation`
- Failure text:
  - `pnpm vitest run src/lib/pr-closeout.test.ts -t "required CI conclusions"` failed locally with `ERR_MODULE_NOT_FOUND: Cannot find package vitest`.
- Ownership classification:
  - `environment_or_tooling_failure (pre-existing in this checkout)`
- Coordinator next step:
  - Re-run in an environment with installed workspace deps (or run `pnpm install --frozen-lockfile` in this worktree), then repeat the focused test command and attach output to the slice proof.

## Accountability receipt
- status: findings_reported_with_blocked_validation
- artifact_paths:
  - /private/tmp/coding-harness-gap002-mainline-1779834383152/artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-mainline-best-practices.md
- findings:
  - missing required per-slice lens artifacts (high)
  - missing mixed conclusion/state precedence regression (medium)
- failures_or_blockers:
  - local-memory CLI blocked by PID write permission (`~/.local-memory/local-memory.pid`)
  - local focused vitest execution blocked by missing package in this checkout
- improvement_opportunities:
  - enforce per-slice lens artifact presence with a deterministic validator
  - add contradictory status-pair regression cases
- strengths:
  - core GAP-002 false-success fix is narrow, correctly scoped, and test-backed
  - required-vs-optional check behavior is materially improved for closeout truth
- validation_evidence:
  - source inspection of scoped diffs and artifacts
  - attempted focused vitest run showing missing `vitest` dependency
- next_action:
  - produce missing lens artifacts (or explicit N/A evidence), restore runnable test environment, and rerun focused GAP-002 tests

WROTE: /private/tmp/coding-harness-gap002-mainline-1779834383152/artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-mainline-best-practices.md
