## Agent-Native Architecture Review

### Summary
Scoped re-review confirms the prior semantic-bypass class is closed for `decision-request/v1` within the runtime packet schema validation lane: manifest wiring now invokes a dedicated semantic validator, and claim-sensitive HILT boundary constraints are enforced consistently between runtime builder logic and external schema/example validation. No new material parity gaps were found in the reviewed scope.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Request decision boundary with claim-sensitive HILT semantics | src/commands/decision-request.test.ts:8 | harness decision-request command + builder | n/a (CLI contract) | Must-have | Covered |
| Validate runtime packet schema + semantic constraints | scripts/validate-runtime-packet-schemas.cjs:564 | validate-runtime-packet-schemas script + semanticValidatorPath execution | n/a (validator lane) | Must-have | Covered |

### Findings

#### Critical (Must Fix)
1. None.

#### Warnings (Should Fix)
1. None.

#### Observations
1. Local Memory CLI workflow could not run in this sandbox due PID write permissions outside workspace (`/Users/jamiecraik/.local-memory/local-memory.pid`), so this review is based on repo evidence plus targeted tests only. Evidence: command failure output from `local-memory bootstrap ... --json` and `local-memory search ... --json`.

### Evidence Review (Scoped)

- **Semantic validator exists and encodes claim-sensitive constraints**: [scripts/validate-decision-request.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-decision-request.cjs:18), [scripts/validate-decision-request.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-decision-request.cjs:128), [scripts/validate-decision-request.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-decision-request.cjs:137)
- **Manifest wiring executes semantic validation for decision-request**: [contracts/runtime-packet-schemas.manifest.json](/Users/jamiecraik/dev/coding-harness/contracts/runtime-packet-schemas.manifest.json:75), [scripts/validate-runtime-packet-schemas.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-runtime-packet-schemas.cjs:564), [scripts/validate-runtime-packet-schemas.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-runtime-packet-schemas.cjs:580)
- **Path safety for semantic validator execution is enforced**: [scripts/validate-runtime-packet-schemas.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-runtime-packet-schemas.cjs:68), [scripts/validate-runtime-packet-schemas.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-runtime-packet-schemas.cjs:502)
- **Runtime builder parity with semantic validator**:
  - claim-sensitive boundaries set matches: [src/lib/decision-request/hilt-boundary.ts](/Users/jamiecraik/dev/coding-harness/src/lib/decision-request/hilt-boundary.ts:25) and [scripts/validate-decision-request.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-decision-request.cjs:18)
  - evidence + non-current stale-state gate matches: [src/lib/decision-request/hilt-boundary.ts](/Users/jamiecraik/dev/coding-harness/src/lib/decision-request/hilt-boundary.ts:82) and [scripts/validate-decision-request.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-decision-request.cjs:128)
  - stale_claim_support freshness constraint matches: [src/lib/decision-request/hilt-boundary.ts](/Users/jamiecraik/dev/coding-harness/src/lib/decision-request/hilt-boundary.ts:95) and [scripts/validate-decision-request.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-decision-request.cjs:137)
- **Regression test confirms schema-valid but semantically invalid claim-sensitive packet now fails**: [src/dev/validate-runtime-packet-schemas-script.test.ts](/Users/jamiecraik/dev/coding-harness/src/dev/validate-runtime-packet-schemas-script.test.ts:306)

### Validation Evidence

- `pnpm vitest src/dev/validate-runtime-packet-schemas-script.test.ts -t "decision-request semantic validation"` -> pass (1 test passed).
- Inspected semantic execution flow and manifest path constraints directly in scoped files.

### Residual Risks

- Semantic parity still relies on duplicated business rules across runtime builder and standalone script; future drift remains possible without a shared rule module or fixture-based parity test that mechanically compares both validators across the same corpus.
- This review is scoped to requested files; no claim is made about unrelated packet families.

### What's Working Well

- Strong closure of the originally reported bypass class through executable semantic checks.
- Good defense-in-depth: schema + semantic validation + scoped regression test.
- Semantic validator path is constrained to repo-contained paths, reducing path-injection/supply risk.

### Score

- **2/2 high-priority capabilities are agent-accessible**
- **Verdict:** PASS

## Accountability Receipt

- status: complete
- manifest_path: n/a (single-review artifact run)
- artifact_paths:
  - artifacts/reviews/pu-032-spg-006-hilt-boundary-post-semantic-agent-native.md
- findings:
  - none material in scoped review
- failures_or_blockers:
  - blocked_local_memory_cli:
    - command: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness/task:pu-032-spg-006-post-semantic-review" --json`
    - error: `failed to write PID file: open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted`
- improvement_opportunities:
  - reduce duplicated semantic logic by extracting shared claim-sensitive boundary checks used by both runtime builder and external semantic validator
- strengths:
  - semantic bypass fixed with concrete validator wiring and tests
  - line-level parity between boundary mapping and claim-sensitive gating
- validation_evidence:
  - code evidence references listed above
  - focused vitest command passed
- useful_findings:
  - bypass closure verified
- avoided_false_positive:
  - did not escalate duplicated-logic risk to warning because behavior is currently aligned and regression-covered
- evidence_quality:
  - high for scoped files; medium overall due local-memory CLI sandbox blocker
- followed_scope:
  - yes; only requested files evaluated
- reusable_learning:
  - for claim-sensitive packets, require both schema and semantic validators in manifest to prevent structure-only bypasses
- coordinator_score:
  - 9/10 (clear scope and validation context; only missing reproducible local-memory access in sandbox)
- next_action:
  - optional hardening: add corpus parity test that feeds identical packets through runtime builder and semantic script to detect rule drift

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-post-semantic-agent-native.md
