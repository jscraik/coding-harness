---
title: feat: command metadata registry core parity
type: feat
status: active
date: 2026-03-05
origin: docs/brainstorms/2026-03-04-command-metadata-registry-brainstorm.md
---

# ✨ feat: command metadata registry core parity

## Overview
Create a typed command metadata registry that becomes the single source of truth for **core** CLI commands first, then scales to the full command surface. The registry must drive parser wiring, CLI help text, and docs generation/checks so command drift is eliminated (see brainstorm: `docs/brainstorms/2026-03-04-command-metadata-registry-brainstorm.md`).

## Problem Statement / Motivation
Command definitions are currently distributed across multiple places:
- parser/dispatch in `/Users/jamiecraik/dev/coding-harness/src/cli.ts:345-1679`
- help text in `/Users/jamiecraik/dev/coding-harness/src/cli.ts:68-302`
- docs index in `/Users/jamiecraik/dev/coding-harness/README.md:84-115`
- dispatch test expectations in `/Users/jamiecraik/dev/coding-harness/src/cli-dispatch.test.ts:103-1343`

This creates drift risk and higher maintenance overhead whenever command flags or behavior change.

## Research Summary

### Brainstorm foundation (authoritative)
Using brainstorm decisions as primary input (see brainstorm: `docs/brainstorms/2026-03-04-command-metadata-registry-brainstorm.md`):
- typed manifest + adapters for v1
- core commands first
- both humans + AI agents as first-class users
- no new runtime dependencies
- success = parser/help/docs synchronization
- out of scope: full rewrite, new CLI framework in v1

### Local repo findings
- Core parsing helpers already exist and are reusable: `parseIntegerArg`, `parseCsvList`, `getFlagValue` in `/Users/jamiecraik/dev/coding-harness/src/cli.ts:303-343`.
- Dispatcher is a long imperative chain (`if (command === ...)`) in `/Users/jamiecraik/dev/coding-harness/src/cli.ts:366-1576`.
- Help output currently repeats entries, showing source-of-truth drift symptoms (`remediate` and `gap-case` repeated) in `/Users/jamiecraik/dev/coding-harness/src/cli.ts:90-109`.
- Existing parity work exists and should be reused, not re-designed:
  - `/Users/jamiecraik/dev/coding-harness/docs/plans/2026-02-27-feat-roadmap-cli-gap-closure-plan.md`
  - `/Users/jamiecraik/dev/coding-harness/docs/roadmap/agent-first-status.md`

### Learnings corpus findings
- `docs/solutions/` currently has no files under `/Users/jamiecraik/dev/coding-harness/docs/solutions`.
- Institutional learnings therefore come from existing plans + tests + AGENTS guidance.

### External research decision
Skipped. This is an internal architecture/refactor with strong local context and no new external API/security/payment surface.

## Premortem (6 months later, this failed)

### What went wrong
- We accidentally created **two** sources of truth (registry + legacy `if` chain) and teams updated whichever was faster.
- Migration stalled after a few commands; mixed routing became permanent, increasing confusion.
- Parity checks were too weak/flaky, so drift still reached `main`.
- Help text became technically correct but less usable; users felt commands were harder to discover.

### Assumptions that turned out false
- “Core commands first” would naturally complete without strict sunset milestones.
- A single metadata shape could represent all command parsing behaviors without many exceptions.
- README parity validation would be simple and stable despite formatting churn.
- Existing tests would catch subtle parser regressions without dedicated compatibility fixtures.

### Edge cases we missed
- Commands with complex/conditional flags that do not fit naive metadata modeling.
- Aliases with nuanced behavior (`policy-gate` / `risk-policy-gate`) under malformed input.
- Non-migrated commands being unintentionally affected by shared help rendering changes.
- Async command error propagation changing timing/exit behavior in CI scripts.

### Integration issues we overlooked
- Registry and legacy dispatch ownership was not explicit; both changed in parallel.
- No hard guard prevented duplicate command definitions across paths.
- Docs/CLI parity checks had no robust extraction contract for README command table rows.
- JSON output compatibility for automation consumers lacked a frozen contract test matrix.

### What users would hate
- “Why did this command behavior change?” surprises from subtle parser regressions.
- Inconsistent help output ordering/content between versions.
- Error messages becoming more generic due over-normalized metadata handling.
- Slower contribution flow because contributors must understand both registry and legacy paths.

## Proposed Solution
Implement a **registry-first architecture** with adapters that preserve current command handlers and exit semantics.

### V1 design
1. Add `src/lib/cli/command-registry.ts` as typed source of truth for migrated commands.
2. Add `src/lib/cli/help-renderer.ts` to render help from registry entries.
3. Add `src/lib/cli/doc-parity.ts` (or equivalent validation utility) to compare registry command list against README command index.
4. Update `src/cli.ts` to route migrated commands through registry-driven dispatch.
5. Keep non-migrated commands on legacy path until phased migration completes.

### Recommended core command migration set (v1)
Start with high-value, frequently-governance-touched commands:
- `policy-gate` (and alias `risk-policy-gate`)
- `preflight-gate`
- `review-gate`
- `branch-protect`
- `evidence-verify`
- `check-authz`
- `check-environment`

Rationale: these form the policy/governance backbone and are most sensitive to drift in parser/help/docs.

## Alternative Approaches Considered
1. **Full all-command rewrite now**  
   Rejected for v1 because risk and migration blast radius are too high (see brainstorm: `docs/brainstorms/2026-03-04-command-metadata-registry-brainstorm.md`).
2. **Docs/help generation only, parser untouched**  
   Rejected because it does not fully solve parser/help/docs drift.
3. **Adopt a new CLI framework**  
   Rejected for v1 due “no new runtime dependencies” and unnecessary migration complexity.

## Implementation Phases

### Phase 1: Registry foundation + one pilot command
- Add `src/lib/cli/command-registry.ts` typed structures.
- Add a pilot migrated command path (recommended pilot: `policy-gate`).
- Generate help rows for pilot command from registry.
- Add a rollback switch (`MIGRATED_COMMANDS_ALLOWLIST`) for fast disable.
- **Deliverable:** one end-to-end registry-backed command with parity tests passing and rollback path verified.

### Phase 2: Core governance command migration
- Migrate remaining core set (`preflight-gate`, `review-gate`, `branch-protect`, `evidence-verify`, `check-authz`, `check-environment`).
- Add registry-vs-README parity validation utility.
- Remove duplicated help rows for migrated commands.
- Add duplicate-definition guard (CI fail if a migrated command exists in both registry and legacy dispatch map).
- **Deliverable:** full core command set registry-backed, deduplicated help output, and no dual-definition drift.

### Phase 3: Hardening + rollout gates
- Add deterministic help ordering assertions.
- Add regression coverage for alias, missing-value, and async dispatch behaviors.
- Add docs/process notes for adding new commands through registry-first path.
- Add compatibility fixture matrix (legacy-vs-registry expected output parity per migrated command).
- Define legacy sunset criteria and owner for decommissioning migrated legacy branches.
- **Deliverable:** merge-safe rollout gates, compatibility fixtures, and explicit legacy sunset plan.

## Technical Considerations
- Must preserve existing command module boundaries (for example `/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.ts` and peers).
- Must preserve existing exit code contracts and JSON output expectations per command.
- Must keep ESM import style (`.js` extension) for new local imports.
- Must avoid runtime dependency additions per brainstorm + AGENTS policy (see brainstorm origin; `/Users/jamiecraik/dev/coding-harness/AGENTS.md:49`).
- Must keep `pnpm` workflow and repo gates (`/Users/jamiecraik/dev/coding-harness/AGENTS.md:12-13`).

## System-Wide Impact
- **Interaction graph:** CLI entry (`src/cli.ts`) → command parser/dispatch → command modules (`src/commands/*.ts`) → policy/contract libs. Registry insertion changes the first layer and must not alter downstream command logic.
- **Error propagation:** parser-level validation errors must continue to map to current command-level exit behavior; adapter layer must not swallow or reclassify errors.
- **State lifecycle risks:** low for parser/help/docs changes; moderate for command option misrouting (wrong flag mapping can create false-negative policy checks).
- **API surface parity:** ensure parity across CLI help, README command index, and dispatch test matrix.
- **Integration test scenarios:**
  1. same command + flags from legacy and registry route produce identical exit code and JSON shape;
  2. alias handling (`risk-policy-gate`) remains equivalent to `policy-gate`;
  3. missing-value flag behavior remains stable (e.g., `--files` with no value);
  4. unknown command fallback still prints help and exits non-zero;
  5. mixed migrated/non-migrated command paths coexist without regressions.

## SpecFlow Analysis (manual fallback)
`spec-flow-analyzer` subagent was unavailable due model usage limit; manual flow coverage analysis added.

### Flow coverage gaps to close
- Command metadata currently duplicated across parser/help/docs.
- No central drift gate preventing mismatches after edits.

### Edge cases to explicitly cover
- Alias commands and de-duplicated help rendering.
- Optional vs required flags (especially empty/missing values).
- Async command dispatch parity (`check-authz`, `check-environment`).
- JSON-mode stability for automation consumers.

### Acceptance criteria additions from spec-flow pass
- Registry-generated help includes migrated commands exactly once.
- README parity check fails on command-list mismatch.
- Migrated commands pass existing dispatch tests without changing expected exit behavior.

## Technical Review (manual fallback)
`/prompts:technical_review` was unavailable in this shell, so this section captures an equivalent architecture-focused review.

### P0 recommendations (must include in execution)
- Define a strict `CommandSpec` contract boundary (name, summary, options, parser mapping, handler binding) and avoid embedding command business logic in registry rows.
- Add a migration kill-switch (feature flag or explicit migrated-command allowlist) so rollback can disable registry routing quickly.
- Add golden/snapshot tests for generated help output to enforce deterministic ordering and prevent accidental duplication.

### P1 recommendations (strongly advised)
- Add contract tests for unsupported/malformed flags to guarantee legacy-compatible error behavior.
- Add README parity check to CI in a non-flaky manner (stable extraction strategy for command table rows).
- Preserve and assert alias equivalence behavior (`policy-gate` vs `risk-policy-gate`) as a dedicated test matrix row.

### Residual risk to watch
- Mixed-path routing (registry + legacy) can create split behavior if ownership boundaries are unclear; phase checklists must explicitly mark which commands are migrated.
- Registry schema creep can become a second programming language if escape hatches are not constrained.

## Acceptance Criteria
- [x] Registry exists with typed command definitions for the v1 core set (see brainstorm origin).
- [x] `harness --help` for migrated commands is generated from registry metadata, with no duplicate command lines.
- [x] Parser + help + README parity is validated by automated checks.
- [x] Existing behavior of migrated commands (options, alias handling, exit codes, JSON outputs) is preserved.
- [x] Dispatch tests for migrated commands pass and explicitly cover alias + missing-value scenarios.
- [x] No new runtime dependencies are introduced.
- [x] Pilot command migration proves registry route and legacy route can coexist during phased rollout.
- [x] Async command dispatch behavior remains stable for `check-authz` and `check-environment`.
- [x] CI fails when a migrated command is defined in both registry and legacy dispatch.
- [ ] Compatibility fixture matrix proves legacy vs registry behavioral parity for each migrated command.
- [ ] A legacy sunset checklist exists with owner and target date for every migrated command.

## Success Metrics
- Drift incidents between `src/cli.ts` help output and README command index drop to zero for migrated commands.
- One-file update path for migrated command metadata (registry file) instead of multi-file manual edits.
- CI catches parser/help/docs mismatch before merge.

## Dependencies & Risks

### Dependencies
- Existing command modules remain stable and reusable.
- Existing test harness (`vitest`) and lint/typecheck pipelines.

### Risks
- **Medium:** partial migration can create mixed paradigms and confusion.
- **Medium:** adapter mistakes can subtly change option parsing.
- **Low:** docs parity check may be noisy at first if README formatting changes.
- **Medium:** registry model over-generalization can degrade UX/error specificity.
- **Medium:** contributor friction if workflow for adding commands is not explicit and enforced.

### Mitigations
- Phase migration command-by-command with parity tests per command.
- Keep legacy path for non-migrated commands until parity is proven.
- Add deterministic snapshot assertions for help output ordering.
- Add dual-definition CI guard for migrated commands.
- Add per-command compatibility fixtures before declaring migration complete.
- Require migration owner + sunset date to avoid permanent mixed mode.

## MVP Change Sketch

### `src/lib/cli/command-registry.ts`
```ts
export interface CommandSpec {
  name: string;
  summary: string;
  options: Array<{ flag: string; required?: boolean }>;
  dispatch: (args: string[]) => Promise<number> | number;
}

export const CORE_COMMAND_SPECS: CommandSpec[] = [
  // policy-gate, preflight-gate, review-gate, ...
];
```

### `src/lib/cli/help-renderer.ts`
```ts
export function renderHelp(specs: CommandSpec[]): string {
  // deterministic ordering + dedupe
}
```

### `src/cli.ts`
```ts
// 1) resolve command by name from registry for migrated commands
// 2) fallback to legacy branch for non-migrated commands
// 3) preserve current process.exit contract
```

## AI-Era Considerations
- Keep JSON output contracts stable for agent automation.
- Prefer deterministic ordering and explicit schemas so coding agents can self-correct from parser errors.
- Require human review for any command contract changes with policy/security impact.

## Out of Scope (v1)
- Full all-command registry migration.
- New CLI framework adoption.
- Deep redesign of command module internals.
(see brainstorm: `docs/brainstorms/2026-03-04-command-metadata-registry-brainstorm.md`)

## Open Questions
- Should README command index become fully generated or just validated against registry in v1?
- Which single command should be the pilot migration to de-risk adapter semantics?

## Validation Plan
- `zsh -lc 'pnpm lint'`
- `zsh -lc 'pnpm typecheck'`
- `zsh -lc 'pnpm test -- src/cli-dispatch.test.ts'`
- `zsh -lc 'pnpm test -- src/cli.test.ts'`
- `zsh -lc 'pnpm check'`
- `zsh -lc 'pnpm exec tsx src/cli.ts --help'` (manual parity spot-check)

## Work Breakdown (file-oriented)
- [x] `src/lib/cli/command-registry.ts` — introduce typed command metadata model.
- [x] `src/lib/cli/help-renderer.ts` — deterministic help renderer from registry.
- [x] `src/lib/cli/doc-parity.ts` — compare registry command set with README command index.
- [x] `src/cli.ts` — route migrated commands through registry adapter, retain legacy fallback.
- [x] `src/cli-dispatch.test.ts` — add/adjust parity tests for migrated commands and alias behavior.
- [x] `README.md` — ensure command index and migration notes remain aligned with registry-backed surface.

## Sources & References
- **Origin brainstorm:** [docs/brainstorms/2026-03-04-command-metadata-registry-brainstorm.md](/Users/jamiecraik/dev/coding-harness/docs/brainstorms/2026-03-04-command-metadata-registry-brainstorm.md)
  - Carried-forward decisions: typed manifest+adapters, core-first rollout, no runtime deps, both humans+agents, explicit v1 non-goals.
- Existing parity plan: [2026-02-27-feat-roadmap-cli-gap-closure-plan.md](/Users/jamiecraik/dev/coding-harness/docs/plans/2026-02-27-feat-roadmap-cli-gap-closure-plan.md)
- CLI dispatch implementation: `/Users/jamiecraik/dev/coding-harness/src/cli.ts:345-1679`
- CLI help block: `/Users/jamiecraik/dev/coding-harness/src/cli.ts:68-302`
- README command index: `/Users/jamiecraik/dev/coding-harness/README.md:84-115`
- Dispatch tests: `/Users/jamiecraik/dev/coding-harness/src/cli-dispatch.test.ts:103-1343`
- AGENTS constraints: `/Users/jamiecraik/dev/coding-harness/AGENTS.md:12-13,46,49`
