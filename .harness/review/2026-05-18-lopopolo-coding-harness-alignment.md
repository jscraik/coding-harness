# Lopopolo Harness Engineering Alignment Review

Date: 2026-05-18

## Table of Contents

- [Purpose](#purpose)
- [Evidence Used](#evidence-used)
- [Alignment Legend](#alignment-legend)
- [Fully Aligned](#fully-aligned)
- [Partially Aligned](#partially-aligned)
- [Gaps](#gaps)
- [Contradictions And Tensions](#contradictions-and-tensions)
- [Trim, Refactor, Or Remove](#trim-refactor-or-remove)
- [Recommended Next Moves](#recommended-next-moves)

## Purpose

Map the Ryan Lopopolo harness-engineering transcript extraction against Coding
Harness as it exists in this repository, then identify alignment, gaps,
contradictions, and surfaces worth trimming or refactoring.

This is a secondary-context review artifact. It should inform future
implementation only when an admitted .harness/linear, .harness/refactors,
.harness/specs, or .harness/plan slice references it.

## Evidence Used

- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/ryan-lopopolo-extreme-harness-engineering.md
- .harness/research/2026-05-16-harness-engineering-youtube-transcripts/transcripts/ryan-lopopolo-transcript-source.txt
- AGENTS.md
- CODESTYLE.md
- codestyle/04-docs-config-and-release.md
- .harness/README.md
- .harness/active-artifacts.md
- docs/roadmap/north-star.md
- docs/roadmap/agent-first-status.md
- docs/agents/01-instruction-map.md
- docs/agents/03-local-memory.md
- docs/agents/04-validation.md
- docs/agents/07b-agent-governance.md
- docs/agents/12-ai-review-governance.md
- .agents/skills/coding-harness/SKILL.md
- .agents/skills/improve-codebase-architecture/SKILL.md
- scripts/run-harness-evals.mjs

## Alignment Legend

- Fully aligned: Coding Harness has an explicit canonical contract, product
  surface, validation rule, or operating principle matching the extracted
  method.
- Partially aligned: The idea exists, but is advisory, local-only, fragmented,
  not yet automated, not yet live-state-backed, or not yet productized.
- Small gap: Naming, placement, wording, or local hygiene issue.
- Medium gap: A bounded missing contract, adapter, validator, or workflow
  integration.
- Full gap: A major missing product lane or control-loop capability.
- Critical gap: A present defect that directly invalidates the north-star
  promise unless handled.

## Fully Aligned

- Human attention is treated as the scarce resource. Coding Harness explicitly
  names PR lead time, review/rework, manual intervention, and merge-readiness
  block time as the target throughput metrics.
- The repo already frames itself as a portable agent operating system: thin
  surface, strong guardrails, durable memory, professional output.
- Repeated feedback is treated as system evidence, not an isolated correction.
  Root guidance requires steering feedback, failed checks, PR comments, and
  line-level review to become durable rules, tests, prompts, validators, or
  tracked exceptions.
- The north-star safety floor matches the transcript's responsible autonomy:
  deterministic evidence, current-head awareness, bounded remediation,
  rollback, and independent review.
- The memory model is strongly aligned. .harness/memory/LEARNINGS.md, Project
  Brain, imported learning artifacts, and review-context gates encode the
  transcript's idea that agents should learn from failures and prior work.
- The validation model already teaches agents through lints and gates. Baseline
  scripts, codestyle parity, docs steering guards, required checks, and
  CodeRabbit evidence are used as operating constraints rather than passive
  documentation.
- The repo prefers small high-leverage route surfaces over unlimited prompt
  sprawl. harness next --json, harness init, harness policy-gate, skill routing,
  and Project Brain are meant to hide complexity behind compact command
  contracts.
- The eval/observability direction is aligned. The north-star docs call for
  tracing real work, curating failures, structural and live behavior evals,
  distillation, organizational feedback loops, and capture-the-flag workflow
  skills.
- .harness/README.md already separates durable execution inputs from secondary
  context, generated runtime output, backups, and scratch data. That matches
  the transcript's warning that raw transcript or telemetry volume is not the
  product.
- PR and review governance is intentionally agent-native but independent:
  CodeRabbit, required checks, closeout evidence, Linear reconciliation, and
  self-approval limits all reinforce professional output.

## Partially Aligned

- Agent-first debugging is present as a principle, but the repo still leans
  heavily on Markdown artifacts and human-readable governance. The transcript
  pushes harder toward agents talking to services and diagnostics directly.
- Session trajectory distillation exists in docs, memory policy, and eval
  scripts, but it is not yet a daily productized loop that automatically turns
  session logs, PR failures, and review corrections into eval seeds and durable
  operating rules.
- Full PR lifecycle delegation is partly present through closeout evidence,
  review gates, Linear governance, and required checks. Live PR state, Linear
  state, and merge readiness still appear to require manual reconciliation in
  enough cases that the loop is not fully closed.
- Multi-agent rework is not first-class. The transcript treats disposable
  rework, multiple attempts, and cheap restart as core methods. Coding Harness
  has swarms, reviewers, evals, and active artifacts, but not a compact
  reusable attempt -> review -> discard or promote -> learn domain model.
- The repo has a strong command contract philosophy, but command truth can be
  brittle in local sandbox conditions. During this review, pnpm exec tsx
  src/cli.ts next --json failed with listen EPERM for a tsx IPC pipe under
  /tmp/tsx-501/5790.pipe.
- Reviewer independence is aligned, but reviewer-author negotiation is thinner.
  The transcript highlights reviewers pushing back, deferring, or challenging
  merges; Coding Harness mostly captures that as gates and independent review,
  not yet as a rich agent conversation contract.
- The small-skill-set principle is directionally aligned, but the repo still
  exposes many docs, gates, governance surfaces, skills, and generated
  artifacts. The right answer is likely stronger routing and summarization, not
  deleting the safety model.
- On-policy guardrails are aligned in intent. Portability remains partial
  because some loops depend on local memory, CodeRabbit imports, Linear/GitHub
  state, MCP health, or environment-specific tool behavior.

## Gaps

### Small

- The raw transcript artifacts live at root .harness/*, which is ignored by
  default. That is correct for bulk source material, but the useful distilled
  findings need curated tracked placement such as .harness/review/.
- The source transcript filename says ryan-lolopolo while the curated extraction
  uses ryan-lopopolo. Standardize retained filenames and titles if these
  artifacts become durable references.
- CLI and validation outputs should keep getting more token-efficient for
  agents: quiet pass summaries, exact failing snippets, and compact JSON for
  next decisions.
- Some secondary-context artifacts can become stale unless explicitly linked
  from active execution inputs. .harness/active-artifacts.md should remain lean
  and current.

### Medium

- Add a first-class session-distillation workflow that turns session evidence,
  PR comments, failed checks, and repeated steering into one or more of:
  .harness/memory/LEARNINGS.md, eval seeds, guard updates, docs updates, or
  tracked skip reasons.
- Add a mandatory pattern-generalization pass after steering or review feedback.
  Codex should infer the rule behind a local correction, search sibling code,
  tests, docs, schemas, generated projections, and command surfaces, then apply
  the rule broadly or record why related surfaces were intentionally left alone.
- Harden source-repo command truth for sandboxed environments. If tsx IPC pipe
  creation can fail in common agent contexts, add a wrapper, compiled fallback,
  or documented no-IPC path for core discovery commands such as harness next
  --json.
- Add a reusable rework loop contract: run multiple attempts, compare evidence,
  throw away low-quality outputs cheaply, promote the best result, and record
  what missing context caused the rejected attempts.
- Make live PR/Linear/GitHub reconciliation a product surface rather than a
  closeout checklist. The repo already demands proof; the missing piece is a
  compact agent command that proves it without manual cross-checking.
- Create an agent-readable diagnostic-pack pattern for failures. The transcript
  repeatedly turns unclear errors into compact, structured context for the next
  agent pass.
- Define reviewer-agent negotiation semantics: when a reviewer can defer,
  object, request evidence, accept risk, or mark a failure as pre-existing,
  unrelated, or environment-owned.

### Full

- A Symphony-like coordination plane is not yet present as a coherent product
  lane: queued work, parallel agent attempts, cheap discard, reviewer
  arbitration, PR lifecycle execution, and human escalation in one small model.
- Organization-level trajectory learning is not fully productized. Coding
  Harness has the pieces, but not yet a recurring control loop that harvests
  trajectories across work, distills them, validates them, and feeds them back
  into skills, gates, prompts, and eval suites.
- Agent-native observability is still more artifact/eval/governance oriented
  than service oriented. The transcript points toward traces, metrics,
  dashboards, and debugging surfaces that agents can query directly.
- Spec-as-software is underdeveloped as a product lane. harness init and eval
  scripts help, but there is not yet a first-class loop for spec -> agent
  reimplementation -> review -> spec refinement -> reusable harness.

### Critical

- No current critical gap invalidates the north star. The strongest critical
  watch item is surface-area drift: if governance artifacts become the product
  instead of the product producing better agent outcomes, the repo can satisfy
  its own paperwork while missing the transcript's core lesson.
- Critical watch item: if Jamie has to repeat the same steering across multiple
  places, the harness is failing at larger-system judgment. Local correction
  must become sibling-pattern search and shared-rule repair, not a series of
  manually requested edits.
- Command truth failure would become critical if repeated in clean agent
  contexts. One observed tsx IPC failure is a medium operational gap; repeated
  failures around core commands should escalate to critical because they break
  the agent-operating-system promise.

## Contradictions And Tensions

- The transcript often leans toward no-human-code and post-merge review.
  Coding Harness intentionally keeps independent review, branch protection, and
  high-risk human mediation. This is a deliberate safety boundary, not a defect.
- The transcript favors full domain access and cheap discard. Coding Harness
  emphasizes bounded autonomy, dry runs, rollback, current-head checks, and
  provenance. That costs speed, but preserves portability and customer safety.
- The transcript is skeptical of heavy MCP/tool injection because it can bloat
  context and fail under compaction. Coding Harness uses MCP and Local Memory in
  some operational paths. Treat those as adapters that must fail soft, not as
  mandatory startup assumptions.
- The transcript prefers agent-first diagnostics over human dashboards. Coding
  Harness has many Markdown and governance artifacts. The north-star already
  warns against static artifacts as the endpoint, but the repo should keep
  applying that pressure.
- The transcript encourages internalizing low/medium-complexity dependencies.
  Coding Harness publishes a portable package with downstream compatibility
  obligations, so dependency internalization should be selective and justified.
- The transcript praises a small shared skill set. Coding Harness has a large
  surface of skills, docs, gates, and policy. The reconciliation is progressive
  disclosure: keep the expert surface hidden behind a few command and route
  primitives.

## Trim, Refactor, Or Remove

- Trim raw transcript artifacts out of canonical navigation. Keep bulky source
  transcripts local/ignored and promote only distilled, curated Markdown or JSON
  into tracked .harness areas.
- Refactor repeated steering, PR closeout, and validation-governance prose into
  fewer canonical sources with generated or checked projections.
- Trim .harness/active-artifacts.md to only current execution-input items.
  Historical context should remain available elsewhere without routing future
  agents by accident.
- Remove or demote artifacts that do not feed a next decision, validator, eval,
  reviewer, or durable memory surface.
- Refactor command output for agent efficiency: compact JSON, failing snippets,
  changed-state summaries, and explicit next actions.
- Refactor implementation and review workflows so line-level feedback triggers
  a broader inventory: inferred principle, sibling search, changed siblings,
  intentionally unchanged siblings with reasons, and validation evidence.
- Refactor Linear, GitHub, CodeRabbit, and Symphony-like behavior behind a
  common coordination/rework interface so external systems do not dominate the
  core mental model.
- Remove mandatory MCP assumptions from startup-critical paths. Keep MCP useful
  where healthy, but require CLI and file-based fallbacks for the core loop.
- Refactor broad skill/governance taxonomies into a smaller number of front
  doors that route to deep references only when the current task needs them.

## Recommended Next Moves

1. Create an agent-rework/v1 spec for cheap discard, rerun, comparison,
   promotion, and missing-context learning.
2. Add a session-distillation command or documented workflow that converts real
   session, PR, check, and review evidence into durable memory and eval seeds.
3. Add a pattern-generalization gate for user steering and review comments:
   infer principle, search siblings, repair the shared owner, validate, and
   record intentionally unchanged surfaces.
4. Investigate the tsx IPC failure for core source-repo commands and add a
   robust fallback if it reproduces.
5. Define an agent-output style rubric for harness commands: pass silence,
   failure snippets, JSON summaries, and exact next actions.
6. Promote this review into an admitted .harness/refactors, .harness/specs, or
   Linear slice only after choosing which gap to execute first.
