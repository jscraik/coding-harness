# Ryan Lopopolo Harness Engineering Evidence Extraction

Generated: 2026-05-18

Primary source: `.harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/ryan-lopopolo-extreme-harness-engineering.md`

Supporting source set:

- `.harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/ryan-lopopolo-transcript-source.txt`
- `.harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/CeOXx-XTYek - Extreme Harness Engineering 1M LOC 1B toksday 0 human code or review Ryan Lopopolo OpenAI.txt`
- `.harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/am_oeAoUhew - Harness Engineering How to Build Software When Humans Steer Agents Execute Ryan Lopopolo O.txt`
- `.harness/research/2026-05-16-harness-engineering-youtube-transcripts/manifest.json`

Evidence labels:

- Explicit evidence: directly stated in the transcript or curated transcript-backed extraction.
- Inferred insight: derived from repeated behaviors, examples, constraints, or tooling choices.
- Speculative interpretation: plausible but not proven by the transcript alone.

## Executive Summary

Ryan Lopopolo's harness engineering posture is not "prompt better." It is a systems approach where the repo, tools, CI, docs, skills, lints, review loops, observability, and agent trajectories become the execution environment that lets agents operate with less synchronous human attention. The most reusable idea is the feedback conversion loop: every PR comment, failed build, repeated human correction, missing timeout, slow build, poor review, or discarded run should become a durable improvement to docs, tests, lints, skills, scripts, or observability.

The strongest operational pattern is to treat human attention as the scarce resource and tokens as parallelizable labor. That flips engineering priorities: build speed, CLI output shape, repo legibility, deterministic validation, artifact compression, and agent-readable context are not developer-experience nice-to-haves; they are production capacity constraints for an agent workforce.

The central risk is overgeneralizing this into careless autonomy. The transcript repeatedly implies strong control planes: identity, authorization, revocation, observability, governance dashboards, safety specs, post-merge review, human smoke tests for distribution, and review agents that can disagree. The lesson is not "remove humans." It is "move humans to the highest-leverage control points and make every low-level correction teach the system."

## Core Engineering Patterns

### Pattern: Zero-Human-Code Constraint

#### Description

Use a hard constraint that product code must be produced by agents, forcing the team to build the harness, primitives, validation, and context surfaces needed for the agent to do the full engineering job.

#### Evidence

- Explicit evidence: Ryan says he began with the constraint that he could not write code himself; the only way to do his job was to get the agent to do it.
- Explicit evidence: The interview frames five months of work as zero lines of human-written code over a codebase of more than one million lines.

#### Why It Matters

This turns agent productivity from an optional assistant workflow into a forcing function. If the human keeps patching around harness gaps, the system never learns where it is deficient.

#### Implementation Opportunities

- Create a `no-human-product-code` experiment lane for bounded modules.
- Require human edits in the lane to be harness, tests, docs, validators, scripts, specs, or observability improvements.
- Track exceptions as harness defects, not personal productivity wins.

#### Risks / Tradeoffs

- High early slowdown.
- Can incentivize accepting mediocre code unless validation is strict.
- Needs careful scope selection; hard/new product discovery still needs human steering.

### Pattern: Failure-Driven Decomposition

#### Description

When an agent cannot complete a task, decompose the task into smaller reusable building blocks, then reassemble them into the original objective.

#### Evidence

- Explicit evidence: Ryan describes "double-clicking" into tasks the model cannot solve, building smaller blocks, and reassembling them.
- Explicit evidence: The first month and a half was slower because the team was building the agent's "assembly station."

#### Why It Matters

The agent failure is not merely a bad run. It is a map of missing primitives, weak interfaces, missing context, and oversized work units.

#### Implementation Opportunities

- Add a "decompose on second failure" rule to agent workflow docs.
- Require failure notes to classify whether the missing piece is context, primitive, validation, dependency, tooling, or task shape.
- Create reusable scripts or commands whenever two runs fail for the same reason.

#### Risks / Tradeoffs

- Can produce too many helper scripts if not consolidated.
- Requires periodic pruning to avoid a sprawling control surface.

### Pattern: Human Attention Budgeting

#### Description

Treat synchronous human attention as the limiting resource and optimize the SDLC so agents can continue without waiting for humans.

#### Evidence

- Explicit evidence: Ryan says the model is trivially parallelizable, while synchronous human attention is the fundamentally scarce thing.
- Explicit evidence: Human review moved mostly post-merge once the system had enough confidence.

#### Why It Matters

This reframes productivity. The question is not "did the agent save one edit?" It is "did the system remove a recurring human bottleneck from the loop?"

#### Implementation Opportunities

- Track human interruptions as a first-class metric.
- Add PR closeout artifacts that state which human approval points remain and why.
- Move repeated human feedback into lints, tests, docs, or skills before declaring the workflow improved.

#### Risks / Tradeoffs

- Poorly controlled autonomy can create silent risk.
- Post-merge review needs strong rollback, observability, and blast-radius discipline.

### Pattern: One-Minute Inner Loop and Build-Time Ratchet

#### Description

Keep builds and feedback loops fast enough that agents can iterate without losing patience, overcompacting, or abandoning useful blocking commands.

#### Evidence

- Explicit evidence: The team retooled the build system to complete in under a minute after Codex background shells changed agent behavior.
- Explicit evidence: Ryan describes build time as an envelope: if it breaches, stop and decompose the build graph.
- Explicit evidence: Tooling moved through Makefile, Bazel, Turbo, and NX until the build was fast enough.

#### Why It Matters

Build speed is agent infrastructure. Slow feedback loops cause more speculative edits, worse validation, and more human supervision.

#### Implementation Opportunities

- Add a build-time budget gate for agent-critical commands.
- Split slow checks into fast related checks and deeper scheduled checks.
- Treat a repeated slow gate as a harness defect requiring decomposition.

#### Risks / Tradeoffs

- Over-optimizing for speed can hide integration failures.
- Build system churn has migration cost and can create new maintenance burden.

### Pattern: Repo Text as Agent Operating System

#### Description

Encode product context, team taste, architecture rules, quality expectations, reliability rules, and follow-up work in text surfaces that the agent can read and act on.

#### Evidence

- Explicit evidence: Ryan says models "crave text."
- Explicit evidence: `core-beliefs.md`, `spec.md`, tech-debt trackers, quality scores, reliability documentation, workflow docs, and `AGENTS.md`-style files are named as steering surfaces.
- Explicit evidence: A missing network timeout becomes both a code fix and a reliability-doc update requiring timeouts.

#### Why It Matters

The agent cannot follow taste or standards it cannot see. Text turns tacit team preference into executable context.

#### Implementation Opportunities

- Keep high-signal project beliefs in a short file loaded by agent workflows.
- Convert repeated review comments into lints or validation docs.
- Maintain a tech-debt table that agents can burn down autonomously.

#### Risks / Tradeoffs

- Stale text becomes harmful context.
- Persisting every correction globally can create false universals and brittle exceptions.

### Pattern: Missing-Context Telemetry

#### Description

Treat PR comments, failed builds, rework, review feedback, pages, and human corrections as telemetry showing missing context in the harness.

#### Evidence

- Explicit evidence: The curated extraction says PR comments and failed builds are learning signals.
- Explicit evidence: Ryan says a page caused by a missing timeout should update reliability documentation, not only the local code.
- Explicit evidence: Rework in Symphony can discard the PR/worktree, then ask why the work was trashed and improve the harness.

#### Why It Matters

This closes the loop from individual failure to system improvement. Without this loop, the same human steering is paid again.

#### Implementation Opportunities

- Add a "feedback admission" command that turns a correction into a rule, guard, tracked exception, or rejected proposal.
- Record failed build root causes in Project Brain or a structured learning artifact.
- Require PR closeout to include "what context was missing?"

#### Risks / Tradeoffs

- Needs strong signal filtering; not every comment should become a rule.
- Can overfit to one reviewer or one incident.

### Pattern: Agent-Owned Observability

#### Description

Expose traces, logs, metrics, dashboards, and local service state in forms agents can inspect directly.

#### Evidence

- Explicit evidence: Ryan describes adding vector, log, metrics APIs, local observability, Grafana/dashboard JSON, and trace access.
- Explicit evidence: He says they inverted setup so Codex can boot the observability stack it needs.

#### Why It Matters

Agents cannot debug what they cannot observe. Human-only dashboards leave the agent dependent on synchronous narration.

#### Implementation Opportunities

- Provide JSON or text summaries for logs, traces, metrics, and failing spans.
- Add commands like `harness observe failure --json` that compress local runtime state.
- Prefer command outputs that highlight failures and suppress passing noise.

#### Risks / Tradeoffs

- Observability data can contain secrets or PII.
- Too much trace data becomes context pollution unless compressed.

### Pattern: Environment Inversion

#### Description

Start the agent first, then let the agent choose scripts and skills to boot the local stack it needs.

#### Evidence

- Explicit evidence: Ryan contrasts setting up an environment before spawning Codex with spawning Codex first and giving it skills/scripts to boot the stack and configure environment variables.

#### Why It Matters

It shifts setup from human prework into a repeatable agent-visible workflow. The setup itself becomes inspectable and improvable.

#### Implementation Opportunities

- Create agent-readable setup actions in repository environment files.
- Provide `bootstrap local stack`, `start observability`, and `status` commands with JSON output.
- Make setup scripts idempotent and safe to rerun.

#### Risks / Tradeoffs

- Agents may start expensive or unsafe services if boundaries are unclear.
- Credentials and local state require explicit guardrails.

### Pattern: Small Skill Set, High Taste Density

#### Description

Keep a small shared set of skills and pour repeated team taste into those skills instead of scattering guidance across many one-off artifacts.

#### Evidence

- Explicit evidence: Ryan says their codebase had about six skills and they poured every engineer's taste into them.
- Explicit evidence: The curated extraction recommends adding or updating a small number of high-leverage skills instead of fragmenting workflows.

#### Why It Matters

A small skill set is easier for agents to choose, easier to maintain, and more likely to carry coherent taste.

#### Implementation Opportunities

- Audit skills for overlap and consolidate near-duplicates.
- Add explicit trigger rules and win conditions.
- Treat skill updates as product surface changes with tests or evals.

#### Risks / Tradeoffs

- Overloaded skills can become vague.
- Too few skills can hide important domain boundaries.

### Pattern: Review Agent Disagreement Protocol

#### Description

Reviewer agents should find issues, but authoring agents must be allowed to acknowledge, defer, or push back so review does not cause endless churn.

#### Evidence

- Explicit evidence: Ryan says author agents should not be bullied by reviewer feedback and can defer or push back.
- Explicit evidence: Reviewer agents were biased toward merge and discouraged from surfacing low-severity issues as blockers.

#### Why It Matters

Unbounded AI review can create non-convergence. Review needs authority, severity, and closure rules.

#### Implementation Opportunities

- Require severity-ranked findings with explicit merge/block status.
- Let author agents respond with `accept`, `defer`, `reject with reason`, or `needs human`.
- Track unresolved review disagreement separately from validation failure.

#### Risks / Tradeoffs

- Merge bias can miss real defects.
- Author-agent pushback can become a rubber stamp without audits.

### Pattern: Full PR Lifecycle Delegation

#### Description

Delegate not only code edits but PR push, review wait, CI watch, flake repair, upstream merge, merge queue entry, and repeated retry until merged.

#### Evidence

- Explicit evidence: The curated extraction describes a land skill that coaches Codex through push, reviews, CI, flakes, upstream merge, merge queue, and final merge.

#### Why It Matters

Many teams only automate the edit step, leaving humans to babysit the actual delivery path. Delivery babysitting is the bottleneck.

#### Implementation Opportunities

- Build a `land` workflow with state checks: branch, PR, CI, review, mergeability, queue, post-merge verification.
- Require exact blocker classification when the workflow cannot proceed.
- Add retry policy for flakes with capped attempts and ownership labels.

#### Risks / Tradeoffs

- Requires credentials and strong permission boundaries.
- Automation can loop wastefully without deterministic stop conditions.

### Pattern: Disposable Runs With Mandatory Learning

#### Description

Make bad agent outputs cheap to discard, but require learning extraction from the discarded run before retrying.

#### Evidence

- Explicit evidence: Ryan says code is disposable and bad outputs can be thrown away cheaply.
- Explicit evidence: Symphony rework can trash worktree and PR, then ask why it was trashed.

#### Why It Matters

Cheap rework changes review economics, but only improves the system if failures become new context, tests, or constraints.

#### Implementation Opportunities

- Add a `rework` state that records discarded path, reason, missing context, and next guard.
- Preserve minimal evidence from failed runs for future routing.
- Use multiple parallel runs and compare outputs when task ambiguity is high.

#### Risks / Tradeoffs

- Can normalize waste if token and CI costs are ignored.
- Discarding without learning reproduces the same failure.

### Pattern: Spec as Distributable Software

#### Description

Use specs as portable implementation artifacts that agents can reassemble into working systems across repositories or environments.

#### Evidence

- Explicit evidence: Symphony is described as distributed as a spec or ghost library that agents can reassemble locally.
- Explicit evidence: They used an existing proprietary repo as a reference, had Codex write a spec, had tmux agents implement and review it, then updated the spec to reduce divergence.

#### Why It Matters

Specs become executable coordination surfaces rather than static documents. They can carry behavior across repo boundaries without shipping all source.

#### Implementation Opportunities

- Store spec, acceptance criteria, known divergence, and fixture prompts together.
- Run implementation-review-spec loops until outputs converge.
- Use generated implementation diffs to update the spec.

#### Risks / Tradeoffs

- Specs can drift from real behavior.
- Without tests, "spec-as-software" becomes prose theater.

### Pattern: On-Policy Guardrails

#### Description

Build guardrails in the same medium agents already operate in: code, docs, tests, lints, scripts, review comments, and CI gates.

#### Evidence

- Explicit evidence: Ryan contrasts native guardrails that are "just running tests" with an external Rust scaffold around Codex that would fight the model and risk being scrapped.
- Explicit evidence: The interviewer maps this to on-policy vs off-policy harnessing, and Ryan agrees.

#### Why It Matters

On-policy guardrails improve current agents and remain useful as models improve. Off-policy cages can become obsolete or suppress model capability.

#### Implementation Opportunities

- Prefer repo-native validators over wrapper-only control systems.
- Make guardrails visible in normal agent context.
- Encode policy through tests, lints, docs, and commands that agents can run.

#### Risks / Tradeoffs

- Some safety controls must exist outside the agent's editable domain.
- On-policy does not mean unrestricted; permissions and revocation still need external control.

## Tooling & Ecosystem

### Coding Agents and Models

| Tool | Purpose | Workflow Role | Integration Opportunities | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Codex | Agentic coding harness | Primary execution agent | Repo workflows, skills, CI, observability, PR lifecycle | Strong codebase understanding and tool use | Needs context, validation, and environment affordances |
| Codex CLI | Shell-oriented Codex runtime | Local execution and automation | Scriptable setup, worktree flows, source inspection | Composable with repo scripts | Behavior changes across versions can require repo adaptation |
| Codex app | Product surface for Codex | Human-agent interaction and orchestration | PR workflows, background jobs, screenshots, local env actions | Richer UX | Needs durable repo context to avoid one-off chat state |
| Codex Security | Security review and remediation | Internalized dependency review and code security | In-repo dependency hardening, threat reviews | Can modify code directly | Needs strong scope and false-positive controls |
| Codex skills | Durable procedural memory | Workflow selection and specialist behavior | Small high-density skill set | Reusable taste and process | Too many skills create routing noise |
| GPT-5.x models | Reasoning and coding models | Long-horizon agent work | Model-specific command budgets and evals | Rapid capability growth | Version behavior changes can break assumptions |
| GPT-5.3 Spark | Fast small model | Spikes, docs, lint transformations, quick healing tasks | Cheap parallel transformation passes | Speed | Poor fit for long-horizon extra-high-reasoning tasks in Ryan's early use |
| ChatGPT | General assistant and workplace interface | Slack, knowledge, culture, memory | Shared team knowledge and non-code workflows | Broad context and conversational access | Needs governance and data boundaries |
| GPT OSS safeguard model | Safety policy enforcement | Enterprise safety spec integration | Custom safety specs for enterprise domains | Customizable safety layer | Requires precise enterprise policy definitions |

### Repo and Engineering Tooling

| Tool | Purpose | Workflow Role | Integration Opportunities | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Git worktrees | Parallel isolated code work | Multi-agent concurrency | One worktree per agent/run | Cheap parallelism | Merge conflicts and cleanup need automation |
| GitHub | PR and review platform | Delivery control plane | PR comments as missing-context telemetry | Established collaboration surface | Human-oriented UI can hide agent-needed state |
| GitHub CLI (`gh`) | Scriptable GitHub operations | PR and CI automation | Land skill, review checks, merge queue status | Automation friendly | Auth/network bound |
| Merge queue | Controlled merge sequencing | PR landing | Agent-monitored landing loop | Reduces branch breakage | Can create waiting and retry complexity |
| tmux | Parallel terminal sessions | Multi-agent implementation/review loops | Spec reproduction swarms | Simple orchestration | Requires artifact discipline |
| Makefile, Bazel, Turbo, NX | Build orchestration | Inner-loop speed | Build graph decomposition | Can enforce fast builds | Migration cost and tool churn |
| PNPM/NPM | JavaScript package management | App and tooling dependencies | Frozen installs, agent setup scripts | Common ecosystem support | Noisy output and dependency drift |
| ESLint/Prettier | Static checking and formatting | Lint-as-teacher | Error messages that teach agents corrections | Fast feedback | Bad lint messages can waste context |
| CI | Validation and release gate | Automated correctness checks | Agent watched and repaired delivery path | Objective feedback | Slow/noisy CI becomes agent bottleneck |

### Product, Observability, and Enterprise Tooling

| Tool | Purpose | Workflow Role | Integration Opportunities | Strengths | Limitations |
| --- | --- | --- | --- | --- | --- |
| Grafana/dashboard JSON | Observability presentation | Agent-readable runtime state | Dashboards as files agents can edit/read | Text-shaped configuration | Human dashboard may be unnecessary if agent can read raw bundle |
| Prometheus/VictoriaMetrics style binaries | Metrics | Local observability stack | Agent-booted local services | Fast local setup | Requires safe service lifecycle |
| Jaeger/tracing | Trace inspection | Debugging and trajectory analysis | Trace summaries for agents | Causal debugging | Raw traces can overwhelm context |
| DataDog | Observability | Enterprise telemetry | Agent-readable incident summaries | Mature ecosystem | Vendor complexity and permissions |
| Blob/object storage | Trajectory storage | Session log collection | Knowledge distillation jobs | Scales raw data | Privacy and retention risks |
| Linear/Jira/Bitbucket | Work tracking and repo integration | Enterprise workflow connectors | Agent task routing and status sync | Existing enterprise adoption | Requires consistent state reconciliation |
| Slack and Slack ChatGPT app | Workplace interaction | Paging, feedback, culture, quick commands | Convert pages/comments into docs and tasks | Low-friction human input | Chat state can be ephemeral and noisy |
| IAM/GRC/security tooling | Enterprise controls | Identity, authorization, revocation, compliance | Frontier-style governance dashboard | Required for enterprise deployment | Heavy integration surface |
| OpenAI Frontier | Enterprise agent deployment platform | Control plane for workplace agents | Identity, observability, safety, governance | Agent deployment at scale | Product details not fully specified in transcript |
| OpenAI Agents SDK | Agent app construction | Works-by-default harness primitives | Compose shell tools, containers, file attachments | Model-native agent platform | Needs app-specific safety/context design |

## Harness Engineering Insights

### Orchestration

- High confidence: Orchestration should manage the whole delivery path, not only code editing. The land-skill concept includes push, review wait, CI, flake repair, upstream merge, merge queue, and merge.
- High confidence: Worktree-per-agent is the preferred concurrency primitive for code work because isolation is cheap and merge conflicts are manageable by agents.
- Medium confidence: Multiple parallel agent attempts can replace babysitting a single run when the objective is clear but implementation path is uncertain.

### Validation

- High confidence: Validation must be fast, explicit, and close to the changed behavior.
- High confidence: Lint and test errors should instruct the agent how to fix the issue.
- High confidence: Build duration is a validation quality metric for agent workflows.
- Medium confidence: Passing output should be suppressed; failing output should be compressed and explanatory.

### Context

- High confidence: Context should include product vision, team, customers, pilot users, beliefs, workflow rules, quality standards, and reliability constraints.
- High confidence: The best context surfaces are durable text artifacts in the repo.
- Medium confidence: Million-token contexts reduce compaction damage, but they do not remove the need for concise repo surfaces.

### Routing

- High confidence: Skills/scripts should give agents a menu of safe options instead of forcing a rigid state machine.
- High confidence: Reasoning models perform better when the harness gives them enough context to choose intelligently.
- Medium confidence: A small skill set is a routing advantage because it reduces selection noise.

### Memory

- High confidence: Agent trajectories should be collected, inspected, and distilled into team-level knowledge.
- High confidence: Repeated human feedback should become durable memory in docs, skills, lints, or tests.
- Medium confidence: Team culture, even communication style, can be modeled as operational memory for workplace agents.

### Evals

- High confidence: A run is not proven by the transcript alone; it needs compressed evidence, command results, screenshots, tests, traces, or other artifacts.
- Medium confidence: Evals should measure whether specs can reproduce implementations and whether review loops reduce divergence.
- Medium confidence: Model-version-specific evals are needed because harness behavior changed across Codex/GPT releases.

### Governance

- High confidence: Enterprise agent deployment needs identity, authorization, revocation, observability, governance dashboards, GRC integration, and safety specs.
- High confidence: Human approval remains important for high-blast-radius release/distribution actions.
- Medium confidence: Governance should be customizable per enterprise but work by default.

### Scaling

- High confidence: Architecture should scale to effective agent workforce size, not human headcount.
- High confidence: A seven-person team with 10 to 50 agents each needs stricter interfaces and decomposition than a seven-person human-only team.
- Medium confidence: Agent organizations require dashboards and control planes similar to long-running process management systems.

### Recovery

- High confidence: Rework should be cheap but must emit a learning artifact.
- High confidence: Failed builds, PR comments, pages, and thrown-away runs are recovery inputs, not dead ends.
- Medium confidence: The best recovery systems classify missing context before retrying.

## Implied Best Practices

- Keep the repo legible to agents: consistent package boundaries, patterns, languages, and command names.
- Prefer deterministic command outputs and JSON summaries for automation.
- Make the narrowest fast check available for every common change type.
- Treat new model or harness behavior as an environment change that may require repo adaptation.
- Store product and customer context near the code so agents can make product-shaped decisions.
- Use docs as active context, not archive material.
- Convert point fixes into general rules only after checking for exceptions.
- Give reviewer agents scoped authority and severity rules.
- Give author agents a protocol for disagreeing with review.
- Keep release approvals human-controlled when downstream blast radius is high.
- Design CLIs for agents: quiet success, focused failure, clear next action.
- Prefer agent-first debugging artifacts before building human dashboards.
- Make internalized dependencies observable, tested, and security-reviewed.
- Keep raw transcripts and logs out of hot-path context; promote distilled evidence.
- Maintain a model-behavior changelog when runtime behavior changes workflows.
- Use session-log reflection as a routine maintenance job.

## Failure Modes & Mitigations

### Failure: Off-Policy Harness Cage

#### Description

An external scaffold restricts the model in ways that do not align with what the model naturally produces.

#### Evidence

- Explicit evidence: Ryan warns that an external Rust scaffold around Codex would be prone to being scrapped.
- Explicit evidence: He prefers guardrails native to code, tests, docs, lints, and scripts.

#### Probable Root Cause

Safety or determinism is implemented outside the agent's ordinary work medium.

#### Severity

High.

#### Mitigation Strategy

Prefer repo-native validators, tests, policies, and scripts. Keep external controls for permissions, secrets, and revocation.

#### Recommended Guardrails

- Guardrail design review: label every control as on-policy or external-boundary.
- Require a reason when a control cannot be represented as code/docs/tests/lints/scripts.

### Failure: Context Sprawl

#### Description

The repo accumulates too many docs, tools, skills, and transcripts, causing agents to load the wrong context or overcompact.

#### Evidence

- Explicit evidence: MCP can inject too much tool context and interfere with compaction.
- Explicit evidence: The transcript favors a small shared skill set.
- Explicit evidence: Raw transcripts should be source evidence, not hot-path doctrine.

#### Probable Root Cause

Every useful artifact is promoted without a routing or compression policy.

#### Severity

High.

#### Mitigation Strategy

Keep source evidence in research folders, promote distilled rules into small hot-path files, and periodically prune or consolidate skills.

#### Recommended Guardrails

- Context budget review for every new instruction surface.
- Skill overlap audit.
- "Raw evidence is not policy" marker in research artifacts.

### Failure: Slow Validation Loop

#### Description

Builds or tests take long enough that agents stop waiting, speculate, or spend too much context managing command output.

#### Evidence

- Explicit evidence: The team retooled builds to complete under a minute.
- Explicit evidence: Build time breaches trigger build-graph decomposition.

#### Probable Root Cause

Human-era build tolerances are reused for agent workflows.

#### Severity

High.

#### Mitigation Strategy

Create fast related checks, split build graphs, and make slow checks scheduled or release-bound.

#### Recommended Guardrails

- Inner-loop time budget.
- CI output compression.
- Repeated slow gate admission as a harness defect.

### Failure: Review Non-Convergence

#### Description

Reviewer agents keep generating comments and author agents keep applying them, causing churn without better software.

#### Evidence

- Explicit evidence: Ryan says author agents should not be bullied by review feedback.
- Explicit evidence: Review agents were biased toward merge and severity discipline.

#### Probable Root Cause

Review lacks authority boundaries, severity thresholds, or disagreement protocol.

#### Severity

Medium to high.

#### Mitigation Strategy

Define review severity, merge/block criteria, and author response options.

#### Recommended Guardrails

- Required status line: merge-blocking, advisory, or defer.
- Author response taxonomy.
- Human escalation on repeated reviewer-author disagreement.

### Failure: Disposable Code Without Learning

#### Description

Teams throw away bad agent work but do not capture why it failed.

#### Evidence

- Explicit evidence: Ryan says code is disposable.
- Explicit evidence: Rework in Symphony should ask why the work was trashed and fix the context/harness.

#### Probable Root Cause

The economic ease of rerunning hides the need for root-cause capture.

#### Severity

High.

#### Mitigation Strategy

Require every discarded run to emit missing-context classification before retry.

#### Recommended Guardrails

- Rework artifact with reason, missing context, and next guard.
- Cap blind retries.
- Compare failures across runs before starting another.

### Failure: Human Approval Drift

#### Description

Automation expands into release, distribution, security, or enterprise actions without preserving human approval where blast radius requires it.

#### Evidence

- Explicit evidence: Native app distribution still required a blessed human smoke test.
- Explicit evidence: Frontier emphasizes identity, authorization, revocation, security, GRC, and safety specs.

#### Probable Root Cause

Agent success in code editing is mistaken for authority to perform all lifecycle actions.

#### Severity

Critical.

#### Mitigation Strategy

Separate execution autonomy from authority. Keep high-blast-radius gates explicit.

#### Recommended Guardrails

- Approval matrix by action type.
- Revocation hooks.
- Human smoke-test requirement for release/distribution.
- Audit log of who or what approved each step.

### Failure: Tool Context Overload

#### Description

Tools, MCP servers, or CLIs expose too much surface, consuming context and making the agent less effective.

#### Evidence

- Explicit evidence: MCP can inject too much tool context and interfere with compaction.
- Explicit evidence: Large generic CLIs and build systems can be too noisy unless wrapped.

#### Probable Root Cause

Human-flexible interfaces are given to agents without summarization or routing.

#### Severity

Medium.

#### Mitigation Strategy

Wrap tools with task-specific commands and quiet outputs.

#### Recommended Guardrails

- Agent-facing command catalog.
- Failure-first output format.
- Tool context budget.

### Failure: Stale Persistent Rules

#### Description

A local correction is persisted globally, then later becomes wrong or blocks legitimate exceptions.

#### Evidence

- Explicit evidence: The interviewer raises concern that persisted rules can miss exceptions and require rollback.
- Explicit evidence: Ryan's workflow encourages durable encoding of process knowledge.

#### Probable Root Cause

No distinction between local fix, general principle, and exception-bearing policy.

#### Severity

Medium.

#### Mitigation Strategy

Use scoped rules with owner, evidence, exceptions, and expiry/review criteria.

#### Recommended Guardrails

- Rule admission template.
- Exception registry.
- Periodic stale-rule audit.

### Failure: Hard/New Work Over-Automation

#### Description

Agents are pushed into tasks where the human does not yet know the missing context or desired product shape.

#### Evidence

- Explicit evidence: Ryan says models are not yet there for new product idea to prototype in one shot.
- Explicit evidence: White-space projects require synchronous interaction because missing bits are discovered during the trajectory.

#### Probable Root Cause

The team applies established-work automation to exploratory product work.

#### Severity

Medium to high.

#### Mitigation Strategy

Use agents to explore options, surface missing decisions, and prototype slices, but keep humans in the steering loop.

#### Recommended Guardrails

- Classify work as easy/established, hard/established, or hard/new before delegation.
- Require product decision artifacts before full autonomy.

### Failure: Internalized Dependency Risk

#### Description

A small dependency is brought in-house for agent legibility or customization, losing upstream battle-testing.

#### Evidence

- Explicit evidence: Ryan says a couple-thousand-line dependency can be cheaper to internalize, but the curated extraction notes this loses battle-tested scale and security properties unless confidence is rebuilt.

#### Probable Root Cause

Code is cheap to generate, but security and operational confidence are not automatically cheap.

#### Severity

Medium.

#### Mitigation Strategy

Only internalize with tests, security review, ownership, and upgrade/replacement criteria.

#### Recommended Guardrails

- Internalized dependency manifest.
- Security-agent review.
- Fuzz or regression tests for copied behavior.
- Exit criteria for returning to upstream.

## Reusable Techniques

- Create a `missing-context` classifier for failed runs and PR comments.
- Add a `rework.md` artifact template: discarded run, reason, missing context, next guard.
- Maintain a `core-beliefs.md` style file with product, team, customer, pilot, and 12-month vision context.
- Convert repeated review comments into lints with repair-oriented messages.
- Add command wrappers that output quiet success and focused JSON failure.
- Track inner-loop command durations and fail when they exceed agent budgets.
- Run a scheduled "session roast" or reflection job over Codex trajectories to find workflow improvements.
- Use worktree-per-agent with deterministic artifact naming.
- Require review agents to output severity, merge-blocking status, and remediation.
- Require author agents to respond to review with accept/defer/reject/escalate.
- Store raw transcripts under research, then promote only distilled operational rules.
- Attach compressed evidence to PRs instead of raw transcripts or full recordings.
- Use ASCII or structured text representations for visual/UI evidence when direct visual reasoning is unreliable.
- Provide an agent-bootable observability stack with status and teardown commands.
- Keep human approval gates for release, distribution, credentials, and policy changes.
- Build evals that test whether a spec can recreate an implementation, not just whether prose exists.
- Maintain a model/runtime behavior changelog for agent workflow changes.

## Strategic Insights

- The value is shifting from writing code to building systems that reliably generate, validate, review, ship, observe, and improve code.
- Agentic scale changes architecture: effective team size includes agent workers, not just humans.
- Text-shaped organizational knowledge becomes an execution substrate.
- CI/CD becomes an agent control system, not only a human quality gate.
- Observability must be dual-use: readable by humans and directly consumable by agents.
- Skills are an organizational taste container. Skill sprawl is an operational risk.
- Enterprise agent deployment is primarily a governance and integration problem once agents are capable enough.
- The best harnesses will preserve model upside by using on-policy controls while reserving external controls for authority, secrets, and safety boundaries.
- The strongest teams will turn every repeated human correction into a system improvement before it becomes culture debt.

## Key Quotes & Evidence

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

## Final Assessment

### Strongest Ideas

- Feedback conversion loop: every correction becomes docs, lints, tests, skills, scripts, or observability.
- Human attention as the bottleneck.
- One-minute inner-loop as agent infrastructure.
- On-policy guardrails.
- Worktree-per-agent parallelism.
- Spec-as-software distribution.
- Agent-owned observability.

### Weakest Areas

- Post-merge human review can become risky without strong rollback and monitoring.
- Persisted rules can overfit without exception handling.
- Tool and context sprawl can silently degrade agent performance.
- Hard/new product work still requires human context discovery.
- Internalizing dependencies shifts security and maintenance burden onto the team.

### Most Reusable Concepts

- Missing-context telemetry.
- Small high-density skills.
- Review disagreement protocol.
- Rework-with-learning artifact.
- Agent-readable observability bundles.
- Quiet-success/focused-failure CLI design.

### Highest Leverage Opportunities

- Build a reusable feedback-admission workflow.
- Add duration budgets to agent-critical validation commands.
- Create a compact Project Brain file for product/customer/team context.
- Turn reviewer comments into validator/lint candidates.
- Add post-run trajectory reflection as a scheduled maintenance flow.

### Most Important Risks

- Autonomy outrunning authority.
- Context sprawl masquerading as memory.
- Slow validation causing shallow or unverified work.
- Review-agent churn.
- Raw evidence entering hot-path instruction context.

### Immediate Implementation Candidates

- Add a `missing-context` field to PR closeout or phase-exit artifacts.
- Create `.harness/research/deep/` as the destination for evidence extraction artifacts.
- Add a `rework-from-scratch` template with mandatory learning capture.
- Add a validator that checks repeated steering is admitted into a durable destination or explicitly rejected.
- Build a command-output guideline: quiet pass, actionable fail, JSON when feeding automation.

