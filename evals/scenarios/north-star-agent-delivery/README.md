# North-Star Agent Delivery Evals

## Table of Contents

- [Purpose](#purpose)
- [Scenario Classes](#scenario-classes)
- [Live Fixtures](#live-fixtures)
- [Spec Reimplementation Loop](#spec-reimplementation-loop)
- [Lifecycle Routing](#lifecycle-routing)
- [Resume and Automation Loops](#resume-and-automation-loops)
- [Observability Export](#observability-export)
- [Guardrail Effectiveness](#guardrail-effectiveness)
- [Promotion Rule](#promotion-rule)
- [Run](#run)

## Purpose

These scenarios evaluate whether Coding Harness helps an agent shorten the PR delivery loop without weakening evidence, review independence, validation discipline, or rollback safety.

The registry intentionally favors realistic agent-delivery prompts over generic benchmark questions. A scenario should prove at least one of these behaviors:

- route to the right harness command or canonical source
- produce artifact-backed evidence
- choose narrow but sufficient validation
- classify blockers honestly
- reduce manual coordination between review, CI, learnings, and handoff surfaces

## Scenario Classes

The registry contains 28 high-signal live scenarios:

- `live_fixture`: deterministic local fixture executed by `pnpm test:evals`
- `registered`: reserved for future scenario contracts before a full runner exists

All current scenarios run as local fixtures. Future registered scenarios remain
valuable when they preserve expected command routing, stop conditions, and
artifact evidence before a full runner exists.

## Live Fixtures

The executable suite runs these local fixtures:

- `live-fixture-path-safety`: verifies generated fixture paths stay inside the eval workspace and reject traversal or absolute escape attempts.
- `generated-artifact-drift-repair`: detects a stale generated artifact, repairs it from the canonical source, and verifies drift is gone.
- `validation-plan-closeout-match`: runs the production validation-plan builder against fixture learnings and asserts the recommended closeout commands match the changed files.
- `spec-reimplementation-loop`: converts source behavior into an executable spec, simulates a fresh implementation attempt, evaluates source/spec/implementation drift, writes schema-checked review/repair/validation iteration receipts with loop budgets and stop reasons, improves the spec, and verifies the next implementation attempt has fewer missing assumptions.
- `harness-engineering-lifecycle-routing`: evaluates deterministic Harness Engineering routing doctrine before promoting any workflow route into Coding Harness command behavior.
- `review-feedback-eval-seed`: converts repeated late-stage remediation noise into a deterministic eval-seed artifact with feedback provenance, bounded issue taxonomy, matched files, evidence refs, remediation source, failure class, and a concrete target surface.
- `github-app-auth-preflight`: classifies GitHub App vs PAT auth before live Checks API scenarios run, including private-key-path config and partial app config blockers.
- `review-gate-check-name-alignment`: proves required check names, created check runs, and review-gate `checkName` inputs stay aligned before live polling can timeout.
- `repo-local-e2e-scratch`: verifies E2E contracts and scratch artifacts stay under repo-local `artifacts/e2e` instead of OS temp paths rejected by contract path safety.
- `github-check-run-transient-retry`: preserves the transient GitHub check-run retry policy while proving permission failures are not retried as flakes.
- `e2e-canary-replay`: replays E2E result artifacts for clean, credential-blocked, scenario-regression, and missing-artifact PR-loop cases without creating live GitHub, CircleCI, or CodeRabbit side effects.
- `side-effect-authorization-validator`: proves side-effectual actions require user authorization, reject external-party authorization and prompt injection, and return safer next steps when blocked.
- `agentic-eval-contract-coverage`: proves the registry has outcome graders, trajectory graders, tracked metrics, trial reporting, and validity checks expected of agentic evals.
- `terse-review-request-routing`: blocks ambiguous review baselines, fixes only verified findings, skips stale findings, and avoids broad refactors.
- `circleci-red-job-triage`: records deterministic CI-lane decisions from failing CircleCI evidence while keeping review, security, and credential blockers separate.
- `required-check-name-parity`: verifies CircleCI, CodeRabbit, and Snyk ownership lanes without promoting GitHub Actions fallback checks.
- `review-finding-narrow-fix`: verifies review findings against current code, skips stale comments with evidence, and routes generated artifacts through canonical regeneration.
- `harness-init-update-path`: records a dry-run upgrade preview with tracked manifest, update details, canonical surface updates, and overwrite approval boundaries.
- `north-star-feedback-closeout`: proves changed-file exactness, missing learning artifact honesty, and repeated-feedback promotion or explicit skip decisions.
- `autonomy-stop-human-mediation`: stops ownership-conflicting shortcuts for human mediation while allowing non-conflicting local validation.
- `known-failure-regression-replay`: represents prior harness failure classes as local replay cases with concrete guardrails and validation commands.
- `claim-support-calibration`: evaluates closeout sentences against labeled calibration examples, source evidence, rationale-bearing failure reasons, and precision/recall-style metrics.
- `live-pr-loop-canary`: compares local validation, blocked external checks, independent review state, and merge readiness without collapsing those lanes.
- `adversarial-pr-loop-probes`: probes stale CI claims, self-approved review, required-check confusion, repo-slug path hashing, and high-risk autonomy shortcuts while allowing safe local validation.
- `guardrail-tuning-report`: emits advisory-only tuning recommendations with ranked handoff packets that name the outcome, copied assumption, smallest mechanism, target surface, proof command, and human gate.
- `policy-contract-capsules`: evaluates compact risk-tiered policy capsules for autonomy mode, required evidence, and rollback requirements.
- `registry-drift-guard`: verifies live fixture registry entries keep expected artifacts, stop conditions, and scorecard weights.
- `harness-trace-envelope`: validates the minimal redacted trace envelope for closeout, CI, review-context, and claim-verification evidence.

These fixtures require no GitHub, CircleCI, CodeRabbit, Semgrep, or npm registry credentials.

## Spec Reimplementation Loop

The `spec-reimplementation-loop` fixture captures a higher-order harness eval
pattern:

1. Start from source behavior.
2. Extract an executable spec and evidence package.
3. Produce a fresh implementation attempt from that spec.
4. Compare source behavior, spec, and implementation output.
5. Update the spec with the missing operational intent.
6. Repeat until a fresh implementation can reproduce the intended behavior with
   fewer missing assumptions.

For Coding Harness, this tests whether the harness can preserve enough
operational intent for another agent to reproduce behavior from artifacts,
not just whether the original command happened to pass once.

## Lifecycle Routing

The `harness-engineering-lifecycle-routing` fixture imports the strongest
workflow idea from the Harness Engineering plugin without making Coding Harness
depend on the plugin at runtime: deterministic lifecycle routing should be
measured before it becomes a guardrail.

The fixture covers:

- review-state language routing to review before implementation
- regression-first language routing to TDD
- recurring until-green language routing to heartbeat
- named-stage ambiguity staying in the router
- unrelated work staying outside Harness Engineering
- shell-like request text being treated as data with redacted telemetry

This gives Coding Harness a safe proving ground for a future `harness route
--json` command: plugin doctrine can generate candidate behavior, but evals
decide whether the behavior is stable enough for the control plane.

## Resume and Automation Loops

Future registered scenarios should cover long-horizon Codex work where private
chat context is not enough:

- `compaction-resume-loop`: a fresh or compacted Codex instance resumes from a
  plan, closeout, run artifact, or progress cursor and identifies the next safe
  command without re-deriving the whole session.
- `automation-runbook-loop`: a repo-owned automation runbook contains enough
  cadence, stop-condition, validation, and reporting detail for Codex to execute
  the next wake-up without a long app prompt.
- `ablation-surface-check`: removing a command, field, doc, or artifact that is
  claimed to be load-bearing must make Codex measurably slower, less safe, or
  less able to complete the loop.

These scenarios should become executable only when they can prove completion
rate, evidence quality, blocker classification, or PR lead-time impact. Until
then, keep them as registered contracts rather than expanding the runner.

## Observability Export

The runner writes a local Braintrust-style export to `artifacts/evals/braintrust-log-data.json`. It uses the familiar `input`, `expected`, `output`, `metadata`, and `scores` fields so the same artifact can be uploaded later by an external workflow.

The local runner never requires Braintrust credentials. External sink failures must degrade to a local artifact, not block deterministic eval execution.

Observed telemetry feeds stay outside the deterministic runner and are
normalized into repo-local artifacts first. The observed usage collector reads
session evidence and optional repo-contained CircleCI telemetry under
`artifacts/evals/circleci-telemetry` or `CIRCLECI_TELEMETRY_ROOT`, then writes:

- `artifacts/evals/observed-skill-usage.json`
- `artifacts/evals/observed-skill-usage-summary.md`
- `artifacts/evals/observed-circleci-feed.json`

Run the collector manually with a local telemetry root:

```bash
pnpm run observed:eval-usage -- --plugin-eval-budget none --circleci-telemetry-root <circleci-telemetry-root> --circleci-output artifacts/evals/observed-circleci-feed.json --json
```

CircleCI telemetry is redacted, repo-contained, and bounded before persistence.
It can seed new fixtures or tuning recommendations, but `pnpm test:evals` does
not depend on live CircleCI or machine-local telemetry state. Missing telemetry
writes an artifact with `source.status: unavailable`, zero observed jobs, and the
configured output path when requested. Malformed JSON/JSONL records, unreadable
files, and unreadable directories are skipped rather than blocking the
deterministic eval lane. Telemetry roots or output paths that escape `repoRoot`
fail fast instead of scanning or writing outside the checkout.

## Guardrail Effectiveness

Live fixture results may include staged guardrail evidence:

- `preflight`: repo, tool, auth, worktree, or fixture readiness
- `input`: user request, review comment, risk tier, or evidence classification
- `execution`: command, remediation, or policy decision behavior
- `output`: claim-vs-evidence, closeout, or artifact correctness
- `feedback`: durable learning, skip reason, or operator handoff evidence

The result summary aggregates false positives, false negatives, stage failures,
and precision/recall when fixtures emit classification metrics. This keeps
the eval focused on what kind of guardrail mistake occurred rather than only
whether a scenario passed.

## Promotion Rule

If a live fixture or registered eval fails twice for the same reason, the next change should add one of:

- harness guardrail
- focused regression test
- Project Brain rule
- promoted learning
- explicit documented skip reason

Repeated review feedback should become durable harness behavior, not recurring human comments.

## Run

```bash
pnpm test:evals
```

The artifact wrapper can run the same eval lane:

```bash
pnpm test:artifacts:evals
```

Default outputs:

- `artifacts/evals/result.json`
- `artifacts/evals/braintrust-log-data.json`
- `artifacts/evals/live-fixtures/`
