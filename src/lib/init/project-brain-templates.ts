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
			`| [${domain.slug}](./${domain.slug}/) | ${domain.focus} | (none yet) | 0 |`,
	).join("\n");

	return `# Knowledge Index

Project Brain index for repository-grounded knowledge and decision artifacts.

## Domains

| Domain | Focus | Last updated | Key rules |
|--------|-------|--------------|-----------|
${rows}

## Recently active

(none yet)

## Review needed

(none yet)
`;
}

function renderProjectBrainKnowledgeTemplate(
	domain: ProjectBrainDomain,
): string {
	return `# ${domain.label} Knowledge

## Confirmed facts

(none yet)

## Patterns

(none yet)

## Gotchas

(none yet)

## References

(none yet)
`;
}

function renderProjectBrainHypothesesTemplate(
	domain: ProjectBrainDomain,
): string {
	return `# ${domain.label} Hypotheses

## Active hypotheses

(none yet)

## Under review

(none yet)

## Demoted from rules

(none yet)
`;
}

function renderProjectBrainRulesTemplate(domain: ProjectBrainDomain): string {
	return `# ${domain.label} Rules

**Rule count:** 0
**Last promoted:** (none yet)

## Active rules

(none yet)
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
  Format: **YYYY-MM-DD [Codex]:** <problem> -> <fix>
---

# Learnings

Repo-specific agent knowledge base. Append-only.

> Scope: this repository only.
> Format: **YYYY-MM-DD [Codex]:** <problem> -> <fix>
`;
}

function renderProjectBrainQualityTemplate(): string {
	return `# Quality Criteria

**Last updated:** (not yet)
**Total criteria:** 0

## Categories

### Reliability
| ID | Criterion | Severity | Source | Last triggered |
|----|-----------|----------|--------|----------------|
| (none yet) | | | | |

### Security
| ID | Criterion | Severity | Source | Last triggered |
|----|-----------|----------|--------|----------------|
| (none yet) | | | | |

### Testing
| ID | Criterion | Severity | Source | Last triggered |
|----|-----------|----------|--------|----------------|
| (none yet) | | | | |
`;
}

function renderProjectBrainReviewLogTemplate(): string {
	return `# System Review Log

Record of periodic reviews for knowledge, decisions, and quality criteria.

## Review schedule

- Suggested cadence: every 2 weeks or after major milestones.
- Last review: (not yet)

## Reviews

(none yet)
`;
}

function renderProjectBrainCodexLearnSummaryTemplate(): string {
	return `# Codex Learn Summary

This file is maintained by \`./scripts/codex-learn analyze\`.

**Last generated:** (not yet)
**Scope:** repo
**Failure store:** \`.harness/memory/codex-learned\`

## Error frequency

(none yet)

## Suggested preflight overrides

- Extra bins: (none yet)

## Path hints

- (none yet)

## Promotion guide

- Confirmed 3+ times: promote pattern to \`rules.md\`.
- Still uncertain: keep investigation notes in \`hypotheses.md\`.
`;
}

export const PROJECT_BRAIN_TEMPLATES: readonly Template[] = [
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
