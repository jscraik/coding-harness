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

Repo-specific agent knowledge base. Append-only.

> Scope: this repository only.
> Format: **YYYY-MM-DD [Agent]:** \`problem → fix\`
`;
}

function renderHarnessReadmeTemplate(): string {
	return `# Harness Control Plane

## Table of Contents

- [Tracking Policy](#tracking-policy)
- [Authority Levels](#authority-levels)
- [Directory Map](#directory-map)
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
