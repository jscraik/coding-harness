---
schema_version: 1
reviewed_at: 2026-05-07
repo: coding-harness
artifact_type: architecture-review
review_lenses:
  - pragmatic-programmer
  - philosophy-of-software-design
  - extreme-programming
  - domain-driven-design
  - five-lines-of-code
---

# Coding Harness Architecture Review

## Table of Contents

- [Executive Summary](#executive-summary)
- [Review Method](#review-method)
- [Architectural Risk Assessment](#architectural-risk-assessment)
- [Repository Cognition Review](#repository-cognition-review)
- [Complexity Audit](#complexity-audit)
- [Deep vs Shallow Module Analysis](#deep-vs-shallow-module-analysis)
- [Domain Integrity Review](#domain-integrity-review)
- [Skill/Plugin Architecture Review](#skillplugin-architecture-review)
- [Agent-Native Capability Review](#agent-native-capability-review)
- [Governance & Workflow Review](#governance--workflow-review)
- [Refactor Recommendations](#refactor-recommendations)
- [Anti-Patterns Identified](#anti-patterns-identified)
- [Drift Risks](#drift-risks)
- [Technical Debt Hotspots](#technical-debt-hotspots)
- [Strategic Review](#strategic-review)
- [Recommended Simplifications](#recommended-simplifications)
- [Recommended Deletions](#recommended-deletions)
- [Recommended Core Investments](#recommended-core-investments)
- [Long-Term Scalability Risks](#long-term-scalability-risks)
- [Moat Analysis](#moat-analysis)
- [Competitive Replication Risk](#competitive-replication-risk)
- [Evidence & Traceability Matrix](#evidence--traceability-matrix)

## Executive Summary

Coding Harness is coherent. It is not a random pile of AI-flavored scripts. The
real product is a TypeScript control plane for shrinking the PR review/rework
loop by giving agents deterministic command surfaces, evidence contracts,
current-head discipline, review gates, branch-protection alignment, and packaged
repo setup defaults.

The architecture is genuinely agent-native where it matters most:

- `harness next --json` and the `HarnessDecision` envelope expose explicit
  next actions, required evidence, stop conditions, permissions, risk tier, and
  retry posture.
- The command catalog classifies commands by audience, tier, mutability,
  retryability, expected artifacts, safe-first alternatives, and agent mode.
- The north-star contract names PR lead time, review/rework cost, deterministic
  evidence, strict SHA discipline, bounded remediation, and independent review
  surfaces as first-class architectural concerns.
- The repo-local skill package includes install/update guidance, validation
  scripts, command references, evaluation prompts, and explicit capability
  boundaries.

The strongest claim is this: Coding Harness is not primarily a CLI. It is an
operational contract system for agentic development. The CLI is the execution
surface. The docs, contract, packaged skill, CI config, PR template, and
validation scripts are the governance substrate.

The biggest risk is that the governance substrate is becoming heavier than the
throughput problem it is meant to solve. The repo contains about 1407 inspected
files across source, tests, scripts, docs, agent skill surfaces, CI, and harness
state. It exposes 169 command files under `src/commands`. Several critical
files are large enough to become hidden coordination centers:

| File | Lines | Architectural concern |
| --- | ---: | --- |
| `src/commands/ci-migrate-core.ts` | 10402 | CI migration, parity proof, break-glass, provider API, merge queue, signatures, provenance, and state concerns share one oversized runtime unit. |
| `src/commands/ci-migrate.test.ts` | 6319 | The test harness mirrors the size of the orchestrator, which makes refactoring expensive. |
| `src/commands/review-gate-core.ts` | 1939 | Review readiness, provider checks, and policy interpretation appear concentrated. |
| `src/lib/contract/types-core.ts` | 1776 | Contract schema language is centralized enough to become a god vocabulary. |
| `scripts/verify-work.sh` | 1261 | Validation orchestration and fallback normalization are operationally important but hard to reason about locally. |
| `harness.contract.json` | 1120 | The contract is load-bearing, but it aggregates many policy domains. |

This is not fatal. It is a sign that the project has crossed from prototype
into control-plane architecture and now needs domain boundaries as hard as its
policy gates. Without those boundaries, the control plane will keep succeeding
locally while becoming harder to productize.

The moat is real only if measured as operational learning encoded into portable
contracts, gates, fixtures, and agent-facing decisions. The moat is not the
number of commands, the volume of docs, or the sophistication of the prompt
surface. A smaller competitor could rebuild a simplified `init`, `next`,
`verify`, and `review-gate` product quickly. They would struggle to replicate the accumulated
edge-case discipline if this repo keeps turning repeated review failures into
deterministic, tested, portable guardrails.

The blunt assessment: keep the command/decision/gate model, simplify the
orchestrators, delete stale placeholder surfaces, make bounded contexts explicit,
and measure whether the machinery actually lowers PR lead time. If that metric
does not improve, this becomes ceremony with a CLI. Not "risks becoming."
Becomes.

## Review Method

This review used the attached reference material as architectural pressure, not
as source material to summarize.

The lenses applied were:

- Pragmatic engineering: DRY as knowledge ownership, orthogonality, tracer
  bullets, automation, reversibility, broken-window discipline, operational
  friction, and software entropy.
- Philosophy of Software Design: deep modules, cognitive load, change
  amplification, information leakage, obviousness, hidden dependencies,
  tactical vs strategic design, and shallow abstraction detection.
- Domain-Driven Design: ubiquitous language, bounded contexts, core-domain
  distillation, model/implementation alignment, context leakage, and language
  stability.
- Extreme Programming: fast feedback, continuous integration, test reality,
  small reversible changes, humane iteration, and learning loops.
- Structural refactoring: long functions/files, mixed abstraction levels,
  conditional sprawl, duplication, procedural orchestration, local reasoning,
  and mechanical refactorability.

Evidence was taken from implementation reality: source, scripts, package
metadata, CI, skill files, validation contracts, governance docs, generated
Project Brain surfaces, and live command/file inspection. Marketing claims were
not treated as proof.

Confidence tags:

- High: directly verified in code, config, scripts, or live file inspection.
- Medium: strong inference from multiple implementation surfaces.
- Low: strategic or product inference that needs telemetry or user validation.

## Architectural Risk Assessment

### Overall Risk

Current architectural risk: **medium-high**.

The system is coherent, but its complexity budget is under pressure. The risk is
not that the idea is fake. The risk is that operational control surfaces keep
multiplying until agents need another harness to understand the harness. That is
the failure mode to fight now, not later.

### Risk Register

| Risk | Severity | Evidence | Interpretation | Recommended action |
| --- | --- | --- | --- | --- |
| Oversized CI migration core | High | `src/commands/ci-migrate-core.ts` is 10402 lines and contains parity proof paths, break-glass policy, merge queue windows, provider APIs, signatures, provenance manifests, snapshots, and verification logic. | This is a god orchestrator. It concentrates too many reasons to change and makes safe refactoring costly. | Split by lifecycle and policy boundary: plan, provider adapter, state store, proof pack, break-glass, merge queue, report rendering. |
| Oversized tests mirror oversized runtime | High | `src/commands/ci-migrate.test.ts` is 6319 lines. | Test size suggests behavior is fixture-heavy and hard to isolate. That raises change cost even when coverage is good. | Characterize current behavior, then split tests around extracted domain modules. |
| Governance can become ceremony | High | `harness.contract.json` encodes north-star, product surfaces, review policy, CI ownership, and many downstream rules. `docs/agents/04-validation.md` requires multiple gates even for docs-only changes. | Governance is useful, but the load-bearing contract is broad. If not measured, it will optimize for process surface instead of review/rework reduction. | Introduce a governance budget: every new policy surface must name the repeated failure it eliminates and the metric it moves. |
| Placeholder memory surface undermines trust | Medium-high | `memory.json` still says `repo: replace-with-repo-name` and contains bootstrap placeholder content while the PR template treats memory validation as a required gate. | This is a broken window in a core cognition surface. It teaches agents that some governed artifacts are symbolic. | Replace with repo-specific memory or stop requiring it in the PR template until it is meaningful. |
| String-level skill drift validation is useful but shallow | Medium | Skill validators ban deprecated strings and require command strings in `.agents/skills/coding-harness/scripts/validate_reference_contracts.py` and `scripts/validate-packaged-skill.cjs`. | This catches known regressions but does not prove semantic correctness. It can create false confidence. | Keep string guards, but add command-backed smoke tests for generated skill contracts. |
| Command surface growth may exceed agent cognition | Medium | `src/commands` contains 169 files; the command catalog exists to classify tiers, mutability, retryability, and agent modes. | The catalog is a strong mitigation, but the need for it shows the public surface is already large. | Treat `harness next`, `commands --json`, and a small set of cockpit commands as the product surface; demote or hide plumbing. |
| README command surface drift is already present | Medium-high | `bash scripts/verify-work.sh --resume-from validate-codestyle-fast --fast --changed-only` passed but reported 64 non-blocking `drift-gate.command.command.surface.dispatch.missing` warnings for commands documented in README but not dispatched in `src/cli.ts`. | This is not a theoretical command-surface risk. The repo already has a baseline drift class around command truth. | Promote the drift to an owned cleanup lane: either dispatch documented commands through the registry or remove/demote README references. |
| Validation wrapper complexity can obscure failure causes | Medium | `scripts/verify-work.sh` has 1261 lines and implements run-state, parallel/serial gates, fallback normalizers, and resume behavior. | This is powerful and agent-friendly, but shell complexity can be harder to test and refactor than TypeScript modules. | Move stable orchestration logic into typed modules or generated gate specs; keep shell as thin launcher. |
| Local environment assumptions reduce portability | Medium | `agent-install.json` requires `NPM_TOKEN`, `mise`, `gh`, `jq`, `rg`, `fd`, CircleCI variables, and private package installation. | This is acceptable for Jamie's operational environment, but external adoption will hit setup friction. | Create an open/local starter mode with reduced external dependencies. |
| Context systems are promising but partially bespoke | Medium | `src/lib/context-compound/indexer.ts` implements custom document indexing and frontmatter parsing. `.harness/knowledge` contains Project Brain surfaces. | The direction is right for repository cognition, but custom context machinery can become another maintenance domain. | Define context contracts and evaluate retrieval quality, not just existence of indexes. |
| Code-size guard has legacy escape routes | Medium | `scripts/check-code-size.mjs` enforces file/function limits for changed production code but skips legacy oversized files and split `*-core.ts` files. | The guard prevents new damage but can normalize old hotspots. | Add explicit burn-down targets for skipped legacy cores. |

## Repository Cognition Review

### What Works

The repo is unusually legible for an AI coding agent compared with typical
TypeScript control-plane repositories. That is a real achievement. It is also
not enough: a legible maze is still a maze if the cockpit does not keep getting
smaller.

Verified facts:

- The root `AGENTS.md` defines runtime/toolchain requirements, baseline gates,
  CI ownership, branch-protection expectations, instruction routing, command
  preflight, quality gates, PR workflow, memory layer, vocabulary, Project Brain,
  and implementation conventions.
- `docs/architecture/documentation-layers.md` defines progressive disclosure
  instead of treating every doc as equally binding.
- `docs/agents/04-validation.md` defines validation by change type, docs-gate,
  plan-gate, verify-work lifecycle, failure classes, resume behavior, and
  evidence reporting.
- `harness.contract.json` encodes north-star, product surfaces, ownership, and
  policy surfaces in machine-readable JSON.
- `src/lib/cli/registry/command-capabilities.ts` exposes command metadata that
  can be consumed by agents instead of discovered only through prose.
- The packaged skill under `.agents/skills/coding-harness/` gives a target repo
  an agent-facing operational manual rather than relying on the README.

Interpretation:

The cognition strategy is real. It does not assume future agents will infer the
right workflow from source code. It gives them an instruction hierarchy,
machine-readable command catalog, validation contract, and repo-local skill.

### What Does Not Work Yet

The cognition layer is dense enough that it now needs pruning as a first-class
maintenance activity.

Observed problems:

- The repo has 1407 inspected files across source, tests, scripts, docs,
  skills, CI, and harness state. A future agent will not read all of that
  reliably.
- The command surface is broad. The catalog mitigates this, but a broad catalog
  is still a broad product surface.
- Current validation reports 64 baseline command-surface warnings where commands
  are documented in README but not dispatched in `src/cli.ts`. That is direct
  evidence that command truth has drifted across surfaces.
- The local memory file is a placeholder while being referenced as validation
  evidence in the PR template. This is a trust break.
- Some operational docs are strong, but some generated/reference docs contain
  incomplete or awkward execution steps. For example,
  `.agents/skills/coding-harness/references/setup-and-commands.md` starts an
  install section with "Install dependencies" and then moves into abbreviations,
  which looks like a scaffold gap.

Architectural impact:

The repo helps agents orient, but it can also overfeed them. The best future
state is not more documentation. It is fewer, sharper, executable front doors:

- `harness next --json`
- `harness commands --json`
- `bash scripts/verify-work.sh`
- `.agents/skills/coding-harness/SKILL.md`
- `harness.contract.json`
- a compact Project Brain index with real entries

## Complexity Audit

### Intentional Complexity

The following complexity appears intentional and defensible:

- CI ownership split: CircleCI owns PR governance and security workflows,
  GitHub Actions handles release publishing, CodeRabbit remains independent, and
  Semgrep Cloud remains an external required check.
- Review-gate and branch-protection alignment: independent review and required
  checks are part of the safety floor.
- Agent decision envelopes: risk, permissions, stop conditions, and evidence are
  useful complexity because they reduce improvisation.
- Skill packaging: downstream repos receive a portable operational surface, not
  just a package binary.
- North-star learning loop: repeated review findings can become durable gates or
  Project Brain rules.

This is leverage. It compresses repeated coordination into reusable contracts.

### Accidental Complexity

The following complexity looks accidental or at least under-governed:

- Large orchestrator files where multiple lifecycles share one module.
- Repeated compatibility and fallback logic across shell scripts.
- String-based drift checks that are useful but brittle.
- Placeholder cognition artifacts that pass shape checks but not meaning checks.
- Broad command growth requiring heavy metadata to preserve discoverability.
- Legacy exceptions in size checks without visible burn-down ownership.

This creates drag. It increases cognitive load and makes agents more likely to
patch symptoms instead of preserving architecture.

### Complexity by Lens

Pragmatic Programmer lens:

- Strong automation and tracer-bullet behavior exist through `harness next`,
  `verify-work`, CI workflows, and dry-run modes.
- Broken-window risk is visible in placeholder memory and legacy exceptions.
- Orthogonality is mixed: command catalog and decision envelope are orthogonal;
  CI migration core is not.

Philosophy of Software Design lens:

- Deep modules exist where small interfaces hide meaningful policy: command
  catalog, decision envelope, gate result shape, and packaged skill install
  contract.
- Shallow modules appear where wrappers mainly pass through command strings or
  validate prose with string checks.
- Change amplification is highest where policy, provider API, artifact format,
  and reporting live together.

Domain-Driven Design lens:

- The domain language is strong: gate, contract, evidence, risk tier, review
  rework, current-head SHA, north-star, drift, learning, Project Brain.
- Bounded contexts are implicit rather than explicit. CI migration, review
  governance, Linear workflow, context indexing, learning promotion, and
  scaffolding are different subdomains but still share broad contract surfaces.

XP lens:

- Feedback loops are unusually explicit.
- The risk is that feedback becomes slow or intimidating as validation stacks
  grow.
- The best XP move is smaller, more frequent, executable checks tied to exact
  production paths, not more process prose.

Refactoring lens:

- The biggest mechanical wins are extracting stable concepts from large
  procedural orchestrators and deleting compatibility layers once migration
  windows close.
- Line count alone is not the problem. Mixed reasons to change are the problem.

## Deep vs Shallow Module Analysis

### Deep Modules

#### `HarnessDecision`

Evidence:

- `src/lib/decision/harness-decision.ts` defines statuses, phases, risk tiers,
  friction classes, delay classes, execution profile, permission plan, and
  evidence-bearing decision envelopes.
- The interface includes `nextCommand`, `requiredEvidence`, `stopConditions`,
  `humanEscalation`, `safeToRun`, `requiresHuman`, `requiresNetwork`,
  `writesFiles`, `failureClass`, `retry`, and `riskTier`.

Interpretation:

This is a deep module. It exposes a compact orchestration contract that hides
agent decision complexity behind a stable schema. It directly supports local
reasoning and deterministic execution.

Risk:

If every command invents custom metadata outside this envelope, the module will
lose leverage.

#### Command Capability Catalog

Evidence:

- `src/lib/cli/registry/command-capabilities.ts` defines command categories,
  mutability, retryability, tier, primary audience, orchestrator, agent mode,
  visibility, required flags, expected artifacts, and safe-first alternatives.
- `src/lib/cli/command-registry.ts` builds specs, aliases, capability catalogs,
  help rows, and dispatch indexes.

Interpretation:

This is one of the strongest agent-native abstractions in the repo. It turns
command discovery from a prose problem into a machine-readable interface.

Risk:

The catalog is only valuable if it is stricter than the command sprawl it
describes. If the command surface keeps growing without demotion, the catalog
becomes a directory rather than an architecture.

#### Packaged Coding Harness Skill

Evidence:

- `package.json` publishes `.agents/skills/coding-harness`.
- `.agents/skills/coding-harness/SKILL.md` defines working agreements,
  workflows, boundaries, validation, command references, and troubleshooting.
- `.agents/skills/coding-harness/references/agent-install.json` defines install
  phases, required binaries, secrets agents can verify but not create,
  branch-protection checks, scaffolded files, and capability boundaries.
- `scripts/validate-packaged-skill.cjs` validates required skill files,
  references, eval text, install JSON, and forbidden deprecated patterns.

Interpretation:

This is deep if treated as the product's agent onboarding module. It packages
operational expertise into a portable skill surface.

Risk:

Its validation is partly lexical. The next step is behavior validation: prove
that a target repo initialized from the package can execute the documented
workflow.

### Shallow or Overloaded Modules

#### `src/commands/ci-migrate-core.ts`

Evidence:

- The file is 10402 lines.
- It defines or handles parity proof pack paths, provenance bundles, artifact
  indexes, external control-plane paths, merge queue windows, break-glass
  rosters, provider API configs, snapshots, signatures, and many validation
  functions.

Interpretation:

This is not shallow in the sense of doing nothing. It is overloaded. Its public
surface may be narrow, but its internal cohesion is too low. A module this broad
cannot be understood locally by most agents.

Recommended boundary:

- `ci-migrate/plan`
- `ci-migrate/provider-adapters`
- `ci-migrate/state-store`
- `ci-migrate/parity-proof`
- `ci-migrate/break-glass`
- `ci-migrate/merge-queue`
- `ci-migrate/reports`

#### Shell Verification Wrappers

Evidence:

- `scripts/verify-work.sh` is 1261 lines and includes stack detection, run-state,
  gate execution, fallback normalization, resume behavior, and failure reporting.
- `docs/agents/04-validation.md` makes the wrapper the required evidence
  surface.

Interpretation:

The wrapper is strategically important, but shell is a poor home for growing
domain logic. The current shape is pragmatic for bootstrap portability but
fragile for long-term evolution.

Recommended boundary:

Keep shell as the launcher. Move gate graph, resume eligibility, summary
normalization, and failure classes into typed code or generated JSON gate specs.

#### Contract Type Core

Evidence:

- `src/lib/contract/types-core.ts` is 1776 lines.
- `harness.contract.json` combines north-star, product surfaces, review policy,
  CI ownership, branch protection, remediation, and loop-stage contracts.

Interpretation:

The contract is useful, but the type core risks becoming a universal policy
bucket. That increases change amplification across unrelated governance
domains.

Recommended boundary:

Split contract schema by bounded context and compose it at the document edge.

## Domain Integrity Review

### Core Domain

The core domain is not "AI coding" in general. It is:

> Reducing PR lead time and review/rework cost by turning repeated agent
> workflow failures into deterministic, portable, evidence-backed governance.

Evidence:

- `harness.contract.json` names PR lead time as the primary metric, review/rework
  as the primary bottleneck, and deterministic evidence, current-head SHA,
  bounded remediation, rollback paths, and independent review as the safety
  floor.
- `docs/roadmap/north-star.md` repeats the same mission and non-goals.
- `docs/agents/04-validation.md` defines evidence reporting, failure classes,
  validation by change type, and north-star learning loop closeout.
- `.agents/skills/improve-codebase-architecture/SKILL.md` defines architecture
  improvement in terms of lower PR lead time, less review/rework, deterministic
  evidence, current-head SHA, bounded autonomy, and rollback safety.

Interpretation:

The domain is coherent. It has a clear bottleneck and a stable safety model.

### Ubiquitous Language

Strong terms:

- harness
- gate
- contract
- evidence
- current-head SHA
- drift
- review/rework loop
- north-star
- Project Brain
- learning promotion
- branch protection
- independent review
- risk tier
- failure class
- safe-first alternative

Language risk:

Some terms are overloaded:

- "memory" can mean `memory.json`, `.harness/memory/LEARNINGS.md`, Project
  Brain, Local Memory, CodeRabbit learning imports, or context indexes.
- "contract" can mean `harness.contract.json`, command contracts, gate output
  contracts, docs-gate policy, skill install contract, or PR template structure.
- "gate" covers validation gates, CI jobs, docs-gate, plan-gate, review-gate,
  policy-gate, artifact-gate, memory-gate, and more.

Interpretation:

The vocabulary is strong but nearing saturation. The repo needs a context map
that says which terms mean what in each bounded context.

### Bounded Contexts

Inferred contexts:

| Context | Primary surfaces | Current boundary quality |
| --- | --- | --- |
| Command cockpit | `src/cli.ts`, command registry, `harness next`, command catalog | Strong |
| Review governance | `review-gate`, PR template, CodeRabbit/Semgrep/CircleCI contracts | Strong but broad |
| Validation orchestration | `verify-work.sh`, `validate-codestyle.sh`, docs validation policy | Strong but shell-heavy |
| CI migration | `ci-migrate-core.ts`, CI parity artifacts, branch protection, provider state | Weak internal boundaries |
| Scaffolding/update | `init`, `upgrade`, packaged skill, agent install JSON | Medium-strong |
| Repository cognition | Project Brain, memory, context index, docs layers | Promising but overloaded |
| Learning loop | `learnings`, `review-context`, `north-star-feedback` | Medium; needs measurable outcomes |
| Linear workflow | `linear`, `linear-gate`, workflow docs | Medium; external dependency heavy |

DDD verdict:

The language is better than the boundaries. The next architectural step is not
new terminology. It is enforcing context boundaries in module layout, contract
schema composition, and command ownership.

## Skill/Plugin Architecture Review

### Verified Skill System

The repo has a real packaged skill architecture:

- The npm package publishes `.agents/skills/coding-harness`.
- The skill has an entrypoint `SKILL.md`, references, scripts, evals, and an
  install JSON contract.
- The skill's install contract declares what agents can verify and cannot do:
  agents can scaffold governance files, verify state, apply branch protection
  with credentials, generate Codex environment action blocks, and run gates; they
  cannot create tokens, authorize third-party apps, set secrets, bypass branch
  protection, or overwrite customized environment files without approval.
- Skill validation checks required files, required command references, eval
  coverage text, install JSON shape, and forbidden deprecated strings.

This is genuinely agent-native. It gives downstream agents an operational role,
not just a README.

### Plugin Architecture Reality

This repository does not appear to contain a general plugin architecture in the
same sense as a plugin host with dynamic extension loading. It references
optional external tools such as `agentation`, `agentation-mcp`, `agent-browser`,
diagram tooling, Argos, Mermaid, markdownlint, and Wrangler through
`agent-install.json`, but those are install/runtime dependencies or adjacent
tools, not a local plugin system.

Fact:

- The inspected repo contains a packaged skill and many integrations.

Interpretation:

- Calling this a skill/plugin architecture is only accurate if "plugin" means
  "external tool and MCP integration surface." The durable architecture in this
  repo is the skill packaging and command contract, not a general plugin runtime.

### Skill Composition Quality

Strengths:

- The skill uses progressive disclosure: entrypoint first, references only when
  needed.
- It names exact commands and surfaces.
- It has capability boundaries.
- It has local validators to prevent stale command references.

Weaknesses:

- Some validation is based on strings rather than behavior.
- Some reference docs appear generated or scaffolded rather than edited down to
  a sharp operational path.
- The skill risks becoming another policy document unless its commands remain
  executable and tested in downstream fixtures.

Recommendation:

Treat the packaged skill as a product API. It should have compatibility tests,
golden command outputs, and target-repo smoke tests just like the CLI.

## Agent-Native Capability Review

### Agent-Native Strengths

The agent-native model is real.

Evidence:

- `src/cli.ts` directs agents to `harness next --json`, machine command
  discovery, exact exit code semantics, and fuzzy command correction that keeps
  stdout JSON clean.
- `HarnessDecision` exposes next action, next command, evidence, stop
  conditions, hidden plumbing, permissions, failure class, retry posture, and
  risk tier.
- The command catalog exposes mutability, retryability, safe-first alternatives,
  expected artifacts, and visibility.
- `docs/agents/04-validation.md` requires exact command outcomes and blocker
  reasons.
- `.agents/skills/coding-harness/references/agent-install.json` distinguishes
  secrets agents can verify from secrets agents cannot create.
- The PR template requires independent CodeRabbit and Codex review artifacts and
  explicitly says merge is blocked until required checks pass.

Interpretation:

This is agent-native because it reduces ambiguity at execution time. It gives
agents structured decisions, not just prose.

### Agent-Native Weaknesses

Weaknesses:

- Some important context still requires reading many docs.
- The command surface is broad enough that command selection can still be
  ambiguous without `harness next`.
- Placeholder memory reduces trust in cognition artifacts.
- Legacy compatibility paths and fallback normalizers increase uncertainty about
  what runtime path actually executed.
- Large orchestrators reduce local reasoning and make agent edits riskier.

Verdict:

Genuine, not performative. But the model depends on keeping a small cockpit and
demoting plumbing. Without that, "agent-native" becomes "agent-navigable with
enough tokens," which is weaker.

## Governance & Workflow Review

### What Is Strong

Governance is unusually explicit:

- The north-star contract names what the project optimizes for and what it must
  not optimize for.
- CI ownership is clearly split: CircleCI for PR governance/security, GitHub
  Actions for release publishing, CodeRabbit for independent review, Semgrep
  Cloud as independent security check.
- Validation docs specify docs-only, code, command behavior, process/instruction
  edits, failure classes, resume behavior, and evidence reporting.
- CircleCI installs pinned runtime tooling and runs PR governance jobs.
- The release workflow pins Node and pnpm, runs `pnpm check`, builds, performs
  pack smoke tests, checks tag version, publishes, and emits provenance
  attestation.

This is mature.

### What Is Risky

Governance is also close to becoming self-protecting machinery.

Examples:

- Docs-only edits still require the full baseline gate before handoff.
- The PR template requires a memory JSON shape check even though `memory.json`
  contains placeholder repo and observation values.
- `harness.contract.json` has become a broad governance aggregate rather than a
  small domain contract.
- Multiple gates and docs reference learning, memory, review context, and north
  star, but the review found less hard evidence that these are currently
  measured against actual PR lead-time outcomes.

Interpretation:

Governance helps when it reduces repeated manual review. Governance drags when
it increases the number of artifacts agents must placate without moving the
review/rework bottleneck.

## Refactor Recommendations

### 1. Split `ci-migrate-core.ts` by Domain Lifecycle

Priority: P1.

Do not split by arbitrary file size. Split by reason to change.

Recommended modules:

- `src/lib/ci-migrate/plan.ts`: migration planning and stage transitions.
- `src/lib/ci-migrate/state-store.ts`: snapshots, signatures, state reads and
  writes.
- `src/lib/ci-migrate/provider-adapters/`: CircleCI/GitHub/provider API
  interaction behind explicit ports.
- `src/lib/ci-migrate/parity-proof.ts`: proof pack schema, validation,
  signatures, age checks, required scenarios.
- `src/lib/ci-migrate/break-glass.ts`: roster, approval, governance policy,
  digest validation.
- `src/lib/ci-migrate/merge-queue.ts`: windows, evidence binding, lifecycle.
- `src/lib/ci-migrate/reporting.ts`: human/JSON rendering.

Proof path:

1. Add characterization tests around current CLI behavior.
2. Extract pure validation functions first.
3. Extract file-system state store behind an interface.
4. Extract provider API calls last.
5. Keep public command output stable.

### 2. Replace Placeholder `memory.json`

Priority: P1.

Either make `memory.json` meaningful or remove it from required PR validation.

Recommended content:

- repo: `coding-harness`
- entries for north-star, CI ownership split, command cockpit, memory surfaces,
  and packaged skill contract
- source links to `harness.contract.json`, `docs/roadmap/north-star.md`, and
  `.agents/skills/coding-harness/SKILL.md`

Why:

Agents should not be trained to trust placeholder cognition surfaces.

### 3. Define Bounded Context Owners

Priority: P1.

Add a context map that names:

- domain purpose
- owned commands
- owned source dirs
- owned contract schema fragment
- owned docs
- owned tests
- allowed dependencies
- forbidden dependencies

Start with:

- cockpit
- validation
- review-governance
- ci-migration
- scaffolding-update
- repository-cognition
- learning-loop
- Linear workflow

### 4. Convert Shell Orchestration Logic Into Data + Thin Shell

Priority: P2.

Keep `scripts/verify-work.sh` as the stable entrypoint, but move gate graph,
gate metadata, resume policy, and failure classes into typed modules or JSON
specs consumed by the shell wrapper.

Why:

Shell is fine for launching. It is a poor long-term home for an expanding
execution state machine.

### 5. Add Skill Behavior Tests

Priority: P2.

Keep existing string drift validators, but add tests that initialize a fixture
repo and prove:

- generated skill files exist
- documented commands resolve
- `harness check-environment --json` output matches expectations
- `harness init --check-updates` behaves deterministically
- generated `.codex/environments/environment.toml` is not overwritten when
  customized

### 6. Create a Command Surface Budget

Priority: P2.

Set thresholds:

- cockpit commands: maximum 5
- domain commands: allowed only with explicit owner/context
- plumbing commands: hidden unless used by a cockpit/domain command
- legacy commands: must have deletion issue/date

Why:

The command catalog is strong. It needs teeth.

## Anti-Patterns Identified

### God Orchestrator

`ci-migrate-core.ts` is the clearest example. It likely started as an
operationally pragmatic tracer bullet and then accumulated provider migration,
state, proof, policy, governance, and reporting.

Impact:

- high change amplification
- high review load
- high agent regression risk
- hard-to-isolate tests

### Governance as Artifact Count

The repo explicitly says governance surface area is not a proxy for progress,
yet the number of governance surfaces is high.

Impact:

- agents can satisfy shape without improving throughput
- docs/gates can become defensive bureaucracy
- maintainers may fear deleting stale policy

### Placeholder Cognition Surface

`memory.json` is the concrete example.

Impact:

- undermines trust in Project Brain and memory systems
- encourages symbolic compliance
- weakens agent reasoning quality

### Compatibility Layer Creep

Fallbacks and legacy references appear in shell scripts and validation tooling.

Impact:

- runtime truth becomes harder to explain
- errors become harder to classify
- temporary migration code risks becoming permanent architecture

### Lexical Drift Validation Masquerading as Semantic Validation

String guards are useful. They are not sufficient.

Impact:

- prevents known stale terms
- does not prove commands run
- can pass while workflow intent is broken

## Drift Risks

| Drift signal | Why it matters | Likely root cause | Operational impact | Severity | Corrective action | Block merges/releases? |
| --- | --- | --- | --- | --- | --- | --- |
| Command count grows without demotion | Agents lose the cockpit and start guessing | Feature addition without surface budget | Slower orientation, more wrong commands | High | Enforce command tier budget and owner/context metadata | Block when command is public without catalog metadata |
| README documents commands not dispatched by CLI | README stops being an executable product surface | Command docs and registry evolved separately | Agents run commands that do not exist or route differently | High | Make command docs generated from registry/catalog or demote stale commands | Block new command docs not generated from live registry |
| `ci-migrate-core.ts` grows further | Hotspot becomes unrefactorable | Provider/policy changes land in easiest file | Review risk and brittle tests | High | Require extraction before adding new lifecycle behavior | Block new CI migration features unless behind extracted module |
| Placeholder memory remains required | Governance loses credibility | Shape validation without semantic ownership | Agents treat memory as ceremonial | High | Replace content or remove PR requirement | Block release if unchanged |
| Docs add policy without executable gate | Process grows without leverage | Governance-by-prose | More review burden, no reliability gain | Medium-high | Require repeated-failure ID and enforcement destination | Block governance docs that define new required behavior |
| Skill validators remain string-only | Skill can be "valid" but unusable | Cheap drift checks replacing behavior tests | Downstream setup failures | Medium | Add fixture install/update tests | Block packaged skill release if smoke fails |
| More fallback paths in shell wrappers | Runtime path becomes ambiguous | Environment variability and backward compatibility | Harder debugging, lower determinism | Medium | Centralize fallback policy and sunset dates | Block fallback additions without deletion condition |
| Learning loop lacks outcome telemetry | Moat becomes assumed, not measured | Local evidence imports without lead-time analytics | Cannot prove product value | High | Track PR lead time, rework retries, manual interventions | Block claims, not merges, until telemetry exists |
| Contract schema absorbs unrelated domains | Contract becomes god object | Convenient central JSON | Change amplification | Medium | Split schema fragments by bounded context | Block new top-level domains without context owner |
| Project Brain grows without pruning | Context cost rises | Accumulating local memory | Slower agents, stale facts | Medium | Add review cadence and stale entry pruning | Advisory until stale entries affect gates |
| Legacy size exemptions persist | Refactor debt becomes normalized | "Do not touch risky file" inertia | Hotspots remain | Medium | Add burn-down issues and changed-area enforcement | Block if exempt files receive new unrelated behavior |

## Technical Debt Hotspots

### `src/commands/ci-migrate-core.ts`

Debt type: structural, domain-boundary, testability.

Why it matters:

This is the highest-risk file. It combines too many policy and runtime concerns
for safe local reasoning.

Best next move:

Extract pure validation and artifact schema modules first.

### `src/commands/ci-migrate.test.ts`

Debt type: test architecture.

Why it matters:

Large tests can protect behavior but also lock in incidental structure. A
6319-line test file makes agents reluctant to refactor.

Best next move:

Split tests by extracted domain modules after characterization.

### `scripts/verify-work.sh`

Debt type: orchestration language/runtime.

Why it matters:

This is a critical path. It should remain stable, but its internals are too
large for shell to remain the primary logic layer indefinitely.

Best next move:

Generate or consume a typed gate spec while preserving the script entrypoint.

### `harness.contract.json` and `src/lib/contract/types-core.ts`

Debt type: schema aggregation.

Why it matters:

The contract is a core leverage point. If it becomes a policy junk drawer,
bounded context integrity will degrade.

Best next move:

Modularize schema definitions and compose the final contract.

### `memory.json`

Debt type: cognition trust.

Why it matters:

It is small but symbolically important. A placeholder in a required evidence
surface damages the architecture more than its size suggests.

Best next move:

Fix immediately.

## Strategic Review

### Is the Project Coherent?

Yes. The project has a real center: reduce PR lead time by making agentic
development safer, more deterministic, and less dependent on repeated human
coordination.

### Is the Complexity Justified?

Partly.

Justified:

- command catalog
- decision envelope
- review gate
- validation wrapper
- CI ownership contract
- packaged skill
- evidence reporting
- branch-protection alignment
- learning loop

Not fully justified:

- oversized orchestrator internals
- placeholder memory required by PR validation
- repeated compatibility fallbacks
- broad governance docs without clear enforcement destinations
- command proliferation beyond cockpit/domain boundaries

### Is the Architecture Pragmatic?

Yes at the system level. Mixed at the module level.

The project uses pragmatic tracer bullets: CLI commands, dry-runs, JSON outputs,
CI jobs, release pack smoke tests, skill validators. That is good engineering.

The less pragmatic part is allowing critical paths to accrete until they become
hard to change. Pragmatism should now mean deletion and extraction, not more
coverage around overloaded files.

### Is the Abstraction Quality High?

High in the command/decision/gate surfaces.

Lower in large procedural cores and shell wrappers.

The best abstractions compress decision-making for agents. The weaker
abstractions mostly organize files or strings without reducing cognitive load.

### Is the System Overbuilt?

It is overbuilt for a small team using it manually.

It is not overbuilt if the goal is a portable governance control plane for many
agent-run repositories.

The deciding factor is telemetry. If PR lead time and review/rework retries
improve, this is infrastructure. If they do not, this is ceremony.

### Is Governance Helping or Slowing Things Down?

Both, and the slow-down side is no longer theoretical.

Governance helps by making safety rules executable and review evidence explicit.
Governance slows things down when it treats every artifact as equally important
or lets placeholder surfaces remain in required paths.

The project should keep fail-closed gates for real risk and become more
aggressive about deleting weak or symbolic governance. Any governance surface
that cannot name the failure it prevents should be treated as suspect.

### What Creates Leverage?

- `harness next --json`
- the `HarnessDecision` envelope
- command capability catalog
- review-gate/current-head discipline
- packaged skill contract
- validation wrappers with exact outcome reporting
- CI ownership/branch-protection alignment
- turning repeated review findings into gates or durable Project Brain rules

### What Creates Drag?

- oversized orchestrators
- broad command surface
- docs that restate policy without executing it
- placeholder cognition artifacts
- legacy fallbacks without deletion dates
- private/local setup assumptions that make adoption harder

### What Should Become Core?

- cockpit command model
- decision envelope
- command catalog
- review/rework learning loop
- packaged skill behavior tests
- contract-backed branch protection and CI ownership
- minimal Project Brain memory with verified facts

### What Should Be Deleted?

- placeholder `memory.json` content
- stale legacy references once migration tests prove removal
- command aliases or plumbing commands that are no longer orchestrated
- duplicate governance prose that does not connect to a gate, contract, or
  command
- size-check exemptions without active burn-down ownership

### Smallest Compelling Version

The smallest compelling product is:

1. `harness init` installs governance files and packaged agent skill.
2. `harness next --json` tells an agent the next safe action.
3. `harness verify-work --fast --json` runs a deterministic local gate.
4. `harness review-gate --json` checks PR readiness against current-head SHA,
   independent review, and required checks.
5. `harness learnings gate/review-context` turns repeated review failures into
   future context.

Everything else should justify itself against those five.

### If This Fails

It will fail because the control plane becomes harder to understand than the PR
workflow it is replacing. Developers will not adopt a harness that feels like a
second bureaucracy unless it visibly saves time and prevents real mistakes.
Internal coherence will not save it if the user experience feels like paying a
process tax.

### If This Succeeds

It will succeed because it turns the messy human craft of agent-run PR
governance into portable, executable contracts that agents can follow reliably.
The winning product is not "more AI." It is less ambiguity at the moment of
execution. The commercial value is trust under pressure: when the PR is messy,
the agent still knows what to do, what to prove, and when to stop.

## Recommended Simplifications

1. Make `harness next --json` the canonical front door and demote other commands
   behind it.
2. Split CI migration internals by lifecycle and artifact boundary.
3. Replace placeholder memory with real repo knowledge or remove it from required
   PR validation.
4. Add a command surface budget and hide plumbing by default.
5. Move validation gate metadata out of shell and into typed specs.
6. Split contract schemas by bounded context and compose the published contract.
7. Convert skill drift validation from string-only to fixture-backed behavior
   tests.
8. Add explicit deletion dates to legacy compatibility paths.
9. Keep Project Brain compact and indexed; do not use it as a dumping ground.
10. Require every new governance surface to name the repeated failure it removes.

## Recommended Deletions

Immediate deletion or replacement:

- Placeholder contents in `memory.json`.
- Any stale "replace-with-repo-name" or bootstrap-only Project Brain entries
  that are not real repo knowledge.
- Any doc paragraph that repeats policy already enforced elsewhere but does not
  add routing, evidence, or failure recovery.

Delete after characterization:

- Legacy compatibility paths in `scripts/codex-preflight.sh`,
  `scripts/check-environment.sh`, and `scripts/verify-work.sh` that no longer
  map to supported downstream states.
- Greptile-era references once the packaged-skill validator and fixture tests
  prove the replacement contract.
- Public command aliases that are not used by docs, tests, or the command
  cockpit.

Do not delete yet:

- Review-gate and CI ownership surfaces.
- Packaged skill validators.
- Validation wrappers.
- North-star contract.

Those are core leverage even if their internals need simplification.

Deletion rule:

If a surface exists only to reassure humans that governance exists, delete it.
If it changes agent behavior, blocks a real unsafe path, or preserves a repeated
learning, keep it and test it.

## Recommended Core Investments

### Measured North-Star Telemetry

The repo talks about PR lead time and review/rework cost. It needs more live
measurement.

Track:

- PR open-to-merge time
- review retries per PR
- agent rework loops per PR
- manual interventions per PR
- time from CodeRabbit/Codex finding to accepted fix
- rate of repeated findings after promotion into guardrails

### Fixture-Based Downstream Harness Tests

The product is portable only if a fresh repo can install and use it.

Create fixture repos that exercise:

- clean init
- update adoption
- customized environment file preservation
- missing credentials
- CircleCI present/absent
- CodeRabbit present/absent
- docs-gate impacted/unimpacted changes

### Context Quality Evaluation

Do not just index context. Measure whether retrieved context helps agents make
fewer wrong edits.

Track:

- whether `harness next` recommendations used the right docs
- whether agents opened fewer irrelevant files
- whether context index staleness caused mistakes
- whether Project Brain facts remained current

### Contract Modularity

Invest in domain-specific contract fragments and generated aggregate
validation.

This protects the moat because it keeps governance portable without making every
policy change a global edit.

## Long-Term Scalability Risks

### Operational Scaling

The system scales only if cockpit commands absorb complexity. If users must know
which of 100+ commands to run, adoption will stall.

### Organizational Scaling

Governance requires ownership. Without context owners, every policy surface
becomes everyone's problem and nobody's responsibility.

### Technical Scaling

Large orchestrators will slow change velocity. The CI migration path is the
first likely bottleneck.

### Agent Scaling

Agents can follow deterministic contracts. They struggle with sprawling
exception paths, ambiguous docs, and hidden coupling. The current architecture
supports agents, but it must reduce context cost faster than it adds features.

### Commercial Scaling

Private registry assumptions, CircleCI-specific workflows, and local Jamie
operational conventions may limit adoption. The project needs a low-friction
open/local mode if the audience extends beyond the current environment.

## Moat Analysis

### What Is the Actual Moat?

The actual moat is operational discipline encoded as portable execution
contracts:

- command decisions agents can consume
- evidence-backed gates
- current-head SHA discipline
- independent review integration
- packaged skill onboarding
- CI/check ownership alignment
- repeated-review learning promotion
- Project Brain/context surfaces
- validation wrappers with exact outcomes

The moat is not TypeScript, shell scripts, CircleCI, CodeRabbit, or agent
language by themselves. Those are ingredients.

The operational moat is only defensible if it keeps compounding. Every repeated
review failure should become one of four things: a test, a gate, a skill rule, or
a deliberate non-goal. Anything else is unharvested advantage.

### Is the Moat Durable?

Medium, with a path to high.

It becomes durable if real PR/review data keeps feeding better guardrails,
fixtures, and skills. It is not durable if the repo mainly accumulates policy
documents and command variants. Complexity without operational learning is not a
moat. It is a copying discount for a cleaner competitor.

### Is the Moat Measurable?

Not enough yet.

The repo defines PR lead time and review/rework cost as metrics, but the review
found stronger evidence of declared metrics than live outcome measurement.

Required measurements:

- PR lead time before and after harness adoption
- repeated review findings before and after learning promotion
- manual intervention count per agent-run PR
- failed gate cause distribution
- mean time from failed gate to corrected rerun

### Is the Moat Merely Complexity?

No, but it could become that.

The command decision envelope, review gate, packaged skill, and validation
contracts are leverage. Oversized orchestrators and placeholder surfaces are
complexity.

### Could a Smaller Competitor Rebuild This Quickly?

They could rebuild the simple version quickly:

- init templates
- command catalog
- next-step JSON
- PR readiness gate
- CI required-check alignment

They could not quickly replicate accumulated edge-case behavior if this repo
continues encoding real failures into tested contracts and downstream fixtures.

### Which Parts Are Strategically Defensible?

- agent-readable command decisions
- evidence and permission metadata
- review/rework learning loop
- current-head and independent review discipline
- packaged skill with executable install/update contract
- downstream upgrade matrix and fixture evidence
- context/memory quality if measured and kept current

### Which Parts Only Feel Sophisticated?

- broad command count
- long governance docs without gates
- placeholder memory artifacts
- lexical-only validators
- compatibility layers without sunset dates
- large orchestrators framed as necessary complexity

### What Should Be Aggressively Protected?

- the north-star: PR lead time under safety constraints
- independent review surfaces
- deterministic evidence over intuition
- current-head SHA discipline
- cockpit command model
- command catalog schema
- `HarnessDecision` schema
- packaged skill contract
- downstream fixture tests once added

### What Should Be Simplified Because It Weakens the Moat?

- CI migration internals
- shell fallback ladders
- public command sprawl
- repeated policy prose
- placeholder Project Brain/memory entries
- contract schema aggregation

### Likely False Moat Assumptions

- "More governance makes the product safer." Only true when governance removes
  repeated review failure or blocks real risk.
- "More commands make agents more capable." Only true when the command cockpit
  remains obvious.
- "A memory layer is valuable because it exists." False unless facts are current,
  specific, indexed, and used.
- "Technical sophistication is defensibility." False. Operational proof and
  adoption habit are defensibility.

### If This Succeeds Massively

Competitors will struggle because the system has accumulated a large library of
real agent failure modes and converted them into portable contracts, review
gates, context rules, and fixture-backed setup flows. The hard part will not be
building a CLI. It will be earning trust that the CLI knows when to stop, what
evidence is enough, and which review failures recur.

### If Competitors Catch Up Quickly

They will catch up if Coding Harness fails to measure outcomes, keeps
complexity local/Jamie-specific, and does not turn its operational experience
into compact product primitives. A clean competitor with fewer commands and
better onboarding could beat a more sophisticated but heavier harness.

## Competitive Replication Risk

Replication risk: **medium-high for the current feature set, medium-low for the
full operational discipline if measured and hardened**.

Easy to copy:

- CLI templates
- JSON command catalog
- required-check config
- PR template gates
- basic skill packaging
- docs-gate style validation

Harder to copy:

- high-quality failure taxonomy
- reliable current-head review orchestration
- downstream init/update behavior across messy repos
- accumulated review-learning data
- trusted defaults that developers keep installed
- measured proof that agent PRs move faster without weaker safety

Strategic recommendation:

Reduce visible complexity and increase experiential trust. Developers adopt
tools that make the next action obvious and safe. They do not adopt governance
because it is architecturally impressive.

## Evidence & Traceability Matrix

| Conclusion | Evidence type | File paths | Symbols/interfaces/components | Runtime behavior observed | Confidence | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| Project is a TypeScript control plane for agentic PR/review workflows | source-code, config, docs | `package.json`, `src/cli.ts`, `harness.contract.json`, `docs/roadmap/north-star.md` | package `@brainwav/coding-harness`, `harness` bin, north-star mission | Package exposes CLI and scripts; contract names PR lead time and review/rework | High | Establishes real domain from implementation, not marketing. |
| Agent-native model is real | source-code, runtime flow | `src/lib/decision/harness-decision.ts`, `src/lib/cli/registry/command-capabilities.ts`, `src/cli.ts` | `HarnessDecision`, command catalog, `harness next --json` | CLI help directs agents to JSON cockpit; decision envelope carries evidence/permissions | High | Shows agents receive structured execution guidance. |
| Command surface is broad and needs budget | source-code, naming patterns | `src/commands/**`, `src/lib/cli/registry/command-capabilities.ts` | 169 command files, command tiers, visibility | File count observed with `fd`; catalog classifies commands | High | Broad surfaces increase agent cognition cost unless controlled. |
| Command truth has current baseline drift | runtime flow, docs, source-code | `README.md`, `src/cli.ts`, `.harness/guardrails/north-star/drift-findings.json` | `drift-gate.command.command.surface.dispatch.missing` | `bash scripts/verify-work.sh --resume-from validate-codestyle-fast --fast --changed-only` passed with 64 non-blocking drift-gate warnings | High | Confirms command-surface drift is present, not only predicted. |
| CI migration core is a god orchestrator | source-code, architectural coupling | `src/commands/ci-migrate-core.ts` | parity proof, provenance, break-glass, merge queue, provider API, snapshots | 10402-line file inspected; symbol list spans many policy/runtime domains | High | Highest refactor priority and biggest change-amplification risk. |
| Tests mirror orchestration complexity | tests | `src/commands/ci-migrate.test.ts` | CI migration test harness | 6319-line test file observed | High | Large tests can protect behavior while making change expensive. |
| Governance is strong but at risk of ceremony | config, docs, CI/CD | `harness.contract.json`, `docs/agents/04-validation.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.circleci/config.yml` | north-star, validation gates, PR checklist, CircleCI jobs | Required gates and policy surfaces inspected | Medium-high | Governance is leverage only when it reduces repeated review/rework. |
| Placeholder memory undermines cognition trust | docs, memory/context | `memory.json`, `.github/PULL_REQUEST_TEMPLATE.md` | memory JSON, PR required local gate | `memory.json` contains `replace-with-repo-name`; PR template requires memory check | High | Required evidence should not be placeholder compliance. |
| Packaged skill is a strong product API | skills, config, tests/scripts | `.agents/skills/coding-harness/SKILL.md`, `.agents/skills/coding-harness/references/agent-install.json`, `scripts/validate-packaged-skill.cjs`, `package.json` | skill entrypoint, install phases, capability boundaries, validator | Skill included in package files; validators inspect required docs/contracts | High | This is the portable agent onboarding surface. |
| Plugin architecture should not be overstated | skills, dependency graph | `.agents/skills/coding-harness/references/agent-install.json`, `package.json` | optional tools, MCP/tool references | Optional tools listed, but no local general plugin host verified | Medium | Prevents hallucinating a plugin runtime that is not evidenced. |
| Validation wrappers are critical but shell-heavy | scripts, docs | `scripts/verify-work.sh`, `docs/agents/04-validation.md` | verify-work run-state, gate artifacts, resume, failure classes | 1261-line shell wrapper and docs requiring exact evidence | High | Shell orchestration should remain a stable entrypoint but not absorb all logic. |
| CI/CD maturity is high | CI/CD | `.circleci/config.yml`, `.github/workflows/release-private-npm.yml` | CircleCI PR governance, release publish workflow | Config pins Node/pnpm/mise, installs tools, runs gates, release smoke/provenance | High | Supports XP feedback loops and operational trust. |
| Contract schema risks becoming a policy aggregate | config, source-code | `harness.contract.json`, `src/lib/contract/types-core.ts` | northStar, productSurface, reviewPolicy, ciOwnership, branch protection | 1120-line contract and 1776-line core types file | Medium-high | Broad schema aggregation increases change amplification. |
| Bounded contexts are implicit | source-code, docs, naming patterns | `src/commands/**`, `src/lib/**`, `docs/agents/**`, `.agents/skills/**` | cockpit, validation, review governance, CI migration, learning, context | Domains inferred from file and command ownership | Medium | DDD boundary clarity is the next strategic architecture step. |
| Context/memory architecture is promising but overloaded | source-code, memory/context | `src/lib/context-compound/indexer.ts`, `.harness/knowledge/**`, `.harness/memory/**`, `memory.json` | context indexer, Project Brain, memory surfaces | Custom indexer and Project Brain surfaces inspected; placeholder memory found | Medium | Context is central to agent cognition, but stale or broad memory creates drag. |
| Code-size guard prevents new damage but tolerates legacy debt | scripts | `scripts/check-code-size.mjs` | max file/function lines, legacy oversized skip | Script enforces limits but skips legacy oversized files and split core files | High | Existing hotspots need burn-down, not permanent exemption. |
| Actual moat is operational, not technical sophistication | interpretation grounded in source/config/docs | `harness.contract.json`, `src/lib/decision/harness-decision.ts`, `src/lib/cli/registry/command-capabilities.ts`, `.agents/skills/coding-harness/**`, CI configs | portable contracts, decisions, gates, skill, review integration | No single command proves moat; conclusion synthesized from control-plane surfaces | Medium | Strategic clarity prevents defending complexity instead of leverage. |
| Competitive replication risk is real for simplified product | speculation grounded in architecture | command catalog, init/update, review-gate, validation docs | core primitives | No external competitor evidence inspected | Low-medium | A smaller competitor can copy features; durable advantage needs measured operational learning. |
