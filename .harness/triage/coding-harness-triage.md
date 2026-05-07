---
schema_version: 1
triaged_at: 2026-05-07
repo: coding-harness
artifact_type: structural-triage
inputs:
  - .harness/features/coding-harness-intent.md
  - .harness/review/coding-harness-architecture-review.md
---

# Coding Harness Structural Triage

## Table of Contents

- [Executive Triage Summary](#executive-triage-summary)
- [Triage Rules](#triage-rules)
- [Immediate Architectural Risks](#immediate-architectural-risks)
- [Strategic Findings](#strategic-findings)
- [Architectural Findings](#architectural-findings)
- [Operational Findings](#operational-findings)
- [Governance Findings](#governance-findings)
- [Agent-Native Findings](#agent-native-findings)
- [Complexity Without Leverage](#complexity-without-leverage)
- [Moat-Critical Systems](#moat-critical-systems)
- [Fake Sophistication Signals](#fake-sophistication-signals)
- [Recommended Deletions](#recommended-deletions)
- [Refactor Candidates](#refactor-candidates)
- [Anti-Drift Priorities](#anti-drift-priorities)
- [Execution Priority Matrix](#execution-priority-matrix)
- [Recommended Linear Initiatives](#recommended-linear-initiatives)
- [Recommended ADRs](#recommended-adrs)
- [Recommended Refactor Programs](#recommended-refactor-programs)
- [Future Agent Operational Risks](#future-agent-operational-risks)
- [Recommended Compression Opportunities](#recommended-compression-opportunities)
- [Findings That Should Not Become Work Items](#findings-that-should-not-become-work-items)
- [Evidence & Traceability Matrix](#evidence--traceability-matrix)

## Executive Triage Summary

The architecture review and intent artifact agree on the same operational truth:
Coding Harness is coherent, genuinely agent-native, and strategically valuable
only if it stays focused on reducing PR lead time and review/rework cost through
deterministic execution contracts.

The execution priority is not "improve architecture" in the abstract. The
priority is to remove the specific conditions that make future agents slower,
less certain, or more likely to patch symptoms.

Top execution calls:

| Rank | Action | Category | Why it matters | Next artifact |
| ---: | --- | --- | --- | --- |
| 1 | Fix or remove placeholder `memory.json` from required PR validation | Governance, Agent-Native | A placeholder memory surface in a memory-governed repo is trust damage. | Linear issue |
| 2 | Resolve command truth drift between README, registry, and CLI dispatch | Agent-Native, Governance, Operational | 64 baseline drift warnings mean command discoverability is already inconsistent. | Linear project |
| 3 | Start `ci-migrate-core.ts` decomposition | Architectural, Technical Debt | The 10402-line core is the highest-risk change-amplification point. | Refactor program |
| 4 | Create a command surface budget | Strategic, Agent-Native, Governance | A broad command surface is the clearest future-agent cognition risk. | ADR plus enforcement issue |
| 5 | Add fixture-backed packaged skill tests | Operational, Agent-Native | Lexical skill validation is useful but not enough to prove downstream usability. | Eval program |
| 6 | Modularize contract schema by bounded context | Architectural, Governance | `harness.contract.json` and `types-core.ts` are becoming broad policy aggregates. | ADR plus refactor program |
| 7 | Move stable `verify-work.sh` orchestration logic toward typed gate specs | Operational, Architectural | Shell is a good entrypoint and a weak long-term home for orchestration state. | Refactor program |
| 8 | Add measured north-star telemetry | Strategic, Operational | The moat is operational learning; it is not measurable enough yet. | Linear initiative |

Work to reject:

- More policy docs that do not remove a repeated failure.
- More commands without removing, hiding, or consolidating existing commands.
- More memory/context surfaces before placeholder memory and retrieval quality are
  fixed.
- More plugin/integration surface unless it proves a repeatable workflow
  improvement.
- More coverage around `ci-migrate-core.ts` that leaves the boundary intact
  unless it is characterization coverage for extraction.

The repo does not need more architecture cognition. It needs execution pressure
against the few findings that compound.

Execution posture:

- Treat the recommended Linear initiatives as the planning boundary.
- Do not explode this into dozens of disconnected issues.
- Every issue should attach to one of the initiatives or be rejected.
- Any work that only improves how the architecture is described should be
  treated as suspicious until it proves execution value.

## Triage Rules

Use these rules before turning any finding into work:

1. If it does not reduce review/rework cost, improve deterministic execution, or
   protect the agent cockpit, it is probably noise.
2. If it only makes governance feel more complete, reject it.
3. If it adds a public command, it must either replace another command, be
   orchestrated by the cockpit, or remain hidden plumbing.
4. If it adds memory/context, it must prove retrieval quality or decision
   improvement.
5. If it touches CI migration, it must move code out of the oversized core or
   explicitly block further growth.
6. If it adds policy, it must name the repeated failure, enforcement surface, and
   deletion condition.

## Immediate Architectural Risks

| Risk | Severity | Likelihood | Blast radius | Why it matters | Recommended response |
| --- | --- | --- | --- | --- | --- |
| Placeholder memory remains required evidence | High | High | PR workflow, Project Brain, agent trust | `memory.json` contains bootstrap placeholder data while the PR template treats memory shape as required validation. This teaches agents that governed cognition can be symbolic. | Replace with repo-specific memory or remove memory check from PR template until meaningful. |
| Command truth drift persists | High | High | README, CLI, agents, onboarding, validation | Validation reports 64 non-blocking drift warnings for README-documented commands missing CLI dispatch. That directly harms command discoverability. | Make command docs generated from registry or resolve dispatch/docs mismatch as an owned project. |
| `ci-migrate-core.ts` absorbs more behavior | High | High | CI migration, branch protection, parity proof, merge queue, release safety | The file already combines too many lifecycles. New behavior there increases regression and review risk. | Freeze new feature growth in the core except extraction work. |
| Governance expands without metric proof | High | Medium | All workflow surfaces | The repo's own non-goal rejects governance surface area as progress, but docs/contracts/gates can still multiply. | Require repeated-failure ID and enforcement destination for any new governance surface. |
| Packaged skill passes lexical checks but fails real downstream use | Medium-high | Medium | Downstream adoption, agent onboarding, package trust | Skill validators catch stale strings but do not prove init/update workflows run in fixture repos. | Add fixture-backed skill behavior tests before expanding packaged skill complexity. |
| Contract schema becomes policy junk drawer | Medium-high | Medium | Review policy, CI ownership, branch protection, product surfaces | `harness.contract.json` and `types-core.ts` aggregate many domains. That increases change amplification. | Split schema ownership by bounded context and compose the final contract. |
| Validation shell wrapper grows as state machine | Medium | Medium | Local validation, CI parity, agent handoff | `verify-work.sh` is load-bearing and already large. More logic in shell reduces testability. | Keep shell entrypoint; move gate graph/resume/failure taxonomy into typed specs. |

## Strategic Findings

| Finding | Signal level | Execution category | Fact | Interpretation | Next routing |
| --- | --- | --- | --- | --- | --- |
| The actual moat is operational discipline encoded into portable contracts | High-leverage | Strategic, Agent-Native, Governance | Both prior artifacts identify contract schema, decision envelope, gate results, CI parity, scaffold metadata, and learned-failure promotion as differentiators. | Protect the repeatable control loop, not the surface area around it. | Linear initiative: Operational Moat Hardening |
| PR lead time is the only acceptable strategic metric | High-leverage | Strategic, Operational | `harness.contract.json` and north-star docs name `pr_lead_time` and `review_rework_loop`. | Work that cannot plausibly move this metric should not become strategic work. | ADR: North-Star Work Admission |
| A smaller competitor can copy the simple feature set | High-leverage | Strategic | The review says `init`, `next`, `verify`, and `review-gate` can be rebuilt quickly. | Defensibility must come from measured workflow learning, fixtures, and adoption trust. | Eval program plus telemetry initiative |
| The smallest compelling version is already identifiable | High-leverage | Strategic, Agent-Native | Prior review reduces the product to init, next, verify, review-gate, and learnings/review-context. | Product routing should collapse toward these front doors. | ADR: Cockpit Product Surface |
| Governance is valuable only when executable | High-leverage | Governance | Docs and contract repeatedly warn against governance surface area as proxy for progress. | New governance prose without enforcement is drift inventory. | Governance change |

Strategic findings that should not become work:

- "Improve commercial positioning" without changing install friction,
  measurement, or cockpit clarity.
- "Add more AI workflow docs" without deleting or generating existing surfaces.
- "Make plugin architecture more extensible" before proving existing skill and
  command workflows.
- "Create a broader strategy document" before telemetry and command truth are
  fixed.
- "Investigate more frameworks" for problems already solved by the current
  command/decision/gate model.

## Architectural Findings

| Finding | Signal level | Execution category | Affected modules | Operational impact | Next routing |
| --- | --- | --- | --- | --- | --- |
| `ci-migrate-core.ts` is the primary boundary failure | High-leverage | Architectural, Technical Debt | `src/commands/ci-migrate-core.ts`, `src/commands/ci-migrate.test.ts` | High review cost, fragile edits, poor local reasoning. | Refactor program |
| Contract schema needs bounded-context composition | High-leverage | Architectural, Governance | `harness.contract.json`, `src/lib/contract/types-core.ts` | Broad policy edits become global changes. | ADR plus refactor program |
| Command registry/capability catalog is a core deep module | High-leverage | Architectural, Agent-Native | `src/lib/cli/registry/command-capabilities.ts`, `src/lib/cli/command-registry.ts` | Compresses command cognition for agents. | Protect and enforce |
| `HarnessDecision` is a core deep module | High-leverage | Architectural, Agent-Native | `src/lib/decision/harness-decision.ts`, `src/commands/next.ts` | Turns workflow ambiguity into structured next action. | Protect and extend carefully |
| Context/memory architecture is promising but overloaded | Medium-leverage | Architectural, Agent-Native | `memory.json`, `.harness/knowledge/**`, `.harness/memory/**`, `src/lib/context-compound/indexer.ts` | Future agents can inherit stale or ambiguous context. | Context quality eval program |
| Documentation layers are useful but near saturation | Medium-leverage | Architectural, Governance | `docs/agents/**`, `docs/architecture/documentation-layers.md`, root `AGENTS.md` | Agents may read too much before acting. | Compression initiative, not new docs |

## Operational Findings

| Finding | Signal level | Execution category | Evidence | Operational impact | Next routing |
| --- | --- | --- | --- | --- | --- |
| Fast validation works and catches real doc defects | High-leverage | Operational | `verify-work --fast` failed on markdownlint, then passed after fix. | The wrapper is useful as an execution reality check. | Preserve wrapper entrypoint |
| Drift-gate warnings are non-blocking but high-signal | High-leverage | Operational, Governance | 64 baseline command-surface warnings. | Non-blocking warnings can normalize drift if not assigned. | Linear project |
| CircleCI/GitHub Actions/CodeRabbit/Semgrep split is strategically important | High-leverage | Operational, Governance | Intent artifact cites CI ownership split and contract. | Preserves independent review and release separation. | Protect with check-name parity |
| Skill validation is present but shallow | Medium-leverage | Operational, Agent-Native | `validate-packaged-skill.cjs`, reference-contract validator. | Prevents known text regressions but not broken workflows. | Fixture eval program |
| North-star telemetry is under-evidenced | High-leverage | Operational, Strategic | Prior review found stronger declared metrics than live outcome measurement. | Cannot prove the moat or reject ceremony. | Measurement initiative |

## Governance Findings

| Finding | Signal level | Category | Fact | Interpretation | Work decision |
| --- | --- | --- | --- | --- | --- |
| Placeholder memory is governance debt | High-leverage | Governance, Agent-Native | Required PR template checks `memory.json`; file contains placeholder repo data. | This should be fixed before adding any new memory governance. | Create issue now |
| New governance needs admission criteria | High-leverage | Governance | North-star docs reject governance surface as progress. | Every new gate/doc/policy needs failure ID and enforcement destination. | ADR |
| Existing docs may contain repeated policy | Medium-leverage | Governance | Intent/review warn against docs repeating contract/CI policy. | Duplicate prose is future drift. | Compression project |
| Required gates must stay explicit | High-leverage | Governance, Operational | Validation docs require exact command outcomes. | This is valuable and should not be weakened. | Preserve |
| Review independence is moat-critical | High-leverage | Governance, Operational | PR template and contract require independent CodeRabbit/Codex/Semgrep surfaces. | Do not collapse review back into self-approval. | Protect |

## Agent-Native Findings

| Finding | Signal level | Category | Why future agents care | Work decision |
| --- | --- | --- | --- | --- |
| `harness next --json` should be the front door | High-leverage | Agent-Native, Strategic | Reduces command selection ambiguity. | Make it canonical in docs and generated guidance. |
| Command truth drift harms agent execution | High-leverage | Agent-Native, Governance | Agents may run documented commands that do not dispatch. | Resolve or generate docs from registry. |
| `HarnessDecision` should absorb more next-step metadata, not random command-specific prose | High-leverage | Agent-Native, Architectural | Keeps orchestration decisions machine-readable. | Protect schema discipline. |
| Packaged skill is a product API | High-leverage | Agent-Native, Operational | Target repo agents use it as operational guidance. | Add fixture behavior tests. |
| Memory/context surfaces are too ambiguous | Medium-leverage | Agent-Native | Agents cannot tell which memory surface is canonical. | Collapse terminology and fix placeholder memory first. |
| Large core modules are anti-agent | High-leverage | Agent-Native, Technical Debt | Agents cannot safely infer local change boundaries. | Refactor CI migration by domain. |

## Complexity Without Leverage

| Item | Why it exists | Why it survived | Why harmful now | Action |
| --- | --- | --- | --- | --- |
| Placeholder `memory.json` | Bootstrap scaffold for repo memory. | Shape checks pass and nobody made content meaningful. | It converts memory governance into symbolic compliance. | Remove or replace immediately. |
| README command docs not generated from live registry | Human-readable product docs. | README evolved separately from CLI dispatch. | It creates command truth drift. | Generate, reconcile, or demote stale commands. |
| Legacy/fallback shell paths without sunset dates | Downstream compatibility and environment variance. | Avoided breaking existing installs. | Makes runtime path ambiguous and harder to debug. | Keep only with owner, test, and removal date. |
| Broad contract aggregation | Convenient single policy file. | Easy place to add governance. | Turns schema into a policy bucket. | Split by bounded context. |
| Large CI migration core | Tracer-bullet implementation grew with real features. | It works and has tests. | New changes become migration-risk by default. | Refactor program. |
| Policy prose not tied to gates | Human reassurance and handoff clarity. | Docs are easier than executable checks. | Creates governance recursion and drift surface. | Delete or attach to enforcement. |
| Plugin/tool references without product proof | Tooling ambition and optional setup breadth. | Useful in Jamie's environment. | Looks sophisticated but may not improve repeatable workflows. | Ignore unless tied to a measured workflow. |

## Moat-Critical Systems

| System | Moat contribution | Compounds over time? | Strategic investment? | Complexity effect |
| --- | --- | --- | --- | --- |
| `HarnessDecision` and `harness next --json` | Makes safe next action explicit for agents. | Yes, if more commands emit compatible evidence. | Yes. | Complexity strengthens it only when schema stays compact. |
| Command capability catalog | Makes command surface machine-discoverable. | Yes, if docs/help are generated from it. | Yes. | Complexity weakens it if catalog becomes a passive directory. |
| Review-gate/current-head discipline | Prevents stale or self-approved PR execution. | Yes, through repeated review hardening. | Yes. | Complexity strengthens it when checks remain deterministic. |
| Packaged skill contract | Ports harness operating knowledge into target repos. | Yes, if fixture tested across repo states. | Yes. | Complexity weakens it when docs outpace tested behavior. |
| CI/check ownership parity | Preserves independent review/security/release split. | Yes, if drift is blocked. | Yes. | Complexity is justified because provider drift is expensive. |
| Learning/review-context loop | Converts repeated review failures into future guardrails. | Yes, if measured and promoted. | Yes. | Complexity weakens it if it becomes advisory-only context. |
| Project Brain/context memory | Can improve repository cognition. | Maybe. | Conditional. | Complexity weakens it until placeholder/staleness issues are solved. |

Fake moat systems:

- Raw command count.
- Long governance docs.
- Optional tool/plugin lists.
- Placeholder memory artifacts.
- Lexical validators without behavior tests.
- Large orchestrators framed as necessary sophistication.

Easy-to-copy systems:

- Basic CLI scaffolding.
- PR template checks.
- Static required-check manifests.
- Simple command catalog.
- Markdown docs and skill entrypoints.

Hard-to-copy systems:

- Real failure corpus converted into gates.
- Current-head review reliability.
- Downstream fixture matrix across messy repos.
- Measured reduction in review/rework loops.
- Developer trust that the harness knows when to stop.

## Fake Sophistication Signals

These should trigger skepticism:

| Signal | Why it is false sophistication | Correct response |
| --- | --- | --- |
| Adding another governance doc to restate existing policy | It increases drift surface without execution value. | Delete, link, or generate. |
| Adding a command for every workflow variant | It makes the product look capable while increasing selection ambiguity. | Route through cockpit or hide as plumbing. |
| Expanding memory/context before fixing placeholder memory | It deepens an untrusted system. | Fix canonical memory first. |
| Treating plugin/tool lists as architecture | Tool availability is not workflow leverage. | Require measured workflow improvement. |
| Adding tests only around current giant orchestrator shape | It can entrench bad boundaries. | Use characterization tests to enable extraction. |
| New prompt/routing layers without eval gains | Token cost rises without determinism. | Require eval before merge. |
| Turning every review finding into a Linear issue | It creates issue explosion and hides the few compounding fixes. | Group under initiatives and reject low-leverage items. |
| Treating ADR creation as progress | Decisions matter only when they constrain future work. | ADRs must include enforcement or routing impact. |

## Recommended Deletions

| Candidate | Why it exists | Why it survived | Why remove | Impact |
| --- | --- | --- | --- | --- |
| Placeholder `memory.json` content | Bootstrap memory scaffold. | Required shape check passes. | It is actively misleading. | High positive cognition impact. |
| Stale README command references | Product surface breadth. | Drift-gate warnings are non-blocking. | They confuse agents and users. | High discoverability impact. |
| Duplicate governance paragraphs | Reassurance and handoff. | Docs grew through accretion. | They create drift inventory. | Medium governance simplification. |
| Legacy fallback paths without owner/date | Compatibility. | Removal risk was deferred. | They obscure runtime truth. | Medium determinism gain. |
| Public aliases not used by docs/tests/cockpit | Convenience. | Low immediate cost. | They increase command surface entropy. | Medium agent UX gain. |
| Optional tool references not exercised by workflows | Environment ambition. | Helpful in local setup. | They look like capability without product proof. | Low-to-medium simplification. |

Do not delete:

- `HarnessDecision`.
- Command registry/capability catalog.
- Review-gate/current-head checks.
- CI ownership split.
- Packaged skill validators.
- `verify-work.sh` entrypoint.
- North-star contract.

## Refactor Candidates

| Candidate | Priority | Target shape | Execution artifact | Blocking condition |
| --- | --- | --- | --- | --- |
| `ci-migrate-core.ts` | P1 | Domain modules for plan, state, provider adapters, parity proof, break-glass, merge queue, reporting. | Refactor program | No new CI migration feature should grow the core. |
| `ci-migrate.test.ts` | P1 | Characterization plus module-specific fixtures. | Refactor program | Split after first runtime extraction. |
| `harness.contract.json` and `types-core.ts` | P2 | Context-specific schemas composed at publish boundary. | ADR plus refactor program | No new top-level policy domain without owner. |
| `verify-work.sh` internals | P2 | Thin shell plus typed gate spec/resume model. | Refactor program | Keep CLI/script invocation stable. |
| Skill validation | P2 | Fixture-backed install/update smoke tests. | Eval program | Keep lexical checks as fast guard. |
| Memory/context system | P2 | Single canonical memory contract plus retrieval-quality checks. | ADR plus eval program | Fix placeholder memory first. |
| Command docs | P1 | Generated from registry/capability catalog. | Governance change | Resolve 64 baseline warnings. |

## Anti-Drift Priorities

| Priority | Finding | Increases drift risk if ignored? | Improves determinism? | Improves cognition? | Improves local reasoning? | Reduces hidden coupling? | Simplifies execution? | Future-agent impact |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Command docs generated from live registry | Yes | Yes | Yes | Yes | Yes | Yes | Very high |
| 2 | Replace/remove placeholder `memory.json` | Yes | Yes | Yes | Medium | Medium | Yes | Very high |
| 3 | Freeze and split `ci-migrate-core.ts` | Yes | Medium | Yes | Yes | Yes | Medium | Very high |
| 4 | Command surface budget | Yes | Medium | Yes | Yes | Yes | Yes | High |
| 5 | Skill behavior fixtures | Yes | Yes | Yes | Medium | Medium | Medium | High |
| 6 | Contract bounded contexts | Yes | Medium | Yes | Yes | Yes | Medium | High |
| 7 | North-star telemetry | Yes | Medium | Medium | Low | Low | Medium | Medium-high |
| 8 | Shell gate spec extraction | Medium | Yes | Medium | Yes | Yes | Medium | Medium |

## Execution Priority Matrix

| Work item | Impact | Complexity | Strategic importance | Risk class | Enter Linear? | Artifact type | Do not implement if |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Replace or remove placeholder `memory.json` | High | Trivial | Operational | Governance risk, cognition risk | Yes | Issue | It is only rewritten with new placeholder prose. |
| Resolve README/CLI command drift | Critical | Moderate | Moat-critical | Drift risk, cognition risk | Yes | Project | It adds more manual docs instead of generating/reconciling truth. |
| Split `ci-migrate-core.ts` | Critical | Migration-risk | Architectural | Regression risk, migration risk | Yes | Refactor program | No characterization tests exist. |
| Add command surface budget | High | Moderate | Moat-critical | Governance risk, cognition risk | Yes | ADR plus issue | It becomes advisory prose only. |
| Add packaged skill fixture tests | High | Moderate | Operational | Regression risk, adoption risk | Yes | Eval program | It only checks strings. |
| Contract schema modularization | High | Difficult | Architectural | Migration risk, governance risk | Yes | ADR plus refactor program | It changes published contract shape without migration plan. |
| Measured PR lead-time telemetry | High | Moderate | Moat-critical | Strategy risk | Yes | Initiative | It cannot distinguish review/rework improvement. |
| Move `verify-work` logic to typed specs | Medium | Difficult | Operational | Regression risk | Yes | Refactor program | It breaks existing script entrypoint. |
| Add more governance docs | Low | Trivial | Cosmetic | Drift risk | No | None | Always reject unless tied to gate/failure. |
| Add more optional tool integrations | Low | Moderate | Cosmetic | Complexity risk | No | None | No measured workflow improvement. |

## Recommended Linear Initiatives

Planning rule:

Use these initiatives as the top-level execution containers. If proposed work
does not fit one of them, it is probably not important enough right now.

### Initiative 1: Operational Moat Hardening

Goal:

Make the actual moat measurable and compounding.

Projects:

- North-star telemetry for PR lead time, review retries, manual interventions,
  and failed-gate recovery time.
- Learning promotion loop from repeated review finding to test/gate/skill rule.
- Downstream fixture matrix for harness adoption.

Reject from this initiative:

- Brand/positioning work that does not improve adoption proof.
- Moat language edits without metric instrumentation.
- New integrations that do not feed the learning loop.

### Initiative 2: Agent Cockpit Compression

Goal:

Make the smallest compelling command path obvious and generated from runtime
truth.

Projects:

- README/CLI command truth reconciliation.
- Command docs generated from registry.
- Command surface budget enforcement.
- `harness next --json` canonical front-door pass.

Reject from this initiative:

- New public command variants.
- Manual README command tables not generated from registry truth.
- Prompt routing that bypasses command metadata.

### Initiative 3: CI Migration Boundary Recovery

Goal:

Turn the highest-risk orchestrator into bounded modules without breaking
behavior.

Projects:

- Characterization tests.
- Parity proof extraction.
- State store extraction.
- Provider adapter extraction.
- Break-glass and merge queue extraction.

Reject from this initiative:

- New CI migration features inside `ci-migrate-core.ts`.
- Refactors that only move code without reducing reasons to change.
- Test rewrites that preserve the same monolithic runtime shape.

### Initiative 4: Governance Simplification And Trust Repair

Goal:

Remove symbolic governance and keep only execution-changing rules.

Projects:

- Replace/remove placeholder `memory.json`.
- Delete duplicate policy prose.
- Add governance admission ADR.
- Add legacy fallback sunset registry.

Reject from this initiative:

- New governance docs without deletion of older prose.
- Advisory-only policies with no enforcement destination.
- Memory/context expansion before placeholder memory is resolved.

## Recommended ADRs

| ADR | Decision needed | Why now | Inputs |
| --- | --- | --- | --- |
| ADR: Command Surface Budget | Define cockpit/domain/plumbing/legacy limits and admission rules. | Command truth drift and 169 command files show surface pressure. | Command registry, README drift findings, architecture review. |
| ADR: Governance Admission Criteria | Require repeated-failure ID, enforcement destination, and deletion condition for new policy. | Prevent governance recursion. | North-star non-goals, review governance findings. |
| ADR: Contract Bounded Contexts | Split contract schema by domain while preserving published aggregate. | Contract/type core are broad policy aggregates. | `harness.contract.json`, `types-core.ts`. |
| ADR: Memory Surface Ownership | Decide whether `memory.json` is operational, fixture-only, or removed. | Placeholder memory conflicts with repo cognition model. | `memory.json`, PR template, Project Brain docs. |
| ADR: Cockpit Product Surface | Treat `init`, `next`, `verify-work`, `review-gate`, and learning/review context as the smallest compelling path. | Prevent feature/command sprawl. | Intent and architecture review smallest-version findings. |

## Recommended Refactor Programs

### Program 1: CI Migration Decomposition

Outcome:

`ci-migrate-core.ts` stops being the default destination for new CI migration
behavior.

First issues:

1. Add characterization tests for current public outputs.
2. Extract parity proof validation into typed module.
3. Extract state store and snapshot/signature logic.
4. Extract provider adapter boundary.
5. Extract break-glass and merge queue policies.

### Program 2: Command Truth Reconciliation

Outcome:

README/help/registry/dispatch agree by generation or strict validation.

First issues:

1. Inspect 64 drift-gate warnings and classify each as dispatch, docs removal,
   alias, or hidden plumbing.
2. Generate command docs from command registry.
3. Make drift-gate required for command-surface changes.

### Program 3: Skill Behavior Assurance

Outcome:

Packaged skill validity means target repo usability, not just no stale strings.

First issues:

1. Add fixture repo for clean install/init.
2. Add fixture repo with customized `.codex/environments/environment.toml`.
3. Prove documented skill commands resolve against built package.
4. Keep lexical validators as fast preflight.

### Program 4: Contract Modularization

Outcome:

Governance policy remains machine-readable without becoming one schema bucket.

First issues:

1. Map contract domains and owners.
2. Split type definitions by context.
3. Compose aggregate contract for published compatibility.
4. Add migration tests.

## Future Agent Operational Risks

| Risk | Agent failure mode | Token/cognition cost | Recommended compression |
| --- | --- | --- | --- |
| Command surface drift | Agent runs documented command that does not dispatch. | High | Generate docs from registry and route through `harness next`. |
| Placeholder memory | Agent trusts fake repo memory. | High | Replace/remove memory and mark fixture-only if needed. |
| CI migration core | Agent edits wrong concern in giant file. | Very high | Split domain modules and add ownership map. |
| Multiple memory concepts | Agent cannot tell whether `memory.json`, Project Brain, Local Memory, or review-context is canonical. | High | ADR plus single memory-surface map. |
| Shell validation internals | Agent cannot localize failure inside wrapper. | Medium-high | Typed gate specs and clearer run artifacts. |
| Governance docs saturation | Agent reads too much before acting. | High | Compress front doors and delete repeated policy. |
| Optional tool/plugin breadth | Agent assumes unsupported integration significance. | Medium | Mark optional tools as non-core unless exercised. |

Anti-agent architecture:

- Giant files with many reasons to change.
- Required placeholder evidence.
- Command docs not tied to dispatch.
- Advisory warnings that represent real product truth drift.
- Memory/context terms that overlap without ownership.
- Policy prose that cannot be tested.

## Recommended Compression Opportunities

| Compression | What to compress | Why | Output |
| --- | --- | --- | --- |
| Cockpit compression | User/agent entrypoints | Reduce command selection ambiguity. | Generated quick command map plus `harness next` docs. |
| Governance compression | Repeated docs and policy text | Reduce drift inventory. | One governance admission ADR and deleted duplicates. |
| Memory compression | `memory.json`, Project Brain, Local Memory, review-context terminology | Reduce false context. | Memory ownership ADR and health check. |
| CI migration compression | One giant core into domain modules | Improve local reasoning. | Refactor program. |
| Skill compression | Skill docs into executable behavior contracts | Improve downstream trust. | Fixture eval program. |
| Evidence compression | Many validation outputs into decision/evidence summary | Improve closeout readability. | Gate summary schema or enhanced decision envelope. |

## Findings That Should Not Become Work Items

Do not create work for:

- Generic architecture cleanup without a named hotspot.
- New docs that restate north-star, validation, or governance policy.
- New plugins or optional tools without measured workflow impact.
- New prompt/routing layers without eval evidence.
- Broad "improve memory" work before `memory.json` ownership is decided.
- CI migration feature work that grows `ci-migrate-core.ts`.
- More command aliases for convenience.
- More dashboards before PR lead-time telemetry is trustworthy.
- More review artifacts unless they reduce review/rework loops.
- More architecture review passes before the first four initiatives have owners.
- More "agent-native" wording changes that do not affect command routing,
  evidence, context, or validation behavior.

These are low-leverage or false-sophistication lanes. They increase the chance
of architecture sprawl while looking productive.

## Evidence & Traceability Matrix

| Conclusion | Evidence | Affected files/modules | Confidence | Operational impact | Strategic impact | Fact / interpretation / speculation |
| --- | --- | --- | --- | --- | --- | --- |
| Placeholder memory is the first trust repair | Intent lines identify `memory.json` placeholder; review risk table marks it medium-high; live file contains `repo: replace-with-repo-name`. | `memory.json`, `.github/PULL_REQUEST_TEMPLATE.md`, `.harness/memory/**` | High | Agents may trust meaningless governed context. | Weakens cognition moat. | Fact plus interpretation. |
| Command truth drift must become an execution project | Review records 64 non-blocking drift-gate warnings for README commands not dispatched in `src/cli.ts`. | `README.md`, `src/cli.ts`, command registry, `.harness/guardrails/north-star/drift-findings.json` | High | Agents/users may run stale commands. | Weakens agent-native product trust. | Fact. |
| CI migration decomposition is the highest-risk refactor program | Intent and review both cite `src/commands/ci-migrate-core.ts` at 10402 lines and `ci-migrate.test.ts` at 6319 lines. | `src/commands/ci-migrate-core.ts`, `src/commands/ci-migrate.test.ts` | High | High regression risk and poor local reasoning. | Large hotspot slows future moat work. | Fact plus interpretation. |
| Command cockpit and decision envelope are moat-critical | Intent/review identify `harness next --json`, `HarnessDecision`, and command catalog as stable agent-native surfaces. | `src/lib/decision/harness-decision.ts`, `src/commands/next.ts`, `src/lib/cli/registry/command-capabilities.ts` | High | Reduces execution ambiguity. | Core differentiator if kept compact. | Fact plus interpretation. |
| Governance is useful but must be pruned | Intent/review say governance layers are valuable but risk ceremony; north-star non-goals reject governance surface area as progress. | `harness.contract.json`, `docs/agents/**`, `.github/PULL_REQUEST_TEMPLATE.md`, `.circleci/config.yml` | Medium-high | Too many surfaces slow agents and humans. | Ceremony can beat product value. | Interpretation grounded in docs. |
| Packaged skill needs behavior tests | Review identifies skill validation as partly lexical; install JSON declares downstream capability boundaries. | `.agents/skills/coding-harness/**`, `scripts/validate-packaged-skill.cjs` | High | Downstream setup could fail despite passing string checks. | Skill is a product API and adoption surface. | Fact plus interpretation. |
| Contract schema needs bounded contexts | Review identifies `harness.contract.json` at 1120 lines and `types-core.ts` at 1776 lines as broad policy aggregate. | `harness.contract.json`, `src/lib/contract/types-core.ts` | Medium-high | Changes become global and risky. | Governance moat weakens if contract becomes junk drawer. | Interpretation grounded in file size/scope. |
| North-star telemetry is underbuilt | Prior artifacts say PR lead time is primary metric and review found stronger declared metrics than live measurement. | `harness.contract.json`, `docs/roadmap/north-star.md`, future telemetry surfaces | Medium | Cannot prove governance value. | Moat remains asserted, not measured. | Interpretation; needs telemetry validation. |
| Plugin/tool breadth is not a moat | Review found optional tools in install JSON but no general plugin runtime in repo. | `.agents/skills/coding-harness/references/agent-install.json`, package/tool docs | Medium | Optional tools can distract agents. | Easy-to-copy sophistication. | Interpretation. |
| Future-agent risk is driven by context cost and hidden coupling | Both artifacts identify broad command surface, large modules, layered docs, and memory ambiguity. | `src/commands/**`, `docs/**`, `.harness/**`, `memory.json` | Medium-high | Agents need more tokens and make riskier edits. | Adoption suffers if cockpit is not compressed. | Interpretation grounded in repository evidence. |
