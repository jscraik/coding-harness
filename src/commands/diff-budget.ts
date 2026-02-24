/**
 * Diff budget CLI command
 *
 * Enforces diff budget constraints on PRs.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DiffBudget, DiffBudgetOverride } from "../lib/contract/types.js";
import {
	type DiffBudgetCheck,
	type DiffMetrics,
	type PullRequestFile,
	calculateDiffMetrics,
	checkDiffBudget,
	formatDiffBudgetMessage,
} from "../lib/policy/diff-budget.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	BUDGET_EXCEEDED: 1,
	VALIDATION_ERROR: 2,
	SYSTEM_ERROR: 10,
} as const;

export interface DiffBudgetOptions {
	/** Base ref (commit SHA or branch name) */
	base?: string;
	/** Head ref (commit SHA or branch name) */
	head?: string;
	/** Path to contract file */
	contractPath?: string;
	/** Path to override file */
	overridePath?: string;
	/** Output as JSON */
	json?: boolean;
}

export interface DiffBudgetResult {
	passed: boolean;
	metrics: DiffMetrics;
	check: DiffBudgetCheck;
	base: string;
	head: string;
}

const DEFAULT_DIFF_BUDGET: DiffBudget = {
	maxFiles: 10,
	maxNetLOC: 400,
};

/**
 * Get diff between base and head refs using git.
 */
function getGitDiff(base: string, head: string): PullRequestFile[] {
	// Use spawnSync for safe argument passing (no shell interpolation)
	const result = spawnSync("git", ["diff", "--numstat", `${base}..${head}`], {
		encoding: "utf-8",
		timeout: 30000,
	});

	// Check for spawn error (e.g., git not found)
	if (result.error && result.error.message !== "no error") {
		throw new Error(`Failed to run git diff: ${result.error.message}`);
	}

	if (result.status !== 0) {
		throw new Error(
			`git diff failed with status ${result.status}: ${result.stderr}`,
		);
	}

	const output = result.stdout;
	if (!output.trim()) {
		return [];
	}

	const files: PullRequestFile[] = [];
	const lines = output.trim().split("\n");

	for (const line of lines) {
		const parts = line.split("\t");
		if (parts.length >= 3) {
			const additions =
				parts[0] === "-" ? 0 : Number.parseInt(parts[0] ?? "0", 10);
			const deletions =
				parts[1] === "-" ? 0 : Number.parseInt(parts[1] ?? "0", 10);
			const filename = parts.slice(2).join("\t");

			files.push({
				filename,
				additions,
				deletions,
				changes: additions + deletions,
				status: "modified",
			});
		}
	}

	return files;
}

/**
 * Load diff budget from contract file.
 */
function loadDiffBudgetFromContract(contractPath: string): DiffBudget | null {
	try {
		const content = readFileSync(contractPath, "utf-8");
		const contract = JSON.parse(content) as { diffBudget?: DiffBudget };
		return contract.diffBudget ?? null;
	} catch {
		return null;
	}
}

/**
 * Load override from file.
 */
function loadOverride(overridePath: string): DiffBudgetOverride | null {
	try {
		const content = readFileSync(overridePath, "utf-8");
		return JSON.parse(content) as DiffBudgetOverride;
	} catch {
		return null;
	}
}

/**
 * Run diff budget check.
 */
export function runDiffBudget(options: DiffBudgetOptions): DiffBudgetResult {
	const base = options.base ?? "main";
	const head = options.head ?? "HEAD";
	const contractPath = options.contractPath ?? "harness.contract.json";

	// Load budget from contract or use defaults
	let budget = DEFAULT_DIFF_BUDGET;
	const contractFullPath = join(process.cwd(), contractPath);
	if (existsSync(contractFullPath)) {
		const contractBudget = loadDiffBudgetFromContract(contractFullPath);
		if (contractBudget) {
			budget = contractBudget;
		}
	}

	// Get diff metrics
	const files = getGitDiff(base, head);
	const metrics = calculateDiffMetrics(files);

	// Load override if specified
	let override: DiffBudgetOverride | undefined;
	if (options.overridePath) {
		override = loadOverride(options.overridePath) ?? undefined;
	}

	// Check budget
	const check = checkDiffBudget(metrics, budget, override);

	return {
		passed: check.passed,
		metrics,
		check,
		base,
		head,
	};
}

/**
 * CLI entry point for diff budget command.
 */
export function runDiffBudgetCLI(options: DiffBudgetOptions): number {
	try {
		const result = runDiffBudget(options);

		if (options.json) {
			console.info(JSON.stringify(result, null, 2));
		} else {
			console.info(formatDiffBudgetMessage(result.check));
			console.info(`  Base: ${result.base}`);
			console.info(`  Head: ${result.head}`);
		}

		return result.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.BUDGET_EXCEEDED;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${message}`);

		if (options.json) {
			console.info(JSON.stringify({ error: message }));
		}

		return EXIT_CODES.SYSTEM_ERROR;
	}
}
