/**
 * File-to-domain mapper for Project Brain preflight (JSC-185).
 *
 * Maps changed file paths to relevant Project Brain domains based on
 * path patterns and naming conventions.
 *
 * @module lib/project-brain/domain-mapper
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DomainMapping {
	/** Brain domain slug (e.g., "api", "ci", "testing") */
	domain: string;
	/** Relevance score 0–1 for this mapping */
	relevance: number;
	/** Reason this domain was matched */
	reason: string;
}

// ─── Domain rules ────────────────────────────────────────────────────────────

interface DomainRule {
	domain: string;
	/** Glob-like patterns that indicate this domain */
	patterns: RegExp[];
	/** Human-readable description of the domain */
	description: string;
}

const DOMAIN_RULES: DomainRule[] = [
	{
		domain: "api",
		patterns: [
			/\/commands\//i,
			/\/cli\//i,
			/src\/cli\.ts$/i,
			/CommandSpec/i,
			/\bgate\b/i,
		],
		description: "CLI command surface and gate output contracts",
	},
	{
		domain: "testing",
		patterns: [
			/\.test\.ts$/i,
			/\.spec\.ts$/i,
			/vitest/i,
			/\/tests?\//i,
			/__tests__\//i,
			/src\/lib\/.*\.test\./i,
		],
		description: "Test infrastructure and patterns",
	},
	{
		domain: "ci-migrate",
		patterns: [
			/\.circleci\//i,
			/\.github\/workflows\//i,
			/ci-migrate/i,
			/ci-required-checks/i,
			/harness\.contract\.json$/i,
		],
		description: "CI/CD migration and pipeline configuration",
	},
	{
		domain: "governance",
		patterns: [/\.harness\//i, /contract/i, /policy/i, /governance/i],
		description: "Policy controls and audit expectations",
	},
	{
		domain: "tooling",
		patterns: [
			/biome\.json/i,
			/tsconfig/i,
			/package\.json$/i,
			/\.prettierrc/i,
			/\.eslintrc/i,
			/scripts\//i,
			/mise\.toml$/i,
		],
		description: "Build tooling and local runtime contracts",
	},
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Map a set of file paths to relevant Project Brain domains.
 *
 * Returns deduplicated domain mappings sorted by relevance (highest first).
 * A file may match multiple domains; each domain gets the maximum relevance
 * across all files.
 *
 * @param files - Array of file paths (relative or absolute)
 * @returns Ordered domain mappings with relevance scores
 */
export function mapFilesToDomains(files: string[]): DomainMapping[] {
	const domainScores = new Map<
		string,
		{ relevance: number; reasons: Set<string> }
	>();

	for (const file of files) {
		for (const rule of DOMAIN_RULES) {
			for (const pattern of rule.patterns) {
				if (pattern.test(file)) {
					const existing = domainScores.get(rule.domain);
					const score = 0.8;
					if (existing) {
						if (score > existing.relevance) {
							existing.relevance = score;
						}
						existing.reasons.add(`File matched: ${file}`);
					} else {
						domainScores.set(rule.domain, {
							relevance: score,
							reasons: new Set([`File matched: ${file}`]),
						});
					}
				}
			}
		}
	}

	// If no domains matched, include all with low relevance
	if (domainScores.size === 0) {
		for (const rule of DOMAIN_RULES) {
			domainScores.set(rule.domain, {
				relevance: 0.3,
				reasons: new Set(["No direct match — including as general context"]),
			});
		}
	}

	// Convert to sorted array
	const mappings: DomainMapping[] = [];
	for (const [domain, data] of domainScores) {
		mappings.push({
			domain,
			relevance: data.relevance,
			reason: [...data.reasons].join("; "),
		});
	}

	// Sort by relevance descending, then alphabetically
	mappings.sort((a, b) => {
		if (b.relevance !== a.relevance) return b.relevance - a.relevance;
		return a.domain.localeCompare(b.domain);
	});

	return mappings;
}
