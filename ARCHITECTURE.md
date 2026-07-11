---
doc_schema: coding-harness-doc/v1
doc_type: architecture
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - coding-harness-maintainer
  - codex-agent
  - reviewer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-07-11
review_cadence: quarterly
maintenance_trigger:
  - architecture-boundary-change
  - command-family-change
  - generated-context-refresh
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - AGENTS.md
  - docs/architecture/documentation-layers.md
  - docs/adr/004-synaipse-agent-native-delivery-control-plane.md
  - docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
  - AI/context/diagram-context.md
---

# Architecture

## Table of Contents

- [Bird's Eye View](#birds-eye-view)
- [SynAIpse Control Plane](#synaipse-control-plane)
- [Universal Context Plane](#universal-context-plane)
- [Source Map](#source-map)
- [Code Map](#code-map)
- [API Boundaries](#api-boundaries)
- [Architecture Invariants](#architecture-invariants)
- [Cross-Cutting Concerns](#cross-cutting-concerns)
- [Deliberate Absences](#deliberate-absences)
- [Related Architecture Docs](#related-architecture-docs)

## Bird's Eye View

Coding Harness is a TypeScript control plane for agentic development and
review workflows. It turns repository policy, validation, memory, review, and
delivery evidence into executable guardrails so agents can do bounded software
work with professional handoff discipline.

At the highest level, the system accepts repository state, user or issue
intent, PR context, validation output, review evidence, and durable memory. It
then produces safe next actions, policy decisions, evidence artifacts,
review-ready changes, and closeout status.

The core architecture is a layered domain system with explicit cross-cutting
boundaries:

    CLI and agent cockpit surfaces
            |
    Command facades and registry adapters
            |
    Domain services and policy evaluators
            |
    Providers, repositories, config, and typed contracts
            |
    Evidence, memory, templates, docs, generated context, and tests

This root document is a stable orientation map. Detailed operating policy lives
in AGENTS.md, command and validation details live under docs/agents/, and
generated architecture context lives in AI/context/diagram-context.md.

## SynAIpse Control Plane

SynAIpse is the AI Delivery Harness implemented by this repository. Its
accepted v1 architecture keeps Codex as the execution runtime and makes
SynAIpse the Jamie-specific delivery policy and evidence layer.

    Jamie Core
        |
    SynAIpse lifecycle, authority, evidence, and improvement policy
        |
    Codex runtime: agent, tools, sessions, permissions, memory, review
        |
    Target repository: product, CODESTYLE, validation, privacy, rollback
        |
    CircleCI, Linear, CodeRabbit, security, sign-off, and git providers
        |
    Current-SHA evidence -> SynAIpse transition -> one next action

The canonical lifecycle is:

    Shape -> Admit -> Build -> Prove -> Review -> Integrate -> Improve

`harness next --json` is the intended sole routine agent entrypoint. It
projects `synaipse-state/v1`, including one action, truth-lane blockers,
authority, evidence references, and invocation-level effects. Administrative,
provider, diagnostic, and compatibility commands stay behind that cockpit.

SynAIpse owns Jamie Core precedence, lifecycle transitions, provider ownership,
project adoption, the Vital Decision Gate, and measured harness improvement.
It does not own Codex execution, tools, sessions, sandbox controls, native
memory, plugins, skills, MCP, or review execution. Target repositories retain
non-overridable authority over domain truth, privacy, raw sources, durable
knowledge, local instructions, CODESTYLE, validation, and rollback. Unresolved
policy contradictions block progression.

The accepted contract is
`docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md`;
ADR 004 records the decision, and the companion plan sequences migration. This
is the target architecture. Existing commands, packets, CI providers, and
active-route surfaces remain current behavior until their individual migration
slices produce caller, compatibility, canary, rollback, and independent-review
evidence.

## Universal Context Plane

The accepted context architecture separates identity, catalog, resolution, and
task reproducibility:

    Project identity plane: Jamie Brain projects registry
        |
    Context catalog plane: governed metadata over Jamie Brain, KnowledgeOS,
      Linear, and repository sources
        |
    Resolution plane: SynAIpse selects refs by project, stage, authority,
      privacy, lifecycle, and freshness; Codex retrieves them
        |
    Task snapshot plane: Admit-time IDs, digests, base SHA, outcome, evidence,
      privacy, and refresh triggers

Jamie Brain `operating-system/projects.yaml` remains project identity authority;
project cards remain human-readable summaries. A future governed project-context
catalog is the agent interface to private context, but its tree must first be
admitted through Jamie Brain CODE_TREE and validation. KnowledgeOS owns source
evidence, Linear owns active work, and the target repository owns executable
truth.

Allowed dependency direction:

- repository -> logical project/context reference;
- SynAIpse -> registry, catalog, and provider adapters;
- Codex -> selected source reads;
- task snapshot -> immutable source refs.

Forbidden direction:

- repository or CI -> Jamie-specific absolute path or private document body;
- product build -> Jamie Brain availability;
- KnowledgeOS or generated bundle -> repository authority;
- SynAIpse -> private Codex implementation path;
- project -> copied coding-harness documentation tree.

The first resolver is additive and read-only. It must prove required/optional
unavailability, privacy, freshness, host resolution, and unfamiliar-agent
outcomes across code, native, knowledge, minimal, and private canaries before
any document migration or remote context projection.

Public developer documentation follows a separate projection path. Every
canonical project must provide a GitBook-compatible repository entrypoint or an
explicit non-public exception. GitBook is presentation, not authority: the
target repository owns the source, CircleCI validates it, and publication
records source revision and result as a separate evidence lane. Jamie Brain
project context, task snapshots, private plans, raw sources, secrets, and local
paths are prohibited publication inputs.

## Source Map

The root directory intentionally keeps a small set of high-signal contract
surfaces:

- README.md: product overview, install path, common workflows, and command
  surface.
- AGENTS.md: mandatory operator baseline for agents working in this repo.
- ARCHITECTURE.md: stable source map and architecture invariants.
- CODESTYLE.md and codestyle/: repository and downstream style contracts.
- CONTRIBUTING.md, SECURITY.md, and SUPPORT.md: public contribution, security,
  and support policy.
- harness.contract.json: machine-readable governance contract.
- UBIQUITOUS_LANGUAGE.md: canonical project vocabulary.
- WORKFLOW.md, memory.json, and FORJAMIE.md: local workflow and handoff
  surfaces.
- Tooling config such as package.json, pnpm-lock.yaml, tsconfig.json,
  vitest.config.ts, biome.json, .mise.toml, and CI or lint config.

Generated output, local caches, runtime databases, bulk reports, and temporary
work areas should stay out of the root unless a contract explicitly promotes
them.

## Code Map

### src/commands/

Command entrypoints and compatibility facades live here.

**Architecture Invariant:** command files stay thin. Parsing, validation,
orchestration, persistence, and presentation belong behind named domain modules
under src/lib/** when they grow beyond a small adapter.

**API Boundary:** command behavior and JSON output are user and automation
boundaries. Changes must be deliberate, documented, and validated through the
repo command contract.

Runtime-card CLI artifact emission uses a dedicated command adapter:
`src/commands/runtime-card-artifacts.ts` owns `--out`, `--evidence-out`, and
`--handoff-out` path distinctness, repository-constrained writes, and trace
artifact-write recording so `src/commands/runtime-card.ts` remains a thin
runtime-card orchestration facade.

### src/lib/

Domain behavior lives here: policy gates, evidence evaluators, memory and
Project Brain logic, review and closeout flows, command internals, architecture
guards, provider adapters, and reusable typed contracts.

**Architecture Invariant:** implementation logic belongs in library modules,
not in docs, templates, generated context, or command facades.

**Deep Modules Placement:** promoted deep-module ownership lives in
`docs/architecture/deep-module-boundary-cards.json`. Keep this section as a
navigation front door: implementation logic belongs in `src/lib/**`, each
promoted module needs a compact public surface, owned responsibilities, and
explicit non-ownership boundaries, and command facades must route through those
public surfaces rather than absorbing behavior.

The boundary-card registry currently covers runtime evidence, browser evidence,
docs-surface, runtime trace, replay, prompt context, intermediary receipts,
delivery-truth, root hygiene, and PR closeout. Update that registry when a deep
module becomes route-driving or reviewer-facing, then keep tests and docs-gate
evidence aligned with the changed surface.
### scripts/

Repository validation, setup, governance, migration, release, and audit
automation lives here.

**Architecture Invariant:** scripts are executable contracts. When a doc
describes a required workflow, the matching script or package command is the
proof surface.

### docs/

Human-readable workflow, governance, architecture, release, validation, and
reference documentation lives here.

**Architecture Invariant:** docs explain contracts; scripts, tests, and gates
prove them. Stable docs should be indexed from docs/README.md and assigned to
one documentation layer.

### .harness/

Durable Project Brain state, decisions, memory, review logs, active artifact
indexes, and harness control-plane files live here.

**Architecture Invariant:** tracked .harness Markdown and JSON files are
durable operating memory. Runtime databases, caches, backups, and bulk outputs
remain local unless explicitly promoted.

**Tracking Interface:** `.harness/README.md` is the canonical classification
map for this surface. Stable policy, decisions, accepted specs/plans, intent
packets, learning examples, curated research, validator manifests, and media
sidecars can be repository truth. Raw command evidence, guardrail snapshots,
metrics, run directories, local learning imports, live browser HTML, runtime
databases, rollback markers, and generated binary media stay local by default
until a spec, plan, PR, validator, or decision explicitly promotes them.

### .codex/

Repo-local Codex runtime config, agents, hooks, skills, and environment setup
live here.

**Architecture Invariant:** Codex runtime configuration is a control plane, not
an incidental preference surface. Changes must preserve config, hook, symlink,
and runtime drift validation.

### .agents/

Packaged or exported agent and skill surfaces live here when the repository
needs to ship agent-facing behavior downstream.

**API Boundary:** exported skills are downstream contracts. Source behavior,
generated metadata, evals, and validation evidence must stay synchronized.

### templates/

Scaffolded downstream files and package templates live here.

**Architecture Invariant:** template changes must remain synchronized with the
source contracts they project. Generated downstream behavior should not become
the canonical source of truth.

### tests/, e2e/, test-fixtures/, and evals/

Proof surfaces live here: unit tests, integration and browser flows, fixtures,
and evaluation scenarios.

**Architecture Invariant:** tests should exercise stable boundaries and real
production paths where feasible. Fixture data may explain behavior, but it must
not become a hidden implementation oracle.

### AI/context/ and .diagram/

Generated architecture context and diagram artifacts live here.

**Architecture Invariant:** generated architecture context is derived evidence,
not canonical source truth. Update source contracts first, then refresh or
validate generated context when the change is architecture-sensitive.

## API Boundaries

Treat these surfaces as compatibility boundaries:

- CLI commands and machine-readable JSON output.
- harness.contract.json and related contract schemas.
- .harness/** durable memory, decision, intent, review, research, learning, and
  promoted evidence files.
- PR template and closeout evidence schemas.
- Review artifact contracts under artifacts/reviews/ when reviewers are
  requested.
- Review-state and external-state packet schemas that keep review truth, remote
  checks, tracker state, and merge readiness as separate evidence families.
- Intermediary receipt coverage schemas that keep real-time, browser, mailbox,
  compaction, visual, operator, and subagent observations orientation-only
  unless current receipts and canonical packet routes make claim support
  explicit.
- Exported downstream skill and template surfaces.
- Generated Codex environment actions.
- CI required-check contracts and branch-protection identities.
- Runtime evidence schemas such as runtime cards and evidence bundles.
- SynAIpse state, transition, improvement, adoption, security-finding, and
  sign-off contracts introduced through the v1 migration.
- SynAIpse context-catalog, context-ref, and task-context contracts introduced
  through the read-only universal-context canary.

Rules at these boundaries are stricter than rules inside an implementation
module. Prefer additive changes, explicit migration notes, and narrow validation
that proves the caller-visible behavior.

## Architecture Invariants

The following rules are intentionally stable:

- Root contract files are canonical until an explicit migration replaces them.
- Generated projections are never the source of truth.
- Evidence paths stay repository-scoped unless a command explicitly documents a
  wider trust boundary.
- Local validation, remote CI, review threads, tracker state, and merge
  readiness are separate truths.
- Required closeout evidence must classify missing, stale, untracked, or
  unverifiable proof as blocked or unknown rather than success.
- Review artifact output must exist on disk before synthesis when a review
  swarm requests artifact-first reports.
- CircleCI owns the primary PR gate; CodeRabbit remains independent review
  evidence; Semgrep Cloud remains independent external security evidence; GitHub
  Actions stays release or fallback unless the CI contract intentionally
  changes.
- Command-registry facades should stay small. Action-specific option builders,
  parsing, validation, and orchestration belong behind named internal seams.
- Project Brain and Local Memory capture durable operating knowledge; chat
  narrative alone is not durable evidence.
- .harness tracking is selective: visible control-plane candidates still require
  an explicit promotion decision before staging, and generated runtime state is
  not repository truth just because it sits under `.harness`.
- Repeated human steering that implies a design principle should become a guard,
  validator, test, policy, documented exception, or tracked follow-up.
- Codex owns execution primitives; SynAIpse may adapt stable signals but must
  not copy Codex-owned sessions, tools, permissions, memory, skills, plugins,
  MCP, or review execution.
- `harness next --json` is the target routine cockpit; other commands must be
  internal, administrative, provider, diagnostic, or compatibility surfaces.
- The exact invocation declares read, artifact-write, repository-write, git,
  and external effects; a command-level label cannot hide flag-dependent writes.
- Higher-level policy may strengthen but never weaken repository-owned privacy,
  raw-source, durable-knowledge, CODESTYLE, validation, or rollback constraints.
- Every harness mechanism requires a canary, measurement, rollback, and
  retain/change/consolidate/delete disposition.
- Repositories and CI remain independent of private Jamie Brain availability;
  cross-project context crosses boundaries only as logical IDs, approved
  projections, digests, and source references.

## Cross-Cutting Concerns

### Validation

Validation spans package scripts, shell scripts, policy gates, markdown and Vale
checks, TypeScript tests, architecture guards, docs-gate, and CI required
checks. Prefer the narrowest command that proves the touched behavior, then
widen when a change affects shared contracts.

### Review Governance

Reviewer roles, review artifacts, CodeRabbit evidence, and PR closeout ledgers
are governance surfaces. They must remain independent enough that an
implementation agent cannot self-approve its own delivery claims.

### Trust Boundary

Trust-boundary logic classifies which evidence can support a claim. It must
distinguish tracked source truth, generated projections, stale artifacts,
runtime-only files, remote state, and human review evidence.

### Runtime Evidence And Observability

Runtime cards, evidence bundles, session evidence, telemetry, and generated
context help agents reason about current state. They are advisory and
artifact-backed unless a command contract explicitly promotes them to a gate.

### Project Brain And Local Memory

Project Brain files under .harness/ and Local Memory integrations preserve
decisions, learnings, and active artifacts across sessions. They support work
routing only when their referenced artifacts are current and traceable.

### Generated Artifacts

Generated docs, diagrams, templates, package output, and environment actions
must be tied back to source contracts and freshness checks. Generated drift is a
real failure when the generated surface is part of review or runtime evidence.

## Deliberate Absences

- No source implementation logic in root Markdown files.
- No broad operational policy in README.md; use AGENTS.md and docs/agents/** for
  operator guidance.
- No generated caches, coverage output, build output, or temporary work
  directories as root source contracts.
- No direct dependency from command facades to rich provider or runtime
  internals when a domain seam exists.
- No remote-service truth claims without current evidence or an explicit
  blocker classification.

## Related Architecture Docs

- docs/agents/00-architecture-bootstrap.md: architecture-sensitive workflow and
  artifact refresh guidance.
- docs/architecture/module-boundaries.md: deep module and command boundary
  contracts.
- docs/architecture/effect-deep-modules.md: Effect adoption boundary rules.
- docs/architecture/runtime-aware-harness-control-plane.md: runtime-aware
  control-plane design.
- docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md:
  accepted SynAIpse ownership, lifecycle, authority, and contract boundary.
- docs/plans/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-plan.md:
  reversible implementation and canary sequence.
- docs/adr/004-synaipse-agent-native-delivery-control-plane.md: decision and
  consequences for the v1 control-plane architecture.
- docs/architecture/documentation-layers.md: documentation layering model.
- AI/context/diagram-context.md: generated architecture context for agents.
