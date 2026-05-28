## Agent-Native Architecture Review

### Summary
The SPG-005 intent is strongly aligned with a narrow, orientation-only cockpit model: it constrains scope to tool-exposure schema/projection seams and explicitly forbids command-registry and delivery-truth authority expansion. Agent-native readiness is mostly solid for this slice, but one discoverability gap remains: the intent does not explicitly require a machine-discoverable runtime entrypoint proving where an agent can read the new tool-exposure projection during this unit.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| View sandbox/approval/network/tool-exposure summary in cockpit evidence | .harness intent + runtime-card projection scope | Existing runtime-card evidence path (planned) | Partial | Must-have | Partial |
| Distinguish unavailable vs blocked vs not-attempted vs claim-failed tool states | intent acceptance criteria | Verifier/runtime-card fixtures (planned) | Yes | Must-have | Covered |
| Keep tool exposure orientation-only (non-claim-support) | intent design constraints + acceptance guard | Validator rejection rules (planned) | Yes | Must-have | Covered |

### Findings

#### Warnings (Should Fix)
1. **Runtime discoverability for SPG-005 projection is implied but not contract-explicit** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-031-spg-005-tool-exposure-projection-intent.json:9-16`, `:39-44`, and `.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md:962-971` -- The intent defines projection semantics and validation, but does not require a specific machine-readable runtime proof in this slice that an agent can discover and consume the projection end-to-end (for example, a required runtime-card CLI fixture/receipt for SPG-005 fields). This can leave a soft hidden step where humans inspect code/tests instead of agents consuming the projected surface directly.
Fix: Add one acceptance/validation clause in the SPG-005 intent that binds tool-exposure projection to a concrete runtime-card evidence output contract (fixture or command evidence) discoverable by agents.

#### Observations
1. **Narrow cockpit boundary is clearly protected** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-031-spg-005-tool-exposure-projection-intent.json:23-30`, `:33-37`, and `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:227` keep this work away from command authority and second-registry drift.
2. **Orientation-only guard is explicit and consistent across goal/state/intent** -- intent `:33`, goal `:223-227`, state `:175` all align that tool exposure cannot be promoted to claim-support without receipt-bound proof.

### What's Working Well
- Clear forbidden-path boundaries prevent accidental command-surface or registry expansion.
- Acceptance criteria explicitly preserve failure-state distinctions (blocked vs unavailable vs not-attempted vs claim-failed), which is key for agent-operable diagnostics.
- Validation plan already includes targeted tests and lint checks for bounded implementation seams.

### Score
- **2/3 high-priority capabilities are fully agent-accessible**
- **Verdict:** NEEDS WORK (single discoverability contract gap)

### Accountability Receipt
- status: completed_with_findings
- artifact_paths:
  - artifacts/reviews/pu-031-spg-005-tool-exposure-intent-agent-native.md
- manifest_path: artifacts/agent-runs/agent-native-reviewer-019e6cc3-a587-76e3-850b-103aeaca6e65/manifest.json
- findings:
  - warning: runtime discoverability clause for SPG-005 projection is not explicit in this intent
- failures_or_blockers:
  - none
- improvement_opportunities:
  - add explicit runtime-card evidence discoverability requirement for SPG-005 acceptance
- strengths:
  - narrow scope boundaries
  - orientation-only policy consistency
  - explicit failure-state distinction requirements
- validation_evidence:
  - nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-031-spg-005-tool-exposure-projection-intent.json
  - nl -ba docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md (lines 206-227)
  - nl -ba docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml (lines 175-200)
  - nl -ba .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md (lines 962-971)
- next_action:
  - patch intent acceptance/validation text to require one agent-consumable runtime proof for SPG-005 projection
- useful_findings: 1
- avoided_false_positive:
  - Did not flag orientation-only design as a defect because claim-support rejection is already explicit.
- evidence_quality: medium_high (code-addressable line evidence across intent/goal/state/plan)
- followed_scope: yes (intent+context review only, no source edits)
- reusable_learning:
  - For intent-only slices, require at least one explicit agent-consumable proof path for any new projection surface.
- coordinator_score: 0.92
- uncertainty:
  - Could not verify runtime command behavior itself in this pre-implementation intent review; assessment is contract-text only.

WROTE: artifacts/reviews/pu-031-spg-005-tool-exposure-intent-agent-native.md

## Delta Review (Patched Intent)

### Delta Verdict
The prior discoverability gap is resolved. The patched intent now explicitly requires agent-consumable runtime-card discovery proof for codexRuntime.toolExposure and includes a concrete runtime-card command in the validation plan.

### Delta Findings

#### Resolved
1. **Runtime discoverability contract now explicit** -- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-031-spg-005-tool-exposure-projection-intent.json:47 adds a required fixture/command-evidence clause proving agent discoverability through runtime-card JSON output.
2. **Validation path now machine-runnable for discovery evidence** -- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-031-spg-005-tool-exposure-projection-intent.json:56 adds a concrete runtime-card --json --evidence command, closing the hidden human-inspection-only path.

#### Remaining Risks (Non-blocking)
1. **Evidence fixture path lifecycle should be kept deterministic** -- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-031-spg-005-tool-exposure-projection-intent.json:56 uses a specific artifact path; implementation should ensure the fixture is produced in-repo with stable provenance to avoid flaky validation ownership classification.

### Updated Score
- **3/3 high-priority capabilities are fully agent-accessible at intent-contract level**
- **Verdict:** PASS (intent delta closes material parity gap)

### Delta Accountability Receipt
- status: completed_delta_review
- artifact_paths:
  - artifacts/reviews/pu-031-spg-005-tool-exposure-intent-agent-native.md
- manifest_path: artifacts/agent-runs/agent-native-reviewer-019e6cc3-a587-76e3-850b-103aeaca6e65/manifest.json
- findings:
  - resolved: discoverability gap closed by acceptance criterion and validation command additions
- failures_or_blockers:
  - none
- improvement_opportunities:
  - keep SPG-005 evidence fixture provenance deterministic in implementation receipts
- strengths:
  - explicit agent-discoverable runtime-card proof path
  - maintained orientation-only boundary while adding operability proof
- validation_evidence:
  - nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-031-spg-005-tool-exposure-projection-intent.json (lines 42-57)
- next_action:
  - proceed to implementation with fixture-provenance ownership checks

WROTE: artifacts/reviews/pu-031-spg-005-tool-exposure-intent-agent-native.md
