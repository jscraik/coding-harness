# Validation and checks

## Core principle

Every change must be checked by the smallest gate needed for risk, then by the full aggregate gate when behavior changed.

## Required baseline gates

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm audit`
5. `pnpm check` (aggregated command)

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

- If no code path changed, run at least:
  - `pnpm lint` if docs lint depends on repo scripts.
  - `pnpm typecheck` if imports/types were touched.
- Still report status of unavailable commands if missing.

### Code + command behavior edits

- Run full `pnpm check`.
- Add any targeted tests if behavior changed.
- For pull-requested work, also ensure the PR body lists valid plan IDs and the referenced plans' completed acceptance items carry evidence refs.
- When review-policy or PR-template behavior changes, ensure the PR body and related docs stay truthful about required CodeRabbit and Codex review artifacts.

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
