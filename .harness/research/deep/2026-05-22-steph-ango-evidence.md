# Steph Ango / Kepano Obsidian Vault Evidence Extraction

Generated: 2026-05-22

Primary source:

- .harness/research/2026-05-22-obsidian_vault-evidence.md

Thread context used:

- User-provided Getting the most out of Codex source note.
- User-provided How Memory Works in Codex CLI source note.
- User-provided Codex knowledge vault source note.
- User-provided Obsidian knowledge vault with Claude, Readwise, Airr, Whisper, Telegram, and N8N source note.
- Current Coding Harness context around Project Brain, Local Memory, goal boards, sync receipts, and the Codex-native memory baseline.

Evidence posture:

- This is an engineering intelligence extraction, not a transcript summary.
- The transcript is auto-captioned and contains transcription artifacts, including the speaker name rendered as Steph Engo for Steph Ango / Kepano.
- Evidence labels distinguish explicit evidence, inferred insight, and speculative interpretation.
- Recommendations are candidate harness patterns. They are not adopted repo policy until promoted into a repo-owned instruction, validator, skill, eval, or tracked implementation slice.
- The central boundary is that Obsidian vault memory, Codex first-party generated memory, and Coding Harness Project Brain are adjacent systems, not interchangeable systems.

## Command Summary

BLUF: The strongest extraction is that a useful Codex-native memory baseline needs an output loop, not just a storage layer. Obsidian contributes a local-first, user-editable knowledge substrate. Codex contributes durable threads, steering, goals, side-panel artifacts, automations, and generated recall. Coding Harness contributes repo-governed operational state, validation, receipts, and closeout evidence. The system fails if it captures information but never returns insight, or if it says memory is updated without naming which memory layer was touched and verified.

Decision Needed: Decide which layer is canonical for each fact class: raw captures, source notes, personal context, project decisions, implementation state, artifact evidence, validation proof, generated recall, daily briefs, and weekly operating-rule proposals.

Top Risks: The highest risks are blended success claims, vault sprawl, input-only archives, unsafe autonomous instruction rewrites, source-less technical decisions, privacy leaks from passive ingest, stale generated memories, and automations that keep acting after authority or context changed.

Next Action: Add an explicit vault contract to the Codex-native memory baseline: folder map, capture and promotion states, source citation requirements, daily and weekly output loops, sync receipt fields, contradiction handling, and a validator that proves vault-linked evidence exists when a claim says the vault was updated.

## Table of Contents

- [Command Summary](#command-summary)
- [Executive Summary](#executive-summary)
- [Evidence Model](#evidence-model)
- [Core Engineering Patterns](#core-engineering-patterns)
- [Tooling And Ecosystem](#tooling-and-ecosystem)
- [Harness Engineering Insights](#harness-engineering-insights)
- [Implied Best Practices](#implied-best-practices)
- [Failure Modes And Mitigations](#failure-modes-and-mitigations)
- [Reusable Techniques](#reusable-techniques)
- [Strategic Insights](#strategic-insights)
- [Key Quotes And Evidence](#key-quotes-and-evidence)
- [Final Assessment](#final-assessment)
- [Validation Evidence](#validation-evidence)

## Executive Summary

The source material points to a memory architecture built from four operating ideas.

First, the vault must be local-first and inspectable. The transcript repeatedly frames Obsidian as powerful because it is based on Markdown, files, links, local-first storage, plugins, and cross-platform access. This makes it a durable user-owned memory substrate rather than an opaque agent state store.

Second, the vault must produce output. The newer user source is explicit: most knowledge systems fail because they are designed for input, not output. Capture without return creates a dead archive. The daily brief and weekly synthesis are therefore not accessories. They are the feedback loop that turns stored material into operational intelligence.

Third, agent memory must be layered. Codex CLI first-party memories are generated, async, summarized, truncated, grepped, and local-only. Obsidian is editable durable knowledge. Coding Harness Project Brain is repo-governed execution memory with plans, decisions, artifacts, sync receipts, and validation proof. A robust harness should report and validate these layers separately.

Fourth, insight must remain source-grounded. The Freshman Rule from the user sources is the safety hinge: technical decisions need a source link or an explicit admission of uncertainty. This is especially important because generated memory and daily synthesis can produce coherent prose from weak evidence.

The highest leverage gap for Coding Harness is therefore not merely adding a folder called vault. It is adding a governed vault loop: raw capture into inbox, structured pipeline into notes and ideas, daily output that returns connections, weekly synthesis that surfaces contradictions and thesis drift, and validation receipts that prove what changed.

## Evidence Model

High confidence:

- The transcript explicitly emphasizes maximum-detail craft across software, furniture, and food.
- The transcript explicitly frames Obsidian around Markdown, files, web technologies, plugins, cross-platform access, local-first constraints, links, backlinks, embeds, graph views, canvas, bases, sync, and ideas as interrelated.
- The thread text explicitly describes Codex durable threads, voice, steering, queuing, side-panel artifacts, automations, Goals, first-party memories, and Obsidian vaults as shared memory.
- The thread text explicitly lists Codex CLI memory files, write and read paths, configuration switches, token caps, keyword-only fallback, and limitations.
- The newer vault source explicitly defines a four-layer architecture: capture, pipeline, Obsidian, and Claude.
- The newer vault source explicitly identifies three failure causes: capture friction, no connection layer, and no reason to return.

Medium confidence:

- Obsidian's graph and linking model can become a harness relationship model for source, pattern, decision, project, task, artifact, and validation edges.
- A vault contract should become a first-class sync receipt surface alongside Local Memory, Chronicle, artifact state, and native citations.
- Passive ingest is useful only if staged through an inbox and promoted through citation, deduplication, redaction, and contradiction checks.
- Claude.md in the source maps to a Codex-world instruction or vault map such as AGENTS.md, README.md, or a vault-specific operating file. The exact filename must respect the tool and repo being used.

Low confidence:

- Any claim that the current Coding Harness implementation already supports the full Obsidian vault loop.
- Any claim that AGENTS or any binding instruction file should be rewritten autonomously without review.
- Any claim that graph visualization itself should become a required product feature.
- Any claim that Obsidian Sync, Git, Dropbox, Google Drive, N8N, or any specific sync and automation stack is the right default for every user.

Evidence labels used below:

- Explicit evidence: Directly stated in the transcript or the thread-provided source material.
- Inferred insight: Derived from repeated examples, tool choices, workflow constraints, or operational consequences.
- Speculative interpretation: Plausible harness direction that needs owner review, design, and validation before adoption.

## Core Engineering Patterns

### Pattern: Output-First Knowledge System

#### Description

Design the vault around feedback, not storage. The system must return connections, patterns, questions, contradictions, and actions without relying on the user to remember to retrieve them.

#### Evidence

- Explicit evidence: The newer vault source says most systems are designed for input, not output: capture everything, retrieve nothing.
- Explicit evidence: It says a second brain that never talks back is a very organized way to forget things.
- Explicit evidence: It proposes a weekday 6am daily brief and a weekly synthesis session.
- Inferred insight: A Coding Harness memory baseline that only creates folders and receipts has not implemented the core loop unless it produces useful returns.

#### Why It Matters

Memory is valuable only when it changes future work. For Codex, that means a vault must brief the thread, route the next task, reveal contradictions, and feed implementation decisions. Otherwise it is a nicer archive.

#### Implementation Opportunities

- Add a daily brief template that reads new inbox items, recent notes, active projects, and goal boards.
- Require the brief to output connections, one pattern, one question, contradictions, and one candidate action.
- Store briefs as dated Markdown files with source links and promotion status.
- Add a validator that checks briefs cite source notes rather than generic summaries.

#### Risks / Tradeoffs

- Daily briefs can become slop if they optimize for inspirational output instead of exact evidence.
- Automated output can create notification fatigue.
- Briefs can route stale or low-quality information if no source quality gate exists.

### Pattern: Four-Layer Vault Architecture

#### Description

Separate capture, pipeline, permanent storage, and intelligence into distinct layers with no overlapping responsibility.

#### Evidence

- Explicit evidence: The newer vault source defines layer one as capture, layer two as pipeline, layer three as Obsidian, and layer four as Claude.
- Explicit evidence: Capture tools include Readwise, Airr, Whisper, and Telegram.
- Explicit evidence: The pipeline is N8N, which watches sources and writes formatted Markdown into the vault.
- Explicit evidence: Obsidian is the permanent storage layer, and Claude is the intelligence layer that reads, connects, briefs, and answers.

#### Why It Matters

Layering prevents the common failure where one tool tries to capture, classify, store, summarize, decide, and act. A harness can validate each layer separately and report the exact broken layer when something fails.

#### Implementation Opportunities

- Map the source architecture into Coding Harness terms:
  - Capture: browser, connectors, transcript downloader, voice, Readwise, Airr, Whisper, Telegram, X, YouTube.
  - Pipeline: N8N, scripts, MCP jobs, Codex automations, or harness commands.
  - Storage: Obsidian vault plus .harness research and Project Brain.
  - Intelligence: Codex thread, goal, daily brief, weekly synthesis, eval, and review agents.
- Add receipts with fields for capture_source, pipeline_run, storage_target, intelligence_output, and validation.
- Add failure classes per layer.

#### Risks / Tradeoffs

- More layers mean more operational surface.
- Teams may choose different pipeline tools, so the harness should define the contract, not hardcode N8N.
- The intelligence layer can overstep if it writes binding policy without review.

### Pattern: Local-First Memory Substrate

#### Description

Use plain files as durable memory that remains inspectable, editable, movable, linkable, and resilient outside any one Codex thread or generated memory store.

#### Evidence

- Explicit evidence: Ango says Obsidian was easy to adopt because it was based on Markdown and files.
- Explicit evidence: The transcript says sharing a single note is conceptually difficult because Obsidian is local first.
- Explicit evidence: The thread source says shared memory can be anchored in an Obsidian vault stored in Git, Dropbox, Google Drive, or another sync layer.
- Explicit evidence: Codex CLI memory is generated under home directory memories and is not the supported place for user-edited always-know context.

#### Why It Matters

Generated Codex memory is useful recall, but it is not a source of durable project truth. A vault can store canonical rolling context that future threads inspect directly.

#### Implementation Opportunities

- Define a vault root discovery mechanism.
- Define folder destinations for raw ingest, source notes, ideas, projects, decisions, people, and daily briefs.
- Require sync receipts to distinguish vault, Codex generated memory, Local Memory CLI, Local Memory MCP, Chronicle, native citation, and artifact state.
- Add a validator that fails if a closeout claim says the vault was updated but no changed file or receipt exists.

#### Risks / Tradeoffs

- Plain files can sprawl.
- Sync introduces conflict and freshness problems.
- Vaults can accidentally store secrets or private third-party content.

### Pattern: Relationship-First Knowledge Capture

#### Description

Capture relationships between ideas, sources, projects, decisions, and tasks as first-class information.

#### Evidence

- Explicit evidence: Ango says people know ideas from yesterday are related to ideas from today, and the graph visualizes that concept.
- Explicit evidence: The transcript says cataloging relationships while making notes builds up into something.
- Explicit evidence: Ango connects Winamp skinning, online culture, and Obsidian's origin as interrelated ideas.
- Inferred insight: The transcript treats links as a cognitive model, not just navigation.

#### Why It Matters

Engineering memory becomes useful when it can answer why things connect. A source note alone is weak. A link from source to pattern, pattern to implementation decision, decision to validation, and validation to closeout creates an auditable chain.

#### Implementation Opportunities

- Add frontmatter fields for sources, derived_patterns, projects, decisions, validation, and open_questions.
- Generate backlinks from research extractions into vault notes when used in implementation.
- Extend Project Brain indexes to include relationship edges between research, decisions, specs, plans, artifacts, and reviews.
- Add a validator that detects orphaned decisions without source evidence.

#### Risks / Tradeoffs

- Link graphs can become decorative.
- Over-linking creates noisy retrieval.
- Link names can drift without canonical aliases or glossary support.

### Pattern: Low-Friction Capture, Governed Promotion

#### Description

Make raw capture automatic or under 10 seconds, but require evidence, deduplication, redaction, contradiction checks, and destination choice before raw material becomes durable operating memory.

#### Evidence

- Explicit evidence: The newer vault source says capture friction over 10 seconds breaks the habit under cognitive load.
- Explicit evidence: The user-provided vault article proposes passive ingest from X Bookmarks and YouTube Watch Later into inbox.
- Explicit evidence: The newer source says inbox is raw and unprocessed; notes are processed sources; ideas are the user's own thinking.
- Inferred insight: Friction should be removed from capture, not from truth promotion.

#### Why It Matters

Agents can capture more material than humans can manually file. Without promotion gates, the vault becomes a junk drawer. With promotion gates, capture becomes source, extraction, decision, and action.

#### Implementation Opportunities

- Define an inbox staging contract with no direct implementation authority.
- Use status states: raw, extracted, promoted, adopted, archived, contradicted, rejected.
- Require source, date, and capture tool metadata for every raw file.
- Add redaction and source-quality checks before promotion.

#### Risks / Tradeoffs

- Passive ingest can scrape private or irrelevant content.
- Automated summaries can launder weak sources into authoritative-looking notes.
- Promotion rules can become too heavy and reintroduce friction.

### Pattern: Daily Brief As Retrieval Compiler

#### Description

Use a scheduled intelligence pass to turn recent captures into connections, patterns, and questions that return value to the user.

#### Evidence

- Explicit evidence: The newer vault source gives a daily prompt: read inbox from the last 24 hours and notes from the last 7 days; output connections, pattern, and question.
- Explicit evidence: It says the brief should quote relevant passages and save to inbox as brief-date.md.
- Inferred insight: The daily brief is a compiler from raw memory into working context.

#### Why It Matters

The brief prevents the vault from becoming an archive. It also gives Codex a compact entry point for the day without rereading the entire vault.

#### Implementation Opportunities

- Add a daily-brief template under .harness or vault templates.
- Include active Coding Harness goals and Project Brain artifacts in the read set.
- Require each connection to cite both source notes.
- Add an output section for harness implications: validation, docs, skill, eval, or no action.

#### Risks / Tradeoffs

- Daily briefs can overwhelm the user if every brief recommends work.
- The source prompt asks for a question, not a task; the harness should preserve that distinction unless the user asks for execution.
- Briefs can become repetitive without dedupe.

### Pattern: Weekly Synthesis As Governance Proposal

#### Description

Run a deeper weekly review that extracts emerging thesis, contradictions, knowledge gaps, and one action, but treat binding instruction changes as proposals.

#### Evidence

- Explicit evidence: The newer vault source proposes weekly synthesis with emerging thesis, contradictions, knowledge gaps, and one action.
- Explicit evidence: The earlier vault source proposes a weekly firmware upgrade that rewrites AGENTS or core logic.
- Explicit evidence: Repo instructions treat AGENTS and instruction surfaces as binding agent behavior.

#### Why It Matters

Weekly synthesis is where compounding happens, but automated instruction mutation is dangerous. The safe harness pattern is proposal first, applied change second, validation third.

#### Implementation Opportunities

- Write weekly synthesis to a dated artifact with proposed instruction diffs.
- Require user approval before touching AGENTS or equivalent instruction files.
- Run focused validation after accepted instruction changes.
- Track rejected proposals and reasons to avoid repeated suggestions.

#### Risks / Tradeoffs

- Without review, instruction drift can silently change future behavior.
- With too much review overhead, weekly synthesis stops happening.
- The system needs a clear difference between insight, recommendation, and adopted rule.

### Pattern: Citation-First Technical Decisions

#### Description

Do not let the agent make technical decisions from unstated memory when a vault or repo source should exist. Require source-linked evidence or an explicit admission of uncertainty.

#### Evidence

- Explicit evidence: The Freshman Rule says the agent is not allowed to make a technical decision unless it can link back to a specific file in notes.
- Explicit evidence: The newer weekly prompt asks Claude to show both sides of contradictions from the user's own notes.
- Explicit evidence: Codex CLI memory has hard token caps and keyword-only fallback.

#### Why It Matters

Generated recall and daily synthesis can sound confident while being incomplete. Citation-first decisions reveal whether the agent is using source evidence, generated memory, or guesswork.

#### Implementation Opportunities

- Add a plan checkpoint requiring source evidence, intended action, and verifier.
- Extend decision artifacts with evidence_source and source_files.
- Add a contradiction protocol: ask for tie-breaker or record explicit override.
- Add eval cases where the correct behavior is to refuse or ask because no source exists.

#### Risks / Tradeoffs

- Citation requirements can slow trivial tasks.
- Bad citations can become token theater.
- Agents need calibrated exceptions for low-risk implementation mechanics.

### Pattern: Three-Layer Memory Boundary

#### Description

Separate generated agent recall, durable user knowledge, and repo-specific execution memory.

#### Evidence

- Explicit evidence: Codex CLI memory uses memory_summary.md, MEMORY.md, raw memories, skill memories, and rollout summaries.
- Explicit evidence: The shared memory source says the vault holds rolling context: people, projects, blockers, owners, dates, and links.
- Explicit evidence: Coding Harness uses .harness surfaces for research, artifacts, decisions, plans, review logs, memory learnings, and validation proof.

#### Why It Matters

Many failures come from saying memory updated without naming which memory. Generated memory, vault notes, and Project Brain have different edit rules, freshness properties, and authority.

#### Implementation Opportunities

- Define memory authority by fact class:
  - Personal preferences: generated memory plus vault people or agent notes.
  - Project decisions: .harness decisions and vault projects.
  - Implementation state: artifacts, goal boards, PR closeout evidence.
  - Source research: .harness research and vault notes.
  - Raw capture: vault inbox.
- Add sync receipt fields with independent statuses.
- Add closeout language for layers read, updated, skipped, deferred, or blocked.

#### Risks / Tradeoffs

- Too many layers can confuse agents unless the routing map is compact.
- Cross-layer synchronization can create stale duplicates.
- Some users may want a simpler personal vault.

### Pattern: Durable Thread Plus Verifier

#### Description

Use Codex durable threads and Goals only when there is a concrete finish line and verifier.

#### Evidence

- Explicit evidence: The Codex source says Goals are strongest when they have a measurable success criterion.
- Explicit evidence: Useful verifiers include tests, benchmarks, bug reproductions, validation matrices, and end-to-end workflows.
- Inferred insight: A memory baseline goal should prove memory surfaces and retrieval workflows, not just document intentions.

#### Why It Matters

Without a verifier, a long-running goal becomes plausible activity. With a verifier, the thread can continue while the user is away and know whether it is closer to completion.

#### Implementation Opportunities

- Define a vault-baseline verifier checking folder contract, instruction layer, sample source note, promoted note, sync receipt, retrieval proof, and contradiction handling.
- Add verifier fields to goal boards.
- Require each heartbeat to report current verifier state and blocker class.

#### Risks / Tradeoffs

- Verifiers can certify paperwork rather than behavior.
- Long-running goals can act on stale assumptions.
- Cadence needs backoff and stop conditions.

### Pattern: Steering And Queuing As Control-Plane Events

#### Description

Treat in-flight steering and queued follow-up tasks as structured state changes that affect durable memory and future work.

#### Evidence

- Explicit evidence: The Codex source distinguishes steering from queuing.
- Explicit evidence: The repo instructions treat repeated steering as an environment defect that should become a durable guardrail.
- Inferred insight: User correction is memory evidence, not merely chat.

#### Why It Matters

If steering is only obeyed in the current turn, the system repeats the failure. If steering is captured as a pattern, it can become a validator, doc, skill, or eval.

#### Implementation Opportunities

- Add steering_event and queued_task entries to runtime evidence bundles or goal boards.
- Promote repeated steering into .harness/memory/LEARNINGS.md or vault decisions.
- Add heartbeat logic that consumes queued tasks only after active verifier completion or explicit block.

#### Risks / Tradeoffs

- Over-capturing casual corrections creates noise.
- Queued tasks can go stale.
- Steering needs priority and recency rules.

### Pattern: Make Your Own Tooling

#### Description

Use increasingly accessible coding tools to create narrow, user-shaped utilities instead of forcing the user into generic workflows.

#### Evidence

- Explicit evidence: The transcript says make your own tooling.
- Explicit evidence: Ango says tools may become exactly the right thing for you.
- Explicit evidence: He describes preferring tools that let him mess around, including skins, themes, and plugins.
- Explicit evidence: The newer vault source says a Telegram bot can be built with Claude Code and N8N in about 30 minutes.

#### Why It Matters

Coding Harness is a tool-making control plane. The lesson is not just to use Obsidian, N8N, or Claude. The lesson is to build small tools that remove recurring friction while preserving evidence and validation.

#### Implementation Opportunities

- Package transcript ingest, vault promotion, daily brief, weekly synthesis, contradiction check, and source citation audit as skills or harness commands.
- Use machine-readable JSON outputs for automation.
- Keep tools small enough to validate independently.

#### Risks / Tradeoffs

- Too many small tools can fragment workflows.
- User-shaped tools may become hard for others to understand.
- Custom tooling must preserve deterministic validation.

### Pattern: Human Thinking Remains The Asset

#### Description

Design AI-assisted memory systems to amplify the user's thinking, not replace it with generated summaries.

#### Evidence

- Explicit evidence: Ango says using Obsidian requires valuing your own thinking at a baseline.
- Explicit evidence: He hopes AI does not take us toward a place where we stop valuing our own thinking.
- Explicit evidence: The Codex voice section says raw thoughts and transcripts preserve uncertainty, emphasis, and unfinished lines better than short summaries.
- Explicit evidence: The newer vault source frames compounding as compound interest of your own thinking.

#### Why It Matters

The vault should preserve Jamie's actual thinking, not flatten it into generic AI prose. This is especially important for anti-slop preferences and repeated steering.

#### Implementation Opportunities

- Preserve raw transcripts and source notes alongside extracted patterns.
- Store original correction language when it affects operating rules.
- Separate raw, distilled, and adopted memory states.
- Add a no-generic-summary standard for research artifacts.

#### Risks / Tradeoffs

- Raw transcripts are bulky and may contain private data.
- Preserving too much raw material increases retrieval cost.
- Distillation still needs editorial discipline.

## Tooling And Ecosystem

### Knowledge And Memory

Obsidian:

- Purpose: Local-first knowledge base using Markdown files, wikilinks, backlinks, embeds, graph views, canvas, bases, plugins, themes, sync, and mobile apps.
- Workflow role: Durable user-editable memory substrate for people, projects, notes, ideas, daily briefs, and source-linked decisions.
- Integration opportunities: link .harness research into vault notes, store project context in vault projects, use backlinks to connect source material to decisions and plans.
- Implied best practices: prefer Markdown and plain text, keep raw capture separate from promoted notes, use graph views as orientation rather than proof, treat local-first sync as a separate product concern.
- Strengths: ownership, inspectability, portability, plugin ecosystem, LLM-friendly Markdown, cross-platform access.
- Limitations: sync conflicts, local-first sharing complexity, graph noise, privacy risk, and possible note sprawl.

Codex CLI memories:

- Purpose: Generated, async-summarized memory store under home directory memories.
- Workflow role: First-party recall layer for preferences, recurring workflows, and session learnings.
- Integration opportunities: use as a hint, then verify against repo and vault sources; write closeout notes that future memory extraction can summarize.
- Implied best practices: do not treat generated memory as canonical; use AGENTS or vault notes for always-know information.
- Strengths: automatic, low friction, local, redacted, integrated into Codex startup.
- Limitations: feature-gated, generated, idle-gated, local-only, truncated, keyword-only fallback, no embeddings or rerank.

Coding Harness Project Brain:

- Purpose: Repo-local operational memory under .harness.
- Workflow role: Governs implementation plans, decisions, research, artifacts, validation evidence, review logs, and closeout proof.
- Integration opportunities: add vault receipts, link research to decisions, route high-value repeated rules to memory learnings, and keep active artifacts aligned with side-panel review.
- Implied best practices: keep execution state close to the repo, make claims evidence-backed, separate durable contracts from runtime caches.
- Strengths: versionable, reviewable, validation-friendly, repo-scoped, agent-native.
- Limitations: repo-specific, not a full personal knowledge system, needs a clean boundary with external vaults.

Vault instruction layer:

- Purpose: Source calls it CLAUDE.md; in a Codex-oriented system the equivalent should be a vault AGENTS.md, README.md, or explicitly configured instruction file.
- Workflow role: Front door that tells the agent who the user is, what projects are active, how folders work, and what outputs are wanted.
- Integration opportunities: map source CLAUDE.md template into a Codex-safe vault operating file; avoid conflicting with repo AGENTS scope rules.
- Implied best practices: update current projects and reading focus weekly; keep routing simple; challenge assumptions; answer from vault context.
- Strengths: prevents cold starts.
- Limitations: stale instruction files produce stale answers; binding instruction names differ by agent platform.

### Capture And Ingest

Readwise:

- Purpose: Capture articles, highlights, Kindle notes, Twitter bookmarks, Instapaper, and Pocket saves.
- Workflow role: Backbone aggregator for written content.
- Integration opportunities: native Obsidian integration writes formatted Markdown into notes.
- Implied best practices: highlight and move on; do not summarize or categorize during capture.
- Strengths: low-friction capture across many reading surfaces.
- Limitations: external account dependency, source availability, quality control, and potential noise.

Airr:

- Purpose: Clip podcast moments and save transcripts.
- Workflow role: Audio capture source for notable podcast passages.
- Integration opportunities: route clips through pipeline into notes with source, show, timestamp, and transcript.
- Implied best practices: capture the moment while listening; classify later.
- Strengths: preserves audio insights that would otherwise vanish.
- Limitations: transcript quality and platform dependency.

Whisper:

- Purpose: Transcribe longer audio such as meetings, lectures, and voice notes.
- Workflow role: Converts raw audio into searchable text for the vault.
- Integration opportunities: route voice notes into ideas and meetings into notes or projects.
- Implied best practices: preserve raw transcript and only then extract patterns.
- Strengths: broad audio-to-text capability.
- Limitations: privacy, transcription errors, and summarization drift.

Telegram bot:

- Purpose: Quick capture from phone or anywhere.
- Workflow role: Always-available inbox writer for ideas, tweets, questions, and fragments.
- Integration opportunities: N8N trigger formats messages into inbox Markdown.
- Implied best practices: make capture nearly instant; metadata should be automatic.
- Strengths: very low capture friction.
- Limitations: bot security, chat ID scoping, duplicate messages, and private data risk.

YouTube transcripts:

- Purpose: Convert videos into searchable Markdown source evidence.
- Workflow role: Raw source capture for deep research extraction.
- Integration opportunities: download transcripts into .harness/research, extract patterns into .harness/research/deep, promote distilled notes into vault notes or ideas.
- Implied best practices: keep raw transcript and extraction separate; validate artifact shape; cite exact lines for key claims.
- Strengths: preserves long-form nuance.
- Limitations: auto captions contain errors.

X bookmarks and Watch Later:

- Purpose: Passive capture of saved social and video sources.
- Workflow role: Daily inbox feed for technical, strategic, or cultural signals.
- Integration opportunities: browser or computer automation to export daily saved items.
- Implied best practices: strip engagement bait, retain URLs, classify source quality, do not promote directly to decisions.
- Strengths: uses existing user behavior.
- Limitations: auth brittleness, platform churn, deleted content, and noise.

### Pipeline And Automation

N8N:

- Purpose: Automation pipeline that watches capture sources and writes Markdown into the vault.
- Workflow role: Routing layer between capture tools and Obsidian storage.
- Integration opportunities: Readwise to notes, Telegram to inbox, scheduled daily brief, weekly synthesis.
- Implied best practices: each workflow should have one job and structured output.
- Strengths: visual automation, scheduling, connectors, code nodes.
- Limitations: workflow drift, credentials, filesystem access, and error observability.

Codex automations:

- Purpose: Scheduled or heartbeat Codex work.
- Workflow role: Fresh scheduled jobs or thread-attached wake-ups.
- Integration opportunities: daily memory brief, PR comment watch, vault quality audit, passive ingest review.
- Implied best practices: define stop conditions, blockers, and cadence.
- Strengths: can use thread context and tools.
- Limitations: stale authority, repeated blockers, and unclear completion if no verifier exists.

MCP servers and connectors:

- Purpose: Extend Codex to Slack, Gmail, Calendar, GitHub, Linear, browser, and other systems.
- Workflow role: Source discovery, message triage, issue state, review comments, scheduling, and external context.
- Integration opportunities: route external signals into inbox and attach connector evidence to receipts.
- Implied best practices: draft-only for communications unless approved; record source and authority.
- Strengths: reaches real work surfaces.
- Limitations: permissions, partial data, freshness, and privacy.

### Codex Work Surfaces

Durable threads and pinned threads:

- Purpose: Persistent working contexts.
- Workflow role: Recurring streams such as Chief of Staff, release, documentation review, monitoring, or memory baseline.
- Integration opportunities: bind a thread to a vault area or Project Brain board.
- Strengths: reduces cold starts.
- Limitations: thread context is not canonical memory.

Goals:

- Purpose: Long-running tasks with finish lines.
- Workflow role: Continue until a verifier passes or a blocker is classified.
- Integration opportunities: memory baseline verifier matrix.
- Strengths: measurable completion.
- Limitations: weak goals create activity without proof.

Side panel:

- Purpose: Artifact inspection, annotation, browser operation, and review beside the conversation.
- Workflow role: Review Markdown, documents, decks, data tables, Storybook, Remotion Studio, static dashboards, and browser apps.
- Integration opportunities: memory dashboard, daily brief review, sync receipt inspection.
- Strengths: keeps review in the working loop.
- Limitations: annotations must be persisted to become durable.

### Review, Validation, And Evals

Test suites, benchmarks, bug reproductions, validation matrices, and E2E workflows:

- Purpose: Goal verifiers and implementation proof.
- Workflow role: Determine whether Codex is closer to the finish line.
- Integration opportunities: memory baseline acceptance matrix and passive ingest scenario tests.
- Strengths: converts ambition into proof.
- Limitations: tests can certify paperwork unless they inspect real evidence.

Markdownlint and docs gates:

- Purpose: Validate Markdown artifact quality and documentation contract alignment.
- Workflow role: Basic proof for research and docs artifacts.
- Integration opportunities: run on research/deep artifacts; widen to docs gates when research becomes policy.
- Strengths: fast and deterministic.
- Limitations: does not validate factual correctness or implementation completeness.

## Harness Engineering Insights

### Orchestration

- High confidence: A memory system needs a coordinator that routes between capture, pipeline, storage, intelligence, validation, and closeout.
- High confidence: Steering and queuing should be structured events, not informal chat only.
- Medium confidence: A daily heartbeat can run capture review, but it should stop or downgrade cadence when no new sources appear.
- Medium confidence: Tool reach should be recorded so reviewers can see whether work used local files, API, browser, signed-in browser, or desktop GUI.

Potential implementation pattern:

- Add a memory-orchestrator artifact with active goal, thread, vault root, Project Brain root, source inputs, queued work, last verifier, next wakeup, and authority boundary.

### Validation

- High confidence: Memory sync claims require proof. Vault updated should mean a changed file, receipt, source link, and validation command.
- High confidence: Generated Codex memory cannot be treated as complete because startup reads are truncated and fallback retrieval is keyword-only.
- Medium confidence: Passive ingest should validate source count, dedupe, redaction, and promotion state.
- Medium confidence: Daily and weekly automations need freshness checks to prevent replaying stale source material.

Potential implementation pattern:

- Add vault-sync-receipt/v1 with vault_root, files_read, files_written, source_artifacts, promotion_state, redaction_status, contradictions, validation_command, and validation_outcome.

### Context

- High confidence: The context strategy should be retrieval-led: compact maps first, source files second, exact evidence third.
- High confidence: A vault instruction file should teach agents where context lives and when not to churn it.
- Medium confidence: Graph and canvas views are orientation aids, while exact source retrieval should remain path and text based.

Potential implementation pattern:

- Add a vault map with inbox for raw capture, notes for processed sources, ideas for original thinking, projects for active work, people for recurring collaborators, daily for briefs, and decisions for durable choices.

### Routing

- High confidence: Raw source capture should not drive implementation directly.
- High confidence: Vault and .harness should route different fact classes.
- Medium confidence: A daily brief can route next work only when it links to a current roadmap, active artifact, or explicit user ask.

Potential implementation pattern:

- Source evidence goes to .harness/research and vault notes.
- Repo execution plans go to .harness/plan.
- Durable project decisions go to .harness/decisions and vault projects.
- Personal preferences go to vault people, vault agent notes, or Codex generated memory.
- Repeated harness rules go to .harness/memory/LEARNINGS.md.

### Memory

- High confidence: Codex generated memory is recall; Obsidian is durable written context; Project Brain is repo operational state.
- High confidence: Each layer needs separate status fields.
- Medium confidence: The vault should store raw sources and compact briefs because raw material is too expensive to reread every time.

Potential implementation pattern:

- Use state transitions: raw_capture, extracted_pattern, promoted_note, adopted_decision, validated_workflow.

### Evals

- High confidence: The memory baseline should be evaluated with scenario tests.
- Medium confidence: Useful evals include cold-start retrieval, stale generated memory, contradiction handling, missing-source decision, passive ingest dedupe, and unsafe instruction rewrite.

Potential implementation pattern:

- Add fixtures where the agent must cite vault sources, refuse a source-less decision, detect contradiction, and propose but not apply instruction changes.

### Governance

- High confidence: Freshman Rule is a governance rule.
- High confidence: Instruction files are high-risk because they alter future agent behavior.
- Medium confidence: Weekly firmware should be proposal-first.

Potential implementation pattern:

- Create memory-governance rules: automatic raw ingest, source-linked promotion, reviewed instruction changes, source-required technical decisions, and explicit contradiction resolution.

### Scaling

- High confidence: Keyword-only recall scales poorly as generated memory grows.
- High confidence: Vault growth needs folder routing and canonical-note preference.
- Medium confidence: Human graph browsing is useful, but agent retrieval should use indexes and targeted search.

Potential implementation pattern:

- Maintain generated vault indexes, active projects, source maps, and active artifact indexes.

### Recovery

- High confidence: If memory sources conflict, ask for a tie-breaker or record an explicit override.
- High confidence: If a memory layer cannot be reached, closeout should classify it as blocked or deferred, not not applicable.
- Medium confidence: If passive ingest repeatedly fails, downgrade to manual source entry and preserve the blocker.

Potential implementation pattern:

- Use blocker classes: vault_missing, vault_unreadable, sync_conflict, source_unavailable, auth_missing, redaction_blocked, contradiction_unresolved, generated_memory_unavailable, receipt_missing.

## Implied Best Practices

- Design for return, not just capture.
- Keep memory layer boundaries explicit.
- Prefer plain text, Markdown, and source links for durable agent-readable context.
- Store raw capture separately from distilled and adopted knowledge.
- Promote durable rules only after source evidence, contradiction check, owner surface selection, and validation.
- Treat Claude.md from the source as a portable pattern, not a literal requirement in Codex-only repos.
- Use side-panel review for artifacts that humans must inspect, but persist outcomes into files.
- Treat voice and transcripts as source material, not already-clean requirements.
- Use generated memory as recall, then verify important facts against repo or vault sources.
- Record when a memory layer is skipped and why.
- Use graphs and canvases for orientation; use text indexes and search for deterministic retrieval.
- Keep instruction changes small, reviewed, and validated.
- Write daily briefs as output artifacts with source links, contradictions, and a question or recommended action.
- Write weekly synthesis as thesis plus contradiction plus gap analysis plus one action.
- Use Freshman Rule citations for technical decisions, architecture changes, and strategy shifts.
- Prefer scenario verifiers over broad memory health claims.
- Use status enums that expose uncertainty: updated, observed, not_applicable, deferred, blocked, stale, contradicted.
- Make memory receipts auditable.
- Preserve human phrasing when it carries steering, taste, or priority.
- Separate team-shareable project memory from personal preference memory.
- Include redaction checks in passive ingest.
- Stop automation when authority changes, source access fails, or repeated errors occur.

## Failure Modes And Mitigations

### Failure: Input-Only Archive

#### Description

The system captures information but never returns connections, patterns, questions, or actions.

#### Evidence

- Explicit evidence: The newer vault source says capture everything and retrieve nothing is the common failure.
- Explicit evidence: It says a vault that does not push insights back becomes a bookmarking tool.

#### Probable Root Cause

The system optimizes capture and folder structure but lacks a scheduled output loop.

#### Severity

High.

#### Mitigation Strategy

Add daily brief and weekly synthesis workflows with source citations, contradiction detection, and operational routing.

#### Recommended Guardrails

- Daily brief required fields: connections, pattern, question, sources, contradictions, and next routing.
- Weekly synthesis required fields: emerging thesis, contradictions, knowledge gaps, one action.
- Validator that briefs cite real source files.

### Failure: Blended Memory Success Claim

#### Description

The agent says memory is updated without identifying which memory layer was touched and verified.

#### Evidence

- Explicit evidence: The sources distinguish Codex generated memory, Obsidian vault memory, and repo-local Project Brain.
- Explicit evidence: Codex CLI memories are not equivalent to a user-editable vault.

#### Probable Root Cause

Memory is treated as one concept rather than separate storage surfaces.

#### Severity

High.

#### Mitigation Strategy

Require per-layer receipt fields and exact validation outcomes.

#### Recommended Guardrails

- memory-sync-receipt/v1 schema.
- Validator for impossible not_applicable statuses when work objective names a memory layer.
- Closeout template with separate layer lines.

### Failure: Generated Memory Overtrust

#### Description

The agent relies on generated Codex memory as if it were complete, current, editable, or semantically searchable.

#### Evidence

- Explicit evidence: Codex CLI startup loads truncated memory_summary.md and falls back to grepping MEMORY.md.
- Explicit evidence: The source says there is no embedding store, similarity search, or rerank step.

#### Probable Root Cause

Generated recall feels authoritative because it is injected into the session.

#### Severity

High.

#### Mitigation Strategy

Treat generated memory as a hint and verify important claims against repo, vault, or live tools.

#### Recommended Guardrails

- Decision artifact evidence_source field.
- Final answer disclosure when relying on unverified memory.
- Eval fixture where the fact is absent from memory summary but present in source.

### Failure: Vault Sprawl

#### Description

Passive ingest creates many files that are never promoted, linked, deduped, or used.

#### Evidence

- Explicit evidence: The newer source says complex folders collapse under their own weight and capture friction rises.
- Explicit evidence: It says when in doubt, put material in inbox.

#### Probable Root Cause

Capture becomes easy but refinement discipline is missing.

#### Severity

Medium to high.

#### Mitigation Strategy

Use an inbox with status, TTL, promotion states, source quality labels, and daily review.

#### Recommended Guardrails

- Frontmatter for captured_at, source, status, promoted_to, and review_by.
- Daily brief reports unreviewed inbox count.
- Weekly archive or promotion rule.

### Failure: Unsafe Autonomous Instruction Rewrite

#### Description

A weekly automation rewrites AGENTS, CLAUDE.md, or core operating instructions without review.

#### Evidence

- Explicit evidence: One source proposes weekly firmware upgrades to AGENTS.
- Explicit evidence: The newer source says CLAUDE.md should be updated weekly.
- Explicit evidence: Repo instructions treat AGENTS as binding behavior.

#### Probable Root Cause

The workflow collapses proposing better operating logic and mutating binding instructions.

#### Severity

High.

#### Mitigation Strategy

Make weekly instruction changes proposal-first.

#### Recommended Guardrails

- instruction-change-proposal artifact.
- Human approval before applying binding changes.
- Focused validation after accepted changes.

### Failure: Source-Less Technical Decision

#### Description

The agent makes a technical recommendation from generic knowledge, generated memory, or stale context even though a source should exist.

#### Evidence

- Explicit evidence: The Freshman Rule requires a specific note source or an admission that the agent is guessing.
- Explicit evidence: Weekly synthesis asks for contradictions from the user's own notes.

#### Probable Root Cause

The agent optimizes plausible completion over source-grounded decision making.

#### Severity

High.

#### Mitigation Strategy

Add a plan-first checkpoint and source citation requirement for technical decisions.

#### Recommended Guardrails

- Plan template: source, action, verifier.
- Decision artifact must include source files.
- Eval where source is missing and correct behavior is to ask or state uncertainty.

### Failure: Passive Ingest Privacy Leak

#### Description

Daily automation captures private bookmarks, messages, audio, or browser content and stores it in a repo or synced vault without redaction.

#### Evidence

- Explicit evidence: Sources propose Slack, Gmail, X bookmarks, YouTube, Telegram, voice notes, and browser/computer automation.
- Explicit evidence: Codex CLI memory uses secret redaction before memory hits disk.

#### Probable Root Cause

Automation focuses on capture usefulness and under-specifies data classification.

#### Severity

High.

#### Mitigation Strategy

Classify sources, redact secrets, and route private captures to user-controlled vault areas unless explicitly promoted.

#### Recommended Guardrails

- Redaction check before durable write.
- privacy_classification field.
- Repo validator blocking accidental promotion of private ingest into tracked files.

### Failure: Automation Runaway

#### Description

A heartbeat or scheduled automation keeps checking, scraping, drafting, or modifying artifacts after the task is stale, blocked, or complete.

#### Evidence

- Explicit evidence: Thread automations can check every few minutes or hours and continue until a condition is met.
- Inferred insight: Without stop conditions, recurring automation repeats stale work.

#### Probable Root Cause

Cadence is specified but stop conditions and blockers are weak.

#### Severity

High.

#### Mitigation Strategy

Define stop conditions, max attempts, idle or no-change backoff, and blocked-state closure.

#### Recommended Guardrails

- Heartbeat receipt with stop_condition, last_change_detected_at, attempt_count, and next_cadence.
- Pause after repeated identical blockers.
- Closeout proof before continuing or deleting a heartbeat.

### Failure: Graph Theater

#### Description

The system adds graph views or link maps that look sophisticated but do not improve retrieval, validation, or decisions.

#### Evidence

- Explicit evidence: The transcript says the Obsidian graph is memed as useless while still useful for teaching relationship thinking.

#### Probable Root Cause

Visual relationship artifacts are mistaken for operational relationship contracts.

#### Severity

Medium.

#### Mitigation Strategy

Use graphs as orientation surfaces; keep deterministic indexes, backlinks, and validators as the operational layer.

#### Recommended Guardrails

- Every graph-derived insight links to source notes.
- Do not make graph visualization a required validator.
- Maintain text indexes alongside visual maps.

### Failure: Local-First Sync Conflict

#### Description

Multiple devices, agents, or sync tools update the vault and create conflicts or stale state.

#### Evidence

- Explicit evidence: The transcript says Obsidian Sync exists because users want notes across devices outside a single provider ecosystem.
- Explicit evidence: It mentions collaborative vaults, Git, and Dropbox-like folders.

#### Probable Root Cause

Local-first ownership and multi-device collaboration have conflicting constraints.

#### Severity

Medium to high.

#### Mitigation Strategy

Choose a sync strategy per vault and record backend, conflict policy, and freshness.

#### Recommended Guardrails

- vault_backend and last_sync_observed_at fields.
- Conflict marker scan before writing.
- One-writer-at-a-time automation rule.

### Failure: Contradiction Laundering

#### Description

New source material contradicts older notes, but automation merges both into a coherent summary instead of surfacing the conflict.

#### Evidence

- Explicit evidence: The source asks weekly synthesis to show both sides of contradictions from the user's own notes.
- Explicit evidence: The Freshman Rule says contradictions require a tie-breaker.

#### Probable Root Cause

Summarization optimizes coherence and hides conflict.

#### Severity

High.

#### Mitigation Strategy

Make contradiction detection required output of daily and weekly reviews.

#### Recommended Guardrails

- contradictions section in daily briefs.
- requires_tiebreaker status.
- Block instruction or decision updates until contradiction is resolved.

### Failure: Tool Reach Overreach

#### Description

The agent uses desktop, signed-in browser, Slack, Gmail, or other broad tools when local files or APIs would suffice.

#### Evidence

- Explicit evidence: The Codex source distinguishes browser, Chrome, and computer by use case.
- Explicit evidence: The vault sources suggest browser-use, computer use, and multiple connected services.

#### Probable Root Cause

Automation optimizes capability rather than least authority.

#### Severity

Medium to high.

#### Mitigation Strategy

Require tool reach classification and use the lowest-authority successful tool.

#### Recommended Guardrails

- Ingest receipt records tool_surface.
- Policy: local or API before browser before desktop.
- Draft-only default for communication tools.

### Failure: Human Thinking Flattened Into AI Summary

#### Description

Raw voice, transcripts, and notes are summarized into generic prose that loses uncertainty, priority, voice, and edge cases.

#### Evidence

- Explicit evidence: The Codex source says transcripts preserve uncertainty, emphasis, and unfinished thought better than short summaries.
- Explicit evidence: Ango warns against technology causing people to stop valuing their own thinking.

#### Probable Root Cause

The pipeline treats summarization as the goal rather than preservation plus extraction.

#### Severity

Medium to high.

#### Mitigation Strategy

Keep raw source artifacts, extract patterns separately, and preserve key quotes that carry intent.

#### Recommended Guardrails

- Raw source retention rule.
- Extraction documents include evidence labels.
- Research artifact lint against generic motivational summaries.

## Reusable Techniques

- Vault sync receipt: record every vault read and write with source files, status, blocker, redaction state, and validation command.
- Daily source triage: scan inbox and recent notes, dedupe, classify source quality, extract candidate patterns, list contradictions, and propose one question or action.
- Weekly synthesis proposal: generate emerging thesis, contradictions, gaps, one action, and any proposed instruction changes as reviewable artifacts.
- Freshman Rule checkpoint: require source file link, three-sentence plan, and contradiction check before technical decisions.
- Memory layer closeout: report Codex generated memory, vault, Project Brain, Chronicle, artifact state, and native citation separately.
- Passive ingest staging: route Readwise, Airr, Whisper, Telegram, X, YouTube, and voice captures to inbox with raw status.
- Relationship frontmatter: add sources, patterns, decisions, projects, owners, validated_by, and supersedes fields.
- Contradiction register: store unresolved conflicts between current source and older notes as first-class work items.
- Source-linked daily brief: include new sources, extracted connections, pattern, question, contradictions, and validation implications.
- Vault instruction map: maintain a compact vault AGENTS.md, README.md, or configured instruction file describing folder semantics and churn rules.
- Retrieval drill eval: ask an agent to answer a project question using only vault or repo sources and verify exact citations.
- Stale generated memory eval: hide the answer outside generated memory summary and ensure the agent searches source or admits uncertainty.
- Side-panel review receipt: persist human artifact annotations as structured steering evidence.
- Least-authority ingest policy: record when browser or computer use was necessary and what safer surfaces were unavailable.
- Redaction preflight: scan passive ingest for credentials, private messages, and sensitive account data before promotion.
- Goal verifier matrix: define memory baseline completion across vault structure, source evidence, sync receipt, retrieval proof, contradiction handling, and docs.
- Brownfield vault inventory: before initializing a vault, list existing files and classify migration risk.
- Canonical-note preference: merge repeated facts into existing notes rather than creating a new note per source.
- Note TTL: archive unpromoted inbox items after a review window unless retained.
- Decision override artifact: when a user overrules an old note, record old source, new decision, owner, date, and validation impact.

## Strategic Insights

- The future agent memory stack is plural. Serious workflows will combine generated memory, repo memory, vault memory, connector context, and artifact state. The engineering problem is authority assignment and validation, not merely storage.
- Codex is moving from code assistant to computer-work orchestrator. Memory must span shell commands, browser surfaces, APIs, documents, events, automations, and reviewable artifacts.
- Plain text is a compatibility layer between humans, agents, and tools. The transcript notes that LLMs are Markdown-first; Obsidian's Markdown foundation aligns with the agent era.
- The strongest vaults will not be libraries. They will be operating systems: capture, route, link, validate, brief, decide, and act.
- The key governance challenge is preventing low-friction capture from becoming low-evidence authority.
- The graph metaphor is useful because it teaches relationship thinking. The implementation should remain boring: files, links, indexes, receipts, schemas, validators, and exact source citations.
- Side-panel review turns memory work from background bookkeeping into inspectable artifact work.
- Make your own tooling is a harness thesis. The agent should build small tools that fit the user's workflow instead of forcing everything through generic chat.
- The highest leverage Coding Harness feature is not an Obsidian clone. It is a reliable bridge: vault-aware routing, source-linked promotion, sync receipts, contradiction handling, and validators.
- The long-term risk is cognitive outsourcing. The memory system should preserve and sharpen Jamie's thinking, not replace it with generic daily summaries.

## Key Quotes And Evidence

- Detail-driven craft: The transcript asks what it means to consider every single detail in the thing being made at .harness/research/2026-05-22-obsidian_vault-evidence.md:21.
- Cross-domain craft: The transcript applies detail work to software, furniture, and a dish at .harness/research/2026-05-22-obsidian_vault-evidence.md:25.
- Customizable tools: Ango says he tends toward tools that let him mess around at .harness/research/2026-05-22-obsidian_vault-evidence.md:6721.
- Wikilink model: Double brackets around a word make it a link and can create a stub page at .harness/research/2026-05-22-obsidian_vault-evidence.md:6817.
- Markdown and plugins: Obsidian being Markdown and file based, and built on web technologies, made themes and plugins accessible at .harness/research/2026-05-22-obsidian_vault-evidence.md:6937.
- Link rot and local durability: The transcript says nothing has durability on the internet really, and Obsidian can recreate part of the concept locally at .harness/research/2026-05-22-obsidian_vault-evidence.md:7193.
- Atomic notes: The transcript describes really small notes that can be combined at .harness/research/2026-05-22-obsidian_vault-evidence.md:7317.
- Graph as cognitive model: People know ideas are linked, and the graph visualizes that concept at .harness/research/2026-05-22-obsidian_vault-evidence.md:7681.
- Graph as onboarding artifact: Even if unused day to day, the graph puts the idea of note connections in the user's mind at .harness/research/2026-05-22-obsidian_vault-evidence.md:7745.
- Relationship accumulation: Cataloging relationships as notes are made builds up into something at .harness/research/2026-05-22-obsidian_vault-evidence.md:7909.
- Tool matches thought: Ango says the tool matches the reality of how ideas work at .harness/research/2026-05-22-obsidian_vault-evidence.md:8293.
- Ideas as building blocks: The transcript describes combining ideas to get new ideas at .harness/research/2026-05-22-obsidian_vault-evidence.md:8585.
- Collaborative and sync options: The transcript mentions bases for task management, collaborative vaults, Git, and Dropbox-like folders at .harness/research/2026-05-22-obsidian_vault-evidence.md:9889.
- Local-first sharing complexity: Sharing one note is difficult because Obsidian is local first at .harness/research/2026-05-22-obsidian_vault-evidence.md:10041.
- Sync motivation: Obsidian Sync provides access to notes across devices and ecosystems at .harness/research/2026-05-22-obsidian_vault-evidence.md:10277.
- Markdown and LLMs: The transcript says LLMs are Markdown-first and users combine Obsidian with cloud code or Cursor at .harness/research/2026-05-22-obsidian_vault-evidence.md:10617.
- Human-authored product boundary: Obsidian is described as 100 percent human authored code while vibe coding is used for hobbies at .harness/research/2026-05-22-obsidian_vault-evidence.md:18629.
- Make your own tooling: The transcript says make your own tooling and imagines tools becoming exactly right for you at .harness/research/2026-05-22-obsidian_vault-evidence.md:19229.
- Frictionless creation: The transcript describes tools allowing movement from mind to reality when fluid and frictionless enough at .harness/research/2026-05-22-obsidian_vault-evidence.md:19441.
- Value own thinking: Obsidian requires valuing your own thinking, and AI should not push users away from that at .harness/research/2026-05-22-obsidian_vault-evidence.md:20205.
- AI removes operational friction: AI may remove steps until supporting work happens behind the scenes at .harness/research/2026-05-22-obsidian_vault-evidence.md:20485.
- Input-only archive risk: The user-provided vault source says the difference between a second brain and a dead archive is feedback.
- Four-layer architecture: The user-provided vault source defines capture, pipeline, Obsidian, and Claude as separate layers.
- Daily brief loop: The user-provided vault source says the vault should brief the user every morning without being asked.
- Weekly synthesis loop: The user-provided vault source asks for emerging thesis, contradictions, knowledge gaps, and one action.

## Final Assessment

Strongest ideas:

- Output-first vault design: daily brief and weekly synthesis are the core loop.
- Local-first vault as durable, inspectable, agent-readable memory.
- Relationship-first knowledge capture through links, backlinks, source-to-decision chains, and graph orientation.
- Four-layer architecture: capture, pipeline, storage, intelligence.
- Three-layer memory boundary: generated Codex memory, Obsidian vault, and repo-local Project Brain.
- Citation-first decisions as a practical safety rule.

Weakest areas:

- The vault sources under-specify privacy, redaction, sync conflicts, and authorization.
- The weekly AGENTS or CLAUDE.md rewrite concept is dangerous unless proposal-first.
- The graph discussion is conceptually powerful but insufficient as implementation.
- Codex generated memory is too lossy and local-only to serve as canonical work memory.
- Passive ingest can become source laundering if promotion checks are weak.

Most reusable concepts:

- Vault folder contract with inbox, notes, ideas, projects, people, daily, and decisions.
- Capture to pipeline to storage to intelligence architecture.
- Daily brief and weekly synthesis workflows.
- Sync receipts that separate memory surfaces.
- Freshman Rule source citation.
- Contradiction register and tie-breaker protocol.
- Goal verifier matrix for memory baseline completion.

Highest leverage opportunities:

- Add a vault baseline contract to Coding Harness.
- Add validators for vault sync receipts and source-linked decisions.
- Package passive ingest and promotion as skills.
- Add memory eval fixtures for cold-start retrieval, stale memory, contradiction handling, and unsafe instruction rewrite.
- Generate a side-panel-reviewable memory dashboard from .harness and vault indexes.

Most important risks:

- False done claims caused by blended memory layers.
- Input-only archive behavior.
- Autonomous memory automation mutating instruction surfaces without review.
- Generated memory overtrust.
- Vault sprawl and source laundering.
- Privacy leakage from passive ingest.
- Automation loops acting on stale or blocked state.

Immediate implementation candidates:

- Define vault-sync-receipt/v1.
- Add .harness/research to vault promotion workflow.
- Update memory baseline docs to include Obsidian vault folder map, capture and promotion states, daily and weekly output loops, and Freshman Rule.
- Add a focused validator that checks memory closeout claims against actual receipt files.
- Add a daily brief template with source links, contradictions, and one recommended question or action.

## Validation Evidence

Command: pnpm exec markdownlint-cli2 .harness/research/deep/2026-05-22-steph-ango-evidence.md -> pass (0 errors)
