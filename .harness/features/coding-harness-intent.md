# Coding Harness Intent

## Table of Contents

- [How To Read This Artifact](#how-to-read-this-artifact)
- [Project Intent](#project-intent)
- [Core Thesis](#core-thesis)
- [Strategic Direction](#strategic-direction)
- [Intended Users](#intended-users)
- [Non-Goals](#non-goals)
- [System Philosophy](#system-philosophy)
- [Architectural Patterns](#architectural-patterns)
- [Agent-Native Design Assumptions](#agent-native-design-assumptions)
- [Harness And Governance Model](#harness-and-governance-model)
- [Critical Constraints](#critical-constraints)
- [Stable Interfaces](#stable-interfaces)
- [Sources Of Complexity](#sources-of-complexity)
- [Sources Of Leverage](#sources-of-leverage)
- [Probable Moat](#probable-moat)
- [Modern Standards Assessment - May 2026](#modern-standards-assessment---may-2026)
- [Strategic Review](#strategic-review)
- [UX Philosophy](#ux-philosophy)
- [What Future Agents Should Preserve](#what-future-agents-should-preserve)
- [What Future Agents Should Challenge](#what-future-agents-should-challenge)
- [Open Questions](#open-questions)
- [Recommended Decisions](#recommended-decisions)
- [Strategic Contradictions](#strategic-contradictions)
- [Suggested Simplifications](#suggested-simplifications)
- [Missing Capabilities](#missing-capabilities)
- [Long-Term Scalability Concerns](#long-term-scalability-concerns)
- [Drift Detection Signals](#drift-detection-signals)
- [Evidence & Traceability Matrix](#evidence--traceability-matrix)

## How To Read This Artifact

This file records repository intent as of 2026-05-07. It is not marketing copy and it is not a replacement for API docs. It is an operational interpretation of the repository's real shape, built from source, scripts, docs, CI, tests, governance files, and live preflight behavior.

Claim confidence labels:

- Hard evidence: directly visible in source, configuration, scripts, docs, tests, or command output.
- Strong inference: not stated as a single sentence, but repeatedly implied by implementation boundaries and workflows.
- Weak speculation: plausible strategic reading that should be verified with maintainers before becoming policy.

The canonical preflight command is `bash scripts/codex-preflight.sh --stack auto --mode required`. Snapshot outcomes should be recorded in time-scoped review or closeout artifacts with commit SHA and treated as evidence for that snapshot only.

## Project Intent

Coding Harness is trying to become a TypeScript control plane for agentic software work. Its real target is not "AI coding" in the abstract. It is the operational gap between a human asking an agent to work and the repository being able to prove that the work is safe, reviewable, current, and aligned with local policy.

Evidence:

- `README.md:8-17` defines it as a CLI control plane for AI-agent-operated repositories, where humans steer and agents execute safely, with PR lead time as the north-star metric.
- `README.md:21-26` says the system gives agents a repo-local way to verify work, validate policy, stage CI migrations, and expand autonomy with evidence.
- `harness.contract.json:9-20` encodes the same mission, metric, bottleneck, autonomy boundary, and safety floor as contract data, not just prose.
- `src/cli.ts:52-64` places `harness next --json` at the "Start here" path for agents.

Interpretation:

The repo is best understood as a harness around coding agents, CI, review systems, repo memory, and governance files. It is not trying to replace Codex, Claude, GitHub, CircleCI, CodeRabbit, Linear, Semgrep, or local developer tooling. It is trying to make those systems composable, inspectable, and harder for agents to bypass accidentally.

## Core Thesis

The core thesis is that agentic development becomes reliable when repeated human review friction is converted into deterministic repo-local contracts, machine-readable next-action packets, policy gates, memory surfaces, and rollback-aware automation.

Hard evidence:

- `docs/roadmap/north-star.md:22-37` names PR lead time as the primary metric and review rework loops as the main bottleneck.
- `docs/roadmap/north-star.md:58-67` defines the safety floor: deterministic evidence, current-head SHA discipline, bounded auto-remediation, rollback evidence, and independent review.
- `src/lib/decision/harness-decision.ts:52-153` defines a structured decision envelope with next command, required evidence, stop conditions, hidden plumbing, human requirements, write/network requirements, and failure class.
- `src/commands/next.ts:120-260` converts repository state into explicit next-command guidance, blockers, evidence refs, and safe alternatives.
- `src/commands/health-core.ts:136-232` models governance, memory, context, docs, CI migration, and plan checks as gates with structured results.

Strong inference:

The repository assumes the winning unit of agent work is not a prompt. The winning unit is a repeatable repo-native loop: inspect state, choose safe next action, run canonical validation, record evidence, and promote repeated failures into durable rules.

## Strategic Direction

The strategic direction should be to narrow the product around the repeatable PR loop, not to keep adding governance surfaces indefinitely. The repo is already past the point where "more coverage" is automatically good. From here, unfocused expansion is architectural debt unless it removes a real blocker in the PR loop.

The strongest product path is:

1. Bootstrap a repository into a known governance shape.
2. Give agents a single safe next-action command.
3. Run deterministic validation and review gates.
4. Keep CI, review, memory, and policy surfaces synchronized.
5. Promote repeated failures into source-controlled learned rules.
6. Measure whether PR lead time and review rework actually improve.

Evidence:

- `README.md:150-166` frames the adoption jobs as bootstrap/align, policy in code, CI/review trust migration, and autonomy expansion with artifacts.
- `README.md:168-198` lists today's strongest surfaces: init/upgrade/eject, CI migration, review/docs gates, pilot control plane, repo-local preflight, context/search, and multi-repo audit.
- `src/lib/init/cli.ts:50-177` shows init is not a shallow scaffolder; it detects existing contract state, handles check/update/migrate/interactive modes, and preserves existing contract posture.
- `.agents/skills/coding-harness/SKILL.md:74-100` defines the harness skill around repo-local scaffolding, governance files, managed/adaptable files, and safe validation.

Recommendation:

Make "reduce review rework for agent-authored PRs" the commercial center. Everything else should justify itself by reducing ambiguity, reducing review delay, preserving safety, or making downstream installs easier to trust. If a subsystem cannot explain how it improves that loop, it should be demoted, hidden from the default path, or removed.

## Intended Users

Primary users:

- Human maintainers who want agents to work inside real repositories without losing control.
- AI coding agents that need deterministic instructions, command contracts, validation gates, and safe next actions.
- Governance reviewers who need evidence that policy was enforced on the current branch and current head.
- Staff engineers or platform owners trying to standardize repo operations across multiple projects.

Secondary users:

- CI maintainers coordinating CircleCI, GitHub Actions, Semgrep Cloud, CodeRabbit, and release workflows.
- Agent-skill builders who need an installed downstream skill surface.
- Product or technical leads evaluating whether an agent workflow can be made operationally safe.

Evidence:

- `README.md:56-64` explicitly says agents should start with `harness next --json`, while humans can use a smaller quickstart.
- `README.md:69-106` splits install paths for global CLI, project install, and single-command repo bootstrap.
- `.github/PULL_REQUEST_TEMPLATE.md:11-21` requires validation, independent review, Linear linkage, and north-star learning loop evidence from PR authors.
- `docs/agents/04-validation.md:27-36` makes validation a proof obligation rather than an optional developer habit.

## Non-Goals

Hard non-goals already encoded in the contract:

- It should not replace coding agents or become an agent runtime.
- It should not accept hidden broad autonomy.
- It should not bypass independent review.
- It should not optimize for ceremony instead of PR lead time.
- It should not make GitHub Actions the automatic PR gate without an intentional contract migration.

Evidence:

- `harness.contract.json:21-27` lists non-goals for replacing agents, hidden broad autonomy, and ignoring PR lead-time impact.
- `README.md:11-17` describes the harness as a layer around agents, not the agent itself.
- `README.md:200-224` and `harness.contract.json:189-221` preserve the CI ownership split: CircleCI for PR governance/security, CodeRabbit for independent review, Semgrep Cloud as external required security check, and GitHub Actions for fallback/release.
- `.github/PULL_REQUEST_TEMPLATE.md:14-21` makes independent review and merge-blocking conditions explicit.

Recommended additional non-goal:

Do not become a general-purpose platform automation framework. The harness should remain anchored to agent-authored repository work, PR readiness, and governance evidence.

## System Philosophy

The system philosophy is canonical-only, evidence-first, and repo-local.

Important beliefs:

- Source-controlled contracts should beat remembered process.
- Machine-readable output should be preferred when an agent or CI will consume it.
- Current-head evidence matters more than old green checks.
- Review independence is part of the safety model, not a social nicety.
- Local memory is valuable only when it is deterministic enough to improve future execution.
- Agent autonomy should expand through narrow, auditable loops instead of broad trust.

Evidence:

- Root `AGENTS.md` requires repo evidence over copied instructions and calls out `pnpm@10.33.0`, Node `>=24.0.0`, canonical gates, and exact command reporting.
- `docs/agents/04-validation.md:143-154` classifies failures as implementation, validation, environment, and policy/contract blockers.
- `docs/agents/06-security-and-governance.md:24-48` defines conservative defaults: no direct pushes to protected branches, narrow tokens, artifact-backed automation, and rollback plans.
- `src/cli.ts:96-147` preserves structured stdout for robot mode and keeps fuzzy correction guidance on stderr.

## Architectural Patterns

### CLI registry and capability metadata

The CLI is registry-driven. Command specs, aliases, mutability, retryability, expected artifacts, required flags, safe alternatives, and audience metadata are encoded in source.

Evidence:

- `src/lib/cli/command-registry.ts:49-116` builds the command registry, catalog, aliases, and command specs.
- `src/lib/cli/registry/command-capabilities.ts:3-47` defines schema, categories, mutability, retryability, risk tier, and audience.
- `src/lib/cli/registry/command-capabilities.ts:196-238` maps required flags, expected artifacts, safe-first alternatives, and risk tiers.

Intent:

Agents should not need to infer whether a command mutates state, needs a PR, or has a safer alternative. That should be queryable from the harness.

### Contract-centered governance

The `harness.contract.json` file and TypeScript contract types are the repo's policy spine.

Evidence:

- `src/lib/contract/types-core.ts:1477-1538` defines the core contract fields.
- `src/lib/contract/types-core.ts:1540-1560` provides default contract values.
- `src/lib/contract/types-core.ts:784-849` models CI provider policy and CI ownership.
- `src/lib/contract/types-core.ts:851-915` models context integrity policy.

Intent:

Repository policy should be machine-checkable, diffable, and scaffoldable into downstream repos. The contract is a product artifact, not an implementation detail.

### Gates as structured evidence

The repo repeatedly models checks as structured gates rather than free-form scripts.

Evidence:

- `src/commands/health-core.ts:31-79` defines gate reports and health reports.
- `src/commands/docs-gate-core.ts:83-125` defines docs-gate report structure.
- `.agents/skills/coding-harness/SKILL.md:148-150` states that all gates emit canonical `GateResult` JSON.
- `scripts/verify-work.sh:43-60` is the canonical verification runner, with stack and mode controls.

Intent:

Validation should produce evidence that agents can summarize, CI can inspect, and reviewers can trust.

### Progressive disclosure documentation

Docs are organized as always-read front doors plus routed deeper references.

Evidence:

- `docs/architecture/documentation-layers.md:21-35` defines Layer 0 through Layer 3 documentation.
- `docs/agents/01-instruction-map.md` routes domain work into specific SOPs.
- Root `AGENTS.md` says `README.md` is product-facing and `docs/agents/*.md` are progressive-disclosure governance references.

Intent:

Future agents should not load the entire repo into context. They should start from narrow routing surfaces and open only the task-relevant docs.

### Memory and context integrity

The repo treats memory as an operational surface, not a vague assistant feature.

Evidence:

- `.harness/knowledge/INDEX.md:5-18` indexes Project Brain domains.
- `.harness/review-log.md:5-15` records review cadence and last review state.
- `docs/agents/15-context-integrity-compact.md:59-84` defines context integrity invariants and checkpoint transitions.
- `src/lib/context-compound/indexer.ts:1-9` describes context compound indexing for Project Brain and documentation surfaces.

Intent:

Agent context should be rebuildable from repo-local artifacts, and compression or memory shortcuts should not erase decision constraints.

## Agent-Native Design Assumptions

This repository's agent-native model is real. It is not just prompt text wrapped around ordinary scripts.

Assumptions:

- Agents need one canonical entrypoint when they are unsure: `harness next --json`.
- Agents need commands to tell them whether they mutate state, require human approval, or have safe alternatives.
- Agents need structured blockers and stop conditions.
- Agents need validation outputs that can be parsed without reading terminal prose.
- Agents need repository-local memory, not only model memory.
- Agents need docs that route context instead of flooding context.

Evidence:

- `src/commands/next.ts:27-42` exposes options for JSON output, evidence source, risk profile, and scope.
- `src/commands/next.ts:120-260` emits blocked decisions, safe next commands, evidence references, and stop conditions.
- `src/lib/decision/harness-decision.ts:33-50` models friction, delay, and bottleneck categories.
- `src/lib/decision/harness-decision.ts:102-153` defines decision envelope fields that are explicitly agent-operational.
- `src/cli.ts:133-147` protects robot-mode stdout from fuzzy suggestions.

Strategic conclusion:

The strongest part of the project is the decision packet plus gate model. If this repo became commercially valuable, these agent-native contracts are the core intellectual asset to protect and simplify.

## Harness And Governance Model

The governance model is intentionally multi-layered:

- Repository contract in `harness.contract.json`.
- Required CI checks in `.harness/ci-required-checks.json`.
- Review independence in CodeRabbit and PR template requirements.
- CircleCI as primary PR governance and security executor.
- GitHub Actions for release publishing and fallback only.
- Semgrep Cloud as independent external security check.
- Repo-local validation wrappers in `scripts/`.
- Project Brain and Local Memory for durable learning.
- Documentation routing through `AGENTS.md`, `CODESTYLE.md`, and `docs/agents/`.

Evidence:

- `README.md:200-224` states the CI/security ownership model.
- `.harness/ci-required-checks.json:1-20` sets active provider to CircleCI and maps required checks.
- `.circleci/config.yml:3-142` defines shared governance job setup and common tool installation.
- `.circleci/config.yml:143-205` defines PR pipeline jobs for template, Linear, risk, and dependency checks.
- `.github/workflows/release-private-npm.yml:1-25` limits release workflow to tags and manual dispatch.
- `docs/agents/06-security-and-governance.md:57-83` records CI ownership, secret posture, code governance, and risk controls.

Interpretation:

The harness is betting that governance only works for agents when it lives in the repo and is enforced by CI. That is the right bet. The risk is that the number of governance layers becomes harder to operate than the work it protects.

## Critical Constraints

These constraints should be treated as architectural boundaries:

- Node `>=24.0.0` and `pnpm@10.33.0` are the current runtime contract.
- Local ESM imports must include `.js` extensions.
- CLI automation should prefer `--json`.
- Exit code `0` means success, `1` means failed/blocked/unknown command by default, and `2` means usage error unless command-specific docs say otherwise.
- Review and gate evidence must be tied to current head where applicable.
- High-risk changes require human mediation.
- CI ownership must remain explicit and synchronized.
- Generated or scaffolded artifacts need managed/adaptable ownership metadata.
- Docs-gate surfaces must stay synchronized when governance, validation, tooling, runtime, or architecture-context behavior changes.

Evidence:

- Root `AGENTS.md` lists runtime/toolchain, baseline gates, branch-protection defaults, and local ESM import rules.
- `src/cli.ts:96-111` documents robot mode, exit semantics, and fuzzy command correction behavior.
- `src/commands/review-gate-core.ts:131-201` resolves GitHub check runs using current head SHA and source constraints.
- `.agents/skills/coding-harness/SKILL.md:83-100` distinguishes managed and adaptable installed files.

## Stable Interfaces

Preserve these unless an explicit migration plan and compatibility window exist:

- CLI command names and JSON output contracts, especially `next`, `init`, `upgrade`, `verify`, `review-gate`, `docs-gate`, `plan-gate`, `policy-gate`, `risk-tier`, and `commands --json`.
- `HarnessDecision` schema and validation semantics in `src/lib/decision/harness-decision.ts`.
- Gate result JSON semantics used by health, docs, plan, review, and validation gates.
- `harness.contract.json` and matching TypeScript contract schema.
- `.harness/ci-required-checks.json` required-check manifest.
- `scripts/codex-preflight.sh`, `scripts/verify-work.sh`, `scripts/validate-codestyle.sh`, and codestyle parity scripts.
- PR template testing and review artifact fields.
- Project Brain paths under `.harness/knowledge/**`, `.harness/decisions/**`, `.harness/review-log.md`, and `.harness/README.md`.
- Harness Engineering plan artifact discovery under `.harness/plan/**.md`, including non-date-prefixed plan filenames consumed by `plan-gate`.
- The installed downstream skill shape under `.agents/skills/coding-harness/`.

Why:

These are the surfaces agents, CI, downstream repositories, and reviewers are most likely to depend on. Breaking them silently destroys the harness's main value: operational predictability.

## Sources Of Complexity

### Intentional complexity

- Cross-provider governance: CircleCI, CodeRabbit, Semgrep Cloud, GitHub Actions, GitHub PR state, Linear, local scripts, and memory all need alignment.
- Scaffolding and update lifecycle: `init`, `upgrade`, `eject`, managed files, adaptable files, rollback, and drift detection are inherently complex.
- Current-head review proof: checking CI/review status for the right commit is legitimately necessary.
- Context integrity: agent context compression and memory can create subtle correctness failures, so explicit checkpoints are justified.

### Accidental or suspect complexity

- `src/commands/ci-migrate-core.ts` is about 10,402 lines. That is a module boundary failure even if the behavior is valuable.
- `src/commands/ci-migrate.test.ts` is about 6,319 lines. That suggests the behavior is too entangled or the test fixture strategy is too large.
- `src/commands/review-gate-core.ts` is about 1,939 lines and imports many domains. That is strategically important but fragile.
- `src/lib/contract/types-core.ts` is about 1,776 lines. The contract has become broad enough that readers need generated maps and targeted schemas.
- There are about 169 files under `src/commands/` and about 600 TypeScript files across source and tests. Command discoverability is therefore a product requirement, not a nice-to-have.
- `memory.json:1-26` still contains placeholder values like `replace-with-repo-name`, which conflicts with the repo's high standard for repo-local memory.
- `src/lib/context-compound/indexer.ts:56-121` contains a simple custom frontmatter parser. For a context-integrity system, ad hoc parsing is a weak point unless deliberately constrained.

Interpretation:

The repo has real leverage, but it also has local-maximum architecture: hard-won operational cases have accumulated in large modules faster than stable internal boundaries have been extracted.

## Sources Of Leverage

The main leverage is not any single command. It is the combination of:

- Contract-backed repo state.
- Agent-readable next-action packets.
- Structured gate evidence.
- CI/review provider alignment.
- Scaffolding and update lifecycle for downstream repos.
- Learned-failure promotion into repo memory.
- Progressive-disclosure docs that keep agent context bounded.
- Governance rules that are executable, not merely advisory.

Evidence:

- `harness.contract.json` captures mission, product surfaces, CI ownership, branch protection, remediation, learning, and loop-stage contracts.
- `src/lib/decision/harness-decision.ts` and `src/commands/next.ts` convert state into agent action.
- `scripts/verify-work.sh` and `docs/agents/04-validation.md` define validation evidence loops.
- `.github/PULL_REQUEST_TEMPLATE.md` forces PR authors to report exact command outcomes and independent review artifacts.
- `.agents/skills/coding-harness/SKILL.md` packages the harness for agent consumption in downstream repositories.

## Probable Moat

The probable moat is accumulated operational scar tissue encoded as deterministic workflow contracts.

This is hard to copy because it requires:

- Real PR-loop failure cases.
- Current-head review gate discipline.
- CI provider ownership boundaries.
- Downstream scaffold/update/eject lifecycle.
- Agent-readable decision schemas.
- Memory and context integrity rules.
- Enough tests and fixtures to preserve edge cases.
- Willingness to keep governance executable instead of aspirational.

What is not the moat:

- Generic AI governance language.
- A large CLI command count by itself.
- Prompt templates.
- Static status matrices.
- A particular CI provider.

Strategic warning:

If the harness feels like importing one person's entire operating system, it will not be broadly adopted. The moat should be protected by making the smallest compelling path extremely clear, not by exposing every internal governance lane up front. Operational contracts are only a moat when they are portable, enforced, and cheaper than the failures they prevent.

## Modern Standards Assessment - May 2026

### Ahead of current standards

- Agent-native decision contracts: `HarnessDecision` provides next action, evidence, permissions, stop conditions, and failure classification in a way many 2026 repos still leave to prompts.
- Repository cognition: progressive docs, command catalog metadata, Project Brain, Local Memory, and context-integrity docs are more deliberate than typical agent-ready repos.
- Governance as code: CI ownership, required checks, branch protection, review policy, and north-star questions are encoded in contracts and templates.
- Current-head review proof: review-gate source/head discipline is stronger than many PR automation setups.
- Evidence-first PRs: the PR template requires validation outcomes and independent review artifacts.
- Release posture: the release workflow includes pack smoke tests, SBOM generation, provenance/attestation behavior, and explicit auth mode handling.

### Aligned with current standards

- TypeScript CLI with strict package-manager/runtime contract.
- Machine-readable JSON for automation.
- CircleCI/GitHub/CodeRabbit/Semgrep separation of concerns.
- Secret handling and least-privilege posture in governance docs.
- Retry/throttling wrappers for GitHub API calls.
- Codestyle parity and validation wrapper scripts.
- Test-related and deep-test gates for behavior changes.

### Lagging or fragile

- Some core modules are too large for healthy long-term maintenance.
- The command surface is broad enough that onboarding and discoverability are strategic risks.
- Some status and roadmap docs appear more manual than telemetry-derived.
- `memory.json` contains placeholder data and should not be treated as real memory.
- Local Codex/Project Brain/Local Memory assumptions may limit portability for teams that are not using Jamie's environment model.
- Native dependencies such as SQLite/vector components can create install and CI portability friction.
- Ad hoc parsers in context infrastructure are riskier than structured parsers when metadata becomes operationally important.

### Over-engineered

- The governance surface is sometimes broader than the minimum product promise.
- CI migration and review-gate paths appear to carry many special cases in large modules.
- Some documentation layers risk becoming ceremony unless they stay tied to validation or measurable PR-loop improvement.

### Under-engineered

- The smallest compelling user path is not yet sharp enough.
- Adoption UX needs a clearer "install, run one command, reduce one painful PR loop" story.
- Observability around actual PR lead time and review rework should be harvested automatically, not mainly described.
- Internal module boundaries need more work around CI migration, review gate, contract schema, and context indexing.

## Strategic Review

### Is this project coherent?

Yes. It is more coherent than its file count suggests. The north star, contract, CLI entrypoint, validation docs, PR template, and CI ownership model all point at the same idea: let humans steer and agents execute safely, with PR lead time as the measurable outcome.

The coherence is fragile because the repo has many surfaces that can drift: docs, contract schema, generated templates, CI manifests, skills, Project Brain, Local Memory, and command metadata. The project needs ruthless pruning to keep the central story legible.

### Is the architecture pragmatic?

The architecture is pragmatic at the workflow level and less pragmatic at the module level.

Pragmatic:

- The CLI wraps real repo problems.
- The command catalog helps agents choose safe actions.
- The gates produce structured evidence.
- The CI/review split matches actual provider responsibilities.
- The init/update/eject lifecycle acknowledges that downstream repos drift.

Not pragmatic enough:

- Several modules are too large.
- Too much behavior is discoverable only after reading many docs.
- Some proof artifacts may cost more attention than they return.
- The shortest path for a new adopter is less obvious than the governance machinery.

The uncomfortable truth: the architecture has correctly identified the hard problem, but it has not yet earned all of its surface area. The next phase should be consolidation, not feature expansion.

### Is the complexity justified?

The core complexity is justified. Guarded agent operations in real repos require contracts, gates, current-head proof, and provider-specific handling.

The edge complexity is not all justified. Any compatibility layer, fallback path, or governance artifact that does not reduce review rework, preserve safety, or improve downstream updates should be treated as suspect. The default assumption for new surface area should be "no" until it proves leverage.

### Is the agent-native model real or performative?

It is real. The strongest proof is that the repository does not rely only on instructions telling agents what to do. It implements agent-readable command metadata, decision packets, structured gates, validation wrappers, skill packaging, memory surfaces, and context integrity rules.

Performative risk exists in the docs and status surfaces, not in the core architecture. If metrics and artifacts are not tied to live behavior, they are governance theater, not merely a documentation gap.

### What is genuinely differentiated?

- The `HarnessDecision` model.
- `harness next --json` as a safe action recommender.
- Current-head-aware review gate behavior.
- CI/review/security ownership encoded as contract data.
- Downstream repo scaffold/update/eject lifecycle.
- Project Brain plus Local Memory as repo-local operating memory.
- North-star learning loop that promotes repeated review failures into durable rules.

### What feels trend-driven?

- Broad AI-governance language when detached from gates.
- Status dashboards and roadmap matrices if not generated from live telemetry.
- Too many named workflows around the same PR loop.
- Any prompt growth that substitutes for improving the harness's deterministic behavior.

### What should be deleted immediately?

Do not delete broad areas blindly. The immediate candidates are narrow:

- Replace or remove the placeholder `memory.json` content unless it is still needed as a fixture. A placeholder memory file in a memory-first repo is bad signal.
- Retire stale compatibility references after confirming no downstream repos still depend on them.
- Remove dead fallback workflows that are not exercised by tests, CI, or documented migration windows.
- Delete or archive stale status claims that cannot be traced to current checks, telemetry, or an explicit review date.
- Hide non-core commands from the default human path if they do not help an agent open, verify, repair, or hand off a PR.
- Stop adding docs that repeat policy already encoded in contract or CI. Repetition here is not documentation; it is drift inventory.

### What should become core?

- `harness next --json`.
- The `HarnessDecision` envelope.
- Init/upgrade/eject lifecycle.
- `verify-work`, codestyle parity, and repo preflight wrappers.
- Review/docs/plan/policy gates.
- CI required-check parity.
- Project Brain learned-failure promotion, once its runtime state is non-placeholder and deterministic.
- A minimal adoption path that proves value in one PR.

The core should be small enough that a new maintainer can explain it without reciting the whole repository. If the core cannot be explained as "init, next, verify, review, learn", it is still too broad.

### What creates leverage?

The biggest leverage comes from turning repeated review comments, setup failures, CI drift, and agent ambiguity into source-controlled contracts and checks. Every time a repeated failure becomes a gate, a contract rule, or a scaffold update, future agents become cheaper to supervise.

### What creates drag?

- Large modules.
- Overlapping command names and workflows.
- Manual status surfaces.
- Local environment assumptions.
- Validation runtime bloat.
- Governance language that is not enforced by CI.
- Agent instructions that ask agents to remember what the harness could decide mechanically.
- Strategic claims that are not backed by harvested telemetry.
- Local-environment dependencies that make the project feel non-transferable.

### What would make this hard to copy?

Depth in operational cases, not breadth in features. The hard-to-copy version has excellent fixtures for real PR failures, review feedback loops, CI drift, branch protection mismatches, stale checks, memory drift, and scaffold migrations. It should be painfully specific and boringly reliable.

### What would make this commercially valuable?

A team should be able to install it, run one command, and see a measurable reduction in review rework or PR handoff ambiguity within a week.

Commercial value likely comes from:

- Repo onboarding and governance alignment for agent-heavy teams.
- PR readiness and review rework reduction.
- Provider-agnostic but provider-aware CI/review policy.
- Agent-safe command recommendations.
- Audit-ready evidence packs for regulated or high-trust teams.

The commercial product should not lead with "agent governance platform." It should lead with a concrete pain: agent PRs waste review time because they are hard to trust. Coding Harness should make them easier to trust without slowing everyone down.

### What would make developers adopt it?

- A minimal mode with fewer concepts.
- Fast local validation.
- Clear failure messages.
- No requirement to adopt Jamie-specific workflows.
- Excellent GitHub PR integration.
- Obvious escape hatches.
- Trust that the harness will not mutate unrelated files or impose hidden policy.

### Biggest risks

- The product becomes too personal to Jamie's workflow and not portable enough for other teams.
- Governance outpaces product value.
- Command count grows faster than command comprehension.
- Local memory and context systems become nondeterministic or hard to bootstrap.
- CI runtime becomes too heavy.
- Large modules become too risky to change.
- North-star metrics remain documented but not automatically measured.
- Agents learn to satisfy ceremony rather than improve PR quality.
- The moat stays implicit in Jamie-specific operating knowledge instead of becoming a portable product contract.
- The project wins architecture arguments but loses developer patience.

### Likely wrong assumptions

- That every team wants this much governance in the first install.
- That agent operators will read layered docs correctly without a very strong `next` path.
- That memory systems are trustworthy unless made deterministic and observable.
- That provider-specific CI/review integrations can stay manageable without sharper module boundaries.

### Smallest compelling version

The smallest compelling version is:

1. `harness init --minimal`
2. `harness next --json`
3. `harness verify-work --fast`
4. `harness review-gate --json`
5. A required-check parity check that keeps CircleCI, CodeRabbit, Semgrep, and GitHub branch protection aligned.
6. One learned-failure promotion loop that updates repo-local memory after repeated review issues.

Everything else should earn its place by strengthening that loop.

### If this became the company moat

Aggressively protect:

- The decision envelope schema.
- Current-head review evidence.
- Scaffold/update idempotency.
- Contract-to-CI-to-doc parity.
- Learned-failure promotion.
- Provider integration fixtures.
- The discipline that every major claim is traceable to repo evidence.

### If this fails

It will fail because the harness feels like a large governance import rather than a practical way to make agent PRs easier to merge. It will fail if it optimizes for policy completeness instead of demonstrable PR lead-time improvement. It will also fail if local context and memory features are unreliable outside this one development environment.

The failure mode will not be "the idea was too small." It will be "the idea was buried under its own operating model."

## UX Philosophy

The UX philosophy should be quiet, operational, and agent-readable.

Good UX in this repo means:

- One obvious command when uncertain.
- JSON output when automation consumes it.
- Human-readable explanations that name blockers plainly.
- No hidden mutation.
- Clear safe alternatives.
- Exact validation commands and outcomes.
- Documentation that routes, not overwhelms.
- Failure classes that let agents decide whether to fix code, rerun validation, stop for environment setup, or ask for human approval.

Evidence:

- `README.md:56-64` puts `harness next --json` first for agents.
- `src/cli.ts:133-147` protects stdout JSON and moves fuzzy guidance to stderr.
- `docs/agents/04-validation.md:143-154` provides failure classes.
- `src/commands/next.ts:186-260` recommends safe follow-up commands when evidence or git state is blocked.

## What Future Agents Should Preserve

- Keep the north-star metric and safety floor visible in contract, docs, and runtime checks.
- Preserve the CI ownership split unless there is a deliberate migration.
- Preserve current-head SHA discipline in review and CI checks.
- Prefer adding deterministic harness behavior over growing prompts.
- Keep command metadata accurate when commands are added or changed.
- Keep docs routed through progressive disclosure.
- Keep generated downstream files synchronized with source templates.
- Keep exact validation command reporting.
- Keep independent review independent.
- Promote repeated failures into Project Brain or learned-fix surfaces only when evidence is concrete.

## What Future Agents Should Challenge

- Any new command that overlaps an existing command without clearer capability boundaries.
- Any docs-only governance rule with no CI, script, or contract enforcement path.
- Any large module change that adds more behavior without extracting a boundary.
- Any memory or context feature that cannot be reproduced from repo-local state.
- Any compatibility path that has no active downstream consumer.
- Any validation gate that is slow but does not catch real failures.
- Any artifact that exists mainly to satisfy ceremony.

## Open Questions

1. Should `memory.json` be a real repo memory surface, a fixture, or removed from the operational surface?
2. Which five commands define the minimum viable external product?
3. What PR lead-time and review-rework telemetry is automatically harvested today versus manually documented?
4. Which downstream repos are canonical customers for scaffold/update/eject behavior?
5. Where is the compatibility sunset policy recorded for legacy migration paths?
6. Should the CI migration subsystem be split into smaller domain services before more features are added?
7. What is the target maximum local verification runtime for the default adoption path?
8. Which governance docs are merge-blocking truth and which are reference-only?

## Recommended Decisions

1. Declare a minimal adoption mode as a first-class product surface.
2. Split `ci-migrate-core.ts` around stable internal interfaces before expanding CI migration behavior.
3. Turn PR lead-time and review-rework metrics into harvested telemetry, not just roadmap text.
4. Replace placeholder memory with a real repo-local memory contract or remove it from operational paths.
5. Define a compatibility sunset policy for old providers, legacy names, and fallback runners.
6. Add a "command surface budget" policy: every new command must replace, consolidate, or justify its distinct role in the agent PR loop.
7. Make `harness next --json` the primary public product demo.
8. Treat docs-only governance as invalid unless backed by contract, script, CI, or explicit reference-only status.
9. Freeze broad governance expansion until the core PR loop has telemetry that proves it reduces rework.
10. Make operational contracts the explicit moat: contract schema, decision envelope, gate result schema, required-check parity, scaffold ownership metadata, and learned-failure promotion.

## Strategic Contradictions

- The repo says the north star is PR lead time, but the visible system invests heavily in governance breadth. This is only coherent if governance work is continuously tied back to measurable review rework reduction.
- The repo wants agent clarity, but the command and docs surfaces are large enough to create agent ambiguity without strong routing.
- The repo values deterministic memory, but placeholder memory content exists.
- The repo aims for portability, but some workflows assume Codex, Local Memory, Project Brain, and local environment conventions that may not generalize.
- The repo treats contracts as canonical, but large contract type files can make the canonical surface hard to understand.

## Suggested Simplifications

- Create a single "agent PR loop" diagram and map every core command to it.
- Split CI migration into provider detection, manifest planning, workflow generation, validation, rollback, and reporting modules.
- Split review gate into GitHub check retrieval, CodeRabbit status resolution, branch protection policy, readiness scoring, and report rendering.
- Replace ad hoc frontmatter parsing with a small structured parser or clearly constrain metadata syntax.
- Collapse overlapping docs that restate validation policy without adding operational specificity.
- Generate a command map from the registry and use it as the canonical command-discoverability artifact.
- Add a `--minimal` install path that does not require users to understand every governance subsystem.

## Missing Capabilities

- Automatically harvested PR lead-time and review-rework metrics with historical trend output.
- A public "why this failed and what to do next" UX for common gate failures.
- A clear compatibility lifecycle for deprecated commands and providers.
- A stronger portability story for non-Codex teams.
- A verified onboarding-time target.
- A command inventory drift gate that fails when docs, registry, and help output disagree.
- A module-size or complexity budget tied to architectural review.
- A deterministic memory health contract that treats placeholder memory as failing state unless explicitly fixture-scoped.

## Long-Term Scalability Concerns

- Command count and option count may exceed what agents can reliably select without `next`.
- Large modules will slow changes and increase regression risk.
- CI setup may become too slow for frequent PR loops.
- Governance docs may outgrow reviewer attention.
- Provider-specific logic may become hard to maintain as GitHub, CircleCI, CodeRabbit, and Semgrep behavior changes.
- Downstream scaffold updates can become dangerous if generated/adaptable ownership metadata is incomplete.
- Memory/context systems can become a second source of truth unless repo-local artifacts remain canonical.

## Drift Detection Signals

| Signal | Why it matters | Likely root cause | Operational impact | Severity | Indicator or threshold | Corrective action | Blocks merges/releases |
| --- | --- | --- | --- | --- | --- | --- | --- |
| New abstraction without measurable leverage | Adds cognitive load without reducing review rework | Architecture enthusiasm outpacing product evidence | More files, slower reviews, unclear ownership | High | New abstraction has no linked gate, test, telemetry, or repeated-failure evidence | Require a decision note naming the failure it removes | Block if it touches core command, contract, or gate paths |
| Duplicated orchestration logic | Agents and CI may take inconsistent paths | Fast fixes added beside canonical wrappers | Drift between scripts, CLI, and docs | High | Same workflow exists in more than one command or script without shared implementation | Consolidate behind one production function and update docs | Block when validation or CI behavior diverges |
| Prompt growth replacing harness improvements | Makes reliability depend on agent memory | Hard cases handled by instructions instead of code | Repeated failures return under different agents | High | New AGENTS/docs rule has no script, gate, contract field, or test | Convert rule into deterministic check or mark reference-only | Block for safety/governance rules |
| Skills becoming undiscoverable | Agents lose the intended operational path | Too many skills or stale skill metadata | Wrong workflow selected, validation skipped | Medium | More than 10 overlapping skills for one workflow, or skill docs mention stale command names | Generate skill command inventory and prune overlaps | Block when installed downstream skill points to missing commands |
| Governance ignored by CI | Policy becomes ceremony | Docs updated without gate/contract updates | Unsafe PRs appear compliant | Critical | Governance doc changes with no matching contract, script, PR template, or CI update | Add parity gate or mark doc as reference-only | Always block |
| Runtime paths bypass validation loops | Agents can complete work without evidence | Convenience shortcuts, legacy scripts | False green handoffs | Critical | Any mutating command lacks expected artifacts, safe alternative, or validation recommendation | Add capability metadata and post-action evidence requirement | Block for mutating commands |
| UX inconsistency across surfaces | Humans and agents cannot predict behavior | CLI, docs, and PR template drift | Onboarding friction and bad handoffs | Medium | Help output, README, command registry, and docs disagree on entrypoint or flags | Generate command docs from registry | Block if disagreement affects validation or mutation |
| Memory/context non-determinism | Future agents inherit false context | Placeholder data, unindexed notes, unverified summaries | Bad decisions based on stale memory | High | Placeholder memory in operational path, missing index update, or context check cannot reproduce source | Fail memory health or mark memory surface fixture-only | Block when memory informs gates or next actions |
| Rising configuration entropy | Repo becomes impossible to reason about | More config files without ownership | Provider and policy conflicts | High | More than one canonical source for CI ownership, branch protection, or runtime | Declare one canonical source and generate projections | Block when required-check names or providers diverge |
| Fragile cross-module coupling | Small changes break distant gates | Large modules importing many domains | Slow development and regressions | High | Core module exceeds 2,000 lines or imports more than 10 internal domains | Split by domain service and add contract tests | Block further feature expansion in that module |
| Observability gaps | Cannot prove the north star is improving | Metrics documented manually | Product direction becomes opinion-based | High | PR lead-time/review-rework claims lack harvested data or timestamped source | Add telemetry extraction or downgrade claim confidence | Block release-readiness claims, not every merge |
| Dead workflows remain active | Agents choose obsolete paths | Compatibility never sunset | Confusing command surface and false maintenance burden | Medium | Workflow has no test, no docs, no downstream consumer, and no run evidence in 90 days | Deprecate, warn, then remove | Block only if obsolete path affects required checks |
| Temporary compatibility becomes permanent | Design stays constrained by old behavior | No sunset policy | Core architecture bends around dead cases | Medium | Compatibility path older than one release cycle with no owner or removal date | Add sunset issue and tests for current path | Block new compatibility paths without owner/date |
| Tool proliferation without consolidation | More integrations, less capability clarity | Provider additions without abstraction boundaries | Harder installs and flaky CI | Medium | New tool added without command capability metadata or dependency rationale | Require provider boundary doc and smoke test | Block for CI/release/security tools |
| Speculative architecture without proof | Builds future systems before product pain is real | Strategic overreach | Maintenance drag | Medium | New subsystem has no real workflow, fixture, or measured failure case | Convert to experiment behind explicit flag or remove | Block if default-enabled |
| Declining repo discoverability | Agents spend context on navigation | Docs and commands grow uncurated | More mistakes and slower onboarding | High | New agent cannot identify start command and validation lane within 10 minutes | Strengthen `next`, command catalog, and docs map | Block if README/AGENTS/registry disagree |
| More ceremony than execution | Users reject the harness | Governance artifacts do not improve outcomes | Adoption failure | Critical | PR template/gates grow while PR lead time or review rework does not improve | Delete or automate low-value ceremony | Block release positioning claims |
| Increasing token/context cost without reliability gains | Agent work becomes slower and less reliable | Docs duplication and long prompts | Higher cost, weaker decisions | Medium | Required startup context exceeds task-relevant routing docs or repeats same rule in 3+ places | Consolidate into routed docs and executable gates | Block when duplicate instructions conflict |

## Evidence & Traceability Matrix

| Conclusion | Evidence category | File paths | Symbols/interfaces/components involved | Runtime behaviour observed | Confidence | Why the evidence matters |
| --- | --- | --- | --- | --- | --- | --- |
| The repository is a control plane around agents, not an agent runtime | docs, config | `README.md:8-17`, `harness.contract.json:9-27` | North-star contract, product description | Preflight repeated the same mission and safety floor | Hard evidence | The project identity is stated in both prose and contract data |
| PR lead time is the north-star metric | docs, config, runtime flow | `README.md:126-140`, `docs/roadmap/north-star.md:22-37`, `harness.contract.json:9-20` | `northStar.primaryMetric`, bottleneck `review_rework_loop` | Preflight reported `pr_lead_time` and review rework loop | Hard evidence | It is the measure that should decide whether complexity is justified |
| The agent-native model is real | source-code | `src/commands/next.ts:120-260`, `src/lib/decision/harness-decision.ts:52-153`, `src/cli.ts:52-64` | `HarnessDecision`, `next`, robot mode | `harness next --json` is documented as the agent start path | Hard evidence | The repo implements machine-readable agent decision support |
| Governance is intended to be executable | config, CI/CD, docs | `.harness/ci-required-checks.json:1-20`, `.circleci/config.yml:143-205`, `.github/PULL_REQUEST_TEMPLATE.md:11-21`, `docs/agents/04-validation.md:27-36` | Required checks, PR checklist, validation gates | Preflight and wrapper scripts are canonical local gates | Hard evidence | Governance exists in CI and scripts, not just documentation |
| CircleCI, CodeRabbit, Semgrep, and GitHub Actions have distinct ownership | config, CI/CD, docs | `README.md:200-224`, `harness.contract.json:189-221`, `.github/workflows/release-private-npm.yml:1-25`, `.harness/ci-required-checks.json:1-20` | CI ownership contract, release workflow, required-check manifest | Not directly run during this review | Hard evidence | Provider ownership drift would undermine branch protection and review trust |
| Current-head review proof is strategically important | source-code | `src/commands/review-gate-core.ts:131-201` | Check-run resolution, current head SHA/source constraints | Not directly run during this review | Hard evidence | Agent PRs need proof that checks match the current commit |
| The contract schema is a central stable interface | source-code, config | `src/lib/contract/types-core.ts:1477-1538`, `src/lib/contract/types-core.ts:1540-1560`, `harness.contract.json` | `HarnessContract`, default contract | Preflight validated contract-derived repo state | Hard evidence | Many governance behaviours depend on one contract spine |
| Command discoverability is a product requirement | source-code, naming patterns | `src/lib/cli/command-registry.ts:49-116`, `src/lib/cli/registry/command-capabilities.ts:3-47`, `src/lib/cli/registry/command-capabilities.ts:196-238` | Command registry, capability metadata | Source inventory found about 169 files under `src/commands/` | Hard evidence | The command surface is too large for memory-only navigation |
| Validation is designed as structured evidence | source-code, scripts, docs | `src/commands/health-core.ts:31-79`, `src/commands/docs-gate-core.ts:83-125`, `scripts/verify-work.sh:43-60`, `docs/agents/04-validation.md:143-178` | Gate reports, verify-work, failure classes | `codex-preflight` passed in required mode | Hard evidence | The harness's value depends on repeatable proof, not terminal prose |
| Project Brain and Local Memory are intended operating surfaces | docs, runtime flow | `.harness/knowledge/INDEX.md:5-18`, `.harness/review-log.md:5-15`, `docs/agents/15-context-integrity-compact.md:59-84` | Project Brain domains, review log, context checkpoints | Preflight checked Project Brain paths and Local Memory health | Hard evidence | Memory is treated as repo infrastructure, so drift here affects agent decisions |
| The repo is ahead of common agent-readiness standards | source-code, docs, config | `src/lib/decision/harness-decision.ts`, `src/lib/cli/registry/command-capabilities.ts`, `.github/PULL_REQUEST_TEMPLATE.md`, `docs/architecture/documentation-layers.md` | Decision envelope, command metadata, evidence PR template, docs layers | Preflight proved live canonical paths | Strong inference | Few repos encode this much agent-operational metadata as source |
| The repo risks over-governance | docs, config, architectural coupling | `docs/agents/`, `harness.contract.json`, `.harness/ci-required-checks.json`, `.github/PULL_REQUEST_TEMPLATE.md` | Layered governance, contract, PR checklist | Not measured against PR lead-time telemetry in this review | Strong inference | Governance breadth must be justified by the north-star metric |
| Large core modules are a maintainability risk | source-code, naming patterns | `src/commands/ci-migrate-core.ts`, `src/commands/ci-migrate.test.ts`, `src/commands/review-gate-core.ts`, `src/lib/contract/types-core.ts` | CI migration core, review gate core, contract types | Source inventory found about 10,402, 6,319, 1,939, and 1,776 lines respectively | Hard evidence | Module size increases regression risk and slows future extraction |
| Placeholder memory is a drift signal | config | `memory.json:1-26` | Baseline memory object | File contains placeholder repo name and 2026-01-01 timestamp | Hard evidence | A memory-first repo should not expose placeholder operational memory as truth |
| Context indexing has a weak parsing boundary | source-code | `src/lib/context-compound/indexer.ts:56-121` | Custom frontmatter parsing | Not directly run during this review | Strong inference | Context integrity depends on metadata correctness; ad hoc parsing may become fragile |
| The release path is mature | CI/CD | `.github/workflows/release-private-npm.yml:74-114`, `.github/workflows/release-private-npm.yml:124-184`, `.github/workflows/release-private-npm.yml:186-207` | pnpm check/build, pack smoke, auth mode, provenance, attestations | Not run during this review | Hard evidence | Release workflow includes checks beyond basic publish |
| Downstream scaffold/update lifecycle is core | source-code, skills | `src/lib/init/cli.ts:50-177`, `.agents/skills/coding-harness/SKILL.md:83-100` | `runInit`, managed/adaptable installed files | Not directly run during this review | Hard evidence | The harness's adoption model depends on installing and maintaining repo-local artifacts |
| The smallest compelling version should center on the PR loop | docs, source-code, interpretation | `README.md:150-198`, `src/commands/next.ts`, `scripts/verify-work.sh`, `src/commands/review-gate-core.ts` | init, next, verify, review gate, required-check parity | Preflight validated local readiness; no PR loop executed | Strong inference | A narrow product loop would reduce adoption friction and preserve strategic focus |
| Commercial moat is operational contract depth, not generic AI language | source-code, config, docs | `harness.contract.json`, `src/lib/decision/harness-decision.ts`, `.harness/ci-required-checks.json`, `.agents/skills/coding-harness/SKILL.md` | Contract, decision schema, CI parity, downstream skill | Not directly commercial-tested | Strong inference | These surfaces encode hard-won operational specificity that is harder to copy than prose |
| The default strategic posture should be consolidation | source-code, docs, naming patterns | `src/commands/ci-migrate-core.ts`, `src/commands/review-gate-core.ts`, `src/lib/contract/types-core.ts`, `docs/agents/`, `.harness/ci-required-checks.json` | Large command modules, broad governance layers, required-check manifest | Source inventory found large modules and broad command/docs surfaces | Strong inference | The repo already has enough surface area; more features without consolidation increase drag |
| Local-environment assumptions may limit portability | docs, scripts, dependency graph | Root `AGENTS.md`, `docs/agents/03-local-memory.md`, `.harness/knowledge/INDEX.md`, package native/runtime dependencies | Local Memory, Project Brain, native runtime dependencies | Local Memory passed in this environment | Strong inference | External teams may not share Codex, Project Brain, Local Memory, or native dependency assumptions |
| Strategic failure mode is governance import without visible value | docs, source-code, speculation | `README.md`, `docs/agents/`, `harness.contract.json`, command inventory | Governance docs, command surface, contract breadth | No adoption test run during this review | Weak speculation | This is the most plausible product failure if the minimal path is not sharpened |
