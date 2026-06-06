---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: advisory-stale-document-archive-candidate-reporting-spec
artifact_type: sy-spec
canonical_slug: advisory-stale-document-archive-candidate-reporting
title: Advisory Stale-Document Archive Candidate Reporting Spec
harness_stage: sy-spec
status: proposed
date: 2026-06-05
origin: user-requested sy-spec for JSC-395 from the documentation architecture comparison plan
source_type: spec
authority: execution-input
lifecycle_status: execution-input
canonical_destination: src/lib/docs-surface
owner: coding-harness-maintainers
created: 2026-06-05
last_reviewed: 2026-06-05
review_cadence: event-driven
validated_by:
  - pnpm docs:lint
  - pnpm docs:lifecycle
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
  - .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
  - .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md
  - .harness/specs/2026-06-04-reader-task-documentation-eval-spec.md
linear_issue: JSC-395
linear_issue_url: https://linear.app/jscraik/issue/JSC-395/coding-harness-add-advisory-stale-document-archive-candidate-reporting
linear_parent: JSC-392
linear_project: Harness control-loop hardening
linear_status_source: .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
linear_mutation_status: not_needed
linear_action_required: false
safe_to_continue: true
blocked_reason: null
traceability_required: true
risk: documentation-authority-and-evidence-retention
depth: bounded-advisory-report-contract
ui: false
lifecycle_scope: spec_for_next_execution_slice
planning_only_delivery_allowed: true
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
---

# Advisory Stale-Document Archive Candidate Reporting Spec

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
- [Scanner Boundary Contract](#scanner-boundary-contract)
- [Route Freshness Contract](#route-freshness-contract)
- [Candidate Signal Contract](#candidate-signal-contract)
- [Enforcement Contract](#enforcement-contract)
- [Docs-Gate Advisory Projection Contract](#docs-gate-advisory-projection-contract)
- [Proof and Runtime Boundary](#proof-and-runtime-boundary)
- [Coding and Testing Lenses](#coding-and-testing-lenses)
- [Security, Privacy, and Safety](#security-privacy-and-safety)
- [Failure and Recovery](#failure-and-recovery)
- [Validation Plan](#validation-plan)
- [Acceptance Criteria](#acceptance-criteria)
- [Decision](#decision)
- [Evidence and References](#evidence-and-references)
- [Appendix A. Harness Metadata / Traceability](#appendix-a-harness-metadata--traceability)
- [Appendix B. Review Outcomes](#appendix-b-review-outcomes)
- [Appendix C. sy-plan Handoff](#appendix-c-sy-plan-handoff)

## Command Summary

BLUF: This spec defines the JSC-395 advisory stale-document archive candidate report for Coding Harness. It matters because the repository now has enough docs, research, specs, plans, implementation notes, generated context, and historical evidence that agents need a mechanical way to find possible cleanup candidates without treating cleanup as authority to delete, move, or demote evidence. The decision is to build a read-only docs-surface report that emits candidate reasons, confidence, and blocking protections, then project it into docs-gate as advisory-only evidence until humans approve an archive decision workflow. The main risk is losing useful research or historical proof by confusing stale doctrine with disposable evidence, so this spec forbids automatic deletion and requires active/canonical protections. The next action is to route this spec through sy-plan or the local Harness planning flow before implementing the candidate scanner, fixtures, package script, and advisory docs-gate projection.

Decision Needed: approve this spec as the behavior contract for JSC-395 before implementing advisory archive-candidate reporting.

Top Risks:

- Stale-document reporting could be mistaken for permission to delete files.
- Research that is old but still valuable could be flagged without enough context.
- Generated or runtime artifacts could be classified as source truth.
- Docs-gate could become noisy if advisory findings are not separate from required lifecycle errors.

Next Action: create the JSC-395 plan with bounded implementation units for the candidate contract, scanner, tests, docs, and advisory docs-gate projection.

## Purpose

Define a deterministic, read-only report that helps maintainers and agents see which documentation-adjacent files may need archive review. The report must surface evidence, not perform cleanup.

The report answers four questions:

- Which tracked docs or .harness artifacts look stale, superseded, orphaned, or disconnected from current route truth?
- Why is each candidate being reported?
- Which protections prevent the file from being considered safe to archive?
- What human-reviewed decision or follow-up would be required before any move, archive, deletion, or demotion?

The first implementation must be advisory and reversible.

## Problem Statement

Coding Harness already has lifecycle metadata for governed docs and a reader-task eval lane for route-truth behavior. Those gates reduce the chance that an agent treats raw research or old notes as current doctrine. They do not yet provide a maintained list of candidate documents that may be stale, superseded, orphaned, or ready for archive review.

The documentation architecture plan names this as PU-005 and maps JSC-395 to VAC-007: archive candidate reporting is advisory and never deletes or moves files automatically. Without this report, cleanup work is either manual and error-prone or too risky to start, because historical evidence, research, and generated projections can look similar during a quick review.

JSC-395 closes that gap by specifying a report that separates candidate signals from archive authority.

## User / Operator Scenarios

| Scenario | Reader Need | Required Behavior |
| --- | --- | --- |
| Agent finds an old research audit | Know whether it is stale doctrine or retained evidence | Report may flag weak current-route links, but must preserve research value and require a reviewed archive decision. |
| Maintainer sees a superseded spec | Know which newer artifact replaced it | Report must include supersession or dependency evidence when available. |
| Docs-gate reports documentation noise | Distinguish blocking lifecycle errors from advisory cleanup | Required errors and advisory archive candidates must be separate in JSON and text output. |
| Generated architecture context looks stale | Avoid editing generated output as source truth | Report must prefer source document or regeneration path and must not classify generated projections as canonical docs. |
| A root or agent-facing doc has no inbound links | Avoid false positives on canonical entry points | Canonical, manifest-listed, or explicitly active docs must not be flagged by simple link count alone. |
| A file is untracked runtime output | Avoid making local artifacts part of source cleanup | Report must ignore untracked runtime output unless a future source manifest intentionally admits it. |

## Goals

- Add a deterministic advisory report for stale-document and archive-candidate review.
- Use the JSC-393 lifecycle metadata model and current docs manifests as input evidence.
- Detect candidate signals such as no inbound links, no manifest entry, no active-artifact reference, no admitted evidence-pattern reference, and superseded or archived lifecycle status.
- Emit machine-readable JSON with candidate reasons, confidence, source evidence, protections, closed-enum suggested actions, and reviewed-decision requirements.
- Add tests proving active, canonical, manifest-listed, and recently promoted docs are not flagged by age or low link count alone.
- Keep archive decisions separate from advisory reporting.
- Keep docs-gate integration advisory-only unless a later approved plan promotes a specific class to a required gate.

## Non-Goals

- Do not delete files.
- Do not move files into archive directories.
- Do not rewrite all historical metadata.
- Do not mark raw research as valueless merely because it is old.
- Do not classify untracked runtime output as source truth.
- Do not make docs-gate fail on archive candidates in the first slice.
- Do not mutate Linear, GitHub, CI, branch protection, release settings, or downstream repositories.
- Do not compress README.md, AGENTS.md, docs indexes, or progressive-disclosure docs in JSC-395; that belongs to JSC-397.
- Do not change SemVer or downstream distribution policy; that belongs to JSC-396.

## Current State / Evidence

Verified current surfaces:

- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md maps PU-005 to stale-document archive candidate reporting.
- .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md maps JSC-395 to PU-005 and VAC-007.
- The same Linear plan records JSC-395 as the next medium-priority issue after JSC-393 and JSC-394.
- .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md defines lifecycle metadata and touched/promoted artifact enforcement.
- .harness/specs/2026-06-04-reader-task-documentation-eval-spec.md defines reader-task route-truth fixtures that should protect progressive-disclosure changes before JSC-397.
- src/lib/docs-surface already contains doc-lifecycle modules, docs-task-eval modules, and frontmatter metadata gate tests.
- scripts/check-doc-lifecycle.ts and scripts/check-docs-task-eval.ts are the current docs-surface script entry points.

Known evidence debt:

- No archive-candidate scanner exists.
- No docs:archive-candidates package script exists.
- No archive-candidate JSON schema, fixture, or docs-gate advisory projection exists.
- .harness/active-artifacts.md may still point at older active-route context and must not be treated as live external truth without a separate refresh.
- Live Linear state for JSC-395 was not refreshed in this spec run; this spec relies on the tracked Linear plan artifact.

## Authority and Scope Boundary

requested_depth: bounded_spec

approved_execution_boundary: The user requested sy-spec to create the JSC-395 spec for advisory stale-document archive candidate reporting.

downscope_authority: Keep JSC-395 limited to advisory reporting, docs-surface contract, tests, and documentation of archive criteria. Move SemVer, distribution impact, progressive disclosure cleanup, and actual archive decisions to their existing child issues or later reviewed decisions.

external_mutation_boundary: Do not mutate Linear, GitHub, CI, release settings, branch protection, downstream repositories, or filesystem archive locations from this spec.

proof_boundary: This spec can prove local artifact intent only. It cannot prove CI, review-thread state, Linear status, PR mergeability, release readiness, archive safety, or deletion authority.

non_proof_sources: chat_summary, stale_session, unvalidated_research, generated_projection, local_runtime_output

freshness_required: validation_time for repo files; current-turn external refresh if later reporting live Linear or PR state.

human_acceptance_boundary: Human acceptance is required before any candidate is moved, archived, deleted, demoted, or used to justify docs compression.

## Proposed Behavior

Add an advisory archive-candidate report under the docs-surface boundary. The report reads tracked repository files and known documentation lifecycle manifests, computes candidate signals, applies protections, and emits JSON plus human-readable output.

The first implementation should expose local commands similar to:

~~~bash
pnpm docs:archive-candidates
pnpm --silent docs:archive-candidates -- --json
~~~

The exact package script name may change during planning if it better matches existing command families, but the behavior must remain read-only and advisory.

 The report must classify findings as:

- candidate: file should be reviewed for retention, supersession, admission, or a separate archive decision.
- repairFinding: file or route evidence needs metadata, manifest, source-link, lifecycle, or index repair, but the observed file is not itself an archive candidate.
- protected: file matched one or more weak signals but is protected by canon, active route, manifest, package distribution, current execution status, research value, or historical evidence.
- ignored: file is outside source-report scope, usually generated output, untracked runtime output, dependency output, or explicitly excluded path.

The report must not classify any file as safe to delete.

## Requirements

Functional requirements:

- FR-001: The scanner must operate on git-tracked source files only unless a future approved manifest admits another source class.
- FR-002: The scanner must read docs lifecycle metadata and .harness lifecycle metadata when present.
- FR-003: The scanner must compute inbound references from the bounded reference corpus defined in this spec using repo-relative paths.
- FR-004: The scanner must read docs/doc-lifecycle-manifest.json and active .harness execution-input artifacts as protection evidence, but active-artifacts absence cannot increase candidate confidence unless the active route is freshness-verified.
- FR-005: The scanner must identify lifecycle fields by surface type and must not invent lifecycle states outside the current docs or .harness metadata contracts.
- FR-006: The scanner must emit every candidate with at least one reason, one confidence value, one closed-enum suggested action, advisory-only authority, and evidence refs.
- FR-007: The scanner must emit protections that explain why a file is not an archive candidate despite weak signals.
- FR-008: JSON output must be stable enough for docs-gate advisory projection.
- FR-009: Text output must clearly say the report is advisory and performs no deletion or moves.
- FR-010: Docs-gate integration in JSC-395 must add advisory findings only and must not change required docs-gate pass/fail semantics.
- FR-011: The scanner must split archive candidates from governance repair findings so missing metadata, missing manifest entries, generated source-link gaps, and archive-index gaps do not become archive pressure against protected files.

Non-functional requirements:

- NFR-001: The scanner must be deterministic for a given repository tree.
- NFR-002: The scanner must not depend on network access.
- NFR-003: The scanner must not inspect secrets, local databases, dependency folders, or runtime output directories.
- NFR-004: The scanner must not follow symlinks outside the repo root.
- NFR-005: The scanner must avoid path traversal and report only repo-relative paths.
- NFR-006: The scanner must be small enough to test with focused fixtures.

## Interfaces

Candidate implementation surfaces:

- src/lib/docs-surface/archive-candidates.ts
- src/lib/docs-surface/archive-candidates-contract.ts
- src/lib/docs-surface/archive-candidates-validation.ts
- src/lib/docs-surface/archive-candidates.test.ts
- scripts/check-docs-archive-candidates.ts
- package.json script: docs:archive-candidates

Optional integration surfaces:

- docs-gate advisory projection in src/commands/docs-gate-core.ts, src/commands/docs-gate.test.ts, src/lib/cli/registry/docs-gate-command-spec.ts, and src/lib/output/normalise-docs-gate.ts when those surfaces are the selected integration points after implementation inspection.
- docs explaining archive candidate criteria, likely under docs/architecture or docs/agents/05-contradictions-and-cleanup.md if planning chooses that route.

Out-of-scope surfaces:

- src/templates/**
- .github/PULL_REQUEST_TEMPLATE.md
- release configuration
- external tracker mutation code
- runtime-card, delivery-truth, or review-state claim support

## Data / Domain Contract

The JSON report should use a versioned contract named docs-archive-candidates-report/v1.

Required top-level fields:

- schema: docs-archive-candidates-report/v1
- advisoryStatus: pass, warn, or fail
- generatedAt
- repoRef
- headSha when available
- advisoryOnly: true
- actionAuthority: advisory_only
- mutationSupported: false
- scannedFiles
- candidates
- repairFindings
- protectedFiles
- ignoredFiles
- summary

Top-level field contract:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| schema | string | yes | Must equal docs-archive-candidates-report/v1. |
| advisoryStatus | pass, warn, fail | yes | pass means no candidates or repair findings; warn means advisory candidates or repair findings exist; fail means scanner contract/runtime failure. |
| generatedAt | string | yes | ISO timestamp. Tests may normalize it; deterministic snapshots must allow timestamp injection. |
| repoRef | string | yes | Must be repo-relative or redacted. Use "." for local runs unless a future approved contract defines a stable repo id. |
| headSha | string or null | yes | Current git HEAD when available; null only when git metadata is unavailable and the report fails. |
| advisoryOnly | boolean | yes | Must be true. |
| actionAuthority | string | yes | Must equal advisory_only. The report is not mutation authority. |
| mutationSupported | boolean | yes | Must equal false. Any mutation requires a separate reviewed decision outside this report. |
| scannedFiles | object | yes | Include counts by scanned, skipped, ignored, protected, candidate, and repairFinding. |
| candidates | array | yes | Archive-candidate entries only. Must never contain generated outputs or canon/execution-input files protected by authority alone. |
| repairFindings | array | yes | Metadata, manifest, active-route, generated-source-link, archive-index, or governance repair findings that are not archive candidates. |
| protectedFiles | array | yes | Files with weak signals suppressed by protection evidence. |
| ignoredFiles | array | yes | Files outside source-report scope. |
| summary | object | yes | Include counts by reason code, protection code, action, and confidence. |

Candidate entries must include:

- path
- kind
- lifecycleStatus when known
- authority when known
- confidence: low, medium, or high
- reasons
- protections
- suggestedAction
- actionAuthority: advisory_only
- requiresReviewedDecision
- evidenceRefs

Repair finding entries must include:

- path
- findingKind
- reasons
- suggestedAction
- actionAuthority: advisory_only
- requiresReviewedDecision when the action family touches archive indexes, manifests, lifecycle metadata, generated source links, active artifacts, or distribution surfaces
- evidenceRefs

Suggested action codes:

- review_for_retention
- repair_manifest_registration
- repair_lifecycle_metadata
- refresh_active_artifact_route
- add_supersession_pointer
- add_research_admission_pointer
- repair_archive_index_reference
- repair_generated_source_link
- regenerate_from_source
- create_separate_archive_decision

The scanner must reject destructive-looking free-form action text in JSON contract tests. Actions that imply archive, move, delete, demotion, manifest rewrite, metadata rewrite, source-link update, active-artifact update, or archive-index repair must remain advisory and must set requiresReviewedDecision to true unless they are emitted as non-mutating operator guidance in text output.

Reason codes:

- no_inbound_references
- not_in_lifecycle_manifest
- not_active_artifact
- not_referenced_by_current_plan_or_spec
- superseded_status
- raw_research_without_admission
- generated_projection_without_source_ref
- stale_review_date
- missing_lifecycle_metadata
- active_reference_stale_or_unverified
- metadata_repair_needed
- protection_repair_needed

Protection codes:

- canon_or_canonical
- execution_input
- active_artifact_reference
- manifest_listed
- package_distribution_surface
- root_entrypoint
- agent_instruction_surface
- current_plan_or_spec_dependency
- research_value_retained
- generated_output_do_not_edit
- historical_evidence_retained

Absolute local paths are forbidden in all report fields. Paths, evidence refs, parser diagnostics, and summaries must be repo-relative, redacted, or structured without local machine prefixes.

## Scanner Boundary Contract

The scanner input universe is deliberately small:

| Input Class | Included | Rule |
| --- | --- | --- |
| Git-tracked Markdown | yes | Source via git ls-files or an equivalent repository-index API. |
| Git-tracked JSON/YAML/TOML/package config | yes | Include only when used for manifests, package scripts, lifecycle metadata, or route references. |
| Git-tracked TypeScript/source files | reference corpus only | May count repo-relative literal references; must not parse code semantics as archive authority. |
| Untracked files | no | Ignore unless a future approved source manifest admits them. |
| Dependency folders | no | Exclude node_modules, package-manager stores, vendored caches, and build outputs. |
| Runtime/local output | no | Exclude local databases, telemetry dumps, raw transcripts, caches, and run output. |
| Generated projections | repair findings only | Do not place generated files in candidates. Emit source-link or regeneration repair findings when needed. |
| Symlinks | bounded | Do not follow symlinks outside the repo root; unsafe symlinks fail closed or are ignored with evidence. |
| Binary/deleted files | no | Ignore binary files and deleted git-index paths. |

Inbound-reference corpus:

- Markdown links and image links with repo-relative targets count as references.
- Frontmatter depends_on, canonical_destination, supersedes, superseded_by, source_ref, and validated_by path entries count as structured references when they resolve inside the repo.
- Lifecycle manifest dependencies and package scripts count as structured references.
- Active artifact entries count only under the route freshness rules below.
- Code-fenced examples do not count as inbound references unless they are also listed in a structured manifest or package script.
- Plain prose file-name mentions are low-confidence evidence only and must not be the sole reason for protection or candidate status.

The implementation must expose scanner-boundary fixtures for tracked/untracked files, excluded runtime output, generated projections, symlink escape attempts, Markdown links with anchors, frontmatter dependencies, package script references, and code-fenced examples.

## Route Freshness Contract

.harness/active-artifacts.md and admitted execution-input artifacts are protection evidence, not live external truth.

Active route rules:

- A matching active-artifact reference may protect a file only when the referenced path exists, the active-artifact entry is parseable, and the entry is tied to the current Linear/spec/plan route.
- Missing active-artifact references must not increase candidate confidence unless active route freshness is verified for the current work item.
- The report must emit active_reference_stale_or_unverified as a repair finding when the active-artifacts index is stale, missing freshness evidence, points at missing files, conflicts with supersession metadata, or cannot be tied to the current Linear/spec/plan route.
- Stale, missing, unparseable, route-mismatched, or unverified active-artifacts state is never protection evidence. It must not protect a file, suppress an archive candidate, or increase candidate confidence.
- active_artifact_reference protection must include evidenceRefs for the active index path and the referenced artifact path.
- Dependency traversal must be bounded to direct dependencies plus one transitive level unless a later implementation plan proves cycle protection and performance.
- If an execution-input file is not listed in active-artifacts, classify the gap as protection_repair_needed or metadata_repair_needed, not as an archive candidate.

The admitted route graph for JSC-395 includes direct depends_on metadata, lifecycle manifest dependencies, active artifact entries that pass the freshness checks above, supersession links, canonical destinations, package/docs indexes, and the current plan/spec pair named in the execution slice. It does not include stale chat summaries or unvalidated generated projections.

## Candidate Signal Contract

Candidate signals are evidence, not verdicts.

| Signal | Candidate Effect | Required Protection Check |
| --- | --- | --- |
| No inbound references | Increase confidence only when no active/canonical protection exists | Root entrypoints, manifests, active artifacts, package scripts, and generated references |
| Missing manifest entry | Repair finding for canon, canonical, root, agent instruction, package distribution, or execution-input files; possible candidate only for non-protected supporting docs | Supporting docs may remain unlisted when linked from canon |
| Not active artifact | Repair finding only unless active route freshness is verified and the file claims current route-driving status | Historical plans and research may be retained as evidence |
| Superseded lifecycle status | Candidate for archive review or index update | Must name replacement when available |
| Archived lifecycle status without index | Repair finding for archive-index review | Must not move file or update index automatically |
| Raw research without admission | Repair finding for admission or historical retention review; candidate only when no retained-research evidence exists | Research value can override cleanup |
| Generated projection without source ref | Repair finding for regeneration or source-link repair | Must not place generated output in candidates or edit generated projection as source truth |
| Stale review date | Low-confidence signal unless paired with other evidence | Review cadence and ownership fields |
| Missing lifecycle metadata | Candidate only when file is in enforcement scope | Legacy files remain advisory unless touched, promoted, or manifest-listed |

Age alone must never produce a high-confidence archive candidate.

Lifecycle metadata mapping:

| Surface | Metadata Field | Allowed Values Used By This Spec | Archive Report Behavior |
| --- | --- | --- | --- |
| Governed docs | lifecycle_state | active, deprecated, archived | active protects when paired with canon/manifest/current references; deprecated may produce low/medium candidate or repair finding; archived without index produces repair finding. |
| Governed docs | authority/canon_class | canon, canonical, supporting, generated, historical | canon/canonical protects; generated routes to repairFindings/ignoredFiles; historical protects retained evidence unless supersession or missing-index repair applies. |
| .harness artifacts | lifecycle_status | raw, reviewed, distilled, promoted, execution-input, archived | execution-input protects; raw without admission is repair finding; promoted protects when linked from current route; archived without index is repair finding. |
| .harness specs/plans | status | proposed, accepted, superseded, archived | proposed/accepted protect when current route evidence exists; superseded may produce candidate with replacement ref; archived requires index evidence. |

Values not listed here, including draft and historical as lifecycle statuses, must not be invented by the scanner. If an unknown value is encountered, emit metadata_repair_needed with low confidence or fail only when the value violates an existing lifecycle schema.

## Enforcement Contract

JSC-395 starts advisory:

- The report exits 0 when the scanner succeeds, including when advisory candidates or repair findings exist.
- The report must return fail only for scanner/runtime contract errors such as invalid options, unreadable required manifests, unsafe paths, invalid JSON, or internal consistency failures.
- Candidate findings must not block docs-gate unless a later approved change promotes a specific class to required.
- Docs-gate advisory projection must preserve machine-readable reason codes and evidence refs.
- Destructive options such as --archive, --delete, --move, --demote, --rewrite-metadata, --update-manifest, --update-active-artifacts, --repair-index, --apply, --fix, --write, --rm, likely short aliases such as -a, -d, -m, -w, -f, -r, parser-supported short aliases, or equivalent mutation-shaped aliases must fail closed with usage exit code 2 and machine-readable error destructive_option_unsupported.
- The implementation must keep a closed destructive-option matrix near the CLI parser or parser metadata. Tests must enumerate every destructive long option, every supported short alias, and every mutation-shaped equivalent admitted by parser metadata.

The report must never:

- delete files;
- move files;
- rewrite lifecycle metadata;
- update manifests;
- mutate active-artifacts;
- create, update, repair, or regenerate archive indexes;
- mutate Linear, GitHub, PRs, CI, release state, or downstream repositories;
- claim archive safety.

## Docs-Gate Advisory Projection Contract

JSC-395 includes advisory docs-gate projection. Docs-gate is an aggregation consumer only.

Projection requirements:

- Use a distinct advisory rule id, for example docs_archive_candidates_advisory.
- Use advisory severity for candidate and repair findings.
- Preserve schema, reason codes, protection codes, suggestedAction, evidenceRefs, and advisoryOnly.
- Required docs-gate mode must keep overall required status passing when the only findings are archive candidates or repair findings.
- Scanner runtime failures may surface as docs-gate failures only when the docs-gate command directly invokes the scanner and the scanner exits with a runtime/contract error.
- Summary counts must separate lifecycle errors, task-eval errors, archive candidates, repair findings, protected files, and ignored files.
- Projection enablement must be explicit in implementation: always advisory with tests proving non-blocking behavior, or behind a documented internal flag until noise is measured.
- Text and docs-gate projection must include a noise budget: summary counts first, bounded displayed findings, protected/ignored details suppressed by default, and full evidence available through --json or an artifact pointer.
- A noisy-repository fixture must prove advisory archive candidates and repair findings do not swamp required docs-gate findings or change required-mode status. It must assert separate counts for lifecycle errors, task-eval errors, archive candidates, repair findings, protected files, and ignored files.
- Text-mode output must suppress protected and ignored detail rows by default, cap advisory candidate and repair-finding samples, and print the cap plus hidden-count summary before sample rows.
- A disable or internal-flag path must be documented and tested if projection noise is high enough to defer visible docs-gate output.

## Proof and Runtime Boundary

Local report output proves only that the scanner classified local tracked files according to this contract at validation time.

It does not prove:

- a file is safe to delete;
- a file is no longer valuable;
- live Linear state is current;
- PR, CI, review-thread, or merge state is current;
- generated architecture context is source truth;
- downstream templates are aligned;
- SemVer or release impact has been approved.

Any archive, delete, move, demotion, manifest update, or distribution change requires a separate reviewed decision and its own validation.

## Coding and Testing Lenses

Simplify lens:

- Prefer one narrow docs-surface module and one script entry point.
- Do not create a broad documentation database or crawler.
- Keep report semantics mechanical and evidence-backed.

Architecture lens:

- Keep parsing and classification under src/lib/docs-surface.
- Keep command/script projection thin.
- Keep docs-gate as an aggregation consumer, not the source of classification truth.
- Keep generated projections and runtime artifacts out of source authority.

Testing lens:

- Unit tests must cover candidate, protected, and ignored files.
- Fixture tests must prove canonical docs are protected from age-only and link-count-only false positives.
- Tests must prove raw research can be reported without being treated as disposable.
- Tests must prove advisory candidates do not cause required docs-gate failure.
- Tests must prove generated projections cannot become archive candidates.
- Tests must prove stale active-artifacts absence cannot create candidate confidence.
- Tests must prove stale, missing, unparseable, route-mismatched, or unverified active-artifacts state cannot protect files or suppress archive candidates.
- Tests must prove destructive options fail closed with exit code 2.
- Tests must prove JSON output rejects absolute local paths and free-form destructive action text.
- Tests must prove mutation-shaped option aliases fail closed with usage exit code 2.
- Tests must exercise the production git-index adapter or script path, not only in-memory scanner fixtures. At least one proof must fail if the production command receives a mocked, precomputed, or arbitrary filesystem file list instead of the production repository-index source.
- Tests must prove docs-gate noisy advisory output is auditable through category counts, capped text samples, protected/ignored suppression, and JSON or artifact access to full details.

Domain language lens:

- Use archive candidate, advisory report, protection, evidence ref, research admission, and historical evidence consistently.
- Avoid saying stale docs cleanup when the behavior is only candidate reporting.

## Security, Privacy, and Safety

- Do not read ignored local databases, telemetry dumps, dependency folders, or raw session transcripts.
- Do not print secrets or local absolute paths.
- Do not follow symlinks outside the repo root.
- Do not classify local-only runtime output as source truth.
- Do not include raw file contents in JSON output; use paths, metadata, reason codes, and compact evidence refs.
- Treat destructive cleanup as a high-risk action outside this spec.

## Failure and Recovery

| Failure | Required Behavior |
| --- | --- |
| Invalid options | Exit usage error and print valid options. |
| Required manifest invalid | Fail with path, parser error, and remediation. |
| Unsafe path or traversal | Fail closed without scanning. |
| Git file list unavailable | Fail with environment diagnostic; do not scan arbitrary filesystem output. |
| Candidate confidence uncertain | Emit low or medium confidence with evidence refs, not a failure. |
| Docs-gate advisory projection noisy | Disable projection and keep local report until criteria improve. |
| Destructive option supplied | Exit usage error 2 with destructive_option_unsupported and no filesystem mutation. |

Recovery:

- If a candidate is false positive, add the narrowest protection evidence: manifest entry, canonical link, active-artifact reference, lifecycle metadata, or supersession pointer.
- If a file really is stale, create a separate archive decision artifact or plan before moving or deleting it.
- If the scanner cannot distinguish research value from doctrine, keep the file and emit research_value_retained.

## Validation Plan

Required before implementation handoff:

- Command: pnpm docs:lint -> proves this spec is Markdown-valid under repo docs lint.
- Command: pnpm docs:lifecycle --json -> proves this spec metadata is accepted by the docs lifecycle model.

Required after implementation:

- Command: pnpm test -- src/lib/docs-surface/archive-candidates.test.ts -> proves archive-candidate classification behavior.
- Command: pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts -> proves JSON schema, exit-code, absolute-path, and action-enum behavior.
- Command: pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts -> proves include/exclude, symlink, generated-output, and inbound-reference fixture behavior.
- Command: pnpm --silent docs:archive-candidates -- --json -> proves the operator JSON report path without package-runner banner text on stdout.
- Command: pnpm docs:archive-candidates -- --archive -> proves destructive options fail closed with usage exit code 2.
- Command: pnpm docs:archive-candidates -- --apply -> proves mutation-shaped aliases fail closed with usage exit code 2.
- Command: pnpm docs:lint -> proves docs remain lintable.
- Command: pnpm docs:lifecycle --json -> proves lifecycle metadata remains valid.
- Command: bash scripts/run-harness-gate.sh docs-gate --mode required --json -> proves docs-gate remains healthy and advisory candidates do not become required failures.
- Command: pnpm test -- src/commands/docs-gate.test.ts -> proves normalized docs-gate projection remains advisory.
- Command: pnpm run test:related -> proves related source/test behavior when TypeScript surfaces change.

Validation limits:

- These commands do not prove live Linear state, PR readiness, CI state, CodeRabbit review, mergeability, archive safety, deletion safety, or release readiness.

## Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| SA-001 | A tracked doc has superseded lifecycle metadata and a replacement ref | The archive-candidate report runs | The doc appears as a candidate with superseded_status, replacement evidence, and no delete claim. |
| SA-002 | A root canonical doc has low inbound link count | The report runs | The doc is protected by root_entrypoint or canon_or_canonical and is not a candidate from link count alone. |
| SA-003 | A research audit is old and not active | The report runs | The audit may be low or medium confidence, but includes research_value_retained unless admitted evidence says otherwise. |
| SA-004 | A plan/spec is execution-input or active-artifact referenced | The report runs | The file is protected by execution_input or active_artifact_reference. |
| SA-005 | A generated projection lacks a source ref | The report runs | The generated projection appears as a repairFinding or ignored file with generated_output_do_not_edit, not as an archive candidate. |
| SA-006 | Candidates exist | Docs-gate required mode runs | Required docs-gate status does not fail solely because advisory archive candidates exist. |
| SA-007 | A caller asks the report to archive files | The command runs | The command rejects destructive options with usage exit code 2, emits destructive_option_unsupported, and reports that cleanup requires a separate reviewed decision. |
| SA-008 | JSON output is requested | The report runs | Output uses docs-archive-candidates-report/v1 with stable reason and protection codes. |
| SA-009 | An execution-input or canonical file is missing from the lifecycle manifest | The report runs | The file is not an archive candidate solely due to manifest absence; the report emits metadata_repair_needed or protection_repair_needed. |
| SA-010 | .harness/active-artifacts.md is stale or unverified | The report runs | Absence from active-artifacts does not increase candidate confidence; the report emits active_reference_stale_or_unverified when appropriate. |
| SA-011 | JSON output contains paths | The report runs | All paths and evidence refs are repo-relative or redacted, and absolute local paths are rejected by contract tests. |
| SA-012 | A generated architecture context file lacks a source link | The report runs | The suggested action targets source-link or regeneration repair, the file is not a candidate, and stable generated-output codes such as generated_output_do_not_edit and repair_generated_source_link identify the generated file as non-source authority. |

VAC-007 mapping: archive candidate reporting is advisory and never deletes or moves files automatically.

## Decision

Proposed: implement JSC-395 as a read-only, advisory archive-candidate report under docs-surface, backed by deterministic reason/protection codes and tests. Do not delete, move, or demote files in this slice. Do not make docs-gate fail on candidates until a later approved promotion plan exists.

## Evidence and References

- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
- .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
- .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
- .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md
- .harness/specs/2026-06-04-reader-task-documentation-eval-spec.md
- docs/architecture/documentation-layers.md
- docs/agents/05-contradictions-and-cleanup.md
- docs/agents/14-docs-gate-rollout.md
- src/lib/docs-surface
- scripts/check-doc-lifecycle.ts
- scripts/check-docs-task-eval.ts

## Appendix A. Harness Metadata / Traceability

~~~yaml
schema_version: 1
stage: sy-spec
target: JSC-395
linear_parent: JSC-392
source_plan: .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
source_linear_plan: .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
plan_unit: PU-005
acceptance_id: VAC-007
authority: execution-input
external_lanes_checked: none
external_lanes_not_claimed:
  - live Linear state
  - PR state
  - CI state
  - CodeRabbit review
  - mergeability
  - archive safety
~~~

## Appendix B. Review Outcomes

Three adversarial review passes were run against this spec on 2026-06-05. The named adversarial-reviewer role could not run in this Codex account because its configured model was unavailable, so three fallback agents were run with explicit adversarial-review instructions and separate lenses.

Review verdict: REVISE.

Spec changes admitted from review:

- Split archive candidates from repair findings so protected documents are not pushed toward archive because metadata is incomplete.
- Replaced free-form recommendedAction with closed-enum suggestedAction plus advisory authority and reviewed-decision flags.
- Added destructive-option fail-closed behavior with exit code 2.
- Added scanner boundary rules for git-tracked inputs, ignored runtime output, generated projections, symlinks, inbound references, and code-fenced examples.
- Added active route freshness rules so stale .harness/active-artifacts.md can protect matches but cannot create negative evidence by absence.
- Added lifecycle metadata mapping by surface type and banned invented lifecycle states.
- Replaced repoRoot with repoRef and banned absolute local paths in all report fields.
- Added docs-gate advisory projection semantics and validation requirements.
- Added generated projection source-truth protections and repair-finding behavior.

Required before implementation merge:

- docs-expert or equivalent documentation review for candidate criteria.
- architecture review for docs-surface boundary and docs-gate advisory projection.
- adversarial review focused on false positives, deletion authority, and research retention safety.

## Appendix C. sy-plan Handoff

Recommended next stage: sy-plan.

Plan units:

1. Contract and fixture design for docs-archive-candidates-report/v1.
2. Scanner and classifier implementation under src/lib/docs-surface.
3. Script/package command for text and JSON output.
4. Tests for candidate, protected, ignored, destructive-option rejection, and advisory docs-gate behavior.
5. Minimal docs update explaining archive-candidate criteria and non-deletion boundary.

Blocked inputs:

- Live Linear status for JSC-395 was not refreshed in this spec run.
- Human approval is required before any actual archive, move, delete, demotion, or mandatory docs-gate promotion.

Handoff notes:

- Keep this slice advisory.
- Do not modify downstream templates.
- Do not modify generated architecture context as source truth.
- Preserve unrelated local edits already present in the worktree.
