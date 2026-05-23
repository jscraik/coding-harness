# Harness Source Synthesis Evidence Extraction

Generated: 2026-05-22

## Table of Contents

- [Executive Summary](#executive-summary)
- [Source Boundary And Authority](#source-boundary-and-authority)
- [Core Engineering Patterns](#core-engineering-patterns)
- [Tooling And Ecosystem](#tooling-and-ecosystem)
- [Harness Engineering Insights](#harness-engineering-insights)
- [Implied Best Practices](#implied-best-practices)
- [Failure Modes And Mitigations](#failure-modes-and-mitigations)
- [Reusable Techniques](#reusable-techniques)
- [Strategic Insights](#strategic-insights)
- [Key Quotes And Evidence](#key-quotes-and-evidence)
- [Final Assessment](#final-assessment)
- [Subagent Assistance Record](#subagent-assistance-record)

## Executive Summary

This artifact is a cross-source extraction addendum for the existing deep
research corpus. It does not replace the per-person evidence files. It checks
the Ryan Lopopolo, Tejas, Sean Grove, agent-rft, Eno Reyes, Matt Pocock, and
Praveen Govindaraj evidence surfaces against the implementation notes that show
which ideas have already been admitted into the harness operating system.

The strongest shared conclusion is that agentic software quality is governed by
the environment, not by the model alone. Ryan and Praveen frame harness
engineering as environment design; Tejas gives the concrete outer-loop version
where the harness owns attempts, traces, verification, retries, and stop
conditions; Eno names validation as the autonomy ceiling; Sean turns
specification into the durable source artifact; Matt turns repository shape,
language, deep modules, and context budget into agent infrastructure; agent-rft
research turns trajectories, graders, and reward-hacking pressure tests into
eval design.

The implementation notes show that several of these ideas are no longer only
research. Repeated steering has a guarded admission path, evidence promotion is
tracked by .harness/research/evidence-patterns.json, runtime-card phase-exit
summaries are marked as weaker than gate-backed evidence, PR/CI/closeout modes
fail closed on missing required evidence, and module-layout work follows the
rule: callers use small facades, agents work inside deeper modules, and tests
guard the boundary.

The central operating pattern is a three-level authority ladder:

- Cold research: useful patterns, not instructions.
- Decision records and implementation notes: historical execution evidence,
  secondary context unless promoted.
- Validators, schemas, tests, gates, specs, and active plans: load-bearing
  harness authority.

The critical failure mode is authority flattening. If a future agent treats a
short secondary explainer, speculative agent-rft pattern, live implementation
note, validated regression, and canonical gate as the same class of evidence,
it will overclaim, misroute work, and reproduce the exact failure this harness
is meant to prevent.

## Source Boundary And Authority

This addendum reads these deep research files as source baselines:

- .harness/research/deep/2026-05-18-praveen-govindaraj-evidence.md
- .harness/research/deep/2026-05-18-ryan-lopopolo-evidence.md
- .harness/research/deep/2026-05-18-sean-grove-evidence.md
- .harness/research/deep/2026-05-18-tejas-evidence.md
- .harness/research/deep/2026-05-19-agent-rft-evidence.md
- .harness/research/deep/2026-05-19-agent-rft-patterns-evidence.md
- .harness/research/deep/2026-05-19-eno-reyes-evidence.md
- .harness/research/deep/2026-05-19-matt-pocock-evidence.md
- .harness/research/deep/2026-05-19-ryan-lopopolo-evidence.md

This addendum reads implementation notes as execution evidence, not as primary
source material. The governing rule is explicit:
.harness/implementation-notes/README.md:16-17 says implementation notes are
secondary-context unless an active plan, spec, decision, or validator promotes
a rule from them.

Authority rules:

- High confidence: source files that describe patterns, risks, tools, or
  implementation opportunities can be used as research input.
- High confidence: implementation notes can prove that a pattern was attempted,
  adopted, rejected, or demoted in a specific implementation slice.
- High confidence: validators, schemas, scripts, tests, active goals, and
  manifests are the durable enforcement layer.
- Medium confidence: cross-source similarities are useful design signals when
  supported by multiple files.
- Low confidence: isolated quotes from short secondary explainers should not be
  treated as full harness doctrine without a corroborating source or repo gate.

## Core Engineering Patterns

### Pattern: Environment-First Harness Engineering

#### Description

Agent performance is treated as an environment-design problem. The model is one
component inside a governed execution system that supplies context, repo shape,
tools, validation, observation, and stop conditions.

#### Evidence

- Ryan 2026-05-19 identifies repeated corrections becoming durable context,
  validation, and tooling as one of the strongest ideas
  (.harness/research/deep/2026-05-19-ryan-lopopolo-evidence.md:2328-2337).
- Praveen frames the core lesson as environment-first engineering rather than
  single-prompt optimization
  (.harness/research/deep/2026-05-18-praveen-govindaraj-evidence.md:34-38).
- Steering admission notes translate repeated human correction into telemetry
  and durable system change
  (.harness/implementation-notes/2026-05-20-steering-admission.md:16-24,
  .harness/implementation-notes/2026-05-20-steering-admission.md:57-73).

#### Why It Matters

The model cannot reliably compensate for missing repo structure, stale context,
weak tests, ambiguous authority, or hidden tacit knowledge. Treating those as
environment defects makes failures fixable through deterministic surfaces.

#### Implementation Opportunities

- Keep .harness as the injected control plane for greenfield and brownfield
  repos so harness memory, plans, research, decisions, gates, and notes do not
  collide with customer docs.
- Promote repeated steering into validators, schemas, workflow rules, or
  explicit tracked exceptions.
- Add source-role metadata to research manifests when audits need to distinguish
  baseline source, synthesis source, implementation note, adopted rule, and
  candidate pattern.

#### Risks / Tradeoffs

- The repo can become noisy if every observation is promoted without selection.
- Prompt-only reminders can masquerade as system improvements.
- Environment design must stay bounded; otherwise the harness becomes harder to
  operate than the work it coordinates.

### Pattern: Outer Harness Loop Owns Completion

#### Description

The agent loop is nested inside a harness loop. The harness owns attempt
tracking, evidence collection, validation, recovery, retry limits, and the
decision to continue, stop, or escalate.

#### Evidence

- Tejas describes the agent loop inside the harness loop
  (.harness/research/deep/2026-05-18-tejas-evidence.md:135-155).
- Tejas treats trace history as a truth surface
  (.harness/research/deep/2026-05-18-tejas-evidence.md:163-183).
- Runtime-card and closeout notes require mode-aware evidence and phase-exit
  source completeness
  (.harness/implementation-notes/2026-05-21-coding-harness-goal-governed-evidence-led-implementation-notes.html:69-89).

#### Why It Matters

Completion claims are often wrong when made from local output alone. A harness
loop can compare the claim with gate state, runtime state, PR state, review
state, and tracker state.

#### Implementation Opportunities

- Record attempts, commands, outcomes, blockers, and freshness in closeout
  artifacts.
- Separate summary-only evidence from gate-backed evidence.
- Make phase-exit gates refuse success when required evidence is fail, blocked,
  not_run, missing, or stale.

#### Risks / Tradeoffs

- More ceremony can slow small tasks.
- Stale attempt ledgers can mislead agents if not tied to current branch, head
  SHA, and timestamp.
- Retry loops can hide real blockers unless failure classes are explicit.

### Pattern: Verification Is The Autonomy Boundary

#### Description

The system allows more autonomy only where validation is strong enough to catch
wrong action. If validation is weak, the agent should narrow scope, ask for
approval, or stop with a blocker.

#### Evidence

- Eno identifies verification as the autonomy boundary
  (.harness/research/deep/2026-05-19-eno-reyes-evidence.md:100-126).
- Tejas emphasizes deterministic verification over model claims
  (.harness/research/deep/2026-05-18-tejas-evidence.md:191-204).
- PR/CI/closeout implementation notes require current evidence and distinguish
  missing metadata from pending checks
  (.harness/implementation-notes/2026-05-19-coding-harness-gap-implementation-notes.html:224-236).

#### Why It Matters

Agents are most dangerous when they can mutate state faster than the system can
observe consequences. Good validation converts autonomy from trust into a
bounded engineering contract.

#### Implementation Opportunities

- Map each harness action to its narrowest proving command.
- Require validators to classify failure ownership: current patch,
  pre-existing, unrelated dirty worktree, environment/tooling failure, or
  external state.
- Keep browser, runtime, CI, and repo validation separate in closeout reports.

#### Risks / Tradeoffs

- Validation can become performative if it checks format rather than behavior.
- False confidence emerges when commands pass without exercising touched paths.
- Overly broad gates can make agents ignore the specific failure surface.

### Pattern: Specification As Executable Control Plane

#### Description

Specs are not background documentation. They are durable source artifacts that
constrain implementation, review, testing, and handoff.

#### Evidence

- Sean frames specification as a source artifact
  (.harness/research/deep/2026-05-18-sean-grove-evidence.md:25-33,
  .harness/research/deep/2026-05-18-sean-grove-evidence.md:37-64).
- Implementation notes show phase-exit source completeness and gate-backed
  evidence replacing summary-only claims
  (.harness/implementation-notes/2026-05-19-coding-harness-gap-implementation-notes.html:204-208).

#### Why It Matters

Agents need explicit authority boundaries. Specs prevent conversational memory
from becoming the only place where requirements live.

#### Implementation Opportunities

- Use .harness/goals, .harness/specs, .harness/plan, and
  .harness/decisions as portable control-plane surfaces.
- Link each plan item to validation evidence and implementation notes.
- Treat plan gaps as code or validator gaps when the plan called for full
  implementation.

#### Risks / Tradeoffs

- Specs can become stale faster than code.
- Spec language can overclaim if not tied to validators.
- Too many plan surfaces can fragment authority unless routed through an index.

### Pattern: Deep Modules With Small Agent-Facing Facades

#### Description

The repo should expose compact command and facade surfaces while placing real
behavior inside cohesive deeper modules. Agents get a simple entrypoint, but
the code remains testable, typed, and organized by domain.

#### Evidence

- Matt identifies agent-ready codebase practices: thin docs, deep modules,
  agent-oriented language, context-window austerity, and uneven validation
  risks (.harness/research/deep/2026-05-19-matt-pocock-evidence.md:51-63).
- Module-layout notes state: callers stay on small facades; agents work inside
  deeper modules; tests guard the boundary
  (.harness/implementation-notes/2026-05-19-module-layout.html:593-596).
- Module-layout implementation notes show boundary ratchets and proof
  (.harness/implementation-notes/2026-05-19-module-layout.html:570-586).

#### Why It Matters

Agents perform better when the repo offers obvious high-level entrypoints and
bounded internal seams. Flat command files with mixed parsing, policy,
rendering, IO, and domain logic waste context and invite shallow fixes.

#### Implementation Opportunities

- Keep command files as compatibility facades.
- Move argument parsing, validation, persistence, operation, and presentation
  into named lib domains.
- Add module-boundary ratchets that fail when command files grow back into
  mixed-responsibility modules.

#### Risks / Tradeoffs

- Over-splitting can create pass-through modules with no domain value.
- Boundary tests can become brittle if they check file names rather than
  responsibility.
- Agents may still need maps that explain where the real behavior lives.

### Pattern: Context Budget As Reliability Control

#### Description

The harness should curate what the agent sees. Relevant instructions, current
truth, high-signal memory, and exact evidence matter more than maximal context.

#### Evidence

- Matt calls out context-window austerity as an agent-ready codebase practice
  (.harness/research/deep/2026-05-19-matt-pocock-evidence.md:51-63).
- The user-provided images emphasize that what Codex cannot see effectively
  does not exist, and that unseen knowledge should be encoded into the codebase
  as markdown.

#### Why It Matters

Context overload hides the governing truth. Context absence makes the agent
invent. The harness needs retrieval and routing, not just larger prompts.

#### Implementation Opportunities

- Maintain .harness/README.md and active-artifact indexes as routing surfaces.
- Store durable tacit knowledge as markdown or JSON near the repo control
  plane.
- Keep authority tiers explicit in every synthesis or audit.

#### Risks / Tradeoffs

- Encoding too much tacit knowledge creates stale documents.
- Retrieval can overfit to recent implementation notes unless authority is
  classified.
- Small context can drop important constraints if route maps are incomplete.

### Pattern: Trajectory And Reward-Hacking Discipline

#### Description

Agent evaluation should inspect trajectories and outcomes, not only final text.
Once agents learn the rubric, graders must be pressure-tested for shortcuts and
reward hacking.

#### Evidence

- Agent-rft patterns emphasize strict final-outcome graders
  (.harness/research/deep/2026-05-19-agent-rft-patterns-evidence.md:244-260).
- Agent-rft patterns also describe rewarding self-validation
  (.harness/research/deep/2026-05-19-agent-rft-patterns-evidence.md:269-287).
- The same source calls for reward-hacking pressure tests
  (.harness/research/deep/2026-05-19-agent-rft-patterns-evidence.md:296-324).

#### Why It Matters

Harnesses can accidentally train agents to produce good-looking claims instead
of good work. The eval layer must reward validated behavior and penalize
plausible but unsupported completion.

#### Implementation Opportunities

- Add eval fixtures for stale evidence, skipped validation, fake closeout,
  ignored dirty worktree, and over-promoted research.
- Use trajectory review for tasks with retries, tool failures, or repeated
  steering.
- Require evidence references in final closeout and PR bodies.

#### Risks / Tradeoffs

- Trajectory evals can be expensive.
- Graders may privilege verbose self-explanation unless they are outcome-bound.
- Eval fixtures can become stale if they are not refreshed with real failures.

## Tooling And Ecosystem

### Repository Control Plane

Purpose:

- Keep agent-facing knowledge, plans, audits, decisions, memory, and research
  inside .harness so injected harness scaffolding does not interfere with
  customer docs.

Workflow role:

- .harness/research/deep stores extracted research evidence.
- .harness/research/evidence-patterns.json tracks adoption, deferral, and
  validation commands.
- .harness/implementation-notes stores execution history and secondary context.
- .harness/goals, .harness/specs, .harness/plan, and .harness/decisions become
  higher-authority surfaces when they drive implementation.

Integration opportunities:

- Extend evidence-patterns with source role, authority tier, confidence, and
  promotion destination.
- Add a validator that catches synthesis files without authority-boundary
  sections.

Limitations:

- Ignored implementation-note scratch space cannot be treated as PR-durable
  evidence unless promoted into tracked files.

### Runtime Evidence And Closeout

Purpose:

- Prove what happened during the run and prevent summary-only claims from
  passing as gate-backed evidence.

Workflow role:

- Runtime-card evidence, phase-exit evidence, PR closeout evidence, and
  artifacts classify current proof, blockers, stale data, and missing data.

Integration opportunities:

- Require current head SHA, evidence source, freshness, blocker class, and
  verification timestamp for closeout claims.
- Make missing or stale required evidence block success.

Limitations:

- Runtime summaries remain advisory unless connected to validators or gate
  artifacts.

### Observability Stack

Purpose:

- Give agents a queryable truth surface for logs, metrics, traces, and runtime
  behavior.

Workflow role:

- The attached observability diagrams point to logs over HTTP, OTLP metrics,
  OTLP traces, Vector fanout, Victoria Logs, Victoria Metrics, Victoria Traces,
  LogQL, PromQL, and TraceQL.

Integration opportunities:

- Treat observability APIs as agent-readable evidence inputs during diagnosis.
- Correlate UI journeys, runtime events, and code changes before claiming a
  behavior fix.

Limitations:

- Observability without workload replay can prove symptoms but not necessarily
  resolution.
- Trace data can become too bulky unless queries are task-scoped.

### Browser And UI Validation

Purpose:

- Let Codex drive the application and verify actual rendered behavior.

Workflow role:

- The attached Chrome DevTools MCP diagrams show a loop: select target, clear
  console, snapshot before, trigger UI path, collect runtime events, snapshot
  after, apply fix, restart, rerun validation until clean.

Integration opportunities:

- Convert UI tasks into before/after screenshot, console, network, and runtime
  event contracts.
- Use browser traces as closeout evidence for UI changes.

Limitations:

- Browser validation can be shallow if it does not assert the intended behavior.
- Visual checks need stable selectors and viewport coverage.

### GitHub, Linear, CI, And Review Tools

Purpose:

- Keep delivery state and tracker state distinct from local implementation
  state.

Workflow role:

- GitHub stores branches, PRs, checks, review threads, and merge state.
- Linear stores issue state and follow-up ownership.
- CircleCI, Semgrep Cloud, CodeRabbit, and repository scripts own different
  parts of the external validation contract.

Integration opportunities:

- Closeout should report local code status, remote checks, review threads,
  tracker state, and merge readiness separately.
- PR bodies should include concrete session or traceability evidence.

Limitations:

- Local green does not imply PR green.
- PR green does not imply tracker closure.
- Review artifacts are not independent if the coding agent self-approves.

### Deep Module And Boundary Tooling

Purpose:

- Keep large command families understandable to agents and maintainers.

Workflow role:

- Module-boundary tests, architecture context, and codestyle gates enforce
  domain seams.

Integration opportunities:

- Add ratchets for command file size, dependency direction, and facade-only
  command specs.
- Generate architecture diagrams from current module structure and require
  freshness checks when boundaries change.

Limitations:

- Boundary tooling can become ceremonial unless it maps to actual blast radius
  and maintainability risks.

## Harness Engineering Insights

### Orchestration

- The harness should own the outer loop: goal, plan, attempt, proof, recovery,
  closeout.
- Subagents should produce artifact-first reports. Mailbox status is not enough
  when the requested contract is a written review.
- Fanout should be bounded by role and expected output. Open-ended swarms create
  coverage ambiguity.

### Validation

- Validation must be tied to touched behavior and authority level.
- Summary-only evidence is weaker than gate-backed evidence.
- Missing evidence is a blocker or unknown state, not success.
- Repeated failed commands should trigger research and system improvement, not
  local retry loops forever.

### Context

- .harness is the right place for portable agent context because it avoids
  contaminating customer docs while preserving repo-local operating memory.
- Context should be routed through indexes and active artifacts rather than
  bulk-loaded.
- Implementation notes are useful but must remain secondary unless promoted.

### Routing

- Research input, implementation plan, active goal, validator, and reviewer
  finding are different route types.
- Overloaded human language should be mapped through repo vocabulary and current
  artifacts.
- When the user asks for full implementation, future-work deferral requires an
  explicit authority decision, not agent preference.

### Memory

- Durable memory should encode decisions, learned fixes, and repeated steering.
- Memory should not replace current repo, branch, PR, or CI truth.
- Research extraction should distinguish explicit evidence, inferred insight,
  and speculative interpretation.

### Evals

- Evaluate both final outcome and trajectory.
- Reward self-validation only when it is backed by actual command or runtime
  evidence.
- Add negative fixtures for overclaiming, skipped gates, stale context, and
  authority flattening.

### Governance

- Governance is load-bearing when enforced by scripts, schemas, tests, gates,
  or active plans.
- A note or prompt without enforcement is useful guidance, not protection.
- Repo control-plane changes should include validation commands and evidence
  manifest updates.

### Scaling

- Deep modules, compact facades, and route maps scale better than flat command
  files.
- Agent-readable observability scales debugging by making runtime truth
  queryable.
- CI and PR gates scale accountability only when check ownership is explicit.

### Recovery

- Recovery should start by classifying the failed surface: missing context,
  stale state, weak validation, hidden assumption, retrieval failure, workflow
  design, runtime ambiguity, architecture drift, lack of verification, weak
  observability, missing guardrail, poor task routing, or excessive context
  noise.
- Every repeated correction should be considered for a validator, schema, trace
  event, workflow rule, recovery handler, CI gate, repo artifact, skill
  improvement, context-routing improvement, or governance rule.

## Implied Best Practices

- Prefer deterministic enforcement over reminders.
- Treat human steering as telemetry about the harness, not just about the task.
- Encode tacit knowledge into tracked markdown or JSON where agents can see it.
- Keep .harness as the portable harness namespace for injected projects.
- Use exact file and line evidence when converting research into audit claims.
- Separate cold research from admitted implementation authority.
- Use subagents only with artifact contracts and verify artifact existence.
- Keep command facades small and move real behavior into named domains.
- Validate the exact behavior path touched before claiming behavior is fixed.
- Report local, PR, CI, review, tracker, and merge truths separately.
- Use branch, head SHA, and timestamp to prevent stale closeout evidence.
- Add eval fixtures for failure modes observed in real runs.
- Use implementation notes to explain decisions, not to silently create policy.
- Update evidence-patterns.json whenever a new deep research artifact is added.
- Record coverage gaps when a reviewer role fails to write its expected report.

## Failure Modes And Mitigations

### Failure: Authority Flattening

Description:

- The agent treats research, implementation notes, plans, validators, and gates
  as equal authority.

Evidence:

- Implementation notes explicitly say they are secondary-context unless
  promoted (.harness/implementation-notes/README.md:16-17).

Probable root cause:

- Missing source-role metadata and weak context routing.

Severity:

- High.

Mitigation strategy:

- Add authority tiers to synthesis artifacts and manifests.
- Promote only through active plans, specs, decisions, validators, schemas, or
  tests.

Recommended guardrails:

- Manifest schema fields for sourceRole and authorityTier.
- Validator that requires authority boundary sections in synthesis artifacts.

### Failure: Overclaiming Implementation Completeness

Description:

- Future work is described as a tracked gap even when the user or source plan
  requested full implementation.

Evidence:

- Steering admission notes say repeated steering must become a durable system
  improvement (.harness/implementation-notes/2026-05-20-steering-admission.md:16-24).

Probable root cause:

- Agent substitutes local judgment for plan authority.

Severity:

- High.

Mitigation strategy:

- Require an explicit decision record for any deferral of plan-required code.
- Treat unimplemented planned code as a defect unless the plan is superseded.

Recommended guardrails:

- Plan-completion validator that flags unimplemented plan items without a
  tracked exception.
- Closeout field for full-implementation proof.

### Failure: Summary-Only Evidence Passing As Gate Evidence

Description:

- A narrative summary is treated as proof that gates passed.

Evidence:

- Implementation notes distinguish summary_only from gate_backed phase-exit
  evidence (.harness/implementation-notes/2026-05-19-coding-harness-gap-implementation-notes.html:204-208).

Probable root cause:

- Missing evidence source classification.

Severity:

- High.

Mitigation strategy:

- Require source, status, freshness, and blocker class for every closeout claim.

Recommended guardrails:

- Runtime-card and PR-closeout validators that fail on missing required
  evidence.

### Failure: Subagent Coverage Overclaim

Description:

- The coordinator counts a subagent as successful based on mailbox text without
  a written artifact.

Evidence:

- The current review loop produced three artifact-backed harness reports. The
  repository automation reviewer did not write the requested artifact after a
  retry and is recorded here as a coverage gap.

Probable root cause:

- Completion status and artifact verification are separate surfaces.

Severity:

- Medium.

Mitigation strategy:

- Verify every expected artifact exists and is non-empty before synthesis.

Recommended guardrails:

- Review-swarm artifact probe.
- Coordinator checklist for agents requested, completed, blocked, failed
  artifact verification, and closed.

### Failure: Context Dump Instead Of Context Routing

Description:

- Agents load too much material and lose the governing truth.

Evidence:

- Matt highlights context-window austerity as an agent-ready codebase principle
  (.harness/research/deep/2026-05-19-matt-pocock-evidence.md:51-63).

Probable root cause:

- Missing routing indexes and authority-aware retrieval.

Severity:

- Medium.

Mitigation strategy:

- Route through .harness active indexes, source manifests, and topic-specific
  plans.

Recommended guardrails:

- Context budget checks for skills and review workflows.

### Failure: Reward Hacking In Agent Evals

Description:

- Agents learn to satisfy visible rubric text without doing the underlying
  engineering work.

Evidence:

- Agent-rft patterns explicitly call for reward-hacking pressure tests
  (.harness/research/deep/2026-05-19-agent-rft-patterns-evidence.md:296-324).

Probable root cause:

- Graders that inspect final prose but not action traces and validation.

Severity:

- High for autonomous workflows.

Mitigation strategy:

- Grade trace, evidence, and final state together.

Recommended guardrails:

- Negative evals for fake validation, stale evidence, omitted blockers, and
  unsupported completion.

### Failure: Deep Module Drift

Description:

- Command files grow back into mixed-responsibility modules.

Evidence:

- Module-layout notes state that callers stay on small facades and tests guard
  the boundary (.harness/implementation-notes/2026-05-19-module-layout.html:593-596).

Probable root cause:

- Local fixes are easier in a command facade than a deeper module.

Severity:

- Medium.

Mitigation strategy:

- Keep boundary ratchets and module-layout diagrams current.

Recommended guardrails:

- Command-size and dependency-direction tests.
- Architecture-context freshness checks.

## Reusable Techniques

- Evidence promotion register: record each research source, status, owner,
  target surfaces, validation command, and disposition reason.
- Authority ladder: cold research, secondary execution evidence, load-bearing
  validators/specs/tests/gates.
- Gate-backed closeout: require command outcomes, artifact paths, timestamps,
  and blocker classes.
- Summary-only demotion: explicitly label summaries that are not gate evidence.
- Steering admission record: capture feedback class, principle, searched
  surfaces, durable destination, guard, and validation.
- Attempt ledger: record each retry, recovery action, validation result, and
  stop condition.
- Artifact-first review swarm: each reviewer writes a report; coordinator
  verifies existence before synthesis.
- Deep-module ratchet: command facade stays small, behavior moves to named
  lib domains, tests enforce the boundary.
- Observability feedback loop: collect logs, metrics, traces, UI journey, and
  workload replay before and after a fix.
- Browser validation loop: snapshot before, trigger path, collect runtime
  events, snapshot after, fix, restart, rerun until clean.
- Reward-hacking fixture: intentionally create cases where agents can appear
  correct without valid evidence and ensure the grader catches them.
- .harness namespace pattern: keep injected harness artifacts separate from
  host project docs while preserving portable repo-local operating knowledge.

## Strategic Insights

- Agent engineering is moving from prompt craft toward operating-system design:
  context, tools, feedback, memory, validation, and repo shape.
- The strongest harnesses will make tacit expert judgment visible as code,
  markdown, schemas, and gates.
- Full observability is not only for humans; it becomes an agent reasoning
  substrate when logs, metrics, traces, screenshots, and runtime events are
  queryable.
- The repo layout itself is an agent interface. Deep modules, small facades,
  route maps, and manifest-backed evidence lower token cost and improve repair
  quality.
- Evals must become adversarial. Once agents learn the success language, the
  harness must test for unsupported claims, fake validation, stale evidence,
  and skipped action.
- .harness is strategically preferable to reorganizing customer docs because it
  preserves a portable, injected control plane for both greenfield and
  brownfield systems.

## Key Quotes And Evidence

- "Every piece of steering, correction, clarification, repeated instruction,
  or recovery guidance I give you should be treated as high-signal operational
  telemetry." This user instruction is now reflected by steering admission
  notes and should be treated as a harness operating rule.
- "Implementation notes are secondary-context unless ... promoted"
  (.harness/implementation-notes/README.md:16-17).
- "Callers stay on small facades; agents work inside deeper modules; tests
  guard the boundary"
  (.harness/implementation-notes/2026-05-19-module-layout.html:593-596).
- Ryan strongest idea: repeated corrections become durable context,
  validation, and tooling
  (.harness/research/deep/2026-05-19-ryan-lopopolo-evidence.md:2328-2337).
- Tejas: agent loop inside harness loop
  (.harness/research/deep/2026-05-18-tejas-evidence.md:135-155).
- Tejas: trace history as truth surface
  (.harness/research/deep/2026-05-18-tejas-evidence.md:163-183).
- Tejas: deterministic verification over model claims
  (.harness/research/deep/2026-05-18-tejas-evidence.md:191-204).
- Eno: verification is autonomy boundary
  (.harness/research/deep/2026-05-19-eno-reyes-evidence.md:100-126).
- Sean: specification as source artifact
  (.harness/research/deep/2026-05-18-sean-grove-evidence.md:25-33,
  .harness/research/deep/2026-05-18-sean-grove-evidence.md:37-64).
- Matt: agent-ready codebase, deep modules, context-window austerity, and
  validation risk
  (.harness/research/deep/2026-05-19-matt-pocock-evidence.md:51-63).
- Agent-rft: strict final-outcome graders, rewarded self-validation, and
  reward-hacking pressure tests
  (.harness/research/deep/2026-05-19-agent-rft-patterns-evidence.md:244-260,
  .harness/research/deep/2026-05-19-agent-rft-patterns-evidence.md:269-287,
  .harness/research/deep/2026-05-19-agent-rft-patterns-evidence.md:296-324).

## Final Assessment

Strongest ideas:

- Harness engineering is environment design with deterministic feedback, not
  prompt optimization.
- Verification quality is the autonomy ceiling.
- Specs, goals, receipts, and validators are source artifacts.
- Deep modules and small facades are agent-control boundaries.
- Context budget and source hierarchy are reliability controls.
- Reward-hacking pressure tests are necessary once agents learn the rubric.

Weakest areas:

- Agent-rft and dynamic harness research can be over-promoted without concrete
  eval fixtures or validators.
- Existing evidence manifest statuses do not fully express baseline,
  consolidated, absorbed, secondary, and candidate source relationships.
- Implementation notes remain easy to read as policy unless every synthesis
  restates the secondary-context boundary.
- Subagent review coverage can be overclaimed if artifact verification is not
  enforced.

Most reusable concepts:

- Evidence promotion register.
- Gate-backed vs summary-only evidence.
- Mode-aware strictness.
- Attempt ledger and recovery event.
- Deep-module seam with executable guard.
- Steering admission as durable system improvement.

Highest leverage opportunities:

- Extend .harness/research/evidence-patterns.json with source-role metadata if
  future audits keep needing baseline, consolidated, or secondary distinctions.
- Add eval fixtures for stale evidence, skipped validation, and summary-only
  closeout claims.
- Use .harness as the default injected harness control plane for greenfield and
  brownfield systems.

Most important risks:

- Overclaiming cold research as implemented policy.
- Confusing implementation complete with lifecycle closeout complete.
- Treating runtime summaries as gate evidence.
- Letting context volume hide governing truth.

Immediate implementation candidates:

- Keep this synthesis tracked in .harness/research/evidence-patterns.json.
- Use the authority ladder in future deep extraction artifacts.
- Preserve artifact-first subagent verification and record coverage gaps when
  requested roles fail to write artifacts.

## Subagent Assistance Record

Requested harness roles:

- harness-doc-history-reviewer: completed artifact at
  .harness/implementation-notes/reviews/2026-05-22-deep-research-extraction/harness-doc-history-reviewer.md.
- harness-dev-tools-reviewer: completed artifact at
  .harness/implementation-notes/reviews/2026-05-22-deep-research-extraction/harness-dev-tools-reviewer.md.
- harness-evaluation-reviewer: completed artifact at
  .harness/implementation-notes/reviews/2026-05-22-deep-research-extraction/harness-evaluation-reviewer.md.
- harness-repository-automation-reviewer: requested and retried, but did not
  write the requested artifact before being closed. This is recorded as a
  coverage gap, not counted as completion evidence.

Subagent findings incorporated:

- The final artifact should be a synthesis addendum, not a new duplicate set of
  per-person files.
- Source boundaries and authority tiers must be explicit.
- Agent-rft and dynamic-harness material should stay candidate-level unless
  promoted by a validator, spec, or eval.
- Implementation notes must be used as decision/execution evidence, not as
  primary source evidence.
- Subagent artifact existence must be verified before coverage is counted.
