---
last_validated: 2026-04-30
---

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
- [North-star learning loop closeout](#north-star-learning-loop-closeout)
- [Process/agent instruction edits](#processagent-instruction-edits)
- [Verify-work lifecycle](#verify-work-lifecycle)
- [Execution order and restart policy](#execution-order-and-restart-policy)
- [Governance failure classes](#governance-failure-classes)
- [Blocked and retry recovery playbook](#blocked-and-retry-recovery-playbook)
- [Evidence reporting](#evidence-reporting)
- [Non-code verification options](#non-code-verification-options)
- [Failure handling](#failure-handling)

## Core principle

Every change must be checked by the smallest gate needed for risk, then by the fail-closed code-style gate, then by any deeper aggregate gate required by the behavior change.

## Required baseline gates

1. `bash scripts/validate-codestyle.sh --fast`
2. `bash scripts/validate-codestyle.sh`
3. `pnpm test:deep` when artifact/runtime behavior changed beyond the baseline gate
4. When `validate-codestyle.sh` runs via hooks, treat hook-exported git environment (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*`) as untrusted input and ensure the wrapper sanitizes those values before invoking `pnpm run`, so fixture-local git checks are isolated from hook context.

## CI gates

### docs-gate

Enforces documentation parity for governance-sensitive changes.

- **Trigger**: Pull requests and merge queue events.
- **Behavior**: Classifies changed files into impact categories; verifies required docs exist, including tracked workflow-authority docs such as `docs/agents/01-instruction-map.md`, `docs/agents/04-validation.md`, `docs/agents/08-release-and-change-control.md`, `docs/agents/10-agent-testing-gates.md`, `docs/agents/13-linear-production-workflow.md`, `docs/agents/14-docs-gate-rollout.md`, `docs/agents/15-context-integrity-compact.md`, and `docs/agents/16-linear-production-compact.md`, plus tracked compound-workflow artifacts under `docs/adr/`, `docs/specs/`, `docs/plans/`, and `docs/brainstorms/`. It also enforces the promoted CodeRabbit frontmatter learning: policy docs with YAML frontmatter fields such as `schema_version`, `status`, or `applies_to` must keep those fields as metadata, not body headings or Table of Contents entries.
- **Mode**: `advisory` (logs warnings) or `required` (fails CI).
- **Exit codes**:
  - `0`: No drift or advisory mode
  - `10`: Drift detected (required mode)
  - `11-14`: Bootstrap gap, trust mismatch, policy error, runtime error
- **Remediation**: Add missing docs, update `harness.contract.json` `docsGatePolicy.surfaces` to reflect new doc locations, or remove duplicated frontmatter metadata from policy-doc body headings and Table of Contents entries.

### plan-gate

Enforces plan-traceability and acceptance-evidence requirements for pull-request work.

- **Trigger**: Pull requests via `risk-policy-gate`, plus any direct `harness plan-gate` run.
- **Behavior**:
  - extracts `Plan IDs` from PR title/body or explicit `--plan-ids`
  - verifies each referenced ID resolves to a `docs/plans/**.md` or Harness Engineering `.harness/plan/**.md` file with matching `plan_id` frontmatter
  - requires completed acceptance checklist items in referenced plans to carry evidence links/refs
  - fails when changed work cannot be mapped back to at least one valid plan ID
  - accepts stable Harness Engineering artifact names such as `.harness/plan/JSC-246-account-settings.md`; date-prefixed `*-plan.md` filenames are no longer required for discovery
- **Mode**: required for pull requests; advisory only when a caller omits the enforcing flags.
- **Exit codes**:
  - `0`: traceability passes
  - `5`: plan ID missing or unknown
  - `6`: completed acceptance item missing evidence
  - `7`: changed work not mapped to plan IDs
- **Remediation**:
  - add `plan_id` to the referenced plan frontmatter
  - list the plan IDs in the PR summary or pass `--plan-ids`
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
- For CodeRabbit learning evidence imports, prove the exact command surface with a fixture-backed `harness learnings import --provider coderabbit-csv --source <csv> --repo <repo> --json` path in installed-package contexts. In this source checkout, route source-owned gates through `bash scripts/run-harness-gate.sh`: prove exact-file or explicit path-prefix enforcement with `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files <files> --json`, prove review context with `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files <files> --json`, prove validation guidance with `bash scripts/run-harness-gate.sh validation-plan --source .harness/learnings/coderabbit.local.json --files <files> --json`, and prove north-star feedback with `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json`. Use the current command family for non-learning gates such as review-gate, artifact provenance, and CI ownership before treating matched learnings as review-blocking context.
- For existing-repo harness upgrades, use `pnpm test:harness-upgrade-matrix -- <repo>...` after `pnpm build` to prove `init --update --dry-run --json` emits valid update evidence (`updateMode`, `trackedManifest`, `updated`, `skipped`, `updateDetails`) without mutating target git status. For operator-facing current-repo previews, prefer `harness upgrade --dry-run --json`; it delegates to the same safe update/adoption preview contract.
- Keep validation evidence explicit that `scripts/validate-codestyle.sh` sanitizes hook-exported `GIT_*` values before nested `pnpm run` calls, rather than assuming inherited hook env is safe.
- For pull-requested work, also ensure the PR body lists valid plan IDs and the referenced plans' completed acceptance items carry evidence refs.
- When review-policy or PR-template behavior changes, ensure the PR body and related docs stay truthful about required CodeRabbit and Codex review artifacts.
- For this repository, keep `## Work performed` in the PR body structured with `Plan IDs`, `Phase / slice`, `Session IDs`, `Trace IDs`, `AI session / traceability`, `Completed work`, `Acceptance trace`, `Validation evidence`, `Review artifacts`, `Learning / reinforcement`, and `Deferred work` so implementation progress, provenance, evidence refs, durable learning, and intentionally deferred scope remain reviewable after handoff.
- For AI-assisted work, `Session IDs` should cite a Codex thread/session, session-collector artifact, or harness run reference; `Trace IDs` should cite CI, harness, eval, runtime-card, evidence-bundle, or review trace references when those artifacts exist. Use `n.a.` only with a concrete reason, and do not paste raw transcripts, prompts, secrets, or bulky telemetry into PR bodies.
- For this repository, keep `## Testing` in the PR body structured with `verification_commands`, `verification_outcomes`, and `blocked_steps_reason` so CodeRabbit can evaluate validation evidence deterministically.
- For pull-requested source-checkout work with changed files that can be evaluated against imported CodeRabbit learning evidence, treat the north-star learning loop as a closeout check: run or explicitly mark `n.a.` for `bash scripts/run-harness-gate.sh learnings gate`, `bash scripts/run-harness-gate.sh review-context`, and `bash scripts/run-harness-gate.sh north-star-feedback` in the PR template evidence.
- When running `harness linear*` commands (locally or in CI), set `LINEAR_API_KEY` in the runtime environment or pass `--token`, and load `~/.codex/.env` into the active shell/session when secrets are stored there.
- Run `harness symphony-check` as part of validation evidence when Linear secret discovery behavior changed, so `LINEAR_API_KEY` discovery is explicitly verified.

### North-star learning loop closeout

Use this closeout when a PR touches code, docs, governance, CI, generated artifacts, scaffold defaults, or review policy surfaces that can be matched against imported learning evidence.

Required evidence:

1. In this source checkout, run `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files <changed-files> --json`, or mark `n.a.` when no local learning artifact exists for the repo.
2. In this source checkout, run `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files <changed-files> --json`, or mark `n.a.` when no learning artifact exists or the change is outside review-context scope.
3. In this source checkout, run `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json`, or mark `n.a.` when no learning artifact exists.
4. Promote any high-usage repeated learning only when the finding has a concrete enforcement destination: validator, gate, scaffold regression, generated-artifact rule, review-context fact, or explicit exception.
5. Promote the durable distilled rule, decision, or explicit skip reason into Project Brain when the learning affects future planning or agent behavior; keep the imported learning artifact as operational evidence rather than copying every row into Project Brain.

The `--files` value accepts comma-separated paths or multiple following path tokens.
Use plain `harness ...` for downstream or installed-package contexts, not for source-checkout PR closeout evidence.

The purpose is to keep repeated review learning load-bearing. A PR should not claim north-star alignment only because it added policy prose; it should show which learning evidence was checked, enforced, measured, or consciously excluded.

### Process/agent instruction edits

- Run validation gates before finalizing if they alter execution behavior.
- Explicitly verify command contract docs against `package.json`/`pnpm-lock.yaml`.
- When the change introduces or updates a validation wrapper, prove the wrapper itself was executed from the current repo state instead of claiming equivalent underlying commands ran.

## Verify-work lifecycle

`bash scripts/verify-work.sh` now records run-state under `.harness/runs/<run-id>/`:

- `run.json` for run metadata (`mode`, `schemaVersion`, `contractVersion`, `contractFingerprint`, provider class)
- `gates/<gate-id>.json` for per-gate outcomes
- `summary.json` for terminal status, failed gate identity (`failedGateId`), and execution mode (`freshVsResumed`)

Fast-mode orchestration uses two classes:

- `read_only_parallel`: safe, bounded parallel gates (for example code-style fast lane and manifest alignment checks)
- `serial_guarded`: fail-closed guarded gates (for example preflight and full code-style lane)

Resume behavior:

- Use `bash scripts/verify-work.sh --resume-from <gate-id>` to restart from a failed gate boundary.
- Resume is admitted only when the latest compatible run matches repo root, provider class, `schemaVersion`, `contractVersion`, and `contractFingerprint`.
- Resume is blocked when deterministic fingerprint tooling is unavailable (`node`, `shasum`, or `openssl`).
- Reused prior gates must already be `passed`; otherwise resume is rejected and a fresh run is required.

## Execution order and restart policy

- On first failure, stop.
- Fix root cause.
- Rerun from the first failed gate forward using `--resume-from <gate-id>` when compatibility checks pass.
- If resume is rejected due to contract drift, run a fresh verification lane from the start.

## Governance failure classes

- `contract_policy`: fail-closed, no auto-retry. Typical causes are Linear policy mismatch or required-check identity drift. Deterministic next step: fix contract/policy mismatch, then rerun from the failed gate.
- `internal_unknown`: fail-closed, no auto-retry. Deterministic next step: inspect gate output, fix root cause, then rerun.
- `transient_infra`: bounded retry is allowed only for `read_only_parallel` gates. After retry exhaustion, treat the gate as failed and resume from that gate once the dependency issue is fixed.

`linear-gate` human output must include both `Failure class:` and `Next action:` lines for failed outcomes, and JSON output must include `meta.failureClass` and `meta.nextAction` when failure data is present.

For check-identity diagnostics, keep terminology aligned across surfaces:

- verify-work gate id: `ci-check-alignment`
- doctor advisory check id: `ci:check-alignment`
- doctor message prefix: `ci-check-alignment:`
- CircleCI workflow-level `githubCheckName` continuity: `pr-pipeline`

## Blocked and retry recovery playbook

1. Read the latest gate artifact at `.harness/runs/<run-id>/gates/<gate-id>.json` and capture `failureClass` + `nextAction`.
2. Fix the blocker identified by the failed gate output (contract/policy mismatch, infra dependency, or internal script error).
3. Resume with `bash scripts/verify-work.sh --resume-from <gate-id>` when compatibility checks pass.
4. If resume is rejected (`contract/provider/root/fingerprint must match`), run a fresh lane from the start.

## Evidence reporting

For each gate run, include:

- Exact command
- Final status (`pass`/`fail`/`blocked`)
- Blocker details when blocked (missing tool, lock mismatch, environment issue)
- Do not collapse `validate-codestyle.sh` into a hand-wavy "lint/tests passed" summary; report the wrapper command explicitly so downstream repos inherit auditable proof-of-pass language.

## Non-code verification options

When dependency tooling is unavailable, run the strongest alternative checks possible and mark explicitly that the full gate is environment-blocked.

For local CodeRabbit CSV imports, distinguish evidence preparation from enforcement. The Phase 1A import path can produce `.harness/learnings/coderabbit.local.json`, the Phase 1B gate can enforce exact-file and explicit path-prefix matches, the Phase 1C promotion report can identify high-usage learnings that deserve permanent rules or exceptions, Phase 3 can generate advisory review-context and validation-plan output from changed files, and Phase 4 can check generated artifact provenance with `.harness/artifact-provenance.json` plus CI ownership with `harness.contract.json`. Phase 4c scaffold-default promotion is enforced through generated-template regression coverage for auth-free `.npmrc`, repo-local harness wrappers, real codestyle templates, wrapper-first readiness checks, first-class `toolingPolicy`, and Codex environment action sync. Review-gate can consume `review-context/v1` artifacts in advisory mode and can require current review context only when `reviewPolicy.requireReviewContext` or `--require-review-context` is explicitly enabled. Keyword-only fuzzy matches remain advisory measurement data and must not block until false-positive behavior justifies a future policy change.

## Failure handling

- If a required gate fails repeatedly after two fix attempts, pause and request scope/priority decision before continuing.
