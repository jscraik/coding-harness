# PU-019 GAP-008 Context Health Intent Best-Practices Review

## Scope
- Intent reviewed: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json`
- Supporting sources reviewed:
  - `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`
  - `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`
  - `src/lib/agent-readiness/**`
  - `src/commands/context-health.ts`

## Verdict
- Status: **approve_with_changes**
- Summary: The amended intent is directionally correct and now explicitly avoids re-implementing the existing `context-health` engine. Remaining issues are mostly contract-tightening and compatibility clarity, not architecture blockers.

## Severity-Ranked Findings

### 1) MEDIUM - Schema overlap risk remains underspecified for consumers
- Severity: MEDIUM
- Evidence:
  - `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:49` (new `agent-readiness-context-health/v1` projection)
  - `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:71` (suggests `context-health` refresh command)
  - `src/commands/context-health.ts:85` (`context-health-report/v1` canonical report)
  - `src/lib/agent-readiness/types.ts:39` (current `agent-readiness/v1` top-level contract)
- Impacted behavior:
  - Downstream automation can misinterpret the new projection as a second source of truth unless field names, ownership, and precedence are explicit.
- Remediation:
  - Add a required acceptance bullet and doc note that `agent-readiness-context-health/v1` is advisory projection-only, while `context-health-report/v1` remains canonical for context-integrity artifacts.
  - Include one explicit non-goal: no contradiction-history, coverage-rate, or inventory metrics in the projection.
- Confidence: High
- Validation ownership: introduced by current patch (intent contract clarity).

### 2) MEDIUM - Pass/fail semantics for surfaces are not fully deterministic
- Severity: MEDIUM
- Evidence:
  - `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:66` (warnings acceptable for runtime-card and external horizon)
  - `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:72-74` (active route missing -> finding; runtime/external absence -> warning)
  - `src/lib/agent-readiness/checker.ts:44-53` (overall status derived from finding severity)
- Impacted behavior:
  - Without strict mapping, equivalent stale states could flip between warn/fail across runs, making CI and agent decisions less predictable.
- Remediation:
  - Add a normative severity table in intent (surface -> condition -> status), especially for:
    - missing `.harness/active-artifacts.md`
    - referenced route path missing
    - Project Brain memory/knowledge missing
    - runtime-card absent vs stale timestamp
    - external-horizon unobserved vs stale snapshot
- Confidence: High
- Validation ownership: introduced by current patch (determinism gap in acceptance wording).

### 3) LOW - Validation gates do not yet prove projection/canonical non-duplication invariant
- Severity: LOW
- Evidence:
  - `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:79-83` (current gates)
  - `src/commands/context-health.ts:83-104` (rich canonical report structure)
- Impacted behavior:
  - Future refactors may accidentally duplicate heavy logic in `agent-readiness` without a regression test that guards separation.
- Remediation:
  - Add one focused test expectation: `agent-readiness` output contains projection fields and recommendation string, but does not emit `context-health-report/v1` fields (e.g., `artifactRefs`, contradiction metrics).
- Confidence: Medium
- Validation ownership: introduced by current patch (test coverage specificity).

## Strengths Observed
- Clear additive boundary now exists between fast readiness projection and deep context-integrity artifact engine:
  - `.harness/intent/...json:24`
  - `.harness/intent/...json:52`
  - `.harness/intent/...json:64`
- Scope is appropriately local-first and non-networked for first slice:
  - `.harness/intent/...json:65`
- Goal-level GAP-008 alignment is strong:
  - `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:152`
  - `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md:424`

## Improvement Opportunities
- Add explicit projection ownership language to `.harness/core/agent-readiness-contract.md`.
- Add one CLI reference example showing both commands:
  - `harness agent-readiness --json` for preflight advisory context
  - `harness context-health --json` for artifact-grade integrity report

## Validation Evidence
- Command: `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json`
- Command: `nl -ba docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`
- Command: `nl -ba .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`
- Command: `nl -ba src/lib/agent-readiness/types.ts`
- Command: `nl -ba src/lib/agent-readiness/checker.ts`
- Command: `nl -ba src/commands/context-health.ts`
- Command: `rg -n "context-health-report/v1|agent-readiness-context-health/v1|context-health" src`

## Blockers / Uncertainty
- `blocked_local_memory_cli`: could not run required Local Memory CLI bootstrap/search due to permission error writing PID file.
  - Command: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness task:pu-019-gap-008-intent-review" --json`
  - Exact failure: `failed to save PID: failed to write PID file: open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted`
  - Fallback used: repo-local evidence only.

## Accountability Receipt
- status: complete_with_findings
- manifest_path: artifacts/agent-runs/best-practices-researcher-pu-019-gap-008-intent-review/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-019-gap-008-context-health-intent-best-practices.md
- findings:
  - medium: schema overlap precedence needs explicit projection/canonical rule
  - medium: severity mapping for context surfaces needs deterministic table
  - low: add non-duplication regression assertion
- failures_or_blockers:
  - blocked_local_memory_cli (permission denied writing PID under user home)
- improvement_opportunities:
  - tighten agent-readiness contract wording for advisory projection
  - add CLI docs and projection/non-duplication test
- strengths:
  - updated intent already removes the largest duplication risk and aligns with GAP-008
- validation_evidence:
  - line-cited intent, goal, audit, and implementation contract files (see above)
- next_action:
  - coordinator should request a small intent patch that adds explicit projection precedence + deterministic severity matrix before implementation starts
- useful_findings: 3
- avoided_false_positive: did not flag full engine duplication after amended intent introduced explicit context-health command dependency
- evidence_quality: high for repo-local contract alignment; medium for cross-run memory continuity due Local Memory CLI block
- followed_scope: yes (read-only review, no source edits)
- reusable_learning: projection-vs-canonical contract must be explicit whenever two commands expose similarly named health surfaces
- coordinator_score: 8/10

WROTE: artifacts/reviews/pu-019-gap-008-context-health-intent-best-practices.md
