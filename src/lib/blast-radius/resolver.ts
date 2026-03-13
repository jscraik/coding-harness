import picomatch from "picomatch";
import type {
	BlastRadiusRule,
	BlastRadiusRulesMode,
} from "../contract/types.js";

/**
 * Module-level cache for compiled picomatch matchers.
 * Key: pattern string, Value: compiled matcher function.
 */
const MATCHER_CACHE = new Map<string, ReturnType<typeof picomatch>>();

/**
 * Get or create a compiled matcher for the given pattern.
 * Isomorphic: identical matching behavior, but caches compilation.
 */
function getMatcher(pattern: string): ReturnType<typeof picomatch> {
	let matcher = MATCHER_CACHE.get(pattern);
	if (!matcher) {
		matcher = picomatch(pattern);
		MATCHER_CACHE.set(pattern, matcher);
	}
	return matcher;
}

/**
 * Blast-radius merge mode.
 */
const DEFAULT_BLAST_RADIUS_RULES_MODE: BlastRadiusRulesMode = "merge";

/**
 * Default blast radius rules.
 */
export const DEFAULT_BLAST_RADIUS_RULES: BlastRadiusRule[] = [
	// Critical paths
	{
		pattern: "src/auth/**",
		checks: ["auth-flows", "security-scan", "integration-tests"],
		description: "Authentication is security-critical",
	},
	{
		pattern: "src/payments/**",
		checks: ["payment-flows", "compliance-check", "e2e-tests"],
		description: "Financial transactions require verification",
	},
	{
		pattern: "**/encryption/**",
		checks: ["crypto-tests", "security-audit"],
		description: "Cryptographic code is high-risk",
	},
	{
		pattern: "**/secrets/**",
		checks: ["secret-scan", "access-control-tests"],
		description: "Secret handling is sensitive",
	},

	// API contract paths
	{
		pattern: "src/api/**",
		checks: ["contract-tests", "openapi-validate", "breaking-change-detection"],
		description: "API contracts affect consumers",
	},
	{
		pattern: "**/types.ts",
		checks: ["typecheck", "api-surface-check"],
		description: "Type changes affect API",
	},
	{
		pattern: "**/schema/**",
		checks: ["schema-validation", "migration-tests"],
		description: "Schema changes need migration path",
	},

	// UI component paths
	{
		pattern: "src/components/**",
		checks: ["component-tests", "visual-regression", "a11y-check"],
		description: "UI components need visual testing",
	},
	{
		pattern: "src/ui/**",
		checks: ["storybook-verify", "ui-fast", "ui-verify"],
		description: "UI paths need visual feedback",
	},
	{
		pattern: "**/*.css",
		checks: ["stylelint", "visual-regression"],
		description: "CSS affects appearance",
	},
	{
		pattern: "**/*.scss",
		checks: ["stylelint", "visual-regression"],
		description: "SCSS affects appearance",
	},

	// Database paths
	{
		pattern: "**/migrations/**",
		checks: ["migration-tests", "rollback-tests", "schema-validation"],
		description: "Migrations must be reversible",
	},
	{
		pattern: "**/models/**",
		checks: ["model-tests", "integration-tests"],
		description: "Model changes affect data layer",
	},
	{
		pattern: "**/queries/**",
		checks: ["query-tests", "performance-check"],
		description: "Queries affect performance",
	},

	// Configuration paths
	{
		pattern: "package.json",
		checks: ["dependency-audit", "license-check", "install-test"],
		description: "Dependencies affect security",
	},
	{
		pattern: "tsconfig.json",
		checks: ["typecheck", "build-test"],
		description: "Config affects compilation",
	},
	{
		pattern: ".github/workflows/**",
		checks: ["workflow-validate", "dry-run-tests"],
		description: "CI changes affect all builds",
	},
	{
		pattern: "harness.contract.json",
		checks: ["contract-validate", "policy-gate"],
		description: "Contract changes affect enforcement",
	},

	// Documentation paths
	{
		pattern: "docs/**",
		checks: ["docs-lint", "link-check", "freshness-check"],
		description: "Docs need quality checks",
	},
	{
		pattern: "README.md",
		checks: ["readme-validate", "link-check"],
		description: "README is first impression",
	},
	{
		pattern: "CHANGELOG.md",
		checks: ["changelog-validate", "version-check"],
		description: "Changelog tracks releases",
	},

	// Test paths
	{
		pattern: "tests/**",
		checks: ["test-lint", "coverage-check"],
		description: "Tests need validation",
	},
	{
		pattern: "**/*.test.ts",
		checks: ["test-run", "coverage-check"],
		description: "Unit tests must pass",
	},
	{
		pattern: "**/*.spec.ts",
		checks: ["test-run", "coverage-check"],
		description: "Spec tests must pass",
	},
];

/**
 * Resolve the active blast-radius rules.
 *
 * @param customRules - Optional custom blast-radius rules from contract.
 * @param mode - Merge mode for combining default and custom rules.
 * @returns Rules used for matching.
 */
export function resolveBlastRadiusRules(
	customRules: BlastRadiusRule[] | undefined = undefined,
	mode: BlastRadiusRulesMode = DEFAULT_BLAST_RADIUS_RULES_MODE,
): BlastRadiusRule[] {
	if (mode === "replace") {
		return customRules ? [...customRules] : [];
	}

	if (customRules === undefined) {
		return [...DEFAULT_BLAST_RADIUS_RULES];
	}

	return [...DEFAULT_BLAST_RADIUS_RULES, ...customRules];
}

/**
 * Default checks to run when no specific patterns match.
 */
export const DEFAULT_CHECKS = ["typecheck", "lint", "test-run"];

/**
 * Get the required checks for a single file path.
 *
 * @param filePath - Path to check
 * @param rules - Blast radius rules to apply
 * @returns Array of required check names
 */
export function getChecksForFile(
	filePath: string,
	rules: BlastRadiusRule[] = DEFAULT_BLAST_RADIUS_RULES,
): string[] {
	const checks: string[] = [];

	for (const rule of rules) {
		const matcher = getMatcher(rule.pattern);
		if (matcher(filePath)) {
			checks.push(...rule.checks);
		}
	}

	return [...new Set(checks)]; // Remove duplicates
}

/**
 * Resolve all required checks for a set of changed files.
 *
 * @param changedFiles - Array of changed file paths
 * @param rules - Blast radius rules to apply
 * @returns Object with unique checks and file-to-check mappings
 */
export function resolveChecks(
	changedFiles: string[],
	rules: BlastRadiusRule[] = DEFAULT_BLAST_RADIUS_RULES,
): {
	/** Unique required checks */
	checks: string[];
	/** Mapping from each file to its required checks */
	fileChecks: Map<string, string[]>;
	/** Whether default checks should be applied */
	useDefaults: boolean;
} {
	const allChecks = new Set<string>();
	const fileChecks = new Map<string, string[]>();
	let hasMatches = false;

	for (const file of changedFiles) {
		const fileChecksList = getChecksForFile(file, rules);
		fileChecks.set(file, fileChecksList);

		if (fileChecksList.length > 0) {
			hasMatches = true;
			for (const check of fileChecksList) {
				allChecks.add(check);
			}
		}
	}

	// Use defaults only if no files matched any rules
	const useDefaults = !hasMatches && changedFiles.length > 0;
	if (useDefaults) {
		for (const check of DEFAULT_CHECKS) {
			allChecks.add(check);
		}
	}

	return {
		checks: [...allChecks],
		fileChecks,
		useDefaults,
	};
}

/**
 * Get detailed blast radius information for changed files.
 *
 * @param changedFiles - Array of changed file paths
 * @param rules - Blast radius rules to apply
 * @returns Detailed information about matches
 */
export function getBlastRadiusInfo(
	changedFiles: string[],
	rules: BlastRadiusRule[] = DEFAULT_BLAST_RADIUS_RULES,
): {
	/** Matched rules with their descriptions */
	matchedRules: Array<{ pattern: string; description?: string }>;
	/** Total unique checks required */
	totalChecks: number;
	/** Files requiring the most checks */
	highestImpactFiles: string[];
} {
	const matchedPatterns = new Set<string>();
	const matchedDescriptions = new Map<string, string>();
	const fileCheckCounts = new Map<string, number>();
	const allChecks = new Set<string>();

	for (const file of changedFiles) {
		let fileChecks = 0;
		for (const rule of rules) {
			const matcher = getMatcher(rule.pattern);
			if (matcher(file)) {
				matchedPatterns.add(rule.pattern);
				if (rule.description) {
					matchedDescriptions.set(rule.pattern, rule.description);
				}
				fileChecks += rule.checks.length;
				for (const check of rule.checks) {
					allChecks.add(check);
				}
			}
		}
		fileCheckCounts.set(file, fileChecks);
	}

	// Find files with highest check counts
	let maxChecks = 0;
	for (const count of fileCheckCounts.values()) {
		if (count > maxChecks) {
			maxChecks = count;
		}
	}

	const highestImpactFiles: string[] = [];
	for (const [file, count] of fileCheckCounts.entries()) {
		if (count === maxChecks && count > 0) {
			highestImpactFiles.push(file);
		}
	}

	const matchedRules = [...matchedPatterns].map((pattern) => {
		const desc = matchedDescriptions.get(pattern);
		return desc === undefined ? { pattern } : { pattern, description: desc };
	});

	return {
		matchedRules,
		totalChecks: allChecks.size,
		highestImpactFiles,
	};
}

/**
 * Create a human-readable summary of blast radius.
 *
 * @param changedFiles - Array of changed file paths
 * @param rules - Blast radius rules to apply
 * @returns Summary string
 */
export function summarizeBlastRadius(
	changedFiles: string[],
	rules: BlastRadiusRule[] = DEFAULT_BLAST_RADIUS_RULES,
): string {
	const { checks, useDefaults } = resolveChecks(changedFiles, rules);
	const { matchedRules, highestImpactFiles } = getBlastRadiusInfo(
		changedFiles,
		rules,
	);

	const lines: string[] = [
		"Blast Radius Analysis",
		"",
		`Changed files: ${changedFiles.length}`,
	];

	if (matchedRules.length > 0) {
		lines.push("", "Matched patterns:");
		for (const rule of matchedRules) {
			lines.push(`  - ${rule.pattern}`);
			if (rule.description) {
				lines.push(`    ${rule.description}`);
			}
		}
	}

	if (useDefaults) {
		lines.push("", "No specific patterns matched. Using default checks.");
	}

	lines.push("", `Required checks (${checks.length}):`);
	for (const check of checks.sort()) {
		lines.push(`  - ${check}`);
	}

	if (highestImpactFiles.length > 0) {
		lines.push("", "Highest impact files:");
		for (const file of highestImpactFiles) {
			lines.push(`  - ${file}`);
		}
	}

	return lines.join("\n");
}
