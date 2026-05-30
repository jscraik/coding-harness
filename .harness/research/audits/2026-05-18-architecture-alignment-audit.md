# Executive Summary

This audit compares the current Coding Harness repository against
`.harness/research/deep/2026-05-18-coding-harness-evidence.md`. The evidence
document argues for an engineered agent operating system: compact context,
typed authority boundaries, deterministic verification, durable learning, live
traceability, bounded recovery, and governance that is enforced in executable
paths rather than narrated in docs.

The codebase is directionally strong. It is not a hollow prompt pack. The repo
has a real command registry, a contract file with north-star and policy
metadata, Project Brain scaffolding, CI/required-check manifests, runtime-card
and PR-closeout artifacts, docs-gate enforcement, evidence verification,
pattern-scope work, local memory gates, and a broad test suite. The strongest
architectural move is that many concepts from the evidence document have been
converted into executable CLI surfaces instead of remaining prose.

The weakest area is runtime cohesion. The evidence describes a runtime harness
around the agent loop: model/tool registry, context manager, step history,
verifier, retry policy, recovery handlers, and trace surface. The repository
contains many of those pieces, but they are not yet one canonical loop. The
main operational shape is a set of gates, shell wrappers, artifacts, and docs.
That is useful and materially better than prompt-only operation, but it is not
yet the full runtime architecture implied by the evidence.

The highest-risk contradiction is policy enforcement. `harness.contract.json`
says high-risk changes remain human-mediated, but the default policy chain maps
high and medium risk to `warn`, and `warn` maps to a passing verdict. The
`policy-gate` implementation also explicitly lets runs without `--max-tier`
pass according to the policy-chain verdict. That means the system's default
mechanical behavior can be weaker than its stated safety floor.

The second major contradiction is verification architecture split. The repo has
a typed TypeScript verification orchestrator with state, gate modes, retry
policy, and run-state primitives, but the public `harness verify-work` command
delegates to `scripts/verify-work.sh`. The shell wrapper is currently the
canonical route in repo instructions, generated scaffolds, and tests. That may
be intentional portability, but it creates a two-track verification architecture:
typed orchestration exists, while the default runtime path is shell-led.

The third major gap is observability. There are artifacts, runtime-card reports,
PR closeout reports, run directories, and an `observability-gate`, but the gate
only validates metric-label cardinality. The evidence's stronger idea of
agent-owned observability, trace history, dashboards, and queryable runtime
truth is only partially implemented.

Overall architectural drift level: medium. The project is coherent at the
mission and surface level, but its implementation has accumulated many adjacent
commands and governance artifacts before consolidating the core runtime loop.
The repo is operationally useful today; it is not yet a fully integrated harness
runtime.

# Overall Gradecard

| Area | Grade | Confidence | Notes |
|---|---:|---:|---|
| Harness Engineering | B | High | Real CLI gates, contracts, Project Brain, closeout, runtime-card, and validation wrappers exist; the integrated agent-loop runtime is still partial. |
| Architecture Cohesion | C+ | High | North-star language is consistent, but command surfaces and gate families are broad, and key flows are split between TypeScript commands and shell wrappers. |
| Runtime Safety | B- | High | Strong path checks in runtime-card/evidence paths and branch-protection metadata; policy-gate defaults weaken high-risk enforcement. |
| Validation Depth | B | High | `pnpm check`, docs gates, codestyle gates, verify-work, tests, and CI contracts are substantial; exact production-path verification is uneven across commands. |
| Governance | B- | High | Contract, required-checks manifest, docs-gate, review-gate, authz policy, and PR-closeout are real; some policy defaults and CI aggregation reduce mechanical force. |
| Evals | C | Medium | Eval engines and observed-skill artifacts exist, but capture-the-flag style continuous runtime evals are not yet first-class. |
| Observability | C- | High | Runtime-card and PR-closeout are useful artifacts; `observability-gate` is metric-label validation, not agent-owned operational telemetry. |
| Modularity | C+ | High | Many commands are isolated, but the registry and some command cores are large coordination hubs; reusable primitives exist unevenly. |
| Recovery Systems | C | Medium | Bounded retry exists for read-only transient verification; general recovery-handler slots are missing. |
| Context Engineering | B- | Medium | Docs layering, command catalog, Project Brain, and active-artifact routing are strong; no runtime context compressor or budgeted source selector exists. |
| Memory Systems | B- | High | Project Brain, local-memory preflight, learning gates, and repo memory surfaces are real; automatic distillation from traces/failures is partial. |
| Agent Coordination | C+ | Medium | `harness next`, runtime-card, PR-closeout, and Linear/GitHub integration help coordination; multi-agent orchestration remains artifact/procedure driven. |
| CI/CD Enforcement | B- | High | CircleCI primary lane, required-check manifest, Semgrep/CodeRabbit separation, and docs gates are present; many logical gates collapse to `pr-pipeline`. |
| Determinism | B- | High | Deterministic validators and artifacts are a project strength; several paths still rely on optional live tools, environment state, or advisory outputs. |
| Traceability | B | High | Evidence artifacts, runtime-card, PR-closeout, Project Brain, and command JSON outputs are strong; there is no single queryable trace history for agent runs. |

# Evidence-to-Code Mapping

## Evidence Concept: Environment As Product Surface

### Code Locations

- `package.json`: canonical scripts for `check`, `test:deep`,
  `docs:steering:guard`, evals, codestyle, and security.
- `scripts/codex-preflight.sh`: repo-oriented startup gate, Project Brain
  detection, safe override loading, and sourced-invocation refusal.
- `scripts/verify-work.sh`: repo-local verification wrapper used as the
  canonical handoff command.
- `src/commands/init.ts` and generated scaffold tests: downstream harness
  bootstrap and wrapper generation.
- `harness.contract.json`: runtime contract, north-star, policy, branch
  protection, and product surface declarations.

### Runtime Status

Partially operational to operational. The environment is not just documentation:
there are real scripts, package commands, generated downstream wrappers, and
tests for scaffolded repo behavior. The environment is a product surface for
agents.

### Alignment Score

8/10.

### Gaps

- Environment health still depends on shell/runtime availability and repo-local
  wrapper behavior.
- The canonical route is split across package scripts, shell wrappers,
  TypeScript commands, and docs.

### Contradictions

None severe. The evidence's idea is substantially implemented here.

## Evidence Concept: Human Attention Budgeting

### Code Locations

- `harness.contract.json` north-star mission and decision questions.
- `src/commands/next.ts`: first-contact decision surface for agents.
- `src/lib/runtime/local-runtime-card.ts`: compact runtime state cards.
- `src/lib/pr-closeout.ts`: next-action classification for PR closeout.
- `docs/agents/00-architecture-bootstrap.md` and `docs/agents/01-instruction-map.md`.

### Runtime Status

Partially operational. `harness next`, runtime-card, and PR-closeout reduce
human interpretation load, but the user still needs to understand which gates
matter, when live checks were used, and whether artifacts are current.

### Alignment Score

7/10.

### Gaps

- No single cockpit proves all live horizons by default: PR, branch, Linear,
  checks, dirty worktree, validation, memory, and next lane.
- Some decision surfaces are advisory rather than executable.

### Contradictions

The repo explicitly tries to minimize manual glue, but the broad command
surface can itself become glue unless `harness next` remains the dominant
entrypoint.

## Evidence Concept: Repository As Agent Operating System

### Code Locations

- `AGENTS.md`: operating contract and north-star mission.
- `.harness/README.md`, `.harness/active-artifacts.md`,
  `.harness/memory/LEARNINGS.md`, `.harness/decisions/**`.
- `src/commands/brain-core.ts`: Project Brain status/query/add/preflight.
- `src/lib/cli/registry/command-capabilities.ts`: machine-readable command
  capability catalog.
- `harness.contract.json`: product surfaces and governance policy.

### Runtime Status

Partially operational. The repository does act like an operating surface for
agents, but several subsystems are file/artifact protocols rather than a
cohesive runtime.

### Alignment Score

7/10.

### Gaps

- No global run coordinator owns the lifecycle from orientation through
  implementation, validation, review, PR, Linear, and learning closeout.
- Project Brain status is static/file-backed; it does not continuously ingest
  every runtime event.

### Contradictions

The repo says recurring manual steering should become operating-system behavior,
but some steering still becomes Markdown or PR-template language before it
becomes a mandatory runtime path.

## Evidence Concept: Static Context Plus Dynamic Evidence

### Code Locations

- `src/commands/runtime-card.ts`: optional live GitHub/Linear, phase-exit, and
  evidence bundle inputs.
- `src/lib/runtime/local-runtime-card.ts`: dirty worktree, branch, active
  artifact, phase-exit, GitHub, Linear, and evidence summaries.
- `src/commands/evidence-verify.ts`: static evidence artifact validation.
- `src/lib/pr-closeout.ts`: PR state, checks, branch, review threads,
  traceability, phase-exit, dirty path, and tool summaries.

### Runtime Status

Partially operational. Static context and dynamic evidence are both present, and
runtime-card is one of the strongest code paths in the repo. Live state remains
optional and tool-dependent.

### Alignment Score

7/10.

### Gaps

- No single trace store ties runtime-card, validation runs, PR closeout, evals,
  and memory updates together.
- Dynamic evidence often arrives via optional flags or external CLIs rather than
  a mandatory harness-owned collection pipeline.

### Contradictions

The evidence rejects model claims as proof. The repo agrees, but some closeout
workflows can still be completed with static artifacts unless the operator
explicitly requests live checks.

## Evidence Concept: Mechanical Architecture Enforcement

### Code Locations

- `src/commands/docs-gate-core.ts`: changed-file classification and required
  docs surface enforcement.
- `scripts/check-steering-feedback-contract.cjs`: repeated-steering contract
  guard.
- `src/commands/pattern-scope.ts`: `pattern-scope/v1` artifact from feedback
  and changed files.
- `src/commands/policy-gate.ts`: risk-tier policy evaluation.
- `harness.contract.json`: policy chain and branch protection.

### Runtime Status

Partial. Some architecture enforcement is real and tested. The policy gate
default is too soft for the stated high-risk safety posture.

### Alignment Score

6/10.

### Gaps

- `pattern-scope/v1` exists in the current tree, but it is a produced artifact
  command; this audit did not find proof that every implementation-time
  steering event is automatically required to run it before closeout.
- `policy-gate` can pass high-risk changes when `--max-tier` is omitted.

### Contradictions

- `harness.contract.json` says high-risk changes remain human-mediated, but
  `policyChain.tierToAction.high` is `warn`, and `warn` maps to `pass`.
- `runPolicyGate` explicitly says that if no max tier is specified, all pass
  according to the policy-chain verdict.

## Evidence Concept: Runtime Harness Around The Agent Loop

### Code Locations

- `src/lib/cli/registry/command-specs-core.ts`: command dispatch registry.
- `src/lib/cli/registry/command-capabilities.ts`: agent-facing command
  metadata.
- `src/commands/next.ts`: cockpit decision surface.
- `src/lib/verify/orchestrator-core.ts`: typed verification orchestrator.
- `src/lib/verify/retry-policy.ts`: bounded retry policy.
- `src/lib/verify/run-state-core.ts`: durable verification state.
- `src/lib/runtime/local-runtime-card.ts`: runtime-card builder.

### Runtime Status

Partially scaffolded. The ingredients are there, but the evidence's unified
agent loop is not yet the main runtime abstraction. The current architecture is
closer to a command-and-gate toolkit than a single harness loop.

### Alignment Score

5/10.

### Gaps

- No canonical `AgentLoop` or `HarnessRun` primitive owns step history,
  context selection, tool execution, validation, retries, recovery, and learning.
- Verification orchestration and shell verification wrappers remain split.
- Recovery handlers are not a general extension point.

### Contradictions

`harness verify-work` delegates to `scripts/verify-work.sh`, while the typed
verify orchestrator exists separately. This is an architecture split between
the runtime path operators are told to use and the richer TypeScript state
machine the evidence would prefer.

## Evidence Concept: Tool Registry As Authority Boundary

### Code Locations

- `src/lib/cli/command-registry.ts`: command index and dispatch.
- `src/lib/cli/registry/command-specs-core.ts`: command definitions.
- `src/lib/cli/registry/command-capabilities.ts`: mutability, retryability,
  tier, audience, orchestrator, mode, and visibility metadata.
- `src/cli.ts`: first-contact help and dispatch behavior.

### Runtime Status

Operational but broad. The command catalog is real, structured, and agent
oriented. It is also large and still centered on a manually maintained registry.

### Alignment Score

7/10.

### Gaps

- Capability metadata is useful but not a full typed authority model. It does
  not itself enforce credentials, blast radius, approval state, or artifact
  freshness for every command.
- The registry is a large central module, which increases review burden and
  hidden coupling.

### Contradictions

None severe. The implementation is a credible authority boundary, just not yet
as compact or enforceable as the evidence implies.

## Evidence Concept: Trace History As Truth Surface

### Code Locations

- `.harness/runs/**`: intended runtime output area.
- `src/lib/verify/run-state-core.ts`: verification run-state persistence.
- `src/lib/pr-closeout.ts`: closeout evidence and next-action summary.
- `src/commands/runtime-card.ts`: runtime cards and evidence bundle outputs.
- `src/lib/evals/observed-skill-usage.ts`: observed skill usage artifact
  support.

### Runtime Status

Partially implemented. There are trace-like artifacts, but not one queryable
history of agent decisions, tools, validations, failures, recoveries, and
learning promotion.

### Alignment Score

5/10.

### Gaps

- No central event schema spans all commands.
- No default trace ingestion from Codex sessions, GitHub, Linear, validation
  runs, and memory updates into a single harness-owned store.
- Observed-skill usage can consume session data, but collection is caller-driven
  rather than automatic.

### Contradictions

The evidence wants trace history to beat model narrative. The repo has many
evidence artifacts, but operators still need to assemble the trace from several
places.

## Evidence Concept: Deterministic Verification Over Model Claims

### Code Locations

- `package.json` `check`, `test:deep`, and guard scripts.
- `scripts/verify-work.sh`.
- `src/commands/review-gate-core.ts`.
- `src/commands/evidence-verify.ts`.
- `src/commands/docs-gate-core.ts`.
- `src/lib/pr-closeout.ts`.

### Runtime Status

Operational. This is one of the repo's strongest alignments. The codebase
repeatedly encodes deterministic proof surfaces.

### Alignment Score

8/10.

### Gaps

- Some proof remains artifact-existence proof rather than runtime behavior proof.
- Some high-risk checks are advisory unless invoked through stricter modes.

### Contradictions

No severe contradiction. The main risk is uneven enforcement, not absence.

## Evidence Concept: Failure-Driven Decomposition

### Code Locations

- `src/lib/pr-closeout.ts`: blocker classifications and next actions.
- `src/lib/verify/retry-policy.ts`: transient failure classification.
- `src/commands/pattern-scope.ts`: steering-to-sibling-scope artifact.
- `.harness/memory/LEARNINGS.md`: durable learned-fix surface.
- `scripts/codex-preflight.sh`: Project Brain and memory surfaces.

### Runtime Status

Partial. Failures are classified in several places, but there is no universal
failure taxonomy and no default loop that converts every repeated failure into
code, tests, docs, or memory.

### Alignment Score

6/10.

### Gaps

- Retry classification in `retry-policy.ts` is intentionally narrow and
  string-pattern based.
- Pattern-scope is present, but automatic admission of every repeated steering
  signal is still not proven as an enforced implementation-time path.

### Contradictions

The project says repeated steering is stop-the-line. Current mechanics are
improving, but still depend on command invocation and PR/template governance
rather than universal runtime interception.

## Evidence Concept: Feedback Conversion Loop

### Code Locations

- `scripts/check-steering-feedback-contract.cjs`.
- `src/commands/pattern-scope.ts`.
- `.harness/memory/LEARNINGS.md`.
- `src/lib/evals/observed-skill-usage.ts`.
- `src/commands/north-star-feedback.ts`.
- `docs/agents/07b-agent-governance.md`.

### Runtime Status

Partially operational. The repo has serious machinery for feedback conversion,
including the new pattern-scope command in the current tree. It is not yet
fully closed-loop.

### Alignment Score

6/10.

### Gaps

- No automatic extractor watches PR comments, CodeRabbit findings, failed
  checks, and Codex session corrections and proposes durable rule updates.
- Feedback promotion still relies on operator discipline and command selection.

### Contradictions

The docs treat feedback conversion as mandatory; the runtime makes it possible
and partially enforced, not yet unavoidable.

## Evidence Concept: Small Skill Set With High Taste Density

### Code Locations

- `.agents/skills/coding-harness/**`: downstream skill packaging target.
- `src/commands/init.ts`: skill installation/scaffold behavior.
- `package.json`: skill validation scripts.
- `src/lib/evals/observed-skill-usage.ts`: skill-use evidence.

### Runtime Status

Partial. Skill validation and packaging exist, but this audit focused on the
codebase rather than downstream installed skill behavior. The principle is
present but not fully proven from runtime evidence alone.

### Alignment Score

6/10.

### Gaps

- Skill quality depends on evals and observed usage artifacts that are not yet
  continuously captured.
- The command surface is larger than the evidence's "small high-density" ideal.

### Contradictions

The project values compact agent surfaces, but the CLI catalog is broad and can
overwhelm unless routed through `harness next`.

## Evidence Concept: Agent-Owned Observability

### Code Locations

- `src/commands/observability-gate.ts`.
- `src/lib/policy/cardinality.ts`.
- `src/commands/runtime-card.ts`.
- `src/lib/pr-closeout.ts`.
- `src/lib/evals/observed-skill-usage.ts`.

### Runtime Status

Partially scaffolded. Runtime-card and PR-closeout are useful observability
artifacts. The named `observability-gate` itself only validates labels and
cardinality.

### Alignment Score

4/10.

### Gaps

- No unified trace viewer, dashboard, or query command for agent runs.
- No standard event stream for tool calls, retries, recoveries, PR state, Linear
  state, validation state, and learning state.
- No agent-owned observability contract beyond artifact production and label
  hygiene.

### Contradictions

Calling the current observability surface "agent-owned observability" overclaims
it. It is observability scaffolding plus static artifact checks.

## Evidence Concept: Environment Inversion

### Code Locations

- `scripts/prepare-worktree.sh`.
- `scripts/check-environment.sh`.
- `scripts/codex-preflight.sh`.
- `src/commands/init.ts`.
- `.codex/environments/environment.toml` if present in generated surfaces.

### Runtime Status

Partial to operational. The repo invests heavily in making the environment
shape agent behavior. Downstream generated environment behavior was not fully
traced in this audit.

### Alignment Score

7/10.

### Gaps

- Generated environment action synchronization is governance-heavy and can
  drift across docs, contracts, tests, and runtime outputs.

### Contradictions

No severe contradiction found in the inspected paths.

## Evidence Concept: Review Disagreement And Closure Protocol

### Code Locations

- `src/commands/review-gate-core.ts`.
- `src/lib/pr-closeout.ts`.
- `harness.contract.json` review policy and independent review requirement.
- `.harness/ci-required-checks.json`: CodeRabbit and external check entries.

### Runtime Status

Partially operational. Review-gate and PR-closeout are real. Negotiated reviewer
disagreement semantics are thinner than the evidence implies.

### Alignment Score

6/10.

### Gaps

- No first-class disagreement object capturing reviewer position, agent
  position, evidence, resolution, and durable follow-up.
- CodeRabbit independence is enforced as a check surface, but not as a full
  disagreement workflow.

### Contradictions

No severe contradiction. This is an incomplete maturity area.

## Evidence Concept: Full Delivery Lifecycle Delegation

### Code Locations

- `src/commands/next.ts`.
- `src/commands/runtime-card.ts`.
- `src/commands/pr-closeout.ts`.
- `src/commands/review-gate-core.ts`.
- `src/commands/linear*.ts`.
- `.circleci/config.yml`.

### Runtime Status

Partial. The repo has many lifecycle checkpoints. It does not yet fully own the
delivery lifecycle as an autonomous, closed loop.

### Alignment Score

6/10.

### Gaps

- PR, Linear, branch, validation, review, and memory closeout are still combined
  through multiple commands and operator discipline.
- Live external state collection is optional or dependent on external CLIs.

### Contradictions

The repo forbids equating green checks with completion, but the code still
requires explicit closeout paths to prove broader lifecycle state.

## Evidence Concept: Disposable Runs With Mandatory Learning

### Code Locations

- `.harness/memory/LEARNINGS.md`.
- `src/commands/learnings*.ts`.
- `src/commands/north-star-feedback.ts`.
- `src/lib/evals/observed-skill-usage.ts`.
- `scripts/codex-preflight.sh`.

### Runtime Status

Partial. Learning surfaces exist, but mandatory learning from every discarded or
failed run is not automatically enforced.

### Alignment Score

5/10.

### Gaps

- No default post-run learning admission hook for failed/abandoned agent runs.
- No automatic repeated-failure detector spanning session history and CI.

### Contradictions

The evidence says disposable runs must still produce learning. The repo has
learning mechanisms, but not yet a mandatory run-finalization loop.

## Evidence Concept: Spec As Distributable Software

### Code Locations

- `src/commands/init.ts`.
- `src/commands/contract*.ts`.
- `harness.contract.json`.
- `docs/agents/**`.
- `.agents/skills/coding-harness/**`.

### Runtime Status

Operational in scaffold form, partial in behavior. The repo distributes
contracts, wrappers, skills, docs, and gates. The stronger evidence pattern of
specs acting as executable software is present but uneven.

### Alignment Score

7/10.

### Gaps

- Some specs still require separate validators to matter.
- Not every spec has a direct runtime consumer.

### Contradictions

No severe contradiction.

## Evidence Concept: Harness-Owned Recovery

### Code Locations

- `src/lib/verify/retry-policy.ts`.
- `src/lib/pr-closeout.ts`.
- `scripts/codex-preflight.sh`.
- `src/commands/pilot-rollback*.ts`.
- `harness.contract.json` pilot rollback policy.

### Runtime Status

Partial. Recovery is present in bounded pockets, not as a general harness-owned
contract.

### Alignment Score

5/10.

### Gaps

- No standard recovery-handler registry.
- Retry only applies to a narrow class of read-only transient verification
  failures.
- Rollback is policy-described and command-backed, but not part of every
  delivery loop.

### Contradictions

The evidence implies recovery belongs inside the runtime loop; the repo handles
it with separate commands and policies.

## Evidence Concept: Prompt-Invariant Harness Improvement

### Code Locations

- `scripts/check-steering-feedback-contract.cjs`.
- `src/commands/pattern-scope.ts`.
- `src/commands/north-star-feedback.ts`.
- `.harness/memory/LEARNINGS.md`.
- `docs:steering:guard` in `package.json`.

### Runtime Status

Partial and improving. The current branch's `pattern-scope/v1` command is a
good move from prompt discipline toward an artifact contract.

### Alignment Score

6/10.

### Gaps

- Needs mandatory integration into `harness next`, PR closeout, and/or
  verify-work when steering signals are detected.
- Needs evidence that triggered pattern-scope artifacts are checked, not merely
  producible.

### Contradictions

No current contradiction as strong as the pre-pattern-scope state, but the
enforcement chain is not complete.

## Evidence Concept: Cheap Model Plus Strong Harness

### Code Locations

- Command catalog, JSON outputs, deterministic gates, docs map, Project Brain,
  and validation scripts throughout the repo.

### Runtime Status

Partially operational. The repo clearly reduces the model reasoning burden by
encoding workflow structure. It has not yet consolidated enough runtime state to
make the model largely interchangeable.

### Alignment Score

7/10.

### Gaps

- Still depends heavily on agents interpreting documentation and choosing the
  right command.
- No single mandatory harness loop constrains arbitrary model behavior.

### Contradictions

The architecture is moving in the right direction, but overbroad docs and
commands can reintroduce model judgment load.

## Evidence Concept: Maintenance Agents Against Entropy

### Code Locations

- `src/commands/gardener*.ts`.
- `src/commands/drift-gate*.ts`.
- `docs-gate`, `docs:ubiquitous:guard`, and codestyle parity scripts.
- `.harness/ci-required-checks.json`.

### Runtime Status

Partial. There are maintenance commands and drift checks, but this audit did not
find evidence of autonomous recurring maintenance agents as a core runtime
pattern.

### Alignment Score

5/10.

### Gaps

- Maintenance is largely command/CI driven, not agent-fleet driven.
- Entropy checks are surface-specific rather than one generalized upkeep loop.

### Contradictions

No severe contradiction; this is a future opportunity.

## Evidence Concept: Dynamic Harness Generation

### Code Locations

- `src/commands/init.ts`.
- `src/commands/ci-migrate*.ts`.
- `src/commands/workflow-generate*.ts`.
- Generated scaffold tests in `src/commands/init.test.ts`.

### Runtime Status

Partial. The repo can generate/scaffold harness surfaces. It does not yet
dynamically tailor a harness from observed repo behavior and runtime traces in
the stronger evidence sense.

### Alignment Score

6/10.

### Gaps

- Dynamic generation appears config/scaffold-driven, not evidence-ingestion
  driven.
- No generator takes a trace history and emits tailored validators, skills, or
  recovery handlers.

### Contradictions

No severe contradiction.

# Critical Contradictions

## 1. High-Risk Policy Is Human-Mediated In Contract But Passing In Default Gate

Severity: High.

Evidence says high-risk autonomy must be mechanically constrained and
verification must beat claims. `harness.contract.json` agrees in prose:
`northStar.autonomyBoundary` says high-risk changes remain human-mediated.

Runtime path contradicts the claim:

- `harness.contract.json` maps `high` and `medium` to `warn`.
- `harness.contract.json` maps `warn` to `pass`.
- `src/commands/policy-gate.ts` returns success for no `--max-tier` path and
  sets `passed` from the policy-chain verdict.

Operational impact: a high-risk file can produce a passing policy gate if the
caller uses the default mode. That weakens review-gate and CI confidence when
operators assume "policy gate passed" means "risk is allowed under the safety
floor."

Probable root cause: policy-gate is serving both advisory classification and
blocking governance. Those two responsibilities were not split strongly enough.

Mitigation:

- Split `policy-gate classify` from `policy-gate enforce`, or make strict
  enforcement the default for CI/PR contexts.
- Require explicit approval evidence for high-risk pass verdicts.
- Make `warn` a non-passing verdict in required CI mode, or require
  `--max-tier` for all required policy-gate invocations.

## 2. Verification Runtime Is Split Between Shell Wrapper And TypeScript Orchestrator

Severity: High.

Evidence favors executable, typed, traceable runtime paths. The repo has
`src/lib/verify/orchestrator-core.ts`, `retry-policy.ts`, and run-state
primitives, but the public `harness verify-work` command delegates to
`scripts/verify-work.sh`.

Operational impact: the richest verification state machine is not obviously the
canonical runtime path. Agents and downstream repos are told to use the shell
wrapper, while architecture work is investing in a TypeScript orchestrator.
That creates two places for validation behavior, resume semantics, retries, and
gate identity to drift.

Probable root cause: portability and downstream scaffold compatibility required
a shell wrapper before the typed orchestration layer became mature.

Mitigation:

- Make the shell wrapper a thin adapter around the TypeScript orchestrator, or
  formally declare the shell wrapper as the runtime engine and retire/rename
  unused orchestration primitives.
- Add a parity test proving every verify-work gate in shell has a matching typed
  gate spec and run-state event.
- Record verify-work runs as `runtime-evidence-bundle/v1` by default.

## 3. Observability Is Claimed More Broadly Than It Is Implemented

Severity: High.

Evidence describes agent-owned observability: logs, metrics, traces, failure
states, and run history that agents can query. The current
`observability-gate` validates only JSON metric labels and cardinality.
Runtime-card and PR-closeout are stronger, but they are artifact snapshots, not
a full observability substrate.

Operational impact: agents can believe observability is covered because the
repo has a command with that name, while the actual runtime cannot answer
"what happened across this run?" without manual artifact assembly.

Probable root cause: label hygiene was implemented as an early, narrow slice
and inherited the broader observability name.

Mitigation:

- Rename the current command to `metric-label-gate` or expand
  `observability-gate` into a real trace-health gate.
- Define `harness-run-event/v1` and `harness-run-trace/v1`.
- Require runtime-card, verify-work, PR-closeout, and eval commands to append
  events to the same trace bundle.

## 4. Required-Check Manifest Collapses Many Logical Gates Into One GitHub Check

Severity: Medium-high.

`.harness/ci-required-checks.json` lists many required logical gates, but most
CircleCI-owned gates use `githubCheckName: "pr-pipeline"` and
`externalIdPattern: "^pr-pipeline$"`.

Operational impact: branch protection can prove that the aggregate pipeline
passed, but it cannot independently prove that each logical gate remained wired
unless the CircleCI workflow and manifest parity checks are also trusted and
fresh. That reduces traceability for required checks.

Probable root cause: CircleCI aggregation and GitHub branch protection naming
constraints.

Mitigation:

- Keep aggregate `pr-pipeline` if needed, but emit machine-readable per-gate
  artifacts and require `ci-check-name-parity` to prove each logical gate maps
  to a current CircleCI job.
- Add closeout output that shows logical-gate pass/fail inside the pipeline, not
  only aggregate check status.

## 5. Feedback Conversion Is Partly Enforced But Not Yet Unavoidable

Severity: Medium-high.

The evidence says repeated steering must become harness improvement. The repo
has `docs:steering:guard`, `check-steering-feedback-contract.cjs`, and the
current tree includes `pattern-scope/v1`. That is real progress. The missing
piece is a mandatory runtime edge that forces pattern-scope when steering
signals appear.

Operational impact: an agent can still comply locally with a correction and
skip the wider pattern inventory unless the workflow, PR template, or reviewer
catches it.

Probable root cause: the project is migrating from prose-heavy governance to
artifact-backed governance.

Mitigation:

- Have `harness next` or `pr-closeout` detect steering phrases and require a
  fresh `pattern-scope/v1` artifact.
- Teach `verify-work` to fail required mode when changed files plus admitted
  steering lack a pattern-scope artifact.

# Missing Systems

## Validation

- Strict default policy enforcement for high-risk changes.
- Unified claim-vs-trace verifier that checks whether stated validation
  actually ran and touched the relevant runtime path.
- Verify-work parity contract between shell gates and typed gate specs.
- Required pattern-scope artifact gate for detected steering/review signals.
- Validation ownership classification embedded in every gate failure, not only
  reviewer/closeout prose.

## Orchestration

- First-class `HarnessRun` or `AgentLoop` primitive.
- Standard step contract: context selected, command/tool invoked, evidence
  produced, verifier run, retry/recovery decision, memory decision.
- General recovery-handler registry.
- Canonical lifecycle runner from orientation to PR/Linear closeout.
- Multi-agent coordination protocol with artifact verification baked in.

## Governance

- Separate classify/advisory modes from enforce/blocking modes.
- Approval evidence object for high-risk work.
- Stronger reviewer disagreement protocol.
- Per-logical-gate CI traceability instead of aggregate-only GitHub check names.
- Drift guard proving every contract surface has a runtime consumer.

## Memory

- Automatic extraction from failed checks, review comments, CodeRabbit findings,
  and session corrections into candidate learnings.
- Mandatory discarded-run learning finalizer.
- Freshness checks for Project Brain entries used as execution inputs.
- A structured link from learning artifact to validator/test/doc update.

## Evals

- Continuous capture-the-flag eval cases from real failures.
- Eval result attachment to runtime-card or PR-closeout.
- Skill usefulness evals based on observed run outcomes, not only static
  estimates.
- Regression harness for "agent forgot rule" cases.

## Observability

- Unified event schema and trace bundle.
- Query command for recent runs, failures, retries, recoveries, and learning
  promotions.
- Dashboard/report generation from trace history.
- Observability health gate that checks event completeness, not only label
  cardinality.

## Runtime Safety

- High-risk approval proof as a required machine-readable artifact.
- Unified path/credential/side-effect boundary enforcement across all commands.
- Mandatory live external-state checks for final closeout when network and
  credentials are available.
- Safer distinction between advisory recommendations and executable authority.

## Recovery

- Recovery-handler slots by blocker class.
- Retry budget and attempt history in standard trace output.
- Rollback plan generation for high-risk changes.
- Escalation object when recovery cannot proceed safely.

## Context Engineering

- Runtime context compressor/source selector.
- Context budget metadata per command or workflow.
- Included/excluded source proof in runtime-card.
- Automatic stale-context warnings when docs and runtime contracts diverge.

# Architecture Drift Analysis

## Drift From Intended Architecture

The intended architecture is a compact agent operating system. The current
implementation is a broad governance and CLI toolkit with several strong
runtime artifacts. The drift is not fatal, but the center of gravity has moved
toward many gates and documents before consolidating the loop that should bind
them.

## Duplicated Systems

- Validation is represented by package scripts, shell wrappers, TypeScript
  commands, CircleCI jobs, required-check manifests, docs gates, and PR closeout.
  Those are all useful, but the runtime source of truth is not singular.
- Evidence appears as runtime-card, PR-closeout, evidence-verify, eval artifacts,
  review-context, validation-plan, and Project Brain entries. The artifact
  family lacks a shared event spine.
- Risk appears in `risk-tier`, `blast-radius`, `policy-gate`,
  `review-gate`, branch protection, CI required checks, and docs guidance.

## Abandoned Or Partially Migrated Patterns

- The TypeScript verification orchestrator looks like the future shape, while
  `scripts/verify-work.sh` remains the default shape.
- Observability has an early narrow implementation under a broad name.
- Pattern generalization is moving from docs/templates into `pattern-scope/v1`,
  but enforcement is not yet complete.

## Conflicting Abstractions

- `harness next` is advisory/read-only by design, while the evidence pushes
  toward a runtime loop that can own execution and recovery.
- Policy-gate is both classifier and gate, which blurs advisory output with
  blocking authority.
- CI required-check metadata treats many gates as separate logical policies,
  while GitHub check identity treats most as one aggregate `pr-pipeline`.

## Over-Centralisation

- `src/lib/cli/registry/command-specs-core.ts` is a large central registry for
  many command families.
- Command capability metadata is also centrally mapped by name. This makes the
  catalog easy to emit, but harder to keep locally owned by command modules.
- Large command/test files increase review burden and make architecture drift
  easier to hide.

# Runtime Risk Assessment

## Brittle Execution Paths

- Shell wrappers remain critical. If shell behavior, environment setup, PATH, or
  downstream scaffold assumptions drift, TypeScript-level contracts may still
  pass locally.
- Live GitHub/Linear state collection is optional and tool-dependent.
- Required-check proof can collapse to aggregate `pr-pipeline` state.

## Unsafe Defaults

- Policy-gate default behavior can pass high-risk changes.
- Advisory outputs can look like gate outputs unless mode and verdict are read
  carefully.
- Some external-service failures become blocker objects, but final workflows
  still need operators to decide whether that is acceptable.

## Hidden Failure Modes

- A gate can exist in docs and command registry without being invoked by the
  canonical workflow.
- Evidence artifacts can prove file presence without proving behavioral
  adequacy.
- Pattern-scope can produce a sibling inventory without proving the inventory
  changed implementation behavior.

## Coupling Risks

- `harness.contract.json`, docs, package scripts, CI config, required-check
  manifest, command registry, and generated scaffolds all need synchronization.
- Command metadata is manually keyed by command name, so renames and aliases can
  drift.

## Silent Failure Zones

- Optional live state checks can be skipped without making the artifact visibly
  incomplete unless consumers inspect source metadata.
- Observability can appear covered by a passing label-cardinality check while no
  actual run trace exists.
- High-risk policy warnings can pass required flows if not elevated elsewhere.

## Hallucination Amplification Risks

- Rich docs plus broad command catalog can invite agents to claim systems are
  operational because the terms exist.
- Architecture diagrams/status docs can outpace runtime wiring.
- Advisory cockpit decisions can be mistaken for completed actions.

## Missing Proof Chains

- No mandatory chain from user steering -> pattern-scope -> sibling changes or
  explicit unchanged reasons -> validator.
- No mandatory chain from failed validation -> classified failure -> recovery
  handler -> retry or escalation -> learning candidate.
- No mandatory chain from PR closeout -> live PR state -> Linear state -> branch
  state -> validation state -> memory decision.

# High-Leverage Improvements

| Rank | Improvement | Impact | Difficulty | Leverage | Risk Reduction |
|---:|---|---:|---:|---:|---:|
| 1 | Make policy-gate strict by default in required/CI mode and require approval evidence for high-risk passes. | High | Medium | High | High |
| 2 | Consolidate verify-work around one engine: shell as adapter to TypeScript orchestrator, or TypeScript as documented future and shell as explicit current runtime. | High | High | High | High |
| 3 | Introduce `harness-run-event/v1` and `harness-run-trace/v1`; make runtime-card, verify-work, PR-closeout, evals, and memory commands append to it. | High | High | Very high | High |
| 4 | Require `pattern-scope/v1` when steering/review signals are detected and fail closeout when the artifact is missing/stale. | High | Medium | High | High |
| 5 | Split advisory classifiers from enforcing gates across policy, blast-radius, observability, and next-action surfaces. | High | Medium | High | Medium |
| 6 | Upgrade observability from label hygiene to trace completeness: rename current narrow command or expand it. | Medium-high | Medium | High | Medium-high |
| 7 | Add CI logical-gate evidence artifacts so aggregate `pr-pipeline` can prove each required gate ran. | Medium-high | Medium | Medium | Medium-high |
| 8 | Add recovery-handler registry keyed by blocker class and connect it to verify-work/pr-closeout. | Medium-high | High | High | Medium-high |
| 9 | Move command capability metadata closer to command modules or generate it from command specs. | Medium | Medium | Medium | Medium |
| 10 | Add context-budget/source-selection metadata to runtime-card and `harness next`. | Medium | Medium | Medium | Medium |

# Final Assessment

What is genuinely strong:

- The repo has a clear north-star and actually encodes much of it in scripts,
  commands, contracts, CI metadata, and tests.
- `harness next`, runtime-card, PR-closeout, docs-gate, evidence-verify,
  Project Brain, and the command capability catalog are real agent-operating
  surfaces.
- Deterministic verification is a real project value, not just a slogan.
- The current branch's `pattern-scope/v1` work is the right architectural
  direction for converting steering into a concrete artifact.

What is overclaimed:

- "Runtime harness around the agent loop" is not fully true yet. The repo has
  many loop ingredients, but not one loop.
- "Agent-owned observability" is not fully true yet. The current named gate is
  label hygiene, and artifacts are distributed.
- "High-risk human mediation" is weaker than claimed while policy-gate defaults
  allow warning-as-pass behavior.

What is missing:

- A unified run trace.
- A strict policy enforcement mode as the default required path.
- A canonical verification engine with no shell/TypeScript split.
- Mandatory failure-to-learning and steering-to-pattern-scope edges.
- A real observability substrate.
- General recovery handlers.

What should be removed or renamed:

- Do not keep broad names on narrow gates. If `observability-gate` remains
  label-only, rename it or make the broader command fail when no trace evidence
  exists.
- Avoid adding more documents that describe runtime loops until the loop exists
  as an executable primitive.

What should be hardened:

- `policy-gate` default semantics.
- Verify-work parity and trace output.
- Required-check logical gate proof.
- Pattern-scope enforcement.
- Live-state closeout behavior.

What should become canonical:

- `harness next` should remain the first-contact cockpit.
- Runtime-card should become the compact current-state artifact for every
  meaningful run.
- PR-closeout should become the lifecycle completion proof, but only when it
  includes live PR/check/branch/Linear state or an explicit blocker.
- `pattern-scope/v1` should become the standard steering/review generalization
  artifact.
- A new run-trace contract should become the spine that connects validation,
  observability, evals, closeout, and learning.

What creates long-term scaling risk:

- Governance surface area growing faster than executable consolidation.
- Multiple validators checking adjacent truths without a shared trace.
- Advisory commands presenting like enforcement commands.
- CI aggregation hiding logical-gate identity.
- Broad command catalogs that require agent judgment rather than reducing it.

What creates hidden operational debt:

- Shell wrapper and TypeScript orchestrator drift.
- High-risk policy warnings passing as successful required gates.
- Observability language outpacing actual traceability.
- Memory and feedback loops relying on operator discipline.
- Dynamic harness generation not yet driven by observed runtime evidence.

Bottom line: Coding Harness is already more mature than a documentation-heavy
agent prompt system. It has the bones of a real agent operating system. The
next architectural step is not more surface area; it is consolidation. Make the
runtime loop, trace spine, policy enforcement, and learning edge unavoidable,
then the evidence document's strongest claims become runtime truth rather than
aspirational architecture.
