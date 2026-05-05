# North-Star Agent Delivery Evals

## Table of Contents

- [Purpose](#purpose)
- [Scenario Classes](#scenario-classes)
- [Live Fixtures](#live-fixtures)
- [Spec Reimplementation Loop](#spec-reimplementation-loop)
- [Lifecycle Routing](#lifecycle-routing)
- [Resume and Automation Loops](#resume-and-automation-loops)
- [Observability Export](#observability-export)
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

The registry contains 15 high-signal scenarios:

- `live_fixture`: deterministic local fixture executed by `pnpm test:evals`
- `registered`: scenario contract captured for future replay or external judge execution

Registered scenarios are still valuable because they preserve expected command routing, stop conditions, and artifact evidence before a full runner exists.

## Live Fixtures

The first executable slice runs these local fixtures:

- `live-fixture-path-safety`: verifies generated fixture paths stay inside the eval workspace and reject traversal or absolute escape attempts.
- `generated-artifact-drift-repair`: detects a stale generated artifact, repairs it from the canonical source, and verifies drift is gone.
- `validation-plan-closeout-match`: runs the production validation-plan builder against fixture learnings and asserts the recommended closeout commands match the changed files.
- `spec-reimplementation-loop`: converts source behavior into an executable spec, simulates a fresh implementation attempt, evaluates source/spec/implementation drift, improves the spec, and verifies the next implementation attempt has fewer missing assumptions.
- `harness-engineering-lifecycle-routing`: evaluates deterministic Harness Engineering routing doctrine before promoting any workflow route into Coding Harness command behavior.
- `review-feedback-eval-seed`: converts repeated late-stage remediation noise into a deterministic eval-seed artifact with matched files, evidence refs, remediation source, failure class, and a concrete target surface.

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
