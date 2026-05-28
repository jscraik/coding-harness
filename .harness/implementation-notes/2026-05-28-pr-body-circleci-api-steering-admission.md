# Current-Session Steering Admission

## Table of Contents

- [Feedback Signal](#feedback-signal)
- [Root Operational Failure](#root-operational-failure)
- [Failure Category](#failure-category)
- [Searched Surfaces](#searched-surfaces)
- [Durable System Improvement](#durable-system-improvement)
- [Executable Guard](#executable-guard)
- [Forbidden Recurrence Behavior](#forbidden-recurrence-behavior)
- [Validation](#validation)
- [Review Condition](#review-condition)

## Feedback Signal

Jamie repeated that every steering correction is high-signal operational
telemetry and that normal implementation work must stop until the environment
changes. The concrete current-session steering classes are:

- PR body creation must not execute Markdown backticks or command snippets
  through shell interpolation.
- CircleCI API and log triage must use the approved private env surface at
  `~/.codex/.env` before calling CircleCI evidence unavailable.

## Root Operational Failure

The root operational failure is that the workflow relied on operator memory for
two repeatable recovery paths. The repo already required env-backed validation
recovery in general, and it already required PR template validation in general,
but it did not make the dangerous mechanics explicit enough:

- a PR body containing Markdown was passed through an interpreting shell string,
  which allowed backticks and command snippets to execute;
- CircleCI API/log recovery was attempted without a validated, bounded
  `~/.codex/.env` loading rule specific to CircleCI token names.

## Failure Category

- weak validation
- hidden assumptions
- poor workflow design
- runtime ambiguity
- lack of verification
- missing guardrails
- weak observability

## Searched Surfaces

- AGENTS.md
- CODESTYLE.md
- codestyle/10-shell-bash-zsh.md
- docs/agents/04-validation.md
- UBIQUITOUS_LANGUAGE.md
- docs/solutions/integration-issues/2026-05-17-steering-feedback-admission.md
- docs/solutions/integration-issues/2026-05-19-env-backed-validation-admission.md
- scripts/check-steering-feedback-contract.cjs
- docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
- docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl

## Durable System Improvement

This admission promotes the correction from chat into the repo operating system:

- `scripts/check-steering-feedback-contract.cjs` now validates that the
  steering contract includes safe PR body file handoff language.
- `scripts/check-steering-feedback-contract.cjs` now validates CircleCI
  env-backed API triage language.
- `docs/agents/04-validation.md`, `UBIQUITOUS_LANGUAGE.md`, and the steering
  admission solution record now define the workflow rule.
- The active runtime evidence goal now requires the same handoff and CircleCI
  triage behavior during slice PR closeout.

The inferred principle is: if a workflow can execute user-authored Markdown or
misclassify credential-backed external evidence, the safe path must be a
deterministic guard or checked workflow rule, not a remembered chat correction.

## Executable Guard

The executable guard is `pnpm run docs:steering:guard`, backed by
`scripts/check-steering-feedback-contract.cjs`.

The guard checks that the validation guide, glossary, and solution record
retain:

- safe PR body file handoff with `--body-file` and `pr-template-gate --pr-body-file`;
- rejection of shell interpolation, command substitution, and raw `--body` strings for Markdown PR bodies;
- CircleCI env-backed API triage using `~/.codex/.env`;
- accepted CircleCI token names `CIRCLECI_TOKEN`, `CIRCLE_TOKEN`, and `CIRCLE_API_TOKEN`;
- secret-safe and bounded CircleCI API calls.

## Forbidden Recurrence Behavior

Do not create or edit PR bodies by embedding Markdown with backticks, shell
snippets, validation output, or generated text inside an interpreting shell
string. Use a body file and validate it before PR create or edit.

Do not classify CircleCI API, CircleCI log, or CircleCI job evidence as
unavailable until the approved env surface has been checked without printing
values, loaded into the active shell, and used through a bounded network call or
reported as unreadable or incomplete.

## Validation

Command: `pnpm run docs:steering:guard` -> pass.

## Review Condition

Review this admission when a typed PR body handoff validator or CircleCI API
triage helper replaces the markdown steering contract. Until then, keep the
guard load-bearing so the same steering does not need to be repeated.
