## Agent-Native Architecture Review

### Summary
This slice promotes a durable CircleCI credential-recovery rule into Project Brain and threads it through route-truth artifacts. Agent integration for this slice is document/procedure based (no UI/tool code changes), and parity is mostly preserved: future agents can discover the rule in CI knowledge and are explicitly told to keep CI/PR/tracker/closeout lanes separate. Overall verdict: **NEEDS WORK (minor)** because one wording inconsistency can weaken deterministic agent retrieval.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Retrieve CircleCI credential-recovery policy | .harness/knowledge/ci/rules.md | N/A (procedure artifact) | Yes (state + receipts + active artifacts reference it) | Must | Pass |
| Distinguish missing creds vs unreadable env surface/FIFO | .harness/knowledge/ci/rules.md | N/A (procedure artifact) | Yes | Must | Pass |
| Preserve claim-lane separation (CI vs tracker vs merge vs completion) | state.yaml + receipts + active-artifacts | N/A (governance contract) | Yes | Must | Pass |
| Locate exact env surface path to execute recovery | active-artifacts/state/receipts references | N/A | Partially | Should | Warning |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
1. **Env-surface path representation is inconsistent across retrieval surfaces** -- `.harness/active-artifacts.md:27`, `.harness/active-artifacts.md:42`, `docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml:92`, `docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl:196` -- The durable CI rule uses literal `~/.codex/.env` (`.harness/knowledge/ci/rules.md:8-22`), but other high-salience route-truth surfaces use `<REDACTED_HOME_PATH>/.codex/.env`. This can cause an agent to copy a placeholder instead of an executable path when triaging quickly from route artifacts.
Fix now: add one canonical normalization sentence in each placeholder-bearing surface: "`<REDACTED_HOME_PATH>/.codex/.env` maps to `~/.codex/.env` for local command execution."
Impacted behavior: agent may fail first-attempt retrieval/execution in a failing CircleCI lane.
Confidence: 75
Validation ownership: introduced by current patch (this slice added the new route-truth wording).

#### Observations
1. **Agent-native closure boundaries are well preserved** -- `state.yaml:70`, `state.yaml:93-95`, and receipt narratives keep CI pass, tracker refresh, merge readiness, Judge/PM readiness, and final completion explicitly separate. This reduces false "done" claims.
2. **Rule discoverability is improved** -- `.harness/knowledge/INDEX.md:10,21` now points future agents directly to CI rule promotion, reducing reliance on chat memory.

### Commit Readiness
- Commit after remediating the warning above.
- If warning is deferred, classify as a known retrieval-risk and assign follow-up owner; do not treat as blocker for this limited memory-rule slice.

### What's Working Well
- Durable promotion into Project Brain CI rules with clear "must" severity.
- Explicit no-secret-printing constraint is present where the rule is defined.
- FIFO/no-writer and unreadable env-surface classification is preserved as distinct from missing credentials.

### Score
- **3/4 high-priority capabilities are fully agent-accessible**
- **Verdict:** NEEDS WORK

## Accountability Receipt
- status: completed_with_findings
- manifest_path: not_written_for_single-review-artifact-slice
- artifact_paths:
  - artifacts/reviews/pu-045-circleci-env-project-brain-agent-native.md
- findings:
  - warning: placeholder vs executable env-path inconsistency across retrieval surfaces
- failures_or_blockers:
  - `agents/templates/review-artifact.md` not found in target worktree; used required output contract structure directly.
- improvement_opportunities:
  - normalize executable-path alias wording across all route-truth mirrors
- strengths:
  - strong lane separation language and durable CI-rule indexing
- validation_evidence:
  - `nl -ba .harness/knowledge/ci/rules.md`
  - `nl -ba .harness/knowledge/INDEX.md`
  - `nl -ba .harness/active-artifacts.md`
  - `rg -n "PU-045|CircleCI|\\.codex/\\.env|tracker|merge|Judge|completion|claim" docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml`
  - `rg -n "PU-045|CircleCI|\\.codex/\\.env|tracker|merge|Judge|completion|claim|R-001" docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl`
- next_action:
  - add canonical mapping note from `<REDACTED_HOME_PATH>` to `~` in placeholder-bearing route-truth surfaces.

WROTE: artifacts/reviews/pu-045-circleci-env-project-brain-agent-native.md
