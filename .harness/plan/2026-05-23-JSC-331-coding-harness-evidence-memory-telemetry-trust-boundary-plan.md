---
schema_version: 1
artifact_id: jsc-331-coding-harness-evidence-memory-telemetry-trust-boundary-he-plan
artifact_type: he-plan
canonical_slug: jsc-331-coding-harness-evidence-memory-telemetry-trust-boundary
title: JSC-331 Coding Harness Evidence, Memory, and Telemetry Trust Boundary Plan
harness_stage: he-plan
status: active
date: 2026-05-23
traceability_required: true
origin: .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
linear_issue: JSC-331
linear_status: confirmation_required
linear_milestone: not_applicable
---

# JSC-331 Coding Harness Evidence, Memory, and Telemetry Trust Boundary Plan

## Command Summary

BLUF: This plan turns the JSC-331 master trust-boundary spec into the first implementation slice for Coding Harness operators and developers. It builds only the local Trust Boundary P0 work: strict adopted-evidence validation, runtime-card source precedence, case-normalized Linear matching, audit-reference reporting, and reviewer-coverage receipts, because those are the controls that stop agents from turning stale plans, raw telemetry, or mailbox status into false done claims. The risk is that implementation may drift into memory rollout, telemetry import, or Linear mutation before the proof boundary is ready, so this plan names forbidden paths, validation gates, rollback, and handoff evidence before any code work starts.

Decision Needed: Trust Boundary P0 is selected as the first he-work slice. The live Linear destination is confirmed as JSC-331, and the tracker-side confirmation comment was posted after explicit user authorization; further Linear mutation still requires implementation evidence and explicit user instruction.

Top Risks: Strict validation may reveal adopted evidence patterns whose commands are missing or stale; runtime-card changes could accidentally change existing v1 contract behavior; audit-reference and reviewer-coverage validators may become public CLI too early; validator scripts that are implementation deliverables may be mistaken for pre-existing proof.

Next Action: Route PU-001 through PU-006 to implementation only after refreshing current branch state and confirming no unrelated dirty worktree changes overlap the allowed paths.

## Objective

Implement the first local proof slice from the master spec so Coding Harness can reject false success at the research, runtime-card, audit-reference, and reviewer-coverage boundaries before broader memory and telemetry work begins.

This is not the full evidence, memory, and telemetry program. It is the boring, fixture-backed Trust Boundary P0 slice named in Appendix C of the source spec.

## Source Contract

Primary source:

- .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md

Selected source slice:

- FR-001 through FR-006
- SA-001 through SA-006
- NFR-001 through NFR-003, NFR-005, NFR-007 through NFR-010 where they apply to the selected slice

Deferred source scope:

- FR-007 through FR-012 and SA-007 through SA-009: memory proof boundary
- FR-013 through FR-017 and SA-010 through SA-011: telemetry evidence bridge
- FR-018 through FR-020 and SA-012 through SA-014: downstream rollout and synthesis
- FR-021 and SA-015: closeout convergence after receipt contracts exist
- FR-022 and SA-016: tracker destination guard before Linear mutation automation

Source ID mapping:

| Source ID | Plan unit | Evidence target |
|---|---|---|
| Professional review / artifact precondition | PU-000 | active plan and spec pass HE validation and implementation seams are inventoried before code work starts |
| FR-001 | PU-001 | adopted evidence missing, non-runnable, or failing validationCommand blocks strict validation |
| FR-002 | PU-001 | documented_only, planning_only, enforcement_backed, implementation_backed, deferred status classification |
| FR-003 | PU-002 | blocked, stale, or worse runtime evidence is preserved over optimistic duplicate provenance |
| FR-004 | PU-003 | Linear issue-key matching is case-normalized with display value preserved |
| FR-005 | PU-004 | audit-reference-report/v1 or equivalent JSON reports loadable, missing, ignored, and untracked references |
| FR-006 | PU-005 | reviewer-coverage-receipt/v1 records requested, completed, blocked, missing, retry, and synthesis state |
| SA-001 | PU-001 | regression proves adopted pattern fails when validationCommand is missing or failing |
| SA-002 | PU-001 | status enum regression proves the five evidence-pattern states |
| SA-003 | PU-002 | runtime-card source merge precedence regression |
| SA-004 | PU-003 | runtime-card Linear key normalization regression |
| SA-005 | PU-004 | audit reference validator JSON regression |
| SA-006 | PU-005 | reviewer coverage receipt JSON regression |

## Scope and Boundaries

Allowed path:

- scripts/validate-evidence-patterns.cjs
- scripts/validate-he-artifacts.sh
- scripts/validate-audit-references.cjs
- src/lib/runtime/runtime-evidence-adapter.ts
- src/lib/runtime/local-runtime-card-assembly.ts
- src/commands/runtime-card.test.ts
- src/lib/runtime/local-runtime-card.test.ts
- src/lib/harness-artifact-routine.ts when audit-reference or reviewer-coverage proof extends artifact-routine behavior
- src/lib/review-gate/** only when PU-000 proves reviewer coverage belongs in that seam
- src/commands/artifact-routine.ts only if PU-000 records public command wiring as the narrowest existing seam
- package.json only when a script or command entry is required
- tests or fixtures directly supporting PU-000 through PU-006
- .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md
- .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md when technical review repairs spec-plan alignment

Forbidden path:

- raw collector data
- external tracker state without approval
- further Linear mutation beyond the authorized destination-confirmation comment
- GitHub, CircleCI, CodeRabbit, automation, or deployment mutation
- unrelated dirty deep-module migration artifacts
- broad memory implementation under src/lib/memory beyond compile-time imports needed by the selected slice
- telemetry session-bundle importer implementation
- harness init or harness upgrade memory rollout behavior
- authority-file synthesis writes to AGENTS.md, CODESTYLE.md, harness.contract.json, or generated downstream docs unless a later unit explicitly admits them

Out of scope:

- Full Vector, Victoria, OTLP, or external observability rollout
- External vault requirement decisions
- Brownfield file movement
- Closeout-grade memory claims
- Public schema version changes beyond existing v1 or new local receipt/report shapes named in the spec

## Authority and Scope Boundary

requested_depth: approved_slice

approved_execution_boundary: User invoked he-plan for the selected master spec; the source spec Appendix C recommends Trust Boundary P0 as the first he-plan unit.

downscope_authority: source_artifact

external_mutation_boundary: Linear destination confirmation is complete for JSC-331; further Linear mutation still requires explicit user instruction. No GitHub, CircleCI, CodeRabbit, deployment, or automation mutation is authorized by this plan.

freshness_required: branch, validation_time, tracker_state before implementation starts; PR state only after a PR exists.

human_acceptance_boundary: required before Linear mutation, public schema-version expansion, or authority-file synthesis.

proof_boundary: Completion requires code changes plus passing focused tests or validators for each admitted source ID; this plan, chat, historical memory, and raw telemetry are not completion proof.

non_proof_sources:

- chat_summary
- raw_logs
- aggregate_stats
- stale_session
- mailbox_only_reviewer_status
- uncited_memory
- local_spec_without_validation

## Current State / Evidence

Verified in this planning pass:

- The requested path without the leading dot, harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md, is absent.
- The canonical source exists at .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md.
- The source spec marks he-plan handoff safe and recommends Trust Boundary P0 first.
- Root repo status before this plan had only the pre-existing .harness/memory/LEARNINGS.md local modification.
- Linear destination was verified as JSC-331, team Jscraik, project Harness cockpit routing, status In Progress, assignee jscraik@brainwav.io.
- Live Linear mutation was authorized by the user for destination confirmation only, and comment ac992e03-6f58-457d-8c45-a45b7102294e was posted to JSC-331.
- Post-plan professional review found the source spec had artifact-shape and traceability gaps plus an internal FR range contradiction; those gaps are repaired in the associated spec update before implementation handoff.
- Existing code seams verified during review include scripts/validate-evidence-patterns.cjs, runtime-card tests, src/lib/runtime/runtime-evidence-adapter.ts, src/lib/runtime/local-runtime-card-assembly.ts, src/lib/harness-artifact-routine.ts, and src/lib/review-gate/.
- scripts/validate-audit-references.cjs does not exist before implementation and must be created in PU-004 unless PU-000 records a narrower existing seam.
- scripts/validate-reviewer-coverage.cjs does not exist before implementation and must be created in PU-005 unless PU-000 records a narrower existing seam.

Historical context used for caution:

- JSC-331 has had prior stale-route and closeout-truth drift, so implementation must recheck live tracker ownership, active artifacts, branch state, and validation evidence before claiming closeout.

Implementation-time unknowns:

- Exact helper names and module seams.
- Whether audit-reference validation should ship as public CLI or script-backed validator in the first patch.
- Whether reviewer coverage helpers already have adjacent command or artifact abstractions that should absorb the receipt.
- Whether the confirmed Linear destination needs later state, attachment, or description mutation after implementation evidence exists.

## Implementation Strategy

Sequence Trust Boundary P0 from the most local and deterministic checks outward.

First, run a discovery and artifact-proof gate so the implementation starts from current repo seams rather than assumed file paths. Then harden the existing evidence-pattern validator so adopted evidence cannot pass without an executable declared command and so status classification distinguishes documentation, planning, enforcement, implementation, and deferred states. Next fix runtime-card source handling so worse evidence and mixed-case issue keys cannot be hidden by optimistic assembly behavior. After that, add audit-reference validation and reviewer-coverage receipt proof as local JSON validators or script-backed library paths, deferring public CLI admission unless discovery shows an existing command family is already ready to host them.

Keep the first patch local-first, fixture-backed, and refusal-friendly. Prefer existing command families, fixture structures, and runtime-card tests over new broad abstractions. If implementation discovery shows the named script paths are stale, choose the nearest existing validator or command seam and record that decision in the handoff.

## Runtime Persistence and State

runtime_state: he-plan complete; implementation not started.

resumption_key: .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md plus JSC-331 plus current branch at implementation time.

runtime_invocation_receipt: he-plan invoked by user in the current Codex thread on 2026-05-23; no external runtime receipt was generated.

artifact_chain_key: jsc-331-coding-harness-evidence-memory-telemetry-trust-boundary

persistent_artifacts:

- .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
- .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md

live_state_refresh: required before he-work and before closure.

session_evidence_status: historical; useful for routing caution, not proof of current repo, tracker, PR, or validation state.

proof_boundary: Fresh code/test evidence and validator output from the implementation branch, not this plan or prior session memory.

What survives resume:

- Source spec path
- Selected FR and SA IDs
- Allowed and forbidden path boundaries
- Validation expectations
- Linear mutation blocked status

What must be refreshed:

- git status and branch
- active artifact index
- current Linear destination for JSC-331
- existing implementation seams and tests
- exact validation command outcomes

## Enforcement Contract

essential_decisions:

- Implement only Trust Boundary P0 first.
- Do not invent a new public schema version.
- Do not let raw telemetry or stale memory satisfy closeout.
- Preserve validation-receipt/v1 separation between declaredValidationCommand and executedCommand where strict adopted-evidence receipts are involved.
- Preserve runtime-evidence-bundle/v1 and runtime-evidence-contract/v1 compatibility.
- Treat reviewer coverage as artifact-first when artifact-first review was requested.
- Keep Linear destination ambiguity outside code behavior.

fillable_gaps:

- Exact helper names and module seams.
- Fixture directory layout.
- Additive optional metadata fields.
- Command help text.
- Whether audit-reference validation is public command wiring or script-backed first.
- Whether reviewer coverage receipt lives under an existing review, artifact, or runtime library namespace.

guardrails:

- Unit tests for strict adopted-evidence validation and status classification.
- Unit tests for runtime-card source merge precedence and issue-key normalization.
- Audit-reference validator fixture tests.
- Reviewer coverage receipt fixture tests.
- JSON parseability checks for new report or receipt outputs.
- Off-repo or missing-reference failure cases where the relevant unit admits path handling.
- pnpm check before parent issue closeout.

refusal_triggers:

- A new public schema version becomes necessary.
- Raw telemetry persistence would enter tracked artifacts.
- Audit-reference validation cannot distinguish missing, ignored, untracked, and loadable references.
- Reviewer artifact outputs are missing after retry but implementation tries to mark review complete.
- Linear mutation is required before destination confirmation.
- Runtime-card changes would alter existing v1 compatibility without a reviewed migration.

durable_memory:

- Repo-specific learned fixes go to .harness/memory/LEARNINGS.md only when implementation discovers a new recurring gotcha.
- Governance behavior changes go to docs/agents/07b-agent-governance.md only in a later docs-admitted slice.
- Memory workflow changes go to docs/agents/03-local-memory.md only in the deferred memory proof boundary.
- Evidence pattern adoption status updates go to .harness/research/evidence-patterns.json only when implementation changes the adopted evidence source.

professional_output:

- Handoff must report changed files, exact commands, pass/fail/blocked outcomes, evidence artifact paths, runtime evidence source and freshness, reviewer coverage status, live tracker state observed or explicitly unobserved, blockers, next action, and rollback path.

## Coding and Testing Lenses

coding_lens:

- Ownership: Coding Harness CLI, runtime-card, validators, and review receipt helpers.
- Allowed modules: scripts/validate-evidence-patterns.cjs, scripts/validate-audit-references.cjs if created, runtime-card adapter and assembly files, runtime-card tests, src/lib/harness-artifact-routine.ts, and src/lib/review-gate/** only when PU-000 proves those seams are the narrowest fit.
- Forbidden modules: raw collector data, external tracker mutation code, broad memory rollout, telemetry importer, downstream init/upgrade migration, unrelated command-registry migration.
- Public contract posture: canonical-only and backwards compatible for existing v1 runtime contracts; new report or receipt shapes must carry schemaVersion and stable status enums.
- Failure and recovery: missing commands, malformed JSON, ambiguous identity, missing artifacts, and absent reviewer artifacts must produce blocked, unknown, missing, partial, or fail states rather than pass.
- Generated-artifact boundary: new JSON fixtures or outputs must be repo-relative, deterministic, and redaction-safe.
- Complexity posture: prefer existing validators and runtime-card assembly patterns before adding new abstractions.

testing_lens:

- Observable behavior: strict validators fail closed, runtime-card preserves worse source state, issue-key matching normalizes case, audit references classify path state, reviewer coverage reports artifact completeness.
- Source acceptance IDs: SA-001 through SA-006.
- Prior-art families to inspect: runtime-card command tests, local runtime-card assembly tests, evidence-pattern validator tests or fixtures, artifact-routine/reference validation helpers, review artifact handling tests.
- Positive scenarios: valid adopted evidence with executed command, enforcement_backed and implementation_backed status, runtime-card with consistent issue key, all audit refs loadable, all requested reviewer artifacts present.
- Negative scenarios: missing validationCommand, failing declared command, documented_only adopted pattern, duplicate stale runtime evidence, mixed-case issue key, missing audit reference, untracked ignored reference, missing reviewer artifact after retry.
- Stale-state scenarios: stale runtime source, stale validation receipt, stale reviewer artifact, historical memory cited without live refresh.
- Exact validation commands known now: node scripts/validate-evidence-patterns.cjs --strict-adopted --json; pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts.
- Blocked gates: audit-reference and reviewer-coverage commands cannot be run until implemented.
- Recovery ownership: implementation agent owns focused unit tests; coordinator owns live Linear destination confirmation.

## Work Units

### PU-000 Evidence and Seam Discovery Gate

Objective: Prove the active artifacts and current implementation seams before code work starts.

Source trace: professional-confidence review, source spec Authority and Scope Boundary, source spec Proof and Runtime Boundary.

Allowed path:

- .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md
- .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
- read-only inspection of scripts/validate-evidence-patterns.cjs, runtime-card files, artifact-routine files, and review-gate files

Forbidden path:

- implementation edits
- Linear or external tracker mutation
- public command wiring decisions without recorded evidence

Steps:

1. Refresh git status and confirm unrelated dirty worktree files are not in the implementation scope.
2. Run the repo-owned HE artifact wrapper on this plan and the associated spec.
3. Inventory existing code seams for evidence-pattern validation, runtime-card assembly, artifact-routine/reference handling, and reviewer coverage or review-gate behavior.
4. Record whether audit-reference validation and reviewer-coverage proof will be script-backed, library-backed, or command-backed.
5. If a planned file or seam is missing, choose the nearest existing repo-owned seam and record the decision before editing code.

Validation:

- Command: pnpm he:artifacts:validate .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md -> required before implementation.
- Expected wrapper contract: exit 0 with stdout JSON status pass when all HE checks pass; exit 1 with stdout JSON status fail or blocked when validators fail or the HE validator bundle is unavailable; exit 2 for usage errors.

Stop condition: Stop if plan/spec validation fails, the source spec contradicts the selected slice, the HE validator wrapper reports blocked, or the current repo lacks an admissible seam for a planned proof surface.

Rollback: Revert artifact-only review edits; no implementation state should exist yet.

Handoff: ready for PU-001 only when active artifacts validate and seam decisions are recorded.

### PU-001 Strict Adopted-Evidence Validation

Objective: Make adopted evidence fail when the declared validation command is missing, non-runnable, or failing, and expose the required evidence-pattern status states.

Source trace: FR-001, FR-002, SA-001, SA-002, NFR-001, NFR-003, NFR-008.

Allowed path:

- scripts/validate-evidence-patterns.cjs
- .harness/research/evidence-patterns.json only if the fixture data must represent the new states
- tests or fixtures for evidence-pattern validation
- package.json only if a script entry is required

Forbidden path:

- broad research rewrites
- docs-only adoption claims
- Linear mutation

Steps:

1. Inspect the existing evidence-pattern validator and fixture shape.
2. Preserve declaredValidationCommand separately from executedCommand where receipts are emitted.
3. Add strict-adopted behavior for missing, non-runnable, and failing commands.
4. Add or update status classification for documented_only, planning_only, enforcement_backed, implementation_backed, and deferred.
5. Cover positive and negative fixture cases.

Validation:

- Command: node scripts/validate-evidence-patterns.cjs --strict-adopted --json -> required after implementation.
- Command: focused unit test for evidence-pattern validator -> required after implementation.
- Expected outcome: adopted pattern without runnable proof is fail or blocked, not pass.

Stop condition: Stop if the existing validator cannot identify declared commands separately from substituted or executed commands without a schema decision.

Rollback: Revert validator changes and fixtures while preserving source evidence files.

Handoff: ready for PU-002 only when strict JSON output and status classification tests pass or are blocked with exact reason.

### PU-002 Runtime Evidence Merge Precedence

Objective: Preserve blocked, stale, or worse runtime evidence when duplicate optimistic synthetic provenance exists.

Source trace: FR-003, SA-003, NFR-003, NFR-010.

Allowed path:

- src/lib/runtime/runtime-evidence-adapter.ts
- src/lib/runtime/local-runtime-card-assembly.ts
- src/lib/runtime/local-runtime-card.test.ts
- adjacent runtime-card fixture files

Forbidden path:

- runtime-evidence-bundle/v1 schema replacement
- telemetry importer implementation
- raw collector reads

Steps:

1. Inspect runtime-card evidence source assembly and duplicate merge behavior.
2. Add a precedence rule that keeps blocked, stale, fail, missing, partial, or unknown evidence visible over optimistic duplicate data.
3. Preserve both evidence refs when needed to avoid hiding conflict.
4. Add regression coverage for worse-state duplicate evidence.

Validation:

- Command: pnpm vitest run src/lib/runtime/local-runtime-card.test.ts -> required after implementation.
- Expected outcome: runtime-card exposes the worse relevant blocker or conflict instead of synthetic pass.

Stop condition: Stop if preserving worse evidence would break current runtime-evidence-bundle/v1 or runtime-evidence-contract/v1 compatibility.

Rollback: Revert merge precedence logic and the targeted regression test.

Handoff: ready for PU-003 when runtime-card behavior is proven by focused test.

### PU-003 Runtime-Card Linear Issue-Key Normalization

Objective: Make runtime-card Linear issue-key matching case-normalized while preserving original display values.

Source trace: FR-004, SA-004, NFR-008.

Allowed path:

- src/lib/runtime/local-runtime-card-assembly.ts
- src/commands/runtime-card.test.ts
- src/lib/runtime/local-runtime-card.test.ts
- adjacent runtime-card helpers or fixtures

Forbidden path:

- Linear API mutation
- tracker destination selection
- broad issue-key semantics outside runtime-card matching

Steps:

1. Find the current Linear issue-key comparison boundary.
2. Normalize keys for matching only.
3. Preserve the original key for display and evidence references.
4. Add mixed-case regression coverage.

Validation:

- Command: pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts -> required after implementation.
- Expected outcome: JSC-331, jsc-331, and mixed-case variants match the same runtime-card issue identity without mutating display evidence.

Stop condition: Stop if issue-key normalization requires a broader Linear identity migration.

Rollback: Revert comparison helper and regression test.

Handoff: ready for PU-004 after focused runtime-card tests pass.

### PU-004 Audit Reference Report

Objective: Add audit-reference-report/v1 or equivalent JSON output for referenced source artifacts in audits, specs, plans, and closeout.

Source trace: FR-005, SA-005, NFR-001, NFR-002, NFR-007, NFR-008.

Allowed path:

- scripts/validate-audit-references.cjs
- src/lib/harness-artifact-routine.ts only if PU-000 proves artifact-routine is the right shared helper seam
- src/commands/artifact-routine.ts only if PU-000 records public command wiring as the narrowest existing seam
- audit-reference fixtures under the existing test or fixture root
- package.json only if a script entry is required

Forbidden path:

- external filesystem roots outside repo unless explicitly configured read-only
- authority-file mutation
- broad artifact-routine rewrites not needed for reference validation

Steps:

1. Inspect existing artifact-routine or reference validation helpers.
2. Build scripts/validate-audit-references.cjs as a PU-004 implementation deliverable unless PU-000 records a narrower existing seam; do not treat this script as pre-existing proof.
3. Choose script-backed validator first unless a current command family already owns this behavior; public CLI admission is forbidden in this slice unless the command-admission checklist below passes.
4. Validate that referenced artifacts are real, allowed, tracked, or intentionally classified as ignored, untracked, missing, or blocked.
5. Emit exactly one audit-reference-report/v1-compatible JSON object on stdout with status, blockerClass, reason, sourceArtifact, referencedArtifacts, missingRefs, and ignoredOrUntrackedRefs.
6. Cover loadable, missing, ignored, untracked, malformed input, and missing-source cases.

Validation:

- Command: node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json -> required after PU-004 creates or routes the validator.
- Command: focused unit or fixture test for audit-reference validation -> required once implemented.
- Command contract: stdout is exactly one parseable audit-reference-report/v1 JSON object; stderr is human diagnostics only; exit 0 means status pass, exit 1 means fail, blocked, missing, or partial in required mode, and exit 2 means usage error.
- Expected outcome: missing or ignored source artifacts block or classify validation, not silently pass.

Stop condition: Stop if the validator needs policy for private-user or off-repo references not present in the source spec.

Rollback: Remove the new validator and fixtures; leave the source audit and spec files untouched.

Handoff: ready for PU-005 once JSON shape and reference-state classification are proven.

### PU-005 Reviewer Coverage Receipt

Objective: Define reviewer-coverage-receipt/v1 for artifact-first review swarms.

Source trace: FR-006, SA-006, NFR-001, NFR-003, NFR-008, NFR-009.

Allowed path:

- src/lib/review-gate/** only if PU-000 proves reviewer coverage belongs in that seam
- src/lib/harness-artifact-routine.ts only if reviewer coverage proof is part of artifact-routine evidence handling
- src/lib/runtime/** only if receipt consumption is already located there
- scripts/** only for a local validator if no library command seam exists
- tests or fixtures for reviewer coverage receipts

Forbidden path:

- spawning reviewers
- mutating review threads
- treating mailbox/status text as completion evidence
- broad pr-closeout integration beyond a local receipt helper

Steps:

1. Inspect existing review artifact handling and PR closeout receipt patterns.
2. Build scripts/validate-reviewer-coverage.cjs as a PU-005 implementation deliverable unless PU-000 records a narrower existing seam; do not treat this script as pre-existing proof.
3. Keep first-slice proof script-backed unless PU-000 proves review-gate or artifact-routine is the narrower existing seam.
4. Read a reviewer manifest and verify that each required reviewer artifact exists, is non-empty, and carries a completion or blocker status.
5. Treat mailbox-only reviewer text as non-proof.
6. Emit exactly one reviewer-coverage-receipt/v1 JSON object on stdout with status, blockerClass, reason, requestedRoles, completedRoles, completedArtifacts, blockedRoles, missingArtifacts, retryCount, synthesisStatus, and evidenceRefs.
7. Validate missing artifact, blocked role, retry, partial, and complete receipt cases.
8. Keep consumer integration advisory unless implementation discovers a narrow existing seam.

Validation:

- Command: node scripts/validate-reviewer-coverage.cjs --manifest artifacts/reviews/reviewer-coverage-manifest.json --reviews-dir artifacts/reviews --json -> required after PU-005 creates or routes the validator.
- Command: pnpm vitest run src/lib/reviewer-coverage-receipt.test.ts -> required once implemented unless PU-000 records a different exact test file.
- Command contract: stdout is exactly one parseable reviewer-coverage-receipt/v1 JSON object; stderr is human diagnostics only; exit 0 means status pass, exit 1 means fail, blocked, missing, or partial in required mode, and exit 2 means usage error.
- Expected outcome: missing artifacts produce partial or blocked reviewer coverage, not complete.

Stop condition: Stop if receipt validation requires changing reviewer swarm runtime behavior rather than local artifact classification.

Rollback: Remove receipt helper and tests; leave existing reviewer artifacts untouched.

Handoff: ready for PU-006 after local receipt shape and failure cases pass.

### PU-006 Trust Boundary P0 Integration and Handoff

Objective: Tie PU-001 through PU-005 together into a coherent first patch with exact validation evidence, blockers, and next-slice boundaries.

Source trace: FR-001 through FR-006, SA-001 through SA-006, professional_output.

Allowed path:

- package.json only for admitted scripts
- targeted docs or help text only if command wiring changes user-visible behavior
- PR body or handoff notes after implementation

Forbidden path:

- FR-007 through FR-022 implementation
- tracker mutation
- broad docs-gate surfaces unless touched by the first patch

Steps:

1. Run focused unit and validator commands from PU-001 through PU-005.
2. Run the smallest repo wrapper required by touched surfaces, likely bash scripts/validate-codestyle.sh --fast.
3. Classify any broader gate failures as introduced by current patch, pre-existing, unrelated dirty worktree, or environment/tooling failure.
4. Record exact command outcomes and unresolved blocker classes.

Validation:

- Command: bash scripts/validate-codestyle.sh --fast -> required before implementation handoff when source files change.
- Command: pnpm check -> required before parent issue closeout, may be deferred from first patch if scoped handoff explicitly says not run.
- Expected outcome: local Trust Boundary P0 behavior is proven or blocked with exact recovery step.

Stop condition: Stop if validation cannot separate current-patch failures from pre-existing or unrelated dirty worktree state.

Rollback: Revert Trust Boundary P0 code/test changes as one patch; do not delete source specs or plan artifacts.

Handoff: route to review or next implementation slice only after exact validation evidence is recorded.

## Dependencies and Sequencing

Sequence:

1. PU-000 evidence and seam discovery gate.
2. PU-001 strict adopted-evidence validation.
3. PU-002 runtime evidence merge precedence.
4. PU-003 issue-key normalization.
5. PU-004 audit reference report.
6. PU-005 reviewer coverage receipt.
7. PU-006 integration and handoff.

PU-002 and PU-003 may be implemented in the same runtime-card patch if the changed files and tests overlap tightly. PU-004 and PU-005 may remain script or library backed without public CLI admission if command routing would create unnecessary surface area in the first patch.

## Validation Gates

Pre-implementation gates:

| Gate | Status | Observable behavior / proof |
|---|---|---|
| Source spec exists | pass | .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md was read during planning |
| Plan/spec HE validation | required | PU-000 requires artifact identity, Linear traceability, BLUF, and generated-shape checks on both active artifacts before implementation |
| Seam inventory | partial | key existing seams were observed during review; PU-000 must refresh them before edits and record whether audit-reference and reviewer-coverage proof are script-backed, library-backed, or command-backed |
| Linear destination | blocked | JSC-331 destination remains confirmation_required before mutation |
| Dirty worktree | partial | .harness/memory/LEARNINGS.md was already modified before this plan; implementation must avoid or reconcile overlap |

Post-implementation required gates:

| Command | Scope | Required for |
|---|---|---|
| pnpm he:artifacts:validate .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md | repo-owned HE artifact wrapper | PU-000, implementation start |
| node scripts/validate-evidence-patterns.cjs --strict-adopted --json | strict adopted evidence | PU-001, SA-001, SA-002 |
| pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts | runtime-card behavior | PU-002, PU-003, SA-003, SA-004 |
| node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json | audit references, implementation target until PU-004 creates or routes it | PU-004, SA-005 |
| node scripts/validate-reviewer-coverage.cjs --manifest artifacts/reviews/reviewer-coverage-manifest.json --reviews-dir artifacts/reviews --json | reviewer coverage receipt, implementation target until PU-005 creates or routes it | PU-005, SA-006 |
| pnpm vitest run src/lib/reviewer-coverage-receipt.test.ts | reviewer coverage receipt fixture/unit proof | PU-005, SA-006 |
| pnpm run safety:local | local secret/changed Semgrep safety lane | PU-004, PU-005, or PU-006 when receipt/report payload, redaction, telemetry, or tracked evidence-output logic changes |
| bash scripts/validate-codestyle.sh --fast | repo codestyle and focused quality | any code/test patch |
| pnpm check | aggregate closeout | parent JSC-331 closeout, not first-patch proof by itself |

Testing decisions:

- Test observable output and blocker classification, not private helper names.
- Fixture inputs must include positive, negative, missing, stale, and malformed states where the unit owns that state.
- Expected outcome is parseable JSON with stable status words and blocker reasons.
- Any unavailable gate must be marked blocked with owner and recovery step.

Command output contract:

- Validator stdout must be exactly one JSON object in success, fail, blocked, missing, partial, or usage cases.
- Human diagnostics, stack traces, and command banners belong on stderr.
- Exit 0 means status pass.
- Exit 1 means required-mode fail, blocked, missing, partial, or stale.
- Exit 2 means usage error.
- Every non-pass JSON object must include blockerClass and reason.

Public command admission checklist:

- The behavior already belongs to an existing command family.
- The command adds no new parser semantics beyond the existing family.
- The JSON schema and exit-code contract above are locked by tests.
- The command does not expand FR-007 or later work.
- Docs-gate impact is either absent or explicitly admitted.
- If any item fails, keep the validator script-backed for Trust Boundary P0 and record the deferred command rationale in the PU-000 seam decision artifact.

## Review Plan

Required review before implementation handoff:

- Harness product/code review for runtime-card behavior and validator correctness.
- Harness dev-tools review for script/CLI ergonomics and deterministic JSON output.
- API contract review if public command wiring or schema names change.
- Agent-native review if reviewer coverage or runtime-card output changes agent routing behavior.

Review evidence:

- Reviewer findings must cite file and line evidence.
- Artifact-first reviewer output is required when a review swarm is explicitly requested.
- Mailbox text alone is not completion evidence for reviewer coverage.

## Rollback Plan

Rollback PU-001 by reverting strict evidence validator changes and associated fixtures.

Rollback PU-002 and PU-003 by reverting runtime-card assembly changes and focused regressions while keeping source specs untouched.

Rollback PU-004 by removing the audit-reference validator/script and fixtures without deleting referenced research artifacts.

Rollback PU-005 by removing reviewer coverage helper and tests without deleting existing reviewer reports.

Rollback PU-006 by reverting integration wiring and script entries; if package.json changed only for command exposure, remove the entry and keep library behavior only when tests still require it.

Do not delete Project Brain, source specs, historical audits, or user-approved brownfield files as part of this rollback.

## Risk Register

| Risk | Impact | Mitigation | Owner |
|---|---|---|---|
| Public CLI admitted too early | New command surface becomes hard to change | Keep PU-004 or PU-005 script-backed unless existing command family is obvious | implementation agent |
| Runtime evidence v1 drift | pr-closeout or runtime-card consumers break | Add compatibility tests and preserve current required fields | implementation agent |
| Dirty worktree overlap | User memory edit gets swept into implementation | Recheck git status and avoid .harness/memory/LEARNINGS.md unless a new learned fix is required | coordinator |
| Linear destination ambiguity | Tracker mutation lands in wrong project | Keep linear_mutation_status confirmation_required until he-linear-plan or user approval | coordinator |
| Validator claims pass from partial evidence | False closeout confidence persists | Treat missing, stale, malformed, ignored, and untracked states as explicit non-pass statuses | implementation agent |

## Observability and Evidence

Evidence allowed for this slice:

- repo-local validator JSON
- fixture-backed unit test output
- runtime-card test output
- reviewer coverage receipt fixture output
- exact command outcomes from the implementation branch

Evidence not allowed for this slice:

- raw OTLP stats
- session-collector raw payloads
- historical session summaries as proof of current code
- uncited memory
- local plan text without tests
- mailbox-only reviewer completion claims

Evidence artifacts should be repo-relative and redaction-safe. If implementation creates generated outputs for tests, they must stay in ignored runtime/output paths unless explicitly promoted by a later source contract.

## Visual References / Diagrams

| Stage | Depends on | Output |
|---|---|---|
| PU-001 strict evidence validation | source spec | validation-receipt behavior and status classification |
| PU-002 runtime source precedence | PU-001 source contract clarity | runtime-card duplicate-source blocker precedence |
| PU-003 issue-key normalization | PU-002 runtime-card touchpoint | case-normalized Linear matching regression |
| PU-004 audit reference report | PU-001 validation pattern | audit-reference-report/v1-compatible JSON |
| PU-005 reviewer coverage receipt | PU-004 artifact reference behavior | reviewer-coverage-receipt/v1-compatible JSON |
| PU-006 validation and handoff | PU-001 through PU-005 | exact command outcomes and next-stage decision |

Minimum proof bundle:

| Unit | Required command | Required artifact or output | Freshness / blocker rule |
|---|---|---|---|
| PU-000 | pnpm he:artifacts:validate .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md | stdout JSON status pass plus recorded seam decision | blocked_missing_validator, validation_failed, or seam_unavailable blocks PU-001 |
| PU-001 | node scripts/validate-evidence-patterns.cjs --strict-adopted --json | validation-receipt/v1-compatible JSON | missing or failing declaredValidationCommand blocks adoption |
| PU-002 | pnpm vitest run src/lib/runtime/local-runtime-card.test.ts | Vitest pass output for duplicate/worse evidence precedence | fail blocks PU-003 |
| PU-003 | pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts | Vitest pass output for mixed-case issue matching | fail blocks PU-004 |
| PU-004 | node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json after PU-004 creates or routes the validator | audit-reference-report/v1 JSON | missing before PU-004 is expected; missing, blocked, fail, or partial after PU-004 blocks PU-005 unless explicitly scoped |
| PU-005 | node scripts/validate-reviewer-coverage.cjs --manifest artifacts/reviews/reviewer-coverage-manifest.json --reviews-dir artifacts/reviews --json after PU-005 creates or routes the validator | reviewer-coverage-receipt/v1 JSON | missing before PU-005 is expected; missing artifact after retry is partial or blocked, never pass |
| PU-006 | bash scripts/validate-codestyle.sh --fast | exact command outcome plus blocker ownership classification | introduced failures block handoff |

~~~mermaid
flowchart LR
  A["PU-001 strict evidence validation"] --> B["PU-002 runtime source precedence"]
  B --> C["PU-003 issue-key normalization"]
  C --> D["PU-004 audit reference report"]
  D --> E["PU-005 reviewer coverage receipt"]
  E --> F["PU-006 validation and handoff"]
  F --> G["Review or next slice"]
~~~

The diagram shows execution order only. Source requirements, validation gates, and rollback notes in this plan remain authoritative.

## Accessibility and Operator Ergonomics

- Human output should name the smallest next safe action.
- JSON output must be parseable by agents and use word statuses rather than color-only indicators.
- Failure output should distinguish missing, stale, blocked, not_configured, not_applicable, partial, fail, and unknown where relevant.
- Handoff must keep exact commands and blocker classes near the changed files they prove.

## Open Questions

OQ-001: Should audit-reference validation become public command wiring after Trust Boundary P0, or stay script-backed until a later command-admission plan proves the shape?

OQ-002: Should reviewer-coverage-receipt/v1 later move from the Trust Boundary P0 script-backed validator into review-gate, artifact-routine, or another public command family?

OQ-003: Which live Linear destination owns JSC-331 before any tracker mutation?

OQ-004: Does strict adopted-evidence validation need a compatibility mode for historical evidence patterns that cannot run locally?

## Final Decision

Proceed with Trust Boundary P0 as an approved implementation plan only after the user authorizes he-work or another implementation stage. This plan permits the already-authorized Linear destination-confirmation record, but blocks further Linear mutation, broad memory rollout, telemetry importer work, and closeout claims until fresh code and validation evidence exists.

post_plan_handoff:

- state: explicit_stop
- selected_next_stage: none
- evidence: .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md
- next_action: user may authorize he-work for PU-000 through PU-006; further Linear mutation requires separate implementation-evidence confirmation

## Appendix A. Harness Metadata / Traceability

- interactive_status: complete
- selection_evidence: user invoked he-plan with the master spec path; missing non-dot path resolved to .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
- route: standard-plan
- stage: he-plan
- scope: Trust Boundary P0 for Coding Harness evidence, runtime-card, audit-reference, and reviewer-coverage proof
- source: .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
- plan_path: .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md
- safe_to_continue: true for plan artifact handoff; false for implementation until he-work is authorized and live state is refreshed
- blocked_reason: further Linear mutation remains blocked until implementation evidence exists; implementation not authorized by this planning-only output
- linear_action_required: false for destination confirmation, true before any additional tracker mutation
- linear_mutation_status: confirmation_required
- authority_scope_boundary: approved_slice, local plan artifact only
- runtime_persistence: resumption_key recorded in Runtime Persistence and State
- coding_lens: present
- testing_lens: present
- blackboard_delta: master trust-boundary spec now has a bounded first implementation plan for FR-001 through FR-006 and SA-001 through SA-006
- git_staging_status: unstaged
- staged_paths: none
- confidence: high that source IDs and first slice match the spec; medium that likely files are exact because implementation seam inspection has not started; blocked for Linear destination truth until refreshed

stage_arc_boundary:

- left_arc.source_of_truth: .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
- left_arc.entry_authority: explicit
- left_arc.freshness_required: fresh source artifact; live tracker state required before mutation
- left_arc.not_proof: plan text, chat, historical memory, raw telemetry, mailbox-only reviewer status
- active_arc.owned_stage: he-plan
- active_arc.allowed_actions: read source artifacts and write local .harness/plan artifact
- active_arc.forbidden_actions: product code edits, Linear mutation, GitHub mutation, commits, pushes, deployment, raw telemetry reads
- active_arc.mutation_boundary: local_artifact
- right_arc.handoff_target: he-work or he-code-review after user choice
- right_arc.handoff_artifact: .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md
- right_arc.proof_required: focused validation commands and review evidence from implementation branch
- right_arc.closure_boundary: not_closure
- right_arc.resume_key: JSC-331 plus .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md
- persona_lenses.coding_lens: required
- persona_lenses.testing_lens: required
- persona_lenses.coverage_parity_required: yes

## Appendix B. Linear / Tracker Handoff

### Linear Work Item Contract

- Linear issue: JSC-331
- Linear status: confirmation_required
- Mutation status: not performed
- Required confirmation: choose live destination before tracker writes
- Local plan status: active, unstaged

### Linear / Spec / Plan / PR Traceability

| Linear issue | Source acceptance IDs | Plan units | Acceptance IDs | PR evidence |
|---|---|---|---|---|
| JSC-331 | FR-001, FR-002, SA-001, SA-002 | PU-001 | SA-001, SA-002 | pending implementation PR |
| JSC-331 | FR-003, SA-003 | PU-002 | SA-003 | pending implementation PR |
| JSC-331 | FR-004, SA-004 | PU-003 | SA-004 | pending implementation PR |
| JSC-331 | FR-005, SA-005 | PU-004 | SA-005 | pending implementation PR |
| JSC-331 | FR-006, SA-006 | PU-005 | SA-006 | pending implementation PR |
| JSC-331 | FR-001 through FR-006 | PU-006 | SA-001 through SA-006 | pending implementation PR |

Ready Linear payload if mutation is later approved:

- Comment summary: Trust Boundary P0 plan created for FR-001 through FR-006 and SA-001 through SA-006; implementation remains blocked on explicit he-work authorization and live destination confirmation.
- Links: .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md and .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md

## Appendix C. Review Outcomes

Readiness review swarm run on 2026-05-23:

- agent-native-reviewer completed with artifact:
  artifacts/reviews/2026-05-23-jsc-331-trust-boundary-agent-native-reviewer.md
- cli-agent-readiness-reviewer completed with artifact after retry:
  artifacts/reviews/2026-05-23-jsc-331-trust-boundary-cli-agent-readiness-reviewer.md
- planning-specialist-agent failed artifact verification after the required
  one retry; mailbox findings were treated as advisory feedback, not completion
  evidence.

Findings incorporated in this readiness hardening:

- Replace absolute HE validator commands with repo-owned pnpm
  he:artifacts:validate wrapper.
- Pin command exit-code and stdout/stderr contracts for P0 validators.
- Add exact reviewer-coverage validator and test command targets for PU-005.
- Add public command-admission checklist to prevent early CLI surface expansion.
- Add minimum proof bundle and conditional pnpm run safety:local gate.

Recommended review before code handoff:

- harness-product-code-reviewer for runtime-card behavior and validator tests
- harness-dev-tools-reviewer for script/CLI ergonomics and JSON determinism
- api-contract-reviewer if command or schema surfaces become public
- agent-native-reviewer if outputs influence agent routing, closeout, or reviewer coverage

Validation status for this plan artifact:

- HE artifact wrapper: pass via pnpm he:artifacts:validate .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
- markdownlint: pass via pnpm exec markdownlint-cli2 .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
- validate-codestyle fast: pass via bash scripts/validate-codestyle.sh --fast
