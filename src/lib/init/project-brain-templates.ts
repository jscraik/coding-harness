import type { Template } from "./types.js";

const PROJECT_BRAIN_DOMAINS = [
	{
		slug: "cli",
		label: "CLI",
		focus: "Command surfaces, flags, and operator workflows.",
	},
	{
		slug: "ci",
		label: "CI",
		focus: "Pipelines, required checks, and release safety.",
	},
	{
		slug: "governance",
		label: "Governance",
		focus: "Policy controls, approvals, and audit expectations.",
	},
	{
		slug: "tooling",
		label: "Tooling",
		focus: "Bootstrap scripts, preflight rules, and local runtime contracts.",
	},
] as const;

type ProjectBrainDomain = (typeof PROJECT_BRAIN_DOMAINS)[number];

function renderProjectBrainIndexTemplate(): string {
	const rows = PROJECT_BRAIN_DOMAINS.map(
		(domain) =>
			`| [${domain.slug}](./${domain.slug}/) | ${domain.focus} | ${new Date().toISOString().slice(0, 10)} | 0 rules |`,
	).join("\n");

	return `# Knowledge Index

## Table of Contents

- [Domains](#domains)
- [Recently Active](#recently-active)
- [Review Needed](#review-needed)

**Last updated:** ${new Date().toISOString().slice(0, 10)}

## Domains

| Domain | Focus | Last updated | Key rules |
|--------|-------|--------------|-----------|
${rows}

## Recently active

- No activity recorded yet

## Review needed

(none currently)
`;
}

function renderProjectBrainKnowledgeTemplate(
	domain: ProjectBrainDomain,
): string {
	return `# ${domain.label} Knowledge

## Table of Contents

- [Confirmed Facts](#confirmed-facts)
- [Patterns](#patterns)
- [Gotchas](#gotchas)
- [References](#references)

**Last verified:** (not yet)
**Verification source:** manual
**Confidence:** medium
**Owner:** (not yet)

## Confirmed facts

- Add confirmed, verified facts about the ${domain.label} domain here
- Each fact should be independently verifiable

## Patterns

- Document recurring patterns and conventions observed in this domain

## Gotchas

- Record non-obvious pitfalls and edge cases discovered during development

## References

- List key source files, configs, and documentation relevant to this domain
`;
}

function renderProjectBrainHypothesesTemplate(
	domain: ProjectBrainDomain,
): string {
	return `# ${domain.label} Hypotheses

## Table of Contents

- [Active Hypotheses](#active-hypotheses)
- [Under Review](#under-review)
- [Demoted From Rules](#demoted-from-rules)

Unconfirmed patterns under observation. Promote to rules.md after 3+ confirmations.

## Active hypotheses

No active hypotheses. Record observations here when patterns are noticed but not yet confirmed.

## Under review

(none currently)

## Demoted from rules

(none currently)
`;
}

function renderProjectBrainRulesTemplate(domain: ProjectBrainDomain): string {
	return `# ${domain.label} Rules

## Table of Contents

- [Active Rules](#active-rules)
- [Promotion Guide](#promotion-guide)

**Rule count:** 0
**Last promoted:** (not yet)

## Active rules

No rules promoted yet. As patterns become confirmed through repeated observation,
promote them from hypotheses with a rule ID:

- **Format**: \`R-NNN: description\`
- **Severity**: must | should | may
- **Required fields**: Rationale, Last promoted date, Promoted from source

## Promotion guide

1. Hypothesis observed 3+ times → promote to rule
2. Rule contradicted by evidence → demote back to hypothesis
3. Each rule gets a unique R-NNN identifier within its domain
`;
}

function renderProjectBrainLearningsTemplate(): string {
	return `---
schema_version: 1
purpose: Project-specific agent knowledge base — repo-scoped fixes and gotchas.
scope: This repo only.
update_policy: |
  Append after any bug, tool failure, or extra-effort fix that is specific to this repository.
  Universal fixes belong in ~/.codex/instructions/Learnings.md.
  Do not delete entries; append only.
  Format: **YYYY-MM-DD [Agent]:** \`problem → fix\`
---

# Learnings

## Table of Contents

- [Scope](#scope)
- [Format](#format)

Repo-specific agent knowledge base. Append-only.

## Scope

This repository only.

## Format

Use \`**YYYY-MM-DD [Agent]:** problem -> fix\`.
`;
}

function renderHarnessReadmeTemplate(): string {
	return `# Harness Control Plane

## Table of Contents

- [Tracking Policy](#tracking-policy)
- [Authority Levels](#authority-levels)
- [Directory Map](#directory-map)
- [Codex-Native Baseline](#codex-native-baseline)
- [Admission Rule](#admission-rule)

## Tracking Policy

Track curated Markdown and JSON contract files under \`.harness\`. Ignore runtime,
backup, database, cache, and bulk snapshot output.

\`.harness\` is part of the repository control plane, but it is not a dumping
ground. Durable policy, decisions, execution inputs, and curated context should
move with the repository. Local run state should stay local.

## Authority Levels

| Level | Meaning |
| --- | --- |
| \`policy\` | Non-negotiable project invariants and operating rules. |
| \`decision\` | ADRs, tradeoffs, and accepted constraints. |
| \`execution-input\` | Approved work slices that may directly route implementation. |
| \`secondary-context\` | Useful evidence and intent, but not implementation authority by itself. |
| \`generated-runtime\` | Local command output, caches, snapshots, or mutable state. |
| \`backup/scratch\` | Recovery or temporary files that should not be reviewed as repo truth. |

## Directory Map

| Path | Level | Tracking |
| --- | --- | --- |
| \`.harness/core/**.md\` | \`policy\` | Track |
| \`.harness/decisions/**.md\` | \`decision\` | Track |
| \`.harness/linear/**.md\` | \`execution-input\` | Track |
| \`.harness/refactors/**.md\` | \`execution-input\` | Track |
| \`.harness/features/**.md\` | \`secondary-context\` | Track |
| \`.harness/strategy/**.md\` | \`secondary-context\` | Track |
| \`.harness/triage/**.md\` | \`secondary-context\` | Track |
| \`.harness/review/**.md\` | \`secondary-context\` | Track when curated |
| \`.harness/ideate/**.md\` | \`secondary-context\` | Track when produced by Harness Engineering |
| \`.harness/brainstorm/**.md\` | \`secondary-context\` | Track when produced by Harness Engineering |
| \`.harness/specs/**.md\` | \`execution-input\` | Track when produced by Harness Engineering |
| \`.harness/plan/**.md\` | \`execution-input\` | Track when produced by Harness Engineering |
| \`.harness/memory/LEARNINGS.md\` | \`policy\` | Track |
| \`.harness/active-artifacts.md\` | \`execution-input\` | Track |
| \`.harness/artifacts/README.md\` | \`policy\` | Track |
| \`.harness/artifacts/brownfield-memory-inventory.md\` | \`execution-input\` | Track when onboarding brownfield projects |
| \`.harness/artifacts/sync-receipts.jsonl\` | \`secondary-context\` | Track curated receipts |
| \`.harness/knowledge/**.md\` | \`secondary-context\` | Track |
| \`.harness/quality/**\` | \`policy\` | Track |
| \`.harness/review-log.md\` | \`secondary-context\` | Track |
| \`.harness/ci-required-checks.json\` | \`policy\` | Track |
| \`.harness/ci-provider-transition-status.json\` | \`policy\` | Track |
| \`.harness/artifact-provenance.json\` | \`policy\` | Track |
| \`.harness/*-manifest.json\` | \`policy\` | Track with care when validators consume it |
| \`.harness/backups/**\` | \`backup/scratch\` | Do not track |
| \`.harness/*.db\` | \`generated-runtime\` | Do not track unless promoted to a fixture |
| \`.harness/ci-migrate-snapshots/**\` | \`generated-runtime\` | Do not track unless a fixture or doc contract consumes it |
| \`.harness/runs/**\` | \`generated-runtime\` | Do not track |
| \`.harness/memory/codex-learned/**\` | \`generated-runtime\` | Do not track |
| \`.harness/memory/codex-preflight-overrides.env\` | \`generated-runtime\` | Do not track |

## Codex-Native Baseline

Greenfield and brownfield repositories need a small, source-owned memory and
artifact baseline so Codex can distinguish repo truth from optional runtime
signals. The baseline is:

- \`.harness/memory/LEARNINGS.md\` for repo-scoped durable fixes.
- \`.harness/knowledge/**\` and \`.harness/decisions/**\` for Project Brain facts,
  hypotheses, rules, and accepted decisions.
- \`.harness/review-log.md\` for periodic review evidence.
- \`.harness/active-artifacts.md\` for current execution-input pointers.
- \`.harness/artifacts/README.md\` for artifact and sync receipt rules.
- \`.harness/artifacts/sync-receipts.jsonl\` for Project Brain, vault, Local
  Memory CLI, Local Memory MCP, Chronicle, native citation, artifact state,
  source evidence, redaction, and reason fields.
- \`docs/goals/README.md\` for goal-board conventions. Runtime goal state stays
  in \`docs/goals/<goal-slug>/state.yaml\` and receipt evidence stays in
  \`docs/goals/<goal-slug>/receipts.jsonl\`.

Chronicle is observational evidence only. Promote Chronicle-derived claims only
after they are verified against repo files, runtime artifacts, PR or tracker
state, or explicit owner direction.

## Admission Rule

Secondary context is not execution authority on its own. Files under
\`.harness/review\`, \`.harness/strategy\`, \`.harness/triage\`, \`.harness/features\`,
\`.harness/ideate\`, and \`.harness/brainstorm\` can inform work, but they only
drive implementation after an admitted \`.harness/linear\`, \`.harness/refactors\`,
\`.harness/specs\`, or \`.harness/plan\` slice references them.
`;
}

function renderProjectBrainQualityTemplate(): string {
	return `# Quality Criteria

## Table of Contents

- [Categories](#categories)
- [Usage](#usage)

**Last updated:** ${new Date().toISOString().slice(0, 10)}
**Total criteria:** 3
**Project domain:** CLI tool

## Categories

### API Design
| ID | Criterion | Severity | Source | Last triggered |
|----|-----------|----------|--------|----------------|
| Q-001 | All public commands must produce structured, parseable output | must | convention | (not yet) |
| Q-002 | Gate commands must follow shared output envelope (status, reason, action_now, action_later, evidence_ref) | must | convention | (not yet) |

### Testing
| ID | Criterion | Severity | Source | Last triggered |
|----|-----------|----------|--------|----------------|
| Q-003 | New modules must include co-located test files with happy-path and error-path coverage | must | convention | (not yet) |

---

## Usage

Before marking any task complete:
1. Run through relevant criteria
2. Note any issues found
3. Update "Last triggered" for criteria that caught issues
4. Propose new criteria for any new failure patterns
`;
}

function renderProjectBrainReviewLogTemplate(): string {
	return `# System Review Log

## Table of Contents

- [Review Schedule](#review-schedule)
- [Reviews](#reviews)
- [Instructions](#instructions)

Record of periodic reviews for knowledge, decisions, and quality criteria.

## Review schedule

- Suggested cadence: every 2 weeks or after major milestones.
- Last review: (not yet)

## Reviews

| Date | Reviewer | Scope | Findings | Actions |
|------|----------|-------|----------|---------|
| (no reviews yet) | | | | |

---

## Instructions

Add a new row after each review session. Include:
- **Date**: ISO date of the review
- **Reviewer**: Who performed the review
- **Scope**: Which domains/artifacts were reviewed
- **Findings**: Summary of issues or observations
- **Actions**: Follow-up tasks created
`;
}

function renderProjectBrainCodexLearnSummaryTemplate(): string {
	return `# Codex Learn Summary

## Table of Contents

- [Error Frequency](#error-frequency)
- [Suggested Preflight Overrides](#suggested-preflight-overrides)
- [Path Hints](#path-hints)
- [Promotion Guide](#promotion-guide)

This file is maintained by \`./scripts/codex-learn analyze\`.

**Last generated:** (not yet)
**Scope:** repo
**Failure store:** \`.harness/memory/codex-learned\`

## Error frequency

No errors recorded yet. Run \`./scripts/codex-learn analyze\` to populate.

## Suggested preflight overrides

- Extra bins: no suggestions yet

## Path hints

- No path hints recorded yet

## Promotion guide

- Confirmed 3+ times: promote pattern to \`rules.md\`.
- Still uncertain: keep investigation notes in \`hypotheses.md\`.
`;
}

function renderActiveArtifactsTemplate(): string {
	return `${[
		"# Active Artifacts",
		"",
		"## Table of Contents",
		"",
		"- [Active](#active)",
		"- [Rules](#rules)",
		"",
		"This index records the current execution-input artifacts Codex may use to route work.",
		"",
		"## Active",
		"",
		"| Artifact | Authority | Status | Last checked | Notes |",
		"| --- | --- | --- | --- | --- |",
		"| (none) | | | | |",
		"",
		"## Rules",
		"",
		"- Reference tracked plans, specs, Linear mirrors, or goal boards only.",
		"- Do not route implementation from secondary context unless an admitted execution-input artifact points to it.",
		"- Refresh this index when an artifact becomes active, completes, blocks, or is superseded.",
	].join("\n")}\n`;
}

function renderHarnessArtifactsReadmeTemplate(): string {
	return `${[
		"# Harness Artifacts",
		"",
		"## Table of Contents",
		"",
		"- [Sync Receipts](#sync-receipts)",
		"",
		"Curated artifacts here are repo truth only when they are tracked, current, and tied to source evidence.",
		"Runtime dumps, bulky traces, local databases, and unredacted transcripts stay out of the repository.",
		"",
		"## Sync Receipts",
		"",
		"Use `.harness/artifacts/sync-receipts.jsonl` when a task updates or observes multiple memory surfaces.",
		"Each JSONL row must use `schema_version: harness-sync-receipt/v1` and separate these fields instead of collapsing them into one success claim:",
		"",
		"- `schema_version`",
		"- `receipt_id`",
		"- `timestamp`",
		"- `runtime_action`",
		"- `project_brain`",
		"- `vault`",
		"- `local_memory_cli`",
		"- `local_memory_mcp`",
		"- `chronicle`",
		"- `native_citation`",
		"- `artifact_state`",
		"- `source_evidence`",
		"- `redaction`",
		"- `reason`",
		"",
		"Allowed status classes are `updated`, `observed`, `not_applicable`, `deferred`, and `blocked`.",
		"Chronicle remains observational until corroborated by repo, runtime, PR, tracker, artifact, or owner evidence.",
	].join("\n")}\n`;
}

function renderHarnessDirectoryReadmeTemplate(
	title: string,
	purpose: string,
	authority: string,
	use: string,
): string {
	return [
		`# ${title}`,
		"",
		"## Table of Contents",
		"",
		"- [Purpose](#purpose)",
		"- [Authority](#authority)",
		"- [Use](#use)",
		"",
		"## Purpose",
		"",
		purpose,
		"",
		"## Authority",
		"",
		authority,
		"",
		"## Use",
		"",
		use,
		"",
	].join("\n");
}

function renderSyncReceiptsTemplate(): string {
	return `${JSON.stringify({
		schema_version: "harness-sync-receipt/v1",
		receipt_id: "bootstrap-0001",
		timestamp: "2026-01-01T00:00:00.000Z",
		runtime_action: "verify",
		project_brain: { status: "updated", reason: "initial scaffold" },
		vault: { status: "not_applicable", reason: "no vault configured" },
		local_memory_cli: { status: "deferred", reason: "run local preflight" },
		local_memory_mcp: {
			status: "not_applicable",
			reason: "optional runtime surface",
		},
		chronicle: { status: "not_applicable", reason: "no observation used" },
		native_citation: { status: "not_applicable", reason: "no citation used" },
		artifact_state: { status: "updated", reason: "baseline scaffolded" },
		source_evidence: {
			status: "updated",
			paths: [".harness/README.md", "docs/goals/README.md"],
		},
		redaction: { status: "updated", reason: "no sensitive input" },
		reason: "Codex-native harness memory baseline initialized.",
	})}\n`;
}

function renderBrownfieldMemoryInventoryTemplate(): string {
	return `${[
		"# Brownfield Memory Inventory",
		"",
		"## Table of Contents",
		"",
		"- [Classification](#classification)",
		"- [Rules](#rules)",
		"",
		"Use this inventory before adopting, replacing, or ignoring existing memory, artifact, goal, review, or decision surfaces.",
		"",
		"## Classification",
		"",
		"| Surface | Class | Adopted path | Conflict | Decision |",
		"| --- | --- | --- | --- | --- |",
		"| (none) | optional | | | |",
		"",
		"Classes: canonical, mirror, legacy, optional, blocked.",
		"",
		"## Rules",
		"",
		"- Resolve canonical or blocked conflicts before replacing content.",
		"- Preserve useful legacy or mirror evidence with an explicit mapping or deferred reason.",
		"- Add a sync receipt for adopted, mapped, deferred, or blocked surfaces.",
	].join("\n")}\n`;
}

function renderGoalBoardReadmeTemplate(): string {
	return `${[
		"# Goal Boards",
		"",
		"## Table of Contents",
		"",
		"- [Layout](#layout)",
		"",
		"Goal boards provide durable coordination for long-running Codex work.",
		"",
		"## Layout",
		"",
		"Use `docs/goals/<goal-slug>/` with:",
		"",
		"- `goal.md` for objective, scope, completion contract, and boundaries.",
		"- `state.yaml` for current task and native-goal reconciliation state.",
		"- `receipts.jsonl` for append-only RuntimeAction evidence.",
		"",
		"Receipts should name the task id, actor, action type, changed files, validation, blocker class when blocked, and next action.",
	].join("\n")}\n`;
}

function renderArtifactProvenanceTemplate(): string {
	return `${JSON.stringify(
		{ schemaVersion: "artifact-provenance/v1", artifacts: [] },
		null,
		2,
	)}\n`;
}

export const PROJECT_BRAIN_TEMPLATES: readonly Template[] = [
	{
		path: ".harness/README.md",
		render: () => renderHarnessReadmeTemplate(),
	},
	{
		path: ".harness/memory/LEARNINGS.md",
		render: () => renderProjectBrainLearningsTemplate(),
	},
	{
		path: ".harness/active-artifacts.md",
		render: () => renderActiveArtifactsTemplate(),
	},
	{
		path: ".harness/artifacts/README.md",
		render: () => renderHarnessArtifactsReadmeTemplate(),
	},
	{
		path: ".harness/core/README.md",
		render: () =>
			renderHarnessDirectoryReadmeTemplate(
				"Core Harness Policy",
				".harness/core contains portable policy and operating-system rules for agents.",
				"Files here are policy authority and may constrain implementation when referenced by active artifacts, repo instructions, validators, or command contracts.",
				"Keep rules short, source-owned, and validator-backed where possible. Runtime state, generated logs, and bulky evidence belong elsewhere.",
			),
	},
	{
		path: ".harness/plan/README.md",
		render: () =>
			renderHarnessDirectoryReadmeTemplate(
				"Harness Plans",
				".harness/plan holds execution-input plans that may route implementation.",
				"Files here are execution-input authority only when current, tracked, and named by .harness/active-artifacts.md or an equivalent admitted control-plane index.",
				"Plans must name ownership, source evidence, acceptance criteria, and validation. Do not use old plans as route-driving truth without refreshing the active index.",
			),
	},
	{
		path: ".harness/specs/README.md",
		render: () =>
			renderHarnessDirectoryReadmeTemplate(
				"Harness Specs",
				".harness/specs holds source-owned specs that define desired behavior.",
				"Specs are execution-input authority when admitted by the active artifact index. Research and strategy files can inform specs, but cannot replace them.",
				"Specs should include scope, non-goals, acceptance evidence, and links to tracker or local-only ownership.",
			),
	},
	{
		path: ".harness/research/README.md",
		render: () =>
			renderHarnessDirectoryReadmeTemplate(
				"Harness Research",
				".harness/research stores curated research, evidence manifests, and audits.",
				"Research is secondary-context until a plan, spec, decision, or validator admits it into implementation authority.",
				"Use evidence-patterns.json to record disposition, target surfaces, and replayable validation commands for adopted patterns.",
			),
	},
	{
		path: ".harness/decisions/README.md",
		render: () =>
			renderHarnessDirectoryReadmeTemplate(
				"Harness Decisions",
				".harness/decisions records accepted tradeoffs and durable architecture choices.",
				"Decision records are decision authority. They explain why a path was chosen and what would be required to revisit it.",
				"Record the decision, alternatives considered, evidence, consequences, and review date.",
			),
	},
	{
		path: ".harness/implementation-notes/README.md",
		render: () =>
			renderHarnessDirectoryReadmeTemplate(
				"Harness Implementation Notes",
				".harness/implementation-notes captures dated execution notes, admissions, and implementation evidence.",
				"Implementation notes are secondary-context unless an active plan, spec, decision, or validator promotes a rule from them.",
				"Use these notes to preserve why work changed shape, what was validated, and where follow-up ownership lives when a blocker is outside current authority.",
			),
	},
	{
		path: ".harness/evals/README.md",
		render: () =>
			renderHarnessDirectoryReadmeTemplate(
				"Harness Evals",
				".harness/evals stores curated evaluation plans, fixtures, and result summaries.",
				"Eval artifacts are secondary-context unless a plan, spec, quality criterion, or gate names them as required validation evidence.",
				"Keep fixtures small, replayable, and tied to acceptance criteria. Store bulky or volatile run output outside tracked repo truth unless explicitly promoted.",
			),
	},
	{
		path: ".harness/solutions/README.md",
		render: () =>
			renderHarnessDirectoryReadmeTemplate(
				"Harness Solutions",
				".harness/solutions stores reusable fixes and recovery playbooks discovered during harness work.",
				"Solutions are secondary-context until referenced by instructions, validators, or active execution-input artifacts.",
				"Prefer refreshing a high-overlap solution over duplicating one. Include symptoms, root cause, exact fix, validation, and when not to apply it.",
			),
	},
	{
		path: ".harness/artifacts/sync-receipts.jsonl",
		render: () => renderSyncReceiptsTemplate(),
	},
	{
		path: ".harness/artifacts/brownfield-memory-inventory.md",
		render: () => renderBrownfieldMemoryInventoryTemplate(),
	},
	{
		path: ".harness/artifact-provenance.json",
		render: () => renderArtifactProvenanceTemplate(),
	},
	{
		path: "docs/goals/README.md",
		render: () => renderGoalBoardReadmeTemplate(),
	},
	{
		path: ".harness/knowledge/INDEX.md",
		render: () => renderProjectBrainIndexTemplate(),
	},
	...PROJECT_BRAIN_DOMAINS.flatMap((domain) => [
		{
			path: `.harness/knowledge/${domain.slug}/knowledge.md`,
			render: () => renderProjectBrainKnowledgeTemplate(domain),
		},
		{
			path: `.harness/knowledge/${domain.slug}/hypotheses.md`,
			render: () => renderProjectBrainHypothesesTemplate(domain),
		},
		{
			path: `.harness/knowledge/${domain.slug}/rules.md`,
			render: () => renderProjectBrainRulesTemplate(domain),
		},
	]),
	{
		path: ".harness/knowledge/tooling/codex-learn-summary.md",
		render: () => renderProjectBrainCodexLearnSummaryTemplate(),
	},
	{
		path: ".harness/decisions/.gitkeep",
		render: () => "",
	},
	{
		path: ".harness/quality/criteria.md",
		render: () => renderProjectBrainQualityTemplate(),
	},
	{
		path: ".harness/review-log.md",
		render: () => renderProjectBrainReviewLogTemplate(),
	},
];
