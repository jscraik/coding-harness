# SynAIpse CC1 QA Disproof

## Result

**Status:** `blocked_validation`

The immutable target was reached, but the packet's 300-second artifact-probe
window expired before a packet-bound QA artifact could be written. The packet
makes probe expiry a stop condition, so no required validation entrypoint was
run after that condition became true.

## Instruction and target attestation

- Packet: `.harness/intent/2026-07-19-synaipse-cc1-qa-packet.json`
- Packet SHA-256: `214486782e70b173cdc3e14ae5f5328590e7255bd9c2ec6379c3e7d32ea0cf8f`
- Target expected and observed: `8e7e7251c299d8f7844cf633cf885bedeab2752d`
- Instruction chain read: `AGENTS.md`, `src/AGENTS.md`, `contracts/AGENTS.md`, and `CODESTYLE.md`.
- Artifact probe: `.harness/review/synaipse-cc1/qa-artifact-probe.json`
- Artifact probe SHA-256: `3f1f6cce29e8554226bfaff257ac8152af02d390176974965ec9f6133188ea16`
- Probe observed at: `2026-07-19T18:15:31Z`; maximum age: 300 seconds.
- Runtime attestation: the OC requested `gpt-5.6-luna` with `xhigh` reasoning. This task exposed `gpt-5.6-terra` with `xhigh` reasoning instead; Luna was not visible and is not attested.

## Finding

### P1 — expired artifact-probe invalidates fresh QA evidence

- **given:** the QA packet declares the artifact probe a 300-second freshness control and lists `artifact probe expiry before result write` as a stop condition.
- **should:** receive a replacement packet and fresh artifact probe before running CC1's required disproof commands.
- **actual:** the probe timestamp plus its maximum age elapsed before this result was written.
- **expected:** a fresh packet/probe bound to the same immutable target, then independent execution of all three declared validation entrypoints.
- **evidence_refs:** `.harness/intent/2026-07-19-synaipse-cc1-qa-packet.json`; `.harness/review/synaipse-cc1/qa-artifact-probe.json`.
- **reproduce_command:** `date -u +%Y-%m-%dT%H:%M:%SZ; jq . .harness/review/synaipse-cc1/qa-artifact-probe.json`
- **status:** `blocked_validation`
- **diagnostic:** probe expiry is a packet-enforced freshness boundary, not evidence of a source defect.

## Commands

- Command: `git -C /private/tmp/coding-harness-synaipse-cc1-effects rev-parse HEAD` -> pass (observed immutable target `8e7e7251c299d8f7844cf633cf885bedeab2752d`)
- Command: `date -u +%Y-%m-%dT%H:%M:%SZ; sha256sum .harness/intent/2026-07-19-synaipse-cc1-qa-packet.json .harness/review/synaipse-cc1/qa-artifact-probe.json .harness/review/synaipse-cc1/recovery-worker-result.json; jq . .harness/review/synaipse-cc1/qa-artifact-probe.json` -> fail (the probe's `2026-07-19T18:15:31Z` observation plus 300 seconds elapsed before QA artifact write)
- Command: `pnpm exec vitest run src/commands/next-fitness-report.test.ts src/commands/next-agent-parity.test.ts src/commands/next-decision-meta.test.ts src/commands/next.test.ts src/lib/decision/harness-decision.test.ts src/lib/synaipse/state.test.ts --reporter=dot` -> blocked (packet stop condition: artifact probe expired before result write)
- Command: `pnpm exec tsc --noEmit` -> blocked (packet stop condition: artifact probe expired before result write)
- Command: `git diff --check bfe275b09244cd44c63ae4cbb641b3630056d04f..8e7e7251c299d8f7844cf633cf885bedeab2752d` -> blocked (packet stop condition: artifact probe expired before result write)

## Claims boundary

This records only target-SHA and instruction-chain observation plus a packet
freshness blocker. It does **not** prove or disprove CC1 producer-reader
compatibility, malformed-envelope rejection, pure invocation-effects
separation, legacy fitness-report behavior, local validation, adversarial
review, hosted CI, review, acceptance, merge, release, or readiness.

WROTE: .harness/review/synaipse-cc1/qa-disproof.md
