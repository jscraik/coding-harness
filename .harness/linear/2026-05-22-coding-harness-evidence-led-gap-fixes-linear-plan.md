# Coding Harness Evidence-Led Gap Fixes Linear Plan

## Command Summary

BLUF: This plan routes the evidence-led codebase gap audit into a code-changing Linear execution lane for Jamie and future coding agents. It is not a docs-only plan; it defines implementation issues, likely source files, acceptance criteria, and validation gates so the missing harness behavior is implemented in the codebase. It blocks direct Linear mutation until the user confirms whether the active destination should remain Harness cockpit routing or whether the trashed legacy coding-harness project should be restored, because creating tracker work in the wrong project would recreate the same state-drift failure the audit is trying to fix.

Decision Needed: Confirm the Linear destination before mutation: use active project Harness cockpit routing, restore or replace the trashed coding-harness project, or create parentless JSC issues with only the verified coding-harness repo label.

Top Risks: The highest planning risk is creating duplicate or misfiled Linear work while the live repo project record is trashed. The highest implementation risk is leaving adopted research, runtime-card evidence, and reviewer coverage as prose-backed claims instead of enforced code paths.

Next Action: Start the Now slice as a parent issue plus two or three code implementation sub-issues after destination confirmation, then implement GAP-001, GAP-002, and GAP-003 before promoting broader closeout or observability work.

schema_version: 1

selected_stage: he-linear-plan

generated_at: 2026-05-22

source_artifact:
.harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md

linear_mutation_status: confirmation_required

live_linear_setup_status: blocked_destination_confirmation

live_linear_blocker: Live read-only probes found active project Harness cockpit routing, but the older coding-harness and Portfolio Ops project records are trashed. Creating or moving Linear records before the destination is confirmed could file implementation work into the wrong project history.

required_confirmation: Confirm one destination: Harness cockpit routing, restored coding-harness, or parentless JSC issues with the verified repo label coding-harness.

decision_artifact_status: present_source_audit

core_artifact_status: present_source_audit_and_evidence_manifest

source_prompt_family_status: not_applicable

subagent_policy: conditional_not_invoked_for_plan

roles_used: Codex coordinator, HE Linear Plan skill, read-only Linear probes.

roles_recommended: harness-product-code-reviewer, harness-dev-tools-reviewer, api-contract-reviewer, agent-native-reviewer.

roles_missing: none_required_for_local_plan; reviewer runtime coverage remains an implementation gap recorded as GAP-012.

git_staging_status: not_staged

staged_paths: []

## Table Of Contents

- [Command Summary](#command-summary)
- [Executive Linear Routing Summary](#executive-linear-routing-summary)
- [Target Linear Destination](#target-linear-destination)
- [Existing Project Match](#existing-project-match)
- [ADR / Decision Artifact Readiness](#adr--decision-artifact-readiness)
- [Core / Invariant Artifact Readiness](#core--invariant-artifact-readiness)
- [Proposed Milestones](#proposed-milestones)
- [Proposed Parent Issues](#proposed-parent-issues)
- [Proposed Sub-Issues](#proposed-sub-issues)
- [Now / Next / Later / Do Not Create](#now--next--later--do-not-create)
- [Dependency Map](#dependency-map)
- [Eval Gate Map](#eval-gate-map)
- [Human vs Agent Execution Map](#human-vs-agent-execution-map)
- [Story / Value Basis](#story--value-basis)
- [Recommended Labels](#recommended-labels)
- [Repo / Location Label](#repo--location-label)
- [Priority Mapping](#priority-mapping)
- [Project / Cycle Justification](#project--cycle-justification)
- [Project Reactivation Recommendation](#project-reactivation-recommendation)
- [Portfolio Ops Items](#portfolio-ops-items)
- [Dev Portfolio Impact](#dev-portfolio-impact)
- [GitHub PR Tracking](#github-pr-tracking)
- [Delivery Evidence](#delivery-evidence)
- [Evidence & Traceability Matrix](#evidence--traceability-matrix)
- [Visual References / Diagrams](#visual-references--diagrams)
- [Ready-To-Create Payloads](#ready-to-create-payloads)
- [Final Routing Decision](#final-routing-decision)

## Executive Linear Routing Summary

Route the audit into one parent execution lane, not twelve disconnected issues.
The first shippable slice must change source code. It should close GAP-001,
GAP-002, and GAP-003 because those gaps directly affect whether agents can
trust adopted evidence and runtime-card state. Treat GAP-011 and GAP-012 as the
next assurance layer, and treat full external observability as a later or
separate lane.

Recommended active shape:

1. One parent issue: [coding-harness] Close evidence-led harness trust-boundary gaps.
2. Two Now sub-issues: strict adopted-evidence validation, and runtime-card evidence truth hardening.
3. One optional Now or Next sub-issue: audit reference validation if browser-loading or stale-reference failure remains active.
4. One Next bundle for reviewer coverage receipts plus harness-run and session-closeout reachability.

Do not create a new project from this plan. Live Linear already has an active
Harness cockpit routing project and a trashed legacy coding-harness project;
the right action is destination confirmation, not another project shell.

## Target Linear Destination

Team:

- Jscraik, key JSC.

Recommended destination:

- Primary recommendation: attach to active project Harness cockpit routing.
- Alternative: restore or replace legacy project coding-harness, then attach
  the parent issue there.
- Fallback: create parentless JSC issues with label coding-harness and link the
  audit artifact in each description.

Status:

- live_linear_setup_status: blocked_destination_confirmation
- linear_mutation_status: confirmation_required
- template_status: template_inferred_not_live_verified
- label_status: partially_verified

Verified live records:

| Record | Live Status | Routing Impact |
|---|---|---|
| Harness cockpit routing | Active, In Progress, under Dev Portfolio | Best current project match for runtime-card, phase-exit, and evidence-gate trust-boundary work. |
| coding-harness project | trashed true, In Progress | Do not attach new work here unless the user explicitly restores or confirms it. |
| Portfolio Ops project | trashed true, Backlog | Not a safe destination for this repo-specific implementation lane. |
| JSC-311 | Related phase-exit evidence-gates issue | Existing context, not necessarily the parent for every audit gap. |
| JSC-328 | In Progress PR closeout evidence classifier | Related to closeout-grade evidence and should not be duplicated. |
| JSC-331 | Todo apparatus verifier persona lens | Related governance context, but not an exact match for strict evidence validation. |

## Existing Project Match

existing_project_match: active_project_found_with_legacy_project_trashed

The active match is Harness cockpit routing because the audit's highest-risk
gaps are runtime-card, phase-exit, closeout, and reviewer-coverage trust
boundaries. The legacy coding-harness project name matches the repo, but the
live Linear project is trashed, so it should be treated as historical context
until restored.

Duplicate-prevention rule:

- Do not create a second coding-harness or Portfolio Ops project.
- Do not create a new issue for work already owned by JSC-328 unless the new
  scope is strict evidence adoption or runtime-card source correctness.
- Link JSC-311, JSC-328, and JSC-331 in the parent issue as related context
  rather than assuming one of them is the parent without confirmation.

## ADR / Decision Artifact Readiness

decision_artifact_status: present_source_audit

No separate ADR is required before the Now slice. The audit already records the
decision boundary: runtime truth and strict evidence adoption must beat docs-only
claims. If later work changes project-level observability architecture or
introduces Vector and Victoria infrastructure, add or update an ADR before
implementation.

Decision artifact:

- .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md

## Core / Invariant Artifact Readiness

core_artifact_status: present_source_audit_and_evidence_manifest

Core invariants already exist in the source audit and evidence manifest:

- Adopted research must be backed by executable validation.
- Runtime-card evidence must preserve the worst relevant blocker or freshness state.
- Closeout-grade claims must be reachable through real command paths.
- Reviewer swarms must produce artifact-backed coverage, not mailbox-only completion claims.

The implementation should promote these invariants into validators, schemas,
tests, and command wiring before broader planning work continues.

## Proposed Milestones

### Milestone 1: Trust Boundary P0

Purpose: close the false-success and stale-provider defects that make agents
overtrust the audit and runtime-card state.

Included gaps:

- GAP-001
- GAP-002
- GAP-003

Codebase implementation:

- scripts/validate-evidence-patterns.cjs
- src/lib/runtime/runtime-evidence-adapter.ts
- src/lib/runtime/runtime-evidence-producer.ts
- src/lib/runtime/local-runtime-card-assembly.ts
- src/commands/runtime-card.test.ts
- src/lib/runtime/local-runtime-card.test.ts
- package.json if strict validation becomes a script or gate entry.

Acceptance:

- Strict adopted evidence validation exists and can fail adopted patterns whose validation commands are missing or fail.
- Runtime evidence source merge cannot hide a blocked or stale source behind synthetic provenance.
- Linear issue-key matching is case-normalized with a regression test.

### Milestone 2: Closeout Evidence Reachability

Purpose: turn tested evidence schemas and reviewer expectations into reachable
closeout proof.

Included gaps:

- GAP-004
- GAP-005
- GAP-011
- GAP-012

Codebase implementation:

- scripts/validate-audit-references.cjs
- src/commands/pr-closeout
- src/commands/evidence-verify.ts
- src/lib/contract
- src/lib/session
- src/lib/runtime/local-runtime-card-attempts.ts
- docs/agents/07b-agent-governance.md if governance surfaces change.

Acceptance:

- session-closeout/v1 or harness-run/v1 is accepted by a visible closeout gate.
- Audit reference verification has a deterministic command.
- Reviewer coverage has a structured receipt.

### Milestone 3: Mechanical Governance Hardening

Purpose: make advisory architecture and recovery guidance enforceable without
overbuilding the external observability stack.

Included gaps:

- GAP-006
- GAP-007
- GAP-008
- GAP-009
- GAP-010

Codebase implementation:

- scripts/check-architecture-rules.cjs
- .harness/research/evidence-patterns.json
- src/lib/cli/registry/command-capability-rules.ts
- docs/agents/04-validation.md
- harness.contract.json only if a gate or CI ownership contract changes.

Acceptance:

- Auth-boundary delegation is mechanically checked or allowlisted.
- Default command discovery is compact but useful.
- Retry classification is recorded for repeated failures.
- Full observability is explicitly tracked as future infrastructure, not implied current capability.

## Proposed Parent Issues

### Parent: [coding-harness] Close evidence-led harness trust-boundary gaps

Template: Governance / Policy

Team: JSC

Project: confirmation required

Recommended labels:

- coding-harness
- Governance
- Reliability
- Agent-Native

Priority: High

Problem:

The 2026-05-22 evidence-led audit found that core harness capabilities are
partially implemented but not always enforced. Adopted evidence validation,
runtime-card source merging, closeout evidence, audit references, and reviewer
coverage can still produce or preserve false-success signals.

Outcome:

Agents can follow the audit and implement missing code through a bounded issue
chain where each issue has a concrete gate and no gap is silently reclassified
as future work without an explicit routing reason.

## Proposed Sub-Issues

### Sub-Issue 1: Add strict adopted-evidence validation

Template: Governance / Policy

Maps to:

- GAP-001
- GAP-008

Priority: High

Implementation type: codebase change.

Recommended fix:

- Add strict mode to scripts/validate-evidence-patterns.cjs.
- Fail adopted patterns whose validationCommand is missing, non-runnable, or
  fails under strict mode.
- Add status classification for planning-only, enforcement-backed, and
  implementation-backed evidence patterns.
- Wire the strict command into the relevant repo gate after the first focused
  patch proves it.

Validation command:

~~~bash
node scripts/validate-evidence-patterns.cjs --strict-adopted --json
~~~

### Sub-Issue 2: Harden runtime-card evidence source truth

Template: Bug

Maps to:

- GAP-002
- GAP-003

Priority: High

Implementation type: codebase change.

Recommended fix:

- Change runtime evidence source merge precedence so blocked, stale, or worse
  evidence cannot be masked by synthetic provenance.
- Normalize issue-key comparisons when runtime-card assembly matches Linear
  evidence.
- Add tests for duplicate source kind/ref with worse status and mixed-case issue
  keys.

Validation command:

~~~bash
pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts
~~~

### Sub-Issue 3: Add audit reference verification

Template: Governance / Policy

Maps to:

- GAP-011

Priority: High

Implementation type: codebase change.

Recommended fix:

- Add scripts/validate-audit-references.cjs or equivalent.
- Validate referenced files, commands, and evidence artifacts in the audit.
- Return JSON so agents can use the command in closeout and CI.

Validation command:

~~~bash
node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json
~~~

### Sub-Issue 4: Promote run and session evidence into closeout gates

Template: Feature

Maps to:

- GAP-004
- GAP-005

Priority: Medium

Implementation type: codebase change.

Recommended fix:

- Make session-closeout/v1 or harness-run/v1 reachable through pr-closeout,
  evidence-verify, or a dedicated closeout command.
- Require closeout-grade command claims to cite a run/session artifact with
  exit/status consistency.

Validation command:

~~~bash
pnpm vitest run src/commands/pr-closeout.test.ts src/commands/evidence-verify.test.ts
~~~

### Sub-Issue 5: Add reviewer coverage receipts

Template: Governance / Policy

Maps to:

- GAP-012

Priority: Medium

Implementation type: codebase change.

Recommended fix:

- Add reviewer-coverage-receipt/v1.
- Record requested reviewers, completed reviewers, missing artifacts, blocked
  reviewers, retry state, and coordinator synthesis status.
- Make mailbox-only reviewer completion invalid when artifact-first review was
  requested.

Validation command:

~~~bash
pnpm vitest run src/lib/contract src/commands/review-gate.test.ts
~~~

### Sub-Issue 6: Classify governance and observability follow-through

Template: Research

Maps to:

- GAP-006
- GAP-007
- GAP-009
- GAP-010

Priority: Medium

Implementation type: mixed codebase change and decision classification.

Recommended fix:

- Add compact command-discovery hints without bloating the default rail.
- Convert auth-boundary delegation into a mechanical rule or explicit allowlist.
- Record retry classification and blind-retry prevention in run records.
- Keep full Vector and Victoria observability as a separate future lane unless
  local JSONL/runtime evidence first becomes enforcement-backed.

Validation command:

~~~bash
pnpm check
~~~

## Now / Next / Later / Do Not Create

### Now

- Create or select the parent execution issue after destination confirmation.
- Create Sub-Issue 1 and Sub-Issue 2.
- Optionally create Sub-Issue 3 in the same parent if browser-loading or stale
  audit-reference failures are still recurring this week.
- Implement code changes for the Now sub-issues before marking the audit lane
  as fixed.

### Next

- Create Sub-Issue 4 and Sub-Issue 5 after the Trust Boundary P0 slice lands.
- Attach them to JSC-328 if that issue remains the active PR closeout evidence
  owner; otherwise attach them to the new parent.

### Later

- Create Sub-Issue 6 only after the first two milestones prove the local
  evidence loop.
- Split external observability into a separate project or initiative only if the
  user wants Vector and Victoria infrastructure work, not merely local harness
  evidence enforcement.

### Do Not Create

- Do not create one issue per audit row.
- Do not create or duplicate a coding-harness project.
- Do not create full observability-stack implementation issues before local run,
  session, reviewer, and audit-reference evidence is enforced.
- Do not mutate Linear while project destination is blocked.

## Dependency Map

~~~mermaid
flowchart TD
  A["Parent: Close evidence-led trust-boundary gaps"] --> B["Strict adopted-evidence validation"]
  A --> C["Runtime-card evidence source truth"]
  A --> D["Audit reference verification"]
  B --> E["Closeout run/session evidence"]
  C --> E
  D --> F["Reviewer coverage receipts"]
  E --> G["Governance and observability follow-through"]
  F --> G
~~~

## Eval Gate Map

| Gate | Purpose | Required For |
|---|---|---|
| node scripts/validate-evidence-patterns.cjs --strict-adopted --json | Prove adopted research is validation-backed. | Sub-Issue 1 |
| pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts | Prove runtime-card evidence merge and issue matching behavior. | Sub-Issue 2 |
| node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json | Prove audit references load and remain current. | Sub-Issue 3 |
| pnpm vitest run src/commands/pr-closeout.test.ts src/commands/evidence-verify.test.ts | Prove closeout can consume run/session evidence. | Sub-Issue 4 |
| pnpm vitest run src/lib/contract src/commands/review-gate.test.ts | Prove reviewer receipts and contract schema behavior. | Sub-Issue 5 |
| pnpm check | Prove repo-wide validation after staged trust-boundary fixes. | Parent closeout |

## Human vs Agent Execution Map

| Work | Owner | Reason |
|---|---|---|
| Confirm Linear destination | Human | Live coding-harness project is trashed; project assignment is a tracker governance decision. |
| Create or update Linear records | Human-approved agent action | Mutation requires the destination confirmation above. |
| Implement GAP-001 through GAP-003 | Agent | Bounded code changes with direct validation gates. |
| Review implementation | Harness reviewers | Runtime-card, evidence validation, and closeout behavior are high-trust surfaces. |
| Decide external observability investment | Human | Full Vector and Victoria stack is product and infrastructure scope, not just a harness bug fix. |

## Story / Value Basis

The user value is trustworthy agent execution. If an agent follows the audit,
the audit must lead to missing code being implemented, not to another prose
artifact that allows false-success claims. The first slice makes adopted
research and runtime-card evidence harder to misread, which directly supports
Codex autonomy in future coding-harness work.

## Recommended Labels

label_status: partially_verified

Verified labels:

- coding-harness
- Governance
- Reliability
- Agent-Native

Recommended but not verified through the label probe:

- Policy
- Type Feature
- Type Bug
- Roadmap Next

If type or roadmap labels do not exist in the workspace, do not block issue
creation; use the verified governance and repo labels.

## Repo / Location Label

repo_location_label: coding-harness

The verified Linear label is coding-harness with parent Repo. Use this as the
repo/location label. Do not invent Repo / coding-harness as a separate label
unless the workspace is intentionally normalizing repo labels.

## Priority Mapping

| Audit Severity | Linear Priority | Issues |
|---|---|---|
| Critical trust boundary / false success | High | Sub-Issue 1, Sub-Issue 2, Sub-Issue 3 |
| Closeout reachability / reviewer evidence | Medium | Sub-Issue 4, Sub-Issue 5 |
| Discovery, retry, observability classification | Medium or Low | Sub-Issue 6 |

## Project / Cycle Justification

project_assignment_reason: Harness cockpit routing is the best live match for
runtime-card, closeout, and evidence-gate work, but mutation is blocked until
destination confirmation because the legacy coding-harness project is trashed.

cycle_assignment_reason: no cycle assignment recommended from this local plan.
Use the current JSC cycle only if the user confirms these gaps should enter the
current delivery window.

## Project Reactivation Recommendation

Do not reactivate the trashed coding-harness project automatically.

Recommended choices:

1. Confirm Harness cockpit routing as the active implementation project for
   this trust-boundary lane.
2. Restore the legacy coding-harness project only if the user wants a durable
   repo-wide project shell again.
3. Keep issues parentless with the coding-harness repo label if project cleanup
   should remain separate.

## Portfolio Ops Items

portfolio_ops_status: do_not_use_trashed_project

No Portfolio Ops item should be created from this plan. The live Portfolio Ops
project is trashed and this is repo-specific implementation work.

## Dev Portfolio Impact

This lane supports Dev Portfolio by hardening the coding-harness control plane
that future repo work depends on. The impact is strongest if attached to
Harness cockpit routing, because the current gaps directly affect lifecycle
routing, runtime-card truth, and closeout evidence.

## GitHub PR Tracking

github_tracking_rule: create one branch and PR for the Now slice after the
Linear parent or target issue is selected. Use a branch name that includes the
chosen Linear key, for example codex/JSC-XXX-evidence-led-gap-fixes.

PR requirements:

- Link the parent issue with Refs JSC-XXX until the issue is fully complete.
- Include validation evidence for each changed gate.
- Keep broader Next and Later issues linked but not claimed as fixed.

## Delivery Evidence

delivery_evidence_rule: Each issue must close with exact command output status,
changed files, and the runtime path exercised. Tests alone are not enough when
the implementation introduces a new CLI gate; the gate must be run directly.

Required evidence for Now closeout:

- Strict adopted evidence command run.
- Runtime-card focused tests run.
- Any new validator run against the 2026-05-22 audit.
- GitHub PR link and head SHA.
- Explicit statement of any gaps intentionally left in Next or Later.

## Evidence & Traceability Matrix

| Evidence | Source | Linear Handling |
|---|---|---|
| GAP-001 strict adopted validation | 2026-05-22 audit Gap Register | Now Sub-Issue 1 |
| GAP-002 runtime evidence dedupe | 2026-05-22 audit Gap Register | Now Sub-Issue 2 |
| GAP-003 issue-key normalization | 2026-05-22 audit Gap Register | Now Sub-Issue 2 |
| GAP-004 session-closeout reachability | 2026-05-22 audit Gap Register | Next Sub-Issue 4 |
| GAP-005 harness-run operational gate | 2026-05-22 audit Gap Register | Next Sub-Issue 4 |
| GAP-006 compact command catalog | 2026-05-22 audit Gap Register | Later Sub-Issue 6 |
| GAP-007 auth-boundary enforcement | 2026-05-22 audit Gap Register | Later Sub-Issue 6 |
| GAP-008 manifest status classification | 2026-05-22 audit Gap Register | Now Sub-Issue 1 |
| GAP-009 retry budget | 2026-05-22 audit Gap Register | Later Sub-Issue 6 |
| GAP-010 external observability | 2026-05-22 audit Gap Register | Later or separate lane |
| GAP-011 audit references | 2026-05-22 audit Gap Register | Now or Next Sub-Issue 3 |
| GAP-012 reviewer coverage receipt | 2026-05-22 audit Gap Register | Next Sub-Issue 5 |

## Visual References / Diagrams

No external visual reference is required for the Now slice. The user-provided
observability and agent-knowledge diagrams support the Later classification:
first make local evidence authoritative, then consider broader observability
infrastructure.

## Ready-To-Create Payloads

ready_to_create_payloads_status: unapplied_confirmation_required

These payloads are intentionally not applied.

~~~yaml
parent_issue:
  template: Governance / Policy
  team: JSC
  title: "[coding-harness] Close evidence-led harness trust-boundary gaps"
  project: "CONFIRM: Harness cockpit routing or restored coding-harness"
  priority: High
  labels:
    - coding-harness
    - Governance
    - Reliability
    - Agent-Native
  description: |
    The 2026-05-22 evidence-led audit found enforceability gaps in adopted
    research validation, runtime-card evidence merging, closeout evidence,
    audit references, and reviewer coverage. This parent tracks the bounded
    implementation lane that turns the audit into code-backed trust boundaries.
~~~

~~~yaml
sub_issues:
  - template: Governance / Policy
    title: "Add strict adopted-evidence validation"
    priority: High
    labels: [coding-harness, Governance, Reliability]
    gaps: [GAP-001, GAP-008]
    validation: "node scripts/validate-evidence-patterns.cjs --strict-adopted --json"
  - template: Bug
    title: "Harden runtime-card evidence source truth"
    priority: High
    labels: [coding-harness, Reliability, Agent-Native]
    gaps: [GAP-002, GAP-003]
    validation: "pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts"
  - template: Governance / Policy
    title: "Add audit reference verification"
    priority: High
    labels: [coding-harness, Governance, Reliability]
    gaps: [GAP-011]
    validation: "node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json"
  - template: Feature
    title: "Promote run and session evidence into closeout gates"
    priority: Medium
    labels: [coding-harness, Reliability, Agent-Native]
    gaps: [GAP-004, GAP-005]
    validation: "pnpm vitest run src/commands/pr-closeout.test.ts src/commands/evidence-verify.test.ts"
  - template: Governance / Policy
    title: "Add reviewer coverage receipts"
    priority: Medium
    labels: [coding-harness, Governance, Agent-Native]
    gaps: [GAP-012]
    validation: "pnpm vitest run src/lib/contract src/commands/review-gate.test.ts"
  - template: Research
    title: "Classify governance and observability follow-through"
    priority: Medium
    labels: [coding-harness, Governance, Reliability]
    gaps: [GAP-006, GAP-007, GAP-009, GAP-010]
    validation: "pnpm check"
~~~

## Final Routing Decision

decision: needs_human_confirmation_before_linear_mutation

Use this plan as the execution bridge from the audit into Linear. The safest
first mutation is to create or select the parent issue in Harness cockpit
routing, then create the two Now sub-issues for strict evidence validation and
runtime-card truth. The plan should not be treated as permission to leave audit
gaps unimplemented; it is a routing artifact that makes each remaining gap
explicitly owned, sequenced, and validation-backed.
