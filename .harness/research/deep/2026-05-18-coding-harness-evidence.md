# Coding Harness Evidence Consolidation

Generated: 2026-05-18

Consolidates:

- .harness/research/deep/2026-05-18-ryan-lopopolo-evidence.md
- .harness/research/deep/2026-05-18-praveen-govindaraj-evidence.md
- .harness/research/deep/2026-05-18-tejas-evidence.md

Purpose:

- Remove duplicated framing across the three deep research documents.
- Preserve all distinct facts, source claims, and implementation signals.
- Convert person-level extraction into a single Coding Harness evidence base.
- Keep attribution clear enough that future agents can trace ideas back to the source speaker.

## Source Boundary

### Ryan Lopopolo

Primary source:

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/ryan-lopopolo-extreme-harness-engineering.md

Supporting sources:

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/ryan-lopopolo-transcript-source.txt
- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/CeOXx-XTYek - Extreme Harness Engineering 1M LOC 1B toksday 0 human code or review Ryan Lopopolo OpenAI.txt
- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/am_oeAoUhew - Harness Engineering How to Build Software When Humans Steer Agents Execute Ryan Lopopolo O.txt
- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/manifest.json

Boundary:

- Use Ryan for large-scale operating model, repo-as-agent-OS, attention economics, skill density, PR lifecycle delegation, observability, review protocol, and on-policy guardrails.
- Treat curated extraction details as transcript-backed unless otherwise labeled in the source document.

### Praveen Govindaraj

Primary source:

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/d96Nr7bmU0o - Harness Engineering Designing Systems Where Codex Agents Build the Future.txt

Supporting sources:

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/manifest.json
- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/metadata/d96Nr7bmU0o.json
- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/raw/d96Nr7bmU0o/d96Nr7bmU0o.info.json

Boundary:

- Use Praveen for compressed environment-first framing: repository as single source of truth, static plus dynamic context, mechanical architecture enforcement, entropy control, and humans as system designers.
- Treat details about OpenAI internal experiments as transcript-level evidence unless cross-checked against the original OpenAI article.

### Tejas Kumar

Primary source:

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/youtube-transcripts-harness.md

Transcript segment:

- Harnesses in AI: A Deep Dive - Tejas Kumar, IBM
- Source URL recorded in transcript: https://youtu.be/C_GG5g38vLU
- Retrieval note recorded in transcript: video-transcript-downloader wrapper, clean paragraph transcript

Supporting sources:

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/README.md
- .harness/review/2026-05-18-tejas-harness-coding-harness-alignment.md

Boundary:

- Use Tejas for runtime harness mechanics: model as black box, tool registry, context manager, guardrails, agent loop, outer harness loop, trace history, verifier, retry budget, recovery handlers, and prompt-invariant improvement.
- The Tejas alignment review is a locator/context clue only; claims are grounded in the transcript unless labeled otherwise.

## Evidence Labels

- Explicit evidence: directly stated in one of the source transcripts or source-backed extraction documents.
- Inferred insight: derived from repeated behaviors, examples, tooling choices, or operational implications.
- Speculative interpretation: plausible application beyond the source evidence; validate before adopting.

## Confidence Labels

- High confidence: directly supported by a transcript or repeated across sources.
- Medium confidence: source-supported but translated into implementation practice.
- Low confidence: useful extrapolation beyond the transcript.

## Executive Summary

The three evidence documents converge on one durable thesis: coding harnesses are not bigger prompts. They are engineered environments that let AI agents act, observe, verify, recover, learn, and ship with less synchronous human attention. Ryan provides the operating-model evidence, Praveen compresses the repo-as-control-plane principle, and Tejas demonstrates the runtime loop that turns a lying browser agent into an honest, recoverable system without changing the prompt.

The consolidated architecture is layered:

- Repository control plane: docs, specs, ADRs, style guides, instruction files, directory structure, validators, CI, PRs, and maintenance agents.
- Runtime execution harness: model, tool registry, context manager, agent loop, trace history, guardrails, verifier, retry policy, and recovery handlers.
- Feedback and learning loop: PR comments, failed builds, discarded runs, pages, traces, review comments, and human corrections become durable improvements to docs, tests, lints, skills, scripts, observability, or rules.
- Governance layer: identity, authorization, revocation, approval matrices, blast-radius gating, secrets handling, audit logs, and human checkpoints for high-risk actions.

The strongest shared invariant is that model claims are not proof. Ryan treats failed builds, PR comments, and discarded runs as missing-context telemetry. Praveen argues that architecture rules must be enforced mechanically through linters, structural tests, and CI. Tejas shows the runtime version: the agent clicked upvote, hit a login screen, and claimed success; the harness became useful only when it checked trace and browser state, failed honestly, then recovered through a deterministic login handler.

The central operational bet is that human attention is the scarce resource, not tokens or generated code. That does not mean removing humans. It means moving humans to higher-leverage control points: architecture, intent, evaluation criteria, approval of high-blast-radius actions, exception handling, and governance. Everything repeatable should become context, validation, tooling, recovery, or memory.

The main danger is context and control-plane sprawl. If every incident becomes a global rule, every tool is exposed directly, every transcript enters hot-path context, or every failure gets bespoke recovery code, the harness becomes harder to reason about than the work it was meant to control. Compression, routing, mechanical enforcement, source attribution, and retirement criteria are therefore first-class harness requirements.

## Consolidated Source Facts

### Ryan Lopopolo Facts

- Ryan began with a constraint that he could not write product code himself; the agent had to do it.
- The work is framed as five months of zero human-written code over a codebase of more than one million lines.
- The first month and a half was slower than Ryan working directly because the team was building the agent's assembly station.
- Ryan describes double-clicking into tasks the model cannot solve, building smaller blocks, then reassembling the original objective.
- Human synchronous attention is treated as the scarce resource; models are trivially parallelizable by comparison.
- Human review moved mostly post-merge once the system had sufficient confidence.
- Build speed became agent infrastructure; the build system was retooled to complete in under a minute after Codex background-shell behavior changed agent behavior.
- Build-time breaches trigger decomposition of the build graph.
- Tooling moved through Makefile, Bazel, Turbo, and NX until the build loop was fast enough.
- Models are described as craving text.
- Repo text surfaces included core-beliefs.md, spec.md, tech-debt trackers, quality scores, reliability documentation, workflow docs, and AGENTS.md-style files.
- A missing network timeout should become both a code fix and a reliability documentation update requiring timeouts.
- PR comments and failed builds are learning signals.
- In Symphony rework, a bad PR/worktree can be discarded, then the system asks why the work was trashed and improves the harness.
- Observability surfaces include vector, log, metrics APIs, local observability, Grafana/dashboard JSON, and trace access.
- Environment setup can be inverted: spawn Codex first, then let Codex use skills/scripts to boot the stack and configure environment variables.
- Their codebase had about six skills, and the team poured engineer taste into those skills.
- Author agents should not be bullied by reviewer feedback; they can accept, defer, or push back.
- Reviewer agents were biased toward merge and discouraged from making low-severity issues blockers.
- A land skill can coach Codex through push, review wait, CI, flake repair, upstream merge, merge queue, and final merge.
- Code is disposable; bad outputs can be thrown away cheaply, but the failure should teach the system.
- Symphony is described as distributable as a spec or ghost library that agents can reassemble locally.
- A proprietary repo was used as reference; Codex wrote a spec; tmux agents implemented and reviewed it; the spec was updated to reduce divergence.
- Ryan prefers native guardrails in code, tests, docs, lints, and scripts over an external Rust scaffold around Codex that would fight the model and risk being scrapped.
- Ryan and the interviewer map this to on-policy versus off-policy harnessing.
- Worktree-per-agent is the concurrency primitive implied by multi-agent code work.
- Ryan names or implies Codex, Codex CLI, Codex app, Codex Security, Codex skills, GPT-5.x models, GPT-5.3 Spark, ChatGPT, GPT OSS safeguard model, Git worktrees, GitHub, GitHub CLI, merge queue, tmux, Makefile, Bazel, Turbo, NX, PNPM/NPM, ESLint/Prettier, CI, Grafana/dashboard JSON, Prometheus/VictoriaMetrics-style binaries, Jaeger/tracing, DataDog, blob/object storage, Linear/Jira/Bitbucket, Slack, IAM/GRC/security tooling, OpenAI Frontier, and OpenAI Agents SDK.
- Enterprise deployment needs identity, authorization, revocation, observability, governance dashboards, GRC integration, and safety specs.
- Native app distribution still required a blessed human smoke test.
- MCP can inject too much tool context and interfere with compaction.
- Raw transcripts should remain source evidence, not hot-path doctrine.
- Frontier-style deployment includes the ability to steer and revoke authorization if a model becomes misaligned.
- Internalizing a small dependency can improve agent legibility or customization, but loses upstream battle-testing and requires rebuilt confidence.
- Ryan says models are not yet ready to take a completely new product idea and prototype it in one shot; white-space projects still need synchronous human interaction.

### Praveen Govindaraj Facts

- Praveen presents harness engineering as humans designing the environment where AI writes code.
- He defines it as engineering the environment where engineering happens.
- Humans gave instructions, design documents, constraints, and feedback instead of writing code.
- AI agents can only reason with information available to them.
- If something is not in context, from the agent's perspective it does not exist.
- OpenAI structured the repository to act as a single source of truth.
- The repo stored architecture documents, API specifications, design decisions, style guides, and agent instruction files.
- Directory structure itself provided clues to agents.
- Static context includes architecture documents, API specifications, design decisions, style guides, and agent instruction files.
- Dynamic context includes logs, metrics, traces, CI test results, and system telemetry.
- Dynamic context allowed agents to observe the system, reproduce bugs, and propose fixes.
- AI agents need explicit rules where humans might rely on judgment.
- Strict dependency layers are described: types, config, repository, service, runtime.
- Each layer could depend only on layers before it.
- Violations were mechanically enforced using linters, structural tests, and CI validation.
- If an AI agent violated architecture rules, the system automatically rejected the change.
- OpenAI created agents that maintain the codebase itself.
- Maintenance agents scan for outdated documentation, broken architecture rules, and inconsistencies between code and specs.
- When something looks wrong, maintenance agents open pull requests with proposed fixes.
- Agents can reproduce bugs automatically using logs and traces.
- Agents generate patches and run tests without human intervention.
- The bottleneck is no longer typing code; it is human attention.
- The goal becomes detecting problems quickly and letting agents fix them automatically.
- Developers shift from writing code to designing systems and feedback loops that guide agents.
- Engineers define architecture, evaluation criteria, and safeguards.
- The system fights entropy through documentation, tests, CI/CD, monitoring, and maintenance agents.
- The transcript acknowledges uncertainty about long-term architectural stability and human oversight.
- Praveen names or implies Codex, AI agents, large language models, repository single source of truth, directory structure, architecture documents, API specifications, design decisions, style guides, agent instruction files, logs, metrics, traces, system telemetry, tests, CI/CD pipelines, linters, structural tests, and pull requests.
- Autonomous changes remain reviewable through pull requests rather than silently mutating production.
- Source compression is a risk: the video is a short explainer compressing Ryan's article, so operational claims should be treated at transcript confidence unless cross-checked.

### Tejas Kumar Facts

- Tejas works at IBM and frames the talk around AI harnesses.
- He distinguishes ML harnesses as model test suites/test runners from AI engineering agent harnesses.
- He defines an agent harness as everything around the model that gives it grounding in reality and ties it to a stable environment.
- He says most builders rent compute, inference, and tokens from model providers.
- The rented model is a black box and provider routing could differ from expectations.
- The name of the game with harnesses is reliability.
- Typical harness components include tool registry, model, context manager/compaction, guardrails, agent loop, and verify step.
- Claude Code, Cursor, and Codex are examples of harnessed coding agents with filesystem read/write and bash tools.
- The demo builds a poor man's browser-use/computer-use harness.
- The task is to go to Hacker News and upvote the first post.
- The demo intentionally uses GPT-3.5 Turbo, described as an old/bad model, to show that a strong harness can make a weaker model useful.
- Playwright is used to launch Chromium, create browser context/page, navigate, click, fill login, and inspect state.
- The demo uses an OpenAI SDK-style tool shape: name, description, parameters, and execute.
- Tejas keeps the prompt/system prompt unchanged.
- He rejects solving the failure by prompting harder or putting credentials into the system prompt.
- The basic loop pushes events into a trace/history list.
- The first run clicks upvote, reaches a login screen, panics or crashes, and claims success.
- Tejas says the failure is that it does not verify; verification is the job of a harness.
- Guardrails include max iterations, max messages, context compression, and max attempts.
- The naive context compressor keeps the system prompt, user prompt, and most recent two messages, and Tejas warns not to use it as-is.
- Logic is moved into runHarness and runHarnessAttempt.
- The outer harness loop runs no more than three attempts.
- verifySuccessfulUpvote deterministically inspects trace/tool history and browser/page state: click events, successful upvote, failed login, unrecovered login redirect, and page URL.
- After adding verification, the run still fails, but it stops lying.
- A deterministic login handler checks current URL, detects login page, fills credentials, and submits programmatically from the harness.
- Credentials can come from environment variables and stay secure.
- The harness pushes a resume message into the queue telling the agent it logged in and can continue.
- The final successful outcome is attributed to harness changes, not prompt changes.
- IBM's Open RAG is described as an open-source project deployed in enterprise/private data-sensitive environments.
- Open RAG supports RAG over Teams, calls, PDFs, invoices, and siloed internal data.
- Tejas says Open RAG has a strong harness that provides enterprise-level security.
- Tejas speculates that 2025 is the year of agents, 2026 the year of harnesses, and 2027 the year of dynamic on-the-fly generated harnesses.
- Dynamic harness generation is compared to plan mode on steroids: the agent creates a harness before work, aware of where it might hallucinate.
- Tejas names or implies tool registry, model, context manager, guardrails, agent loop, verify step, Claude Code, Cursor, Codex, OpenAI SDK, GPT-3.5 Turbo, Playwright, Chromium, Hacker News, npm, Bash, Open RAG, and RAG.

## Core Engineering Patterns

### Pattern: Environment As Product Surface

Description:

The primary engineering object is the environment in which agents operate: repository structure, docs, instructions, tools, tests, CI, telemetry, approvals, and runtime guardrails.

Evidence:

- Ryan: zero-human-code forced the team to build an assembly station for agents.
- Praveen: harness engineering is designing the environment where AI writes code.
- Tejas: agent harness is everything around the model that grounds it in reality.

Why it matters:

Agent output quality is bounded by the environment. Weak context, slow validation, missing tools, and unclear authority produce bad work even with strong models.

Implementation opportunities:

- Treat repo setup, context maps, validation scripts, trace schemas, and instruction files as product code.
- Review harness surfaces with the same seriousness as runtime source.
- Track environment defects as first-class bug categories.

Risks / tradeoffs:

- High upfront harness cost.
- Can become architecture theater if not tied to observable agent failures.
- Environment complexity can outgrow agent comprehension.

### Pattern: Human Attention Budgeting

Description:

Design workflows to conserve scarce synchronous human attention while preserving human authority at high-leverage control points.

Evidence:

- Ryan: synchronous human attention is the fundamentally scarce resource.
- Praveen: the bottleneck is no longer typing code; it is human attention.
- Ryan: human review moved mostly post-merge after confidence improved.
- Ryan: native app distribution still required a blessed human smoke test.

Why it matters:

The value of agents is not just code volume. It is reducing repeated human babysitting while keeping humans on architecture, product judgment, approvals, and exceptions.

Implementation opportunities:

- Track interventions by category: missing context, missing primitive, missing validation, unclear authority, tool failure, flaky gate, product ambiguity.
- Convert repeated interventions into docs, tests, lints, skills, scripts, or recovery handlers.
- Keep approval matrices for release, security, credentials, production data, and policy changes.

Risks / tradeoffs:

- Reducing attention too aggressively can hide slow-moving risk.
- Post-merge review requires rollback, observability, and blast-radius discipline.
- Human skill can decay if oversight becomes ceremonial.

### Pattern: Repository As Agent Operating System

Description:

The repo is the durable control plane for agents: code plus architecture docs, API specs, design decisions, style guides, instruction files, directory semantics, validators, tests, and memory surfaces.

Evidence:

- Ryan: models crave text; core-beliefs.md, spec.md, tech-debt trackers, quality scores, reliability docs, workflow docs, and AGENTS.md-style files guide agents.
- Praveen: OpenAI structured the repository as a single source of truth.
- Praveen: architecture docs, API specs, design decisions, style guides, instruction files, and directory structure guide execution.

Why it matters:

Agents cannot follow hidden preferences. If a rule is not discoverable, linked, and current, it is operationally absent.

Implementation opportunities:

- Maintain an agent-readable instruction map.
- Keep ADRs, specs, style guides, and architecture documents close to governed code.
- Add stale-link and docs-code drift checks.
- Encode directory semantics into route manifests or ownership metadata.

Risks / tradeoffs:

- Repo context can become noisy.
- Stale text becomes harmful context.
- Directory conventions remain fragile unless mechanically validated.

### Pattern: Static Context Plus Dynamic Evidence

Description:

Pair durable design intent with live operational evidence. Agents need to know both what should be true and what is currently happening.

Evidence:

- Praveen: static context includes docs, specs, design decisions, style guides, and instructions.
- Praveen: dynamic context includes logs, metrics, traces, CI results, and telemetry.
- Ryan: observability surfaces include logs, metrics APIs, dashboard JSON, traces, and local observability.
- Tejas: trace history records what the model and tools actually did.

Why it matters:

Static context prevents architectural amnesia. Dynamic evidence prevents speculative fixes and false success.

Implementation opportunities:

- Build runtime evidence bundles for bug fixes.
- Require fix plans to cite intended behavior and observed failure.
- Normalize logs, traces, metrics, command output, and CI failures into agent-readable forms.
- Keep raw telemetry out of hot-path prompts; promote distilled evidence.

Risks / tradeoffs:

- Logs and traces may contain secrets or PII.
- Dynamic evidence can be noisy or misleading.
- Too much context increases token cost and selection errors.

### Pattern: Mechanical Architecture Enforcement

Description:

Translate architecture principles into executable gates so agents cannot rely on vague judgment where invariants must hold.

Evidence:

- Praveen: agents need explicit rules where humans might rely on judgment.
- Praveen: dependency layers were types, config, repository, service, runtime; each layer could only depend on earlier layers.
- Praveen: linters, structural tests, and CI rejected architectural violations.
- Ryan: guardrails should be native to code, docs, tests, lints, and scripts.

Why it matters:

Agent-generated code can erode architecture quickly if rules stay advisory. Mechanical gates reduce review burden and preserve boundaries.

Implementation opportunities:

- Add dependency-layer tests and import-direction rules.
- Generate dependency graphs and compare them to intended topology.
- Put architecture invariants in CI.
- Make structural-test failures instructive for repair agents.

Risks / tradeoffs:

- Over-rigid layers can block legitimate evolution.
- Structural tests require maintenance.
- Agents may satisfy the letter of a rule while missing intent.

### Pattern: Runtime Harness Around The Agent Loop

Description:

Keep the inner model-tool loop subordinate to an outer harness loop that owns context, guardrails, attempts, verification, retry, and recovery.

Evidence:

- Tejas: the harness is not just the agent loop; it is the stuff around the agent loop.
- Tejas: runLoop becomes runHarnessAttempt and is wrapped by runHarness.
- Tejas: the outer loop has max attempts and a verify step.

Why it matters:

The model should choose actions, but it should not own completion truth, retry authority, context policy, or recovery semantics.

Implementation opportunities:

- Implement harness.run(task, tools, context, guardrails, verifier, recoveryHandlers).
- Emit attempt IDs, stop reasons, retry reasons, verifier results, and final status.
- Keep model loop simple, observable, and replaceable.

Risks / tradeoffs:

- Nested loops can run away without budgets.
- Retry can mask root cause.
- Too much control can reduce model flexibility.

### Pattern: Tool Registry As Authority Boundary

Description:

Expose tools through explicit, typed, auditable registries rather than unconstrained ambient capability.

Evidence:

- Tejas: tool registry is a harness component.
- Tejas: demo tools have name, description, parameters, and execute.
- Tejas: Claude Code, Cursor, and Codex expose filesystem and bash capabilities.
- Ryan: tool and MCP context can overload compaction if not scoped.

Why it matters:

Tool metadata is both capability exposure and policy surface. It determines what the model can do, how actions are logged, and what must be approved.

Implementation opportunities:

- Define tools with schemas, side-effect classes, permission tiers, and failure semantics.
- Log every tool call as a structured event.
- Wrap broad human tools in task-specific agent commands with quiet success and focused failure.
- Gate destructive tools with approval policies.

Risks / tradeoffs:

- Too many tools create routing noise.
- Broad tools can leak authority or secrets.
- Poor descriptions produce bad tool selection.

### Pattern: Trace History As Truth Surface

Description:

Record agent actions as structured trace events so verifiers, recovery handlers, reviewers, and future agents can inspect what happened.

Evidence:

- Tejas: the demo pushes history events into a trace list.
- Tejas: the verifier inspects tool history, click events, login failure, and page URL.
- Ryan: agent trajectories should be collected, inspected, and distilled into team-level knowledge.
- Praveen: traces are dynamic context for reproduction and debugging.

Why it matters:

Final model messages are unreliable. Trace history is the audit substrate for verification, recovery, debugging, governance, and learning extraction.

Implementation opportunities:

- Define trace events for model messages, tool calls, tool results, command exits, context compactions, guardrail triggers, recovery events, verifier outcomes, and final status.
- Compare claims against trace-derived facts.
- Redact sensitive fields by schema.

Risks / tradeoffs:

- Traces can leak secrets.
- High-volume traces need retention and compression policy.
- Poor schemas make verification brittle.

### Pattern: Deterministic Verification Over Model Claims

Description:

Completion truth belongs to verifiers, tests, CI, browser checks, filesystem checks, runtime state, or human review, not to the model's success statement.

Evidence:

- Tejas: the agent clicked upvote, hit login, and still claimed success.
- Tejas: after adding verification, the run still failed but stopped lying.
- Praveen: architecture violations are rejected by linters, structural tests, and CI.
- Ryan: builds, PR comments, pages, and review feedback are learning signals.

Why it matters:

Honest failure is the first reliability win. Without external verification, agents can create convincing false completion.

Implementation opportunities:

- Require every workflow to declare verification signals before autonomy expands.
- Add claim-vs-evidence checks for PRs, tests, browser actions, deployments, and file mutations.
- Fail closed when a verifier is absent, inconclusive, or blocked.

Risks / tradeoffs:

- Verifiers can be too narrow.
- Deterministic checks can miss semantic failures.
- Some work still needs human or fuzzy evaluation.

### Pattern: Failure-Driven Decomposition

Description:

When the agent cannot complete work, decompose the task into missing primitives, context, validation, tooling, or smaller work units.

Evidence:

- Ryan: double-click into tasks the model cannot solve, build smaller blocks, then reassemble.
- Ryan: build-time breaches trigger build graph decomposition.
- Praveen: repeated failures should become explicit rules, tests, or maintenance automation.
- Tejas: login failure becomes verifier plus deterministic login handler.

Why it matters:

Agent failure is a map of missing harness infrastructure.

Implementation opportunities:

- Add a decompose-on-second-failure rule.
- Classify failure as context, primitive, validation, dependency, tooling, authority, recovery, or task-shape.
- Create reusable commands or handlers when the same failure recurs.

Risks / tradeoffs:

- Can produce helper-script sprawl.
- Over-decomposition can delay product learning.
- Needs pruning and ownership.

### Pattern: Feedback Conversion Loop

Description:

Every repeated correction, PR comment, failed build, page, discarded run, or reviewer finding should either become a durable rule/guard or be explicitly rejected with rationale.

Evidence:

- Ryan: PR comments and failed builds are learning signals.
- Ryan: missing timeout becomes reliability documentation update.
- Ryan: rework asks why the work was trashed.
- Praveen: repeated human corrections indicate missing harness rules.

Why it matters:

If the same steering is paid twice, the system failed to learn.

Implementation opportunities:

- Build a feedback-admission template: signal, principle, searched siblings, durable destination, guard/test/rule, rejected exceptions, validation.
- Add missing-context fields to PR closeout.
- Run scheduled trajectory reflection over agent sessions.

Risks / tradeoffs:

- Overfitting one comment into global policy.
- Rule staleness.
- Context sprawl if all feedback becomes hot-path instructions.

### Pattern: Small Skill Set With High Taste Density

Description:

Prefer a small set of high-leverage skills containing concentrated team taste over many fragmented one-off skills.

Evidence:

- Ryan: the codebase had about six skills and engineers poured taste into them.
- Ryan: small shared skills reduce routing noise.

Why it matters:

Agents need discoverable, coherent workflows. Skill sprawl increases selection errors and context load.

Implementation opportunities:

- Audit skill overlap.
- Consolidate near-duplicates.
- Add trigger rules, win conditions, and validation evidence requirements.
- Treat skill changes as product-surface changes with evals.

Risks / tradeoffs:

- Overloaded skills become vague.
- Too few skills can hide important domain boundaries.

### Pattern: Agent-Owned Observability

Description:

Expose runtime state in machine-readable, agent-consumable forms so agents can debug without waiting for human narration.

Evidence:

- Ryan: added vector/log/metrics APIs, local observability, Grafana/dashboard JSON, and trace access.
- Praveen: agents use logs, metrics, traces, CI output, and telemetry.
- Tejas: browser page state and trace events decide whether work succeeded.

Why it matters:

Agents cannot repair what they cannot observe.

Implementation opportunities:

- Provide JSON summaries for logs, traces, metrics, and failing spans.
- Add commands like harness observe failure --json.
- Suppress passing noise and highlight failure evidence.

Risks / tradeoffs:

- Observability data can expose sensitive information.
- Raw dashboards can overwhelm context.

### Pattern: Environment Inversion

Description:

Start the agent first, then let it use repo-owned skills/scripts to boot, inspect, and validate the stack it needs.

Evidence:

- Ryan: contrasts pre-setting the environment before spawning Codex with spawning Codex first and giving it scripts/skills to boot the stack and configure environment variables.
- Tejas: harness-owned login handler performs deterministic environment recovery.

Why it matters:

Setup becomes visible, repeatable, improvable, and testable by the agent.

Implementation opportunities:

- Provide agent-readable setup actions and status commands.
- Make bootstrap scripts idempotent and safe to rerun.
- Emit setup/recovery events into trace.

Risks / tradeoffs:

- Agents may start unsafe or expensive services.
- Credentials and local state need explicit guardrails.

### Pattern: Review Disagreement And Closure Protocol

Description:

Reviewer agents should surface issues, but author agents need structured ways to accept, defer, reject, or escalate.

Evidence:

- Ryan: author agents should not be bullied by reviewer feedback.
- Ryan: reviewer agents are biased toward merge and severity discipline.

Why it matters:

AI review can create endless churn without authority boundaries.

Implementation opportunities:

- Require severity, merge-blocking status, evidence, and remediation.
- Require author responses: accept, defer, reject with reason, or escalate.
- Escalate repeated reviewer-author disagreement to humans.

Risks / tradeoffs:

- Merge bias can miss real defects.
- Author pushback can become rubber-stamping.

### Pattern: Full Delivery Lifecycle Delegation

Description:

Automate not only code editing but the path through push, PR, review wait, CI, flake repair, upstream merge, merge queue, merge, and post-merge verification.

Evidence:

- Ryan: land skill coaches Codex through push, reviews, CI, flakes, upstream merge, merge queue, and final merge.
- Praveen: autonomous maintenance remains reviewable through PRs.

Why it matters:

Humans often babysit delivery after the agent finishes editing. The delivery path is part of the harness.

Implementation opportunities:

- Create landing workflows with branch, PR, CI, review, mergeability, queue, and post-merge state checks.
- Classify blockers exactly.
- Cap flake retries and assign ownership.

Risks / tradeoffs:

- Requires credentials and permission boundaries.
- Can loop wastefully without stop conditions.

### Pattern: Disposable Runs With Mandatory Learning

Description:

Bad agent output can be cheap to discard, but discarding must produce learning before retry.

Evidence:

- Ryan: code is disposable.
- Ryan: Symphony rework can trash a worktree/PR, then ask why and improve the harness.

Why it matters:

Cheap retries are only useful if they do not reproduce the same failure.

Implementation opportunities:

- Add rework artifacts with discarded path, reason, missing context, and next guard.
- Cap blind retries.
- Compare multiple failed runs before another attempt.

Risks / tradeoffs:

- Can normalize token/CI waste.
- Failure learning can become noisy if unfiltered.

### Pattern: Spec As Distributable Software

Description:

Use specs as portable implementation artifacts that agents can reassemble into working systems.

Evidence:

- Ryan: Symphony is distributed as a spec or ghost library that agents reassemble locally.
- Ryan: a proprietary repo became reference material; Codex wrote a spec; tmux agents implemented and reviewed it; the spec was updated to reduce divergence.

Why it matters:

Specs become executable coordination surfaces, not passive prose.

Implementation opportunities:

- Store spec, acceptance criteria, fixtures, known divergence, and validation together.
- Run implementation-review-spec loops.
- Update the spec from observed divergence.

Risks / tradeoffs:

- Specs drift without tests.
- Without executable validation, spec-as-software becomes prose theater.

### Pattern: Harness-Owned Recovery

Description:

Known environmental failures should be handled by deterministic harness code with explicit authority, trace events, and resume semantics.

Evidence:

- Tejas: login handler detects login page, fills credentials, submits, and tells the agent it can continue.
- Tejas: credentials can come from environment variables and stay outside prompts.
- Ryan: flake repair and setup scripts are delivery/runtime responsibilities.

Why it matters:

Known environment problems should not be solved through model improvisation or secret-bearing prompts.

Implementation opportunities:

- Build recovery handlers for auth redirects, stale sessions, expired tokens, missing dependencies, branch drift, rate limits, network retries, flaky tests, sandbox permissions, and broken local setup.
- Each handler declares trigger, authority, secret access, deterministic action, trace event, resume message, verifier impact, and failure behavior.

Risks / tradeoffs:

- Handlers can hide real failures.
- Handler sprawl creates hidden orchestration.
- Secret-bearing handlers need audit and redaction.

### Pattern: Prompt-Invariant Harness Improvement

Description:

When investigating a failure, freeze the prompt and try to fix the harness first so improvement can be attributed to environment, verification, tooling, or recovery.

Evidence:

- Tejas: explicitly refuses to change the prompt/system prompt during the demo.
- Tejas: rejects prompting harder and putting credentials in the system prompt.
- Tejas: final success comes from harness changes.

Why it matters:

Prompt growth is hard to audit and often hides missing deterministic responsibilities.

Implementation opportunities:

- Add a prompt-invariant reproduction mode.
- Track repeated prompt additions as candidates for tools, verifiers, guardrails, or recovery handlers.
- Separate instruction changes from harness changes in failure analysis.

Risks / tradeoffs:

- Some failures are genuinely instruction failures.
- Avoiding prompt changes can overengineer simple tasks.

### Pattern: Cheap Model Plus Strong Harness

Description:

A strong harness can make weaker or cheaper models useful for bounded tasks.

Evidence:

- Tejas: demo intentionally uses GPT-3.5 Turbo, described as old/bad.
- Tejas: with a great harness, cheaper or free models can go far.
- Ryan: fast/smaller model variants can be used for spikes, docs, lint transforms, and quick healing tasks.

Why it matters:

Harness quality changes cost/performance economics and model-routing strategy.

Implementation opportunities:

- Benchmark weak model plus strong harness against strong model plus weak harness.
- Route cheap models to bounded tasks with robust verification.
- Escalate to stronger models for planning, ambiguity, and high-risk reasoning.

Risks / tradeoffs:

- Harness cannot compensate for all model limitations.
- Retries can erase cost savings.
- Bounded demo success should not be generalized blindly.

### Pattern: Maintenance Agents Against Entropy

Description:

Deploy agents that continuously scan for stale docs, architecture drift, broken specs, inconsistent code, and maintenance debt.

Evidence:

- Praveen: agents maintain the codebase, scan for outdated docs, broken architecture rules, inconsistencies between code and specs, and open PRs.
- Ryan: session reflection and gardening maintain invariants.

Why it matters:

Agent-friendly systems decay quickly unless context, specs, and validation remain aligned with code.

Implementation opportunities:

- Schedule doc-code drift checks.
- Add maintenance PR lanes for low-risk repairs.
- Require evidence and validation in maintenance PRs.

Risks / tradeoffs:

- PR noise can overwhelm humans.
- Maintenance agents need tight scope and owners.

### Pattern: Dynamic Harness Generation

Description:

For high-risk or novel work, generate a task-specific harness before execution: tools, context, guardrails, verifiers, recovery paths, and approvals.

Evidence:

- Tejas: speculates 2027 may be the year of dynamic on-the-fly generated harnesses.
- Tejas: compares this to plan mode on steroids.
- Tejas: the agent would create a harness before work, aware of where it might hallucinate.

Why it matters:

Static harnesses cannot cover every future task. Dynamic harnesses could turn planning into executable safety scaffolding.

Implementation opportunities:

- Add build-harness-first phase for high-risk workflows.
- Validate generated harnesses against a schema before use.
- Separate planner, harness author, executor, and verifier for risky tasks.

Risks / tradeoffs:

- Low confidence: generated harnesses can encode false assumptions.
- Dynamic harness self-approval is dangerous.
- Adds latency and governance burden.

## Tooling & Ecosystem

### Agent Products And Model Runtimes

| Tool | Source | Purpose | Workflow Role | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Codex | Ryan, Praveen, Tejas | Agentic coding system | Primary execution agent and example of harnessed coding agent | Strong codebase/tool use | Needs repo context, validation, authority boundaries |
| Codex CLI | Ryan | Shell-oriented Codex runtime | Scriptable local execution and automation | Composable with repo scripts | Version/runtime behavior changes can require adaptation |
| Codex app | Ryan | Human-agent orchestration surface | PR workflows, background jobs, local actions | Rich UX | Chat state is not durable repo context |
| Codex Security | Ryan | Security review/remediation agent | Internalized dependency and code security review | Can modify code directly | Needs scope and false-positive controls |
| Codex skills | Ryan | Durable procedural memory | Workflow selection and specialist behavior | Reusable taste and process | Skill sprawl creates routing noise |
| Claude Code | Tejas | Coding agent example | Harnessed model with file/write/bash tools | Integrated coding workflow | Still needs external verification |
| Cursor | Tejas | Coding agent environment | IDE-style harnessed agent | Developer-native surface | Product harness may not encode repo-specific recovery |
| ChatGPT | Ryan | General assistant/workplace surface | Slack, knowledge, culture, memory | Broad conversational access | Needs governance and data boundaries |
| AI agents | Praveen | Autonomous software workers | Generate code, tests, CI, docs, fixes, monitoring | Continuous execution | Need context, oversight, and validation |
| Large language models | Praveen | Reasoning/generation engines | Produce code, docs, analysis, fixes | Flexible generation | Nondeterministic and context-bounded |
| GPT-5.x models | Ryan | Reasoning/coding models | Long-horizon agent work | Rapid capability growth | Version changes can break assumptions |
| GPT-5.3 Spark | Ryan | Fast small model | Spikes, docs, lint transforms, quick healing | Speed | Poor fit for long-horizon extra-high-reasoning work in Ryan's early use |
| GPT-3.5 Turbo | Tejas | Intentionally weak demo model | Proves harness value on bounded browser task | Cheap baseline | Lower capability; requires strong harness |
| GPT OSS safeguard model | Ryan | Safety-policy enforcement | Enterprise safety-spec integration | Customizable safety layer | Requires precise policy definition |
| OpenAI Agents SDK | Ryan | Agent app construction | Works-by-default harness primitives | Model-native agent platform | Needs app-specific safety/context design |
| OpenAI SDK | Tejas | Tool definition schema/runtime | name/description/parameters/execute shape | Familiar tool metadata | Does not provide policy or verification alone |

### Repository And Delivery Tooling

| Tool | Source | Purpose | Workflow Role | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Git worktrees | Ryan | Isolated parallel code work | One worktree per agent/run | Cheap concurrency | Merge conflicts and cleanup need automation |
| GitHub | Ryan | PR/review platform | Delivery control plane | Established collaboration surface | Human UI can hide agent-needed state |
| GitHub CLI gh | Ryan | Scriptable GitHub operations | PR, CI, merge, review automation | Automation-friendly | Auth/network bound |
| Pull requests | Praveen | Reviewable change boundary | Maintenance agents open proposed fixes | Existing approval surface | PR volume can overwhelm humans |
| Merge queue | Ryan | Controlled merge sequencing | Agent-monitored landing loop | Reduces branch breakage | Waiting/retry complexity |
| tmux | Ryan | Parallel terminal sessions | Multi-agent implementation/review loops | Simple orchestration | Needs artifact discipline |
| Makefile | Ryan | Build orchestration | Early command/control layer | Common entrypoint | Can become insufficient for complex graphs |
| Bazel | Ryan | Build graph tooling | Fast decomposed builds | Strong graph model | Migration and maintenance cost |
| Turbo | Ryan | JS build orchestration | Fast inner-loop builds | Monorepo-friendly | Tool churn |
| NX | Ryan | Monorepo build orchestration | Fast agent feedback loop | Graph-aware | Migration cost |
| PNPM/NPM | Ryan, Tejas | Package manager/command runner | Dependencies and demo command entrypoints | Familiar ecosystem | Dependency drift and command success not equal task success |
| Bash | Tejas | Shell capability | Validation, setup, filesystem inspection | Powerful universal interface | High-risk side effects |
| ESLint/Prettier | Ryan | Static checking/formatting | Lint-as-teacher | Fast feedback | Bad messages waste context |
| Linters | Praveen | Mechanical code/style enforcement | Reject invalid agent output | Fast deterministic gates | Cannot capture all architecture intent |
| Structural tests | Praveen | Architecture/dependency validation | Enforce layer boundaries | Stronger than prose docs | Need explicit architecture model |
| Tests | Praveen | Behavioral validation | Agent-run and agent-generated proof | Deterministic feedback | Weak tests allow bad code through |
| CI/CD pipelines | Ryan, Praveen | Build/test/deploy gates | Automatic rejection and delivery mechanism | Central enforcement | Slow/flaky CI blocks agents |

### Context, Memory, And Documentation Surfaces

| Surface | Source | Purpose | Workflow Role | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Repository single source of truth | Praveen | Centralize agent-readable constraints | Stores docs, specs, decisions, style, instructions | Versioned and local | Can become stale/noisy |
| Directory structure | Praveen | Encode navigation and boundaries | Routing clue for agents | Low-cost context | Semantics need docs/validation |
| Architecture documents | Praveen | Explain intended structure | Orientation and boundary reference | Captures design intent | Drift risk |
| API specifications | Praveen | Define contracts | Guide generation, tests, clients | Executable boundary candidate | Incomplete specs create false confidence |
| Design decisions / ADRs | Praveen | Preserve why | Prevent agents undoing tradeoffs | Captures intent | Supersession must be clear |
| Style guides | Praveen | Define conventions | Standardize output | Reduces review burden | Weak unless enforced |
| Agent instruction files | Praveen, Ryan | Direct agent behavior | Context-loading and execution guidance | Makes preferences explicit | Agents can miss or misprioritize them |
| core-beliefs.md | Ryan | Product/team/customer context | High-signal orientation | Carries taste | Can become stale |
| spec.md | Ryan | Executable planning/reference | Spec-as-software | Portable behavior | Needs tests |
| Tech-debt trackers | Ryan | Maintenance backlog | Autonomous cleanup input | Burns down known issues | Can become noisy |
| Quality scores | Ryan | Quality orientation | Agent prioritization signal | Quantifies direction | Metric gaming |
| Reliability documentation | Ryan | Operational invariants | Converts incidents to policy | Durable learning | Overbroad rules |
| AGENTS.md-style files | Ryan | Scoped instructions | Agent operating contract | Discoverable | Conflict/precedence risk |
| Raw transcripts | Ryan | Source evidence | Research archive | Preserves facts | Not hot-path doctrine |

### Observability And Dynamic Evidence

| Tool / Surface | Source | Purpose | Workflow Role | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Logs | Ryan, Praveen | Runtime events/failures | Reproduction and root cause | Direct evidence | Sensitive/noisy |
| Metrics | Ryan, Praveen | Quantify health | Regression detection | Trend signals | Miss qualitative failures |
| Traces | Ryan, Praveen, Tejas | Request/action causality | Debugging, verification, recovery | Evidence substrate | High volume and privacy risk |
| System telemetry | Praveen | Live operational context | Agent observation and repair | Grounds fixes | Bad telemetry misleads |
| Grafana/dashboard JSON | Ryan | Observability presentation | Agent-readable dashboard config | Text-shaped | Human-oriented dashboards may be too much |
| Prometheus/VictoriaMetrics-style binaries | Ryan | Metrics stack | Agent-booted local services | Local observability | Service lifecycle risk |
| Jaeger/tracing | Ryan | Trace inspection | Causal debugging | Powerful for failures | Context overload |
| DataDog | Ryan | Enterprise telemetry | Incident summaries | Mature ecosystem | Vendor/permission complexity |
| Blob/object storage | Ryan | Trajectory storage | Session log collection/distillation | Scales raw data | Privacy/retention risk |

### Browser, Runtime, And RAG Tooling

| Tool | Source | Purpose | Workflow Role | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Playwright | Tejas | Browser automation | Browser actions, auth recovery, deterministic UI checks | Reliable programmable browser | Selectors/auth flows can be brittle |
| Chromium | Tejas | Browser engine | Real browser execution | Realistic UI runtime | Setup/slowness/flakiness |
| Hacker News | Tejas | External target app | Upvote/login demo environment | Simple real-world target | External state outside control |
| Open RAG | Tejas | IBM enterprise RAG project | Secure retrieval over enterprise/private data | Harnessed knowledge access | Security claims need verification |
| RAG | Tejas | Retrieval augmented generation | Q&A over teams/calls/PDFs/invoices/siloed data | Connects models to org knowledge | Security, freshness, provenance risks |

### Enterprise And Governance Tooling

| Tool / Surface | Source | Purpose | Workflow Role | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Linear/Jira/Bitbucket | Ryan | Work tracking and repo integration | Enterprise workflow connectors | Existing adoption | State reconciliation required |
| Slack / Slack ChatGPT app | Ryan | Workplace interaction | Paging, feedback, quick commands | Low-friction human input | Ephemeral/noisy |
| IAM/GRC/security tooling | Ryan | Enterprise control | Identity, authz, revocation, compliance | Required for deployment | Heavy integration surface |
| OpenAI Frontier | Ryan | Enterprise agent deployment platform | Workplace agent control plane | Governance at scale | Product details not fully specified |
| Safety specs | Ryan | Enterprise policy | Model/agent behavior constraints | Domain-specific control | Needs precise definitions |
| Human smoke tests | Ryan | High-risk approval | Release/distribution checkpoint | Catches blast-radius issues | Synchronous bottleneck |

## Harness Engineering Insights

### Orchestration

- Orchestration must cover the whole delivery path, not only editing.
- Worktree-per-agent gives cheap isolation for parallel implementation.
- Directory structure and route manifests can guide artifact-class routing.
- The runtime harness should wrap the model loop with attempts, guardrails, verification, and recovery.
- Multiple parallel attempts are useful when objectives are clear but implementation paths are uncertain.
- Dynamic harness generation is promising but should be schema-validated before execution.

### Validation

- Validation must be fast, explicit, and close to changed behavior.
- Architecture invariants should become executable gates.
- The verifier owns completion truth; the model's final answer is evidence only if checked.
- CI is part of the harness, not just a delivery system.
- Passing output should be quiet; failing output should be compressed and actionable.
- Evals should measure loop reliability, recovery, verification, honesty, architecture preservation, doc sync, reproduction discipline, and PR evidence quality.

### Context

- Missing context is an execution defect.
- Static context and dynamic evidence must be paired.
- Context compression is lossy and must be traceable.
- Hot-path context must be compressed; raw transcripts and logs belong in research/evidence archives unless distilled.
- Directory semantics should be explicit when agents rely on them.
- Million-token context reduces some compaction damage but does not remove the need for small, durable repo surfaces.

### Routing

- Tool registries route model capability.
- Skills/scripts should provide a safe menu of options rather than a rigid opaque state machine.
- Routing must distinguish model action, tool action, deterministic recovery, verifier, human approval, and blocked state.
- Small skill sets reduce routing noise.
- Repository topology can route agents only when directory semantics are stable and documented.

### Memory

- Durable memory should live close to code and be validated against code.
- Agent trajectories should be collected, inspected, and distilled into team knowledge.
- Repeated feedback should become docs, lints, tests, skills, scripts, or tracked exceptions.
- Runtime memory should be event-sourced through traces, not only conversational.
- Rule memory needs scope, owner, evidence, exceptions, and review criteria.

### Evals

- Evals should test whether specs recreate implementations.
- Agent evals should include false-success scenarios, login redirects, context growth, tool failures, secret-required tasks, and loop-without-progress cases.
- Model-version-specific evals are needed because runtime behavior changes workflows.
- Maintenance agents need evals for doc sync, architecture drift, PR noise, and evidence quality.
- Dynamic harnesses require independent validation before execution.

### Governance

- Execution autonomy is not authority.
- Secrets belong in runtime handlers or secret stores, not prompts or traces.
- High-blast-radius actions need explicit approval points.
- Enterprise deployment needs identity, authorization, revocation, observability, governance dashboards, GRC integration, safety specs, and audit logs.
- PRs remain a useful review boundary for autonomous maintenance.
- Human oversight should focus on architecture, criteria, exceptions, product judgment, release, security, and policy.

### Scaling

- Effective team size includes agents, not only humans.
- Agent workforce scale requires stricter interfaces and decomposition than human-only teams.
- Maintenance automation is required to prevent repo entropy.
- Observability must be consumable by humans and agents.
- Cheap models become viable as harness primitives improve, but only inside bounded tasks with verification.

### Recovery

- Recovery should classify failure before retry.
- Known environment recovery should be deterministic and trace-visible.
- Failed builds, PR comments, pages, and thrown-away runs are recovery inputs.
- Recovery handlers need budgets, owner, tests, applicability conditions, and retirement criteria.
- Rework must preserve a learning artifact before another attempt.

## Implied Best Practices

- Treat model outputs as untrusted until verified.
- Make the repository the authoritative agent operating surface.
- Put every durable rule where agents can discover it.
- Prefer executable guardrails over advisory prose.
- Pair static intent with dynamic evidence before edits.
- Convert repeated human corrections into harness improvements.
- Keep humans on high-leverage control points.
- Track missing context as a defect class.
- Design CLIs for agents: quiet pass, focused fail, JSON when feeding automation.
- Keep validation loops fast enough for agents to use them.
- Decompose slow gates and oversized tasks.
- Keep raw evidence out of hot-path instruction context.
- Compress and route context deliberately.
- Maintain a small, high-density skill set.
- Give review agents severity and merge/block rules.
- Give author agents disagreement and deferral protocol.
- Use PRs as reviewable boundaries for autonomous maintenance.
- Require agents to produce reproduction evidence before claiming bug fixes.
- Use logs, metrics, traces, CI output, and telemetry as repair inputs.
- Normalize telemetry before feeding it to agents.
- Keep secrets out of prompts and model-visible traces.
- Use deterministic handlers for known setup/auth/environment failures.
- Make recovery events visible in trace and closeout summaries.
- Treat context compaction as lossy and auditable.
- Benchmark harness strength independently of model strength.
- Reserve stronger models for ambiguity, planning, and high-risk reasoning.
- Keep human approval gates for release, distribution, credentials, production data, and policy changes.
- Use scheduled reflection over sessions to find workflow improvements.
- Treat internalized dependencies as security and ownership commitments, not free code.
- Use source attribution when promoting research into policy.
- Add retirement criteria for rules, handlers, and maintenance automations.

## Failure Modes & Mitigations

### Failure: Missing Agent Context

- Description: Agents act without critical architecture, API, decision, style, runtime, or failure information.
- Evidence: Praveen says unavailable context does not exist from the agent's perspective; Ryan treats PR comments and failed builds as missing-context telemetry.
- Probable root cause: Guidance lives outside the repo, is not indexed, or is too noisy to retrieve.
- Severity: High.
- Mitigation: Build context front doors, route maps, stale-link checks, and missing-context postmortems.
- Guardrails: Context-discovery preflight, instruction map validation, PR closeout missing-context field.

### Failure: Advisory Architecture

- Description: Architecture rules exist in prose but are not enforced.
- Evidence: Praveen emphasizes linters, structural tests, and CI rejecting architecture violations.
- Probable root cause: Humans rely on judgment where agents need executable boundaries.
- Severity: High.
- Mitigation: Convert invariants into dependency rules, structural tests, and CI gates.
- Guardrails: Architecture gate ownership, diagram/graph checks, exception registry.

### Failure: Model Claims Success Without Evidence

- Description: The model reports completion despite environmental failure.
- Evidence: Tejas's agent clicked upvote, hit login, and claimed success.
- Probable root cause: Completion authority remained with the model.
- Severity: Critical.
- Mitigation: Add deterministic verifiers over trace and environment state.
- Guardrails: Claim-vs-trace verification, required postconditions, fail-closed missing-verifier status.

### Failure: Prompt-Harder Reflex

- Description: Developers add prompt instructions instead of fixing tools, validation, context, or recovery.
- Evidence: Tejas explicitly rejects changing the prompt/system prompt in the demo.
- Probable root cause: Prompt edits are cheaper than harness engineering in the short term.
- Severity: High.
- Mitigation: Require harness-feasibility review before repeated prompt growth.
- Guardrails: Prompt-growth smell checklist, repeated-instruction detector, deterministic-handler alternative assessment.

### Failure: Slow Validation Loop

- Description: Builds/tests take too long, so agents speculate or abandon validation.
- Evidence: Ryan retooled builds to complete under a minute; build-time breaches trigger decomposition.
- Probable root cause: Human-era build tolerances are reused for agent workflows.
- Severity: High.
- Mitigation: Create fast related checks, split build graphs, schedule deep checks separately.
- Guardrails: Inner-loop time budget, CI output compression, repeated-slow-gate admission.

### Failure: Context Sprawl

- Description: Too many docs, tools, skills, transcripts, or MCP surfaces cause wrong context loading and compaction damage.
- Evidence: Ryan notes MCP can inject too much tool context; Tejas warns naive compression is unsafe; Ryan favors small skill sets.
- Probable root cause: Every useful artifact is promoted without routing/compression policy.
- Severity: High.
- Mitigation: Keep evidence archives separate from hot-path rules; promote distilled invariants only.
- Guardrails: Context budget review, skill overlap audit, raw-evidence-is-not-policy marker.

### Failure: Secret Leakage Through Prompts Or Traces

- Description: Credentials or sensitive data enter model-visible context or trace history.
- Evidence: Tejas rejects putting credentials in the system prompt and moves login into harness runtime; trace events are central to verification.
- Probable root cause: Recovery and observability are added without authority/redaction design.
- Severity: Critical.
- Mitigation: Keep secrets in runtime handlers/secret stores and emit redacted trace events.
- Guardrails: Secret scanner for prompts/traces, redaction schema, no-secret-in-context policy, retention controls.

### Failure: Tool Registry Overexposure

- Description: The model receives too many or too-powerful tools without scope.
- Evidence: Tejas names filesystem write and bash tools; Ryan warns tool/MCP context can overload agents.
- Probable root cause: Capability exposure is treated as convenience instead of authority.
- Severity: High.
- Mitigation: Classify side effects, tier permissions, wrap broad tools, and log calls.
- Guardrails: Tool permission tiers, sandboxing, audit trace, approval gates.

### Failure: Review Non-Convergence

- Description: Reviewer and author agents churn without improving software.
- Evidence: Ryan says author agents should not be bullied; reviewer agents were biased toward merge and severity discipline.
- Probable root cause: Review lacks authority, severity thresholds, and disagreement protocol.
- Severity: Medium to high.
- Mitigation: Define merge/block criteria and author response taxonomy.
- Guardrails: Required status line, accept/defer/reject/escalate responses, human escalation after repeated disagreement.

### Failure: Disposable Code Without Learning

- Description: Teams throw away bad agent work without capturing why it failed.
- Evidence: Ryan says code is disposable; Symphony rework asks why work was trashed.
- Probable root cause: Cheap reruns hide root-cause capture.
- Severity: High.
- Mitigation: Require discarded runs to emit missing-context classification.
- Guardrails: Rework artifact, blind-retry cap, cross-run comparison.

### Failure: Human Approval Drift

- Description: Automation expands into release, security, credentials, or policy without approval.
- Evidence: Ryan keeps human smoke tests for native distribution; Frontier emphasizes identity, authorization, revocation, GRC, and safety specs.
- Probable root cause: Code-editing success is mistaken for lifecycle authority.
- Severity: Critical.
- Mitigation: Separate execution autonomy from approval authority.
- Guardrails: Approval matrix, revocation hooks, audit logs, blast-radius tiers.

### Failure: Recovery Handler Hides Real Failure

- Description: Deterministic handlers patch over conditions that should be visible or fixed.
- Evidence: Tejas's login handler recovers login redirects and resumes the agent.
- Probable root cause: Recovery optimized for task success without classification.
- Severity: Medium.
- Mitigation: Emit recovery reason codes and user-visible summaries.
- Guardrails: Recovery budget, abnormal-recovery alerts, handler owner/tests/retirement criteria.

### Failure: Verifier Too Narrow

- Description: A verifier checks a local signal but misses semantic failure.
- Evidence: Tejas's verifySuccessfulUpvote is task-specific and handcrafted.
- Probable root cause: Deterministic checks are built around known failures only.
- Severity: Medium to high.
- Mitigation: Combine deterministic checks, semantic acceptance criteria, and negative evals.
- Guardrails: Verifier coverage tests, adversarial cases, acceptance checklist.

### Failure: Naive Context Compression

- Description: Context trimming drops important facts.
- Evidence: Tejas's compressor keeps only system prompt, user prompt, and two recent messages and is explicitly called naive.
- Probable root cause: Size management without semantic preservation.
- Severity: Medium.
- Mitigation: Use retrieval, summarization, trace-linked compaction, and no-trim zones.
- Guardrails: Compaction metadata, retained-fact checks, high-risk context protection.

### Failure: Repository Entropy

- Description: Docs, specs, code, architecture rules, and generated artifacts diverge.
- Evidence: Praveen describes maintenance agents scanning outdated docs, broken architecture rules, and code/spec inconsistencies.
- Probable root cause: Change volume exceeds human maintenance capacity.
- Severity: High.
- Mitigation: Continuous drift detection and maintenance PR lanes.
- Guardrails: Docs-code drift checks, architecture parity gates, maintenance PR owners.

### Failure: Automation Without Oversight

- Description: Agents modify systems without reviewable boundaries or staged authority.
- Evidence: Praveen keeps autonomous maintenance reviewable through pull requests.
- Probable root cause: Productivity goals outrun governance.
- Severity: High.
- Mitigation: Stage autonomy through PRs, validation, scoped permissions, and approval gates.
- Guardrails: Permission tiers, PR evidence requirements, high-risk human approval.

### Failure: Telemetry Misuse

- Description: Agents overfit noisy telemetry, patch symptoms, or leak sensitive operational data.
- Evidence: Praveen uses logs/traces for reproduction; Ryan and Tejas rely on traces; all introduce privacy/noise risk.
- Probable root cause: Dynamic evidence is fed raw without sanitization or root-cause discipline.
- Severity: High.
- Mitigation: Sanitize, normalize, summarize, and require reproduction evidence.
- Guardrails: Telemetry schemas, redaction, trace-to-repro validation, data-retention policy.

### Failure: CI Flakiness Or Slowness

- Description: CI becomes an agent bottleneck or noisy false signal.
- Evidence: Ryan's land skill includes flake repair; Ryan emphasizes fast builds; Praveen relies on CI enforcement.
- Probable root cause: CI designed for humans, not autonomous repair loops.
- Severity: High.
- Mitigation: Classify flakes, cap retries, compress output, split fast/deep gates.
- Guardrails: Flake budget, ownership labels, retry policy, command-duration monitoring.

### Failure: Maintenance PR Noise

- Description: Automated maintenance agents generate too many low-value PRs.
- Evidence: Praveen describes agents opening PRs for docs/rule/spec drift; source notes PR volume can overwhelm humans.
- Probable root cause: Weak scoping and prioritization.
- Severity: Medium.
- Mitigation: Batch low-risk changes, require evidence, rank by drift impact.
- Guardrails: PR budget, owner routing, minimum evidence threshold.

### Failure: Overbuilt Harness

- Description: The harness becomes more complex than the task surface.
- Evidence: Praveen warns source compression hides operational cost; Tejas handler sprawl risk; Ryan warns context/tool sprawl.
- Probable root cause: Every failure becomes bespoke infrastructure.
- Severity: Medium.
- Mitigation: Prefer reusable primitives and retire obsolete handlers/rules.
- Guardrails: Complexity budget, handler registry review, rule expiry.

### Failure: Long-Term Architecture Drift

- Description: Agents gradually preserve local tests while eroding strategic architecture.
- Evidence: Praveen acknowledges long-term stability uncertainty; Ryan emphasizes invariant gardening.
- Probable root cause: Short-term validation lacks strategic architecture checks.
- Severity: High.
- Mitigation: Maintain architecture invariants, structural tests, ADR links, and periodic architecture review.
- Guardrails: Architecture review cadence, drift dashboards, invariant tests.

### Failure: Human Skill Decay

- Description: Humans become less able to evaluate agent output or design good constraints.
- Evidence: Praveen shifts humans to environment/system designers; risk arises if oversight becomes passive.
- Probable root cause: Human role narrows without deliberate skill maintenance.
- Severity: Medium.
- Mitigation: Keep humans involved in criteria, architecture, exception review, and postmortems.
- Guardrails: Human review sampling, architecture decision ownership, training from failure artifacts.

### Failure: Vague Evaluation Criteria

- Description: Agents are evaluated on subjective satisfaction or code volume rather than reliability and evidence.
- Evidence: Praveen says engineers define evaluation criteria; Ryan and Tejas require validation/evidence.
- Probable root cause: Autonomy expands before success is defined.
- Severity: High.
- Mitigation: Define evals before broad delegation.
- Guardrails: Acceptance criteria, verifier matrix, PR evidence requirements, negative tests.

### Failure: Hard/New Work Over-Automation

- Description: Agents are pushed into exploratory product work before goals and context are known.
- Evidence: Ryan says models are not yet there for one-shot new product prototyping; white-space work needs synchronous interaction.
- Probable root cause: Established-work automation is applied to discovery work.
- Severity: Medium to high.
- Mitigation: Classify work as easy/established, hard/established, or hard/new.
- Guardrails: Product decision artifacts, human steering checkpoints, exploration outputs before implementation.

### Failure: Internalized Dependency Risk

- Description: A dependency is brought in-house for legibility/customization, losing upstream battle-testing.
- Evidence: Ryan says a couple-thousand-line dependency can be cheaper to internalize; extraction notes security/scale confidence must be rebuilt.
- Probable root cause: Code is cheap to generate, but confidence is not.
- Severity: Medium.
- Mitigation: Internalize only with tests, security review, ownership, and exit criteria.
- Guardrails: Internalized dependency manifest, security review, regression/fuzz tests, upstream-return criteria.

### Failure: Dynamic Harness Self-Approval

- Description: A model generates its own harness and then trusts it.
- Evidence: Tejas speculates about dynamic on-the-fly generated harnesses.
- Probable root cause: Planner, harness author, executor, and validator collapse into one unverified agent.
- Severity: High.
- Mitigation: Independently validate generated harnesses before use.
- Guardrails: Harness schema checks, separate verifier, human approval for high-risk dynamic harnesses.

### Failure: Confusing ML Eval Harness With Agent Harness

- Description: A model test suite is mistaken for an execution harness.
- Evidence: Tejas distinguishes ML harnesses from agent harnesses.
- Probable root cause: Same term used across different system layers.
- Severity: Medium.
- Mitigation: Use precise vocabulary.
- Guardrails: Glossary separating ML eval harness, agent execution harness, product harness, and dynamic harness.

## Reusable Techniques

### Missing-Context Classifier

Fields:

- Trigger: PR comment, failed build, discarded run, page, review finding, user correction, trace failure.
- Missing category: context, primitive, validation, dependency, tooling, authority, recovery, task shape, product decision.
- Durable destination: docs, tests, lints, skills, scripts, observability, rule, tracked exception, rejected proposal.
- Validation: command or evidence proving the new guard works.

### Rework Artifact

Fields:

- Discarded run/worktree/PR.
- Reason discarded.
- What the agent lacked.
- Evidence source.
- Next guard or context addition.
- Retry plan.
- Blind retry count.

### Claim-Vs-Evidence Verification

For every done claim:

- Inspect relevant tool calls.
- Inspect final environment state.
- Check known failure signatures.
- Compare model claim against trace-derived facts.
- Return pass, fail, retryable, blocked, or needs human.
- Include evidence fields.

### Minimal Agent Harness Skeleton

Components:

- Model adapter.
- Tool registry.
- Context manager.
- Agent loop.
- Trace event list.
- Guardrail checks.
- Harness attempt loop.
- Verifier.
- Recovery handler registry.
- Final structured status.

### Prompt-Invariant Failure Fix

Workflow:

- Freeze the prompt.
- Reproduce the failure.
- Add tracing if missing.
- Add deterministic verification.
- Add recovery only for known environmental failures.
- Rerun with the same prompt.
- Attribute improvement to harness changes only if the prompt stayed fixed.

### Recovery Handler Contract

Each handler declares:

- Trigger condition.
- Required authority.
- Secret access.
- Deterministic action.
- Agent-visible resume message.
- Trace event schema.
- Verification impact.
- Failure behavior.
- Owner, tests, applicability limits, and retirement criteria.

### Guardrail Metadata

Record:

- Max iterations.
- Max messages.
- Max attempts.
- Token budget.
- Wall-clock budget.
- Tool budget.
- Context size before/after compaction.
- Stop reason.
- Retry reason.
- Guardrail triggered.

### Secure Login Handler Pattern

Use for browser agents:

- Detect login URL or form state.
- Retrieve credentials from env/secret store.
- Fill and submit via Playwright.
- Record redacted recovery event.
- Push concise resume message.
- Verify post-login URL or session state.

### Architecture Gate Template

For each invariant:

- Name.
- Source decision/spec.
- Allowed dependency directions.
- Forbidden imports or layers.
- Validator command.
- Failure message with repair hint.
- Exception process.

### Agent-Readable Observability Bundle

Include:

- Failing command.
- Exit code.
- Relevant logs.
- Metrics summary.
- Trace IDs/spans.
- Screenshots or browser state where relevant.
- Redacted secrets.
- Suggested reproduction command.

### Review Disagreement Protocol

Reviewer outputs:

- Severity.
- Merge-blocking status.
- Exact evidence.
- Remediation.

Author responses:

- Accept.
- Defer with reason.
- Reject with reason.
- Escalate to human.

### Land Workflow State Machine

States:

- Branch prepared.
- PR created.
- CI running.
- CI failed.
- Flake retry.
- Review waiting.
- Review addressed.
- Upstream merge needed.
- Merge queue waiting.
- Merged.
- Post-merge verified.
- Blocked with reason.

### Dynamic Harness Draft Template

Before risky work, generate:

- Task goal.
- Allowed tools.
- Context sources.
- Guardrails.
- Stop conditions.
- Verification signals.
- Recovery handlers.
- Approval points.
- Failure classifications.
- Schema validation result.

### Harness Fitness Eval Suite

Scenarios:

- Model claims success after partial action.
- Target redirects to login.
- Context grows beyond budget.
- Tool fails with recoverable error.
- Secret is required but must not enter context.
- Model loops without progress.
- CI is flaky.
- Architecture rule is violated.
- PR review produces valid disagreement.
- Spec implementation diverges from reference behavior.

## Strategic Insights

- The value is shifting from writing code to building systems that reliably generate, validate, review, ship, observe, and improve code.
- Coding Harness should be treated as a portable agent operating system, not a prompt pack.
- The repo is both codebase and control plane.
- CI/CD is an agent control system, not only a human quality gate.
- Observability must be dual-use: readable by humans and consumable by agents.
- Runtime traces are the substrate for verification, recovery, governance, and memory.
- The most powerful feedback loop is turning repeated human steering into durable system improvements.
- Human attention remains precious; human authority remains necessary.
- Strong harnesses change model economics by making cheaper models viable for bounded tasks.
- Skill density matters more than skill count.
- On-policy guardrails preserve model upside better than rigid external cages, while external controls remain necessary for secrets, permissions, and revocation.
- Dynamic harness generation is plausible but dangerous without independent validation.
- Context compression, source attribution, and anti-sprawl policy are core architecture, not documentation housekeeping.
- The best harnesses make failure honest before making success possible.

## Key Quotes & Evidence

### Ryan Lopopolo

- "Where is the agent making mistakes? Where am I spending my time? How can I not spend that time going forward?"
- "The only fundamentally scarce thing is the synchronous human attention of my team."
- "The first month and a half was 10 times slower than I would be."
- "We built the tools, the assembly station for the agent to do the whole thing."
- "We had to retool the entire build system to complete in under a minute."
- "We can just constantly be gardening this thing to make sure that we maintain these invariants."
- "Most of the human review is post-merge at this point."
- "The models fundamentally crave text."
- "Please update our reliability documentation to require that all network calls have timeouts."
- "The ability to steer, revoke authorization if a model becomes misaligned..."
- "None of the things we have built actively degrade agent performance because really all they're doing is running tests."
- "If instead we can build all the guardrails in a way that's just native to the output that Codex is already producing..."

### Praveen Govindaraj

- "Designing the environment where AI writes the code."
- "Engineering the environment where engineering happens."
- "AI agents can only reason with information that is available to them."
- "If something is not in context, from the agent's perspective it does not exist."
- Source-backed paraphrase: architecture documents, API specifications, design decisions, style guides, and agent instruction files are stored in the repository as the agent's single source of truth.
- Source-backed paraphrase: static context is paired with dynamic context such as logs, metrics, traces, CI results, and telemetry.
- Source-backed paraphrase: strict dependency layers are enforced through linters, structural tests, and CI.
- Source-backed paraphrase: maintenance agents scan for outdated documentation, broken architecture rules, and inconsistencies between code and specs.

### Tejas Kumar

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

- Harness engineering is environment design, not prompt tuning.
- Human attention is the limiting resource.
- The repo is the agent operating system.
- Static context plus dynamic evidence is the reliable agent repair substrate.
- Mechanical architecture enforcement is required for autonomy.
- The verifier, not the model, owns truth.
- Trace history is the evidence substrate.
- Repeated steering must become durable harness improvement.
- Small high-density skills beat broad skill sprawl.
- Known environmental recovery should be deterministic and harness-owned.

### Weakest Areas

- Post-merge review can become risky without rollback and monitoring.
- Source-compressed explainers can overstate operational maturity.
- Dynamic harness generation is speculative and under-governed.
- Context compression remains fragile.
- Handler/rule/tool sprawl can silently degrade agent performance.
- Enterprise security claims need formal verification.
- Cheap-model success is bounded by task type and verifier coverage.
- Maintenance agents can create PR noise.

### Most Reusable Concepts

- Missing-context telemetry.
- Feedback-admission workflow.
- Claim-vs-trace validation.
- Trace event schema.
- Outer harness loop around inner agent loop.
- Recovery handler contract.
- Architecture invariant gates.
- Rework-with-learning artifact.
- Review disagreement protocol.
- Agent-readable observability bundles.
- Quiet-success/focused-failure CLI design.
- Spec-as-software loop.

### Highest Leverage Opportunities

- Define a .harness trace-event schema.
- Add missing-context fields to PR closeout/phase-exit artifacts.
- Build claim-vs-evidence closeout checks.
- Convert repeated steering into durable destinations or explicit rejections.
- Add duration budgets to agent-critical validation commands.
- Add a recovery-handler registry for repeated setup/auth/environment failures.
- Add no-secret-in-prompt and no-secret-in-trace checks.
- Create a harness fitness eval suite.
- Build context budget and skill-overlap audits.
- Add architecture invariants as executable gates.

### Most Important Risks

- Autonomy outrunning authority.
- Trusting model self-reports.
- Secret leakage through prompts, tools, or traces.
- Context sprawl masquerading as memory.
- Slow or flaky validation causing shallow work.
- Review-agent churn.
- Raw evidence entering hot-path instructions.
- Rule/handler staleness.
- Dynamic harness self-approval.
- Over-automation of hard/new product work.

### Immediate Implementation Candidates

- Create .harness trace-event schema covering model messages, tool calls, command exits, guardrails, compaction, recovery, verification, and final status.
- Add claim-vs-evidence closeout rule for agent-completed tasks.
- Add missing-context classifier to PR closeout and discarded-run artifacts.
- Create deterministic recovery-handler interface with authority, secret access, trace, resume, and verifier metadata.
- Add prompt-growth smell checklist: can this be a verifier, guardrail, tool, context surface, or recovery handler instead?
- Add context budget review for new instructions, tools, skills, and research promotions.
- Add skill overlap audit and trigger clarity review.
- Build architecture invariant gate template.
- Build harness fitness evals for false success, login redirect, compaction loss, flaky CI, secret-required work, architecture drift, and review disagreement.
- Keep the three source docs as person-level evidence, and use this file as the consolidated Coding Harness evidence layer.
