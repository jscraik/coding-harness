# Coding Harness Recommendation Evaluation

Generated: 2026-05-18

Purpose: evaluate the May 2026 implementation recommendations against the
actual Coding Harness north star, current roadmap, and consolidated evidence.
This is not a generic AI-platform roadmap. It is a project-specific filter for
what Coding Harness should absorb, adapt, defer, or reject.

Inputs:

- .harness/research/deep/2026-05-18-coding-harness-evidence.md
- .harness/strategy/coding-harness-strategy.md
- docs/roadmap/north-star.md
- docs/roadmap/agent-first-status.md
- harness.contract.json

## Table of Contents

- [Executive Decision](#executive-decision)
- [Project-Specific Interpretation](#project-specific-interpretation)
- [Recommendation Matrix](#recommendation-matrix)
- [Implementation Sequence](#implementation-sequence)
- [Truth Layer](#truth-layer)
- [Validation And Enforcement](#validation-and-enforcement)
- [Recovery Systems](#recovery-systems)
- [Context Engineering](#context-engineering)
- [Skills Mapping](#skills-mapping)
- [Eval Strategy](#eval-strategy)
- [Deferred Or Rejected Stack Choices](#deferred-or-rejected-stack-choices)
- [Immediate Work Items](#immediate-work-items)
- [Guardrails](#guardrails)
- [Final Assessment](#final-assessment)

## Executive Decision

The recommendations are directionally right but too generic for this repo.

Coding Harness should adopt the architecture principle:

- deterministic runtime around unreliable cognition
- verifier-owned truth
- evented evidence
- fast local validation
- deterministic recovery
- hot/cold context separation
- small high-density skills
- executable governance

Coding Harness should not adopt the generic stack wholesale.

The project already has a stronger and narrower product shape:

- TypeScript CLI as control plane
- harness.contract.json as repo policy substrate
- HarnessDecision and command metadata as agent cognition layer
- docs-gate, drift-gate, review-context, north-star-feedback, and verify-work as executable governance
- pr-closeout, runtime-card, evidence bundles, and gate outputs as the right trace/evidence anchors
- pnpm, Vitest, TypeScript, Biome, repo validators, and shell wrappers as the current validation path

Project-specific decision:

Build the next layer around existing harness primitives, not around a new
framework stack. The next roadmap slice should be PR-loop truth, deterministic
recovery, and replayable evals.

## Project-Specific Interpretation

The generic advice says "build a truth layer first."

For Coding Harness, that means:

- do not invent an independent trace platform first
- extend the existing artifact vocabulary: pr-closeout/v1, runtime-card/v1, runtime-evidence-bundle/v1, HarnessDecision, gate result JSON, review-context output, and north-star-feedback output
- make closeout claims mechanically checkable against evidence
- preserve current-head SHA discipline
- record missing-context and recovery decisions as first-class events
- keep raw research and transcripts cold unless distilled into fixtures, validators, invariants, or explicit roadmap decisions

The generic advice says "thin orchestration."

For Coding Harness, that means:

- keep harness next --json and CLI commands as the front door
- avoid creating a second orchestration runtime until a trace/eval use case proves it
- treat Codex, GitHub, Linear, CI, local memory, and skills as integrations behind harness-stable contracts
- do not expose provider-specific workflow complexity directly to agents

The generic advice says "fast validation."

For Coding Harness, that means:

- improve existing pnpm, Vitest, TypeScript, Biome, codestyle, docs-gate, and verify-work lanes before considering NX/Turbo/Bazel
- measure inner-loop duration and failure clarity before changing build systems
- add narrower affected-path checks only where current gates are too slow or too broad

## Recommendation Matrix

| Recommendation | Verdict | Project-specific decision | Why |
| --- | --- | --- | --- |
| OpenAI Codex CLI as primary runtime | Accept as operator assumption | Keep Codex-first workflow, but keep repo truth in the TypeScript CLI and generated contracts. | The product is a portable Codex-facing operating contract, not a replacement runtime. |
| OpenAI Agents SDK | Defer / adapter only | Do not move core orchestration into Agents SDK. Consider it only for eval harnesses or optional downstream adapters. | Current moat is repo-local contracts and gates; SDK adoption would be premature stack churn. |
| Playwright | Conditional accept | Use where browser/runtime evidence is required; do not make it core for non-browser CLI flows. | Useful for capture-the-flag skill evals and UI evidence, irrelevant to many harness commands. |
| tmux plus git worktrees | Accept as operating pattern | Preserve worktree-per-agent and parallel execution guidance. Productize only when a current harness command needs it. | Simple and debuggable, but not a library dependency. |
| Structured JSONL traces | Strong accept, adapted | Add evented trace output through existing artifacts before creating a standalone store. | Aligns with runtime-card, evidence bundles, gate JSON, and PR closeout proof. |
| OpenTelemetry plus Grafana | Defer | Keep structured local artifacts first. Add OTel export only after trace schema stability and consumer demand. | Observability must reduce PR lead time, not become a dashboard project. |
| NX/Turbo/Bazel | Mostly reject for now | Measure existing loop first. Use pnpm/Vitest/TypeScript plus related-test and focused gates. | The repo is not yet bottlenecked enough to justify build-system migration. |
| ESLint v9 custom validators | Adapt | Prefer existing Biome plus custom repo validators. Add ESLint only if a rule cannot be expressed cleanly elsewhere. | The principle is mechanical enforcement, not a specific lint stack. |
| dependency-cruiser / madge | Conditional accept | Use for one proven architecture invariant if custom validators are insufficient. Avoid broad graph-tool adoption first. | Mechanical boundaries matter, but tool sprawl is a known risk. |
| ts-morph / AST checks | Accept selectively | Use for command registry, contract schema, docs parity, and invariant checks where text search is brittle. | Fits existing TypeScript control-plane shape. |
| Braintrust / OpenEvals | Defer external, accept pattern | Build custom local replay fixtures first. Export later if stable datasets need external scoring. | Vendor workflow must not become architecture. |
| Custom replay harness | Strong accept | Make this the eval backbone for false-success, context loss, recovery, closeout, and drift cases. | Directly supports the north-star learning loop. |
| Postgres plus object storage | Reject for current core | Keep durable file artifacts first: JSON, JSONL, Markdown, and .harness contracts. | Portability and zero ceremony are higher priority than backend durability. |
| Doppler / 1Password / Vault | Accept principle, not vendor | Enforce no secrets in prompts, traces, docs, or artifacts; integrate with whatever repo already uses. | Secrets governance matters, vendor lock-in does not. |
| Sparse plus vector retrieval | Adapt | Use sparse/path/symbol retrieval first. Vector retrieval is cold-path only for large research/history sets. | Repo cognition depends on exact file names, commands, schemas, and symbols. |
| Few high-density skills | Accept | Compress skills around actual harness workflows, not generic names. | Matches evidence and current repo strategy. |
| Deterministic recovery registry | Strong accept | Build bounded handlers for known recurrent blockers with authority, verification, rollback, trace, and retirement rules. | Converts repeated steering into executable system improvement. |

## Implementation Sequence

### Phase 0: No Stack Churn

Do not add Agents SDK, NX, Turbo, Bazel, Grafana, Postgres, object storage,
Braintrust, OpenEvals, dependency-cruiser, or madge by default.

Acceptance condition for any new tool:

- the current repo primitive cannot express the needed invariant
- the tool reduces PR lead time, review rework, closeout ambiguity, or brownfield install risk
- the tool has a narrow owner, fixture, validation command, and removal path

### Phase 1: PR Closeout Truth Layer

Make pr-closeout the first user-visible truth layer.

Required behavior:

- every closeout claim maps to evidence
- evidence has freshness, source, SHA, and blocker classification
- missing evidence produces blocked or unknown, not success
- model-written summary cannot outrank verifier output
- closeout emits a compact trace/event artifact that can become eval input

Initial claim classes:

- tests passed
- CI green
- review threads resolved
- PR metadata ready
- branch current with base
- Linear or tracker state aligned
- CodeRabbit or independent review status known
- required checks match current HEAD
- rollback path named or not applicable

### Phase 2: Missing-Context Classifier

Turn review comments, failed checks, discarded runs, and repeated steering into
typed missing-context evidence.

Initial classes:

- missing repo instruction
- stale docs or command reference
- missing verifier
- missing recovery handler
- missing fixture
- missing permission/auth explanation
- hidden provider behavior
- unmodeled current-state dependency
- ambiguous ownership boundary

Output destinations:

- gate/validator when deterministic
- fixture/eval when behavior can recur
- Project Brain learning when durable but not yet executable
- roadmap exception when intentionally deferred
- cold research reference when source material is useful but not hot-path truth

### Phase 3: Deterministic Recovery Registry

Build a bounded registry only after the truth layer can prove failures.

Handler contract:

- id
- trigger condition
- authority level
- required secret or permission boundary
- verify-before
- recover
- verify-after
- rollback or stop condition
- trace fields
- retirement condition

Start with recurring Coding Harness blockers:

- stale branch or non-current SHA
- missing required check metadata
- unknown CI provider state
- local setup/preflight failure with known repair
- missing generated artifact parent directory
- auth or permission unavailable
- dirty worktree prevents safe mutation
- merge conflict requiring human boundary
- docs-gate or drift-gate mismatch with known source-of-truth update

Do not start with broad browser-login automation unless a workflow eval proves it
is a high-frequency harness blocker.

### Phase 4: Architecture Invariant Gates

Mechanical enforcement should target known Coding Harness risks first.

Initial invariant candidates:

- command registry, README, CLI reference, and dispatch stay synchronized
- harness.contract.json and docs/roadmap status dates stay synchronized when north-star surfaces change
- pr-closeout evidence cannot report success without current-head proof
- runtime-card and evidence-bundle schemas remain advisory and artifact-backed
- route-decision stays read-only and cannot become executable authority
- CI ownership remains CircleCI for PR governance, GitHub Actions for release, Semgrep Cloud as external security check
- .harness research remains cold unless promoted into core docs, gates, fixtures, or decisions

Prefer custom validators or ts-morph checks over broad dependency graph tools
unless import-boundary drift becomes a measured problem.

### Phase 5: Replay Eval Harness

Build local replay fixtures before external eval platforms.

Minimum eval set:

- false-success closeout: model says done, evidence is missing
- stale-CI success: checks are green for an old SHA
- context-loss: compacted run loses required blocker or next action
- retry-without-progress: repeated same failure without classification
- recovery-success: known blocker recovered and verified
- recovery-denied: handler refuses unsafe or unauthorized repair
- architecture-drift: command/docs/registry mismatch detected
- review-disagreement: reviewer feedback accepted/deferred with evidence
- secret-leakage: traces redact env vars, tokens, and secret-like values
- missing-context-promotion: repeated steering becomes durable destination

Scoring should measure operational reliability, not prose quality.

### Phase 6: Context And Skill Compression

After truth/recovery/evals exist, compress hot-path context.

Hot path:

- AGENTS.md
- CODESTYLE.md and relevant codestyle module
- harness next --json
- command registry metadata
- harness.contract.json
- active roadmap status
- relevant gate schema and output
- current task artifact

Cold path:

- transcripts
- long research docs
- discarded runs
- raw traces
- experimental strategy notes
- historical discussions

Promotion rule:

Cold evidence enters hot path only as a compressed invariant, command behavior,
fixture, validator, recovery handler, roadmap decision, or explicit exception.

## Truth Layer

Project-specific trace events should be introduced as an extension of existing
artifacts, not as a parallel platform.

Candidate event names:

- claim.recorded
- evidence.observed
- evidence.missing
- verifier.started
- verifier.passed
- verifier.failed
- verifier.blocked
- recovery.classified
- recovery.applied
- recovery.denied
- recovery.verified
- context.compacted
- context.missing_detected
- gate.started
- gate.result
- reviewer.feedback_received
- reviewer.feedback_resolved
- final.status

Minimum fields:

- schemaVersion
- eventId
- parentEventId
- runId
- taskId
- repoRoot
- worktreeId
- branch
- headSha
- command
- provider
- evidenceRef
- verifierResult
- blockerClass
- authority
- redactionStatus
- timestamp

Storage:

- start with local JSONL or JSON artifacts under existing artifact locations
- keep output small enough for agents to read
- preserve enough structure for replay fixtures
- avoid central databases until multiple repos require cross-run query at scale

## Validation And Enforcement

Current repo-specific validation stack remains canonical:

- pnpm check
- pnpm test
- pnpm typecheck
- pnpm build
- bash scripts/validate-codestyle.sh
- bash scripts/verify-work.sh
- bash scripts/run-harness-gate.sh docs-gate --mode required --json
- bash scripts/run-harness-gate.sh drift-gate --mode health --json
- targeted command tests for changed CLI behavior

New enforcement should be added as repo validators first.

Add external enforcement tools only if:

- the invariant cannot be checked clearly by an existing script
- the tool is faster or less brittle than a custom validator
- the new dependency has a small fixture and a removal path

## Recovery Systems

Recovery should be deterministic and boring.

Rules:

- no open-ended retry loops
- no recovery without verify-before and verify-after
- no secret-dependent recovery without explicit secret boundary
- no state mutation without authority classification
- no handler that hides the original failure text
- no handler without trace emission
- no handler without a retirement rule

Recovery is allowed to stop.

A stopped, well-classified recovery is a success if it preserves evidence and
gives the next owner a safe action.

## Context Engineering

Project-specific retrieval order:

1. exact task artifact or command output
2. harness next --json or command metadata
3. nearest AGENTS/CODESTYLE scope
4. relevant contract/gate schema
5. active roadmap or decision surface
6. sparse search over repo files
7. cold research or transcript evidence
8. vector/semantic retrieval only when sparse retrieval cannot locate concepts

This repo should treat pure vector retrieval as a research accelerator, not as
execution authority.

## Skills Mapping

Do not create the generic six-skill set as named new surfaces by default.

Map the recommendation to existing Coding Harness concepts:

| Generic skill | Coding Harness mapping | Decision |
| --- | --- | --- |
| spec-builder | .harness/specs, planning artifacts, Linear-ready plans, existing harness-engineering routes | Use existing surfaces before adding a skill. |
| architecture-review | .harness/review, architecture bootstrap docs, drift-gate, docs-gate | Keep as review/eval workflow, not just prose. |
| verifier-builder | gate templates, validator scripts, command tests, claim-vs-evidence closeout | Needed as capability; implement through validators first. |
| recovery-builder | deterministic recovery registry and fixtures | Needed, but start as registry contract plus tests. |
| land | pr-closeout, review-gate, verify-work, GitHub/Linear closeout rules | Do not fork into a separate generic land skill yet. |
| drift-review | drift-gate, docs-gate, review-context, north-star-feedback | Already exists; strengthen with fixtures and current-head evidence. |

Skill rule:

A skill earns hot-path status only if it reduces repeated steering or improves
a capture-the-flag outcome. Otherwise it remains a cold reference or gets
deleted.

## Eval Strategy

The best project-specific eval platform is local replay first.

Replay fixture sources:

- pr-closeout failures
- docs-gate and drift-gate findings
- review-context misses
- CodeRabbit/local review learnings
- discarded or blocked runs
- Linear closeout mismatches
- canary installs in agent-skills, diagram-cli, design-system, and x-writer
- session evidence where available

External platforms may be useful later, but only after the repo has stable
datasets and scoring semantics.

Eval outputs should answer:

- did the harness prevent false success?
- did it identify missing context?
- did it choose the right next action?
- did it stop safely when authority was missing?
- did it preserve current-head truth?
- did it reduce manual glue work?
- did it avoid adding hot-path context load?

## Deferred Or Rejected Stack Choices

### OpenAI Agents SDK

Deferred for core orchestration.

Possible future use:

- optional agent prototype runner
- eval scenario driver
- integration adapter for downstream projects

Not acceptable now:

- moving harness next orchestration into SDK flows
- making SDK traces the only source of truth
- requiring SDK setup for zero-ceremony install

### NX / Turbo / Bazel

Rejected for current roadmap.

Possible future use:

- if measured inner-loop validation exceeds acceptable budgets
- if multi-package graph growth makes related-test selection brittle
- if canary repos prove build graph compression is the blocker

Not acceptable now:

- migration without measured loop bottleneck
- using build-system churn as a substitute for verifier quality

### OpenTelemetry / Grafana

Deferred.

Possible future use:

- optional export from stable trace schema
- local or CI dashboard for aggregate PR-loop metrics

Not acceptable now:

- dashboard-first observability
- raw trace volume without replay/eval consumption

### Postgres / Object Storage

Rejected for current core.

Possible future use:

- separate multi-repo telemetry collector
- long-term artifact warehouse outside the installable harness

Not acceptable now:

- making local harness adoption require a service backend
- replacing portable artifacts before file-based evidence is exhausted

### Braintrust / OpenEvals

Deferred as external systems.

Possible future use:

- exporting stable replay datasets
- comparing model/runtime changes over retained fixtures

Not acceptable now:

- scoring prose quality instead of operational reliability
- vendor-specific eval semantics becoming the repo contract

### dependency-cruiser / madge

Conditional.

Possible future use:

- narrow import-boundary gate when command/control-plane modules drift

Not acceptable now:

- broad dependency graph policy before specific violations are defined

## Immediate Work Items

1. Define claim-vs-evidence closeout schema for pr-closeout/v1.
2. Add closeout fixtures for missing evidence, stale SHA, unresolved review, and unknown CI state.
3. Add missing-context classifier output to closeout or phase-exit artifacts.
4. Draft recovery-handler contract with authority, verification, rollback, and trace fields.
5. Implement one narrow recovery handler for a known, safe, recurring blocker.
6. Add replay fixture runner for false-success and recovery-denied cases.
7. Add a context promotion rule: research becomes hot-path only through invariant, fixture, validator, recovery handler, command behavior, or decision.
8. Audit skill overlap against actual capture-the-flag outcomes before adding any new skill surface.

## Guardrails

- Do not add new orchestration frameworks before closeout truth exists.
- Do not add new observability platforms before trace artifacts feed evals.
- Do not add build graph tools before validation time is measured.
- Do not treat raw research as hot-path instruction.
- Do not expose all MCP/tools as context by default.
- Do not encode repeated failures only in docs.
- Do not let model claims outrank verifier output.
- Do not let recovery handlers mutate state without authority and rollback classification.
- Do not make portability depend on a service backend.
- Do not create new skills until existing command/gate/skill surfaces cannot carry the behavior.

## Final Assessment

Strongest recommendation:

- verifier-owned truth with evented evidence

Most project-specific immediate candidate:

- claim-vs-evidence PR closeout backed by current-head gate proof and replay fixtures

Most important adaptation:

- build on existing TypeScript CLI, harness.contract.json, HarnessDecision,
  pr-closeout, runtime-card, gate outputs, docs-gate, drift-gate, and verify-work

Most important rejection:

- no framework or observability stack migration without measured bottleneck and a
  narrow repo-owned invariant

Highest leverage next move:

- make false-success mechanically impossible in closeout, then turn that artifact
  stream into the first replay eval set

Strategic rule:

Coding Harness should become more deterministic before it becomes more
autonomous. Every accepted recommendation must reduce PR lead time, review
rework, closeout ambiguity, brownfield install risk, or repeated human steering.

