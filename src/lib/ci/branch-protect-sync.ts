/**
 * JSC-60: Branch protection required check synchronisation utilities.
 *
 * After a ci-migrate commit (especially when deleting GitHub Actions workflows),
 * the GitHub branch protection ruleset may reference status checks produced by
 * those deleted workflows. These "orphaned" checks will permanently block PRs.
 *
 * This module provides:
 *  - detectOrphanedChecks()              — pure comparison between ruleset checks
 *                                          and current workflow job names
 *  - getProviderDefaultChecks()          — canonical check names for target CI
 *  - buildBranchProtectSyncPlan()        — structured sync recommendation
 *  - formatBranchProtectSyncWarning()    — human-readable CLI warning
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ─── Provider check name mapping ─────────────────────────────────────────────

/**
 * Known CircleCI GitHub App ID (used for required_status_checks app_id).
 * https://circleci.com/docs/github-integration/#status-checks
 */
export const CIRCLECI_APP_ID = 18001;

/**
 * The canonical CircleCI pipeline job name written by `harness init`.
 * Overrideable via the contract's ciProviderPolicy.primaryCheckName.
 */
export const CIRCLECI_PRIMARY_CHECK = "pr-pipeline";

/**
 * Canonical check names by CI provider.
 */
export const PROVIDER_DEFAULT_CHECKS: Record<string, string[]> = {
	circleci: [CIRCLECI_PRIMARY_CHECK],
	"github-actions": ["ci"],
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CheckEntry {
	/** Status check context name (e.g. "quality-gates", "pr-pipeline") */
	context: string;
	/** GitHub App ID that reported the check, if present */
	appId?: number | undefined;
}

export interface BranchProtectSyncPlan {
	/** Checks currently in the ruleset */
	currentChecks: CheckEntry[];
	/** Subset of currentChecks that no longer have a backing workflow/CI job */
	orphanedChecks: CheckEntry[];
	/** Checks that should be added for the target provider */
	recommendedAdditions: CheckEntry[];
	/** Whether any changes are needed */
	hasDrift: boolean;
	/** Human-readable drift summary */
	summary: string;
	/** Exact `harness branch-protect` command to fix drift */
	fixCommand: string;
	/**
	 * Exact `gh api` command to atomic-patch required_status_checks,
	 * for when the user prefers to use the GitHub CLI directly.
	 */
	ghApiCommand: string | null;
}

// ─── Workflow file parsing ────────────────────────────────────────────────────

/**
 * Extract GHA job IDs from a GitHub Actions workflow YAML (best-effort, no parser).
 * Returns the raw job key names that GitHub uses as status check context names.
 */
export function extractGHAJobNames(yamlContent: string): string[] {
	const jobNames: string[] = [];
	// Match "jobs:" block, then capture keys at next indentation level
	const lines = yamlContent.split("\n");
	let inJobsBlock = false;
	for (const raw of lines) {
		const line = raw.trimEnd();
		if (/^jobs:/.test(line)) {
			inJobsBlock = true;
			continue;
		}
		if (inJobsBlock) {
			// Any top-level key under jobs: at 2-space indent
			const match = /^  ([a-zA-Z0-9_-]+)\s*:/.exec(line);
			if (match?.[1]) {
				jobNames.push(match[1]);
			}
			// Stop if we hit another top-level key (no indent)
			if (/^[a-zA-Z]/.test(line) && !match) {
				inJobsBlock = false;
			}
		}
	}
	return [...new Set(jobNames)];
}

/**
 * Read all GHA workflow files from `<targetDir>/.github/workflows/` and
 * return the union of all job names they define.
 */
export function getActiveGHAJobNames(targetDir: string): string[] {
	const workflowDir = resolve(targetDir, ".github", "workflows");
	if (!existsSync(workflowDir)) {
		return [];
	}
	let files: string[] = [];
	try {
		files = readdirSync(workflowDir).filter(
			(f) => f.endsWith(".yml") || f.endsWith(".yaml"),
		);
	} catch {
		return [];
	}
	const jobNames = new Set<string>();
	for (const file of files) {
		try {
			const content = readFileSync(join(workflowDir, file), "utf-8");
			for (const name of extractGHAJobNames(content)) {
				jobNames.add(name);
			}
		} catch {
			// Best-effort per file
		}
	}
	return Array.from(jobNames);
}

// ─── Orphan detection ─────────────────────────────────────────────────────────

/**
 * Compare current ruleset check contexts against the set of active job names
 * (from whichever CI system is currently in use).
 *
 * A check is "orphaned" if:
 * - Its context does not appear in `activeJobNames`
 * - AND its context does not appear in `targetProviderChecks`
 *
 * This is intentionally lenient: checks that already match target provider
 * names are not flagged as orphaned.
 */
export function detectOrphanedChecks(options: {
	/** Checks currently configured in the branch protection ruleset */
	currentChecks: CheckEntry[];
	/** Active job names from current CI config files */
	activeJobNames: string[];
	/** Canonical check names for the target CI provider */
	targetProviderChecks: string[];
}): CheckEntry[] {
	const { currentChecks, activeJobNames, targetProviderChecks } = options;
	const activeNames = new Set(activeJobNames.map((n) => n.trim().toLowerCase()));
	const targetNames = new Set(
		targetProviderChecks.map((n) => n.trim().toLowerCase()),
	);

	return currentChecks.filter((check) => {
		const ctx = check.context.trim().toLowerCase();
		return !activeNames.has(ctx) && !targetNames.has(ctx);
	});
}

// ─── Sync recommendation builder ──────────────────────────────────────────────

export interface BuildSyncPlanOptions {
	/** Current checks in the branch protection ruleset */
	currentChecks: CheckEntry[];
	/** Target CI provider (determines recommended additions) */
	targetProvider: string;
	/** Active GHA job names on disk */
	activeGHAJobNames: string[];
	/** Override recommended check names (defaults to PROVIDER_DEFAULT_CHECKS) */
	targetProviderChecks?: string[] | undefined;
	/** Repository owner for fix commands */
	owner?: string | undefined;
	/** Repository name for fix commands */
	repo?: string | undefined;
	/** Branch name (default: main) */
	branch?: string | undefined;
}

/**
 * JSC-60: Build a complete sync plan for branch protection required checks.
 *
 * Detects orphaned checks, recommends additions, and provides exact fix commands.
 */
export function buildBranchProtectSyncPlan(
	options: BuildSyncPlanOptions,
): BranchProtectSyncPlan {
	const {
		currentChecks,
		targetProvider,
		activeGHAJobNames,
		owner,
		repo,
		branch = "main",
	} = options;

	const targetProviderChecks =
		options.targetProviderChecks ??
		PROVIDER_DEFAULT_CHECKS[targetProvider] ??
		[];

	const orphanedChecks = detectOrphanedChecks({
		currentChecks,
		activeJobNames: activeGHAJobNames,
		targetProviderChecks,
	});

	// Checks to add: target provider checks not already in current
	const currentContexts = new Set(
		currentChecks.map((c) => c.context.trim().toLowerCase()),
	);
	const recommendedAdditions: CheckEntry[] = targetProviderChecks
		.filter((c) => !currentContexts.has(c.trim().toLowerCase()))
		.map((context) => ({
			context,
			...(targetProvider === "circleci"
				? { appId: CIRCLECI_APP_ID }
				: {}),
		}));

	const hasDrift = orphanedChecks.length > 0 || recommendedAdditions.length > 0;

	// Build summary
	const parts: string[] = [];
	if (orphanedChecks.length > 0) {
		parts.push(
			`${orphanedChecks.length} orphaned check(s): ${orphanedChecks.map((c) => `"${c.context}"`).join(", ")}`,
		);
	}
	if (recommendedAdditions.length > 0) {
		parts.push(
			`${recommendedAdditions.length} recommended addition(s): ${recommendedAdditions.map((c) => `"${c.context}"`).join(", ")}`,
		);
	}
	const summary = hasDrift
		? parts.join("; ")
		: "Branch protection required checks are in sync with CI provider";

	// Build fix command
	const allDesiredChecks = [
		...currentChecks
			.filter(
				(c) =>
					!orphanedChecks.some(
						(o) =>
							o.context.trim().toLowerCase() ===
							c.context.trim().toLowerCase(),
					),
			)
			.map((c) => c.context),
		...recommendedAdditions.map((c) => c.context),
	];

	const repoFlag =
		owner && repo ? ` --owner ${owner} --repo ${repo}` : " --owner <owner> --repo <repo>";
	const checksFlag = allDesiredChecks
		.map((c) => `--checks "${c}"`)
		.join(" ");
	const fixCommand = `harness branch-protect${repoFlag} ${checksFlag}`;

	// gh api command as alternative
	let ghApiCommand: string | null = null;
	if (owner && repo && allDesiredChecks.length > 0) {
		const checksJson = JSON.stringify(
			allDesiredChecks.map((c) =>
				targetProvider === "circleci"
					? { context: c, app_id: CIRCLECI_APP_ID }
					: { context: c },
			),
		);
		ghApiCommand = `gh api repos/${owner}/${repo}/branches/${branch}/protection/required_status_checks --method PATCH --field required_status_checks='${checksJson}'`;
	}

	return {
		currentChecks,
		orphanedChecks,
		recommendedAdditions,
		hasDrift,
		summary,
		fixCommand,
		ghApiCommand,
	};
}

// ─── CLI warning formatter ────────────────────────────────────────────────────

/**
 * Format a human-readable branch protection sync warning for the CLI.
 * Used by ci-migrate commit post-commit output.
 */
export function formatBranchProtectSyncWarning(
	plan: BranchProtectSyncPlan,
): string {
	if (!plan.hasDrift) {
		return "";
	}

	const lines: string[] = [
		"",
		"⚠️  BRANCH PROTECTION DRIFT DETECTED (JSC-60)",
		"   Your GitHub branch protection ruleset may have orphaned or missing checks.",
		"",
	];

	if (plan.orphanedChecks.length > 0) {
		lines.push("   Orphaned checks (no backing CI job found):");
		for (const check of plan.orphanedChecks) {
			lines.push(`     - "${check.context}"`);
		}
		lines.push(
			"   These will permanently block PRs until removed from branch protection.",
		);
		lines.push("");
	}

	if (plan.recommendedAdditions.length > 0) {
		lines.push("   Recommended additions for target CI provider:");
		for (const check of plan.recommendedAdditions) {
			const appNote =
				check.appId !== undefined ? ` (app_id: ${check.appId})` : "";
			lines.push(`     + "${check.context}"${appNote}`);
		}
		lines.push("");
	}

	lines.push("   Fix with:");
	lines.push(`     ${plan.fixCommand}`);
	lines.push("");
	lines.push("   Or skip GitHub API and auto-update via:");
	lines.push("     harness ci-migrate sync-branch-protection");
	lines.push("");

	return lines.join("\n");
}
