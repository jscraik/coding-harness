# Adversarial Intent Review — PU-025 GAP-005 Decision-Request Governance

## Scope
- Reviewed only: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json`
- Goal alignment reference: `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` GAP-005 language

## Findings

### 1) High — Escalation contract can remain prose-only while packet is marked emitted
- Severity: high
- Evidence:
  - Intent requires human escalation in feedback framing: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:15`
  - GAP-005 requires machine-readable human escalation: `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:149`
  - Expected output contract omits any escalation field/structure: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:65-71`
  - Implementation approach lists flags/fields but no escalation payload: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:56-63`
- Impacted behavior:
  - Scenario chain: command emits `decision-request/v1` with `runtimeStatus=emitted` -> downstream governance consumers treat packet as complete -> no machine-readable escalation actor/path/urgency is present -> human routing remains chat/prose-only and automation cannot distinguish "decision pending" from "decision blocked by missing escalation metadata."
- Remediation:
  - Add required escalation structure to intent output contract and schema plan now (for example: `escalation.required`, `escalation.owner`, `escalation.channel`, `escalation.reason`, `escalation.requestedAt`), plus a failing test for packets missing escalation when status requires human decision.
- Confidence: 88
- Validation ownership: introduced by current patch intent design

### 2) High — Caller-provided freshness/status can contradict expiry and produce non-deterministic stale classification
- Severity: high
- Evidence:
  - CLI allows caller-supplied `--status` and `--freshness`: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:59`
  - Builder is also expected to classify expired decisions as stale: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:58`
  - Acceptance checks stale handling generally, but does not define precedence when user inputs conflict with computed expiry state: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:98`
- Impacted behavior:
  - Scenario chain: operator submits `--expires-at` in the past plus `--freshness current --status active` -> parser accepts both raw and derived signals -> one component trusts explicit flags while another trusts computed expiry -> packet appears both active and stale across consumers, causing inconsistent gate behavior and decision routing.
- Remediation:
  - Define and test precedence in intent: computed temporal state must override caller freshness/status, with explicit conflict error or forced normalization plus `staleState` reason code.
- Confidence: 84
- Validation ownership: introduced by current patch intent design

### 3) Medium — Duplicate option identifiers can pass default membership check and still create ambiguous default semantics
- Severity: medium
- Evidence:
  - Option input is repeated free-form `--option id=Label|Tradeoff|Tradeoff`: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:59`
  - Validation only promises default option exists in option ids, not uniqueness: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:58-59,99`
- Impacted behavior:
  - Scenario chain: user supplies two options with same id but different label/tradeoffs -> membership check passes for `defaultOptionId` -> renderers/resolvers choose first vs last occurrence differently -> decision view and downstream recommendation diverge under normal repeated-edit usage.
- Remediation:
  - Add uniqueness invariant for option ids in intent acceptance and schema/CLI validation; fail closed on duplicates with deterministic error text.
- Confidence: 79
- Validation ownership: introduced by current patch intent design

## Residual Risks
- Intent does not yet declare explicit conflict-policy codes for stale-state classification, so future implementers may encode incompatible semantics across CLI, schema example, and manifest evidence.

## Strengths
- Scope is narrow and clearly constrained to deep module plus registry surfaces.
- Non-goals explicitly prevent accidental closeout-claim inflation.
- Validation includes command-registry and schema-validator paths rather than doc-only assertions.

WROTE: artifacts/reviews/pu-025-gap-005-decision-request-governance-intent-adversarial.md
