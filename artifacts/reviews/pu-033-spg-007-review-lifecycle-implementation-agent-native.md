## Agent-Native Architecture Review

### Summary
ReviewLifecycle/v1 is mostly wired as an orientation/audit packet with explicit non-authoritative posture (`runtimeStatus: not_yet_emitted`, semantic validator in manifest, and no closeout command wiring in this slice). However, one high-severity lineage-authentication gap remains: the validator can accept self-certified implementation-produced artifacts if role and producer are forged to the same non-independent identity. There is also a schema/semantic/TS parity drift risk in the standalone semantic validator that can mask mistakes when used outside the manifest+schema path.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Discover ReviewLifecycle contract and validator | contracts/runtime-packet-schemas.manifest.json | schema + semantic validator pointers | n/a | Must-have | Pass |
| Project tool-exposure state classes | src/lib/review-state/review-lifecycle.ts | validateReviewLifecyclePacket | n/a | Should-have | Pass |
| Prove independent reviewer artifact lineage | src/lib/review-state/review-lifecycle.ts | validateReviewLifecyclePacket | n/a | Must-have | **Gap** |

### Findings

#### Critical (Must Fix)
1. **Self-certified artifact lineage can pass with forged non-independent role/producer** -- src/lib/review-state/review-lifecycle.ts:499, src/lib/review-state/review-lifecycle.ts:504, src/lib/review-state/review-lifecycle.ts:595, src/lib/review-state/review-lifecycle.ts:628
Impacted behavior: The implementation only enforces `entry.role === entry.producer` and role coverage consistency. It does not enforce that this identity is an allowed independent reviewer role or distinct from implementation producers (for example `harness:*`). A packet can set `artifactLineage[].role`, `artifactLineage[].producer`, and coverage roles all to the same self-certified implementation identity and still satisfy pass-verdict gates.
Why this matters for agent-native parity: this weakens machine-verifiable artifact-first proof and allows user- or implementation-side assertions to masquerade as independent review evidence.
Remediation: Add explicit independence policy checks in validator and schema/fixtures (for example deny implementation-prefixed producers and/or enforce membership in an approved reviewer role allowlist emitted from reviewer-role inventory). Add a test where `role===producer===harness:review-lifecycle` with aligned coverage/verdict and assert invalid.
Confidence: 90
Validation ownership: introduced_by_current_patch
Validation owner next step: review-state slice owner

#### Warnings (Should Fix)
1. **Semantic validator is weaker than TS validator for several fields** -- scripts/validate-review-lifecycle.cjs:325, scripts/validate-review-lifecycle.cjs:345, src/lib/review-state/review-lifecycle.ts:367, src/lib/review-state/review-lifecycle.ts:386
Impacted behavior: `validate-review-lifecycle.cjs` checks `mode.status` but not `mode.kind`, `mode.startedAt/completedAt`, and omits explicit `reviewer` object validation. Schema catches many of these in manifest-driven runs, but direct semantic-validator use can produce false confidence and drift from TS validation semantics.
Remediation: Either (a) call into shared TS validator from semantic script build artifact, or (b) mirror the missing checks in CJS and add parity tests that intentionally violate `mode.kind` and reviewer fields.
Confidence: 80
Validation ownership: introduced_by_current_patch
Validation owner next step: runtime packet validator owner

### Observations
1. `review-lifecycle/v1` remains explicitly non-authoritative in this slice (`runtimeStatus: not_yet_emitted`; manifest marks not emitted) -- contracts/runtime-packet-schemas.manifest.json:134, contracts/runtime-packet-schemas.manifest.json:135.

### What's Working Well
- Artifact receipt checks are strong on freshness, head SHA binding, claim-support evidence-use, and positive size validation.
- Tool exposure classification captures `visible`, `deferred`, `hidden`, `unavailable`, and `policyBlocked` states and is enforced by both TS and semantic validators.
- Runtime packet schema manifest includes `semanticValidatorPath` for review-lifecycle discoverability.

### Score
- **2/3 high-priority capabilities are agent-accessible with robust machine-proof**
- **Verdict:** NEEDS WORK

### Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/agent-native-reviewer-019e6d57-7772-77d3-b0dc-0a17ad053b31/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-033-spg-007-review-lifecycle-implementation-agent-native.md
- findings:
  - critical: self-certified lineage can pass when role/producer/coverage are forged to same implementation identity
  - warning: semantic validator parity drift versus TS validator
- failures_or_blockers:
  - missing referenced template path `agents/templates/review-artifact.md` in this checkout; used required contract fields directly
- improvement_opportunities:
  - add independent reviewer-role allowlist or denylist policy
  - share one validation core between TS and semantic validator script
- strengths:
  - explicit orientation-only runtime posture
  - rich lineage receipt checks for freshness/head SHA/evidence-use/size
- validation_evidence:
  - inspected source and tests in review-state module, semantic validator script, runtime packet manifest, and schema/example files
- useful_findings:
  - found a concrete bypass path for independent-review proof semantics
- avoided_false_positive:
  - did not flag non-authoritative posture regression because manifest/runtime status remains advisory-only
- evidence_quality:
  - line-level static analysis across validator, tests, schema manifest; no runtime mutation required
- followed_scope: yes (read-only review of assigned PU-033 SPG-007 files)
- reusable_learning:
  - identity equality checks are insufficient for reviewer-independence proofs; policy-bound role provenance is required
- coordinator_score: 0.85
- next_action:
  - patch validator and tests for independent reviewer provenance enforcement, then rerun packet-schema and review-state test lanes

WROTE: artifacts/reviews/pu-033-spg-007-review-lifecycle-implementation-agent-native.md
