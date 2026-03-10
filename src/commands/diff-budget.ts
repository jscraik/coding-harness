/**
 * Diff budget CLI command
 *
 * Enforces diff budget constraints on PRs.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadContract } from "../lib/contract/loader.js";
import type { DiffBudget, DiffBudgetOverride } from "../lib/contract/types.js";
import { validatePath } from "../lib/input/validator.js";
import {
	type DiffBudgetCheck,
	type DiffMetrics,
	type PullRequestFile,
	calculateDiffMetrics,
	checkDiffBudget,
	formatDiffBudgetMessage,
} from "../lib/policy/diff-budget.js";
import {
	type CliError,
	type CliResult,
	type Result,
	createError,
	err,
	ok,
} from "../lib/result/types.js";

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

export interface DiffBudgetOutput {
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

const GIT_REF_PATTERN = /^[A-Za-z0-9._/-]{1,120}$/;

function isSafeGitRef(ref: string): boolean {
	return (
		GIT_REF_PATTERN.test(ref) &&
		!ref.startsWith("-") &&
		!ref.includes("..") &&
		!ref.includes("//")
	);
}

function isValidDiffBudgetOverride(
	value: unknown,
): value is DiffBudgetOverride {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const record = value as Record<string, unknown>;
	if (
		typeof record.reason !== "string" ||
		record.reason.trim().length === 0 ||
		typeof record.approvedBy !== "string" ||
		record.approvedBy.trim().length === 0 ||
		typeof record.timestamp !== "string"
	) {
		return false;
	}
	return !Number.isNaN(new Date(record.timestamp).getTime());
}

/**
 * Get diff between base and head refs using git.
 */
function getGitDiff(
	base: string,
	head: string,
): Result<PullRequestFile[], CliError> {
	// Use spawnSync for safe argument passing (no shell interpolation)
	const result = spawnSync("git", ["diff", "--numstat", `${base}..${head}`], {
		encoding: "utf-8",
		timeout: 30000,
	});

	// Check for spawn error (e.g., git not found)
	if (result.error) {
		return err(
			createError(
				"SYSTEM_ERROR",
				`Failed to run git diff: ${result.error.message}`,
				undefined,
				result.error,
			),
		);
	}

	if (result.status !== 0) {
		return err(
			createError(
				"SYSTEM_ERROR",
				`git diff failed with status ${result.status}: ${result.stderr}`,
			),
		);
	}

	const output = result.stdout;
	if (!output.trim()) {
		return ok([]);
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

	return ok(files);
}

/**
 * Load diff budget from contract file.
 */
function loadDiffBudgetFromContract(contractPath: string): DiffBudget | null {
	try {
		const contract = loadContract(contractPath);
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
		const safePath = validatePath(process.cwd(), overridePath);
		const content = readFileSync(safePath, "utf-8");
		const parsed = JSON.parse(content) as unknown;
		if (!isValidDiffBudgetOverride(parsed)) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/**
 * Run diff budget check and return structured result.
 */
export function runDiffBudget(
	options: DiffBudgetOptions,
): CliResult<DiffBudgetOutput> {
	const base = options.base ?? "main";
	const head = options.head ?? "HEAD";
	const contractPath = options.contractPath ?? "harness.contract.json";

	if (!isSafeGitRef(base)) {
		return err(createError("VALIDATION_ERROR", `Invalid base ref: ${base}`));
	}
	if (!isSafeGitRef(head)) {
		return err(createError("VALIDATION_ERROR", `Invalid head ref: ${head}`));
	}

	// Load budget from contract or use defaults
	let budget = DEFAULT_DIFF_BUDGET;
	const contractBudget = loadDiffBudgetFromContract(contractPath);
	if (contractBudget) {
		budget = contractBudget;
	}

	// Get diff metrics
	const filesResult = getGitDiff(base, head);
	if (!filesResult.ok) {
		return filesResult;
	}

	const metrics = calculateDiffMetrics(filesResult.value);

	// Load override if specified
	let override: DiffBudgetOverride | undefined;
	if (options.overridePath) {
		override = loadOverride(options.overridePath) ?? undefined;
	}

	// Check budget
	const check = checkDiffBudget(metrics, budget, override);

	return ok({
		passed: check.passed,
		metrics,
		check,
		base,
		head,
	});
}

/**
 * CLI entry point for diff budget command.
 */
export function runDiffBudgetCLI(options: DiffBudgetOptions): number {
	const result = runDiffBudget(options);

	if (!result.ok) {
		console.error(`Error: ${result.error.message}`);

		if (options.json) {
			console.info(JSON.stringify({ error: result.error.message }));
		}

		return EXIT_CODES.SYSTEM_ERROR;
	}

	if (options.json) {
		console.info(JSON.stringify(result.value, null, 2));
	} else {
		console.info(formatDiffBudgetMessage(result.value.check));
		console.info(`  Base: ${result.value.base}`);
		console.info(`  Head: ${result.value.head}`);
	}

	return result.value.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.BUDGET_EXCEEDED;
}
