## Agent-Native Architecture Review

### Summary
This intent is a well-bounded GAP-006 slice that directly targets the executable contradiction between the stated high-risk safety floor and the current policy-gate chain. Scope is mostly tight (contract/default chain plus policy-gate behavior plus focused docs/tests), and the proposed acceptance criteria are concrete. One material gap remains: the intent does not require explicit proof that omitted/scaffolded contracts inherit the new fail-closed high-risk default, which risks leaving user-created repos and agent-initialized workflows on stale behavior.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Configure risk-tier and policy chain in contract | harness.contract.json | `policy-gate` CLI + contract loader defaults | Yes (goal + intent + docs) | Must-have | Partial |
| Evaluate changed files against policy chain | src/commands/policy-gate.ts | `policy-gate` CLI | Yes | Must-have | Pass |
| Enforce high-risk fail-closed behavior with no max-tier | src/commands/policy-gate.ts | `policy-gate` CLI | Yes | Must-have | Planned (not yet implemented) |
| Preserve medium-risk advisory behavior | src/commands/policy-gate.ts | `policy-gate` CLI | Yes | Should-have | Planned |
| Discover governance expectation for high-risk behavior | docs/agents/06-security-and-governance.md | Read docs + run CLI | Yes | Should-have | Pass |

### Findings

#### Warnings (Should Fix)
1. **Missing explicit default/scaffold parity acceptance for omitted `policyChain`** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json:52`, `:74`, `:85-90`; evidence that default still maps high to warn exists at `src/lib/contract/types-core.ts:1462-1472`.
Impacted behavior: The intent says newly scaffolded or omitted-policyChain contracts should inherit fail-closed behavior, but acceptance/validation does not explicitly require a test that an omitted `policyChain` path resolves to `high -> block -> fail`. This can let user-visible behavior drift: current repo contract may be fixed while agent-initialized or minimal contracts remain permissive.
Remediation: Add one acceptance criterion and one focused test/command proving omitted `policyChain` uses updated `DEFAULT_POLICY_CHAIN` (for example via loader/policy-chain test or a fixture contract without `policyChain`).
Confidence: 92
Validation ownership: Introduced by current patch scope (intent contract completeness).

#### Observations
1. **Slice narrowness is good and avoids GAP cross-contamination** -- Intent explicitly excludes decision-request and runtime-card/closeout surfaces (`...intent.json:58-64`), which keeps GAP-006 focused and reduces regression risk.
2. **The contradiction is mechanically verified and correctly targeted** -- Current governed chain is `high: warn` + `warn: pass` (`harness.contract.json:140-150`), while safety language says high-risk remains human-mediated (`harness.contract.json:13`), matching GAP-006 diagnosis.

### What's Working Well
- In-scope/out-of-scope boundaries are concrete and aligned with goal-board GAP ordering.
- Acceptance criteria include both behavioral JSON assertions and CLI exit-code expectations.
- Validation gates are focused and reproducible for the policy-gate surface.
- Agent-visible discoverability is preserved: behavior is implemented in shared contract + CLI, not hidden in human-only process.

### Score
- **4/5 high-priority capabilities are agent-accessible and properly constrained by this intent**
- **Verdict:** NEEDS WORK (one targeted acceptance/validation addition)

If the omitted-policyChain parity criterion is added, no material blocker remains for implementation kickoff.

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-intent-agent-native.md
