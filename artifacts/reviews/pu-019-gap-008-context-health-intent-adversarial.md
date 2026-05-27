# Adversarial Intent Review — PU-019 GAP-008 Context Health

## Findings (Severity-Ranked)

### 1) High — Composition failure: dual context-health classifiers can drift and produce contradictory truth
- Severity: high
- Confidence: 0.82
- Impacted behavior: Agent orientation could disagree between `harness agent-readiness --json` and `harness context-health`, causing inconsistent stale-context decisions across workflow stages.
- Evidence:
  - Trigger: intent requires a new `agent-readiness-context-health/v1` projection and per-surface classifications in agent-readiness rather than explicit reuse of existing context-health engine ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:49](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:49), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:50](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:50), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:52](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:52)).
  - Existing lane already computes policy-bound context integrity, staleness, and artifact-backed metrics in a separate command contract ([src/commands/context-health.ts:85](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.ts:85), [src/commands/context-health.ts:249](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.ts:249), [src/commands/context-health.ts:355](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.ts:355)).
  - Agent-readiness currently has no context-health domain/category and would require parallel logic insertion ([src/lib/agent-readiness/types.ts:5](/Users/jamiecraik/dev/coding-harness/src/lib/agent-readiness/types.ts:5), [src/lib/agent-readiness/checker.ts:37](/Users/jamiecraik/dev/coding-harness/src/lib/agent-readiness/checker.ts:37)).
- Remediation:
  - Add a strict anti-duplication rule to the intent: agent-readiness may only project a summarized view derived from a shared helper used by `context-health` (or from a read-only artifact emitted by it), not reimplement stale/context integrity logic independently.
  - Require one parity test that compares overlapping surface verdicts between both commands for the same fixture repo.
- Validation ownership: introduced by current patch (intent-level design risk).

### 2) High — Cascade: “mandatory fail” context evidence can hard-fail routine readiness and block unrelated work
- Severity: high
- Confidence: 0.76
- Impacted behavior: Repositories that are otherwise operable can become hard-fail on agent-readiness due to missing Project Brain route evidence, triggering repeated preflight/readiness failures and retry churn.
- Evidence:
  - Intent explicitly allows missing Project Brain route evidence to fail ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:66](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:66)).
  - CLI maps any fail finding to exit code 1 ([src/lib/agent-readiness/cli.ts:38](/Users/jamiecraik/dev/coding-harness/src/lib/agent-readiness/cli.ts:38)).
  - Current checker aggregates across categories and escalates overall status from any fail finding ([src/lib/agent-readiness/checker.ts:44](/Users/jamiecraik/dev/coding-harness/src/lib/agent-readiness/checker.ts:44), [src/lib/agent-readiness/checker.ts:384](/Users/jamiecraik/dev/coding-harness/src/lib/agent-readiness/checker.ts:384)).
- Remediation:
  - Tighten intent to define “mandatory fail” only when an explicit `--strict-context` flag is present, otherwise default to warn for missing Project Brain surfaces in generic readiness runs.
  - Add acceptance criterion for backward-compatible exit behavior in non-strict mode.
- Validation ownership: introduced by current patch (intent-level policy risk).

### 3) Medium — Abuse case: suggested deep-refresh command can be non-runnable in target repos, creating dead-end remediation
- Severity: medium
- Confidence: 0.74
- Impacted behavior: Users follow agent-readiness remediation to run `context-health`, but command can fail with bootstrap gaps when `harness.contract.json` or `contextIntegrityPolicy` are absent, leaving no actionable fallback.
- Evidence:
  - Intent requires suggesting existing context-health command as deeper refresh path ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:71](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:71)).
  - context-health hard-requires contract presence and contextIntegrityPolicy, returning bootstrap-gap failures when missing ([src/commands/context-health.ts:111](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.ts:111), [src/commands/context-health.ts:335](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.ts:335), [src/commands/context-health.ts:342](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.ts:342)).
- Remediation:
  - In intent, require remediation suggestions to be conditional: emit `context-health` only when contract prerequisites are detected; otherwise emit a bootstrap command/fix path first.
  - Add one focused test for fallback recommendation when context-health prerequisites are absent.
- Validation ownership: introduced by current patch (intent-to-runtime contract mismatch).

## Residual Risks
- The updated intent reduces direct duplication risk by naming context-health as canonical deep lane, but still lacks an explicit shared-logic/parity constraint, so divergence remains plausible.
- “Orientation-only warning” semantics are stated, but no explicit non-blocking compatibility criterion is defined for existing automation consumers.

## Testing Gaps
- Missing parity fixture test between agent-readiness context projection and context-health overlapping signals.
- Missing strict-vs-default exit-behavior test for context-health-induced fail paths.
- Missing recommendation fallback test when context-health prerequisites are not met.

## Accountability Receipt
- status: completed
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e66f2-6bf0-7933-bd7c-2e14cb5bd4b1/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-019-gap-008-context-health-intent-adversarial.md
- findings:
  - useful_findings: 3
  - avoided_false_positive: did not flag security/perf/style-only concerns outside adversarial scope
- failures_or_blockers:
  - expected template/contract paths from role policy not found in checkout: `agents/templates/review-artifact.md`, `agents/contracts.json`
  - local-memory CLI commands returned no visible JSON output in this run, so no durable memory evidence was incorporated
- improvement_opportunities:
  - Add intent-level “shared classifier” requirement and parity test
  - Add strict/non-strict fail policy for context-health in agent-readiness
  - Add prerequisite-aware remediation suggestions
- strengths:
  - intent now explicitly acknowledges existing `context-health` command and narrows duplication
  - scope/out-of-scope boundaries remain concrete and implementation-directed
- validation_evidence:
  - `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json`
  - `nl -ba src/lib/agent-readiness/types.ts`
  - `nl -ba src/lib/agent-readiness/checker.ts`
  - `nl -ba src/lib/agent-readiness/cli.ts`
  - `nl -ba src/commands/context-health.ts`
  - `rg -n "context-health|context health|contextHealth|agent-readiness-context-health|context-health-report" src`
- next_action:
  - Update PU-019 intent acceptance criteria with shared-logic parity and compatibility guards before implementation branch starts
- evidence_quality:
  - high for cited code-path behavior; medium for downstream orchestration impact projections
- followed_scope:
  - read-only review of intent and referenced code paths only
- reusable_learning:
  - when adding lightweight projections around existing heavy commands, enforce shared-source truth + parity tests to prevent lane drift
- coordinator_score:
  - 8/10 (clear updated context signal and bounded remit)

WROTE: artifacts/reviews/pu-019-gap-008-context-health-intent-adversarial.md
