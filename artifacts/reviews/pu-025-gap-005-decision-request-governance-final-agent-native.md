## Agent-Native Architecture Review

### Summary
This slice preserves agent-native parity for decision governance. The action to emit a decision request is reachable through a real registry command, exposed in agent handoff catalogs, and implemented as a thin command facade over src/lib/decision-request deep-module logic. The packet contract is explicitly read-only governance evidence and explicitly not closeout proof, matching the intent boundary.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Emit decision governance packet with options/tradeoffs | src/commands/decision-request.ts:1 | decision-request command via registry | Yes | Must-have | Pass |
| Discover decision-request in handoff mode | src/lib/cli/registry/command-capability-rules.ts:348 | commands catalog in handoff mode | Yes | Must-have | Pass |
| Produce machine-readable escalation metadata | src/lib/decision-request/builder.ts:229 | decision-request packet builder | Yes | Must-have | Pass |
| Fail closed on malformed/unsafe input | src/lib/decision-request/cli.ts:19; src/lib/decision-request/builder.ts:49 | CLI plus builder validation | Yes | Must-have | Pass |
| Keep governance packet out of closeout proof | src/lib/decision-request/builder.ts:141; README.md:761 | constants plus docs contract | Yes | Must-have | Pass |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
None.

#### Observations
1. Schema-level uniqueness for options ids is not encoded.
- severity: observation
- evidence: contracts/decision-request.schema.json:56
- impacted behavior: JSON Schema validates shape, but duplicate option IDs are only blocked by runtime builder/CLI logic.
- remediation: Optional hardening via parity validator rule for unique options ids if non-CLI producers are expected.
- confidence: 75
- validation ownership: pre-existing design choice

2. Discoverability is mode-scoped to handoff catalogs.
- severity: observation
- evidence: src/lib/cli/registry/command-capability-rules.ts:348
- impacted behavior: Agents discover this command when using handoff catalog mode; default catalog flows may not surface it.
- remediation: Optional docs hint where handoff catalogs are introduced.
- confidence: 50
- validation ownership: shared orchestration/docs surface

### What's Working Well
- Real registry dispatch path exists and is test-covered: src/lib/cli/command-registry.test.ts:96.
- Read-only governance boundary is explicit: src/lib/decision-request/builder.ts:141 and contracts/decision-request.schema.json:97.
- Fail-closed validation covers required GAP-005 conditions:
duplicate ids, unknown tradeoff option ids, default-option mismatch, malformed options, invalid dates, invalid status/freshness/authority, and blank escalation fields.
- Deep-module boundary is intact: src/commands/decision-request.ts remains a thin facade.

### Score
- 5/5 high-priority capabilities are agent-accessible
- Verdict: PASS

## Accountability Receipt
- status: complete
- manifest_path: n.a. (review-only run; no reviewer manifest contract file present in this repository scope)
- artifact_paths:
  - artifacts/reviews/pu-025-gap-005-decision-request-governance-final-agent-native.md
- findings:
  - critical: 0
  - warnings: 0
  - observations: 2
- failures_or_blockers: none
- improvement_opportunities:
  - Add schema/parity uniqueness guard for options ids if non-CLI emitters are introduced.
  - Add discoverability cue for handoff-mode command catalog usage.
- strengths:
  - Strong action parity and context parity for this slice.
  - Clear non-closeout claim boundary.
  - Deterministic fail-closed validation behavior.
- validation_evidence:
  - Static source review of scoped files plus consistency check against provided validation receipts.
- next_action:
  - Keep current implementation; optionally schedule the two observation hardenings in a follow-up.

WROTE: artifacts/reviews/pu-025-gap-005-decision-request-governance-final-agent-native.md
