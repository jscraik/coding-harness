## Agent-Native Architecture Review

### Summary
Re-review of PU-035/SPG-009 confirms the previously reported agent-native gaps are addressed. ArtifactRuntimeSurface/v1 remains a narrow, contract-only packet with strong semantic guardrails, and the standalone validator now enforces unknown-field rejection and live-HEAD checks in claim-support mode without broadening authority into runtime emission or delivery-truth composition.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Validate artifact runtime surface contract semantics | scripts/validate-artifact-runtime-surface.cjs | `node scripts/validate-artifact-runtime-surface.cjs <packet> --repo-root <repo>` | N/A | Must-have | Covered |
| Validate TypeScript packet invariants | src/lib/artifact-runtime-surface/validation.ts | `validateArtifactRuntimeSurface()` | N/A | Must-have | Covered |
| Discover packet in runtime manifest | contracts/runtime-packet-schemas.manifest.json | `packets[]` entry | N/A | Should-have | Covered (consistent with manifest contract for not_yet_emitted packets) |

### Findings

#### Critical (Must Fix)
1. None.

#### Warnings (Should Fix)
1. None.

#### Observations
1. Unknown-field rejection is now present in the standalone validator for packet and nested objects, including verifier refs and blockers (`scripts/validate-artifact-runtime-surface.cjs:133-157`).
2. Claim-support packets are now checked against live repository HEAD via `--repo-root` and fail when `currentHeadSha` diverges (`scripts/validate-artifact-runtime-surface.cjs:100-109`, `200-217`).
3. Secret-like value detection is expanded consistently across TS and CJS validators to cover GitHub tokens, Slack tokens, AWS/API key signatures, JWT-like strings, and Bearer-style values (`src/lib/artifact-runtime-surface/validation-constants.ts:125-126`, `scripts/validate-artifact-runtime-surface.cjs:21-22`).
4. The checked-in example is now audit-trail oriented, while claim-support expectations are tested with synthesized live-head packets, preventing fixture drift across commits (`contracts/examples/artifact-runtime-surface.example.json:7-10`, `src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts:49-61`).

### What's Working Well
- Contract remains pointer-only and non-authoritative (`runtimeStatus: not_yet_emitted`), preserving agent-native architecture boundaries.
- CJS and TS validators are aligned on leakage prevention and claim-support fail-closed behavior.
- Tests cover symlink escape, live-head mismatch, unknown fields, unsafe paths, preview applicability, and secret-like value rejection.

### Validation Evidence
- `node scripts/validate-artifact-runtime-surface.cjs contracts/examples/artifact-runtime-surface.example.json --repo-root .` -> pass
- `pnpm vitest run src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot` -> pass (36/36)

### Score
- **3/3 high-priority capabilities are agent-accessible**
- **Verdict:** PASS

### Accountability Receipt
- status: completed_no_material_findings
- manifest_path: n/a (review-only artifact update)
- artifact_paths:
  - artifacts/reviews/pu-035-spg-009-artifact-runtime-surface-agent-native.md
- findings:
  - none
- failures_or_blockers:
  - none
- improvement_opportunities:
  - none required for this slice
- strengths:
  - fail-closed claim-support semantics, live-head verification, unknown-field rejection, and value-level leakage controls
- validation_evidence:
  - command outputs listed above; all pass
- next_action:
  - proceed with coordinator closeout for this reviewer lane
- useful_findings:
  - 0 (no remaining defects after fixes)
- avoided_false_positive:
  - retained manifest `typeSourcePath: null` as compliant with runtime-packet manifest contract for `not_yet_emitted` entries
- evidence_quality:
  - high (line-referenced code and rerun validation commands)
- followed_scope:
  - yes
- reusable_learning:
  - for contract-only packets, keep fixture examples audit-trail safe and exercise claim-support semantics in generated test packets tied to live HEAD
- coordinator_score:
  - 10/10

WROTE: artifacts/reviews/pu-035-spg-009-artifact-runtime-surface-agent-native.md
