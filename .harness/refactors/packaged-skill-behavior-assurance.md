# Packaged Skill Behavior Assurance

# Table Of Contents

- [Refactor Classification](#refactor-classification)
- [Problem Statement](#problem-statement)
- [Root Cause Analysis](#root-cause-analysis)
- [Evidence](#evidence)
- [Architectural Impact](#architectural-impact)
- [Desired End State](#desired-end-state)
- [Migration Strategy](#migration-strategy)
- [Execution Phases](#execution-phases)
- [Linear Mapping](#linear-mapping)
- [Anti-Regression Constraints](#anti-regression-constraints)
- [Eval Requirements](#eval-requirements)
- [Success Criteria](#success-criteria)
- [Safe Rollback Conditions](#safe-rollback-conditions)
- [Future-Agent Guidance](#future-agent-guidance)
- [Related Systems](#related-systems)

# Refactor Classification

eval stabilization, skill discoverability improvement, execution determinism,
moat reinforcement, plugin boundary correction, context-load reduction

# Problem Statement

The packaged `coding-harness` skill is a strong product API. It carries install
and update guidance, capability boundaries, references, eval metadata, and
downstream operating contracts into target repos. The prior artifacts also warn
that current validation is partly lexical: validators catch missing files,
required references, deprecated strings, and static contract drift, but they do
not prove that a downstream repo can actually use the skill successfully.

The future-agent issue is trust. If a packaged skill passes validation but its
documented commands fail in a fixture repo, agents inherit false confidence.

The moat risk is direct. The packaged skill is how operational learning becomes
portable. If portability is asserted through string checks rather than behavior
fixtures, competitors can copy the prose while this repo loses its operational
advantage.

# Root Cause Analysis

The architecture emerged correctly: start with a portable skill package and
validate its static shape. That is the cheapest way to prevent known regressions
and stale references.

It survived because lexical validation is fast, deterministic, and easy to run
in CI. It is still valuable and should remain. The gap is that static validation
became too close to the release confidence boundary.

The issue is operational and agent-native. This is not a request for more skill
docs. It is a migration from static shape validation to fixture-backed behavior
assurance.

# Evidence

Facts:

- `.harness/review/coding-harness-architecture-review.md` identifies the
  packaged skill under `.agents/skills/coding-harness/` as a strong product API.
- The review says validators inspect required files, command references, eval
  text, install JSON, and forbidden deprecated patterns.
- The review and triage both warn that string-level skill drift validation does
  not prove downstream usability.
- `.harness/strategy/coding-harness-strategy.md` identifies fixture-backed
  downstream harness tests as core investment.

Interpretation:

- Skill release confidence should require fixture behavior proof, not just
  lexical checks.
- Optional plugin/tool breadth should not be promoted as core without
  fixture-backed value.

Assumptions:

- Fixture repos can be created locally without credentials for the first test
  matrix.
- Credential-required remote checks can be marked blocked with explicit reason
  rather than excluded silently.

# Architectural Impact

Affected systems:

- `.agents/skills/coding-harness/**`
- `scripts/validate-packaged-skill.cjs`
- `.agents/skills/coding-harness/scripts/validate_reference_contracts.py`
- packaged skill references
- `package.json` package files
- harness init/update/eject fixture flows
- downstream `.codex/environments/environment.toml` action-sync behavior
- eval artifacts

Blast radius:

Medium. Skill packaging is important, but behavior tests can start in isolated
fixtures.

Migration complexity:

Moderate. The risk is test flakiness and fixture bloat, not product behavior.

Rollback difficulty:

Low if fixture tests are additive before becoming release-blocking.

Likely files/directories touched:

- `.agents/skills/coding-harness/**`
- `scripts/validate-packaged-skill.cjs`
- future fixture directories under tests or temporary harness fixtures
- package scripts for skill validation
- eval artifacts under `.harness/evals/**`

Systems that must not be touched casually:

- Skill capability boundaries around credentials and secrets.
- Packaged skill progressive disclosure model.
- `harness init` managed/adaptable ownership semantics.
- Existing fast lexical validators.

# Desired End State

Packaged skill validation should have two layers:

1. Fast static validation for file shape, required references, deprecated text,
   and command strings.
2. Fixture-backed behavior validation for install, init/update, action sync,
   command resolution, and capability boundaries.

The skill remains a compact map. Behavior proof lives in tests and evals, not
more prose.

# Migration Strategy

Add fixture tests before making them release-blocking.

Sequencing order:

1. Define fixture matrix and blocked-credential policy.
2. Add a clean repo fixture for install/init guidance.
3. Add an existing harness repo fixture for update/idempotence.
4. Add customized environment fixture for action-sync ownership.
5. Add command reference resolution tests.
6. Wire behavior tests into release or packaged-skill gate after stabilization.

Coexistence rule:

Lexical validators remain the fast guard. Fixture tests become semantic release
confidence.

Rollback strategy:

If fixtures are flaky, keep lexical validation blocking and fixture validation
advisory until determinism is fixed.

Linear milestone/parent issue shape:

One parent issue for skill behavior assurance. Sub-issues by fixture scenario,
not by skill document.

# Execution Phases

## Phase 1 - Fixture Matrix Design

Objective:

Define the minimum downstream states the skill must support.

Affected systems:

Skill references, eval plan, test design.

Expected risk:

Low.

Can run in parallel:

No.

Validation requirements:

- Matrix includes clean repo, existing harness repo, customized environment,
  and credential-blocked remote checks.
- Each fixture has closure proof.

Rollback conditions:

If matrix expands into broad platform testing, cut it back to PR-loop behavior.

Linear mapping:

Sub-issue: "Design packaged skill fixture matrix".

Agent-safe:

Yes.

Human review required:

Yes.

## Phase 2 - Clean Repo Install Fixture

Objective:

Prove documented install/init guidance works in a clean repo without secrets.

Affected systems:

Skill references, harness init, generated files.

Expected risk:

Medium.

Can run in parallel:

No.

Validation requirements:

- Skill references resolve.
- Generated governance files match expected ownership.
- Required secret boundaries are explicit.

Rollback conditions:

If fixture setup is not deterministic.

Linear mapping:

Sub-issue: "Add clean repo packaged skill fixture".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 3 - Update And Idempotence Fixture

Objective:

Prove the skill guides safe update behavior in a repo that already has harness
state.

Affected systems:

`harness init --update`, managed/adaptable files, rollback notes.

Expected risk:

Medium.

Can run in parallel:

Yes, after fixture matrix design.

Validation requirements:

- Re-running update is deterministic.
- Managed/adaptable file ownership is preserved.
- Rollback guidance matches actual artifacts.

Rollback conditions:

Any fixture modifies adaptable project-owned files unexpectedly.

Linear mapping:

Sub-issue: "Add packaged skill update/idempotence fixture".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 4 - Environment Action Sync Fixture

Objective:

Prove `.codex/environments/environment.toml` guidance respects generated vs
customized ownership.

Affected systems:

Action-sync behavior, environment config, skill references.

Expected risk:

Medium.

Can run in parallel:

Yes, after clean fixture exists.

Validation requirements:

- Autogenerated environment can update.
- Customized environment is not overwritten silently.
- Diff/rollback evidence is produced.

Rollback conditions:

Any test encourages overwriting user-owned environment config.

Linear mapping:

Sub-issue: "Add environment action-sync fixture".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 5 - Command Reference Resolution

Objective:

Prove skill command references resolve against the built package and current CLI
truth.

Affected systems:

Skill references, command registry, package build, docs.

Expected risk:

Medium.

Can run in parallel:

No if command truth reconciliation is active; otherwise yes.

Validation requirements:

- Every skill command reference maps to dispatch, generated docs, or explicit
  blocked/credential-required status.
- Command truth drift does not re-enter skill references.

Rollback conditions:

If resolution requires adding fake dispatch branches for docs-only commands.

Linear mapping:

Sub-issue: "Validate packaged skill command references".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 6 - Release Gate Integration

Objective:

Promote deterministic fixture tests into the packaged-skill release gate.

Affected systems:

Package scripts, CI, release validation, skill validator.

Expected risk:

Medium-high.

Can run in parallel:

No.

Validation requirements:

- Fixture tests are deterministic locally.
- CI runtime remains acceptable.
- Credential-required checks are blocked with explicit reason.

Rollback conditions:

If fixture tests are flaky or materially slow release without catching behavior
risk.

Linear mapping:

Sub-issue: "Promote skill behavior fixtures to release gate".

Agent-safe:

Assisted.

Human review required:

Yes.

# Linear Mapping

Workspace/team: Jscraik
Team key: JSC
Top-level initiative: Dev Portfolio
Cross-repo project: Portfolio Ops
Repo-specific work: coding-harness

Target Linear project:

Coding Harness - Operational Moat Hardening.

Repo-specific or cross-repo:

Repo-specific now, cross-repo relevant because the skill is installed into
downstream repos.

Portfolio Ops:

Yes, because this proves portability across repo states.

Dev Portfolio:

Yes.

Recommended milestone name:

Packaged Skill Behavior Assurance.

Recommended parent issue title:

Add fixture-backed behavior tests for the packaged coding-harness skill.

Recommended sub-issues:

- Design packaged skill fixture matrix.
- Add clean repo packaged skill fixture.
- Add packaged skill update/idempotence fixture.
- Add environment action-sync fixture.
- Validate packaged skill command references.
- Promote skill behavior fixtures to release gate.

Suggested priority:

P2, P1 if packaged skill changes are actively shipping.

Suggested labels:

skill, eval, fixture, downstream, agent-native, moat, refactor-program.

Dependencies:

Command truth reconciliation for command reference closure.

Project reactivation:

Reactivate existing Operational Moat Hardening if present.

Active set:

Keep fixture design plus one fixture implementation active.

# Anti-Regression Constraints

- Do not replace lexical validation; extend it.
- Do not add skill prose instead of behavior proof.
- Do not require credentials for baseline fixture success.
- Do not overwrite user-owned environment config.
- Do not treat optional integrations as core without fixture proof.
- Do not close release confidence with string checks only.

# Eval Requirements

Expected eval artifact:

`.harness/evals/coding-harness-jsc-283-packaged-skill-behavior-assurance-eval.md`

Eval must prove:

- Clean repo fixture works.
- Existing harness repo update fixture works.
- Customized environment fixture preserves ownership.
- Command references resolve against current CLI truth.
- Credential-required boundaries are explicit.
- Fixture tests are deterministic enough to gate release.

No Linear parent issue or milestone should close without this eval artifact.

# Success Criteria

- Skill validation has static and behavior layers.
- Fixture matrix covers the smallest downstream states that matter.
- Skill command references cannot drift silently.
- Release confidence improves without turning the skill into a longer policy
  document.
- Future agents can trust the packaged skill as executable guidance.

# Safe Rollback Conditions

Rollback if:

- fixture tests are flaky
- fixture runtime becomes disproportionate
- tests require secrets for baseline paths
- action-sync fixture overwrites user-owned config
- command resolution encourages fake commands

Linear status recommendation:

Keep static validation as blocking, mark behavior-gate integration blocked, and
continue fixture hardening under the parent.

# Future-Agent Guidance

Preserve:

- progressive disclosure in `SKILL.md`
- explicit credential boundaries
- managed/adaptable ownership model
- fast lexical validation

Simplify further:

- skill prose
- optional tool references
- fixture setup
- command reference projections

Intentional complexity:

Downstream repo states and install/update ownership are real complexity.

Accidental complexity:

Treating command strings as enough proof of usability.

Safe to modify:

Fixture harness, skill references, validation scripts.

Human review required:

Release gate changes, capability boundary changes, and environment ownership
semantics.

# Related Systems

- `.harness/review/coding-harness-architecture-review.md`
- `.harness/triage/coding-harness-triage.md`
- `.harness/strategy/coding-harness-strategy.md`
- `.agents/skills/coding-harness/**`
- `scripts/validate-packaged-skill.cjs`
- `.agents/skills/coding-harness/scripts/validate_reference_contracts.py`
- `package.json`
- `harness init` and update lifecycle
