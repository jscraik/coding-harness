# Coding Harness Strategy

## Table of Contents
- [Executive Strategic Summary](#executive-strategic-summary)
- [Core Thesis](#core-thesis)
- [Irreducible Core](#irreducible-core)
- [Actual Moat](#actual-moat)
- [False Moat Signals](#false-moat-signals)
- [Strategic Contradictions](#strategic-contradictions)
- [Complexity Without Leverage](#complexity-without-leverage)
- [What Should Be Deleted](#what-should-be-deleted)
- [What Should Become Core](#what-should-become-core)
- [Architectural Non-Negotiables](#architectural-non-negotiables)
- [Safe To Rewrite](#safe-to-rewrite)
- [Strategic Risks](#strategic-risks)
- [Operational Risks](#operational-risks)
- [Long-Term Scaling Risks](#long-term-scaling-risks)
- [Governance Risks](#governance-risks)
- [Agent-Native Risks](#agent-native-risks)
- [Recommended Strategic Direction](#recommended-strategic-direction)
- [Recommended Simplifications](#recommended-simplifications)
- [Core Investment Priorities](#core-investment-priorities)
- [Future Agent Guidance](#future-agent-guidance)
- [Evidence & Traceability Matrix](#evidence--traceability-matrix)

## Executive Strategic Summary

Coding Harness should become a small, hard, operational system for making
agent-assisted PR work safer, faster, and easier to audit.

It should not become a general AI development platform, a governance framework,
or a warehouse of every useful automation Jamie has ever needed.

The durable strategic spine is:

1. `harness init` installs the operating contract into a repo.
2. `harness next --json` tells agents what to do next with risk, evidence, and
   stop conditions.
3. `harness verify` and repo wrappers prove the work through deterministic gates.
4. `harness review-gate` proves review readiness against current-head evidence.
5. The learning loop converts repeated review failures into contract, scaffold,
   fixture, or gate improvements.

Everything else is supporting infrastructure. If it does not improve this loop,
compress it, hide it, or delete it.

Strategic decision:

The project should optimize for fewer front doors, stronger evidence, smaller
orchestrators, generated command truth, and measured PR-loop improvement. It
should stop rewarding artifact count as progress.

Final posture:

This strategy intentionally chooses a sharper core over platform breadth. The
repo should be easier to adopt, easier to reason about, and harder to drift. If
that means deleting sophisticated-looking surfaces that do not protect the PR
loop, delete them.

## Core Thesis

Agentic development becomes reliable when repeated human review friction is
converted into repo-local contracts, machine-readable decisions, deterministic
validation, and portable learned fixes.

Evidence:

- The intent artifact identifies the core thesis as deterministic repo-local
  contracts, machine-readable next-action packets, policy gates, memory surfaces,
  and rollback-aware automation.
- The architecture review identifies the actual product as operational contract
  infrastructure for agentic development, not generic AI tooling.
- The triage artifact reduces execution pressure to command truth, memory trust,
  CI migration boundaries, skill behavior tests, contract modularity, and
  measured north-star telemetry.

Interpretation:

The product is strongest when it behaves like a control plane with a cockpit,
not when it exposes its whole engine room.

## Irreducible Core

### What The Project Fundamentally Is

Coding Harness is a portable governance and execution contract for agentic PR
work.

It exists to answer:

- What should the agent do next?
- What risk tier is this work?
- What evidence is required?
- Which checks are authoritative?
- Which workflows are allowed to mutate repo state?
- What did prior review failure teach the repo?

### Irreducible Architecture

The irreducible architecture is:

| Core component | Strategic role | Preserve? |
| --- | --- | --- |
| CLI cockpit | Gives humans and agents a small command front door. | Yes |
| Command registry and capability metadata | Converts command sprawl into machine-readable execution semantics. | Yes |
| `HarnessDecision` envelope | Turns ambiguous next steps into structured action, risk, evidence, and stop conditions. | Yes |
| Contract schema | Carries repo policy, CI ownership, review expectations, and scaffold behavior. | Yes, but modularize |
| Gate result schemas | Make validation consumable by agents and CI. | Yes |
| Review/readiness proof | Ensures checks match the current commit and independent reviewers remain independent. | Yes |
| Init/update/eject lifecycle | Makes the system portable across repos. | Yes |
| Learned-failure loop | Converts review pain into future automation. | Yes, but measure it |

### Operational Identity

The operational identity is not "many commands." It is "one reliable PR loop
that agents can execute without guessing."

### Cognition Model

Future agents should consume compressed, structured truth first:

1. `harness next --json`
2. command capability metadata
3. contract/gate JSON
4. the nearest repo instructions
5. detailed docs only when the structured packet points there

### Orchestration Philosophy

Orchestration is justified only when it hides provider mess, protects current
state, or reduces repeated human review.

Orchestration is not justified when it merely moves branching logic from code
into shell, prompts, docs, or another wrapper.

### Execution Philosophy

The repository should prefer:

- small command front doors
- structured output
- current-head evidence
- deterministic validation
- explicit stop conditions
- reversible scaffolding
- measured improvement over aspirational governance

### Governance Philosophy

Governance is useful only when executable.

Policy prose that is not enforced, generated, validated, or tied to repeated
failure should be treated as drift inventory.

## Actual Moat

### What Is The Moat?

The moat is operational learning encoded as portable, executable repo contracts.

That is the whole moat. Not the command count. Not the docs volume. Not the
number of integrations. Not the phrase "agent-native." If operational learning
does not become executable evidence, there is no meaningful moat.

More specifically:

- contract-backed CI and review ownership
- command capability metadata agents can reason over
- decision envelopes with risk and stop conditions
- current-head review proof
- scaffold/update lifecycle with managed/adaptable ownership
- learned-failure promotion into gates, fixtures, and templates
- downstream skill packaging that teaches agents the same operational loop

### Why It Is Difficult To Replicate

A competitor can rebuild the visible CLI surface quickly. They can copy `init`,
`verify`, `next`, and `review-gate` as words.

They cannot quickly copy the operational scar tissue if this repo keeps
compounding it:

- real CI provider drift cases
- review failure patterns
- branch-protection mismatches
- stale check proof
- scaffold migration mistakes
- agent ambiguity failures
- repo memory drift
- command/documentation drift

The moat is not the artifacts. It is the tested conversion of repeated failures
into portable execution constraints.

### Does Complexity Strengthen Or Weaken The Moat?

Complexity strengthens the moat only when it compresses real operational
failure.

Complexity weakens the moat when it:

- increases command surface without reducing PR rework
- adds governance prose without enforcement
- adds plugins or tools without fixtures
- leaves giant orchestrators too risky to change
- makes agents read more before acting

### Moat Type

| Moat type | Status | Notes |
| --- | --- | --- |
| Operational | Real | The strongest defensibility comes from repeated failure encoded as checks and scaffolds. |
| Cognitive | Real but fragile | `HarnessDecision`, command metadata, and structured gates compress agent reasoning. Command drift weakens this. |
| Architectural | Conditional | The architecture is defensible if large cores are split and contracts stay modular. |
| Workflow-based | Real | The PR loop is the product. |
| Governance-based | Conditional | Governance is a moat only when executable and cheaper than failure. |
| Execution-based | Real | Deterministic gates and current-head checks are hard to replace with prose. |
| Ecosystem-based | Weak | Optional tools and integrations are not yet a defensible ecosystem. |
| Trust-based | Emerging | Trust improves if memory, command docs, and validation surfaces stop lying. |
| Distribution-based | Not proven | No artifact proves broad adoption or switching cost yet. |

### Moat-Critical Systems

Protect these aggressively:

- `harness next --json` and `HarnessDecision`
- command registry and capability metadata
- contract schema and generated contract defaults
- `review-gate` current-head proof
- CI required-check ownership and parity
- init/update/eject scaffold ownership model
- packaged coding-harness skill and its reference contract
- Project Brain and Local Memory only where they contain current, actionable
  learned-failure evidence

### Systems That Weaken The Moat

- placeholder `memory.json`
- README command references that do not dispatch
- string-only skill validation presented as semantic assurance
- `ci-migrate-core.ts` as a growing god orchestrator
- repeated governance prose across docs
- optional tool/plugin breadth treated as core capability
- compatibility paths without owner and sunset date

### Likely False Moat Assumptions

- More commands mean more value.
- More governance docs mean safer agents.
- A memory file is valuable because it exists.
- Plugin breadth is defensibility.
- Technical sophistication is hard to copy.
- A giant well-tested file is safe enough to keep growing.

### What A Smart Competitor Would Remove Immediately

A smart competitor would remove:

- broad command surface exposed to new users
- repeated policy docs
- placeholder memory
- optional tool menus that are not on the PR loop
- giant CI migration internals from the public mental model
- any gate that cannot explain which repeated failure it prevents

That competitor would keep the cockpit, decision envelope, current-head proof,
contract schema, fixtures, and learning loop.

Strategic implication:

Assume competitors can copy every visible feature. Defend only the compounding
operational evidence loop and the small trusted cockpit that exposes it.

## False Moat Signals

| Signal | Why it is false | Strategic response |
| --- | --- | --- |
| Large command count | Breadth is easy to copy and hard to learn. | Budget and classify commands. |
| Governance artifact volume | Artifact count does not prove safety. | Delete or enforce. |
| Optional integration list | Optional tools are not product gravity. | Treat as adapters, not core. |
| String drift validators | They catch regressions but do not prove behavior. | Add fixture-backed tests. |
| Layered docs | Progressive disclosure is useful only if front doors stay small. | Compress and generate truth. |
| Local memory presence | Stale or placeholder memory damages trust. | Require meaningful memory or remove from required path. |

## Strategic Contradictions

| Contradiction | Evidence | Strategic risk | Decision |
| --- | --- | --- | --- |
| The project values deterministic command truth, but README command drift already exists. | Triage records 64 non-blocking command-surface warnings. | Agents may follow stale public instructions. | Generate or reconcile command docs before expanding the command surface. |
| The project values cognition surfaces, but `memory.json` is placeholder. | Review and triage identify placeholder memory under a required PR surface. | Agents learn that governed artifacts may be symbolic. | Replace with meaningful repo memory or remove from required validation. |
| The project values local reasoning, but CI migration is concentrated in one huge core. | Review cites `ci-migrate-core.ts` at 10402 lines and test file at 6319 lines. | High-risk edits become normal. | Freeze feature growth in the core and extract lifecycle modules. |
| The project values portable governance, but contract/type surfaces risk becoming junk drawers. | Review cites `harness.contract.json` at 1120 lines and `types-core.ts` at 1776 lines. | Policy changes amplify across unrelated contexts. | Split by bounded context while preserving published aggregate. |
| The project claims PR lead time as north star, but telemetry is underbuilt. | Intent and review both identify declared metrics stronger than live measurement. | Cannot prove the moat. | Build measurement before adding new strategic surfaces. |

## Complexity Without Leverage

| Complexity | Why it exists | Why it survived | Why it is harmful now | Direction |
| --- | --- | --- | --- | --- |
| `ci-migrate-core.ts` concentration | CI migration needed tracer-bullet implementation across providers and policy. | It works and has broad tests. | It now has too many reasons to change. | Split by lifecycle and policy boundary. |
| Repeated governance prose | Human reassurance and agent handoff clarity. | Docs are easy to add and hard to delete. | Every duplicate policy sentence becomes future drift. | Delete or generate from contract. |
| README command truth drift | Product docs evolved faster than dispatch truth. | Warnings are non-blocking. | Public command truth is unreliable. | Reconcile and enforce. |
| Placeholder memory | Bootstrap scaffold was left in place. | Required surfaces normalized it. | Breaks trust in cognition infrastructure. | Replace or remove from required path. |
| Optional tool/plugin breadth | Harness setup wants to expose useful ecosystem helpers. | Optional lists feel like capability. | Agents may mistake optional breadth for core architecture. | Demote unless fixture-backed and PR-loop relevant. |
| Shell orchestration growth | Shell wrappers are convenient cross-language entrypoints. | They are familiar and CI-friendly. | Complex shell is hard to type, test, and refactor. | Keep thin shell, move policy to typed specs. |

## What Should Be Deleted

Delete after characterization or direct replacement:

| Candidate | Why it exists | Why it survived | Why remove it now |
| --- | --- | --- | --- |
| Placeholder `memory.json` content | Bootstrap default. | It became part of governed surfaces before being made real. | It weakens the repo's trust model. |
| Stale README command references | Product visibility. | Drift warnings do not block. | They are anti-agent instructions. |
| Duplicate governance paragraphs | Reassurance and onboarding context. | Docs accreted around real risk. | Repetition is drift inventory. |
| Legacy compatibility paths without owner/date | Migration safety. | Removal risk was deferred. | Permanent compatibility distorts architecture. |
| Non-core command publicity | Discoverability for power users. | Every command looked useful in isolation. | It hides the smallest compelling product. |
| Optional integration claims without executable proof | Ecosystem ambition. | Tool lists are cheap to maintain. | They create fake moat signals. |
| Any architecture doc that restates prior reviews without changing routing | Strategic anxiety. | More writing feels safer than deletion. | It increases cognition load. |

Do not delete:

- command registry and capability metadata
- `HarnessDecision`
- gate result schemas
- init/update/eject ownership model
- current-head review proof
- CI ownership parity
- packaged harness skill

Those are core leverage surfaces even when their internals need simplification.

## What Should Become Core

Core investment should narrow around:

1. Agent cockpit compression.
2. Command truth reconciliation.
3. Current-head review proof.
4. Contract modularity.
5. Fixture-backed downstream behavior tests.
6. Learned-failure promotion.
7. Measured PR-loop telemetry.
8. CI migration boundary recovery.

Not core:

- general plugin platform claims
- broad optional tool menus
- unmeasured governance expansion
- more static strategy documents
- command additions that bypass capability metadata
- memory surfaces without freshness and provenance

## Architectural Non-Negotiables

1. The default user and agent path must stay small: `init`, `next`, `verify`,
   `review-gate`, and learned-failure/context commands.
2. Mutating commands must expose risk, expected artifacts, validation guidance,
   and stop conditions through command metadata or structured output.
3. Command docs, help, registry, and dispatch must not disagree.
4. Governance policy must be executable, generated, validated, or deleted.
5. Review readiness must be tied to current-head evidence.
6. CI ownership split must remain explicit: CircleCI for PR governance/security
   checks, CodeRabbit for independent review, Semgrep Cloud for external security,
   GitHub Actions for release/fallback unless an intentional migration changes it.
7. Memory/context surfaces must be current, provenance-aware, and operationally
   meaningful.
8. No new lifecycle behavior may be added to oversized cores without an
   extraction plan.
9. Shell wrappers must remain thin entrypoints, not policy engines.
10. New abstractions must name the repeated failure, review loop, or validation
    gap they remove.
11. Strategy claims must be backed by telemetry, fixtures, gates, or explicit
    maintainer decisions.
12. Future agents must be able to reason locally before reading the whole repo.

## Safe To Rewrite

These areas can evolve aggressively if tests and contract behavior remain stable:

| Area | Rewrite latitude | Guardrail |
| --- | --- | --- |
| Internal CI migration modules extracted from `ci-migrate-core.ts` | High | Preserve CLI behavior and characterization tests. |
| Documentation layout below the main front doors | High | Do not duplicate policy; preserve generated truth links. |
| Shell internals in `verify-work.sh` | Medium-high | Keep entrypoint and exit semantics stable while moving logic to typed specs. |
| Optional integration lists | High | Remove, demote, or fixture-test before promoting. |
| Skill reference prose | Medium-high | Preserve install/update contract and behavior tests. |
| Contract internal organization | Medium | Preserve published aggregate or ship migration. |
| Status and roadmap surfaces | High | Delete stale claims; keep dated, evidenced status. |
| Legacy compatibility paths | High after characterization | Add owner, date, and removal test before deletion. |

Safe does not mean casual. It means these surfaces are not the moat by
themselves. Future agents should not preserve them out of reverence. Preserve
the public contract, proof behavior, and user trust; rewrite the internals when
that reduces context cost or hidden coupling.

Rewrite permission:

- Rewrite non-core internals when the existing shape makes local reasoning hard.
- Delete non-core docs when they duplicate executable truth.
- Demote optional integrations when they lack fixture-backed PR-loop value.
- Collapse orchestration layers when they add handoff cost without new safety.
- Keep compatibility only with an owner, expiry, and characterization test.

## Strategic Risks

| Risk | Severity | Why it matters | Response |
| --- | --- | --- | --- |
| The repo optimizes for governance completeness instead of PR-loop improvement. | Critical | Adoption fails if the harness feels like imported ceremony. | Admit strategic work only if it can affect PR lead time, review rework, safety, or agent ambiguity. |
| The moat remains asserted rather than measured. | High | Competitors can copy unmeasured claims. | Build north-star telemetry and fixture evidence. |
| The command surface becomes the product. | High | Agents and humans cannot find the reliable path. | Budget commands and make cockpit routing canonical. |
| Large orchestrators become too risky to change. | High | Core product areas freeze under their own complexity. | Start extraction before adding lifecycle behavior. |
| Jamie-specific operating knowledge stays implicit. | High | The product cannot become portable. | Encode learned failures as fixtures, gates, and contract rules. |

## Operational Risks

| Risk | Evidence | Impact | Response |
| --- | --- | --- | --- |
| Command drift remains non-blocking. | 64 baseline warnings in triage/review. | Stale instructions become normalized. | Assign cleanup lane and fail future command-surface drift. |
| Packaged skill validation stays lexical. | Review identifies string validators. | Downstream installs can be "valid" but unusable. | Add fixture-backed install/update tests. |
| Placeholder memory remains required. | Review/triage identify `memory.json` placeholder. | Trust in memory and PR template drops. | Replace or remove requirement. |
| Validation wrappers grow in shell. | Review flags `verify-work.sh` size. | Harder to refactor or agent-read. | Move policy to typed gate specs. |
| Required-check ownership drifts. | Intent identifies CircleCI/CodeRabbit/Semgrep/GitHub split. | Branch protection trust degrades. | Keep check-name parity enforced. |

## Long-Term Scaling Risks

Over 2-5 years, the system naturally evolves into a portable agentic PR control
plane.

What compounds positively:

- reusable failure fixtures
- command capability metadata
- current-head review proof
- learned-failure promotion
- generated command truth
- contract-backed CI ownership
- downstream skill behavior assurance

What breaks first:

- giant orchestrators
- duplicated policy docs
- command discoverability
- memory freshness
- optional integration sprawl
- shell orchestration readability

What scaling pressure appears:

- multiple repos need different policy profiles
- command count grows faster than cockpit clarity
- governance exceptions become common
- agents consume too much context before action
- contract schema becomes a universal policy object unless split

Strategic stance:

Scale by compression, not expansion. Add depth to the PR loop before adding new
surface area.

## Governance Risks

Governance is both the strength and the danger.

It helps when it:

- blocks real risk
- proves current state
- reduces repeated review
- preserves independent checks
- gives agents stop conditions

It hurts when it:

- repeats policy across docs
- turns warnings into permanent baseline noise
- requires symbolic artifacts
- adds PR ceremony without telemetry
- blocks speed without explaining the failure it prevents

Governance must earn its place through operational proof.

## Agent-Native Risks

| Risk | Why future agents struggle | Strategic response |
| --- | --- | --- |
| Too many commands | Agents spend context choosing instead of executing. | Route through `next --json` and command categories. |
| Stale command docs | Agents run commands that do not dispatch. | Generate/reconcile docs from registry. |
| Giant core files | Agents cannot isolate safe edit boundaries. | Extract by domain lifecycle. |
| Placeholder memory | Agents treat false context as truth. | Require provenance and freshness. |
| Layered governance docs | Agents over-read and under-act. | Compress front doors and delete repeats. |
| String-only validation | Agents over-trust lexical checks. | Add behavior fixtures. |

## Recommended Strategic Direction

For the next phase, pursue four strategic initiatives and reject work outside
them unless it fixes a production defect.

### Initiative 1: Operational Moat Hardening

Goal:

Make the moat measurable and compounding.

Includes:

- PR lead-time and review-rework telemetry
- learned-failure promotion metrics
- fixture-backed downstream harness tests
- review-gate/current-head proof reliability

Reject:

- moat wording changes without measurement
- new status surfaces without live evidence

### Initiative 2: Agent Cockpit Compression

Goal:

Make the smallest reliable path obvious to humans and agents.

Includes:

- command surface budget
- generated command docs
- `next --json` as canonical front door
- command category cleanup

Reject:

- new top-level commands without admission criteria
- README command expansion before drift cleanup
- any feature whose main value is "the harness can also do this"

### Initiative 3: CI Migration Boundary Recovery

Goal:

Turn the highest-risk orchestrator into bounded modules.

Includes:

- characterization tests
- provider adapters
- lifecycle modules
- proof-pack/report modules
- merge queue and break-glass boundaries

Reject:

- new CI migration features inside `ci-migrate-core.ts`
- refactors without production-like tests

### Initiative 4: Governance Simplification And Trust Repair

Goal:

Make governance smaller, truer, and more enforceable.

Includes:

- replace/remove placeholder memory
- delete duplicate policy prose
- modularize contract schema
- move shell policy to typed specs
- sunset legacy compatibility paths

Reject:

- new governance docs that do not change validation, routing, or gates
- strategy/architecture follow-up documents that do not delete, enforce,
  generate, measure, or simplify something

## Recommended Simplifications

1. Generate README command tables from the command registry or remove command
   claims that are not dispatch truth.
2. Replace `memory.json` with repo-specific operational memory or remove it from
   required PR validation until meaningful.
3. Split `ci-migrate-core.ts` by lifecycle before adding feature behavior.
4. Move stable `verify-work.sh` policy into typed gate specs while keeping the
   shell entrypoint.
5. Split contract schema by bounded context and compose the public aggregate.
6. Add behavior fixtures for packaged skill install/update flows.
7. Delete duplicated governance prose after identifying the canonical source.
8. Hide or demote non-core commands from first-run docs.
9. Require owner/date/removal condition for compatibility paths.
10. Treat non-blocking drift warnings as backlog with burn-down, not background
    noise.

## Core Investment Priorities

| Priority | Investment | Why it matters | Confidence |
| --- | --- | --- | --- |
| P1 | Command truth and cockpit compression | Agent-native trust depends on executable command truth. | High |
| P1 | Memory trust repair | A cognition system cannot contain placeholders. | High |
| P1 | CI migration decomposition | This is the largest change-amplification risk. | High |
| P1 | North-star telemetry | Without measurement, the moat is asserted. | Medium-high |
| P2 | Skill behavior fixtures | Downstream adoption depends on actual install/update behavior. | High |
| P2 | Contract modularity | Keeps governance portable without becoming a junk drawer. | Medium-high |
| P2 | Typed gate specs | Reduces shell complexity and improves local reasoning. | Medium |
| P3 | Documentation compression | Important after command truth and canonical sources are fixed. | Medium |

## Future Agent Guidance

Future agents should preserve:

- the small PR loop
- structured JSON outputs
- current-head proof
- command capability metadata
- contract-backed governance
- independent review/check ownership
- learned-failure promotion
- fixture-backed behavior proof

Future agents may rewrite:

- internal module layout
- docs organization
- shell implementation details
- optional integration surfaces
- skill prose
- compatibility layers after characterization

Future agents should challenge:

- any new top-level command
- any new governance document
- any unmeasured strategic claim
- any memory/context surface without provenance
- any addition to `ci-migrate-core.ts`
- any optional tool promoted as core without fixture evidence

Default decision rule:

If a change does not reduce review rework, improve deterministic execution,
compress context, repair trust, or strengthen fixture-backed portability, it is
probably not strategic work.

Future-agent permission:

Be conservative with contracts and proof behavior. Be aggressive with accidental
shape. The worst future outcome is not that an agent rewrites a non-core helper.
The worst outcome is that agents keep preserving every historical layer until
the real product is buried under its own safety equipment.

## Evidence & Traceability Matrix

| Strategic conclusion | Evidence | Affected systems/modules | Confidence | Why it matters | Operational impact | Fact / interpretation / speculation |
| --- | --- | --- | --- | --- | --- | --- |
| The core product is the agentic PR loop, not generic AI tooling. | Intent defines mission around humans steering agents safely and PR lead time; review defines the core domain as reliable human-plus-agent PR execution. | `src/commands/next.ts`, `scripts/verify-work.sh`, `src/commands/review-gate-core.ts`, `harness.contract.json` | High | Prevents strategy from expanding into every possible automation. | Narrows execution routing and docs. | Interpretation grounded in prior artifacts. |
| The actual moat is operational learning encoded into portable contracts. | Intent says probable moat is operational scar tissue encoded as deterministic workflow contracts; review says moat is real only if measured through contracts, gates, fixtures, and decisions. | `harness.contract.json`, command registry, gate schemas, `.agents/skills/coding-harness/**` | Medium-high | Protects the real differentiator instead of technical sophistication. | Prioritizes fixtures, telemetry, and learned-failure promotion. | Interpretation grounded in evidence. |
| Command truth is a strategic trust issue. | Triage/review record 64 non-blocking command-surface drift warnings for README commands missing CLI dispatch. | `README.md`, `src/cli.ts`, `src/lib/cli/registry/**`, drift findings | High | Agent-native systems fail when instructions are false. | Requires generated/reconciled command docs. | Fact plus interpretation. |
| Placeholder memory weakens the cognition model. | Review and triage identify `memory.json` placeholder while memory is treated as required PR/governance surface. | `memory.json`, `.harness/memory/**`, PR template | High | A governed memory artifact that lies teaches agents to distrust the system. | Replace or remove from required path. | Fact plus interpretation. |
| `ci-migrate-core.ts` is the primary architectural drag. | Review cites 10402-line core and 6319-line test file; intent calls it a module boundary failure. | `src/commands/ci-migrate-core.ts`, `src/commands/ci-migrate.test.ts` | High | New behavior there increases regression risk and slows strategic work. | Freeze feature growth and split by lifecycle. | Fact plus interpretation. |
| Contract schema is core but at risk of becoming a junk drawer. | Review cites `harness.contract.json` at 1120 lines and `types-core.ts` at 1776 lines; intent identifies contract as stable interface. | `harness.contract.json`, `src/lib/contract/types-core.ts` | Medium-high | Governance portability depends on contract clarity. | Modularize by bounded context while preserving aggregate. | Interpretation grounded in file scope. |
| Governance must be executable or deleted. | Intent and review both warn governance layers risk ceremony; triage rejects work outside execution initiatives. | `docs/agents/**`, `.github/PULL_REQUEST_TEMPLATE.md`, `.circleci/config.yml`, contract | Medium-high | Repeated policy prose becomes drift inventory. | Delete duplicates or tie to gates/generated truth. | Interpretation. |
| Optional plugin/tool breadth is not a moat. | Review says optional tools in install metadata are not a general plugin runtime; triage labels plugin breadth as fake moat. | `.agents/skills/coding-harness/references/agent-install.json`, docs/tool lists | Medium | Prevents ecosystem theater from distracting from the PR loop. | Demote optional tools unless fixture-backed. | Interpretation. |
| North-star telemetry is underbuilt. | Intent names PR lead time and review rework; review says moat is not measurable enough yet; triage makes telemetry a core initiative. | `harness.contract.json`, roadmap/status docs, future telemetry | Medium | Strategy cannot prove value without measurement. | Build telemetry before making stronger commercial claims. | Interpretation; needs live telemetry work. |
| Future agents need compression, not more guidance. | Prior artifacts identify command breadth, layered docs, large cores, and memory ambiguity as future-agent risks. | `src/commands/**`, `docs/**`, `.harness/**`, `memory.json` | Medium-high | Agent adoption depends on low context cost and local reasoning. | Route through `next --json`, generated command truth, and bounded modules. | Interpretation grounded in evidence. |
