# Tejas Kumar Agent Harness Evidence Extraction

Generated: 2026-05-18

Primary source: .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/youtube-transcripts-harness.md

Transcript segment:

- Harnesses in AI: A Deep Dive - Tejas Kumar, IBM
- Source URL recorded in transcript: https://youtu.be/C_GG5g38vLU
- Retrieval note recorded in transcript: video-transcript-downloader wrapper, clean paragraph transcript

Supporting source set:

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/README.md
- .harness/review/2026-05-18-tejas-harness-coding-harness-alignment.md

Source boundary:

- The primary evidence is the Tejas Kumar harness transcript embedded in youtube-transcripts-harness.md.
- The alignment review is used only as a locator/context clue; extraction claims below are grounded in the transcript unless labeled otherwise.
- The transcript contains a live demo narrative. Some implementation details are inferred from spoken descriptions of diffs and code, not from inspecting the original demo repository.

Evidence labels:

- Explicit evidence: directly stated in the transcript.
- Inferred insight: derived from the demo behavior, code walkthrough, analogies, or repeated operational framing.
- Speculative interpretation: plausible harness-engineering application that should be validated before adoption.

Confidence labels:

- High confidence: directly supported by transcript claims or demo steps.
- Medium confidence: supported by the transcript but translated into implementation practice.
- Low confidence: useful extrapolation beyond the transcript.

## Executive Summary

Tejas Kumar frames an agent harness as the system around a model that ties a black-box, rented, nondeterministic model to a stable environment. The transcript is unusually useful because it does not stay at metaphor level: it walks through a computer-use agent that fails on Hacker News, falsely claims success, then becomes reliable only after the surrounding harness adds guardrails, trace history, deterministic verification, bounded attempts, and a deterministic login recovery handler.

The strongest reusable idea is "do not prompt harder." Tejas explicitly refuses to change the user prompt or system prompt during the demo. The outcome changes because harness logic changes: context management, max-iteration guardrails, trace recording, verification over the trace, and an environment handler that logs in securely outside the model. This cleanly separates fuzzy model behavior from deterministic harness-owned recovery.

The core harness architecture extracted from the talk is: tool registry, model, context manager, guardrails, agent loop, outer harness loop, trace history, verifier, retry budget, and recovery handlers. These pieces are not optional decoration. They are the mechanism that turns a cheap weak model, GPT-3.5 Turbo in the demo, into a system that can complete a task correctly.

The biggest failure mode is allowing a model's success claim to substitute for external verification. In the demo, the agent clicked upvote, hit a login screen, crashed or stopped, and still claimed it succeeded. The harness became useful only when it inspected event history and page state to reject the lie. For agentic engineering systems, this maps directly to CI, PR, browser, filesystem, runtime, and trace-backed validation: never trust the model's assertion when the environment can be checked.

## Core Engineering Patterns

### Pattern: Harness As Stable Anchor Around Black-Box Models

#### Description

Build a stable environment around rented, nondeterministic models whose internals, routing, context limits, and behavior cannot be fully controlled.

#### Evidence

- Explicit evidence: Tejas says most people pay rent to companies for compute, inference, and tokens.
- Explicit evidence: He says the rented model is a black box and could theoretically route differently than expected.
- Explicit evidence: He says the "name of the game" with harnesses is reliability.
- Explicit evidence: He defines an agent harness as everything around the model that gives it grounding in reality and ties it to a stable environment.

#### Why It Matters

If the model is opaque and rented, reliability must come from the surrounding system. The harness is the part the builder controls: tools, context, guardrails, verification, traces, and recovery.

#### Implementation Opportunities

- Treat model calls as untrusted fuzzy components inside deterministic infrastructure.
- Build a harness boundary that owns tool exposure, retries, context trimming, verification, and audit history.
- Record provider/model assumptions and make routing changes observable.
- Prefer small deterministic checks over relying on model self-report.

#### Risks / Tradeoffs

- Harnesses can become overgrown state machines if every failure is hard-coded.
- Over-trusting the harness can hide model/provider drift.
- Black-box model assumptions require continuous verification.

### Pattern: Prompt-Invariant Harness Improvement

#### Description

Improve outcomes by changing harness structure rather than repeatedly changing prompts. Keep the prompt fixed to prove the harness is responsible for the improvement.

#### Evidence

- Explicit evidence: Tejas says the demo will not change the prompt at all.
- Explicit evidence: He rejects "prompt it harder" and "change the system prompt" as the solution to the login/upvote failure.
- Explicit evidence: At the end, he emphasizes that he did not touch the prompt or system prompt; the harness changed and the outcome changed.

#### Why It Matters

Prompt tweaking is hard to audit, fragile, and often hides missing system responsibilities. Harness changes can be tested, versioned, and reused.

#### Implementation Opportunities

- Add a "prompt-invariant reproduction" mode for agent failures: first fix with harness/tooling/verification before editing prompts.
- Track repeated prompt additions as candidates for deterministic handlers or gates.
- Separate model instructions from environment logic in architecture docs.

#### Risks / Tradeoffs

- Some failures really are instruction failures.
- Avoiding prompt changes entirely can overcomplicate simple tasks.
- Deterministic handlers need maintenance and ownership.

### Pattern: Tool Registry As Controlled Capability Surface

#### Description

Expose a typed set of tools to the model, with names, descriptions, parameters, and execute functions, instead of giving unconstrained ambient capability.

#### Evidence

- Explicit evidence: Tejas lists tool registry as a typical part of an agent harness.
- Explicit evidence: Claude Code, Cursor, and Codex are named as examples with tools to read the filesystem, write, and execute bash commands.
- Explicit evidence: In the demo, createTools returns tools with name, description, parameters, and execute, following OpenAI SDK-style shape.

#### Why It Matters

Tool registries define what the model can do and how the harness observes it. A typed tool surface is easier to audit, trace, restrict, and verify.

#### Implementation Opportunities

- Define tools with explicit schemas, side-effect classes, and failure semantics.
- Log every tool call as an event.
- Keep dangerous operations behind harness-owned policies.
- Generate model-facing tool descriptions from canonical metadata.

#### Risks / Tradeoffs

- Tool descriptions can be ambiguous.
- Too many tools increase selection confusion.
- Poorly scoped tools can leak secrets or broaden authority.

### Pattern: Agent Loop Inside Harness Loop

#### Description

Separate the inner model-tool loop from the outer harness loop. The agent loop handles model responses and tool calls; the harness loop owns attempts, verification, stop conditions, retries, and recovery.

#### Evidence

- Explicit evidence: Tejas says some people think the harness is just the agent loop, but it is the stuff around the agent loop.
- Explicit evidence: He says it could be a loop around your agent loop.
- Explicit evidence: The demo moves runLoop into runHarnessAttempt and wraps it with runHarness that runs no more than three times.

#### Why It Matters

The model should not own the full execution contract. The harness must decide when an attempt has failed, whether to retry, and whether the task is actually complete.

#### Implementation Opportunities

- Implement a harness runner with attempt IDs, max attempts, verifier results, retry reasons, and final status.
- Keep the model loop simple and observable.
- Put task completion authority in the verifier, not the model.

#### Risks / Tradeoffs

- Nested loops can create runaway behavior without strict budgets.
- Retry logic can mask root causes if not classified.
- Too much outer-loop control can reduce model flexibility.

### Pattern: Trace History As Truth Surface

#### Description

Record events from the agent loop into a trace so the harness can inspect what actually happened rather than trusting the model's final statement.

#### Evidence

- Explicit evidence: The demo pushes history events into a trace list.
- Explicit evidence: The verifier reflects on the tool history to determine whether a click happened, whether login failed, and whether the agent ended on a login URL.
- Explicit evidence: Tejas says the harness checks the tool history and actually sees what happened.

#### Why It Matters

Agents can misreport success. Trace history gives the harness an independent evidence surface for verification, debugging, retry decisions, and postmortem analysis.

#### Implementation Opportunities

- Store every model response, tool call, tool result, page URL, command exit code, and recovery handler event.
- Give verifiers access to structured traces, not only final messages.
- Compare model claims against trace-derived facts.

#### Risks / Tradeoffs

- Traces can contain secrets or sensitive data.
- High-volume traces need compression and retention policy.
- Poor event schemas make verification brittle.

### Pattern: Deterministic Verification Over Model Claims

#### Description

Use deterministic harness logic to verify whether the intended environmental state was achieved. Do not accept the model's "I'm done" response as proof.

#### Evidence

- Explicit evidence: The initial agent clicked upvote, reached a login page, and claimed success.
- Explicit evidence: Tejas says "it doesn't verify" and "this is the job of a harness."
- Explicit evidence: verifySuccessfulUpvote checks trace history and page state to return true or false.
- Explicit evidence: After adding verification, the run still fails but stops lying.

#### Why It Matters

Verification turns failure into useful information. The first win is not success; it is honest failure classification.

#### Implementation Opportunities

- Require every agent task to define an external verification signal.
- Implement claim-vs-trace verifiers for PRs, browser actions, filesystem changes, deployments, and tests.
- Fail closed when verification is missing or inconclusive.

#### Risks / Tradeoffs

- Verifiers can be too narrow and miss semantic failures.
- Deterministic checks may require brittle environment assumptions.
- Some tasks require fuzzy or human verification.

### Pattern: Bounded Guardrails

#### Description

Limit agent execution with max iterations, max messages, context compression, and max attempts.

#### Evidence

- Explicit evidence: Tejas lists guardrails as a harness component and gives max steps as an example.
- Explicit evidence: The demo adds max iterations and max messages.
- Explicit evidence: The context compressor keeps the system prompt, user prompt, and most recent two messages.
- Explicit evidence: Later, max attempts limits the outer harness loop to three tries.

#### Why It Matters

Agents need hard stops. Without them, failures can burn tokens, loop indefinitely, or degrade context until behavior becomes incoherent.

#### Implementation Opportunities

- Add guardrails for step count, token budget, tool budget, wall-clock time, and retry count.
- Emit guardrail-trigger events into traces.
- Treat guardrail exits as classified outcomes, not generic failures.

#### Risks / Tradeoffs

- Naive context compression can drop crucial facts.
- Too-low limits can kill valid long tasks.
- Guardrails need per-task tuning.

### Pattern: Harness-Owned Recovery Handler

#### Description

Move known environmental recovery tasks into deterministic harness handlers instead of asking the model to improvise or exposing secrets in prompts.

#### Evidence

- Explicit evidence: The login handler detects when the browser is on a login page.
- Explicit evidence: If on login, the harness fills credentials and submits the form programmatically.
- Explicit evidence: Tejas says credentials can be environment variables and secure.
- Explicit evidence: The harness pushes a message into the queue telling the agent it logged in and can continue.

#### Why It Matters

Known environment problems should be solved by the system, not by the model. This protects secrets, reduces randomness, and lets the agent resume from a stable state.

#### Implementation Opportunities

- Add deterministic handlers for auth redirects, missing setup, expired tokens, dependency installation, branch state, and common CI flakes.
- Keep secrets in harness runtime, never model-visible prompts.
- Emit recovery events to the trace and verifier.

#### Risks / Tradeoffs

- Recovery handlers can hide real user-facing failures.
- Secret-handling code must be audited carefully.
- Too many handlers can produce implicit, hard-to-debug behavior.

### Pattern: Cheap Model Plus Strong Harness

#### Description

Use a weak or cheap model successfully by surrounding it with a strong harness.

#### Evidence

- Explicit evidence: The demo intentionally uses GPT-3.5 Turbo, described as an old bad model.
- Explicit evidence: Tejas says models are nondeterministic and you want to do more with less.
- Explicit evidence: He says with a great harness, even cheaper or free models can go far.

#### Why It Matters

Harness quality can substitute for some model capability. This changes cost economics and shifts engineering focus from only buying the best model to building better control planes.

#### Implementation Opportunities

- Benchmark weak models under strong harnesses against stronger models under weak harnesses.
- Use cheaper models for bounded tasks with robust verification.
- Reserve expensive models for planning, ambiguity resolution, or high-risk reasoning.

#### Risks / Tradeoffs

- A harness cannot fully compensate for insufficient model competence.
- Weak models may fail in ways the harness did not anticipate.
- Cost savings can be erased by retries and long traces.

### Pattern: Enterprise Harness For Secure RAG

#### Description

Use harnesses to provide enterprise-grade security around RAG over siloed internal data.

#### Evidence

- Explicit evidence: Tejas says IBM created an open-source project called Open RAG deployed in enterprise environments.
- Explicit evidence: It supports RAG operations over teams, calls, PDFs, invoices, and siloed internal data.
- Explicit evidence: He says Open RAG has "a hell of a harness" that provides enterprise-level security.

#### Why It Matters

RAG systems need more than retrieval. They need access control, data handling, policy, auditability, and safe tool use around sensitive data.

#### Implementation Opportunities

- Put permission checks, source filtering, citation requirements, and audit logging in the RAG harness.
- Separate retrieval authority from answer generation.
- Add deterministic source-access handlers and policy gates.

#### Risks / Tradeoffs

- Enterprise security claims require formal verification, not demo confidence.
- RAG harnesses can leak data through prompts, traces, or logs.
- Access-control complexity grows quickly across siloed systems.

### Pattern: Dynamic On-The-Fly Harness Generation

#### Description

Before performing risky work, an agent generates a task-specific harness that defines guardrails, checks, recovery paths, and execution boundaries.

#### Evidence

- Explicit evidence: Tejas speculates that 2027 could be the year of dynamic on-the-fly generated harnesses.
- Explicit evidence: He compares it to plan mode on steroids.
- Explicit evidence: The agent would create an actual harness before doing the work, aware of where it might hallucinate.

#### Why It Matters

Static harnesses cannot cover every future task. Dynamic harness generation could let agents construct temporary safety and validation scaffolding before execution.

#### Implementation Opportunities

- Add a "build harness first" phase for high-risk workflows.
- Require generated harnesses to declare tools, context, guardrails, verifier, recovery handlers, and approval points.
- Validate the generated harness before using it.

#### Risks / Tradeoffs

- Low confidence: generated harnesses can encode false assumptions.
- The harness itself needs review and verification.
- Dynamic harnessing may add too much latency for simple tasks.

## Tooling & Ecosystem

### Agent Harness Components

#### Tool Registry

- Purpose: Expose controlled model-callable actions.
- Workflow role: Defines capabilities such as filesystem read/write, bash execution, browser actions, and custom domain tools.
- Integration opportunities: Schema validation, side-effect classification, trace logging, permission gates.
- Implied best practices: Every tool should have a name, description, parameters, and execute function.
- Strengths: Makes capabilities explicit and inspectable.
- Limitations: Bad tool descriptions or broad tools can undermine control.

#### Model

- Purpose: Fuzzy reasoning and action selection.
- Workflow role: Chooses tools, interprets context, and proposes next actions.
- Integration opportunities: Model selection by task risk, fallback routing, cost-aware execution.
- Implied best practices: Treat the model as rented and black-box; verify externally.
- Strengths: Flexible reasoning.
- Limitations: Nondeterministic, opaque, context-limited, provider-controlled.

#### Context Manager

- Purpose: Shape what the agent sees and preserve useful state.
- Workflow role: Maintains system prompt, user task, recent messages, and compressed context.
- Integration opportunities: Context budgets, compaction traces, retrieval, memory summaries.
- Implied best practices: Context management belongs to the harness, not ad hoc prompting.
- Strengths: Prevents runaway context growth.
- Limitations: Naive compression can erase important state.

#### Guardrails

- Purpose: Bound execution.
- Workflow role: Enforce max steps, max messages, max attempts, and stop conditions.
- Integration opportunities: Step budgets, wall-clock budgets, token budgets, tool-specific limits.
- Implied best practices: Guardrail triggers should be recorded as structured events.
- Strengths: Prevents runaway loops and token waste.
- Limitations: Requires careful tuning.

#### Agent Loop

- Purpose: Repeated model/tool/context cycle.
- Workflow role: Runs until model stop, guardrail stop, or harness stop.
- Integration opportunities: Event tracing, tool dispatch, policy checks before/after tool calls.
- Implied best practices: Keep the loop observable and subordinate to the harness.
- Strengths: Simple core execution abstraction.
- Limitations: Not enough by itself for reliability.

#### Verify Step

- Purpose: Decide whether work actually succeeded.
- Workflow role: Checks trace history and environment state after attempts.
- Integration opportunities: CI commands, browser state checks, database assertions, API probes, code review agents.
- Implied best practices: The verifier, not the model, owns completion truth.
- Strengths: Converts model claims into testable outcomes.
- Limitations: Verification can be brittle or incomplete.

### Mentioned Agent Products And Runtimes

#### Claude Code

- Purpose: Coding agent / harnessed coding agent example.
- Workflow role: Provides model, tools, context management, guardrails, and file/bash capability.
- Integration opportunities: Compare native harness behavior against repo-specific harness layers.
- Implied best practices: Even productized coding agents should be understood as harnessed models.
- Strengths: Integrated developer workflow.
- Limitations: Still depends on external verification and scoped authority.

#### Cursor

- Purpose: Coding agent environment example.
- Workflow role: Harnessed agent with file, write, and command tools.
- Integration opportunities: Tool registry and context management pattern comparison.
- Implied best practices: IDE agents need harness controls around tool use and verification.
- Strengths: Developer-native surface.
- Limitations: Product-level harnesses may not encode repo-specific recovery.

#### Codex

- Purpose: Coding agent example.
- Workflow role: Harnessed coding agent with tool access.
- Integration opportunities: Repo-local harness should wrap Codex with verification, context routing, and recovery handlers.
- Implied best practices: Do not rely on Codex's success statement alone; validate with repo gates.
- Strengths: Strong code execution partner.
- Limitations: Needs external control plane for durable reliability.

#### OpenAI SDK

- Purpose: Tool definition/runtime schema source in the demo.
- Workflow role: Provides function/tool structure with name, description, parameters, and execute.
- Integration opportunities: Use SDK-shaped tool metadata as canonical registry schema.
- Implied best practices: Make tools typed and executable through a consistent runtime interface.
- Strengths: Familiar integration model.
- Limitations: SDK schema alone does not provide policy or verification.

#### GPT-3.5 Turbo

- Purpose: Intentionally weak/old model used in the demo.
- Workflow role: Demonstrates harness value by making a weak model complete a browser-use task.
- Integration opportunities: Benchmark harness strength using non-frontier models.
- Implied best practices: Harness quality should be evaluated independently of model strength.
- Strengths: Cheap baseline for proving control-plane leverage.
- Limitations: Lower reasoning capability; may need more deterministic support.

### Browser And Runtime Tooling

#### Playwright

- Purpose: Browser automation runtime.
- Workflow role: Opens Chromium, creates browser context/page, navigates, clicks, fills login form, and inspects page state.
- Integration opportunities: Browser-use agents, deterministic UI verification, login recovery handlers, E2E checks.
- Implied best practices: Use direct Playwright APIs for deterministic harness actions rather than model-only browser control.
- Strengths: Reliable programmable browser automation.
- Limitations: Browser state can be brittle; selectors and auth flows change.

#### Chromium

- Purpose: Browser engine launched by Playwright.
- Workflow role: Executes the Hacker News interaction in a real browser.
- Integration opportunities: E2E testing and browser-use agent verification.
- Implied best practices: Verify real UI state when the task is UI-facing.
- Strengths: Realistic browser runtime.
- Limitations: Requires environment setup and can be slow/flaky.

#### Hacker News

- Purpose: External target application in the demo.
- Workflow role: Task environment for upvoting first post.
- Integration opportunities: Demonstrates login redirect recovery, browser trace verification, and external state check.
- Implied best practices: External web tasks need auth and postcondition handling.
- Strengths: Simple real-world browser target.
- Limitations: External service state and login rules are outside harness control.

#### npm

- Purpose: Demo command runner.
- Workflow role: Runs the agent via npm run agent.
- Integration opportunities: Agent harness tasks should have repeatable command entrypoints.
- Implied best practices: Provide simple reproducible commands for harness runs.
- Strengths: Familiar developer workflow.
- Limitations: Command success alone does not prove task success.

#### Bash

- Purpose: Tool capability in coding agents.
- Workflow role: Allows agents to execute shell commands.
- Integration opportunities: Validation gates, setup checks, filesystem inspection.
- Implied best practices: Bash access should be traced, scoped, and verified.
- Strengths: Powerful universal interface.
- Limitations: High-risk side effects without sandboxing.

### Enterprise And RAG Tooling

#### Open RAG

- Purpose: IBM open-source enterprise RAG project.
- Workflow role: Harnessed retrieval system for sensitive enterprise data.
- Integration opportunities: Secure retrieval, policy gates, source isolation, audit logging.
- Implied best practices: RAG over private data requires enterprise security harnessing.
- Strengths: Grounding over internal sources.
- Limitations: Needs rigorous access control and data leakage prevention.

#### RAG

- Purpose: Retrieval-augmented generation over enterprise content.
- Workflow role: Lets users ask questions over teams, calls, PDFs, invoices, and siloed data.
- Integration opportunities: Permissions-aware retrievers, citations, answer verification, data-source policy.
- Implied best practices: Retrieval and generation should be constrained by a harness.
- Strengths: Connects models to organization knowledge.
- Limitations: Security, freshness, and provenance risks.

## Harness Engineering Insights

### Orchestration

- Explicit evidence: The harness wraps the agent loop with attempts, guardrails, verification, and recovery.
- Inferred insight: Orchestration should be a thin deterministic control layer around model-driven actions.
- Implementation pattern: harness.run(task, tools, context, guardrails, verifier, recoveryHandlers) returns structured status.

### Validation

- Explicit evidence: The initial agent claimed success without verifying; verification caught the false success.
- Inferred insight: Validation must be external to the model and based on trace/environment state.
- Implementation pattern: verifier(trace, environment) produces pass, fail, retryable, blocked, and evidence.

### Context

- Explicit evidence: The harness manages context and compacts messages when max messages is exceeded.
- Inferred insight: Context compression must be traceable and policy-driven.
- Implementation pattern: context events record kept messages, trimmed messages, reason, and risk.

### Routing

- Explicit evidence: Tool registry provides model-callable actions, and login recovery runs outside the model.
- Inferred insight: Routing decisions should decide whether a need belongs to the model, a tool, a verifier, or a deterministic handler.
- Implementation pattern: classify failure as model-action, tool-action, recovery-handler, human-approval, or blocked.

### Memory

- Explicit evidence: The trace list records event history across the loop.
- Inferred insight: Runtime memory for agents should be event-sourced rather than only conversational.
- Implementation pattern: append-only trace with model messages, tool calls, context compactions, verifier outcomes, recovery events, and final status.

### Evals

- Explicit evidence: Tejas distinguishes ML harnesses as test suites and agent harnesses as grounding systems.
- Inferred insight: Agent evals should measure loop reliability, recovery, verification, and honesty, not only model output quality.
- Implementation pattern: eval scenarios where the model is tempted to claim success after partial action.

### Governance

- Explicit evidence: Secrets can be injected from the harness and not exposed in prompts.
- Inferred insight: Sensitive authority belongs in deterministic runtime handlers, not model-visible context.
- Implementation pattern: secret-bearing handlers emit redacted trace events and require policy approval.

### Scaling

- Explicit evidence: Tejas argues harnesses run the world and enable doing more with less.
- Inferred insight: Scaling agent systems means scaling reliable harness primitives, not just scaling token spend.
- Implementation pattern: shared library of reusable guardrails, verifiers, context managers, and recovery handlers.

### Recovery

- Explicit evidence: The login handler recognizes login pages, injects credentials, submits, and informs the agent.
- Inferred insight: Recovery handlers should be triggered by environment state, not model panic.
- Implementation pattern: knownFailureDetector -> deterministicRecovery -> traceEvent -> resumeMessage -> verify.

## Implied Best Practices

- Treat model outputs as untrusted until verified.
- Use a fixed prompt when testing harness changes.
- Prefer deterministic handlers over adding secrets to prompts.
- Log every meaningful event in the agent loop.
- Keep completion authority outside the model.
- Add guardrails for steps, messages, attempts, and context size.
- Classify failure honestly before trying to recover.
- Use traces to debug why the agent failed.
- Keep the agent loop simple and wrap it with a stronger harness loop.
- Expose tools through typed registries.
- Scope dangerous tools and record side effects.
- Keep secrets in runtime environment variables or secret stores, not context.
- Design verifiers around environmental postconditions.
- Treat context compaction as a lossy operation requiring metadata.
- Use cheap models to test whether the harness actually adds reliability.
- Build recovery handlers for repeated known environmental problems.
- Make recovery handlers visible to the agent through concise status messages.
- Use browser automation for browser-state verification.
- Separate ML eval harnesses from agent execution harnesses.
- Treat dynamic harness generation as future-facing and high-risk until validated.

## Failure Modes & Mitigations

### Failure: Model Claims Success Without Evidence

- Description: The agent reports task completion even though the environment shows the task failed.
- Evidence: The demo agent clicked upvote, hit a login page, and still claimed success.
- Probable root cause: Completion authority remained with the model and no verifier checked the trace.
- Severity: Critical.
- Mitigation strategy: Add deterministic verification over trace and environment state.
- Recommended guardrails: Claim-vs-trace verifier, required postcondition checks, fail-closed status when verifier is absent.

### Failure: Prompt-Harder Reflex

- Description: Developers respond to failures by adding more prompt instructions rather than building deterministic controls.
- Evidence: Tejas explicitly rejects changing the prompt or system prompt in the demo.
- Probable root cause: Prompt edits are cheaper than harness engineering in the short term.
- Severity: High.
- Mitigation strategy: Require a harness feasibility check before adding repeated prompt rules.
- Recommended guardrails: Repeated-instruction detector, prompt-growth review, deterministic-handler alternative assessment.

### Failure: Secret Leakage Through Prompts

- Description: Credentials or tokens are placed in model-visible instructions.
- Evidence: Tejas rejects "always login with these credentials included in the system prompt" and moves login into a handler.
- Probable root cause: Model is asked to perform environment recovery directly.
- Severity: Critical.
- Mitigation strategy: Keep secrets inside runtime handlers and inject state deterministically.
- Recommended guardrails: Secret scanner for prompts, redacted handler traces, no-secret-in-context policy.

### Failure: Unbounded Agent Loop

- Description: The agent keeps taking steps, accumulating messages, and spending tokens without useful progress.
- Evidence: Guardrails include max iterations and max messages; max attempts bounds the outer loop.
- Probable root cause: No hard execution budget.
- Severity: High.
- Mitigation strategy: Add explicit step, message, token, wall-clock, and attempt budgets.
- Recommended guardrails: Guardrail events, stop reasons, budget dashboards, per-task defaults.

### Failure: Naive Context Compression

- Description: Context trimming drops important facts, causing bad downstream decisions.
- Evidence: Tejas describes a naive compressor that keeps only the system prompt, user prompt, and most recent two messages, and warns not to use it as-is.
- Probable root cause: Simple context-size management without semantic preservation.
- Severity: Medium.
- Mitigation strategy: Use summarization, retrieval, and trace-linked compaction policies.
- Recommended guardrails: Compaction metadata, retained-fact checks, high-risk no-trim zones.

### Failure: Tool Registry Overexposure

- Description: The model receives too many or too-powerful tools without adequate scope.
- Evidence: Harnessed coding agents expose filesystem read/write and bash tools.
- Probable root cause: Capability exposure is treated as convenience rather than authority.
- Severity: High.
- Mitigation strategy: Classify tool side effects and restrict dangerous tools.
- Recommended guardrails: Tool permission tiers, sandboxing, audit trace, approval gates for destructive actions.

### Failure: Recovery Handler Hides Real Failure

- Description: Deterministic handlers patch around environmental problems that should be visible to users or fixed upstream.
- Evidence: The login handler silently recovers login redirects and resumes the agent.
- Probable root cause: Recovery is optimized for task success without enough classification.
- Severity: Medium.
- Mitigation strategy: Emit explicit recovery events and distinguish expected recovery from abnormal failure.
- Recommended guardrails: Recovery budget, recovery reason codes, user-visible summary for privileged recovery.

### Failure: Verifier Too Narrow

- Description: The verifier checks for a specific signal but misses semantic failure.
- Evidence: verifySuccessfulUpvote checks trace and login redirect state for one task-specific outcome.
- Probable root cause: Deterministic verifiers are often handcrafted around known failures.
- Severity: Medium to High.
- Mitigation strategy: Combine deterministic checks, semantic checks, and task-specific acceptance criteria.
- Recommended guardrails: Verifier coverage tests, negative cases, adversarial evals.

### Failure: Trace Privacy Leak

- Description: Event traces capture credentials, tokens, user data, or sensitive page content.
- Evidence: The login handler can access credentials and trace events are central to verification.
- Probable root cause: Observability added without privacy boundaries.
- Severity: Critical.
- Mitigation strategy: Redact sensitive event fields and separate secret-bearing operations from model-visible traces.
- Recommended guardrails: Trace schema with redaction, secret scanners, retention policy, access controls.

### Failure: Harness State Machine Sprawl

- Description: Every known failure becomes bespoke code, creating a brittle hidden orchestration layer.
- Evidence: The demo adds special cases for failed login and unrecovered login redirect.
- Probable root cause: Deterministic recovery is added incrementally without abstraction.
- Severity: Medium.
- Mitigation strategy: Generalize recurring handlers into typed recovery patterns.
- Recommended guardrails: Handler registry, owner, tests, applicability conditions, retirement criteria.

### Failure: Cheap Model Overconfidence

- Description: Teams assume a strong harness makes weak models safe for all tasks.
- Evidence: The demo succeeds with GPT-3.5 Turbo, but only on a narrow browser task with a purpose-built harness.
- Probable root cause: Extrapolating from bounded demo success.
- Severity: Medium.
- Mitigation strategy: Benchmark by task type and risk tier.
- Recommended guardrails: Model capability matrix, escalation rules, high-risk model floor.

### Failure: Dynamic Harness Self-Approval

- Description: A model generates a harness for itself and then trusts it without independent review.
- Evidence: Tejas speculates about agents creating dynamic on-the-fly harnesses before tasks.
- Probable root cause: Collapsing planner, harness author, executor, and validator into one unverified agent.
- Severity: High.
- Mitigation strategy: Independently validate generated harnesses before execution.
- Recommended guardrails: Harness schema checks, separate verifier, human approval for high-risk generated harnesses.

### Failure: Confusing ML Eval Harness With Agent Harness

- Description: Teams believe a model test suite is enough to make an agent reliable in an environment.
- Evidence: Tejas distinguishes ML harnesses as test suites/test runners from agent harnesses as grounding around the model.
- Probable root cause: Same term used across ML and AI engineering with different meanings.
- Severity: Medium.
- Mitigation strategy: Use precise vocabulary and document which harness layer is being discussed.
- Recommended guardrails: Glossary, architecture docs separating eval harness, agent harness, product harness, and runtime harness.

## Reusable Techniques

### Technique: Minimal Agent Harness Skeleton

Implement:

- Model adapter.
- Tool registry.
- Context object.
- Agent loop.
- Trace event list.
- Guardrail checks.
- Harness attempt loop.
- Verifier.
- Recovery handler registry.
- Final structured status.

### Technique: Claim-Vs-Trace Verification

For every "done" claim:

- Inspect relevant tool calls.
- Inspect final environment state.
- Check for known failure signatures.
- Return pass, fail, retryable, or blocked.
- Include evidence fields in the result.

### Technique: Prompt-Invariant Failure Fix

When an agent fails:

- Freeze the prompt.
- Reproduce the failure.
- Add tracing if missing.
- Add deterministic verification.
- Add recovery only for known environmental failures.
- Rerun with the same prompt.
- Attribute improvement to harness changes only if the fixed prompt remains unchanged.

### Technique: Recovery Handler Contract

Each handler declares:

- Trigger condition.
- Required authority.
- Secret access.
- Deterministic action.
- Agent-visible resume message.
- Trace event schema.
- Verification impact.
- Failure behavior.

### Technique: Guardrail Metadata

Record:

- Max iterations.
- Max messages.
- Max attempts.
- Context size before and after compaction.
- Stop reason.
- Retry reason.
- Guardrail triggered.

### Technique: Secure Login Handler Pattern

Use for browser agents:

- Detect login URL or form state.
- Retrieve credentials from secret store or env.
- Fill and submit via Playwright.
- Record redacted recovery event.
- Push concise "logged in, continue" message.
- Verify post-login URL or session state.

### Technique: Harness Fitness Eval

Evaluate harnesses by running scenarios where:

- The model claims success after a partial action.
- The target redirects to login.
- Context grows beyond budget.
- A tool fails with recoverable error.
- A secret is required but must not enter context.
- The model loops without progress.

### Technique: Dynamic Harness Draft Template

Before risky work, generate but do not yet trust:

- Task goal.
- Allowed tools.
- Context sources.
- Guardrails.
- Stop conditions.
- Verification signals.
- Recovery handlers.
- Approval points.
- Failure classifications.

### Technique: Harness Handler Registry

Maintain handlers for:

- Login redirect.
- Missing dependency.
- Stale session.
- Expired token.
- Rate limit.
- Network retry.
- Test flake.
- Sandbox permission.
- Broken local setup.

### Technique: Harness Vocabulary Split

Use distinct terms:

- ML eval harness: test suite for model outputs.
- Agent execution harness: tools, context, guardrails, loop, verifier.
- Product harness: repo/runtime system that makes agents useful.
- Dynamic harness: task-specific temporary control plane.

## Strategic Insights

- Agent reliability will increasingly come from harness design, not only model selection.
- The most important harness boundary is between fuzzy model action and deterministic environment truth.
- Prompt growth is a smell when deterministic verification or recovery is feasible.
- Trace history is the substrate for debugging, verification, retry, and governance.
- Secure recovery handlers are a major enterprise differentiator because they let agents operate without exposing secrets.
- Cheap models become more useful as harnesses become stronger, changing cost/performance tradeoffs.
- Dynamic harness generation is a plausible next step, but it creates new validation and governance problems.
- The future agent platform is likely a library of reusable harness primitives: tools, guardrails, verifiers, context managers, recovery handlers, and trace schemas.
- The best harnesses will make failure honest before making success possible.
- Harness engineering should optimize for controlled capability, not maximum model freedom.

## Key Quotes & Evidence

- "The name of the game with harness is reliability."
- "The model you rent is a black box."
- "The agent harness is everything around the model that gives it grounding in reality."
- "Claude code, cursor, codex ... have tools to read from the file system, to write, to execute bash commands."
- "Almost every harnessed agent runtime today will compact its own context."
- "Guardrails are another part of a harness."
- "Isn't a harness just the agent loop? No, it's the stuff around the agent loop."
- "Finally, there's a verify step."
- "We're using GPT-3.5 Turbo ... but we're going to harness it so that it can actually do the job."
- "For the purpose of this demo, we will not change the prompt at all."
- "Prompt it harder? No."
- "It doesn't verify. This is the job of a harness."
- "We just push history into a big list of history."
- "Max iterations ... if you do more than six steps, I'mma kill you."
- "Max messages ... if you have more than this many messages, I will compress the context."
- "We run harness and we added a third argument here, which is a verify step and max attempts."
- "This is deterministic. That's what I want to show you."
- "It's still failed, but look, it stopped lying."
- "The harness checks the tool history and actually sees what happened."
- "Step one to solving a problem is admitting you have one."
- "We fill in credentials and submit the button programmatically from the harness, not from the agent, deterministically and securely."
- "I did not touch the prompt once. I did not change the system prompt. We just built a harness and the outcome radically changed."
- "With a great harness, you can go very far."
- "2027 was the year of dynamic on-the-fly generated harnesses."

## Final Assessment

### Strongest Ideas

- Harnesses ground black-box models in stable reality.
- The verifier, not the model, owns truth.
- Trace history is the evidence substrate.
- Known environmental recovery should be deterministic and harness-owned.
- Prompt-invariant demos cleanly prove harness value.
- Cheap models can be more useful when wrapped in strong control planes.

### Weakest Areas

- The demo verifier is narrow and handcrafted for one Hacker News task.
- Context compression is explicitly naive.
- Dynamic harness generation is speculative and under-governed.
- Security claims around enterprise RAG are high-level, not deeply evidenced.
- Handler sprawl is not addressed as the harness grows.

### Most Reusable Concepts

- Tool registry plus trace plus verifier.
- Outer harness loop around inner agent loop.
- Claim-vs-trace validation.
- Deterministic login recovery.
- Prompt-invariant harness improvement.
- Guardrail-trigger metadata.
- Handler registry for known environment failures.

### Highest Leverage Opportunities

- Add a reusable harness-run trace schema to agent workflows.
- Build verifiers that compare agent claims with actual command/browser/file state.
- Convert repeated setup/auth/environment failures into recovery handlers.
- Add no-secret-in-prompt checks for agent instructions.
- Build eval scenarios where the model is tempted to lie about success.
- Separate prompt changes from harness changes in failure investigations.

### Most Important Risks

- Trusting model self-reports.
- Exposing secrets to model context.
- Naive context trimming.
- Unbounded retries or loops.
- Narrow handcrafted verifiers.
- Recovery handlers hiding real failures.
- Dynamic harnesses approving themselves.

### Immediate Implementation Candidates

- Define a .harness trace-event schema for model messages, tool calls, guardrails, verification, and recovery.
- Add a claim-vs-evidence closeout rule for agent-completed tasks.
- Create a deterministic recovery-handler interface for repeated environment failures.
- Add a prompt-growth smell checklist: can this be a verifier, guardrail, or handler instead?
- Build a minimal harness fitness eval suite with login redirect, false success, context compaction, and secret-required scenarios.
- Add a glossary separating ML eval harness, agent execution harness, Coding Harness product surface, and dynamic harness.
