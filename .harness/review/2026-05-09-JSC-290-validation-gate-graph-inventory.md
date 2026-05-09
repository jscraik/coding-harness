---
schema_version: 1
artifact_id: jsc-290-validation-gate-graph-inventory
artifact_type: he-code-review-inventory
canonical_slug: jsc-290-validation-gate-graph-inventory
title: JSC-290 Validation Gate Graph Inventory
harness_stage: he-code-review
status: draft
date: 2026-05-09
traceability_required: true
origin: .harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md
linear_issue: JSC-290
linear_status: Triage
linear_milestone: Validation Typed Gate Specs Slice (not present in Linear)
---

# JSC-290 Validation Gate Graph Inventory

## Table Of Contents

- [Runtime Edits Statement](#runtime-edits-statement)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Linear / Spec / Plan / PR Traceability](#linear--spec--plan--pr-traceability)
- [Live Linear Refresh](#live-linear-refresh)
- [Source Evidence](#source-evidence)
- [Accepted Command Flags](#accepted-command-flags)
- [Gate Graph](#gate-graph)
- [Run Artifacts](#run-artifacts)
- [Resume Compatibility](#resume-compatibility)
- [Retry Behavior](#retry-behavior)
- [Failure-Class Next Actions](#failure-class-next-actions)
- [Shell-Native Residue](#shell-native-residue)
- [Typed-Mirror-Ready Facts](#typed-mirror-ready-facts)
- [Candidate Parity Tests](#candidate-parity-tests)
- [Diff Checklist](#diff-checklist)
- [Validation Evidence](#validation-evidence)
- [Review Gate Evidence](#review-gate-evidence)
- [Open Follow-Up](#open-follow-up)

## Runtime Edits Statement

Runtime edits: `none`.

This inventory is read-only evidence for `IU-VAL-001`. It did not edit
`scripts/verify-work.sh`, `scripts/validate-codestyle.sh`, `package.json`,
`.github/**`, `.circleci/**`, `src/**`, `tests/**`, `harness.contract.json`, or
`.harness/ci-required-checks.json`.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-290` |
| Linear title | `[coding-harness] Mirror validation gate graph in typed specs` |
| Linear project | `coding-harness` |
| Linear team | `Jscraik` / `JSC` |
| Linear status | `Triage` |
| Linear priority | High, value `2` |
| Planned milestone | `Validation Typed Gate Specs Slice` |
| Active implementation unit | `IU-VAL-001` |
| Execution boundary | Read-only inventory; no runtime, CI, package, source, test, or validation-wrapper edits. |

## Linear / Spec / Plan / PR Traceability

| Linear issue | Source acceptance IDs | Plan units | Acceptance IDs | PR evidence |
| --- | --- | --- | --- | --- |
| `JSC-290` | `SA-VAL-001`, `SA-VAL-006`, `SA-VAL-007` from `.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md` | `IU-VAL-001` from `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md` | `SA-VAL-001`, `SA-VAL-006`, `SA-VAL-007` | Not created in this phase; current evidence is `.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`. |

## Live Linear Refresh

| Field | Live observation | Evidence | Confidence |
| --- | --- | --- | --- |
| Parent issue | `JSC-290` exists in Linear with title `[coding-harness] Mirror validation gate graph in typed specs`. | Linear connector `_list_issues`, query `JSC-290`, team `JSC`. | High |
| Project | `coding-harness`. | Linear connector `_list_issues`, issue `JSC-290`. | High |
| Status | `Triage` / `triage`. | Linear connector `_list_issues`, issue `JSC-290`. | High |
| Priority | High, value `2`. | Linear connector `_list_issues`, issue `JSC-290`. | High |
| Labels | `Drift-Risk`, `Agent-Native`, `Reliability`, `CE: Spec`, `architecture`, `Refactor`. | Linear connector `_list_issues`, issue `JSC-290`. | High |
| Planned milestone | `Validation Typed Gate Specs Slice` is still not present in the `coding-harness` milestone list. | Linear connector `_list_milestones`, project `coding-harness`. | High |

Interpretation: live Linear does not contradict the plan. The milestone remains
absent exactly as the plan records, so `IU-VAL-001` may proceed without creating
or mutating Linear objects.

## Source Evidence

| Source | Command or path | Observed fact | Confidence |
| --- | --- | --- | --- |
| `scripts/verify-work.sh` | `bash scripts/verify-work.sh --help` | The wrapper accepts `--all`, `--changed-only`, `--strict`, `--fast`, `--resume-from ID`, `--json`, `--repo-root PATH`, `--project-governance`, `--workspace-governance`, and help flags. | Hard evidence |
| `scripts/validate-codestyle.sh` | `bash scripts/validate-codestyle.sh --help` | The wrapper accepts `--all`, `--changed-only`, `--strict`, `--fast`, `--repo-root PATH`, and help flags. | Hard evidence |
| `scripts/verify-work.sh` | `nl -ba scripts/verify-work.sh` lines 579-607 | Gate IDs, execution classes, and failure defaults are declared by `add_gate` calls inside `build_gate_plan`. | Hard evidence |
| `scripts/verify-work.sh` | `nl -ba scripts/verify-work.sh` lines 611-713 | `run_gate_command` maps each gate ID to a command surface or skip/fail behavior. | Hard evidence |
| `scripts/verify-work.sh` | `nl -ba scripts/verify-work.sh` lines 723-755 | `run.json` is written by `write_run_header` with run metadata, repo/contract fingerprints, and lane fields. | Hard evidence |
| `scripts/verify-work.sh` | `nl -ba scripts/verify-work.sh` lines 758-790 | Per-gate JSON artifacts include gate identity, execution class, attempt, status, failure class, timestamps, next action, and exit code. | Hard evidence |
| `scripts/verify-work.sh` | `nl -ba scripts/verify-work.sh` lines 976-988 | `summary.json` includes run ID, overall status, failed gate ID, fresh/resumed mode, and duration. | Hard evidence |
| `scripts/verify-work.sh` | `nl -ba scripts/verify-work.sh` lines 897-955 | Resume compatibility checks require passed prior gates and matching run metadata. | Hard evidence |
| `scripts/verify-work.sh` | `nl -ba scripts/verify-work.sh` lines 288-321 and 803-879 | Retry is bounded and only applies when the gate is `read_only_parallel` and the failure default is `transient_infra`; failure output must match transient infrastructure text. | Hard evidence |
| `scripts/verify-work.sh` | `nl -ba scripts/verify-work.sh` lines 1176-1238 | Consecutive `read_only_parallel` gates run as a batch; serial gates run one at a time and stop on first failed gate. | Hard evidence |
| `scripts/validate-codestyle.sh` | `nl -ba scripts/validate-codestyle.sh` lines 12-25 | Help text defines accepted flags and describes the wrapper as fail-closed codestyle validation. | Hard evidence |
| `scripts/validate-codestyle.sh` | `nl -ba scripts/validate-codestyle.sh` lines 40-66 | The wrapper sanitizes hook-exported git environment before invoking `pnpm run`. | Hard evidence |
| `scripts/validate-codestyle.sh` | `nl -ba scripts/validate-codestyle.sh` lines 152-187 | The wrapper always runs codestyle parity; full mode runs `check`; fast mode runs lint/docs/workflow/typecheck/quality/test lanes. | Hard evidence |
| `docs/agents/04-validation.md` | `nl -ba docs/agents/04-validation.md` lines 31-36 and 75-83 | Docs require fast and full `validate-codestyle.sh` baseline gates even for docs-only edits. | Hard evidence |
| `docs/agents/04-validation.md` | `nl -ba docs/agents/04-validation.md` lines 122-153 | Docs describe `.harness/runs/<run-id>/` artifacts, execution classes, resume compatibility, and failure classes. | Hard evidence |
| `package.json` | `jq '.scripts ...' package.json` | `check`, `lint`, `typecheck`, `test`, `test:deep`, `codestyle:validate`, `workflow:validate`, `quality:docstrings`, and `quality:size` are defined package scripts. | Hard evidence |

## Accepted Command Flags

| Wrapper | Accepted flags | Source |
| --- | --- | --- |
| `bash scripts/verify-work.sh` | `--all`, `--changed-only`, `--strict`, `--fast`, `--resume-from ID`, `--json`, `--repo-root PATH`, `--project-governance`, `--workspace-governance`, `-h`, `--help` | Help output and `scripts/verify-work.sh` lines 1030-1085. |
| `bash scripts/validate-codestyle.sh` | `--all`, `--changed-only`, `--strict`, `--fast`, `--repo-root PATH`, `-h`, `--help` | Help output and `scripts/validate-codestyle.sh` lines 96-125. |

## Gate Graph

| Gate ID | Fast | Full | Order | Execution class | Failure class | Command surface | Source line evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `preflight` | Yes | Yes | 1 | `serial_guarded` | `contract_policy` | `bash scripts/codex-preflight.sh --stack "$stack" --mode required --bins "$bins_csv" --paths "$paths_csv"` | `scripts/verify-work.sh` lines 593 and 615-623 |
| `ci-check-alignment` | Yes | No | 2 | `read_only_parallel` | `contract_policy` | `run_ci_check_alignment_gate` | `scripts/verify-work.sh` lines 596 and 624-628 |
| `hook-governance-inventory` | Yes | Yes | Fast 3, full 2 | `serial_guarded` | `contract_policy` | `python3 "$hook_inventory_builder" --manifest "$hook_scope_manifest" --out "$hook_inventory_output"` | `scripts/verify-work.sh` lines 597, 603, and 629-643 |
| `hook-governance-rollout-check` | Yes | Yes | Fast 4, full 3 | `read_only_parallel` | `contract_policy` | `python3 "$hook_rollout_checker" --inventory "$hook_inventory_output" --recovery-slo-hours 24 --out "$hook_rollout_output"`; project-local mode can skip when optional `.codex/hook-conformance.json` is missing. | `scripts/verify-work.sh` lines 598, 604, and 644-663 |
| `hook-governance-docstring-ratchet` | Yes | Yes | Fast 5, full 4 | `read_only_parallel` | `contract_policy` | `python3 "$hook_docstring_ratchet_evaluator" --classification "$hook_classification_input" --metrics "$hook_metrics_input" --window-days 14 --out "$hook_docstring_output"` | `scripts/verify-work.sh` lines 599, 605, and 664-684 |
| `hook-governance-format-reports` | Yes | Yes | Fast 6, full 5 | `serial_guarded` | `contract_policy` | `format_hook_governance_reports` | `scripts/verify-work.sh` lines 600, 606, and 685-689 |
| `validate-codestyle-fast` | Yes | No | Fast 7 | `read_only_parallel` | `transient_infra` | `bash scripts/validate-codestyle.sh --repo-root "$repo_root" --fast` plus `--changed-only`/`--all` and optional `--strict` | `scripts/verify-work.sh` lines 601 and 695-707 |
| `validate-codestyle` | No | Yes | Full 6 | `serial_guarded` | `internal_unknown` | `bash scripts/validate-codestyle.sh --repo-root "$repo_root"` | `scripts/verify-work.sh` lines 607 and 690-694 |

Interpretation: the graph is small and stable enough for a future typed mirror,
but the shell remains authoritative until parity tests prove the mirror cannot
drift silently.

## Run Artifacts

| Artifact | Required fields | Producer function or block | Consumer behavior | Source line evidence |
| --- | --- | --- | --- | --- |
| `run.json` | `runId`, `mode`, `sourceRunId`, `status`, `startedAt`, `resumeFromGateId`, `repoRoot`, `providerClass`, `schemaVersion`, `contractVersion`, `contractFingerprint`, and `lane` fields. | `write_run_header` | Used by resume compatibility checks to match root, schema, contract, fingerprint, provider, and lane. | `scripts/verify-work.sh` lines 723-755 and 930-955 |
| `gates/<gate-id>.json` | `gateId`, `executionClass`, `attempt`, `status`, `failureClass`, `startedAt`, `finishedAt`, `nextAction`, `exitCode`. | `record_gate_result` | Used by resume hydration; prior gates must already be `passed`. | `scripts/verify-work.sh` lines 758-790 and 897-915 |
| `gates/<gate-id>.json` reused form | Existing gate fields plus `reused: true` and `sourceRunId`. | `record_reused_gate_result` | Marks prior compatible gates as reused during resume. | `scripts/verify-work.sh` lines 793-800 and 915 |
| `summary.json` | `runId`, `overallStatus`, `failedGateId`, `freshVsResumed`, `durationMs`. | `finalize_run` | Terminal summary for humans and automation. | `scripts/verify-work.sh` lines 964-988 |

## Resume Compatibility

| Compatibility check | Pass condition | Fail-closed behavior | Source line evidence |
| --- | --- | --- | --- |
| Prior gate artifacts exist | Every gate before the requested resume gate has a source `gates/<gate-id>.json`. | Resume hydration returns failure. | `scripts/verify-work.sh` lines 902-908 |
| Prior gate status | Every reused prior gate has `status == "passed"`. | Resume hydration returns failure. | `scripts/verify-work.sh` lines 909-914 |
| Candidate run metadata | Candidate run has matching `repoRoot`, `schemaVersion`, `contractVersion`, `contractFingerprint`, `providerClass`, and lane flags. | Candidate is ignored; no compatible run is selected. | `scripts/verify-work.sh` lines 930-955 |
| Latest compatible run exists | The first newest compatible run is selected from `.harness/runs/*`. | `find_resume_source_run_dir` returns failure. | `scripts/verify-work.sh` lines 920-961 |
| Resume argument | `--resume-from` has a non-empty gate ID. | Usage error exit `2`. | `scripts/verify-work.sh` lines 1048-1053 |

## Retry Behavior

| Gate or class | Retry allowed | Retry limit | Reason | Source line evidence |
| --- | --- | --- | --- | --- |
| `read_only_parallel` plus `transient_infra` failure default | Yes | Local: `2`; CI: `3`. | Only read-only transient infrastructure failures are eligible. | `scripts/verify-work.sh` lines 300-305 and 811-813 |
| Transient output match | Yes, only when output contains network/timeout style signals. | Same retry budget as above. | Prevents policy or internal failures being retried as infrastructure. | `scripts/verify-work.sh` lines 288-297 and 848-850 |
| Retry delay | Yes | Local cap `5s`; CI cap `15s`; exponential by attempt. | Keeps retry bounded. | `scripts/verify-work.sh` lines 308-320 and 853-870 |
| `contract_policy` | No | `0` | Governance mismatches are deterministic blockers. | `scripts/verify-work.sh` lines 874-876 |
| `internal_unknown` | No | `0` | Unknown failures require inspection and root-cause repair. | `scripts/verify-work.sh` lines 878-879 |

## Failure-Class Next Actions

| Failure class | Default next action | Source line evidence |
| --- | --- | --- |
| `contract_policy` | `fix contract/policy mismatch, then rerun from this gate` | `scripts/verify-work.sh` lines 874-876 |
| `transient_infra` | `retry budget exhausted; fix infrastructure blocker and resume` | `scripts/verify-work.sh` lines 876-877 |
| `internal_unknown` | `inspect gate output, fix root cause, and rerun` | `scripts/verify-work.sh` lines 878-879 |

## Shell-Native Residue

| Behavior | Why it is shell-native | Typed mirror risk | Future extraction condition |
| --- | --- | --- | --- |
| Tool availability, path resolution, and local repo root switching. | Depends on the local process environment and filesystem. | A typed mirror could imply deterministic behavior that only exists at runtime. | Extract only stable predicates, not process mechanics. |
| Hook-governance optional skips. | Skip behavior depends on whether optional scripts or local conformance files exist. | A static mirror could turn optional local absence into false failure or false success. | Mirror only the gate ID and skip condition text; keep actual skip decision in shell. |
| Transient failure detection. | Uses textual output matching against network/transport signals. | Re-implementing regex classification elsewhere would duplicate procedural behavior. | Extract enum names and retry contract only; keep output matching in shell until a tested shared classifier exists. |
| Parallel batch execution. | Uses shell background jobs, temp files, and `wait`. | TypeScript metadata cannot prove process scheduling behavior. | Mirror adjacency/execution classes; leave batching implementation in shell. |
| `pnpm run` environment sanitization. | Depends on inherited hook environment variables. | A mirror could miss hook-specific env leakage. | Keep sanitizer in shell; tests may assert wrapper behavior later. |

## Typed-Mirror-Ready Facts

| Fact | Why it is ready | Guardrail |
| --- | --- | --- |
| Gate IDs and order. | Stable literal strings in `build_gate_plan`. | Parity tests must fail if shell gate order changes. |
| Execution classes. | Stable literal strings paired with gate IDs. | No runtime consumption until mirror-shell parity is tested. |
| Failure classes. | Stable literal strings paired with gate IDs and next actions. | Do not duplicate transient-output regex in typed metadata yet. |
| Artifact field names. | Stable JSON field names in `jq` producers. | Tests should inspect produced fixtures or shell evidence. |
| Resume compatibility predicates. | Stable metadata comparisons in `find_resume_source_run_dir`. | Mirror should describe predicates, not perform resume. |

## Candidate Parity Tests

| Test | Shell evidence | Typed assertion | Intentional mismatch case | Deferred until |
| --- | --- | --- | --- | --- |
| Fast gate order parity | `build_gate_plan` fast branch lines 595-601. | Typed fast gate list exactly matches shell order. | Remove or reorder `validate-codestyle-fast` in typed data and expect failure. | `IU-VAL-003` |
| Full gate order parity | `build_gate_plan` full branch lines 602-607. | Typed full gate list exactly matches shell order. | Add `ci-check-alignment` to full typed list and expect failure. | `IU-VAL-003` |
| Execution class parity | `add_gate` arguments lines 593-607. | Typed execution class per gate matches shell literals. | Mark `hook-governance-inventory` as `read_only_parallel` and expect failure. | `IU-VAL-003` |
| Failure class parity | `add_gate` arguments lines 593-607. | Typed failure default per gate matches shell literals. | Mark `validate-codestyle-fast` as `contract_policy` and expect failure. | `IU-VAL-003` |
| Artifact field parity | `write_run_header`, `record_gate_result`, and `finalize_run`. | Typed artifact contract contains all produced field names. | Drop `contractFingerprint` or `nextAction` from typed contract and expect failure. | `IU-VAL-003` |
| Resume compatibility parity | `find_resume_source_run_dir` lines 930-955. | Typed compatibility predicates include root, schema, contract, fingerprint, provider, and lane. | Omit lane or provider predicate and expect failure. | `IU-VAL-003` |

## Diff Checklist

| Path group | Changed? | Allowed? | Evidence |
| --- | --- | --- | --- |
| `scripts/verify-work.sh` | No | No runtime edit allowed. | `git diff --name-only` before validation did not list this path. |
| `scripts/validate-codestyle.sh` | No | No runtime edit allowed. | `git diff --name-only` before validation did not list this path. |
| `package.json` | No | No package-script edit allowed. | `git diff --name-only` before validation did not list this path. |
| `.github/**` | No | No CI edit allowed. | `git diff --name-only` before validation did not list this path. |
| `.circleci/**` | No | No CI edit allowed. | `git diff --name-only` before validation did not list this path. |
| `src/**` | No | No runtime source edit allowed. | `git diff --name-only` before validation did not list this path. |
| `tests/**` | No | No test edit allowed in `IU-VAL-001`. | `git diff --name-only` before validation did not list this path. |
| `harness.contract.json` | No | No contract edit allowed. | `git diff --name-only` before validation did not list this path. |
| `.harness/ci-required-checks.json` | No | No required-check edit allowed. | `git diff --name-only` before validation did not list this path. |
| `.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md` | Yes | Yes. | This artifact is the only allowed `IU-VAL-001` output. |
| Existing planning artifacts | Pre-existing dirty state | Not owned by this phase. | `git status --short --branch` before execution showed existing JSC-290 spec, plan, review, and Linear plan artifacts. |

## Validation Evidence

Validation was run after the initial inventory write and again after adding the
required Linear traceability section.

| Command | Outcome | Evidence |
| --- | --- | --- |
| `python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py" .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md` | Pass | Reported `PASS .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`. |
| `python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py" .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md` | Pass after one artifact-only fix | Initial run failed because the inventory lacked the required Linear traceability section/table. The section was added, then the command reported `PASS .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`. |
| `python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py" .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md` | Pass | Reported `PASS .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`. |
| `pnpm markdownlint .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md` | Pass | Reported `Summary: 0 error(s)`. |
| `bash scripts/validate-codestyle.sh --fast` | Pass | Completed codestyle parity, preflight sync, Biome, docs lint, packaged skill validation, workflow contract validation, typecheck, quality gates, and related-test checks without failures. |
| `bash scripts/validate-codestyle.sh` | Pass | Completed full codestyle validation, standard Vitest suite (`238 passed`, `3733 passed`, `2 skipped`), CI migration suite (`106 passed`), and audit with `No known vulnerabilities found`. |

Post-validation working tree check:

```bash
git diff --name-only
# .harness/linear/coding-harness-linear-plan.md

git status --short --branch
# ## main...origin/main
#  M .harness/linear/coding-harness-linear-plan.md
# ?? .harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md
# ?? .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md
# ?? .harness/review/2026-05-09-JSC-290-validation-typed-gate-specs-plan-technical-review.md
# ?? .harness/review/2026-05-09-JSC-290-validation-typed-gate-specs-technical-review.md
# ?? .harness/specs/2026-05-09-validation-typed-gate-specs-spec.md
```

The only tracked diff after validation is the pre-existing Linear plan change.
The only `IU-VAL-001` output is this inventory artifact. No runtime source,
wrapper, package-script, CI, required-check, or contract surface was edited.

## Review Gate Evidence

| Gate | Mode | Outcome | Evidence |
| --- | --- | --- | --- |
| `simplify` | Docs-only scoped simplification pass | Pass; no behavior-preserving simplification required. | Scope is one inventory artifact with no runtime code, duplicated logic, or executable behavior. |
| `he-code-review` | Review-only correctness pass | Pass; no blocker findings. | Independent reviewer returned no findings for evidence accuracy, traceability, validation claims, or scope compliance. |
| `he-fix-bugs` | Conditional bug-fix pass | Not run; not required. | Validation and review gates did not produce failing evidence or a reproduced defect. |

## Open Follow-Up

`IU-VAL-002` should not consume this inventory until the artifact is reviewed
and closure validation passes. The typed mirror should start from gate IDs,
execution classes, failure defaults, artifact field names, and resume
compatibility predicates only. It should not extract process mechanics, local
environment handling, shell batching, or transient-output regex behavior.
