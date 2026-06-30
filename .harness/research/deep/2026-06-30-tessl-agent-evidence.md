---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: tessl-agent-evidence-2026-06-30
artifact_type: transcript_evidence_extraction
canonical_slug: tessl-agent-evidence
title: Tessl Agent Loop Engineering Evidence Extraction
status: active
date: 2026-06-30
source_type: research
primary_source_url: https://youtu.be/7PKEXIq25H0?si=7kkQ_NfL3aCRLR9R
primary_target_repo: /Users/jamiecraik/dev/coding-harness
authority: secondary-context
lifecycle_status: reviewed
canonical_destination: .harness/research/audits/2026-06-30-evidence-led-codebase-gap-audit.md
owner: coding-harness-maintainers
created: 2026-06-30
last_reviewed: 2026-06-30
review_cadence: on-change
validated_by:
  - pnpm run research:evidence:validate
  - pnpm exec markdownlint-cli2 .harness/research/deep/2026-06-30-tessl-agent-evidence.md
depends_on:
  - .harness/research/2026-06-30-tessl-agent-video-transcript-research.md
evidence_registry_id: 2026-06-30-tessl-agent
---

# Tessl Agent Loop Engineering Evidence Extraction

Generated: 2026-06-30

Primary source: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md

Transcript source:

- URL: https://youtu.be/7PKEXIq25H0?si=7kkQ_NfL3aCRLR9R
- Video ID: 7PKEXIq25H0
- Title: The Tessl Agent: Build Your Software Factory on Autopilot
- Uploader: AI Native Dev
- Transcript words: 10810
- Raw metadata: .harness/research/2026-06-30-video-transcript-batch/raw/7PKEXIq25H0/7PKEXIq25H0.info.json
- Raw captions: .harness/research/2026-06-30-video-transcript-batch/raw/7PKEXIq25H0/7PKEXIq25H0.en.vtt

Evidence posture:

- This is transcript-backed external research, not a repo instruction surface.
- Promote an observation into Coding Harness behavior only after checking the current repo owner surface and adding a validator, spec, skill, CI check, or review artifact.
- Explicit evidence is direct transcript evidence.
- Inferred insight is derived from repeated examples, product behavior, workflow structure, or implied operating constraints.
- Speculative interpretation is plausible harness application that needs separate validation before adoption.

Confidence labels:

- High confidence: directly supported by central or repeated transcript claims.
- Medium confidence: supported by transcript examples but translated into implementation terms.
- Low confidence: plausible extrapolation requiring follow-up evidence.

## Executive Summary

This discussion frames the Tessl Agent as a factory-building interface rather than a general coding agent. Its primary job is to turn interactive agent work into owned, repeatable, observable loops: code review, change-risk triage, skill adherence verification, repo maintenance, architecture review, flaky-test repair, and cost optimization. The important product thesis is that agents should not remain stuck in chat or terminal sessions. Productive agent work should migrate toward background automation, CI/CD checks, scheduled tasks, and pull requests that improve the harness itself.

The strongest engineering pattern is loop-first harness building. Instead of asking teams to pause shipping for months to build internal agent infrastructure, Tessl proposes starting with one recurring loop, observing agent failure through real PRs, CI checks, review comments, issues, and session logs, then converting those observations into skills, verifiers, eval scenarios, and automation updates. This makes harness improvement incremental and attached to real workflow evidence.

The highest-leverage harness concept is the verifier layer: small, fast, targeted LLM linting rules derived from skills and repository context. Verifiers sit between broad natural-language instructions and generated code, asking whether an agent actually followed a specific guideline without spending a large context window every time. This is a concrete control-plane bridge from skills and plugins to code-level enforcement.

The most important governance idea is factory ownership. Tessl's stated position is that the factory, its skills, workflows, policies, and context should be owned by the engineering organization and portable across tools. Tessl provides defaults, orchestration, sandboxes, logs, and optimization support, but the brain of code review or other workflows should be checked into the repo as owned artifacts rather than locked into a vendor black box.

The biggest failure mode is unobserved local agent work. When agent mistakes live only in local sessions, teams either ship through the failure and never improve agent autonomy, or they stop shipping to build internal tooling. The proposed mitigation is to move recurring agent work into legible loops with durable logs, PR comments, CI outcomes, eval extraction, and automated improvement PRs.

## Core Engineering Patterns

### Pattern: Loop-First Harness Building

#### Description

Start with a recurring operational loop rather than a broad platform rewrite. Pick a workflow such as code review, repo maintenance, architecture review, flaky-test repair, or frontend-layout improvement; automate it; observe failures; and let the loop propose incremental harness improvements.

#### Evidence

- Explicit evidence: The transcript describes the Tessl Agent as a factory-building agent that sets up loops to make agents more effective over time.
- Explicit evidence: The code-review story starts with a command such as set up agentic code review and expands into a skill, CI flow, human gate, verifiers, and recurring optimization.
- Explicit evidence: The recurring loop scans PRs, CI checks, PR comments, and coding-agent sessions to find mistakes slipping through.
- Inferred insight: The loop is the unit of harness improvement because it has inputs, outputs, feedback, measurable drift, and a place to attach automation.

#### Why It Matters

Most teams cannot afford to stop feature work to build an ideal agent platform. Loop-first adoption converts harness work into small, evidence-backed increments. It also makes agent failure observable in the same channels where engineering work already happens: PRs, CI, review comments, issues, and scheduled checks.

#### Implementation Opportunities

- Add a loop-spec template for recurring agent workflows: trigger, inputs, tools, owner, expected outputs, failure signals, eval extraction rule, and rollback policy.
- Require new recurring agent automations to emit a compact report artifact with source evidence, proposed change, validation command, and confidence label.
- Create loop categories in .harness: review, risk, maintenance, eval-generation, skill-hardening, and cost-optimization.
- Treat each loop as an owned product surface with quality metrics and a decommission path.

#### Risks / Tradeoffs

- Loops can multiply faster than governance if every recurring task becomes automation.
- A weak loop can generate repeated low-quality PRs and create review noise.
- If observations are shallow, the loop may optimize for visible symptoms rather than root causes.
- If automation owns too much too early, teams may lose human judgment over sensitive changes.

Confidence: High.

### Pattern: Interactive-to-Background Migration

#### Description

Use interactive agent sessions as discovery, then migrate stable recurring work into background actions such as CI/CD checks, scheduled jobs, or automation-generated pull requests.

#### Evidence

- Explicit evidence: The transcript says interactive sessions are a transition period for figuring out what works and what can be delegated.
- Explicit evidence: Tessl Agent suggests recurring actions or CI/CD checks after observing a workflow.
- Inferred insight: Chat or CLI interaction is treated as prototyping; durable automation is the intended steady state.

#### Why It Matters

Interactive usage scales poorly because it consumes synchronous human attention. Background loops scale better, provide repeatable evidence, and can be optimized independently for cost, model choice, and reliability.

#### Implementation Opportunities

- Add a workflow maturity rubric: manual, assisted, repeatable, scheduled, CI-gated, self-improving.
- In PR closeout artifacts, classify whether a task should remain interactive or be promoted to a recurring loop.
- Mine session logs for repeated commands or request patterns and propose automation candidates.

#### Risks / Tradeoffs

- Premature automation can freeze a poorly understood workflow.
- Background actions need strict scope, secrets boundaries, and cancellation controls.
- Some work should remain interactive because ambiguity, risk, or user intent changes too often.

Confidence: High.

### Pattern: Evidence-Backed Skill Creation

#### Description

Create team-owned skills from real repository evidence: PR history, issue trackers, session logs, style conventions, common agent failures, and repeated human review comments.

#### Evidence

- Explicit evidence: The transcript says Tessl reviews PRs, issues, issue trackers, and coding-agent session logs to find style guides, common failure cases, and frequent review feedback.
- Explicit evidence: The agent reports findings before creating a skill, giving humans a chance to correct off-base conclusions.
- Inferred insight: Skill creation is a research and evidence-folding process, not just a prompt-writing task.

#### Why It Matters

Skills become stronger when they encode observed team behavior rather than aspirational policy. The correction step also prevents latent repository noise from being promoted into official instructions.

#### Implementation Opportunities

- Add a skill-intake artifact with fields for evidence sources, inferred rules, human corrections, accepted rules, rejected rules, and unresolved ambiguities.
- Require every new skill rule to cite at least one source class: PR comment, CI failure, issue, design doc, security policy, or session log.
- Create a validator that flags skill rules with no evidence or owner.

#### Risks / Tradeoffs

- Historical review comments may encode stale preferences or individual bias.
- Mining session logs can expose sensitive local details if not redacted.
- Evidence-backed does not mean correct; human review remains necessary before skill promotion.

Confidence: High.

### Pattern: Team-Owned Review Skill

#### Description

Encode code-review practice as an owned skill that can run through CI, leave inline comments, and move across agents or vendors.

#### Evidence

- Explicit evidence: Tessl helps create a PR code-review skill that maps to the team's best practices.
- Explicit evidence: The skill is owned by the team, can be updated, augmented, shared, and reused elsewhere.
- Explicit evidence: The workflow can run in CI and leave inline comments in GitHub.

#### Why It Matters

Code review contains organizational taste. Locking it inside a vendor review system creates portability and governance risk. A repo-owned review skill can be inspected, versioned, tested, and reused across model providers.

#### Implementation Opportunities

- Store review rules in a repo-owned skill or review spec with stable IDs and test cases.
- Run review skill checks as warning-only at first, then promote narrow reliable checks to gates.
- Include review-skill version and model/provider in review artifacts.
- Add a CodeRabbit/Linear/Codex bridge that distinguishes vendor comments from repo-owned review-skill findings.

#### Risks / Tradeoffs

- Poorly scoped review skills can become generic style nags.
- Review automation can duplicate existing tools unless it has a clear differentiated role.
- Inline comments from agents need severity calibration to avoid reviewer fatigue.

Confidence: High.

### Pattern: Human-Risk Gate

#### Description

Run a change-risk verifier on each PR to decide whether human review is required under an organization-owned policy.

#### Evidence

- Explicit evidence: Tessl introduces a PR review human gate for determining when humans must review versus when agent review can handle the PR.
- Explicit evidence: The policy should be agreed with security, privacy, and other involved teams.
- Explicit evidence: Tessl calls this a change risk verifier and can tune strictness.

#### Why It Matters

The hard question is not whether an agent can review code; it is when human review remains necessary. A risk gate preserves human attention for high-risk changes while making automation auditable.

#### Implementation Opportunities

- Define PR risk dimensions: auth, payments, data deletion, privacy, migrations, dependencies, security-sensitive paths, public API changes, generated artifacts, and infra changes.
- Require the gate to produce an explicit decision: human_required, agent_review_allowed, or blocked_for_missing_context.
- Add policy owners and appeal paths for false positives or false negatives.
- Keep risk-gate output separate from test status and merge readiness.

#### Risks / Tradeoffs

- False negatives are serious because risky changes could bypass human review.
- False positives can erase automation benefits by routing too much to humans.
- Risk policies can drift behind product architecture unless path ownership is maintained.

Confidence: High.

### Pattern: Verifiers As LLM Lint

#### Description

Translate skills, design guidelines, and repository context into many small, targeted, fast checks that inspect whether a change follows a specific instruction.

#### Evidence

- Explicit evidence: Verifiers are described as small, targeted, fast LLM linting rules derived from existing skills and context.
- Explicit evidence: The accessibility example checks whether frontend changes apply ARIA properties correctly.
- Explicit evidence: Stacking focused verifiers catches mistakes where agents do not adhere to codified skills.
- Inferred insight: Verifiers operationalize context adherence without reloading full skills into a large review prompt every time.

#### Why It Matters

Natural-language instructions are weak unless there is a verification path. Verifiers create a scalable enforcement layer between broad skills and generated code.

#### Implementation Opportunities

- Create one verifier per narrow invariant, not one giant review prompt.
- Require each verifier to declare scope selector, evidence source, pass/fail criteria, cost budget, known false positives, and escalation path.
- Run verifiers on changed files only where practical.
- Promote stable verifiers into deterministic linters when the rule becomes formal enough.

#### Risks / Tradeoffs

- LLM lint can be nondeterministic and expensive if not tightly scoped.
- Verifier sprawl can become another governance problem.
- Overlapping verifiers may produce contradictory feedback.

Confidence: High.

### Pattern: Observation-Derived Evals

#### Description

Extract eval scenarios from real failures, review comments, issues, and PR behavior rather than relying only on hand-authored synthetic test cases.

#### Evidence

- Explicit evidence: The recurring loop creates evaluation scenarios after observing mistakes and simulates PRs to test proposed fixes.
- Explicit evidence: The transcript says evals can be extracted from the review process and real-world scenarios.
- Inferred insight: Evals become a side effect of operations rather than a separate discipline that developers must remember to perform.

#### Why It Matters

Developers often avoid writing docs and tests. Observation-derived evals reduce that burden and keep evaluation anchored in actual failure modes.

#### Implementation Opportunities

- Add a failure_to_eval workflow: capture failing PR/comment/session, minimize it, create eval case, run before/after, and link to skill/verifier update.
- Tag eval cases by source: human_review_comment, ci_failure, agent_session_failure, issue_reopen, security_review.
- Require eval scenarios for recurring agent failure classes before adding broader automation.

#### Risks / Tradeoffs

- Extracted evals can overfit to local incidents.
- Privacy and secret redaction are mandatory if session logs or PR content contain sensitive data.
- Evals generated by the same loop that fixes the issue require independent calibration.

Confidence: High.

### Pattern: Delegation Is Cost Optimization

#### Description

Optimize costs by moving repeated work from general interactive agents into bounded skills, plugins, and workflows where model choice, open models, sandboxing, and eval-based tradeoffs can be tuned.

#### Evidence

- Explicit evidence: The transcript discourages optimizing every interactive session's model choice upfront.
- Explicit evidence: Repetitive tasks should be carved off into dedicated skills or plugins.
- Explicit evidence: Once a workflow runs often, teams can compare small or open models against quality and cost.
- Inferred insight: Cost optimization depends on workflow structure more than operator discipline.

#### Why It Matters

As agent usage scales, generic best-model-everywhere usage becomes expensive. Bounded workflows create measurement points where lower-cost models can be tested safely.

#### Implementation Opportunities

- Track per-loop run frequency, model/provider, average cost, failure rate, latency, and human intervention rate.
- Use eval packs to compare model/provider choices for a recurring loop.
- Prefer best available model for ambiguous interactive work, then optimize only after the work is boxed and repeatable.

#### Risks / Tradeoffs

- Over-optimizing too early can degrade output quality.
- Model substitutions need eval evidence, not cost pressure alone.
- Cost telemetry can be misleading if it ignores human rework or downstream failure costs.

Confidence: High.

### Pattern: Open Modular Factory Ownership

#### Description

Treat the software factory as a company-owned, portable technology stack composed of rails, context, skills, workflows, policies, and interchangeable service providers.

#### Evidence

- Explicit evidence: The transcript argues the factory is part of a team's software discipline and should be owned.
- Explicit evidence: Tessl is positioned as platform-like rather than a black-box framework or end-to-end solution.
- Explicit evidence: The brain of code review should be a skill checked into the repo and usable with any agent.
- Inferred insight: Context and workflow artifacts are strategic IP, not disposable config.

#### Why It Matters

Agent factories will produce core product work. Vendor lock-in at that layer creates pricing, portability, security, and strategic risk. Ownership also makes audits and incident reviews more credible.

#### Implementation Opportunities

- Keep policies, review skills, verifier specs, eval cases, and workflow definitions in repo-owned or org-owned storage.
- Separate vendor-provided rails from organization-owned context.
- Make provider bindings explicit: agent, model, sandbox, CI, issue_tracker, review_surface.
- Validate that core factory artifacts can run through at least one alternate provider path.

#### Risks / Tradeoffs

- Building everything internally can become a distraction.
- Open modular systems need interface contracts, versioning, and compatibility tests.
- Portability can be nominal if proprietary runtime behavior is still assumed.

Confidence: High.

### Pattern: Factory From Either End

#### Description

Teams can build toward a factory from two starting points: governance-first skill inventory and standardization, or loop-first automation around a concrete agent workflow.

#### Evidence

- Explicit evidence: The transcript describes teams with skill sprawl starting from inventory, security review, policies, and quality review.
- Explicit evidence: Leading-edge teams may start with loops like code review or frontend-layout improvement.
- Explicit evidence: A single team can prove value first, then scale governance and standardization.

#### Why It Matters

Different organizations have different maturity and pain points. A one-size adoption path fails. The useful strategy is to match the entry point to current risk: sprawl, security, productivity, or repeated agent failure.

#### Implementation Opportunities

- Offer two operating tracks: governance-first and loop-first.
- Use skill registry growth as a trigger for governance work.
- Use repeated workflow failures as a trigger for loop-first automation.
- Define promotion criteria from team-local loop to org-wide pattern.

#### Risks / Tradeoffs

- Governance-first can become slow and abstract without a workflow payoff.
- Loop-first can create ungoverned local automations if not later reconciled.
- Teams may scale before ownership and policy are ready.

Confidence: Medium.

## Tooling & Ecosystem

### Tessl Agent

- Purpose: CLI-first vertical agent for building and improving agent workflows, skills, loops, and software-factory components.
- Workflow role: Orchestrates setup, evidence gathering, skill creation, CI/CD wiring, human gates, verifiers, recurring loops, and optimization PRs.
- Integration opportunities: Coding Harness could model similar command outputs as evidence artifacts rather than opaque chat transcripts.
- Implied best practices: Start from outcomes; inspect existing repo evidence; propose owned artifacts; push stable work into recurring actions.
- Strengths: Focused domain; automation-friendly; bridges skills, CI, review, evals, and logs.
- Limitations: Product-specific claims need independent validation; a factory-building agent can create automation sprawl without governance.

### Tessl Skills

- Purpose: Package team context, best practices, and workflow rules as reusable owned artifacts.
- Workflow role: Drives code review, plugin behavior, context sharing, and verifier generation.
- Integration opportunities: Align with .agents/skills, repo-local skills, and skill registry governance.
- Implied best practices: Keep skills owned, versioned, reviewable, shareable, and reusable across workflows.
- Strengths: Portable context layer; natural boundary for team taste.
- Limitations: Skills need validation and dedupe; skill sprawl can emerge quickly.

### Tessl Plugins

- Purpose: Encapsulate workflow components or runnable behaviors that agents can use.
- Workflow role: Pair with skills to execute recurring actions and code review harnesses.
- Integration opportunities: Map plugin outputs to repo-owned command contracts and validation gates.
- Implied best practices: Plugins should be modular and swappable, not hard-coded to one provider.
- Strengths: Turns knowledge into executable workflow units.
- Limitations: Plugin governance and lifecycle management are required.

### Tessl Launch

- Purpose: Cloud agent execution environment with logs, longer runtime, agent switching, and workflow support.
- Workflow role: Runs agents in a managed environment for repeatable automation and optimization loops.
- Integration opportunities: Compare against local worktree, CI runner, Codex Desktop, and sandbox execution paths.
- Implied best practices: Make agent execution observable; do not depend on short-lived action tokens or brittle local state.
- Strengths: Environment management, logs, provider switching, long-running task support.
- Limitations: Cloud execution introduces data, trust, cost, and permission questions.

### Cloud Sandbox

- Purpose: Hosted execution environment for agent code review or automation.
- Workflow role: Provides runnable context and log observability for review loops.
- Integration opportunities: Attach sandbox logs to review artifacts or workflow-closeout receipts.
- Implied best practices: Every automated agent run should be inspectable after the fact.
- Strengths: Centralized logs and consistent environment.
- Limitations: Requires security boundaries and data retention policy.

### GitHub Actions / CI/CD

- Purpose: Trigger recurring or PR-based agent workflows.
- Workflow role: Runs review skills, risk gates, verifiers, maintenance loops, and scheduled checks.
- Integration opportunities: Convert narrow harness checks into CI warnings or gates with exact evidence.
- Implied best practices: Use CI as a durable, reviewable automation surface instead of local-only agent behavior.
- Strengths: Existing developer workflow surface; integrates with PR status and review.
- Limitations: Token lifetimes, runtime limits, cost, and noisy checks can limit usefulness.

### GitHub Inline Comments

- Purpose: Surface agent review results directly on changed lines.
- Workflow role: Allows review skill outputs to meet developers where they already review changes.
- Integration opportunities: Label comments by source, severity, verifier ID, and confidence.
- Implied best practices: Keep comments actionable and severity-calibrated.
- Strengths: High-context feedback surface.
- Limitations: Comment noise can reduce trust quickly.

### Issue Trackers

- Purpose: Provide workflow context and route tasks into agent environments.
- Workflow role: Source of recurring tasks, requirements, failures, and postback updates.
- Integration opportunities: Link issue IDs to agent runs, PRs, verifier updates, and eval cases.
- Implied best practices: Agent loops should post evidence back to the tracker.
- Strengths: Preserves planning and accountability context.
- Limitations: Issue data can be stale or underspecified.

### Coding-Agent Session Logs

- Purpose: Evidence source for repeated failures, successful recurring tasks, and opportunities for delegation.
- Workflow role: Mined by Tessl to infer style guides, failure cases, review feedback, and automation candidates.
- Integration opportunities: Use local Codex sessions or session-collector output as a controlled evidence source.
- Implied best practices: Session logs should be searchable, redacted, and connected to follow-up artifacts.
- Strengths: Captures real operator behavior.
- Limitations: Privacy, volume, and local-only visibility risks.

### Codex, Claude Code, Gemini, Open Models

- Purpose: Interchangeable coding/review agents or model providers.
- Workflow role: Tessl orchestrates the agent of choice rather than replacing it.
- Integration opportunities: Model/provider matrix for recurring loops with eval-backed selection.
- Implied best practices: Keep workflow brain portable across agents.
- Strengths: Provider flexibility and cost optimization.
- Limitations: Behavior variance; model-specific obedience and capability changes.

### Verifiers

- Purpose: Small targeted LLM lint checks for skill adherence.
- Workflow role: Enforce specific guidelines on incoming changes.
- Integration opportunities: Add verifier specs and results to research-to-validator promotion.
- Implied best practices: Scope narrowly, run cheaply, link to source skill and eval cases.
- Strengths: Bridges natural-language context to code-level checks.
- Limitations: Nondeterminism and false positives require calibration.

### Evals

- Purpose: Measure whether a skill, plugin, verifier, or model choice handles observed scenarios.
- Workflow role: Compare fixes, simulate PRs, optimize cost/quality, and validate recurring loops.
- Integration opportunities: Build eval packs from PR comments, failures, and session logs.
- Implied best practices: Use real scenarios; compare before/after; preserve provenance.
- Strengths: Converts subjective workflow quality into repeatable tests.
- Limitations: Can overfit; must be refreshed as codebase and models change.

### Tessl Learn

- Purpose: Education surface for agent patterns and learning material.
- Workflow role: Helps users keep up with fast-changing practices.
- Integration opportunities: Treat training material as another context artifact that can be versioned and tested.
- Implied best practices: Product education must update at agent-speed.
- Strengths: Reduces knowledge burden for users.
- Limitations: Education content can drift without validation against actual workflow behavior.

## Harness Engineering Insights

### Orchestration

- A vertical factory-building agent should orchestrate other coding agents rather than trying to be the best general coding agent itself.
- Orchestration includes evidence gathering, skill creation, CI wiring, sandbox selection, model/provider selection, review output, and follow-up PR creation.
- The orchestrator should preserve artifacts in owned surfaces: repo skills, CI config, eval cases, verifier specs, issue comments, and logs.
- Provider agnosticism is a control-plane property, not a nice-to-have.

### Validation

- Validation should exist at multiple levels: code review skill, change-risk gate, narrow verifier, eval scenario, CI status, and human policy review.
- Verifiers are especially useful where deterministic static checks are not yet available but context adherence matters.
- The strongest validation chain is: observed failure -> proposed skill/verifier change -> simulated PR/eval run -> improvement PR -> monitored recurrence.
- Human review decisions should be policy outputs, not implied by whether tests pass.

### Context

- Context is treated as portable factory fuel: skills, style guides, policies, issue history, PR comments, logs, and user workflows.
- Context should be owned by the organization and checked into a portable surface where practical.
- The harness should not require loading all context for every run; small verifiers and scoped skills reduce token waste.
- Context governance becomes urgent once skills grow from a few team artifacts into thousands of organization-wide artifacts.

### Routing

- Route work by outcome: code review, risk analysis, skill adherence, repo readiness, flaky tests, architecture review, frontend-layout improvement, cost optimization.
- Route high-frequency recurring work into boxed workflows where models and costs can be optimized.
- Route risky or ambiguous work to humans using explicit policy rather than informal intuition.
- Route maturity by entry point: governance-first for skill sprawl, loop-first for repeated agent failure or productivity bottlenecks.

### Memory

- Session logs, PR comments, CI failures, and issue feedback form operational memory.
- Memory becomes valuable when it is mined into owned skills, verifiers, evals, and recurring automation.
- Local-only memory is a risk because it hides repeated failures from the team and from improvement loops.
- Memory must be redacted, scoped, and linked to artifacts before it becomes governance input.

### Evals

- Evals can be generated from observed operational failures, not just designed upfront.
- Evals are also a cost tool: they enable comparing a recurring workflow across models or providers.
- Eval provenance matters; each scenario should know which real failure or review comment produced it.
- Evals should test skills/plugins/verifiers in combination, because workflow quality depends on the assembled harness.

### Governance

- Teams need policies for when human review is required.
- Security, privacy, and other policy owners should shape risk gates.
- Skills and factories should have ownership, review, security inspection, dedupe, and lifecycle policies.
- Vendor-provided defaults are acceptable starting points, but organization-owned artifacts should remain portable.

### Scaling

- Agent adoption can cause skill sprawl rapidly; governance primitives must arrive earlier than teams expect.
- Effective factory size may grow faster than human team size because recurring loops and agents multiply.
- Cost optimization becomes meaningful at loop boundaries, especially high-frequency workflows like PR review.
- Product teams may ship faster than GTM and users can absorb; an agent interface can translate stable user intent into changing product capabilities.

### Recovery

- Repeated agent mistakes should trigger harness improvement rather than repeated manual correction.
- The right recovery loop captures the failure, proposes a skill/verifier/eval update, validates it, and submits a small PR.
- If a loop itself degrades, create a loop around the loop: monitor quality, cost, false positives, and human intervention rate.
- Failures should be classified by missing context, weak skill, missing verifier, weak eval, bad model choice, insufficient sandbox, or ambiguous policy.

## Implied Best Practices

- Treat agent workflow automation as product engineering, with owned artifacts, observability, and iteration.
- Start with one loop that directly removes a painful recurring task.
- Keep human approval for policy and risk boundaries even as routine work moves to agents.
- Make generated agent work legible through CI, PRs, logs, and evidence artifacts.
- Convert repeated review comments into skills or verifiers.
- Convert repeated agent failures into eval cases.
- Do not optimize model choice globally; optimize boxed recurring workflows after measurement.
- Keep skills portable and checked into a repository or owned registry.
- Prefer modular factory platforms over closed black-box workflow providers.
- Separate rails from context: vendors can provide execution rails, but the organization should own workflow knowledge.
- Use agent logs as improvement evidence, but never promote them raw without redaction and human correction.
- Treat ease of use as a core adoption requirement; if creating evals or loops is too hard, teams will not do it.
- Design agent-facing tools around outcomes rather than product-specific command vocabulary.
- Use narrow checks instead of giant all-context prompts when validating skill adherence.
- Create explicit strictness controls for human-risk policies.
- Start local/team-scoped, then introduce governance as the workflow crosses team boundaries.
- Preserve portability across Codex, Claude Code, Gemini, and open models where recurring workflows justify it.

## Failure Modes & Mitigations

### Failure: Local Maximum Shipping

#### Description

Teams push through agent mistakes to ship features and never invest in making agents more autonomous.

#### Evidence

- Explicit evidence: The transcript describes teams choosing between shipping through a mistake or pausing to do science.
- Explicit evidence: Teams that only focus on shipping get stuck and never fix agents.

#### Probable Root Cause

Harness improvement is treated as separate internal tooling work rather than part of the delivery loop.

#### Severity

High.

#### Mitigation Strategy

Attach improvement to recurring loops that create small PRs from observed failures. Make harness hardening a side effect of real work.

#### Recommended Guardrails

- Every repeated failure class must produce one of: skill update, verifier, eval, deterministic test, or documented exception.
- Track repeated failure classes across PRs.
- Require owner approval before ignoring a third occurrence of the same agent failure.

Confidence: High.

### Failure: Tooling Gulf / Velocity Drop

#### Description

Disciplined teams may pause shipping for months to build internal agent infrastructure.

#### Evidence

- Explicit evidence: The transcript describes a gulf where disciplined teams shift work into internal tooling and suffer a velocity drop.

#### Probable Root Cause

The team tries to build the entire factory before proving one loop.

#### Severity

High.

#### Mitigation Strategy

Start with a narrow loop, use vendor/default primitives where acceptable, and keep owned artifacts portable.

#### Recommended Guardrails

- For any new factory component, require a named loop that will use it within one week.
- Reject platform work without a workflow owner and feedback metric.
- Timebox factory infrastructure spikes and produce a working loop artifact.

Confidence: High.

### Failure: Unobserved Agent Failure

#### Description

Agent mistakes remain trapped in local coding-agent sessions and are not visible to team-level improvement systems.

#### Evidence

- Explicit evidence: The transcript says insights into agent failures can be locked away in local coding-agent session logs.
- Explicit evidence: Moving loops into PR review makes failures available and legible.

#### Probable Root Cause

Local interactive sessions have no standard artifact, redaction, indexing, or feedback path.

#### Severity

High.

#### Mitigation Strategy

Collect, redact, summarize, and route session evidence into durable improvement artifacts.

#### Recommended Guardrails

- Require recurring loops to emit logs and compact run summaries.
- Add secret redaction before session evidence is used for skill or eval generation.
- Link improvement PRs to source failure artifacts.

Confidence: High.

### Failure: Black-Box Review Brain

#### Description

The organization's review taste is locked inside a vendor tool rather than owned as a portable skill or policy.

#### Evidence

- Explicit evidence: The transcript argues the brain of code review should not be locked inside the harness and should be a skill checked into the repo.

#### Probable Root Cause

Convenience of one-click review tooling hides the strategic value of owned review context.

#### Severity

High.

#### Mitigation Strategy

Maintain repo-owned review skills, policy IDs, severity conventions, and eval cases.

#### Recommended Guardrails

- No durable review rule without a source artifact and owner.
- Review automation must declare whether feedback came from vendor default, repo skill, verifier, or human.
- Periodically export or mirror review configuration into owned storage.

Confidence: High.

### Failure: Risk Gate False Negative

#### Description

The automated change-risk verifier allows a PR to skip human review when human review was required.

#### Evidence

- Explicit evidence: The transcript proposes policy-based analysis of every PR to decide whether it needs a human.
- Inferred insight: This creates an obvious high-impact false-negative risk.

#### Probable Root Cause

Policy gaps, stale path ownership, ambiguous risk categories, or poor model judgment.

#### Severity

Critical.

#### Mitigation Strategy

Start strict, log decisions, sample agent-approved PRs, and require human review for sensitive categories until enough evidence exists.

#### Recommended Guardrails

- Default to human review for auth, privacy, security, data migration, dependency, billing, infra, or public API changes.
- Require risk-gate rationale and cited files.
- Sample and audit agent-approved PRs weekly.
- Keep human-risk gate separate from merge readiness.

Confidence: Medium.

### Failure: Verifier Sprawl

#### Description

Many narrow LLM verifiers accumulate without ownership, overlap, cost controls, or calibration.

#### Evidence

- Explicit evidence: The transcript recommends stacking many focused verifiers.
- Inferred insight: The same pattern can become unmanageable without registry and lifecycle controls.

#### Probable Root Cause

Each repeated failure gets a new verifier, but old or overlapping verifiers are not retired.

#### Severity

Medium.

#### Mitigation Strategy

Maintain a verifier registry with owner, scope, source skill, last hit, false-positive rate, cost, and retirement criteria.

#### Recommended Guardrails

- Require verifier IDs and narrow selectors.
- Deduplicate verifier intent before adding a new one.
- Promote stable rules to deterministic checks where possible.
- Retire verifiers with low signal or high false positives.

Confidence: Medium.

### Failure: Eval Overfitting

#### Description

Observation-derived evals become too tailored to past failures and fail to predict future workflow quality.

#### Evidence

- Explicit evidence: The transcript proposes extracting evals from real-world scenarios and simulating PRs.
- Inferred insight: Incident-derived evals need diversity and generalization checks.

#### Probable Root Cause

The eval generation loop optimizes for the most recent failure rather than the underlying invariant.

#### Severity

Medium.

#### Mitigation Strategy

Group evals by invariant, include counterexamples, and periodically review eval coverage against recent failures.

#### Recommended Guardrails

- Each eval must state the general rule it tests.
- Add at least one near-miss or negative case for important evals.
- Track eval age and last production failure class.

Confidence: Medium.

### Failure: Cost-Driven Quality Regression

#### Description

Teams switch recurring workflows to cheaper models without enough evidence that quality remains acceptable.

#### Evidence

- Explicit evidence: The transcript discusses accepting a model that is slightly worse but much cheaper after running the workflow through its paces.

#### Probable Root Cause

Cost pressure outruns eval rigor and human sampling.

#### Severity

Medium.

#### Mitigation Strategy

Require model substitution to pass a loop-specific eval suite and monitored rollout.

#### Recommended Guardrails

- Model changes need before/after quality, cost, latency, and intervention metrics.
- Roll out cheaper model choices to a subset of runs first.
- Keep fallback to stronger model for ambiguous or high-risk cases.

Confidence: Medium.

### Failure: Skill Sprawl

#### Description

Organizations accumulate thousands of skills without knowing which are current, duplicated, secure, or effective.

#### Evidence

- Explicit evidence: The transcript says teams can quickly move from a small number of skills to a huge skill inventory.
- Explicit evidence: Tessl addresses inventory, security review, vulnerability detection, policies, and quality review.

#### Probable Root Cause

Agent-speed creation outpaces human-speed governance.

#### Severity

High.

#### Mitigation Strategy

Introduce skill inventory, ownership, dedupe, security review, quality scoring, and retirement before broad rollout.

#### Recommended Guardrails

- Every skill needs owner, scope, evidence source, last-used, security posture, and replacement relationships.
- Add duplicate detection and active/archive links.
- Block new org-wide skills without review.

Confidence: High.

### Failure: Vendor Lock-In At Factory Layer

#### Description

Core workflow knowledge, context, and policies become dependent on one integrated platform.

#### Evidence

- Explicit evidence: The transcript warns against a fully integrated solution owning the work that differentiates the company.
- Explicit evidence: Context and artifacts should be owned so teams can move providers.

#### Probable Root Cause

Buying convenience without separating vendor rails from organization-owned context.

#### Severity

High.

#### Mitigation Strategy

Keep workflow knowledge in portable, versioned artifacts and test alternate execution rails.

#### Recommended Guardrails

- Export policy, skill, verifier, and eval definitions to repo-owned formats.
- Avoid proprietary-only authoring paths for core review or automation logic.
- Run periodic portability drills for critical loops.

Confidence: High.

### Failure: Ease-Of-Use Gap

#### Description

Good practices such as eval writing, skill hardening, and loop creation are known but too hard for teams to do consistently.

#### Evidence

- Explicit evidence: The transcript emphasizes that if a practice is not easy, people will not do it.
- Explicit evidence: Tessl packages tools, skills, harness, and a control center to reduce adoption friction.

#### Probable Root Cause

The workflow asks developers to understand too many fast-changing primitives before seeing value.

#### Severity

High.

#### Mitigation Strategy

Expose outcome-oriented commands, infer setup from repository evidence, and generate owned artifacts with reviewable diffs.

#### Recommended Guardrails

- Prefer make my repo agent ready style commands that produce concrete PRs.
- Keep generated changes small and explainable.
- Include rollback instructions and confidence labels in automation PRs.

Confidence: High.

## Reusable Techniques

- failure_to_skill: Convert repeated human review feedback into a skill update with source evidence.
- failure_to_verifier: Convert a repeated skill-adherence problem into a narrow verifier.
- failure_to_eval: Convert a real PR failure into a minimized eval scenario.
- loop_spec: Define trigger, scope, tools, expected output, validation, owner, and escalation policy for every recurring automation.
- risk_gate: Run policy-backed PR risk classification before deciding whether human review can be skipped.
- verifier_registry: Track verifier ID, source skill, selector, cost, false-positive rate, last hit, and retirement status.
- model_matrix: Evaluate recurring workflows across Codex, Claude Code, Gemini, and open models against quality/cost/latency.
- session_log_mining: Mine agent sessions for repeated successful tasks, repeated failures, and automation candidates.
- owned_review_brain: Keep review rules as repo-owned skill/spec artifacts rather than only vendor settings.
- automation_candidate_scan: Ask which recurring tasks succeed often enough to move into CI/CD or scheduled actions.
- loop_on_loop: Monitor recurring loop quality and generate improvements to the loop itself.
- context_portability_drill: Prove a review skill or verifier can run on an alternate agent/provider.
- strict_then_relax: Start risk policies strict, then relax based on audited evidence.
- determinize_when_stable: Promote reliable LLM verifier rules into deterministic linters or static checks when possible.
- small_pr_improvement: Each loop improvement should land as a small PR with evidence, before/after eval, and rollback.

## Strategic Insights

- The software factory becomes part of the engineering organization's core IP. The durable assets are not only source code, but skills, policies, evals, verifiers, logs, and workflow definitions.
- Agent vendors are becoming rails and orchestration layers. Competitive advantage comes from owned context and workflow knowledge that can move across rails.
- The product interface is shifting from command vocabulary to outcome vocabulary. Users increasingly expect to state the desired outcome and let the agent assemble tools, skills, and workflow steps.
- Cost optimization becomes a harness discipline. It is not mainly about asking humans to pick cheaper models; it is about boxing recurring workflows so model choice can be tested.
- Governance must arrive earlier in agent adoption because agent-speed creation produces skill, workflow, and policy sprawl quickly.
- Evals become operational memory. The best evals are not abstract benchmarks but captured examples of what the organization learned from actual failures.
- Product companies may need agent interfaces to keep users current as shipping velocity outpaces documentation, GTM, and human learning cycles.
- The future factory likely has multiple specialized lines: code review, issue handling, design validation, frontend layout, security review, release management, docs, and customer-facing artifact generation.

## Key Quotes & Evidence

Only short quotes are included here; most evidence above is paraphrased to avoid over-quoting the transcript.

- "factory building agent" - supports the claim that Tessl Agent is positioned as a harness/factory builder, not just a coding agent.
- "almost get you to stop using it" - supports the interactive-to-background migration pattern.
- "checked into our repo" - supports the portable ownership claim for the review brain.

Evidence anchors:

- Transcript metadata and source boundary: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:1
- Factory-building agent and CLI interface: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:143
- Interactive-to-background migration and CI/CD suggestion: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:200
- Agentic code review setup story: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:246
- Evidence-backed skill creation from PRs, issues, and session logs: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:266
- Team-owned review skill and CI/GitHub flow: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:306
- Agent/model agnostic review execution: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:383
- Human review risk gate and policy: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:426
- Verifiers as focused LLM linting rules: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:471
- Recurring daily/weekly improvement loop: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:537
- Loop-first adoption and local maxima: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:610
- Observation-derived evals: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:706
- Cost optimization through boxed recurring workflows: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:794
- Tessl Launch and environment primitives: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:943
- Open modular factory ownership: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:1045
- Context and review brain portability: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:1158
- Skill sprawl and governance-first path: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:1242
- Loop-first path and team-local scaling: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:1320
- Product-shape thesis: tools, skills, harness, control center: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:1533
- Outcome-oriented product interface: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:1580
- Other loop examples: delegation scan, frontend failures, repo readiness, architecture review, flaky tests: .harness/research/2026-06-30-tessl-agent-video-transcript-research.md:1660

## Final Assessment

Strongest ideas:

- Loop-first harness building as a practical path from manual agent use to automated software factory.
- Verifiers as a scalable bridge between skills/context and code-level enforcement.
- Observation-derived evals as a way to convert real workflow failures into reusable validation.
- Human-risk gates that preserve scarce human review attention for high-risk work.
- Open modular factory ownership, especially keeping the review brain and workflow context portable.

Weakest areas:

- The transcript is product-launch oriented, so it asserts workflow value more than it demonstrates empirical outcomes.
- Verifier accuracy, cost, nondeterminism, and false-positive behavior are not deeply quantified.
- The risk-gate story needs stronger safety evidence before use as a merge or review bypass.
- Session-log mining raises privacy, redaction, and governance questions that are acknowledged only indirectly.

Most reusable concepts:

- Skill-backed code review.
- Change-risk verifier.
- Small focused LLM verifier checks.
- Daily/weekly failure-mining loop.
- Failure-to-eval extraction.
- Model/cost optimization on boxed recurring workflows.
- Repo-owned context as portable factory IP.

Highest leverage opportunities:

- Build a Coding Harness loop-spec template and require every recurring agent automation to declare owner, trigger, evidence, validation, and rollback.
- Add a failure-to-eval workflow for repeated PR/CI/review failures.
- Create a verifier registry for narrow LLM lint checks, with retirement and deterministic-promotion paths.
- Separate review truth lanes: human-risk gate, agent review, deterministic CI, CodeRabbit/vendor review, local validation, and merge/readiness state.
- Mine existing Codex session logs only through a redacted, evidence-preserving workflow.

Most important risks:

- False-negative human-risk gating.
- Skill and verifier sprawl.
- Vendor lock-in at the factory layer.
- Cost-driven quality regressions.
- Local-only agent failure evidence.
- Automation PR noise.
- Product claims outpacing validated operating proof.

Immediate implementation candidates:

1. Add loop-spec and failure-to-eval templates under the harness research or governance surface.
2. Pilot one warning-only verifier derived from an existing repo skill or PR failure.
3. Create a review artifact field that identifies whether feedback came from human, CodeRabbit, Codex, verifier, deterministic CI, or risk gate.
4. Add a small registry for recurring loops: owner, schedule, model/provider, cost, last result, false-positive notes, and linked evals.
5. Define a strict initial PR human-risk policy and explicitly keep it separate from readiness or mergeability claims.

## Validation Evidence

- Command: pwd -> pass (/Users/jamiecraik/dev/coding-harness)
- Command: git status --short --branch -> pass (## HEAD (no branch))
- Command: find .harness/research -maxdepth 3 -type f | sort | head -80 -> pass (confirmed existing transcript/research layout)
- Command: yt-dlp --version -> pass (2026.06.09)
- Command: head -120 .harness/research/2026-06-30-tessl-agent-video-transcript-research.md -> pass (confirmed existing transcript intake for target video)
- Command: wc -l .harness/research/2026-06-30-tessl-agent-video-transcript-research.md .harness/research/deep/2026-05-18-sean-grove-evidence.md -> pass (confirmed source and prior deep extraction format sizes)
- Command: rg -n "Tessl|agent|loop|spec|MCP|CI|validation|eval|GitHub|IDE|Cursor|Claude|Codex|factory|review|PR|test|workflow|background|memory|context|tool|autopilot" .harness/research/2026-06-30-tessl-agent-video-transcript-research.md | head -220 -> pass (identified evidence bands)

## Promotion Boundary

This artifact is research. It does not itself authorize new CI checks, recurring automations, CodeRabbit settings, Tessl installation, or global observability changes. Any promotion should name the owner surface, add a narrow validator or workflow spec, and keep local validation, hosted checks, review-thread state, tracker state, and merge/readiness state separate.
