# Adversarial Closure Review: PU-021 GAP-003 Public Packet Schemas

## Scope
- scripts/validate-runtime-packet-schemas.cjs
- src/dev/validate-runtime-packet-schemas-script.test.ts
- contracts/runtime-packet-schemas.manifest.json
- contracts/*.schema.json
- contracts/examples/**/*.json

## Depth
- Size estimate: Standard-depth surface (validator logic + tests; under 200 changed lines in touched areas).
- Risk signals: data-validation control-plane path.

## Findings (severity-ranked)

### 1) MEDIUM - External \`\$ref\` with fragment crashes validator before fail-report emission
- Severity: medium
- File:line:
  - scripts/validate-runtime-packet-schemas.cjs:117
  - scripts/validate-runtime-packet-schemas.cjs:120
  - scripts/validate-runtime-packet-schemas.cjs:95
  - scripts/validate-runtime-packet-schemas.cjs:98
- Impacted behavior:
  - Validator assumes non-local \`\$ref\` is a plain filesystem path.
  - When schema authors use valid JSON Schema external refs with fragments (for example \`ref-target.schema.json#/properties/kind\`), the script resolves and opens the literal string as a path, causing \`ENOENT\`.
  - This aborts execution with process exit 2 (runtime error) rather than a deterministic JSON fail report (\`status: "fail"\`), which can break CI/reporting consumers expecting structured output.
- Constructed failure scenario (adversarial chain):
  1. Trigger: manifest schemaPath points to a schema containing \`"\$ref": "ref-target.schema.json#/properties/kind"\`.
  2. Execution path: \`validateSupportedSchemaKeywords\` sees non-\`#\` ref and resolves \`dirname(schemaPath) + ref\` (includes fragment).
  3. Boundary mismatch: \`loadJson(referencedSchemaPath)\` treats \`#...\` as part of filename.
  4. Failure: \`ENOENT: no such file or directory\` thrown, caught only at top-level \`main()\`, process exits 2.
  5. Outcome: validator emits runtime error path instead of schema-validation failure payload.
- Evidence:
  - Command:
    - \`node scripts/validate-runtime-packet-schemas.cjs --manifest <temp manifest with ref-target.schema.json#/properties/kind>\`
  - Output:
    - \`ENOENT: no such file or directory, open /tmp/ref-frag-SwQzsu/ref-target.schema.json#/properties/kind\`
    - \`EXIT:2\`
- Remediation:
  - Parse external refs into \`file\` + optional \`fragment\` components before file read.
  - Load only the file component.
  - If a fragment exists, resolve pointer against loaded JSON object.
  - Ensure this path still reports unsupported-keyword failures through \`errors[]\` with \`status: "fail"\` rather than throwing.
  - Add regression test: external \`\$ref\` with fragment containing unsupported keyword in fragment target.
- Confidence: 100
- Validation ownership: introduced by current patch
- Autofix class: manual
- Owner: downstream-resolver

## Closure on prior finding
- Prior bypass status: fixed.
- Confirmation:
  - New recursive scan follows local sibling \`\$ref\` during keyword support checks.
  - Added regression test in src/dev/validate-runtime-packet-schemas-script.test.ts covering referenced schema with unsupported \`oneOf\`.
  - Scenario now fails as expected.

## Residual risks
- Ref resolution currently supports only plain local file refs robustly; mixed file+fragment refs remain crash-prone until remediated.

## Testing gaps
- Missing test for external \`\$ref\` with JSON Pointer fragment in both:
  - supported-keyword scanner path
  - example-value validation path

## Accountability receipt
- status: completed_with_findings
- artifact_paths:
  - artifacts/reviews/pu-021-gap-003-public-packet-schemas-closure-adversarial.md
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6871-524e-74b3-8cd7-5203d9febcc6/manifest.json
- findings:
  - 1 medium finding
- failures_or_blockers:
  - none
- improvement_opportunities:
  - normalize external \`\$ref\` parsing and fragment-pointer traversal
  - add fragment-aware regression coverage
- strengths:
  - prior local sibling \`\$ref\` unsupported-keyword bypass is now closed
  - regression test added for referenced-schema unsupported keyword
- validation_evidence:
  - targeted repro command produced deterministic crash evidence (\`EXIT:2\`)
- useful_findings:
  - 1
- avoided_false_positive:
  - confirmed original bypass is fixed before raising new issue
- evidence_quality:
  - high (direct repro + line-level path trace)
- followed_scope:
  - yes
- reusable_learning:
  - schema validators should treat \`\$ref\` as URI-like references, not raw filesystem paths
- coordinator_score: strong signal for one material edge case remaining
- next_action:
  - implement fragment-aware external \`\$ref\` handling and add regression test; rerun schema validator + test file

WROTE: artifacts/reviews/pu-021-gap-003-public-packet-schemas-closure-adversarial.md
