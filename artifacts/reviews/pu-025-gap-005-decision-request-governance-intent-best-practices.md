# Best Practices Review - PU-025 GAP-005 Decision Request Governance Intent

## Scope
- Reviewed intent only: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json`
- Goal alignment target: `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md#gap-005`
- Assessment lens: implementation tightness, agent-native operability, runtime determinism, and governance safety boundaries.

## Severity-Ranked Findings

1. **Severity: medium**
Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:59`, `:76`
Impacted behavior: The option grammar is ambiguous and internally inconsistent. Line 59 defines repeated `--option id=Label|Tradeoff|Tradeoff` (three segments, with `|` as an in-value separator), while validation example line 76 shows `--option <id=label|tradeoff>` (two segments). This can produce divergent parser implementations and flaky interoperability across agents/scripts.
Remediation: Define one canonical option grammar in the intent and mirror it in validation gates, schema example notes, and docs. Recommended: switch to repeated named flags (for example `--option-id`, `--option-label`, repeated `--option-tradeoff`) or a JSON object form for `--option` to avoid delimiter collisions.
Confidence: high
Validation ownership: introduced by current intent patch

2. **Severity: medium**
Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:58-59`, `:65-71`, `:95-103`
Impacted behavior: The intent requires machine-readable stale handling, but it does not define deterministic precedence between `--status`, `--freshness`, `--expires-at`, and `--generated-at`. Different implementations could classify the same packet differently (for example expired + status=current).
Remediation: Add explicit precedence rules in intent acceptance criteria and expected output contract, such as: expiry check evaluated first, then explicit stale flag, then freshness-derived state; require rejection or forced stale classification when conflicts occur. Include at least one negative test case in validation gates for conflicting inputs.
Confidence: high
Validation ownership: introduced by current intent patch

## Strengths
- Clear non-goals prevent scope creep into PR/CI/tracker mutation (`:49-55`).
- Good read-only governance posture and explicit claim boundary (`:65-70`, `:104-108`).
- Validation list includes both command-registry visibility and schema-manifest checks (`:72-82`), which is strong for agent-native reachability.

## Improvement Opportunities
- Tighten command contract examples so implementers do not infer parser behavior.
- Add one explicit stale/expiry conflict matrix to remove semantic drift risk before coding starts.

## Overall Assessment
The intent is strong and close to implementation-ready, but it should resolve the option grammar ambiguity and stale-state precedence rules before coding. Without those clarifications, GAP-005 could be implemented with subtle contract drift across CLI, schema examples, and validators.

WROTE: artifacts/reviews/pu-025-gap-005-decision-request-governance-intent-best-practices.md
