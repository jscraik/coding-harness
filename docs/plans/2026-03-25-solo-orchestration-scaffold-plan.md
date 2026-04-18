---
title: Solo Orchestration & Scaffold Flexibility Plan
type: generic-plan
status: draft
deepened: 2026-03-25
last_validated: 2026-04-18
---

# Solo Orchestration & Scaffold Flexibility Plan

## Table of Contents

- [Enhancement Summary](#enhancement-summary)
- [Background & Constraints](#background--constraints)
- [Phase 0: CLI Arg Parsing & Options Extension](#phase-0-cli-arg-parsing--options-extension)
- [Phase 1: Minimal Scaffold Definitions](#phase-1-minimal-scaffold-definitions)
- [Phase 2: Building the Ejection Path (`harness eject`)](#phase-2-building-the-ejection-path-harness-eject)
- [System-Wide Impact & Risk Treatment](#system-wide-impact--risk-treatment)
- [Phase 3: Testing & Validation](#phase-3-testing--validation)
- [Phase 4: Documentation & Rollout](#phase-4-documentation--rollout)
- [Acceptance Criteria](#acceptance-criteria)
- [Execution Ledger](#execution-ledger)

## Enhancement Summary
*(2026-03-25)* Deepened plan to align with `InitOptions` flow and `getTemplatesForProvider`. Explicitly defined how CLI args from commander map to `TemplateRenderContext`, how `eject.ts` targets files safely, and the exact shape of `--minimal` contract rendering.
*(2026-03-25)* Conducted adversarial review and CE technical review to fix state desync in updates, caller breakages for `getTemplatesForProvider`, precedence conflicts via Commander, and destructive ejection risks.
*(2026-03-25)* Deepened plan (`ce-deepen-plan` pass) to strengthen system-wide risk treatment around downstream verification scripts (`ci-migrate`), add schema degradation implications, and include a formal documentation rollout phase.

## Background & Constraints
The current `harness init` command is highly prescriptive and enforces an enterprise-grade contract (Linear issue tracking, strict Greptile integration, risk SLA layers, and rigid PR templates). The user has requested to adapt the scaffold for **solo orchestration**, specifically:
- **Gap 2**: Lack of progressive adoption (`--minimal` mode).
- **Gap 3**: Missing an "ejection" path (`harness eject`).
- **Recommendations**: Implement dynamic flagging (`--issue-tracker`, `--greptile`) and a lightweight bootstrapper strategy.

## Phase 0: CLI Arg Parsing & Options Extension
Goal: Allow developers to define their scaffold verbosity via new flags on the `harness init` command using Commander.

- **P0.1**: Update `InitOptions` in `src/lib/init/types.ts` to include `minimal?: boolean`, `issueTracker?: string` (default: "none" in minimal mode, "linear" otherwise), and `greptile?: boolean` (default: true).
- **P0.2**: Update the argument parser in `src/commands/init.ts` (using `@commander-js/extra-typings`) to add `.option('--minimal', 'Deploy a minimal solo-orchestration setup...')` and similar options for `--issue-tracker` and `--no-greptile`. Explicitly constrain `--issue-tracker` using `.choices(['linear', 'github', 'none'])`.
- **P0.3**: **Precedence Strategy**: Use Commander's `.conflicts('minimal')` method on the `--issue-tracker` and `--greptile` options so the CLI fails fast and explicitly if conflicting values are passed.
- **P0.4**: Map the Commander parsed options into the `InitOptions` object passed to `handleInit(targetDir, options)` in `src/lib/init/cli.ts`.

*Exit Criteria:* Running `harness init --help` surfaces the new flags; parsing works, validates inputs, and handles conflicting flags correctly using Commander constraints.

## Phase 1: Minimal Scaffold Definitions
Goal: Teach the scaffolding templates to interpret the new flags and optionally omit strict governance files based on `TemplateRenderContext`.

- **P1.1**: Add `minimal`, `issueTracker`, and `useGreptile` to `TemplateRenderContext` in `src/lib/init/types.ts`.
- **P1.2**: Update `getTemplatesForProvider(ciProvider, options)` in `src/lib/init/scaffold.ts`:
  - Conditionally filter out the `.greptile` config templates (`config.json`, `rules.md`, `files.json`) and `.github/workflows/greptile-review.yml` if `options.greptile === false` or `options.minimal` is true.
  - **Caller Safety**: Update `src/lib/init/interactive.ts`, `src/lib/init/cli.ts`, and test files (`scaffold-shell-quality.test.ts`) to pass the `options` object through to `getTemplatesForProvider` so build and run modes pass strict type checks.
- **P1.3**: Re-synchronize State in `src/lib/init/update.ts`:
  - `harness update` must deserialize the current `harness.contract.json` to extract `issueTrackingPolicy` and `aiReviewPolicy`, reconstructing the `--minimal` or `--no-greptile` flags. **Crucially**, it must pass these options into `createTemplateRenderContext(targetDir, ciProvider, options)` so templates cleanly re-render. Failing to pass flags to the render context will cause `update` to re-infect minimal repos with enterprise defaults inside `harness.contract.json` and workflow files.
- **P1.4**: Update `harness.contract.json` template generation in `src/lib/init/scaffold.ts`:
  - If `minimal === true`, omit SLA checks, strict test thresholds, branch protection enforcements, and high/med risk-tier configurations.
  - Use the `issueTracker` context to set `issueTrackingPolicy: { provider: context.issueTracker }` instead of hardcoding linear. (When `none`, remove the policy).
  - Validate that `ContractSchema` in `src/lib/init/types.ts` is strictly typed with optional fields (e.g., `issueTrackingPolicy?:`) so minimal contracts will pass TypeScript and runtime schema checks.
- **P1.5**: Test the new logic by running `pnpm exec tsx src/cli.ts init --minimal` on a scratch directory.

*Exit Criteria:* A `--minimal` execution yields a locally valid harness environment without dumping enterprise CI templates, and `harness update` safely respects those minimal settings on templated files.

## Phase 2: Building the Ejection Path (`harness eject`)
Goal: Give solo orchestrators a low-friction way to instantly uninstall harness artifacts with safe boundaries.

- **P2.1**: **Execution Context Check**: Before ejecting, verify the presence of `harness.contract.json` or `package.json` with harness scripts in the target directory (`cwd`). Blindly deleting paths if run by mistake in the user's home directory (`~`) could destroy global agent skills!
- **P2.2**: Purely isolate ejection target paths in `src/lib/init/eject.ts`. Ejection must safely delete paths using sequential `try/catch` blocks with `rmSync(..., { recursive: true, force: true })`, warning the user on failure:
  - The `.harness/` directory.
  - The `.greptile/` directory (if they were scaffolded by us).
  - `.agents/skills/coding-harness/`.
  *(Note: `package.json` scripts injected by init should be left alone to avoid breaking the consumer's established workflows if they chose to keep `pnpm check`, etc. Instead, log a final terminal message: `"Harness configurations removed. You may want to manually remove the 'check', 'audit', and 'harness' scripts from your package.json."`)*
- **P2.3**: **Non-Destructive CI Eject**: `.github/workflows/pr-pipeline.yml` and `.github/workflows/greptile-review.yml` shouldn't be unconditionally purged because developers may have added custom deployment logic. Leave CI action files alone but print a strong warning: `"Harness configuration ejected. Custom CI action files were left in .github/workflows for your review."`
- **P2.4**: Include an interactive confirmation warning using enquirer or standard readline (`Are you sure you want to remove the coding-harness integration? [y/N]`).
- **P2.5**: Create `src/commands/eject.ts` to expose the new CLI entrypoint and wire it into the main CLI router (`src/cli.ts`).

*Exit Criteria:* Running `harness eject` successfully cleans up an initialized repository safely (protecting custom logic and verifying project boundaries), leaving user source code untouched.

## System-Wide Impact & Risk Treatment
Goal: Ensure loosening the enterprise defaults does not break existing downstream compliance tooling.

- **Contract Drift in Downstream Tooling**: `ci-migrate` and `docs-gate` heavily rely on `harness.contract.json` fields (like `greptileParity`). By making fields like `issueTrackingPolicy` and `aiReviewPolicy` optional in `ContractSchema` (Phase 1.4), we create a risk that these tools throw undefined errors.
  - *Mitigation*: We are ensuring schema parsing treats missing fields as deactivated gates, but we expect minimal orchestrators will not run `ci-migrate` to enforce large-team parity loops anyway.
- **Destructive Re-Infection**: The highest risk of solo workflows is that running `harness update` next month re-writes the excluded files.
  - *Mitigation*: This was addressed in Phase 1.3 by explicitly deserializing the current contract to hydrate the `InitOptions` before passing them to the template renderer.
- **Linear Webhooks & GitHub App Isolation**: `harness init` typically pairs with cloud integrations. In minimal mode, these are turned off locally, but users may still have GitHub Apps installed.
  - *Mitigation*: The CLI output must be transparent that `--minimal` only bounds local scaffold limits; it does not uninstall GitHub Apps.

## Phase 3: Testing & Validation
Goal: Prove the new orchestration lifecycle is safe and correctly branches.

- **P3.1**: Update `scaffold.ts` test suite asserting that `.greptile` templates are correctly filtered out when `minimal: true` or `greptile: false`.
- **P3.2**: Write unit tests for the `ejection` script verifying accurate file deletion paths and context boundary protections.
- **P3.3**: Ensure `pnpm check` passes across the repository.

*Exit Criteria:* CI passes and coverage is maintained. Tests prove that an ejected repository safely returns to a generic unmanaged state.

## Phase 4: Documentation & Rollout
Goal: Expose the new capabilities consistently across all agent and developer surfaces.

- **P4.1**: Update `README.md` to document the `--minimal`, `--issue-tracker`, and `--no-greptile` CLI flags, demonstrating how to use them for solo or lightweight projects.
- **P4.2**: Update `README.md` to document the `harness eject` command alongside clear notes that the command operates locally and leaves custom CI files intact.
- **P4.3**: Update `CLAUDE.md` and `AGENTS.md` (if applicable) to record that `coding-harness` now supports progressive adoption and safe ejections, explicitly stating the system boundary logic for local configurations.
- **P4.4**: Update `docs/agents/02-tooling-policy.md` and `docs/agents/06-security-and-governance.md` whenever this rollout changes tooling/runtime contract surfaces such as hooks, `Makefile`, `.mise.toml`, readiness scripts, or generated Codex environment actions.

*Exit Criteria:* Command line usage and feature documentation are accurate, guiding developers clearly on how to opt-out of enterprise constraints.

## Acceptance Criteria
- [ ] **AC1**: User can run `harness init --minimal` and avoid installing Greptile rules or Linear constraints.
- [ ] **AC2**: User can specify `harness init --issue-tracker=github` or `--issue-tracker=none` to bypass strict Linear validation, constrained to exact choices.
- [ ] **AC3**: User can execute `harness eject` to confidently remove all coding-harness config footprint without destroying custom CI workflow edits.
- [ ] **AC4**: `harness update` respects the minimal contract settings and passes context options accurately to the renderer.
- [ ] **AC5**: All new CLI arguments and the ejection command are covered by component-level tests.
- [ ] **AC6**: `README.md` securely documents the progressive adoption arguments and ejection pathways.

## Execution Ledger
- Current Status: Technically Reviewed & Ready for Execution
- Execution Owner: Antigravity Agent
