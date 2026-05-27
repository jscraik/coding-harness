# PU-020 GAP-006 Intent Review (Best Practices Researcher)

## Scope
Intent-only review for:
- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json`

Compared against GAP-006 evidence and current policy-gate implementation/tests.

## Findings (Severity-Ordered)

### 1) High - Acceptance criteria under-specifies explicit tracked-exception path called out by GAP-006
- Evidence:
  - GAP-006 expected state requires "block for human approval or require an explicit tracked exception": `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md:332`
  - Recommended fix allows either fail-closed alignment or explicit exception modeling: `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md:348`
  - Intent objective and acceptance criteria focus on fail-closed behavior only and defer exceptions to future slice assumptions: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json:8`, `:72-83`, `:70`
- Impacted behavior:
  - Slice may close as "implemented" for GAP-006 while still not expressing how tracked exceptions are represented or rejected in this lane, risking future policy ambiguity.
- Remediation:
  - Add one acceptance criterion that explicitly states exception behavior for this slice boundary, for example:
    - "This slice does not introduce tracked exception schema; any high-risk pass-through remains unsupported and must fail (or be explicitly blocked as follow-up to GAP-005) with receipt linkage."
- Confidence: high
- Validation ownership: introduced by current patch (intent artifact quality/completeness)

### 2) Medium - Validation gates do not include default-contract path proof beyond unit assertions
- Evidence:
  - Intent changes both repository contract and default contract behavior: `.harness/intent/...-intent.json:51-53`, `:74`
  - Runtime behavior currently passes high risk with no max-tier and with max-tier=high because high maps to warn/pass:
    - `src/commands/policy-gate.ts:103-115`
    - `src/lib/contract/types-core.ts:1462-1472`
    - `harness.contract.json:140-150`
    - `src/commands/policy-gate.test.ts:64-75`, `:79-91`
  - Listed validation gates cover CLI against `harness.contract.json` and vitest file, but no explicit command-level proof for fallback/default path when contract policyChain is omitted: `.harness/intent/...-intent.json:84-90`
- Impacted behavior:
  - Could regress default-chain semantics for newly scaffolded or omitted-policyChain consumers while repository contract path still passes tests.
- Remediation:
  - Add a focused validation command/test criterion for default/fallback policy chain behavior (for example through a fixture missing `policyChain` or a targeted test in `loader.test.ts`/`validator.test.ts`).
- Confidence: medium
- Validation ownership: introduced by current patch (intent validation completeness)

## No Material Blocker On Slice Shape
The slice is otherwise appropriately narrow for GAP-006:
- In-scope is aligned to contract/default policy-chain and policy-gate tests/doc wording: `.harness/intent/...-intent.json:50-57`
- Out-of-scope correctly excludes decision-request and unrelated runtime surfaces: `.harness/intent/...-intent.json:58-64`
- This matches GAP-006 "align contract and policy-gate outcomes" framing: `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md:347-360`

## Strengths
- useful_findings: Strong containment of blast radius with explicit allowed/forbidden file list.
- avoided_false_positive: Did not force decision-request schema expansion into GAP-006 despite GAP-005 adjacency.
- evidence_quality: Line-level acceptance criteria and command list are concrete and testable.
- followed_scope: Maintains narrow governance/validation focus without touching runtime-card or closeout subsystems.
- reusable_learning: Pattern for converting prose safety claims into executable gate assertions is reusable across cockpit governance lanes.
- coordinator_score: 8/10 (clear and scoped; two targeted tightenings recommended)

## Improvement Opportunities
1. Add explicit "no tracked exception support in this slice" acceptance wording with GAP-005 linkage.
2. Add explicit default/fallback policy-chain runtime proof in validation gates.

## Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/best-practices-researcher-2026-05-27T08-00-00Z-019e6835/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-020-gap-006-policy-gate-intent-best-practices.md
- findings:
  - High: acceptance criteria miss explicit tracked-exception boundary statement
  - Medium: validation gates miss explicit default/fallback runtime proof
- failures_or_blockers:
  - Could not locate `agents/templates/review-artifact.md` or `agents/contracts.json` in this checkout (used equivalent manual structure).
- validation_evidence:
  - `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json`
  - `nl -ba .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`
  - `nl -ba src/commands/policy-gate.ts`
  - `nl -ba src/commands/policy-gate.test.ts`
  - `nl -ba src/lib/contract/types-core.ts`
  - `nl -ba harness.contract.json`
- next_action:
  - Tighten the two acceptance/validation items before implementation kickoff, then proceed.

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-intent-best-practices.md
