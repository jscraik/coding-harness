# Command Cockpit Truth Reconciliation

# Refactor Classification

routing redesign, cognition compression, anti-drift hardening, execution
determinism, skill discoverability improvement, context-load reduction, moat
reinforcement

# Problem Statement

The command surface is both a strategic asset and a cognition risk. The prior
artifacts identify `harness next --json`, `HarnessDecision`, and command
capability metadata as moat-critical agent-native surfaces. The same artifacts
also record 64 baseline `drift-gate.command.command.surface.dispatch.missing`
warnings for commands documented in README but not dispatched in `src/cli.ts`.

The issue is that command truth is split across README, help text, CLI dispatch,
command registry, command capability metadata, skills, and validation output.
When these disagree, agents lose the cockpit and start guessing.

This weakens execution quality because a documented command that does not
dispatch is not documentation drift. It is an anti-agent instruction.

# Root Cause Analysis

The command surface grew from real operational needs. Commands were added to
support gates, migrations, review contexts, policy checks, and setup flows.
Documentation then grew as a product surface, while dispatch and registry truth
continued evolving in code.

The drift survived because warnings are baseline and non-blocking. The command
catalog mitigates breadth, but it cannot compensate for public docs that do not
match runtime truth.

The issue is operational and agent-native. The architecture has good raw
materials, but the source-of-truth hierarchy needs to become deterministic.

# Evidence

Facts:

- `.harness/review/coding-harness-architecture-review.md` records 64
  non-blocking command-surface dispatch warnings.
- The review identifies `src/lib/cli/registry/command-capabilities.ts` as a
  deep module for command categories, mutability, retryability, risk, and
  audience.
- `.harness/features/coding-harness-intent.md` says agents should start with
  `harness next --json`.
- `.harness/strategy/coding-harness-strategy.md` says command docs, help,
  registry, and dispatch must not disagree.

Interpretation:

- The command cockpit is real, but public truth drift is already present.
- Command docs should be generated or reconciled from runtime-capable sources.

Assumptions:

- Existing command capability metadata can become the canonical generation
  source or be aligned with the canonical dispatch source.
- Some documented commands may be aliases or conceptual surfaces rather than
  direct dispatch branches; those need explicit classification.

# Architectural Impact

Affected systems:

- `src/cli.ts`
- command registry
- command capability metadata
- README command tables
- packaged skill command references
- drift-gate command-surface checks
- `harness next --json`
- CLI help output

Blast radius:

Medium-high. This touches public product docs and agent routing but should not
change core business logic.

Migration complexity:

Moderate. The hard part is classification and enforcement, not implementation.

Rollback difficulty:

Low if generated docs or classifications are additive before old references are
removed.

Likely files/directories touched:

- `src/cli.ts`
- `src/lib/cli/registry/**`
- `README.md`
- `.agents/skills/coding-harness/references/**`
- drift-gate command-surface code and fixtures
- docs generated from command metadata

Systems that must not be touched casually:

- `HarnessDecision` schema.
- Existing command exit-code contracts.
- Stable public cockpit commands.
- Mutating command risk metadata.

# Desired End State

Command truth should have one operational source and generated projections.

The cockpit should be explicit:

- cockpit commands: small public front door
- domain commands: discoverable through `commands --json` and `next`
- plumbing commands: hidden unless called by cockpit/domain commands
- legacy aliases: owner, expiry, and test or deletion

Agents should be able to run `harness next --json` and receive a safe path
without reading the README command inventory.

# Migration Strategy

Use classification before mutation.

Sequencing order:

1. Export the current README command list, dispatch list, registry list, and
   capability list into one comparison artifact.
2. Classify every mismatch as dispatch bug, docs bug, alias, generated-only
   command, or legacy candidate.
3. Define command tiers and admission rules.
4. Generate README command fragments or validate README against the canonical
   source.
5. Update packaged skill references to point to the same command truth.
6. Make future command-surface drift blocking for touched areas.

Coexistence rule:

Manual README command docs may exist only if generated markers or validation
prove they match runtime truth.

Rollback strategy:

If generation destabilizes docs, keep the comparison artifact and enforce
warning classification first. Do not block releases until the command map is
classified.

Linear milestone/parent issue shape:

One parent issue with classification, generation, skill sync, and enforcement
sub-issues. Avoid creating one issue per command.

# Execution Phases

## Phase 1 - Command Surface Inventory

Objective:

Create a deterministic inventory of README commands, CLI dispatch branches,
registry entries, capability metadata, help output, and skill references.

Affected systems:

Docs, CLI, registry, drift-gate artifacts.

Expected risk:

Low.

Can run in parallel:

No.

Validation requirements:

- Inventory artifact lists every mismatch.
- No source behavior changes.

Rollback conditions:

If inventory cannot distinguish runtime commands from conceptual docs, stop and
add a classification schema.

Linear mapping:

Sub-issue: "Inventory command truth sources".

Agent-safe:

Yes.

Human review required:

No for inventory, yes for classification policy.

## Phase 2 - Tier And Admission Rules

Objective:

Define cockpit, domain, plumbing, and legacy tiers with admission rules.

Affected systems:

Command capability metadata, strategy docs, future ADR.

Expected risk:

Low-medium.

Can run in parallel:

No.

Validation requirements:

- Every public command has a tier.
- Mutating commands have risk metadata and safe-first guidance.

Rollback conditions:

If tier rules become advisory prose without validation, stop.

Linear mapping:

Sub-issue: "Define command surface budget and tiers".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 3 - Truth Projection

Objective:

Generate or validate README and skill command references from the canonical
command source.

Affected systems:

README, packaged skill references, command docs.

Expected risk:

Medium.

Can run in parallel:

No.

Validation requirements:

- Drift-gate command warnings decrease.
- Generated fragments are reproducible.
- Skill validation still passes.

Rollback conditions:

If generated docs become unreadable or lose critical usage context, revert docs
projection and keep validation-only mode.

Linear mapping:

Sub-issue: "Generate command docs from runtime truth".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 4 - Dispatch Or Demote

Objective:

Resolve each mismatch by adding runtime dispatch only where the command is real,
or deleting/demoting stale docs where it is not.

Affected systems:

`src/cli.ts`, docs, tests, registry.

Expected risk:

Medium-high.

Can run in parallel:

Yes, only after inventory slices are independent.

Validation requirements:

- CLI dispatch tests for added dispatch.
- Docs lint.
- Drift-gate command warnings reduced.

Rollback conditions:

If dispatch is added without tests or risk metadata, revert.

Linear mapping:

Sub-issue: "Resolve command dispatch/docs mismatches".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 5 - Blocking Drift Enforcement

Objective:

Make new command-surface drift blocking for changed areas.

Affected systems:

Drift-gate, verify-work, docs-gate if applicable.

Expected risk:

Medium.

Can run in parallel:

No.

Validation requirements:

- Existing baseline warnings are either resolved or explicitly grandfathered.
- New drift fails in tests.

Rollback conditions:

If the gate blocks unrelated work due to old baseline, keep baseline mode and
block only changed command surfaces.

Linear mapping:

Sub-issue: "Block new command truth drift".

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

Coding Harness - Agent Cockpit Compression.

Repo-specific or cross-repo:

Repo-specific first. Cross-repo later if generated command truth becomes a
shared harness pattern.

Portfolio Ops:

Yes as an adoption-quality concern, but execution should remain in the
coding-harness project.

Dev Portfolio:

Yes.

Recommended milestone name:

Command Cockpit Truth Reconciliation.

Recommended parent issue title:

Reconcile README, CLI, registry, and skill command truth.

Recommended sub-issues:

- Inventory command truth sources.
- Define command surface budget and tiers.
- Generate command docs from runtime truth.
- Resolve command dispatch/docs mismatches.
- Block new command truth drift.

Suggested priority:

P1.

Suggested labels:

agent-native, command-surface, drift, docs-truth, cockpit, refactor-program.

Dependencies:

Inventory before enforcement.

Project reactivation:

Reactivate any existing cockpit/compression project if present.

Active set:

Keep one classification issue and one implementation issue active at a time.

# Anti-Regression Constraints

- Do not add new top-level commands without tier, owner, risk, and validation.
- Do not expand README command tables manually without generated validation.
- Do not hide mutating command risk metadata.
- Do not make `harness next --json` less central.
- Do not treat aliases as free; every alias needs owner and purpose.
- Do not close with baseline warnings merely reclassified as acceptable noise.

# Eval Requirements

Expected eval artifact:

`.harness/evals/coding-harness-command-cockpit-truth-reconciliation-eval.md`

Eval must prove:

- README, help, registry, dispatch, and skill references are reconciled or have
  explicit classifications.
- The number of unclassified dispatch warnings trends to zero.
- A new drift fixture fails when docs mention an undispatched public command.
- Agents can identify the recommended command path through `next --json`.
- Public command count and tier distribution are recorded.

No Linear parent issue or milestone should close without this eval artifact.

# Success Criteria

- Zero unclassified README/CLI dispatch drift.
- All public commands have capability metadata.
- Cockpit command set is small and named.
- README command surfaces are generated or validation-backed.
- Packaged skill references match runtime truth.
- New command drift is blocking for changed areas.

# Safe Rollback Conditions

Rollback if:

- generated docs remove critical human usage context
- dispatch changes alter exit-code behavior unexpectedly
- command tiers break `harness next --json`
- new enforcement blocks unrelated work due to old baseline

Linear status recommendation:

Move enforcement sub-issue to blocked, keep inventory/classification complete,
and resume with narrower changed-area enforcement.

# Future-Agent Guidance

Preserve:

- `harness next --json`
- command capability metadata
- stable exit-code contracts
- mutating command risk metadata

Simplify further:

- docs projections
- aliases
- plumbing command visibility

Intentional complexity:

Some commands represent real domains and should remain accessible through JSON
discovery.

Accidental complexity:

Manual command docs and stale aliases.

Safe to modify:

Docs generation, command metadata, alias visibility, and README command tables.

Human review required:

Public command deletions, exit-code changes, and mutation-risk changes.

# Related Systems

- `.harness/features/coding-harness-intent.md`
- `.harness/review/coding-harness-architecture-review.md`
- `.harness/triage/coding-harness-triage.md`
- `.harness/strategy/coding-harness-strategy.md`
- `src/cli.ts`
- `src/lib/cli/registry/**`
- `.agents/skills/coding-harness/references/**`
- drift-gate command-surface findings
