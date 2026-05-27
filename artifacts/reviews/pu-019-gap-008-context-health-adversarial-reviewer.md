# Adversarial Review - PU-019 GAP-008 Context Health

## Scope
- src/lib/agent-readiness/context-health.ts
- src/lib/agent-readiness/types.ts
- src/lib/agent-readiness/checker.ts
- src/lib/agent-readiness/cli.ts
- src/commands/agent-readiness.test.ts
- .harness/active-artifacts.md
- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json

## Depth Calibration
- Size estimate: Standard-depth review (>=50 logical changed lines across scoped files, excluding generated assets).
- Risk signals: state freshness, local-vs-external truth boundaries, readiness orchestration behavior.
- Techniques applied: assumption violation, composition failures, abuse cases, cascade construction.

## Findings
- No blocking adversarial findings with confidence >=75.
- Validation ownership classification for observed warnings/risk surfaces: introduced-by-design in current patch and intentionally orientation-only (not gate-fail).

## Residual Risks
1. Local artifact-name drift can produce false stale warnings.
- Severity: low
- Evidence: src/lib/agent-readiness/context-health.ts:204, src/lib/agent-readiness/context-health.ts:228
- Impacted behavior: If downstream teams write runtime/external snapshots to non-listed paths, the projection warns even when equivalent evidence exists.
- Remediation: Keep path allowlists synchronized with canonical producer outputs; consider centralizing known artifact locations in one shared constant contract.
- Confidence: 75
- Validation ownership: pre-existing contract fragility (surface-catalog drift risk), not a regression specific to this slice.
- Validation owner: human

2. Heading-shape dependence can classify active route as stale when section semantics are present but formatted differently.
- Severity: low
- Evidence: src/lib/agent-readiness/context-health.ts:274, src/lib/agent-readiness/context-health.ts:281
- Impacted behavior: Non-exact markdown heading structure (for example alternate heading depth) can trigger warn status and reduce trust in projection signal.
- Remediation: Parse heading structure more flexibly or validate against a markdown schema for active-artifacts.
- Confidence: 75
- Validation ownership: pre-existing format-coupling risk amplified by new projection usage.
- Validation owner: human

## Improvement Opportunities
- Add one negative test for alternate-but-valid active-artifacts heading formats to define whether strict heading matching is intended policy.
- Add one compatibility test that proves projection still behaves when runtime/external snapshot producers move to a newly canonical path alias.

## Strengths
- Projection correctly labels context surfaces as `evidenceUse: "orientation"` and preserves deep report authority in `context-health-report/v1`.
- External horizon surface avoids prescribing local refresh commands, reducing false implication that local checks refresh remote truth.
- CLI behavior remains additive and non-breaking (`warn` exits 0; `fail` exits 1; usage errors exit 2).

## Validation Evidence
- Coordinator-provided validations were reviewed as passing:
  - `pnpm vitest run src/commands/agent-readiness.test.ts`
  - `biome check` on scoped files
  - `node --import tsx src/cli.ts agent-readiness --repo-root . --json`
  - `git diff --check` on scoped files
- Reviewer reproduction actions:
  - Read scoped files with numbered evidence lines.
  - Inspected scoped diff for intent alignment and local truth boundaries.

## Accountability Receipt
- status: completed
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e681c-f302-7f21-bdf8-c1495d394c46/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-019-gap-008-context-health-adversarial-reviewer.md
- findings:
  - useful_findings: 2 low-severity residual fragility risks, 0 blocking findings
  - avoided_false_positive: did not classify intentional orientation-only warnings as regressions
  - evidence_quality: line-specific code references and scoped diff review
  - followed_scope: yes
  - reusable_learning: keep artifact-path catalogs centralized to prevent stale-signal drift
  - coordinator_score: high-confidence no-block review with explicit residual risk boundaries
- failures_or_blockers: none
- improvement_opportunities:
  - flexible heading parsing policy test
  - path-catalog compatibility test
- strengths:
  - clear orientation-vs-canonical boundary
  - additive CLI contract preservation
- validation_evidence:
  - scoped file inspection with line evidence
  - coordinator validation receipts consumed
- next_action: proceed with implementation review synthesis; no blocker from adversarial lane

WROTE: artifacts/reviews/pu-019-gap-008-context-health-adversarial-reviewer.md
