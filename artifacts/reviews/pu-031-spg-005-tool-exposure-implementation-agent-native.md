## Agent-Native Architecture Review

### Summary
SPG-005 adds a bounded tool-exposure projection path that is agent-consumable through existing runtime-card JSON (codexRuntime.toolExposure) and enforces orientation-only semantics in the snapshot contract. Overall parity is good: the agent can discover sandbox/approval/network posture and compact tool exposure counts without raw payload leakage. One schema-level gap remains for consumers that validate with JSON Schema only.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Inspect runtime capability posture (sandbox/approval/network/tool availability) | src/lib/runtime/runtime-card-codex-runtime.ts:16 and src/lib/runtime/runtime-evidence-adapter.ts:175 | runtime-card JSON output path (codexRuntime.toolExposure) | Unknown from reviewed scope | must-have | wired |
| Validate orientation-only tool exposure packet | src/lib/tool-exposure/validation.ts:500 | validateToolExposureSnapshot + projectToolExposureToRuntimeCard | n/a | must-have | wired |
| Detect and classify blocked permission attempts (closed taxonomy) | src/lib/tool-exposure/types.ts:42 and src/lib/tool-exposure/validation.ts:353 | tool-exposure snapshot validation | n/a | should-have | wired |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
1. **JSON-schema-only consumers can admit unbounded codexRuntime payloads** -- contracts/runtime-card.schema.json:195 -- The runtime-card schema leaves codexRuntime as additionalProperties: true, so a schema-only validator can accept oversized/raw nested payloads (including fields the TS validator would reject), weakening agent/runtime parity for downstream non-TS consumers. Impacted behavior: consumers that trust schema validation alone may ingest non-compact or unsafe codexRuntime blocks and miss SPG-005 projection boundaries. Remediation: add an explicit codexRuntime sub-schema for the compact projection (including toolExposure field contract) or a strict allowed-field guard schema that mirrors validateOptionalCodexRuntimeProjection. Confidence: 78. Validation ownership: pre-existing (outside the SPG-005 scoped files but directly affects projection contract enforcement).

#### Observations
1. **Orientation-only posture is strongly encoded** -- src/lib/tool-exposure/validation.ts:542, contracts/tool-exposure-snapshot.schema.json:38 -- evidenceUse rejects claim-support promotion and snapshot requires runtimeStatus: not_yet_emitted.
2. **Raw payload/path/secret suppression is explicit and tested** -- src/lib/tool-exposure/validation.ts:20, src/lib/tool-exposure/validation.ts:35, src/lib/tool-exposure/tool-exposure-snapshot.test.ts:68.
3. **Runtime-card discoverability exists through current agent-facing surface** -- src/lib/runtime/runtime-card-codex-runtime.ts:16, src/lib/runtime/runtime-card-codex-runtime-projection.test.ts:164.

### What's Working Well
- Closed blocked-permission taxonomy is defined and enforced (types.ts plus validation enum checks).
- Key tool-name projection is bounded with deterministic truncation limits (TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT and summary consistency checks).
- Schema/example/manifest registration for tool-exposure-snapshot/v1 is present and coherent.
- Runtime-card validation rejects raw embeddings and enforces projection consistency against source refs.

### Score
- **3/3 high-priority capabilities are agent-accessible**
- **Verdict:** NEEDS WORK (schema-level hardening for JSON-schema-only consumers)

### Accountability Receipt
- status: completed_with_findings
- artifact_paths: artifacts/reviews/pu-031-spg-005-tool-exposure-implementation-agent-native.md
- manifest_path: n/a (no manifest template or contract file found at instructed repo paths)
- findings: 1 warning, 0 critical
- failures_or_blockers: missing template path agents/templates/review-artifact.md in this checkout; proceeded with required artifact format and evidence
- improvement_opportunities: align runtime-card JSON schema strictness with TS runtime validator for codexRuntime/toolExposure
- strengths: orientation-only boundary enforcement, bounded key-name projection, blocked-permission taxonomy closure, runtime-card projection discoverability
- validation_evidence:
  - zsh -lc 'nl -ba src/lib/tool-exposure/validation.ts | sed -n "1,760p"'
  - zsh -lc 'nl -ba src/lib/runtime/runtime-card-codex-runtime-projection.test.ts | sed -n "130,320p"'
  - zsh -lc 'nl -ba contracts/tool-exposure-snapshot.schema.json | sed -n "1,320p"'
  - zsh -lc 'nl -ba contracts/runtime-packet-schemas.manifest.json | sed -n "118,127p"'
  - zsh -lc 'nl -ba contracts/runtime-card.schema.json | sed -n "193,197p"'
- next_action: tighten runtime-card codexRuntime schema contract or document TS-only validation requirement for all consumers.
- useful_findings: schema/validator strictness mismatch at runtime-card codexRuntime boundary
- avoided_false_positive: did not flag hidden tool-name omission as defect because SPG-005 explicitly requires compact, non-registry projection
- evidence_quality: high for scoped files; medium for schema hardening recommendation because it touches cross-surface validator assumptions
- followed_scope: yes (read-only review over requested files, plus one adjacent contract file for enforcement parity)
- reusable_learning: compact projection contracts should be strict in both runtime validators and published JSON schemas to keep agent-native parity portable
- coordinator_score: 0.86

WROTE: artifacts/reviews/pu-031-spg-005-tool-exposure-implementation-agent-native.md

