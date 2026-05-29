## Agent-Native Architecture Review

### Summary
This PU-039 slice introduces an explicit historical review-coverage ledger, a dedicated validator script, and focused regression tests for PU-001..PU-016. The design preserves non-fabrication constraints by allowing `not applicable` entries with accepted exceptions, and it keeps final readiness lanes separated from local implementation truth. Overall agent-native parity is strong for this scope because agents can read, validate, and reason over the same tracked artifacts users use.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Update historical review-coverage ledger for PU-001..PU-016 | docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json | File edit + validator script | Yes (state lane references artifact and validator) | Must have | Covered |
| Validate backfill ledger shape, member coverage, and evidence refs | scripts/check-goal-review-backfill.py | python3 script invocation | Yes (state lane includes exact command) | Must have | Covered |
| Verify regression behavior for validator failure modes | src/dev/check-goal-review-backfill-script.test.ts | pnpm vitest | Partial (via repo test conventions) | Should have | Covered |
| Discover closeout dependency for historical backfill | docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml | Read goal board state | Yes | Must have | Covered |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
1. **Backfill validator is not yet wired into an always-run goal gate** -- `scripts/check-goal-board.py` (no `review-coverage-backfill` or `check-goal-review-backfill` references found via `rg -n \"historical_backfill_validator|review-coverage-backfill|check-goal-review-backfill\" scripts/check-goal-board.py`) and [state.yaml](/private/tmp/coding-harness-jsc363-review-backfill/docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml:112).
Impacted behavior: future agents can discover the command from goal state, but automated closeout paths that only run goal-board checks can miss a stale/broken backfill ledger unless they separately execute the standalone validator.
Remediation: invoke the backfill validator from the goal-board validation flow (or an equivalent required gate) whenever `historical_backfill_required_before_goal_closeout: true` is set.
Confidence: 0.86
Validation ownership: introduced by current patch.

#### Observations
1. The non-fabrication posture is enforced correctly: pass requires current evidence (`freshness: current` + resolvable `evidenceRef`) and non-pass requires reason + owner/accepted exception in [check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:170), [check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:181), and [check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:187).
2. Tests cover the core negative paths needed for durable usage by future agents (missing unit, duplicate unit, missing member, unresolved receipt, missing evidence, stale pass freshness, non-pass owner/exception gap) in [check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:138), [check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:153), and [check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:219).

### What’s Working Well
- Historical ratification is explicit, tracked, and machine-readable.
- The validator fails closed on member coverage and evidence integrity.
- State text preserves truth-lane boundaries and avoids claiming final merge/Linear/Judge completion in this slice.

### Score
- **4/4 high-priority capabilities are agent-accessible**
- **Verdict:** NEEDS WORK (single automation-wiring gap)

### Validation Evidence
- `python3 -m py_compile scripts/check-goal-review-backfill.py` -> pass
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-review-backfill.py docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json --repo .` -> pass
- `pnpm vitest run src/dev/check-goal-review-backfill-script.test.ts --reporter=dot` -> pass (8 tests)

### Accountability Receipt
- status: completed_with_warning
- manifest_path: n/a (no run-manifest template present in this worktree for this reviewer task)
- artifact_paths:
  - artifacts/reviews/pu-039-review-coverage-backfill-agent-native.md
- findings:
  - warning: backfill validator not yet wired into always-run goal gate
- failures_or_blockers:
  - none for reviewer execution
- improvement_opportunities:
  - enforce `historical_backfill_validator` via required goal-board/closeout gate path
- strengths:
  - strict evidence-reference validation and non-fabrication guardrails
  - clear separation of readiness lanes in goal state
- validation_evidence:
  - local py_compile, direct validator run, focused vitest run all passing
- next_action:
  - coordinator should decide whether to accept this as a follow-up hardening task or patch now before closeout
- useful_findings:
  - 1
- avoided_false_positive:
  - did not flag intentional pre-R064 `not applicable` ratification as missing parity
- evidence_quality:
  - high (direct file/line evidence + command receipts)
- followed_scope:
  - yes (review limited to PU-039 listed files)
- reusable_learning:
  - standalone validators that gate closeout should be wired into required closeout/board execution paths
- coordinator_score:
  - 0.9

WROTE: artifacts/reviews/pu-039-review-coverage-backfill-agent-native.md
