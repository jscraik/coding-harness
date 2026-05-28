## Agent-Native Architecture Review

### Summary
This intent targets a CLI-first governance slice (GAP-005) rather than a GUI workflow, and it does include a concrete agent-usable action surface (`decision-request` command + command-catalog discoverability gate). Overall parity direction is good, but implementation readiness is not fully complete yet because human-escalation semantics are required by the goal and feedback signal but are not explicitly represented in the output contract or acceptance criteria.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Create structured decision request packet | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:59 | `decision-request` CLI command via registry | Yes (catalog discoverability test at :77 and acceptance at :100) | Must-have | Partial |
| Detect stale/expired decision state | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:58,98 | Builder stale classification + packet `staleState` | Yes | Must-have | Pass |
| Distinguish governance packet from closeout proof | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:51,69 | Contracted as not-closeout-proof | Yes | Must-have | Pass |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
1. **Human-escalation parity is under-specified in the output contract**
- Severity: Warning
- Evidence: [goal.md](/Users/jamiecraik/dev/coding-harness/docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:149) requires decision request intent, authority, **human escalation**, and stale-state handling to be machine-readable; intent feedback repeats the same requirement at [.harness/intent/...intent.json](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:15), but expected output contract only guarantees schemaVersion/runtimeStatus/evidenceUse/claimSupport/staleState at [same file:65](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:65) and acceptance criteria do not explicitly require human-escalation fields at [same file:95](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:95).
- Impacted behavior: Agent and user can both emit a decision packet, but escalation intent may drift into prose or optional metadata, weakening machine-verifiable governance parity.
- Remediation: Add explicit machine-readable escalation requirements (for example: `escalation.required`, `escalation.targetRole`, `escalation.reason`, `escalation.deadline` or equivalent) to expectedOutputContract, schema/example, and acceptance criteria.
- Confidence: 0.88
- Validation ownership: introduced by current patch intent (specification gap in this intent artifact).

2. **Validation gates do not explicitly prove escalation semantics or stale-state negative paths**
- Severity: Warning
- Evidence: Validation list includes one happy-path command invocation at [.harness/intent/...intent.json:76](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:76), but no explicit negative gate for missing escalation data or expired/stale classification assertion despite GAP-005 stale-state mandate in [goal.md:149](/Users/jamiecraik/dev/coding-harness/docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:149).
- Impacted behavior: Slice could pass green with command reachability while still missing deterministic fail-closed behavior for required governance semantics.
- Remediation: Add focused tests/gates for (a) missing required escalation fields fails, (b) expired decision emits required `staleState`, and (c) stale decision cannot be misclassified as current governance intent.
- Confidence: 0.82
- Validation ownership: introduced by current patch intent (test contract incompleteness).

#### Observations
1. **Strong agent discoverability posture for command exposure**
- Evidence: Command catalog handoff visibility is required via [intent.json:77](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:77) and accepted as agent-usable metadata at [intent.json:100](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json:100).
- Suggestion: Keep this requirement when implementation lands so capability does not become registry-hidden.

### What's Working Well
- Intent is tightly scoped and avoids authority creep into PR/tracker mutation.
- Shared-workspace posture is preserved (read-only packet generation, no side-channel output directory).
- Governance boundary is explicit: `decision-request/v1` is not a closeout success proof.

### Score
- **2/3 high-priority capabilities are fully agent-accessible and machine-verifiable**
- **Verdict:** NEEDS WORK

## Accountability receipt
- status: completed_with_findings
- manifest_path: not_provided_for_this_review_run
- artifact_paths:
  - artifacts/reviews/pu-025-gap-005-decision-request-governance-intent-agent-native.md
- findings:
  - warning: human-escalation contract under-specified for GAP-005 machine-readable requirement
  - warning: validation gates miss explicit negative-path proofs for escalation/stale-state semantics
- failures_or_blockers:
  - Missing repository-local reviewer template path (`agents/templates/review-artifact.md`) and contract file (`agents/contracts.json`) at current checkout; proceeded using explicit task contract and existing artifact conventions.
- improvement_opportunities:
  - Add explicit escalation fields to contract/schema/examples.
  - Add fail-closed regression tests for stale/expired/escalation-missing paths.
- strengths:
  - Clear scope boundaries and explicit non-goals.
  - Agent discoverability and read-only command metadata are already planned.
- validation_evidence:
  - `rg -n "GAP-005|decision request|governance" docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`
  - `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json`
  - `nl -ba docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md | sed -n "140,190p"`
- next_action:
  - Update intent contract + acceptance criteria for machine-readable human escalation and add explicit negative-path validation gates before implementation starts.

WROTE: artifacts/reviews/pu-025-gap-005-decision-request-governance-intent-agent-native.md
