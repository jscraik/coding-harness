# Executive Summary

This audit compares the current Coding Harness repository against
`.harness/research/deep/2026-05-18-coding-harness-evidence.md` and refreshes
the prior audit in
`.harness/research/audits/2026-05-18-architecture-alignment-audit.md`. The
evidence describes an agent operating system: compact context, deterministic
guardrails, durable memory, runtime traceability, bounded recovery, explicit
authority boundaries, and continuous conversion of failures into reusable
harness behavior.

The codebase is materially stronger than a prompt pack. It has executable CLI
gates, a command capability catalog, north-star and branch-protection contracts,
Project Brain scaffolding, local-memory preflight, docs-gate and steering
guards, CI required-check manifests, runtime-card evidence surfaces,
PR-closeout claims, phase-exit gate contracts, and a broad validation script
surface. The strongest parts of the architecture are the movement from prose to
machine-readable contracts and the recent closeout-truth work that turns PR
readiness into claim-level evidence with freshness, head SHA, blocker class, and
missing-context routing.

The codebase still falls short of the evidence document's strongest runtime
claim. The evidence implies a canonical harness loop around the agent:
orientation -> context selection -> command/tool authority -> execution ->
verification -> trace -> recovery -> learning. The repository contains many of
those pieces, but they are spread across TypeScript commands, shell wrappers,
CircleCI jobs, JSON artifacts, PR templates, docs, and optional live probes. In
practice, Coding Harness is currently a strong governance and validation
control plane, not yet a fully unified runtime harness.

The highest-risk contradiction remains policy enforcement. The contract says
high-risk changes remain human-mediated, but the default policy chain maps high
and medium risk to `warn`, and `warn` maps to `pass`
(`harness.contract.json:13`, `harness.contract.json:140`). The CircleCI
risk-policy job compensates by passing `--max-tier medium`
(`.circleci/config.yml:307`), but the reusable `policy-gate` command's
default behavior can still pass high-risk warnings when callers omit the max
tier. That is a runtime truth contradiction, not just wording drift.

The second major contradiction is verification architecture split. The public
`harness verify-work` command delegates to `bash scripts/verify-work.sh`
(`src/commands/verify-work.ts:27`), while a typed TypeScript verification
orchestrator with gate state, execution classes, run-state persistence, and
retry policy exists separately (`src/lib/verify/orchestrator-core.ts:15`,
`src/lib/verify/run-state-core.ts:16`, `src/lib/verify/retry-policy.ts:27`).
The shell path is functional and heavily governed, but it means the most
important verification route is not yet the typed runtime model implied by the
evidence.

The third major gap is observability. Runtime-card and PR-closeout are useful
snapshot artifacts, and run-state exists for verification, but the
`observability-gate` only validates metric label cardinality
(`src/commands/observability-gate.ts:18`). There is no single queryable trace
history that joins agent decisions, tool calls, validation outcomes, PR state,
review findings, recovery attempts, and memory promotion. Traceability is good
at artifact boundaries and weak as a runtime substrate.

Architectural drift level: medium. The project has a coherent north star and
many real executable surfaces, but it has accumulated overlapping gate families,
shell and TypeScript verification paths, several memory models, broad command
registries, and CI aggregation patterns before consolidating one canonical
agent-loop runtime. Operational readiness is good for disciplined local and PR
workflows; it is not yet strong enough to treat all claimed harness behavior as
automatic, enforced, or continuously observable.

# Table of Contents

- [Executive Summary](#executive-summary)
- [Overall Gradecard](#overall-gradecard)
- [Evidence-to-Code Mapping](#evidence-to-code-mapping)
- [Critical Contradictions](#critical-contradictions)
- [Missing Systems](#missing-systems)
- [Architecture Drift Analysis](#architecture-drift-analysis)
- [Runtime Risk Assessment](#runtime-risk-assessment)
- [High-Leverage Improvements](#high-leverage-improvements)
- [Final Assessment](#final-assessment)

# Overall Gradecard

| Area | Grade | Confidence | Notes |
|---|---:|---:|---|
| Harness Engineering | B | High | Real control-plane surfaces exist: command catalog, docs gate, closeout gates, runtime-card, PR closeout, Project Brain, CI gates, and validation wrappers. The canonical agent-loop runtime is still distributed rather than unified. |
| Architecture Cohesion | C+ | High | The north-star contract is coherent, but implementation is split across shell, TypeScript, CI YAML, JSON contracts, docs, and optional artifacts. |
| Runtime Safety | B- | High | Path containment, closeout blockers, branch-protection contracts, and evidence freshness are strong. Policy-gate defaults and optional live evidence weaken runtime safety. |
| Validation Depth | B | High | `pnpm check`, `verify-work`, codestyle, docs gates, steering guard, tests, and CI are substantial. The typed verification orchestrator is not the default public path. |
| Governance | B- | High | Governance is real and broad. The main weaknesses are policy-chain pass-on-warn defaults, many logical gates collapsing to one required PR context, and optional closeout inputs. |
| Evals | C | Medium | Eval artifacts and observed-skill usage exist, but continuous capture-the-flag style eval loops are not central to the runtime. |
| Observability | C- | High | Runtime-card, PR-closeout, and verify run-state help. Agent-owned operational telemetry and a queryable trace history are missing. |
| Modularity | C+ | High | Many commands are separated, but `command-specs-core.ts` and command capability maps are broad coordination hubs with string-name coupling. |
| Recovery Systems | C | Medium | Retry policy exists for read-only transient verification. General recovery handlers, rollback orchestration, and resumable multi-stage workflows are partial. |
| Context Engineering | B- | Medium | Instruction layering, Project Brain, command catalog, and active artifacts are strong. Runtime context selection and compression are mostly procedural, not harness-owned. |
| Memory Systems | B- | High | Project Brain, LEARNINGS, local-memory preflight, memory gate, and steering guard exist. The repo has parallel memory contracts and incomplete automatic distillation. |
| Agent Coordination | C+ | Medium | `harness next`, runtime-card, Linear gate, PR closeout, and phase-exit help coordination. Multi-agent work remains artifact/procedure driven. |
| CI/CD Enforcement | B- | High | CircleCI primary lane, Semgrep, CodeRabbit, and required-check manifests are strong. Logical gate proof is compressed into `pr-pipeline` in branch protection. |
| Determinism | B- | High | Many validators are deterministic. Several important paths depend on optional live credentials, external CLIs, or caller-provided artifacts. |
| Traceability | B- | High | PR closeout claim evidence and runtime-card are strong. There is no single trace graph joining execution, validation, review, recovery, and learning. |

# Evidence-to-Code Mapping

## Environment As Product Surface

### Code Locations

- `scripts/codex-preflight.sh:59` defines Project Brain and local-memory
  preflight paths.
- `scripts/verify-work.sh:43` exposes the canonical verification runner.
- `package.json` defines `check`, `test:deep`, codestyle, docs, eval, and
  security scripts.
- `src/templates/codex-preflight.sh:60` and downstream templates export the
  same environment contract.
- `harness.contract.json:9` records north-star and safety-floor policy.

### Runtime Status

Operational, with caveats. The environment is executable and distributed to
downstream projects. Preflight and verify-work are real scripts, and CircleCI
runs the same command families. The caveat is that environment behavior is
spread across multiple authority surfaces rather than one typed runtime engine.

### Alignment Score

8/10.

### Gaps

- Shell wrappers and TypeScript command surfaces both claim canonical roles.
- Local runtime readiness depends on installed CLIs and credential state.
- The environment is productized, but not fully self-describing from one
  machine-readable contract.

### Contradictions

No severe contradiction. This is one of the strongest alignment areas.

## Human Attention Budgeting

### Code Locations

- `src/commands/next.ts:42` implements the first-contact recommendation command.
- `src/lib/runtime/local-runtime-card.ts:30` models runtime-card state.
- `src/lib/pr-closeout.ts:29` models PR closeout input and report generation.
- `src/lib/pr-closeout/claims.ts:44` defines closeout claim evidence.
- `AGENTS.md:9` describes the thin-surface, strong-guardrails mission.

### Runtime Status

Partially operational. `harness next`, runtime-card, and PR-closeout reduce
manual interpretation. The branch now has stronger closeout truth: claim status,
freshness, head SHA, source, blocker class, and verified-at metadata. But
operators must still know when to provide `--phase-exit`, `--runtime-card`,
`--gates`, `--live`, or closeout artifacts.

### Alignment Score

7/10.

### Gaps

- No one command proves every closeout horizon by default: PR, branch, Linear,
  review threads, CI freshness, validation, dirty worktree, memory, and next lane.
- `harness next` can block on provided phase-exit/runtime-card data, but it does
  not collect all horizons itself.

### Contradictions

The system says it removes manual glue, yet several readiness proofs remain
manual artifact plumbing.

## Repository As Agent Operating System

### Code Locations

- `src/lib/cli/registry/command-capabilities.ts:72` defines capability metadata.
- `src/lib/cli/registry/command-specs-core.ts:114` builds the central command
  registry.
- `.harness/README.md:49` maps durable Project Brain and memory surfaces.
- `src/commands/brain-core.ts` implements Project Brain command behavior.
- `harness.contract.json:47` declares product surfaces and owned paths.

### Runtime Status

Partially operational. The repository is an agent operating surface: it
contains instructions, memory, contracts, command metadata, gates, and bootstrap
scripts. It is not yet a single operating system kernel. The operating model is
a federation of commands and artifacts.

### Alignment Score

7/10.

### Gaps

- No global lifecycle coordinator owns orientation through learning closeout.
- Command authority is split between registry specs, capability maps, docs, and
  script wrappers.
- Product surface ownership is declared, but not all owned paths are proven by
  runtime reachability checks.

### Contradictions

The operating-system metaphor is overclaimed when applied to runtime execution.
It is accurate for repository structure and weaker for end-to-end control flow.

## Static Context Plus Dynamic Evidence

### Code Locations

- `src/commands/runtime-card.ts:158` supports live and artifact-backed runtime
  evidence.
- `src/lib/runtime/local-runtime-card.ts:245` includes live PR provider data.
- `src/lib/runtime/runtime-evidence-producer.ts:15` emits
  `runtime-evidence-bundle/v1`.
- `src/lib/runtime/runtime-evidence-adapter.ts:13` adapts evidence bundles into
  runtime-card snapshots.
- `src/commands/evidence-verify.ts:18` validates evidence files and policies.

### Runtime Status

Partially operational. Static and dynamic evidence coexist, and runtime-card is
a real bridge from local state to live PR/Linear signals. The runtime-evidence
bundle is a good architectural direction. The remaining weakness is that dynamic
collection is optional and not universally required by closeout.

### Alignment Score

7/10.

### Gaps

- No mandatory evidence ingestion pipeline for every run.
- Evidence-verify confirms file/policy properties more than semantic claim truth.
- Runtime-card and PR-closeout are snapshots, not a shared append-only trace.

### Contradictions

The evidence says runtime truth beats claims. The code supports that principle
only where callers opt into current live evidence or provide fresh artifacts.

## Mechanical Architecture Enforcement

### Code Locations

- `src/commands/docs-gate-core.ts:100` defines machine-readable docs-gate
  reports.
- `scripts/check-steering-feedback-contract.cjs:12` ties steering feedback to
  `.harness/memory/LEARNINGS.md`.
- `src/commands/pattern-scope.ts:54` defines the pattern-scope artifact schema.
- `src/lib/decision/he-phase-exit-core.ts:15` defines phase-exit and closeout
  gate schema versions.
- `src/lib/pr-closeout/blockers.ts:193` blocks missing closeout-gate evidence.

### Runtime Status

Partially operational to operational. Several architecture rules are now
enforced mechanically. The closeout-gates contract is especially strong because
the phase-exit model names canonical gates and PR closeout can block on missing
closeout-gate evidence. Pattern-scope is implemented and useful, but it is not
yet mandatory in all steering-triggered flows.

### Alignment Score

7/10.

### Gaps

- Pattern-scope is a command, not a globally enforced pre-closeout invariant.
- Docs-gate focuses on synchronized documentation and policy surfaces; it does
  not prove runtime architecture cohesion by itself.
- Closeout gates depend on artifact availability and correct operator routing.

### Contradictions

The repo states repeated steering must become operating-system behavior, but the
runtime cannot yet prove every high-signal correction triggered pattern-scope and
memory promotion unless the operator supplies those artifacts.

## Runtime Harness Around The Agent Loop

### Code Locations

- `src/commands/next.ts:145` reads local git status and selects decision paths.
- `src/commands/next-decisions.ts:116` builds changed-file decisions.
- `src/lib/verify/orchestrator-core.ts:15` defines a typed verification
  orchestrator.
- `src/lib/verify/run-state-core.ts:16` defines resumable verification state.
- `src/lib/verify/retry-policy.ts:51` retries only transient read-only failures.
- `scripts/verify-work.sh:856` implements shell retry messages for transient
  gate failures.

### Runtime Status

Partial. The pieces exist, but the canonical runtime loop is not unified.
`harness next` is a read-only cockpit, `verify-work` is shell-led, closeout is
artifact-led, and recovery is mostly gate-specific.

### Alignment Score

5/10.

### Gaps

- No unified execution graph owns tool selection, step history, verification,
  retry, recovery, and learning.
- The TypeScript orchestrator is not the default public verify-work route.
- Recovery handlers are limited to transient retry and manual next actions.

### Contradictions

The evidence implies a harness around the agent loop. The repository implements
a harness around many command and PR boundaries, but not yet around the whole
agent loop.

## Tool Registry As Authority Boundary

### Code Locations

- `src/lib/cli/registry/command-capabilities.ts:72` models command category,
  mutability, retryability, tier, audience, orchestrators, agent mode, and
  visibility.
- `src/lib/cli/registry/command-capabilities.ts:176` marks write commands.
- `src/lib/cli/registry/command-capabilities.ts:385` defines expected
  artifacts for several commands.
- `src/lib/cli/registry/command-specs-core.ts:1` imports many command runners
  into one central registry.

### Runtime Status

Partially operational. The command catalog is a strong authority surface and is
machine-readable. The risk is hidden coupling: command metadata is maintained in
parallel maps keyed by command names, while the large registry imports and
dispatches broad behavior.

### Alignment Score

7/10.

### Gaps

- Capability metadata is not co-located with every command implementation.
- Registry and capability maps can drift unless every command addition is
  validated by parity tests.
- Some commands contain substantial inline parsing and routing logic inside the
  registry layer.

### Contradictions

The tool registry is intended to narrow authority. The implementation narrows
metadata, but centralization creates a new authority hotspot.

## Trace History As Truth Surface

### Code Locations

- `src/lib/pr-closeout/claims.ts:92` models source, head SHA, freshness, blocker
  class, and missing context for claims.
- `src/lib/pr-closeout/evidence.ts` maps check and PR evidence.
- `src/lib/runtime/runtime-evidence-producer.ts:15` creates evidence bundles.
- `src/lib/verify/run-state-core.ts:45` models verify run metadata and gate
  results.
- `docs/goals/coding-harness-closeout-truth/receipts.jsonl` records phase
  receipts for the closeout-truth lane.

### Runtime Status

Partially operational. Trace evidence exists as artifacts and JSON reports.
There is no single append-only operational history for all agent actions and
decisions.

### Alignment Score

6/10.

### Gaps

- No queryable trace graph links commands, PR state, validation, review threads,
  skill gates, recovery, and memory promotion.
- Evidence is scattered across artifacts, PR bodies, run directories, docs, and
  local memory.
- The trace model is stronger for closeout than for ordinary command execution.

### Contradictions

The project treats trace history as important, but trace is not yet the primary
runtime substrate.

## Deterministic Verification Over Model Claims

### Code Locations

- `scripts/verify-work.sh:43` is the canonical verification runner.
- `package.json` wires `pnpm check`, `test:related`, `test:deep`, codestyle,
  docs, steering, and workflow validation.
- `src/lib/pr-closeout/blockers.ts:208` blocks missing or failing closeout gates.
- `src/lib/pr-closeout/claims.ts:218` requires current required checks for
  passing check claims.
- `src/commands/evidence-verify.ts:67` enforces evidence file existence and size.

### Runtime Status

Operational, but uneven. The repo strongly prefers command evidence, and
closeout truth is improving. The remaining weakness is that not all claims are
validated by semantic runtime execution; some are validated by artifact
presence, freshness, and operator-supplied data.

### Alignment Score

8/10.

### Gaps

- Semantic verification of evidence claims is incomplete.
- Required commands can be skipped or marked blocked by human handoff unless a
  closeout surface demands them.
- The public verification command shells out instead of using the typed
  orchestrator.

### Contradictions

The principle is mostly honored. The contradiction is structural rather than
philosophical: proof exists, but proof chains are not uniformly captured in one
runtime.

## Failure-Driven Decomposition And Feedback Conversion

### Code Locations

- `scripts/check-steering-feedback-contract.cjs:909` validates memory learnings.
- `src/commands/pattern-scope.ts:107` detects steering and pattern-scope
  triggers.
- `src/lib/missing-context/classifier.ts` classifies missing context for durable
  destinations.
- `src/lib/pr-closeout/claims.ts:44` carries missing-context metadata into
  closeout claims.
- `.harness/memory/LEARNINGS.md:30` records the PR closeout steering lesson.

### Runtime Status

Partially operational. The branch has clear improvement here: missing context is
typed, PR closeout carries durable destinations, and steering guard checks
learning surfaces. The gap is that failure-to-pattern conversion is not yet
inescapable across all commands and sessions.

### Alignment Score

7/10.

### Gaps

- No automatic trigger from a repeated failed command to research, fixture
  generation, Project Brain update, and gate reinforcement.
- Pattern-scope and memory updates can be skipped outside documented closeout
  discipline.
- The system detects some steering contract drift but not every repeated
  operational failure.

### Contradictions

The architecture says repeated steering is stop-the-line. Runtime enforcement is
strongest in docs and PR closeout; ordinary command retries can still continue
without a forced durable learning path.

## Agent-Owned Observability

### Code Locations

- `src/commands/observability-gate.ts:18` validates observability metric labels.
- `src/lib/runtime/local-runtime-card.ts:127` collects local runtime state.
- `src/lib/pr-closeout.ts:260` derives blockers and next actions.
- `src/lib/evals/observed-skill-usage.ts:99` records observed skill usage input.

### Runtime Status

Mostly partial. The observability gate validates hygiene around metric labels,
not agent-owned observability. Runtime-card and PR-closeout give snapshots, but
they do not form a live telemetry system.

### Alignment Score

4/10.

### Gaps

- No first-class event stream for agent decisions, command calls, tool failures,
  retries, and closeout outcomes.
- No dashboard or query layer for operational drift.
- No automatic observability feedback into evals and Project Brain.

### Contradictions

The evidence calls for trace history and agent-owned observability. The
implementation mostly has artifacts and label validation. Calling that full
observability would be architecture theatre.

## Full Delivery Lifecycle Delegation

### Code Locations

- `src/lib/pr-closeout.ts:29` models PR closeout input.
- `src/lib/pr-closeout/blockers.ts:31` derives closeout blockers.
- `src/lib/pr-closeout/claims.ts:44` models claim-level readiness.
- `src/commands/pr-closeout.ts:52` supports live PR input and closeout gates.
- `src/lib/decision/he-phase-exit-core.ts:21` defines closeout-gate schema.

### Runtime Status

Partially operational, improved since the 2026-05-18 audit. PR closeout now has
realer truth mechanics: required claims, evidence status, freshness, head SHA,
and blockers. But the lifecycle is not fully delegated because live PR, Linear,
review-thread, automation, and validation horizons still depend on supplied
artifacts or external credentials.

### Alignment Score

7/10.

### Gaps

- No default end-to-end command collects all closeout evidence, validates it,
  updates PR/Linear, and records memory in one bounded operation.
- Live checks are available but not universal.
- Independent review remains a required external/human surface, correctly, but
  agent workflows need clearer machine-readable waiting states.

### Contradictions

The code has strong closeout reporting. It does not yet make green checks,
review resolution, Linear state, branch state, memory state, and next-lane state
a single guaranteed runtime proof.

## Harness-Owned Recovery

### Code Locations

- `src/lib/verify/retry-policy.ts:51` limits retry to transient read-only
  failures.
- `scripts/verify-work.sh:247` supports resume hints and prior run matching.
- `scripts/verify-work.sh:856` retries transient gate failures.
- `harness.contract.json:172` defines pilot rollback policy.
- `src/lib/pr-closeout/blockers.ts:31` classifies closeout blockers.

### Runtime Status

Partial. There is retry and resume behavior, but no general recovery subsystem.
Rollback policy exists in contract. Recovery is mainly encoded as next-action
text, blocker classes, or gate-specific retry.

### Alignment Score

5/10.

### Gaps

- No reusable recovery-handler registry.
- No automatic rollback plan execution.
- No durable recovery trace across retries, reruns, and follow-up work.
- No cross-command failure classifier that consistently routes to research,
  fix, retry, defer, or human review.

### Contradictions

The evidence describes harness-owned recovery. The codebase has recovery
scaffolding and pockets, not a systemic recovery layer.

## Dynamic Harness Generation

### Code Locations

- `src/commands/init.ts` and templates generate downstream harness scaffolding.
- `scripts/test-harness-upgrade-matrix.mjs:20` validates generated workflow
  surfaces.
- `src/presets/*.json` define language-specific generated contracts.
- `src/templates/pr-pipeline.yml:524` includes generated memory validation.

### Runtime Status

Partially operational. The repo can generate downstream harness pieces and tests
some generated surfaces. The stronger evidence idea is dynamic harness
generation from observed work, repo shape, and current failure modes. That is
only partially implemented.

### Alignment Score

6/10.

### Gaps

- Presets are mostly static.
- There is no automatic repo-profile-to-harness-generation loop based on live
  trace outcomes.
- Generated harnesses can inherit parallel memory and validation drift unless
  contracts are normalized.

### Contradictions

The project distributes harness scaffolds, but dynamic generation is still more
template-driven than evidence-driven.

# Critical Contradictions

## 1. High-Risk Human Mediation Is Weakened By Pass-On-Warn Defaults

Severity: High.

Evidence: The north-star contract says high-risk changes remain
human-mediated (`harness.contract.json:13`). The policy chain maps high and
medium to `warn`, and `warn` to `pass`
(`harness.contract.json:140`). `policy-gate` loads this contract and returns a
passing verdict when no stricter max tier is provided
(`src/commands/policy-gate.ts:66`, `src/commands/policy-gate.ts:103`). CircleCI
does run `policy-gate --max-tier medium` (`.circleci/config.yml:307`), which
blocks high-risk PR paths in that lane, but the reusable command's default
runtime behavior is weaker than the stated safety floor.

Operational impact: A downstream repo or local operator can call policy-gate
without max-tier and receive a pass for high-risk warnings. That creates false
confidence and makes the contract depend on caller discipline.

Probable root cause: The contract supports advisory warning mode while the
north-star wording now describes a stricter autonomy boundary.

Mitigation: Make high-risk default to block or human-review-required in the
contract, or require `--max-tier` in non-advisory policy-gate modes. Add a test
that high-risk changes cannot pass without an explicit tracked override or
human-mediated artifact.

## 2. Verification Has Two Architectures

Severity: High.

Evidence: `harness verify-work` delegates to `bash scripts/verify-work.sh`
(`src/commands/verify-work.ts:27`). The shell runner contains the real
canonical lane, including required-check normalization, gate ordering, retry,
resume, and final JSON status (`scripts/verify-work.sh:141`,
`scripts/verify-work.sh:856`, `scripts/verify-work.sh:1250`). Separately,
TypeScript verification primitives define schema versions, run state, execution
classes, gate results, idempotency keys, and retry decisions
(`src/lib/verify/run-state-core.ts:16`, `src/lib/verify/retry-policy.ts:27`,
`src/lib/verify/orchestrator-core.ts:15`).

Operational impact: Fixes and features can land in one verification system
without affecting the other. Agents looking for the runtime truth must inspect
both shell and TS paths.

Probable root cause: The shell runner became the portable production contract
before the typed orchestrator became the default implementation.

Mitigation: Choose one canonical verification engine. Prefer moving shell gate
steps behind typed gate specs and using shell as a thin compatibility launcher.
Until then, add parity tests that prove public `verify-work` behavior and TS
orchestrator semantics cannot diverge.

## 3. Observability Is Mostly Artifact Snapshots, Not Agent-Owned Telemetry

Severity: High.

Evidence: `observability-gate` validates metric label shape and cardinality
(`src/commands/observability-gate.ts:18`, `src/commands/observability-gate.ts:56`).
Runtime-card and PR-closeout generate useful snapshots, but no code path
observed here writes a unified event stream for agent actions, command runs,
review findings, retry decisions, recovery actions, and memory promotion.

Operational impact: The system can report local truth at checkpoints, but cannot
easily answer longitudinal questions such as "which failures recur", "which
gates are skipped", "which skills produce rework", or "which recovery path
worked last time" without manual artifact archaeology.

Probable root cause: Reporting artifacts were built before an event model.

Mitigation: Introduce an append-only `harness-trace/v1` event model and route
runtime-card, verify-work, PR-closeout, evals, pattern-scope, and memory
promotion through it. Keep current artifacts as views over the trace.

## 4. CI Gate Identity Compresses Many Logical Gates Into One Required Context

Severity: Medium-High.

Evidence: `.circleci/config.yml` runs many named jobs in the `pr-pipeline`
workflow: pr-template, linear-gate, risk-policy-gate, dependency-scan,
docs-gate, lint, typecheck, test, audit, check, memory, drift-health
(`.circleci/config.yml:213`, `.circleci/config.yml:307`,
`.circleci/config.yml:402`, `.circleci/config.yml:453`). The required-check
manifest maps these logical checks to the same GitHub required context
`pr-pipeline` (`.harness/ci-required-checks.json:10`,
`.harness/ci-required-checks.json:72`, `.harness/ci-required-checks.json:139`).
Branch protection requires `pr-pipeline`, `security-scan`, `CodeRabbit`, and
`semgrep-cloud-platform/scan` (`harness.contract.json:189`).

Operational impact: GitHub branch protection can confirm the aggregate context,
but local closeout and required-check parity need additional proof to know which
logical gates ran, failed, or were skipped.

Probable root cause: CircleCI workflow-level contexts were chosen to preserve
stable branch protection names while internal jobs expanded.

Mitigation: Keep `pr-pipeline` as the external context if needed, but emit and
require a machine-readable per-job gate manifest artifact during closeout. Make
PR closeout fail when the aggregate context is green but the internal gate
manifest is absent or stale.

## 5. Memory Architecture Is Split Across Project Brain, Local Memory, And Legacy Memory Gate

Severity: Medium-High.

Evidence: Root instructions and Project Brain point at `.harness/memory/LEARNINGS.md`,
`.harness/knowledge/**`, `.harness/decisions`, and `.harness/review-log.md`
(`AGENTS.md:205`, `.harness/README.md:49`). Preflight requires Project Brain
paths (`scripts/codex-preflight.sh:62`). But `memory-gate` validates a
`memory.json` workflow and FORJAMIE closeout discipline
(`src/lib/memory/validator.ts:34`, `src/commands/doctor-file-checks.ts:54`).
CircleCI still runs `memory-gate` (`.circleci/config.yml:453`).

Operational impact: Agents can pass or fail different "memory" systems without
clarity on which one is canonical for durable learning. This creates risk of
learning being recorded in the wrong surface or not promoted from runtime
evidence.

Probable root cause: Legacy memory-gate behavior predates Project Brain and was
not fully collapsed into the newer memory architecture.

Mitigation: Define one memory authority contract. Either migrate memory-gate to
Project Brain/LEARNINGS or rename it as a legacy compatibility gate and make
Project Brain preflight the required memory gate for current repos.

## 6. Command Registry Narrows Authority But Centralizes Coupling

Severity: Medium.

Evidence: The command capability catalog is rich, but it is keyed by string
names in central maps (`src/lib/cli/registry/command-capabilities.ts:72`,
`src/lib/cli/registry/command-capabilities.ts:176`). The core command registry
imports broad command behavior and contains dispatch/parsing responsibilities
(`src/lib/cli/registry/command-specs-core.ts:1`,
`src/lib/cli/registry/command-specs-core.ts:114`).

Operational impact: A command can drift across implementation, registry, and
capability metadata. The registry becomes a bottleneck and a hidden coupling
zone.

Probable root cause: CLI slim-shell refactors centralized command registration
before command-owned metadata modules were introduced.

Mitigation: Move capability metadata beside command implementations and generate
the central registry. Keep tests that fail when command spec, capability, help,
artifact expectations, and docs disagree.

## 7. Pattern-Scope Exists But Is Not Yet A Universal Steering Enforcement Point

Severity: Medium.

Evidence: `pattern-scope` detects line-level corrections, broad principle
language, sibling patterns, and repeated steering triggers
(`src/commands/pattern-scope.ts:107`). It writes a constrained artifact
(`src/commands/pattern-scope.ts:291`). But closeout and verify-work do not
universally require a current pattern-scope artifact for steering-triggered
work.

Operational impact: The tool can support pattern generalization, but the system
cannot prove it ran whenever a high-signal correction occurred.

Probable root cause: Pattern-scope was added as a command before being wired
into PR closeout, steering guard, and phase-exit as a required conditional gate.

Mitigation: Add a conditional closeout claim: if PR body, commits, session note,
or changed docs admit repeated steering/design correction, require a
pattern-scope artifact and memory destination.

# Missing Systems

## Validation

- Semantic evidence validation: artifact presence is validated more reliably
  than claim truth.
- A single typed verification engine behind `verify-work`.
- Required pattern-scope validation for steering-triggered work.
- High-risk override validation with tracked human acknowledgement as the
  default policy path.

## Orchestration

- A canonical agent-loop coordinator that owns orientation, tool authority,
  execution, verification, trace, recovery, and memory.
- A generated command registry that eliminates manual string-map drift.
- First-class workflow composition primitives beyond shell job ordering and
  command-specific logic.

## Governance

- One authoritative risk policy where high-risk mediation is mechanical by
  default.
- Per-logical-gate CI proof for all jobs hidden behind `pr-pipeline`.
- A product-surface reachability validator that proves declared owned paths are
  executed or intentionally documentation-only.

## Memory

- One canonical memory contract connecting Project Brain, LEARNINGS, local
  memory, and legacy memory-gate.
- Automatic failure-to-learning promotion from repeated command failures, review
  findings, and recovery outcomes.
- Memory freshness checks tied to PR closeout and phase-exit.

## Evals

- Continuous evals over real agent runs.
- Capture-the-flag skill success criteria wired into CI or scheduled checks.
- Eval fixtures generated from real regressions and closeout blockers.

## Observability

- Append-only `harness-trace/v1` event stream.
- Query layer for run history, recurring failures, skipped gates, and recovery
  outcomes.
- Cross-linking between runtime-card, verify-work, PR-closeout, eval artifacts,
  and Project Brain updates.

## Runtime Safety

- Default fail-closed high-risk policy.
- Mandatory live-state collection for closeout claims that cannot be proven
  statically.
- Explicit human override artifacts for policy bypasses.

## Recovery

- Recovery-handler registry.
- Durable recovery traces.
- Automatic research/fix/eval routing after repeated deterministic failures.
- Rollback plan verification for higher-risk automation.

## Context Engineering

- Runtime context budgeter/source selector.
- Context compression with freshness and provenance metadata.
- A cockpit that can explain which context was used, omitted, stale, or blocked.

# Architecture Drift Analysis

## Drift From Intended Architecture

The evidence points toward one integrated harness runtime. The codebase has
instead evolved into several strong but separate layers: shell wrappers,
TypeScript commands, CI jobs, PR closeout artifacts, runtime-card artifacts,
Project Brain files, docs-gate contracts, and eval artifacts. This is productive
drift, not random entropy, but it still leaves too much burden on agents to know
which surface is authoritative in a given lane.

## Duplicated Systems

- Verification exists as shell runner plus TypeScript orchestrator.
- Memory exists as Project Brain/LEARNINGS plus local-memory preflight plus
  legacy `memory.json` gate.
- Traceability exists as PR-closeout claims, runtime-card snapshots, verify run
  state, receipts JSONL, and eval artifacts.
- Governance exists as contract JSON, AGENTS, docs-gate, CircleCI config,
  required-check manifest, branch protection docs, and PR template fields.

## Abandoned Or Partially Migrated Patterns

- `memory.json` appears to be legacy relative to Project Brain, but is still
  validated by current memory-gate paths.
- The typed verification orchestrator appears newer than the shell runner but
  has not displaced it.
- Runtime-card/evidence-bundle are strong newer abstractions, but closeout still
  accepts multiple input shapes and static artifacts.

## Conflicting Abstractions

- `harness next` risk inference is lightweight path-based while policy-gate
  risk is contract-based. These can produce different risk language.
- Policy-chain warning semantics conflict with high-risk human-mediation
  language.
- Command capability metadata describes authority, while individual command
  implementations still own much of the real behavior and parsing.

## Partially Migrated Systems

- PR closeout has moved from checklist/prose toward claim-level evidence. This
  is a strong migration, but it still needs automatic evidence collection.
- Phase-exit gate contracts now model skill gates, but execution still depends
  on external skill/reviewer artifacts.
- Project Brain is recognized by preflight and docs, but the CI memory gate
  remains legacy-shaped.

# Runtime Risk Assessment

## Brittle Execution Paths

- Shell verification has many environment-sensitive branches and fallbacks.
- Required-check normalization can fall back from dist CLI to source runner,
  mise harness, PATH harness, or raw manifest (`scripts/verify-work.sh:151`).
  This improves resilience but makes the actual authority path variable.
- Live runtime-card and PR-closeout depend on GitHub CLI, tokens, and Linear API
  availability.

## Unsafe Defaults

- Policy-chain pass-on-warn is the clearest unsafe default.
- `remediationPolicy` allows medium auto-apply with `dryRunOnlyByDefault:
  false` for CodeQL and Codex (`harness.contract.json:233`). This may be
  acceptable with evidence, but it should be reconciled with the high-risk
  autonomy boundary and explicit rollback requirements.

## Hidden Failure Modes

- Aggregate `pr-pipeline` status can hide which logical gate failed or skipped
  unless internal artifacts are checked.
- Memory updates can land in one memory surface while the required gate checks
  another.
- Pattern-scope can be omitted even when the work admits a broader principle.

## Weak Enforcement

- `harness next` is read-only and advisory unless supplied blockers exist.
- Runtime-card live mode is optional.
- Pattern-scope, eval reinforcement, and Project Brain promotion are not one
  inescapable chain.

## Coupling Risks

- Central command registry and capability maps can drift from command reality.
- CI config, required-check manifest, contract branch protection, and docs all
  duplicate check identity.
- Shell scripts encode substantial runtime behavior that TS tests may not cover
  at the semantic level.

## Silent Failure Zones

- Optional credential-dependent live checks can degrade to unknown or static
  states.
- Docs and contracts can remain synchronized while runtime paths remain
  unreachable.
- Evidence artifacts can exist without proving the semantic claim they support.

## Hallucination Amplification Risks

- If an agent treats docs or artifacts as proof without checking live runtime
  paths, the system can amplify false readiness.
- Broad command surface area invites agents to choose a plausible command rather
  than the canonical command unless `harness next` and instruction routing keep
  narrowing the lane.
- Advisory outputs can be mistaken for enforced gates.

## Missing Proof Chains

- No single proof chain from evidence concept -> command -> runtime path ->
  validation -> CI -> closeout -> memory.
- No universal current-head proof across all artifact-producing commands.
- No default proof that every closeout claim has live or fresh source evidence.

# High-Leverage Improvements

| Rank | Improvement | Impact | Difficulty | Architectural Leverage | Risk Reduction |
|---:|---|---|---|---|---|
| 1 | Make high-risk policy fail closed unless a tracked human override artifact exists. | Very high | Medium | Aligns north-star autonomy boundary with runtime truth. | Very high |
| 2 | Collapse `verify-work` onto the typed verification orchestrator, with shell as compatibility launcher. | Very high | High | Creates one validation runtime and one run-state model. | High |
| 3 | Introduce `harness-trace/v1` as append-only event substrate for commands, validation, review, recovery, and memory. | Very high | High | Turns snapshots into queryable operational truth. | High |
| 4 | Make PR closeout collect runtime-card, closeout-gates, required checks, review threads, Linear, branch, and memory horizons by default. | High | Medium-High | Converts manual closeout proof into one cockpit path. | High |
| 5 | Migrate memory-gate from legacy `memory.json` to Project Brain/LEARNINGS, or rename legacy behavior explicitly. | High | Medium | Removes memory authority confusion. | Medium-High |
| 6 | Require conditional pattern-scope artifacts when work admits repeated steering or design-principle correction. | High | Medium | Makes feedback conversion enforceable. | Medium-High |
| 7 | Emit a CircleCI internal gate manifest and require it in PR closeout when `pr-pipeline` is the required GitHub context. | High | Medium | Preserves stable external checks while exposing internal gate truth. | Medium-High |
| 8 | Generate command registry/capability catalog from command-owned metadata. | Medium-High | Medium | Reduces registry drift and command-name coupling. | Medium |
| 9 | Upgrade observability-gate from metric-label hygiene to trace/event contract validation. | Medium-High | Medium | Converts observability from hygiene to runtime proof. | Medium |
| 10 | Add semantic evidence validators for common claim types: tests, CI freshness, review threads, Linear status, rollback path, memory promotion. | Medium-High | Medium | Reduces artifact theatre. | Medium-High |

# Final Assessment

Coding Harness is genuinely strong where it converts operating discipline into
executable surfaces. The command catalog, docs-gate, steering guard,
Project Brain scaffold, runtime-card, PR closeout, CI contracts, and validation
scripts are real architecture. The current branch's closeout-truth work is an
important upgrade: closeout claims now model source, freshness, head SHA,
blocker class, and missing context, which directly addresses the evidence
document's demand for runtime truth over model confidence.

The project overclaims only when it describes these surfaces as a unified
runtime harness. Today they are a strong control plane with several runtime
islands. The architecture should stop pretending that artifact presence,
docs synchronization, or advisory cockpit output is equivalent to enforced
runtime behavior. Those are useful signals, not proof by themselves.

The biggest missing system is the canonical loop: one lifecycle engine that
selects context, authorizes commands, records trace events, runs verification,
routes recovery, collects closeout proof, and promotes durable learning. Without
that loop, agents still need procedural knowledge to stitch together
`harness next`, runtime-card, verify-work, PR closeout, pattern-scope, memory
gates, evals, and CI evidence.

What should be hardened first: high-risk policy defaults, verification
architecture, closeout evidence collection, Project Brain memory authority, and
trace history. Those changes would reduce the most dangerous gap: the difference
between a system that says it is evidence-driven and a system that can prove it
was evidence-driven for the current run.

What should become canonical: runtime-card plus PR-closeout claim evidence plus
phase-exit closeout gates are the strongest emerging primitives. They should be
joined by a trace event model and become the default proof chain for every
non-trivial change.

What should be removed or demoted: legacy `memory.json` authority should either
be migrated into Project Brain or clearly labeled compatibility-only. Parallel
verification architecture should be collapsed. Any docs-only governance claim
without a validator or runtime path should be treated as roadmap language, not
current capability.

Long-term scaling risk comes from successful partial systems becoming permanent:
many gates, many artifacts, many command families, and many docs can make agents
feel governed while still leaving proof gaps. The next architectural move should
be consolidation, not another adjacent gate. The project does not need more
ceremony; it needs fewer, stronger primitives that make the evidence chain
unavoidable.

