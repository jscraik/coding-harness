## Agent-Native Architecture Review

### Summary
This slice is a CLI/contract-policy surface (no user-facing GUI actions). Agent integration is first-class because the same `policy-gate` command and contract parser used by users are directly callable by agents through the shared workspace/CLI path. The GAP-006 false-success path (custom `policyChain` mapping `block -> pass`) is now closed by executable guardrails across runtime logic, validator, and JSON schema, with regression fixture/tests in place.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Run policy gate against changed files | src/cli.ts -> policy-gate command | `harness policy-gate` / `node --import tsx src/cli.ts policy-gate` | N/A (CLI command discoverable via repo contract/docs) | Must-have | Accessible |
| Configure policy chain behavior | harness.contract.json:140 | Contract parser + validator (`validateContract`) | N/A | Must-have | Accessible with fail-closed validation |
| Generate machine-readable policy verdict | src/lib/output/normalise-policy-gate.ts | JSON output (`--json`) | N/A | Must-have | Accessible |

### Findings

#### Critical (Must Fix)
1. None.

#### Warnings (Should Fix)
1. None.

#### Observations
1. **Validator error projection is intentionally generic at CLI surface** -- [src/lib/output/normalise-policy-gate.ts:51](/Users/jamiecraik/dev/coding-harness/src/lib/output/normalise-policy-gate.ts:51), [src/commands/policy-gate.ts:156](/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.ts:156). Invalid contract runs return a generic internal-error finding in normalized output while full detail remains in stderr/details; this is acceptable for now and not a GAP-006 bypass.

### Evidence For GAP-006 Closure
- **Max-tier override now hard-fails with explicit fail/block tuple**: [src/commands/policy-gate.ts:128](/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.ts:128) sets `passed: false`, `action: "block"`, `verdict: "fail"` when actual tier exceeds max allowed.
- **Contract validator rejects `actionToVerdict.block !== "fail"`**: [src/lib/contract/validator-core.ts:386](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator-core.ts:386), with explicit validation message at [src/lib/contract/validator-core.ts:2072](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator-core.ts:2072).
- **JSON schema enforces `const: "fail"` for block verdict mapping**: [src/lib/contract/json-schema-core.ts:620](/Users/jamiecraik/dev/coding-harness/src/lib/contract/json-schema-core.ts:620).
- **Canonical defaults remain fail-closed**: [src/lib/contract/types-core.ts:1468](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types-core.ts:1468), [harness.contract.json:146](/Users/jamiecraik/dev/coding-harness/harness.contract.json:146).
- **Regression fixture and tests exist**:
  - Fixture: [test-fixtures/contract-block-pass.json:15](/Users/jamiecraik/dev/coding-harness/test-fixtures/contract-block-pass.json:15)
  - Validator regression: [src/lib/contract/validator.test.ts:695](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.test.ts:695)
  - Schema regression: [src/commands/contract.test.ts:278](/Users/jamiecraik/dev/coding-harness/src/commands/contract.test.ts:278)

### Validation Evidence
- Ran: `pnpm vitest run src/lib/contract/validator.test.ts -t "rejects policy chains that map block to pass"` -> **pass**.
- Ran: `node --import tsx src/cli.ts policy-gate --contract test-fixtures/contract-block-pass.json --files src/auth/login.ts --json` -> **exit 1**, contract validation failure (fail-closed), no pass path observed.

### What's Working Well
- Defense-in-depth is in place: runtime decision guard + contract validation + schema constraint + fixture regression.
- Shared-workspace parity is preserved: users and agents execute the same command and consume the same JSON result contract.
- No workflow-tool anti-pattern introduced; policy decisioning remains explicit and inspectable via primitive contract mappings.

### Score
- **3/3 high-priority capabilities are agent-accessible**
- **Verdict:** PASS

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-rereview-agent-native.md
