## Agent-Native Architecture Review

### Summary
This slice introduces/updates policy-chain-driven `policy-gate` behavior and keeps the command agent-discoverable through the CLI registry alias surface. The core GAP-006 behavior (high-risk `block` defaults to fail) is implemented and test-covered for the repository default contract. One contract-validation gap remains that can allow a false-success path in custom contracts, so verdict is NEEDS WORK until that invariant is enforced.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Run policy safety gate for changed files | src/lib/cli/registry/policy-gate-command-spec.ts:8 | `harness policy-gate` (alias `risk-policy-gate`) | Yes (CLI help/registry summary) | Must-have | Covered |
| Return machine-readable gate verdict for automation | src/commands/policy-gate.ts:181 | `--json` output via `normalisePolicyGateResult` | Yes | Must-have | Covered |
| Enforce contract policy-chain mapping semantics | src/lib/contract/validator-core.ts:340 | Contract validator | Partial | Must-have | Gap |

### Findings

#### Warnings (Should Fix)
1. **Policy-chain validator allows unsafe `block -> pass` mapping (false-success risk)** -- `src/lib/contract/validator-core.ts:381`
Impacted behavior: A contract can legally set `policyChain.actionToVerdict.block = "pass"`. In that state, a max-tier violation path in `runPolicyGate` (`src/commands/policy-gate.ts:130`) computes verdict via `resolveGateVerdict("block", policyChain)`, which can return pass and produce a success exit for what should be a blocking condition.
Remediation: Enforce semantic invariant in contract validation (and JSON schema/tests) that `actionToVerdict.block` must be `"fail"` for governed safety-floor contracts, or add an explicit strict-mode policy that fails closed by default.
Confidence: 90
Validation ownership: introduced by current patch (GAP-006 closure claims depend on this invariant being non-bypassable, but validator currently permits bypass).

### Observations
1. Contract/docs/test synchronization is otherwise solid for this slice: default contract maps high->block and block->fail (`harness.contract.json:140`), targeted command tests cover omitted-`maxTier` and `maxTier=high` high-risk behavior (`src/commands/policy-gate.test.ts:64`, `:82`), and governance docs now state the executable safety floor (`docs/agents/06-security-and-governance.md:100`).

### What's Working Well
- Command discoverability parity is strong: canonical name, alias, summary, and example are registry-declared in one place (`src/lib/cli/registry/policy-gate-command-spec.ts:8`).
- JSON normalization returns actionable evidence refs and deterministic findings for failed gates (`src/lib/output/normalise-policy-gate.ts:91`).
- No scope creep detected in touched files; the change stays focused on policy-chain gating semantics and governance wording.

### Score
- **2/3 high-priority capabilities are fully agent-accessible and safety-complete**
- **Verdict:** NEEDS WORK

## Accountability Receipt
- status: needs_work
- manifest_path: artifacts/agent-runs/agent-native-reviewer-019e683b-d955-7470-b224-06bf79d375ca/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-020-gap-006-policy-gate-implementation-agent-native.md
- findings:
  - warning: policyChain validator permits block->pass semantic, enabling false-success in custom contracts
- failures_or_blockers:
  - none
- improvement_opportunities:
  - enforce semantic policy invariant for block action; add validator and policy-gate regression tests for custom `policyChain`
- strengths:
  - focused implementation, good targeted tests, clear docs/contract alignment for default behavior
- validation_evidence:
  - `src/lib/contract/validator-core.ts:340-387`
  - `src/commands/policy-gate.ts:130-141`
  - `src/commands/policy-gate.test.ts:64-77`
  - `src/commands/policy-gate.test.ts:82-94`
  - `harness.contract.json:140-151`
  - `docs/agents/06-security-and-governance.md:100`
- next_action:
  - tighten validator/schema invariant for `actionToVerdict.block`, add regression coverage, rerun policy-gate + validator suites

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-implementation-agent-native.md
