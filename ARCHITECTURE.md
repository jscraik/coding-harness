# Architecture

## Table of Contents

- [Bird's Eye View](#birds-eye-view)
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

**Deep Modules Placement:** current runtime-evidence deep modules include:

- src/lib/evidence/: shared receipt contracts that classify validation,
  artifact, runtime-card, review, external-state, and run-record proof.
- src/lib/browser-evidence/: browser-evidence/v1 manifest validation for
  rendered UI artifacts. It owns screenshot path containment, required viewport
  coverage, missing-console-telemetry classification, default-deny console
  policy checks, deterministic nonblank PNG screenshot inspection, and
  browser-specific machine-readable failure codes while keeping browser
  evidence separate from delivery-truth, review-state, external-state,
  Judge/PM, goal-completion, and merge-readiness proof.
- src/lib/runtime/: Codex runtime evidence, runtime evidence bundles, runtime
  cards, producer adapters, runtime-card projections, and
  `runtime-card-handoff/v1` contracts. The runtime-card handoff module binds a
  persisted runtime card to its produced runtime-evidence bundle with a shared
  binding id, checksums, source/provenance refs, head SHA, and orientation-only
  evidence-use policy before any handoff can feed agent cockpit state. Codex
  runtime identity also carries nullable client user-message correlation when
  producer input can prove it; unavailable message ids remain null and must not
  be synthesized from adjacent turn, trace, timestamp, PR, or artifact fields.
  Permission evidence is scoped by an explicit runtime environment snapshot
  rather than by profile alone: environment id, cwd, expected cwd, executor
  kind, approval scope, expected approval scope, sandbox policy ref, state, and
  failure class live in `codex-runtime-evidence/v1`. Known permission claims
  require a receipt-backed sandbox policy ref, stale cwd and approval-scope
  mismatches are blocked session sources, and runtime-card projection exposes
  only compact `environmentRefs` pointers. Runtime-card Codex continuity
  projection also stays inside this deep module: producer-supplied thread,
  turn, trace, goal, client-message, queue, approval, and heartbeat refs may be
  projected only as compact source-backed and receipt-backed pointers under
  `codexRuntime.continuity`; they must not embed raw prompts, transcripts,
  event streams, secrets, or bulky runtime payloads and must not become command
  authority, delivery-truth, review-state, external-state, merge-readiness,
  Judge/PM, or goal-completion proof.
- src/lib/runtime-trace/: opt-in runtime-card trace recording that projects
  runtime-card execution into canonical `agent-run-event/v1` event streams
  under `artifacts/agent-runs/<runId>/events.jsonl`. It owns trace-out path
  parsing, run-id derivation, compact payload construction, artifact refs, and
  terminal manifest emission while requiring a fresh run id before the first
  event append and reusing the shared run-record writer for hash-chain
  continuity and replay validation.
- src/lib/replay/: replay and validation contracts for replayable runtime,
  hook, and session evidence. It owns `ReplayPacket/v1` types and semantic
  validation for pointer-only replay seeds, content-bound source refs,
  hook-execution provenance, normalized event summaries, stale-state
  classification, redaction guarantees, and orientation/audit-trail evidence
  use. Replay packets are not delivery-truth claim support; they can steer
  investigation or preserve audit evidence only after validators prove
  repo-relative path safety, SHA-256 integrity, hook identity, TTL/head
  freshness semantics, and absence of raw prompts, transcripts, command output,
  screenshots, images, or secret-like values.
- src/lib/prompt-context/: prompt-context receipt contracts for the prompt,
  instruction, permission, capability, and goal context that shaped an agent
  turn. It owns `prompt-context-receipt/v1` types, schema parity, pointer-only
  validation, raw prompt/transcript/secret rejection, and source-ref authority
  classification. Instruction sources may use only system, developer, repo,
  trusted-skill, or user-steering authority layers; plugin metadata, artifact
  data, review feedback, telemetry, and untrusted external inputs may orient or
  audit the turn but must not be accepted as behavior-steering instruction
  authority. The packet remains `not_yet_emitted` and cannot authorize
  commands, support delivery-truth, review-state, external-state, Linear,
  merge-readiness, Judge/PM, or goal-completion claims.
- src/lib/prompt-context-drift/: prompt-context integrity reports for agent
  cockpit orientation. It owns `prompt-context-drift-report/v1` types,
  semantic validation, repo-contained SHA-256 source refs, symlink/realpath
  containment, stale Project Brain/runtime-card/receipt classification, and
  claim-support eligibility checks for required local context surfaces. The
  first consumer is `src/lib/agent-readiness/context-health.ts`, which exposes
  the report as an advisory `prompt_context_drift` context surface; the packet
  must not authorize commands, close JSC-363 acceptance criteria, support
  delivery-truth, or prove merge readiness.
- src/lib/intermediary-receipts/: realtime and intermediary receipt coverage
  contracts for browser state, streamed status, mailbox status, compaction
  summaries, visual state, realtime event snippets, external check snapshots,
  operator steering echoes, and subagent status text. It owns
  `intermediary-receipt-coverage/v1` types, deny-by-default claim policy
  matrix validation, source-kind taxonomy coverage, deterministic
  blocker-to-next-action mapping, most-restrictive-wins summary aggregation,
  raw/secret leakage rejection, current receipt/head-SHA checks for
  claim-support evidence, and canonical-packet routing requirements for
  protected external-state, review-state, delivery-truth, Linear, Judge/PM, and
  merge-readiness claim families. The packet is contract-first and
  `not_yet_emitted`; unbound realtime observations may orient agents, but they
  cannot support closeout, delivery-truth, review-state, external-state,
  root-hygiene, Judge/PM, Linear, or merge-readiness claims without a current
  `evidence-receipt/v1` and the matching canonical packet route.
- src/lib/delivery-truth/: private and production verdict composition for
  delivery, root hygiene, Judge/PM readiness, and merge-readiness claims.
- src/lib/root-hygiene/: root-surface classification and claim-support receipt
  generation for root_surface_tidy. It reads live git-tracked paths through a
  no-shell verifier-owned seam before claim support, maps policy-backed root
  entries into canonical, should-move, generated-tracked, legacy/drift, and
  unclassified classes, recomputes coverage digests from classified entries
  before receipt emission, binds receipts to the current policy digest and
  classifier-owned complete git-tracked root inventories, binds reports to a
  non-path repository identity derived from the real git top-level directory, and requires
  delivery-truth to verify the report payload, repository identity,
  verifier-owned runtime report token, frozen report graph, receipt checksum,
  and head SHA when the verdict is head-bound. The verifier-owned marker is
  module-private to the classifier seam, so other in-process callers cannot
  mint claim support by importing a marker helper; the report is frozen before
  it receives the marker so callers cannot mutate trusted evidence after
  classification. The module keeps hook-safe git environment sanitization,
  git top-level resolution, git inventory reading, tracked-path projection,
  entry classification, report freezing, receipt construction, policy digesting,
  policy rows, and classifier trust
  logic split so delivery-truth does not trust prose-only, stale-policy,
  stale-head, caller-forged, post-token-mutated, direct-import-forged, or
  cross-repository replayed root hygiene claims.
- src/lib/pr-closeout/: PR closeout claim evaluation and recovery state; it may
  consume delivery-truth verdict summaries as additive evidence but must not
  collapse local validation, remote checks, review state, tracker state, and
  merge readiness into one blended truth.
- src/lib/review-state/: PR review truth packets, reviewer artifact receipt
  validation, unresolved thread counts, and validation ownership
  classification.
- src/lib/external-state/: live PR/CI/review/tracker snapshot packets,
  freshness/TTL/head-SHA validation, stale-state classification, and
  claim-support eligibility.
- src/lib/action-review/: high-risk action review receipt contracts for merge,
  release, destructive cleanup, and external tracker mutation. It owns
  `action-review-receipt/v1` types, schema parity, semantic validation,
  reviewer independence checks, action-envelope mismatch classification, and
  machine-readable allow/block/mismatch error codes while keeping receipts
  contract-only, `not_yet_emitted`, orientation/governance/audit evidence, and
  out of delivery-truth claim support unless an emitted producer and consumer
  boundary is implemented and validated in the same change.
- src/lib/artifact-runtime-surface/: visible artifact runtime surface
  contracts for implementation notes, review artifacts, screenshots, CSV/PDF
  or document outputs, reports, runtime cards, and lifecycle artifacts. It
  owns `artifact-runtime-surface/v1` types, schema parity, semantic validation,
  repo-relative path safety, current-head and lineage matching, preview
  applicability, value-level leakage checks, and filesystem containment checks
  in the standalone validator so artifacts can steer agents or support claims
  only when their path, freshness, preview, checksum, and lineage are current.
- src/lib/steering-queue/: pending operator-steering packets and
  steering-application receipts for continuation recovery, stale-state
  detection, and audit/orientation evidence. It keeps `steering-queue.ts` as a
  compatibility facade over typed contracts, builder, hash, constants, and
  semantic-validation modules. It owns `steering-queue/v1` item state,
  instruction-source hashing, artifact identity checks, supersession,
  stale-precondition classification, client user-message correlation for
  expected and applied same-thread steering, single-scope packet validation,
  deterministic selection order, and semantic validation. It also owns
  `steering-application-receipt/v1` as a pointer-only, `not_yet_emitted`
  contract that binds a queue item, expected/current thread-turn-message
  context, stale-precondition result, runtime-card update reference, and
  head-SHA freshness for the attempted application. Both packets stay out of
  execution authority, delivery-truth claim support, Judge/PM readiness,
  tracker mutation, and merge-readiness proof until a future runtime-card
  adapter explicitly emits and consumes them with synchronized governance docs.
- src/lib/decision/: advisory cockpit decision and lifecycle route metadata.
  It owns `harness-decision/v1`, `route-decision/v1`, route validation, and the
  risk-tiered mutation policy that allows only low-risk repo-local advisory
  mutation routes to omit human review when current evidence and validator
  ownership are present. It must not make route target commands executable
  authority, prove delivery truth, mutate trackers, prove merge readiness, or
  satisfy Judge/PM or goal-completion claims.
- src/lib/decision-request/: read-only governance request packet emission for
  human or operator escalation. It owns intent, authority, option grammar,
  evidence references, escalation metadata, expiry/freshness normalization, and
  stale-state classification for decision-request/v1 while explicitly keeping
  the packet out of closeout and merge-readiness claim support.

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
- Intermediary receipt coverage schemas that keep realtime, browser, mailbox,
  compaction, visual, operator, and subagent observations orientation-only
  unless current receipts and canonical packet routes make claim support
  explicit.
- Exported downstream skill and template surfaces.
- Generated Codex environment actions.
- CI required-check contracts and branch-protection identities.
- Runtime evidence schemas such as runtime cards and evidence bundles.

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
- docs/architecture/documentation-layers.md: documentation layering model.
- AI/context/diagram-context.md: generated architecture context for agents.
