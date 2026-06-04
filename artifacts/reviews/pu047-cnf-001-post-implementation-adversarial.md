head_sha: 50a6d0b5d764e35395e12190a465e854c26784fd

# PU-047 CNF-001 Post-Implementation Adversarial Review

## Findings

No material findings.

The reviewed patch keeps Codex user-message correlation bounded to explicit evidence instead of inventing a surrogate identity. The runtime producer accepts `clientUserMessageId` only as optional producer input and serializes missing values to `null` at [src/lib/runtime/codex-runtime-evidence-producer.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.ts:51) and [src/lib/runtime/codex-runtime-evidence-producer.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.ts:137). Runtime validation accepts only a nullable non-empty string at [src/lib/runtime/codex-runtime-evidence-validation.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-validation.ts:170), which prevents empty-string claim support.

The steering-queue changes add the same-message boundary in the deep module rather than in command facades or docs. Packet context now carries `clientUserMessageId` at [src/lib/steering-queue/builder.ts](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/builder.ts:38), and stale current-message mismatches are classified as `stale_client_user_message` at [src/lib/steering-queue/builder.ts](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/builder.ts:147). Applied-item validation rejects both missing and mismatched applied message IDs when the item expected one at [src/lib/steering-queue/validation-item.ts](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/validation-item.ts:233) and [src/lib/steering-queue/validation-item.ts](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/validation-item.ts:245). The standalone semantic validator mirrors those checks at [scripts/validate-steering-queue.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-steering-queue.cjs:318) and [scripts/validate-steering-queue.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-steering-queue.cjs:329), reducing schema-validator drift risk.

The JSON Schema requires the new packet and item fields and includes the new stale kind at [contracts/steering-queue.schema.json](/Users/jamiecraik/dev/coding-harness/contracts/steering-queue.schema.json:16), [contracts/steering-queue.schema.json](/Users/jamiecraik/dev/coding-harness/contracts/steering-queue.schema.json:94), [contracts/steering-queue.schema.json](/Users/jamiecraik/dev/coding-harness/contracts/steering-queue.schema.json:129), and [contracts/steering-queue.schema.json](/Users/jamiecraik/dev/coding-harness/contracts/steering-queue.schema.json:137). Tests cover explicit producer propagation, missing producer input staying null, stale-message classification, missing applied IDs, and mismatched applied IDs at [src/lib/runtime/codex-runtime-evidence-producer.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.test.ts:15), [src/lib/runtime/codex-runtime-evidence-producer.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.test.ts:71), [src/lib/steering-queue/steering-queue.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.test.ts:105), [src/lib/steering-queue/steering-queue.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.test.ts:356), and [src/lib/steering-queue/steering-queue.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.test.ts:376).

Documentation does not overstate runtime support. AGENTS states that nullable client user-message IDs must come from explicit producer input and must not be synthesized from adjacent fields at [AGENTS.md](/Users/jamiecraik/dev/coding-harness/AGENTS.md:262). ARCHITECTURE places the runtime identity work in `src/lib/runtime/` and same-thread steering correlation in `src/lib/steering-queue/` at [ARCHITECTURE.md](/Users/jamiecraik/dev/coding-harness/ARCHITECTURE.md:106) and [ARCHITECTURE.md](/Users/jamiecraik/dev/coding-harness/ARCHITECTURE.md:205).

## Residual Risks

- Live Codex Desktop extraction is not proven by this slice. The implementation adds contract fields and validation, but the producer still needs a real upstream/runtime source before `clientUserMessageId` can support live runtime claims.
- Delivery-truth, Judge/PM readiness, merge-readiness, and goal-completion claims remain unproven. The reviewed code is intentionally advisory/contract-level and does not wire client-message evidence into those broader truth lanes.
- The E2E `pnpm test:deep` lane is blocked by credential/runtime environment availability according to the coordinator evidence. Passing unit, contract, typecheck, lint, and docs gates do not prove external runtime behavior.
- This review was performed against the local uncommitted diff. Remote PR, CI, CodeRabbit, Linear, and branch-protection state are separate lanes and require fresh evidence before any merge-ready claim.

## Validation Ownership

- Current patch: Runtime producer propagation, runtime nullable validation, steering-queue stale-message classification, applied-item semantic validation, schema field presence, standalone validator parity, and focused unit coverage are owned by this patch and show no material adversarial finding in the inspected diff.
- Requires implementation/runtime testing: Live Codex Desktop message ID extraction, runtime-card producer emission from actual desktop events, and any downstream delivery-truth consumption are not proven by this patch.
- Environment or tooling failure: The `pnpm test:deep` credential/runtime blocker and prior subagent artifact-production failures are environment/tooling gates, not evidence that the local contract implementation is wrong.
- External state: PR checks, review threads, Linear issue status, and mergeability are outside this local review artifact and must be refreshed independently.

WROTE: artifacts/reviews/pu047-cnf-001-post-implementation-adversarial.md
