---
schema_version: 1
title: JSC-282 Command Truth Cockpit Plan
type: architecture
status: superseded
date: 2026-05-07
superseded_by: .harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md
superseded_reason: 2026-05-08 plan carries the active completed JSC-282 command-truth evidence.
plan_id: jsc-282-command-truth-cockpit
origin: .harness/specs/coding-harness-agent-cockpit-compression-spec.md
repo: coding-harness
linear_issue: JSC-282
linear_issue_url: https://linear.app/jscraik/issue/JSC-282/coding-harness-reconcile-command-truth-for-pr-loop-cockpit
linear_project: coding-harness
linear_milestone: Agent Cockpit Compression Slice
linear_blocks:
  - JSC-283
source_spec: .harness/specs/coding-harness-agent-cockpit-compression-spec.md
source_refactor: .harness/refactors/command-cockpit-truth-reconciliation.md
traceability_required: true
---

# JSC-282 Command Truth Cockpit Plan

> Superseded: use
> .harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md
> as the active JSC-282 command-truth cockpit plan. This draft is retained for
> historical context only.

## Table Of Contents

- [Plan Summary](#plan-summary)
- [Authority](#authority)
- [Linear Tracker](#linear-tracker)
- [Baseline Evidence](#baseline-evidence)
- [First-Contact Budget](#first-contact-budget)
- [Implementation Steps](#implementation-steps)
- [Acceptance Criteria](#acceptance-criteria)
- [Validation Plan](#validation-plan)
- [Rollback Plan](#rollback-plan)
- [Dependencies And Sequencing](#dependencies-and-sequencing)
- [Human Review Points](#human-review-points)
- [Out Of Scope](#out-of-scope)
- [Linear / Spec / Plan / PR Traceability](#linear--spec--plan--pr-traceability)
- [Slack Policy](#slack-policy)
- [he-work Handoff](#he-work-handoff)
- [Blackboard Delta](#blackboard-delta)

## Plan Summary

JSC-282 must make the command cockpit truthful before JSC-283 proves packaged
skill behavior against it.

The work is deliberately subtractive before additive:

1. Inventory command truth across runtime, source, docs, help, registry,
   capability metadata, skill references, and gates.
2. Classify mismatches before changing behavior.
3. Define the visible command budget and demote or hide commands that do not
   belong in first-contact surfaces.
4. Validate or generate projections so README/help/skill references cannot drift
   from runtime command truth.
5. Dispatch only the selected cockpit batch that survives classification.
6. Write the command-truth eval artifact before closing JSC-282.

This plan does not implement JSC-283. It only prepares the command truth that
JSC-283 will consume.

## Authority

Primary source:

- `.harness/specs/coding-harness-agent-cockpit-compression-spec.md`

Selected Linear slice:

- `JSC-282: [coding-harness] Reconcile command truth for PR-loop cockpit`

Selected refactor:

- `.harness/refactors/command-cockpit-truth-reconciliation.md`

Binding decisions and invariants:

- `.harness/decisions/ADR-001-pr-loop-cockpit-core.md`
- `.harness/decisions/ADR-002-command-truth-and-surface-budget.md`
- `.harness/core/routing-invariants.md`
- `.harness/core/execution-invariants.md`

Secondary context only:

- `.harness/linear/coding-harness-linear-plan.md`
- `.harness/refactors/packaged-skill-behavior-assurance.md`
- `.harness/core/cognition-principles.md`
- `.harness/core/anti-drift-principles.md`

## Linear Tracker

| Field | Value |
| --- | --- |
| Issue | `JSC-282` |
| Title | `[coding-harness] Reconcile command truth for PR-loop cockpit` |
| URL | `https://linear.app/jscraik/issue/JSC-282/coding-harness-reconcile-command-truth-for-pr-loop-cockpit` |
| Project | `coding-harness` |
| Milestone | `Agent Cockpit Compression Slice` |
| Priority | `2 High` |
| Blocks | `JSC-283` |
| Current route | Agent-assisted; human review required for public command tier/admission decisions |

## Baseline Evidence

Observed in this planning pass:

- `src/lib/cli/command-registry.ts` has a command registry and `commands`
  command, plus `getRegistryCommandHelpRows()` for focused/default help rows.
- `src/lib/cli/registry/command-capabilities.ts` defines command category,
  mutability, retryability, tier, audience, orchestrator, agent mode, and
  visibility.
- `src/cli.ts` contains source help text that says `Start here: harness next
  --json`.
- `pnpm exec harness --help` currently emits a broader first-contact path:
  install/init/contract/health steps, hero workflows, and a large focused
  command list.
- `pnpm exec harness --help --all-commands` exposes aliases and full command
  rows.
- `pnpm exec harness commands --json --for-agent` currently emits 56 commands.
- The source constant `COMMAND_CATALOG_SCHEMA_VERSION` is
  `harness-command-catalog/v3`, while the observed command catalog emitted
  `harness-command-catalog/v1`. The first inventory must determine whether this
  is built artifact drift, stale package execution, or source/runtime mismatch.
- README has a command index and tells agents to prefer `harness commands
  --json`, while the spec and ADRs require `harness next --json` to remain the
  primary routing surface.

Interpretation:

- The repo already has useful compression primitives.
- The risk is not absence of metadata; it is visible-surface drift and too much
  first-contact command exposure.

## First-Contact Budget

Default agent-visible surfaces must converge on this budget unless a human
review explicitly approves an exception:

| Surface | Budget |
| --- | --- |
| Golden path | `harness next --json` |
| Setup rail | `harness init --dry-run`, `harness init --track`, `harness check --json` |
| Verification rail | `bash scripts/verify-work.sh --fast`, `harness review-gate ... --json` |
| Discovery rail | `harness commands --json --for-agent` |
| Expert escape hatch | `harness --help --all-commands`, `harness commands --json --all` |

Default help should not behave like a broad catalog. It may show enough rails to
start, check, verify, review, and discover agent-safe commands. Everything else
must be reachable through `next`, readiness packets, learning packets, explicit
advanced/all flags, or docs for expert operators.

The first implementation unit must measure the current visible command count and
record the exact budget delta before changing help or README text.

## Implementation Steps

### IU-001 - Command Truth Inventory

Acceptance IDs: SA-010, SA-011.

Objective:

- Produce a deterministic inventory of selected command truth sources with no
  behavior changes.

Affected files:

- new inventory script or fixture under `scripts/`, `src/lib/cli/**`, or
  `artifacts/` as selected during implementation
- `.harness/evals/coding-harness-command-cockpit-truth-reconciliation-eval.md`
  may be created as a draft evidence sink, but the final eval is not required
  until IU-006

Required inventory columns:

- command
- alias
- source location
- observed in `pnpm exec harness --help`
- observed in `pnpm exec harness --help --all-commands`
- observed in `pnpm exec harness commands --json --for-agent`
- observed in `pnpm exec harness commands --json --all`
- present in registry specs
- present in capability metadata
- present in README command index
- present in packaged skill references
- dispatch status
- mismatch class
- proposed tier
- recommended action

Implementation notes:

- Prefer using existing structured sources before parsing prose.
- If README parsing is required, reuse or extend existing doc-parity extraction
  code rather than inventing a one-off parser.
- Treat the runtime catalog schema mismatch as a first-class inventory finding.

Validation:

- Inventory command or test reproduces the same output twice.
- No production command behavior changes.
- Focused tests cover the inventory parser/source comparison if new logic is
  introduced.

Rollback:

- Delete the inventory artifact/script if it cannot classify runtime vs docs
  reliably.
- Keep notes in the eval draft if runtime source drift blocks the slice.

### IU-002 - Mismatch Classification And Tier Rules

Acceptance IDs: SA-011, SA-012, SA-013.

Objective:

- Classify every selected mismatch and define command tier/admission rules for
  the cockpit path.

Required mismatch classes:

- dispatch bug
- docs bug
- alias
- generated-only command
- planned command
- legacy candidate
- runtime artifact drift

Required tier actions:

- cockpit: keep visible only if directly serving init, next action selection,
  verification, PR readiness, review confidence, or learned-failure promotion
- domain: reachable through catalog or a cockpit recommendation, not promoted as
  first-contact
- plumbing: hidden from default help and agent catalog unless explicitly routed
- legacy: owner, validation path, and sunset condition required

Validation:

- Tier table exists for selected commands.
- No command remains unclassified.
- Human review approves public cockpit classifications before implementation
  changes.

Rollback:

- Revert tier metadata changes if human review rejects the public command
  budget.

### IU-003 - Help And Catalog Compression

Acceptance IDs: SA-014, SA-034.

Objective:

- Make default help and agent catalog match the first-contact budget.

Expected changes:

- Default help prioritizes `harness next --json` as the golden path.
- Full catalogs remain available behind explicit advanced/all flags.
- The agent catalog stops returning broad expert surfaces unless explicitly
  requested.
- Tests assert the budget for default help and `commands --json --for-agent`.

Validation:

- `pnpm exec harness --help`
- `pnpm exec harness --help --all-commands`
- `pnpm exec harness commands --json --for-agent`
- focused tests for `src/cli.ts` and `src/lib/cli/command-registry.test.ts`

Rollback:

- Restore previous help/catalog visibility while keeping the inventory and
  tier table.
- Do not roll back the inventory just because budget enforcement needs another
  pass.

### IU-004 - README And Skill Projection Alignment

Acceptance IDs: SA-014.

Objective:

- Align README front-door command prose and packaged skill command references
  with the chosen command truth source.

Expected changes:

- README front door points to `harness next --json` as the agent memory rule.
- README command index distinguishes cockpit rails from expert catalog.
- Packaged skill references do not point agents at command paths that are
  hidden, deprecated, or unavailable.
- Any generated fragment or validation rule has a stable source marker.

Validation:

- `pnpm docs:lint`
- `pnpm skill:validate`
- focused command-reference tests or validators

Rollback:

- Revert projection text if validation cannot prove alignment.
- Keep mismatch inventory so the next pass can repair projection logic.

### IU-005 - First Cockpit Runtime Batch

Acceptance IDs: SA-015, SA-034.

Objective:

- Dispatch, demote, or deprecate the first selected cockpit command batch based
  on classification.

Candidate command set:

- `next`
- `init`
- `check`
- `verify-work`
- `review-gate`
- `commands`

Rules:

- Do not add runtime support for every README command.
- Implement missing dispatch only for commands that meet cockpit criteria.
- Demote or document legacy handling for commands that do not.

Validation:

- direct command invocations for changed paths
- focused Vitest tests for dispatch/help/catalog behavior
- no regression to `HarnessDecision` behavior

Rollback:

- Revert runtime dispatch changes as one slice if command behavior changes
  outside the candidate set.

### IU-006 - Eval And Closure Proof

Acceptance IDs: SA-030, SA-032, SA-033, SA-034.

Objective:

- Produce closure evidence for JSC-282 and unblock JSC-283.

Required eval artifact:

- `.harness/evals/coding-harness-command-cockpit-truth-reconciliation-eval.md`

Eval must include:

- before/after command mismatch counts
- default help command count before/after
- agent catalog command count before/after
- runtime catalog schema mismatch disposition
- command budget exceptions and rationale
- exact validation commands and outcomes
- rollback notes
- explicit statement that JSC-283 may now consume the selected command set

Validation:

- `python3 ../agent-skills/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/specs/coding-harness-agent-cockpit-compression-spec.md`
- `pnpm docs:lint`
- `pnpm skill:validate`
- focused tests for changed command/help/catalog code
- `bash scripts/verify-work.sh --fast` before handoff if runtime/docs behavior
  changed

Rollback:

- If eval cannot distinguish docs drift from runtime drift, do not close
  JSC-282.
- Keep JSC-283 blocked until command truth is deterministic.

## Acceptance Criteria

| Plan ID | Spec Acceptance | Linear issue | Proof |
| --- | --- | --- | --- |
| PA-001 | SA-010, SA-011 | JSC-282 | Deterministic command truth inventory exists and classifies mismatches. |
| PA-002 | SA-012, SA-013 | JSC-282 | Selected command set has reviewed tiers and legacy ownership/sunset rules. |
| PA-003 | SA-014 | JSC-282 | Help, README/docs, skill references, and catalogs are generated or validated from command truth. |
| PA-004 | SA-015, SA-034 | JSC-282 | First cockpit batch is dispatched, demoted, or deprecated with focused runtime proof. |
| PA-005 | SA-030, SA-032, SA-033 | JSC-282 | Eval artifact records before/after metrics, validation, and rollback. |
| PA-006 | SA-034 | JSC-282 | `harness next --json`, `HarnessDecision`, and exit-code contracts are not weakened. |

## Validation Plan

Run validation in this order. Stop at the first failed gate.

1. Focused inventory validation.
   - Command: implementation-specific inventory test or script.
   - Required before: IU-002.

2. Focused command/help/catalog tests.
   - Command: `pnpm vitest run src/cli.test.ts src/cli-dispatch.test.ts src/lib/cli/command-registry.test.ts src/lib/cli/help-renderer.test.ts src/lib/cli/doc-parity.test.ts`
   - Required before: IU-003/IU-004 close.

3. Runtime command probes.
   - Command: `pnpm exec harness --help`
   - Command: `pnpm exec harness --help --all-commands`
   - Command: `pnpm exec harness commands --json --for-agent`
   - Command: `pnpm exec harness commands --json --all`
   - Required before: IU-006.

4. Docs and skill validation.
   - Command: `pnpm docs:lint`
   - Command: `pnpm skill:validate`
   - Required before: IU-006.

5. Spec traceability validation.
   - Command: `python3 ../agent-skills/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/specs/coding-harness-agent-cockpit-compression-spec.md`
   - Requires the sibling `../agent-skills` checkout. If the
     `he_linear_traceability_lint.py` script is absent, mark this step blocked
     with the missing path instead of substituting a different traceability
     check.
   - If blocked, IU-006 closure requires an explicit human waiver in Linear
     from a maintainer with missing-path evidence, completed substitute
     governance gates (`pnpm docs:lint`, `pnpm skill:validate`,
     `bash scripts/verify-work.sh --fast`), and a follow-up task to restore
     traceability-lint execution.
   - Required before: IU-006.

6. Repo readiness gate.
   - Command: `bash scripts/verify-work.sh --fast`
   - Required before: final handoff if source/docs/runtime behavior changed.

Broader gates:

- `pnpm check` is required only if implementation changes touch shared runtime
  behavior broadly enough that focused command tests and `verify-work --fast`
  are insufficient.
- `pnpm test:deep` is required only if runtime/artifact behavior changes beyond
  command help/catalog/projection surfaces.

## Rollback Plan

Rollback triggers:

- default help becomes less clear for a fresh agent
- agent catalog loses required safe discovery without replacement
- command inventory cannot reproduce from repo state
- generated README or skill projection increases drift
- `harness next --json` behavior or `HarnessDecision` semantics regress
- runtime catalog schema mismatch remains unexplained after IU-001

Rollback action:

- Revert runtime dispatch/help/catalog changes first.
- Keep inventory artifacts and eval notes unless they are proven wrong.
- Keep Linear blockers in place and do not unblock JSC-283.
- Record the failed unit, validation command, and rollback reason in the eval
  artifact.

## Dependencies And Sequencing

| Unit | Depends on | Blocks | Parallel? |
| --- | --- | --- | --- |
| IU-001 | none | IU-002, IU-003, IU-004, IU-005 | no |
| IU-002 | IU-001 | IU-003, IU-004, IU-005 | no |
| IU-003 | IU-001, IU-002 | IU-006 | no |
| IU-004 | IU-001, IU-002 | IU-006, JSC-283 command-reference proof | yes, after IU-002 review |
| IU-005 | IU-001, IU-002 | IU-006, JSC-283 | no |
| IU-006 | IU-003, IU-004, IU-005 | JSC-283 | no |

## Human Review Points

Human review is required before:

- accepting cockpit/domain/plumbing/legacy tier assignments
- hiding, demoting, or deprecating visible command families
- changing README front-door semantics
- treating runtime catalog schema mismatch as non-blocking
- unblocking JSC-283

Agent-safe:

- command inventory
- source comparison
- focused tests
- eval draft updates

Agent-assisted:

- help/catalog budget implementation
- README/skill projection alignment
- runtime command demotion or dispatch

## Out Of Scope

- JSC-283 packaged skill behavior fixtures.
- governance/memory truth ownership.
- CI migration lifecycle extraction.
- validation typed gate specs.
- full command rewrite.
- one issue per command.
- a new Linear initiative, project, or label cleanup campaign.

## Linear / Spec / Plan / PR Traceability

| Source | Plan Unit | Acceptance | PR expectation |
| --- | --- | --- | --- |
| JSC-282 | IU-001 | PA-001 | PR includes inventory artifact and no runtime behavior change. |
| JSC-282 | IU-002 | PA-002 | PR includes tier table or metadata changes plus human-reviewed decision notes. |
| JSC-282 | IU-003 | PA-003, PA-006 | PR includes help/catalog compression tests and runtime probes. |
| JSC-282 | IU-004 | PA-003 | PR includes README/skill projection validation. |
| JSC-282 | IU-005 | PA-004, PA-006 | PR includes focused dispatch/runtime tests. |
| JSC-282 | IU-006 | PA-005, PA-006 | PR includes eval artifact and closure evidence. |
| `.harness/specs/coding-harness-agent-cockpit-compression-spec.md` | all units | SA-010 through SA-015, SA-030, SA-032 through SA-034 | PR links spec and JSC-282. |

## Slack Policy

No Slack notification is required for this plan.

If implementation finds that the first-contact budget conflicts with existing
public release expectations, pause and ask for human review in Linear before
continuing.

## he-work Handoff

Start with IU-001 only.

Instructions for `he-work`:

- Do not edit runtime dispatch, README, or packaged skill references in the
  first pass.
- Build or extend the smallest deterministic inventory path.
- Prefer existing structured command sources over README parsing.
- Record the runtime catalog schema mismatch.
- Produce the inventory output and a short classification schema.
- Update the eval artifact only as a draft evidence sink if useful.
- Stop before command tier/admission changes.

## Blackboard Delta

```yaml
schema_version: he-blackboard-delta/v1
topic: command-truth-cockpit
selected_issue: JSC-282
blocks: JSC-283
golden_path: harness next --json
first_unit: IU-001
required_first_contact_budget:
  golden_path: harness next --json
  setup_rail:
    - harness init --dry-run
    - harness init --track
    - harness check --json
  verification_rail:
    - harness verify-work --fast
    - harness review-gate ... --json
  discovery_rail:
    - harness commands --json --for-agent
  expert_escape_hatch:
    - harness --help --all-commands
    - harness commands --json --all
observed_baseline:
  agent_catalog_command_count: 56
  runtime_catalog_schema: harness-command-catalog/v1
  source_catalog_schema_constant: harness-command-catalog/v3
stop_rule: do not dispatch or demote commands before inventory and classification
```
