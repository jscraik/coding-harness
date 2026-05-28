## Agent-Native Architecture Review

### Summary
The intent is well-scoped toward a review lifecycle packet and explicitly preserves orientation/audit-only boundaries instead of turning this slice into merge authority. The strongest gap is discoverability and runtime operability: the intent validates packet shape and semantics, but does not require a machine-readable projection/index path that lets agents reliably find and use ReviewLifecycle evidence in the same way a user can inspect lifecycle progress.

### Capability Map

| UI/User Action | Location | Agent Tool/Artifact Path | In Prompt/Goal Contract? | Priority | Status |
|---|---|---|---|---|---|
| Inspect review lifecycle status for current slice | `.harness/intent/...pu-033...json` | Proposed `ReviewLifecycle/v1` packet | Yes (`SPG-007`) | Must-have | Partial |
| Validate lifecycle evidence quality (freshness, unresolved threads, lineage) | Intent validation plan | `scripts/validate-review-lifecycle.cjs`, schema validators | Yes | Must-have | Covered |
| Discover where lifecycle packet lives for downstream agents | Goal/state contracts and this intent | No explicit runtime-card/evidence-bundle/index requirement in this intent | Partial | Must-have | Missing |
| Keep review lifecycle orientation-only (not merge/CI/Linear proof) | Intent constraints + goal policy | Blocked by constraints and acceptance criteria | Yes | Must-have | Covered |

### Findings

#### Warnings (Should Fix)
1. **ReviewLifecycle discoverability path is not explicit, creating an orphan evidence risk**
Severity: Warning
Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json:42-47` defines packet shape/semantics and non-authority boundaries, but there is no acceptance criterion requiring indexed/runtime-card discoverability or an artifact-surface pointer; `docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml:155` requires artifact runtime surfaces to be inspectable and steer execution/claims.
Impacted behavior: A packet can exist and validate while still being hard for agents to discover in active execution, leaving practical parity behind users who can navigate docs/artifacts manually.
Remediation: Add one acceptance criterion requiring ReviewLifecycle evidence to be discoverable through an existing machine-readable surface (for example runtime-card/evidence bundle pointer, artifact runtime surface reference, or receipt field with deterministic path/head SHA).
Confidence: 75
Validation ownership: introduced by current patch (intent contract gap).

2. **Tool exposure requirement is underspecified for parity-sensitive diagnostics**
Severity: Warning
Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json:36` limits role/tool exposure to compact textual form, and `:42` includes `toolExposure`, but acceptance criteria do not require classification of unavailable/deferred/blocked tool classes that are part of adopted parity expectations in `docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml:153` and `:187`.
Impacted behavior: Agents may not be able to explain why a reviewer verdict is blocked when capability visibility differs by runtime policy, reducing action/context parity in real investigations.
Remediation: Add a criterion that `toolExposure` must distinguish at least visible vs unavailable/deferred/policy-blocked classes (without leaking raw payloads/secrets).
Confidence: 70
Validation ownership: introduced by current patch (intent completeness gap).

### Observations
1. **Orientation-only boundary is clearly encoded** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json:34,47,82` strongly prevents this packet from becoming closeout or merge-readiness authority.
2. **Thread and lineage fail-closed semantics are strong** -- `:37-39,44` correctly require blocked/unknown outcomes for stale or unresolved review conditions, which protects against false-success review claims.

### What's Working Well
- Clear non-authority guardrails for ReviewLifecycle scope.
- Strong validation emphasis with explicit negative cases for stale/missing/unsafe evidence.
- Good alignment with SPG-007 adoption target in goal state.

### Score
- **3/4 high-priority capabilities are agent-accessible**
- **Verdict:** NEEDS WORK

## Accountability Receipt
- status: completed
- artifact_paths:
  - artifacts/reviews/pu-033-spg-007-review-lifecycle-intent-agent-native.md
- findings:
  - review lifecycle discoverability/indexing not explicit
  - tool exposure classification underspecified for parity diagnostics
- failures_or_blockers:
  - none
- improvement_opportunities:
  - bind ReviewLifecycle to a deterministic discoverability surface
  - require tool-exposure class granularity consistent with SPG-005/SPG-007 adoption constraints
- strengths:
  - explicit orientation-only boundary and fail-closed stale/unresolved handling
- validation_evidence:
  - `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json`
  - `nl -ba docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml`
  - `rg -n "SPG-007|tool exposure|ArtifactRuntimeSurface|review" docs/goals/codex-runtime-evidence-verifier-cockpit/*`
- next_action:
  - update intent acceptance criteria with explicit discoverability and tool-exposure classification rules before implementation

WROTE: artifacts/reviews/pu-033-spg-007-review-lifecycle-intent-agent-native.md
