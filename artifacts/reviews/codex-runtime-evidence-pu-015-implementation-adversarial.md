# Adversarial Review: PU-015 Implementation

## Scope
- src/lib/delivery-truth/judge-pm-audit.ts
- src/lib/delivery-truth/judge-pm-audit.test.ts
- src/lib/delivery-truth/types.ts
- src/lib/delivery-truth/index.ts
- src/lib/pr-closeout/delivery-truth.ts
- src/lib/pr-closeout.test.ts
- Intent: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json

## Findings (Severity-Ordered)

### 1) High: Judge/PM packet cannot enforce required multi-surface audit inputs, so closeout can pass without proving runtime/external/review/root/validation evidence splits
- Validation ownership: introduced by current patch
- Evidence:
  1. The PU-015 intent requires explicit packet fields for `runtimeCardRefs`, `reviewStateRef`, `externalStateRef`, `linearStateRef (or explicit N/A authority)`, `validationReceiptRefs`, `rootHygieneRef`, and `unresolvedRiskClassifications` ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json:70](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json:70), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json:78](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json:78)).
  2. The implemented `JudgePmAuditVerdictInput` only accepts `packetRef`, `verifiedAt`, `headSha`, reviewer artifacts/roles, one issue authority map, and generic supporting delivery-truth verdicts ([judge-pm-audit.ts:53](/Users/jamiecraik/dev/coding-harness/src/lib/delivery-truth/judge-pm-audit.ts:53), [judge-pm-audit.ts:60](/Users/jamiecraik/dev/coding-harness/src/lib/delivery-truth/judge-pm-audit.ts:60)).
  3. Because those required surfaces are not represented in the input shape, `firstAuditBlocker` cannot validate or fail on their absence; it only checks timestamp/packetRef, reviewer role+artifact checks, issue authority map, and five supporting verdicts ([judge-pm-audit.ts:164](/Users/jamiecraik/dev/coding-harness/src/lib/delivery-truth/judge-pm-audit.ts:164), [judge-pm-audit.ts:179](/Users/jamiecraik/dev/coding-harness/src/lib/delivery-truth/judge-pm-audit.ts:179)).
  4. Resulting failure mode: a caller can provide pass/current supporting verdicts and valid reviewer receipts while omitting explicit runtime-card/validation/root-hygiene/ref-level audit inputs entirely, and still obtain `goal_ready_for_judge_pm: pass`.
- Remediation:
  - Expand Judge/PM packet input/schema to include the required PU-015 audit surfaces as first-class fields.
  - Add fail-closed checks for each required surface, including stale/missing/head-mismatch and explicit N/A authority rules.
  - Add tests that prove pass is impossible when any required audit surface is omitted.

### 2) High: Issue authority N/A decisions are not explicitly attested per decision, enabling ambiguous authority closure
- Validation ownership: introduced by current patch
- Evidence:
  1. Intent requires N/A entries (parent issue / PR / external goal) to carry explicit owner, rationale, and timestamp for that decision ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json:73](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json:73)).
  2. Implemented `JudgePmAuditIssueAuthorityMap` has only global `authorityOwner`, `decidedAt`, and `rationale` fields plus booleans for each N/A toggle, with no per-toggle decision object ([judge-pm-audit.ts:38](/Users/jamiecraik/dev/coding-harness/src/lib/delivery-truth/judge-pm-audit.ts:38), [judge-pm-audit.ts:49](/Users/jamiecraik/dev/coding-harness/src/lib/delivery-truth/judge-pm-audit.ts:49)).
  3. `issueAuthorityBlocker` validates structural consistency of booleans vs values, but cannot prove who authorized each N/A decision or when/why that specific N/A was made ([judge-pm-audit.ts:295](/Users/jamiecraik/dev/coding-harness/src/lib/delivery-truth/judge-pm-audit.ts:295), [judge-pm-audit.ts:346](/Users/jamiecraik/dev/coding-harness/src/lib/delivery-truth/judge-pm-audit.ts:346)).
  4. Resulting failure mode: one broad rationale can authorize all N/A toggles without per-decision provenance, defeating the intent’s authority-audit granularity.
- Remediation:
  - Replace booleans with per-surface authority decisions (value + not-applicable decision metadata).
  - Require owner/rationale/decidedAt per N/A branch and test each independently.

### 3) Medium: PR closeout treats delivery-truth verdicts as blocking/non-blocking using only status+freshness, allowing non-claim-support verdicts to pass through
- Validation ownership: introduced by current patch
- Evidence:
  1. Intent requires supporting verdicts for this gate to be pass/current/claim_support/current-head ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json:74](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json:74), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json:79](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-015-intent.json:79)).
  2. `PrCloseoutDeliveryTruthVerdict` includes `evidenceUse` and head fields ([types.ts:97](/Users/jamiecraik/dev/coding-harness/src/lib/pr-closeout/types.ts:97), [types.ts:112](/Users/jamiecraik/dev/coding-harness/src/lib/pr-closeout/types.ts:112)).
  3. `isBlockingDeliveryTruthVerdict` gates only on `status === pass` and `freshness === current`; it does not validate `evidenceUse === claim_support` or enforce head-sha coherence at this boundary ([delivery-truth.ts:49](/Users/jamiecraik/dev/coding-harness/src/lib/pr-closeout/delivery-truth.ts:49), [delivery-truth.ts:59](/Users/jamiecraik/dev/coding-harness/src/lib/pr-closeout/delivery-truth.ts:59)).
  4. Resulting failure mode: a verdict marked pass/current but with `evidenceUse: "orientation_only"` (or equivalent non-support value) is treated as non-blocking and can contribute to a ready closeout path.
- Remediation:
  - Extend blocking predicate to require `evidenceUse === "claim_support"`.
  - Optionally require head-sha coherence at this projection boundary (or assert the boundary contract and enforce upstream with explicit invariant checks + tests).
  - Add regression tests for pass/current/non-claim-support verdicts being blocked.

## Open Questions
- None.

## Validation run
- `pnpm vitest run src/lib/delivery-truth/judge-pm-audit.test.ts src/lib/pr-closeout.test.ts --reporter=dot`
- Result: pass (2 files, 56 tests).

WROTE: artifacts/reviews/codex-runtime-evidence-pu-015-implementation-adversarial.md
