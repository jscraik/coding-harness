# PU-019 GAP-008 Context Health Simplify Lens

## Scope

- Lifecycle slice: PU-019 / GAP-008 context-health agent-readiness projection.
- Role: simplify.
- Diff source: scoped working-tree changes under `src/lib/agent-readiness/**`, `src/commands/agent-readiness.test.ts`, and `.harness/active-artifacts.md`.

## Verdict

Status: pass.

The current implementation is scoped and behavior-preserving relative to the slice intent: it adds one projection builder, one typed report field, and targeted tests. No broad cleanup or unrelated refactor is justified in this slice.

## Actions Taken

- Removed the unused context-health prerequisite parameter after the external-horizon recommendation was corrected.
- Replaced the hardcoded active-route path prefix list with a small safe repo-relative token normalizer so valid repo artifacts outside common prefixes do not create noisy stale-context warnings.
- Preserved separate helper functions for each surface because each helper owns a distinct evidence source and stale-reason rule.
- Kept suggested refresh commands as simple string values so the CLI can print them as separate options.

## Skipped

- Did not collapse surface helpers into one data table. The stale-reason logic for active-artifacts headings, active-route references, runtime-card discovery, and external-horizon absence is materially different enough that a table would hide the important behavior.
- Did not broaden cleanup into other agent-readiness findings. Those checks predate PU-019 and are outside this slice.

## Evidence

- `src/lib/agent-readiness/context-health.ts:83` keeps surface construction local and readable.
- `src/lib/agent-readiness/context-health.ts:155` isolates active-route stale-state reasoning.
- `src/lib/agent-readiness/context-health.ts:225` keeps external-horizon detection separate and intentionally commandless when no snapshot exists.
- `src/lib/agent-readiness/context-health.ts:302` accepts repo-relative path tokens without hardcoded artifact-family prefixes.
- `src/commands/agent-readiness.test.ts:276` verifies the human CLI prints separate refresh options rather than a shell chain.

## Validation Evidence

- Command: `pnpm vitest run src/commands/agent-readiness.test.ts` -> pass (18 tests).
- Command: `node_modules/.bin/biome check src/lib/agent-readiness/context-health.ts src/lib/agent-readiness/cli.ts src/commands/agent-readiness.test.ts .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json` -> pass.

## Risk Note

The projection intentionally uses local filesystem evidence only. It does not simplify or replace the later external-state producer contract.
