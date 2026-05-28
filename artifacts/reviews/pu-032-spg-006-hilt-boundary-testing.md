# PU-032/SPG-006 HILT Boundary Testing Lens

## Selected Proof Route

Changed surface: TypeScript runtime packet builder, CLI parser, command registry, JSON Schema contract, example packet, and CLI documentation.

Smallest exact proof:

- builder and CLI regressions for accepted HILT boundary, routine uncertainty rejection, and claim-sensitive evidence requirements.
- runtime packet schema validation against the manifest and example packet.

Broader proof:

- typecheck, lint, related tests, docs-gate, codestyle fast, audit, and live PR check refresh.

## Results

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm vitest run src/commands/decision-request.test.ts src/lib/cli/command-registry.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot` | pass | 3 files, 226 tests |
| `node scripts/validate-runtime-packet-schemas.cjs --all` | pass | packetCount 13 |
| `pnpm typecheck` | pass | Exact optional-property issue was fixed before this artifact |
| `pnpm lint` | pass | Repo lint gate |
| `pnpm test:related` | pass | 87 files, 2141 tests, 1 skipped |
| `bash scripts/run-harness-gate.sh docs-gate --mode required --json` | pass | 0 errors, 0 warnings |
| `bash scripts/validate-codestyle.sh --fast` | pass | Wrapper exit code 0 |
| `pnpm audit` with network | pass | No known vulnerabilities found |
| `pnpm test:deep` | blocked | E2E lane requires GitHub/Linear credentials; `~/.codex/.env` is a FIFO with no writer and env vars were absent |
| `gh pr checks 309 --repo jscraik/coding-harness --watch=false` | pass | Live PR #309 checks were green at refresh time |

## Failure Ownership

`pnpm test:deep` E2E block is classified as environment/tooling failure, not introduced by the current patch. The exact blocker is unavailable credential material in the active process plus a FIFO env surface with no writer.

## Coverage Gaps

No material deterministic coverage gap remains for the slice. Full E2E validation still requires an active credential writer or exported GitHub/Linear variables.

## Verdict

Testing lens approves this slice with the E2E credential lane explicitly blocked rather than treated as pass.
