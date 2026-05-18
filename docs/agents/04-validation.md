---
last_validated: 2026-05-17
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
- [Steering feedback closeout](#steering-feedback-closeout)
- [Process/agent instruction edits](#processagent-instruction-edits)
- [Artifact routine gate](#artifact-routine-gate)
- [Verify-work lifecycle](#verify-work-lifecycle)
- [Execution order and restart policy](#execution-order-and-restart-policy)
- [Governance failure classes](#governance-failure-classes)
- [Blocked and retry recovery playbook](#blocked-and-retry-recovery-playbook)
- [Evidence reporting](#evidence-reporting)
- [Non-code verification options](#non-code-verification-options)
- [Failure handling](#failure-handling)

## Core principle

Every change must be checked by the smallest gate needed for risk, then by the fail-closed code-style gate, then by any deeper aggregate gate required by the behavior change.

When validation, review, or local execution exposes a fixable blocker, warning,
risk, stale instruction, flaky command, or weak guard in a touched file,
required validation surface, generated template, or active agent-facing
instruction, fix it in the same pass and rerun the narrowest proving command.
Do not carry it as residual risk merely because it was not part of the initial
request. A residual-risk note is valid only when the fix is outside current
authority, requires unavailable credentials or destructive action, crosses
unrelated ownership boundaries, or is recorded as a tracked exception with the
exact reason and next owner.

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
- Run `pnpm run quality:self-affirming` when tests change; the guard rejects assertions that use the implementation under test as its own expected oracle unless the assertion carries an explicit `self-affirming-ok:` property-test reason.
- Run `pnpm test:deep` when runtime/artifact behavior changed or when deeper promotion evidence is required.
- For CodeRabbit learning evidence imports, prove the exact command surface with a fixture-backed `harness learnings import --provider coderabbit-csv --source <csv> --repo <repo> --json` path in installed-package contexts. In this source checkout, route source-owned gates through `bash scripts/run-harness-gate.sh`: prove exact-file or explicit path-prefix enforcement with `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files <files> --json`, prove review context with `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files <files> --json`, prove validation guidance with `bash scripts/run-harness-gate.sh validation-plan --source .harness/learnings/coderabbit.local.json --files <files> --json`, and prove north-star feedback with `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json`. Use the current command family for non-learning gates such as review-gate, artifact provenance, and CI ownership before treating matched learnings as review-blocking context.
- For existing-repo harness upgrades, use `pnpm test:harness-upgrade-matrix -- <repo>...` after `pnpm build` to prove `init --update --dry-run --json` emits valid update evidence (`updateMode`, `trackedManifest`, `updated`, `skipped`, `updateDetails`) without mutating target git status. For operator-facing current-repo previews, prefer `harness upgrade --dry-run --json`; it delegates to the same safe update/adoption preview contract.
- Keep validation evidence explicit that `scripts/validate-codestyle.sh` sanitizes hook-exported `GIT_*` values before nested `pnpm run` calls, rather than assuming inherited hook env is safe.
- For pull-requested work, also ensure the PR body lists valid plan IDs and the referenced plans' completed acceptance items carry evidence refs.
- When review-policy or PR-template behavior changes, ensure the PR body and related docs stay truthful about required CodeRabbit and Codex review artifacts.
- For this repository, keep `## Work performed` in the PR body structured with `Plan IDs`, `Phase / slice`, `Session IDs`, `Trace IDs`, `AI session / traceability`, `Completed work`, `Affected surfaces`, `Expected outcome alignment`, `Pattern scope inventory`, `Meta-behavior proof`, `Repeated-error research`, `Acceptance trace`, `Validation evidence`, `Review artifacts`, `Runtime impact`, `CodeRabbit mode coverage`, `Closeout state`, `Learning / reinforcement`, and `Deferred work` so implementation progress, provenance, evidence refs, durable learning, and intentionally deferred scope remain reviewable after handoff.
- `Meta-behavior proof` must cite the durable destination and a concrete repo path, command, or issue ID when a PR admits repeated steering, high-signal correction, or current-session stop language. `Repeated-error research` must use the structured form `Source: ...; Candidate 1: ...; Candidate 2: ...; Candidate 3: ...; [Candidate 4: ...; Candidate 5: ...;] Chosen: ...; Implemented: ...` when the same error or command failure repeats.
- For AI-assisted work, `Session IDs` should cite a Codex thread/session, session-collector artifact, or harness run reference; `Trace IDs` should cite CI, harness, eval, runtime-card, evidence-bundle, or review trace references when those artifacts exist. Use `n.a.` only with a concrete reason, and do not paste raw transcripts, prompts, secrets, or bulky telemetry into PR bodies.
- Before PR handoff, prefer `harness pr-closeout --pr <number> --json` when a PR exists, or `harness pr-closeout --input <path> --json` when evidence is assembled by another workflow. Treat `pr-closeout/v1` as read-only closeout evidence: it may use GitHub CLI, CircleCI CLI, CodeRabbit CLI, Snyk CLI, and `~/.codex/.env` credential discovery, but it must never print secrets or replace independent review approval.
- For PR closeout thread truth, use the GitHub GraphQL `reviewThreads` connection or an adapter that preserves `isResolved`, `isOutdated`, path, line, author, and comment URL. Flat comments, check summaries, CodeRabbit summaries, and review decision fields are not sufficient proof that all Codex, CodeRabbit, or human review threads are resolved.
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

### Steering feedback closeout

Use the agent engineering proof loop when feedback, PR comments, failed checks, benchmark-style success, workflow-skill misses, or line-level corrections point beyond one local edit. The loop exists because code production can pass a narrow task while still failing software engineering.

The expected outcome contract is the default acceptance frame: Coding Harness is
a portable agent operating system that makes Codex behave like a software
engineer, not merely a code generator, across greenfield and brownfield projects
with zero customer integration ceremony. Before closing meta work, verify the
changed surfaces still preserve that outcome rather than only preserving a local
rule or phrase.

If the user has to give the same steering twice, stop ordinary feature work and run repeat-feedback admission. The admission is complete only when the agent can show:

- the repeated feedback and the principle it implies
- related repo surfaces searched, including sibling code, docs, skills, gates, PR templates, and roadmap/status surfaces when relevant
- the durable destination chosen, or the tracked exception explaining why no durable destination exists yet
- the executable guard, template field, schema, test, Project Brain entry, or Linear follow-up that will prevent silent recurrence
- the meta-behavior proof that will appear in PR closeout, naming the durable destination and review or deletion condition
- the focused validation command that proves the admission path still exists
- the pattern scope inventory when the feedback came from a line-level design correction

When the steering says the agent is not permitted to proceed, create a
current-session steering admission record before any feature continuation. The
record must quote the feedback class, infer the operating principle, list
searched surfaces, choose the durable destination, name the executable guard or
tracked exception, record the validation command, and state what behavior is now
forbidden. Chat-only acknowledgement is not an admission.

When the same error, command failure, or test failure happens twice, stop the
local retry loop before another attempt. Research trusted web or upstream
documentation, list 3-5 plausible fixes, choose the most efficient fix for the
current repo context, implement that fix, and record the research options plus
chosen implementation in PR closeout. This prevents agents from fighting the
same error with repeated local guesses.

1. Observe: capture the concrete signal and recover relevant context, including reflected context from resumed windows, session collector evidence, runtime evidence, or agent reflection when the signal crosses compaction, harness, repo, machine, or environment boundaries.
2. Orient: translate the signal into the design principle it implies, then search sibling implementations, tests, docs, skills, PRs, issues, automations, and stacked trajectories that share or consume that principle.
3. Decide: classify the scope as local, pattern-wide, stack-aware, organization-aware, reflected-context-backed, or `Unobserved Horizon`; choose the narrowest durable destination that can carry the principle.
4. Act: update the shared abstraction, executable gate, schema, scaffold, documented validation rule, Project Brain decision, Linear follow-up, or explicit exception. Do not add standalone doctrine when no enforcement or follow-up destination exists.
5. Close out: report the principle, searched scope, chosen destination, validation surface, maintainability impact, traceability, handoff evidence, and review or deletion condition.

The PR template and `pr-template-gate` reject repeated-steering admissions that do not name both a durable meta-behavior proof and a learning or reinforcement destination. They reject line-level or design-pattern correction admissions that do not include a pattern scope inventory with the inferred principle, sibling search, siblings changed, and siblings intentionally unchanged or deferred with reasons. They also reject same-error-twice admissions that do not record web/upstream research, 3-5 candidate fixes, the chosen efficient fix, and what was implemented. `n.a.` is valid only when the PR body does not admit steering feedback, repeated user correction, pattern-bearing line feedback, or repeated troubleshooting failure, or when it names a tracked exception.

PR, automation, or heartbeat closeout completion is not the same thing as green
checks. Green checks prove the validation sub-state only. Before an agent says a
closeout lane is complete, stops a heartbeat, or moves to the next slice, it
must classify:

- PR state: open, draft, ready, merged, closed, or missing.
- Merge or auto-merge state: ready to merge, blocked, auto-merge enabled,
  manual approval needed, or not applicable.
- Branch and worktree state: clean, dirty, pushed, behind, merged, deleted, or
  intentionally retained.
- Linear state: referenced issue resolves, PR is attached or linked, status is
  correct, or the tracker check is blocked with a concrete reason.
- Next-lane routing: the next roadmap/live-truth slice is named, deferred, or
  blocked with evidence.
- Continuation state: heartbeat, automation, or follow-up remains active when
  work is waiting; delete it only when the lane is merged/closed or explicitly
  handed off as ready with a waiting owner and reason.

If any of those states are unknown, closeout is `waiting` or `blocked`, not
`complete`.

For line-level design feedback, the pattern-generalization pass is a pre-closeout
requirement for every work surface, not a PR-template-only ceremony. The agent
must do it before claiming the correction is fixed. The inventory names the
inferred principle, lists the sibling implementations searched, states which
siblings changed, states which siblings were intentionally left unchanged with
reasons, and links any deferred follow-up. A local-only patch is valid only when
the inventory explains why the principle does not apply elsewhere.

Do not wait for exact trigger words. Example-based feedback, named-function
feedback, review comments, single-line corrections, and wording such as
"generally", "same pattern", "same things in multiple places", "larger
perspective", "similar class", or "across everything" are
pattern signals until the inventory proves the correction is intentionally
local.

If pattern scope is hard to judge, `harness pattern-scope` is the required
starter: review candidate siblings, run the listed searches or stronger
repo-specific equivalents, update the shared owner or matching siblings, and
record unchanged siblings with reasons.

Example: "return a named sentinel error instead of a success/failure boolean" is not only a request to edit one function. It is API design feedback: search sibling boolean-result APIs in the same command core, adapter family, and tests, then either update the shared pattern or explain why the named function is intentionally different.

Example: a PR closeout fix for one branch is not done until the loop checks sibling stacked PRs, `pr-green-sweep`, CodeRabbit/CircleCI interpretation, Linear references, roadmap status surfaces, and any reflected context needed to observe those lanes.

Example: a high-level workflow skill such as "log in", "upload attachments and start a chat", or "grant this group access to a workplace agent" is not proven because its instructions look plausible. Define a capture-the-flag eval with an observable win condition in the UI or tool surface, run the skill, retain session or trace evidence, let Codex reflect on failed attempts, commit the minimal skill or harness improvement, and rerun until the flag is captured or the blocker is named.

Do not satisfy this by adding standalone prose only. If the destination is documentation, tie it to an existing docs-gate, glossary guard, PR template field, command contract, or tracked follow-up.

Run `pnpm run docs:steering:guard` after changing this contract. The guard keeps the steering-feedback rule connected across `AGENTS.md`, this validation guide, `UBIQUITOUS_LANGUAGE.md`, and the current solution record.

### Process/agent instruction edits

- Run validation gates before finalizing if they alter execution behavior.
- Explicitly verify command contract docs against `package.json`/`pnpm-lock.yaml`.
- When the change introduces or updates a validation wrapper, prove the wrapper itself was executed from the current repo state instead of claiming equivalent underlying commands ran.

## Artifact routine gate

Run `harness artifact-routine --active-index .harness/active-artifacts.md --json`
before using a `.harness` spec or plan as implementation input. The gate is
read-only and validates active-index freshness, Linear or local-only owner,
referenced-path integrity, runtime-output boundary, and stale artifact
classification.

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
