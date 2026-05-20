# Agent-Ready Codebase And Harness Skills Evidence

Generated: 2026-05-19

Primary source batch:

- .harness/research/2026-05-19-video-transcript-batch/manifest.json
- .harness/research/2026-05-19-video-transcript-batch/transcripts/6BB6exR8Zd8 - I stopped using grill-me for coding. Heres what I use instead.txt
- .harness/research/2026-05-19-video-transcript-batch/transcripts/ShuJ_CN6zr4 - Making Codebases Agent Ready Eno Reyes, Factory AI.txt
- .harness/research/2026-05-19-video-transcript-batch/transcripts/uC44zFz7JSM - Your codebase is NOT ready for AI (here's how to fix it).txt
- .harness/research/2026-05-19-video-transcript-batch/transcripts/3MP8D-mdheA - How To De-Slop A Codebase Ruined By AI (with one skill).txt
- .harness/research/2026-05-19-video-transcript-batch/transcripts/MzWIIlx0Gpc - Burn through the backlog from hell with triage.txt
- .harness/research/2026-05-19-video-transcript-batch/transcripts/-uW5-TaVXu4 - Most devs dont understand how context windows work.txt

People / source boundary:

- Matt Pocock: skill-driven individual and team workflows, shared language, context discipline, deep modules, architecture repair, issue triage.
- Eno Reyes / Factory AI: organization-scale agent readiness, verification asymmetry, automated validation, spec-driven workflows, validation as the autonomy bottleneck.

Evidence posture:

- This is cold research. It is not an instruction surface.
- Treat extracted patterns as candidates for future specs, validators, skills, evals, or workflow docs.
- Promote only distilled, validated rules into hot-path repo guidance.

## Executive Summary

The strongest shared conclusion is that agent performance is mostly constrained by the environment around the model, not by the prompt alone. Matt's videos show the local mechanics: a codebase must expose shared language, navigable module boundaries, concise context, explicit decisions, actionable issue states, and feedback loops that agents can use. Eno's talk generalizes this at org level: the limiter on autonomous software work is validation quality. If the organization cannot verify correctness, style, architecture, docs, and deployment safety automatically, it cannot safely scale agents.

The most reusable engineering pattern is a layered agent-readiness control plane: domain vocabulary, architectural decisions, deep modules, issue state machines, validation gates, context budgets, and explicit readiness labels. These layers let humans spend attention on strategy, language, boundaries, and risk while agents execute bounded tactical work.

The biggest failure case is treating agents as superpowered senior engineers. The transcripts repeatedly frame agents as closer to endless new starters: they have no durable memory of the codebase, they struggle with hidden relationships, they are sensitive to bloated context, and they need fast feedback. Codebases that rely on human tacit knowledge, flaky builds, weak tests, shallow modules, and informal backlog judgment become hostile agent environments.

The highest leverage immediate implementation candidates are:

- a repo vocabulary/context document with explicit prompt translations and domain terms,
- ADRs for surprising, hard-to-reverse tradeoffs,
- agent-ready issue states with exactly one category and one state,
- a ready-for-agent brief template,
- architecture-deepening reviews that identify shallow modules and weak boundaries,
- context-window budget discipline for skills, rules, MCP servers, and long sessions,
- validation-gap audits that ask whether agents can prove correctness without human taste.

## Core Engineering Patterns

## Pattern: Shared Language As Agent Compression Layer

### Description

Capture the codebase's domain language in a small, explicit document that humans, agents, and code all use. The goal is not documentation volume. The goal is to reduce repeated explanation, sharpen ambiguous terms, and align names in prompts, planning docs, UI, files, variables, and tests.

### Evidence

- Explicit evidence: Matt says Grill Me repeatedly exposed non-obvious domain terms such as standalone video that the agent had to rediscover.
- Explicit evidence: He replaces Grill Me with Grill with Docs, which looks for context.md, challenges language usage against the existing glossary, sharpens fuzzy language, discusses concrete scenarios, cross-references code, and updates the document during the session.
- Explicit evidence: He says shared language gives concise replies, shorter thinking traces, easier code navigation, and variable/file names aligned with the planning language.
- Inferred insight: vocabulary is a context compression mechanism. It moves repeated domain explanation out of every prompt and into a durable repo artifact.

### Why It Matters

Agents waste tokens and make naming mistakes when domain language is implicit. A glossary turns tacit product knowledge into a stable retrieval target. It also makes future prompts shorter because a phrase such as standalone video can carry a precise meaning.

### Implementation Opportunities

- Maintain a repo-root or bounded-context vocabulary document.
- Include prompt translations for user shorthand, domain aliases, entity meanings, and ambiguous terms.
- Add a skill or checklist that updates vocabulary during planning sessions when new terms emerge.
- Require implementation issues to use vocabulary terms consistently.
- Add a lightweight scan for newly introduced names that conflict with the vocabulary.

### Risks / Tradeoffs

- Vocabulary can become stale if not updated during real planning.
- Over-policing language can slow early exploration.
- A single global glossary can collapse multiple bounded contexts into one overloaded language.

Confidence: High.

## Pattern: Grill With Docs Instead Of Open-Ended Interviewing

### Description

Use an interview skill to resolve ambiguity, but ground the interview in existing repo docs and update those docs as the conversation discovers better language or decisions.

### Evidence

- Explicit evidence: Grill Me interviews until shared understanding is reached, walking the design tree and resolving dependencies between decisions.
- Explicit evidence: Matt finds Grill Me insufficient because useful shared language was not documented and had to be re-explained.
- Explicit evidence: Grill with Docs combines interview behavior with context.md and ADR updates.
- Inferred insight: a skill should not only extract understanding from the user; it should leave behind a reusable artifact.

### Why It Matters

Pure interview prompts are ephemeral. They improve one session but do not improve the next session. A grounded interview that updates durable context compounds.

### Implementation Opportunities

- Add a planning workflow that first reads vocabulary and ADRs.
- During the interview, classify new knowledge as glossary term, ADR candidate, issue acceptance criterion, or implementation detail.
- End the workflow with updated artifacts or an explicit no-update reason.
- Use a brief final check: what did we learn that the next agent would otherwise have to ask again?

### Risks / Tradeoffs

- The skill can over-document temporary ideas.
- Users may accept poor wording too early because it appears in a durable file.
- Updating docs during ideation can create churn unless the destination is scoped.

Confidence: High.

## Pattern: ADRs For Non-Obvious Irreversible Tradeoffs

### Description

Capture decisions that are hard to reverse, surprising without context, and the result of a real tradeoff. Keep them separate from the vocabulary layer, which is for shared language rather than decision history.

### Evidence

- Explicit evidence: Matt adds ADRs for non-obvious decisions that cannot fit into context.md.
- Explicit evidence: He says an ADR is justified when a decision is hard to reverse, surprising without context, and has consequences down the line.
- Inferred insight: vocabulary answers what terms mean; ADRs answer why the system chose a path.

### Why It Matters

Agents often preserve or undo architecture without knowing why it exists. ADRs give agents the tradeoff context needed to avoid locally plausible but globally wrong changes.

### Implementation Opportunities

- Add ADR prompts to planning skills: is this decision hard to reverse, surprising, and tradeoff-heavy?
- Link ADRs from implementation issues and PRs.
- Give reviewers a check for changes that contradict ADRs without migration notes.
- Keep ADRs small and clause-addressable enough for agent retrieval.

### Risks / Tradeoffs

- Too many ADRs make the decision layer noisy.
- Weak ADRs can become stale justifications for bad architecture.
- Agents may cite ADRs as authority without checking whether the implementation drifted.

Confidence: High.

## Pattern: Codebase As New-Starter Environment

### Description

Design the codebase for agents as if each run is a new starter with no memory. Make file layout, module names, exported interfaces, tests, and docs reveal the mental map that experienced maintainers carry in their heads.

### Evidence

- Explicit evidence: Matt says the AI enters the codebase with no memory, like a new starter.
- Explicit evidence: He argues the filesystem and code design should match the developer's mental map.
- Explicit evidence: He says agents struggle when natural groupings are not reflected in the filesystem.
- Explicit evidence: Eno says agents need documentation and validation because they will not invent validation criteria from thin air.

### Why It Matters

Human maintainers can navigate tacit structure. Agents cannot reliably infer it under token and time pressure. Making structure explicit improves search, reduces accidental coupling, and makes validation easier.

### Implementation Opportunities

- Audit whether domain/module boundaries are visible from directory layout.
- Add local README/context files only where they reduce ambiguity.
- Prefer module-level public interfaces over scattered cross-imports.
- Use tests and examples at module boundaries.
- Treat missing onboarding affordances as agent-readiness defects.

### Risks / Tradeoffs

- Over-structuring can create ceremony before a domain stabilizes.
- Directory layout can become misleading if it is not kept aligned with dependencies.
- A codebase can look organized while still having leaky interfaces.

Confidence: High.

## Pattern: Deep Modules As Agent Control Boundaries

### Description

Prefer modules with a simple public interface and substantial internal behavior. The human applies taste at the module boundary, while the agent can work inside the module as long as tests protect behavior.

### Evidence

- Explicit evidence: Matt defines deep modules as lots of implementation behind a simple interface.
- Explicit evidence: He contrasts deep modules with shallow modules that have complex interfaces and little implementation.
- Explicit evidence: He says deep modules improve navigability, reduce cognitive burnout, and create testable boundaries.
- Explicit evidence: He frames the module internals as gray box: inspectable when needed but mostly delegated if the tests are strong.

### Why It Matters

Agents perform better when they can operate inside bounded areas with clear interfaces and tests. Shallow, interconnected modules force the agent to understand too much of the system at once.

### Implementation Opportunities

- Run recurring architecture-deepening reviews.
- Identify shallow modules, duplicated implementations, weak boundaries, and untested module agreements.
- Create issues that consolidate behavior behind narrower interfaces.
- Add tests at public interfaces before asking agents to modify internals.
- Use TypeScript interfaces or service boundaries to make module contracts obvious.

### Risks / Tradeoffs

- Poorly chosen deep modules become oversized black boxes.
- Simplifying an interface too far can hide important constraints.
- Tests at the boundary must be strong enough to support delegation.

Confidence: High.

## Pattern: Architecture Repair As Human-Agent Strategy Session

### Description

Use agents to discover architecture-deepening opportunities, but keep the human responsible for strategic judgment. The agent searches, proposes candidates, grounds them in code, and asks design questions; the human decides what is worth changing.

### Evidence

- Explicit evidence: Matt's improve codebase architecture skill explores the codebase, identifies deepening opportunities, and enters a discussion about design shape.
- Explicit evidence: He says the skill is not AFK and demands judgment from the programmer.
- Explicit evidence: He frames agents as tactical programmers and the human as the strategic programmer.
- Inferred insight: architecture repair belongs in a collaborative planning lane before implementation.

### Why It Matters

Architecture changes encode long-term cost. Agents can find symptoms but may not understand product trajectory, team capacity, or tradeoffs. Human strategy prevents local cleanup from becoming broad churn.

### Implementation Opportunities

- Add an architecture-deepening workflow that returns ranked candidates, evidence, proposed module shape, and required human decisions.
- Convert accepted candidates into issue briefs for AFK agents.
- Keep rejected candidates with reasons to avoid repeated rediscovery.
- Run the workflow periodically on fast-moving codebases.

### Risks / Tradeoffs

- Agents may over-rank refactors that are easy to describe but low leverage.
- Repeated architecture scans can produce backlog noise.
- Human judgment remains a bottleneck unless decisions are recorded.

Confidence: High.

## Pattern: Validation As Autonomy Bottleneck

### Description

The scale of agent autonomy is limited by what the organization can automatically verify. Better tools matter, but weak validation prevents safe parallelism, code review automation, and autonomous deployment.

### Evidence

- Explicit evidence: Eno says software development is highly verifiable and that coding agents are advanced because software has decades of automated validation.
- Explicit evidence: He asks whether codebases have linters, tests, docs validation, OpenAPI specs, and tests that fail when AI slop is introduced.
- Explicit evidence: He says the limiter for fast autonomous customer-issue-to-deploy loops is not coding-agent capability but organizational validation criteria.
- Explicit evidence: He says flaky builds and 50-60% coverage may be tolerable for humans but break agent capabilities.

### Why It Matters

Agents need feedback loops. Without reliable validation, they cannot know whether changes worked, and humans must manually absorb risk. Validation investment multiplies every coding agent and review tool.

### Implementation Opportunities

- Audit validation pillars: format, lint, typecheck, tests, docs, architecture, security, API contracts, deployment readiness.
- Make validators strict enough to encode senior-engineer taste where feasible.
- Classify agent failures by missing validation signal.
- Prioritize fixing flaky or low-signal gates before scaling agent parallelism.
- Track validation coverage as agent-readiness infrastructure.

### Risks / Tradeoffs

- Overly strict validators can block useful work or encode bad taste.
- Sloppy tests can normalize wrong behavior.
- Teams may chase coverage numbers instead of high-signal feedback.

Confidence: High.

## Pattern: Spec-Driven Development Loop

### Description

Shift from understand-design-code-test to specify-generate-verify-iterate. Humans define objectives and constraints; agents generate candidates; validators and humans verify; the loop repeats.

### Evidence

- Explicit evidence: Eno describes a shift from understanding, designing, coding, and testing to specifying constraints, generating solutions, verifying, and iterating.
- Explicit evidence: He connects spec mode, plan mode, and IDE flows to this specification-driven development pattern.
- Inferred insight: specs become execution inputs, not just planning prose.

### Why It Matters

Agents can generate faster than humans can type. The scarce work becomes specifying the right target and verifying output. A spec-driven loop makes this explicit.

### Implementation Opportunities

- Require implementation issues to include objective, constraints, validation command, and done evidence.
- Keep specs small enough to execute and validate.
- Generate issues from PRDs only after acceptance criteria are explicit.
- Use validators to close the loop between spec and implementation.

### Risks / Tradeoffs

- Poor specs make wrong work faster.
- Spec mode can create false confidence if validation is weak.
- Humans may under-specify taste and architecture, then blame the agent.

Confidence: High.

## Pattern: Issue Triage As State Machine

### Description

Convert messy human backlog input into a deterministic state machine with exactly one category and one state. Use labels to decide whether an agent can pick up the work.

### Evidence

- Explicit evidence: Matt's triage skill uses category labels such as bug and enhancement.
- Explicit evidence: It uses state labels including needs triage, needs info, ready for agent, ready for human, and won't fix.
- Explicit evidence: Every triaged issue should carry exactly one category and one state.
- Explicit evidence: ready for agent requires an agent brief.

### Why It Matters

Agents need queues of actionable work. If backlog items are ambiguous, out of scope, missing repro steps, or waiting on humans, AFK agents waste cycles or produce bad work.

### Implementation Opportunities

- Implement exactly-one-category and exactly-one-state checks.
- Add a ready-for-agent brief template with context, constraints, validation, and expected artifacts.
- Use triage skills to convert unstructured issues into action-ready tasks.
- Keep out-of-scope decisions in a durable directory that triage can consult.

### Risks / Tradeoffs

- Labels can drift from reality if not validated.
- ready-for-agent can become a rubber stamp unless brief quality is checked.
- State machines need escape hatches for unusual work.

Confidence: High.

## Pattern: Out-Of-Scope Records As Negative Requirements

### Description

Record rejected features and architectural non-goals so future triage can reject matching requests quickly.

### Evidence

- Explicit evidence: Matt keeps a .out-of-scope directory for things already triaged and not planned.
- Explicit evidence: The agent consults those records when evaluating enhancement issues.
- Inferred insight: negative decisions are part of the agent control plane.

### Why It Matters

Without negative requirements, agents and humans repeatedly reconsider the same rejected ideas. Durable out-of-scope records reduce duplicate debate and make triage more consistent.

### Implementation Opportunities

- Add out-of-scope records with rationale, affected area, and review date.
- Let triage cite them when marking issues won't fix.
- Review stale out-of-scope entries periodically.
- Link them from issue closure comments.

### Risks / Tradeoffs

- Old non-goals can block legitimate strategy changes.
- Agents may over-apply a broad rejection to a narrower valid request.
- A separate negative-requirements layer needs discoverability.

Confidence: Medium.

## Pattern: Context Window Budget As Operational Discipline

### Description

Treat context as a scarce, observable budget. Clear or compact sessions deliberately, keep rules and MCP tools lean, and avoid loading unrelated material.

### Evidence

- Explicit evidence: Matt says the context window is the main constraint most coding agents face.
- Explicit evidence: He explains lost-in-the-middle behavior and says information at the start and end has higher impact than bloated middle context.
- Explicit evidence: He uses Claude Code's context command, clears when remaining context is low, and uses compact when preserving conversation intent matters.
- Explicit evidence: He warns that MCP servers can bloat context rapidly and says he avoids large Cursor or Claude rules.

### Why It Matters

More context is not always better. Bloated context reduces retrieval quality and wastes tokens. Agent harnesses need routing, compression, and narrow tool exposure.

### Implementation Opportunities

- Track context budget in long-running workflows.
- Prefer clear for unrelated work and compact for continuation with intent preservation.
- Keep instruction files short and routed.
- Audit MCP/tool descriptions for token cost and relevance.
- Load source artifacts progressively instead of dumping all research into hot context.

### Risks / Tradeoffs

- Clearing too aggressively can lose important decisions.
- Compact summaries can distort facts.
- Over-pruning tools can make agents blind to necessary capabilities.

Confidence: High.

## Tooling & Ecosystem

## Coding Agents And IDEs

- Claude Code: coding-agent environment used for skill sessions, context inspection, clearing, compacting, command approvals, and implementation.
  - Workflow role: interactive tactical execution.
  - Integration opportunity: context-budget checks, skill routing, architecture scans, issue triage.
  - Strength: exposes context usage and supports clear/compact workflows.
  - Limitation: can behave oddly in UI/session management and still needs validation.

- Factory Droid: referenced by Eno as Factory's coding agent with specification or plan mode.
  - Workflow role: organization-scale coding-agent execution.
  - Integration opportunity: spec-driven implementation workflows.
  - Strength: aligns with validation-heavy autonomous engineering.
  - Limitation: depends on organization validation quality.

- Cursor / spec-mode IDEs: referenced as part of the broader spec-driven development trend.
  - Workflow role: planning and execution inside developer tools.
  - Integration opportunity: repo docs, rules, and validators as shared inputs across tools.
  - Limitation: can be undermined by bloated rules or weak validation.

## Skills And Workflow Automation

- Grill Me: interview skill for resolving ambiguity through relentless questions.
  - Strength: surfaces missing decisions.
  - Limitation: ephemeral unless findings become durable context.

- Grill with Docs: interview plus context.md and ADR update workflow.
  - Strength: compounds shared language and decision context.
  - Limitation: can over-document or over-focus on wording.

- Ubiquitous Language skill: vocabulary extraction/update workflow.
  - Strength: creates shared human-agent-code language.
  - Limitation: needs bounded context discipline.

- Improve Codebase Architecture skill: scans for architecture-deepening opportunities.
  - Strength: finds shallow modules, weak locality, and missing single boundaries.
  - Limitation: requires human strategic judgment.

- Triage skill: issue/backlog state-machine workflow.
  - Strength: converts messy issue queues into agent-ready work.
  - Limitation: ready labels need quality gates.

- Diagnose / TDD-style skill: reproduces bugs, creates regression tests, then fixes.
  - Strength: forces feedback loop before implementation.
  - Limitation: can consume context if run inside a triage-heavy session.

## Documentation And Control Artifacts

- context.md: shared language and bounded context document.
- ADRs: non-obvious, hard-to-reverse, tradeoff-heavy decisions.
- .out-of-scope: negative requirements and rejected feature decisions.
- PRDs and implementation issues: execution inputs and decomposition artifacts.
- AGENTS.md: open standard for agent instructions, cited by Eno as a validation/readiness pillar.
- OpenAPI specs: machine-readable API contracts and validation material.

## Validation And Quality Tooling

- Linters / formatters: style and consistency validation.
- Unit tests / end-to-end tests / QA tests: behavior validation.
- Browserbase and computer-use agents: front-end/visual validation frontier.
- Type systems and TypeScript interfaces: public module contracts.
- Effect TS: mentioned by Matt as making service/module boundaries easier in TypeScript/JavaScript.
- GitHub Issues / Jira: backlog sources for triage and agent queues.

## Harness Engineering Insights

## Orchestration

- Agent work should flow through staged states: clarify language, record decisions, create issue, mark ready for agent, execute, validate, review, close.
- Parallel agent execution depends on validation quality. If single-task execution is unreliable, multi-agent modernization work is premature.
- Humans remain the strategy layer for architecture and scope decisions; agents are effective tactical executors once boundaries are clear.

## Validation

- The validation ladder is the autonomy ladder.
- Tests should catch AI slop, not just obvious regressions.
- Flaky builds are agent-readiness blockers because agents cannot distinguish noise from failure.
- Code review automation needs documentation and validation criteria, not only model capability.

## Context

- Context documents should compress domain meaning.
- Context windows should be kept lean through clearing, compacting, routing, and progressive disclosure.
- MCP servers and large rules files are hidden context costs.
- Raw research should stay cold unless distilled into specs, tests, validators, or decisions.

## Routing

- Skills should route by task stage: ambiguity resolution, vocabulary update, architecture repair, triage, diagnose, implementation.
- Backlog labels route work between human, reporter, agent, and rejection.
- Bounded contexts route vocabulary and docs to the right part of the system.

## Memory

- Durable memory appears as vocabulary, ADRs, out-of-scope records, issue labels, PRDs, and tests.
- Session memory should be compacted only when its intent must persist.
- Organizational memory should be encoded in validators and docs, not in a single senior engineer's head.

## Evals

- Useful evals measure whether agents can find the right files, preserve module boundaries, run validation, classify issue state, and follow repo vocabulary.
- Slop tests can be useful as an initial feedback loop, but must be improved over time.
- Agent readiness should be measured by the system's ability to verify outputs, not by demo fluency.

## Governance

- ready-for-agent is an approval state and should require a brief.
- won't fix should cite durable out-of-scope or strategy evidence.
- Architecture repair should require human signoff when long-term boundaries change.
- Validation gaps should be tracked as infrastructure debt.

## Scaling

- Shared language, deep modules, and strict validation are compounding investments.
- One opinionated engineer can improve the velocity of many agents by encoding taste into validators and docs.
- Multi-agent parallelism is gated by reliable single-agent task validation.

## Recovery

- For bugs, reproduce first, add regression feedback, then fix.
- For architecture entropy, find shallow modules and create explicit boundaries.
- For context bloat, clear unrelated sessions or compact only when preserving intent matters.
- For backlog mess, convert issues into deterministic states before execution.

## Implied Best Practices

- Put language work before implementation when domain terms are fuzzy.
- Keep context artifacts thin and high leverage.
- Use ADRs only for decisions that future agents would otherwise misread.
- Prefer code structures that reveal the mental map from the filesystem.
- Apply human taste at module boundaries, not every internal line.
- Create tests at module interfaces before delegating internals to agents.
- Treat every agent as a capable new starter, not as a codebase veteran.
- Build issue queues that agents can consume without guessing.
- Keep negative requirements close enough for triage to find.
- Audit validators before buying or switching agent tools.
- Make flaky builds and weak lint rules visible agent-readiness defects.
- Use context clear as the default between unrelated tasks.
- Use compact only when preserving conversation intent is worth the summarization risk.
- Expose fewer MCP tools by default; add tools when the task needs them.
- Convert successful ad hoc prompts into skills only when they leave durable improvements.

## Failure Modes & Mitigations

## Failure: Ephemeral Shared Understanding

Description:

The agent and human reach clarity during a session, but the clarified language or decision is not recorded anywhere.

Evidence:

- Matt says Grill Me produced useful shared language that was not documented.

Probable root cause:

- Interview workflow optimized for one session rather than future reuse.

Severity:

- High for recurring domain work.

Mitigation strategy:

- Route new domain terms into context.md and non-obvious tradeoffs into ADRs.

Recommended guardrails:

- End planning sessions with an artifact update check.
- Ask what the next agent would otherwise need to ask again.

## Failure: Agent-Hostile Code Topology

Description:

The codebase's file layout and module boundaries do not match the mental map humans use.

Evidence:

- Matt says agents see disparate modules rather than human-known groupings.

Probable root cause:

- Tacit architecture and unrestricted cross-imports.

Severity:

- High for AI-assisted work.

Mitigation strategy:

- Introduce deep modules, visible public interfaces, and tests at boundaries.

Recommended guardrails:

- Run periodic architecture-deepening reviews.
- Flag duplicated implementations and untested agreements.

## Failure: Validation Ceiling Blocks Autonomy

Description:

The organization expects agents to work autonomously but cannot automatically verify correctness.

Evidence:

- Eno says the limiter is validation criteria, not agent capability.

Probable root cause:

- Human manual testing and senior judgment hide gaps in automated feedback.

Severity:

- Critical for AFK or parallel agents.

Mitigation strategy:

- Invest in lint, tests, docs validation, architecture checks, API contracts, and deployment gates.

Recommended guardrails:

- Block ready-for-agent for tasks without a validation path.
- Track flaky or missing validators as agent-readiness debt.

## Failure: Backlog Items Pretend To Be Ready

Description:

Issues are labeled or treated as actionable even though they lack repro, scope, brief, or validation.

Evidence:

- Matt's triage skill separates needs info, ready for human, ready for agent, and won't fix.

Probable root cause:

- Backlogs mix ideas, bugs, strategy, and implementation tasks without state discipline.

Severity:

- High for queue-driven agents.

Mitigation strategy:

- Enforce exactly one category and one state, plus ready-for-agent brief requirements.

Recommended guardrails:

- Validate labels before agent pickup.
- Require reproduction evidence for bug tasks when possible.

## Failure: Context Bloat Degrades Agent Reasoning

Description:

Rules, MCP tools, long sessions, and broad context loading make important facts harder for the model to retrieve.

Evidence:

- Matt warns about lost-in-the-middle behavior and MCP context bloat.

Probable root cause:

- Treating context capacity as storage rather than attention budget.

Severity:

- Medium to high depending on workflow length.

Mitigation strategy:

- Use progressive disclosure, clear unrelated sessions, and compact only for continuation.

Recommended guardrails:

- Audit long rules files and tool descriptions.
- Track context usage before long implementation phases.

## Failure: Slop Tests Become Permanent Low-Signal Gates

Description:

Initial AI-generated tests provide some feedback but remain weak and encode accidental behavior.

Evidence:

- Eno quotes that a slop test is better than no test, then argues tests should be upgraded and followed by agents.

Probable root cause:

- Teams stop at first feedback loop instead of improving validator quality.

Severity:

- Medium.

Mitigation strategy:

- Allow low-signal tests as bootstraps, but mark them for hardening.

Recommended guardrails:

- Track test confidence and require upgrade for high-risk paths.

## Failure: Architecture Skill Used As AFK Refactor Machine

Description:

An architecture-improvement skill is allowed to make broad changes without human strategy.

Evidence:

- Matt explicitly says improve codebase architecture is not AFK and demands programmer judgment.

Probable root cause:

- Confusing tactical code execution with strategic architecture choice.

Severity:

- High.

Mitigation strategy:

- Split architecture discovery from implementation.

Recommended guardrails:

- Require human approval or a tracked decision before large boundary changes.

## Reusable Techniques

- Context glossary update loop:
  1. Read existing context.md.
  2. Identify fuzzy or conflicting terms.
  3. Ask concrete scenario questions.
  4. Cross-reference code usage.
  5. Update vocabulary or record no-update reason.

- ADR trigger:
  1. Is the decision hard to reverse?
  2. Would it surprise a future agent without context?
  3. Is it a real tradeoff with downstream consequences?
  4. If yes, write a short ADR.

- Architecture-deepening review:
  1. Explore module graph and public interfaces.
  2. Find shallow modules, duplicated implementations, and weak locality.
  3. Rank candidates by leverage and testability.
  4. Ask human strategy questions.
  5. Convert accepted candidates into agent-ready issues.

- Agent-ready issue gate:
  1. Exactly one category.
  2. Exactly one state.
  3. Clear problem statement.
  4. Repro or evidence where applicable.
  5. Validation command or proof path.
  6. Out-of-scope/ADR references checked.

- Validation-gap audit:
  1. List what humans currently judge manually.
  2. Ask whether a new starter could verify it.
  3. Convert repeated manual checks into lint, tests, docs gates, schema checks, or review rubrics.
  4. Track remaining gaps as agent-readiness debt.

- Context-budget procedure:
  1. Check current context usage before deep work.
  2. Clear when switching unrelated tasks.
  3. Compact only when preserving intent matters.
  4. Avoid broad MCP/rules loading unless needed.
  5. Keep research cold until distilled.

## Strategic Insights

- AI raises the value of old software fundamentals. Deep modules, clear interfaces, tests, docs, and decision records matter more because agents amplify both good structure and entropy.
- The future skill of senior engineers shifts toward environment design: vocabulary, constraints, validators, issue queues, architecture boundaries, and review gates.
- Agent tooling procurement is secondary to agent-readiness infrastructure. Better codebase validation improves every tool.
- Context engineering is not only prompt writing. It includes filesystem shape, module boundaries, docs, labels, tests, and what tools are exposed.
- The highest returns come from feedback loops where better agents improve the environment, and the improved environment makes agents better.

## Key Quotes & Evidence

- "Your codebase, way more than the prompts that you use, way more than your agents.md file, is the biggest influence on AI's output." Evidence for codebase-as-harness priority.
- "The AI won't go in knowing every single function, every single module." Evidence for new-starter framing.
- "It interviews you until you reach a shared understanding." Evidence for interview-based ambiguity resolution.
- "We were able to communicate about the code pretty effectively, but I would have to re-explain all of the non-obvious things." Evidence for durable context need.
- "The limiter is not the capability of the coding agent. The limit is your organization's validation criteria." Evidence for validation as autonomy bottleneck.
- "A slop test is better than no test." Evidence for bootstrap validation loops, with hardening caveat.
- "Every single triaged issue should carry exactly one category role and one state role." Evidence for backlog state-machine routing.
- "The context window is the main constraint that most AI coding agents face." Evidence for context budget discipline.

## Final Assessment

Strongest ideas:

- Agent readiness is environment design, not prompt polish.
- Shared language is a durable context compression layer.
- Deep modules make codebases navigable, testable, and delegable.
- Validation quality is the ceiling on autonomy.
- Issue triage should be a state machine with explicit ready-for-agent criteria.

Weakest areas:

- Some examples rely on manual human judgment and do not fully specify machine validators.
- "Slop test" bootstrapping can become dangerous if the tests are not upgraded.
- Context docs and ADRs can drift without maintenance workflows.
- Architecture-deepening skills can produce refactor backlog noise if not tied to business priorities.

Most reusable concepts:

- context.md plus ADR split,
- architecture-deepening candidate review,
- ready-for-agent issue brief,
- out-of-scope negative requirements,
- context-budget routing,
- validation-gap audit.

Highest leverage opportunities:

- Add or strengthen repo vocabulary and prompt translation surfaces.
- Add agent-ready issue state validation.
- Convert repeated review/triage judgments into validators.
- Track validation gaps as first-class harness debt.
- Keep skill outputs artifact-producing so future agents inherit the learning.

Most important risks:

- scaling agents before validation is reliable,
- hiding domain knowledge in human heads,
- letting context bloat masquerade as helpfulness,
- treating architecture repair as AFK implementation,
- relying on labels without validating task readiness.

Immediate implementation candidates:

- Build a ready-for-agent brief schema.
- Add a validation-gap audit command or checklist.
- Add architecture-deepening eval cases focused on shallow modules.
- Create a context glossary update workflow.
- Add a context budget check to long-running agent workflows.
