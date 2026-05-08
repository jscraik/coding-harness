---
schema_version: 1
title: JSC-283 Packaged Skill Behavior Assurance Spec
type: he-spec
status: draft
date: 2026-05-08
origin: he-spec
repo: coding-harness
risk: high
depth: parent-issue
ui: false
linear_workspace: Jscraik
linear_team: JSC
linear_project: coding-harness
linear_parent_initiative: Dev Portfolio
linear_milestone: Agent Cockpit Compression Slice
linear_issue: JSC-283
linear_status: triage
linear_priority: 2
linear_labels:
  - Developer Experience
  - Agent-Native
  - Eval
  - Reliability
traceability_required: true
---

# JSC-283 Packaged Skill Behavior Assurance Spec

## Table Of Contents

- [Mode Decision](#mode-decision)
- [Problem](#problem)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Linear Contract](#linear-contract)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Boundary](#boundary)
- [Baseline](#baseline)
- [Domain Model](#domain-model)
- [Fixture Matrix Contract](#fixture-matrix-contract)
- [Package Form Order](#package-form-order)
- [Lifecycle](#lifecycle)
- [Interfaces](#interfaces)
- [Invariants](#invariants)
- [Failure And Recovery](#failure-and-recovery)
- [Observability](#observability)
- [Validation Ladder](#validation-ladder)
- [Loophole Controls](#loophole-controls)
- [Acceptance Matrix](#acceptance-matrix)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [First Slice](#first-slice)
- [Open Questions](#open-questions)
- [Done](#done)
- [he-plan Handoff](#he-plan-handoff)
- [Blackboard Delta](#blackboard-delta)
- [Evidence](#evidence)

## Mode Decision

Spec mode: Linear-backed parent issue.

Selected slice:

- Type: parent issue.
- Linear issue: `JSC-283`.
- Title: `[coding-harness] Prove packaged skill behavior for cockpit commands`.
- Source: `.harness/linear/coding-harness-linear-plan.md`.

Selected refactor source:

- `.harness/refactors/packaged-skill-behavior-assurance.md`.

Reasoning:

- The Linear Delta Capture Gate marks `JSC-282` as already covered for
  source-command behavior and promotes only `JSC-283` into the approved next
  slice queue.
- `JSC-283` is the smallest next slice because it proves whether the packaged
  `coding-harness` skill actually works in downstream-like repo states.
- The spec must not reopen broad command cleanup, the `JSC-248` umbrella, CI
  migration, governance memory ownership, or validation-orchestration work.

Linear object status:

- Live `coding-harness` project exists under `Dev Portfolio`.
- Live `Agent Cockpit Compression Slice` milestone exists.
- Live `JSC-283` exists in `Triage` with priority `2 High`.
- Required labels are reconciled and applied: `Developer Experience`,
  `Agent-Native`, `Eval`, and `Reliability`.

## Problem

The packaged `coding-harness` skill is a trust-bearing product API. It is how
the repo's operating model travels into downstream repositories and how future
agents learn which commands, validation loops, and boundaries to use.

Current validation is necessary but not sufficient:

- Static skill validators prove required files, references, and forbidden text.
- JSC-282 proves source-command truth for the selected cockpit path.
- Neither layer proves that a downstream-like repo can use the packaged skill
  to install, update, preserve ownership boundaries, or resolve the selected
  command references.

The failure mode is false confidence. A skill that passes lexical validation but
fails in a fixture repo teaches future agents to trust instructions that do not
work.

## Goals

- Define the minimum fixture matrix for packaged skill behavior assurance.
- Preserve fast static validation as the first guard.
- Prove clean downstream-like install/init behavior without secrets.
- Prove update/idempotence behavior in a repo that already has harness state.
- Prove customized environment/action-sync ownership is preserved.
- Prove packaged skill command references resolve against the JSC-282
  source-command truth.
- Explicitly classify credential-required remote checks as blocked when
  credentials are unavailable.
- Produce `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md`
  before any closure claim.

## Non-Goals

- No broad plugin ecosystem work.
- No new skill framework.
- No replacement of static validators.
- No release-blocking fixture gate until fixture determinism is proven.
- No downstream fixture that depends on Jamie-local state.
- No credential-required baseline path.
- No fake command dispatch solely to satisfy skill references.
- No reopening JSC-282 command truth unless JSC-283 proves a current command
  reference contradicts the source-command contract.
- No governance/memory simplification, CI migration, or validation typed-spec
  work in this slice.

## Linear Contract

| Field | Value |
| --- | --- |
| Workspace | `Jscraik` |
| Team key | `JSC` |
| Initiative | `Dev Portfolio` |
| Project | `coding-harness` |
| Milestone | `Agent Cockpit Compression Slice` |
| Parent issue | `JSC-283: [coding-harness] Prove packaged skill behavior for cockpit commands` |
| Priority | `2 High` |
| Labels | `Developer Experience`, `Agent-Native`, `Eval`, `Reliability` |
| Status | `Triage` |
| Execution route | Agent-assisted; human review required for fixture admission and release-gate promotion |
| Depends on | `JSC-282` source-command proof |
| Eval artifact | `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md` |

## Linear Work Item Contract

Tracker state:

- `JSC-283` is the tracker of record for this spec.
- `JSC-282` is complete locally for source-command scope and supplies the
  command truth JSC-283 must consume.
- No child issues exist yet. `he-plan` may propose child issues only by fixture
  scenario, not by every line in the skill.

Required child-issue shape if created:

- Design packaged skill fixture matrix.
- Add clean repo packaged skill fixture.
- Add update/idempotence packaged skill fixture.
- Add customized environment/action-sync fixture.
- Validate packaged skill command reference resolution.
- Promote deterministic fixtures to release gate only after advisory stability.

Closure rule:

- `JSC-283` cannot be marked complete until the eval artifact exists, validates,
  and records observed fixture behavior or explicit blockers.
- Static validation passing alone is not closure proof.

## Boundary

In scope:

- `.agents/skills/coding-harness/**`.
- `scripts/validate-packaged-skill.cjs`.
- `.agents/skills/coding-harness/scripts/validate_reference_contracts.py`.
- Packaged skill references for the selected cockpit command path.
- Fixture tests or helper scripts that create downstream-like local repos.
- Package scripts or test commands needed to run those fixtures.
- Eval artifact for JSC-283 closure.

Out of scope:

- Every command in the CLI.
- Full downstream repo simulation.
- Live GitHub or Linear integration unless credentials are present.
- Release workflow redesign.
- Memory/Project Brain truth ownership.
- CI migration lifecycle extraction.
- New Linear initiatives, projects, or issue-per-command expansion.

## Baseline

Verified facts:

- JSC-282 eval says source command behavior is ready to unblock JSC-283.
- JSC-282 eval explicitly excludes packaged binary, global install, installed
  downstream skill, GitHub App, Linear, and full E2E behavior.
- ADR-007 says packaged skill validity requires downstream-like behavior proof,
  not only string/reference checks.
- Routing invariants say skill references must resolve against real commands
  and downstream-like behavior fixtures.
- Execution invariants require observable validation and behavior fixtures for
  downstream skill readiness.

Strong inference:

- The right first JSC-283 move is fixture matrix design before implementation.

Assumption:

- The first useful fixtures can run locally without credentials by using
  temporary downstream-like repositories and the current workspace package.

## Domain Model

Packaged skill:

- The installed `.agents/skills/coding-harness` artifact and references that a
  downstream repo receives or uses to operate the harness.

Static validator:

- A fast lexical/reference check that catches missing files, stale strings,
  forbidden guidance, or broken reference contracts.

Behavior fixture:

- A deterministic local repo state used to run the documented skill path and
  observe behavior.

Clean repo fixture:

- A downstream-like repo without existing harness state.

Update/idempotence fixture:

- A downstream-like repo with existing harness state where re-running install or
  update guidance must be safe and repeatable.

Customized environment fixture:

- A downstream-like repo with user-owned `.codex/environments/environment.toml`
  or equivalent state that must not be silently overwritten.

Credential-blocked check:

- A real remote or service-backed behavior that cannot run without credentials,
  recorded as blocked with exact missing inputs rather than silently skipped.

Behavior proof:

- A command outcome, file-system delta, or validator result that is produced by
  running the real documented path in a fixture repo.
- A proof is invalid if it only asserts that markdown, references, or expected
  strings exist.

Packaged proof:

- Evidence that the packaged skill artifact behaves from a downstream
  consumer's point of view.
- Source-tree validation can be a prerequisite, but it cannot be the final proof
  for install/update readiness.

## Fixture Matrix Contract

`he-plan` must turn this contract into an explicit matrix before fixture code is
written.

| Scenario | Required setup | Behavior to prove | Minimum proof | Credential policy | Gate status |
| --- | --- | --- | --- | --- | --- |
| Static packaged skill validation | Current repo checkout | Required packaged skill files, references, and forbidden patterns remain valid. | Existing static validator command output. | No credentials. | Blocking, already expected. |
| Clean downstream-like repo | Temporary git repo with no harness state and no Jamie-local config. | The packaged skill can guide the first install/init path without relying on local-only paths. | Command transcript plus generated-file inventory. | No credentials for baseline. | Advisory until stable. |
| Existing harness repo | Temporary git repo with committed harness-managed files from a prior init/update. | Re-running the skill-guided update path is idempotent and preserves managed/adaptable ownership. | Before/after diff summary and repeat-run result. | No credentials for baseline. | Advisory until stable. |
| Customized environment/action-sync repo | Temporary git repo with intentionally customized environment/action surfaces. | Generated action surfaces update when owned; user-owned config is preserved or conflict-marked rather than overwritten. | Diff summary proving preserved customization. | No credentials for baseline. | Advisory until stable. |
| Command reference resolution | Current repo plus packaged skill artifact. | Packaged skill command references match JSC-282 source-command truth or declare blocked/deprecated state. | Machine-readable mismatch report. | No credentials. | Blocking for JSC-283 closure. |
| Remote integration capability | Fixture or live repo path that would require GitHub/Linear/CircleCI credentials. | Skill guidance identifies capability boundaries honestly. | Blocked record with missing credential/service and no readiness claim. | Credentials required; blocked when absent. | Non-blocking if blocked explicitly. |

Fixture constraints:

- Fixture roots must be created under a test-owned temporary directory.
- Fixtures must not read or mutate `~/.codex`, `~/.agents`, Jamie-local
  project config, global Git config, or live Linear/GitHub state for baseline
  proof.
- Fixtures must record exact commands, exit codes, and changed files.
- A fixture is not deterministic if a second run produces unrelated diffs.
- A credential-blocked path is acceptable only when the eval records the exact
  missing input and the baseline proof remains credential-free.

## Package Form Order

Proof should progress from cheapest to most consumer-realistic:

1. Source workspace package proof.
   - Use the current checkout to run existing static validation and command
     reference checks.
   - This catches contract drift quickly but does not prove installed behavior.
2. Packed artifact proof.
   - Use the repo's package output or a local package/tarball install path when
     available.
   - This is the first acceptable proof for packaged downstream behavior.
3. Published/global install proof.
   - Use only when credentials, network policy, and release-channel safety are
     intentionally available.
   - Absence of this proof must not block JSC-283 if packed artifact fixtures
     prove the local release candidate.

The first implementation should not start with global install. That creates
network and credential noise before local behavior proof exists.

## Lifecycle

1. Confirm tracker and labels.
   - Use `JSC-283` as the only selected slice.
   - Keep `JSC-248`, JSC-178, governance, and CI migration out of scope.

2. Design the fixture matrix.
   - Define scenarios, command path, setup, expected proof, credentials,
     closure status, and rollback signal.
   - Start with the smallest local matrix that can disprove false confidence.

3. Preserve static validation.
   - Keep current static validators active.
   - Add behavior validation beside them, not instead of them.

4. Add local clean repo behavior proof.
   - Prove the skill can guide install/init or record the exact blocker.
   - Record generated files and ownership expectations.

5. Add update/idempotence behavior proof.
   - Prove repeated update guidance is deterministic.
   - Confirm managed/adaptable ownership semantics are preserved.

6. Add environment/action-sync ownership proof.
   - Prove generated environment actions can update.
   - Prove customized environment config is not overwritten silently.

7. Add command reference resolution proof.
   - Compare packaged skill references against the JSC-282 command truth.
   - Do not add fake commands to make docs pass.

8. Produce eval and gate recommendation.
   - Write the JSC-283 eval with exact command outcomes.
   - Recommend whether fixtures remain advisory or can become release-blocking.

## Interfaces

Likely affected interfaces:

- Skill entrypoint: `.agents/skills/coding-harness/SKILL.md`.
- Skill references under `.agents/skills/coding-harness/references/**`.
- Static validator: `scripts/validate-packaged-skill.cjs`.
- Reference validator:
  `.agents/skills/coding-harness/scripts/validate_reference_contracts.py`.
- Package scripts that invoke skill validation.
- Test fixture helpers introduced for downstream-like repos.
- Eval artifact:
  `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md`.

Interfaces that must remain stable:

- `harness next --json`.
- `HarnessDecision`.
- command exit-code contract.
- skill capability boundaries around credentials and secrets.
- harness init/update managed/adaptable ownership semantics.
- fast static skill validation command.

## Invariants

- The packaged skill is a product API, not a docs appendix.
- String-level validation is not semantic assurance.
- Static validation remains required.
- Baseline fixtures must not require credentials.
- Fixture setup must be deterministic and portable.
- User-owned environment config must not be overwritten silently.
- Command references must resolve to real source-command truth or explicit
  blocked/deprecated status.
- Closure requires eval proof with observed behavior.
- More skill prose is not a substitute for behavior proof.

## Failure And Recovery

Stop conditions:

- Fixture setup depends on Jamie-local absolute paths outside controlled temp
  workspaces.
- Fixture behavior depends on unavailable credentials for the baseline path.
- Test output cannot distinguish implementation failure from environment,
  credential, or contract failure.
- A fixture modifies user-owned/adaptable files unexpectedly.
- Command reference resolution encourages fake dispatch branches.
- The implementation expands into broad plugin or command cleanup.

Recovery:

- Keep static validation blocking.
- Mark behavior fixture gate advisory until deterministic.
- Record exact blocker in the eval artifact.
- Split flaky fixture work into a follow-up only if it is independently
  verifiable and still part of JSC-283.

Rollback:

- Remove fixture-gate wiring before removing fixture code.
- Restore skill references to the last validator-clean state.
- Keep the fixture matrix artifact when it contains useful failure evidence.

## Observability

Required evidence:

- Fixture matrix with scenario, setup, expected proof, credentials, and status.
- Exact static validation command and result.
- Exact clean repo fixture command and result.
- Exact update/idempotence fixture command and result.
- Exact environment/action-sync fixture command and result.
- Exact command-reference resolution command and result.
- Eval artifact with pass/fail/blocked classification for each fixture.

Recommended metrics:

- Number of packaged skill references behavior-resolved.
- Number of baseline fixtures that run without credentials.
- Fixture runtime.
- Number of static validators retained.
- Number of credential-gated checks explicitly blocked with missing inputs.

## Validation Ladder

JSC-283 validation should move through this ladder in order:

1. `pnpm skill:validate` or the current equivalent packaged skill static check.
2. Markdown/spec lint for harness artifacts touched by the slice.
3. Command-reference resolution check against JSC-282 source truth.
4. Clean repo fixture.
5. Existing repo update/idempotence fixture.
6. Customized environment/action-sync fixture.
7. Eval artifact validation.
8. Broader repo gate only after behavior or release-gate wiring changes:
   `bash scripts/verify-work.sh --fast`.

Promotion rule:

- Static checks may remain blocking from the start.
- Behavior fixtures should begin advisory.
- A fixture may become release-blocking only after two consecutive local runs
  are deterministic and its failure mode is clearly attributable to product
  behavior rather than fixture setup.

## Loophole Controls

Known loopholes to close before `he-work`:

| Loophole | Why it is dangerous | Required control |
| --- | --- | --- |
| Source-only proof masquerades as packaged proof | It repeats JSC-282 confidence and leaves downstream install untested. | Require packed artifact or explicit deferral before JSC-283 closure. |
| Fixture passes by checking strings | It recreates the existing lexical validator under a different name. | Every behavior fixture must run a documented command path and capture output/diffs. |
| Global install is used first | Network, registry, and credential noise obscure local product behavior. | Start with local workspace/packed artifact proof. |
| Credential paths silently skipped | Readiness claims become broader than evidence. | Eval must mark remote checks blocked with exact missing inputs. |
| Fixtures mutate user-owned files | The skill breaks trust in downstream repos. | Customized fixture must assert preservation or conflict behavior. |
| Fake dispatch is added for stale references | It hides command truth drift instead of repairing it. | Command-reference mismatches must be fixed at the real source or marked deprecated/blocked. |
| Fixture bloat becomes a downstream simulator | The slice becomes slow and hard to maintain. | Keep one fixture per adoption-critical state until evidence justifies expansion. |

## Acceptance Matrix

| ID | Acceptance Criterion | Validation | Source |
| --- | --- | --- | --- |
| SA-283-001 | Scope remains bounded to `JSC-283` and does not reopen JSC-248, JSC-282, CI migration, or governance/memory work. | Spec and plan traceability reference only `JSC-283` for implementation scope. | Linear delta gate |
| SA-283-010 | A packaged skill fixture matrix exists for clean repo, existing harness repo, customized environment/action-sync, command reference resolution, and credential-blocked checks. | Matrix records scenario, setup, expected proof, credential need, closure status, and rollback signal. | `.harness/refactors/packaged-skill-behavior-assurance.md` |
| SA-283-012 | The spec or plan names the package form used for behavior proof and does not treat source-only validation as packaged readiness. | he-plan records the first proof target and closure target separately; JSC-283 closure requires packed artifact proof or an explicit non-closure blocker. | ADR-007 |
| SA-283-011 | Static packaged skill validation remains active and is not replaced by fixture tests. | Existing static validator command still runs and is listed in eval evidence. | ADR-007 |
| SA-283-020 | Clean repo packaged skill behavior is proven locally or explicitly blocked with exact reason. | Fixture output is recorded in the eval artifact. | refactor phase 2 |
| SA-283-030 | Existing harness repo update/idempotence behavior is proven locally or explicitly blocked with exact reason. | Fixture output is recorded in the eval artifact. | refactor phase 3 |
| SA-283-040 | Customized environment/action-sync ownership is proven locally or explicitly blocked with exact reason. | Fixture output shows generated config can update and customized config is preserved. | refactor phase 4 |
| SA-283-050 | Packaged skill command references resolve against the JSC-282 source-command truth or carry explicit blocked/deprecated status. | Resolution check compares skill references with source command truth and records mismatches. | routing invariants |
| SA-283-060 | Credential-required remote checks are represented as blocked with missing inputs, not skipped. | Eval lists missing credentials or services for each blocked remote path. | execution invariants |
| SA-283-070 | Fixture tests remain advisory until deterministic enough to gate release confidence. | he-plan records advisory vs blocking gate state and promotion criteria. | refactor phase 6 |
| SA-283-080 | JSC-283 closure writes `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md`. | Eval artifact validates and links back to `JSC-283`. | execution invariants |
| SA-283-090 | The first `he-work` slice cannot implement broad release-gate wiring before the fixture matrix and at least one local behavior fixture exist. | he-plan sequencing keeps release-gate promotion behind fixture determinism evidence. | anti-drift principles |

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Notes |
| --- | --- | --- |
| JSC-283 | SA-283-001, SA-283-010, SA-283-011, SA-283-012, SA-283-020, SA-283-030, SA-283-040, SA-283-050, SA-283-060, SA-283-070, SA-283-080, SA-283-090 | Parent issue for packaged skill behavior assurance. |
| JSC-282 | SA-283-050 | Source-command truth provider only; implementation scope remains out of JSC-282. |

## First Slice

First implementation slice:

- Parent issue: `JSC-283`.
- Phase: fixture matrix design.
- Acceptance IDs: SA-283-001, SA-283-010, SA-283-011, SA-283-060.
  SA-283-012 and SA-283-090 must also be decided before any fixture code is
  promoted beyond matrix design.

Objective:

- Produce the smallest behavior-proof matrix before writing fixture code.

Expected output:

- Fixture matrix artifact or committed test-plan section.
- Static validator preservation note.
- Credential-blocked policy for remote checks.
- Package-form decision for first behavior proof.
- Release-gate deferral rule.
- Recommendation for the first fixture implementation.

Validation:

- `pnpm skill:validate` or the current equivalent static skill validation
  command remains passing.
- Docs/spec lint passes for the matrix/spec updates.
- No runtime behavior changes are introduced by matrix design alone.

## Open Questions

- Should the fixture matrix live in the JSC-283 plan, a dedicated test fixture
  README, or the eval draft until implementation starts?
- Which temporary fixture root should be canonical: test-owned temp directories
  or a reusable fixture generator under scripts/tests?
- Which package form is the first proof target: source workspace package,
  packed tarball, or installed published package?
- Should release-gate promotion happen in JSC-283 or remain a follow-up after
  advisory fixture stability?

## Done

This spec is complete when:

- Linear labels are reconciled for `JSC-283`.
- The spec names one parent issue and one refactor source.
- Acceptance IDs map to `JSC-283`.
- The first `he-plan` slice is fixture matrix design.
- Out-of-scope boundaries prevent expansion into JSC-248, JSC-282, governance,
  CI migration, or broad command cleanup.

JSC-283 implementation is complete only when:

- All `JSC-283` acceptance IDs in the Linear Acceptance Traceability table are
  satisfied or explicitly blocked with durable evidence.
- The JSC-283 eval artifact exists, validates, and links back to Linear.
- Live Linear state is updated intentionally.

## he-plan Handoff

Next command:

- Run `he-plan` for `JSC-283` using this spec.

Planner constraints:

- Start with fixture matrix design.
- Keep static validation.
- Do not implement release-blocking fixture gates before advisory determinism is
  proven.
- Treat credential-required paths as explicit blockers, not skipped tests.
- Keep child issues grouped by fixture scenario.
- Preserve JSC-282 as source-command evidence, not implementation scope.

## Blackboard Delta

- Selected slice: `JSC-283`.
- Selected refactor: packaged skill behavior assurance.
- Linear label gate: resolved through the Linear plugin on 2026-05-08.
- Current safest next move: fixture matrix design.
- Main risk: confusing static skill validation with downstream usability.
- Main dependency: JSC-282 source-command truth.
- Required eval:
  `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md`.

## Evidence

Facts:

- `.harness/linear/coding-harness-linear-plan.md` now selects `JSC-283` as the
  first approved next slice.
- Live Linear has `JSC-283` under the `Agent Cockpit Compression Slice`
  milestone with priority `2 High`.
- The required labels were created/applied through the Linear plugin on
  2026-05-08.
- `.harness/evals/coding-harness-jsc-282-command-truth-eval.md` recommends
  completing JSC-282 source-command scope and keeping JSC-283 open for
  packaged/install proof.
- ADR-007 requires downstream-like behavior proof for packaged skill readiness.
- Routing invariants require packaged skill references to resolve against real
  commands and downstream-like behavior fixtures.
- Execution invariants require behavior fixtures for downstream skill readiness.

Interpretation:

- JSC-283 is the correct next spec because it tests the adoption surface rather
  than expanding command cleanup.
- Fixture matrix design must happen before implementation to keep the slice from
  turning into broad downstream simulation.

Assumptions:

- Local fixture repos can prove the first useful behavior paths without secrets.
- Credential-backed GitHub/Linear behavior can be blocked honestly until the
  right environment exists.
