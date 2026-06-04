---
artifact_schema: harness-document-lifecycle/v1
artifact_id: rand-mt-docs-patterns-audit
artifact_type: research-audit
source_type: operator-requested-audit
authority: secondary-context
lifecycle_status: reviewed
canonical_destination: .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: event-driven
validated_by:
  - pnpm docs:lint
  - pnpm docs:lifecycle
depends_on:
  - docs/architecture/documentation-layers.md
---

# rand_mt Documentation Patterns for Coding Harness

Date: 2026-06-04

Reference repository: <https://github.com/artichoke/rand_mt/tree/a36409d23bac908681f5e891f43a215ea8dbb84b/docs>

Coding Harness checkout: `/Users/jamiecraik/dev/coding-harness`

## Table of Contents

- [Executive Summary](#executive-summary)
- [1. Documentation Inventory](#1-documentation-inventory)
- [2. Information Architecture Analysis](#2-information-architecture-analysis)
- [3. Prose and Writing Style Analysis](#3-prose-and-writing-style-analysis)
- [4. Documentation Patterns](#4-documentation-patterns)
- [5. DDD Analysis](#5-ddd-analysis)
- [6. Canon vs Non-Canon Analysis](#6-canon-vs-non-canon-analysis)
- [7. Adaptation Opportunities](#7-adaptation-opportunities)
- [8. Documentation Gaps](#8-documentation-gaps)
- [9. Agent Compatibility Review](#9-agent-compatibility-review)
- [10. Proposed Coding Harness Documentation Architecture](#10-proposed-coding-harness-documentation-architecture)
- [11. Migration Roadmap](#11-migration-roadmap)
- [Avoid](#avoid)
- [Evidence Reviewed](#evidence-reviewed)

## Executive Summary

The rand_mt documentation is effective because it is small, explicit, and sharply typed by reader intent. The docs tree answers three questions without making the reader infer hierarchy:

- What is the policy? Use `docs/dependencies.md` and `docs/guardrails/**`.
- What repeated work exists? Use `docs/automations/**`.
- What is not here? User-facing API docs live in the crate README and crate docs; local development lives in `CONTRIBUTING.md`.

Coding Harness already has a more advanced governance system than rand_mt: layered docs, docs-gate, Project Brain, active artifacts, durable decisions, a packaged Codex skill, generated architecture context, and explicit Linear-to-merge lifecycle docs. The gap is not missing sophistication. The gap is that the reader must often determine document authority, lifecycle stage, and operational trigger by path, history, or repo knowledge.

The highest-value adoption is a typed documentation taxonomy that every important Coding Harness doc declares in frontmatter or a short metadata block: authority level, audience, lifecycle stage, canon class, maintenance trigger, owner, validation command, and dependencies. This mirrors rand_mt's plain routing while preserving Coding Harness' richer truth lanes.

Adopt immediately:

- Add a concise `docs/guardrails/` layer for durable review standards, separated from procedural SOPs.
- Add `docs/automations/` runbooks with stable automation-comment identity and feedback-loop capture rules.
- Add a documentation authority header template and index lint for Canon, Supporting, Generated, and Historical classes.
- Split the Linear issue-to-main lifecycle into a human journey and an agent truth-lane checklist.
- Promote `.harness/README.md` authority-level language into the main docs IA so agents do not have to discover it separately.

Adopt later:

- Build a context map for core domains: Intake, Planning, Implementation, Validation, Review, External State, Merge Readiness, Learning, and Runtime Evidence.
- Add small problem-to-solution runbooks for recurring drift classes.
- Add release/publication-style checklists for Harness package publishing and downstream scaffold changes.

Avoid:

- Copying rand_mt's Rust-specific content or crate-publication assumptions.
- Replacing Coding Harness' layered docs with a tiny docs tree. Coding Harness has more domains and needs more artifact classes.
- Treating generated architecture diagrams as canon. They are orientation aids unless a validator promotes a specific artifact.

## 1. Documentation Inventory

This inventory covers the reference repository's `docs/` directory at the requested commit.

| Document | Purpose | Audience | Lifecycle stage | Knowledge category | Dependencies on other documents | Canonical or supporting |
| --- | --- | --- | --- | --- | --- | --- |
| `docs/README.md` | Route readers to guardrails, supply-chain posture, and automation runbooks; define what docs belong outside this directory. | Maintainers, contributors, automation agents. | Entry and orientation. | Navigation, doc governance. | Points to crate `README.md`, crate docs, `CONTRIBUTING.md`, `guardrails/README.md`, `dependencies.md`, `automations/README.md`. | Canonical index for maintenance docs. |
| `docs/dependencies.md` | Define dependency and supply-chain posture: pinning, ownership, freshness, enforcement. | Maintainers, dependency automation, reviewers. | Policy and review. | Supply chain, toolchain governance. | Referenced by dependency sweep runbook and docs index; depends on manifests such as `Cargo.toml`, `mise.toml`, `package.json`, lockfiles. | Canonical policy. |
| `docs/automations/README.md` | Define automation conventions, especially distinguishing machine-authored comments from human feedback. | Automation authors, maintainers, Codex. | Automation entry. | Automation governance, learning loops. | Links to each automation runbook. | Canonical automation index. |
| `docs/automations/dependency-sweep.md` | Runbook for scheduled dependency maintenance not owned by Dependabot. | Dependency automation, maintainers. | Recurring maintenance. | Operational runbook, dependency governance. | Must read automation README and `dependencies.md`; references Dependabot ownership and package/tool manifests. | Canonical runbook for dependency sweep. |
| `docs/automations/github-actions-runner-images.md` | Runbook for runner image support, deprecations, brownouts, workflow labels, ruleset check names, and validation. | CI automation, maintainers. | Recurring maintenance and incident prevention. | Operational runbook, CI governance. | Must read automation README; depends on GitHub runner image docs, `.github/workflows/**`, recent CI, GitHub rulesets. | Canonical runbook for runner-image maintenance. |
| `docs/automations/rand-core.md` | Runbook for optional `rand_core` compatibility maintenance and release-prep follow-up. | Dependency automation, crate maintainer, reviewers. | Recurring maintenance, compatibility change, release prep. | Operational runbook, compatibility governance. | Must read automation README; depends on `Cargo.toml`, source integration files, README, `src/lib.rs`, CI workflow, upstream crate metadata/docs. | Canonical runbook for rand_core maintenance. |
| `docs/guardrails/README.md` | Route reviewers to guardrails for common classes of Rust crate work. | Reviewers, maintainers, agents. | Review entry. | Guardrail index, repository posture. | Links to individual guardrail pages; referenced by docs README. | Canonical guardrail index. |
| `docs/guardrails/api-stability-semver-and-msrv.md` | Define public API, semver classification, MSRV policy, feature flags, target support, deprecation, compatibility tooling, release checklist. | Maintainers, API reviewers, release owners. | Design review, PR review, release prep. | API compatibility, versioning, release governance. | Depends on README compatibility claims, Cargo metadata, CI/MSRV checks, release process. | Canonical guardrail. |
| `docs/guardrails/ffi-bindings-and-foreign-runtime-integration.md` | Define boundary model for FFI, raw bindings, safe wrappers, ABI/layout/ownership/string/error/callback/unwinding/runtime behavior, generated bindings, vendored source, testing. | Unsafe/FFI implementers, reviewers. | Design and review. | Boundary design, runtime integration, safety. | Depends on platform docs, upstream ABI docs, generated bindings, tests. | Canonical guardrail. |
| `docs/guardrails/high-quality-rust-code.md` | Define Rust implementation quality: design principles, crate root policy, public API quality, docs, errors, tests, CI, dependencies, features, performance. | Contributors, reviewers, maintainers. | Implementation and review. | Code quality, maintainability. | Depends on Rust idioms, CI checks, README/API docs, dependency posture. | Canonical guardrail. |
| `docs/guardrails/performance-allocation-and-memory-behavior.md` | Define performance contracts, benchmarks, allocation, capacity, footprint, copying, structures, drop/leak behavior, no_std/alloc, FFI performance, regression detection. | Performance-sensitive implementers, reviewers. | Design, implementation, review. | Performance and memory governance. | Depends on benchmark evidence, CI, public claims, FFI docs when relevant. | Canonical guardrail. |
| `docs/guardrails/platform-specific-code.md` | Define explicit platform support, cfg boundaries, docs.rs behavior, platform semantics, wrappers, CI matrix, dependencies, bindings, linkage, error semantics. | Platform implementers, CI maintainers, reviewers. | Design, implementation, review. | Platform compatibility. | Depends on Cargo/docs.rs config, CI matrix, platform APIs. | Canonical guardrail. |
| `docs/guardrails/testing-compatibility-and-conformance.md` | Define testing layers, compatibility and conformance tests, regressions, feature/platform matrices, unsafe verification, golden fixtures, compile-fail tests, flaky tests, CI expectations. | Test authors, maintainers, agents. | Implementation, review, CI maintenance. | Testing strategy, compatibility proof. | Depends on CI workflow, upstream conformance sources, golden fixtures, Rust test tools. | Canonical guardrail. |
| `docs/guardrails/unsafe-code.md` | Define when unsafe is allowed, documentation obligations, encapsulation, proof obligations, verification, platform wrappers, public unsafe APIs, experimental unsafe disclosure, review checklist. | Unsafe implementers, reviewers, maintainers. | Design, implementation, review. | Safety, proof obligations. | Depends on Rust Reference, Rustonomicon, Miri/platform CI, README risk disclosure. | Canonical guardrail. |
| `docs/guardrails/working-in-public-and-publishing-oss-crates.md` | Define public repository shape, issue/PR discipline, Cargo metadata, versioning/MSRV, publishing, CI/supply chain, docs-as-release, maturity disclosure, release checklist. | OSS maintainers, release owners, automation agents. | Project maintenance, PR review, release prep. | Public operations, release governance. | Depends on README, Cargo metadata, CI, crates.io/docs.rs, release workflow. | Canonical guardrail. |

## 2. Information Architecture Analysis

Navigation patterns:

- rand_mt uses one top-level docs index with three obvious categories: guardrails, supply chain, and automations. This works because each category maps to an operator question: review standard, dependency policy, or repeated maintenance task.
- Coding Harness uses a layered model in `docs/README.md` and `docs/architecture/documentation-layers.md`: Layer 0 repo-facing baseline, Layer 1 quickstart, Layer 2 core concepts, Layer 3 extended reference. This is strong for a larger system but currently requires readers to understand both layers and authority levels across `.harness/**`.

Hierarchical structure:

- rand_mt has shallow hierarchy: `docs/`, `docs/guardrails/`, `docs/automations/`. The depth is meaningful; folder name equals document type.
- Coding Harness has multiple meaningful hierarchies: `docs/agents/**`, `docs/architecture/**`, `docs/plans/**`, `docs/specs/**`, `docs/goals/**`, `.harness/core/**`, `.harness/decisions/**`, `.harness/knowledge/**`, `.agents/skills/**`, and generated `AI/context/**`. The richer map is appropriate, but the reader needs a visible taxonomy that says which paths are canon, execution input, secondary context, generated runtime, or historical.

Separation of concerns:

- rand_mt cleanly separates public API docs, local contributor setup, maintenance policy, and recurring automation.
- Coding Harness separates many concerns but sometimes mixes operating policy, rollout history, implementation plan, and agent procedure in the same path family. The existing `.harness/README.md` authority levels are a good internal model that should be surfaced earlier.

Progressive disclosure:

- rand_mt's progressive disclosure is path-based: index to guardrail index to specific guardrail.
- Coding Harness' progressive disclosure is formal: layer 0 through 3, plus instruction map routing. It is more powerful, but agents can still spend tokens opening broad docs because the metadata contract is implicit.

Reader journeys:

- rand_mt supports reviewer journeys: "I am touching unsafe code; read unsafe guardrail." It supports automation journeys: "I am the runner-image automation; read automation README and this runbook."
- Coding Harness supports several journeys: new agent via `harness next --json`, new human via README, operator via AGENTS, contributor via quickstart, maintainer via instruction map, implementation via specs/plans, governance via Project Brain and decisions. The journey map exists, but it should be expressed as a table of human and agent entrypoints with "stop after reading X unless Y" rules.

Onboarding:

- rand_mt explicitly says what not to read for API and setup; this reduces wrong-entry loading.
- Coding Harness README provides a rich onboarding path, including `harness next --json`, init, contract validation, and health checks. For agents, onboarding would be stronger if the docs index repeated "agent first reads `AGENTS.md`, then `harness next --json`, then only the routed SOP."

Advanced concepts:

- rand_mt introduces advanced concepts by risk category: unsafe, FFI, platform, performance, API stability.
- Coding Harness introduces advanced concepts by governance surface: docs-gate, review-gate, Linear workflow, Project Brain, runtime cards, delivery truth. The concepts are strong but should be grouped by domain bounded context and truth lane so readers see why they exist.

Why these patterns are effective:

- They reduce cognitive branching.
- They make review standards durable.
- They keep automation prompts slim by making repository docs the long-lived policy.
- They expose update triggers, so docs change with behavior rather than after drift.
- They separate source-of-truth policy from explanatory background and generated evidence.

## 3. Prose and Writing Style Analysis

Tone:

- rand_mt is direct, maintainer-owned, and concrete. It uses "should", "must", "do not", and "prefer" without sounding bureaucratic.
- Coding Harness is similarly direct but more concept-dense. It often carries governance, product, validation, and runtime language in the same paragraph.

Clarity:

- rand_mt uses short lead paragraphs that define the purpose of a page immediately.
- Coding Harness has strong canonical statements, especially the north-star table in README and the Linear transition table, but some pages require reader familiarity with internal terms before the purpose is obvious.

Brevity:

- rand_mt keeps pages mostly between 18 and 292 lines. It favors compact policy plus checklist.
- Coding Harness has necessary depth, but front-door files can become long. README is product, install, workflow, command index, and trust-artifact overview in one file. The doc layer model already recognizes line budgets; enforcing those budgets more broadly would help.

Technical depth:

- rand_mt goes deep only inside risk-specific guardrails. That keeps advanced detail close to the risk that needs it.
- Coding Harness goes deep in operational specs, architecture artifacts, and governance docs. The depth is valuable, but should be explicitly marked as maintainer reference, not first-contact reading.

Consistency:

- rand_mt repeats page shapes: default stance, scope, sources, decision rules, validation, checklist, references.
- Coding Harness repeats table-of-contents, validation, and governance language, but could benefit from type-specific templates for guardrail, automation, SOP, spec, plan, decision, generated artifact, and audit pages.

Examples:

- rand_mt uses small command snippets and concrete examples only where they clarify an operation.
- Coding Harness has strong command examples, especially README start paths and the Linear workflow command surface. It should keep examples tied to lifecycle stage and expected evidence.

Diagrams:

- rand_mt uses no diagrams in the docs tree reviewed. It does not need them because the domain is compact.
- Coding Harness needs diagrams because its lifecycle and truth lanes are multi-system. Generated `AI/context/diagram-context.md` is useful as orientation, but should not replace hand-authored lifecycle and context maps.

Code snippets:

- rand_mt uses snippets as executable policy examples, such as unsafe lint attributes and GitHub ruleset commands.
- Coding Harness should continue using snippets for exact commands, but distinguish human commands, agent commands, and validator commands.

Cross-linking:

- rand_mt cross-links sparingly and purposefully.
- Coding Harness cross-links heavily, which is appropriate for breadth, but cross-links should include relationship meaning: "source of truth", "operational companion", "generated context", "historical evidence", or "example".

Reusable writing principles:

- Start every doc with the work it owns.
- State what is out of scope.
- Give the reader the next document only when needed.
- Prefer "Default stance" before exceptions.
- Put review checklists at the end of risk-specific guardrails.
- Keep automation prompts thin and runbooks thick.
- Use concrete sources for date-sensitive or external-state claims.
- Say which human feedback must update the runbook before the next automation run.
- Treat documentation as part of release and maintenance, not as post-facto commentary.

Strong patterns worth reusing:

- `docs/README.md`: "Use X for API, Y for contributing, this directory for policy/runbooks."
- `docs/automations/README.md`: stable machine-comment prefix separating automation state from human feedback.
- `docs/automations/github-actions-runner-images.md`: "Sources", "Decision Rules", "Changes", and "Validation and Summary" sections.
- `docs/guardrails/unsafe-code.md`: acceptable/not-appropriate use, proof obligations, verification, and review checklist.
- `docs/guardrails/testing-compatibility-and-conformance.md`: taxonomy of test layers plus flake policy.

## 4. Documentation Patterns

| Pattern | Description | Why it works | Suitability for Coding Harness | Effort | Expected value |
| --- | --- | --- | --- | --- | --- |
| Index -> typed folder -> focused page | A short index routes to folders whose names encode purpose. | Reduces search and wrong-context loading. | High; map `docs/guardrails`, `docs/automations`, `docs/runbooks`, `docs/reference`. | Medium | High |
| Default stance -> exceptions | Start with the normal rule, then list acceptable exceptions. | Reviewers can classify changes quickly. | High for autonomy, evidence, branch protection, generated artifacts, docs-gate, review state. | Low | High |
| Scope -> sources -> decision rules -> validation | Runbook pattern for recurring automation. | Makes automation repeatable and auditable. | High for Linear sweep, PR review sweep, CodeRabbit follow-up, CI green sweep, dependency/toolchain refresh. | Medium | High |
| Human feedback updates guardrail before recurrence | Automation must absorb repeated feedback into docs. | Converts steering into durable learning. | Very high; this is already a Coding Harness north-star rule. | Low | High |
| Stable automation identity prefix | Machine-authored PR comments use a stable prefix. | Prevents agents from confusing their own state with human feedback. | High; use for Coding Harness automations and PR comments. | Low | High |
| Risk-specific guardrails | Pages for unsafe, FFI, platform, performance, API stability. | Review depth only appears where risk warrants it. | High; create guardrails for external state, delivery truth, review state, runtime evidence, generated artifacts, automation authority, HILT. | Medium | High |
| Review checklist at the end | Each guardrail ends in specific reviewer questions. | Converts prose into review behavior. | High; especially useful for Codex and CodeRabbit review prompts. | Low | High |
| Documentation is part of release | Release checklist includes docs, metadata, examples, package validation. | Prevents public contract drift. | High; adapt to npm package, downstream scaffold, skill package, action templates. | Medium | High |
| Operational runbook per recurring task | Scheduled tasks have thick runbooks and thin prompts. | Keeps prompts stable and repo-owned. | High; fits Coding Harness automations and heartbeat-style work. | Medium | High |
| Explicit source hierarchy | Date-sensitive automation lists authoritative external sources. | Avoids memory-based stale decisions. | High; external-state, PR, CI, Linear, GitHub rulesets all need this. | Low | High |
| Small examples | Examples are concrete, minimal, and tied to a rule. | Improves actionability without tutorial sprawl. | Medium; Coding Harness examples should be lifecycle-state-specific. | Low | Medium |
| Public limitations disclosure | Experimental or risky surfaces say so plainly. | Builds trust by naming limits. | High; vital for advisory packets, generated evidence, runtime cards, incomplete integrations. | Low | High |
| Cargo/public metadata discipline | Metadata is treated as public API. | Prevents package-level trust drift. | Medium; translate to npm metadata, CLI command catalog, scaffolded templates. | Medium | Medium |
| Golden fixture guidance | Fixtures are small, named, traceable, and reviewed when changed. | Makes generated evidence reviewable. | High; Coding Harness has many JSON fixtures and artifact contracts. | Low | High |
| Compile-fail/negative contract tests | Some contracts prove absence or refusal. | Protects safety boundaries. | High; adapt to "must refuse merge-readiness claim", "must not execute advisory targetCommand". | Medium | High |

## 5. DDD Analysis

Evidence of DDD in rand_mt:

- Ubiquitous language: terms such as MSRV, semver, feature flags, target support, unsafe code, FFI, safe wrappers, platform semantics, runner images, dependency sweep, and publish workflow are used consistently.
- Bounded contexts: guardrails are natural contexts around API compatibility, unsafe/FFI, platform behavior, testing/conformance, performance/memory, supply chain, and public publishing.
- Context maps: there is no formal context map, but dependencies between docs act as a lightweight map. Automation runbooks explicitly name which policies and source files they depend on.
- Domain concepts: public API, compatibility promise, unsafe proof obligation, CI as support statement, generated fixture as contract, automation state vs human feedback.
- Core domain focus: the core domain is maintaining trustworthy Rust crates in public. The docs protect public contract, safety, compatibility, and release quality.
- Explicit terminology: the docs define terms through use and section headings rather than a glossary.
- Domain ownership: automation pages name ownership boundaries: Dependabot owns some updates; a specific automation owns others; humans own risky release decisions.

How similar approaches strengthen Coding Harness:

- Coding Harness already has a glossary in `UBIQUITOUS_LANGUAGE.md` and a Linear workflow state machine. The next step is a bounded-context map that names core domains and document owners.
- Candidate bounded contexts: Issue Intake, Specification, Planning, Implementation, Local Validation, Pre-Commit, PR Creation, PR Review, CI/Checks, External State, Merge Readiness, Main Sync, Runtime Evidence, Learning Loop, Project Brain, Automation Authority.
- Each context should have: canonical terms, source-of-truth artifacts, allowed claims, forbidden claims, validation commands, and handoff state.
- The "truth lanes" model is a DDD boundary: local code truth, PR state, CI state, review-thread state, tracker state, artifact state, merge readiness, and post-merge main sync must remain separate contexts until a composition contract joins them.

DDD recommendation:

Create `docs/domain/context-map.md` and `docs/domain/ubiquitous-language.md` or keep the existing root glossary but add context ownership columns. The context map should be hand-authored, short, and canonical. Generated diagrams can support it but should not replace it.

## 6. Canon vs Non-Canon Analysis

rand_mt classification:

| Class | Reference docs |
| --- | --- |
| Canon | `docs/dependencies.md`, `docs/guardrails/**`, `docs/automations/**` for their owned maintenance lanes, `docs/README.md` as docs index. |
| Supporting | External references in guardrail pages, examples/snippets inside runbooks, crate README/crate docs for user API outside reviewed docs tree. |
| Generated | None apparent in the reviewed docs tree. |
| Historical | None apparent in the reviewed docs tree; history lives in git, issues, PRs, and release artifacts. |

Current Coding Harness classification:

| Class | Coding Harness surfaces |
| --- | --- |
| Canon | `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `CODESTYLE.md`, `codestyle/**`, `docs/README.md`, `docs/architecture/documentation-layers.md`, `docs/agents/01-instruction-map.md`, `docs/agents/02-tooling-policy.md`, `docs/agents/04-validation.md`, `docs/agents/06-security-and-governance.md`, `docs/agents/13-linear-production-workflow.md`, `harness.contract.json`, `.harness/core/**`, `.harness/decisions/**`, `.harness/ci-required-checks.json`, `.harness/artifact-provenance.json`, `.agents/skills/coding-harness/SKILL.md`. |
| Supporting | `docs/advanced-workflows.md`, `docs/agents/**-operational-spec.md`, `docs/architecture/**`, `docs/examples/**`, `docs/prompts/**`, `.harness/knowledge/**`, `.harness/features/**`, `.harness/implementation-notes/**`, `.harness/evals/**.md`. |
| Generated | `AI/context/diagram-context.md`, `AI/context/refresh.log`, `.harness/evidence/**`, `.harness/ci-migrate-snapshots/**`, generated guardrail snapshots under `.harness/guardrails/**`, runtime cards and receipts, benchmark run JSON. |
| Historical | `docs/archive/**`, older brainstorms/plans/specs not referenced by active artifacts, superseded implementation notes, old snapshots not consumed by validators. |

Recommended Coding Harness canon model:

| Class | Definition | Rules |
| --- | --- | --- |
| Canon | Source-of-truth policy, architecture, workflow, command, domain, and contract docs that can constrain implementation or closeout claims. | Must have owner, maintenance trigger, last reviewed/validated date, dependencies, validation command or explicit n.a., and docs-gate coverage. |
| Supporting | Explanatory, tutorial, example, runbook, or deep-reference docs that help execute canon but do not independently authorize behavior. | Must link to canon source and state whether it can be stale without blocking delivery. |
| Generated | Machine-produced orientation, evidence, snapshots, metrics, diagrams, packets, receipts. | Must include generator, generated timestamp, source inputs, checksum or head SHA when claim-bearing, and allowed claim families. |
| Historical | Archived plans, old audits, superseded specs, closed decisions, obsolete run outputs. | Must be clearly archived, excluded from routing by default, and linked only as background evidence. |

## 7. Adaptation Opportunities

| Impact | Current state | Proposed change | Expected benefit | Risks | Dependencies | Migration effort |
| --- | --- | --- | --- | --- | --- | --- |
| High | Coding Harness has rich docs but authority often inferred from path and repo lore. | Add `authority`, `audience`, `lifecycle_stage`, `canon_class`, `owner`, `maintenance_trigger`, `validation`, and `depends_on` metadata to canonical docs. | Agents load less context and make fewer false authority claims. | Metadata can drift if not linted. | docs-gate, markdown frontmatter validator. | Medium |
| High | `.harness/README.md` has excellent authority levels but is not the main docs entry. | Surface authority levels in `docs/README.md` and `docs/architecture/documentation-layers.md`. | Makes canon/support/generated/historical visible to humans and agents. | Duplicated wording if not linked carefully. | Docs-gate required surfaces. | Low |
| High | Agent lifecycle is split across README, Linear workflow, AGENTS, docs-gate, review-gate, and runtime-card docs. | Add `docs/lifecycle/issue-to-main.md` as a canonical lifecycle map with truth lanes and feedback loops. | Explains "Linear issue -> spec -> plan -> implement -> pre-commit -> review -> commit -> PR -> Codex/CodeRabbit -> green -> merge -> main sync." | Could become too large if it embeds all SOPs. | Existing Linear workflow, visual artifact, PR closeout contracts. | Medium |
| High | Review standards exist but are scattered by governance doc and codestyle modules. | Create `docs/guardrails/README.md` plus focused guardrails for runtime evidence, external state, review state, generated artifacts, automation authority, and delivery truth. | Converts expert judgment into small review standards. | Overlap with CODESTYLE if boundaries unclear. | CODESTYLE docs module, docs-gate. | Medium |
| High | Automations exist, but runbook conventions are less visibly standardized. | Create `docs/automations/README.md` convention with stable machine-comment prefixes and runbook template. | Keeps automation prompts slim and learning-loop updates durable. | Requires aligning existing automation docs. | Existing `docs/automations/**`, feedback-loop ledger. | Medium |
| High | Repeated steering is a north-star rule, but feedback-loop fit in lifecycle is visually and textually distributed. | Add feedback-loop stage to lifecycle docs: review feedback, CI failures, user steering, automation misses, and repeated command failures update guardrails/tests/skills/Project Brain before recurrence. | Clarifies where learning enters the issue-to-main cycle. | Can slow delivery if over-applied to one-off issues. | Project Brain, `.harness/feedback-loops/index.json`, AGENTS rule. | Low |
| Medium | Docs index is layered but does not mark every document's stage. | Add document taxonomy table to `docs/README.md` with doc type and lifecycle stage. | Better discoverability. | Larger index. | Documentation layer model. | Low |
| Medium | Plans/specs/brainstorms are numerous. | Add lifecycle-state headers: draft, approved, active, superseded, historical. | Reduces stale-plan misrouting. | Requires inventory. | `.harness/active-artifacts.md`, plan/spec gates. | Medium |
| Medium | Generated diagram context is powerful but very large. | Add a short hand-authored context map and use generated diagrams as supporting orientation. | Better DDD clarity and agent loading efficiency. | Manual map can drift. | Diagram freshness guard, architecture docs. | Medium |
| Medium | Command examples sometimes mix human and agent usage. | Label examples as `human`, `agent-read-only`, `agent-mutative`, `validator`. | Prevents agents from executing risky paths. | More formatting work. | CLI reference and README. | Low |
| Medium | Release and package governance exists across docs. | Add package-publication guardrail adapting rand_mt's "documentation is part of release" pattern to npm, packaged skills, and downstream scaffold templates. | Reduces package/release drift. | Could duplicate release docs. | Release/change-control docs. | Medium |
| Low | External references exist but are not always source-ranked. | Add "Sources" sections to external-state runbooks. | Avoids stale memory. | Minor doc churn. | GitHub/Linear/CI SOPs. | Low |
| Low | Some old plans/specs remain in active docs tree. | Add archive promotion rules and periodic pruning. | Less agent confusion. | Historical context may feel harder to find. | docs-gate and archive index. | Medium |

## 8. Documentation Gaps

Ranked by strategic value, developer productivity, agent usability, maintainability, and knowledge durability.

| Rank | Gap | Why it matters | Strategic value | Developer productivity | Agent usability | Maintainability | Durability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Canon class and authority metadata on docs. | Agents need to know whether a doc can constrain behavior or only explain it. | High | High | High | High | High |
| 2 | Issue-to-main lifecycle map with truth lanes and feedback loop. | Users and agents need one coherent operating model for Linear-to-main. | High | High | High | High | High |
| 3 | Guardrail folder for durable review standards. | Keeps review judgment focused and reusable. | High | High | High | High | High |
| 4 | Automation runbook convention with stable machine identity. | Prevents automation state from being mistaken for human feedback. | High | Medium | High | High | High |
| 5 | DDD context map for core domains and claims. | Makes bounded contexts and claim authority explicit. | High | Medium | High | High | High |
| 6 | Lifecycle-state headers for plans/specs/goals. | Reduces stale artifact routing. | Medium | High | High | Medium | High |
| 7 | Generated artifact contract header. | Distinguishes generated orientation from claim-bearing evidence. | Medium | Medium | High | High | High |
| 8 | Review checklists per high-risk domain. | Converts principles into reviewer behavior. | Medium | High | Medium | Medium | Medium |
| 9 | Package/scaffold release guardrail. | Treats generated downstream surfaces as public API. | Medium | Medium | Medium | High | Medium |
| 10 | Source-ranked external-state runbooks. | Improves freshness discipline for CI, PR, Linear, GitHub rulesets. | Medium | Medium | High | Medium | Medium |

## 9. Agent Compatibility Review

Discoverability:

- rand_mt is highly discoverable because the docs tree is small and folder names map to intent.
- Coding Harness is discoverable through `AGENTS.md`, `docs/README.md`, `docs/agents/01-instruction-map.md`, and `harness next --json`, but agents still need to classify many surfaces.

Context loading efficiency:

- rand_mt lets agents load one index and one task-specific doc.
- Coding Harness can reach the same efficiency by combining `harness next --json` with doc metadata that names the next single SOP or guardrail.

Explicit instructions:

- rand_mt runbooks directly state "must read X and Y before running."
- Coding Harness already has strong mandatory instructions in AGENTS and skills; add the same "must read" line to automation and lifecycle docs.

Canonical sources:

- rand_mt's canon is easy to infer.
- Coding Harness should make canon explicit with metadata and a generated index checked by docs-gate.

Cross-linking:

- rand_mt links sparingly.
- Coding Harness should preserve cross-linking but type each relationship: canon, companion, generated, historical, example, or validator.

Ambiguity:

- rand_mt reduces ambiguity through "Default Stance" and "Do not" language.
- Coding Harness should add default-stance sections to agent-risk docs: external-state truth, review-state truth, merge-readiness truth, automation authority, generated-artifact authority.

Drift resistance:

- rand_mt uses "update docs in same PR" and automation-feedback loops.
- Coding Harness has docs-gate and repeated-steering rules, which are stronger. The missing piece is metadata linting across all canonical docs and lifecycle artifacts.

Recommendations for Codex and agent workflows:

- Add an `agent_entrypoint` field to canonical docs that says whether Codex should read the doc automatically, only when routed, or never by default.
- Add a `claim_authority` field to generated artifacts: allowed claim families and forbidden claim families.
- Add an `update_when` field to each guardrail and runbook.
- Add a `truth_lane` field for lifecycle docs: local, PR, CI, review, tracker, artifact, merge, main-sync, learning.
- Add a lightweight `harness docs-index --json` command or extend an existing command to emit the doc taxonomy for agents.

## 10. Proposed Coding Harness Documentation Architecture

Folder structure:

```text
README.md
AGENTS.md
ARCHITECTURE.md
CODESTYLE.md
UBIQUITOUS_LANGUAGE.md
harness.contract.json

docs/
  README.md
  lifecycle/
    issue-to-main.md
    feedback-loop.md
    truth-lanes.md
  domain/
    context-map.md
    ubiquitous-language.md
    claim-authority.md
  guardrails/
    README.md
    automation-authority.md
    delivery-truth.md
    external-state.md
    generated-artifacts.md
    review-state.md
    runtime-evidence.md
    package-and-scaffold-release.md
  automations/
    README.md
    ci-green-sweep.md
    coderabbit-review-sweep.md
    linear-sync.md
    dependency-and-toolchain-refresh.md
  agents/
    quickstart.md
    01-instruction-map.md
    ...
  architecture/
    documentation-layers.md
    root-surface-classification.md
    ...
  reference/
    cli-reference.md
    workflow-artifact-registry.md
  examples/
    ...
  archive/
    ...

.harness/
  README.md
  core/
  decisions/
  active-artifacts.md
  audits/
  knowledge/
  evidence/        # generated unless promoted

.agents/
  skills/
    coding-harness/
      SKILL.md
      references/

AI/context/
  diagram-context.md # generated supporting orientation
```

Document taxonomy:

| Type | Purpose | Canon class | Required metadata |
| --- | --- | --- | --- |
| Entry | Route humans and agents. | Canon | audience, next docs, stop rule, maintenance trigger. |
| Guardrail | Durable review standard for a risk domain. | Canon | default stance, allowed exceptions, proof obligations, review checklist, validation. |
| Runbook | Repeatable operational workflow. | Canon or supporting | schedule/trigger, scope, sources, decision rules, changes, validation, summary format. |
| SOP | Active procedure for contributors or agents. | Canon | owner, lifecycle stage, command contract, dependencies. |
| Spec | Approved feature behavior. | Execution input while active; historical after closure. | status, issue, owner, acceptance criteria, supersession. |
| Plan | Implementation sequencing. | Execution input while active; historical after closure. | status, issue, dependencies, validation gates. |
| Decision | Accepted tradeoff. | Canon decision. | alternatives, decision, consequences, revisit trigger. |
| Generated artifact | Machine-produced context/evidence. | Generated unless promoted. | generator, source refs, timestamp, head SHA/checksum, allowed claims. |
| Audit | Advisory analysis. | Supporting unless adopted by plan/spec/decision. | scope, evidence, findings, recommendations, adoption status. |
| Historical | Preserved background. | Historical. | superseded-by or archived reason. |

Canon model:

- Canon: `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `CODESTYLE.md`, `docs/lifecycle/**`, `docs/domain/**`, `docs/guardrails/**`, selected `docs/agents/**`, `harness.contract.json`, `.harness/core/**`, `.harness/decisions/**`, packaged skill entrypoints.
- Supporting: examples, deep references, operational specs, audits, knowledge summaries.
- Generated: diagram context, runtime evidence, snapshots, benchmark run outputs, receipts unless promoted.
- Historical: archives, superseded plans/specs/goals/brainstorms.

Agent entry points:

- First: `AGENTS.md`.
- Then: `harness next --json`.
- For docs routing: `docs/README.md` or future `harness docs-index --json`.
- For task execution: one routed SOP or runbook.
- For risk review: one guardrail.
- For implementation authority: active spec/plan/goal referenced by `.harness/active-artifacts.md`.

Human entry points:

- Product orientation: `README.md`.
- Contribution/setup: `CONTRIBUTING.md`, `docs/agents/quickstart.md`.
- Operating model: `docs/lifecycle/issue-to-main.md`.
- Architecture: `ARCHITECTURE.md` and `docs/domain/context-map.md`.
- Governance: `docs/guardrails/README.md`, `docs/agents/01-instruction-map.md`.

Governance model:

- Canon docs require metadata and docs-gate coverage.
- Every guardrail has a review checklist and validation route.
- Every automation has a runbook, stable machine identity, source list, validation summary, and feedback-loop update rule.
- Every generated artifact declares allowed and forbidden claim families.
- Active plans/specs/goals declare status and supersession.
- Historical docs are preserved but excluded from default agent routing.

## 11. Migration Roadmap

30 days:

- Add doc metadata template and update the top 12 canon docs.
- Add `docs/lifecycle/issue-to-main.md` with truth lanes and feedback loop.
- Add `docs/guardrails/README.md` and two first guardrails: `delivery-truth.md` and `generated-artifacts.md`.
- Add `docs/automations/README.md` with stable automation comment prefix and runbook template.
- Update `docs/README.md` to expose canon/support/generated/historical classes and `.harness/README.md` authority levels.

60 days:

- Add domain context map and claim-authority docs.
- Convert high-value recurring workflows into runbooks: CI green sweep, CodeRabbit review sweep, Linear sync, dependency/toolchain refresh.
- Add lifecycle-state headers to active plans/specs/goals and mark superseded/historical items.
- Add docs-gate checks for required metadata on canonical docs.
- Add generated artifact header requirements for diagram context, runtime cards, evidence receipts, and snapshots.

90 days:

- Add `harness docs-index --json` or extend existing agent-readiness output to emit doc taxonomy and routing.
- Add guardrails for external state, review state, automation authority, runtime evidence, and package/scaffold release.
- Connect guardrail checklists to reviewer roles and CodeRabbit/Codex review prompts.
- Prune or archive stale plans/specs/brainstorms based on active-artifacts and supersession metadata.
- Add regression fixtures proving agents route to one SOP/guardrail instead of loading broad docs.

## Avoid

- Do not copy Rust-specific domain policies into Coding Harness. Translate the pattern, not the content.
- Do not shrink Coding Harness documentation by deleting governance surfaces that support runtime evidence and delivery truth.
- Do not let generated diagrams become the canonical architecture map. Keep a human-authored domain/context map.
- Do not create guardrails that are just essays. Each guardrail needs default stance, exceptions, proof obligations, validation, and review checklist.
- Do not make automations depend on long prompts. Prompts should route to repo-owned runbooks.
- Do not flatten every artifact into `docs/`. Keep `.harness/**` for control-plane authority and evidence, but expose its authority model in docs.

## Evidence Reviewed

Reference repository:

- `docs/README.md`
- `docs/dependencies.md`
- `docs/automations/README.md`
- `docs/automations/dependency-sweep.md`
- `docs/automations/github-actions-runner-images.md`
- `docs/automations/rand-core.md`
- `docs/guardrails/README.md`
- `docs/guardrails/api-stability-semver-and-msrv.md`
- `docs/guardrails/ffi-bindings-and-foreign-runtime-integration.md`
- `docs/guardrails/high-quality-rust-code.md`
- `docs/guardrails/performance-allocation-and-memory-behavior.md`
- `docs/guardrails/platform-specific-code.md`
- `docs/guardrails/testing-compatibility-and-conformance.md`
- `docs/guardrails/unsafe-code.md`
- `docs/guardrails/working-in-public-and-publishing-oss-crates.md`

Coding Harness surfaces:

- `README.md`
- `AGENTS.md`
- `CODESTYLE.md`
- `ARCHITECTURE.md`
- `UBIQUITOUS_LANGUAGE.md`
- `docs/README.md`
- `docs/architecture/documentation-layers.md`
- `docs/agents/01-instruction-map.md`
- `docs/agents/07b-agent-governance.md`
- `docs/agents/13-linear-production-workflow.md`
- `docs/agents/14-docs-gate-rollout.md`
- `.harness/README.md`
- `.harness/core/README.md`
- `.harness/decisions/README.md`
- `.harness/active-artifacts.md`
- `.harness/knowledge/INDEX.md`
- `.agents/skills/coding-harness/SKILL.md`
- `AI/context/diagram-context.md`

Validation evidence:

- Command: `bash scripts/codex-preflight.sh --mode optional` -> pass (run before this audit artifact was drafted in the current thread)
- Command: `git status --short --branch` -> pass (showed pre-existing user-owned modification in `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`)
- Command: `git clone --quiet https://github.com/artichoke/rand_mt.git /private/tmp/rand_mt-docs-audit-1780564601857` -> pass
- Command: `git -C /private/tmp/rand_mt-docs-audit-1780564601857 checkout --quiet a36409d23bac908681f5e891f43a215ea8dbb84b` -> pass
- Command: `find /private/tmp/rand_mt-docs-audit-1780564601857/docs -type f | sort` -> pass
- Command: `sed -n ...` and `rg -n "^#{1,4} "` over reference and Coding Harness docs -> pass
