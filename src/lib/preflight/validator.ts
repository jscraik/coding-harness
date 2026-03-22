/**
 * Preflight policy validator
 *
 * Fast, lightweight checks designed to run before expensive operations
 * like full test suites or builds.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadContract } from "../contract/loader.js";
import type { RiskTier } from "../contract/types.js";
import { resolveOverallTier } from "../policy/risk-tier.js";
import {
	EXIT_CODES,
	type PreflightCheck,
	type PreflightCheckFn,
	type PreflightCheckRegistry,
	type PreflightGateOptions,
	type PreflightGateResult,
} from "./types.js";

export type { PreflightGateOptions };

/**
 * Quick file size check (large files slow down review)
 */
const fileSizeCheck: PreflightCheckFn = (options) => {
	const start = Date.now();
	const files = options.files ?? [];
	const largeFiles: string[] = [];
	const MAX_SIZE_BYTES = 500 * 1024; // 500KB

	for (const file of files) {
		try {
			if (existsSync(file)) {
				const stats = readFileSync(file);
				if (stats.length > MAX_SIZE_BYTES) {
					largeFiles.push(file);
				}
			}
		} catch {
			// Skip files we can't read
		}
	}

	return {
		id: "file-size",
		description: "Check for oversized files",
		severity: "warning",
		passed: largeFiles.length === 0,
		message:
			largeFiles.length > 0
				? `${largeFiles.length} files exceed 500KB: ${largeFiles.join(", ")}`
				: undefined,
		files: largeFiles,
		durationMs: Date.now() - start,
	};
};

/**
 * Contract existence check
 */
const contractExistsCheck: PreflightCheckFn = (options) => {
	const start = Date.now();
	const contractPath = resolve(options.contractPath ?? "harness.contract.json");
	const exists = existsSync(contractPath);

	return {
		id: "contract-exists",
		description: "Verify harness contract exists",
		severity: "error",
		passed: exists,
		message: exists ? undefined : `Contract not found: ${contractPath}`,
		durationMs: Date.now() - start,
	};
};

/**
 * Risk tier validation (quick version)
 */
const riskTierCheck: PreflightCheckFn = (options) => {
	const start = Date.now();
	const contractPath = resolve(options.contractPath ?? "harness.contract.json");

	if (!existsSync(contractPath) || !options.files?.length) {
		return {
			id: "risk-tier",
			description: "Validate risk tier against contract",
			severity: "error",
			passed: true,
			message: "Skipped: no contract or files provided",
			durationMs: Date.now() - start,
		};
	}

	try {
		const contract = loadContract(contractPath);
		const tier = resolveOverallTier(options.files ?? [], contract);

		// Check against max tier if specified
		if (options.maxTier) {
			const TIER_ORDER: RiskTier[] = ["high", "medium", "low"];
			const maxIndex = TIER_ORDER.indexOf(options.maxTier);
			const actualIndex = TIER_ORDER.indexOf(tier);

			if (actualIndex < maxIndex) {
				return {
					id: "risk-tier",
					description: "Validate risk tier against policy",
					severity: "error",
					passed: false,
					message: `Risk tier '${tier}' exceeds maximum allowed '${options.maxTier}'`,
					durationMs: Date.now() - start,
				};
			}
		}

		return {
			id: "risk-tier",
			description: "Validate risk tier against contract",
			severity: "error",
			passed: true,
			message: `Current tier: ${tier}`,
			durationMs: Date.now() - start,
		};
	} catch (error) {
		return {
			id: "risk-tier",
			description: "Validate risk tier against contract",
			severity: "error",
			passed: false,
			message: `Failed to evaluate: ${(error as Error).message}`,
			durationMs: Date.now() - start,
		};
	}
};

/**
 * Forbidden pattern check (quick regex scan)
 */
const forbiddenPatternCheck: PreflightCheckFn = (options) => {
	const start = Date.now();
	const files = options.files ?? [];
	const violations: Array<{ file: string; pattern: string }> = [];

	// Common forbidden patterns
	const forbiddenPatterns: Array<{ pattern: RegExp; name: string }> = [
		{ pattern: /console\.log\s*\(/, name: "console.log" },
		{ pattern: /debugger\s*;/, name: "debugger statement" },
		{ pattern: /TODO\s*:\s*FIXME/i, name: "TODO FIXME marker" },
		{ pattern: /\.skip\s*\(/, name: "skipped test" },
	];

	for (const file of files) {
		if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;

		try {
			const content = readFileSync(file, "utf-8");
			for (const { pattern, name } of forbiddenPatterns) {
				if (pattern.test(content)) {
					violations.push({ file, pattern: name });
				}
			}
		} catch {
			// Skip files we can't read
		}
	}

	return {
		id: "forbidden-patterns",
		description: "Check for forbidden code patterns",
		severity: "warning",
		passed: violations.length === 0,
		message:
			violations.length > 0
				? `Found ${violations.length} violations: ${violations.map((v) => `${v.file} (${v.pattern})`).join(", ")}`
				: undefined,
		files: violations.map((v) => v.file),
		durationMs: Date.now() - start,
	};
};

/**
 * Git repository check
 */
const gitRepositoryCheck: PreflightCheckFn = () => {
	const start = Date.now();
	const gitDir = resolve(".git");
	const exists = existsSync(gitDir);

	return {
		id: "git-repository",
		description: "Verify git repository exists",
		severity: "error",
		passed: exists,
		message: exists ? undefined : "Not a git repository",
		durationMs: Date.now() - start,
	};
};

/**
 * Registry of all available preflight checks
 */
export const PREFLIGHT_CHECKS: PreflightCheckRegistry = {
	"git-repository": {
		name: "Git Repository",
		description: "Verify this is a git repository",
		severity: "error",
		fn: gitRepositoryCheck,
	},
	"contract-exists": {
		name: "Contract Exists",
		description: "Verify harness.contract.json exists",
		severity: "error",
		fn: contractExistsCheck,
	},
	"risk-tier": {
		name: "Risk Tier",
		description: "Validate files against risk tier policy",
		severity: "error",
		fn: riskTierCheck,
	},
	"file-size": {
		name: "File Size",
		description: "Check for oversized files",
		severity: "warning",
		fn: fileSizeCheck,
	},
	"forbidden-patterns": {
		name: "Forbidden Patterns",
		description:
			"Check for forbidden code patterns (console.log, debugger, etc.)",
		severity: "warning",
		fn: forbiddenPatternCheck,
	},
};

/**
 * Run preflight gate with selected checks
 */
export async function runPreflightGate(
	options: PreflightGateOptions,
): Promise<PreflightGateResult> {
	const start = Date.now();
	const checks: PreflightCheck[] = [];

	// Determine which checks to run
	const checkIds = Object.keys(PREFLIGHT_CHECKS).filter(
		(id) => !options.skip?.includes(id),
	);

	// Run all checks in parallel
	const checkPromises = checkIds.map(async (id) => {
		const check = PREFLIGHT_CHECKS[id];
		if (!check) return null;
		return check.fn(options);
	});

	const results = await Promise.all(checkPromises);

	for (const result of results) {
		if (result) {
			checks.push(result);
		}
	}

	// Determine overall pass/fail
	const failedChecks = checks.filter((c) => !c.passed);
	const errorChecks = failedChecks.filter((c) => c.severity === "error");
	const warningChecks = failedChecks.filter((c) => c.severity === "warning");

	// In strict mode, warnings count as failures
	const passed =
		errorChecks.length === 0 &&
		(options.strict ? warningChecks.length === 0 : true);

	// Determine overall risk tier if we have files
	let riskTier: RiskTier | undefined;
	const contractPath = resolve(options.contractPath ?? "harness.contract.json");
	if (existsSync(contractPath) && options.files?.length) {
		try {
			const contract = loadContract(contractPath);
			riskTier = resolveOverallTier(options.files, contract);
		} catch {
			// Ignore errors here
		}
	}

	return {
		passed,
		checks,
		summary: {
			total: checks.length,
			passed: checks.filter((c) => c.passed).length,
			failed: failedChecks.length,
			warnings: warningChecks.length,
			durationMs: Date.now() - start,
		},
		riskTier,
	};
}

export { EXIT_CODES };

// Re-export performance overload precheck for timing-sensitive check consumers
export {
	runPerformanceOverloadPrecheck,
	formatTimingAssertionSkipDiagnostic,
	PERFORMANCE_PRECHECK_ENV,
	type PerformanceOverloadPrecheckResult,
	type PerformanceOverloadPrecheckOptions,
	type PerformanceOverloadThresholds,
	type PerformanceOverloadObserved,
} from "./performance-overload.js";

// Re-export timing assertion overload guard for test suite consumers
export {
	evaluateTimingAssertionOverload,
	runTimingAssertionWithOverloadGuard,
	type TimingAssertionOverloadCheck,
} from "../test/overload-guard.js";
