# PU-030 / SPG-004 Post-fix Re-review (best-practices-researcher)

## Status
STATUS: complete

## Scope
- src/lib/steering-queue/**
- contracts/steering-queue.schema.json
- contracts/examples/steering-queue.example.json
- scripts/validate-steering-queue.cjs
- contracts/runtime-packet-schemas.manifest.json
- src/dev/validate-runtime-packet-schemas-script.test.ts
- Governance/docs/diagram/intent surfaces listed by coordinator

## Findings (Severity-ranked)
- Severity: none
- Result: No blocking or non-blocking defects found in scoped post-fix requirements.

## Verification against requested post-fix points
1. One-scope-per-packet invariant blocks cross-scope arbitration.
- Evidence: src/lib/steering-queue/validation.ts:109-127 adds validateSingleScope and emits multiple_scopes.
- Evidence: src/lib/steering-queue/steering-queue.test.ts:216-229 includes explicit cross-scope rejection test.
- Impacted behavior: Prevents multi-scope blending in a single packet.
- Remediation: none required.
- Confidence: high.
- Validation ownership: introduced by current patch (verified working).

2. Supersession graph cycles fail semantic validation.
- Evidence: src/lib/steering-queue/validation.ts:129-176 detects cycles via DFS and emits supersession_cycle.
- Evidence: src/lib/steering-queue/steering-queue.test.ts:231-245 asserts cycle rejection.
- Impacted behavior: Prevents cyclic supersession from creating unstable winner selection semantics.
- Remediation: none required.
- Confidence: high.
- Validation ownership: introduced by current patch (verified working).

3. Duplicate conflicting instructionSource refs fail closed as instruction_hash_unverifiable.
- Evidence: src/lib/steering-queue/builder.ts:77-90 marks duplicate instructionRef with conflicting text as null.
- Evidence: src/lib/steering-queue/builder.ts:157-166 turns missing/null source into instruction_hash_unverifiable.
- Evidence: src/lib/steering-queue/steering-queue.test.ts:247-278 covers duplicate conflicting source refs.
- Impacted behavior: Fails closed when provenance is ambiguous, preventing stale/unsafe continuation assumptions.
- Remediation: none required.
- Confidence: high.
- Validation ownership: introduced by current patch (verified working).

4. Split module shape preserved with facade.
- Evidence: src/lib/steering-queue/steering-queue.ts:1-5 keeps facade exports only.
- Evidence: behavior split observed in:
  - src/lib/steering-queue/builder.ts
  - src/lib/steering-queue/validation.ts
  - src/lib/steering-queue/validation-item.ts
  - src/lib/steering-queue/validation-helpers.ts
  - src/lib/steering-queue/hash.ts
  - src/lib/steering-queue/types.ts
  - src/lib/steering-queue/constants.ts
- Impacted behavior: Maintains deep-module boundaries and avoids oversized monolith regression.
- Remediation: none required.
- Confidence: high.
- Validation ownership: introduced by current patch (verified working).

5. Validation evidence claims.
- Evidence command: pnpm vitest run src/lib/steering-queue/steering-queue.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot
- Result: 2 files, 27 passed tests.
- Evidence command: node scripts/validate-runtime-packet-schemas.cjs --all
- Result: pass, packetCount 12.
- Evidence command: node scripts/validate-steering-queue.cjs contracts/examples/steering-queue.example.json
- Result: pass.
- Evidence command: pnpm typecheck
- Result: pass.
- Evidence command: pnpm run quality:size
- Result: pass with ratchet warnings in unrelated files.
- Evidence command: pnpm run quality:docstrings
- Result: pass.
- Impacted behavior: Confirms claimed validation outcomes are reproducible for this slice.
- Remediation: none required in scope.
- Confidence: high.
- Validation ownership: mixed; unrelated quality:size warnings are pre-existing outside scoped files.

## Residual risk
- Low: quality:size emits ratchet warnings in unrelated modules; they are non-blocking and out-of-scope for this steering-queue postfix review.

## Accountability receipt
- status: complete
- manifest_path: artifacts/agent-runs/best-practices-researcher-postfix-steering-queue/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-030-spg-004-steering-queue-postfix-best-practices-researcher.md
  - artifacts/agent-runs/best-practices-researcher-postfix-steering-queue/manifest.json
- findings:
  - useful_findings: 5 verification confirmations; 0 defects.
  - avoided_false_positive: Did not flag out-of-scope size-ratchet warnings as slice regressions.
  - evidence_quality: High (line-level + command-output corroboration).
  - followed_scope: Yes (scoped files and direct validators/tests only).
  - reusable_learning: Duplicate conflicting instruction source refs should fail closed via unverifiable-hash classification.
  - coordinator_score: strong (all required postfix points directly evidenced).
- failures_or_blockers: none
- improvement_opportunities:
  - Add a tiny negative semantic-validator fixture that combines multiple_scopes + supersession_cycle in one packet to guard multi-error reporting consistency.
- strengths:
  - Clear fail-closed semantics for ambiguous instruction provenance.
  - Deterministic selection + semantic guard rails covered by focused tests.
- validation_evidence:
  - pnpm vitest run src/lib/steering-queue/steering-queue.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot => 27 passed
  - node scripts/validate-runtime-packet-schemas.cjs --all => pass, packetCount 12
  - node scripts/validate-steering-queue.cjs contracts/examples/steering-queue.example.json => pass
  - pnpm typecheck => pass
  - pnpm run quality:size => pass (non-blocking unrelated warnings)
  - pnpm run quality:docstrings => pass
- next_action:
  - Coordinator can treat SPG-004 postfix invariants as re-verified for the scoped patch and proceed with synthesis.

WROTE: artifacts/reviews/pu-030-spg-004-steering-queue-postfix-best-practices-researcher.md
