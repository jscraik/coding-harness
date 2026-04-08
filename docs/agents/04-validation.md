# Validation and checks

## Table of Contents

- [Core principle](#core-principle)
- [Required baseline gates](#required-baseline-gates)
- [CI gates](#ci-gates)
- [docs-gate](#docs-gate)
- [plan-gate](#plan-gate)
- [Validation by change type](#validation-by-change-type)
- [Docs-only edits](#docs-only-edits)
- [Code + command behavior edits](#code--command-behavior-edits)
- [Process/agent instruction edits](#processagent-instruction-edits)
- [Verify-work lifecycle](#verify-work-lifecycle)
- [Execution order and restart policy](#execution-order-and-restart-policy)
- [Evidence reporting](#evidence-reporting)
- [Non-code verification options](#non-code-verification-options)
- [Failure handling](#failure-handling)

## Core principle

Every change must be checked by the smallest gate needed for risk, then by the fail-closed code-style gate, then by any deeper aggregate gate required by the behavior change.

## Required baseline gates

1. `bash scripts/validate-codestyle.sh --fast`
2. `bash scripts/validate-codestyle.sh`
3. `pnpm test:deep` when artifact/runtime behavior changed beyond the baseline gate

## CI gates

### docs-gate

Enforces documentation parity for governance-sensitive changes.

- **Trigger**: Pull requests and merge queue events.
- **Behavior**: Classifies changed files into impact categories; verifies required docs exist, including tracked workflow-authority docs such as `docs/agents/01-instruction-map.md`, `docs/agents/04-validation.md`, `docs/agents/08-release-and-change-control.md`, `docs/agents/10-agent-testing-gates.md`, `docs/agents/13-linear-production-workflow.md`, `docs/agents/14-docs-gate-rollout.md`, `docs/agents/15-context-integrity-compact.md`, and `docs/agents/16-linear-production-compact.md`, plus tracked compound-workflow artifacts under `docs/adr/`, `docs/specs/`, `docs/plans/`, and `docs/brainstorms/`.
- **Mode**: `advisory` (logs warnings) or `required` (fails CI).
- **Exit codes**:
  - `0`: No drift or advisory mode
  - `10`: Drift detected (required mode)
  - `11-14`: Bootstrap gap, trust mismatch, policy error, runtime error
- **Remediation**: Add missing docs or update `harness.contract.json` `docsGatePolicy.surfaces` to reflect new doc locations.

### plan-gate

Enforces plan-traceability and acceptance-evidence requirements for pull-request work.

- **Trigger**: Pull requests via `risk-policy-gate`, plus any direct `harness plan-gate` run.
- **Behavior**:
  - extracts `Plan IDs` from PR title/body or explicit `--plan-ids`
  - verifies each referenced ID resolves to a `docs/plans/*` file with matching `plan_id` frontmatter
  - requires completed acceptance checklist items in referenced plans to carry evidence links/refs
  - fails when changed work cannot be mapped back to at least one valid plan ID
- **Mode**: required for pull requests; advisory only when a caller omits the enforcing flags.
- **Exit codes**:
  - `0`: traceability passes
  - `5`: plan ID missing or unknown
  - `6`: completed acceptance item missing evidence
  - `7`: changed work not mapped to plan IDs
- **Remediation**:
  - add `plan_id` to the referenced plan frontmatter
  - list the plan IDs in the PR summary
  - add evidence refs to any completed acceptance items before merge

## Validation by change type

### Docs-only edits

- If no code path changed, still run the full required baseline gates before handoff:
  - `bash scripts/validate-codestyle.sh --fast`
  - `bash scripts/validate-codestyle.sh`
- `--fast` can be used as the first iteration gate, but it does not replace the full `scripts/validate-codestyle.sh` proof-of-pass requirement.
- Still report status of unavailable commands if missing.

### Code + command behavior edits

- Run `bash scripts/validate-codestyle.sh`.
- Add any targeted tests if behavior changed.
- Run `pnpm test:deep` when runtime/artifact behavior changed or when deeper promotion evidence is required.
- For pull-requested work, also ensure the PR body lists valid plan IDs and the referenced plans' completed acceptance items carry evidence refs.
- When review-policy or PR-template behavior changes, ensure the PR body and related docs stay truthful about required CodeRabbit and Codex review artifacts.
- For this repository, keep `## Testing` in the PR body structured with `verification_commands`, `verification_outcomes`, and `blocked_steps_reason` so CodeRabbit can evaluate validation evidence deterministically.
- When running `harness linear*` commands (locally or in CI), set `LINEAR_API_KEY` in the runtime environment or pass `--token`, and load `~/.codex/.env` into the active shell/session when secrets are stored there.
- Run `harness symphony-check` as part of validation evidence when Linear secret discovery behavior changed, so `LINEAR_API_KEY` discovery is explicitly verified.

### Process/agent instruction edits

- Run validation gates before finalizing if they alter execution behavior.
- Explicitly verify command contract docs against `package.json`/`pnpm-lock.yaml`.
- When the change introduces or updates a validation wrapper, prove the wrapper itself was executed from the current repo state instead of claiming equivalent underlying commands ran.

## Verify-work lifecycle

`bash scripts/verify-work.sh` now records run-state under `.harness/runs/<run-id>/`:

- `run.json` for run metadata (`mode`, `schemaVersion`, `contractVersion`, provider class)
- `gates/<gate-id>.json` for per-gate outcomes
- `summary.json` for terminal status and failed gate identity

Fast-mode orchestration uses two classes:

- `read_only_parallel`: safe, bounded parallel gates (for example code-style fast lane and manifest alignment checks)
- `serial_guarded`: fail-closed guarded gates (for example preflight and full code-style lane)

Resume behavior:

- Use `bash scripts/verify-work.sh --resume-from <gate-id>` to restart from a failed gate boundary.
- Resume is admitted only when the latest compatible run matches repo root, provider class, and `contractVersion`.
- Reused prior gates must already be `passed`; otherwise resume is rejected and a fresh run is required.

## Execution order and restart policy

- On first failure, stop.
- Fix root cause.
- Rerun from the first failed gate forward using `--resume-from <gate-id>` when compatibility checks pass.
- If resume is rejected due contract drift, run a fresh verification lane from the start.

## Evidence reporting

For each gate run, include:

- Exact command
- Final status (`pass`/`fail`/`blocked`)
- Blocker details when blocked (missing tool, lock mismatch, environment issue)
- Do not collapse `validate-codestyle.sh` into a hand-wavy "lint/tests passed" summary; report the wrapper command explicitly so downstream repos inherit auditable proof-of-pass language.

## Non-code verification options

When dependency tooling is unavailable, run the strongest alternative checks possible and mark explicitly that the full gate is environment-blocked.

## Failure handling

- If a required gate fails repeatedly after two fix attempts, pause and request scope/priority decision before continuing.
