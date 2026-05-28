# PU-025 GAP-005 Decision Request Governance - Architecture Lens

## Status

pass

## Scope Reviewed

- `src/lib/decision-request/**`
- `src/commands/decision-request.ts`
- `src/lib/cli/registry/decision-request-command-spec.ts`
- `src/lib/cli/registry/command-specs-core.ts`
- `src/lib/cli/registry/command-capability-rules.ts`
- `contracts/decision-request.schema.json`
- `contracts/runtime-packet-schemas.manifest.json`
- `README.md`
- `docs/cli-reference.md`
- `ARCHITECTURE.md`

## Findings

No blocking architecture findings.

The implementation follows the command-registry deep-module pattern: the command facade re-exports the library API, the registry adapter delegates to `runDecisionRequestCLI`, and parsing/building logic lives in `src/lib/decision-request/`. The packet remains additive and read-only, with `claimSupport: "not_closeout_proof"` preserving the closeout trust boundary.

## Residual Risk

The schema validator admits `decision-request` as a parity validator label, but full schema-to-TypeScript parity is still bounded to examples and tests in this slice. That is acceptable for PU-025 because the runtime emission path and manifest state are now reachable and validated.

## Evidence

- `pnpm vitest run src/commands/decision-request.test.ts src/lib/cli/command-registry.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts` -> pass
- `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass
- `node --import tsx src/cli.ts commands --json --for-agent --mode handoff` -> pass
