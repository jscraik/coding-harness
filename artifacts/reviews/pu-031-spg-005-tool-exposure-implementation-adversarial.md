# Adversarial Review - PU-031 SPG-005 Tool Exposure Projection

## Findings (severity-ordered)

### 1) High - Snapshot/runtime composition allows forged or stale tool-exposure evidence to masquerade as current runtime proof
- Severity: high
- Validation ownership: introduced by current patch
- Evidence:
  - Trigger: producer injects a valid-looking `toolExposure` object from an older turn or different run while keeping current `sources` refs.
  - Execution path:
    - `buildCodexRuntimeProjection` forwards `bundle.toolExposure` verbatim into `codexRuntime.toolExposure` without binding it to `receiptRefs` or provenance (`src/lib/runtime/runtime-evidence-adapter.ts:175`).
    - `validateOptionalCodexRuntimeProjection` validates shape only and never enforces that `codexRuntime.toolExposure.evidenceRef` appears in `codexRuntime.receiptRefs` or `runtime-card.sources` (`src/lib/runtime/runtime-card-codex-runtime-validation.ts:293-302`).
    - `validateRuntimeCardToolExposureProjection` checks only field shape/enums/counters (`src/lib/tool-exposure/validation.ts:589-655`).
  - Failure outcome: runtime-card can present permission/tool posture that is disconnected from the actual evidence set for that card, causing operators to trust stale or foreign tool availability/permission state.
- Impacted behavior: runtime-card orientation can drift from its own evidence lane, weakening auditability and making blocked/unavailable posture non-reproducible.
- Remediation:
  - Require `codexRuntime.toolExposure.evidenceRef` to be present in `codexRuntime.receiptRefs` and `runtime-card.sources`.
  - Optionally enforce a provenance namespace rule (for example same turn/ref family) between `toolExposure.evidenceRef` and codex runtime provenance.
- Confidence: 75
- Validation ownership: coordinator + implementation owner

### 2) Medium - Truncation metadata can be internally contradictory while still validating in runtime projection
- Severity: medium
- Validation ownership: introduced by current patch
- Evidence:
  - Trigger: payload sets `keyToolNames` to 2 values, `originalKeyToolNameCount` to 200, and `namesTruncated=false`.
  - Execution path:
    - Runtime projection validator accepts non-negative counts and boolean but does not enforce cross-field invariants (`src/lib/tool-exposure/validation.ts:633-655`).
    - No check requires `originalKeyToolNameCount >= keyToolNames.length` with consistent `namesTruncated` semantics, nor that `namesTruncated=true` when original count exceeds projected count.
  - Failure outcome: card can claim "not truncated" while hiding most names, which undermines bounded-inventory truth and can mask exposure breadth.
- Impacted behavior: operator-facing compact summary can be semantically inconsistent even when syntactically valid.
- Remediation:
  - Add invariants in `validateRuntimeCardToolExposureProjection`:
    - `originalKeyToolNameCount >= keyToolNames.length`
    - `namesTruncated === (originalKeyToolNameCount > keyToolNames.length)`
    - optionally `keyToolNames.length <= TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT` already present, keep.
- Confidence: 75
- Validation ownership: implementation owner

### 3) Medium - Safe-pointer regex permits relative path leakage in pointer fields despite “no path list” intent
- Severity: medium
- Validation ownership: introduced by current patch
- Evidence:
  - Trigger: producer emits values like `Users/jamie/private.env` or `tmp/secrets/prod.env` in `keyToolNames`, `blockedBy`, or `failureClass`.
  - Execution path:
    - `SAFE_POINTER_PATTERN` permits slash-containing values that begin with alphanumeric (`src/lib/tool-exposure/validation.ts:16`).
    - `validateSafeString` uses this pattern and does not separately classify path-like values as forbidden (`src/lib/tool-exposure/validation.ts:131-154`).
  - Failure outcome: packet can carry filesystem-like breadcrumbs that violate orientation-only minimization and leak local structure.
- Impacted behavior: tool-exposure packet may drift toward path disclosure over time through otherwise "safe" fields.
- Remediation:
  - Reuse runtime-card reference hygiene (prefix allowlist/path classes) or add explicit path-shape rejection for tool-exposure string fields where paths are not required.
- Confidence: 50
- Validation ownership: implementation owner

## Residual Risks
- `evidenceUse` accepts `audit_trail` and `orientation`; if downstream consumers later treat `audit_trail` as claim support without an explicit gate, this surface can be over-trusted.
- Runtime-card tests assert absence of `/Users/` in one fixture, but no property-based/fuzz coverage exists for encoded or relative path variants.

## Testing Gaps
- Missing negative test: `codexRuntime.toolExposure.evidenceRef` not present in `receiptRefs` should fail.
- Missing negative tests for truncation invariant contradictions in runtime projection validator.
- Missing negative tests for relative path-like strings in tool-exposure safe fields.

## Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6cd3-0fc3-7563-923d-c2eb1a92f42c/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-031-spg-005-tool-exposure-implementation-adversarial.md
- findings:
  - high: 1
  - medium: 2
  - low: 0
- failures_or_blockers: none
- improvement_opportunities:
  - Bind toolExposure evidenceRef to receiptRefs/source refs.
  - Enforce projection truncation invariants.
  - Tighten pointer/path hygiene to block relative filesystem-like strings.
- strengths:
  - Clear orientation-only intent with explicit forbidden raw payload keys.
  - Closed blocked-permission reason taxonomy and required failure classes in snapshot validation.
  - Runtime-card projection keeps a compact, bounded shape and rejects explicit raw embedding fields.
- validation_evidence:
  - Source-read review of intent, projection, validation, runtime adapter, schema, example, and tests with exact line references in findings.
- useful_findings: 3
- avoided_false_positive:
  - Did not flag generic performance/style/test-density issues outside adversarial scope.
- evidence_quality: high (line-anchored, reproducible execution paths)
- followed_scope: yes
- reusable_learning:
  - Cross-field integrity checks are necessary whenever compact projections summarize bounded inventories.
- coordinator_score: 0.88
- next_action:
  - Add three failing tests for the listed gaps, then patch validators/adapters to enforce evidence binding and truncation consistency.

WROTE: artifacts/reviews/pu-031-spg-005-tool-exposure-implementation-adversarial.md

