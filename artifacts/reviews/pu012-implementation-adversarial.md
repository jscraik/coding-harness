# Adversarial Review - PU-012 Implementation

## Depth calibration
- Size estimate: Standard depth (approximately 50-199 changed lines across production files in scope).
- Risk signals: Runtime evidence admission and provenance gating for claim-supporting packets (data mutation of governance evidence surface).

## Findings

### 1) High - Stale Codex source can be admitted as valid runtime evidence because producer validates shape, not observed source freshness
- Severity: high
- Ownership: introduced by current patch
- Type: composition failure + cascade
- Evidence:
  - `buildCodexRuntimeEvidenceFromProducerInput` only runs packet-shape admission via `admitCodexRuntimeEvidencePacket`, and never compares pinned source snapshot against observed Codex checkout state ([src/lib/runtime/codex-runtime-evidence-producer.ts:100](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.ts:100), [src/lib/runtime/codex-runtime-evidence-producer.ts:103](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.ts:103)).
  - `validateCodexRuntimeSourceSnapshot` exists but is only exercised in tests and is not wired into producer admission/runtime path ([src/lib/runtime/codex-runtime-source-provenance.ts:48](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-source-provenance.ts:48), [src/lib/runtime/codex-runtime-source-provenance.test.ts:115](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-source-provenance.test.ts:115)).
  - Current codex-runtime validator checks source provenance fields for presence/classification but does not verify commit/blob correspondence to an observed checkout ([src/lib/runtime/codex-runtime-evidence-validation.ts:87](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-validation.ts:87), [src/lib/runtime/codex-runtime-evidence-validation.ts:131](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-validation.ts:131)).
- Constructed failure scenario:
  - Trigger: Codex checkout updates after intent snapshot capture (HEAD or blob changes), but producer input still carries old `commitSha` and old checksums.
  - Step 1: `buildCodexRuntimeEvidenceFromProducerInput` builds a packet with stale provenance values.
  - Step 2: `admitCodexRuntimeEvidencePacket` accepts it because schema-level checks pass.
  - Step 3: `adaptCodexRuntimeEvidenceToRuntimeEvidenceBundle` re-validates only shape and emits a bundle as if evidence were admissible.
  - Outcome: stale source assumptions propagate into runtime-card evidence as usable shape-valid inputs, violating the intent's fail-closed freshness policy.
- Short remediation:
  - Add an explicit producer-time hook that requires a successful `validateCodexRuntimeSourceSnapshot` (or equivalent observed checkout probe) before admission when source evidence is claim-supporting.

### 2) Medium - Permission snapshot can be marked usable with `workspace_write` but zero writable roots
- Severity: medium
- Ownership: introduced by current patch
- Type: assumption violation + abuse case
- Evidence:
  - Producer normalization allows `profile` and `network` to be non-unknown while `writableRoots` defaults to `[]` ([src/lib/runtime/codex-runtime-evidence-producer.ts:135](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.ts:135), [src/lib/runtime/codex-runtime-evidence-producer.ts:146](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.ts:146)).
  - Validator only requires `writableRoots` to be an array, not semantically non-empty for write-capable profiles ([src/lib/runtime/codex-runtime-evidence-validation.ts:205](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-validation.ts:205)).
  - Adapter maps non-unknown permission state to `status: usable` regardless of empty root set ([src/lib/runtime/codex-runtime-evidence-adapter.ts:96](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-adapter.ts:96), [src/lib/runtime/codex-runtime-evidence-adapter.ts:105](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-adapter.ts:105)).
- Constructed failure scenario:
  - Trigger: caller provides `profile: "workspace_write"` and omits/empties `writableRoots`.
  - Step 1: producer emits a shape-valid packet with empty roots and no failure class.
  - Step 2: adapter classifies permission source as usable/current (not blocked).
  - Outcome: downstream consumers see "usable write profile" without any writable scope evidence, enabling incorrect trust decisions about what filesystem mutations were actually possible.
- Short remediation:
  - Add semantic validation: require non-empty `writableRoots` for write-capable profiles (at least `workspace_write` and `escalated`), otherwise force unknown + failureClass.

## Validation ownership classification
- No gate failure artifacts were produced in this review pass.
- Classification field remains applicable per finding above; both findings are introduced by current patch in this PU-012 slice.

## Residual risks
- Failure-class strings are free-form and not enumerated; inconsistent taxonomy across producers can reduce blocker triage quality and cross-lane comparability.
- Source checksum values are only checked for non-empty strings, so malformed checksum formats can still pass admission.

WROTE: artifacts/reviews/pu012-implementation-adversarial.md
