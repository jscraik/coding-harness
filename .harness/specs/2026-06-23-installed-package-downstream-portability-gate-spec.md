---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: installed-package-downstream-portability-gate-spec
artifact_type: sy-slice-spec
authority: execution-input
source_type: spec
lifecycle_status: execution-input
canonical_destination: evals/scenarios/north-star-agent-delivery/registry.json
owner: coding-harness-maintainers
created: 2026-06-23
last_reviewed: 2026-06-23
review_cadence: on-change
canonical_slug: installed-package-downstream-portability-gate
title: Installed Package Downstream Portability Gate Spec
harness_stage: sy-slice-spec
status: proposed_slice
date: 2026-06-23
origin: AI Delivery Harness cockpit productization tracker-plan
source_trace_plan: .harness/plans/2026-06-23-ai-delivery-harness-cockpit-trace-plan.yaml
source_tracker_plan: .harness/plans/2026-06-23-ai-delivery-harness-cockpit-tracker-plan.yaml
linear_issue: JSC-403
linear_issue_url: https://linear.app/jscraik/issue/JSC-403/coding-harness-add-installed-package-downstream-portability-gate
linear_project: Harness cockpit routing
planning_only_delivery_allowed: true
safe_to_continue: true
blocked_reason: null
traceability_required: true
risk: package-portability-and-public-command-contract
depth: package-installed-downstream-canary
ui: false
lifecycle_scope: slice_spec
depends_on:
  - .harness/plans/2026-06-23-ai-delivery-harness-cockpit-trace-plan.yaml
  - .harness/plans/2026-06-23-ai-delivery-harness-cockpit-tracker-plan.yaml
  - scripts/run-harness-evals.mjs
validated_by:
  - node --import tsx scripts/run-harness-evals.mjs --scenario package-installed-downstream-canary
acceptance_ids:
  - IPD-001
  - IPD-002
  - IPD-003
  - IPD-004
  - IPD-005
  - IPD-006
  - IPD-007
  - IPD-008
---

# Installed Package Downstream Portability Gate Spec

## Table of Contents

- [Command Summary](#command-summary)
- [Intent](#intent)
- [Problem Statement](#problem-statement)
- [Buildable Contract](#buildable-contract)
- [Canary Commands](#canary-commands)
- [Downstream Fixture Requirements](#downstream-fixture-requirements)
- [Result Artifact Contract](#result-artifact-contract)
- [Acceptance Criteria](#acceptance-criteria)
- [Constraints](#constraints)
- [Likely Implementation Surfaces](#likely-implementation-surfaces)
- [Non-Goals](#non-goals)
- [Validation Plan](#validation-plan)
- [Failure Handling](#failure-handling)
- [Exit Conditions](#exit-conditions)
- [Execution Planning Notes](#execution-planning-notes)
- [Stage Handoff](#stage-handoff)

## Command Summary

BLUF: Add a deterministic installed-package downstream canary that proves the
AI Delivery Harness public commands work from a downstream repository, not only
from the coding-harness source checkout. This is the first productization slice
because it makes the north-star promise testable: a dropped-in agent can run
public harness commands, receive structured packets or blockers, and avoid
source-repo package-script assumptions.

Selected slice: Add installed-package downstream portability gate.

Next stage: execution-plan.

## Intent

Prove that the AI Delivery Harness works as an installed product from a
downstream repository.

The product claim under test is that a dropped-in agent can run public harness
commands from an unfamiliar or partially adopted repo and receive structured
next-action guidance without manually wiring source-repo scripts, package paths,
or hidden local assumptions.

## Problem Statement

The harness has strong source-repo behavior, but recent PR-review loops exposed
a recurring portability failure class:

- source-repo package script assumptions
- package-owned scripts resolved from the downstream current working directory
- advertised commands that are not runnable after install
- optional missing evidence causing crashes or non-JSON output
- packet commands pointing to source checkout scripts instead of public CLI
  commands

Those failures directly threaten the north-star promise of zero customer
integration ceremony. Before adding more ratchets or cockpit surfaces, the
product needs a small installed-package canary that catches these regressions.

## Buildable Contract

The slice introduces a deterministic local canary named
package-installed-downstream-canary.

Required behavior:

- Build or package the current harness in a way that simulates consumer
  installation.
- Create a temporary downstream repository fixture outside the source repo's
  normal package-script context.
- Run public harness commands from the downstream repo current working
  directory.
- Parse stdout as JSON for JSON-mode commands.
- Classify missing optional evidence as structured degraded state, not as a
  runtime crash.
- Write a machine-readable canary result artifact.

Forbidden behavior:

- Do not depend on downstream package.json scripts for harness packet
  producers.
- Do not resolve package-owned scripts relative to the downstream repo.
- Do not treat missing CI, review, tracker, or context artifacts as product
  failure when the command contract allows degraded evidence.
- Do not call live external services or require credentials.
- Do not mutate external trackers, PRs, CI, or remote state.

## Canary Commands

| ID | Command | Expected Result |
| --- | --- | --- |
| next | harness next --json | JSON decision packet with structured next command or degraded state. |
| commands | harness commands --json --for-agent | JSON command catalog with agent-facing command metadata. |
| session_distill | harness session-distill --json | session-distill/v1 packet, or structured degraded packet if repo evidence is missing. |
| agent_native_ratchets | harness agent-native-ratchets --json | agent-native-ratchets/v1 packet with public runnable commands. |
| agent_rework | harness agent-rework --json | agent-rework/v1 packet; missing runs classify as needs_evidence rather than crashing. |
| reviewer_decision | harness reviewer-decision --json | reviewer-decision/v1 packet; no manifest classifies as needs_evidence and exits successfully. |
| init_dry_run | harness init --dry-run --json | JSON dry-run install proposal, conflict report, or structured blocker. |

## Downstream Fixture Requirements

The fixture should be a temporary downstream repo.

Setup requirements:

- Create a temp directory under a repo-contained or OS temp test root.
- Initialize git if required by command behavior.
- Create minimal files needed to behave like a downstream repo.
- Install or link the packaged harness through the same path a consumer would
  use.

The fixture should include:

- a minimal package.json only if required for npm or pnpm execution
- no source-repo scripts/write-agent-native-ratchet-report.cjs path
- no harness-specific package scripts such as session:distill or
  agent-native:ratchets
- at most one ordinary downstream script to prove the canary is not relying on
  source package scripts

The fixture should not include:

- the coding-harness source tree copied wholesale
- generated artifacts that mask missing-evidence behavior
- credentials or live service config

## Result Artifact Contract

Default artifact path:

artifacts/evals/live-fixtures/package-installed-downstream-canary/result.json

Schema version:

package-installed-downstream-canary/v1

Required top-level fields:

- schemaVersion
- status
- packageSource
- downstreamRepo
- commands
- summary
- claimBoundary

Allowed top-level statuses:

- pass
- fail
- blocked

Each command record must include:

- id
- command
- cwd
- exitCode
- stdoutJson
- stderrSummary
- packetSchemaVersion
- status
- failureClass

Allowed command statuses:

- pass
- fail
- blocked

Allowed failure classes:

- none
- command_not_found
- non_json_stdout
- nonzero_exit
- source_repo_path_leak
- missing_optional_evidence_unstructured
- package_file_missing
- runtime_exception
- unknown

Summary fields:

- commandCount
- passCount
- failCount
- blockedCount
- sourceRepoPathLeakCount
- nonJsonStdoutCount

Claim boundary: this canary proves installed local command portability for the
covered commands. It does not prove live CI, PR review state, tracker state,
merge readiness, or npm publication.

## Acceptance Criteria

### IPD-001: Canary Runs From Downstream Cwd

Every canary command is executed with cwd set to the downstream fixture repo,
not the coding-harness source repo.

Proof: canary artifact records cwd for each command.

### IPD-002: Commands Use Public CLI

The canary invokes public harness commands, not source checkout implementation
files or private package scripts.

Proof: canary command list contains only harness invocations.

### IPD-003: JSON Mode Is Machine Parseable

Every command expected to emit JSON has parseable stdout.

Proof: each command record has stdoutJson true and a detected packet or catalog
schema where applicable.

### IPD-004: No Source Repo Path Leaks

Output and recommended follow-up commands do not require source-checkout-only
implementation paths from the downstream cwd.

Proof: canary scans stdout command strings and stderr summaries for source
checkout-only paths.

### IPD-005: Missing Evidence Degrades Structurally

Missing runs, manifests, CI, review, tracker, or context evidence returns
structured degraded state rather than an unhandled runtime failure.

Proof: commands such as agent-rework and reviewer-decision produce
needs_evidence, unknown, or named blocker packets.

### IPD-006: Ratchet Commands Are Public Runnable Surfaces

agent-native-ratchets/v1 advertises public runnable commands for packet
producers.

Proof: ratchet packet command fields use harness commands for session, rework,
reviewer, and governance packet producers.

### IPD-007: Dry-Run Init Does Not Write Unexpected Files

harness init --dry-run --json does not mutate downstream repo state beyond
allowed temp or cache artifacts.

Proof: fixture records git status or a file snapshot before and after dry-run.

### IPD-008: Local CI Suitable

The canary runs without network credentials or live external services.

Proof: canary passes in local test/eval mode with credential mode set to none.

## Constraints

Compatibility constraints:

- Do not break existing package scripts.
- Do not remove source-checkout validation paths.
- Keep current public CLI command names stable.

Security constraints:

- Treat downstream fixture files as untrusted.
- Do not follow symlink escapes when reading or writing fixture artifacts.
- Do not print secrets or environment values.

Execution constraints:

- Use repo-native wrappers and existing test/eval conventions.
- Keep the canary deterministic and bounded.
- Use temp paths that are cleaned up or contained under artifacts.

Product constraints:

- Prefer structured blockers over broad failures for absent optional
  integrations.
- The canary should test product usability, not implementation internals.

## Likely Implementation Surfaces

| Path | Reason |
| --- | --- |
| scripts/run-harness-evals.mjs | Existing north-star eval runner owns live fixture execution and result artifacts. |
| evals/scenarios/north-star-agent-delivery/registry.json | Add or update package-installed downstream canary scenario metadata. |
| src/dev/run-harness-evals-script.test.ts | Focused tests for fixture behavior, structured output, and path handling. |
| src/dev/package-files-quality-scripts.test.ts | Package file inclusion and installed-package behavior may need related proof. |
| package.json | Only if a new script is needed for the canary. Avoid unless the eval runner cannot own it. |
| contracts/examples/agent-native-ratchets.example.json | Only if canary exposes source-bound command drift in examples. |

## Non-Goals

- Do not publish the package to npm.
- Do not create Linear issues from this spec.
- Do not add new runtime packet families.
- Do not implement the five-lane cockpit model in this slice.
- Do not require CircleCI, Snyk, CodeRabbit, GitHub token, or tracker
  credentials.
- Do not prove merge readiness.
- Do not attempt broad installer redesign.

## Validation Plan

Focused first:

- pnpm exec vitest run src/dev/run-harness-evals-script.test.ts
- node --import tsx scripts/run-harness-evals.mjs --scenario package-installed-downstream-canary
- pnpm exec vitest run src/dev/package-files-quality-scripts.test.ts

Contract checks:

- node scripts/validate-runtime-packet-schemas.cjs --all
- pnpm artifact:types

Closeout check:

- bash scripts/validate-codestyle.sh --fast

Optional broad checks when shared eval runner behavior changes:

- pnpm test:evals
- pnpm check

## Failure Handling

| Failure | Classification | Action |
| --- | --- | --- |
| Package command missing | current_patch | Fix package file inclusion or CLI dispatch before widening scope. |
| Command requires source script | current_patch | Route through public harness command or package-root-resolved script. |
| Missing optional evidence exits unstructured | contract_gap | Decide whether command should be non-validating by default or emit structured needs_evidence. |
| Non-JSON stdout | product_contract_failure | Move warnings to stderr or structured JSON fields. |
| External credentials required | environment_tooling_blocker | Change canary to degraded local mode; credentials must not be required. |
| Source path leak | portability_failure | Replace source checkout path with public command or package-root-resolved path. |
| Fixture path escape | safety_boundary_failure | Stop and harden path containment before continuing. |

## Exit Conditions

Done when:

- The downstream installed-package canary exists.
- The canary runs the seven public commands from a downstream cwd.
- The canary emits a machine-readable result artifact.
- Focused tests cover pass and at least one portability failure.
- Runtime packet schema validation passes.
- Artifact type validation passes.
- Fast codestyle validation passes.

Not done if:

- Any canary command requires a source-checkout-only script.
- Any JSON command emits unparseable stdout.
- Missing optional evidence crashes instead of producing structured degraded
  state.
- The canary only proves behavior from the coding-harness source repo.
- The result is documented only in prose without artifact proof.

## Execution Planning Notes

Preferred execution shape:

1. Add one fixture function inside the eval runner or adjacent dev test helper.
2. Use pnpm pack or an equivalent local package artifact if repo conventions
   support it.
3. Install into a temp downstream repo.
4. Run the harness binary from that install with cwd set to the downstream repo.
5. Capture stdout, stderr, and exit code per command.
6. Assert command outputs are JSON and command recommendations are public.

Risks to watch:

- Node/pnpm version expectations may differ between source repo and temp
  downstream install.
- Using pnpm link may accidentally preserve source-tree assumptions; package
  tarball install is stronger proof.
- Some commands may need git initialized in the downstream fixture.
- harness init --dry-run --json may inspect or propose files; snapshot fixture
  state before and after.

## Stage Handoff

Next stage: execution-plan.

Proven by this spec:

- Exactly one slice was selected from the tracker-plan handoff.
- The slice has a buildable contract, acceptance criteria, constraints,
  validation plan, failure classifications, and exit conditions.
- No implementation or tracker mutation was performed by the slice-spec stage.
- Repo was clean on main at 8723b8a3d when the stage artifact was prepared.

Unproven:

- No canary has been implemented.
- No package tarball install has been run.
- No new tests or eval fixtures exist yet.
- No current CI/PR/Snyk state was checked.

Blocked by: none.
