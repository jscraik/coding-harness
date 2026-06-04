---
artifact_schema: harness-document-lifecycle/v1
artifact_id: documentation-architecture-comparison-audit
artifact_type: research-audit
status: reviewed
source_type: operator-requested-audit
authority: secondary-context
lifecycle_status: reviewed
related_project: coding-harness
related_module: documentation-architecture
decision_impact: high
agent_hot_path: false
canonical_destination: docs/doc-lifecycle-manifest.json
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: event-driven
validated_by:
  - pnpm docs:lint
  - pnpm docs:lifecycle
depends_on:
  - .harness/README.md
  - docs/architecture/documentation-layers.md
reviewed_at: 2026-06-04
---

# Documentation Architecture Comparison

## Table of Contents

- [Executive Summary](#executive-summary)
- [Evidence Base](#evidence-base)
- [Audit Lenses](#audit-lenses)
- [Reference Documentation Inventory](#reference-documentation-inventory)
- [Coding Harness Documentation Inventory](#coding-harness-documentation-inventory)
- [Inspectional Reading Pass](#inspectional-reading-pass)
- [Analytical Reading Pass](#analytical-reading-pass)
- [Syntopical Comparison](#syntopical-comparison)
- [Reader Task Assessment](#reader-task-assessment)
- [Bad Documentation Signal Findings](#bad-documentation-signal-findings)
- [Information Architecture Comparison](#information-architecture-comparison)
- [Prose And Writing Style Comparison](#prose-and-writing-style-comparison)
- [Documentation Pattern Analysis](#documentation-pattern-analysis)
- [DDD Documentation Analysis](#ddd-documentation-analysis)
- [Canon Model](#canon-model)
- [Agent Compatibility Review](#agent-compatibility-review)
- [Current Strengths](#current-strengths)
- [Gaps](#gaps)
- [Recommendations](#recommendations)
- [Proposed Architecture](#proposed-architecture)
- [Research-To-Canon Workflow](#research-to-canon-workflow)
- [Roadmap](#roadmap)

## Executive Summary

The reference documentation is effective because it is small, task-bound, and
explicit about where each reader should go. Its docs directory does not try to
be the whole project handbook. It separates user-facing API docs,
contribution/setup docs, durable guardrails, dependency posture, and recurring
maintenance runbooks.

Coding Harness already has stronger agent-operational machinery than the
reference project: explicit AGENTS guidance, validation contracts, Project Brain
classification, lifecycle truth lanes, delivery-truth concepts, documentation
lifecycle metadata, and a packageable skill. The risk is not lack of
documentation. The risk is that canonical instructions, research evidence,
generated artifacts, plans, specs, implementation notes, and strategy material
can look equally authoritative to a human or agent unless the canon boundary is
kept sharp.

Top findings:

- The highest-value reference pattern to adopt is not prose style alone. It is
  the combination of a compact docs index, durable guardrails, and runbooks that
  name exact triggers, scope, sources, workflow, validation, and feedback loops.
- Coding Harness now has the beginnings of this model in
  `docs/doc-lifecycle-manifest.json`, `.harness/README.md`,
  `docs/lifecycle/**`, `docs/domain/**`, `docs/guardrails/**`, and
  `docs/automations/**`.
- The biggest agent-readability risk is `AGENTS.md` size and density. It is
  canonical and necessary, but at 512 lines it mixes always-on policy with many
  architecture-sensitive change clauses. Agents can follow it, but only if the
  routing docs and docs-gate stay current.
- The biggest reader-task risk is `README.md` size. At 1,022 lines, it is a
  strong product surface but no longer only an onboarding page. It should remain
  canonical, but should push more command reference and deep governance material
  into task-specific docs.
- The biggest stale-documentation risk is the 209-file research, plan, spec, and
  implementation-note surface. These files are valuable evidence, but they need
  status metadata, promotion records, and archive rules so old thinking does not
  leak into current doctrine.
- The most important next move is not more docs. It is a reader-task validation
  gate that proves humans and agents can identify the right canonical source,
  validation command, and stop condition for common lifecycle tasks.

Adopt immediately:

- Keep the new documentation lifecycle manifest as the source of governed doc
  inventory.
- Add research/notes metadata and promotion status to high-value
  `.harness/research/**`, `.harness/implementation-notes/**`,
  `.harness/specs/**`, and `.harness/plan/**` files.
- Split long canonical docs by reader task before adding more concepts to them.
- Add agent dry-run checks for canonical-source selection, not only markdown
  validity.

Avoid:

- Copying the reference repo's small shape directly. Coding Harness is an
  AI-native delivery platform with agent instructions, schemas, generated
  artifacts, runtime evidence, and downstream distribution. It needs more
  governance than a small Rust library.
- Treating research as canon because it is well-written.
- Treating generated architecture context as source truth.
- Adding broad explanatory docs without a command, decision, validation, or
  reader task they advance.

## Evidence Base

Reference repository:

- Source: `artichoke/rand_mt` at commit
  `a36409d23bac908681f5e891f43a215ea8dbb84b`.
- Method: sparse checkout of `docs/**`.
- Reference docs inspected: 15 files.

Coding Harness:

- Root docs inspected: `README.md`, `AGENTS.md`, `ARCHITECTURE.md`,
  `CONTRIBUTING.md`, `SECURITY.md`, `UBIQUITOUS_LANGUAGE.md`.
- Governed docs inspected:
  `docs/doc-lifecycle-manifest.json`, `docs/README.md`,
  `docs/architecture/documentation-layers.md`,
  `docs/lifecycle/issue-to-main.md`, `docs/lifecycle/truth-lanes.md`,
  `docs/lifecycle/feedback-loop.md`, `docs/domain/context-map.md`,
  `docs/domain/claim-authority.md`, `docs/guardrails/README.md`,
  `docs/automations/README.md`.
- Agent surfaces inspected: root `AGENTS.md`,
  `.agents/skills/coding-harness/SKILL.md`, `.harness/README.md`,
  `.harness/research/README.md`, `.harness/implementation-notes/README.md`.
- Inventory evidence: `docs/doc-lifecycle-manifest.json` governs 29 docs;
  `docs/**` contains 249 markdown files; `.harness/**` contains 1,043 files;
  `.harness/research`, `.harness/implementation-notes`, `.harness/specs`,
  and `.harness/plan` contain 209 files.
- Size evidence: `README.md` 1,022 lines, `AGENTS.md` 512 lines,
  `ARCHITECTURE.md` 442 lines, `CONTRIBUTING.md` 322 lines,
  `SECURITY.md` 71 lines, `UBIQUITOUS_LANGUAGE.md` 211 lines,
  `docs/README.md` 134 lines, `docs/architecture/documentation-layers.md`
  197 lines, `.harness/README.md` 141 lines,
  `.agents/skills/coding-harness/SKILL.md` 152 lines.

Book and study-guide lenses:

- `How to Read a Book.pdf`: used through the request's named operational
  principles because PDF text extraction produced no recoverable text.
- `The Mom Test by @robfitz.pdf`: used for bad-signal filtering, past-use
  evidence, concrete task questions, compliments/fluff rejection, and
  commitment/advancement.
- `ai_evals_comprehensive_study_guide.md`: used for observability, traces,
  error analysis, evaluator design, train/dev/test thinking, and closing loops.
- `Lessons Learned in Software Testing.pdf`: used for risk-based testing,
  bug-report quality, coverage humility, testability, regression limits, and
  pilot-before-policy discipline.

## Audit Lenses

Operational reading lens:

- Inspectional reading: first classify a document's kind, reader, task, and
  authority before judging details.
- Analytical reading: extract unity, parts, terms, claims, enforcement, and
  significance for canonical and hot-path docs.
- Syntopical reading: compare documents by shared questions, not by file path.
  The question is: where should a reader go to decide, act, validate, or stop?
- Significance test: if deleting a document would not change a decision,
  command, validation, or repeated-steering outcome, the document is not canon.

Bad-signal and validation lens:

- Reject documentation compliments such as "clear", "comprehensive", "nice
  context", or "might help". Require concrete past use.
- Prefer questions about the last real use: what task, what search path, what
  section changed action, what stale instruction was ignored.
- Strong docs create commitment or advancement: run command, update artifact,
  make decision, validate claim, stop unsafe action, promote evidence, or
  archive stale material.

Eval and testing lens:

- Treat docs as an AI system interface. Capture traces of agent doc loading,
  classify failures, build repeatable reader-task evals, and close the loop into
  canon or validators.
- Do not let a passing markdown lint imply task validity.
- Use coverage humility: automated doc checks catch broken syntax and some
  drift, but not whether the right reader found the right instruction at the
  right time.

## Reference Documentation Inventory

| Path | Purpose | Audience | Lifecycle Stage | Category | Dependencies | Canonicality | Pattern | Relevance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `docs/README.md` | Route readers to maintenance docs, guardrails, supply chain, and automations. | Maintainer, contributor, automation agent. | Discover. | Navigation. | Crate README, crate docs, `CONTRIBUTING.md`. | Canonical index for `docs/**`. | Compact front door. | Strong model for `docs/README.md`. |
| `docs/dependencies.md` | Define dependency and supply-chain posture. | Maintainer, dependency automation. | Maintain. | Policy. | `mise.toml`, `package.json`, lockfiles, CI. | Canonical policy. | Principles -> ownership -> enforcement. | Adapt for harness package/scaffold/toolchain policy. |
| `docs/automations/README.md` | Define automation comment conventions and list runbooks. | Automation agent, maintainer. | Operate. | Automation index. | Automation runbooks. | Canonical for automation conventions. | Stable prefix, slim prompt, docs-owned runbook. | Directly applicable. |
| `docs/automations/dependency-sweep.md` | Run recurring dependency maintenance. | Scheduled agent, maintainer. | Operate/maintain. | Runbook. | `docs/dependencies.md`, manifests, lockfiles. | Supporting operational canon. | Scope -> pinning rules -> workflow -> PR -> validation. | Strong model for Coding Harness automation runbooks. |
| `docs/automations/github-actions-runner-images.md` | Track runner-image support and required-check drift. | Scheduled agent, maintainer. | Operate/maintain. | Runbook. | Workflow files, runner image docs, rulesets. | Supporting operational canon. | Sources -> decision rules -> changes -> validation. | Adapt for CircleCI/check-name sweeps. |
| `docs/automations/rand-core.md` | Maintain optional `rand_core` compatibility. | Scheduled agent, maintainer. | Operate/release. | Runbook. | `Cargo.toml`, source files, README, CI. | Supporting operational canon. | Source list -> policy -> workflow -> release split. | Adapt for package/scaffold semver runbooks. |
| `docs/guardrails/README.md` | Route reviewers to durable review standards. | Reviewer, maintainer, agent. | Review. | Guardrail index. | Guardrail pages. | Canonical index. | Change-class routing. | Good model for `docs/guardrails/README.md`. |
| `docs/guardrails/api-stability-semver-and-msrv.md` | Review API stability, semver, and MSRV changes. | Reviewer, maintainer. | Review/release. | Guardrail. | Cargo metadata, public API, CI. | Canonical guardrail. | Change impact -> checks -> release posture. | Adapt for harness semver and downstream scaffold impact. |
| `docs/guardrails/ffi-bindings-and-foreign-runtime-integration.md` | Review FFI and foreign runtime integration. | Reviewer. | Review. | Guardrail. | Source and tests. | Supporting guardrail. | Risk-specific review checklist. | Pattern useful; content not directly applicable. |
| `docs/guardrails/high-quality-rust-code.md` | Define Rust quality expectations. | Contributor, reviewer. | Implement/review. | Guardrail. | Rust source, tests, lints. | Supporting guardrail. | Idiom -> maintainability -> validation. | Adapt as TypeScript/deep-module guardrail only if not duplicating CODESTYLE. |
| `docs/guardrails/performance-allocation-and-memory-behavior.md` | Review allocation/performance-sensitive changes. | Reviewer. | Review. | Guardrail. | Benchmarks, code paths. | Supporting guardrail. | Risk trigger -> evidence required. | Adapt for runtime/eval/CLI performance lanes. |
| `docs/guardrails/platform-specific-code.md` | Review platform-specific behavior. | Reviewer. | Review. | Guardrail. | CI matrices, source. | Supporting guardrail. | Compatibility matrix thinking. | Adapt for local/CI/Codex Desktop portability. |
| `docs/guardrails/testing-compatibility-and-conformance.md` | Define test and compatibility expectations. | Contributor, reviewer. | Implement/review. | Guardrail. | Test suite, CI, compatibility policy. | Supporting guardrail. | Coverage by risk and conformance. | Strong fit for harness eval/docs-task checks. |
| `docs/guardrails/unsafe-code.md` | Review unsafe Rust. | Reviewer. | Review. | Guardrail. | Unsafe blocks, invariants. | Supporting guardrail. | Explicit extra scrutiny. | Pattern maps to high-risk actions and external-state authority. |
| `docs/guardrails/working-in-public-and-publishing-oss-crates.md` | Define public OSS/publishing behavior. | Maintainer, release agent. | Release/publish. | Governance. | README, release workflow, crates.io. | Supporting guardrail. | Public trust and publication constraints. | Adapt for NPM package and downstream template release. |

## Coding Harness Documentation Inventory

The Coding Harness inventory is larger than the reference inventory. This table
lists the canonical and high-risk surfaces at path level, and bulk research or
runtime surfaces by governed category so the audit remains usable.

| Path Or Surface | Purpose | Audience | Lifecycle Stage | Category | Dependencies | Classification | Agent Relevance | Human Relevance | Maintenance Risk | Reader Task | Evidence Of Use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `README.md` | Product overview, install path, commands, lifecycle posture. | Human operator, maintainer, agent. | Discover/operate. | Product orientation. | `ARCHITECTURE.md`, `docs/README.md`, contract files. | Canon. | High. | High. | High: large and growing. | Understand what synAIpse/Coding Harness does and how to start. | Manifest governed; root product surface. |
| `AGENTS.md` | Mandatory agent operating instructions. | Codex agents, maintainers. | Execute. | Operator policy. | `CODESTYLE.md`, `UBIQUITOUS_LANGUAGE.md`, agent docs. | Canon, agent hot-path. | Critical. | Medium. | High: dense, many conditionals. | Choose correct workflow, validation, stop condition. | Auto-discovered agent instruction. |
| `ARCHITECTURE.md` | Stable source map and architecture invariants. | Maintainer, agent, reviewer. | Design/review. | Architecture canon. | Generated context, docs layers, source modules. | Canon. | High. | High. | Medium-high: must track deep modules. | Understand boundaries and source truth. | Manifest governed; docs-gate surface. |
| `CONTRIBUTING.md` | Contribution workflow, validation, PR closeout. | Contributor, maintainer, agent. | Implement/review. | Contribution policy. | PR template, validation scripts, docs lifecycle. | Canon. | High. | High. | Medium. | Make a change and prepare PR evidence. | Manifest governed; PR template linkage. |
| `SECURITY.md` | Security reporting and security contribution baseline. | Reporter, maintainer. | Report/review. | Security. | Security/governance docs. | Canon. | Medium. | High. | Low. | Report issue or classify security-sensitive change. | Manifest governed. |
| `UBIQUITOUS_LANGUAGE.md` | Canonical project vocabulary and prompt translations. | Agent, maintainer, reviewer. | Discover/execute. | Domain language. | AGENTS, docs, schemas, code. | Canon. | Critical. | Medium-high. | Medium: term drift. | Translate overloaded wording into canonical action. | Referenced by AGENTS; glossary guard. |
| `docs/README.md` | Docs index and task routing. | Human, agent. | Discover. | Navigation. | Root docs, lifecycle, domains, guardrails. | Canon/supporting index. | High. | High. | Medium. | Find the right doc without loading everything. | Manifest governed. |
| `docs/architecture/documentation-layers.md` | Define progressive disclosure and source-only vs downstream docs. | Agent, maintainer. | Design/maintain. | Docs architecture. | AGENTS, docs manifest, `.harness/README.md`. | Canon. | High. | Medium. | Medium. | Decide where documentation belongs. | Manifest governed; newly updated. |
| `docs/doc-lifecycle-manifest.json` | Machine-readable governed doc inventory. | Validator, maintainer, agent. | Maintain/release. | Schema-backed governance. | Schema, docs frontmatter. | Canon generated/curated contract. | High. | Medium. | Medium: drift if not enforced. | Classify doc lifecycle, ownership, semver impact. | `pnpm docs:lifecycle` pass. |
| `docs/doc-lifecycle.schema.json` | Schema for governed lifecycle docs. | Maintainer, validator. | Maintain. | Schema. | Manifest, checker. | Canon. | High. | Low. | Low-medium. | Validate metadata shape. | `pnpm docs:lifecycle`. |
| `docs/lifecycle/issue-to-main.md` | Explain Lifecycle Harness from Linear issue to main. | Human, agent. | Plan/execute/close. | Lifecycle concept/runbook. | Linear workflow, truth lanes, feedback loop. | Canon/supporting. | High. | High. | Medium: new doc needs use evidence. | Know full delivery cycle and where feedback loops sit. | Manifest governed; created from repeated steering. |
| `docs/lifecycle/truth-lanes.md` | Separate local, PR, CI, review, tracker, merge truth. | Agent, maintainer. | Execute/close. | Delivery truth. | AGENTS, pr-closeout, external-state docs. | Canon/supporting. | Critical. | High. | Low-medium. | Avoid false readiness claims. | New, directly tied to repeated user steering. |
| `docs/lifecycle/feedback-loop.md` | Explain how feedback re-enters docs, validators, and workflows. | Agent, maintainer. | Improve. | Learning loop. | AGENTS, Project Brain, docs lifecycle. | Supporting canon. | High. | Medium. | Medium. | Convert feedback into durable change. | New, validates repeated-steering doctrine. |
| `docs/domain/context-map.md` | Define bounded contexts and translations. | Architect, agent, reviewer. | Design/review. | DDD context map. | Ubiquitous language, architecture. | Canon/supporting. | High. | Medium. | Medium. | Identify owning context for a change. | New, aligns with DDD gap. |
| `docs/domain/claim-authority.md` | Define which artifacts may support which claims. | Agent, reviewer. | Close/review. | Claim authority. | Delivery-truth, review-state, runtime evidence. | Canon/supporting. | Critical. | Medium. | Low-medium. | Stop evidence overclaiming. | New, tied to truth-lane steering. |
| `docs/guardrails/README.md` | Route guardrail pages by risk class. | Agent, reviewer. | Review. | Guardrail index. | Guardrail pages. | Canon/supporting. | High. | Medium. | Medium. | Choose the right guardrail. | Manifest governed. |
| `docs/guardrails/**` | Guardrails for runtime evidence, review state, external state, automation, generated artifacts, packaging. | Agent, reviewer, maintainer. | Review/maintain. | Guardrails. | Architecture, AGENTS, docs lifecycle. | Supporting canon. | High. | Medium. | Medium: needs eval use. | Know evidence required for a risk class. | New; docs-gate covered. |
| `docs/automations/README.md` | Automation conventions and runbook index. | Automation agents, maintainer. | Operate. | Automation index. | Automation runbooks. | Supporting canon. | High. | Medium. | Medium. | Choose or maintain an automation runbook. | Manifest governed. |
| `docs/automations/**` | Runbooks for CI sweeps, CodeRabbit, Linear sync, dependency/toolchain refresh. | Automation agents, maintainer. | Operate/maintain. | Runbooks. | AGENTS, PR closeout, external systems. | Supporting canon. | High. | Medium. | Medium: external APIs drift. | Run recurring lifecycle tasks with stop conditions. | New; requires future heartbeat/eval proof. |
| `.harness/README.md` | Classify .harness control-plane tracking and authority. | Agent, maintainer. | Maintain. | Control-plane map. | AGENTS, docs layers. | Canon. | Critical. | Medium. | Medium: duplicate row spotted for `.harness/audits/**`. | Decide whether .harness artifact is authority. | Manifest governed; explicit authority levels. |
| `.harness/research/README.md` | Define research as secondary context until admitted. | Agent, researcher. | Research/promote. | Research policy. | Evidence patterns, plans/specs/decisions. | Operational/supporting. | High. | Medium. | High if metadata stays sparse. | Know how research becomes authority. | Exists, but too thin for current volume. |
| `.harness/research/audits/**` | Research-derived audits. | Maintainer, agent. | Research/review. | Research evidence. | Evidence patterns, plans/specs. | Research. | Medium. | Medium. | High: old audits can look current. | Find research findings and promote/decline them. | 9 files observed; no uniform frontmatter yet. |
| `.harness/research/deep/**` | Deep source evidence and external research. | Researcher, strategist. | Research. | Evidence archive. | Evidence patterns manifest. | Research. | Low-hot-path, high-strategy. | Medium. | High: needs status, source, disposition. | Retrieve evidence without making it doctrine. | 17 files observed. |
| `.harness/implementation-notes/**` | Execution notes, admissions, implementation evidence. | Maintainer, agent. | Implement/learn. | Implementation history. | Plans/specs/decisions/validators. | Supporting/research/history. | Medium. | Medium. | High: stale todo/opinion risk. | Understand why work changed and what was validated. | README says secondary context. |
| `.harness/specs/**` | Accepted or proposed specs. | Agent, maintainer. | Plan/design. | Execution input. | Plans, reviews, Linear. | Operational/execution-input when admitted. | High. | Medium. | Medium-high: supersession. | Implement approved scope. | Listed in .harness control map. |
| `.harness/plan/**` | Implementation plans. | Agent, maintainer. | Execute. | Execution input. | Specs, Linear, active artifacts. | Operational/execution-input when current. | High. | Medium. | High: old plans can misroute. | Execute a bounded slice. | Listed in .harness control map. |
| `.harness/knowledge/**` | Project Brain facts, hypotheses, rules. | Agent, maintainer. | Learn/operate. | Knowledge base. | Project Brain tooling. | Secondary context/policy depending path. | High. | Medium. | Medium-high. | Retrieve durable lessons and rules. | AGENTS mentions Project Brain. |
| `.agents/skills/coding-harness/SKILL.md` | Packaged skill for downstream install/upgrade/governance. | Codex agent. | Operate/distribute. | Skill. | Skill references, validation. | Canon packaged-skill. | Critical. | Low-medium. | Medium: downstream drift. | Operate harness from live repo evidence. | `pnpm skill:validate`; manifest governed. |
| `src/lib/*/README.md` | Deep-module developer maps. | Maintainer, agent. | Implement. | Module docs. | Source modules, tests. | Supporting. | Medium. | Medium. | Medium: source drift. | Understand module ownership. | Some are listed by docs-gate. |
| `AI/context/diagram-context.md` and generated diagrams | Derived architecture context. | Agent, reviewer. | Orient/review. | Generated evidence. | Source contracts, diagram generator. | Generated, not canon. | Medium-high. | Medium. | Medium. | Orient quickly, never edit as source truth. | AGENTS and ARCHITECTURE classify as generated. |
| `docs/archive/**`, `docs/ideation/**`, older `docs/specs/**` | Historical and design exploration. | Maintainer, researcher. | Research/history. | Archive/spec history. | May link to plans/decisions. | Historical/research. | Low unless cited. | Low-medium. | High if unclassified. | Retrieve past thinking only. | Not all governed by lifecycle manifest. |

## Inspectional Reading Pass

| Document | About As A Whole | Kind | Problem Solved | Reader | Task Enabled | Major Parts | Relationship | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `README.md` | Product and operating overview. | Product/onboarding/reference hybrid. | Explains what the harness is and how to use it. | Human first, agent second. | Install, discover commands, understand lifecycle. | Brand, outcome, install, commands, validation, governance. | Routes to docs and contracts. | READ FULLY for maintainers; HUMAN ONBOARDING; REFERENCE ONLY for command catalog. |
| `AGENTS.md` | Mandatory agent behavior. | Policy/instruction. | Makes Codex operate safely and consistently. | Codex agent. | Choose workflow, validation, stop condition. | Essentials, CLI, workflow, validation, repo workflow, routing. | Overrides/routs to docs. | AGENT HOT-PATH; READ FULLY by agents. |
| `ARCHITECTURE.md` | Source map and invariants. | Architecture canon. | Prevents boundary drift. | Maintainer, agent, reviewer. | Place changes in correct module/context. | System map, runtime packets, source/generation boundaries. | Links generated context and source modules. | READ FULLY for architecture work; REFERENCE ONLY otherwise. |
| `CONTRIBUTING.md` | Contribution and closeout workflow. | Contributor guide/policy. | Shows how to make and prove changes. | Human contributor, agent. | Run validation and prepare PR evidence. | Setup, workflow, validation, PR fields, closeout. | Connects PR template and scripts. | HUMAN ONBOARDING; AGENT HOT-PATH for PR work. |
| `SECURITY.md` | Security reporting and sensitive-change policy. | Security policy. | Handles vulnerability disclosure and security review. | Reporter, maintainer. | Report vulnerability or classify security work. | Reporting, supported versions, security checklist. | Links governance docs. | REFERENCE ONLY. |
| `UBIQUITOUS_LANGUAGE.md` | Domain glossary and prompt translations. | Glossary. | Prevents overloaded language drift. | Agent, maintainer. | Translate terse user language into canonical actions. | Terms, aliases, prompt translations, sources. | Referenced by AGENTS. | AGENT HOT-PATH; REFERENCE ONLY. |
| `docs/README.md` | Documentation front door. | Navigation index. | Prevents random doc loading. | Human and agent. | Find correct docs by task. | Canon, lifecycle, guardrails, automations, generated/historical. | Routes to layered docs. | READ FULLY on first orientation. |
| `docs/architecture/documentation-layers.md` | Documentation layer model. | Docs architecture. | Separates AGENTS, quick refs, governance, downstream docs. | Maintainer, agent. | Decide where doc content belongs. | Layers, distribution, canon, validation. | Connects docs manifest, .harness, AGENTS. | READ FULLY for docs changes. |
| `.harness/README.md` | Control-plane authority map. | Control-plane policy. | Prevents .harness artifact misuse. | Agent, maintainer. | Classify artifact authority. | Tracking policy, authority levels, directory map, admission rule. | Routes research vs execution input. | AGENT HOT-PATH for .harness work. |
| `.harness/research/README.md` | Research storage rule. | Research policy stub. | Says research is secondary until admitted. | Researcher, agent. | Avoid treating research as implementation authority. | Purpose, authority, use. | Depends on evidence patterns. | SKIM ONLY now; should be expanded. |
| `.harness/implementation-notes/README.md` | Implementation note rule. | Evidence/history policy stub. | Says notes are secondary unless promoted. | Agent, maintainer. | Use notes without mistaking them for canon. | Purpose, authority, use. | Depends on plans/specs/decisions. | SKIM ONLY now; should be expanded. |
| `.agents/skills/coding-harness/SKILL.md` | Packaged harness operating skill. | Agent skill. | Enables downstream setup and governance. | Codex agent. | Run harness install/upgrade/governance safely. | Use, command truth, workflow, validation, boundaries. | Depends on references and validation. | AGENT HOT-PATH; READ FULLY when skill triggers. |

Archive/delete inspection:

- `.harness/research/deep/**`: RESEARCH ARCHIVE unless admitted by
  `.harness/research/evidence-patterns.json`.
- `.harness/plan/**` and `.harness/specs/**`: EXECUTION INPUT only when
  current and referenced by an active issue/artifact index; otherwise
  HISTORICAL.
- `docs/ideation/**`: RESEARCH ARCHIVE unless promoted by decision/spec.
- Generated architecture and evidence artifacts: REFERENCE ONLY; never canon.
- No immediate delete candidates should be removed without a separate archive
  decision because many files are evidence-bearing. The delete candidate class
  should be assigned after metadata and citation checks, not by path age alone.

## Analytical Reading Pass

### AGENTS.md

Unity: Mandatory operating policy for Codex agents in this repository.

Parts:

- Project description and expected outcome.
- Mandatory workflow snippet.
- Required essentials and durable steering.
- Harness CLI and reviewer/tool-builder routing.
- Discovery, startup, command, and validation contracts.
- Repo workflow, instruction routing, memory, vocabulary, Project Brain, and
  implementation conventions.

Key terms: Coding Harness, synAIpse, Lifecycle Harness, truth lanes, Project
Brain, docs-gate, validation lane, delivery truth, generated projection,
compatibility posture, repeated steering.

Claims:

| Claim | Status | Evidence |
| --- | --- | --- |
| Agents must treat repeated steering as system evidence. | TRUE BUT PARTLY UNENFORCED | Policy exists; some enforcement through docs steering guard and PR template, but full behavioral proof needs agent dry-runs. |
| Local code/test truth is separate from CI, PR, review, tracker, and merge truth. | TRUE AND ENFORCED IN POLICY | Repeated across AGENTS, lifecycle docs, pr-closeout rules; validators partially enforce. |
| Docs lifecycle impact must be classified before handoff. | TRUE AND ENFORCED | PR template fields and `pnpm docs:lifecycle` exist. |
| Project-local harness reviewer roles are first-choice. | TRUE BUT RUNTIME-DEPENDENT | Policy exists; runtime may not expose project-local roles in all threads. |

Significance: Removing this file would directly change agent behavior. It is
canon, but should become thinner by pushing specialized clauses into routed
guardrails while preserving mandatory discovery instructions.

### README.md

Unity: Product-facing orientation and command entry point for Coding Harness.

Parts:

- Brand/product positioning.
- Installation and setup.
- Lifecycle and command surfaces.
- Governance, validation, and automation concepts.
- Command catalog and deep feature descriptions.

Claims:

| Claim | Status | Evidence |
| --- | --- | --- |
| Coding Harness is a portable agent operating system / AI Delivery Harness. | ASPIRATIONAL BUT STRATEGICALLY CANONICAL | Product direction is clear; downstream portability is still validated through init/upgrade tests and skill evals. |
| `harness next --json` is the fresh-agent entry point. | TRUE AND ENFORCED | Skill and command docs point to it; command exists in repo surfaces. |
| Documentation impact must include lifecycle classification. | TRUE AND ENFORCED | PR template and docs lifecycle checker. |

Significance: High. But 1,022 lines means the README now combines product
overview, command reference, and governance reference. It should remain the
human front door but delegate command catalog and governance details.

### ARCHITECTURE.md

Unity: Human-authored source map for repo boundaries and architecture
invariants.

Key terms: runtime card, evidence receipt, delivery truth, external-state,
review-state, generated context, source truth, deep module, claim support.

Claims:

| Claim | Status | Evidence |
| --- | --- | --- |
| Generated architecture context is evidence, not source truth. | TRUE AND ENFORCED IN POLICY | Repeated in AGENTS and architecture docs; docs-gate watches generated context when required. |
| Deep modules own contract internals behind narrow command facades. | TRUE AND PARTLY ENFORCED | Module-boundary ratchets and quality:size support this. |

Significance: High for architecture work. It prevents agents from editing
generated projections or stuffing logic into command facades.

### .harness/README.md

Unity: Authority and tracking policy for Project Brain/control-plane artifacts.

Claims:

| Claim | Status | Evidence |
| --- | --- | --- |
| Research is secondary context until admitted. | TRUE BUT NEEDS STRONGER METADATA | Policy exists; older research lacks uniform status metadata. |
| Runtime output should stay local unless promoted. | TRUE AND ENFORCED BY POLICY | Tracking map exists; gitignore and artifact rules likely enforce partly. |
| Operator audits and research audits are distinct lanes. | TRUE BUT SLIGHTLY DUPLICATED | Directory map repeats `.harness/audits/**.md` with overlapping wording. |

Significance: Critical. It is the main antidote to research-as-canon drift.

### .agents/skills/coding-harness/SKILL.md

Unity: Agent skill for operating installed or source Coding Harness from live
evidence.

Claims:

| Claim | Status | Evidence |
| --- | --- | --- |
| Use live command truth, not stale install memory. | TRUE AND ENFORCED BY SKILL CONTRACT | Skill references command discovery and validation. |
| Source repo should use `node --import tsx src/cli.ts ...`. | TRUE FOR SOURCE TRUTH | Avoids stale global binary. |
| Packaged skill validation is not full downstream install proof. | TRUE AND IMPORTANT | Prevents evidence overclaiming. |

Significance: Critical for downstream agent behavior.

## Syntopical Comparison

### Cross-Document Contradictions

| Question | Documents | Finding | Recommendation |
| --- | --- | --- | --- |
| Where does research become authority? | `.harness/README.md`, `.harness/research/README.md`, plans/specs. | Agreement exists, but research README is too thin for current volume. | Expand research README with status metadata and promotion workflow. |
| What is the product name? | README, brand docs, skill. | Product brand is synAIpse; repo/package remain Coding Harness. | Keep explicit alias table in README, brand doc, glossary, and skill. |
| What does lifecycle mean? | lifecycle docs, Linear workflow, PR closeout. | New docs align the concept, but older docs may still use flow ops / delivery lifecycle differently. | Add glossary aliases and run terminology scan. |
| Is generated context source truth? | ARCHITECTURE, AGENTS, generated artifacts docs. | Consistent: generated is evidence, not canon. | Preserve. |
| Which validation proves docs are useful? | docs:lifecycle, docs:lint, docs-gate. | Current gates prove shape and drift, not reader-task completion. | Add reader-task/agent dry-run evals. |

### Competing Definitions

| Term | Risk | Canonical Source Recommendation |
| --- | --- | --- |
| Coding Harness / synAIpse / AI Delivery Harness | Brand vs package confusion. | `docs/brand/README.md` plus `UBIQUITOUS_LANGUAGE.md`. |
| Lifecycle Harness / Linear workflow / delivery lifecycle | Same concept at different layers. | `docs/lifecycle/issue-to-main.md` for concept; `docs/agents/13-linear-production-workflow.md` for agent workflow. |
| Evidence / receipt / artifact / truth lane | Overloaded if not claim-bound. | `docs/domain/claim-authority.md` and `UBIQUITOUS_LANGUAGE.md`. |
| Research / audit / implementation note | Can look like doctrine. | `.harness/README.md` and expanded research workflow. |

### Duplicate Concepts

- Docs lifecycle appears in README, CONTRIBUTING, PR template, manifest, and
  docs-gate. This is acceptable if the manifest is the source and the prose only
  routes to it.
- Validation appears in AGENTS, CONTRIBUTING, README, docs/agents, and PR
  template. This is high-risk duplication; route all command lists to a
  validation contract or generated command inventory where possible.
- Project Brain appears in AGENTS, .harness README, Local Memory docs, and
  knowledge files. This needs the context map to distinguish policy, evidence,
  and runtime memory.

### Canonical Source Recommendation

- Product identity: `README.md` and `docs/brand/README.md`.
- Agent behavior: `AGENTS.md` with task routing through
  `docs/agents/01-instruction-map.md`.
- Architecture boundaries: `ARCHITECTURE.md` and
  `docs/domain/context-map.md`.
- Vocabulary: `UBIQUITOUS_LANGUAGE.md`.
- Docs lifecycle: `docs/doc-lifecycle-manifest.json` plus schema.
- .harness authority: `.harness/README.md`.
- Delivery lifecycle: `docs/lifecycle/issue-to-main.md` and
  `docs/lifecycle/truth-lanes.md`.
- Automation behavior: `docs/automations/<runbook>.md`.

### Archive / Merge / Delete Recommendation

- Archive candidates: old plans/specs not referenced by active artifacts,
  superseded research audits, ideation docs with no accepted pattern.
- Merge candidates: repeated validation command lists should route to one
  command contract; repeated docs lifecycle descriptions should route to the
  manifest.
- Delete candidates: none recommended directly in this pass. Use metadata and
  citation checks first so evidence is not destroyed.

## Reader Task Assessment

Score: 0 cannot complete task, 1 needs prior knowledge, 2 possible but
confusing, 3 clear, 4 clear and validated, 5 clear, validated, and agent-safe.

| Document | Reader Task | Score | Reason | Fix |
| --- | --- | --- | --- | --- |
| `docs/README.md` | Find correct documentation by task. | 4 | Clear and now routed; docs-gate validates links/shape. | Add explicit human vs agent first paths. |
| `README.md` | Understand product and start using harness. | 3 | Rich but too long; command catalog competes with onboarding. | Split command reference deeper; keep README task-first. |
| `AGENTS.md` | Agent chooses safe workflow and validation. | 4 | Strong and binding; high density increases miss risk. | Add machine-testable hot-path scenarios. |
| `ARCHITECTURE.md` | Place changes in correct architecture context. | 4 | Strong boundaries; validated by docs-gate when changed. | Add quick context map pointer near top. |
| `CONTRIBUTING.md` | Make a PR-ready change with evidence. | 4 | Good validation/PR closeout specificity. | Reduce duplicated command lists through generated contract links. |
| `UBIQUITOUS_LANGUAGE.md` | Translate overloaded terms. | 4 | Strong glossary and prompt translations. | Add synAIpse/Lifecycle aliases and claim-authority terms if missing. |
| `docs/lifecycle/issue-to-main.md` | Understand Linear issue to main lifecycle. | 3 | New and clear, but no past-use trace yet. | Add reader-task eval after next lifecycle PR. |
| `docs/lifecycle/truth-lanes.md` | Avoid collapsing truth lanes. | 4 | Directly fixes repeated steering. | Add PR closeout dry-run fixture. |
| `.harness/README.md` | Classify .harness artifact authority. | 4 | Strong table; one duplicated audit row. | Deduplicate row; add research metadata pointer. |
| `.harness/research/README.md` | Promote research into canon. | 2 | Correct but too thin for current scale. | Expand with workflow, metadata, statuses, validation. |
| `.harness/implementation-notes/README.md` | Use notes without canon confusion. | 2 | Correct but thin; no note metadata. | Add note hygiene template and review cadence. |
| `.agents/skills/coding-harness/SKILL.md` | Operate harness in downstream repo. | 4 | Strong command truth and boundaries. | Add examples for brand/package naming during transition. |

## Bad Documentation Signal Findings

Weak signals to reject:

- "This explains the idea." Explanation is not enough for canon.
- "Agents might need this later." Future hypothetical is not evidence.
- "This is good context." Context must be linked to a decision or workflow.
- "Comprehensive." Comprehensiveness often increases agent context burden.

Concrete evidence currently available:

| Evidence Type | Present? | Examples | Gap |
| --- | --- | --- | --- |
| Validation linked | Yes | `pnpm docs:lifecycle`, docs-gate, docs lint. | Validates shape more than task success. |
| Agent hot-path | Yes | `AGENTS.md`, skill, docs map, .harness README. | Needs trace-based doc-load eval. |
| Repeated steering | Yes | Truth lanes, docs lifecycle, feedback loop, PR closeout evidence. | Needs citation to exact steering admissions where possible. |
| Past-use trace | Partial | PR templates, validators, specs, plans, research audits. | Not normalized across research/notes. |
| Human onboarding proof | Weak | README exists, but no observed onboarding study. | Add reader-task interview/dry-run. |
| Decorative context | Possible | Older ideation/spec/research surfaces not tied to active patterns. | Classify with metadata before pruning. |

Commitment/advancement test:

- Strong: `AGENTS.md`, `CONTRIBUTING.md`, `.agents/skills/**`,
  `docs/automations/**`, `docs/guardrails/**`, `.harness/README.md`.
- Supporting: `ARCHITECTURE.md`, `UBIQUITOUS_LANGUAGE.md`, context map.
- Research-only unless admitted: deep research, evidence notes, ideation,
  historical audits.
- Archive/delete candidate only after no command, decision, citation, or
  promotion path can be found.

## Information Architecture Comparison

| Area | Reference Docs | Coding Harness Current State | Difference | Recommendation |
| --- | --- | --- | --- | --- |
| Front door | `docs/README.md` is compact and explicit about what docs is for. | `docs/README.md` is improving but routes a much larger system. | Good difference: harness needs more layers. | Keep compact index; avoid making it a second README. |
| Guardrails | One guardrail index plus focused risk docs. | New guardrail docs exist; older governance docs also contain guardrail material. | Risk of duplication. | Make `docs/guardrails/README.md` the risk-router, not AGENTS. |
| Automations | Every automation has runbook, scope, sources, workflow, validation. | New automation runbooks now mirror this; old automations may vary. | Reference is stronger and simpler. | Standardize automation runbook template. |
| Dependencies | One supply-chain posture doc. | Toolchain/package/scaffold policy is spread across README, CONTRIBUTING, AGENTS, docs. | Harness is broader, but too split. | Add or strengthen package/scaffold release guardrail. |
| Human vs agent path | Mostly maintainer/automation; simple enough for both. | Human and agent docs must diverge. | Good difference. | Preserve distinct agent entry points. |
| Research | Reference has little research surface. | Coding Harness has large research archive. | Necessary difference, high risk. | Add research-to-canon workflow and metadata. |
| Generated artifacts | Minimal in reference docs. | Central to Coding Harness. | Necessary difference. | Keep generated artifacts explicitly non-canon. |

## Prose And Writing Style Comparison

| Writing Pattern | Reference Evidence | Coding Harness Current State | Recommendation |
| --- | --- | --- | --- |
| Say where not to look | Reference README says user API docs and CONTRIBUTING are elsewhere. | Coding Harness sometimes says what is canon, but long docs blur scope. | Add "Use this for / do not use this for" to canonical docs. |
| Trigger-first runbooks | Automation docs start with role, scope, sources, workflow. | New runbooks do this; older docs vary. | Standardize. |
| Durable principles before details | Dependencies doc starts with principles and ownership. | Harness docs often begin with policy density. | Keep principles, then route details. |
| Short paragraphs and direct constraints | Reference style is concise and imperative. | Harness style is precise but often dense. | Preserve precision; reduce packed multi-clause bullets. |
| Validation at end of runbook | Reference runbooks state commands and summary requirements. | Harness has strong validation but duplicated. | Keep exact commands in one canonical contract where possible. |
| Feedback loop explicitness | Reference automations say update guardrails after feedback. | Harness has stronger repeated-steering doctrine. | Preserve harness pattern; make it traceable. |

Reusable writing principles:

- Every document should state its job in the first two paragraphs.
- Every operational doc should name trigger, scope, source, workflow, validation,
  stop condition, and feedback loop.
- Every concept doc should link to the operational doc that makes the concept
  actionable.
- Every research doc should state status and canonical destination.
- Every generated doc should state source owner and regeneration path.

## Documentation Pattern Analysis

| Pattern | Reference Use | Coding Harness Equivalent | Assessment | Action |
| --- | --- | --- | --- | --- |
| Compact docs front door | `docs/README.md`. | `docs/README.md`. | Equivalent, broader. | Preserve and keep compact. |
| Guardrail index -> risk doc | `docs/guardrails/README.md`. | `docs/guardrails/README.md`, agent docs. | New equivalent is promising. | Adapt, avoid duplication. |
| Runbook with sources and validation | Automation docs. | New automation docs, AGENTS. | Needs standardization. | Adopt. |
| Dependency posture | `docs/dependencies.md`. | Spread across root docs and guardrails. | Weaker IA. | Adapt as package/scaffold/toolchain posture. |
| Human feedback updates automation docs | Automation docs. | Repeated-steering doctrine stronger. | Harness stronger. | Preserve, add evidence citation. |
| API/semver guardrail | Semver/MSRV guardrail. | Docs lifecycle semver, package release docs. | Present but new. | Strengthen with SemVer matrix. |
| Research archive | Not prominent. | Large .harness research. | Harness-specific. | Do not copy reference absence; govern instead. |
| Generated reference | Minimal. | Architecture context, artifacts, manifests. | Harness-specific. | Preserve non-canon boundary. |

## DDD Documentation Analysis

### Coding Harness Ubiquitous Language Findings

Strong terms already present:

- Control Plane
- Truth Lane
- Runtime Evidence
- Delivery Truth
- Project Brain
- Validation Lane
- Generated Projection
- Compatibility Posture
- Repeated-Error Research Pass
- Lifecycle Harness
- synAIpse / AI Delivery Harness

Overloaded or drift-prone terms:

- Lifecycle: concept, product model, delivery process, and automation loop.
- Harness: product, package, CLI, platform, and repo.
- Evidence: raw output, receipt, review artifact, generated context, and claim
  support.
- Audit: operator-requested current-state audit vs research-derived audit.
- Plan/spec/intent: execution authority depends on admission and currency.

Recommended glossary additions:

- Lifecycle Harness: the issue-to-main operating model inside Coding Harness.
- synAIpse: product/brand name for the AI Delivery Harness; package remains
  `@brainwav/coding-harness` until rename migration.
- Research Admission: the act of promoting research into a plan, spec, decision,
  validator, or canonical doc.
- Reader-Task Validation: proof that a doc lets a human or agent complete a
  named task.
- Documentation Compliment: a non-evidence statement such as "useful" or
  "clear" that does not prove task value.

### Bounded Context / Deep Module Findings

Recommended documentation contexts:

- Product Identity: README, brand, package naming.
- Agent Operations: AGENTS, skills, docs/agents.
- Delivery Lifecycle: lifecycle docs, Linear workflow, PR closeout.
- Evidence And Claim Authority: runtime evidence, delivery truth, review state,
  external state, root hygiene, artifacts.
- Docs Governance: lifecycle manifest, documentation layers, docs-gate.
- Research And Learning: .harness/research, implementation notes, Project Brain.
- Distribution And Downstream Scaffolds: templates, packaged skill, init/upgrade.

The new `docs/domain/context-map.md` is the right canonical home. The next
step is to make each context own its terms, schemas, docs, validators, and
generated projections.

## Canon Model

Canonical docs:

- `README.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `UBIQUITOUS_LANGUAGE.md`
- `docs/README.md`
- `docs/architecture/documentation-layers.md`
- `docs/doc-lifecycle-manifest.json`
- `docs/doc-lifecycle.schema.json`
- `docs/domain/context-map.md`
- `docs/domain/claim-authority.md`
- `.harness/README.md`
- `.agents/skills/coding-harness/SKILL.md`

Supporting docs:

- `docs/lifecycle/**`
- `docs/guardrails/**`
- `docs/automations/**`
- `docs/agents/**`
- module READMEs under `src/lib/**`

Generated docs/artifacts:

- `AI/context/diagram-context.md`
- diagram artifacts
- runtime/evidence packets and generated reports
- generated scaffold docs under `src/templates/**`

Research/evidence docs:

- `.harness/research/**`
- `.harness/audits/**`
- `.harness/review/**`
- `.harness/evals/**`
- `.harness/solutions/**`
- `.harness/implementation-notes/**`

Historical/archive docs:

- superseded `.harness/plan/**`
- superseded `.harness/specs/**`
- `docs/archive/**`
- `docs/ideation/**` unless promoted

Agent entry points:

- `AGENTS.md`
- `docs/agents/01-instruction-map.md`
- `UBIQUITOUS_LANGUAGE.md`
- `.agents/skills/coding-harness/SKILL.md`
- `.harness/README.md` when touching Project Brain/control-plane evidence

Human entry points:

- `README.md`
- `docs/README.md`
- `CONTRIBUTING.md`
- `ARCHITECTURE.md`
- `docs/lifecycle/issue-to-main.md`
- `docs/brand/README.md`

## Agent Compatibility Review

Strengths:

- Agent discovery is explicit through `AGENTS.md`.
- Skill entry point is strong and command-truth oriented.
- Docs lifecycle metadata gives agents a way to classify docs.
- `.harness/README.md` prevents many authority mistakes.
- Truth-lane language matches the user's repeated steering and is agent-native.

Risks:

- Long canonical docs increase context loading cost.
- Some older research/plan/spec files can look current if opened without
  `.harness/README.md`.
- Markdown/frontmatter checks do not prove that an agent chose the right doc.
- Project-local reviewer roles can be documented but unavailable in a stale
  runtime, which creates an instruction/runtime mismatch.
- Generated surfaces are useful for orientation but dangerous if agents patch
  them as source truth.

Agent-specific recommendations:

- Add `harness docs-task-eval --json` later with fixtures such as:
  "PR checks are green but CodeRabbit has unresolved threads", "research note
  says one thing, manifest says another", "downstream scaffold doc needs update".
- Add a canonical-source selection test to docs-gate.
- Add status metadata to research and implementation notes.
- Add "do not use this as current doctrine" banners to archive/research files
  lacking admission.
- Keep `AGENTS.md` as the binding surface, but route deep clauses to guardrails
  with stable anchors.

## Current Strengths

- Evidence discipline is much stronger than the reference project because the
  product domain requires it.
- The truth-lane model is a real differentiator and should be preserved.
- The .harness control-plane map is unusually valuable; it names authority
  levels instead of hoping agents infer them.
- Ubiquitous language is already a canonical artifact, not an afterthought.
- Docs lifecycle metadata and `pnpm docs:lifecycle` are the right enforcement
  foundation.
- The packaged skill is agent-native and already states command truth,
  validation, and failure boundaries.
- Research archives are rich and strategically valuable if kept secondary until
  promoted.

## Gaps

| Gap | Current State | Evidence | Why It Matters | Proposed Fix | Priority | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| Reader-task validation | Shape checks exist, task checks do not. | docs:lifecycle and docs-gate pass shape. | A doc can lint and still misroute agents. | Add docs-task eval fixtures. | P0 | Agent dry-run pass/fail. |
| Research metadata | Research README is thin. | 209 research/plan/spec/note files. | Old research can leak into canon. | Add frontmatter/status and promotion workflow. | P0 | Metadata checker on research/notes. |
| README overgrowth | README is 1,022 lines. | line count. | Onboarding and reference compete. | Move deep command catalog to reference pages. | P1 | Onboarding task score improves. |
| AGENTS density | AGENTS is 512 lines. | line count. | Agents may miss conditions. | Route specialized clauses to guardrails while preserving binding rules. | P1 | Prompt-loading eval. |
| Automation runbook uniformity | New docs good; older automation surfaces may vary. | Mixed docs across repo. | Recurring work needs consistent stop conditions. | Add runbook template. | P1 | Runbook lint. |
| SemVer/docs lifecycle integration | Started in manifest and PR template. | docs lifecycle fields exist. | Downstream changes need release impact clarity. | Add SemVer impact matrix. | P1 | docs:lifecycle + PR template gate. |
| Archive policy | .harness map has classification, not full archive workflow. | Many historical artifacts. | Review noise and stale doctrine risk. | Add archive decision process. | P2 | Archive-candidate report. |

## Recommendations

### P0: Add Reader-Task Documentation Evals

Recommendation: Add a task-based documentation eval lane.

Current problem: Existing gates prove metadata, links, and markdown hygiene, but
not whether a human or agent can complete the intended task.

Concrete evidence: The audit found 29 governed docs, 249 docs markdown files,
and many repeated lifecycle/validation instructions. Passing docs-gate does not
prove canonical-source selection.

Affected reader: Codex agents, maintainers, contributors.

Affected agent workflow: startup routing, PR closeout, research promotion,
truth-lane classification, downstream install.

What changes: Add fixtures that present a scenario and assert the expected
canonical doc, command, stop condition, and forbidden evidence claim.

What gets deleted/merged/archived: Nothing immediately.

Why this is better: It tests documentation by behavior rather than compliments.

Validation method: `pnpm docs:task-eval` or later
`harness docs-task-eval --json`, included in docs-gate once stable.

Priority: P0.

### P0: Expand Research And Notes Metadata

Recommendation: Add status frontmatter to research, audits, implementation
notes, plans, and specs when they are touched or promoted.

Current problem: Research and notes are correctly classified as secondary in
policy, but many files do not carry local status metadata.

Concrete evidence: 209 files exist across `.harness/research`,
`.harness/implementation-notes`, `.harness/specs`, and `.harness/plan`.

Affected reader: Agents and maintainers reading historical evidence.

Affected agent workflow: research-to-canon promotion, implementation routing,
audit synthesis.

What changes: Use metadata:

```yaml
---
status: raw | reviewed | distilled | promoted | archived
source_type: conversation | PR | audit | research | implementation
related_project: coding-harness
related_module:
decision_impact: none | low | medium | high
agent_hot_path: true | false
canonical_destination:
reviewed_at:
---
```

What gets deleted/merged/archived: No deletion yet; unpromoted files become
explicit research or historical context.

Why this is better: It lets agents identify authority without reading an entire
archive.

Validation method: Add a metadata checker for touched `.harness/research/**`
and `.harness/implementation-notes/**`.

Priority: P0.

### P1: Shrink README Into A True Human Front Door

Recommendation: Move deep command reference and detailed governance catalog
from `README.md` into routed reference docs while keeping product identity,
install, quick lifecycle, and next commands.

Current problem: `README.md` is 1,022 lines and mixes onboarding with command
reference.

Concrete evidence: Line count and inspectional reading show product overview,
command catalog, validation, architecture, and governance in one file.

Affected reader: New human operators.

Affected agent workflow: Agents may over-load README instead of targeted docs.

What changes: Add or strengthen command reference pages and leave README with
task routing.

What gets deleted/merged/archived: No content deletion without migration; move
with redirects/links.

Why this is better: Readers can start faster, agents can load less context.

Validation method: Human onboarding dry-run plus link check and command
reference parity test.

Priority: P1.

### P1: Standardize Automation Runbooks

Recommendation: Require automation docs to use the reference-inspired template:
role, trigger, schedule, scope, sources, decision rules, workflow, PR/change
rules, validation, summary, stop condition, feedback loop.

Current problem: New automation docs are close; older recurring workflows may
not share the same shape.

Concrete evidence: Reference automation docs are consistently actionable; Coding
Harness has many automation and heartbeat surfaces.

Affected reader: Automation agents and maintainers.

Affected agent workflow: CI sweeps, CodeRabbit sweeps, Linear sync,
dependency/toolchain refresh.

What changes: Add runbook template and lint required headings for active
automation docs.

What gets deleted/merged/archived: Archive obsolete automation docs after stop
condition proof.

Why this is better: Recurring tasks become auditable and self-correcting.

Validation method: runbook heading lint and one automation dry-run.

Priority: P1.

### P1: Add SemVer And Distribution Impact Matrix

Recommendation: Extend docs lifecycle governance with a SemVer matrix for source
docs, packaged skill docs, downstream scaffold docs, generated templates, and
public CLI behavior.

Current problem: SemVer fields exist, but the release impact decision is not yet
fully teachable from one matrix.

Concrete evidence: Manifest has `semverDefault`; PR template asks lifecycle
impact; downstream templates must not be polluted.

Affected reader: Maintainers and release agents.

Affected agent workflow: PR closeout and package release.

What changes: Add a small matrix under docs lifecycle or release/change-control
docs.

What gets deleted/merged/archived: Merge duplicate SemVer prose into the matrix.

Why this is better: Agents can classify release impact mechanically.

Validation method: PR template gate fixture for docs-only, skill, scaffold, and
CLI changes.

Priority: P1.

### P2: Deduplicate .harness Audit Rows

Recommendation: Remove duplicate/overlapping `.harness/audits/**` entries
from `.harness/README.md` in the next cleanup pass.

Current problem: Directory map includes both a specific audit pattern and a
general audits row with overlapping meaning.

Concrete evidence: Inspection found two rows for `.harness/audits/**`.

Affected reader: Agents classifying audit authority.

Affected agent workflow: Audit placement and research vs operator audit
routing.

What changes: Keep one row for `.harness/audits/**` and one for
`.harness/research/audits/**`.

What gets deleted/merged/archived: Merge duplicate row only.

Why this is better: Reduces authority ambiguity.

Validation method: `pnpm docs:lifecycle` and docs-gate.

Priority: P2.

### P2: Add Archive Candidate Report

Recommendation: Add a report that finds docs with no inbound links, no manifest
entry, no evidence-pattern admission, and no active-artifact reference.

Current problem: Delete decisions are currently manual and risky.

Concrete evidence: Large docs/research surface; many historical docs.

Affected reader: Maintainers.

Affected agent workflow: Cleanup, docs-gate, research promotion.

What changes: Advisory report only; no automatic deletion.

What gets deleted/merged/archived: Nothing until reviewed.

Why this is better: Finds stale docs without destroying evidence.

Validation method: `harness docs-archive-candidates --json` later.

Priority: P2.

## Proposed Architecture

Keep the existing structure but sharpen taxonomy:

```text
docs/
  README.md                         # human and agent docs front door
  brand/                            # product identity and naming
  lifecycle/                        # issue-to-main operating model
  domain/                           # ubiquitous language extensions/context maps
  architecture/                     # human-authored source maps
  agents/                           # progressive-disclosure agent governance
  guardrails/                       # risk-class review standards
  automations/                      # recurring runbooks
  reference/                        # command/reference material split from README
  decisions/                        # future source docs if ADRs move out of .harness
  archive/                          # explicitly historical docs

.harness/
  README.md                         # authority and tracking map
  research/
    README.md                       # research intake and promotion workflow
    deep/                           # raw/reviewed source evidence
    audits/                         # research-derived audits
  implementation-notes/             # execution history and steering admissions
  specs/                            # admitted or historical specs
  plan/                             # admitted or historical plans
  decisions/                        # ADRs and accepted constraints
  knowledge/                        # Project Brain facts/hypotheses/rules
  runs/, evidence/, metrics/        # generated runtime unless promoted
```

Governance model:

- Canon updates require docs lifecycle metadata and docs-gate.
- Research promotion requires status metadata, concrete evidence, accepted
  principle, target canonical destination, and validation.
- Generated artifacts require source owner and regeneration path.
- Terminology changes require glossary update and sibling search.
- Agent-hot-path docs require reader-task evals.
- Archive decisions require inbound-link/citation check and explicit historical
  status.

## Research-To-Canon Workflow

Expected flow:

```text
raw research
-> reviewed evidence
-> distilled audit finding
-> accepted principle
-> canonical doc / glossary / runbook / guardrail
-> validator / workflow / schema / eval fixture
-> archived evidence link
```

Acceptance criteria for promotion:

- Source evidence is named.
- Past problem is concrete.
- Canonical destination is named.
- The promoted rule changes a command, decision, validation, stop condition, or
  reader task.
- Validation command is recorded.
- Original research remains linked but not hot-path.

Archive rules:

- Raw research with no accepted pattern remains research-only.
- Superseded plans/specs become historical unless active artifacts reference
  them.
- Implementation notes older than their delivery lane become history unless
  they contain an admitted rule.
- Generated output is never canon unless explicitly promoted as a fixture or
  reviewed artifact.

## Roadmap

### 30 Days

| Item | What | Why | How | Affected Files | Validation | Benefit |
| --- | --- | --- | --- | --- | --- | --- |
| Reader-task eval design | Define 8-12 doc navigation scenarios. | Prevent agent confusion. | Add fixtures for truth lanes, research promotion, PR closeout, downstream install. | `tests`, docs-gate docs. | New eval command advisory pass. | Proves docs by use. |
| Research metadata template | Add frontmatter template and touched-file checker. | Stop research-as-canon drift. | Expand `.harness/research/README.md` and implementation notes README. | `.harness/research/README.md`, scripts. | Metadata checker. | Clear authority. |
| SemVer matrix | Add docs/distribution impact matrix. | Make release impact teachable. | Extend lifecycle or release docs. | `docs/lifecycle/**`, `CONTRIBUTING.md`. | PR template fixtures. | Better closeout. |
| Runbook template | Standardize active automation runbooks. | Make recurring work self-correcting. | Add required headings and examples. | `docs/automations/**`. | docs lint/runbook lint. | Less drift. |

### 60 Days

| Item | What | Why | How | Affected Files | Validation | Benefit |
| --- | --- | --- | --- | --- | --- | --- |
| README split | Move deep command catalog to reference docs. | Reduce onboarding burden. | Keep README as front door; route details. | `README.md`, `docs/reference/**`. | Link check, onboarding dry-run. | Faster first use. |
| AGENTS compression | Move specialized clauses behind routed guardrails. | Reduce agent context miss risk. | Preserve mandatory rules, link deep rules. | `AGENTS.md`, `docs/guardrails/**`. | Agent prompt-loading eval. | Better agent reliability. |
| Archive candidate report | Generate advisory stale-doc list. | Manage surface area. | Compute inbound links, manifest entries, evidence admissions. | scripts/docs-surface. | `--json` report. | Safer cleanup. |
| Glossary/context sync | Enforce term ownership by context. | Prevent DDD drift. | Add context-owner fields or checks. | `UBIQUITOUS_LANGUAGE.md`, `docs/domain/context-map.md`. | terminology lint. | Clearer model. |

### 90 Days

| Item | What | Why | How | Affected Files | Validation | Benefit |
| --- | --- | --- | --- | --- | --- | --- |
| Promote docs-task eval into docs-gate | Make task validity part of governance. | Shape-only validation is insufficient. | Add stable scenario suite to required docs-gate. | docs-gate, tests. | docs-gate required pass. | Agent-safe docs. |
| Research promotion dashboard/report | Show raw, reviewed, promoted, archived counts. | Keep research durable but bounded. | Use metadata and evidence-patterns manifest. | `.harness/research/**`, CLI. | report snapshots. | Better knowledge durability. |
| Downstream doc distribution guard v2 | Prove source-only docs do not pollute downstream projects. | Protect greenfield/brownfield installs. | Extend template guard and init/upgrade fixtures. | `src/templates/**`, docs lifecycle. | scaffold regression tests. | Cleaner distribution. |
| Human/agent interview loop | Run quarterly doc task interviews or simulations. | Avoid compliments and stale assumptions. | Ask past-use questions and capture failures as eval cases. | `.harness/research/audits/**`, docs evals. | new scenarios added. | Continuous improvement. |

## Final Position

Coding Harness should not become a larger copy of the reference docs. It should
adopt the reference repository's best discipline: small front doors, focused
guardrails, and automation runbooks that drive real action. Coding Harness
should preserve its own stronger ideas: truth lanes, evidence receipts, Project
Brain, agent-hot-path instructions, and docs lifecycle enforcement.

The guiding rule for every future documentation change should be:

```text
Do not ask whether documentation is good.
Ask what concrete task it helped complete.
```
