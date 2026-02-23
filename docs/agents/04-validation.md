# Validation and checks

## Core principle

Every change must be checked by the smallest gate needed for risk, then by the full aggregate gate when behavior changed.

## Required baseline gates

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm audit`
5. `pnpm check` (aggregated command)

## Validation by change type

### Docs-only edits

- If no code path changed, run at least:
  - `pnpm lint` if docs lint depends on repo scripts.
  - `pnpm typecheck` if imports/types were touched.
- Still report status of unavailable commands if missing.

### Code + command behavior edits

- Run full `pnpm check`.
- Add any targeted tests if behavior changed.

### Process/agent instruction edits

- Run validation gates before finalizing if they alter execution behavior.
- Explicitly verify command contract docs against `package.json`/`pnpm-lock.yaml`.

## Execution order and restart policy

- On first failure, stop.
- Fix root cause.
- Rerun from the first failed gate forward.

## Evidence reporting

For each gate run, include:

- Exact command
- Final status (`pass`/`fail`/`blocked`)
- Blocker details when blocked (missing tool, lock mismatch, environment issue)

## Non-code verification options

When dependency tooling is unavailable, run the strongest alternative checks possible and mark explicitly that the full gate is environment-blocked.

## Failure handling

- If a required gate fails repeatedly after two fix attempts, pause and request scope/priority decision before continuing.
