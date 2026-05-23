---
schema_version: 1
artifact_id: jsc-331-observability-telemetry-evidence-bridge-spec
artifact_type: he-spec
canonical_slug: jsc-331-observability-telemetry-evidence-bridge
title: JSC-331 Observability Telemetry Evidence Bridge Spec
harness_stage: he-spec
status: draft
date: 2026-05-22
origin: user-provided observability and telemetry wiring review
linear_issue: JSC-331
linear_issue_url: https://linear.app/jscraik/issue/JSC-331/coding-harness-add-apparatus-verifier-persona-lens
linear_parent: JSC-327
linear_project: Harness cockpit routing
linear_status: Todo
linear_mutation_status: not_needed
linear_action_required: "No Linear mutation performed; he-linear-plan may add a tracker comment if this spec becomes the implementation source."
safe_to_continue: true
blocked_reason: null
traceability_required: true
risk: telemetry-evidence-contract
depth: full
ui: false
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
---

# JSC-331 Observability Telemetry Evidence Bridge Spec

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
- [Linear Work Item Contract](#linear-work-item-contract)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [Appendix A. Harness Metadata / Traceability](#appendix-a-harness-metadata--traceability)
- [Appendix B. Review Outcomes](#appendix-b-review-outcomes)
- [Appendix C. he-plan Handoff](#appendix-c-he-plan-handoff)

## Command Summary

BLUF: This spec defines how the operator, developer, reviewer, and future agent should turn observed Coding Harness telemetry into closeout-grade runtime evidence without letting raw logs, chat summaries, or aggregate stats masquerade as proof. It matters because Coding Harness already has an OTLP emitter, session-collector already emits redaction-safe project bundles, and runtime-card plus pr-closeout already consume normalized evidence, but the missing adapter leaves Jamie with a manual judgment gap between telemetry existing and a PR or slice being proven. The decision is to keep OTEL as raw ingest, session-collector as the normalizer, and Coding Harness as the owner of repo-relative runtime-evidence-bundle/v1 and runtime-evidence-contract/v1 artifacts. The main risk is false confidence from broad, stale, or off-repo telemetry, so the next action is a bounded he-plan slice that adds the importer contract, fixture proof, and focused validation before any broader command telemetry rollout.

Decision Needed: approve this local spec as the JSC-331 source for the
observability-to-runtime-evidence bridge, then route to he-plan for a bounded
implementation slice.

Top Risks: treating collector stats as PR evidence, reading raw home-directory
collector artifacts inside harness commands, broadening telemetry emission
before the evidence schema is stable, or generating closeout claims without
issue, PR, branch, head SHA, freshness, and verifier-owned evidence references.

Next Action: run he-plan against this spec and keep the first implementation
slice limited to the session-collector bundle importer, runtime evidence
mapping, fixture tests, and active-index-safe repo-local artifact handling.

## Purpose

This specification defines the bridge between three existing systems:

- Coding Harness emits and consumes runtime evidence.
- otel-collector ingests OTLP logs, traces, metrics, and processed stats.
- session-collector reads raw collector data plus Codex session and project
  evidence, then writes redaction-safe bundle artifacts.

The bridge must turn observed telemetry into evidence that Coding Harness can
consume through its existing runtime evidence contracts. It must not let raw
telemetry, aggregate health, or chat summaries satisfy acceptance or closeout
claims.

## Problem Statement

Coding Harness can already emit some OTLP log events and can already consume
normalized runtime evidence. The collectors can now capture and normalize richer
observability data. The operator problem is the missing translation step:
observed session and telemetry data cannot yet become a narrow, verifier-owned,
repo-relative artifact for runtime-card, harness next, or pr-closeout.

Without this bridge, agents can see that telemetry exists but still have to
manually decide whether it proves the active issue, PR, branch, head SHA,
validation result, blocker class, and closeout state. That manual gap recreates
artifact-only confidence, exactly the JSC-331 failure mode.

## User / Operator Scenarios

| Scenario | Operator Need | Required Behavior |
| --- | --- | --- |
| A local Coding Harness command emits OTLP logs | Know telemetry is flowing without treating flow as proof | otel-collector records ingest health and raw events, while closeout evidence remains unproven until normalized. |
| A session-collector bundle exists for coding-harness | Convert safe bundle data into harness evidence | The importer reads bundle files and writes a repo-relative runtime-evidence-bundle/v1. |
| runtime-card needs current session evidence | Summarize observed runtime state without reaching into home-directory collector state | runtime-card consumes only the sanitized repo-local bundle artifact. |
| pr-closeout needs verifier-owned runtime evidence | Block or pass closeout based on current proof | runtime-evidence-contract/v1 carries freshness, blocker, and evidence references. |
| Session evidence is broad, stale, or missing issue metadata | Avoid false closeout confidence | The importer classifies evidence as unknown or blocked instead of inventing a pass. |
| The collector README or startup path drifts | Keep agents on the active runtime | Docs and tests distinguish the package entrypoint from legacy collector files. |

## Goals

- Define the first-class adapter contract from session-collector bundle outputs
  to Coding Harness runtime evidence.
- Preserve the boundary that Coding Harness consumes repo-relative sanitized
  artifacts, not raw telemetry from home-directory collector storage.
- Keep otel-collector as raw ingest and health, not as closeout authority.
- Produce runtime-evidence-bundle/v1 for runtime-card and harness next.
- Produce or derive runtime-evidence-contract/v1 for pr-closeout verifier
  evidence.
- Add fixture-backed proof for happy path, stale evidence, missing metadata,
  malformed bundle input, and raw-path refusal.
- Record the minimum standard telemetry fields Coding Harness commands must
  emit before broad telemetry rollout.

## Non-Goals

- Do not mutate Linear, GitHub, CircleCI, CodeRabbit, Snyk, or automations.
- Do not make otel-collector aggregate stats a closeout source.
- Do not read raw collector files from Coding Harness command consumers.
- Do not add broad tracing or metrics to every command in the first slice.
- Do not weaken runtime-card repo-boundary checks.
- Do not store secrets, raw prompts, bulky transcripts, or unredacted telemetry
  in tracked harness artifacts.
- Do not turn session-collector output into a gate without a later explicit
  plan promoting the advisory contract.

## Current State / Evidence

- src/lib/evidence/logger.ts defines StructuredLogger, default service name
  coding-harness, OTLP header parsing, and collector-token wiring.
- Current production logger usage is narrow; the observed source search found
  command usage in src/commands/evidence-verify.ts, not broad command,
  runtime-card, next, pr-closeout, gate, or validation telemetry coverage.
- src/commands/runtime-card.ts accepts evidence input, constrains the evidence
  path to stay within the repository, and can write evidence output.
- src/lib/runtime/runtime-evidence-bundle.ts defines runtime-evidence-bundle/v1
  and includes session_collector as a provenance kind.
- src/lib/runtime/runtime-evidence-adapter.ts maps session_collector evidence to
  runtime-card source kind session.
- src/commands/pr-closeout/args.ts includes runtime evidence input, and
  src/lib/pr-closeout/evidence-summaries.ts reads verifier status from runtime
  evidence.
- session-collector accepts collector root, bundle directory, project roots, and
  default project discovery.
- session-collector knows the default coding-harness project root, but its
  current adapter indexes only shallow artifact surfaces such as traces and the
  active artifact index.
- session-collector writes redaction-safe bundle files such as
  project-evidence.json and related summaries.
- otel-collector starts the package entrypoint with python -m otel_collector;
  the active server exposes log, trace, metric, stats, metrics, and health
  endpoints.
- otel-collector README still names legacy collector.py as the HTTP collector,
  so startup documentation needs reconciliation when the collector project is
  updated.
- .harness/active-artifacts.md records JSC-331 as active but previously had no
  active spec.
- Live Linear JSC-331 is Todo, assigned to Jamie, parented by JSC-327, and
  describes the apparatus verifier lens that refuses artifact-only confidence.

## Proposed Behavior

Operators should be able to run a collector-normalization pass and then hand a
sanitized, repo-local evidence artifact to Coding Harness commands. The bridge
must keep three roles distinct:

- otel-collector receives OTLP and reports telemetry health.
- session-collector normalizes raw, session, and project evidence into
  redaction-safe bundle artifacts.
- coding-harness imports only the safe bundle shape into first-class runtime
  evidence contracts.

The user-facing solution is a clear evidence path: telemetry may explain what
happened, but only a normalized runtime evidence artifact can support
runtime-card, harness next, or pr-closeout claims.

The first implementation slice should add the importer and fixtures before
expanding broad command telemetry. Later slices may add standard event emission
to high-value command entrypoints once the consumer contract is stable.

## Requirements

### Functional Requirements

- FR-001: The importer MUST read a session-collector bundle directory containing
  at minimum manifest, project evidence, and project validation summary files.
- FR-002: The importer MUST write a runtime-evidence-bundle/v1 artifact whose
  provenance kind is session_collector.
- FR-003: The importer MUST reject absolute output paths and paths that resolve
  outside the declared repository root.
- FR-004: The importer MUST classify missing issue, PR, branch, head SHA,
  validation outcome, or freshness data as unknown or blocked; it MUST NOT
  synthesize a passing closeout claim from partial evidence.
- FR-005: The importer MUST preserve source references to redaction-safe bundle
  files without embedding raw collector event payloads.
- FR-006: The importer MUST map validation results, blockers, source files,
  observed timestamps, and project artifact provenance into runtime-card
  evidence fields when present.
- FR-007: A runtime-evidence-contract producer or summarizer MUST expose
  verifier status, evidence refs, freshness, head SHA when known, blocker
  class, and verification timestamp for pr-closeout.
- FR-008: Coding Harness command telemetry SHOULD use consistent low-cardinality
  attributes for command name, issue key, PR number, branch, head SHA, exit
  code, validation command, outcome, blocker class, and artifact path.
- FR-009: otel-collector health or stats MAY support diagnostics, but MUST NOT
  satisfy runtime evidence or closeout claims by itself.
- FR-010: The session-collector coding-harness adapter SHOULD index current
  harness evidence surfaces in addition to existing shallow surfaces.

### Non-Functional Requirements

- NFR-001: The bridge MUST be redaction-first and MUST NOT write secrets, raw
  prompts, full transcripts, token values, or raw OTLP payload bodies into
  tracked artifacts.
- NFR-002: The importer MUST be deterministic for the same fixture bundle and
  repository root.
- NFR-003: Evidence decisions MUST fail closed when bundle schema, freshness, or
  source identity is ambiguous.
- NFR-004: Validation MUST be fixture-backed and local; no external service
  mutation is allowed for the first slice.
- NFR-005: The implementation MUST preserve existing runtime-card repo-boundary
  behavior.

## Interfaces

| Input | Required | Consumer behavior |
| --- | --- | --- |
| bundle manifest file | Yes | Validate bundle identity, created time, and expected artifacts when fields exist. |
| project evidence file | Yes | Read project artifact provenance, observed timestamps, and redaction-safe project records. |
| project validation summary file | Yes | Read validation names, outcomes, blockers, and freshness where present. |
| agent knowledge file | Optional | Read session hints only when redaction-safe and linked to the target project. |
| aggregate file | Optional | Use for diagnostics only; do not treat aggregate stats as closeout proof. |
| repo root | Yes | Resolve and constrain output paths. |
| issue key, PR, branch, or head SHA filter | Optional for first slice | Narrow evidence when supplied; otherwise classify missing identity as unknown. |

| Output | Required | Consumer behavior |
| --- | --- | --- |
| runtime-evidence-bundle/v1 | Yes | Consumed by runtime-card and harness next adapter paths. |
| runtime-evidence-contract/v1 | Required for pr-closeout support | Consumed by harness pr-closeout runtime evidence input. |
| diagnostics | Yes | Report missing, stale, malformed, or out-of-repo evidence with blocker class and source. |

## Data / Domain Contract

The runtime-evidence-bundle/v1 output has these conformance rules:

- Required field: schemaVersion MUST identify runtime-evidence-bundle/v1.
- Required field: provenance.kind MUST be session_collector.
- Required field: generatedAt MUST be an ISO timestamp for the normalized
  bundle.
- Required field: provenance.ref MUST identify the source bundle or import
  reference.
- Required field: provenance.collectedAt MUST be an ISO timestamp from the bundle
  or import run.
- Required field: sources MUST list redaction-safe source refs and repo-relative
  artifacts when available.
- Required field: blockers MUST list missing or invalid evidence conditions.
- Optional fields: issueKey, pullRequest, linear, phaseExit, and
  phaseExitSourceCompleteness MAY be present when source evidence proves them.
- Validation results and closeout summaries MUST use validation-receipt/v1,
  runtime-evidence-contract/v1, or a separately versioned future schema rather
  than adding unversioned required fields to runtime-evidence-bundle/v1.
- Enum values MUST remain compatible with the current runtime evidence schema.
- Unknown-field behavior: unknown input fields SHOULD be ignored unless they
  conflict with known fields.
- Compatibility and versioning: a new schema version is required before
  consumers depend on fields outside the current runtime evidence contracts.
- Error handling: malformed JSON, missing required files, and ambiguous identity
  MUST block import or emit blocked evidence; they MUST NOT produce pass.

The runtime-evidence-contract/v1 artifact for pr-closeout MUST preserve the
current nested contract shape: declaredIntent, resolvedState, verifierResult,
claimTraceConsistency, evaluation, and outcomeMapping. verifierResult carries
status, owner, evidenceRefs, verifiedAt, and reason. Flattened closeout
summaries MUST be projections from this contract or a separately versioned
future schema, not a replacement for runtime-evidence-contract/v1.

## Enforcement Contract

- essential_decisions: The adapter boundary is session-collector bundle to
  repo-local runtime evidence; Coding Harness commands must not reach into raw
  home-directory telemetry, and collector stats are diagnostic rather than
  closeout authority.
- fillable_gaps: The implementation agent may choose helper names, fixture
  layout, parser decomposition, and exact internal module seams as long as the
  emitted schemas and safety boundaries remain stable.
- guardrails: Required proof includes fixture tests for valid bundle import,
  missing files, malformed JSON, stale or missing identity, raw-path refusal,
  runtime-card consumption, and pr-closeout runtime-evidence summary handling.
- refusal_triggers: Stop if source evidence would require a new public schema
  version, external tracker mutation, raw telemetry persistence, secret access,
  ambiguous closeout authority, or weakening existing repo-boundary checks.
- durable_memory: Transferable lessons go to .harness/memory/LEARNINGS.md or a
  matching solution note when the same steering would otherwise recur.
- professional_output: Closeout must report changed files, exact commands,
  pass/fail/block outcomes, evidence artifact paths, unresolved blockers,
  rollback path, and whether live Linear/GitHub/CI state was observed.

## Security, Privacy, and Safety

- Do not store collector tokens or OTLP headers in artifacts.
- Do not persist raw log bodies, prompts, transcripts, or secret-adjacent
  environment variables in tracked outputs.
- Prefer hashed or redaction-safe identifiers when importing session provenance.
- Keep local evidence artifacts under ignored runtime paths unless promoted to
  curated fixtures.
- Treat off-repo paths as input-only and never as direct harness evidence
  outputs.
- External ingest token behavior belongs to otel-collector and environment
  setup, not to tracked Coding Harness artifacts.

## Accessibility and Operator Ergonomics

This is not a UI spec. Operator-facing CLI and report output still must be
scan-friendly:

- statuses must be words, not colors only
- blockers must be grouped by source file or evidence class
- JSON output must be machine-readable and stable
- human output must name the next safe action
- diagnostics must not require opening raw telemetry files

## Failure and Recovery

| Failure | Required Recovery |
| --- | --- |
| Missing bundle file | Block import and name the missing file. |
| Malformed bundle JSON | Block import and name the parse failure without writing partial evidence. |
| Evidence is broad or stale | Emit blocked or unknown runtime evidence with freshness reason. |
| Issue, PR, branch, or head SHA cannot be proven | Keep identity fields null or unknown; do not pass closeout. |
| Output path escapes repo | Refuse with the existing repo-boundary style error. |
| Session-collector adapter misses harness artifacts | Treat as adapter coverage gap and add fixture coverage before claiming proof. |
| OTEL collector docs point at a legacy entrypoint | Fix collector docs in the collector project, not in Coding Harness. |

Rollback is straightforward: remove the importer, fixtures, and local evidence
command surface while preserving existing runtime-card, pr-closeout, and logger
behavior. No data migration is allowed in the first slice.

## Validation Plan

Minimum first-slice validation:

- Targeted importer unit tests for valid and invalid bundle shapes.
- Targeted runtime-card test proving the emitted bundle is accepted.
- Targeted pr-closeout evidence-summary test proving runtime evidence blocks or
  passes only from verifier-owned fields.
- pnpm typecheck or the narrower repo-approved TypeScript check if the change
  touches exported types.
- pnpm test with targeted files, or the repo equivalent targeted Vitest
  invocation.

Artifact validation:

- check_bluf_structure.py on this spec.
- check_generated_artifact_shape.py on this spec with kind spec.
- he_artifact_identity_lint.py on this spec.
- he_linear_traceability_lint.py on this spec.

Broaden to bash scripts/validate-codestyle.sh --fast when code changes land.
Broaden to pnpm check before PR closeout when the importer becomes part of a
public command or gate surface.

## Acceptance Criteria

| ID | Acceptance | Evidence |
| --- | --- | --- |
| SA-001 | A tracked spec names the bridge boundary and updates the active JSC-331 spec route. | This artifact plus .harness/active-artifacts.md. |
| SA-002 | A session-collector bundle fixture imports into runtime-evidence-bundle/v1 with session_collector provenance. | Targeted importer test. |
| SA-003 | Missing or malformed bundle inputs fail closed without partial output. | Targeted importer failure tests. |
| SA-004 | Off-repo output paths are refused. | Path-boundary test matching existing runtime-card posture. |
| SA-005 | Missing issue, PR, branch, head SHA, or freshness data cannot produce a passing closeout verifier result. | Runtime evidence contract test. |
| SA-006 | runtime-card consumes the emitted repo-local evidence bundle. | Runtime-card targeted test. |
| SA-007 | pr-closeout consumes runtime evidence and reports verifier status, blocker, and evidence refs. | Pr-closeout targeted test. |
| SA-008 | Session-collector coding-harness adapter coverage includes current harness evidence surfaces or records explicit deferred coverage. | Session-collector adapter fixture or tracked follow-up. |
| SA-009 | Collector stats remain diagnostic and are not accepted as closeout proof. | Importer test or docs assertion. |
| SA-010 | Handoff reports local validation, live tracker observation, and any unobserved horizons separately. | PR or handoff closeout evidence. |

## Visual References / Diagrams

| Step | Surface | Authority |
| --- | --- | --- |
| 1 | Coding Harness command events | Observation source only |
| 2 | otel-collector raw ingest and stats | Telemetry health and raw input |
| 3 | session-collector normalized bundle | Redaction-safe source evidence |
| 4 | Coding Harness importer | Contract translation boundary |
| 5 | runtime-evidence-bundle/v1 | runtime-card and harness next evidence |
| 6 | runtime-evidence-contract/v1 | pr-closeout verifier evidence |

This visual table is authoritative only for boundary direction. The data
contract above is authoritative when text and table disagree.

## Implementation Notes

- Keep the first slice adapter-focused. Broad command telemetry can follow
  after the importer proves which fields matter.
- Prefer a pure parser and mapper module with fixtures over shelling out to
  session-collector.
- Keep generated local evidence in an ignored harness runtime path unless a
  fixture is intentionally promoted for tests.
- If the plan admits a CLI, prefer explicit JSON output and repo-root
  constraints consistent with existing command contracts.
- Fix otel-collector README entrypoint drift in the collector repository, not as
  part of the Coding Harness importer unless the active slice explicitly spans
  that project.

## Open Questions

- Should the first Coding Harness surface be a new explicit import command, or
  should the importer remain library-only until runtime-card and pr-closeout
  usage settles?
- Which ignored harness path should be the default for local imported session
  evidence?
- Should session-collector learn issue, PR, and head-SHA filtering, or should
  Coding Harness apply that narrowing after bundle import?
- Which command families should emit standard telemetry first after the
  evidence consumer contract lands?

## Decision

Proceed with a bounded JSC-331 spec-to-plan handoff. The approved direction is
to treat telemetry as observation, session-collector bundles as normalized
source evidence, and Coding Harness runtime evidence contracts as the only
local authority for runtime-card and pr-closeout claims.

## Evidence and References

- User-provided observability and telemetry wiring review, 2026-05-22.
- Live Linear JSC-331 issue.
- .harness/active-artifacts.md.
- .harness/plan/2026-05-18-agent-testing-gates-harness-assurance-plan.md.
- src/lib/evidence/logger.ts.
- src/commands/runtime-card.ts.
- src/lib/runtime/runtime-evidence-bundle.ts.
- src/lib/runtime/runtime-evidence-adapter.ts.
- src/commands/pr-closeout/args.ts.
- src/lib/pr-closeout/evidence-summaries.ts.
- session-collector main, evidence, and project adapter modules.
- otel-collector startup, server, and README surfaces.

## No-Fog Gate

- This spec does not prove telemetry is currently flowing.
- This spec does not claim live PR closeout readiness.
- This spec does not authorize Linear mutation.
- This spec does not authorize broad command telemetry rollout.
- This spec does authorize he-plan to create a small importer implementation
  slice with fixture-backed proof.

## Linear Work Item Contract

JSC-331 remains the live tracker for this local spec. The current Linear issue
is in Todo and already describes the apparatus verifier lens that refuses
artifact-only confidence. No Linear write was performed while creating this
spec.

If this spec becomes the active implementation source, he-linear-plan may
prepare a comment that links this spec and summarizes the accepted slice. That
mutation requires separate authority.

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Notes |
| --- | --- | --- |
| JSC-331 | SA-001, SA-002, SA-003, SA-004, SA-005, SA-006, SA-007, SA-008, SA-009, SA-010 | Covers the apparatus verifier lens by requiring runtime evidence rather than artifact-only confidence. |

## Appendix A. Harness Metadata / Traceability

- interactive_status: complete
- selection_evidence: user-provided observability review, active JSC-331 route,
  live Linear JSC-331 read, and current source file inspection from the review
- route: standard-spec
- stage: he-spec
- scope: Coding Harness evidence bridge across coding-harness,
  session-collector, and otel-collector
- validation: artifact validation required before handoff
- safe_to_continue: true
- blocked_reason: null
- linear_mutation_status: not_needed
- linear_action_required: no mutation performed; optional comment deferred to
  he-linear-plan
- spec_path:
  .harness/specs/2026-05-22-jsc-331-observability-telemetry-evidence-bridge-spec.md
- acceptance_ids: SA-001 through SA-010
- git_staging_status: unstaged
- staged_paths: none
- confidence: high for local spec shape and source routing; medium for
  implementation details because no importer code has been written yet
- blackboard_delta: JSC-331 now has a local active spec for the
  observability-to-runtime-evidence bridge instead of relying on chat-only
  analysis.

## Appendix B. Review Outcomes

This artifact is generated from an engineering review and has not yet received
an independent code or spec review. Review stack requirements belong to the
future he-plan or implementation slice.

## Appendix C. he-plan Handoff

Recommended first plan unit:

- allowed files: this spec, .harness/active-artifacts.md, future importer module
  and tests under src/lib/runtime, and future pr-closeout or runtime-card
  targeted tests if required
- forbidden files: unrelated dirty worktree files, raw collector data under
  home-directory collector storage, and external tracker state without explicit
  authority
- verification: artifact shape gates for this spec, targeted importer,
  runtime-card, and pr-closeout tests for code work, then fast codestyle before
  PR handoff when code changes land
- stop if: evidence would require raw telemetry persistence, public schema
  versioning becomes ambiguous, issue or PR identity cannot be represented
  without inventing proof, or validation cannot distinguish telemetry health
  from closeout evidence
