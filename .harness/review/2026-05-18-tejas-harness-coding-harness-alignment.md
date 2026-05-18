# Tejas Harness Alignment Review

Date: 2026-05-18

## Table of Contents

- [Purpose](#purpose)
- [Evidence Used](#evidence-used)
- [Tejas Harness Thesis](#tejas-harness-thesis)
- [Alignment Legend](#alignment-legend)
- [Fully Aligned](#fully-aligned)
- [Partially Aligned](#partially-aligned)
- [Gaps](#gaps)
- [Contradictions And Tensions](#contradictions-and-tensions)
- [Trim, Refactor, Or Remove](#trim-refactor-or-remove)
- [Recommended Next Moves](#recommended-next-moves)

## Purpose

Map the Tejas Kumar harness transcript against Coding Harness as it exists in
this repository. This review focuses on the concrete agent-harness mechanics
from the talk: grounding black-box models in deterministic tools, context,
guardrails, traces, retries, verification, and harness-owned recovery logic.

This is a secondary-context review artifact. It should inform future
implementation only when an admitted .harness/linear, .harness/refactors,
.harness/specs, or .harness/plan slice references it.

## Evidence Used

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/youtube-transcripts-harness.md
- AGENTS.md
- CODESTYLE.md
- codestyle/04-docs-config-and-release.md
- .harness/README.md
- .harness/active-artifacts.md
- .harness/decisions/ADR-001-pr-loop-cockpit-core.md
- .harness/decisions/ADR-002-command-truth-and-surface-budget.md
- .harness/decisions/ADR-003-executable-governance-or-delete.md
- .harness/core/execution-invariants.md
- .harness/core/agent-operating-rules.md
- docs/roadmap/north-star.md
- docs/roadmap/agent-first-status.md
- docs/agents/03-local-memory.md
- docs/agents/04-validation.md
- docs/agents/07b-agent-governance.md
- docs/agents/12-ai-review-governance.md
- .agents/skills/coding-harness/SKILL.md
- .agents/skills/improve-codebase-architecture/SKILL.md

## Tejas Harness Thesis

The talk defines an agent harness as everything around a model that ties it to
a stable environment. The harness exists because rented models are black boxes:
they are nondeterministic, model routing can change, token/context limits
matter, and the user does not control the model internals.

The key mechanics extracted from the talk:

- Tool registry: expose stable, typed actions the model can call.
- Context management: keep, trim, compact, and shape context deliberately.
- Guardrails: max iterations, max messages, stop conditions, safety bounds.
- Agent loop: the repeated model/tool/context cycle, sometimes wrapped by a
  higher harness loop.
- Verification: deterministic checks after agent action so the model cannot
  simply claim success.
- Trace history: record events so the harness can inspect what really happened.
- Retry loop: attempt, verify, retry up to a bounded maximum.
- Deterministic recovery handlers: solve known environmental problems outside
  the model, such as logging in, injecting secure state, or recovering from a
  redirect.
- Do not just prompt harder: move repeated failure handling into harness code,
  not only into system prompts.
- Future direction: dynamic, on-the-fly generated harnesses that an agent builds
  before doing risky work.

## Alignment Legend

- Fully aligned: Coding Harness has an explicit canonical contract, product
  surface, validation rule, or operating principle matching the extracted
  method.
- Partially aligned: The idea exists, but is advisory, fragmented, local-only,
  not fully deterministic, or not yet productized.
- Small gap: Naming, placement, wording, or local hygiene issue.
- Medium gap: A bounded missing contract, adapter, validator, or workflow
  integration.
- Full gap: A major missing product lane or control-loop capability.
- Critical gap: A present defect that directly invalidates the north-star
  promise unless handled.

## Fully Aligned

- Coding Harness already agrees that harnesses exist for reliability around
  nondeterministic agents. The north star names durable guardrails, executable
  evidence, review readiness, and professional output as the core value.
- The repo has a clear harness-as-control-plane identity. ADR-001 defines the
  core product as init, next --json, verify, review-gate, and learned-failure
  promotion around the agent-authored PR loop.
- Verification is deeply aligned. Execution invariants say work is not complete
  until the relevant runtime path has observable evidence, exact command
  outcomes outrank inferred correctness, and blockers must be recorded rather
  than hidden.
- The talk's warning against "prompt it harder" matches ADR-003. Governance must
  become executable, generated, or explicitly reference-only; prompt growth must
  not substitute for deterministic checks when a check is feasible.
- Guardrails are strongly aligned. Root guidance and agent governance require
  validation ownership classification, rollback conditions, required checks,
  current-head evidence, and repeated-failure promotion.
- Context management is aligned at the Project Brain level. .harness/README.md
  classifies execution inputs, secondary context, generated runtime output,
  backups, and scratch data so future agents can load the right context without
  swallowing everything.
- Command truth is aligned with tool registry thinking. ADR-002 treats CLI
  dispatch, registry metadata, help output, docs, packaged skills, and
  validation gates as one synchronized command surface.
- Trace/evidence thinking is aligned. The repo uses runs, gates, review logs,
  learning artifacts, CodeRabbit imports, session evidence, and closeout proof
  as the audit trail for what actually happened.
- Bounded retry and safety posture exist in repo workflow: narrow validation
  first, broader validation when risk increases, and do not claim readiness
  when eval proof, fixture proof, or current-head evidence is missing.
- The talk's "cheap model plus strong harness" point maps well to Coding
  Harness: the value is not model magic; the value is deterministic execution
  support that lets agents behave more like reliable engineers.

## Partially Aligned

- Tool registry exists conceptually through CLI command metadata, capability
  metadata, packaged skills, and repo wrappers. It is not yet as compact as the
  Tejas model of a small typed tool registry given directly to the agent loop.
- Context compaction exists as Project Brain selection and docs layering, but
  not as a runtime-level context compressor that records what was kept, trimmed,
  or summarized for each agent decision.
- Verification exists broadly, but the talk's trace-driven deterministic
  verifier is more direct. Coding Harness often verifies through shell gates,
  PR checks, docs contracts, and review evidence rather than a single
  harness-owned verify function over event history.
- Harness-owned recovery handlers exist as governance ideas and scripts, but
  not as a general extension point. The Tejas login handler pattern suggests a
  reusable slot for known environment failures, auth redirects, setup drift, or
  missing prerequisites.
- Retry behavior is present in workflow guidance and eval/runs artifacts, but
  not yet as a first-class reusable attempt loop with structured trace,
  verification result, retry reason, and final failure classification.
- The agent loop is implicit across Codex, CLI commands, validation gates, and
  PR lifecycle docs. Coding Harness does not yet expose a small explicit
  "harness loop" abstraction that makes the model/tool/context/verify cycle
  visible to agents.
- Dynamic on-the-fly harnesses are only partially present. Plan/spec/eval
  workflows can produce harness-like scaffolding, but agents do not yet create
  task-specific temporary harnesses before risky work.
- Enterprise/security grounding is present in governance, required checks, and
  data handling rules, but not as a single "secure deterministic handler"
  pattern for secrets, credentials, and privileged actions.

## Gaps

### Small

- The Tejas transcript is stored as .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/youtube-transcripts-harness.md,
  which is root .harness ignored source material. The useful distilled mapping
  belongs in tracked curated review context, which this file provides.
- The repo could use a short glossary distinction between ML eval harness,
  agent harness, PR-loop harness, and Coding Harness as a product. The talk
  explicitly warns that "harness" means different things in different worlds.
- Some command and validation outputs are still shaped for humans first. Tejas'
  harness pattern wants compact event history and deterministic result fields.
- Existing Project Brain context routing is good, but it could record "why this
  context was included or trimmed" more explicitly for future agents.

### Medium

- Add a typed event-history contract for core harness runs. The Tejas demo uses
  traces to detect "the agent lied" and identify login redirects. Coding
  Harness has evidence artifacts, but not one small event stream contract for
  agent-loop reasoning.
- Add a pattern-generalization pass after steering or review feedback. When a
  user corrects one instance, the harness should infer the underlying rule,
  search sibling files, tests, docs, schemas, generated projections, and command
  surfaces, then either apply the rule broadly or record why a sibling was
  intentionally left unchanged.
- Add deterministic recovery-handler slots for known failure modes: auth/setup
  redirect, missing dependency, stale branch, unavailable MCP, tsx IPC failure,
  missing Linear/GitHub state, or check-provider drift.
- Add a bounded attempt contract: attempt id, max attempts, stop reason,
  verifier result, recovery handler used, retry reason, final classification.
- Add runtime context-budget metadata to harness decisions: included sources,
  excluded sources, compaction reason, and context-risk warnings.
- Make command registry metadata closer to a model-facing tool registry:
  concise descriptions, input schema, output schema, side-effect class, risk
  tier, verification command, and failure semantics.
- Provide a "do not prompt harder" diagnostic path. When repeated instructions
  or policy prose are added, force the agent to check whether a deterministic
  harness handler, gate, or verifier is feasible instead.

### Full

- Coding Harness does not yet have an explicit generic agent-loop runtime:
  tool registry, context manager, guardrail manager, trace store, verifier, and
  recovery handler as one small composable harness primitive.
- Dynamic harness generation is not a first-class product capability. The
  future Tejas describes would let an agent synthesize a task-specific harness
  before performing risky work, then run through that harness with verification.
- Harness-owned environment recovery is not generalized. Current recovery is
  spread across scripts, docs, preflight, skills, and human judgment rather
  than one deterministic recovery layer.
- Trace-driven truth checking is not unified. Coding Harness has many evidence
  surfaces, but no universal "claim vs trace vs verifier" mechanism that can
  catch success claims contradicted by the actual event history.

### Critical

- No current critical gap invalidates Coding Harness. The repo already has the
  correct direction: deterministic guardrails over prompt-only behavior.
- Critical watch item: if Codex needs the same steering repeated for each file,
  command, doc, or test surface, the harness is failing to convert local
  correction into larger-system judgment. This should be treated as a
  pattern-generalization defect, not a user-communication problem.
- Critical watch item: if governance prose keeps growing where deterministic
  handlers are possible, Coding Harness will contradict the Tejas thesis. The
  harness should solve repeated failures in executable machinery, not by asking
  the next model to remember more words.
- Critical watch item: if core command truth cannot run reliably in normal
  agent environments, the "stable environment around the model" promise breaks.
  The previously observed tsx IPC failure should be investigated if repeated.

## Contradictions And Tensions

- Tejas presents a compact runtime harness around a single task. Coding Harness
  is a repo/product harness around a PR lifecycle. That difference is valid,
  but it can hide the simpler inner loop that agents need.
- Tejas uses deterministic code to solve login and verification. Coding Harness
  sometimes solves equivalent problems with instructions, docs, and workflow
  policy. ADR-003 already says executable governance should win when feasible.
- Tejas' demo harness can access secrets inside a deterministic handler. Coding
  Harness must be stricter: secrets and privileged state need redaction,
  approval boundaries, auditability, and safe fallbacks.
- The talk compresses context naively by keeping system, user, and recent
  messages. Coding Harness correctly needs richer context routing because repo
  work depends on specs, plans, memory, docs, PR state, and validation evidence.
- The talk is model/provider pragmatic: use cheap or free models behind a good
  harness. Coding Harness is Codex-first by design. That is a product focus,
  but the underlying contracts should remain model-agnostic where practical.
- Dynamic harness generation sounds powerful, but Coding Harness should not
  allow generated harnesses to bypass existing contract, security, validation,
  and review gates.

## Trim, Refactor, Or Remove

- Trim prompt-only fixes when a deterministic verifier, guardrail, recovery
  handler, or validation gate can encode the same rule.
- Refactor scattered recovery guidance into a typed recovery-handler catalog
  with owner, trigger, action, side-effect class, audit output, and validation.
- Refactor command metadata toward model-facing tool definitions instead of
  human help text alone.
- Remove or demote root .harness transcript source material from any active
  route. Keep it as ignored source evidence; use curated review files for agent
  navigation.
- Refactor evidence artifacts toward an event-history shape that can answer:
  what happened, what the agent claimed, what verifier ran, what contradicted
  the claim, and what recovery happened.
- Trim repeated governance prose by routing the rule into ADR-003-style
  executable ownership: script, schema, generated projection, or explicit
  reference-only label.
- Refactor review and implementation workflows so every accepted line-level
  correction asks: what is the sibling pattern, where else can this defect
  exist, which shared source should own the rule, and what validation proves the
  broader pass happened?
- Refactor Project Brain context routing to include context-budget and
  compaction metadata for why sources were loaded or skipped.

## Recommended Next Moves

1. Define a harness-run/v1 event contract for attempts, tool calls, guardrails,
   verifier results, recovery handlers, and final status.
2. Create a recovery-handler catalog for repeated environment failures and
   closeout blockers.
3. Add command/tool metadata that is explicitly model-facing: schema,
   side-effects, risk, output contract, verification, and failure semantics.
4. Add a deterministic verifier pattern for agent claims, starting with PR-loop
   readiness claims and validation success claims.
5. Add a pattern-generalization gate for steering feedback and review comments:
   infer rule, search siblings, update shared owner, validate, and record
   intentionally unchanged surfaces.
6. Explore a dynamic-harness spec as a bounded future lane: generated temporary
   harnesses are allowed only when they declare guards, verifiers, recovery
   handlers, and deletion conditions.
