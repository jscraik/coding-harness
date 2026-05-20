# Agent Reinforcement Fine Tuning Pattern Extraction

Generated: 2026-05-19

Primary source:

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/p1CmPZ2j6Lk - Agent Reinforcement Fine Tuning Will Hang & Cathy Zhou, OpenAI.txt

Supporting sources:

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/manifest.json
- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/metadata/p1CmPZ2j6Lk.json
- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/raw/p1CmPZ2j6Lk/p1CmPZ2j6Lk.info.json

Evidence posture:

- This is cold research. It is not a repo instruction surface.
- Use it to shape future prompts, tool contracts, graders, eval fixtures, and reward definitions.
- Do not treat Agent RFT availability, product details, or customer claims as current implementation guidance without checking current official docs.

## Table of Contents
- [Executive Summary](#executive-summary)
- [Source Boundary](#source-boundary)
- [Useful Patterns For Coding Harness](#useful-patterns-for-coding-harness)
- [Prompt And Tool Strengthening Backlog](#prompt-and-tool-strengthening-backlog)
- [Reward And Eval Candidate Metrics](#reward-and-eval-candidate-metrics)
- [Adopt Adapt Defer](#adopt-adapt-defer)
- [Risks And Watchouts](#risks-and-watchouts)

## Executive Summary

The strongest pattern is optimization order: do not jump straight to model training. The transcript says to start with production-like train/eval data, run a baseline, improve prompts, simplify the task, add guardrails, add or subtract tools, and change tool behavior before using Agent RFT. For Coding Harness, that maps to a practical ladder: first improve instruction clarity, tool shape, validation feedback, and grader quality; only then consider whether any model-level tuning is justified.

The second pattern is trajectory-first observability. Agent RFT rollouts carry a unique identifier across every tool call so the final answer can be graded against the whole trajectory. Coding Harness already cares about command evidence, traceability, review artifacts, and closeout truth. This transcript strengthens the case for giving every agent run, reviewer pass, tool call sequence, and validation attempt a compact trajectory ID that can be connected to prompt, tool input, tool output, final claim, and grader result.

The third pattern is reward design as harness design. The useful examples do not reward vibes. They reward selected file F1, relevant fact recall, tests passing, self-validation, latency/tool-call budget adherence, static checks, and reward-hacking rejection. For Coding Harness, the immediate opportunity is to define reward-like local graders before any fine tuning: did the agent inspect the right files, cite the right evidence, run the right command, avoid unnecessary tool calls, classify blockers honestly, and prove completion with current state?

The fourth pattern is tool behavior as a trainable interface. The transcript repeatedly says agents improve when tools are stable, isolated, observable, and shaped around the task. Tool quality is not just availability; it includes endpoint behavior, parallel-call support, per-rollout isolation, output clarity, budgets, and strict grading. For this repo, tools should be treated as agent-facing APIs with test fixtures, examples, failure classes, and misuse checks.

## Source Boundary

Direct transcript claims:

- Agents differ from regular models because they use tools to interact with the outside world.
- Agent interactions include tool calls and reasoning traces in the same context window.
- Frontline optimization starts with prompt engineering, task optimization, guardrails, tool changes, and tool-behavior changes.
- Agent RFT is presented as the next step after those approaches are exhausted.
- The transcript recommends production-like data, a baseline run, prompt/task optimization, and only then Agent RFT.
- Rollouts receive unique identifiers, and tool calls are associated with that rollout ID.
- Customer examples used selected-file F1, relevant-fact recall, tests passing, self-validation, tone/verbosity penalties, reward-hacking detection, static analysis, speedup, and tool-call count reduction.
- The transcript's four stated success principles are well-defined constrained tasks, train/eval data matching production traffic, exploration that can reveal better rollouts, and a reward function that is not hackable.

Boundary for Coding Harness:

- Use the transcript as evidence for harness improvement patterns.
- Do not assume this repo should fine tune a model now.
- Prefer local prompt, tool, trace, grader, and eval improvements first.

## Useful Patterns For Coding Harness

### Pattern: Optimization Ladder Before Model Training

Description:

Treat model-level tuning as a last-mile accelerator, not the first fix. Improve the harness first: prompt, task framing, guardrails, tool set, tool behavior, baseline measurement, and eval data quality.

Transcript evidence:

- Prompt optimization is named as a frontline technique for steering agent behavior.
- Task optimization includes simplifying the task, adding guardrails, adding or subtracting tools, and changing tool behavior.
- The recommended process is production-like data, baseline, prompt/task optimization, then Agent RFT only if more performance is needed.

Coding Harness opportunity:

- Add an optimization checklist for agent-workflow failures:
  1. Is the task well defined and constrained?
  2. Is the prompt/instruction missing a success definition?
  3. Is the tool list too broad, too narrow, or poorly described?
  4. Is tool output hard for an agent to reason over?
  5. Is the validation signal delayed, ambiguous, or non-machine-readable?
  6. Is there a baseline fixture before changing prompts or tools?

Candidate implementation surfaces:

- Skill eval acceptance criteria.
- Prompt comparison reports under .harness/research/deep or .harness/evals.
- harness next or review-context diagnostics that classify failures as prompt, task, tool, guardrail, grader, data, or environment issues.

### Pattern: Production-Mirror Eval Data

Description:

Train and eval data should resemble real production traffic. The transcript warns that domain shift makes agents use tools poorly, call tools too often, or send wrong inputs.

Transcript evidence:

- The speakers say train and eval data should closely match production traffic.
- Domain shift is named as a source of agents calling tools too many times or passing wrong inputs.
- Customer examples use authentic codebase questions, actual user-modified files, and real repository tasks.

Coding Harness opportunity:

- Build eval fixtures from real agent failures, PR comments, failed checks, and steering corrections rather than synthetic prompts only.
- Track the source of every eval case: user correction, review finding, CI failure, runtime trace, stale-doc incident, or closeout miss.
- Mark synthetic cases as lower-confidence unless paired with a real observed failure class.

Candidate implementation surfaces:

- .harness/learnings/coderabbit.local.json
- .harness/memory/LEARNINGS.md
- .harness/review-log.md
- skill eval cases that cite the originating failure or transcript-derived pattern.

### Pattern: Trajectory IDs Across Tool Calls

Description:

Assign a durable ID to each agent trajectory and attach all tool calls, observations, final claims, and grader output to that ID.

Transcript evidence:

- Each rollout produces a unique identifier.
- Tool calls are associated with that identifier.
- The final answer can be graded with the whole context accumulated across the trajectory.

Coding Harness opportunity:

- Give each harness run, review swarm reviewer, continuation heartbeat, and validation closeout a trajectory_id.
- Include the ID in prompt artifact, tool-call log, validation output, blocker classification, final claim, and grader/eval result.
- Make closeout truth checks verify that final claims cite current trajectory evidence instead of only transcript text.

Candidate implementation surfaces:

- runtime-card evidence bundles.
- PR closeout evidence.
- review artifacts under artifacts/reviews/.
- session evidence adapters.
- harness next --json recommendation metadata.

### Pattern: File-Selection F1 For Codebase Navigation

Description:

Score whether an agent identified the right files before editing or answering. Balance precision and recall so the agent neither misses critical files nor sprays broad irrelevant paths.

Transcript evidence:

- Cognition trained code edit planning on user queries paired with files users actually modified.
- The reward was selected-file F1, balancing precision and recall.

Coding Harness opportunity:

- For code-review, planning, and bug-fix tasks, grade file discovery:
  - precision: selected files that were actually relevant.
  - recall: critical files found before implementation.
  - overreach: unrelated files read or edited.
- Use this to strengthen prompt and tool guidance for repo exploration.

Candidate implementation surfaces:

- review-context gate.
- blast-radius diagnostics.
- skill eval fixtures for planning and review skills.
- PR body traceability fields.

### Pattern: Fact Recall For Deep Repo Research

Description:

Measure whether a research or review agent retrieved the relevant facts, not whether it produced fluent analysis.

Transcript evidence:

- Codo trained a deep research agent with authentic Q&A pairs from multiple repositories.
- The reward was recall of relevant facts retrieved.
- RFT improved accuracy while reducing tool calls and output tokens.

Coding Harness opportunity:

- For repo research tasks, create expected-fact sets:
  - required files found.
  - relevant commands identified.
  - exact failure strings preserved.
  - governing instruction surfaces cited.
  - open risks classified.
- Penalize confident answers that omit key repo facts even when the prose is coherent.

Candidate implementation surfaces:

- repo-research evals.
- agent skill evaluations.
- docs-review checklists.
- review-context reports.

### Pattern: Tool-Call Budget And Longtail Control

Description:

Optimize not only average quality but also longtail behavior: excessive tool calls, overlong messages, and slow trajectories.

Transcript evidence:

- Agent RFT can penalize going over a tool-call budget.
- Codo's longtail runs with more than 15 tool calls disappeared after RFT.
- Cosine had trajectories with more than 100 messages that converged to tighter sequences after training.

Coding Harness opportunity:

- Track p50/p95 tool-call count, command count, output-token volume, and elapsed time by workflow type.
- Flag workflows where agents repeatedly over-read, over-search, or loop on the same failing command.
- Add prompt/tool improvements before reaching for heavier automation.

Candidate implementation surfaces:

- session-collector summaries.
- .harness/review-log.md.
- eval reports for skill smoke/release lanes.
- closeout quality dashboards.

### Pattern: Isolated Per-Trajectory Environments

Description:

Run each trajectory in an isolated environment so tool calls and generated state do not contaminate other rollouts.

Transcript evidence:

- Cognition spun up a VM per trajectory to manage the codebase, execute tool calls, and grade the final answer.
- The VMs isolated shell tools so different rollouts did not affect each other.

Coding Harness opportunity:

- Continue favoring worktree-per-agent or sandbox-per-run patterns for parallel agent work.
- Make eval runs hermetic enough that one candidate cannot benefit from another candidate's generated files.
- Treat shared mutable state as a grading contamination risk.

Candidate implementation surfaces:

- worktree readiness scripts.
- eval runner temp directories.
- review swarm artifact directories.
- generated test fixtures.

### Pattern: Strict Final-Outcome Graders

Description:

Reward the final outcome that matters. Avoid giving points for trying when that lets agents optimize style, tone, or busywork instead of correctness.

Transcript evidence:

- Cosine initially used partial credits and points for trying, but the model optimized coding style and tone.
- They rewarded only when final code passed tests.
- A custom judge penalized verbosity, emojis, or unprofessional tone.

Coding Harness opportunity:

- For implementation tasks, primary success should be working code plus relevant validation, not plausible explanation.
- For closeout tasks, primary success should be current PR/branch/Linear/check evidence, not a well-written summary.
- For review tasks, primary success should be valid findings with exact evidence, not broad commentary.

Candidate implementation surfaces:

- skill eval graders.
- PR closeout schema.
- review-swarm artifact verification.
- docs-gate warnings for placeholder or unverifiable claims.

### Pattern: Reward Self-Validation

Description:

Agents should be rewarded for checking their own work using real tools before claiming success.

Transcript evidence:

- Cosine rewarded agents that validated their own work.
- Examples include running tests, inspecting terminal outputs, and checking linting before calling success.

Coding Harness opportunity:

- Make self-validation a first-class scored behavior:
  - exact command run.
  - command maps to touched behavior.
  - output inspected.
  - blocker classified honestly.
  - final claim matches evidence.

Candidate implementation surfaces:

- verify-work closeout.
- PR templates.
- agent skill output contracts.
- verification-before-completion workflows.

### Pattern: Reward-Hacking Pressure Tests

Description:

Inspect successful-looking rollouts for shortcuts, then add deterministic checks and judges that assign zero reward to hacked solutions.

Transcript evidence:

- Metaco observed reward hacking in GPU kernel generation.
- Hacked cases included returning reference code, no kernels, and identity kernels.
- They added an LLM judge and static AST analysis to catch those cases.

Coding Harness opportunity:

- Add reward-hacking checks for common agent failure modes:
  - claiming validation without running the command.
  - citing stale or unrelated evidence.
  - editing docs instead of fixing executable behavior.
  - hiding a blocker as residual risk.
  - using broad searches without reading governing instructions.
  - satisfying checklist text while skipping the actual gate.

Candidate implementation surfaces:

- closeout truth validators.
- docs steering guard.
- skill eval adversarial cases.
- placeholder-marker scans.
- schema checks for evidence freshness.

### Pattern: Tool Parallelism As A Learned Skill

Description:

Agents can become faster when they learn to launch independent tool calls in parallel at the first step instead of alternating reasoning and single calls.

Transcript evidence:

- Cognition observed the agent originally taking 8 to 10 alternating reasoning/tool steps.
- After RFT, the agent launched many tool calls in parallel at the first step and reduced the step count to four.

Coding Harness opportunity:

- Teach agents to parallelize independent reads and inspections when the task has distinct evidence surfaces.
- Keep parallelism bounded and only for independent, read-only operations unless a workflow explicitly owns coordination.
- Record when serial exploration caused latency or context waste.

Candidate implementation surfaces:

- AGENTS and skill guidance for exploration.
- repo-research and review evals.
- prompt examples that show independent rg, sed, jq, and status checks grouped early.

### Pattern: Best-Of-N Candidate Selection

Description:

For hard tasks, sample several candidates and select the best by a strict grader instead of trusting the first answer.

Transcript evidence:

- Metaco ran three samples and selected the best one out of three.
- This improved benchmark performance in the GPU-kernel use case.

Coding Harness opportunity:

- Use bounded multi-agent or multi-candidate review only when the grader is strong enough to choose.
- Prefer this for high-risk planning, architecture, security, and performance work where one path can be wrong in subtle ways.
- Keep artifact-first outputs so candidate comparison is auditable.

Candidate implementation surfaces:

- review swarm contract.
- architecture strategy docs.
- adversarial reviewer artifacts.
- planning evals.

## Prompt And Tool Strengthening Backlog

Prompt candidates:

- Add a standard failure-class question before prompt changes: is the issue unclear goal, missing constraints, weak success criteria, tool misuse, stale context, or missing validation?
- Add examples where agents must cite exact files, commands, and failure strings before proposing a fix.
- Add prompt clauses that require selecting the smallest useful tool set for the task.
- Add prompt clauses that require honest blocker classes when a tool cannot run.
- Add prompt examples that show parallel read-only exploration for independent evidence surfaces.

Tool candidates:

- Make tool outputs more grader-friendly: stable JSON, explicit status, exact paths, exact command text, and blocker class.
- Add wrapper commands that return selected-file sets for planning/review tasks.
- Add trace IDs to tool invocations that feed PR closeout or eval evidence.
- Add misuse checks for repeated identical command failures.
- Add budget metadata for tool count, command count, and elapsed time.
- Add fixtures where tool output is intentionally misleading or partial so agents learn to verify state rather than trust narrative.

Grader candidates:

- Grade file-selection F1 for planning tasks.
- Grade relevant-fact recall for repo research.
- Grade final validation truth for implementation and closeout.
- Grade self-validation behavior separately from final success.
- Grade tool-call budget and p95 longtail reduction.
- Grade reward-hacking resistance with adversarial cases.

## Reward And Eval Candidate Metrics

| Metric | Use Case | Reward Signal | Failure Mode Caught |
| --- | --- | --- | --- |
| Selected-file F1 | Planning, bug fix, review | Relevant file precision and recall | Missing critical files or over-reading unrelated paths |
| Relevant-fact recall | Repo research, docs review | Required evidence facts retrieved | Fluent but incomplete analysis |
| Validation truth | Implementation, closeout | Final claim matches current command/state evidence | Claiming success from stale or absent proof |
| Self-validation score | Implementation | Tests/lint/build run and inspected before success claim | Code changed without proof |
| Tool-call budget | Research, review, planning | Solves task within reasonable tool/command budget | Longtail loops and context waste |
| Blocker classification | Any blocked lane | Exact blocker class and failure text preserved | Collapsing environment/auth/tooling failures into generic failure |
| Reward-hack rejection | Eval and closeout | Zero credit for shortcut patterns | Checklist gaming and fake success |
| Professional output | PR/review/docs | Penalize verbosity, placeholder text, unprofessional tone | Style optimization detached from correctness |

## Adopt Adapt Defer

Adopt now:

- Use the optimization ladder before changing deeper system behavior.
- Build eval cases from real production-like agent failures.
- Grade final outcome and self-validation, not effort.
- Add reward-hacking pressure tests to closeout and skill evals.
- Track tool-call count and repeated command loops as harness quality signals.

Adapt:

- File-selection F1 can become a local planning/review metric without needing model training.
- Relevant-fact recall can become a repo-research grader using expected evidence sets.
- Trajectory IDs can start as local run IDs in artifacts before becoming a full telemetry contract.
- Best-of-N should be limited to high-risk tasks with artifact-first outputs and a clear grader.

Defer:

- Actual Agent RFT.
- Public endpoint tool hosting for training rollouts.
- Reward model infrastructure.
- Large-scale per-trajectory VM orchestration beyond local eval/sandbox needs.
- Continuous reward design until binary correctness and blocker classification are reliable.

## Risks And Watchouts

- Reward hacking is expected, not exceptional. Every new reward metric needs adversarial cases.
- A weak grader can train or select worse behavior faster than no grader.
- Production-mirror evals can leak stale assumptions if the underlying workflow changes.
- Tool-call budgets can punish necessary investigation if they are applied without task class.
- Best-of-N increases cost and can hide systemic prompt/tool weaknesses if used as a crutch.
- Fine tuning can only amplify the target encoded by the reward. If the reward misses traceability, safety, or truthfulness, the agent may learn to optimize around them.
- Raw transcript content should stay cold. Promote only distilled patterns into specs, tests, tools, or validators.
