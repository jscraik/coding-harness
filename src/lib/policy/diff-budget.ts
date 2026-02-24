import type { DiffBudget, DiffBudgetOverride } from "../contract/types.js";

export interface DiffMetrics {
	filesChanged: number;
	additions: number;
	deletions: number;
	netLOC: number;
}

export interface DiffBudgetViolation {
	type: "files" | "loc";
	limit: number;
	actual: number;
}

export interface DiffBudgetCheck {
	passed: boolean;
	metrics: DiffMetrics;
	violations: DiffBudgetViolation[];
	override?: DiffBudgetOverride;
}

export interface PullRequestFile {
	filename: string;
	additions: number;
	deletions: number;
	changes: number;
	status: "added" | "removed" | "modified" | "renamed";
}

/**
 * Calculate diff metrics from PR files.
 */
export function calculateDiffMetrics(files: PullRequestFile[]): DiffMetrics {
	let additions = 0;
	let deletions = 0;

	for (const file of files) {
		additions += file.additions;
		deletions += file.deletions;
	}

	return {
		filesChanged: files.length,
		additions,
		deletions,
		netLOC: additions - deletions,
	};
}

/**
 * Check diff budget against metrics.
 * Returns check result with any violations.
 */
export function checkDiffBudget(
	metrics: DiffMetrics,
	budget: DiffBudget,
	override?: DiffBudgetOverride,
): DiffBudgetCheck {
	const violations: DiffBudgetViolation[] = [];

	if (metrics.filesChanged > budget.maxFiles) {
		violations.push({
			type: "files",
			limit: budget.maxFiles,
			actual: metrics.filesChanged,
		});
	}

	if (metrics.netLOC > budget.maxNetLOC) {
		violations.push({
			type: "loc",
			limit: budget.maxNetLOC,
			actual: metrics.netLOC,
		});
	}

	// Override is valid if it exists and has required fields
	const hasValidOverride =
		override !== undefined &&
		typeof override.reason === "string" &&
		override.reason.length > 0 &&
		typeof override.approvedBy === "string" &&
		typeof override.timestamp === "string";

	return {
		passed: violations.length === 0 || hasValidOverride,
		metrics,
		violations,
		...(hasValidOverride ? { override } : {}),
	};
}

/**
 * Format diff budget check result as human-readable message.
 */
export function formatDiffBudgetMessage(check: DiffBudgetCheck): string {
	if (check.violations.length === 0) {
		return `✓ Diff budget passed (${check.metrics.filesChanged} files, ${check.metrics.netLOC} LOC)`;
	}

	const parts: string[] = [];
	parts.push("✗ Diff budget exceeded:");

	for (const v of check.violations) {
		if (v.type === "files") {
			parts.push(`  - Files: ${v.actual} > ${v.limit} max`);
		} else {
			parts.push(`  - LOC: ${v.actual} > ${v.limit} max`);
		}
	}

	if (check.override) {
		parts.push(
			`\n  Override approved by ${check.override.approvedBy} at ${check.override.timestamp}`,
		);
		parts.push(`  Reason: ${check.override.reason}`);
	}

	return parts.join("\n");
}
