---
schema_version: 1
artifact_id: spec:portable-memory-subsystem:2026-05-22
artifact_type: spec
canonical_slug: portable-memory-subsystem
title: Portable Coding Harness Memory Subsystem
status: draft
date: 2026-05-22
origin: he-spec
risk: high
spec_depth: full
ui: false
traceability_required: true
linear_mutation_status: confirmation_required
linear_action_required: "Confirm whether to create or update a Linear issue for this subsystem."
---

This spec defines the behavior contract for making memory in coding-harness useful as a reusable engineering control plane, not just a local notes convention. It covers how Project Brain, external vault memory, Codex first-party memory, runtime cards, closeout evidence, and downstream init/upgrade should work together. The main decision is to build receipts and validators before capture automation, because the highest risk is false memory success: agents claiming context is current, source-cited, or safe to use when no executable proof exists. The next step is to validate this spec and split the first implementation phase around vault sync receipt validation and memory policy alignment.

## Table of Contents

- [Command Summary](#command-summary)
- [Purpose](#purpose)
- [Problem Statement](#problem-statement)
- [User / Operator Scenarios](#user--operator-scenarios)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Current State / Evidence](#current-state--evidence)
- [Proposed Behavior](#proposed-behavior)
- [Requirements](#requirements)
- [Interfaces](#interfaces)
- [Data / Domain Contract](#data--domain-contract)
- [Enforcement Contract](#enforcement-contract)
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

BLUF: This spec gives the operator, developer, and agent a shared contract for deciding when coding-harness memory is safe to use. It matters because a memory system that only stores notes can still let Codex make stale, uncited, or unsafe claims during planning and closeout. The decision is to build receipts and validators before capture automation, and the next step is to hand this artifact to he-plan for the Phase 1 trust-boundary patch.

Decision Needed: Approve the memory subsystem as a phase-gated harness capability and start with vault-sync-receipt/v1 validation before capture automation.

Top Risks: False memory success claims, stale vault or Project Brain state, source-less decisions, unsafe autonomous instruction rewrites, and brownfield migrations that move user files without approval.

Next Action: Hand this spec to he-plan for the Phase 1 trust-boundary patch: vault sync receipt validation, memory policy alignment, and memory-gate JSON reporting.

Build a portable memory subsystem for coding-harness that:

- works inside this repository first;
- installs cleanly into greenfield repositories through harness init;
- audits and migrates safely into brownfield repositories through harness upgrade;
- proves memory readiness through schemas, validators, runtime evidence, and closeout gates;
- prevents agents from claiming memory, vault, or decision context without source evidence.

## Purpose

The memory layer should let Codex behave like a software engineer with a maintained project notebook, governed research library, traceable decision log, and evidence-backed closeout habit.

It must not become a pile of documents, a prompt ritual, or an unvalidated Obsidian integration.

## Problem Statement

Coding agents lose reliability when important context lives only in chat history, generated memory summaries, stale docs, or unverified local files. coding-harness already has Project Brain, runtime-card, pr-closeout, evidence-pattern, and memory-gate foundations, but the expected Codex-native memory baseline is not yet a portable, enforceable subsystem.

The project needs a memory capability that is useful locally and distributable downstream without forcing brownfield repos into disruptive reorganization.

## User / Operator Scenarios

### Scenario 1: Greenfield Repo Bootstrap

A developer runs harness init in a new repo. The repo receives a complete Project Brain memory baseline, a memory policy, sync receipt templates, and a validator path. Codex can immediately report whether memory is off, advisory, or required.

### Scenario 2: Brownfield Repo Adoption

A developer runs harness upgrade in an existing repo with docs, ADRs, plans, issue notes, or memory-like files. The harness does not move user files automatically. It produces a compatibility map and marks memory as partial until the operator promotes sources.

### Scenario 3: Codex Claims Memory Was Checked

Codex says it checked memory, updated memory, used the vault, recorded a decision, or captured a learning. The claim is accepted only if the matching receipt, source citation, runtime-card source, or closeout evidence exists.

### Scenario 4: Vault Not Configured

A downstream project does not use Obsidian or an external vault. The harness does not fail by default. It records vault_status: not_configured with a reason, and memory remains Project Brain only unless policy says required.

### Scenario 5: Vault Configured But Stale

A project has a vault configured, but the latest sync receipt is stale, missing redaction, or lacks source evidence. memory-gate blocks required mode and reports the exact blocker.

### Scenario 6: Daily or Weekly Memory Output

The system produces a daily brief or weekly synthesis. The artifact must cite sources, name contradictions, classify confidence, and propose instruction changes rather than rewriting authority files directly.

### Scenario 7: PR Closeout Mentions Memory

A PR body or closeout report claims memory was updated. pr-closeout verifies memory-closeout evidence or marks the claim blocked or unknown.

## Goals

- FR-001: Define portable memory readiness modes: off, advisory, required.
- FR-002: Define a vault-sync-receipt/v1 contract.
- FR-003: Extend memory validation so Project Brain and vault readiness are machine-readable.
- FR-004: Make harness init emit the greenfield memory baseline.
- FR-005: Make harness upgrade produce a brownfield memory compatibility report without moving user files automatically.
- FR-006: Add source-cited output-loop contracts for memory briefs and weekly synthesis.
- FR-007: Tie memory claims into runtime-card, pr-closeout, harness next, and phase-exit.
- FR-008: Prevent direct autonomous instruction rewrites from generated synthesis.
- FR-009: Preserve downstream portability through generated templates, docs, tests, and CI wiring.

## Non-Goals

- Automated scraping of X, YouTube, Readwise, Telegram, browser-use, or Obsidian as the first milestone.
- Embedding or semantic search infrastructure.
- Replacing Codex first-party memory.
- Reorganizing brownfield project files automatically.
- Treating a vault as mandatory for every downstream repo.
- Allowing generated synthesis to mutate AGENTS.md or instruction files without approval.
- Building a general personal knowledge management app.

## Current State / Evidence

The repo already has meaningful foundations:

- Project Brain scaffolding exists under .harness templates.
- memory-gate exists and validates repo-local memory surfaces.
- runtime-card/v1 and runtime-evidence-bundle/v1 exist.
- pr-closeout/v1 accepts runtime evidence.
- evidence-pattern validation exists.
- architecture and module-boundary checks are wired into pnpm check.
- CircleCI runs governance gates.

Known gaps from the evidence-led audit:

- Adopted evidence validation does not necessarily run target validation commands.
- Vault sync is scaffolded but not enforced.
- Memory policy and runtime memory types have drift risk.
- Session and reviewer closeout proof is not uniformly required.
- Output loops are not yet first-class runtime artifacts.

## Proposed Behavior

### User-Facing Solution

The user-facing behavior is a small set of harness-native commands and generated repo surfaces that answer one question clearly:

Can Codex safely use this project's memory right now, and what evidence proves that?

The operator should be able to run:

- harness memory status --json
- harness memory validate --json
- harness memory sync-receipt validate --json
- harness memory brief validate --json
- harness memory closeout --json

The output should classify memory as:

- off
- advisory
- required
- pass
- blocked
- stale
- not_configured
- not_applicable
- unknown

### Portable Rollout Model

Greenfield repos get a complete baseline.

Brownfield repos get an audit and compatibility bridge.

Mature repos can opt into required mode.

## Requirements

### Functional Requirements

FR-001: The harness MUST support memory modes off, advisory, and required.

FR-002: The harness MUST expose memory status as JSON.

FR-003: The harness MUST validate Project Brain presence, including .harness/README.md, .harness/memory/LEARNINGS.md, .harness/active-artifacts.md, .harness/knowledge, .harness/decisions, and .harness/review-log.md when required by policy.

FR-004: The harness MUST define vault-sync-receipt/v1.

FR-005: A configured vault MUST require a fresh sync receipt in required mode.

FR-006: A missing vault MUST be represented as not_configured or not_applicable with a reason, not silently ignored.

FR-007: Vault sync receipts MUST include source evidence, redaction status, status, timestamp, source tier, changed files or explicit no-change state, and blocker class when not passing.

FR-008: harness init MUST emit a greenfield memory baseline.

FR-009: harness upgrade MUST inspect brownfield memory-like surfaces and produce a compatibility report without moving files automatically.

FR-010: memory brief artifacts MUST cite sources.

FR-011: weekly synthesis artifacts MUST propose instruction changes rather than applying them directly.

FR-012: pr-closeout MUST block or mark unknown memory-related claims when matching evidence is absent.

FR-013: runtime-card MUST expose memory freshness and blocker state once memory evidence is integrated.

FR-014: harness next MUST avoid memory-dependent recommendations when memory evidence is stale or blocked.

FR-015: Evidence-pattern adoption MUST distinguish runtime-enforced adoption from documented-only adoption.

### Non-Functional Requirements

NFR-001: The memory subsystem MUST be local-first and file-backed.

NFR-002: Validators MUST emit machine-readable JSON.

NFR-003: Brownfield adoption MUST be non-destructive by default.

NFR-004: Required-mode failures MUST provide precise blocker reasons.

NFR-005: The system SHOULD prefer deterministic checks over prompt instructions.

NFR-006: The system SHOULD avoid requiring external services for baseline memory validation.

NFR-007: The system MUST NOT expose secrets in validation output.

## Interfaces

### CLI Commands

#### harness memory status --json

Returns current memory mode, Project Brain status, vault status, latest receipt freshness, and blockers.

#### harness memory validate --json

Runs Project Brain and configured memory validators.

#### harness memory sync-receipt validate --json

Validates vault-sync-receipt/v1 JSON or JSONL artifacts.

#### harness memory brief validate --json

Validates daily brief and weekly synthesis artifacts.

#### harness memory closeout --json

Produces or validates memory-closeout/v1 evidence for a run.

### Existing Integrations

- memory-gate SHOULD call the same validation library.
- runtime-card SHOULD consume memory status.
- pr-closeout SHOULD consume memory closeout evidence.
- harness init SHOULD emit baseline files.
- harness upgrade SHOULD emit brownfield compatibility report.

## Data / Domain Contract

### vault-sync-receipt/v1

Required fields:

- schemaVersion: vault-sync-receipt/v1
- status: pass | blocked | stale | not_configured | not_applicable | unknown
- checkedAt: ISO timestamp
- repoRoot: string
- memoryMode: off | advisory | required
- projectBrainStatus: pass | blocked | partial | missing
- vaultStatus: configured | not_configured | not_applicable | blocked | unknown
- sourceEvidence: array of source references
- redaction: pass | blocked | not_run
- sourceTier: public | repo_internal | private_user | secret_adjacent | unknown
- changedFiles: array
- noChangeReason: optional string
- blockerClass: optional string
- reason: optional string

Unknown-field behavior:

- Validators MAY allow unknown fields in advisory mode.
- Validators MUST reject unknown fields in required mode unless allowExtensions is true.

Compatibility:

- Future versions MUST preserve schemaVersion.
- Breaking changes require a new schema version.

### memory-brief/v1

Required fields:

- schemaVersion
- date
- sourceWindow
- sourceEvidence
- connections
- pattern
- question
- confidence
- durableUpdateRecommendation

### weekly-synthesis-proposal/v1

Required fields:

- schemaVersion
- sourceWindow
- emergingThesis
- contradictions
- knowledgeGaps
- proposedInstructionChanges
- approvalRequired: true
- sourceEvidence

### memory-closeout/v1

Required fields:

- schemaVersion
- runId or sessionId
- memoryChecked
- projectBrainUpdated
- vaultChecked
- durableLearningCaptured
- skippedReason
- sourceEvidence
- validation

## Enforcement Contract

### essential_decisions

Implementation agents MUST NOT invent:

- memory mode semantics;
- vault status enums;
- receipt schema names;
- whether brownfield migration moves files;
- whether generated synthesis can rewrite instructions directly;
- claim-to-evidence requirements for closeout;
- public CLI command names once accepted.

### fillable_gaps

Implementation agents MAY fill:

- exact TypeScript helper names;
- fixture organization;
- JSON formatting details;
- docs wording;
- additive metadata fields;
- command help text;
- test case naming.

### guardrails

Required guardrails:

- schema validation tests;
- memory-gate JSON output tests;
- init/upgrade fixture tests;
- evidence-pattern validation tests;
- pr-closeout memory claim tests;
- runtime-card memory source tests;
- docs-gate where docs are updated;
- pnpm check before closeout for broad readiness.

### refusal_triggers

Stop and ask when:

- a new public command shape is needed beyond this spec;
- live Linear issue topology is required;
- vault root or private-source policy is ambiguous;
- a migration would move or rewrite brownfield files;
- generated synthesis would mutate instruction authority;
- a validator needs credentials or external services.

### durable_memory

Transferable corrections belong in:

- .harness/memory/LEARNINGS.md for repo-specific learned fixes;
- docs/agents/03-local-memory.md for operator guidance;
- harness.contract.json for policy;
- .harness/research/evidence-patterns.json for evidence adoption;
- Project Brain decisions for approved architecture choices.

### professional_output

Closeout MUST include:

- files changed;
- exact validation commands and pass/fail/blocked state;
- memory mode;
- Project Brain status;
- vault status;
- receipt status;
- blockers;
- next action;
- rollback or supersession note.

## Security, Privacy, and Safety

SEC-001: Vault receipts MUST classify source tier.

SEC-002: Private-user sources MUST NOT be promoted into instruction files without approval evidence.

SEC-003: Validators MUST redact secret-like content from output.

SEC-004: Generated summaries MUST NOT rewrite AGENTS.md, CODESTYLE.md, harness.contract.json, or other authority files directly.

SEC-005: Brownfield upgrade MUST NOT move, delete, or rewrite user files without explicit approval.

SEC-006: Required mode MUST fail closed on missing redaction status.

## Accessibility and Operator Ergonomics

Not UI-facing, but operator ergonomics apply.

ERG-001: JSON output MUST be parseable by agents.

ERG-002: Human output SHOULD name the smallest next action.

ERG-003: Failure output MUST distinguish missing, stale, blocked, not configured, and unknown.

ERG-004: Validation docs SHOULD include one greenfield and one brownfield example.

## Failure and Recovery

FAIL-001: Missing Project Brain in required mode blocks with project_brain_missing.

FAIL-002: Missing vault in advisory mode reports not_configured and does not fail.

FAIL-003: Missing vault in required mode blocks unless policy allows no vault.

FAIL-004: Stale sync receipt blocks required mode.

FAIL-005: Missing citations block memory brief validation.

FAIL-006: Direct instruction rewrite from synthesis blocks validation.

FAIL-007: Brownfield conflicting memory surfaces produce compatibility warnings, not file rewrites.

FAIL-008: Closeout memory claims without memory-closeout evidence block or become unknown.

Recovery actions:

- run harness init for missing greenfield baseline;
- run harness upgrade memory audit for brownfield;
- create or refresh vault sync receipt;
- downgrade mode from required to advisory only through explicit policy change;
- add source citations;
- convert instruction rewrites into proposal artifacts.

## Validation Plan

VAL-001: Unit tests for vault-sync-receipt/v1 validator.

VAL-002: Unit tests for memory status mode calculation.

VAL-003: Unit tests for memory-gate integration.

VAL-004: Init fixture tests proving greenfield baseline is emitted.

VAL-005: Upgrade fixture tests proving brownfield report is non-destructive.

VAL-006: Brief validator tests for missing citations, stale source windows, and invalid instruction rewrites.

VAL-007: pr-closeout tests for memory claims with and without evidence.

VAL-008: runtime-card tests for memory blocker projection.

VAL-009: evidence-pattern tests for runtime-enforced vs documented-only adoption.

VAL-010: docs-gate when operator docs are updated.

Suggested command sequence for the first implementation patch:

- pnpm vitest run src/lib/memory/validator.test.ts
- node scripts/validate-evidence-patterns.cjs --json
- pnpm run check

## Acceptance Criteria

SA-001: Running harness memory status --json in a repo with no configured vault returns a parseable not_configured state with a reason and does not fail in advisory mode.

SA-002: Running memory validation in required mode with a configured vault and no fresh receipt fails with a precise blocker.

SA-003: A valid vault-sync-receipt/v1 passes validation and reports source evidence, redaction status, freshness, and source tier.

SA-004: harness init emits the greenfield memory baseline, including Project Brain files and sync receipt template.

SA-005: harness upgrade on a brownfield fixture creates a compatibility report without moving existing user files.

SA-006: A memory brief without source citations fails validation.

SA-007: A weekly synthesis that attempts to rewrite instruction authority directly fails validation and must be represented as a proposal.

SA-008: pr-closeout blocks or marks unknown a memory-updated claim when memory-closeout/v1 evidence is absent.

SA-009: runtime-card reports stale or blocked memory when memory evidence is stale or blocked.

SA-010: evidence-pattern validation prevents runtime adoption from being represented as docs-only unless a documented-only exception is explicit.

## Visual References / Diagrams

Mermaid diagram:

| Surface | Role |
|---|---|
| Project Brain | Repo-local durable work context |
| External vault | Optional broader knowledge source |
| vault-sync-receipt/v1 | Proof boundary for vault state |
| memory validators | Machine-readable readiness checks |
| runtime-card and pr-closeout | Execution and closeout evidence consumers |

~~~mermaid
flowchart LR
  A["Greenfield or Brownfield Repo"] --> B["Project Brain"]
  A --> C["Optional External Vault"]
  C --> D["vault-sync-receipt/v1"]
  B --> E["memory status / validate"]
  D --> E
  E --> F["runtime-card/v1"]
  E --> G["memory-brief/v1"]
  E --> H["memory-closeout/v1"]
  F --> I["harness next"]
  H --> J["pr-closeout/v1"]
  G --> K["Operator Decision"]
~~~

Authoritative behavior remains in requirements and validators if the diagram and prose conflict.

## Implementation Notes

Recommended implementation order:

1. Add vault-sync-receipt/v1 schema and tests.
2. Align memory policy and runtime memory types.
3. Extend memory-gate JSON output.
4. Add init template updates.
5. Add brownfield compatibility report.
6. Add memory brief validator.
7. Add runtime-card and pr-closeout memory evidence integration.
8. Package the dense memory workflow as a skill only after commands exist.

Do not start with passive capture automation.

## Open Questions

OQ-001: Should required mode allow Project Brain only, or must a configured external vault exist?

OQ-002: Should the first public CLI shape be harness memory sync-receipt validate or nested under memory validate with flags?

OQ-003: Which downstream project fixtures should represent brownfield adoption?

OQ-004: Should memory brief generation be in coding-harness core or remain a skill/automation wrapper over validators?

OQ-005: Should Linear receive a parent issue for the whole subsystem and child issues for each phase?

## Decision

Proceed with a phase-gated memory subsystem.

First implementation slice should be:

feat(memory): add vault sync receipt validation

This is the smallest patch that turns the baseline from a planning idea into a trustworthy proof boundary.

## Evidence and References

- .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md
- .harness/research/deep/2026-05-22-steph-ango-evidence.md
- .harness/research/evidence-patterns.json
- Harness Engineering he-spec contract
- Harness Engineering spec artifact contract

## Appendix A. Harness Metadata / Traceability

- artifact_type: spec
- schema_version: 1
- canonical_slug: portable-memory-subsystem
- risk: high
- spec_depth: full
- traceability_required: true
- linear_mutation_status: confirmation_required
- write_status: written

## Appendix B. Review Outcomes

No independent reviewer artifacts were produced for this spec in this turn.

Review still needed before implementation:

- API contract review for CLI/schema compatibility.
- Agent-native review for downstream usability.
- Adversarial review for false-success and privacy failure modes.
- Data/governance review for vault source tiering.

## Appendix C. he-plan Handoff

Recommended he-plan phases:

1. Phase 1: Trust Boundary
   - vault-sync-receipt/v1
   - memory policy/type alignment
   - memory-gate JSON status

2. Phase 2: Downstream Baseline
   - harness init templates
   - brownfield upgrade compatibility report

3. Phase 3: Output Loop
   - memory-brief/v1
   - weekly-synthesis-proposal/v1

4. Phase 4: Claim-vs-Evidence Closeout
   - runtime-card memory projection
   - pr-closeout memory claim enforcement
   - harness next stale-memory behavior

5. Phase 5: Skill Packaging
   - dense executable memory workflow skill
   - no passive capture automation until proof boundaries pass

Next safe action: run HE artifact-shape and BLUF checks, then create the he-plan from this spec.
