# PU-019 GAP-008 Context-Health Best-Practices Review

## Scope
- Reviewed only:
  - src/lib/agent-readiness/context-health.ts
  - src/lib/agent-readiness/types.ts
  - src/lib/agent-readiness/checker.ts
  - src/lib/agent-readiness/cli.ts
  - src/commands/agent-readiness.test.ts
  - .harness/active-artifacts.md
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json
  - Existing artifacts/reviews/pu-019-gap-008-context-health-*.md

## Findings (severity-ranked)

### 1) MEDIUM - Active-route path extraction is prefix-allowlisted and can create false stale warnings
- Severity: medium
- Evidence: src/lib/agent-readiness/context-health.ts:302, src/lib/agent-readiness/context-health.ts:304, src/lib/agent-readiness/context-health.ts:314
- Impacted behavior:
  - `active_route_refs` only recognizes backticked repo-relative refs that start with a fixed prefix set (`.harness/`, `docs/`, `src/`, `scripts/`, `artifacts/`, `AI/`, and a few root files).
  - Valid route refs outside this list (for example `contracts/`, `templates/`, `.github/`, or other tracked repo paths) are silently ignored and can downgrade a healthy route section to warn via "does not contain repo-relative artifact refs."
  - This weakens operator trust in stale-state signals and can increase noisy warnings before agents act.
- Remediation:
  - Replace prefix allowlisting with a broader repo-relative check plus existence test:
    - accept backticked tokens that are relative (not absolute, no URL, no shell operators),
    - normalize and reject traversal outside repo root,
    - optionally filter by tracked-file existence (`git ls-files` or filesystem check) to keep signal quality.
  - Keep current safety posture (no command execution), but avoid hardcoding path families in parser logic.
- Confidence: medium
- Validation ownership: introduced by current patch
- Validation owner: implementation coordinator

## Open Questions / Assumptions
- Assumption: The intent expects `Current Active Route` refs to remain repo-generic rather than constrained to a small fixed path vocabulary.
- No evidence found that this projection duplicates `context-health-report/v1` artifact-grade fields; anti-duplication checks appear covered by tests.

## Strengths Observed
- Orientation-only contract is explicit and consistent:
  - src/lib/agent-readiness/types.ts:60
  - src/lib/agent-readiness/types.ts:90
  - src/lib/agent-readiness/context-health.ts:47
- Canonical deep report ownership is preserved (no artifact-grade duplication):
  - src/lib/agent-readiness/context-health.ts:48
  - src/commands/agent-readiness.test.ts:325
- External horizon is correctly non-claim and non-refreshing from local-only context:
  - src/lib/agent-readiness/context-health.ts:225
  - src/lib/agent-readiness/context-health.ts:244
  - src/commands/agent-readiness.test.ts:296

## Residual Risks
- Surface staleness is presence/structure-based for runtime card and external snapshot; freshness TTL/head-SHA coherence is intentionally out of scope for this slice, so stale-but-present artifacts may still pass orientation checks.

## Validation Evidence Reviewed
- Coordinator-provided evidence accepted:
  - `pnpm vitest run src/commands/agent-readiness.test.ts` (pass)
  - `biome check` on scoped files (pass)
  - `node --import tsx src/cli.ts agent-readiness --repo-root . --json` (pass; warn status expected)
  - `git diff --check` on scoped files (pass)
- Additional review evidence:
  - static source inspection of scoped files with line references above.

## Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/best-practices-researcher-019e681c-f6a6-7e11-b7c8-3bf8ca151f0a/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-019-gap-008-context-health-best-practices-researcher.md
- findings:
  - medium: prefix-allowlisted active-route path parsing can produce false stale warnings
- failures_or_blockers:
  - Missing repository templates/contracts path expected by role policy:
    - agents/templates/review-artifact.md (not found)
    - agents/contracts.json (not found)
  - Continued with explicit structure and evidence because artifact delivery remained possible.
- improvement_opportunities:
  - Generalize route-ref parsing to repo-relative normalization + safe existence checks.
- strengths:
  - Clear orientation-only semantics and anti-duplication guardrails with focused tests.
- validation_evidence:
  - src/lib/agent-readiness/context-health.ts
  - src/lib/agent-readiness/types.ts
  - src/lib/agent-readiness/checker.ts
  - src/lib/agent-readiness/cli.ts
  - src/commands/agent-readiness.test.ts
- next_action:
  - Implement parser broadening for active-route refs and add regression tests for non-allowlisted but valid repo paths.
- useful_findings: 1
- avoided_false_positive:
  - Did not flag external-horizon missing refresh command as a defect; test and intent explicitly require no local command to claim external truth refresh.
- evidence_quality: high
- followed_scope: yes
- reusable_learning:
  - For readiness cockpits, schema boundary tests should include parser acceptance tests for representative repo path classes to prevent structural false warnings.
- coordinator_score: strong

WROTE: artifacts/reviews/pu-019-gap-008-context-health-best-practices-researcher.md
