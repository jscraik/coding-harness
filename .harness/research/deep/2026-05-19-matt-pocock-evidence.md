# Matt Pocock Agent-Ready Codebase Evidence Extraction

Generated: 2026-05-19

Primary source:

- .harness/research/2026-05-19-matt-pocock-research.md

Supporting sources:

- .harness/research/2026-05-19-video-transcript-research.md
- .harness/research/2026-05-19-video-transcript-batch/raw/6BB6exR8Zd8/6BB6exR8Zd8.info.json
- .harness/research/2026-05-19-video-transcript-batch/raw/uC44zFz7JSM/uC44zFz7JSM.info.json
- .harness/research/2026-05-19-video-transcript-batch/raw/3MP8D-mdheA/3MP8D-mdheA.info.json
- .harness/research/2026-05-19-video-transcript-batch/raw/MzWIIlx0Gpc/MzWIIlx0Gpc.info.json
- .harness/research/2026-05-19-video-transcript-batch/raw/-uW5-TaVXu4/-uW5-TaVXu4.info.json

Evidence posture:

- This is cold research, not an instruction surface.
- Use it to shape future harness specs, skills, prompts, validators, eval fixtures, queue states, and repo architecture rules.
- Promote only distilled patterns into canonical docs, gates, or skills.

Evidence labels:

- Explicit evidence: directly stated in the transcript.
- Inferred insight: derived from examples, tooling choices, repeated behavior, or operational consequences.
- Speculative interpretation: plausible application to harness engineering that needs validation before adoption.

Confidence labels:

- High confidence: directly supported by repeated or central transcript claims.
- Medium confidence: supported by examples but translated into harness implementation terms.
- Low confidence: useful extrapolation beyond the transcript.

## Table of Contents
- [Executive Summary](#executive-summary)
- [Source Boundary](#source-boundary)
- [Core Engineering Patterns](#core-engineering-patterns)
- [Tooling & Ecosystem](#tooling--ecosystem)
- [Harness Engineering Insights](#harness-engineering-insights)
- [Implied Best Practices](#implied-best-practices)
- [Failure Modes & Mitigations](#failure-modes--mitigations)
- [Reusable Techniques](#reusable-techniques)
- [Strategic Insights](#strategic-insights)
- [Deeper Extraction Addendum](#deeper-extraction-addendum)
- [Recommended Books](#recommended-books)
- [Key Quotes & Evidence](#key-quotes--evidence)
- [Final Assessment](#final-assessment)

## Executive Summary

Matt Pocock's strongest reusable thesis is that AI coding quality is mostly constrained by the codebase and the harness around the agent, not by prompt cleverness alone. The repeated operational claim is that agents behave like endlessly spawned new starters: they arrive without lived memory of the codebase, need navigable structure, need fast feedback, need clear language, and need a queue of well-specified work. Codebase architecture, domain documentation, tests, labels, and context budgets therefore become agent infrastructure.

The most important pattern is thin documentation with high semantic leverage. Pocock starts with Grill Me, then improves it into Grill with Docs by adding a repo-local context file, shared domain language, and ADRs for hard-to-reverse decisions. The move is not toward more prose everywhere. It is toward a small set of durable language surfaces that remove repeated explanation, reduce token usage, and make generated code names, file names, planning docs, and user language converge.

The second major pattern is deep modules as AI control surfaces. Pocock argues that agent-ready codebases need file-system and architecture shapes that match the mental map of the system. Deep modules hide implementation behind simple interfaces, create seams for testing, and allow the human to apply taste at boundaries while delegating implementation details to the agent. This is a harness engineering point: module interfaces, tests, and folders are control-plane boundaries for agent work.

The third major pattern is backlog triage as a state machine. Pocock's triage skill turns messy human ideas into labeled, agent-ready work. A task is only available to AFK agents after it has one category label, one state label, enough brief detail, and sometimes reproduction or diagnosis evidence. The ready-for-agent label is an approval gate, not just a tag.

The fourth major pattern is context-window austerity. Pocock treats context as the scarce runtime resource. He recommends clear as the default reset, compact only when preserving intent is useful, caution with MCP servers and large rules files, and monitoring actual context usage. This directly supports harness designs that keep hot-path instructions small, route cold research by retrieval, and expose tools only when needed.

The main weakness is validation unevenness. Pocock is strong on tests, seams, feedback loops, reproduction, and issue state. But the examples are mostly hand-operated skills in Claude Code, with manual judgment and occasional direct push-to-main behavior. The patterns are highly reusable, but production harnesses should wrap them with stronger artifact requirements, PR checks, role separation, audit trails, and deterministic validators.

## Source Boundary

Primary transcript set:

- I stopped using /grill-me for coding. Here is what I use instead.
- Your codebase is NOT ready for AI.
- How To De-Slop A Codebase Ruined By AI.
- Burn through the backlog from hell with /triage.
- Most devs do not understand how context windows work.

Use Pocock for:

- skill-mediated clarification workflows
- ubiquitous-language and DDD-style domain documentation
- codebase architecture for agents
- deep module and seam-based refactoring
- backlog triage and ready-for-agent queues
- context-window budgeting and MCP caution
- human strategic judgment over tactical agent work

Do not use Pocock for:

- current product claims about Claude Code, MCP, Vercel AI SDK, or model context sizes without fresh verification
- enterprise governance completeness
- unattended production deployment safety without additional controls

## Core Engineering Patterns

## Pattern: Clarification Skill Before Implementation

### Description

Use a skill to interview the human before implementation, walking the design tree, surfacing ambiguities, resolving dependencies between decisions, and forcing shared understanding before code is written.

### Evidence

- Explicit evidence, high confidence: Pocock says Grill Me gets the LLM to interview the user relentlessly until shared understanding is reached.
- Explicit evidence, high confidence: He describes it walking down each branch of the design tree and resolving dependencies between decisions.
- Inferred insight, medium confidence: The skill is a pre-implementation requirement-gathering harness, not a coding tool.

### Why It Matters

Agents can code quickly from weak premises. Clarification skills slow the initial phase so later implementation becomes cheaper and less ambiguous. The pattern converts tacit human intent into explicit decision material before the agent starts editing.

### Implementation Opportunities

- Add a clarify-before-code skill or phase for ambiguous feature requests.
- Require the output to include unresolved questions, resolved decisions, non-goals, and a first-pass acceptance shape.
- Use the result as the source artifact for PRDs, issues, and agent briefs.
- Add a gate that blocks ready-for-agent state when ambiguity remains on critical decisions.

### Risks / Tradeoffs

- The skill can become verbose and slow if it asks questions after enough certainty exists.
- It can overfit to the wording of the first prompt if it does not cross-check code or docs.
- It can feel like bike-shedding unless paired with clear stop conditions.

## Pattern: Grill With Docs

### Description

Combine live clarification with repo-local documentation. The agent reads a context.md file, challenges language against existing glossary terms, sharpens fuzzy language, cross-references code, and updates the document as the session discovers new language.

### Evidence

- Explicit evidence, high confidence: Pocock says Grill with Docs has the same top text as Grill Me plus the ability to look for a context.md file.
- Explicit evidence, high confidence: He says it challenges language usage against the glossary, sharpens fuzzy language, discusses concrete scenarios, cross-references code, and updates as it goes.
- Explicit evidence, high confidence: He states that variable names and file names will be based on context.md, so getting language right affects generated code.

### Why It Matters

This turns prompt clarification into durable repo memory. Instead of resolving language once in chat and losing it, the system writes the shared vocabulary back into a file future agents can read.

### Implementation Opportunities

- Add a repo-local context.md or domain glossary per bounded context.
- Require feature-planning skills to read the nearest context file before asking questions.
- When a new term is created, write it back with definition, examples, aliases, and code references.
- Link generated implementation issues to the glossary terms they rely on.

### Risks / Tradeoffs

- A single context file can become overloaded in large repos.
- Language refinement can become over-ceremonial if every term is treated as strategic.
- Stale glossary entries can mislead future agents unless refreshed by tests or code search.

## Pattern: Thin Documentation With High Semantic Leverage

### Description

Prefer the thinnest repo-local documentation layer that gives the agent a useful leg up: shared language, context pointers, and ADRs for non-obvious hard-to-reverse decisions.

### Evidence

- Explicit evidence, high confidence: Pocock asks what the thinnest layer of documentation is that can give the AI more context.
- Explicit evidence, high confidence: He uses context files for shared language and ADRs for decisions that are surprising, hard to reverse, or trade-off-heavy.
- Inferred insight, high confidence: He is optimizing documentation for repeated agent use, not broad human onboarding alone.

### Why It Matters

Context is expensive and retrieval is imperfect. Thin high-leverage docs can reduce repeated explanation without bloating every session.

### Implementation Opportunities

- Separate hot-path docs into glossary/context, ADRs, module interfaces, and task briefs.
- Keep raw research and transcripts cold unless distilled.
- Add context pointers in local instruction files rather than pasting full docs into every prompt.
- Validate that context docs contain canonical terms used in code and tickets.

### Risks / Tradeoffs

- Too little documentation leaves agents guessing.
- Too much documentation burns context and worsens lost-in-the-middle behavior.
- Human teams may confuse thin with optional unless docs are wired into skills.

## Pattern: Ubiquitous Language As Agent Compression

### Description

Create shared vocabulary between domain experts, developers, code, and agents. Use the same terms in prompts, docs, code names, file names, UI labels, and implementation plans.

### Evidence

- Explicit evidence, high confidence: Pocock cites Domain-Driven Design and Eric Evans' ubiquitous language.
- Explicit evidence, high confidence: He says shared language lets the AI use fewer words to communicate and think.
- Explicit evidence, high confidence: He says aligned planning documents and code make code easier to navigate.

### Why It Matters

Shared language is both a correctness mechanism and a token optimization. When terms are canonical, agents need fewer explanatory tokens and search becomes more reliable.

### Implementation Opportunities

- Add glossary-term checks for agent-generated PRDs and issue briefs.
- Require new domain terms to include definition, aliases, examples, anti-examples, and source files.
- Add search-friendly term names to module folders, route names, test names, and docs.
- Use glossary diffs as review targets when major domain concepts change.

### Risks / Tradeoffs

- Over-normalizing language can suppress useful nuance.
- Premature naming can lock teams into poor abstractions.
- Glossaries need ownership or they become stale vocabulary dumps.

## Pattern: ADRs For Surprising Hard-To-Reverse Decisions

### Description

Use simple Markdown ADRs for decisions that would surprise a future reader without context, are hard to reverse, or carry downstream tradeoffs.

### Evidence

- Explicit evidence, high confidence: Pocock says ADRs document non-obvious decisions that cannot fit in context.md.
- Explicit evidence, high confidence: He says ADRs should be created when a decision is hard to reverse, surprising without context, or the result of a real tradeoff.
- Inferred insight, medium confidence: ADRs are part of the agent's memory surface and reduce repeated re-litigation.

### Why It Matters

Agents can undo architectural intent if they do not know why a surprising decision exists. ADRs provide a stable reference for future planning, review, and triage.

### Implementation Opportunities

- Add an ADR trigger to feature planning: will this surprise future agents?
- Include decision, alternatives, consequences, affected modules, and validation expectations.
- Link ADRs from issue briefs and module context docs.
- Add review checks that require ADR references for hard-to-reverse generated changes.

### Risks / Tradeoffs

- Overuse creates decision-document noise.
- Underuse leaves agent-visible architecture unexplained.
- ADRs without enforcement can become stale narrative.

## Pattern: Agent-Ready Codebase As New-Starter-Friendly Codebase

### Description

Design the codebase as if many new starters will enter it every day. File system structure, module boundaries, tests, and docs should make the system discoverable without relying on human memory.

### Evidence

- Explicit evidence, high confidence: Pocock says agents enter with no memory and are like a new starter in the codebase.
- Explicit evidence, high confidence: He says teams will spawn many new starters every day, so the map must be easily navigable.
- Explicit evidence, high confidence: He says the file system and design should match the internal mental map humans hold.

### Why It Matters

Agents cannot use tacit team memory. If the repo does not encode structure, every session pays discovery cost and increases the risk of wrong edits.

### Implementation Opportunities

- Align folder structure with product/domain modules rather than incidental technical fragments.
- Add module README/context files only where they reduce discovery.
- Add architecture maps that show service/module boundaries and allowed dependencies.
- Make new-starter discoverability a code-review rubric.

### Risks / Tradeoffs

- Restructuring can be expensive and disruptive.
- Folder names can lie if boundaries are not enforced.
- New-starter-friendliness may conflict with highly optimized low-level code layouts.

## Pattern: Deep Modules As Agent Control Boundaries

### Description

Group behavior behind simple public interfaces. Let agents work inside deep modules while humans apply taste at module boundaries and tests lock down behavior.

### Evidence

- Explicit evidence, high confidence: Pocock defines deep modules as lots of implementation behind a simple interface.
- Explicit evidence, high confidence: He says the interface is a seam where human taste can be applied and tests can lock behavior down.
- Explicit evidence, high confidence: He describes these as gray-box modules where the human does not need to inspect internals as long as tests are good.

### Why It Matters

Deep modules reduce the context agents need to reason about and create safe local work areas. They also turn architecture into a harness: interfaces, tests, and seams constrain what the agent can change.

### Implementation Opportunities

- Identify shallow-module clusters and consolidate them behind named interfaces.
- Add public API files or type exports at module boundaries.
- Build tests at seams rather than only tiny implementation-unit tests.
- Use blast-radius checks to prefer edits inside one deep module.

### Risks / Tradeoffs

- Deep modules can hide poor implementation if tests are weak.
- Interfaces can become too generic and lose type leverage.
- Refactoring shallow modules requires careful migration to avoid behavior drift.

## Pattern: Progressive Disclosure Of Complexity

### Description

Expose the interface first, then implementation only when needed. Agents should be able to understand a module's purpose and usage before reading its internals.

### Evidence

- Explicit evidence, high confidence: Pocock says the interface sits at the top and explains what the module does; only then do you look inside.
- Explicit evidence, high confidence: He says agents can read exported types before implementation and decide whether deeper inspection is necessary.
- Inferred insight, high confidence: This is context budgeting applied to repository structure.

### Why It Matters

Agents over-read when the repo gives no summary boundary. Progressive disclosure reduces token waste and lowers the chance of lost-in-the-middle errors.

### Implementation Opportunities

- Put public types, commands, or exported functions in predictable files.
- Add compact module docs at boundary files.
- Encourage repo-research tools to inspect boundary files before implementation files.
- Add lint or architecture checks for bypassing module public APIs.

### Risks / Tradeoffs

- Boundary docs can drift from implementation.
- Some performance-sensitive modules require internals awareness.
- Overly rigid public APIs can slow legitimate cross-cutting changes.

## Pattern: Architecture Repair Through Deepening Opportunities

### Description

Run a skill periodically to inspect the codebase for shallow modules, poor locality, low leverage, parallel implementations, and untested seams. Then use human strategic judgment to pick a candidate and shape the refactor.

### Evidence

- Explicit evidence, high confidence: Pocock runs an improve codebase architecture skill that explores architecture for deepening opportunities.
- Explicit evidence, high confidence: The skill identifies candidates such as parallel implementations where the seam is untested.
- Explicit evidence, high confidence: Pocock says the skill demands user judgment and is not an AFK skill.

### Why It Matters

AI accelerates entropy if every change is local and tactical. Architecture repair needs a recurring loop that identifies structural debt and converts it into specific refactor opportunities.

### Implementation Opportunities

- Add a periodic architecture-deepening report.
- Score candidates by locality gain, interface simplification, test seam clarity, and blast-radius reduction.
- Convert accepted candidates into PRDs or issues.
- Require strategic human approval before architecture-modifying work begins.

### Risks / Tradeoffs

- Automated architecture advice can overgeneralize without domain context.
- Human judgment remains a bottleneck.
- Frequent refactoring can disrupt feature delivery if not tied to concrete leverage.

## Pattern: Strategic Human, Tactical Agent

### Description

Treat the agent as a strong tactical programmer and the human as the strategic programmer who decides long-term health, boundaries, and tradeoffs.

### Evidence

- Explicit evidence, high confidence: Pocock says agents are good tactical programmers, but need someone above them as the strategic programmer.
- Explicit evidence, high confidence: He says the user must decide what is good for long-term codebase health.
- Inferred insight, high confidence: High-leverage skills should produce decision candidates, not silently perform architecture governance.

### Why It Matters

This prevents over-delegation of irreversible design choices. Agents can gather facts and propose shapes, but strategic ownership stays with humans or formal governance.

### Implementation Opportunities

- Separate discover candidates from execute refactor.
- Require explicit decision records before architecture-changing patches.
- Use reviewer agents to challenge refactor candidates, but keep final approval human-owned.
- Label high-blast-radius work as strategy-required.

### Risks / Tradeoffs

- Human strategy can become a queue bottleneck.
- Agents may under-act if every decision is escalated.
- The model needs clear thresholds for tactical versus strategic changes.

## Pattern: Backlog Triage As A State Machine

### Description

Represent issue readiness as a state machine with exactly one category and one state label. Move issues through needs-triage, needs-info, ready-for-agent, ready-for-human, and won't-fix states.

### Evidence

- Explicit evidence, high confidence: Pocock says triage has category roles and state roles encoded as labels.
- Explicit evidence, high confidence: He says every triaged issue should carry exactly one category role and one state role.
- Explicit evidence, high confidence: He names ready-for-agent as the state an AFK agent is allowed to pick up.

### Why It Matters

Agents need queues they can trust. A state machine prevents agents from stumbling into unclear, blocked, or out-of-scope tasks.

### Implementation Opportunities

- Define issue labels as a state machine, not a loose taxonomy.
- Add a validator that flags multiple states or missing category.
- Require ready-for-agent tasks to include an agent brief, acceptance criteria, validation command, and risk class.
- Make AFK agents filter only ready-for-agent items.

### Risks / Tradeoffs

- Label hygiene becomes operationally important.
- State machines can become too rigid for exploratory work.
- Humans may misuse labels unless transitions are documented or enforced.

## Pattern: Triage As Human-Agent Translation Layer

### Description

Use triage to convert messy human ideas, bug reports, and enhancement requests into actionable tasks, rejections, or requests for more information.

### Evidence

- Explicit evidence, high confidence: Pocock says triage turns messy human ideas into real tasks agents can pick up.
- Explicit evidence, high confidence: He describes triage as pruning a queue and acting as a translation layer between ticket reporters and implementing agents.
- Explicit evidence, high confidence: He uses out-of-scope references to reject enhancements that conflict with prior decisions.

### Why It Matters

Human issue reports are rarely agent-ready. Triage transforms social input into executable work packages and protects agents from unclear work.

### Implementation Opportunities

- Add a triage output contract: classification, state, summary, reproduction status, blocker, next owner, and agent brief.
- Add out-of-scope decision files for rejected feature classes.
- Link triage recommendations to ADRs or out-of-scope records.
- Require reproduction for bug reports before ready-for-agent.

### Risks / Tradeoffs

- Triage can be too credulous if it trusts reporter notes without reproduction.
- Poor out-of-scope docs can prematurely reject useful ideas.
- Queue automation can hide human product judgment if labels become automatic.

## Pattern: Regression Test First For Bugs

### Description

Before fixing a reported bug, reproduce or diagnose it and create a regression test or feedback loop. Then make the fix inside that loop.

### Evidence

- Explicit evidence, high confidence: Pocock asks the agent to diagnose the issue itself instead of trusting existing notes.
- Explicit evidence, high confidence: He says the diagnose skill uses a setup similar to his TDD skill, creating the regression test first.
- Explicit evidence, high confidence: The example includes unit test scaffolding asserting a prompt contains no unresolved task ID.

### Why It Matters

Bug fixes without reproduction can train agents to patch symptoms. Regression-first workflow turns bug reports into durable validation.

### Implementation Opportunities

- Add a bug-diagnosis gate before ready-for-agent bug work.
- Require reproduction evidence or an explicit blocked-reproduction reason.
- Add regression-test-first examples to bug-fix skills.
- Store the failure command and expected fixed command in the issue brief.

### Risks / Tradeoffs

- Some bugs are hard to reproduce locally.
- Test-first can be overkill for trivial obvious defects.
- Agents may write self-affirming tests unless expected behavior is externally grounded.

## Pattern: Context Window Budgeting

### Description

Treat the context window as a hard operational budget. Monitor usage, clear by default, compact only when preserving conversation intent matters, and avoid unnecessary MCP/tools/rules bloat.

### Evidence

- Explicit evidence, high confidence: Pocock calls the context window the main constraint most AI coding agents face.
- Explicit evidence, high confidence: He says models perform worse with more bloated context and suffer lost-in-the-middle issues.
- Explicit evidence, high confidence: He recommends clear as the default and compact when preserving conversation vibes is useful.
- Explicit evidence, high confidence: He warns MCP servers and large Cursor/Claude rules can bloat context rapidly.

### Why It Matters

Context is not free memory. More text can reduce retrieval accuracy, hide important facts, and slow work. Harnesses must route context deliberately.

### Implementation Opportunities

- Add context budget telemetry to long agent runs.
- Keep hot-path instructions compact and move bulk references behind retrieval.
- Gate MCP/tool loading by task rather than enabling all tools globally.
- Add a clear-versus-compact decision rule to agent workflows.

### Risks / Tradeoffs

- Clearing can lose useful intent if artifacts were not written down.
- Compact summaries can hallucinate or omit important details.
- Too much austerity can starve agents of necessary context.

## Tooling & Ecosystem

### Agent Interfaces And Coding Tools

| Tool | Purpose | Workflow Role | Integration Opportunities | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Claude Code | interactive coding agent CLI | primary demonstration environment for skills, context command, clear/compact, issue work | add context budget checks, skill contracts, artifact outputs, PR gates | strong local code interaction and skill workflows | manual approvals and context hygiene remain user-managed |
| Claude | model family referenced in agent sessions | agent reasoning/execution | use with bounded context and task-specific skills | useful coding agent backend | context limits and lost-in-the-middle behavior |
| ChatGPT | general conversational LLM referenced in context-window explanation | general chat and coding assistance | compare context behavior and artifact persistence | accessible broad interface | long chats accumulate context and hidden state |
| Cursor | editor/agent environment implied by Cursor rules | coding-agent workspace | keep rules lean and route context by task | integrated editor workflow | large rules can bloat context |
| AFK agents | unattended implementation agents | pick up ready-for-agent tasks | queue-based execution with labels and briefs | scales implementation throughput | unsafe if tasks are underspecified |

### Skills And Workflow Modules

| Tool / Skill | Purpose | Workflow Role | Integration Opportunities | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Grill Me | human interview and ambiguity surfacing | early clarification when no codebase or broad problem exists | turn into clarify-before-code phase | excellent ambiguity discovery | lacks durable repo context by itself |
| Ubiquitous Language skill | extract and maintain shared domain language | glossary building during planning | update context docs and code terms | compresses future communication | can become naming bike-shedding |
| Grill With Docs | clarification plus repo docs | feature planning with codebase context | require context.md read/update | turns chat discoveries into durable docs | needs stale-doc controls |
| Improve Codebase Architecture skill | find deepening/refactor opportunities | architecture maintenance | create architecture review/eval loop | surfaces structural debt | not AFK-safe; needs human strategy |
| Triage skill | classify issues and convert to ready work | queue management and agent gating | issue label state machine | makes backlog agent-readable | may trust issue notes too much |
| Diagnose skill | reproduce and understand bugs | bug validation before fix | regression-test-first bug flow | reduces credulous fixes | can consume context if run in same session |
| TDD skill | create feedback loop before implementation | validation-first coding | bug and feature implementation harness | strong for agent correctness | test quality still depends on spec quality |
| PRD to issues | convert plans into tasks | planning-to-backlog bridge | generate ready-for-agent briefs | keeps work decomposed | weak PRDs create weak issues |

### Repo And Product Tooling

| Tool | Purpose | Workflow Role | Integration Opportunities | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| GitHub Issues | backlog and task tracking | issue triage and ready-for-agent queue | labels as state machine, PR linkage | widely available and scriptable | label consistency must be enforced |
| Jira | alternative backlog system | same triage target as GitHub Issues | map state machine to workflow statuses | enterprise adoption | heavier workflow setup |
| GitHub PRs | review and issue closure | preferred merge path in normal workflow | require issue references and validation artifacts | traceable change delivery | can be bypassed by direct push |
| Sandcastle | Pocock's AFK agent software factory | consumes ready-for-agent tasks | model as example queue executor | shows label-driven execution | details not fully specified in transcripts |
| .out-of-scope directory | local rejected-feature decision store | triage reference for enhancements | use as lightweight negative ADR index | lets agents reject repeated non-goals | can ossify product decisions |

### Architecture And Language Stack

| Tool / Framework | Purpose | Workflow Role | Integration Opportunities | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| TypeScript | primary language context | interfaces, module boundaries, AI SDK course | use public types as module seams | strong type-level boundaries | JS/TS imports can bypass boundaries unless enforced |
| JavaScript | related ecosystem | mentioned for module boundary difficulty | add lint/module-boundary rules | flexible | weak native boundary enforcement |
| React Router | app framework in example codebase | real codebase for architecture skill | route modules as deep-module candidates | familiar full-stack app model | route/action boundaries can sprawl |
| Effect / Effect.ts | functional TypeScript toolkit | helps modularization/seams | use services/layers to encode boundaries | strong dependency and service modeling | learning curve and abstraction cost |
| TanStack Query | example of a deep open-source module | model of simple interface over complex behavior | use as teaching example for depth/leverage | high leverage API | not a general architecture solution |

### Context And Model Reference Tools

| Tool | Purpose | Workflow Role | Integration Opportunities | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| MCP servers | external tool provision | plug-and-play toolsets | lazy-load by task and budget context cost | expands agent capabilities | can bloat system/tool context rapidly |
| models.dev | model context and metadata reference | compare context limits | add model capability lookup in planning | concrete model metadata | context size is not retrieval quality |
| Vercel AI SDK | TypeScript LLM app SDK | education/course reference | potential SDK for custom harness apps | TypeScript-native LLM development | not directly used in transcript workflows |
| Gemini 2.5 Pro | large-context model example | context-window comparison | evaluate retrieval, not size alone | large context | bigger context can still perform worse |
| Llama 4 Scout | very-large-context caution example | lost-in-the-middle warning | use as warning against size-only model selection | large nominal window | poor retrieval can negate capacity |
| Qwen Math Plus | small-context model example | context-limit contrast | task-specific model comparison | efficient special-purpose model | small window limits long workflows |
| Whisper Flow | dictation | capturing feature ideas | voice-to-PRD / voice-to-brief workflows | fast ideation capture | transcript quality and structure need cleanup |

## Harness Engineering Insights

### Orchestration

- High confidence: Skill workflows are modular orchestration units. Pocock chains Grill with Docs, Ubiquitous Language, Improve Codebase Architecture, Triage, Diagnose, TDD, and PRD-to-issues.
- High confidence: The work queue is the main AFK-agent orchestration primitive. Labels decide what agents may pick up.
- Medium confidence: Agent swarms should be fed from stateful queues rather than ad hoc prompts.

Implementation pattern:

- Define intake -> clarify -> document language -> decide -> brief -> ready-for-agent -> implement -> validate -> review -> close as a harness lane.
- Make each transition produce an artifact.

### Validation

- High confidence: Tests and feedback loops are central. Pocock repeatedly connects agent quality to test quality.
- High confidence: Regression tests should be created before bug fixes when possible.
- Medium confidence: Module seams should become validation boundaries.

Implementation pattern:

- Require each ready-for-agent issue to name the validation seam: unit, integration, typecheck, CLI command, reproduction, or manual blocked reason.

### Context

- High confidence: Context-window size is a budget, not a free advantage.
- High confidence: Hot-path context should stay lean. Large MCP/rules surfaces are risky.
- Medium confidence: Repo docs should be small and heavily routed.

Implementation pattern:

- Add a context budget checklist: current session size, need to clear/compact, loaded tools, loaded docs, task-local artifacts.

### Routing

- High confidence: Use Grill Me when no codebase exists; use Grill With Docs when a codebase exists.
- High confidence: Use triage before AFK implementation.
- Medium confidence: Use architecture-deepening before legacy-code feature work.

Implementation pattern:

- Build a skill router based on artifact state:
  - no codebase: clarify
  - codebase and fuzzy language: grill-with-docs
  - messy issue: triage
  - bug: diagnose/TDD
  - legacy structural risk: improve architecture

### Memory

- High confidence: Context files and ADRs are memory surfaces.
- High confidence: Out-of-scope docs are negative memory for feature rejection.
- Medium confidence: The agent should write durable memory only when it reduces repeated future explanation.

Implementation pattern:

- Maintain separate memory classes: glossary, ADR, out-of-scope, issue brief, regression test, module interface.

### Evals

- Medium confidence: Pocock implies eval quality through tests, issue state, and architecture skill outputs rather than formal model evals.
- High confidence: Better tests produce better agent output is a repeated claim.

Implementation pattern:

- Evaluate agent-readiness by:
  - file discovery time
  - test feedback time
  - seam clarity
  - issue readiness
  - context load size
  - unresolved ambiguity count

### Governance

- High confidence: Ready-for-agent labels are approval gates.
- Medium confidence: ADR and out-of-scope records act as lightweight governance.
- Low confidence: Pocock's demo workflows need stronger PR and branch governance for production teams.

Implementation pattern:

- Require state-machine labels, artifact-backed briefs, and PR-based delivery for unattended agents.

### Scaling

- High confidence: For monorepos, Pocock suggests a context map with multiple bounded contexts.
- High confidence: Queue management is central to managing AFK agents.
- Medium confidence: Skills need changelogs and update channels as they become shared team infrastructure.

Implementation pattern:

- Add per-context docs and context maps for large repos.
- Add queue metrics: ready-for-agent count, blocked count, needs-info age, stale-ready tasks.

### Recovery

- High confidence: Legacy rescue starts with harnessing the codebase: tests, deep modules, seams, architecture improvement.
- High confidence: Bug recovery starts by reproducing and creating the feedback loop.
- Medium confidence: Architecture entropy should trigger recurring deepening review.

Implementation pattern:

- Add a rescue lane for AI-damaged repos: inventory modules, identify shallow modules, choose one deepening candidate, add tests, then refactor.

## Implied Best Practices

- Keep prompt skills separate from durable repo memory. Chat can discover language; repo docs should preserve it.
- Prefer small Markdown control surfaces over huge generic instruction files.
- Put domain terms where agents will search naturally.
- Treat file and variable names as downstream products of the domain language.
- Use ADRs only for decisions with surprise, reversibility, or tradeoff weight.
- Make issue readiness machine-readable with labels.
- Reject unclear work before it reaches AFK agents.
- Require bug reproduction before agent implementation.
- Use direct codebase exploration before architecture recommendations.
- Keep humans in charge of strategic refactors.
- Run architecture-maintenance skills periodically in fast-moving repos.
- Use tests to define gray-box module contracts.
- Prefer deep modules over scattered shallow modules for agent work.
- Watch context usage during long sessions.
- Clear context by default when work is unrelated.
- Compact only when conversation intent must survive.
- Be cautious with MCP servers, large rules files, and always-on tools.
- Select models by context retrieval quality, not advertised context length.
- Use out-of-scope records to prevent re-triaging rejected features.
- Convert PRDs into issues only after domain terms and affected modules are clear.
- Preserve skill changelogs and usage guidance as skills evolve.

## Failure Modes & Mitigations

### Failure: Prompt-Only Clarification Loses Durable Language

Description:

Grill Me can produce shared understanding in chat, but useful terms and decisions disappear after the session.

Evidence:

- Explicit evidence: Pocock says good shared language was not documented anywhere.
- Explicit evidence: He built Grill With Docs to update context.md.

Probable root cause:

- Clarification occurs in transient conversation state rather than repo memory.

Severity:

- High for multi-session agent work.

Mitigation strategy:

- Require clarification outputs to write or update a glossary/context artifact when new domain terms are created.

Recommended guardrails:

- Block ready-for-agent transition if new terms are used in a brief but absent from the context glossary.

### Failure: Context Docs Become Bike-Shedding

Description:

Language refinement can run too long and delay useful implementation.

Evidence:

- Explicit evidence: Pocock says the process might feel like bike-shedding and then stops at good enough.

Probable root cause:

- No stop condition for semantic refinement.

Severity:

- Medium.

Mitigation strategy:

- Define stop rules: enough language to name files, variables, UI concepts, and acceptance criteria; defer remaining refinements.

Recommended guardrails:

- Require a good-enough-for-this-change line in planning output.

### Failure: AI Accelerates Software Entropy

Description:

Fast AI changes that ignore whole-codebase structure introduce small inconsistencies that compound into a hard-to-change system.

Evidence:

- Explicit evidence: Pocock says AI has accelerated software entropy and codebases fall apart faster.

Probable root cause:

- Tactical edits lack architecture memory, boundary checks, and refactor discipline.

Severity:

- Critical for fast-moving agent-heavy repos.

Mitigation strategy:

- Add recurring architecture-deepening review, module-boundary validation, and test-seam coverage.

Recommended guardrails:

- Run architecture checks when a change touches multiple modules or creates parallel implementations.

### Failure: Shallow Module Sprawl

Description:

Many tiny interdependent modules make it hard for agents and humans to navigate, test, and reason.

Evidence:

- Explicit evidence: Pocock contrasts shallow modules with deep modules and says shallow webs are hard to navigate, hard to test, and hard to keep in mind.

Probable root cause:

- Interfaces expose too much detail and implementation concerns are scattered.

Severity:

- High.

Mitigation strategy:

- Consolidate behavior behind deeper interfaces and test at seams.

Recommended guardrails:

- Add blast-radius and dependency checks that flag cross-module scattering.

### Failure: Untested Parallel Implementations

Description:

Two implementations of a rule can drift when the seam where they must agree is untested.

Evidence:

- Explicit evidence: The architecture skill identifies two implementations of an insertion point living in parallel with an untested seam.

Probable root cause:

- Duplicated domain rule without a shared module or contract test.

Severity:

- High.

Mitigation strategy:

- Extract the rule into a single deep module or add contract tests across both implementations.

Recommended guardrails:

- Search for duplicate rule implementations during architecture review.

### Failure: Triage Credulity

Description:

The agent may trust reporter notes and mark a bug ready for agent without reproducing it.

Evidence:

- Explicit evidence: Pocock says the agent is being a little bit too credulous and asks it to diagnose the issue itself.

Probable root cause:

- Triage optimized for queue movement rather than evidence.

Severity:

- High for bug reports.

Mitigation strategy:

- Require reproduction or explicit no-repro blocker before ready-for-agent.

Recommended guardrails:

- Bug category plus ready-for-agent state requires reproduction evidence, stack trace, or command output.

### Failure: Queue State Drift

Description:

Issues can carry inconsistent labels or stale readiness states.

Evidence:

- Explicit evidence: Pocock says a triaged issue should have exactly one category and one state.

Probable root cause:

- Labels are human-maintained without state-machine enforcement.

Severity:

- Medium to high depending on automation level.

Mitigation strategy:

- Validate issue labels before AFK agents consume the queue.

Recommended guardrails:

- CI or scheduled issue audit flags missing, duplicate, or invalid state/category labels.

### Failure: Direct Main Push Bypasses Review

Description:

In the demo, Pocock pushes a fix to main after manual vetting rather than using a PR path.

Evidence:

- Explicit evidence: He says he could create a PR that references the issue, which is how he usually likes to work, but pushes to main for the demo.

Probable root cause:

- Demo shortcut and prior human certainty.

Severity:

- Medium in demos, high in production.

Mitigation strategy:

- Keep PR path mandatory for unattended or agent-generated work.

Recommended guardrails:

- Block direct pushes for agent branches; require PR evidence and issue linkage.

### Failure: Context Bloat From MCP And Rules

Description:

Always-on MCP servers and large rules files consume system/tool context and reduce model effectiveness.

Evidence:

- Explicit evidence: Pocock warns MCP servers can bloat context rapidly.
- Explicit evidence: He avoids very large Cursor or Claude rules.

Probable root cause:

- Tool convenience hides context cost.

Severity:

- High for long-running coding sessions.

Mitigation strategy:

- Lazy-load tools and route skill context by task.

Recommended guardrails:

- Context budget report includes system prompt, tools, rules, messages, and remaining tokens.

### Failure: Context Compaction As False Memory

Description:

Compaction preserves a summary of intentions, but it can omit details or encode a lossy version of the conversation.

Evidence:

- Explicit evidence: Pocock says compact creates a smaller message preserving intentions and vibes.
- Inferred insight: Any summary can drop exact evidence or distort decisions.

Probable root cause:

- LLM-generated summaries are treated as complete state.

Severity:

- Medium.

Mitigation strategy:

- Write exact decisions, commands, and artifacts to files before compacting.

Recommended guardrails:

- After compact/resume, re-open source artifacts before implementation.

### Failure: Context Size Mistaken For Capability

Description:

Large context windows can still perform poorly if retrieval inside context is weak.

Evidence:

- Explicit evidence: Pocock says bigger is not always better and cites models with large windows suffering lost-in-the-middle problems.

Probable root cause:

- Teams evaluate nominal token capacity rather than retrieval quality.

Severity:

- Medium.

Mitigation strategy:

- Evaluate context retrieval and task performance, not advertised window size.

Recommended guardrails:

- Add needle-in-context style tests for long-document workflows.

## Reusable Techniques

- context.md per bounded context with domain terms, examples, aliases, and code references.
- Local instruction pointer to context docs instead of pasting glossary content into every prompt.
- ADR template for surprising, hard-to-reverse, tradeoff-heavy decisions.
- Out-of-scope directory for rejected feature classes and negative product memory.
- Issue state machine: category plus exactly one state.
- Ready-for-agent template: goal, context, affected modules, glossary terms, acceptance criteria, validation command, reproduction evidence, risks.
- Bug diagnose flow: classify, reproduce, write regression test, fix, validate, then move state.
- Architecture-deepening report: shallow module candidates, poor locality, low leverage, untested seams, duplicated rules.
- Module interface checklist: simple public API, hidden implementation, tests at seams, clear adapters, boundary docs.
- Context budget checklist: current tokens, loaded MCP servers, loaded rules, messages, clear/compact decision.
- Skill routing table: no codebase -> Grill Me; codebase language ambiguity -> Grill With Docs; messy issue -> Triage; bug -> Diagnose/TDD; legacy structural risk -> Improve Codebase Architecture.
- Queue audit: stale ready-for-agent tasks, needs-info age, conflicting labels, out-of-scope matches.
- Agent-readiness score: navigability, feedback speed, module depth, test seam quality, glossary coverage, context cost.

## Strategic Insights

- AI makes old software design principles more valuable, not less. Deep modules, ubiquitous language, ADRs, tests, seams, and state machines become agent infrastructure.
- The repo is the real prompt. Pocock explicitly says the codebase matters more than prompts and agent instruction files.
- Agent productivity scales through queue quality. The AFK agent is only as useful as the backlog's readiness state.
- Context engineering is not just prompt engineering. It includes file structure, loaded tools, rules files, MCP servers, transcript memory, and reset behavior.
- Domain language is a performance optimization. Better language improves human alignment, code search, generated names, planning docs, and token efficiency.
- Architecture work remains human-strategic. Agents can inspect and propose, but long-term module boundaries and tradeoffs need taste and governance.
- The emerging workflow is not agent writes code. It is human shapes control plane; agent executes bounded tasks; validators and queues keep the loop honest.

## Deeper Extraction Addendum

This addendum deepens the initial extraction by treating the transcript set as a system-design artifact. The key question is not whether each individual Pocock practice is useful. The stronger question is how the practices combine into an operating model for agentic engineering, where that model breaks, and which parts should become harness-level machinery rather than personal workflow advice.

### Deeper Thesis: Pocock Is Optimizing For Agent Interpretability

Description:

Across the talks, Pocock is not mainly optimizing for faster prompting. He is optimizing for interpretability: making the codebase, backlog, domain language, and session state legible to a stateless worker that has no lived history of the project.

Evidence:

- Explicit evidence: He says the codebase influences AI output more than prompts or agent instruction files.
- Explicit evidence: He compares agents to new starters who need orientation, documentation, tests, and clear task descriptions.
- Explicit evidence: He pushes variable names, file names, and implementation language back toward context documents.
- Explicit evidence: He treats the ready-for-agent label as a meaningful transition from messy human idea to executable agent work.
- Inferred insight: The repeated target is not the agent's intelligence but the agent's ability to read the system without hidden tribal knowledge.

Why it matters:

This reframes agent readiness as an information architecture problem. Prompt quality still matters, but the durable leverage comes from arranging the repo so the agent can infer the right thing from local evidence. A harness that only improves prompts will keep rediscovering the same ambiguity because the ambiguity still lives in the code, docs, and queue.

Implementation opportunity:

Create an agent-interpretability score for repositories. The score should measure whether a fresh agent can answer: what domain words mean, where important behavior lives, which decisions are surprising, which tests prove the touched path, which tasks are ready, and which areas are out of scope. This can be evaluated with small benchmark tasks rather than subjective review alone.

Risk:

Interpretability can become documentation theater. The useful target is not more written material; it is fewer hidden assumptions per unit of work. A repo can have extensive docs and still be agent-hostile if the docs are stale, vague, or not linked to actual code paths.

Confidence:

High confidence.

### Pattern Interdependencies

The extracted patterns form a dependency graph. Several are weak when isolated and strong only when combined.

1. Grill With Docs depends on ubiquitous language.

The clarification skill is more powerful when it can check proposed questions and implementation plans against a shared glossary. Without the glossary, the skill can ask better local questions, but it cannot stabilize project vocabulary across sessions.

Harness implication:

Clarification skills should retrieve a compact vocabulary surface before asking the user questions. The prompt should ask questions in canonical project language and flag when the user's wording may map to multiple glossary terms.

Failure if missing:

Clarification becomes conversational but not durable. The same ambiguity returns in future issues, PRs, and generated code.

2. Ubiquitous language depends on code naming enforcement.

Pocock's strongest move is not simply documenting terms; it is saying variable names and file names should derive from the context documents. That converts docs into a naming contract.

Harness implication:

Add a glossary drift check that compares canonical terms and aliases against changed files, issue titles, test names, generated docs, and public APIs. The check should warn on newly introduced synonyms for established concepts and on deprecated terms that reappear.

Failure if missing:

The glossary becomes a passive reference. Agents may read it but still create new naming forks because nothing checks the output.

3. Deep modules depend on regression and seam tests.

Deep modules are valuable because implementation can change behind a simple interface. That only helps if the seam is covered by tests or executable checks.

Harness implication:

Architecture review should classify a module boundary as agent-safe only when it has a stable public interface and tests at the boundary. A deep module without tests is a hidden change-risk area, not a safe delegation boundary.

Failure if missing:

Agents may refactor behind the interface and silently break behavior that callers depended on.

4. Ready-for-agent queues depend on state-machine validation.

The ready label is only meaningful if the labels are mutually exclusive, current, and enforced. Pocock's exactly-one-category and exactly-one-state rule is the seed of a validator.

Harness implication:

Issue queues should reject work as agent-ready when it has conflicting state labels, no acceptance criteria, no validation command, stale reproduction evidence for bugs, or unresolved needs-info markers.

Failure if missing:

Ready-for-agent becomes an optimism tag. AFK agents burn time on ambiguous, blocked, or low-value tasks.

5. Context-window discipline depends on retrieval routing.

Clear and compact are only safe when important state is written somewhere retrievable. Context austerity without artifact discipline creates amnesia.

Harness implication:

Long-running workflows should write compact state artifacts before clearing: current objective, changed files, exact decisions, validation evidence, blockers, and next action. Session memory should be treated as a cache, not as the source of truth.

Failure if missing:

Agents clear too aggressively and lose intent, or compact too often and preserve distorted summaries.

### Operational Maturity Model

Level 0: Prompt-only agent use.

Signals:

- Work starts from free-form prompts.
- Project language lives in the user's head.
- Agent follows local instructions but cannot recover from ambiguity without the user.
- Tests are optional or manually selected.

Failure profile:

- Repeated questions.
- Inconsistent naming.
- Plausible but wrong implementations.
- Context window fills with history and corrections.

Level 1: Skill-mediated clarification.

Signals:

- Grill Me style question generation exists.
- The agent asks what it needs before implementation.
- The workflow improves user prompts but does not necessarily change repo structure.

Failure profile:

- Better conversations, but weak durability.
- Ambiguities return because language is not admitted into a persistent surface.

Level 2: Thin durable context.

Signals:

- context.md or equivalent captures domain terms, examples, aliases, and code references.
- ADRs capture surprising, hard-to-reverse decisions.
- Out-of-scope decisions are recorded.

Failure profile:

- Docs can drift.
- Context can expand until it becomes too expensive to load.
- Teams may debate wording instead of proving usefulness.

Level 3: Architecture as agent control plane.

Signals:

- Deep modules expose simple interfaces.
- Tests exist at seams.
- Agents can be assigned bounded implementation work inside clear modules.
- Architecture review identifies shallow modules and missing boundaries.

Failure profile:

- Refactors may become taste-driven without clear acceptance criteria.
- Deepening work can over-abstract if not tied to repeated agent failure or business value.

Level 4: Queue governance and readiness gates.

Signals:

- Issue triage is a state machine.
- Ready-for-agent requires category, state, reproduction or acceptance criteria, validation command, and risk context.
- Agents consume ready work without the user reexplaining the task.

Failure profile:

- Label drift.
- Stale tasks.
- Low-value busywork routed to agents because the queue is mechanically ready but strategically weak.

Level 5: Evidence-backed harness operations.

Signals:

- Every ready task has evidence inputs and validation outputs.
- Agent work writes artifacts.
- CI, PR review, triage, glossary, architecture, and context-budget checks reinforce each other.
- Failures update the harness, not just the task.

Failure profile:

- More governance overhead.
- Risk of creating a control plane that is technically correct but too heavy for solo use.

Assessment:

Pocock's examples mostly sit between Level 1 and Level 4. The most useful harness opportunity is to translate them into Level 5 without losing the lightweight feel that makes them usable.

### Adoption Map For Coding Harness

Candidate 1: Ready-for-agent schema.

Purpose:

Turn Pocock's issue-label state machine into a machine-checkable contract.

Fields:

- task title
- category
- state
- goal
- user value
- affected modules
- domain terms
- acceptance criteria
- validation command
- reproduction evidence for bugs
- out-of-scope notes
- risk tier
- required reviewer or approval path

Validator behavior:

- Fail when more than one state label is present.
- Fail when ready-for-agent appears with needs-info.
- Fail when bugs lack reproduction or a failing test plan.
- Warn when acceptance criteria cannot be checked.
- Warn when no relevant context or glossary file is linked.

Candidate 2: Context document contract.

Purpose:

Make context.md files useful as agent-facing compression surfaces rather than broad documentation.

Required sections:

- canonical terms
- aliases and rejected terms
- examples from code or user workflows
- code references
- decision links
- out-of-scope boundaries
- last verified date

Validator behavior:

- Warn when a context document lacks code references.
- Warn when new changed files introduce alternate names for canonical terms.
- Warn when context documents exceed a size budget without an index or split.

Candidate 3: ADR trigger policy.

Purpose:

Use ADRs only for decisions that are surprising, hard to reverse, tradeoff-heavy, or likely to be questioned by future agents.

Trigger examples:

- non-obvious architecture choice
- rejected simpler approach
- compatibility constraint
- security or governance tradeoff
- decision that affects naming, public interfaces, or module ownership

Validator behavior:

- Warn when major architecture files change without either an ADR link or an explicit no-ADR reason.
- Flag ADRs with no consequences, no alternatives, or no status.

Candidate 4: Module-depth review.

Purpose:

Operationalize Pocock's deep-module insight for agent delegation.

Signals:

- public interface is smaller than implementation
- tests cover boundary behavior
- callers do not reach into internals
- naming matches domain language
- module has a single reason to change
- documentation explains only the surprising parts

Validator or reviewer output:

- shallow module candidates
- boundary leaks
- duplicate concepts
- missing seam tests
- agent-risk classification

Candidate 5: Context-budget preflight.

Purpose:

Make context-window austerity visible before long or multi-agent runs.

Signals:

- loaded instruction surfaces
- loaded MCP or app tools
- large attached docs
- current transcript length
- active memory inserts
- stale summaries after compaction

Recommended actions:

- clear when durable artifacts already hold state
- compact only when live intent matters and source artifacts are available
- route to retrieval instead of preloading bulk research
- disable unused tools for the run where possible

### Deeper Failure Analysis

Failure: Personal skill workflow does not automatically become team governance.

Evidence:

- Explicit evidence: Pocock demonstrates workflows in Claude Code and describes local skills such as Grill with Docs and Triage.
- Inferred insight: The examples depend heavily on the operator's judgment and willingness to inspect results.

Root cause:

The skill boundary improves the interaction but does not by itself create auditability, role separation, or reproducible acceptance criteria.

Severity:

High for production teams; medium for solo research workflows.

Mitigation:

Promote useful skill outputs into artifacts, schemas, CI checks, PR templates, and issue state rules. Treat local skill use as the front end, not as the whole control system.

Recommended guardrail:

No ready-for-agent transition without an artifact. No artifact should be accepted without current validation fields or an explicit blocker.

Failure: Ubiquitous language can freeze the wrong abstraction.

Evidence:

- Explicit evidence: Pocock values shared domain language from domain-driven design.
- Inferred insight: If the chosen terms are wrong, generated code will reproduce the wrong model consistently.

Root cause:

Glossaries feel authoritative once written, even when they encode early guesses.

Severity:

Medium to high depending on domain complexity.

Mitigation:

Add lifecycle states to terms: proposed, accepted, deprecated, rejected. Require examples and code references before a term becomes accepted.

Recommended guardrail:

Glossary changes that introduce or deprecate canonical terms should require review by the domain owner or maintainer.

Failure: Deep-module advice can be over-applied.

Evidence:

- Explicit evidence: Pocock prefers deep modules over shallow modules.
- Inferred insight: Deepening everything can produce ceremony if applied without a repeated pain signal.

Root cause:

A good architecture heuristic becomes a universal refactor mandate.

Severity:

Medium.

Mitigation:

Only prioritize module-deepening work when there is evidence of agent confusion, repeated bugs, duplicated logic, hard-to-test seams, or high-change areas.

Recommended guardrail:

Architecture-deepening reports should include a why-now field and a do-not-change list.

Failure: Ready-for-agent can optimize throughput over judgment.

Evidence:

- Explicit evidence: Pocock distinguishes strategic human decisions from tactical agent execution.
- Inferred insight: A queue can become efficient at feeding agents work that should have been declined, bundled, or reframed.

Root cause:

State-machine readiness is not the same as strategic value.

Severity:

High when teams measure issue throughput without outcome quality.

Mitigation:

Separate ready-for-agent from worth-doing. Add explicit user value, priority, and out-of-scope checks before ready tasks enter AFK queues.

Recommended guardrail:

Periodic queue audit: closed as duplicate, closed as out of scope, stale ready tasks, reverted agent changes, and tasks reopened after agent completion.

Failure: Context austerity can hide necessary evidence.

Evidence:

- Explicit evidence: Pocock recommends clear as the default and warns about context bloat.
- Inferred insight: Overzealous clearing can erase useful near-term reasoning if the state was never externalized.

Root cause:

Teams adopt the reset behavior without the artifact discipline that makes reset safe.

Severity:

Medium.

Mitigation:

Require checkpoint artifacts before clearing after substantial work: objective, current plan, changed files, decisions, validation, blockers, next action.

Recommended guardrail:

After resume, the agent must reopen source artifacts and not rely solely on compacted narrative.

Failure: Demo speed masks missing deployment controls.

Evidence:

- Explicit evidence: Some examples include direct push-to-main style behavior.
- Inferred insight: The demonstrations optimize for showing the loop, not for production-grade review separation.

Root cause:

Educational demos collapse roles to keep the story visible.

Severity:

High if copied into real repos.

Mitigation:

Keep the workflow, but route completion through branches, PRs, checks, review artifacts, and merge policies.

Recommended guardrail:

No unattended direct push to protected branches. Agent-created changes require independent review or explicit human override with recorded reason.

### Validation And Eval Design Candidates

Eval: New-starter comprehension test.

Question:

Can a fresh agent explain the repo's domain terms, module boundaries, validation commands, and task workflow using only repo-local artifacts?

Fixture:

Provide the agent a cold repo checkout and ask for an orientation memo with citations. Score for correct terms, correct paths, no hallucinated commands, and ability to identify unknowns.

Why it maps to Pocock:

It tests the new-starter analogy directly.

Eval: Glossary-to-code drift test.

Question:

Do changed files follow canonical domain language?

Fixture:

Seed a repo with canonical terms plus common synonyms. Ask an agent to implement a feature. Score whether it reuses canonical terms or invents aliases.

Why it maps to Pocock:

It tests whether context docs shape variable names and file names.

Eval: Ready-for-agent queue integrity test.

Question:

Can the triage system prevent blocked or underspecified work from entering an AFK queue?

Fixture:

Create issues with conflicting labels, missing acceptance criteria, stale needs-info, unreproduced bugs, and vague tasks. Score gate behavior and remediation suggestions.

Why it maps to Pocock:

It converts triage labels into governance.

Eval: Deep-module delegation test.

Question:

Can an agent safely change internals behind a module interface without breaking callers?

Fixture:

Create paired shallow and deep module examples with equivalent feature requests. Compare diff size, touched files, test failures, and correctness.

Why it maps to Pocock:

It tests the claim that deep modules make agent work safer and more local.

Eval: Context-budget stress test.

Question:

Does a workflow preserve accuracy as context grows?

Fixture:

Run the same task with minimal retrieval, bloated docs, multiple MCP surfaces, and compacted session summaries. Score correctness, citation accuracy, token use, and missed constraints.

Why it maps to Pocock:

It tests the context-window discipline claims instead of assuming bigger context is better.

Eval: Regression-first bug repair test.

Question:

Does the bug workflow create the feedback loop before patching?

Fixture:

Provide a bug report with enough evidence to reproduce. Score whether the agent writes or identifies a failing test, confirms failure, applies a fix, and proves pass.

Why it maps to Pocock:

It operationalizes the diagnose flow.

### Governance Gaps And Required Hardening

Gap: Skill output provenance.

Problem:

Pocock's skill examples are useful, but the transcript does not establish a durable provenance model for generated questions, triage decisions, or architecture reports.

Harness hardening:

Every skill that changes work state should write an artifact with source inputs, timestamp, tool/model identity when available, confidence, blockers, and validation command.

Gap: Reviewer independence.

Problem:

The examples do not strongly separate the agent that writes code from the reviewer that approves readiness or merge.

Harness hardening:

Require independent review for high-risk changes and for tasks promoted from ready-for-agent to done. The same agent can suggest readiness but should not be the sole authority for final acceptance on risky work.

Gap: Staleness management.

Problem:

Context docs, ADRs, and issue labels can become stale.

Harness hardening:

Add freshness metadata and stale-warning gates. A stale context file should not block everything, but it should force the agent to verify live code before relying on it.

Gap: Negative memory governance.

Problem:

Out-of-scope documents are powerful but can reject future good ideas if old product constraints change.

Harness hardening:

Give rejected decisions owners, dates, and review triggers. Out-of-scope is a current boundary, not eternal truth.

Gap: Tool bloat accountability.

Problem:

MCP caution is stated, but the workflow needs an observable budget.

Harness hardening:

Track tool surfaces loaded per run, estimated context impact, actual use, and unused expensive surfaces. Recommend disabling or lazy-loading tools that are repeatedly loaded and unused.

### Research-To-Implementation Backlog

1. Build a ready-for-agent contract.

Acceptance criteria:

- Machine-readable schema exists.
- Validator rejects conflicting states and missing readiness fields.
- Example valid and invalid issues exist.
- Documentation explains the human approval meaning of ready-for-agent.

2. Add a compact context document template.

Acceptance criteria:

- Template distinguishes accepted terms, aliases, rejected terms, examples, code references, and out-of-scope notes.
- Template includes a size budget and last-verified field.
- A sample context file demonstrates the intended level of thinness.

3. Create a glossary drift checker.

Acceptance criteria:

- Checker flags newly introduced synonyms for accepted terms.
- Checker supports allowlisted exceptions.
- Output is warning-first until false positives are understood.

4. Add a module-depth review report.

Acceptance criteria:

- Report classifies shallow modules, boundary leaks, missing seam tests, and deep-module candidates.
- Report requires why-now evidence.
- Report includes no-change recommendations to prevent broad refactor drift.

5. Add context-budget telemetry.

Acceptance criteria:

- Workflow records loaded instruction surfaces, tools, large artifacts, and summary/clear events.
- Output recommends clear, compact, or artifact checkpoint.
- It warns when large tools or docs are loaded but unused.

6. Create eval fixtures for agent-ready codebases.

Acceptance criteria:

- Fixtures cover glossary use, ready queue integrity, deep-module delegation, and regression-first repair.
- Scoring separates correctness, evidence quality, and context efficiency.

### What Not To Copy

- Do not copy direct-to-main demo behavior into production workflows.
- Do not treat ready-for-agent as a purely mechanical label. It must retain a human approval meaning.
- Do not create large always-loaded context files. Pocock's thesis is thin leverage, not maximal documentation.
- Do not let ADRs become a diary. Use them for surprising, hard-to-reverse decisions.
- Do not turn deep modules into blanket abstraction work. Use evidence of repeated pain.
- Do not accept compacted summaries as authoritative after long work. Reopen artifacts.
- Do not assume a skill prompt is a governance system. Skills need schemas, artifacts, validators, and review boundaries.
- Do not use the out-of-scope file as a graveyard without owners or review dates.
- Do not equate context-window size with practical performance.

### Stronger Assessment

Pocock's most valuable contribution is a practical bridge between classic software design and modern agent operations. The talks make an important claim: agent performance is downstream of maintainability. Tests, deep modules, shared language, ADRs, and clean queues were already good engineering practices, but agents convert them from human niceties into execution infrastructure.

The work is strongest where it treats the agent as a fast but context-limited new starter. That framing predicts the practical fixes: improve onboarding docs, reduce hidden assumptions, create stable interfaces, write feedback loops, make task states explicit, and preserve only useful context. It is also strong because it resists prompt maximalism. The codebase, issue tracker, tests, and vocabulary become the prompt.

The work is weakest where demonstration workflow stands in for institutional control. A solo expert can safely inspect a triage result, approve a ready label, or push a change in a demo. A reusable harness needs more: artifacts, schemas, provenance, stale-state detection, validation gates, role separation, and review evidence. The patterns should be treated as high-quality raw operating instincts, not as complete production governance.

The deepest reusable idea is that harness engineering should move ambiguity left into durable structures. If the agent asks a good clarification question, the harness should ask whether that question reveals a missing glossary term, a missing ADR, a weak issue template, an untested seam, or a stale context document. The improvement should not end with a better answer in the current chat. It should alter the control plane so the next agent starts with less ambiguity.

### Highest Leverage Experiments

Experiment 1: Ready-for-agent gate on a real issue queue.

Run the validator on a small backlog and measure how many issues are blocked by missing acceptance criteria, missing validation, stale needs-info, or conflicting labels. Then repair the top ten and compare agent completion quality.

Success signal:

Fewer clarification loops, fewer abandoned agent runs, and clearer PR validation evidence.

Experiment 2: Context document plus glossary drift on one bounded domain.

Choose one domain area, write the thin context file, and run a naming drift check on new changes. Keep it warning-only at first.

Success signal:

Agents reuse canonical terms in file names, variables, tests, and PR descriptions without the user restating them.

Experiment 3: Deep-module refactor as an agent-safety benchmark.

Pick one shallow module with repeated churn. Deepen the boundary, add seam tests, then compare agent changes before and after.

Success signal:

Future agent diffs touch fewer files, require fewer corrections, and break fewer unrelated tests.

Experiment 4: Context-budget audit for a long agent session.

Track loaded rules, MCP surfaces, docs, transcript length, compact events, and artifacts. Compare accuracy before and after introducing checkpoint-before-clear discipline.

Success signal:

Lower context load with equal or better evidence quality.

Experiment 5: Regression-first bug lane.

Require every bug marked ready-for-agent to include reproduction evidence or a failing test plan. Track how often agents patch before proving the bug.

Success signal:

Fewer plausible fixes without proof and better reviewer trust in bug PRs.

## Recommended Books

- Domain-Driven Design by Eric Evans
  - Role in transcript: source of ubiquitous language and bounded-context thinking.
  - Harness relevance: glossary/context docs, shared language between users, domain experts, developers, code, and agents.
- A Philosophy of Software Design by John Ousterhout
  - Role in transcript: source of deep modules versus shallow modules.
  - Harness relevance: module depth, leverage, locality, seam design, cognitive load reduction, agent-safe boundaries.

## Key Quotes & Evidence

- "Your code base, way more than the prompts that you use, way more than your agents.md file, is the biggest influence on AI's output."
  - Supports: codebase-as-primary-harness thesis.
- "What is the thinnest layer of documentation I could use to just give the AI a bit more of a leg up?"
  - Supports: thin high-leverage documentation pattern.
- "All variable names, all file names are going to be based on these context.md documents."
  - Supports: glossary as code-generation control surface.
- "When you have a code base, use Grill with Docs. When you don't have a code base, use Grill me."
  - Supports: routing by artifact state.
- "AI has simply accelerated software entropy."
  - Supports: architecture repair and guardrail urgency.
- "Deep modules have simple interfaces and lots of implementation hidden behind them."
  - Supports: deep modules as agent boundaries.
- "The seam where they must agree is untested."
  - Supports: untested parallel implementation failure mode.
- "This is not an AFK skill."
  - Supports: strategic-human/tactical-agent split.
- "Every single triaged issue should carry exactly one category role and one state role."
  - Supports: issue-state-machine governance.
- "The ready for agent kind of signal is a really cool one."
  - Supports: ready-for-agent as approval gate.
- "It gets it to create the regression test first, create the feedback loop first, and then fix it within that feedback loop."
  - Supports: regression-first bug fixing.
- "The context window is the main constraint that most AI coding agents face."
  - Supports: context-window budgeting.
- "MCP servers are super attractive... But they can bloat your context incredibly rapidly."
  - Supports: lazy tool loading and MCP caution.

## Final Assessment

Strongest ideas:

- Codebase structure is the primary agent prompt.
- Ubiquitous language is both human alignment and token compression.
- Deep modules create safe, testable agent work boundaries.
- Issue labels can encode an agent-consumable state machine.
- Context-window discipline is a first-class operational skill.

Weakest areas:

- Governance is lightweight and demo-oriented.
- Formal eval methodology is implied through tests and queues, not deeply specified.
- Some workflows remain highly manual and dependent on Pocock's judgment.
- Direct-to-main demo behavior should not be copied into production agent lanes.

Most reusable concepts:

- Grill With Docs.
- Context file plus ADR split.
- Ready-for-agent queue state.
- Out-of-scope negative memory.
- Architecture-deepening periodic review.
- Regression-test-first diagnose flow.
- Context clear/compact decision rule.

Highest leverage opportunities:

- Add a ready-for-agent schema and validator.
- Add a context/glossary surface tied to task briefs.
- Add architecture-deepening eval fixtures for shallow-module detection.
- Add issue-triage state-machine checks.
- Add context budget telemetry and MCP/rules bloat warnings.

Most important risks:

- Stale or bloated docs becoming misleading context.
- Triage labels drifting from actual readiness.
- Architecture skills making refactor proposals without strategic review.
- Agents patching bugs without reproduction.
- MCP and rules bloat degrading agent performance.

Immediate implementation candidates:

- A small context.md template with glossary entries, examples, aliases, and code links.
- A ready-for-agent issue template requiring acceptance criteria and validation.
- A bug triage rule requiring reproduction before ready-for-agent.
- A module-depth review checklist for architecture reviews.
- A context-budget preflight for long-running agent sessions.
