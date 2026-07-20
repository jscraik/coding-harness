# CC1 recovery QA disproof — blocked freshness

## Target and instruction attestation

- Immutable target: `8e7e7251c299d8f7844cf633cf885bedeab2752d` in
  `/private/tmp/coding-harness-synaipse-cc1-effects`.
- Packet: `pkt_synaipsecc1qa02`, SHA-256
  `f9b95defff7a0f3d733b0fd3c0216e16ea799eb92ea66dcc8a5febb44966f38a`.
- Freshness probe: `prb_synaipsecc1qa02`, SHA-256
  `650d9f467f967b3979ea3a6f40e793c57bc525acb45b6337ffe5f9305fde333d`,
  observed `2026-07-19T18:26:55Z`. The declared commands finished before its
  `2026-07-19T18:31:55Z` five-minute expiry, but this required artifact was
  persisted at `2026-07-19T18:32:04Z`. The packet therefore fails closed as
  `blocked_validation`; command observations below are not accepted QA proof.
- Read and applied: repository `AGENTS.md`, `src/AGENTS.md`,
  `contracts/AGENTS.md`, and `CODESTYLE.md`. No conflict was observed for this
  read-only QA scope.
- Runtime attestation: policy requested `gpt-5.6-luna` with xhigh reasoning.
  That runtime is not visible/available in this session; this review used the
  supplied `gpt-5.6-terra` xhigh substitute and does not claim Luna execution.

## Disproof results

### P1 — recommendation projection must not collapse into invocation effects

**Unaccepted observation; no finding recorded.** Given a recommendation whose later command could write files,
the decision should expose that prospective effect separately while the `next`
invocation remains read-only. The focused suite including `next-decision-meta`,
`next-agent-parity`, and `next` passed 132 assertions. This is evidence against
the proposed collapse, not a hosted or runtime-canary claim.

### P1 — existing fitness producer must remain compatible

**Unaccepted observation; no finding recorded.** Given the existing fitness-report producer path, it should
continue to construct and consume the decision envelope after the CC1
projection is added. The declared `next-fitness-report` suite passed in the
same focused run.

### P1 — malformed recommendation envelope must be rejected

**Unaccepted observation; no finding recorded.** Given invalid decision-envelope combinations, shared decision
validation should reject them rather than accepting contradictory legacy and
projection metadata. The declared shared `harness-decision` suite passed in the
focused run. The test suite is local proof only; it does not demonstrate every
unlisted malformed input.

### P2 — prospective Git/external effects require later authority

**Unaccepted observation; no finding recorded.** Given recommendation effects that describe future Git or
external work, they should remain a recommendation and not authorize an
execution. The focused `next` and agent-parity tests passed, and this QA did not
run any recommended command with side effects.

### P2 — patch must be whitespace-safe

**Unaccepted observation; no finding recorded.** Given the immutable base-to-target diff, it should not contain
whitespace errors. The declared Git diff check completed with no output and a
zero exit status.

## Exact command outcomes

- Command: `pnpm exec vitest run src/commands/next-fitness-report.test.ts src/commands/next-agent-parity.test.ts src/commands/next-decision-meta.test.ts src/commands/next.test.ts src/lib/decision/harness-decision.test.ts src/lib/synaipse/state.test.ts --reporter=dot` -> pass (6 files, 132 tests).
- Command: `pnpm exec tsc --noEmit` -> pass (no diagnostics).
- Command: `git diff --check bfe275b09244cd44c63ae4cbb641b3630056d04f..8e7e7251c299d8f7844cf633cf885bedeab2752d` -> pass (no whitespace errors).

## Claims boundary

This artifact records a packet-bound `blocked_validation` freshness failure;
it supplies no accepted QA evidence. It preserves local command observations
only. It does not prove source ownership beyond the target, full regression
coverage, hosted CI, provider review, independent acceptance, mergeability,
release, or runtime-canary behavior. It did not read, alter, or reuse the
earlier blocked QA artifacts.

WROTE: .harness/review/synaipse-cc1/qa2-disproof.md
