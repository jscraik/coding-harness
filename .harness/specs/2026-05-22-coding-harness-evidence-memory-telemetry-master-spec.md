---
schema_version: 1
artifact_id: spec:coding-harness-evidence-memory-telemetry-master:2026-05-22
artifact_type: he-spec
canonical_slug: coding-harness-evidence-memory-telemetry-master
title: Coding Harness Evidence, Memory, and Telemetry Trust Boundary Master Spec
status: draft
date: 2026-05-22
origin: he-spec
linear_issue: JSC-331
linear_project: null
linear_project_candidates:
  - Harness cockpit routing
  - restored coding-harness project
linear_mutation_status: confirmation_required
linear_action_required: "Confirm whether implementation work should route through Harness cockpit routing or a restored coding-harness project before mutating Linear."
safe_to_continue: true
blocked_reason: null
traceability_required: true
risk: high
spec_depth: full
ui: false
source_artifacts:
  - .harness/linear/2026-05-22-coding-harness-evidence-led-gap-fixes-linear-plan.md
  - .harness/specs/2026-05-22-portable-memory-subsystem-spec.md
  - .harness/specs/2026-05-22-jsc-331-observability-telemetry-evidence-bridge-spec.md
acceptance_ids:
  - SA-001
  - SA-002
  - SA-003
  - SA-004
  - SA-005
  - SA-006
  - SA-007
  - SA-008
  - SA-009
  - SA-010
  - SA-011
  - SA-012
  - SA-013
  - SA-014
  - SA-015
  - SA-016
---

# Coding Harness Evidence, Memory, and Telemetry Trust Boundary Master Spec

## Command Summary

BLUF: This master spec combines the evidence-led Linear implementation plan, the portable memory subsystem spec, and the JSC-331 observability bridge spec into one behavior contract for Jamie, implementation agents, and technical reviewers. It defines how Coding Harness must turn research, memory, telemetry, reviewer output, runtime-card state, and closeout claims into enforceable code-backed evidence instead of prose-backed confidence. The decision is to build the local trust boundary first: strict adopted-evidence validation, runtime-card source truth, memory receipts, session-collector evidence import, audit reference validation, reviewer coverage receipts, and closeout-grade run evidence. The main risk is false success from stale memory, broad telemetry, missing issue identity, or tracker drift, so this spec forbids using raw logs, uncited memory, mailbox-only reviewer status, or docs-only adoption as proof. The next action is technical review of this artifact, then a bounded he-plan implementation slice that starts with the Trust Boundary P0 acceptance IDs.

Decision Needed: Approve this artifact as the master source for the combined evidence, memory, and telemetry trust-boundary implementation. Confirm whether Linear execution should route through Harness cockpit routing or a restored coding-harness project before mutating Linear.

Top Risks: False-success claims from adopted research whose validation command did not run; stale or uncited memory used as authority; telemetry health confused with closeout proof; runtime-card evidence that masks blockers; and reviewer swarms treated as complete without artifact receipts.

Next Action: Run technical review, repair fixable spec gaps, then hand off to he-plan for the Trust Boundary P0 code slice covering FR-001 through FR-008 and SA-001 through SA-006.

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
- [No-Fog Gate](#no-fog-gate)
- [Appendix A. Harness Metadata / Traceability](#appendix-a-harness-metadata--traceability)
- [Appendix B. Review Outcomes](#appendix-b-review-outcomes)
- [Appendix C. he-plan Handoff](#appendix-c-he-plan-handoff)

## Purpose

This specification defines the combined Coding Harness trust boundary for three
systems that currently overlap but do not yet prove one another:

- evidence-led gap implementation;
- portable Project Brain and vault-backed memory;
- telemetry-to-runtime-evidence import through session-collector.

The spec exists so an implementation agent can build missing code without
deciding policy from scratch. It preserves the focused source specs as evidence
and sets one master contract for what must be implemented, what must remain
diagnostic, and what must fail closed.

## Problem Statement

Coding Harness already has runtime-card, pr-closeout, evidence-pattern
validation, memory-gate, OTLP logging, session evidence, and governance docs.
The operator problem is that these surfaces can still drift apart. Research can
be marked adopted without its validation command running; memory can be cited
without a receipt; telemetry can prove that something happened without proving a
PR, issue, branch, or head SHA; reviewer coverage can be described in mailbox
text without an artifact; and closeout can look mature while run/session schemas
are not on the required path.

For Jamie and future agents, the failure mode is not missing vocabulary. The
failure mode is a weak proof boundary. The harness must make it difficult for an
agent to say done unless the relevant source, memory, telemetry, runtime, and
review evidence exists in a deterministic, repo-relative, validation-backed
form.

## User / Operator Scenarios

### Scenario 1: Agent Follows an Evidence-Led Audit

An agent receives an audit with adopted evidence patterns and identified gaps.
The agent must run strict evidence validation and implement code for the Now
slice before claiming the audit is handled. If a validation command is missing,
stale, or fails, the agent must classify the blocker instead of treating the
audit as complete.

### Scenario 2: Agent Uses Project Memory

An agent claims it checked Project Brain, an external vault, or durable memory.
The claim is accepted only when memory status, vault sync receipts, source
citations, or memory-closeout evidence prove the memory state. If memory is
missing or stale, runtime-card and closeout must show that blocker.

### Scenario 3: Telemetry Exists for a Harness Run

Coding Harness emits OTLP logs and session-collector produces a normalized
bundle. The harness may use that bundle only after importing it into
runtime-evidence-bundle/v1 or runtime-evidence-contract/v1. Raw collector stats
remain diagnostics and cannot satisfy acceptance or closeout claims.

### Scenario 4: Reviewer Swarm Is Requested

A coordinator requests technical reviewers. The review is complete only when a
reviewer-coverage-receipt/v1 records requested roles, produced artifacts,
blocked roles, retries, and synthesis status. Mailbox text alone does not prove
coverage when artifact-first review was requested.

### Scenario 5: Browser or Audit Reference Fails to Load

An audit, implementation note, spec, or evidence file is referenced in a plan or
closeout. The harness must validate that the referenced artifact exists,
matches the expected source boundary, and can be loaded. Missing or ignored
artifacts must be reported as blockers or untracked local evidence, not silently
trusted.

### Scenario 6: Greenfield or Brownfield Harness Adoption

A greenfield repo receives a baseline memory and evidence control plane. A
brownfield repo receives a compatibility report and no automatic file moves.
The harness must show whether memory and evidence are off, advisory, required,
passing, blocked, stale, unknown, not configured, or not applicable.

### User Stories

1. As an operator, I want every adopted evidence pattern to have executable proof, so that an agent cannot confuse research alignment with implementation.
2. As a developer, I want runtime-card to preserve the worst relevant blocker, so that current state packets do not hide stale or failed evidence.
3. As an agent, I want memory status and receipts exposed as JSON, so that I can use project memory without relying on conversational memory.
4. As a reviewer, I want reviewer coverage receipts, so that missing subagent artifacts are visible before implementation proceeds.
5. As a maintainer, I want session-collector bundles imported into repo-local runtime evidence, so that telemetry can support closeout without exposing raw logs.
6. As a downstream repo owner, I want greenfield and brownfield memory adoption to be non-destructive, so that Coding Harness can install without disrupting existing docs.

## Goals

- Build a single proof boundary across research adoption, memory, telemetry,
  runtime evidence, reviewer coverage, and closeout.
- Preserve local-first, repo-relative evidence as the authority for harness
  commands.
- Make strict validation and receipt schemas available to agents through JSON
  output.
- Keep external vaults and telemetry optional until policy marks them required.
- Prevent raw telemetry, stale memory, or docs-only adoption from satisfying
  implementation or closeout claims.
- Provide stable acceptance IDs for he-plan and implementation review.

## Non-Goals

- Do not build the full Vector or Victoria observability stack in the first
  implementation slice.
- Do not mutate Linear, GitHub, CircleCI, CodeRabbit, or automations from this
  spec.
- Do not read raw collector data from Coding Harness command consumers.
- Do not auto-move or rewrite brownfield project files.
- Do not allow generated memory synthesis to mutate AGENTS.md, CODESTYLE.md,
  harness.contract.json, or other authority files without approval.
- Do not treat a local .harness spec as proof that live tracker state exists.
- Do not make external vaults mandatory for every downstream repo.

## Current State / Evidence

The three source artifacts provide the current evidence baseline:

| Source Artifact | Contribution | Current Limitation |
|---|---|---|
| Evidence-led Linear plan | Turns the 2026-05-22 audit into code-changing implementation slices. | Linear mutation is blocked until destination is confirmed because the legacy coding-harness project is trashed. |
| Portable memory subsystem spec | Defines memory modes, vault-sync-receipt/v1, memory briefs, synthesis proposals, and closeout evidence. | It is not yet merged with telemetry and runtime evidence import. |
| JSC-331 observability bridge spec | Defines session-collector to runtime-evidence-bundle/v1 and runtime-evidence-contract/v1. | It is adapter-focused and does not own broader memory or audit enforcement. |

Known codebase foundations:

- runtime-card/v1 and runtime-evidence-bundle/v1 exist.
- pr-closeout/v1 consumes runtime evidence.
- evidence-pattern validation exists.
- memory-gate exists.
- StructuredLogger and OTLP configuration exist.
- session-collector can produce redaction-safe project bundles.
- Harness cockpit routing is an active Linear project.

Known gaps admitted by the audit and source specs:

- Adopted evidence validation is not strict enough by default.
- Runtime evidence source merging can mask worse duplicate evidence.
- Runtime-card Linear evidence matching is case-sensitive.
- session-closeout/v1 and harness-run/v1 are tested or designed but not
  uniformly required by a visible closeout path.
- Audit references and reviewer coverage do not have first-class receipts.
- Memory receipts, vault readiness, and synthesis outputs are not yet wired into
  runtime-card, harness next, or pr-closeout.
- Telemetry health is not a closeout authority and must stay separate.

## Proposed Behavior

### User-Facing Solution

The operator should be able to ask one question:

Can Coding Harness safely use this evidence, memory, telemetry, and review state
to support implementation or closeout right now?

The harness answers with machine-readable status and narrow human diagnostics.
For each source class, it reports pass, blocked, stale, missing, unknown,
not_configured, not_applicable, or advisory. Required-mode failures fail closed.
Advisory-mode failures remain visible but do not block unless a downstream gate
requires them.

### System Boundary

The master boundary is:

1. Research and audits become enforceable only through strict validation and
   audit-reference reports.
2. Project Brain and vault memory become usable only through memory status,
   receipts, citations, and closeout evidence.
3. Raw telemetry becomes usable only after session-collector normalizes it and
   Coding Harness imports it into repo-local runtime evidence.
4. Reviewer swarms become complete only through reviewer coverage receipts.
5. Closeout claims become acceptable only when pr-closeout, runtime-card, or an
   evidence gate can cite current verifier-owned artifacts.

### Ownership and Decision Authority

| Surface | Implementation Owner | Review Owner | Decision Authority | Escalation Trigger |
| --- | --- | --- | --- | --- |
| strict adopted-evidence validation | coding-harness implementation agent | harness-dev-tools-reviewer | repo maintainer | validationCommand semantics change |
| runtime-card evidence merge | coding-harness implementation agent | harness-product-code-reviewer | repo maintainer | source precedence or blocker semantics change |
| memory receipts and modes | coding-harness implementation agent | harness-doc-history-reviewer and harness-dev-tools-reviewer | repo maintainer | required-mode policy or vault authority changes |
| session evidence import | coding-harness implementation agent | api-contract-reviewer | repo maintainer | runtime-evidence schema change |
| reviewer coverage receipts | coding-harness implementation agent | harness-review-response-auditor or harness-doc-history-reviewer | repo maintainer | artifact-first review contract changes |
| Linear tracker mutation | he-linear-plan operator | human operator | human operator | destination remains ambiguous |

Implementation agents MAY fill local helper names, fixture layout, and parser
seams. They MUST escalate before changing public schema versions, authority
file mutation policy, Linear destination, or the meaning of pass, blocked,
stale, missing, or unknown.

### Assumptions and Evidence Limits

- Current TypeScript contracts are authoritative for runtime-evidence-bundle/v1
  and runtime-evidence-contract/v1.
- The audit-reference validator is not yet present; this spec may require that
  script as implementation work but MUST NOT cite it as a completed proof.
- Linear project destination is unresolved; no tracker mutation is authorized
  by this spec.
- Image, media, and infographic artifacts created during specification review
  are review evidence only and MUST NOT become implementation proof.

### Do / Do Not Boundaries

Do:

- use repo-relative, sanitized, schema-validated evidence;
- classify blockers precisely;
- preserve source references;
- keep memory and telemetry optional until policy requires them;
- require focused validation for each acceptance ID.

Do Not:

- treat raw telemetry stats as closeout proof;
- treat uncited memory as source truth;
- treat adopted research as implemented without running its validation command;
- treat reviewer mailbox text as artifact-first review completion;
- mutate trackers before destination confirmation;
- rewrite authority files from generated synthesis.

## Requirements

### Functional Requirements

FR-001: The harness MUST provide strict adopted-evidence validation that fails
adopted patterns when validationCommand is missing, non-runnable, or fails.

FR-002: Evidence-pattern status MUST distinguish documented_only,
planning_only, enforcement_backed, implementation_backed, and deferred.

FR-003: Runtime evidence source merging MUST preserve blocked, stale, or worse
evidence over optimistic duplicate synthetic provenance.

FR-004: Runtime-card Linear issue-key matching MUST be case-normalized.

FR-005: The harness MUST define audit-reference-report/v1 or equivalent JSON
output for referenced source artifacts in audits, specs, plans, and closeout.

FR-006: The harness MUST define reviewer-coverage-receipt/v1 for artifact-first
review swarms.

FR-007: The harness MUST support memory modes off, advisory, and required.

FR-008: The harness MUST expose memory status and memory validation as JSON.

FR-009: The harness MUST define vault-sync-receipt/v1 and validate configured
vault state when memory policy requires it.

FR-010: The harness MUST define memory-closeout/v1 for memory-related closeout
claims.

FR-011: runtime-card SHOULD project memory freshness and blocker state once
memory evidence is available.

FR-012: pr-closeout MUST block or mark unknown memory-updated claims when
memory-closeout/v1 evidence is absent.

FR-013: The session evidence importer MUST read redaction-safe
session-collector bundle files and write runtime-evidence-bundle/v1 with
session_collector provenance.

FR-014: The importer MUST reject output paths outside the declared repository
root.

FR-015: The importer MUST classify missing issue, PR, branch, head SHA,
validation outcome, or freshness data as unknown or blocked; it MUST NOT
synthesize pass from partial evidence.

FR-016: runtime-evidence-contract/v1 summaries MUST expose verifier status,
evidence refs, freshness, head SHA when known, blocker class, and verification
timestamp for pr-closeout.

FR-017: otel-collector health and stats MAY support diagnostics but MUST NOT
satisfy runtime evidence or closeout claims by themselves.

FR-018: harness init MUST emit a greenfield memory baseline when the memory
subsystem is admitted into implementation.

FR-019: harness upgrade MUST produce a brownfield memory compatibility report
without moving files automatically.

FR-020: Generated memory synthesis MUST propose instruction changes instead of
applying them directly.

FR-021: Closeout-grade command claims MUST cite harness-run/v1,
session-closeout/v1, runtime-evidence-contract/v1, or another accepted
verifier-owned artifact.

FR-022: The implementation MUST keep live Linear destination ambiguity outside
code behavior and inside Linear planning or tracker confirmation.

### Non-Functional Requirements

NFR-001: Validators MUST emit parseable JSON.

NFR-002: Baseline validation MUST be local-first and must not require external
service mutation.

NFR-003: Required-mode evidence failures MUST fail closed with precise blocker
classes.

NFR-004: Brownfield adoption MUST be non-destructive by default.

NFR-005: Evidence artifacts MUST NOT contain secrets, raw prompts, full
transcripts, collector tokens, OTLP headers, or unredacted telemetry payloads.

NFR-006: The same fixture input and repository root MUST produce deterministic
importer output.

NFR-007: JSON schemas MUST preserve compatibility through explicit
schemaVersion fields.

NFR-008: Human diagnostics SHOULD name the smallest next safe action.

NFR-009: Agent-facing output SHOULD be compact enough to fit hot-path command
context.

NFR-010: Implementation MUST preserve existing runtime-card repo-boundary
behavior.

## Interfaces

### CLI Surfaces

These command names are accepted as target behavior unless implementation
discovery finds an existing command family that should absorb them.

| Command | Purpose | Output |
|---|---|---|
| harness evidence-patterns validate --strict-adopted --json | Validate adopted evidence commands and status classification. | validation-receipt/v1 |
| harness audit references validate --json | Validate artifact references in audits, specs, plans, and closeout. | audit-reference-report/v1 |
| harness memory status --json | Report memory mode, Project Brain, vault, receipt, and blocker state. | memory-status/v1 |
| harness memory validate --json | Validate memory policy, Project Brain, receipts, and brief rules. | memory-validation-report/v1 |
| harness memory sync-receipt validate --json | Validate vault-sync-receipt/v1 artifacts. | validation-receipt/v1 |
| harness evidence import session-bundle --json | Import session-collector bundle evidence into runtime evidence. | runtime-evidence-bundle/v1 |
| harness review coverage validate --json | Validate artifact-first reviewer coverage. | reviewer-coverage-receipt/v1 |
| harness pr-closeout --runtime-evidence PATH | Consume verifier-owned runtime evidence. | pr-closeout/v1 |

Implementation MAY keep some commands as scripts first if public CLI admission
is deferred. If a command is deferred, the same JSON shape and validation
behavior must still exist behind the script or library path.

### Existing Integrations

| Existing Surface | Required Integration |
|---|---|
| runtime-card | consume runtime evidence, memory status, and source blocker precedence |
| harness next | avoid recommendations that rely on stale required evidence |
| pr-closeout | consume runtime, memory, and reviewer receipts for closeout-grade claims |
| evidence-pattern validation | add strict adopted mode and status classification |
| memory-gate | share the memory validation library and JSON statuses |
| session-collector | produce redaction-safe bundles for importer fixtures |
| otel-collector | remain diagnostic raw ingest, not closeout authority |

## Data / Domain Contract

### Shared Status Enums

Required status values:

- pass
- fail
- blocked
- stale
- missing
- partial
- unknown
- not_configured
- not_applicable
- advisory

Unknown-field behavior:

- Validators MAY tolerate unknown fields in advisory mode.
- Validators for harness-owned output artifacts MUST reject unknown fields in
  required mode unless an explicit allowExtensions flag or schema version
  contract permits them.
- Importer input parsing MUST remain forward-compatible for additive unknown
  fields and reject only conflicting, unsafe, malformed, or security-sensitive
  fields.

Compatibility:

- Every receipt and report MUST include schemaVersion.
- Breaking schema changes require a new schemaVersion.
- Consumers MUST ignore newer optional fields that do not conflict with known
  fields.

Error handling:

- Malformed JSON MUST fail validation and name the parse failure.
- Ambiguous identity MUST produce blocked or unknown, not pass.

### validation-receipt/v1

Required fields:

- schemaVersion: validation-receipt/v1
- status
- checkedAt
- declaredValidationCommand
- executedCommand
- command
- cwd
- target
- exitCode
- evidenceRefs
- blockerClass
- reason

The command field is a backwards-compatible alias for executedCommand. Strict
adopted-evidence validation MUST preserve declaredValidationCommand separately
from executedCommand so a receipt can prove when the declared command was
missing, mismatched, not run, failed, or replaced by an unrelated command.

### audit-reference-report/v1

Required fields:

- schemaVersion: audit-reference-report/v1
- status
- checkedAt
- sourceArtifact
- referencedArtifacts
- missingRefs
- ignoredOrUntrackedRefs
- blockerClass
- reason

### memory-status/v1

Required fields:

- schemaVersion: memory-status/v1
- status
- checkedAt
- repoRoot
- memoryMode
- projectBrainStatus
- vaultStatus
- latestReceiptRef
- latestReceiptFreshnessStatus
- freshnessThreshold
- blockers
- sourceEvidence
- reason

### memory-validation-report/v1

Required fields:

- schemaVersion: memory-validation-report/v1
- status
- checkedAt
- repoRoot
- memoryMode
- policyStatus
- projectBrainStatus
- vaultStatus
- receiptStatus
- briefStatus
- failures
- evidenceRefs
- blockerClass
- reason

### reviewer-coverage-receipt/v1

Required fields:

- schemaVersion: reviewer-coverage-receipt/v1
- status
- checkedAt
- requestedRoles
- completedRoles
- completedArtifacts
- blockedRoles
- missingArtifacts
- retryCount
- synthesisStatus
- evidenceRefs

### vault-sync-receipt/v1

Required fields:

- schemaVersion: vault-sync-receipt/v1
- status
- checkedAt
- repoRoot
- memoryMode
- projectBrainStatus
- vaultStatus
- freshnessStatus
- freshnessThreshold
- sourceEvidence
- redaction
- sourceTier
- changedFiles
- noChangeReason
- blockerClass
- reason

### memory-closeout/v1

Required fields:

- schemaVersion: memory-closeout/v1
- runId or sessionId
- memoryChecked
- projectBrainUpdated
- vaultChecked
- durableLearningCaptured
- skippedReason
- sourceEvidence
- validation

### runtime-evidence-bundle/v1

Required fields:

- schemaVersion: runtime-evidence-bundle/v1
- generatedAt
- issueKey
- provenance.kind
- provenance.ref
- provenance.collectedAt
- sources
- blockers

Optional fields:

- pullRequest
- linear
- phaseExit
- phaseExitSourceCompleteness

This spec preserves the current TypeScript runtime-evidence-bundle/v1 contract.
Session-collector imports MUST set provenance.kind to session_collector, but
MUST NOT rename collectedAt to observedAt or add validationSummary as a
required v1 field. Import validation results belong in validation-receipt/v1 or
a separately versioned future schema.

### runtime-evidence-contract/v1

Required fields:

- schemaVersion: runtime-evidence-contract/v1
- declaredIntent
- resolvedState
- verifierResult
- claimTraceConsistency
- evaluation
- outcomeMapping

Required nested verifierResult fields:

- status
- owner
- evidenceRefs
- verifiedAt
- reason

This spec preserves the current TypeScript runtime-evidence-contract/v1 object
contract. Flattened closeout summaries MUST be projections from this contract
or a separately versioned schema, not a replacement for v1.

### memory-brief/v1 and weekly-synthesis-proposal/v1

These synthesis artifacts MUST cite source evidence and MUST NOT mutate
authority files directly. weekly-synthesis-proposal/v1 MUST include
approvalRequired: true.

## Enforcement Contract

### essential_decisions

Implementation agents MUST NOT invent:

- public CLI shape beyond this spec without recording a new decision;
- receipt schema names or required fields;
- memory mode semantics;
- vault status enums;
- runtime evidence pass semantics;
- whether raw telemetry can satisfy closeout;
- whether brownfield migration moves files;
- whether generated synthesis can rewrite instructions directly;
- reviewer coverage completion rules;
- Linear destination while the project match remains ambiguous.

### fillable_gaps

Implementation agents MAY choose:

- exact helper names and module seams;
- fixture directory layout;
- additive optional metadata fields;
- command help text;
- internal parser decomposition;
- whether the first Trust Boundary P0 patch exposes a public command or a
  script-backed validator.

### guardrails

Required guardrails:

- strict adopted-evidence validator tests;
- runtime-card source merge and issue-key tests;
- audit-reference validator tests;
- memory receipt schema tests;
- session bundle importer fixture tests;
- off-repo output refusal tests;
- pr-closeout runtime evidence tests;
- reviewer coverage receipt tests;
- docs-gate when governance docs change;
- pnpm check before parent issue closeout.

### refusal_triggers

Stop and ask when:

- implementation needs a new public schema version;
- raw telemetry persistence would enter tracked artifacts;
- a vault root or private-source policy is ambiguous;
- a brownfield migration would move or rewrite files;
- generated synthesis would mutate authority files;
- Linear mutation is required but destination is not confirmed;
- validation cannot distinguish telemetry health from closeout proof;
- reviewer artifacts are missing after retry and the plan requires full review
  coverage.

### durable_memory

Transferable corrections belong in:

- .harness/memory/LEARNINGS.md for repo-specific learned fixes;
- docs/agents/03-local-memory.md for operator memory guidance;
- docs/agents/07b-agent-governance.md for agent-governance closeout behavior;
- .harness/research/evidence-patterns.json for adopted evidence status;
- harness.contract.json when a policy or gate becomes contractual;
- Project Brain decisions when architecture choices are approved.

### professional_output

Closeout MUST report:

- changed files;
- exact commands with pass, fail, or blocked outcomes;
- evidence artifact paths;
- memory mode and memory status;
- runtime evidence source and freshness;
- reviewer coverage status;
- live tracker state observed or explicitly unobserved;
- blockers and next action;
- rollback or supersession path.

## Security, Privacy, and Safety

SEC-001: Receipt and runtime evidence outputs MUST redact secret-like values.

SEC-002: Raw OTLP payload bodies, prompts, full transcripts, collector tokens,
and private user content MUST NOT be written into tracked artifacts.

SEC-003: Vault receipts MUST classify source tier as public, repo_internal,
private_user, secret_adjacent, or unknown.

SEC-004: Private-user sources MUST NOT be promoted into instruction files
without approval evidence.

SEC-005: Brownfield upgrade MUST NOT move, delete, or rewrite user files without
explicit approval.

SEC-006: Required mode MUST fail closed on missing redaction status.

SEC-007: Off-repo evidence outputs MUST be refused.

SEC-008: External tracker or GitHub mutations require explicit user approval or
an approved he-linear-plan handoff.

## Accessibility and Operator Ergonomics

This is not a UI spec, but operator ergonomics are required.

ERG-001: JSON output MUST be parseable by agents.

ERG-002: Human output SHOULD name the smallest next safe action.

ERG-003: Failure output MUST distinguish missing, stale, blocked, not
configured, not applicable, and unknown.

ERG-004: Statuses MUST be words, not color-only indicators.

ERG-005: Diagnostics SHOULD group blockers by source class.

ERG-006: Downstream docs SHOULD include one greenfield and one brownfield
example for memory and evidence readiness.

## Failure and Recovery

| Failure | Required Recovery |
|---|---|
| Adopted evidence command missing | Block strict validation and name the pattern. |
| Adopted validation command fails | Preserve command, exit code, and blocker class. |
| Duplicate runtime evidence has worse state | Preserve the worse state or expose both sources; do not mask it. |
| Mixed-case Linear issue key | Normalize for matching while preserving original display value. |
| Missing audit reference | Block audit-reference validation and name the missing path. |
| Missing Project Brain in required mode | Block with project_brain_missing. |
| Missing vault in advisory mode | Report not_configured without failing. |
| Missing vault in required mode | Block unless policy explicitly allows Project Brain only. |
| Stale vault receipt | Block required mode and name freshness threshold. |
| Missing memory citation | Fail memory brief validation. |
| Raw telemetry used as closeout proof | Block and require normalized runtime evidence. |
| Missing bundle file | Block import and name the missing file. |
| Malformed bundle JSON | Block import and name the parse failure. |
| Missing issue, PR, branch, or head SHA | Keep identity null or unknown; do not pass closeout. |
| Reviewer artifact missing | Mark reviewer coverage partial or blocked and record retry status. |
| Linear destination ambiguous | Defer mutation to he-linear-plan or human confirmation. |

Rollback:

- remove new validators, importer, and receipt consumers while preserving
  existing runtime-card and pr-closeout behavior;
- keep source specs and audit artifacts as historical evidence;
- do not delete Project Brain or brownfield compatibility files created by
  explicit user approval without a separate rollback decision.

## Validation Plan

VAL-001: Run the HE BLUF structure check on this spec.

VAL-002: Run the generated artifact shape check on this spec with kind spec.

VAL-003: Run markdownlint on this spec.

VAL-004: Unit test strict adopted-evidence validation.

VAL-005: Unit test runtime-card evidence merge precedence and issue-key
normalization.

VAL-006: Unit test audit-reference-report/v1 validation.

VAL-007: Unit test memory-status/v1, memory-validation-report/v1,
vault-sync-receipt/v1, memory mode calculation, and receipt freshness
classification.

VAL-008: Unit test session-collector bundle import, including valid import,
missing files, malformed JSON, stale identity, and off-repo output refusal.

VAL-009: Unit test pr-closeout runtime evidence and memory-closeout handling.

VAL-010: Unit test reviewer-coverage-receipt/v1.

VAL-011: Run docs-gate when docs or governance surfaces are updated.

VAL-012: Run pnpm check before parent closeout.

VAL-013: Run pnpm run safety:local when implementation changes redaction,
secret handling, telemetry import, or tracked evidence-output code.

VAL-014: Run contract-compatibility tests for runtime-evidence-bundle/v1 and
runtime-evidence-contract/v1 whenever this spec or implementation changes those
schema descriptions.

Suggested first implementation proof:

- node scripts/validate-evidence-patterns.cjs --strict-adopted --json
- pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts
- After the audit-reference validator is implemented: node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json

## Acceptance Criteria

SA-001: Strict adopted-evidence validation fails an adopted pattern whose
validationCommand is missing or failing.

SA-002: Evidence-pattern status distinguishes documented_only, planning_only,
enforcement_backed, implementation_backed, and deferred.

SA-003: Runtime-card source merge preserves blocked or stale duplicate evidence
instead of masking it with synthetic provenance.

SA-004: Runtime-card Linear issue-key matching is case-normalized and covered
by a regression test.

SA-005: Audit reference validation reports missing, ignored, untracked, and
loadable artifacts in JSON.

SA-006: reviewer-coverage-receipt/v1 records requestedRoles,
completedRoles, completedArtifacts, blockedRoles, missingArtifacts,
retryCount, and synthesisStatus.

SA-007: memory status reports Project Brain and vault readiness as parseable
JSON.

SA-008: vault-sync-receipt/v1 validates source evidence, redaction status,
freshness, source tier, changed files, and blockers.

SA-009: pr-closeout blocks or marks unknown memory-related claims when
memory-closeout/v1 evidence is absent.

SA-010: A session-collector bundle fixture imports into
runtime-evidence-bundle/v1 with session_collector provenance.

SA-011: Missing issue, PR, branch, head SHA, or freshness in imported telemetry
cannot produce a passing closeout verifier result.

SA-012: Generated synthesis proposes instruction changes and cannot directly
rewrite authority files without approval evidence.

SA-013: harness init emits a greenfield memory baseline only when memory mode
requires or enables it, and validation proves the emitted files are repo-local
and non-secret-bearing.

SA-014: harness upgrade emits a brownfield memory compatibility report without
moving, deleting, or rewriting existing project docs unless approval evidence is
present.

SA-015: Closeout-grade command claims cite harness-run/v1,
session-closeout/v1, runtime-evidence-contract/v1, memory-closeout/v1, or an
accepted equivalent; missing evidence produces blocked or unknown, not pass.

SA-016: Linear tracker mutation is refused or marked blocked while the
destination is ambiguous, and the blocker names the candidate destinations.

## Visual References / Diagrams

| Layer | Input | Normalizer / Validator | Evidence Output | Consumers |
|---|---|---|---|---|
| Research | audits, plans, evidence patterns | strict evidence validator | validation-receipt/v1 | he-plan, closeout |
| Memory | Project Brain, optional vault | memory validator | memory-status/v1, vault-sync-receipt/v1 | runtime-card, pr-closeout |
| Telemetry | OTLP logs, traces, session data | session-collector and importer | runtime-evidence-bundle/v1 | runtime-card, harness next |
| Review | subagent artifacts | review coverage validator | reviewer-coverage-receipt/v1 | coordinator, pr-closeout |
| Closeout | run/session artifacts | pr-closeout and evidence verify | runtime-evidence-contract/v1 | PR body, Linear closeout |

~~~mermaid
flowchart LR
  A["Research and audits"] --> B["Strict evidence validation"]
  C["Project Brain and vault"] --> D["Memory receipts"]
  E["OTLP and session data"] --> F["Session collector bundle"]
  F --> G["Runtime evidence importer"]
  H["Reviewer artifacts"] --> I["Reviewer coverage receipt"]
  B --> J["Runtime card / harness next"]
  D --> J
  G --> J
  I --> K["pr-closeout"]
  J --> K
~~~

Prose requirements remain authoritative when this diagram and the requirement
IDs disagree.

## Implementation Notes

Recommended implementation order:

1. Trust Boundary P0: implement FR-001 through FR-006 and SA-001 through SA-006.
2. Memory proof boundary: implement FR-007 through FR-012 and SA-007 through
   SA-009.
3. Telemetry evidence bridge: implement FR-013 through FR-017 and SA-010
   through SA-011.
4. Downstream rollout: implement FR-018 through FR-020 and SA-012.
5. Downstream rollout hardening: implement SA-013 through SA-014.
6. Closeout convergence: implement FR-021 and SA-015, then connect accepted
   receipts to pr-closeout and harness next.
7. Tracker destination guard: implement FR-022 and SA-016 before any Linear
   mutation automation.

Do not start with broad telemetry rollout, external observability services, or
passive memory capture automation. The first implementation should be boring,
local, fixture-backed, and refusal-friendly.

Likely first changed files:

- scripts/validate-evidence-patterns.cjs
- src/lib/runtime/runtime-evidence-adapter.ts
- src/lib/runtime/local-runtime-card-assembly.ts
- src/commands/runtime-card.test.ts
- src/lib/runtime/local-runtime-card.test.ts
- scripts/validate-audit-references.cjs
- package.json if a script entry is added

Likely later changed files:

- src/lib/memory
- src/commands/pr-closeout
- src/commands/evidence-verify.ts
- src/lib/contract
- src/lib/session
- src/lib/cli/registry/command-capability-rules.ts
- harness.contract.json
- docs/agents/03-local-memory.md
- docs/agents/07b-agent-governance.md

## Open Questions

OQ-001: Should required memory mode allow Project Brain only, or require a
configured external vault when policy says memory is required?

OQ-002: Should audit reference validation become a public harness command or
remain a script until the first implementation slice proves it?

OQ-003: Should session evidence import be library-only first, or admitted as a
public CLI command in the same patch?

OQ-004: Which project should receive live Linear work: Harness cockpit routing
or a restored coding-harness project?

OQ-005: Which reviewer roles are required before implementation: harness doc
history, dev tools, API contract, agent-native, or all four?

## Decision

Proceed with this master spec as the canonical combined source for the
evidence, memory, and telemetry trust-boundary program. The two focused specs
remain source evidence. The Linear plan remains the tracker-routing artifact.
Implementation begins only after technical review and he-plan, and the first
code slice must implement Trust Boundary P0 rather than starting with external
observability infrastructure.

## Evidence and References

- .harness/linear/2026-05-22-coding-harness-evidence-led-gap-fixes-linear-plan.md
- .harness/specs/2026-05-22-portable-memory-subsystem-spec.md
- .harness/specs/2026-05-22-jsc-331-observability-telemetry-evidence-bridge-spec.md
- .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md
- .harness/research/evidence-patterns.json
- Harness Engineering he-spec artifact contract
- Harness Engineering BLUF review contract

## No-Fog Gate

- This spec is not implementation proof.
- This spec does not authorize live Linear mutation.
- This spec does not claim broad Codex autonomy readiness.
- This spec does not make telemetry health a closeout source.
- This spec does authorize technical review and he-plan to create bounded
  implementation units from stable FR, NFR, and SA IDs.
- Any claim that all gaps are fixed must cite code changes and validation
  evidence, not this spec alone.

## Appendix A. Harness Metadata / Traceability

- interactive_status: complete
- selection_evidence: user-selected he-spec invocation with three local source
  artifacts
- route: standard-spec, deepen mode
- stage: he-spec
- scope: coding-harness evidence, memory, telemetry, reviewer coverage, and
  closeout trust boundary
- validation: artifact validation required before handoff
- safe_to_continue: true
- blocked_reason: null
- linear_mutation_status: confirmation_required
- linear_action_required: confirm live destination before tracker writes
- spec_path:
  .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
- acceptance_ids: SA-001 through SA-016
- git_staging_status: unstaged
- staged_paths: none
- confidence: high for source-artifact synthesis; medium for implementation
  file list because code has not yet been changed
- blackboard_delta: three separate source artifacts now have one master spec
  that preserves evidence-led implementation, memory receipts, telemetry import,
  reviewer coverage, and closeout proof in a single contract.

## Appendix B. Review Outcomes

technical_review_status: completed

Reviewer artifacts:

- artifacts/reviews/2026-05-22-master-spec-harness-doc-history-reviewer.md
- artifacts/reviews/2026-05-22-master-spec-harness-dev-tools-reviewer.md
- artifacts/reviews/2026-05-22-master-spec-harness-product-code-reviewer.md
- artifacts/reviews/2026-05-22-master-spec-api-contract-reviewer.md

Findings repaired in this spec:

- Linear project metadata no longer pre-commits a destination while mutation is
  confirmation-required.
- SA-006 now uses reviewer-coverage-receipt/v1 field names.
- memory-status/v1 and memory-validation-report/v1 are defined.
- audit-reference validation is labeled as a new validator proof after
  implementation rather than an already-runnable script.
- validation-receipt/v1 preserves declaredValidationCommand separately from
  executedCommand.
- vault-sync-receipt/v1 includes freshnessStatus and freshnessThreshold.
- reviewer-coverage-receipt/v1 includes completedArtifacts.
- runtime-evidence-bundle/v1 and runtime-evidence-contract/v1 preserve the
  current TypeScript v1 contracts instead of silently changing wire shape.
- Unknown-field rejection is scoped to harness-owned output artifacts; importer
  input remains forward-compatible for additive unknown fields.

Residual review notes:

- The source observability bridge spec still uses observedAt wording in places;
  implementation MUST follow the current TypeScript v1 collectedAt contract
  unless a new schema version is introduced.
- Contract compatibility tests should assert that spec-declared v1 fields stay
  aligned with runtime-evidence-bundle.ts and runtime-evidence-contract.ts.
- Tracker mutation remains intentionally blocked until the live Linear
  destination is confirmed.

## Appendix C. he-plan Handoff

Recommended first he-plan unit:

- name: Trust Boundary P0
- requirement IDs: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
- acceptance IDs: SA-001, SA-002, SA-003, SA-004, SA-005, SA-006
- allowed paths:
  - scripts/validate-evidence-patterns.cjs
  - scripts/validate-audit-references.cjs
  - src/lib/runtime
  - src/commands/runtime-card.test.ts
  - src/lib/runtime/local-runtime-card.test.ts
  - package.json when needed for command wiring
- forbidden paths:
  - raw collector data
  - external tracker state without approval
  - unrelated dirty deep-module migration artifacts
  - authority docs unless docs-gate explicitly requires synchronization
- validation:
  - node scripts/validate-evidence-patterns.cjs --strict-adopted --json
  - pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts
  - after implementation: node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json
- stop condition: implementation needs a new public schema, cannot distinguish
  telemetry health from proof, or cannot preserve repo-boundary safety.
- rollback: remove new validator/importer wiring and leave existing
  runtime-card and pr-closeout behavior unchanged.
