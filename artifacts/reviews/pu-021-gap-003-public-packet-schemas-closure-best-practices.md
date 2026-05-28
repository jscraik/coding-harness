# PU-021 GAP-003 Closure Review (Best Practices)

## Findings (severity-ranked)

1. **Severity: none (material pass)**
Evidence: `scripts/validate-runtime-packet-schemas.cjs:112-128`, `scripts/validate-runtime-packet-schemas.cjs:381`, `src/dev/validate-runtime-packet-schemas-script.test.ts:180-224`, command `node scripts/validate-runtime-packet-schemas.cjs --all`, command `pnpm vitest run src/dev/validate-runtime-packet-schemas-script.test.ts`.
Impacted behavior: The prior bypass (unsupported keyword hidden behind local sibling `$ref`) is now covered; referenced schemas are recursively scanned for unsupported keywords, and a regression test fails on referenced `oneOf`.
Remediation: No further remediation required for the reported GAP-003 bypass.
Confidence: high.
Validation ownership: introduced by current patch and verified fixed.

## Remaining Material Issues Before Local Validation

- None identified.
- Verdict: **No remaining material issue blocks marking PU-021 GAP-003 locally validated**.

## Residual Risk (non-blocking)

- `validateSupportedSchemaKeywords` currently skips recursion for fragment-only refs (`$ref: "#/..."`) by design (`scripts/validate-runtime-packet-schemas.cjs:116`). Current packet schemas do not use fragment refs (searched contracts), so this is not a present blocker. Consider adding fragment-ref traversal if internal schema composition is introduced later.

## Accountability Receipt

- status: complete
- artifact_paths:
  - artifacts/reviews/pu-021-gap-003-public-packet-schemas-closure-best-practices.md
- manifest_path: artifacts/agent-runs/best-practices-researcher-019e6871-4ead-7df0-8ec0-b1da86cf7944/manifest.json
- findings:
  - useful_findings: confirmed previously reported local-sibling-ref bypass is fixed and regression-tested.
  - avoided_false_positive: did not escalate fragment-ref handling as blocker because no fragment refs are present in current packet schemas.
  - evidence_quality: direct code-path evidence + independent command reruns with pass outputs.
  - followed_scope: limited to validator script, tests, and runtime packet schema surfaces.
  - reusable_learning: when schema validator supports only a keyword subset, recurse through referenced schema files during keyword auditing and keep a regression fixture for hidden unsupported keywords.
  - coordinator_score: high (clear closure signal with independent repro evidence).
- failures_or_blockers: none
- improvement_opportunities:
  - optional hardening: add fragment `#/...` resolver in supported-keyword scan for future-proofing.
- strengths:
  - recursion guard (`visitedRefs`) prevents cycles while expanding scan coverage.
  - focused regression test directly encodes prior escape vector.
- validation_evidence:
  - `node scripts/validate-runtime-packet-schemas.cjs --all` => pass, exit 0
  - `pnpm vitest run src/dev/validate-runtime-packet-schemas-script.test.ts` => 8 passed, exit 0
- next_action:
  - Coordinator may treat PU-021 GAP-003 as locally validated and proceed with broader lane checks only.

WROTE: artifacts/reviews/pu-021-gap-003-public-packet-schemas-closure-best-practices.md
