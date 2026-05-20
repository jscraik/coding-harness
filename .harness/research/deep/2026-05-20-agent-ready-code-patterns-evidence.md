# Agent-Ready Code Patterns Engineering Intelligence

Generated: 2026-05-20

Primary source:

- .harness/research/2026-05-20-agent-ready-code-patterns-evidence.md

Source sources analyzed inside the primary artifact:

- https://bits.logic.inc/p/ai-is-forcing-us-to-write-good-code
- https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
- https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html

Evidence posture:

- This is a deep extraction from an existing Coding Harness research artifact.
- It is not a repo instruction surface and does not create policy by itself.
- Evidence labels distinguish direct source evidence, inferred insight, and speculative interpretation.
- Promote any recommendation only after live repo inspection, owner selection, and validation proof.
- The most important boundary: external advice is evidence for possible harness design, not proof that Coding Harness currently has or needs a given implementation.

## Command Summary

BLUF: This document converts the agent-ready-code pattern artifact into an engineering intelligence report for Jamie, future agents, and reviewers who need reusable harness primitives rather than another article summary. The core finding is that agent effectiveness is mostly a systems-design problem: typed boundaries, executable proof, navigable file layout, compact codemaps, fast isolated validation, and drift controls shrink the space in which an agent can be wrong. It matters because these patterns turn vague article advice into candidate repo guards, evals, and workflow checks without pretending they are already adopted policy. The next action is to use the high-confidence patterns here as candidate validators, eval rubrics, command-boundary conventions, and architecture-review prompts, while treating all implementation claims as blocked until checked against the live Coding Harness repo.

Decision Needed: Decide which extracted pattern becomes a tracked Coding Harness improvement first: parse-boundary contract review, codemap/file-adjacency audit, changed-behavior proof guard, isolation/run-id artifact discipline, or single-source-of-truth drift inventory.

Top Risks: The main risk is over-promoting article-derived wisdom into repo policy without current evidence. Secondary risks are coverage-metric theater, file-splitting without navigability, type ceremony without operational payoff, stale architecture docs, and validators that check but fail to return proof-carrying artifacts.

Next Action: Pick one candidate, inspect current repo surfaces, define the owner command or document, add a focused validator or eval fixture, and record exact command outcomes before treating the pattern as adopted.

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

The source artifact is already a useful pattern map, but the deeper engineering intelligence is sharper: agent-readiness is not a prompt problem first. It is a proof, boundary, navigation, and feedback-loop problem. Agents perform better when the repository reduces ambiguity before the agent starts choosing: precise types, parser-like input boundaries, generated contracts, small coherent modules, explicit architecture maps, fast checks, isolated worktrees, and evidence-bearing closeout states.

The most reusable pattern is proof-carrying transformation. The "Parse, don't validate" theme generalizes far beyond input parsing. A validator that returns no usable artifact is weak harness design. A harness command should parse raw flags, paths, PR state, gate output, or reviewer text into a stronger domain object that downstream code must use. That object becomes a compact proof token. It can then flow into review artifacts, runtime cards, PR closeout claims, and eval graders.

The second major pattern is navigability as an operational control. File layout, command names, type names, and architecture docs are not merely human aesthetics. They are the first retrieval layer for agents. A bad filesystem map causes over-search, wrong-file edits, hidden dependency mistakes, and token waste. A compact codemap plus semantically named modules can reduce both human cognitive load and agent tool-call volume. In harness terms, `ARCHITECTURE.md` should function as terrain: `AGENTS.md` defines behavior, `CODESTYLE.md` defines implementation taste, `ARCHITECTURE.md` defines system shape and boundaries, and `.harness/**` carries evidence, plans, reviews, memory, and operational state.

The third major pattern is evidence velocity. Agents need cheap feedback because they iterate by changing, checking, and correcting. Slow gates, manual setup, shared mutable environments, and vague error output turn agent work into speculation. Fast local lanes, deterministic fixtures, isolated worktrees, structured outputs, and exact blocker classes are not convenience features. They are correctness infrastructure.

The highest-leverage Coding Harness opportunities are: a parse-boundary review/eval rubric, a codemap-to-file-adjacency audit, a changed-behavior proof guard, an isolation/run-id contract for parallel agents, and a single-source-of-truth drift inventory for generated mirrors. The critical warning is that none of this should become broad policy from the article alone. Each pattern needs a repo-owned surface, current evidence, and a narrow proving command.

## Evidence Model

High confidence:

- The primary artifact explicitly identifies guardrails, proof preservation, filesystem navigation, fast validation, typed boundaries, and codemap discipline as repeated themes.
- The primary artifact explicitly says the research is cold external research and not an instruction surface.
- The primary artifact already maps many candidate implementation surfaces inside Coding Harness.

Medium confidence:

- The patterns can be generalized into harness primitives such as validators, eval rubrics, command-boundary conventions, and review prompts.
- Some source claims imply useful workflow design even when they were not originally framed as harness engineering.

Low confidence:

- Any claim about the current live quality of Coding Harness implementation.
- Any claim that a specific repo module is currently deficient without inspecting it.
- Any claim that adopting a global coverage threshold or major architecture-document change would be net positive.

Evidence labels used below:

- Explicit evidence: directly stated in the primary artifact or its source-boundary extraction.
- Inferred insight: derived from repeated patterns, examples, or operational consequences.
- Speculative interpretation: plausible future use that needs repo verification.

## Core Engineering Patterns

### Pattern: Proof-Carrying Boundary Transformation

#### Description

Convert weak external input into strong internal domain values at the boundary, then require downstream work to consume the stronger value. This applies to CLI flags, JSON, file paths, PR metadata, review comments, gate output, runtime-card evidence, and Linear/GitHub state.

#### Evidence

- Explicit evidence: The source artifact says a parser consumes less-structured input and produces more-structured output.
- Explicit evidence: It says validation that returns no useful value throws away the knowledge it just learned.
- Explicit evidence: It recommends parsing raw flags, JSON, file paths, review comments, gate outputs, and PR metadata into typed domain records at command boundaries.

#### Why It Matters

Agents are poor at remembering invisible invariants across long tasks. If a command returns only "valid" or throws on failure, the proof disappears from the workstream. A proof-carrying object lets the type system, schema, or artifact state enforce what was learned. This reduces repeated checking, impossible branches, and false completion claims.

#### Implementation Opportunities

- Replace critical boolean validation helpers with parse/classify/build functions that return named result objects.
- Make command handlers separate parse phase from execution phase.
- Encode required evidence per gate state: pass requires source and freshness; blocked requires blocker class and next step; not_run requires reason.
- Add an eval case that fails when a command validates input but continues passing raw input downstream.

#### Risks / Tradeoffs

- Type precision can become ceremony if it models low-value states.
- Boundary objects can bloat if every possible detail is preserved.
- Overzealous parsing can delay useful exploratory commands.
- Bad error design can hide the original user-facing failure behind domain jargon.

### Pattern: Validation Must Produce An Artifact, Not Just Absence Of Error

#### Description

A validation step is stronger when it emits structured proof that the next step needs. A silent pass, empty return, or process exit alone is weaker for agents because it is harder to cite, inspect, replay, or grade.

#### Evidence

- Explicit evidence: The source artifact warns against void validators for critical proof.
- Explicit evidence: Coding Harness guidance requires exact command outcomes beside command text.
- Inferred insight: If final closeout claims depend on current evidence, validators should emit evidence objects or artifact references.

#### Why It Matters

Agents frequently conflate "a command exited zero" with "the workflow is complete." A structured artifact can say what was checked, what was not checked, which inputs were used, and which claims it supports. This makes closeout and review less dependent on agent memory.

#### Implementation Opportunities

- For high-risk validators, emit JSON with schema_version, status, checked_inputs, evidence_refs, freshness, blocker, and next_step.
- Require PR closeout claims to cite evidence object IDs instead of free-text gate names.
- Add a lint rule or review rubric for critical check functions that return void or bare boolean.
- Store reviewer artifact verification as a required object, not mailbox text.

#### Risks / Tradeoffs

- Artifact sprawl can create its own maintenance burden.
- Structured outputs can be faked unless tied to real command execution.
- Some fast checks are fine as exit-code-only if they are narrow and low-risk.

### Pattern: Changed-Behavior Proof Beats Coverage Theater

#### Description

Coverage is useful when it acts as an executable ledger for changed behavior. The operational goal is not to worship a metric; it is to force every changed behavior to have a runnable example or an explicit blocker.

#### Evidence

- Explicit evidence: The Logic article section says 100% coverage is used to force executable examples for every line an agent changed, not as a no-bugs guarantee.
- Explicit evidence: The source artifact adapts this to Coding Harness as "executable proof for changed behavior" rather than a blanket 100% coverage mandate.
- Inferred insight: The same idea applies to docs-gate, runtime-card, PR closeout, and review-gate changes: prove the changed path directly.

#### Why It Matters

Agents often make plausible edits and then stop at prose. Executable examples collapse ambiguity. They also turn edge cases into concrete tests and expose unreachable or dead code.

#### Implementation Opportunities

- Add closeout language: changed behavior must have a direct test, focused command, or blocked proof note.
- For agent-authored PRs, require a changed-path proof table.
- Add eval cases where the agent must reject "tests pass" if the touched path was not exercised.
- Extend review-gate to classify proof as direct, indirect, missing, or blocked.

#### Risks / Tradeoffs

- A strict coverage metric can reward shallow assertions.
- Some important behavior is hard to test directly; forcing it may cause brittle tests.
- The repo should not import another team's coverage threshold without a decision and cost model.

### Pattern: Filesystem Layout Is Agent UX

#### Description

The file tree is an agent interface. Agents search filenames, list directories, load files, and infer responsibilities from path names. Domain-shaped layout reduces search cost and wrong-file edits.

#### Evidence

- Explicit evidence: The source artifact says filesystem structure is a main navigation mechanism for agentic tools.
- Explicit evidence: It says meaningful paths communicate more than generic helper paths.
- Explicit evidence: It maps this to command-family entrypoints, review evidence, closeout claims, runtime cards, validation gates, and artifact routing.

#### Why It Matters

A human maintainer carries a mental map. An agent starts cold. File layout is the first map the agent sees. Bad names cause broad search, context waste, and implementation in the wrong layer.

#### Implementation Opportunities

- Add "agent navigation surface" to architecture and review audits.
- Flag generic utility files that hide domain ownership.
- Require command-family splits to include a public entrypoint and local tests.
- Add blast-radius or review-context output that reports file-name specificity and entrypoint clarity.

#### Risks / Tradeoffs

- Splitting files without a codemap increases scatter.
- File layout refactors can be expensive and destabilizing.
- Generic helpers are sometimes appropriate for truly cross-cutting primitives.

### Pattern: Codemap Before Atlas

#### Description

Architecture docs should be compact physical maps that help agents and humans answer "where is X?", "what does this component do?", "what must not be broken?", and "which evidence proves I understood this boundary?" They should not duplicate volatile implementation details. For agent-ready repositories, `ARCHITECTURE.md` is a navigation and control surface, not a polished explainer.

#### Evidence

- Explicit evidence: The source artifact says architecture docs should be short, stable, physical, and navigational.
- Explicit evidence: It says the codemap is a country map, not an atlas.
- Explicit evidence: It says to name important files, modules, and types, while avoiding stale direct links.
- Inferred insight: The useful division is `AGENTS.md` for behavior, `CODESTYLE.md` for implementation standards, `ARCHITECTURE.md` for terrain and invariants, and `.harness/**` for evidence and operational memory.
- Inferred insight: A repo-level architecture file should expose entrypoints, boundaries, data/state flow, validation model, agent navigation routes, sharp edges, and update rules.

#### Why It Matters

Agents need routing help, not encyclopedic prose. A short codemap reduces initial search and makes boundaries visible. Long architecture docs drift and become another misleading context source. The highest-value version bridges the maintainer mental map to an agent execution model: where to start, what not to cross, what state is authoritative, and what validation proves the route was understood.

#### Implementation Opportunities

- Keep architecture bootstrap docs focused on command families, boundaries, invariants, and ownership.
- Treat `ARCHITECTURE.md` as the first route map from zero context to safe action.
- Include entrypoints, core modules, boundaries, invariants, data/state flow, validation model, agent navigation, known sharp edges, and update rules.
- Wire update rules to architecture-adjacent changes: either refresh the map/context or record why no architecture change occurred.
- Generate or refresh diagram context only when architecture-adjacent changes demand it.
- Add codemap freshness checks that compare documented boundaries to physical file adjacency.
- Keep implementation details close to code and tests.

#### Risks / Tradeoffs

- Too little detail can leave agents under-oriented.
- Naming files without links helps avoid stale URLs but may slow some human readers.
- Generated architecture context can still drift if generator ownership is unclear.
- If `ARCHITECTURE.md` repeats `README.md`, `AGENTS.md`, or implementation trivia, it becomes another stale mirror instead of an execution aid.

### Pattern: Negative Invariants Need Positive Surfaces

#### Description

Rules defined by absence are hard to infer. "Do not treat route-decision labels as gate proof" or "no completion from green checks alone" needs a schema, validator, or explicit doc because no symbol in code naturally reveals the absence.

#### Evidence

- Explicit evidence: The Architecture article extraction says important invariants are often expressed as absence.
- Explicit evidence: The source artifact lists negative invariants: no gate success without evidence, no PR completion from green checks alone, no unresolved reviewer artifact counted as complete.
- Inferred insight: Harness systems should convert absence rules into positive checkable surfaces.

#### Why It Matters

Agents search for present symbols. An absent edge, forbidden shortcut, or non-equivalence is easy to miss. Encoding absence as a positive guard prevents repeated human steering.

#### Implementation Opportunities

- Add validator rules for "claim complete requires evidence status current."
- Add docs-gate checks for governance absences that often drift.
- Model forbidden shortcuts as explicit error classes.
- Add review prompts that ask "what absence-based invariant is at risk?"

#### Risks / Tradeoffs

- Over-modeling every negative invariant can make governance noisy.
- Some absence rules are contextual and need judgment.
- Guardrails need exception paths or agents will route around them.

### Pattern: Fast Feedback Is Correctness Infrastructure

#### Description

For agents, fast checks are not merely convenient. They are the mechanism by which agents discover mistakes quickly enough to self-correct before compounding errors.

#### Evidence

- Explicit evidence: The Logic article extraction says checks must be cheap enough to run constantly.
- Explicit evidence: It describes fast isolated tests, cached third-party calls for iteration, and uncached CI after approval.
- Explicit evidence: The source artifact maps this to verify-work fast lanes, codex preflight, generated environment actions, worktree readiness, and focused tests.

#### Why It Matters

Slow validation causes speculation. Agents continue editing while uncertain, then produce large diffs with unclear causality. Fast checks keep changes small and feedback local.

#### Implementation Opportunities

- Keep narrow command-family tests discoverable and cheap.
- Emit "nearest meaningful validation" when broad validation is blocked.
- Track validation latency and repeated rerun failures by workflow type.
- Add agent closeout checks for "exact touched path exercised."

#### Risks / Tradeoffs

- Fast lanes can hide integration failures.
- Caching can mask third-party integration drift.
- Agents may over-trust fast checks unless closeout labels proof scope clearly.

### Pattern: Isolation Is The Enabler Of Parallel Agent Work

#### Description

Concurrent agent work needs conflict-free worktrees, caches, temp directories, artifact paths, ports, and evidence IDs. Without isolation, parallelism creates nondeterminism and users avoid using multiple agents.

#### Evidence

- Explicit evidence: The Logic article extraction says concurrent environments need conflict-free allocation.
- Explicit evidence: The source artifact maps isolation to worktree readiness scripts, review swarm artifact contracts, runtime evidence IDs, and source intake batches.
- Inferred insight: Artifact-first outputs need per-run identity to avoid stale artifact reuse.

#### Why It Matters

Review swarms, background heartbeats, and parallel coding attempts all depend on deterministic isolation. Shared artifacts and shared temp paths cause false evidence, collisions, and stale closeout.

#### Implementation Opportunities

- Require run_id or trajectory_id on reviewer artifacts.
- Validate expected artifact parent directories before spawning reviewers.
- Allocate per-worktree temp paths and caches.
- Add stale-artifact detection: artifact timestamp/source run must match current run.

#### Risks / Tradeoffs

- Per-run isolation can make artifacts harder to find.
- Too much generated evidence can clutter ignored research trees.
- Isolation cannot replace synthesis; coordinator still must verify artifacts.

### Pattern: Generated Contracts As Drift Reducers

#### Description

Generated schemas, clients, and docs can reduce drift when one source of truth owns the shape. They are dangerous when generated mirrors are edited manually or lack a guard.

#### Evidence

- Explicit evidence: The Logic article extraction mentions OpenAPI-generated clients, typed database clients, and typed wrappers.
- Explicit evidence: The source artifact maps this to JSON schemas, harness.contract.json, CLI --json output tests, PR closeout schemas, runtime-card schemas, and docs generated from command metadata.
- Inferred insight: Coding Harness already has many mirrored governance surfaces, so source-of-truth discipline is critical.

#### Why It Matters

Agents are prone to patch the nearest visible doc or generated file. Without canonical ownership, local fixes create long-term drift.

#### Implementation Opportunities

- Inventory generated or mirrored surfaces and define source, generator, guard, and exception process.
- Add CI checks that fail when generated mirrors drift.
- In instructions, tell agents to edit canonical source first.
- Include source-of-truth field in generated artifacts.

#### Risks / Tradeoffs

- Generation pipelines can become opaque.
- Manual overrides may be necessary during incidents.
- Too many source-of-truth declarations can confuse agents if they conflict.

### Pattern: Agent Failures Should Be Classified By Structural Cause

#### Description

When an agent fails, do not only patch the local symptom. Classify whether the root cause was weak instruction, weak file layout, weak type/schema, weak parser, weak validator, weak codemap, weak environment isolation, or weak evidence closeout.

#### Evidence

- Explicit evidence: The source artifact says to classify agent failures by weak instruction, file layout, type/schema, parser, validator, architecture map, environment isolation, or evidence closeout.
- Explicit evidence: Coding Harness root instructions say repeated steering is a stop-the-line environment defect.
- Inferred insight: This classification turns agent failure into harness improvement backlog.

#### Why It Matters

Repeated human correction is expensive. If the system only patches the task, the same correction returns. Structural cause classification points to the durable fix surface.

#### Implementation Opportunities

- Add a "failure root class" field to review artifacts or closeout notes.
- Use Project Brain or .harness/memory to record repeated root classes.
- Add evals that include the same failure in different surface forms.
- Make pattern-scope output name the likely structural cause.

#### Risks / Tradeoffs

- Classification can become bureaucratic if every small typo needs root-cause taxonomy.
- Agents may overfit to labels and miss the actual local bug.
- Some failures have multiple causes and need prioritization.

### Pattern: Architecture Review Must Inspect Physical Adjacency

#### Description

Architecture review should compare the intended codemap with the actual file tree. If related command pieces, schemas, tests, and docs are scattered without a map, agents will navigate poorly.

#### Evidence

- Explicit evidence: The source artifact says architecture review should ask whether codemap-adjacent things are physically adjacent.
- Explicit evidence: It says file layout and naming are agent-facing interfaces.
- Inferred insight: Physical adjacency becomes a review criterion, not just design taste.

#### Why It Matters

A repo can have a good architecture story and still be hard for agents to operate if the physical layout contradicts it. Review should catch that mismatch before it becomes repeated wrong-file work.

#### Implementation Opportunities

- Add an architecture-alignment audit section: intended module, actual files, adjacency quality, missing map.
- Add a command-family adjacency check to blast-radius or review-context.
- Use codemap drift as an eval fixture for repo-research agents.
- Track "wrong file" incidents as navigability failures.

#### Risks / Tradeoffs

- Co-location can conflict with build boundaries or package conventions.
- Some cross-cutting concerns are intentionally spread.
- Adjacency scoring needs human judgment to avoid shallow folder policing.

### Pattern: Tool Outputs Are Agent-Facing APIs

#### Description

Every CLI, validator, gate, and script output is an API consumed by agents. Output should be structured, scoped, exact, and include remediation when possible.

#### Evidence

- Explicit evidence: The source artifact emphasizes exact failure classes, structured evidence, and command outcomes.
- Explicit evidence: Coding Harness instructions prefer --json when output feeds automation.
- Inferred insight: Human-readable logs alone are insufficient for automated closeout and evals.

#### Why It Matters

Agents parse outputs to decide next steps. Vague or noisy output causes wrong remediation, fake blockers, or over-reading. Structured outputs can be evaluated and reused.

#### Implementation Opportunities

- Standardize JSON fields for status, blocker_class, evidence_ref, next_step, owner_surface, and validation_scope.
- Add tests that assert machine-readable output for important commands.
- Make stderr fallback explicit and limited.
- Include docs examples for pass, fail, blocked, and usage error.

#### Risks / Tradeoffs

- JSON schemas require maintenance.
- Human readability can suffer if output becomes too machine-centric.
- Some legacy commands may need gradual migration.

### Pattern: The Repo Is The Prompt

#### Description

Instructions matter, but the codebase itself is the dominant prompt: types, tests, names, modules, docs, schemas, and gates tell the agent what is possible and what is expected.

#### Evidence

- Explicit evidence: The source artifact says agents do best when the codebase itself carries more reasoning burden.
- Explicit evidence: It says file layout, tests, types, schemas, architecture maps, and validation loops are the executable environment.
- Inferred insight: Prompt/harness separation means do not compensate for weak structure with longer instructions.

#### Why It Matters

Long prompts cannot reliably overcome poor code structure. A stronger repo reduces context needed per task and makes good behavior easier to elicit.

#### Implementation Opportunities

- When adding instructions, ask whether the same rule can be encoded in a validator, schema, type, or file layout.
- Keep AGENTS concise and route deep detail through progressive disclosure.
- Use evals to test whether agents find and follow repo structure without being spoon-fed.
- Make repeated prompt reminders candidates for durable harness primitives.

#### Risks / Tradeoffs

- Some behavior still needs prose policy.
- Validators can be too rigid for design judgment.
- Structural changes take longer than prompt edits.

### Pattern: Evidence Freshness Is A First-Class State

#### Description

Evidence should carry freshness, source, and scope. A passing result from a stale run, wrong branch, wrong artifact, or previous reviewer is not proof for current closeout.

#### Evidence

- Explicit evidence: The source artifact warns against stale docs and stale generated mirrors.
- Explicit evidence: Coding Harness root guidance says PR/heartbeat closeout is not equivalent to green checks and requires current PR state, branch/worktree state, Linear state, next-lane routing, and blockers.
- Inferred insight: Freshness belongs in artifact schemas, not only coordinator judgment.

#### Why It Matters

Agents are vulnerable to stale evidence because old artifacts often look complete. Freshness metadata lets validators reject stale or wrong-scope proof.

#### Implementation Opportunities

- Add run_id, branch, commit, timestamp, source command, and input hash to evidence artifacts.
- Require reviewer artifacts to match current requested reviewer and run.
- Add stale-artifact detection to review swarm synthesis.
- Include freshness_status in PR closeout evidence.

#### Risks / Tradeoffs

- More metadata increases artifact size.
- Timestamp-based checks can be brittle across timezones.
- Freshness checks need clear override rules for reused evidence.

### Pattern: Review Should Reward Retrieval Quality

#### Description

A research or review agent should be judged on whether it found the right facts and files, not only whether the prose reads well.

#### Evidence

- Explicit evidence: The source artifact maps file-selection, fact recall, exact failure strings, governing instructions, and blocker classification into eval opportunities.
- Inferred insight: This pattern generalizes from agent RFT evidence in adjacent research and from the codemap article's contributor tax.

#### Why It Matters

Fluent wrong answers are dangerous. For codebase work, missing a governing instruction or source file can invalidate the whole conclusion.

#### Implementation Opportunities

- Add expected-fact sets for research/review eval cases.
- Score selected-file precision and recall.
- Require exact file paths and command outcomes in review artifacts.
- Penalize confident answers without source-boundary evidence.

#### Risks / Tradeoffs

- Expected-fact sets take effort to maintain.
- Some exploratory tasks have no single correct file set.
- Over-scoring retrieval can undervalue synthesis quality.

## Tooling And Ecosystem

### TypeScript And Static Types

Purpose:

- Encode domain shapes, illegal states, and command/evidence contracts.

Workflow role:

- Shrinks possible invalid states and gives agents source-of-truth documentation.

Integration opportunities:

- Discriminated unions for gate states.
- Typed parse results for CLI boundaries.
- Domain-specific exported names for PR closeout, runtime-card, artifact routing, and reviewer outcomes.

Implied best practices:

- Use semantic type names.
- Prefer precise representations over loose records.
- Avoid generic Result/State shapes at public boundaries when domain names would clarify.

Strengths:

- Compiler catches drift between parser and processing code.
- Types double as navigable documentation.
- Agents can search exported type names.

Limitations:

- Type ceremony can consume context.
- Types cannot prove runtime behavior without tests.
- Shell/Python/Rust surfaces still need their own guards.

### Parsers, Smart Constructors, And Abstract Types

Purpose:

- Convert weak values into stronger values that preserve checked facts.

Workflow role:

- Boundary normalization before command execution or artifact synthesis.

Integration opportunities:

- Parse artifact paths into repo-scoped artifact references.
- Parse PR metadata into required/optional evidence states.
- Parse gate output into status-specific objects.
- Use smart constructors for constrained values such as non-empty reviewer lists or unique artifact IDs.

Implied best practices:

- Parse before side effects.
- Return refined values, not void checks.
- Push proof upward as far as possible, but no further.

Strengths:

- Removes repeated validation.
- Prevents impossible branches downstream.
- Clarifies root causes when input is malformed.

Limitations:

- Requires careful error messages.
- Harder in dynamic or shell-heavy surfaces.
- Too much precision can become friction.

### Tests, Coverage, And Executable Examples

Purpose:

- Demonstrate behavior and catch regressions.

Workflow role:

- Agent feedback loop and changed-behavior proof.

Integration opportunities:

- test:related for changed files.
- focused command-family tests.
- proof tables in closeout artifacts.
- eval cases for changed path coverage.

Implied best practices:

- Treat coverage as a ledger, not a guarantee.
- Test behavior at the public boundary.
- Require direct proof for touched runtime paths when possible.

Strengths:

- Gives agents rapid correction.
- Makes edge cases visible.
- Supports reviewer trust.

Limitations:

- Metrics can be gamed.
- Overly coupled tests can block refactors.
- Some behavior requires integration proof rather than unit tests.

### Linters, Formatters, Hooks, And Policy Guards

Purpose:

- Enforce repeatable baseline rules without agent discretion.

Workflow role:

- Remove degrees of freedom and catch common drift before review.

Integration opportunities:

- docs-gate for authoritative docs.
- codestyle parity.
- pre-commit/pre-push validation.
- generated projection drift checks.

Implied best practices:

- Strict, automatic, and cheap checks should run early.
- Hooks should use repo wrappers and stable environment setup.
- Warnings that recur should become validators or tracked exceptions.

Strengths:

- Reduces review burden.
- Catches mechanical drift.
- Lets agents self-correct.

Limitations:

- Hooks can become slow or brittle.
- Policy guards need clear exception paths.
- Overuse can encourage bypasses.

### OpenAPI, Generated Clients, JSON Schemas, And Contract Files

Purpose:

- Keep boundary shapes synchronized and machine-checkable.

Workflow role:

- Source-of-truth for external APIs, command outputs, and evidence artifacts.

Integration opportunities:

- Generate CLI output docs from schema.
- Validate runtime-card and PR closeout evidence.
- Keep harness.contract.json aligned with docs and generated actions.
- Test --json outputs against schemas.

Implied best practices:

- Generated mirrors should be guarded against manual drift.
- Schema changes should include examples and negative tests.
- The canonical source must be explicit.

Strengths:

- Reduces human translation.
- Supports machine-readable agent workflows.
- Enables eval fixtures.

Limitations:

- Generated docs can stale if generator ownership is unclear.
- Schemas can lag implementation.
- Manual patches to mirrors create hidden drift.

### Postgres Constraints, Checks, Triggers, And Typed Query Clients

Purpose:

- Enforce data invariants at persistence boundaries.

Workflow role:

- External-world parser and final backstop for invalid data.

Integration opportunities:

- Analogous pattern for Coding Harness artifacts: schemas and validators should reject invalid evidence states.
- Use database-like constraints in JSON schemas for artifact shapes.

Implied best practices:

- Put invariants at the boundary closest to the data.
- Use clear failures that agents can remediate.
- Generate or wrap clients for typed interaction.

Strengths:

- Catches invalid states regardless of caller.
- Makes some invariants hard to bypass.
- Supports explicit failure text.

Limitations:

- Database constraints do not explain workflow intent alone.
- Triggers can hide behavior if undocumented.
- Not every artifact flow has a database.

### Git Worktrees And Ephemeral Environments

Purpose:

- Provide isolated concurrent execution surfaces.

Workflow role:

- Enables parallel agents, clean branch work, and repeatable setup.

Integration opportunities:

- Worktree readiness scripts.
- Per-run temp paths and caches.
- Branch/worktree identity checks before push or closeout.
- Artifact run IDs tied to worktree and commit.

Implied best practices:

- Setup should be one command.
- Environment conflicts should be allocated or namespaced.
- Fresh environments need local config copying without exposing secrets.

Strengths:

- Reduces cross-talk.
- Encourages parallel experimentation.
- Makes local state easier to reason about.

Limitations:

- Misconfigured shared git config can corrupt worktree identity.
- Local secrets/env must be handled carefully.
- Parallel artifacts need coordinator discipline.

### Docker And Containerized Isolation

Purpose:

- Provide environment isolation for services, ports, databases, and dependencies.

Workflow role:

- Optional isolation primitive for concurrent dev/test environments.

Integration opportunities:

- Use where port/database/cache conflicts are hard to allocate otherwise.
- Treat container runtime as one isolation option, not a universal requirement.

Implied best practices:

- Keep startup fast.
- Avoid hiding failure details behind container wrappers.
- Make resource naming deterministic.

Strengths:

- Strong isolation.
- Reproducible dependencies.
- Useful for integration tests.

Limitations:

- Startup and rebuild costs can slow feedback.
- Docker-specific failures can distract from harness task.
- Requires maintenance of images and caches.

### Caching Layers

Purpose:

- Speed repeated tests and third-party interactions.

Workflow role:

- Makes frequent validation affordable.

Integration opportunities:

- Cache only where correctness impact is known.
- Pair local cached checks with uncached CI or periodic broad verification.
- Emit whether validation used cache.

Implied best practices:

- Cache should improve iteration without hiding integration drift.
- Cache assumptions should be explicit in evidence.

Strengths:

- Reduces feedback latency.
- Enables more frequent agent checks.
- Supports parallel work.

Limitations:

- Can mask third-party drift.
- Cache invalidation can create flaky tests.
- Agents may over-trust cached validation.

### CI/CD Systems

Purpose:

- Provide broad, current, independent validation and release gates.

Workflow role:

- Final proof surface beyond fast local checks.

Integration opportunities:

- Distinguish local fast lanes from required PR gates.
- Keep branch protection, CI required-check docs, and contract files aligned.
- Include release checks only when ownership says they belong in PR governance.

Implied best practices:

- Do not treat local checks as full deployment proof.
- Do not treat green checks as PR closure if conversations, mergeability, or tracker state remain unresolved.
- Required check names should be machine-verified.

Strengths:

- Independent proof.
- Protects main branch.
- Captures integration scope.

Limitations:

- Slow feedback.
- External app checks can be opaque.
- Required-check drift can block delivery.

### Architecture Documents And Codemaps

Purpose:

- Externalize maintainer mental map and stable invariants.

Workflow role:

- First-pass route map for humans and agents.
- Bridge from human mental model to agent execution model.
- Boundary index between behavior rules, code style, and evidence surfaces.

Integration opportunities:

- Short architecture bootstrap.
- Root or repo-local `ARCHITECTURE.md` that maps request intake, instruction discovery, skill routing, context loading, execution, validation, evidence capture, and memory.
- Diagram context as generated codemap.
- Architecture-adjacent docs-gate checks.
- Codemap-to-file-adjacency audit.
- Architecture-update rule for changes to routing, orchestration, validation, contract, evidence, and generated mirror surfaces.

Implied best practices:

- Keep stable and physical.
- Name key modules/types.
- Separate responsibilities: `AGENTS.md` for conduct, `CODESTYLE.md` for taste, `ARCHITECTURE.md` for terrain, `.harness/**` for state and proof.
- Describe authoritative state and derived mirrors.
- Document absence-based invariants.
- Avoid volatile implementation detail.
- Make known sharp edges and validation proof explicit.

Strengths:

- Reduces search time.
- Helps route new contributors and agents.
- Makes boundaries reviewable.
- Gives agents a compact path from zero context to safe action.

Limitations:

- Stales if too detailed.
- Can become theater if not tied to file layout.
- Generated maps need refresh discipline.
- Can mislead agents if it duplicates policy docs or fails to name update triggers.

### Coding Harness CLI And JSON Outputs

Purpose:

- Provide machine-readable command surfaces for agent workflows.

Workflow role:

- Control plane for blast radius, policy gates, artifact routines, risk tiering, and validation.

Integration opportunities:

- Ensure --json outputs include proof-carrying fields.
- Add parse-boundary and codemap audit commands.
- Use status/blocker/freshness fields consistently.

Implied best practices:

- Prefer canonical command names.
- Parse stdout JSON when present.
- Treat stderr as fallback diagnostics only.

Strengths:

- Agent-native interface.
- Supports automation and evals.
- Can encode repo-specific governance.

Limitations:

- Legacy text output may remain.
- Schema drift is a risk.
- Commands need examples and negative tests.

## Harness Engineering Insights

### Orchestration

- High confidence: Orchestration should begin with boundary parsing and route selection before side effects.
- High confidence: Parallel reviewer or worker orchestration needs deterministic artifact paths and run IDs.
- Medium confidence: Each agent trajectory should carry metadata linking prompt, discovered files, tool calls, validation, and final claims.
- Implementation pattern: Orchestrator creates run_id, validates inputs, allocates artifacts, spawns workers, verifies artifacts, synthesizes with coverage gaps.

### Validation

- High confidence: Validation should be exact, scoped, and outcome-labeled.
- High confidence: Critical validators should return structured artifacts or proof-carrying values.
- Medium confidence: Changed-behavior proof should become a review/closeout rubric.
- Implementation pattern: validation_result/v1 with status, command, scope, input_refs, evidence_refs, blocker_class, freshness, and next_step.

### Context

- High confidence: File layout, type names, and codemaps are context-loading primitives.
- High confidence: Small, domain-named files reduce summarization/truncation risk.
- Medium confidence: Review tools should report context quality, not only findings.
- Implementation pattern: context_surface_report with entrypoint clarity, domain naming, file size risk, codemap presence, and missing invariant notes.

### Routing

- High confidence: Routing should follow explicit command-family and ownership boundaries.
- Medium confidence: Route decisions should be advisory unless promoted through a typed execution authority.
- Implementation pattern: route_decision/v1 remains non-executable, while a separate parsed command request owns execution.

### Memory

- High confidence: External research belongs in ignored research artifacts until promoted.
- High confidence: Repeated failures should become durable learnings only after proof.
- Medium confidence: Project Brain should track structural failure classes: instruction, parser, validator, codemap, isolation, evidence, source-of-truth drift.
- Implementation pattern: learning_capture/v1 with source_event, structural_cause, durable_destination, validator_added, and unresolved_risk.

### Evals

- High confidence: Evals should measure retrieval quality, proof discipline, and blocker honesty.
- Medium confidence: File-selection precision/recall and expected-fact recall are strong eval dimensions.
- Implementation pattern: eval case includes required_files, forbidden_overreach, expected_facts, required_commands, acceptable_blockers, and scoring notes.

### Governance

- High confidence: Negative invariants need explicit guards.
- High confidence: Source-of-truth mirrors need canonical ownership and drift checks.
- Medium confidence: Architecture docs should be gated when command boundaries or evidence contracts change.
- Implementation pattern: governance_guard/v1 checks invariant_id, source_surface, mirror_surfaces, generator, and drift_status.

### Scaling

- High confidence: Scaling agents depends on fast isolated environments and conflict-free artifacts.
- Medium confidence: Tool-call and validation latency metrics should be tracked by workflow type.
- Implementation pattern: run metrics record p50/p95 command count, validation latency, repeated command failures, artifact count, and blocker rate.

### Recovery

- High confidence: Late-discovered invalid input is a recovery smell.
- High confidence: Stale artifacts must be classified, not reused silently.
- Implementation pattern: recovery classifier identifies parse_failure, stale_evidence, missing_artifact, environment_blocker, external_auth_blocker, source_drift, and unsupported_scope.

## Implied Best Practices

- Parse first, execute second.
- Return proof, not only pass/fail.
- Prefer strong domain values over raw strings after boundary validation.
- Make agent-facing command outputs structured and terse.
- Keep error messages exact and remediable.
- Treat file names as search handles.
- Keep public entrypoints obvious.
- Pair file splits with a codemap or index.
- Keep architecture docs short, stable, and physical.
- Treat `ARCHITECTURE.md` as terrain and route map, not a narrative overview.
- Keep `AGENTS.md`, `CODESTYLE.md`, `ARCHITECTURE.md`, and `.harness/**` responsibilities distinct.
- Require architecture maps to name entrypoints, boundaries, invariants, validation proof, agent navigation paths, and known sharp edges.
- Document absence-based invariants explicitly.
- Back negative rules with validators where feasible.
- Use fast local checks before broad gates.
- Use broad CI for integration confidence, not inner-loop feedback.
- Label validation scope so agents cannot overclaim.
- Require current evidence for closeout.
- Tie reviewer artifacts to a current run ID.
- Do not count mailbox text as artifact proof.
- Track source-of-truth ownership for generated mirrors.
- Do not patch generated surfaces manually unless exception is recorded.
- Convert repeated steering into structural root-cause categories.
- Prefer eval fixtures from real failures over synthetic-only prompts.
- Score research agents on fact recall and file discovery, not prose fluency.
- Keep cached validation distinct from uncached proof.
- Treat manual setup friction as a harness defect.
- Avoid global policy adoption from external articles without repo evidence.
- Keep research artifacts as evidence input until promoted through a decision.

## Failure Modes And Mitigations

### Failure: Coverage Metric Theater

Description:

The team imports a 100% coverage target because the article praised it, but agents learn to write shallow tests that satisfy coverage without proving behavior.

Evidence:

- Explicit evidence: The source artifact says coverage is not a no-bugs guarantee and should be adapted as executable proof for changed behavior.

Probable Root Cause:

- Confusing metric enforcement with behavioral proof.

Severity:

- High.

Mitigation Strategy:

- Adopt "changed behavior has executable proof" first.
- Require assertions to be requirement-derived, not implementation-reused.
- Track direct/indirect/missing proof in closeout.

Recommended Guardrails:

- quality:self-affirming style checks for test assertions.
- PR closeout proof table.
- Reviewer prompt: "Does this test prove behavior or only execute lines?"

### Failure: Void Validator Drift

Description:

A validator checks an invariant but returns nothing, so downstream code passes raw data and silently forgets what was proven.

Evidence:

- Explicit evidence: The source artifact says validation returning no useful value throws away knowledge.
- Explicit evidence: It recommends parse/build/classify functions returning typed artifacts.

Probable Root Cause:

- Validator designed as a side-effecting guard rather than a domain transformation.

Severity:

- High for command boundaries and evidence contracts.

Mitigation Strategy:

- Replace critical void validators with parse results.
- Add typed errors for invalid cases.
- Require downstream functions to accept the refined type.

Recommended Guardrails:

- Review checklist for check* functions in command cores.
- Eval case where a raw input slips past validation and causes false closeout.
- Type-level discriminated states for gate evidence.

### Failure: Shotgun Command Parsing

Description:

Command handlers parse and validate options throughout execution, discovering invalid input after partial side effects or artifact writes.

Evidence:

- Explicit evidence: The Parse article extraction describes shotgun parsing as validation mixed through processing code.
- Inferred insight: Harness commands with side effects need explicit parse/discover/execute phases.

Probable Root Cause:

- Command implementation grows incrementally without a boundary contract.

Severity:

- High when commands write artifacts, mutate trackers, or perform external actions.

Mitigation Strategy:

- Create command handler convention: parse, discover, classify blockers, execute, emit evidence.
- Fail closed before side effects when required input is missing.
- Add tests for invalid input causing no writes.

Recommended Guardrails:

- Side-effect phase tests.
- no-write-on-parse-failure fixtures.
- command schema that separates usage error from runtime blocker.

### Failure: Stale Codemap Misrouting

Description:

Architecture docs or generated diagram context name outdated boundaries, causing agents to route edits to old modules or miss current owner files.

Evidence:

- Explicit evidence: The Architecture extraction warns against frequently changing details in architecture docs.
- Explicit evidence: Coding Harness instructions already require diagram context refresh for architecture-adjacent changes.

Probable Root Cause:

- Architecture docs attempt to be too detailed or lack refresh gates.

Severity:

- Medium to high depending on surface.

Mitigation Strategy:

- Keep codemap stable and high-level.
- Gate architecture-adjacent changes with context refresh.
- Compare codemap to file adjacency during audits.

Recommended Guardrails:

- docs-gate architecture-context category.
- codemap freshness audit.
- generated context input hash or timestamp.
- update-rule check for architecture-adjacent changes.
- architecture-map scope rule that rejects repeated README, AGENTS, or CODESTYLE content unless it clarifies terrain.

### Failure: File Splitting Without Navigability

Description:

A large file is split into many smaller files, but names and indexes do not clarify ownership. Agents now need more searches, not fewer.

Evidence:

- Explicit evidence: The source artifact warns small files without a codemap can create more navigation work.
- Inferred insight: Small files preserve context only when scoped and named well.

Probable Root Cause:

- Treating small files as a goal instead of navigability as a goal.

Severity:

- Medium.

Mitigation Strategy:

- Require splits to define public entrypoint, internal adapter roles, and test ownership.
- Add index or codemap for command-family splits.
- Review for file-name specificity.

Recommended Guardrails:

- command-family split checklist.
- architecture adjacency review.
- blast-radius output includes entrypoint clarity.

### Failure: Generated Mirror Drift

Description:

An agent updates a visible doc, contract mirror, or generated context file without updating the canonical source or generator.

Evidence:

- Explicit evidence: The source artifact flags single-source-of-truth drift for generated context, contracts, docs-gate surfaces, command metadata, and environment actions.

Probable Root Cause:

- Canonical source unclear or generator inconvenient.

Severity:

- High for CI/check contracts and governance docs.

Mitigation Strategy:

- Inventory mirrors with source, generator, guard, and exception process.
- Add drift checks.
- Put source-of-truth notes in generated files.

Recommended Guardrails:

- Generated file header.
- source-of-truth registry.
- CI drift validation.

### Failure: Stale Artifact Counted As Current Proof

Description:

A previous reviewer or validation artifact exists and is reused as evidence for a new run even though it does not match current inputs.

Evidence:

- Explicit evidence: The source artifact emphasizes current evidence and run isolation.
- Inferred insight: Review swarm coordinator rules require verifying artifacts exist and are non-empty, but freshness must also match.

Probable Root Cause:

- Artifact path reused without run identity.

Severity:

- High for review swarms and PR closeout.

Mitigation Strategy:

- Add run_id, timestamp, branch, commit, and input hash to artifacts.
- Require synthesis to verify freshness fields.
- Use deterministic per-run artifact directories.

Recommended Guardrails:

- stale_artifact validator.
- reviewer output schema.
- coordinator retry/fail coverage gap notes.

### Failure: Fast Lane Overclaim

Description:

A fast local check passes, and the agent claims broad readiness or completion even though integration, CI, PR state, or tracker state remains unverified.

Evidence:

- Explicit evidence: Coding Harness root guidance says green checks are not enough for PR or heartbeat closeout.
- Explicit evidence: The source artifact distinguishes fast validation from broader proof.

Probable Root Cause:

- Proof scope not labeled.

Severity:

- High when closeout or merge readiness is claimed.

Mitigation Strategy:

- Validation results must include scope.
- Closeout must list unobserved horizons.
- Broader gates remain separate from fast-lane proof.

Recommended Guardrails:

- proof_scope field.
- closeout current-state checklist.
- "Unobserved Horizon" required when external state is not checked.

### Failure: Human Mental Map Remains Hidden

Description:

Maintainers know where things live and why boundaries exist, but agents and new contributors must rediscover it through broad search.

Evidence:

- Explicit evidence: The Architecture extraction says core developers have a mental map and newcomers read files in pseudo-random order.
- Explicit evidence: The source artifact recommends compact codemaps.

Probable Root Cause:

- Architecture knowledge not externalized or kept too implementation-specific.

Severity:

- Medium.

Mitigation Strategy:

- Maintain a short codemap for stable command families and invariants.
- Name key modules/types.
- Keep details near code.

Recommended Guardrails:

- Architecture doc line budget.
- codemap review in architecture audits.
- expected-fact evals for repo research.

### Failure: Type Ceremony Without Operational Payoff

Description:

The repo adds highly precise types for low-risk values, increasing conversion overhead without reducing real agent errors.

Evidence:

- Explicit evidence: The source artifact warns type precision can become ceremony.
- Inferred insight: Harness design should model high-risk workflow states first.

Probable Root Cause:

- Applying "make illegal states unrepresentable" without prioritizing risk.

Severity:

- Medium.

Mitigation Strategy:

- Prioritize domain states that affect side effects, evidence, and closeout.
- Use smart constructors for high-risk constraints.
- Avoid modeling low-value minutiae.

Recommended Guardrails:

- Risk-based type precision rubric.
- Review question: "What failure does this type make impossible?"
- Waiver for pragmatic simple values.

### Failure: Cache-Masked Integration Drift

Description:

Cached local tests pass while uncached or live integration behavior has drifted.

Evidence:

- Explicit evidence: The Logic article extraction mentions cached third-party calls locally and uncached CI after approval.
- Inferred insight: Cached validation should be labeled and not used as final external proof.

Probable Root Cause:

- Performance optimization hides external dependency changes.

Severity:

- Medium to high depending on dependency.

Mitigation Strategy:

- Label cached validation.
- Run uncached broad checks in CI or scheduled verification.
- Keep cache invalidation rules explicit.

Recommended Guardrails:

- cached: true metadata in validation output.
- CI uncached integration lane.
- blocker classification for external unavailable state.

### Failure: Prompt Patch Replaces Structural Fix

Description:

The agent adds more AGENTS prose or prompt reminders instead of building the validator, schema, file layout, or codemap that would prevent recurrence.

Evidence:

- Explicit evidence: The source artifact says the common denominator is not "write more instructions."
- Explicit evidence: Coding Harness root guidance treats repeated steering as a stop-the-line environment defect.

Probable Root Cause:

- Prose edits are faster than structural fixes.

Severity:

- High for repeated agent failures.

Mitigation Strategy:

- For repeated issues, classify structural cause and choose durable destination.
- Prefer executable guard where feasible.
- Record when prose-only is intentionally chosen.

Recommended Guardrails:

- repeated-steering admission record.
- Meta-behavior proof in PR closeout.
- pattern-scope inventory.

## Reusable Techniques

### Technique: Parse-Boundary Review Checklist

Use for command cores, adapters, and evidence producers.

Checklist:

- What raw inputs enter this boundary?
- Where are they parsed?
- What stronger type or schema object is returned?
- Does downstream code require the refined object?
- What invalid cases fail before side effects?
- Does the error include exact remediation?
- Is there a negative test proving parse failure does not write artifacts?

### Technique: Changed-Behavior Proof Table

Use for PR closeout and review artifacts.

Columns:

- Changed surface
- Behavior claim
- Direct proof command
- Proof scope
- Status
- Evidence reference
- Unobserved horizon
- Blocker or next owner

### Technique: Codemap-To-File-Adjacency Audit

Use for architecture reviews.

Steps:

1. Name intended command family or module.
2. List public entrypoint.
3. List parser/schema/evidence/test/doc files.
4. Check whether related files are discoverable from the entrypoint.
5. Note missing index or misleading generic names.
6. Record whether architecture docs name this boundary.
7. Recommend move, map, or no-op.

### Technique: ARCHITECTURE.md Control-Surface Checklist

Use when creating, reviewing, or refreshing repo architecture docs for agent readiness.

Required questions:

- Does the file answer what the system is and what it is not?
- Does it list execution entrypoints and workflow entrypoints?
- Does it name core modules, ownership boundaries, and forbidden direct paths?
- Does it explain data/state flow at the level needed for safe edits?
- Does it distinguish authoritative state from derived mirrors?
- Does it state invariants, including absence-based invariants?
- Does it map common agent task types to first files to inspect?
- Does it name validation commands or evidence artifacts for each major boundary?
- Does it include known sharp edges that commonly cause wrong edits?
- Does it say when the architecture file must be updated?

Failure indicators:

- Repeats README positioning instead of navigation.
- Repeats AGENTS behavior rules instead of terrain.
- Repeats CODESTYLE implementation rules instead of boundaries.
- Mentions diagrams or modules without tying them to real files.
- Describes aspirations without owner, invariant, command, or evidence.

### Technique: Stale Artifact Rejection

Use for review swarms and closeout.

Required fields:

- artifact_type
- run_id
- requested_by
- reviewer_or_command
- branch
- commit
- input_hash
- generated_at
- status
- evidence_scope

Reject if:

- run_id does not match current synthesis.
- branch or commit is missing for repo-state claims.
- input_hash is absent for reviewer tasks.
- artifact timestamp predates requested run.
- artifact path exists but status is absent or empty.

### Technique: Structural Failure Classifier

Use after repeated steering, wrong-file edits, or failed reviews.

Classes:

- weak_instruction
- weak_file_layout
- weak_type_or_schema
- weak_parser
- weak_validator
- weak_codemap
- weak_environment_isolation
- weak_evidence_closeout
- source_of_truth_drift
- external_dependency_blocker

Output:

- failure_class
- evidence
- narrow_fix
- durable_destination
- validation_command
- deferred_followup

### Technique: Agent Navigation Surface Score

Use in review-context diagnostics.

Signals:

- Domain-specific file names.
- Public entrypoints visible.
- Generic helper sprawl low.
- Large files justified or split.
- Codemap available.
- Negative invariants documented.
- Tests close to public boundary.
- Generated mirrors marked.

### Technique: Proof-Carrying Gate Result

Use for validation output schemas.

Fields:

- schema_version
- gate_name
- status
- status_reason
- checked_inputs
- evidence_refs
- freshness
- command
- blocker_class
- next_step
- owner_surface
- cached
- proof_scope

### Technique: Single-Source-Of-Truth Inventory

Use for drift-prone surfaces.

Fields:

- mirror_surface
- canonical_source
- generator_or_validator
- update_command
- drift_signal
- exception_owner
- exception_expiry
- last_checked

### Technique: Fast-Lane Scope Label

Use for local validation.

Labels:

- direct_path_proof
- related_unit_proof
- docs_shape_proof
- contract_shape_proof
- integration_proxy
- broad_readiness
- external_state_unchecked

Rule:

- Agents may only claim what the label proves.

### Technique: Evidence-First Architecture Update

Use when command boundaries, runtime-card evidence, PR closeout, or generated context changes.

Flow:

1. Identify changed architecture boundary.
2. Update code/schema first.
3. Refresh generated architecture context if required.
4. Update stable codemap only if boundary changed.
5. Run docs-gate or nearest proof.
6. Record exact command outcomes.

## Strategic Insights

### Insight: Agent Readiness Rehabilitates Old Engineering Discipline

High confidence.

The source themes are not exotic AI-only practices. They make long-standing engineering practices newly non-optional because agents amplify ambiguity. Tests, types, file layout, docs, and fast environments were always useful; now they directly determine whether agents can operate without constant human translation.

### Insight: The Best Harnesses Move Judgment Into Interfaces

High confidence.

A strong harness does not rely on the model remembering instructions. It moves judgment into typed parse results, structured command outputs, artifact schemas, proof tables, and codemaps. This keeps human taste in the design of boundaries while letting agents execute inside them.

### Insight: Prompt/Harness Separation Is A Governance Boundary

Medium confidence.

The source artifact implies that longer instructions are not the right default fix. Prompts can route attention, but harnesses enforce constraints. Coding Harness should treat every repeated prompt reminder as a candidate for schema, validator, eval, file layout, or codemap improvement.

### Insight: Future Code Review Will Include Navigability Review

Medium confidence.

Review will increasingly ask whether an agent can find the right boundary, not just whether code works. File adjacency, semantic names, codemap freshness, and public entrypoint clarity become reviewable qualities.

### Insight: Evals Should Grade Workflow, Not Just Output

High confidence.

The highest-value evals should measure whether agents found the right files, preserved exact failure text, ran appropriate commands, classified blockers honestly, and avoided stale proof. Output correctness alone is too late in the workflow.

### Insight: Fast Local Proof And Broad External Proof Must Stay Separate

High confidence.

Agents need fast local checks to iterate, but broad readiness depends on CI, branch state, PR state, and external checks. Harness design should make the distinction impossible to miss.

### Insight: Source-Of-Truth Drift Is The Agent-Native Version Of Configuration Debt

High confidence.

Generated docs, contract files, CI required checks, environment actions, and architecture context are all mirrors. If the canonical source is unclear, agents will patch visible symptoms and increase drift.

## Key Quotes And Evidence

- Material quote: "The only guardrails are the ones you set and enforce." This supports the guardrails-as-runtime pattern.
- Material quote: "Coverage, as we use it, isn't strictly about bug prevention; it's about guaranteeing the agent has double-checked the behavior of every line of code it wrote." This supports changed-behavior proof rather than metric worship.
- Material quote: "The main mechanism agentic tools use to navigate your codebase is the filesystem." This supports filesystem-as-agent-interface.
- Material quote: "A parser is just a function that consumes less-structured input and produces more-structured output." This supports proof-carrying boundary transformation.
- Material quote: "Shotgun parsing is a programming antipattern..." This supports parse-before-execute command design.
- Material quote: "One's mental map is the source of truth." This supports compact codemaps and architecture maps.
- Material quote: "The codemap should answer 'where's the thing that does X?'." This supports architecture docs as navigational infrastructure.
- Material quote: "A codemap is a map of a country, not an atlas of maps of its states." This supports keeping architecture docs short and stable.

## Final Assessment

Strongest ideas:

- Proof-carrying boundary transformation.
- Changed-behavior proof as the useful part of coverage.
- Filesystem and codemap as agent navigation infrastructure.
- Fast isolated feedback loops as correctness infrastructure.
- Negative invariants converted into positive validators or schemas.
- Source-of-truth inventory for generated and mirrored surfaces.

Weakest areas:

- The source artifact is a second-order synthesis, not direct transcript text for all claims.
- The artifact identifies candidate Coding Harness surfaces but does not inspect their current implementation.
- Tooling recommendations are partly implied by article examples and need repo verification.
- Coverage advice is high-risk if translated into a blanket metric target.

Most reusable concepts:

- Parse-boundary review checklist.
- Changed-behavior proof table.
- Codemap-to-file-adjacency audit.
- Stale artifact rejection.
- Structural failure classifier.
- Proof-carrying gate result schema.
- Single-source-of-truth inventory.
- `ARCHITECTURE.md` control-surface checklist.

Highest leverage opportunities:

1. Build a parse-boundary review/eval rubric for command handlers and evidence producers.
2. Add stale-artifact/run-id discipline to review swarm and closeout artifacts.
3. Add changed-behavior proof classification to PR closeout.
4. Add codemap/file-adjacency review to architecture audits.
5. Add source-of-truth drift inventory for generated governance mirrors.
6. Add an `ARCHITECTURE.md` control-surface checklist for repo maps and architecture-context refreshes.

Most important risks:

- Turning article claims into policy without repo evidence.
- Overfitting to coverage percentage instead of behavior proof.
- Creating stale architecture docs.
- Turning `ARCHITECTURE.md` into README, AGENTS, or CODESTYLE duplication instead of a terrain map.
- Splitting files without improving agent navigation.
- Validators that pass but do not preserve proof.
- Fast local checks being misreported as broad readiness.
- Generated mirror drift from manual patches.

Immediate implementation candidates:

- Medium scope: Add a "Proof-Carrying Boundary" section to review-gate or codestyle review prompts.
- Medium scope: Add run_id and freshness requirements to review artifact contracts.
- Small scope: Add closeout wording that separates direct path proof, indirect proof, and blocked proof.
- Small scope: Add a docs/research eval fixture requiring exact command outcomes and ignored-artifact status.
- Larger scope: Build a source-of-truth registry for contract/docs/generated context surfaces.

## Validation Evidence

- Command: zsh -lc 'rg -n "agent-ready-code-patterns|\.harness/research/deep|Deep Research Extraction|agent rft patterns|ignored local research" /Users/jamiecraik/.codex/memories/MEMORY.md' -> pass (memory found prior ignored deep research validation pattern)
- Command: zsh -lc 'cat /Users/jamiecraik/dev/agent-skills/.agents/skills/harness-engineering/SKILL.md' -> pass (HE router instructions read)
- Command: zsh -lc 'sed -n "1,220p" /Users/jamiecraik/dev/coding-harness/AGENTS.md' -> pass (repo instruction front door read)
- Command: zsh -lc 'sed -n "1,200p" /Users/jamiecraik/dev/coding-harness/CODESTYLE.md' -> pass (codestyle front door read)
- Command: zsh -lc 'find /Users/jamiecraik/dev/coding-harness/.harness -maxdepth 4 -name AGENTS.md -print' -> pass (no deeper .harness AGENTS.md found)
- Command: zsh -lc 'python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/lifecycle-and-sync/route_skillset.py --skill-set "harness-engineering" --skillsets-dir /Users/jamiecraik/dev/agent-skills/.skillsets --task "Deep research extraction from coding-harness .harness/research evidence artifact into .harness/research/deep engineering intelligence document" --json' -> pass (selected he-fix-bugs)
- Command: zsh -lc 'cat /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/skills/he-fix-bugs/SKILL.md' -> pass (selected module contract read)
- Command: zsh -lc 'sed -n "1,220p" /Users/jamiecraik/dev/coding-harness/codestyle/04-docs-config-and-release.md' -> pass (matching docs/config codestyle module read)
- Command: zsh -lc 'sed -n "1,680p" /Users/jamiecraik/dev/coding-harness/.harness/research/2026-05-20-agent-ready-code-patterns-evidence.md' -> pass (primary source artifact read)
- Command: zsh -lc 'sed -n "1,220p" /Users/jamiecraik/dev/coding-harness/.harness/research/deep/2026-05-19-agent-rft-patterns-evidence.md' -> pass (nearby deep research style checked)
- Command: zsh -lc 'python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/scripts/check_bluf_structure.py /Users/jamiecraik/dev/coding-harness/.harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md --json' -> fail before BLUF wording patch (missing explicit why phrase)
- Command: zsh -lc 'git ls-files .harness/research/deep | head -20 && git check-ignore -v .harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md || true' -> pass (deep research markdown is explicitly unignored by .gitignore)
- Command: zsh -lc 'python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/scripts/check_bluf_structure.py /Users/jamiecraik/dev/coding-harness/.harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md --json' -> pass (Command Summary and BLUF structure present)
- Command: zsh -lc 'wc -l -w /Users/jamiecraik/dev/coding-harness/.harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md' -> pass (1696 lines, 9033 words)
- Command: zsh -lc 'rg -n "^(#|##|###|####) |Pattern:|Failure:|Technique:|Insight:|Command:" /Users/jamiecraik/dev/coding-harness/.harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md' -> pass (expected sections, patterns, failures, techniques, insights, and command evidence found)
- Command: zsh -lc 'LC_ALL=C rg -n "[^ -~\t]" /Users/jamiecraik/dev/coding-harness/.harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md' -> pass (no non-ASCII matches; rg exit 1 means no matches)
- Command: zsh -lc 'git status --short --ignored .harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md' -> pass (file is untracked, not ignored: ?? .harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md)

### 2026-05-20 Architecture Control-Surface Reinforcement Validation

- Command: zsh -lc 'cat AGENTS.md' -> pass (repo instruction front door re-read before reinforcement edit)
- Command: zsh -lc 'cat CODESTYLE.md' -> pass (codestyle front door re-read before reinforcement edit)
- Command: zsh -lc 'find .harness -name AGENTS.md -print' -> pass (no deeper .harness AGENTS.md found)
- Command: zsh -lc 'cat /Users/jamiecraik/dev/agent-skills/.agents/skills/harness-engineering/SKILL.md' -> pass (HE router instructions re-read)
- Command: zsh -lc 'python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/lifecycle-and-sync/route_skillset.py --skill-set harness-engineering --skillsets-dir /Users/jamiecraik/dev/agent-skills/.skillsets --task "ensure ARCHITECTURE.md as agent navigation/control-surface pattern is implied in deep research evidence artifact" --json' -> blocked (router returned low_confidence with no selected latent module; continued under repo docs/research rules)
- Command: zsh -lc 'cat codestyle/04-docs-config-and-release.md' -> pass (docs/config codestyle module re-read)
- Command: zsh -lc 'python3 scripts/check_bluf_structure.py .harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md --json' -> blocked (repo-local script path does not exist; reran canonical skill validator)
- Command: zsh -lc 'python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/scripts/check_bluf_structure.py /Users/jamiecraik/dev/coding-harness/.harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md --json' -> pass (Command Summary and BLUF structure still present)
- Command: zsh -lc 'rg -n "ARCHITECTURE.md|Control-Surface|terrain|zero context|architecture-map scope|Command:" .harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md' -> pass (reinforced architecture-control-surface signals found)
- Command: zsh -lc 'LC_ALL=C rg -n "[^ -~\\t]" .harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md' -> pass (no non-ASCII matches; rg exit 1 means no matches)
