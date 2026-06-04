---
artifact_schema: harness-plan/v1
lifecycle_schema: harness-document-lifecycle/v1
canonical_slug: documentation-architecture-comparison
plan_id: PLAN-DOCARCH-2026-06-04
status: linear_tracking_created
lifecycle_status: execution-input
source_type: research_audit
source_path: .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
authority: execution-input
canonical_destination: .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md
related_project: coding-harness
related_module: documentation-architecture
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: event-driven
validated_by:
  - pnpm docs:lint
  - pnpm docs:lifecycle
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
linear_issue: JSC-392
linear_children: JSC-393,JSC-394,JSC-395,JSC-396,JSC-397
branch: codex/jsc-363-cnf-001-message-correlation
---

# Documentation Architecture Comparison Plan

## Command Summary

BLUF: This plan turns the documentation architecture audit into a bounded execution program: first make research and notes visibly non-canonical, then prove agents can choose the right documentation through task evals, then use that proof to guide progressive disclosure, stale-document cleanup, SemVer classification, and automation runbook standardization. The work matters because Coding Harness now has enough docs, plans, specs, generated artifacts, and research evidence that a human or agent can mistake old context for current doctrine. Execution is bounded to documentation architecture, validators, docs-gate integration, and docs-adjacent tests; the main risk is overbuilding a documentation operating system that increases context load instead of reducing it. The next handoff is a spec for the P0 research/document metadata contract before any archive or README/AGENTS restructuring begins.

Decision Needed: approve this plan as the execution order for the audit
findings.

Top Risks:

- Research and implementation notes may look authoritative before metadata and
  promotion rules are enforced.
- Reader-task evals can become generic tests unless each fixture asserts a
  canonical source, stop condition, validation command, and forbidden claim.
- README and AGENTS compression can accidentally weaken binding instructions if
  it happens before routing and eval proof exist.

Next Action: write the first spec,
.harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md.

## Objective

Convert
.harness/research/audits/2026-06-04-documentation-architecture-comparison.md
from reviewed research into an ordered implementation program that improves
progressive disclosure, stale-document cleanup, document lifecycle governance,
and agent-safe documentation routing without polluting downstream projects.

## Source Contract

Source artifact:

- AUD-DOCARCH-001:
  .harness/research/audits/2026-06-04-documentation-architecture-comparison.md

Accepted audit findings:

- AF-001: Keep a small canonical documentation surface and route supporting
  material through progressive disclosure.
- AF-002: Treat .harness/research, .harness/implementation-notes,
  .harness/specs, and .harness/plan as secondary or execution-input only when
  current, admitted, and classified.
- AF-003: Add status metadata and a research-to-canon promotion workflow before
  archiving or deleting stale material.
- AF-004: Add reader-task documentation evals because markdown and lifecycle
  shape checks do not prove that agents select the right source.
- AF-005: Keep generated artifacts and downstream scaffold templates separate
  from source-only documentation canon.
- AF-006: Standardize automation runbooks by trigger, scope, sources, workflow,
  validation, stop condition, and feedback loop.
- AF-007: Add SemVer/distribution impact classification for docs, packaged
  skills, downstream templates, and public CLI behavior.

Acceptance ID mapping:

| Acceptance ID | Source Finding | Required Proof |
| --- | --- | --- |
| VAC-001 | AF-002, AF-003 | Research and note metadata spec exists and names status, source type, canonical destination, validation, and archive rules. |
| VAC-002 | AF-003 | Metadata validation can run without failing all legacy historical files. |
| VAC-003 | AF-004 | Reader-task eval fixtures assert canonical source, validation command, stop condition, and forbidden claim. |
| VAC-004 | AF-005, AF-007 | Distribution impact matrix separates source-only docs, packaged-skill docs, downstream templates, generated projections, and CLI-facing docs. |
| VAC-005 | AF-001 | Progressive disclosure changes preserve binding AGENTS rules and are covered by reader-task evals. |
| VAC-006 | AF-006 | Automation runbooks use trigger, scope, sources, workflow, validation, stop condition, and feedback-loop sections. |
| VAC-007 | AF-002, AF-003 | Archive candidate report is advisory and never deletes or moves files automatically. |

Relevant current surfaces:

- docs/doc-lifecycle-manifest.json
- docs/doc-lifecycle.schema.json
- scripts/check-doc-lifecycle.ts
- src/lib/docs-surface
- src/commands/docs-gate-core.ts
- README.md
- AGENTS.md
- ARCHITECTURE.md
- CONTRIBUTING.md
- SECURITY.md
- UBIQUITOUS_LANGUAGE.md
- docs/README.md
- docs/architecture/documentation-layers.md
- .harness/README.md
- .harness/research/README.md
- .harness/implementation-notes/README.md
- .agents/skills/coding-harness/SKILL.md
- .github/PULL_REQUEST_TEMPLATE.md

## Scope and Boundaries

In scope:

- Documentation lifecycle metadata and promotion status.
- Research, implementation-note, plan, and spec authority classification.
- Reader-task eval fixtures and docs-gate integration.
- Advisory stale-document/archive candidate reporting.
- Progressive disclosure cleanup for README, AGENTS, docs indexes, and
  guardrail/runbook routing.
- SemVer and distribution impact classification for documentation, packaged
  skills, generated templates, and source-only docs.
- Automation runbook template and linting where enforcement is intentionally
  adopted.

Out of scope:

- Renaming the package, CLI, or repository from Coding Harness to synAIpse.
- Deleting research, plans, specs, or implementation notes without a reviewed
  archive decision.
- Further Linear, GitHub, branch protection, CI settings, release, or external
  system mutation outside the created issue tree.
- Editing generated architecture context directly as source truth.
- Changing downstream templates without a source distribution-impact decision
  and scaffold regression proof.
- Implementing all roadmap items in one PR.

## Authority and Scope Boundary

requested_depth: plan_only

approved_execution_boundary: User requested a durable plan from the reviewed
audit using docs-expert, improve-codebase-architecture, and he-plan.

downscope_authority: not_applicable

external_mutation_boundary: Linear issue tree JSC-392 through JSC-397 was
created by he-linear-plan after explicit user request; no GitHub, CI, release,
archive, or implementation mutation is authorized by this plan.

proof_boundary: Plan completeness is proved by artifact-shape checks, markdown
lint, docs lifecycle health, and explicit source traceability; implementation
completion requires later specs/work units.

non_proof_sources: chat_summary, stale_session, unvalidated_research

freshness_required: validation_time

human_acceptance_boundary: satisfied_for_linear_tracking; still required before
implementation slices that need specs or contract changes.

This plan does not authorize implementation by itself. It authorizes a staged
spec and implementation sequence after human acceptance or an active artifact
index names this plan as current.

## Current State / Evidence

Verified evidence:

- AUD-DOCARCH-001 exists and is marked status: reviewed.
- The audit identifies 29 governed docs, 249 markdown files under docs, 1,043
  files under .harness, and 209 files across research, notes, specs, and plans.
- docs/doc-lifecycle-manifest.json and docs/doc-lifecycle.schema.json exist.
- .harness/README.md already defines authority levels and distinguishes
  operator-requested audits from research audits.
- .harness/research/README.md and .harness/implementation-notes/README.md
  exist but are intentionally thin.
- Root docs and agent-facing docs are already metadata-bearing in the current
  worktree.

Known evidence debt:

- No reader-task documentation eval lane exists yet.
- Research and implementation-note metadata is not uniformly enforced.
- No stale-document/archive candidate report exists yet.
- README/AGENTS compression has not been proven with prompt-loading or reader
  dry-run evals.
- Linear tracking exists: JSC-392 parent with children JSC-393 through JSC-397.

## Implementation Strategy

Use a proof-first sequence:

1. Define and enforce authority metadata before moving or archiving documents.
2. Add reader-task evals before compressing canonical docs.
3. Add advisory stale-document reporting before deleting or archiving anything.
4. Normalize SemVer/distribution impact before touching downstream templates.
5. Standardize automation runbooks after the docs lifecycle model can classify
   their authority and validation.

Architecture decision:

- Prefer a small set of validators and manifests over additional prose-only
  governance.
- Keep the docs lifecycle checker as the central metadata gate.
- Keep docs-gate as the aggregation point once new checks stabilize.
- Keep source-only docs separate from src/templates distribution surfaces.

## Runtime Persistence and State

runtime_state: plan artifact created from reviewed audit; implementation not
started

resumption_key:
.harness/plan/2026-06-04-documentation-architecture-comparison-plan.md

runtime_invocation_receipt: Codex Desktop session on 2026-06-04; no external
mutation

artifact_chain_key: documentation-architecture-comparison

persistent_artifacts:

- .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md

live_state_refresh: required

session_evidence_status: historical_after_handoff

proof_boundary: This plan proves sequencing only; implementation proof must come
from later specs, tests, docs-gate, docs:lifecycle, and reader-task evals.

Before implementation resumes, refresh:

- current git status;
- current docs lifecycle manifest;
- current docs-gate behavior;
- current root docs line counts and touched-file scope;
- whether this plan is named by .harness/active-artifacts.md or another
  admitted control-plane index.

## Enforcement Contract

essential_decisions:

- Research and notes need local status metadata before archive cleanup.
- Reader-task evals must prove canonical-source selection, not prose quality.
- README/AGENTS compression waits until routing and eval proof exist.
- Generated and downstream template docs stay separate from source-only canon.

fillable_gaps:

- Exact metadata schema fields for research, notes, specs, and plans.
- Exact fixture format for docs-task evals.
- Archive candidate scoring rules.
- SemVer distribution-impact matrix entries.

guardrails:

- pnpm docs:lifecycle
- pnpm docs:lint
- bash scripts/run-harness-gate.sh docs-gate --mode required --json
- future docs-task eval command before required promotion

refusal_triggers:

- Request to delete research without archive-candidate evidence.
- Request to treat generated artifacts as source truth.
- Request to compress AGENTS.md by dropping binding rules instead of routing
  them.
- Request to modify downstream templates without distribution-impact proof.

durable_memory:

- .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
- future accepted specs and validator fixtures

professional_output:

- Changed files and exact validation commands.
- Pass/fail/blocked outcomes.
- Remaining stale-doc candidates and archive decisions.
- Reader-task eval results before claiming docs are agent-safe.

## Coding and Testing Lenses

coding_lens:

- Ownership: docs lifecycle and docs-surface modules own metadata validation;
  docs-gate owns aggregation; root docs own canon prose.
- Allowed surfaces: docs, .harness/research/README.md,
  .harness/implementation-notes/README.md, .harness/README.md, .harness/plan,
  .harness/specs, scripts/check-doc-lifecycle.ts, src/lib/docs-surface,
  src/commands/docs-gate-core.ts, and src/templates only after
  distribution-impact proof.
- Forbidden surfaces: generated architecture context as source truth, raw
  runtime evidence directories, external tracker or PR state, and downstream
  repos.
- Public contracts: docs/doc-lifecycle-manifest.json,
  docs/doc-lifecycle.schema.json, docs-gate JSON findings, and PR template
  documentation lifecycle fields.
- Complexity posture: prefer metadata, small validators, and advisory reports
  before broad prose rewrites.

testing_lens:

- Observable behavior: docs lifecycle checker rejects invalid governed-doc
  metadata; reader-task eval chooses expected canonical source and stop
  condition; archive candidate report is advisory and never deletes files;
  distribution guard keeps source-only docs out of downstream templates.
- Prior art: src/lib/docs-surface/doc-lifecycle.test.ts,
  src/commands/docs-gate.test.ts, src/lib/init/scaffold-doc-templates.test.ts,
  and src/commands/pr-template-gate.test.ts.
- Positive scenarios: research audit with reviewed status routes to plan/spec,
  not implementation authority; truth-lane PR closeout scenario loads
  lifecycle/claim-authority docs; downstream scaffold doc change gets
  distribution impact classified.
- Negative scenarios: raw research file cannot satisfy canon; generated diagram
  context cannot be edited as source; stale plan without active-artifact
  reference cannot route work.
- Exact validation commands: pnpm docs:lifecycle, pnpm docs:lint, and bash
  scripts/run-harness-gate.sh docs-gate --mode required --json.

Experience lenses applied:

- Docs Expert: every doc change needs a reader job, source truth, claim map, and
  smallest relevant validation.
- Deep Module Examiner: docs lifecycle metadata and docs-task evals should live
  behind narrow modules and not leak parsing logic into command facades.
- Domain Language Guardian: terms such as Lifecycle Harness, research
  admission, source-only, generated projection, and documentation complement
  require glossary ownership.
- Pragmatic Delivery Partner: sequence proof-producing P0 slices before broad
  cleanup.

## Work Units

### PU-001: Research And Notes Metadata Spec

Objective: Define the metadata and promotion contract for research, audits,
implementation notes, specs, and plans.

Source trace: AF-002, AF-003, audit recommendation P0 Expand Research And Notes
Metadata.

Allowed paths or areas:

- .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md
- .harness/research/README.md
- .harness/implementation-notes/README.md
- .harness/README.md
- docs/architecture/documentation-layers.md
- UBIQUITOUS_LANGUAGE.md

Forbidden paths or areas:

- bulk metadata rewrites across historical files before the spec is accepted;
- deletion/archive moves;
- downstream templates.

Steps:

1. Write the metadata spec with status values, source types, required fields,
   promotion states, archive states, and admission rules.
2. Define the first validation route: touched-file metadata check first,
   bulk-backfill advisory later.
3. Update only routing docs needed to make the spec discoverable.
4. Add glossary entries for Research Admission, Reader-Task Validation, and
   Documentation Compliment if missing.

Validation command/evidence:

- pnpm docs:lint
- pnpm docs:lifecycle
- bash scripts/run-harness-gate.sh docs-gate --mode required --json

Stop condition:

- Stop if the metadata spec cannot distinguish raw, reviewed, distilled,
  promoted, archived, and execution-input states without making all historical
  files immediately blocking.

Rollback note:

- Revert spec and routing docs; no historical data migration is allowed in this
  unit.

Handoff state:

- Route to he-spec, then implementation only after the spec is accepted.

### PU-002: Metadata Checker And Docs Lifecycle Integration

Objective: Add the smallest validator that enforces metadata on touched or
promoted research/notes/spec/plan artifacts without turning historical cleanup
into a blocking wall.

Source trace: AF-002, AF-003, PU-001.

Allowed paths or areas:

- scripts/check-doc-lifecycle.ts
- src/lib/docs-surface
- docs/doc-lifecycle.schema.json
- docs/doc-lifecycle-manifest.json
- tests under src/lib/docs-surface
- docs-gate integration only after the focused checker passes.

Forbidden paths or areas:

- bulk rewriting all .harness files;
- deleting archive candidates;
- changing PR template behavior before fixture proof.

Steps:

1. Extend docs-surface parsing only if the existing frontmatter parser cannot
   cover .harness metadata safely.
2. Add advisory mode for legacy files and required mode for touched/promoted
   files.
3. Add tests for raw, reviewed, promoted, archived, and missing-status cases.
4. Fold advisory findings into docs-gate after focused tests pass.

Validation command/evidence:

- pnpm docs:lifecycle
- pnpm test -- src/lib/docs-surface/doc-lifecycle.test.ts
- bash scripts/run-harness-gate.sh docs-gate --mode required --json
- pnpm test:related if production source changes.

Stop condition:

- Stop if the checker makes existing historical files fail without a reviewed
  migration policy.

Rollback note:

- Revert checker changes and leave metadata spec as docs-only guidance.

Handoff state:

- Route to implementation after PU-001 spec acceptance.

### PU-003: Reader-Task Documentation Eval Spec

Objective: Define task fixtures that prove agents can find canonical docs,
validation commands, stop conditions, and forbidden evidence claims.

Source trace: AF-004, audit recommendation P0 Add Reader-Task Documentation
Evals.

Allowed paths or areas:

- .harness/specs/2026-06-04-reader-task-documentation-eval-spec.md
- docs/architecture/documentation-layers.md
- docs/agents/01-instruction-map.md
- future tests under src/lib/docs-surface or src/commands

Forbidden paths or areas:

- broad README/AGENTS compression;
- mandatory docs-gate integration before eval design proves stable.

Steps:

1. Define fixture shape with input prompt, expected canonical sources, expected
   validation, expected stop condition, and forbidden claims.
2. Include fixtures for unresolved PR review threads, raw research conflicting
   with canon, stale generated architecture context, downstream source-only
   pollution, and missing PR closeout lifecycle impact.
3. Define pass/fail output and confidence categories.

Validation command/evidence:

- pnpm docs:lint
- planned command: pnpm docs:task-eval, created by PU-004 before promotion.

Stop condition:

- Stop if fixtures cannot assert deterministic expected sources and stop
  conditions.

Rollback note:

- Keep the spec as research if no deterministic implementation route exists.

Handoff state:

- Route to he-spec first, then implementation.

### PU-004: Reader-Task Eval Implementation

Objective: Implement the smallest eval runner or test suite for documentation
task routing.

Source trace: PU-003.

Allowed paths or areas:

- src/lib/docs-surface
- src/commands/docs-gate-core.ts
- src/commands/docs-gate.test.ts
- package.json
- docs/agents/04-validation.md

Forbidden paths or areas:

- LLM-judge dependency as the first implementation;
- network-bound evals;
- mandatory CI gate before the fixture set is stable.

Steps:

1. Start with deterministic fixtures and assertions.
2. Emit JSON results suitable for docs-gate.
3. Keep the first runner advisory unless user explicitly promotes it.
4. Add docs-gate integration only when fixture results are stable.

Validation command/evidence:

- pnpm test -- src/lib/docs-surface/docs-task-eval.test.ts;
- pnpm docs:lint;
- bash scripts/run-harness-gate.sh docs-gate --mode required --json;
- pnpm test:related.

Stop condition:

- Stop if fixture expectations become subjective prose ratings instead of
  deterministic route and claim assertions.

Rollback note:

- Remove advisory integration and keep fixture docs for later redesign.

Handoff state:

- Route to implementation after PU-003.

### PU-005: Stale-Document Archive Candidate Report

Objective: Add an advisory stale-doc report that classifies candidates without
deleting or moving files.

Source trace: AF-002, AF-003, audit recommendation P2 Add Archive Candidate
Report.

Allowed paths or areas:

- src/lib/docs-surface
- a new docs-surface or docs-gate advisory module;
- docs explaining archive candidate criteria.

Forbidden paths or areas:

- automatic deletion;
- automatic archive moves;
- classifying untracked runtime output as source truth.

Steps:

1. Define candidate signals: no inbound links, no manifest entry, no active
   artifact reference, no evidence-pattern admission, superseded status.
2. Emit advisory JSON with reasons and confidence.
3. Add tests proving active/canonical docs are not flagged by simple age alone.
4. Document that deletion requires a separate reviewed archive decision.

Validation command/evidence:

- pnpm test -- src/lib/docs-surface/archive-candidates.test.ts;
- pnpm docs:lint;
- bash scripts/run-harness-gate.sh docs-gate --mode required --json.

Stop condition:

- Stop if the report cannot separate research value from current doctrine.

Rollback note:

- Disable report from docs-gate and keep as local advisory command.

Handoff state:

- Route to he-spec before implementation because archive candidate reporting
  creates a new advisory contract. Docs-gate integration requires explicit spec
  acceptance.

### PU-006: SemVer And Distribution Impact Matrix

Objective: Make release impact and downstream pollution decisions mechanical for
source docs, packaged skill docs, generated templates, and CLI-facing docs.

Source trace: AF-005, AF-007, audit recommendation P1 Add SemVer And
Distribution Impact Matrix.

Allowed paths or areas:

- docs/architecture/documentation-layers.md
- docs/lifecycle/issue-to-main.md
- CONTRIBUTING.md
- .github/PULL_REQUEST_TEMPLATE.md
- docs/doc-lifecycle-manifest.json
- PR template gate tests.

Forbidden paths or areas:

- package version changes;
- downstream template changes without scaffold regression;
- broad release automation changes.

Steps:

1. Define distribution categories: source-only, packaged-skill,
   downstream-template, generated-projection, public-CLI-doc.
2. Map each category to default SemVer impact and required validation.
3. Add PR template fixture coverage if template semantics change.
4. Keep src/templates guarded against source-only docs.

Validation command/evidence:

- pnpm docs:lifecycle
- pnpm test -- src/commands/pr-template-gate.test.ts
- pnpm test -- src/lib/init/scaffold-doc-templates.test.ts
- bash scripts/run-harness-gate.sh docs-gate --mode required --json.

Stop condition:

- Stop if SemVer classification would change release behavior without a release
  spec.

Rollback note:

- Revert matrix prose and template fixtures; no package version changes occur in
  this unit.

Handoff state:

- Route to spec if PR template or validator behavior changes.

### PU-007: Progressive Disclosure Cleanup

Objective: Reduce README and AGENTS load by routing deep material to canonical
supporting docs without weakening binding instructions.

Source trace: AF-001, audit recommendations P1 Shrink README and AGENTS
density.

Allowed paths or areas:

- README.md
- AGENTS.md
- docs/README.md
- docs/agents
- docs/guardrails
- docs/reference if created.

Forbidden paths or areas:

- deleting binding AGENTS rules without replacement;
- moving command truth into unvalidated prose;
- editing generated context.

Steps:

1. Wait for PU-003 and preferably PU-004 so routing can be tested.
2. Identify sections that are reference material, always-on instruction, or
   task-specific governance.
3. Move or summarize reference material while preserving stable anchors.
4. Add reader-task eval fixtures for any changed hot path.

Validation command/evidence:

- pnpm docs:lint
- pnpm docs:lifecycle
- bash scripts/run-harness-gate.sh docs-gate --mode required --json
- pnpm docs:task-eval after PU-004 creates the command.

Stop condition:

- Stop if compression removes a rule before its target doc and eval are in
  place.

Rollback note:

- Revert prose moves; no source behavior changes expected.

Handoff state:

- Route to docs-expert after reader-task eval design.

### PU-008: Automation Runbook Standardization

Objective: Standardize recurring automation docs around triggers, scope,
sources, workflow, validation, stop condition, and feedback loop.

Source trace: AF-006, audit recommendation P1 Standardize Automation Runbooks.

Allowed paths or areas:

- docs/automations
- docs/agents only for routing updates;
- optional runbook lint tests if enforcement is adopted.

Forbidden paths or areas:

- live automation API mutation;
- schedule changes;
- deleting heartbeat or automation files without exact ID proof.

Steps:

1. Define a runbook template.
2. Apply to active automation docs only.
3. Add advisory lint or docs-gate category if enforcement is worthwhile.
4. Preserve feedback-loop update rules.

Validation command/evidence:

- pnpm docs:lint
- bash scripts/run-harness-gate.sh docs-gate --mode required --json
- runbook lint command only if PU-008 adopts enforcement.

Stop condition:

- Stop if standardization becomes wording polish without workflow or validation
  improvement.

Rollback note:

- Revert runbook prose changes.

Handoff state:

- Route to docs-expert for docs-only pass; route to implementation only if lint
  is added.

## Dependencies and Sequencing

Dependency graph:

- PU-001 -> PU-002
- PU-001 -> PU-005
- PU-003 -> PU-004
- PU-004 -> PU-007
- PU-006 -> PU-007
- PU-006 -> PU-008
- PU-002 -> PU-005

Required sequence:

1. PU-001
2. PU-002 and PU-003 in either order
3. PU-004
4. PU-005 and PU-006
5. PU-007
6. PU-008

Do not run PU-007 before reader-task eval design exists.

## Validation Gates

Plan validation:

- `./scripts/check-bluf-structure.sh PLAN_PATH --json` (or via repository validation wrapper): required when available. (Legacy plugin path: `python3 Plugins/harness-engineering/scripts/check_bluf_structure.py` - optional/unstable)
- `./scripts/check-artifact-shape.sh PLAN_PATH --kind plan --json` (or via repository validation wrapper): required when available. (Legacy plugin path: `python3 Plugins/harness-engineering/scripts/check_generated_artifact_shape.py` - optional/unstable)
- pnpm docs:lint: required.
- git diff --check: required.

Implementation validation:

| Gate | Applies To | Observable Behavior | Source IDs | Proof |
| --- | --- | --- | --- | --- |
| pnpm docs:lifecycle | Governed docs metadata | Invalid lifecycle metadata fails and valid governed docs pass. | VAC-001, VAC-002, VAC-004 | Required after docs lifecycle or manifest changes. |
| pnpm docs:lint | Markdown docs | Markdown remains syntactically valid and skimmable under repo lint rules. | VAC-001 through VAC-007 | Required for every docs change. |
| bash scripts/run-harness-gate.sh docs-gate --mode required --json | Docs-gate surfaces | Aggregated docs governance reports no blocking drift. | VAC-001, VAC-002, VAC-004, VAC-005, VAC-006 | Required when docs-gate surfaces change. |
| pnpm test:related | Production source or tests | Related tests exercise changed docs-surface, docs-gate, PR template, or scaffold behavior. | VAC-002, VAC-003, VAC-004, VAC-007 | Required when TypeScript behavior changes. |
| Future docs-task eval | Reader-task safety | Fixtures choose the expected canonical source, validation command, stop condition, and forbidden claim. | VAC-003, VAC-005 | Required before claiming reader-task safety. |
| Scaffold template regression | Distribution guard | Source-only docs do not appear in downstream templates unless explicitly classified. | VAC-004 | Required when src/templates changes. |

Blocked or deferred:

- Linear traceability now routes through JSC-392 and child issues JSC-393
  through JSC-397.
- External PR/CI/review truth is not applicable for plan creation.

## Review Plan

Requested review lenses:

- docs-expert: verify reader jobs, source truth, stale claims, validation
  commands, and proof-backed prose.
- improve-codebase-architecture: verify module boundaries, docs lifecycle
  ownership, deep-module placement, and agent-safe sequencing.
- he-plan: verify plan artifact shape, source traceability, rollback,
  validation, runtime persistence, and handoff.

Independent review recommended before implementation:

- adversarial-document-reviewer or harness-doc-history-reviewer for archive and
  canon-boundary risk.
- testing-reviewer for docs-task eval fixture design.

## Rollback Plan

- Plan-only rollback: delete or supersede this plan with a replacement under
  .harness/plan; do not alter source docs.
- Metadata spec rollback: revert the spec and routing docs; keep historical
  files unchanged.
- Validator rollback: disable new checker integration from docs-gate first, then
  revert focused source changes.
- Reader-task eval rollback: return evals to advisory mode before removing
  fixtures.
- Progressive disclosure rollback: restore moved README/AGENTS sections and keep
  target docs as supporting references if still accurate.
- Archive report rollback: keep report advisory or remove it; never auto-delete
  files as rollback.

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Metadata enforcement blocks historical files. | High | Medium | Start with touched/promoted files and advisory bulk report. |
| Reader-task evals become subjective. | High | Medium | Assert canonical source, command, stop condition, and forbidden claim. |
| README/AGENTS compression weakens instructions. | High | Medium | Require target docs and eval fixtures before moves. |
| Archive candidates destroy useful evidence. | High | Low | Advisory only; separate archive decision required. |
| SemVer matrix changes release semantics accidentally. | Medium | Medium | Spec required before release behavior changes. |
| Automation runbook work becomes polish. | Medium | Medium | Require trigger, workflow, validation, stop condition, feedback loop. |
| Downstream templates receive source-only docs. | High | Low | Keep distribution guard and scaffold regression tests. |

## Observability and Evidence

Evidence to capture per implementation PR:

- Changed files.
- Exact validation command outcomes.
- Docs lifecycle manifest deltas.
- Docs-gate findings.
- Reader-task eval output when available.
- Archive candidate report output when applicable.
- SemVer/distribution impact classification in PR closeout.
- Review artifacts for documentation architecture changes.

Evidence that does not prove completion:

- This plan alone.
- The source audit alone.
- Markdown lint alone.
- Generated architecture context alone.
- Session memory or chat summary alone.

## Visual References / Diagrams

Visual decision: A table is enough for this plan because the core review need is
execution sequencing, not spatial design.

| Stream | Depends On | Unlocks | Validation Signal |
| --- | --- | --- | --- |
| Metadata spec | Audit source | Metadata checker and archive report | Spec accepted and docs lint passes. |
| Metadata checker | Metadata spec | Stale-doc advisory report | docs:lifecycle and focused tests pass. |
| Reader-task eval spec | Audit source | Eval implementation and progressive disclosure cleanup | Fixture expectations are deterministic. |
| Reader-task eval implementation | Eval spec | README/AGENTS compression | Eval JSON proves canonical-source routing. |
| SemVer matrix | Metadata model | Template/distribution guard and runbook cleanup | PR/template fixture coverage passes. |
| Progressive disclosure cleanup | Reader-task eval implementation and SemVer matrix | Smaller hot-path docs | Reader-task eval remains green. |

## Accessibility and Operator Ergonomics

- Keep all future docs changes skimmable with short headings, tables, and stable
  anchors.
- Use repo-relative paths in durable artifacts.
- Do not rely on color-only status.
- Avoid adding large nested checklists to AGENTS or README.
- Prefer one clear command per validation claim.

## Open Questions

- Should this work be linked to a new Linear issue before PU-001 begins?
- Should the first metadata checker cover .harness/specs and .harness/plan, or
  only research and implementation notes?
- Should docs-task evals start as Vitest fixtures, a harness CLI command, or an
  advisory docs-gate category?
- Which root README sections should move first once eval routing exists?

## Final Decision

Proceed with this plan only after human acceptance or active-artifact admission.
The recommended first implementation step is PU-001, a dedicated metadata spec
for research, notes, specs, and plans. Do not start archive cleanup or
README/AGENTS compression before metadata and reader-task eval design exist.

## Appendix A. Harness Metadata / Traceability

schema_version: 1

interactive_status: artifact_written

selection_evidence: source audit
.harness/research/audits/2026-06-04-documentation-architecture-comparison.md;
requested skills docs-expert, improve-codebase-architecture, and he-plan.

route: he-plan

stage: planning

plan_path:
.harness/plan/2026-06-04-documentation-architecture-comparison-plan.md

safe_to_continue: false

blocked_reason: Implementation requires human acceptance or active-artifact
admission plus specs for contract-bearing units.

linear_action_required: false

linear_mutation_status: created

post_plan_handoff: explicit_stop; next recommended stage he-spec; next artifact
.harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md.

git_staging_status: not_staged

staged_paths: none

confidence: high for planning and Linear routing because the source audit, docs
lifecycle surfaces, .harness authority map, requested planning route, live
Linear issue creation, and plan-shape validation are verified. Implementation
confidence still depends on future specs and validation.

## Appendix B. Stage Arc Boundary

Left arc:

- source_of_truth:
  .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
  plus explicit user request.
- entry_authority: explicit.
- freshness_required: fresh.
- not_proof: audit and plan do not prove implementation, docs-gate readiness
  after future changes, or external tracker state.

Active arc:

- owned_stage: he-plan.
- allowed_actions: read repo evidence and write one local .harness/plan
  artifact.
- forbidden_actions: implementation, commit, push, Linear mutation, GitHub
  mutation, deletion/archive moves, generated projection edits.
- mutation_boundary: local_artifact.

Right arc:

- handoff_target: he-spec.
- handoff_artifact:
  .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md.
- proof_required: accepted spec plus focused docs validation before
  implementation.
- closure_boundary: not_closure.
- resume_key:
  .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md.

Persona lenses:

- coding_lens: required.
- testing_lens: required.
- coverage_parity_required: yes.

## Appendix C. Linear / Tracker Handoff

Live Linear mutation was performed through he-linear-plan after explicit user
request.

Linear issue tree:

- JSC-392:
  https://linear.app/jscraik/issue/JSC-392/coding-harness-implement-documentation-lifecycle-architecture-plan
- JSC-393:
  https://linear.app/jscraik/issue/JSC-393/coding-harness-spec-and-enforce-research-lifecycle-metadata
- JSC-394:
  https://linear.app/jscraik/issue/JSC-394/coding-harness-add-deterministic-reader-task-documentation-evals
- JSC-395:
  https://linear.app/jscraik/issue/JSC-395/coding-harness-add-advisory-stale-document-archive-candidate-reporting
- JSC-396:
  https://linear.app/jscraik/issue/JSC-396/coding-harness-classify-semver-distribution-impact-and-source-only
- JSC-397:
  https://linear.app/jscraik/issue/JSC-397/coding-harness-prove-progressive-disclosure-cleanup-and-automation

Local Linear routing artifact:

- .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md

## Appendix D. Review Outcomes

Review status:

- docs-expert lens applied inline from live repo evidence and docs standards.
- improve-codebase-architecture lens applied inline for boundary, ownership,
  deep-module, and sequencing decisions.
- he-plan contract applied through execution-first plan structure, runtime
  boundary fields, stage arc boundary, validation gates, rollback, risks, and
  handoff.

Additional independent review is recommended before implementing PU-002,
PU-004, or PU-007.
