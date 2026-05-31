## Agent-Native Architecture Review

### Summary
Scoped review covered `scripts/validate-codestyle.sh`, `src/commands/pr-closeout.test.ts`, and `src/dev/check-behavior-tests-script.test.ts` for PR #322 follow-up remediation. This slice is test-and-validator focused (no user-facing UI actions or agent tool-registry edits), and the changes preserve agent-operable behavior by tightening validation semantics while preventing scaffold-hostile fast-lane failures in downstream repos.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Run codestyle fast lane in source repo | scripts/validate-codestyle.sh:166 | harness/codestyle script invocation via CLI | n/a in this diff | Must have | Preserved |
| Run codestyle fast lane in downstream scaffold lacking source-only scripts | scripts/validate-codestyle.sh:173 | same as above | n/a in this diff | Must have | Improved |
| PR closeout release-readiness classification | src/commands/pr-closeout.test.ts:1939 | pr-closeout CLI workflow | n/a in this diff | Must have | Improved |
| PR closeout git-probe env sanitization | src/commands/pr-closeout.test.ts:2949 | pr-closeout CLI workflow | n/a in this diff | Must have | Improved |

### Findings

#### Critical (Must Fix)
1. None.

#### Warnings (Should Fix)
1. None.

#### Observations
1. **Template path mismatch in role contract** -- command evidence: `cat agents/templates/review-artifact.md` returned `No such file or directory`. Suggestion: either add the referenced template/contract files at the documented paths or update role instructions to point to current in-repo locations to avoid reviewer-format drift.
Validation ownership: **pre-existing**.

2. **Local Memory CLI runtime permission failure** -- command evidence: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness/task:pr322-agent-native-review" --json` failed with `failed to write PID file: open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted`. Suggestion: grant writable permission for `/Users/jamiecraik/.local-memory` in this runtime or configure Local Memory PID path inside an allowed writable root.
Validation ownership: **environment or tooling failure**.

### What's Working Well
- The codestyle fast-lane change uses `run_optional_script` only for source-repo-specific quality scripts, which prevents false negatives in downstream harness consumers while keeping source behavior available when scripts exist ([scripts/validate-codestyle.sh](/Users/jamiecraik/dev/coding-harness/scripts/validate-codestyle.sh:173)).
- Release-readiness regression coverage now explicitly captures both explicit `unknown` and omitted flag paths, reducing closure-risk for live closeout readiness claims ([pr-closeout.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/pr-closeout.test.ts:1939)).
- Git environment sanitization coverage now includes inherited caller `GIT_*` contamination and verifies cleanup, strengthening execution isolation ([pr-closeout.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/pr-closeout.test.ts:2949)).
- PATH composition now uses `node:path` delimiter for cross-platform correctness in behavior-test script harnesses ([check-behavior-tests-script.test.ts](/Users/jamiecraik/dev/coding-harness/src/dev/check-behavior-tests-script.test.ts:10)).

### Score
- **4/4 high-priority capabilities are agent-accessible**
- **Verdict:** PASS

### Accountability Receipt
- status: complete
- manifest_path: n/a (single-review artifact run; no manifest contract path present in repo)
- artifact_paths:
  - artifacts/reviews/pr-322-coderabbit-followup-agent-native.md
- findings:
  - no code defects found in scoped diff
  - 2 process/runtime observations (template-path drift, Local Memory PID permission)
- failures_or_blockers:
  - blocked_local_memory_cli: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness/task:pr322-agent-native-review" --json` -> `failed to write PID file ... operation not permitted`
- improvement_opportunities:
  - align reviewer template path contracts with real repository paths
  - provision Local Memory writable PID directory in sandbox profile for reproducible memory bootstrap
- strengths:
  - targeted regressions close real behavior gaps without widening runtime authority
  - validation lanes remain explicit and lane-separated
- validation_evidence:
  - diff inspection: `git diff -- scripts/validate-codestyle.sh src/commands/pr-closeout.test.ts src/dev/check-behavior-tests-script.test.ts`
  - line evidence: `nl -ba ... | sed -n ...` for all scoped files
  - prior-run checks (provided by coordinator): vitest + quality gates + validate-codestyle fast + diff check all pass
- next_action:
  - coordinator can treat this lane as review-complete for agent-native parity and proceed with merge-readiness synthesis

WROTE: artifacts/reviews/pr-322-coderabbit-followup-agent-native.md

---

## Follow-up Delta Re-Review (validate-codestyle source-repo guard)

### Delta Scope
- [validate-codestyle.sh](/Users/jamiecraik/dev/coding-harness/scripts/validate-codestyle.sh)

### Finding Status Update
- Previous parity-risk concern about making source-repo-only quality gates optional is resolved.
- New is_source_harness_repo() and run_source_repo_script() behavior now fails closed for source repo (@brainwav/coding-harness) when quality:behavior-tests, quality:git-env-sanitizer, or harness:audit-tracking are missing, while preserving downstream scaffold compatibility when those scripts are intentionally absent.

### Severity-Ranked Findings (Follow-up Delta)

#### Critical (Must Fix)
1. None.

#### Warnings (Should Fix)
1. None.

#### Observations
1. None in this delta.

### Validation Ownership Classification
- Prior source-repo gate concern: introduced by current patch (now fixed in this follow-up patch).
- No new gate ownership concerns introduced by this delta.

### Evidence
- Diff reviewed: git diff -- scripts/validate-codestyle.sh
- Line evidence: [validate-codestyle.sh](/Users/jamiecraik/dev/coding-harness/scripts/validate-codestyle.sh:80), [validate-codestyle.sh](/Users/jamiecraik/dev/coding-harness/scripts/validate-codestyle.sh:85), [validate-codestyle.sh](/Users/jamiecraik/dev/coding-harness/scripts/validate-codestyle.sh:194)
- Coordinator-reported validation:
  - bash -n scripts/validate-codestyle.sh -> pass
  - bash scripts/validate-codestyle.sh --fast -> pass

### Follow-up Verdict
- PASS for this delta; previous blocking concern does not remain.

WROTE: artifacts/reviews/pr-322-coderabbit-followup-agent-native.md
