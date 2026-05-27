# PU-025 GAP-005 Decision Request Governance - Testing Lens

## Status

pass

## Test Coverage

The slice includes focused tests for:

- successful `decision-request/v1` JSON emission
- stale expiry precedence over caller-provided open/current state
- duplicate option id rejection
- tradeoff reference to unknown option id rejection
- explicit blank escalation field rejection
- duplicate scalar flag rejection
- default option mismatch rejection
- registry dispatch
- handoff catalog inclusion and metadata
- runtime packet manifest validation behavior after `decision-request/v1` becomes emitted

## Validation Evidence

- `pnpm vitest run src/commands/decision-request.test.ts src/lib/cli/command-registry.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts` -> pass, 3 files and 216 tests
- `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass
- `node --import tsx src/cli.ts decision-request --json ...` -> pass
- `node --import tsx src/cli.ts commands --json --for-agent --mode handoff` -> pass

## Residual Risk

Full repo validation remains a separate integration step because this branch is diverged and the worktree contains unrelated untracked Project Brain files. This artifact only claims focused PU-025 validation.
