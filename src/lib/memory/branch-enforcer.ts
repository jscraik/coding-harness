/**
 * Codex branch enforcement
 *
 * Enforces stricter validation for codex/* branches per Phase 7 requirements:
 * - Detect codex/* branch naming pattern
 * - Enforce read-first/write-discipline/closeout
 * - Require FORJAMIE.md presence and recency
 */

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Result of branch detection
 */
export interface BranchCheckResult {
	/** Current branch name */
	branch: string | null;
	/** Is this a codex/* branch */
	isCodexBranch: boolean;
	/** Codex task identifier (extracted from branch name) */
	taskId?: string | undefined;
}

/**
 * Detect current git branch
 */
export function detectCurrentBranch(): BranchCheckResult {
	try {
		const branch = execFileSync("git", ["branch", "--show-current"], {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "ignore"],
		}).trim();

		const isCodexBranch = branch.startsWith("codex/");
		const taskId = isCodexBranch ? branch.replace("codex/", "") : undefined;

		return { branch, isCodexBranch, taskId };
	} catch {
		// Not in a git repo or git not available
		return { branch: null, isCodexBranch: false };
	}
}

/**
 * Violation types for codex branch enforcement
 */
export interface CodexViolation {
	/** Violation category */
	type: "naming" | "forjamie" | "preamble" | "closeout";
	/** Human-readable message */
	message: string;
}

/**
 * Result of codex branch enforcement
 */
export interface CodexEnforcementResult {
	/** Is this a codex branch */
	isCodexBranch: boolean;
	/** All checks passed */
	valid: boolean;
	/** Violations found */
	violations: CodexViolation[];
	/** Branch info */
	branch?: string | undefined;
	taskId?: string | undefined;
}

/**
 * Check FORJAMIE.md compliance for codex branches
 */
function checkForjamieCompliance(
	forjamiePath: string,
	options?: { maxAgeHours?: number },
): { valid: boolean; violations: CodexViolation[] } {
	const violations: CodexViolation[] = [];
	const maxAgeHours = options?.maxAgeHours ?? 24;

	if (!existsSync(forjamiePath)) {
		violations.push({
			type: "forjamie",
			message: `FORJAMIE.md not found at ${forjamiePath} (required for codex/* branches)`,
		});
		return { valid: false, violations };
	}

	try {
		const stats = statSync(forjamiePath);
		const modifiedTime = stats.mtime;
		const now = new Date();
		const ageHours =
			(now.getTime() - modifiedTime.getTime()) / (1000 * 60 * 60);

		if (ageHours > maxAgeHours) {
			violations.push({
				type: "forjamie",
				message: `FORJAMIE.md is stale (${Math.round(ageHours)}h old, max ${maxAgeHours}h)`,
			});
		}

		// Check file size (should have meaningful content)
		if (stats.size < 100) {
			violations.push({
				type: "forjamie",
				message: "FORJAMIE.md appears empty or minimal (< 100 bytes)",
			});
		}
	} catch (error: unknown) {
		violations.push({
			type: "forjamie",
			message: `Cannot read FORJAMIE.md: ${(error as Error).message}`,
		});
	}

	return { valid: violations.length === 0, violations };
}

/**
 * Validate codex branch naming convention
 */
function validateBranchNaming(branch: string): {
	valid: boolean;
	violations: CodexViolation[];
} {
	const violations: CodexViolation[] = [];

	// Should follow codex/<task-description> pattern
	const parts = branch.split("/");
	if (parts.length < 2 || parts[0] !== "codex") {
		violations.push({
			type: "naming",
			message: `Branch "${branch}" does not follow codex/<task> pattern`,
		});
		return { valid: false, violations };
	}

	const taskPart = parts.slice(1).join("/");

	// Task description should be meaningful (at least 3 chars, alphanumeric-ish)
	if (taskPart.length < 3) {
		violations.push({
			type: "naming",
			message: `Task identifier "${taskPart}" too short (min 3 characters)`,
		});
	}

	// Should not contain spaces (use hyphens)
	if (taskPart.includes(" ")) {
		violations.push({
			type: "naming",
			message: "Task identifier should not contain spaces (use hyphens)",
		});
	}

	return { valid: violations.length === 0, violations };
}

/**
 * Enforce codex/* branch requirements
 */
export function enforceCodexBranch(options?: {
	forjamiePath?: string;
	maxAgeHours?: number;
}): CodexEnforcementResult {
	const branchInfo = detectCurrentBranch();

	// Not a codex branch - no enforcement needed
	if (!branchInfo.isCodexBranch) {
		return {
			isCodexBranch: false,
			valid: true,
			violations: [],
			branch: branchInfo.branch ?? undefined,
		};
	}

	const violations: CodexViolation[] = [];

	// 1. Validate branch naming (safe cast: isCodexBranch implies branch exists)
	const branchName = branchInfo.branch ?? "unknown";
	const namingResult = validateBranchNaming(branchName);
	violations.push(...namingResult.violations);

	// 2. Check FORJAMIE.md compliance
	const forjamiePath = resolve(options?.forjamiePath ?? "FORJAMIE.md");
	const forjamieResult = checkForjamieCompliance(forjamiePath, options);
	violations.push(...forjamieResult.violations);

	return {
		isCodexBranch: true,
		valid: violations.length === 0,
		violations,
		branch: branchName,
		taskId: branchInfo.taskId,
	};
}

/**
 * Check if current directory is in a codex branch (convenience function)
 */
export function isInCodexBranch(): boolean {
	return detectCurrentBranch().isCodexBranch;
}
