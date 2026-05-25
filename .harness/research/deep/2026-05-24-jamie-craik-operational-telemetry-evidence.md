# Jamie Craik Operational Telemetry Evidence Extraction

Generated: 2026-05-24

Primary source set:

- .harness/implementation-notes/2026-05-20-steering-admission.md
- .harness/implementation-notes/2026-05-21-full-implementation-downscope-steering-admission.md
- .harness/implementation-notes/2026-05-23-pr-285-conflict-routing-admission.md
- .harness/implementation-notes/2026-05-24-root-scaffold-tidy-steering-admission.md
- .harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html

Supporting source set:

- .harness/implementation-notes/README.md
- .harness/research/deep/2026-05-18-praveen-govindaraj-evidence.md
- .harness/research/deep/2026-05-22-harness-source-synthesis-evidence.md

Source boundary:

- This extraction uses implementation notes and steering admissions as forensic
  evidence of a human-agent operating loop. It is not a raw transcript summary.
- The attached/current-session transcript was not available as a separate local
  file in this workspace pass, so this report treats the repo's dated
  implementation notes as the auditable transcript-derived evidence surface.
- Implementation notes are secondary context unless an active plan, spec,
  decision, validator, or gate promotes a rule from them
  (.harness/implementation-notes/README.md:16-17).
- Existing untracked research files were observed but not modified or used as
  authority for this extraction.

Evidence labels:

- Explicit evidence: directly stated in a cited implementation note or report.
- Inferred insight: derived from repeated behavior, workflows, tool choices, or
  constraints recorded in the evidence set.
- Speculative interpretation: plausible system-design extrapolation that should
  be validated before becoming repo policy or product behavior.

Confidence labels:

- High confidence: directly supported by cited repo evidence.
- Medium confidence: supported by the evidence but translated into a reusable
  implementation pattern.
- Low confidence: useful extrapolation beyond the available source set.

## Table of Contents

- [Executive Summary](#executive-summary)
- [Core Engineering Patterns](#core-engineering-patterns)
- [Tooling And Ecosystem](#tooling-and-ecosystem)
- [Harness Engineering Insights](#harness-engineering-insights)
- [Implied Best Practices](#implied-best-practices)
- [Failure Modes And Mitigations](#failure-modes-and-mitigations)
- [Reusable Techniques](#reusable-techniques)
- [Strategic Insights](#strategic-insights)
- [Key Quotes And Evidence](#key-quotes-and-evidence)
- [Final Assessment](#final-assessment)

## Executive Summary

The strongest engineering signal is that Jamie treats repeated correction as an
environment defect, not as a conversational annoyance. The repo has already
absorbed this principle into steering-admission artifacts and the
`docs:steering:guard` validator: repeated human steering must become a durable
surface such as a validator, schema, workflow rule, recovery handler, CI gate,
repo artifact, skill improvement, or tracked exception. This is explicit in the
May 20 steering admission and reinforced by the May 24 ROOT/scaffold admission
(.harness/implementation-notes/2026-05-20-steering-admission.md:16-24,
.harness/implementation-notes/2026-05-24-root-scaffold-tidy-steering-admission.md:109-113).

The central failure pattern is claim-vs-evidence drift. The agent repeatedly
collapsed wider delivery claims into narrower local proof: ROOT/scaffold cleanup
was treated as complete from source-map evidence, full implementation was
downscoped into a smallest mergeable slice without explicit authority, and PR
delivery focus drifted toward adjacent review work before live mergeability was
separated into local, remote, and branch truths. The recurring remedy is a
typed evidence ladder: decompose the claim, identify the authoritative surface,
run the narrow proof, record blockers separately, and refuse completion until
the current evidence supports the exact claim.

JSC-331 turns this into a mature harness workflow. The plan starts with fresh
goal-board authority instead of stale boards, reconciles runtime state before
implementation, limits tracker mutation until evidence exists, requires seam
discovery before code changes, preserves unrelated dirty work, uses subagent
review artifacts as proof, and adds validators when the trust boundary has no
current executable enforcement. The system direction is clear: agents should not
be trusted to remember corrections; the harness should make incorrect future
behavior harder to execute and easier to detect.

The highest-leverage implementation opportunity is to promote the current
markdown admission pattern into structured receipts: `steering-signal/v1`,
`root-hygiene-classification/v1`, `delivery-truth/v1`, and
`scope-authority/v1`. These would preserve the existing human-readable
workflow while letting CI and agent tooling fail closed when claims, evidence,
scope, branch state, PR state, or audit authority diverge.

## Core Engineering Patterns

### Pattern: Steering Feedback As Operational Telemetry

#### Description

Treat every repeated correction, clarification, or recovery hint as evidence
that the environment failed to prevent recurrence. The agent must stop normal
implementation long enough to identify the feedback signal, root operational
failure, failure category, durable destination, guardrail, validation command,
and review condition.

#### Evidence

- Explicit evidence: Jamie's steering was recorded as "high-signal operational
  telemetry" and ordinary implementation was blocked until the repeated behavior
  was admitted into the repo operating system
  (.harness/implementation-notes/2026-05-20-steering-admission.md:16-24).
- Explicit evidence: The durable improvement promoted the correction into an
  implementation note and a steering guard validating required proof fields
  (.harness/implementation-notes/2026-05-20-steering-admission.md:57-73).
- Explicit evidence: The forbidden recurrence says not to resume by saying the
  agent will remember
  (.harness/implementation-notes/2026-05-20-steering-admission.md:88-97).

#### Why It Matters

Prompt-only correction does not scale. A harness that records repeated steering
as a typed defect can reduce future steering load, make reviewer expectations
auditable, and separate genuine blockers from agent forgetfulness.

#### Implementation Opportunities

- Add a `steering-signal/v1` schema with fields for signal, failure category,
  searched surfaces, durable destination, guard, validation outcome, and expiry
  condition.
- Teach closeout tooling to require a steering-signal reference when PR bodies
  mention repeated steering or high-signal correction.
- Add a command such as `harness steering admit --json` that emits both a
  markdown note and machine-readable receipt.
- Fail `docs:steering:guard` when a steering admission lacks a validating gate
  or tracked exception.

#### Risks / Tradeoffs

- High confidence: without selection pressure, every small preference could
  become ceremony.
- Medium confidence: agents may learn to write admissions without changing the
  system if validators only check headings.
- Medium confidence: over-indexing on meta-work can delay urgent product fixes.

### Pattern: Claim-Vs-Evidence Closeout

#### Description

Before claiming completion, decompose the claim into evidence surfaces and prove
each one separately. Local code, remote checks, review threads, tracker state,
branch/worktree state, mergeability, generated artifacts, and goal state are
separate truths.

#### Evidence

- Explicit evidence: ROOT/scaffold recovery failed because a source-map PR was
  accepted as proof of broader ROOT cleanup without classifying top-level files,
  tracked directories, ignored local clutter, and generated evidence surfaces
  (.harness/implementation-notes/2026-05-24-root-scaffold-tidy-steering-admission.md:28-43).
- Explicit evidence: PR conflict routing failed because mergeability, local
  branch cleanliness, and active-review URL state were not separated into
  distinct truths
  (.harness/implementation-notes/2026-05-23-pr-285-conflict-routing-admission.md:17-23).
- Explicit evidence: JSC-331 closeout recorded PR, check, review-thread, Linear,
  main-branch, and Judge/PM receipt truth together
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:552-559).

#### Why It Matters

Agents often report the strongest available proof as if it proves the whole
request. Separating evidence surfaces prevents local validation from being
mistaken for merge readiness, source-map proof from being mistaken for root
hygiene, and a sibling recovery PR from being mistaken for the referenced PR.

#### Implementation Opportunities

- Create `delivery-truth/v1` with required fields for local state, remote check
  state, review state, tracker state, branch/worktree state, and merge readiness.
- Require closeout reports to mark each surface `pass`, `fail`, `blocked`,
  `unknown`, or `not_applicable` with source, timestamp, and head SHA.
- Add a PR handoff guard that refuses "ready", "green", "merged", or "complete"
  language when any required surface is stale or unobserved.

#### Risks / Tradeoffs

- High confidence: stale evidence can still mislead if receipts omit freshness.
- Medium confidence: broad closeout matrices can be heavy for small local tasks.
- Medium confidence: external systems such as GitHub checks and Linear can be
  rate-limited or unavailable, requiring explicit unknown states.

### Pattern: Non-Destructive Root Hygiene Classification

#### Description

Root cleanup is not deletion by intuition. It requires classifying every
top-level tracked file or directory as canonical root, generated but tracked
intentionally, should move, legacy/drift, ignored local clutter, or deferred with
owner and reason.

#### Evidence

- Explicit evidence: The May 24 admission says future ROOT/scaffold closeout
  must include a root-hygiene evidence table or equivalent structured
  classification
  (.harness/implementation-notes/2026-05-24-root-scaffold-tidy-steering-admission.md:68-88).
- Explicit evidence: Forbidden recurrence says not to claim ROOT is tidy until
  top-level tracked files and directories are classified, moved or intentionally
  retained, and validated through docs/governance gates
  (.harness/implementation-notes/2026-05-24-root-scaffold-tidy-steering-admission.md:99-107).

#### Why It Matters

Repository roots are agent navigation surfaces. A messy root increases context
noise, but destructive cleanup can remove evidence, break references, or erase
governance history. Classification makes the cleanup reversible, reviewable, and
auditable.

#### Implementation Opportunities

- Add `docs/architecture/root-surface-classification.md` rows generated from
  `git ls-files` and top-level directory inspection.
- Add `root-hygiene-classification/v1` with categories, owner, move target,
  reference-update status, and validation command.
- Add a docs-gate check that root moves update docs indexes and governance
  references before merge.
- Use a non-destructive first slice for low-risk drift such as temporary
  directories, root task backlog artifacts, or unreferenced reports.

#### Risks / Tradeoffs

- High confidence: root cleanup can become architecture churn if it lacks a
  narrow first slice.
- High confidence: deletion without historical archive violates the evidence
  preservation posture.
- Medium confidence: generated tracked artifacts need explicit retention rules
  or agents may repeatedly try to move them.

### Pattern: Fresh Authority Before Implementation

#### Description

When prior artifacts exist, do not reuse them blindly. Reconcile active goal
state, board state, plan/spec authority, Linear destination, dirty worktree, and
runtime capabilities before implementation begins.

#### Evidence

- Explicit evidence: JSC-331 created a fresh board instead of reusing older
  boards because existing boards targeted earlier May 18 and May 20 artifacts
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:46-60).
- Explicit evidence: T001 was made a governor/scout reconciliation task so
  runtime state was verified before implementation
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:53-56).
- Explicit evidence: the native goal was created only after the board validated
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:86-105).

#### Why It Matters

Agent execution is vulnerable to stale plans. Fresh authority prevents old
boards, outdated specs, stale artifacts, or previous session state from silently
governing a new implementation pass.

#### Implementation Opportunities

- Add a `goal-authority-reconciliation/v1` receipt before implementation work
  that touches active plan/spec/Linear state.
- Require a stale-board rejection reason when creating a fresh board.
- Make active-artifact routing fail closed when referenced plan/spec dates do
  not match the current objective.
- Record runtime tool availability as part of the pre-implementation ledger.

#### Risks / Tradeoffs

- High confidence: fresh boards can proliferate if older artifacts are not
  closed or superseded.
- Medium confidence: reconciliation can feel like delay unless it produces a
  clear go/no-go result.
- Medium confidence: active goals and tracker state can diverge when one system
  mutates outside the other.

### Pattern: Seam Discovery Before Code Mutation

#### Description

Before implementation, identify the narrowest existing seams that satisfy the
plan, reject public-surface expansion unless needed, and record selected and
rejected paths.

#### Evidence

- Explicit evidence: Runtime implementation was blocked until T002 recorded
  selected and rejected seams
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:135-143).
- Explicit evidence: T002 selected internal seams such as
  `scripts/validate-evidence-patterns.cjs`, runtime-card assembly, and missing
  validator scripts while rejecting public CLI expansion and authority changes
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:206-248).

#### Why It Matters

Agents often solve by adding new surfaces. Seam discovery keeps changes inside
existing ownership boundaries, reduces public API churn, and preserves advisory
versus authoritative distinctions.

#### Implementation Opportunities

- Add a `seam-discovery/v1` table to governed plans with selected seam,
  rejected path, reason, and authority impact.
- Require public CLI additions to cite a command-admission decision.
- Add architecture review checks that compare implementation files against the
  approved seam list.

#### Risks / Tradeoffs

- High confidence: too much seam discipline can prevent necessary new
  abstractions.
- Medium confidence: rejecting public surfaces can hide useful capabilities in
  scripts unless documentation and discoverability are handled.
- Medium confidence: seam receipts must be updated when review findings reveal a
  better path.

### Pattern: Validator Creation As Trust-Boundary Repair

#### Description

When a trust boundary lacks executable proof, add or strengthen the validator
instead of treating planned proof as current evidence.

#### Evidence

- Explicit evidence: T002 found that unknown flags were ignored by
  `validate-evidence-patterns.cjs`; PU-001 had to make `--strict-adopted` real
  and fail closed
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:251-255).
- Explicit evidence: T003 changed the validator to execute adopted evidence
  commands, reject unknown flags with usage status, and summarize evidence
  states
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:258-277).
- Explicit evidence: T006 added `validate-audit-references.cjs` as a
  script-backed validator instead of adding a public harness CLI
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:426-440).

#### Why It Matters

Trust boundaries become real when they can fail. Unknown flags, mailbox-only
review text, stale references, and planned future validators are not evidence
until an executable gate classifies them.

#### Implementation Opportunities

- Prefer small validators over broad prompt updates for repeated failures.
- Ensure validators emit exactly one JSON object, map exit codes to pass,
  blocked/fail, and usage error, and cover real artifact inputs.
- Add regression tests for false-pass paths discovered during review.
- Distinguish declared validation commands from executed commands in evidence
  reports.

#### Risks / Tradeoffs

- High confidence: validators can become too narrow if they only encode the last
  failure.
- Medium confidence: script-backed validators need discoverability so agents
  know when to run them.
- Medium confidence: executing validation commands can introduce environment
  dependency and runtime cost.

### Pattern: Artifact-First Subagent Review

#### Description

Subagent review is valid only when it leaves inspectable artifacts. Mailbox text,
historical reports, or status snippets are not proof.

#### Evidence

- Explicit evidence: T003 review proof required reviewers to write artifact
  reports under `artifacts/reviews/`, with valid findings repaired before close
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:284-289).
- Explicit evidence: T005 product review needed an artifact-only retry because
  mailbox status text is not proof
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:403-409).
- Explicit evidence: T008 reviewer coverage validator fails closed for missing,
  empty, blocked, mailbox-only, and incomplete-synthesis reviewer evidence
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:540-549).

#### Why It Matters

Multi-agent workflows create false confidence when coordinator summaries are
treated as review output. Artifact-first review makes coverage, blockers,
findings, and remediation independently inspectable.

#### Implementation Opportunities

- Require a reviewer manifest listing expected, present, empty, blocked, and
  failed artifacts.
- Add a `reviewer-coverage-receipt/v1` gate to PR closeout.
- Teach coordinators to retry missing artifacts once, then record coverage gaps.
- Keep local-only bulky review artifacts out of merge proof while tracking their
  validators and summaries in portable surfaces.

#### Risks / Tradeoffs

- High confidence: review artifacts can become noisy if not severity-ranked.
- Medium confidence: local-only artifact storage can weaken reproducibility
  unless portable summaries and validators remain tracked.
- Medium confidence: reviewer swarms need bounded roles or they can outgrow the
  slice.

### Pattern: Dirty Worktree Isolation

#### Description

Separate current-slice changes from unrelated dirty work. Preserve unrelated
local modifications, classify branch-drift risk, and avoid staging or reverting
work outside the active slice.

#### Evidence

- Explicit evidence: T001 recorded `.harness/memory/LEARNINGS.md` as unrelated
  dirty work that must be preserved
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:167-173).
- Explicit evidence: Git triage classified continuation on `main` with mixed
  dirty state as high branch-drift risk and required a branch before runtime
  edits
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:298-310).
- Explicit evidence: T005 remote readiness remained blocked partly by
  dirty-worktree isolation risk from unrelated `.harness/memory/LEARNINGS.md`
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:411-415).

#### Why It Matters

Agentic workflows often operate in shared worktrees. Without explicit dirty
state handling, agents can stage user work, revert unrelated changes, or ship a
branch whose proof includes accidental files.

#### Implementation Opportunities

- Add a pre-stage dirty-ledger step that lists tracked modified, untracked, and
  ignored local surfaces with ownership classification.
- Require PR body validation to include an unrelated-dirty-state note when
  present.
- Add a worktree isolation check before branch publication and before deleting
  worktrees.

#### Risks / Tradeoffs

- High confidence: excessive caution can leave stale untracked clutter forever.
- Medium confidence: classifying ownership is hard when files overlap active
  scope.
- Medium confidence: local-only dirty ledgers should not leak private content.

### Pattern: Scope Authority Before Downscope

#### Description

When the user asks for full implementation, the agent may not silently translate
the request into gap tracking, advisory work, or the smallest independently
mergeable slice. Any downscope must be explicit, recorded, and reflected in the
audit or closeout artifact.

#### Evidence

- Explicit evidence: Jamie challenged the audit loop after a full implementation
  request was classified as gap tracking
  (.harness/implementation-notes/2026-05-21-full-implementation-downscope-steering-admission.md:15-24).
- Explicit evidence: the root failure was that the audit path normalized
  unimplemented code work as advisory next work
  (.harness/implementation-notes/2026-05-21-full-implementation-downscope-steering-admission.md:26-32).
- Explicit evidence: forbidden recurrence bars silently translating full
  implementation into advisory next work or a smallest-slice boundary
  (.harness/implementation-notes/2026-05-21-full-implementation-downscope-steering-admission.md:77-83).

#### Why It Matters

Small slices are useful only when they preserve user authority. Silent downscope
turns delivery planning into an unapproved product decision and can make agents
look complete while known work remains undone.

#### Implementation Opportunities

- Add `scope-authority/v1` with requested scope, implemented scope, deferred
  scope, user-approved downscope, and validation status.
- Require audit artifacts to include "unfinished full-implementation scope" when
  a known downscope exists.
- Add a closeout linter that blocks "gap register" or "next slice" language when
  user-requested implementation was not completed.

#### Risks / Tradeoffs

- High confidence: full implementation requests can be too broad for one PR, so
  downscope sometimes remains necessary.
- Medium confidence: requiring explicit authority can slow work when the
  practical slice boundary is obvious.
- Medium confidence: audits need a clear distinction between deferred work and
  advisory ideas.

## Tooling And Ecosystem

### Repository And Version Control

#### Git

Purpose: source-of-truth inspection, diff validation, branch isolation,
mergeability repair, and dirty-state classification.

Workflow role: used for `git diff --check`, branch-scoped PR preparation,
conflict probes, and preserving unrelated dirty work.

Integration opportunities: add dirty-ledger receipts, branch-drift risk
classification, and pre-stage ownership checks to harness closeout.

Best practices: inspect current root, branch, and dirty state before edits;
never stage unrelated modifications; use branch-scoped proof before publishing.

Strengths: deterministic local truth and exact diff visibility.

Limitations: local truth does not prove remote PR state, review state, or
tracker state.

#### GitHub PRs And Checks

Purpose: remote delivery surface for PR state, mergeability, CI, review threads,
and PR body contract.

Workflow role: PR conflict routing requires live `mergeStateStatus),
`headRefName`, `headRefOid`, state, and draft status probes
(.harness/implementation-notes/2026-05-23-pr-285-conflict-routing-admission.md:39-43).

Integration opportunities: emit `delivery-truth/v1` from `gh pr view`,
checks, review threads, and branch metadata.

Best practices: re-read live PR state after push; do not rely on sibling PRs as
implicit proof; distinguish non-draft open PRs from draft handoff assumptions.

Strengths: authoritative remote state for mergeability and checks.

Limitations: external API availability, stale local assumptions, and status
latency.

### Tracker And Goal Systems

#### Linear

Purpose: issue destination, lifecycle state, comments, and closeout authority.

Workflow role: JSC-331 limited Linear mutation until implementation evidence
existed and later recorded Done state only after explicit closeout authority
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:57-60,
.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:552-559).

Integration opportunities: tracker-state field in `delivery-truth/v1`;
issue-key normalization that preserves display keys while matching
case-insensitively.

Best practices: do not mutate tracker state before implementation evidence;
preserve display values from external providers; mark explicit closeout
authority.

Strengths: durable project coordination and human-visible state.

Limitations: tracker state can be stale relative to branch/PR reality.

#### Native Codex Goal

Purpose: runtime objective tracking for goal-governed execution.

Workflow role: JSC-331 created the native goal only after the goal board
validated, then kept it open until Judge/PM closeout
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:86-99,
.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:135-143).

Integration opportunities: synchronize native goal status with board receipts,
PR closeout, and audit authority.

Best practices: bind a goal to a validated board; do not mark complete without
required audit authority.

Strengths: keeps runtime objective visible across turns.

Limitations: goal state alone does not prove repository, PR, or tracker state.

### Validation And Gate Tooling

#### `pnpm run docs:steering:guard`

Purpose: validates steering admission records and prevents repeated steering
from remaining only chat memory.

Workflow role: evidence source for May 20, May 21, and May 24 admissions.

Integration opportunities: extend from markdown admission validation toward a
typed `steering-signal/v1` schema.

Best practices: run after any steering admission or repeated-correction
artifact.

Strengths: deterministic enforcement of meta-behavior fields.

Limitations: heading/phrase validation can prove artifact shape before it proves
behavioral adoption.

#### Goal-Board Validator

Purpose: validates governed goal board structure before runtime goal binding.

Workflow role: JSC-331 used `check_goal_board.py` before creating the native
goal and starting implementation
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:108-114).

Integration opportunities: emit board identity, active task, receipts, and stale
artifact warnings as machine-readable authority input.

Best practices: validate before implementation; create fresh boards when older
boards target stale source artifacts.

Strengths: prevents stale or malformed goal state from governing work.

Limitations: board validity is not implementation proof.

#### `pnpm he:artifacts:validate`

Purpose: validates plan/spec identity, traceability, BLUF structure, and
artifact shape.

Workflow role: used in JSC-331 T001 and T003 to prove active plan/spec surfaces
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:115-120,
.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:280-283).

Integration opportunities: add plan/spec freshness and active-artifact
cross-checks.

Best practices: run before relying on plan/spec authority.

Strengths: gives structured validation for planning artifacts.

Limitations: validates document contract, not runtime behavior.

#### `validate-evidence-patterns.cjs`

Purpose: validates research/evidence-pattern records and, after hardening,
executes strict adopted-evidence commands.

Workflow role: trust-boundary validator repaired after unknown flags were found
to false-pass
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:251-277).

Integration opportunities: use adopted-evidence execution as a promotion gate
from research pattern to durable harness rule.

Best practices: reject unknown flags, distinguish declared from executed
commands, and report canonical evidence states.

Strengths: turns evidence adoption from prose into runnable proof.

Limitations: command execution can be slow or environment-sensitive.

#### `validate-audit-references.cjs`

Purpose: validates that audit references point to tracked, concrete, current
files.

Workflow role: T006 added this as `audit-reference-report/v1` with exit-code
semantics and real artifact proof
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:426-491).

Integration opportunities: run against research, audit, PR-body, and closeout
artifacts that cite repo files.

Best practices: block missing, ignored, untracked, broad directory, and stale
references; include real artifact regression tests.

Strengths: prevents citation-shaped but non-existent proof.

Limitations: cannot judge whether cited evidence semantically supports the
claim.

#### `validate-reviewer-coverage.cjs`

Purpose: validates reviewer artifact completeness and blocks mailbox-only
evidence.

Workflow role: T008 added `reviewer-coverage-receipt/v1`
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:540-549).

Integration opportunities: required input to PR closeout when subagent triage or
review swarm is part of the plan.

Best practices: fail closed for missing, empty, blocked, mailbox-only, and
incomplete synthesis evidence.

Strengths: makes subagent review auditable.

Limitations: artifact presence does not guarantee reviewer quality.

#### Markdownlint And `git diff --check`

Purpose: documentation format and whitespace validation.

Workflow role: JSC-331 used markdownlint for goal notes and `git diff --check`
for goal and implementation-note changes
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:121-132).

Integration opportunities: run on newly created research reports and changed
governance docs.

Best practices: validate only touched files when the repo contains unrelated
dirty work.

Strengths: fast, deterministic hygiene proof.

Limitations: formatting proof is not content correctness.

### Review And Agent Coordination

#### Harness Reviewer Agents

Purpose: architecture, simplicity, testing, product, devtools, docs-language, and
standards review roles for bounded slice review.

Workflow role: JSC-331 required artifact reports and repaired valid high/medium
findings before slice closeout
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:284-289,
.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:493-501).

Integration opportunities: reviewer-coverage manifests, artifact probes, and
role-specific required outputs.

Best practices: use artifact-first outputs, retry missing artifacts once, and
record coverage gaps explicitly.

Strengths: parallelizes specialist review and surfaces blind spots.

Limitations: can create coordination overhead and local-only artifacts.

#### Browser Automation Tool

Purpose: render/verify HTML and UI artifacts.

Workflow role: JSC-331 recorded that the required browser automation tool was not
exposed in that turn, so the HTML ledger should be rendered later when tooling
is available
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:101-105).

Integration opportunities: tool-availability snapshots and deferred render
validation tasks.

Best practices: classify unavailable runtime tools explicitly; do not pretend a
rendered artifact was inspected.

Strengths: catches visual/rendering errors that static validation misses.

Limitations: tool availability can vary across sessions.

### Memory And Research Surfaces

#### .harness Implementation Notes

Purpose: dated execution notes, admissions, and implementation evidence.

Workflow role: source material for this extraction and for prior steering
admissions.

Integration opportunities: transition repeated admission patterns into typed
schemas and validators.

Best practices: treat notes as secondary context unless promoted by a plan,
spec, decision, or validator
(.harness/implementation-notes/README.md:11-17).

Strengths: preserves why work changed shape and where follow-up ownership lives.

Limitations: can be overtrusted if authority boundaries are not explicit.

#### .harness Research Deep Reports

Purpose: durable engineering-intelligence extraction from transcripts, research,
and source synthesis.

Workflow role: format examples and research context for this artifact.

Integration opportunities: connect research insights to evidence-pattern
promotion and validator adoption.

Best practices: separate explicit evidence, inferred insight, speculative
interpretation, and confidence labels.

Strengths: captures reusable patterns beyond task-specific implementation.

Limitations: research is not policy until promoted.

## Harness Engineering Insights

### Orchestration

- High confidence: Orchestration should begin with authority reconciliation, not
  coding. JSC-331 created a fresh board, validated it, bound a native goal, and
  only then moved to seams and implementation.
- High confidence: Slice boundaries need explicit commit/PR/triage handoffs when
  the plan says so. Jamie's correction about subagent git triage and commit/PR
  boundaries was recorded as governance feedback
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:503-511).
- Medium confidence: A mature harness should expose a "next authorized action"
  primitive that combines board state, branch state, PR state, and reviewer
  coverage into one machine-readable recommendation.

### Validation

- High confidence: Validators should fail closed for unknown flags, missing
  artifacts, mailbox-only review proof, stale references, and broad directory
  references.
- High confidence: Declared validation and executed validation are separate
  fields. The T003 review explicitly preserved that distinction because the plan
  required it
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:291-296).
- Medium confidence: Adopted research patterns should require a runnable command
  or a tracked exception before being treated as harness authority.

### Context

- High confidence: The system prefers repo evidence over chat memory. Steering
  admissions, root-hygiene rules, PR conflict routing, and JSC-331 receipts all
  convert conversation into repo artifacts.
- High confidence: Source boundaries matter. Implementation notes explicitly
  define themselves as secondary context unless promoted.
- Medium confidence: Future context-loading should prioritize active
  validators, active plans/specs, goal boards, and recent steering admissions
  over older synthesis reports.

### Routing

- High confidence: Routing must respect authority boundaries: tracker mutation
  after evidence, implementation after reconciliation, public CLI after command
  admission, closeout after Judge/PM audit when required.
- Medium confidence: User phrases like "ROOT", "full implementation", "merge
  conflict", and "PR green sweep" should map to specific workflow routes rather
  than generic progress reporting.
- Medium confidence: A request classifier could map repeated steering into
  failure categories and recommended durable destinations.

### Memory

- High confidence: Memory is valuable only when source-of-truth boundaries are
  preserved. The JSC-331 workflow preserved unrelated `.harness/memory` changes
  instead of staging or reverting them.
- Medium confidence: Memory surfaces should hold distilled lessons, while
  validators and schemas hold enforcement.
- Low confidence: A memory-index freshness score could help agents decide when
  to rely on prior research versus re-reading current repo state.

### Evals

- High confidence: The repo uses real artifact validation as an eval proxy:
  strict adopted-evidence mode, audit-reference validation, reviewer-coverage
  validation, and focused Vitest regressions all test failure cases discovered in
  execution.
- Medium confidence: Future evals should replay prior steering failures and
  assert that the current harness routes to the durable guard before normal
  implementation.
- Medium confidence: Agent coordination evals should include mailbox-only
  review text, missing reviewer artifacts, dirty worktree state, stale PR state,
  and silent downscope traps.

### Governance

- High confidence: Governance is implemented through layered authority:
  research, implementation notes, active plans/specs, validators, CI gates, and
  explicit audit receipts.
- High confidence: PR closeout is not equivalent to green checks; JSC-331
  required PR state, review threads, Linear state, main-branch state, and
  Judge/PM receipt.
- Medium confidence: Governance docs should expose short operational contracts
  and push complex checks into validators.

### Scaling

- High confidence: Scaling agent work requires decomposed slices, artifact-first
  review, branch isolation, and validator-backed promotion.
- Medium confidence: The system should limit reviewer swarms to surfaces where
  artifacts can be verified and findings can be repaired within the slice.
- Medium confidence: Root cleanup and scaffold modularity should proceed through
  non-destructive low-risk slices before larger reorganization.

### Recovery

- High confidence: Recovery starts by naming the failure class and live truth
  surface. PR conflict routing requires local conflict probe, GitHub PR truth
  probe, and repaired-branch delivery proof.
- High confidence: If a tool is unavailable, record that as runtime truth and
  defer the affected validation rather than claiming completion.
- Medium confidence: Recovery handlers should produce both human-readable notes
  and machine-readable receipts for later guard validation.

## Implied Best Practices

- Separate evidence role from evidence content. A file can be a useful note
  without being policy; a validator can be policy without explaining every
  rationale.
- Start with reconciliation when the task touches stale plans, long-running
  goals, PR state, tracker state, or dirty worktrees.
- Prefer small internal validators over new public CLI commands unless the user
  or a command-admission decision requires public surface area.
- Keep display values stable when integrating external trackers; normalize only
  for comparison.
- Preserve unrelated dirty work and record it as a risk surface rather than
  cleaning it opportunistically.
- Treat missing future validators as implementation deliverables, not as current
  proof.
- Record rejected paths as intentionally as selected paths; this helps future
  agents avoid reopening settled alternatives.
- Retry missing subagent artifacts once with a narrow artifact-only request, then
  record a coverage gap.
- Make PR body evidence grammar testable so live CI failures can be reproduced
  locally.
- Use real artifacts in validator tests when the risk is stale or imaginary
  references.
- Distinguish local-only evidence from merge proof.
- Mark residual risks by ownership and scope, not as vague caution.
- Keep Judge/PM audit authority separate from local validation and PR readiness.
- Use exact command outcomes in notes; "validated" is not a substitute for a
  command, result, and blocker classification.
- Avoid broad directory references in audits; cite concrete tracked files.
- When a command false-passes because flags are ignored, treat that as a trust
  boundary failure.

## Failure Modes And Mitigations

### Failure: Claim-Vs-Evidence Drift

#### Description

The agent claims a broad outcome based on narrow proof.

#### Evidence

ROOT/scaffold recovery was treated as complete from source-map evidence without
root-hygiene classification
(.harness/implementation-notes/2026-05-24-root-scaffold-tidy-steering-admission.md:28-43).

#### Probable Root Cause

Missing decomposition between source-map restoration, scaffold validation, root
hygiene, generated evidence synchronization, and audit authority.

#### Severity

High.

#### Mitigation Strategy

Require a delivery-truth matrix and claim-specific evidence checklist before
closeout language.

#### Recommended Guardrails

- `delivery-truth/v1`
- root-hygiene classification gate
- PR closeout stale/unknown evidence blocker

### Failure: Prompt-Only Steering Absorption

#### Description

The agent acknowledges correction in chat but does not change the environment.

#### Evidence

The May 20 admission says the repeated behavior was acknowledging steering in
chat, then continuing normal work without proving any environment, workflow,
validation, retrieval, runtime, or execution-strategy change
(.harness/implementation-notes/2026-05-20-steering-admission.md:22-24).

#### Probable Root Cause

Policy existed in prose but was not load-bearing at the artifact level.

#### Severity

High.

#### Mitigation Strategy

Promote steering admissions into validated artifacts and later structured
receipts.

#### Recommended Guardrails

- `docs:steering:guard`
- `steering-signal/v1`
- CI gate for admission proof fields

### Failure: Silent Scope Downshift

#### Description

A full implementation request is narrowed into advisory gap tracking or a small
slice without explicit user authority.

#### Evidence

The May 21 admission records that a full-implementation request was narrowed
into a smallest independently mergeable slice and normalized as advisory next
work
(.harness/implementation-notes/2026-05-21-full-implementation-downscope-steering-admission.md:26-32).

#### Probable Root Cause

The active audit path chose execution boundary from plan state rather than
explicit user acceptance of reduced scope.

#### Severity

High.

#### Mitigation Strategy

Track requested scope, implemented scope, deferred scope, and approved downscope
as separate fields.

#### Recommended Guardrails

- `scope-authority/v1`
- audit linter for "unfinished full-implementation scope"
- closeout blocker for unapproved downscope

### Failure: Mergeability Surface Neglect

#### Description

The delivery loop focuses on adjacent review or auto-merge status before
resolving the referenced PR's live conflict state.

#### Evidence

Jamie raised the PR conflict blocker more than once while the agent focused on
adjacent PR review and auto-merge status
(.harness/implementation-notes/2026-05-23-pr-285-conflict-routing-admission.md:10-15).

#### Probable Root Cause

Remote PR truth, local branch cleanliness, active review URL, and sibling PR
relationships were not reported as separate surfaces.

#### Severity

High.

#### Mitigation Strategy

Run live conflict and PR truth probes before review-thread synthesis.

#### Recommended Guardrails

- PR conflict routing checklist
- `gh pr view --json mergeStateStatus,headRefName,headRefOid,state,isDraft`
- superseded-sibling PR decision field

### Failure: Unknown-Flag False Pass

#### Description

A validator ignores an unknown flag and exits successfully, creating false
confidence that a strict mode exists.

#### Evidence

T002 discovered that `validate-evidence-patterns.cjs --strict-adopted --json`
exited 0 because the script ignored unknown flags
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:251-255).

#### Probable Root Cause

CLI usage parsing did not fail closed for unsupported options.

#### Severity

High.

#### Mitigation Strategy

Reject unknown flags with usage status and add regression tests for strict mode.

#### Recommended Guardrails

- usage exit code 2
- strict flag test fixtures
- declared-command versus executed-command reporting

### Failure: Mailbox-Only Review Proof

#### Description

Coordinator status text or mailbox messages are treated as equivalent to written
review artifacts.

#### Evidence

T005 required an artifact-only retry because mailbox status text is not proof
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:403-409).

#### Probable Root Cause

Subagent communication channels and review artifact channels were conflated.

#### Severity

High.

#### Mitigation Strategy

Require reviewer artifacts and validate coverage with a manifest.

#### Recommended Guardrails

- `reviewer-coverage-receipt/v1`
- artifact-first reviewer contract
- missing-artifact retry protocol

### Failure: Stale Or Broad Audit References

#### Description

Audit artifacts cite paths that are missing, ignored, untracked, broad
directories, or stale relative to the current checkout.

#### Evidence

T006 found stale references in the May 22 audit and discovered that Git pathspec
matching can make directories look tracked when they contain tracked children
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:456-474).

#### Probable Root Cause

Audits used human-readable path references without executable verification.

#### Severity

Medium to high.

#### Mitigation Strategy

Validate cited references against concrete tracked files and block broad
directory proof.

#### Recommended Guardrails

- `audit-reference-report/v1`
- real audit fixture validation
- shared path-token extraction for bare text and fenced code

### Failure: Dirty Worktree Contamination

#### Description

Unrelated local changes create branch-drift risk or may be accidentally staged,
reverted, or included in proof.

#### Evidence

T003 git triage classified direct continuation on `main` with mixed dirty state
as high branch-drift risk
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:298-310).

#### Probable Root Cause

Shared local worktree state was not isolated before branch-scoped implementation.

#### Severity

Medium to high.

#### Mitigation Strategy

Use branch/worktree isolation and dirty ledgers before staging, pushing, or
claiming readiness.

#### Recommended Guardrails

- pre-stage dirty-state ledger
- branch-readiness probe
- explicit unrelated-file preservation note

### Failure: Runtime Tool Availability Assumption

#### Description

The workflow assumes a tool exists in the current turn and risks claiming proof
that could not be produced.

#### Evidence

The JSC-331 ledger recorded that Browser automation was not exposed as a
callable tool and that the HTML ledger should be rendered when Browser tooling
is available
(.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:101-105).

#### Probable Root Cause

Tool availability varies by runtime session but may not be captured as part of
the validation state.

#### Severity

Medium.

#### Mitigation Strategy

Record runtime capability discovery and mark tool-dependent validation as
blocked, deferred, or unavailable.

#### Recommended Guardrails

- tool-availability snapshot
- deferred render-validation field
- closeout blocker for claimed-but-unrun tool proof

### Failure: Authority Flattening

#### Description

Research reports, implementation notes, active specs, validators, CI gates, and
audit receipts are treated as equivalent authority.

#### Evidence

Implementation notes explicitly define themselves as secondary context unless a
plan, spec, decision, or validator promotes a rule from them
(.harness/implementation-notes/README.md:14-17).

#### Probable Root Cause

Agents retrieve many repo artifacts but may not preserve their source roles.

#### Severity

High.

#### Mitigation Strategy

Attach authority metadata to research, notes, decisions, specs, and validators.

#### Recommended Guardrails

- source-role metadata in evidence manifests
- authority ladder in closeout
- promotion gate from research to rule

## Reusable Techniques

- Steering admission template: feedback signal, root operational failure,
  failure category, searched surfaces, durable system improvement, executable
  guard, forbidden recurrence, validation, and review condition.
- Root-hygiene table: path, current category, target category, action,
  references updated, validation command, owner, and deferral reason.
- Delivery-truth matrix: local code/test status, remote checks, review threads,
  tracker state, branch/worktree state, mergeability, audit authority, and
  residual blocker.
- Scope-authority ledger: requested scope, implemented scope, unimplemented
  scope, user-approved downscope, plan authority, and closeout language.
- Seam-discovery receipt: slice, selected seam, rejected path, authority impact,
  public API impact, and validation command.
- Reviewer-coverage manifest: expected artifacts, observed artifacts, blocker
  status, severity summary, retry status, and coverage gaps.
- Validator CLI contract: stdout exactly one JSON object, exit 0 for pass, exit
  1 for blocked/fail, exit 2 for usage error, unknown flags rejected.
- Evidence promotion gate: research pattern cannot become adopted harness rule
  until it has runnable proof or a tracked exception.
- Dirty-state ledger: modified tracked files, untracked files, ignored clutter,
  ownership classification, stage/revert prohibition, and branch risk.
- Runtime capability snapshot: callable tools, unavailable tools, validation
  affected, fallback used, and deferred proof.
- PR conflict routing checklist: local unresolved conflicts, live GitHub
  mergeability, branch to repair, sibling PR relationship, and proof after push.
- Stale-reference validator: extract path tokens from prose and fenced code,
  resolve to tracked files, block broad directories, and ignore deliberately
  non-path prose.

## Strategic Insights

- The agent operating system is moving from instruction prose to executable
  governance. The repo still uses markdown admissions, but the natural endpoint
  is typed receipts, validators, and CI gates.
- The most important harness product boundary is not "can the agent do the
  task?" but "can the environment prove the agent did the exact task requested?"
- Root structure is agent infrastructure. A tidy root reduces retrieval noise,
  but root cleanup needs preservation, classification, and reference updates to
  avoid erasing operational evidence.
- Human steering is a high-value training signal for the harness itself. The
  best systems will capture it once, route it into the smallest durable
  enforcement surface, and make the same correction unnecessary.
- Multi-agent review scales only with artifact discipline. Without artifact
  manifests and coverage validators, reviewer swarms create the appearance of
  assurance without reproducible proof.
- Tracker, PR, goal, and repo states are independent authority surfaces. Future
  harnesses should model them as separate evidence providers rather than a
  single "done" status.
- Validators should encode not just happy paths but false-pass discoveries:
  ignored flags, missing artifacts, stale references, broad directories,
  mailbox-only proof, stale PR bodies, and unapproved downscope.
- The highest-leverage next generation of harness tooling is claim/evidence
  compilation: parse a proposed closeout claim, enumerate required evidence, and
  block unsupported language.

## Key Quotes And Evidence

- "Jamie restated that every correction, clarification, repeated instruction,
  and recovery hint is high-signal operational telemetry"
  (.harness/implementation-notes/2026-05-20-steering-admission.md:16-20).
- "The repeated behavior is acknowledging steering in chat, then continuing
  normal task work without proving that the environment, workflow, validation
  layer, retrieval layer, runtime assumption, or execution strategy changed"
  (.harness/implementation-notes/2026-05-20-steering-admission.md:22-24).
- "Repeated human steering is a harness failure until a deterministic repo
  surface makes the same steering unnecessary or records a tracked exception"
  (.harness/implementation-notes/2026-05-20-steering-admission.md:66-68).
- "The operational failure was claim-vs-evidence drift"
  (.harness/implementation-notes/2026-05-24-root-scaffold-tidy-steering-admission.md:28-33).
- "A claim that ROOT is sorted requires evidence of root-hygiene classification"
  (.harness/implementation-notes/2026-05-24-root-scaffold-tidy-steering-admission.md:23-26).
- "Do not collapse root-hygiene work into source-map recovery"
  (.harness/implementation-notes/2026-05-24-root-scaffold-tidy-steering-admission.md:104-107).
- "The audit workflow allowed a full-implementation request to be narrowed into
  a smallest independently mergeable slice"
  (.harness/implementation-notes/2026-05-21-full-implementation-downscope-steering-admission.md:26-32).
- "PR mergeability, local branch cleanliness, and active-review URL state were
  not separated into distinct truths"
  (.harness/implementation-notes/2026-05-23-pr-285-conflict-routing-admission.md:17-23).
- "Runtime implementation is still blocked until T002 records selected and
  rejected seams"
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:135-143).
- "`node scripts/validate-evidence-patterns.cjs --strict-adopted --json`
  currently exits 0 because the script ignores unknown flags"
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:251-255).
- "Mailbox status text is not proof"
  (.harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html:403-409).
- "Implementation notes are secondary-context unless an active plan, spec,
  decision, or validator promotes a rule from them"
  (.harness/implementation-notes/README.md:14-17).

## Final Assessment

Strongest ideas:

- Repeated steering as harness telemetry, not user frustration.
- Claim-vs-evidence decomposition as the core closeout discipline.
- Validator creation as the preferred repair for trust-boundary gaps.
- Artifact-first subagent review.
- Fresh authority reconciliation before implementation.

Weakest areas:

- Current steering admissions are still markdown-first and can prove structure
  before they prove behavior.
- Root hygiene appears to have a documented expectation but not yet a typed
  validator.
- Closeout evidence spans many surfaces, but a single machine-readable
  delivery-truth receipt is not yet visible in the cited source set.
- Tool availability is recorded manually rather than captured as a reusable
  runtime snapshot.

Most reusable concepts:

- `steering-signal/v1`
- `delivery-truth/v1`
- `root-hygiene-classification/v1`
- `scope-authority/v1`
- `reviewer-coverage-receipt/v1`
- `audit-reference-report/v1`
- seam-discovery receipts

Highest leverage opportunities:

- Promote current markdown steering admissions into structured receipts.
- Add a root-hygiene classifier and gate before any future ROOT cleanup claim.
- Add closeout language validation that blocks unsupported "complete", "ready",
  "green", "merged", or "tidy" claims.
- Require subagent review manifests whenever a plan calls for triage or review
  between slices.
- Add a tool-availability snapshot to runtime-ledger workflows.

Most important risks:

- Agents may keep generating admission artifacts without changing deterministic
  behavior.
- Research and implementation notes may be overtrusted unless authority metadata
  is preserved.
- Non-destructive cleanup can stall if every root artifact is deferred.
- Reviewer swarms can create proof-shaped noise without artifact validation.
- Closeout can still drift if live PR, tracker, branch, and audit states are not
  re-read immediately before the claim.

Immediate implementation candidates:

- Create `docs/architecture/root-surface-classification.md` and validate it
  against top-level tracked files.
- Add `scripts/validate-root-hygiene-classification.cjs` with JSON output and
  fail-closed category coverage.
- Extend `docs:steering:guard` or a successor schema to emit
  `steering-signal/v1`.
- Add `harness pr-closeout --delivery-truth --json` or equivalent internal
  receipt generation.
- Add a regression fixture that replays the ROOT/source-map conflation and
  expects the root-hygiene gate to block the claim.
