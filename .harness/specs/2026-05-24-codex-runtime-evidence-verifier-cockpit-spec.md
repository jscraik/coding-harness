---
schema_version: 1
artifact_id: codex-runtime-evidence-verifier-cockpit-spec
artifact_type: he-spec
canonical_slug: codex-runtime-evidence-verifier-cockpit
title: Codex Runtime Evidence Verifier Cockpit Full Lifecycle Spec
harness_stage: he-spec
status: proposed_full_lifecycle
date: 2026-05-24
origin: user-requested mapping between evidence-led audit, Codex runtime evidence mapping, and local openai/codex source inspection
linear_issue: JSC-363
linear_issue_url: https://linear.app/jscraik/issue/JSC-363/coding-harness-implement-codex-runtime-evidence-verifier-cockpit-phase
linear_parent: JSC-328
linear_project: Harness cockpit routing
linear_status: Triage
linear_mutation_status: approved_small_set_created
linear_action_required: true
linear_action_required_reason: "Linear issue JSC-363 exists for the initial implementation lane; update or split Linear before claiming full lifecycle delivery."
safe_to_continue: true
blocked_reason: null
traceability_required: true
risk: runtime-truth-and-claim-verification
depth: cross-repo-behavior-contract
ui: false
lifecycle_scope: full_implementation
planning_only_delivery_allowed: false
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
  - SA-017
  - SA-018
---

# Codex Runtime Evidence Verifier Cockpit Full Lifecycle Spec

## Table of Contents

- [Command Summary](#command-summary)
- [Purpose](#purpose)
- [Problem Statement](#problem-statement)
- [User / Operator Scenarios](#user--operator-scenarios)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Current State / Evidence](#current-state--evidence)
- [Codex Source Mapping](#codex-source-mapping)
- [Audit-to-Architecture Mapping](#audit-to-architecture-mapping)
- [Authority and Scope Boundary](#authority-and-scope-boundary)
- [Ownership and Decision Authority](#ownership-and-decision-authority)
- [Intent and Slice Governance](#intent-and-slice-governance)
- [Proposed Behavior](#proposed-behavior)
- [Requirements](#requirements)
- [Interfaces](#interfaces)
- [Data / Domain Contract](#data--domain-contract)
- [Enforcement Contract](#enforcement-contract)
- [Proof and Runtime Boundary](#proof-and-runtime-boundary)
- [Coding and Testing Lenses](#coding-and-testing-lenses)
- [Security, Privacy, and Safety](#security-privacy-and-safety)
- [Accessibility Requirements](#accessibility-requirements)
- [Observability Requirements](#observability-requirements)
- [Failure and Recovery](#failure-and-recovery)
- [Rollback / Recovery](#rollback--recovery)
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

BLUF: This spec's job is to define the full lifecycle cross-repo behavior contract that turns Codex runtime signals into Harness-verifiable evidence receipts and claim verdicts for the operator, implementation agent, reviewer, future closeout hook, and Judge/PM audit handoff. It matters because Coding Harness can already model runtime cards and PR closeout claims, while the local openai/codex checkout already exposes thread, turn, token, approval, sandbox, MCP, and lifecycle signals across SDK, app-server protocol, and analytics reducer surfaces. The risk is that agents keep making green, tidy, merged, or Judge/PM-ready claims from partial or stale evidence unless Codex facts are normalized into receipts and Harness decides which claims are supported. The decision and next action are to execute the associated full lifecycle plan from PU-000 through PU-016, starting with evidence-receipt/v1 plus codex-runtime-evidence/v1 ingestion inside Coding Harness and continuing through production review-state, external-state, delivery-truth, Codex producer, closeout, and audit-readiness gates.

Decision Needed: approve this spec as the full lifecycle behavior contract for the runtime evidence bridge, then execute the associated plan as bounded implementation slices. The first implementation slice remains Harness-only and fixture-first; later slices must not claim completion until the production verifier, external refresh, review-state, Codex producer, and audit-readiness surfaces have current evidence.

Top Risks: inventing a broad new truth command family, mixing orientation data with claim-support data, treating SDK events as full permission truth, trusting stale PR or tracker snapshots, and embedding bulky session or review data inside runtime-card/v1 instead of linking receipts.

Next Action: run PU-000 from the associated plan to create the reviewed intent artifact and acceptance-coverage guard, then implement the lifecycle in order. The Harness-only first slice covers evidence-receipt/v1, codex-runtime-evidence/v1 validator, adapter into runtime-evidence-bundle/v1, runtime-card summary projection, minimal delivery-truth composition fixtures, and negative fixtures for missing status, stale external state, unavailable Codex fields, mixed-head merge readiness, and producer freshness that violates verifier policy. It is a foundation stage, not the full implementation.

## Purpose

This specification maps the evidence-led codebase audit and the Codex runtime evidence ingestion proposal against the actual local openai/codex repository. It defines a shared contract where Codex runtime facts become structured input packets, and Coding Harness remains the verifier that decides whether claims are supported, blocked, stale, missing, or only usable for orientation.

The spec is deliberately cross-repo and full lifecycle, but implementation-sequenced. The first implementation patch belongs in Coding Harness because it can validate and consume Codex-shaped packets without requiring upstream Codex changes. That first patch is only the foundation. Completion requires later production slices that wire review-state/v1, external-state-snapshot/v1, delivery-truth/v1, Codex producer/export behavior, closeout downgrade semantics, Linear/PR/CI freshness, and Judge/PM audit packet evidence. Codex changes should follow only after the packet shape, receipt semantics, and claim-verdict rules have fixture-backed proof and an approved bridge boundary.

## Problem Statement

The audit found that Coding Harness already has strong ingredients: runtime cards, PR closeout claims, evidence bundles, command registry surfaces, and review-oriented guardrails. The weakness is that several important delivery claims remain outside a general verifier: root tidy, scaffold sorted, main pulled, branch cleanup complete, goal ready for Judge/PM, and merge readiness.

The runtime evidence mapping solves the shape problem by introducing Codex as a producer of structured runtime truth. The missing piece is an implementation contract that ties that mapping to actual Codex source surfaces instead of imagining fields that Codex cannot currently provide.

Without this bridge, agents can still overclaim from partial evidence: a schema-valid runtime card can be treated as closeout truth, a reviewer artifact can be described without path/size/producer verification, and a stale PR or tracker snapshot can be blended into a green status. That repeats the exact feedback pattern this system is meant to prevent.

## User / Operator Scenarios

| Scenario | Operator Need | Required Behavior |
| --- | --- | --- |
| Codex finishes a turn in the SDK | Capture thread, turn, usage, final response, and event status | Codex-shaped evidence records those fields and marks absent permission or PR truth as unknown rather than inferred. |
| Codex runs through app-server v2 | Reuse first-class thread and turn notifications | The bridge maps app-server thread/turn/token/item notifications to codex-runtime-evidence/v1 receipts. |
| Codex analytics observes approvals, sandbox, and MCP calls | Preserve richer runtime truth | The bridge can admit analytics-derived permission, sandbox, and MCP summaries as stronger evidence than SDK-only events. |
| Harness next needs orientation | Let stale or partial evidence guide the next safe action | runtime-card/v1 may show orientation evidence with stale or unknown freshness. |
| Closeout claims delivery readiness | Prevent false success | delivery-truth/v1 refuses claim support from missing, stale, unknown, or orientation-only receipts. |
| PR review work needs proof | Separate review state from local validation and CI | review-state/v1 carries reviewer artifacts, GitHub/CodeRabbit comments, unresolved threads, and validation ownership. |
| ROOT cleanup is claimed complete | Require mechanical proof | delivery-truth/v1 requires root-hygiene-classification/v1 or equivalent evidence receipt before passing root_surface_tidy. |
| Codex cannot expose a field | Avoid invented confidence | The packet records unavailable fields as unknown with a source-specific failure class. |

## Goals

- Define evidence-receipt/v1 as the shared proof primitive for validation, artifacts, review artifacts, runtime cards, run records, and external snapshots.
- Define codex-runtime-evidence/v1 as an input packet that can represent real Codex thread, turn, goal, permission, MCP, validation, artifact, provenance, and stale-state evidence.
- Map codex-runtime-evidence/v1 into existing runtime-evidence-bundle/v1 and runtime-card/v1 without broadening runtime cards into evidence warehouses.
- Introduce delivery-truth/v1 as the generalized claim-verdict composition layer that wraps existing runtime-evidence-contract/v1 and pr-closeout/v1 semantics instead of replacing or forking them.
- Define review-state/v1 and external-state-snapshot/v1 as distinct packet families so review, CI, tracker, and merge readiness never collapse into one blended truth.
- Ground all Codex-side fields in inspected local source surfaces or explicitly classify them as unavailable in the current source.
- Keep harness next --json as the narrow cockpit; add verdict summaries and references rather than separate public truth commands for every domain.
- Preserve the full lifecycle boundary: planning/spec approval and the Harness-only foundation cannot be reported as the full implementation or fix.

## Non-Goals

- Do not mutate the local openai/codex checkout in the first slice.
- Do not add a new broad Harness command family for every truth category.
- Do not embed raw transcripts, bulky logs, full review comment bodies, or secrets in runtime-card/v1.
- Do not claim live PR, CI, Linear, or CodeRabbit state from Codex SDK events.
- Do not treat Codex analytics events as closeout proof until they are normalized through Harness receipts with freshness and source semantics.
- Do not weaken existing pr-closeout/v1 claim fields.
- Do not implement a Codex upstream app-server protocol extension before the Harness-side packet contract has fixture proof.
- Do not close JSC-363, or claim full lifecycle delivery, until PU-000 through PU-016 have matching validation, closeout, and audit evidence or an explicit blocked status.

## Current State / Evidence

Coding Harness already has the target cockpit anchor:

- src/lib/runtime/runtime-evidence-bundle.ts defines runtime-evidence-bundle/v1 and admits source kinds for git, PR, Linear, artifact, validation, review, session, and phase-exit.
- src/lib/runtime/runtime-card.ts defines runtime-card/v1 with lifecycle, branch, pull request, artifacts, Linear, phase-exit, sources, blockers, attempt ledger, and recovery event.
- src/lib/runtime/runtime-evidence-contract.ts defines runtime-evidence-contract/v1 for tying agent claims to runtime truth, verifier evidence, and run-record semantics; delivery-truth/v1 MUST reuse this verifier vocabulary rather than create a second contradictory contract.
- src/lib/pr-closeout/types.ts defines pr-closeout/v1 claims with status, source, evidenceRef, headSha, freshness, blockerClass, missingContext, and verifiedAt.
- docs/architecture/root-surface-classification.md is the canonical root-surface taxonomy; root-hygiene-classification/v1 MUST be the executable receipt projection of that document, not a competing taxonomy.
- The audit grades Runtime Truth and Decision Packets as B- and Claim-vs-Evidence Verification as B, but calls out that unsupported language is not generally blocked outside PR closeout.
- The audit names root hygiene, runtime-card claim freshness, reviewer coverage coupling, run-record coverage, and delivery-truth/v1 as high-leverage fixes.

The local openai/codex checkout exposes usable runtime signals:

- sdk/typescript/src/thread.ts exposes Thread.id after thread.started, passes threadId/model/sandbox/approval/network/working-directory options into exec, and returns items, finalResponse, and usage after turn completion.
- sdk/typescript/src/events.ts exposes JSONL event types for thread.started, turn.started, turn.completed, turn.failed, item.started, item.updated, and item.completed.
- sdk/python/src/openai_codex/_run.py collects item/completed, thread/tokenUsage/updated, and turn/completed notifications for a specific turn id into TurnResult.
- sdk/python/src/openai_codex/_message_router.py routes app-server notifications by turnId or nested turn.id, preserving in-flight turn streams.
- codex-rs/app-server-protocol/src/protocol/common.rs defines v2 notifications including thread/started, thread/goal/updated, thread/tokenUsage/updated, turn/started, turn/completed, item/completed, hook started/completed, and MCP elicitation request shapes with threadId and turnId.
- codex-rs/app-server-protocol/src/jsonrpc_lite.rs supports optional W3C trace context on JSON-RPC requests, but notifications inspected here do not prove a universal trace id field.
- codex-rs/analytics/src/reducer.rs tracks thread metadata, pending and completed turn state, token usage, tool counts, permission profile, sandbox policy, approval policy, approvals reviewer, network sandbox access, and MCP tool call outcome events.
- sdk/python/pyproject.toml declares package version 0.131.0a4 and depends on openai-codex-cli-bin==0.131.0a4, giving a package-provenance source for later packet fields.

Supporting context caveat: the requested optional path string ~/dev/cpdex/ was not treated as verified evidence because the inspected local Codex source was /Users/jamiecraik/dev/codex. Any future work that depends on a different Codex checkout MUST re-run the source mapping against that checkout before implementation.

## Codex Source Mapping

| Evidence Field | Codex Source | Current Strength | Harness Interpretation |
| --- | --- | --- | --- |
| threadId | TypeScript Thread.id and app-server thread notifications | High | Usable in codex-runtime-evidence/v1 as current thread identity when emitted by SDK/app-server. |
| turnId | Python SDK TurnResult, message router, generated v2 notifications, analytics reducer | High | Usable as primary turn identity and receipt correlation key. |
| traceId | Optional JSON-RPC request trace context | Low | Mark unknown unless the producer can attach a concrete trace context from the active runtime. |
| goalState | app-server thread/goal notifications exist | Medium | Admit only when a concrete goal notification or snapshot is supplied; otherwise unknown. |
| finalResponse/items/usage | TypeScript Thread.run, Python _collect_turn_result, thread/tokenUsage/updated | High | Usable for run-record receipts, not sufficient for delivery claims. |
| model/reasoning/service tier | TypeScript options and analytics resolved config | Medium to High | SDK-only packet can report requested values; analytics-derived packet can report resolved values. |
| approval policy | TypeScript options, Python approval mapping, analytics resolved config | Medium to High | Treat analytics-derived resolved approval policy as stronger than SDK-requested policy. |
| permission profile | analytics reducer permission_profile and sandbox_policy_mode | High when analytics source is present | Do not infer full permission profile from SDK sandbox option alone. |
| writable roots/network | analytics permission profile and sandbox_network_access | High when analytics source is present | Required for closeout claims involving permission posture; unknown from SDK-only packets. |
| MCP tool use | analytics tool counts and mcp tool call event fields | High for observed calls | Use for capability/use evidence; MCP server availability needs a separate snapshot. |
| MCP availability | mcp-server/session state and configured server health | Medium | Capture as capability snapshot, not as proof that a specific call succeeded. |
| validation results | command/tool outputs outside Codex core | Medium | Harness should own validationResult receipts; Codex may reference them when captured. |
| artifact receipts | no inspected first-class Codex artifact receipt model | Low | Harness evidence-receipt/v1 should verify path, size, producer, and checksum where available. |
| PR/CI/review/Linear state | external connectors and Harness commands | Low inside Codex source | Codex packet may carry refs, but Harness must refresh live snapshots before claim support. |
| package provenance | Python package metadata, TypeScript package metadata, CLI/package scripts | Medium | Add later as provenance fields after first packet contract is stable. |

## Audit-to-Architecture Mapping

| Audit Gap | Runtime Evidence Architecture | Combined Fix |
| --- | --- | --- |
| GAP-001 adopted evidence does not execute proof | evidence-receipt/v1 and validationResult receipts | Require a current validation receipt before evidence patterns can pass. |
| GAP-004 root hygiene documented but not enforced | delivery-truth claim root_surface_tidy | Require root-hygiene-classification/v1 evidence receipt before passing root tidy claims. |
| GAP-005 runtime-card local mode unknown live truth | evidenceUse orientation versus claim_support | Allow orientation with unknown freshness; block closeout claims without claim-support receipts. |
| GAP-007 run-record emission not universal | codex thread/turn/trace identity receipts | Link run records to Codex runtime identity and mark missing turn or trace fields explicitly. |
| GAP-008 reviewer coverage not workflow-coupled | review-state/v1 and review artifact receipts | Verify reviewer artifact path, size, expected producer, role, and unresolved thread counts. |
| GAP-011 tool availability not captured | capability snapshot inside codex-runtime-evidence/v1 | Distinguish unavailable tool/MCP environment from failed claim evidence. |
| GAP-012 delivery truth is PR-scoped | delivery-truth/v1 | Generalize PR closeout claim semantics to root, branch, scaffold, goal, and merge language. |

## Authority and Scope Boundary

- requested_depth: cross-repo behavior spec with full lifecycle implementation plan and implementation-ready first slice for Coding Harness.
- approved_execution_boundary: inspect local openai/codex source and update Coding Harness spec artifacts; do not mutate openai/codex source in this spec pass.
- downscope_authority: the first implementation slice MUST include evidence-receipt, codex-runtime-evidence ingestion, adapter projection, runtime-card summary projection, and minimal delivery-truth composition fixtures. It may omit public delivery-truth commands, full review-state implementation, and full external-state implementation if fixture-backed receipts still prove stale, orientation-only, mixed-head, and verifier-freshness refusal behavior. That downscope applies only to the first slice; the associated full lifecycle plan remains incomplete until later production and closeout units finish.
- external_mutation_boundary: no GitHub, CodeRabbit, CircleCI, or Codex upstream mutation is authorized by this spec alone. Linear issue JSC-363 already exists for the initial implementation lane, but Linear must be updated or split before full lifecycle delivery claims.
- freshness_required: live PR, CI, review, and tracker truth must be refreshed by Harness before merge-readiness claims.
- human_acceptance_boundary: Judge/PM audit remains a human acceptance gate for the JSC-331 goal; this spec only improves evidence available to that audit.

## Ownership and Decision Authority

| Surface | Owner | Authority in First Slice | Required Proof |
| --- | --- | --- | --- |
| evidence-receipt/v1 | Coding Harness implementation owner | Add schema, validator, fixtures, and tests. | Positive and negative receipt validation tests. |
| codex-runtime-evidence/v1 | Coding Harness implementation owner | Add Harness-side schema and adapter using local Codex-shaped fixtures. | SDK-only, app-server-shaped, and analytics-derived fixtures pass or fail deterministically. |
| runtime-evidence-bundle/v1 adapter | Coding Harness implementation owner | Add additive Codex projection without breaking existing producers. | Existing runtime evidence adapter tests plus new Codex projection tests pass. |
| runtime-card/v1 projection | Coding Harness implementation owner | Add compact advisory summaries and receipt refs only in the first implementation slice. | Runtime-card validation proves raw packet bodies and full review content are not embedded. |
| delivery-truth/v1 | Coding Harness spec owner and implementation owner | Define as a composition layer over runtime-evidence-contract/v1 and pr-closeout/v1 semantics; first slice proves private fixture behavior, while public exposure waits for the he-plan to select a command surface. | Delivery-truth fixtures reuse status, freshness, evidence refs, head SHA, blocker class, and verifiedAt semantics already present in runtime and PR closeout contracts. |
| review-state/v1 | Coding Harness implementation owner | Defer to a later PR unless required to prove first-slice non-blending. | Reviewer artifact path, size, producer, role, and unresolved-thread fixtures. |
| external-state-snapshot/v1 | Coding Harness implementation owner | Defer to a later PR unless needed for stale-state negative fixtures. | TTL and head-SHA stale fixtures. |
| root-hygiene-classification/v1 | Coding Harness implementation owner | Treat as executable receipt projection of docs/architecture/root-surface-classification.md. | Root tidy claims cannot pass without the receipt ref and classification source. |
| Codex-native SDK or app-server emission | Codex owner or separate Codex integration owner | Not authorized in the first slice; required or explicitly replaced by an approved producer/export bridge before full lifecycle completion. | Separate Codex-owned spec or ADR selecting SDK wrapper, app-server protocol, analytics export, or Harness-owned wrapper boundary. |
| Judge/PM audit readiness | Human Judge/PM owner | Not automatable by this spec; required as an explicit closeout gate before goal completion language. | Human-audit requirement state remains explicit and cannot be passed by local validation alone. |

Escalate before implementation when a patch would change public command authority, alter Codex upstream protocol, remove existing pr-closeout semantics, or reinterpret root-surface classification outside the canonical root-surface document.

## Intent and Slice Governance

Every implementation unit derived from this spec MUST start from a small, bounded intent artifact before code changes. The intent artifact is the first-class statement of why the slice exists, which deep module or adapter seam it touches, which acceptance IDs it owns, which claim classes it may alter, and which surfaces are explicitly out of scope.

Required intent artifact fields:

| Field | Requirement |
| --- | --- |
| intentId | Stable identifier for the slice or work unit. |
| objective | One concise outcome statement. |
| ownedAcceptanceIds | Exact SA IDs owned by the slice. |
| deepModuleBoundary | Target module, adapter seam, command surface, or validator boundary. |
| inScope | Files, schemas, fixtures, commands, or docs the slice may change. |
| outOfScope | Explicitly excluded surfaces, especially Codex upstream, public commands, external connectors, or delivery hooks when deferred. |
| automationPlan | Validators, tests, fixtures, or scripts that will prove the intent without relying on reviewer prose. |
| reviewStatus | not_reviewed, reviewed, blocked, or superseded. |
| reviewedBy | Human, reviewer role, or automated validator that reviewed the intent before implementation. |

Implementation MUST NOT begin until the intent artifact is reviewed or explicitly marked blocked with the missing reviewer or decision. The first he-plan slice should be scoped to one deep module family at a time: evidence receipt schema, Codex evidence adapter, runtime-card projection, delivery-truth composition, review-state packet, external-state snapshot, root hygiene receipt, or closeout hook. Broad multi-family patches require an explicit intent review that justifies the combined blast radius.

Automation is preferred over prose whenever a claim can be mechanically checked. If a reviewer or implementer identifies a repeated manual check, the implementation plan MUST either add a validator, fixture, command, or schema assertion for it, or record why automation is not feasible in that slice.

## Proposed Behavior

Codex runtime evidence enters Harness as an input packet. Harness validates the packet, normalizes useful pieces into runtime-evidence-bundle/v1, summarizes the current state in runtime-card/v1, and uses delivery-truth/v1 to determine which operator claims are supported.

The core flow is:

~~~text
Codex runtime or SDK wrapper
  emits codex-runtime-evidence/v1
    |
    v
Coding Harness validator and adapter
  emits evidence-receipt/v1 records
  emits runtime-evidence-bundle/v1 projection
    |
    v
runtime-card/v1 cockpit summary
    |
    +--> harness next --json meta
    +--> review-state/v1
    +--> external-state-snapshot/v1
    +--> delivery-truth/v1
    |
    v
Closeout language can pass only with current claim-support evidence
~~~

runtime-card/v1 remains a summary and pointer object. It carries current identity, blocker, and receipt summaries; it does not carry every raw event, review body, command log, or transcript.

## Requirements

### FR-001 / SA-001 Shared Evidence Receipt

Coding Harness MUST define evidence-receipt/v1 as the common proof primitive for validation, artifacts, review artifacts, external state, runtime cards, and run records. It MUST include kind, ref, producer, producedAt, verifiedAt, headSha where applicable, status, freshness, blockerClass, evidenceUse, and optional size/checksum fields.

Any receipt used for claim_support MUST fail validation when verifiedAt, status, freshness, evidenceUse, or blockerClass is missing. Orientation receipts MAY omit PR-head-specific headSha only when the source is not PR-head-sensitive and the receipt states why headSha is not applicable.

### FR-002 / SA-002 Codex Runtime Evidence Packet

Coding Harness MUST define codex-runtime-evidence/v1 with sections for Codex identity, thread and turn identity, goal state, model/runtime provenance, permission profile, MCP/capability snapshot, validation results, artifact receipts, external-state refs, review-state refs, and stale-state classification.

The packet MUST include sourceKind and sourceRef fields for every major section. SDK-only packets MUST NOT claim resolved permission profile, live external state, review truth, root hygiene, or artifact existence unless they reference a Harness verifier receipt for that fact.

### FR-003 / SA-003 Real Source Classification

Every codex-runtime-evidence/v1 field MUST declare whether it came from SDK events, app-server protocol, analytics events, Harness validation, external snapshot, or operator-provided evidence. Fields unsupported by the producing source MUST be null or unknown with a failureClass; they MUST NOT be inferred from adjacent fields.

### FR-004 / SA-004 Runtime Evidence Adapter

Coding Harness MUST add an adapter that validates codex-runtime-evidence/v1 and projects it into runtime-evidence-bundle/v1 sources and blockers. The adapter MUST preserve original provenance rather than flattening Codex runtime source details into a generic manual source.

The adapter MUST emit a blocker when a consumer requests claim_support from a packet whose matching receipt is stale, missing, unknown, or orientation-only.

### FR-005 / SA-005 Runtime Card Projection

The first implementation slice MUST add compact runtime-card/v1 summaries for codexRuntime, capabilities, receiptRefs, externalState, staleState, and provenance. Full details MUST stay in receipts or packet artifacts. Projection changes MUST remain backward-compatible until all existing runtime-card producers, validators, and CLI callers are migrated.

### FR-006 / SA-006 Orientation Versus Claim Support

Evidence MUST distinguish orientation, claim_support, and audit_trail use. Stale or partial evidence may inform harness next --json orientation, but MUST NOT support delivery-truth claims.

### FR-007 / SA-007 Delivery Truth

Coding Harness MUST define delivery-truth/v1 as the generalized claim verdict layer for delivery language. It MUST support claims including local validation, remote checks, review threads, tracker state, branch/worktree state, root surface tidy, merge readiness, and goal ready for Judge/PM audit. It MUST compose existing runtime-evidence-contract/v1 and pr-closeout/v1 fields rather than redefine status, freshness, evidenceRef, headSha, blockerClass, or verifiedAt semantics.

delivery-truth/v1 MUST include a verifier-owned verdictHeadSha for PR-head-sensitive composed claims such as merge_ready. Every claim-support receipt that participates in a PR-head-sensitive pass verdict MUST either match verdictHeadSha or be not_applicable with an explicit reason. A mixed-head composition MUST fail with mixed_head_evidence.

delivery-truth/v1 MUST recompute freshness using Harness verifier policy. Producer-provided freshness or ttlSeconds may orient the verifier, but it MUST NOT override verifier-owned maximum TTL, clock, source, or head-SHA comparison rules.

### FR-008 / SA-008 Review and External State Separation

review-state/v1 and external-state-snapshot/v1 MUST remain separate packet families. Review truth, local validation, remote checks, tracker state, and merge readiness MUST NOT collapse into one blended status.

### FR-009 / SA-009 Codex Native Bridge Path

The first native Codex integration SHOULD be treated as exploratory until the Harness-only first slice passes. No Codex API, protocol, package, or launcher behavior may change without a separate Codex-owned spec or ADR that selects the SDK wrapper, app-server protocol, analytics export, or Harness-owned wrapper boundary.

### FR-010 / SA-010 Closeout Hook Integration

Automated final responses or closeout hooks that claim delivered, green, tidy, merged, or ready MUST cite a Harness runtime card and delivery-truth verdict. When no current claim-support verdict exists, the hook MUST downgrade the claim to orientation or block the closeout text with a stable blocker class. Manual human summaries MAY mention unverified orientation only when they explicitly say the claim is not verified.

### FR-011 / SA-017 Intent Artifact Before Implementation

Every implementation slice derived from this spec MUST produce an intent artifact before code changes. The artifact MUST identify objective, owned acceptance IDs, deep module boundary, in-scope files, out-of-scope files, automation plan, and review status. The implementation MUST block or pause when the intent artifact is missing or not reviewed.

### FR-012 / SA-018 Automation-First Validation

Every acceptance criterion that can be checked mechanically MUST have a validator, fixture, command, or schema assertion before the implementation is considered complete. Manual review MAY remain for architecture judgment and human audit, but it MUST NOT be the only proof for deterministic status, freshness, head SHA, artifact, root hygiene, accessibility label, or redaction claims.

## Interfaces

evidence-receipt/v1 fields:

| Field | Requirement |
| --- | --- |
| schemaVersion | Must equal evidence-receipt/v1. |
| kind | validation, artifact, review_artifact, external_state, runtime_card, or run_record. |
| ref | Stable path, command, URL, or artifact reference. |
| producer | Stable producer name such as codex-sdk, codex-analytics, harness-validator, or reviewer role. |
| producedAt | Timestamp from the producer when known. |
| verifiedAt | Timestamp from the verifier when checked. |
| headSha | Required for PR-head-sensitive evidence, otherwise null. |
| status | pass, fail, blocked, unknown, or not_applicable. |
| freshness | current, stale, missing, unknown, or not_applicable. |
| evidenceUse | orientation, claim_support, or audit_trail. |
| blockerClass | Stable blocker class when status is not pass. |
| sizeBytes/checksum | Required for review and artifact receipts when file-backed. |

codex-runtime-evidence/v1 sections:

| Section | Contents |
| --- | --- |
| codex | threadId, turnId, traceId, goalState, model, runtimeChannel, package provenance. |
| permissions | profile, writableRoots, network, approvalPolicy, approvalsReviewer. |
| capabilities | MCP server states and tool counts. |
| receipts | artifact, run-record, and audit-trail receipts. |
| validationResults | validation receipts captured or referenced by the run. |
| externalStateRef | Optional external-state-snapshot/v1 reference. |
| reviewStateRef | Optional review-state/v1 reference. |
| staleState | Refs and reasons that block claim support. |

delivery-truth/v1 initial claims:

| Claim | Proof Source |
| --- | --- |
| local_validation_passed | validation receipt |
| remote_checks_current | external-state snapshot |
| review_threads_resolved | review-state packet |
| linear_state_aligned | external-state snapshot or Linear receipt |
| branch_on_main | git receipt |
| worktree_clean | git receipt |
| root_surface_tidy | root-hygiene-classification receipt |
| goal_ready_for_judge_pm | runtime-card plus human-audit state |
| merge_ready | composed verdict from required claim-support receipts |

delivery-truth/v1 verdict envelope:

| Field | Requirement |
| --- | --- |
| schemaVersion | Must equal delivery-truth/v1. |
| verdictId | Stable verdict identifier for audit and closeout references. |
| claim | Claim being evaluated, such as merge_ready or root_surface_tidy. |
| verdictHeadSha | Required for PR-head-sensitive composed claims; otherwise null with reason. |
| receipts | Claim-support receipt refs participating in the verdict. |
| verifierFreshnessPolicy | Policy ref or inline max TTL and clock-source summary used by Harness. |
| status | pass, fail, blocked, unknown, or not_applicable. |
| blockerClass | Stable blocker class when status is not pass. |
| verifiedAt | Harness verifier timestamp. |

Verifier-owned freshness policy:

| Evidence Class | Maximum Claim-Support TTL | Required Recompute |
| --- | --- | --- |
| local validation receipt | Same head SHA as verdict; no time-only pass when source changed | Compare receipt headSha or source fingerprint to verdictHeadSha where applicable. |
| remote checks and PR metadata | 10 minutes | Refresh or mark stale when ttlSeconds exceeds policy, fetchedAt expires, or headSha mismatches. |
| review-state packet | 10 minutes | Refresh unresolved-thread count and headSha before merge_ready. |
| Linear or tracker state | 30 minutes | Refresh before goal_ready_for_judge_pm or merge_ready. |
| root hygiene receipt | Same root-surface classification source and current tree state | Recompute when tracked root entries or classification source change. |
| artifact or reviewer receipt | Current file path, non-zero size, expected producer, and checksum when available | Re-stat file and compare producer/role expectations before claim support. |

## Data / Domain Contract

- Receipt status answers whether a piece of evidence passed, failed, blocked, was unknown, or was not applicable.
- Receipt freshness answers whether the evidence can be used now.
- Evidence use answers whether the evidence may support a claim or only orient the next step.
- Runtime cards summarize the current cockpit state and link to receipts.
- Review-state packets own review thread and artifact truth.
- External-state snapshots own live PR, CI, CodeRabbit, CircleCI, and Linear refresh truth with TTL and head SHA.
- Delivery-truth verdicts compose runtime-evidence-contract/v1 and pr-closeout/v1 semantics; they are the only supported basis for closeout language that claims completion, readiness, green checks, tidy root, or Judge/PM audit readiness.

Conformance rules:

- Every persisted packet MUST include schemaVersion, generatedAt or producedAt, producer, and source classification.
- Every claim-support receipt MUST include verifiedAt, status, freshness, evidenceUse, and blockerClass.
- Every PR-head-sensitive receipt MUST include headSha or fail validation with missing_head_sha.
- Every PR-head-sensitive composed verdict MUST include verdictHeadSha and fail with mixed_head_evidence when participating claim-support receipts do not match it.
- Every external-state freshness verdict MUST be recomputed by Harness verifier policy; producer-provided ttlSeconds cannot extend the policy maximum.
- Every artifact-backed receipt MUST include a repo-relative ref, sizeBytes greater than zero, and producer.
- Every packet adapter MUST reject unknown schema versions and preserve raw source refs in a normalized source entry.
- Every runtime-card projection MUST summarize packet state and receipt refs without embedding raw event streams or full review bodies.

## Enforcement Contract

essential_decisions:

- Coding Harness is the verifier cockpit; Codex is an evidence producer.
- runtime-card/v1 is a summary and pointer object, not the evidence warehouse.
- delivery-truth/v1 is the claim-support layer for completion, readiness, root hygiene, merge readiness, and Judge/PM readiness language.
- review-state/v1 and external-state-snapshot/v1 stay separate so local validation, remote checks, review truth, and tracker truth do not collapse.

fillable_gaps:

- SDK-only evidence may omit permission profile, trace id, external state, and artifact receipts; these become unknown fields rather than inferred truth.
- Analytics-derived evidence may fill resolved permission, sandbox, approval, and tool-count fields.
- Harness validators may fill validation, artifact, root hygiene, PR, CI, review, and Linear receipts.

guardrails:

- A receipt with freshness stale, missing, or unknown MUST NOT support a delivery-truth pass unless the claim explicitly allows not_applicable.
- A reviewer artifact receipt MUST verify path, non-zero size, expected producer, expected role, and producedAt.
- An external-state snapshot MUST include generatedAt, ttlSeconds, source, freshness, and headSha where the source is PR-head-sensitive.
- A merge_ready verdict MUST use one verifier-owned verdictHeadSha across local validation, remote checks, review threads, tracker state, PR metadata, and branch/base currency.
- Harness verifier freshness policy MUST cap producer-provided TTL before claim support.
- root_surface_tidy MUST require a root-hygiene-classification evidence receipt.
- merge_ready MUST require separate current pass verdicts for local validation, remote checks, review threads, tracker state, PR metadata, and branch/base currency.
- goal_ready_for_judge_pm MUST NOT pass without a current delivery-truth packet and explicit human-audit requirement state.

refusal_triggers:

- Refuse claim support when a source is stale, missing, unknown, or orientation-only.
- Refuse artifact proof when path, size, producer, or expected role cannot be verified.
- Refuse merge readiness when PR head SHA, required checks, unresolved review threads, or tracker freshness are absent.
- Refuse root tidy claims when no root-hygiene-classification receipt exists.
- Refuse to infer permissions, MCP availability, or live external state from SDK turn events alone.

durable_memory:

- Promote repeated false-success, stale-state, root hygiene, reviewer artifact, and closeout-language failures into Harness schemas, validators, and Project Brain learnings rather than relying on prompt reminders.
- Link future implementation notes to this spec and to the evidence-led audit path.

professional_output:

- Handoff text must cite the runtime card, delivery-truth verdict, and relevant receipts when claiming delivery.
- If evidence is incomplete, handoff text must name the blocker class and next owner rather than using broad readiness language.

## Proof and Runtime Boundary

proof_boundary: This spec proves only the intended contract and inspected source feasibility. It does not prove that Codex currently emits codex-runtime-evidence/v1 or that Coding Harness production closeout paths enforce delivery-truth/v1.

non_proof_sources: Plan text, spec text, chat summaries, mailbox-only reviewer status, stale Linear or PR snapshots, Codex final-response prose, local validation without claim verdicts, and raw telemetry are not completion proof.

runtime_state: Proposed full lifecycle contract; implementation not started.

resumption_key: .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md plus .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus JSC-363 plus current branch and active artifact state at implementation time.

runtime_invocation_receipt: User invoked he-spec, he-plan, and follow-up review loops in the current Codex thread on 2026-05-24; no runtime-card receipt exists yet for implementation.

artifact_chain_key: codex-runtime-evidence-verifier-cockpit-full-lifecycle

persistent_artifacts: The canonical spec, associated full lifecycle plan, steering admission implementation note, and persisted final reviewer artifacts are durable planning evidence. Runtime receipts, verifier outputs, external-state snapshots, and audit packets must be produced by implementation units before closeout claims.

live_state_refresh: Branch, worktree, Linear, PR, CI, review-thread, root-surface, and Codex producer evidence must be refreshed by the lifecycle unit that consumes it for claim support.

session_evidence_status: Session evidence and review mailbox text are advisory unless converted into an admitted evidence receipt or reviewer artifact with path, producer, timestamp, and verification status.

This spec is not proof that Codex currently emits codex-runtime-evidence/v1. It proves that the local Codex source has enough runtime signals to ground the packet shape and that Coding Harness has the right adapter/cockpit anchors.

Proof that the bridge works requires:

- fixture packets based on real SDK and app-server event fields;
- validation failures for missing required receipt fields;
- adapter tests that project Codex evidence into runtime-evidence-bundle/v1;
- runtime-card tests that show Codex summaries without embedding raw evidence;
- delivery-truth tests that reject stale and orientation-only receipts.

## Coding and Testing Lenses

coding_lens:

- In Coding Harness, prefer small schema and adapter modules under src/lib over broad command surfaces.
- Keep runtime-card/v1 advisory and artifact-backed.
- Reuse existing validation helpers before adding another validation framework.
- If adding a public command, keep it narrow and JSON-first.
- In openai/codex, any future app-server protocol change should use v2 app-server conventions, camelCase wire fields, generated TypeScript exports, and schema regeneration.
- Avoid adding runtime evidence logic to codex-core unless Codex maintainers designate it as the proper boundary.

testing_lens:

- Start with fixture validation tests for evidence-receipt/v1 and codex-runtime-evidence/v1.
- Add adapter tests for SDK-only packets, analytics-derived packets, stale external refs, and missing trace IDs.
- Add runtime-card projection tests that prove source counts, blockers, and summaries are stable.
- Add delivery-truth negative tests before positive closeout tests.
- For future Codex app-server changes, run schema generation and protocol tests required by the Codex repo contract.

## Security, Privacy, and Safety

- Do not persist raw prompts, full transcripts, secrets, credentials, or bulky telemetry in tracked Harness artifacts.
- Do not expose writable roots or permission details beyond what is needed for the claim verdict.
- Treat unknown permission, network, MCP, PR, CI, or tracker state as unknown or blocked, never as pass.
- Keep external-state refresh responsible to Harness connectors rather than accepting stale Codex-carried snapshots.
- Keep destructive-action claims behind explicit delivery-truth evidence and human authority where required.
- Redact environment values, token-like strings, absolute user-private paths outside the repository, and raw tool payloads from tracked receipts unless the field is explicitly required for verification.

## Accessibility Requirements

This spec does not define a user-facing visual UI. It still defines operator-facing CLI, JSON, Markdown, and closeout text that must remain accessible:

- Status values MUST use explicit words such as pass, fail, blocked, unknown, stale, missing, and not_applicable; color, icons, or glyphs may supplement but must not carry the only meaning.
- Markdown reports and sidecars MUST use stable headings, concise tables, and plain-language blocker summaries so screen-reader and skim-reading workflows can locate the current verdict.
- JSON verdicts MUST include machine-readable status, blockerClass, and evidenceRef fields so assistive or automation layers do not need to parse prose.
- Future UI rendering of runtime cards or delivery truth MUST include keyboard navigation, visible focus states, non-color severity labels, and readable text alternatives for diagrams.

## Observability Requirements

- Each adapter run SHOULD produce or update a run-record or receipt that names the command or entrypoint, schema version, producer, source refs, generated or verified timestamp, status, and blocker class.
- Validation failures MUST use stable blocker classes, including missing_required_field, missing_head_sha, stale_external_state, unknown_permission_profile, missing_review_artifact, missing_root_hygiene_evidence, and orientation_only_evidence.
- runtime-card/v1 projection SHOULD expose source counts, receipt refs, stale-state summaries, and blocker summaries without embedding raw event streams.
- delivery-truth/v1 SHOULD preserve which claim failed, which receipt or snapshot was missing or stale, which owner can resolve it, and whether the evidence was usable only for orientation.
- Telemetry is advisory until normalized into evidence-receipt/v1; log presence alone MUST NOT support a closeout claim.

## Failure and Recovery

| Failure | Required Classification | Recovery |
| --- | --- | --- |
| SDK packet lacks turnId | blocked_validation | Reject packet or mark run receipt unusable for claim support. |
| SDK packet lacks permission profile | unknown_permission_profile | Admit orientation evidence only unless analytics or Harness wrapper supplies permission truth. |
| External snapshot TTL expired | stale_external_state | Refresh before claim support; allow orientation only. |
| PR head SHA mismatch | stale_head_sha | Refresh PR/check/review state before closeout. |
| Composed verdict mixes receipts from different head SHAs | mixed_head_evidence | Rebuild the verdict from receipts that match the verifier-owned verdictHeadSha. |
| Producer TTL exceeds verifier policy | stale_external_state | Recompute freshness from Harness policy and refresh the source before claim support. |
| Reviewer artifact path missing or empty | missing_review_artifact | Block review_threads_resolved until artifact receipt verifies. |
| Trace ID unavailable | unknown_trace_id | Do not fail the packet; mark trace identity as unknown and keep session/turn identity. |
| Root hygiene report missing | missing_root_hygiene_evidence | Block root_surface_tidy. |

## Rollback / Recovery

- The first implementation slice MUST be additive. Existing runtime-card, runtime-evidence-bundle, runtime-evidence-contract, and pr-closeout callers must continue to validate until an explicit migration slice changes them.
- If Codex packet ingestion breaks runtime-card output, disable the Codex projection path while leaving existing non-Codex runtime evidence producers active.
- If delivery-truth/v1 blocks valid existing pr-closeout flows, fall back to current pr-closeout/v1 behavior and keep delivery-truth advisory until the contradiction is fixed.
- Malformed codex-runtime-evidence/v1 packets MUST be rejected or downgraded to orientation-only evidence without discarding existing Harness evidence for the same run.
- Any Codex upstream protocol, SDK, package, or launcher change requires a separate rollback plan that covers schema regeneration, package compatibility, and app-server client behavior.

## Validation Plan

Current spec validation:

- Command: rg -n "GAP-00|delivery-truth|runtime-card|review-state|external-state|ROOT|claim-vs-evidence" .harness/research/audits/2026-05-24-evidence-led-codebase-gap-audit.md -> pass (confirmed audit gap anchors and roadmap language)
- Command: nl -ba src/lib/runtime/runtime-evidence-bundle.ts | sed -n '1,180p' -> pass (confirmed runtime-evidence-bundle/v1 source kinds and provenance)
- Command: nl -ba src/lib/runtime/runtime-card.ts | sed -n '1,260p' -> pass (confirmed runtime-card/v1 fields and normaliseRuntimeCard)
- Command: nl -ba src/lib/pr-closeout/types.ts | sed -n '1,180p' -> pass (confirmed pr-closeout/v1 claim semantics)
- Command: cd /Users/jamiecraik/dev/codex && nl -ba sdk/typescript/src/thread.ts | sed -n '1,190p' -> pass (confirmed TypeScript SDK thread and turn result surface)
- Command: cd /Users/jamiecraik/dev/codex && nl -ba sdk/typescript/src/events.ts | sed -n '1,240p' -> pass (confirmed JSONL event types)
- Command: cd /Users/jamiecraik/dev/codex && nl -ba sdk/python/src/openai_codex/_run.py | sed -n '1,150p' -> pass (confirmed Python TurnResult collection)
- Command: cd /Users/jamiecraik/dev/codex && nl -ba sdk/python/src/openai_codex/_message_router.py | sed -n '1,240p' -> pass (confirmed turn notification routing)
- Command: cd /Users/jamiecraik/dev/codex && rg -n "permission_profile|approval_policy|sandbox_network_access|mcp_tool_call|SessionSource|PendingTurn|CompletedTurn|effective_permissions|sandbox_policy" codex-rs/analytics/src/reducer.rs -> pass (confirmed analytics reducer runtime fields)
- Command: cd /Users/jamiecraik/dev/codex && rg -n "TurnStarted|TurnCompleted|ThreadTokenUsageUpdated|ItemCompleted|turnId|threadId|trace" codex-rs/app-server-protocol codex-rs/protocol sdk/typescript/src sdk/python/src/openai_codex | head -200 -> pass (confirmed protocol and SDK event surfaces)

Implementation validation for first Coding Harness slice:

~~~bash
pnpm vitest run src/lib/evidence/evidence-receipt.test.ts
pnpm vitest run src/lib/runtime/codex-runtime-evidence.test.ts src/lib/runtime/runtime-evidence-adapter.test.ts
pnpm vitest run src/lib/runtime/runtime-card-validation.test.ts src/commands/runtime-card.test.ts
pnpm vitest run src/lib/delivery-truth/delivery-truth-composition.test.ts
pnpm vitest run src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts
pnpm vitest run src/lib/he-plan/intent-artifact-validation.test.ts
pnpm vitest run src/lib/he-plan/acceptance-coverage-validation.test.ts
pnpm exec tsx src/cli.ts runtime-card --json --repo .
~~~

If the final two `src/lib/he-plan/*` validation modules do not exist at the
start of implementation, PU-000 MUST create equivalent validator, fixture, or
schema-assertion coverage before runtime evidence implementation begins. The
first implementation PR MUST NOT claim SA-017 or SA-018 complete from prose
review alone.

Implementation validation for later production verifier slices:

~~~bash
pnpm vitest run src/lib/delivery-truth/*.test.ts src/lib/pr-closeout/*.test.ts
pnpm vitest run src/lib/review-state/*.test.ts src/lib/external-state/*.test.ts
pnpm vitest run src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts
~~~

Implementation validation for later openai/codex app-server protocol slice:

~~~bash
just write-app-server-schema
cargo test -p codex-app-server-protocol
~~~

## Acceptance Criteria

| ID | Phase | Criterion | Pass / Fail Proof |
| --- | --- | --- | --- |
| SA-001 | Foundation required | evidence-receipt/v1 validates positive and negative fixtures. | Tests pass for required status, freshness, evidenceUse, verifiedAt, producer, and artifact size fields; negative fixtures fail with stable codes. |
| SA-002 | Foundation required | codex-runtime-evidence/v1 validates SDK-only, app-server-shaped, and analytics-derived fixtures. | Tests prove SDK-only packets cannot claim resolved permission or external state without verifier receipts. |
| SA-003 | Foundation required | unsupported source fields become unknown with failureClass instead of inferred values. | Source-classification negative fixture fails any adjacent-field inference. |
| SA-004 | Foundation required | codex-runtime-evidence/v1 maps into runtime-evidence-bundle/v1 with Codex provenance preserved. | Adapter test preserves sourceKind, sourceRef, producer, and raw packet artifact reference. |
| SA-005 | Foundation required | runtime-card/v1 projects compact Codex runtime summaries and receipt refs without embedding raw packet bodies. | Runtime-card validation rejects raw event stream or full review-body embedding. |
| SA-006 | Foundation private fixture; production enforcement later | stale, missing, unknown, or orientation-only evidence cannot pass delivery-truth claims. | delivery-truth negative tests block claim_support from stale, unknown, missing, or orientation-only receipts. |
| SA-007 | Foundation private fixture; production enforcement later | delivery-truth/v1 represents root_surface_tidy, goal_ready_for_judge_pm, and merge_ready as separate claims. | Claim fixtures show separate verdicts and no blended readiness status. |
| SA-008 | Production verifier required after foundation non-blending fixture | review-state/v1 remains distinct from external-state-snapshot/v1 and pr-closeout/v1 can reference either without blending them. | Foundation fixtures prove separate refs; production tests prove full review, validation, tracker, and remote check status remain separate inputs. |
| SA-009 | Codex bridge required after Harness verifier foundation | future Codex-native emission has an approved boundary before code changes. | he-plan or ADR records the selected SDK wrapper, app-server protocol, analytics export, or Harness-owned wrapper boundary. |
| SA-010 | Foundation private fixture; production closeout hook later | closeout text that claims green, tidy, delivered, or ready cites a current delivery-truth verdict or is blocked. | Closeout adapter or hook test downgrades unsupported claims to blocked or orientation. |
| SA-011 | Foundation required | delivery-truth/v1 composes runtime-evidence-contract/v1 and pr-closeout/v1 semantics rather than forking them. | Tests or type-level fixtures reuse status, freshness, evidenceRef, headSha, blockerClass, verifiedAt, and verifier owner semantics. |
| SA-012 | Foundation fixture; production root receipt later | root-hygiene-classification/v1 is tied to docs/architecture/root-surface-classification.md. | Root tidy claim fixture includes the root-surface classification source and fails without it. |
| SA-013 | Foundation and production required | operator-facing outputs remain accessible. | Snapshot or lint-style tests prove textual status labels exist and no verdict relies only on color, icons, or glyphs. |
| SA-014 | Foundation and production required | sensitive values and raw telemetry are not persisted into tracked receipts. | Redaction/security fixture proves prompts, secrets, credentials, and bulky payloads are omitted or blocked. |
| SA-015 | Foundation and production required | merge_ready cannot compose claim-support receipts from different head SHAs. | delivery-truth negative fixture fails with mixed_head_evidence when receipt headSha values do not match verdictHeadSha. |
| SA-016 | Foundation and production required | Harness verifier freshness policy overrides producer-provided TTL for claim support. | freshness-policy fixture fails producer TTL values that exceed the verifier maximum or conflict with fetchedAt/headSha recomputation. |
| SA-017 | PU-000 and every slice required | every implementation slice starts from a reviewed intent artifact. | intent-artifact fixture or he-plan validation fails when objective, owned acceptance IDs, deep module boundary, automation plan, or review status is missing. |
| SA-018 | PU-000 and every slice required | deterministic proof is automated when feasible. | acceptance coverage fixture maps each mechanically checkable SA ID to a validator, test, fixture, command, or schema assertion. |

## Visual References / Diagrams

| View | Meaning |
| --- | --- |
| Codex source | SDK, app-server, protocol, and analytics surfaces that can produce runtime facts. |
| Harness ingestion | codex-runtime-evidence/v1 validation and runtime-evidence-bundle/v1 projection. |
| Cockpit | runtime-card/v1 summary with receipt references and blockers. |
| Verdict | delivery-truth/v1 claim support or refusal. |
| Closeout | PR, goal, ROOT, and Judge/PM readiness language backed by verdicts. |

~~~mermaid
flowchart TD
  A["Codex SDK, app-server, or analytics source"] --> B["codex-runtime-evidence/v1"]
  B --> C["Coding Harness validator"]
  C --> D["evidence-receipt/v1"]
  C --> E["runtime-evidence-bundle/v1"]
  E --> F["runtime-card/v1 cockpit summary"]
  D --> G["delivery-truth/v1 claim verdicts"]
  F --> G
  H["review-state/v1"] --> G
  I["external-state-snapshot/v1"] --> G
  G --> J["closeout, PR, goal, and Judge/PM audit readiness"]
~~~

## Implementation Notes

The first patch should stay entirely inside Coding Harness. It should not wait for openai/codex to emit native packets. Use checked-in fixtures that mirror the observed Codex event fields and source classifications. This first patch is the foundation stage; later associated-plan units must promote the same semantics into production review-state, external-state, delivery-truth, closeout, Codex producer, and audit-readiness paths before full lifecycle completion may be claimed.

Recommended file shape:

- src/lib/evidence/evidence-receipt.ts
- src/lib/evidence/evidence-receipt.test.ts
- src/lib/runtime/codex-runtime-evidence.ts
- src/lib/runtime/codex-runtime-evidence-adapter.ts
- src/lib/runtime/codex-runtime-evidence.test.ts
- focused updates to src/lib/runtime/runtime-evidence-bundle.ts
- focused updates to src/lib/runtime/runtime-card.ts and validation tests for the required foundation runtime-card projection

The associated full lifecycle plan is the execution authority for sequencing: PU-000 controls reviewed intent and acceptance automation; PU-001 through PU-008 build the Harness-only foundation; PU-009 through PU-011 wire production review-state, external-state, delivery-truth, root hygiene, and closeout semantics; PU-012 through PU-013 add the approved Codex producer bridge; PU-014 through PU-016 handle PR/CI/Linear closeout, Judge/PM audit readiness, and hardening. A slice may complete its stage, but it must not rename that stage as the full implementation.

## Open Questions

- Resolved for first slice: the first implementation producer is a Harness-owned adapter using Codex-shaped fixtures, not a Codex upstream packet emitter.
- Later decision required: should the first native Codex producer live in the TypeScript SDK, Python SDK, app-server v2 protocol, analytics export, or a thin Harness-owned wrapper?
- Tracker decision required: should JSC-363 expand to own the full lifecycle, or should PU-009 through PU-016 become linked child issues before production stages begin?
- Should trace identity use JSON-RPC W3C trace context when present, or should Harness require its own traceId receipt field independent of Codex transport?
- Resolved for first slice: delivery-truth exposure remains private or advisory until the he-plan selects runtime-card, harness next --json, pr-closeout, or a shared private adapter as the first command surface.
- Resolved for this spec: root-hygiene-classification/v1 is the executable receipt projection of docs/architecture/root-surface-classification.md. Implementation order remains open and should be selected in he-plan.

## Decision

Adopt the combined architecture:

- many input packets;
- one shared receipt primitive;
- one runtime-card cockpit object;
- one delivery-truth verdict layer that composes runtime-evidence-contract/v1 and pr-closeout/v1 semantics;
- separate review-state and external-state packets;
- narrow harness next --json output that references verdict summaries.

Do not create separate public truth commands for every domain until the shared packet and receipt contracts prove insufficient.

## Evidence and References

- .harness/research/audits/2026-05-24-evidence-led-codebase-gap-audit.md
- .harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md is adopted as the SPG-001 through SPG-012 source for final Judge/PM audit reconciliation; the spec must keep this marker so the focused SPG adoption validator can detect plan/spec drift.
- docs/architecture/root-surface-classification.md
- src/lib/runtime/runtime-evidence-bundle.ts
- src/lib/runtime/runtime-evidence-contract.ts
- src/lib/runtime/runtime-card.ts
- src/lib/pr-closeout/types.ts
- /Users/jamiecraik/dev/codex/sdk/typescript/src/thread.ts
- /Users/jamiecraik/dev/codex/sdk/typescript/src/events.ts
- /Users/jamiecraik/dev/codex/sdk/python/src/openai_codex/_run.py
- /Users/jamiecraik/dev/codex/sdk/python/src/openai_codex/_message_router.py
- /Users/jamiecraik/dev/codex/codex-rs/app-server-protocol/src/protocol/common.rs
- /Users/jamiecraik/dev/codex/codex-rs/app-server-protocol/src/jsonrpc_lite.rs
- /Users/jamiecraik/dev/codex/codex-rs/analytics/src/reducer.rs
- /Users/jamiecraik/dev/codex/sdk/python/pyproject.toml
- /Users/jamiecraik/dev/codex/sdk/typescript/package.json

## No-Fog Gate

- The spec names actual Codex files and the exact evidence fields they can or cannot supply.
- The spec separates orientation from claim support.
- The spec keeps runtime-card as a summary and pointer object.
- The spec keeps Coding Harness as verifier, not Codex final-message prose.
- The spec gives a smallest first patch that can be validated without mutating openai/codex.

## Linear Work Item Contract

Linear issue JSC-363 exists for the initial implementation lane under parent JSC-328. Before full lifecycle delivery is claimed, PU-000 must decide whether JSC-363 expands to own PU-000 through PU-016 or whether production stages become linked child issues. Keep the JSC-331 Judge/PM audit gate open until human audit or an explicit authorized blocked status.

## Linear Acceptance Traceability

| Acceptance ID | Linear-ready Criterion | Proof |
| --- | --- | --- |
| SA-001 | Shared receipt schema exists and validates fixtures | evidence-receipt tests pass |
| SA-002 | Codex runtime evidence schema exists and validates fixtures | codex-runtime-evidence tests pass |
| SA-003 | Unsupported fields become unknown, not inferred | negative source-classification fixture passes |
| SA-004 | Adapter preserves Codex provenance | runtime-evidence-adapter test passes |
| SA-005 | Runtime card summary projection exists | runtime-card validation and command tests pass |
| SA-006 | Orientation evidence cannot support closeout claims | delivery-truth negative tests pass |
| SA-007 | Non-PR claims are represented | delivery-truth claim fixture passes |
| SA-008 | Review and external state remain separate | Foundation non-blending fixture passes; production review-state and external-state tests pass before full SA-008 completion |
| SA-009 | Codex-native producer boundary is selected before upstream patch | he-plan records chosen boundary |
| SA-010 | Closeout claims cite verdicts or block | closeout hook or adapter test passes |
| SA-011 | Delivery truth composes existing runtime and PR claim semantics | delivery-truth fixture reuses runtime-evidence-contract and pr-closeout fields |
| SA-012 | Root hygiene receipt projects the canonical root-surface classification | root tidy fixture cites docs/architecture/root-surface-classification.md |
| SA-013 | Operator-facing outputs remain accessible | status labels and blocker refs are textual and machine-readable |
| SA-014 | Sensitive values and raw telemetry are not persisted | redaction fixture blocks secrets, prompts, credentials, and bulky payloads |
| SA-015 | Merge readiness uses one head-SHA anchor | mixed-head receipt fixture fails with mixed_head_evidence |
| SA-016 | Verifier freshness policy controls claim support | producer TTL fixture fails when it exceeds verifier policy |
| SA-017 | Implementation intent is reviewed before code | intent artifact validator fails missing reviewStatus or ownedAcceptanceIds |
| SA-018 | Feasible deterministic proof is automated | acceptance coverage validator maps SA IDs to tests, fixtures, commands, or schema assertions |

## Appendix A. Harness Metadata / Traceability

schema_version: 1
interactive_status: complete
selection_evidence: User invoked he-spec and requested the combined audit plus Codex runtime evidence mapping be checked against the actual ~/dev/codex source.
route: he-spec
stage: spec
scope: cross-repo behavior contract, full lifecycle implementation plan, Coding Harness first implementation slice, openai/codex inspect-only mapping
traceability: source-inspection-backed
validation: artifact shape checks required after write
safe_to_continue: true
blocked_reason: null
linear_mutation_status: approved_small_set_created
linear_action_required: true
linear_action_required_reason: Update or split JSC-363 before claiming full lifecycle delivery.
spec_path: .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md
acceptance_ids: SA-001, SA-002, SA-003, SA-004, SA-005, SA-006, SA-007, SA-008, SA-009, SA-010, SA-011, SA-012, SA-013, SA-014, SA-015, SA-016, SA-017, SA-018
authority_scope_boundary: Do not mutate openai/codex in the first slice; Coding Harness may add schema, adapter, fixture, and projection code after he-plan.
proof_runtime_boundary: Source inspection proves field availability, not live packet emission.
coding_lens: Build schemas and adapters in Coding Harness first; Codex upstream changes require app-server or SDK boundary selection.
testing_lens: Fixture-first validation, adapter projection tests, stale/unknown negative tests, mixed-head delivery-truth tests, freshness-policy tests, intent-artifact validation, acceptance automation coverage, accessibility status tests, redaction tests, protocol schema tests only for later Codex changes.
git_staging_status: not_staged
staged_paths: []
handoff: Route this spec through the full lifecycle he-plan; start with PU-000 and the Harness-only foundation.
confidence: high_plan_confidence
confidence_basis: Source inspection, prior spec validation, full lifecycle plan validation, and final review-swarm findings support the plan/spec contract. Implementation confidence remains capped until runtime code paths and production closeout gates exist.
confidence_ceiling: 0.94 until implementation tests, production verifier integration, Codex producer evidence, external refresh proof, and Judge/PM audit evidence exist.

## Appendix B. Review Outcomes

A project-local harness-doc-history-reviewer reviewed this spec pass. A later three-agent swarm using planning-specialist-agent, agent-native-reviewer, and adversarial-reviewer reviewed the updated spec. The reviews found that delivery-truth/v1 needed to compose existing runtime-evidence-contract/v1 and pr-closeout/v1 semantics, root-hygiene-classification/v1 needed an explicit bridge to docs/architecture/root-surface-classification.md, acceptance criteria needed phase labels, closeout enforcement needed MUST-level language, Codex source validation commands needed explicit workdirs, merge_ready needed one verdictHeadSha anchor, and freshness needed verifier-owned TTL policy. This revision folds those findings into the ownership, requirements, interfaces, validation, decision, acceptance, and evidence sections. A later implementation PR should use project-local Harness reviewer roles for product code, dev tools, and review-response coverage where applicable.

## Appendix C. he-plan Handoff

Recommended first plan unit: PU-000 intent and acceptance-coverage guard, followed by the Harness-only foundation lane.

1. Add evidence-receipt/v1 schema and validation tests.
2. Add codex-runtime-evidence/v1 schema and source-classification tests.
3. Add adapter into runtime-evidence-bundle/v1.
4. Add fixture proof from TypeScript SDK, Python SDK, app-server protocol, and analytics-derived packet shapes.
5. Add compatibility tests showing delivery-truth reuses runtime-evidence-contract/v1 and pr-closeout/v1 semantics.
6. Add root hygiene tests that tie root_surface_tidy to docs/architecture/root-surface-classification.md through an evidence receipt.
7. Add delivery-truth tests for mixed-head merge_ready refusal and verifier-owned freshness-policy refusal.
8. Add intent-artifact validation that blocks implementation slices without objective, owned acceptance IDs, deep module boundary, automation plan, and review status.
9. Add acceptance automation coverage proving each mechanically checkable SA ID maps to a validator, fixture, command, test, or schema assertion, including a consistency check that Implementation Notes and Linear Acceptance Traceability preserve the same phase semantics as the Acceptance Criteria table.
10. Add negative tests for missing turnId, unknown permission profile, unavailable traceId, stale external state, orientation-only evidence, non-text-only status output, and sensitive-value persistence.
11. Run focused vitest commands and artifact shape checks before PR handoff.
12. Continue through PU-009 through PU-016 before claiming full lifecycle implementation, closeout readiness, or Judge/PM audit readiness.
