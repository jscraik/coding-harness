STATUS: complete

# Adversarial Review - PU-033 SPG-007 ReviewLifecycle/v1 (Implementation)

## Findings (severity-ranked)

### 1) HIGH - Semantic validator accepts structurally invalid packets, creating schema/validator parity bypass
- Severity: high
- Validation ownership: introduced_by_current_patch
- Confidence: 100
- Evidence:
  - Schema forbids unknown top-level fields: `additionalProperties: false` at `contracts/review-lifecycle.schema.json:7`.
  - TS validator enforces unknown top-level rejection via `TOP_LEVEL_KEYS` scan at `src/lib/review-state/review-lifecycle.ts:43-61,210-214`.
  - CLI semantic validator does not enforce unknown top-level keys and still passes:
    - Command: `jq ". + {mergeReady:true}" ... | node scripts/validate-review-lifecycle.cjs ...`
    - Result: `unknown_exit:0`, `"status":"pass"` (captured in this run output).
  - CLI validator path: no equivalent top-level key allowlist in `scripts/validate-review-lifecycle.cjs:325-372`.
- Impacted behavior:
  - A packet can pass the semantic validator while violating the declared contract. Any pipeline or human workflow trusting `validate-review-lifecycle.cjs` as a gate can accept drifted or authority-like fields (e.g. `mergeReady`) that should be rejected.
- Remediation:
  - Add explicit top-level key allowlist enforcement in `scripts/validate-review-lifecycle.cjs` matching `TOP_LEVEL_KEYS` in TS validator and schema.
  - Add regression test(s) that mutate the example with unknown top-level fields and expect semantic validator failure.

### 2) HIGH - Semantic validator skips required `reviewer` object validation, enabling forged lineage context
- Severity: high
- Validation ownership: introduced_by_current_patch
- Confidence: 100
- Evidence:
  - Schema requires `reviewer` object with `role`, `producer`, `runManifestRef`: `contracts/review-lifecycle.schema.json:231-246` and required list at `8-26`.
  - TS validator validates reviewer object at `src/lib/review-state/review-lifecycle.ts:386-401`.
  - CLI semantic validator never validates `packet.reviewer` and passes packet with reviewer deleted:
    - Command: `jq "del(.reviewer)" ... | node scripts/validate-review-lifecycle.cjs ...`
    - Result: `noreviewer_exit:0`, `"status":"pass"`.
  - CLI validate flow has no reviewer call in `scripts/validate-review-lifecycle.cjs:325-372`.
- Impacted behavior:
  - A packet can claim pass verdict and artifact lineage while omitting reviewer identity/run-manifest context entirely, weakening forged/self-certified artifact detection and audit provenance.
- Remediation:
  - Add `validateReviewer` equivalent in semantic validator and invoke it during packet validation.
  - Add regression test covering missing/invalid reviewer fields in CLI semantic validation.

### 3) MEDIUM - Semantic validator does not validate `mode.kind`, allowing unsupported lifecycle modes to pass
- Severity: medium
- Validation ownership: introduced_by_current_patch
- Confidence: 100
- Evidence:
  - Schema enumerates allowed `mode.kind`: `contracts/review-lifecycle.schema.json:197-205`.
  - TS validator enforces mode kind enum at `src/lib/review-state/review-lifecycle.ts:375`.
  - CLI semantic validator only checks `mode.status` and never checks `mode.kind`:
    - Logic: `scripts/validate-review-lifecycle.cjs:345-349`
    - Command: `jq ".mode.kind = \"nonsense_mode\"" ... | node scripts/validate-review-lifecycle.cjs ...`
    - Result: `modekind_exit:0`, `"status":"pass"`.
- Impacted behavior:
  - Unsupported lifecycle modes can be treated as valid semantic packets, creating downstream interpretation ambiguity and potential authority creep via unrecognized states.
- Remediation:
  - Enforce `mode.kind` enum in CLI validator and add parity tests for invalid mode kinds.

## Residual Risks
- Self-certification is still trust-on-string: lineage independence currently relies on string equality checks (`role === producer`) and claim-support receipt metadata, not on cryptographic signer identity or filesystem-backed manifest/artifact existence checks.
- There is no dedicated test suite for `scripts/validate-review-lifecycle.cjs`; parity with TS/schema is currently incidental and can drift silently.

## Validation Evidence
- Static evidence inspection:
  - `contracts/review-lifecycle.schema.json`
  - `scripts/validate-review-lifecycle.cjs`
  - `src/lib/review-state/review-lifecycle.ts`
- Reproduction commands executed:
  - Unknown top-level field bypass (`mergeReady`) -> semantic validator returned pass.
  - Missing `reviewer` bypass -> semantic validator returned pass.
  - Invalid `mode.kind` bypass -> semantic validator returned pass.

## Accountability Receipt
- status: complete
- manifest_path: n/a (no reviewer run manifest was produced in this review task)
- artifact_paths:
  - artifacts/reviews/pu-033-spg-007-review-lifecycle-implementation-adversarial.md
- findings:
  - 3 (high: 2, medium: 1)
- failures_or_blockers:
  - none
- improvement_opportunities:
  - Add dedicated CLI semantic-validator tests for review-lifecycle packet parity and negative cases.
  - Consider stronger provenance checks for independent reviewer identity beyond string matching.
- strengths:
  - TS validator and schema already encode strong constraints (unknown field rejection, reviewer presence, mode kind enum, receipt-level checks).
  - Intent and acceptance criteria clearly preserve orientation-only authority boundary.
- validation_evidence:
  - Concrete command-level reproductions with pass-on-invalid outcomes.
- next_action:
  - Align `scripts/validate-review-lifecycle.cjs` with schema + TS validator, then add regression tests in `src/dev/validate-runtime-packet-schemas-script.test.ts` or dedicated validator tests.
- useful_findings: 3
- avoided_false_positive: Did not flag closeout-authority leakage in runtime packet manifest; `runtimeStatus` remains `not_yet_emitted` and no closeout wiring touched in scoped files.
- evidence_quality: high (direct code-path evidence plus executable reproductions)
- followed_scope: yes (only assigned files reviewed)
- reusable_learning: Semantic CLI validators need explicit parity tests against schema + TS validators; otherwise orientation packets can gain silent bypass channels.
- coordinator_score: strong signal, actionable remediations

WROTE: artifacts/reviews/pu-033-spg-007-review-lifecycle-implementation-adversarial.md
