# Adversarial Intent Review: PU-020 GAP-006 Policy-Gate Risk Chain

## Scope Reviewed
- Intent artifact: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json`
- Corroborating sources listed in the assignment.

## Findings (Severity-Ordered)

1. **Severity: Medium - Default-fallback behavior can regress without being caught by the declared validation gates**
- Evidence:
  - Intent requires changing default policy behavior: `DEFAULT_POLICY_CHAIN maps high to block` ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json:74](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json:74)).
  - Runtime uses fallback defaults when contract policy chain is absent: `return contract?.policyChain ?? DEFAULT_POLICY_CHAIN` ([src/lib/policy/policy-chain.ts:19](/Users/jamiecraik/dev/coding-harness/src/lib/policy/policy-chain.ts:19)).
  - Current default is warn/pass for high: `high: "warn"`, `warn: "pass"` ([src/lib/contract/types-core.ts:1464](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types-core.ts:1464), [src/lib/contract/types-core.ts:1471](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types-core.ts:1471)).
  - Declared validation gates do not include `src/lib/contract/loader.test.ts` or a no-`policyChain` fixture invocation, even though those files are in allowed scope ([intent:29-30,85-90](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json:85)).
- Constructed failure scenario:
  - Trigger: implementer updates repo contract `harness.contract.json` to block/fail but misses or partially updates `DEFAULT_POLICY_CHAIN`.
  - Execution path: `policy-gate` appears correct for this repository because it reads explicit `contract.policyChain`; downstream/fixture paths that omit `policyChain` continue resolving old warn/pass fallback via `resolvePolicyChain`.
  - Outcome: GAP-006 appears closed locally while generated/default contract consumers still pass high-risk changes, recreating the same contract-vs-runtime drift in another boundary.
- Impacted behavior: cross-component safety-floor consistency (repo contract vs default/scaffold behavior).
- Remediation: add one explicit acceptance criterion and one mandatory validation command that proves no-`policyChain` fallback is fail-closed for `high` (for example a focused `loader.test`/fixture or a CLI test contract missing `policyChain`).
- Confidence: 75
- Validation ownership: introduced by current patch (intent-level validation omission).

## No Material Blockers Beyond Findings
- The slice is otherwise appropriately narrow for GAP-006 and correctly avoids GAP-005 decision-request expansion.
- High-risk contradiction is directly evidenced:
  - Stated human-mediated boundary ([harness.contract.json:13](/Users/jamiecraik/dev/coding-harness/harness.contract.json:13))
  - Executable warn/pass high-tier chain ([harness.contract.json:140](/Users/jamiecraik/dev/coding-harness/harness.contract.json:140), [src/commands/policy-gate.test.ts:64](/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.test.ts:64), [src/commands/policy-gate.test.ts:80](/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.test.ts:80)).

## Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6835-20db-7bb2-b19d-9ea701948027/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-020-gap-006-policy-gate-intent-adversarial.md
- findings:
  - 1 medium-severity validation-hole finding
- failures_or_blockers:
  - Missing `agents/templates/review-artifact.md` at expected relative path (`agents/templates` absent in this checkout); proceeded with contract-complete artifact format.
- improvement_opportunities:
  - Make fallback/default-path validation mandatory whenever intent changes DEFAULT_* contract behavior.
- strengths:
  - Scope is bounded to GAP-006 and explicitly excludes decision-request and runtime-closeout expansion.
  - Acceptance criteria are concrete on high/medium/low CLI outcomes.
- validation_evidence:
  - `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json`
  - `nl -ba src/lib/policy/policy-chain.ts`
  - `nl -ba src/lib/contract/types-core.ts`
  - `nl -ba harness.contract.json`
  - `nl -ba src/commands/policy-gate.test.ts`
- next_action:
  - Add a no-`policyChain` fallback acceptance+validation check before implementation begins.
- useful_findings: 1
- avoided_false_positive:
  - Did not flag GAP-005 decision-request absence as a defect because intent explicitly keeps it out of scope.
- evidence_quality: high
- followed_scope: yes
- reusable_learning:
  - When safety-floor fixes touch both explicit contract and default fallback, force a paired validation gate.
- coordinator_score: strong

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-intent-adversarial.md
