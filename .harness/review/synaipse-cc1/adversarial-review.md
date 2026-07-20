# SynAIpse CC1 Adversarial Review

## Attestation

- **Role:** fresh Adversarial Review.
- **Target:** `f2de738ff0cef0c036b2f48ab3ba06f3a5157208` on `codex/synaipse-cc1-effects`; baseline `bfe275b09244cd44c63ae4cbb641b3630056d04f`.
- **Packet:** `.harness/intent/2026-07-19-synaipse-cc1-adversarial-packet.json`, SHA-256 `37a1f4f4eb3d91a9d0e99404020c162db8baa2801e6a000cd3f8d07aa38c7725`.
- **Instruction chain:** root `AGENTS.md`, `src/AGENTS.md`, `contracts/AGENTS.md`, `CODESTYLE.md`, TypeScript, testing, and review standards.
- **Lenses:** agent-native command/current-head evidence, architecture seam, deterministic test proof, malformed-input probe, and producer-consumer compatibility.
- **Runtime limitation:** workforce policy requested `gpt-5.6-luna` with xhigh reasoning. This review ran as the available `gpt-5.6-terra` with xhigh reasoning; Luna availability is not claimed.

## Compatibility matrix

| Path | Outcome | Evidence |
| --- | --- | --- |
| Runtime `harness next` producers | Pass: all route through `createNextDecision`. | `src/commands/next-*.ts` |
| Legacy packet canonicalizer | Compatible: it uses `buildHarnessDecision` only to create SynAIpse state, not a `harness next` recommendation envelope. | `src/lib/synaipse/packet-canonicalization.ts:82-100` |
| Current invocation | Pass: invocation effects remain strict pure-read. | `src/lib/synaipse/state.ts:155-160`, `src/lib/synaipse/state-validation.ts:196-231` |
| Later recommendation | Pass: a separately versioned projection is created by `createNextDecision`. | `src/commands/next-decision-meta.ts:24-80` |
| Known malformed fields and aliasing | Pass: wrong known field values reject; copied evidence/permission arrays do not alias. | direct deterministic probe below |
| Unknown permission-plan field | **Finding:** accepted as valid. | direct deterministic probe below |

## P2 finding — versioned recommendation permission plans accept undeclared fields

**Given:** a serialized `harness-decision/v1` with a valid CC1 `meta.recommendationEffects.permissionPlan`, plus an undeclared `mutatesExternal: true` field.

**Should:** reject the unknown field at the versioned recommendation-effects trust boundary. The v1 permission-plan interface is closed; this validator is the reader-side enforcement for externally shaped decision envelopes.

**Actual:** `validateHarnessDecision` returns `{ valid: true, errors: [] }`. `validatePermissionPlan` checks known members but accepts extra keys at `src/lib/decision/harness-decision-recommendation-effects-validation.ts:25-42`. By contrast, the closed `synaipse-state/v1` validator rejects unknown members at `src/lib/synaipse/state-validation.ts:196-208`.

**Expected:** an error such as `meta.recommendationEffects.permissionPlan.mutatesExternal is not allowed`, with a known-bad regression fixture.

**Impact:** current CC1 producers do not emit the field and no current consumer interprets it, so this is not evidence of a current mutation. It is a P2 compatibility/authority contract gap: an unsupported authority-like field can enter a payload the v1 validator marks valid, before later CC2 envelope work.

**Smallest remediation:** add narrow closed-key checks for `recommendationEffects`, `authority`, and `permissionPlan`, while keeping the outer additive `meta` object compatible; add a malformed fixture for `mutatesExternal`. Do not alter `synaipseState.invocationEffects` or broaden CC1.

## Command evidence

- Command: `pnpm exec vitest run src/commands/next-fitness-report.test.ts src/commands/next-agent-parity.test.ts src/commands/next-decision-meta.test.ts src/commands/next.test.ts src/lib/decision/harness-decision.test.ts src/lib/synaipse/state.test.ts --reporter=dot` -> pass (6 files, 132 tests).
- Command: `pnpm exec tsc --noEmit` -> pass (no diagnostics).
- Command: `git diff --check bfe275b09244cd44c63ae4cbb641b3630056d04f..f2de738ff0cef0c036b2f48ab3ba06f3a5157208` -> pass (no whitespace errors).
- Command: `node --import tsx --input-type=module <<'EOF'` -> pass (the direct constructor/validator probe rejected known malformed fields, proved mutable-array copies do not alias, and reproduced acceptance of `permissionPlan.mutatesExternal=true` with `valid: true` and no errors; its script ran only in Node stdin and wrote no repository state).
- Command: `git rev-parse HEAD` -> pass (`f2de738ff0cef0c036b2f48ab3ba06f3a5157208`, matching the packet target).

## Claims boundary

This artifact proves the listed local inspection and deterministic command outcomes against the immutable target, and records one P2 contract finding. It does not prove a repair, a fresh QA-agent acceptance, hosted CI, external review, human acceptance, PR state, merge, release, runtime-model availability, or invocation of a recommended command.

WROTE: .harness/review/synaipse-cc1/adversarial-review.md
