---
schema_version: deterministic-qa-fallback/v1
project: coding-harness
job_id: job_synaipsecc1repairqa01
packet: .harness/intent/2026-07-19-synaipse-cc1-repair-qa-packet.json
target_sha: cb50e6e2705bde993105c55d7c5690fba14fddcd
status: fallback_pass
reason: child_transport_failed_before_artifact
---

# CC1 repair QA deterministic fallback

The single fresh QA Disproof child was dispatched against the immutable target,
then exceeded its bounded review window without writing either declared artifact
or a packet-bound blocker. It was stopped to prevent an unbounded stale node.
Under the OC fallback policy, this is a deterministic local replacement for the
missing QA artifact; it is not independent QA acceptance.

## Assertions

- Given an undeclared key at `recommendationEffects`, `authority`, or
  `permissionPlan`, the versioned projection should reject the envelope with
  the corresponding assertion-shaped error.
- Given an unknown outer `meta` key or a legacy operational
  `meta.execution.permissionPlan` extension, validation should remain
  additive and accept the otherwise valid envelope.

## Evidence

- Command: `pnpm exec vitest run src/lib/decision/harness-decision.test.ts src/commands/next-decision-meta.test.ts src/commands/next-fitness-report.test.ts --reporter=dot` -> pass (3 files, 34 tests).
- Command: `pnpm exec tsc --noEmit` -> pass (no diagnostics).
- Command: `git diff --check 3e9e5f52..cb50e6e2705bde993105c55d7c5690fba14fddcd` -> pass (no whitespace errors).
- Command: `node --import tsx --input-type=module -e '<closed-key and additive-compatibility probe>'` -> pass (rejected `permissionPlan.mutatesExternal`, `authority.externalApproval`, and `recommendationEffects.unplannedEffect`; accepted outer-meta and legacy operational-plan extensions).

## Claims boundary

This proves the listed local test, type, diff, and direct validator lanes for
the repaired SHA. It does not prove an independent QA-agent verdict, a fresh
adversarial verdict, hosted CI, external review, acceptance, PR state, merge,
release, or readiness.
