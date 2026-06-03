head_sha: 50a6d0b5d764e35395e12190a465e854c26784fd

# PU-047 CNF-001 Post-Implementation Best-Practices Review

## Findings

No material findings.

The implementation keeps the correlation contract narrow and evidence-bound. Runtime identity adds `clientUserMessageId` as nullable state, not a derived or authority-bearing value, in `CodexRuntimeIdentity` at `src/lib/runtime/codex-runtime-evidence-types.ts:109` and `src/lib/runtime/codex-runtime-evidence-types.ts:116`. The producer only carries explicit input through to the packet and defaults missing input to `null` at `src/lib/runtime/codex-runtime-evidence-producer.ts:45`, `src/lib/runtime/codex-runtime-evidence-producer.ts:52`, and `src/lib/runtime/codex-runtime-evidence-producer.ts:134`. Validation treats the field as a nullable non-empty string at `src/lib/runtime/codex-runtime-evidence-validation.ts:168` and `src/lib/runtime/codex-runtime-evidence-validation.ts:170`, which avoids inventing adjacent-field inference while still rejecting malformed non-null ids.

The steering-queue side keeps the same-thread correlation inside the deep module rather than spreading it through command facades. The packet and evaluation input carry `clientUserMessageId` at `src/lib/steering-queue/types.ts:82`, `src/lib/steering-queue/types.ts:92`, `src/lib/steering-queue/types.ts:114`, and `src/lib/steering-queue/types.ts:122`; queued items carry expected and applied ids at `src/lib/steering-queue/types.ts:39`, `src/lib/steering-queue/types.ts:54`, and `src/lib/steering-queue/types.ts:62`. The builder records stale preconditions when expected and current client message ids differ at `src/lib/steering-queue/builder.ts:128`, `src/lib/steering-queue/builder.ts:146`, and `src/lib/steering-queue/builder.ts:150`. The semantic validator requires applied items that expected a client user-message id to record the applied id and rejects mismatches at `src/lib/steering-queue/validation-item.ts:233`, `src/lib/steering-queue/validation-item.ts:238`, `src/lib/steering-queue/validation-item.ts:245`, and `src/lib/steering-queue/validation-item.ts:251`.

Schema and standalone validator alignment are present. The runtime semantic validator accepts the new packet field at `src/lib/steering-queue/validation.ts:65` and `src/lib/steering-queue/validation.ts:68`; the standalone validator mirrors the packet key, item keys, stale kind, nullable pointer validation, and applied-state checks at `scripts/validate-steering-queue.cjs:48`, `scripts/validate-steering-queue.cjs:57`, `scripts/validate-steering-queue.cjs:64`, `scripts/validate-steering-queue.cjs:78`, `scripts/validate-steering-queue.cjs:86`, `scripts/validate-steering-queue.cjs:260`, `scripts/validate-steering-queue.cjs:293`, and `scripts/validate-steering-queue.cjs:318`. The focused tests cover the most important behavioral boundaries: absent runtime client-message ids stay valid without inference at `src/lib/runtime/codex-runtime-evidence.test.ts:33`, explicit producer input is preserved at `src/lib/runtime/codex-runtime-evidence-producer.test.ts:15` and `src/lib/runtime/codex-runtime-evidence-producer.test.ts:45`, missing producer input defaults to null at `src/lib/runtime/codex-runtime-evidence-producer.test.ts:71` and `src/lib/runtime/codex-runtime-evidence-producer.test.ts:86`, stale steering is classified on client-message mismatch at `src/lib/steering-queue/steering-queue.test.ts:105`, and applied-state correlation is exercised at `src/lib/steering-queue/steering-queue.test.ts:192` and `src/lib/steering-queue/steering-queue.test.ts:203`.

## Residual Risks

- The slice proves contract shape, validation, and focused behavior. It does not prove a live Codex Desktop/browser/runtime producer can currently observe a real client user-message id.
- The field is not yet proven as delivery-truth claim support, Judge/PM readiness evidence, merge-readiness evidence, or a production runtime-card consumer input.
- End-to-end deep validation remains blocked by the credential/env lane recorded by the coordinator; this review does not treat focused tests or schema validation as proof of production runtime behavior.
- Independent review artifact recovery was required because earlier reviewer subprocesses did not persist artifacts. This artifact covers the best-practices lane only and does not substitute for the adversarial or agent-native review artifacts.

## Validation Ownership

- Introduced by current patch: no material best-practices defect found in the inspected runtime identity, producer, steering-queue validation, schema/standalone validator, or focused tests.
- Pre-existing: live Codex Desktop client user-message id extraction is not implemented or proven by this slice; the change correctly models absence as `null` instead of synthesizing a value.
- Unrelated dirty worktree: none identified in the inspected diff.
- Environment or tooling failure: post-implementation reviewer artifact persistence was blocked in earlier subagent attempts; the E2E `pnpm test:deep` lane is environment/credential-blocked per the coordinator evidence, not proven as a current patch regression.

WROTE: artifacts/reviews/pu047-cnf-001-post-implementation-best-practices.md
