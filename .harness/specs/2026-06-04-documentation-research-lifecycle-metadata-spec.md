---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: documentation-research-lifecycle-metadata-spec
artifact_type: he-spec
canonical_slug: documentation-research-lifecycle-metadata
title: Documentation Research Lifecycle Metadata Spec
harness_stage: he-spec
status: proposed
date: 2026-06-04
origin: user-requested he-spec for JSC-393 from the documentation architecture comparison plan
source_type: spec
authority: execution-input
lifecycle_status: execution-input
canonical_destination: scripts/check-doc-lifecycle.ts
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: event-driven
validated_by:
  - pnpm docs:lint
  - pnpm docs:lifecycle
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
  - .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
linear_issue: JSC-393
linear_issue_url: https://linear.app/jscraik/issue/JSC-393/coding-harness-spec-and-enforce-research-lifecycle-metadata
linear_parent: JSC-392
linear_project: Harness control-loop hardening
linear_status: Todo
linear_mutation_status: existing_issue_verified
linear_action_required: false
safe_to_continue: true
blocked_reason: null
traceability_required: true
risk: documentation-authority-and-agent-routing
depth: bounded-metadata-contract
ui: false
lifecycle_scope: spec_for_first_execution_slice
planning_only_delivery_allowed: true
acceptance_ids:
  - SA-001
  - SA-002
  - SA-003
  - SA-004
  - SA-005
  - SA-006
  - SA-007
---

# Documentation Research Lifecycle Metadata Spec

## Table of Contents

- [Command Summary](#command-summary)
- [Purpose](#purpose)
- [Problem Statement](#problem-statement)
- [User / Operator Scenarios](#user--operator-scenarios)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Current State / Evidence](#current-state--evidence)
- [Authority and Scope Boundary](#authority-and-scope-boundary)
- [Proposed Behavior](#proposed-behavior)
- [Requirements](#requirements)
- [Interfaces](#interfaces)
- [Data / Domain Contract](#data--domain-contract)
- [Enforcement Contract](#enforcement-contract)
- [Proof and Runtime Boundary](#proof-and-runtime-boundary)
- [Coding and Testing Lenses](#coding-and-testing-lenses)
- [Security, Privacy, and Safety](#security-privacy-and-safety)
- [Accessibility and Operator Ergonomics](#accessibility-and-operator-ergonomics)
- [Failure and Recovery](#failure-and-recovery)
- [Validation Plan](#validation-plan)
- [Acceptance Criteria](#acceptance-criteria)
- [Visual References / Diagrams](#visual-references--diagrams)
- [Implementation Notes](#implementation-notes)
- [Open Questions](#open-questions)
- [Decision](#decision)
- [Evidence and References](#evidence-and-references)
- [Appendix A. Harness Metadata / Traceability](#appendix-a-harness-metadata--traceability)
- [Appendix B. Review Outcomes](#appendix-b-review-outcomes)
- [Appendix C. he-plan Handoff](#appendix-c-he-plan-handoff)

## Command Summary

BLUF: This spec defines the metadata and enforcement contract that lets Coding Harness distinguish raw research, reviewed research, implementation notes, specs, plans, and archive candidates before any agent treats those files as current source truth. It matters because the repository now has enough .harness cognition that stale or secondary context can look as authoritative as canon unless authority, lifecycle state, canonical destination, validation, and promotion rules are visible. The main risk is making historical .harness files fail all at once, so the first implementation must enforce metadata only for touched or promoted artifacts while reporting legacy gaps as advisory. The next action is to implement the JSC-393 checker slice against this spec, then run docs lifecycle, focused tests, docs-gate, and related validation before any stale cleanup work starts.

Decision Needed: approve this spec as the behavior contract for JSC-393 before implementing the metadata checker and docs-gate integration.

Top Risks: blocking the repo on historical files, letting advisory research become implementation authority, hiding archive decisions inside a validator, and widening the first slice into reader-task evals or downstream template changes.

Next Action: implement touched/promoted .harness metadata validation in scripts/check-doc-lifecycle.ts and src/lib/docs-surface, with tests for raw, reviewed, distilled, promoted, execution-input, archived, and missing-status cases.

## Purpose

Define a small, enforceable lifecycle model for documentation-adjacent cognition
under .harness. The model must tell a human or Codex agent:

- what a file is;
- whether it is canon, execution input, supporting context, generated output, or
  historical evidence;
- whether it may route implementation;
- which canonical destination it can promote into;
- which validation command proves the classification; and
- when stale or archive handling is only advisory.

The spec is intentionally narrower than the full documentation architecture
program. It covers JSC-393, PU-001, and PU-002 only.

## Problem Statement

Coding Harness has strong root documentation lifecycle metadata for governed
docs, but .harness artifacts still mix research, audits, implementation notes,
specs, plans, Linear handoffs, and generated/runtime evidence in ways that can
be hard to classify quickly. .harness/README.md already defines authority
levels, and .harness/research/README.md plus
.harness/implementation-notes/README.md already say those directories are
secondary context unless admitted. The missing piece is an executable metadata
contract that future validators and agents can rely on.

Without that contract, an old research audit can be mistaken for current
doctrine, an implementation note can become policy without promotion evidence,
or an archive report can accidentally look like permission to delete files.
That is exactly the failure class the documentation architecture audit warned
about.

## User / Operator Scenarios

| Scenario | Reader Need | Required Behavior |
| --- | --- | --- |
| Agent sees a research audit | Know whether it can route implementation | The audit must expose lifecycle status and authority; only reviewed or distilled research with a target route may feed a spec, plan, decision, or validator. |
| Agent sees an implementation note | Know whether it is proof, context, or policy | The note remains secondary context unless a current spec, plan, decision, or validator promotes a rule from it. |
| Maintainer reviews stale docs | Avoid deleting useful evidence too early | The checker may emit archive candidates, but archive or deletion stays a separate reviewed decision. |
| Plan references research | Preserve traceability | The plan or spec must name source artifact, accepted findings or plan units, and validation boundary. |
| Historical .harness file lacks metadata | Avoid blocking unrelated work | Legacy files are advisory until touched, promoted, or listed in a required manifest. |
| Docs-gate consumes lifecycle findings | Keep output machine-readable | Required and advisory findings must be separate so docs-gate can fail only the current enforcement scope. |

## Goals

- Add a lifecycle metadata contract for .harness/research, .harness/audits,
  .harness/implementation-notes, .harness/specs, .harness/plan, and
  .harness/linear.
- Preserve .harness/README.md authority levels while adding machine-checkable
  lifecycle status and promotion fields.
- Enforce required metadata for touched, promoted, manifest-listed, or
  execution-input artifacts.
- Keep legacy historical files advisory until a migration plan promotes them.
- Expose archive candidates as advisory findings only.
- Feed docs-gate with separate required and advisory lifecycle findings.
- Keep the first implementation small enough to validate with focused tests.

## Non-Goals

- Do not bulk rewrite all historical .harness files.
- Do not delete, move, archive, or rename research artifacts in this slice.
- Do not implement reader-task documentation evals; that belongs to JSC-394.
- Do not change source-only or downstream template distribution rules; that
  belongs to JSC-396.
- Do not compress README, AGENTS, or progressive-disclosure docs; that belongs
  to JSC-397 after eval proof.
- Do not mutate Linear, GitHub, CI, release settings, or branch protection from
  this spec.

## Current State / Evidence

Verified current surfaces:

- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md names
  PU-001 and PU-002 as the first execution units.
- .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
  maps JSC-393 to PU-001, PU-002, VAC-001, and VAC-002.
- Live Linear issue JSC-393 exists, is Todo, is high priority, blocks JSC-395,
  and says to route through he-spec first.
- docs/doc-lifecycle.schema.json defines governed-document fields for root and
  docs surfaces.
- docs/doc-lifecycle-manifest.json already lists root docs,
  .harness/README.md, the packaged skill, and issue-to-main lifecycle docs.
- .harness/README.md defines authority levels and admission rules.
- .harness/research/README.md says research is secondary context until a plan,
  spec, decision, or validator admits it.
- .harness/implementation-notes/README.md says implementation notes are
  secondary context unless promoted by an active plan, spec, decision, or
  validator.

Evidence debt:

- .harness/research and .harness/implementation-notes metadata is not uniformly
  enforceable.
- Existing docs lifecycle validation focuses on governed docs, not all
  .harness cognition.
- Archive candidate reporting does not exist yet and must wait for this
  metadata contract.

## Authority and Scope Boundary

requested_depth: bounded_spec

approved_execution_boundary: The user requested a spec using docs-expert and
he-spec after creating the documentation architecture plan and Linear issue
tree.

downscope_authority: Keep JSC-393 limited to metadata spec, checker behavior,
focused tests, and docs-gate integration. Move reader-task evals, SemVer
distribution impact, stale cleanup, and progressive disclosure cleanup to their
existing child issues.

external_mutation_boundary: Do not mutate Linear or other external systems from
this spec. JSC-393 was read for freshness only.

freshness_required: validation_time for repo files; current-turn read for
Linear status if reporting tracker state.

human_acceptance_boundary: Human acceptance is required before using this spec
to drive implementation beyond checker and docs-gate work. Archive and deletion
decisions require separate human acceptance.

## Proposed Behavior

Introduce a .harness lifecycle metadata model that complements, rather than
replaces, the existing governed-doc metadata model.

Every newly created or materially edited .harness cognition artifact in the
covered paths should carry frontmatter with:

- schema and identity;
- artifact type and source type;
- authority level;
- lifecycle status;
- canonical destination or route;
- owner and review dates;
- validation command;
- promotion source or promoted target where relevant;
- archive/supersession fields when relevant; and
- optional Linear traceability for execution artifacts.

The checker should classify findings as:

- required: a touched, promoted, execution-input, or manifest-listed artifact
  violates the metadata contract;
- advisory: a legacy or unpromoted historical artifact lacks metadata or may be
  stale; or
- ignored: generated runtime, backup, scratch, cache, local database, or raw
  evidence path that .harness/README.md already excludes from tracked truth.

## Requirements

| ID | Requirement |
| --- | --- |
| FR-001 | The metadata contract MUST cover .harness/research/**.md, .harness/audits/**.md, .harness/implementation-notes/**.md, .harness/specs/**.md, .harness/plan/**.md, and .harness/linear/**.md. |
| FR-002 | The checker MUST require metadata for files that are created, touched, manifest-listed, explicitly promoted, or marked execution-input. |
| FR-003 | The checker MUST treat legacy unpromoted files as advisory unless a migration policy lists them as required. |
| FR-004 | The checker MUST separate required findings from advisory findings in JSON output. |
| FR-005 | The metadata model MUST distinguish raw, reviewed, distilled, promoted, execution-input, superseded, and archived states. |
| FR-006 | The metadata model MUST name canonical destination or route when secondary context promotes into canon, execution input, decision, validator, or docs-gate behavior. |
| FR-007 | Archive candidate reporting MUST NOT delete, move, rename, or rewrite files automatically. |
| FR-008 | Docs-gate integration MUST fail only required lifecycle findings and report advisory findings separately. |
| FR-009 | Tests MUST cover valid and invalid metadata for raw, reviewed, distilled, promoted, execution-input, archived, and missing-status examples. |
| FR-010 | The implementation MUST preserve the existing governed-doc lifecycle contract for root and docs surfaces. |
| NFR-001 | The first implementation SHOULD avoid a broad new abstraction if existing docs-surface parsing can safely cover the metadata. |
| NFR-002 | Output SHOULD be deterministic JSON for agents and concise text for humans. |
| NFR-003 | The checker SHOULD avoid scanning generated-runtime, backup, scratch, cache, local database, and bulk evidence paths unless they are explicitly promoted. |
| NFR-004 | Validation SHOULD remain fast enough for pnpm docs:lifecycle and docs-gate usage. |

## Interfaces

Primary file interfaces:

- docs/doc-lifecycle.schema.json: governed documentation metadata schema.
- docs/doc-lifecycle-manifest.json: current governed-doc manifest.
- .harness/README.md: tracked .harness authority and admission map.
- .harness/research/README.md: research intake and promotion map.
- .harness/implementation-notes/README.md: implementation-note authority map.
- scripts/check-doc-lifecycle.ts: command entrypoint for lifecycle checks.
- src/lib/docs-surface: parser, path classifier, report builder, and tests.
- src/commands/docs-gate-core.ts: aggregation point after focused checker
  behavior is stable.

CLI interface:

    pnpm docs:lifecycle
    bash scripts/run-harness-gate.sh docs-gate --mode required --json

Implementation may add flags such as --changed, --advisory, or
--include-harness only if they preserve the existing no-argument behavior.

JSON report shape:

    {
      "schema": "coding-harness-doc-lifecycle-report/v1",
      "status": "pass",
      "requiredFindings": [],
      "advisoryFindings": [],
      "ignoredPaths": []
    }

## Data / Domain Contract

### Required Metadata Fields

| Field | Required For | Meaning |
| --- | --- | --- |
| artifact_schema | covered .harness artifacts | Must be harness-document-lifecycle/v1 for this contract. |
| artifact_id | all required artifacts | Stable kebab-case identity. |
| artifact_type | all required artifacts | The artifact family, such as research-audit, implementation-note, he-spec, he-plan, or linear-plan. |
| source_type | all required artifacts | Where the content came from, such as operator-requested-audit, research-discovery, implementation-evidence, spec, plan, or linear-tracker. |
| authority | all required artifacts | One of .harness/README.md authority levels: policy, decision, execution-input, secondary-context, generated-runtime, or backup-scratch. |
| lifecycle_status | all required artifacts | One of the status values below. |
| canonical_destination | promoted or distilled artifacts | Target canonical doc, spec, plan, decision, validator, or explicit none. |
| owner | all required artifacts | Owning team or maintainer group. |
| created | all required artifacts | ISO date. |
| last_reviewed | all required artifacts | ISO date. |
| review_cadence | all required artifacts | Cadence or event-driven. |
| validated_by | all required artifacts | Validation command list or explicit manual-review-required. |
| depends_on | all required artifacts | Source files or artifacts this artifact depends on. |

### Lifecycle Status Values

| Status | Meaning | May Route Implementation |
| --- | --- | --- |
| raw | Captured but not reviewed. | No. |
| reviewed | Reviewed and safe as evidence, but not yet distilled. | Only into spec, plan, decision, or validator design. |
| distilled | Durable rule or pattern extracted from evidence. | Yes, if canonical destination is named. |
| promoted | Incorporated into a canonical doc, decision, validator, or execution artifact. | Yes, through the promoted target. |
| execution-input | Accepted plan, spec, Linear handoff, refactor, or active artifact that may route work. | Yes, within stated scope and freshness. |
| superseded | Retained for history but replaced by a newer artifact. | No; must name superseded_by. |
| archived | Retained for historical evidence only. | No. |

### Promotion Rules

| From | To | Required Evidence |
| --- | --- | --- |
| raw | reviewed | Human or agent review note plus source trace. |
| reviewed | distilled | Named accepted finding, durable principle, and target surface. |
| distilled | promoted | Canonical destination changed or validator created, with validation command. |
| reviewed or distilled | execution-input | Accepted spec, plan, Linear handoff, or active-artifact entry. |
| any current state | superseded | superseded_by plus reason. |
| any current state | archived | Separate archive decision; checker advisory is not enough. |

## Enforcement Contract

essential_decisions:

- .harness cognition needs explicit authority before agents treat it as current
  source truth.
- Research and notes are secondary context by default.
- Execution-input status is scope-bounded and freshness-bound.
- Archive candidates are advisory until a separate reviewed decision acts.
- Legacy files must not become a blocking wall without migration policy.

fillable_gaps:

- Exact CLI flag names for changed-file versus full-scan modes.
- Whether required .harness metadata reuses the governed docs schema or lives in
  a companion schema file.
- Whether archive-candidate reporting is part of docs:lifecycle or a later
  separate command.

guardrails:

- pnpm docs:lifecycle
- pnpm docs:lint
- pnpm test -- src/lib/docs-surface/doc-lifecycle.test.ts
- bash scripts/run-harness-gate.sh docs-gate --mode required --json
- pnpm test:related when production source changes

refusal_triggers:

- Request to delete or move .harness artifacts from checker output alone.
- Request to treat raw research or implementation notes as canon.
- Request to fail all historical .harness files without an accepted migration
  policy.
- Request to change downstream templates before JSC-396 distribution-impact
  proof.
- Request to compress binding instructions before JSC-394 reader-task eval
  proof.

durable_memory:

- .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
- .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
- this spec
- future checker tests and docs-gate fixtures

professional_output:

- Required/advisory finding counts.
- Changed files.
- Exact validation commands and pass/fail/blocked outcomes.
- Explicit statement that archive candidates did not mutate files.
- Handoff to JSC-394, JSC-395, JSC-396, or JSC-397 only when the work belongs
  there.

## Proof and Runtime Boundary

proof_boundary: This spec proves the intended metadata contract only. It does
not prove implementation, docs-gate integration, or archive safety until the
checker, tests, and validation run.

non_proof_sources: chat_summary, stale Linear snapshots, unvalidated research,
generated runtime output, and unchecked historical .harness files.

runtime_state: spec artifact created; implementation not started in this slice.

runtime_invocation_receipt: Codex Desktop session on 2026-06-04; Linear JSC-393
was read for freshness; no external mutation was performed.

artifact_chain_key: documentation-research-lifecycle-metadata

resumption_key:
.harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md

persistent_artifacts:

- .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
- .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
- .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md

live_state_refresh: required before implementation resumes because git status,
docs lifecycle manifest, docs-gate behavior, and Linear state can drift.

session_evidence_status: current for files read in this turn; historical after
handoff.

## Coding and Testing Lenses

coding_lens:

- Keep parsing and path classification inside src/lib/docs-surface.
- Keep scripts/check-doc-lifecycle.ts as the command entrypoint.
- Keep docs-gate as an aggregator, not the first owner of metadata semantics.
- Prefer extending existing frontmatter parsing before introducing a second
  parser.
- Keep .harness/README.md authority terms as the source vocabulary.
- Do not modify generated architecture context or downstream templates in this
  slice.

testing_lens:

- Positive tests: valid reviewed research, valid execution-input spec, valid
  archived artifact with superseded_by or archive decision, valid promoted
  artifact with canonical destination.
- Negative tests: missing status on touched file, raw research used as
  execution input, promoted artifact without canonical destination, archived
  artifact without reason, generated-runtime file treated as required.
- Regression tests: existing governed docs still pass lifecycle validation.
- Gate tests: docs-gate reports advisory findings without failing required mode.

Docs Expert lens:

- Reader job is classification first, not prose polish.
- Every doc claim needs a source path or validation command.
- The smallest useful rewrite is metadata plus route clarity, not broad cleanup.

## Security, Privacy, and Safety

- Do not promote raw telemetry, secrets, local databases, browser captures, or
  bulky runtime evidence into durable docs metadata.
- Do not print secret values from any environment-backed validation.
- Do not auto-delete, auto-archive, or auto-move files from advisory findings.
- Keep generated-runtime and backup/scratch paths out of required validation
  unless a spec or validator explicitly promotes a redacted fixture.
- Treat external tracker state as live-state evidence only when queried in the
  same closeout window.

## Accessibility and Operator Ergonomics

The metadata model should make the next action obvious from a file header.
Humans should not need to read the whole artifact to know whether it can route
implementation. Agents should receive machine-readable findings that separate
blocking errors from advisory cleanup. Error text should name the missing field,
path, authority class, and suggested next action.

## Failure and Recovery

| Failure | Required Recovery |
| --- | --- |
| Historical files produce many missing-metadata findings | Keep them advisory, record migration need, and do not fail docs-gate. |
| Touched file lacks required metadata | Fail required mode and name the missing fields. |
| Archive candidate looks stale | Emit advisory finding only; require a later archive decision. |
| Metadata conflicts with .harness/README.md authority map | Fail required mode for required files and route the conflict to .harness/README.md or the artifact frontmatter. |
| Docs-gate integration becomes noisy | Keep focused checker passing, downgrade legacy findings to advisory, and do not promote docs-gate required behavior until signal is clear. |

## Validation Plan

Spec artifact validation:

    # Run from repository root
    ./scripts/check-bluf-structure.sh .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md --json
    ./scripts/check-artifact-shape.sh .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md --kind spec --json
    pnpm docs:lint
    pnpm docs:lifecycle
    bash scripts/run-harness-gate.sh docs-gate --mode required --json
    git diff --check

Note: If using plugin paths directly, invoke from repository root:
`./Plugins/cache/agent-skills-local/harness-engineering/0.1.0/scripts/check_bluf_structure.py` (path may vary by installation)

Implementation validation after checker changes:

    pnpm docs:lifecycle
    pnpm test -- src/lib/docs-surface/doc-lifecycle.test.ts
    bash scripts/run-harness-gate.sh docs-gate --mode required --json
    pnpm test:related

## Acceptance Criteria

| ID | Acceptance Criterion | Trace |
| --- | --- | --- |
| SA-001 | Spec exists at .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md and passes he-spec artifact checks. | JSC-393, PU-001, VAC-001 |
| SA-002 | Metadata contract names required fields, lifecycle status values, promotion rules, archive rules, and admission rules. | JSC-393, PU-001, VAC-001 |
| SA-003 | Checker design separates required findings from advisory findings. | JSC-393, PU-002, VAC-002 |
| SA-004 | Legacy unpromoted .harness files are advisory unless touched, promoted, manifest-listed, or migration-scoped. | JSC-393, PU-002, VAC-002 |
| SA-005 | Archive candidate behavior is advisory and cannot delete, move, rename, or rewrite files automatically. | JSC-393, blocks JSC-395 |
| SA-006 | Docs-gate integration is allowed only after focused docs lifecycle tests pass. | JSC-393, PU-002 |
| SA-007 | The spec explicitly hands reader-task evals, SemVer distribution impact, stale cleanup, and progressive disclosure cleanup to the existing child issues instead of absorbing them. | JSC-394, JSC-395, JSC-396, JSC-397 |

## Visual References / Diagrams

| Flow Step | Meaning |
| --- | --- |
| raw or reviewed evidence | Secondary context that can inform a spec, plan, decision, or validator. |
| distilled or promoted rule | Durable guidance with a named canonical destination or execution route. |
| required lifecycle validation | Blocking checker path for touched, promoted, manifest-listed, or execution-input artifacts. |
| advisory archive candidate | Non-mutating stale-file signal that requires a later archive decision. |

## Implementation Notes

- Start by adding fixture frontmatter in tests before changing real historical
  files.
- Prefer path classification over recursive blanket validation. .harness has
  runtime, backup, cache, and local-state directories that should stay outside
  required docs validation.
- Keep status enum names plain and stable because they will appear in review
  findings and agent handoff.
- If schema reuse becomes awkward, add a companion schema only for .harness
  lifecycle artifacts rather than overloading docs/doc-lifecycle.schema.json.
- Update .harness/research/README.md and
  .harness/implementation-notes/README.md after checker behavior is clear, not
  before.

## Open Questions

| ID | Question | Default for First Slice |
| --- | --- | --- |
| OQ-001 | Should .harness lifecycle metadata reuse doc_schema or use artifact_schema? | Use artifact_schema: harness-document-lifecycle/v1 in tests unless implementation evidence favors reuse. |
| OQ-002 | Should changed-file detection read git diff directly or accept an explicit path list? | Prefer explicit path list internally, with CLI default preserving current full-check behavior. |
| OQ-003 | Should archive candidates live in docs-gate or a later dedicated report command? | Keep only advisory lifecycle findings in JSC-393; route richer archive reporting to JSC-395. |

## Decision

Proposed: accept this spec as the JSC-393 contract and implement the smallest
metadata checker that enforces touched/promoted .harness artifacts while keeping
legacy historical gaps advisory.

This decision does not approve file archive, broad documentation cleanup,
downstream template changes, or reader-task eval promotion.

## Evidence and References

| Evidence | Use |
| --- | --- |
| .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md | Source plan with PU-001, PU-002, VAC-001, and VAC-002. |
| .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md | Linear issue mapping and dependency evidence. |
| .harness/research/audits/2026-06-04-documentation-architecture-comparison.md | Reviewed audit source for documentation architecture findings. |
| .harness/README.md | Existing .harness authority levels and admission rule. |
| .harness/research/README.md | Existing research secondary-context rule. |
| .harness/implementation-notes/README.md | Existing implementation-note secondary-context rule. |
| docs/doc-lifecycle.schema.json | Existing governed-document metadata schema. |
| docs/doc-lifecycle-manifest.json | Existing governed-document manifest. |
| UBIQUITOUS_LANGUAGE.md | Existing terms for Truth Lane, Claim Authority, Guardrail, Lifecycle Harness, and projection surfaces. |
| Linear JSC-393 live fetch on 2026-06-04 | Tracker freshness for title, scope, status, blockers, and route-through-he-spec instruction. |

## Appendix A. Harness Metadata / Traceability

artifact_chain:

- audit: .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
- plan: .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
- linear handoff:
  .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
- spec:
  .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md

lineage:

- JSC-392: parent documentation lifecycle architecture plan.
- JSC-393: this spec and implementation lane.
- JSC-395: blocked by JSC-393 because archive reporting needs metadata states.
- JSC-394, JSC-396, JSC-397: adjacent child issues intentionally outside this
  spec.

## Appendix B. Review Outcomes

No independent review has been run on this spec yet. Required follow-up before
implementation closeout:

- run he-spec artifact validation;
- run docs lint and docs lifecycle checks;
- run docs-gate if any governed surfaces or docs-gate behavior changes;
- request document or architecture review if checker behavior changes authority
  semantics beyond this spec.

## Appendix C. he-plan Handoff

Next implementation handoff:

1. Read this spec, .harness/README.md, and the existing docs lifecycle checker
   modules.
2. Implement only the JSC-393 metadata checker scope.
3. Add focused docs-surface tests before docs-gate integration.
4. Keep archive reporting advisory and route full stale cleanup to JSC-395.
5. Report exact validation commands and outcomes.
