/**
 * Repository Scanner - Multi-repo governance visibility
 *
 * Scans multiple repositories for harness.contract.json files and:
 * - Validates contract syntax and structure
 * - Detects drift from base contract
 * - Reports compliance status
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HarnessContract } from "../contract/types.js";
import { validateContract } from "../contract/validator.js";
import {
	type ScanCache,
	getCachedEntry,
	getDefaultCachePath,
	loadScanCache,
	saveScanCache,
	setCachedEntry,
} from "./scan-cache.js";

export interface ScanOptions {
	/** Base contract to compare against (for drift detection) */
	baseContract?: HarnessContract | undefined;
	/** Whether to include repositories without contracts */
	includeMissing?: boolean | undefined;
	/** Enable caching for repeated scans (default: true) */
	useCache?: boolean | undefined;
	/** Path to cache file (default: ~/.cache/harness/org-audit-cache.json) */
	cachePath?: string | undefined;
}

export interface ScanResult {
	/** Repository path */
	path: string;
	/** Scan status */
	status: "success" | "error" | "no-contract";
	/** Contract data (if found and valid) */
	contract?: HarnessContract | undefined;
	/** Validation errors (if invalid) */
	errors?: string[] | undefined;
	/** Error message (if error) */
	error?: string | undefined;
	/** Drift findings (if baseContract provided) */
	drift?: DriftFinding[] | undefined;
}

export interface DriftFinding {
	/** Path to the field that differs */
	path: string;
	/** Expected value (from base) */
	expected: unknown;
	/** Actual value (from repo) */
	actual: unknown;
	/** Severity of the drift */
	severity: "critical" | "warning" | "info";
	/** Description of the drift */
	description: string;
}

/**
 * Scan multiple repositories in parallel.
 *
 * Uses Promise.allSettled for fault tolerance - one repo failing
 * doesn't prevent others from being scanned.
 *
 * Supports caching to improve performance on repeated scans.
 */
export async function scanRepositories(
	repos: string[],
	options: ScanOptions = {},
): Promise<ScanResult[]> {
	const useCache = options.useCache ?? true;
	const cachePath = options.cachePath ?? getDefaultCachePath();
	const cache = useCache
		? loadScanCache(cachePath)
		: { version: 1, entries: [] };

	const results = await Promise.allSettled(
		repos.map((repo) => scanSingleRepo(repo, options, cache)),
	);

	// Save cache after scan if enabled
	if (useCache) {
		saveScanCache(cachePath, cache);
	}

	return results.map((result, i) => {
		if (result.status === "fulfilled") {
			return result.value;
		}
		return {
			path: repos[i] ?? "unknown",
			status: "error",
			error:
				result.reason instanceof Error
					? result.reason.message
					: "Unknown error",
		};
	});
}

/**
 * Scan a single repository for harness contract.
 */
export async function scanSingleRepo(
	repoPath: string,
	options: ScanOptions = {},
	cache?: ScanCache,
): Promise<ScanResult> {
	const contractPath = join(repoPath, "harness.contract.json");

	// Check cache first if available
	if (cache && existsSync(contractPath)) {
		const cached = getCachedEntry(cache, repoPath, contractPath);
		if (cached) {
			const cachedResult = cached.result as ScanResult;
			// Re-run drift detection if base contract changed
			if (options.baseContract && cachedResult.contract) {
				return {
					...cachedResult,
					drift: detectDrift(options.baseContract, cachedResult.contract),
				};
			}
			// Drop stale drift findings when no base contract is requested.
			// Cached entries may have been created during a previous scan with
			// baseContract enabled.
			if (!options.baseContract && cachedResult.drift !== undefined) {
				const { drift: _drift, ...resultWithoutDrift } = cachedResult;
				return resultWithoutDrift;
			}
			return cachedResult;
		}
	}

	// Check if contract exists
	if (!existsSync(contractPath)) {
		if (options.includeMissing) {
			return {
				path: repoPath,
				status: "no-contract",
			};
		}
		return {
			path: repoPath,
			status: "error",
			error: "No harness.contract.json found",
		};
	}

	try {
		// Read and parse contract
		const content = readFileSync(contractPath, "utf-8");
		const data = JSON.parse(content);

		// Validate contract structure
		const validationResult = validateContract(data);

		if (!validationResult.success) {
			return {
				path: repoPath,
				status: "error",
				errors: validationResult.errors.map(
					(e: { message: string }) => e.message,
				),
			};
		}

		const contract = validationResult.data as HarnessContract;

		// Detect drift if base contract provided
		const result: ScanResult = {
			path: repoPath,
			status: "success",
			contract,
		};

		if (options.baseContract) {
			result.drift = detectDrift(options.baseContract, contract);
		}

		// Update cache if enabled
		if (cache) {
			setCachedEntry(cache, repoPath, contractPath, result);
		}

		return result;
	} catch (error) {
		return {
			path: repoPath,
			status: "error",
			error:
				error instanceof Error ? error.message : "Failed to parse contract",
		};
	}
}

/**
 * Detect drift between base contract and actual contract.
 *
 * Compares key governance fields and reports differences.
 */
export function detectDrift(
	base: HarnessContract,
	actual: HarnessContract,
): DriftFinding[] {
	const findings: DriftFinding[] = [];

	// Compare review policy required checks
	// Use Set for O(1) lookup instead of O(n) includes()
	const baseChecks = base.reviewPolicy?.requiredChecks ?? [];
	const actualChecksSet = new Set(actual.reviewPolicy?.requiredChecks ?? []);

	for (const check of baseChecks) {
		if (!actualChecksSet.has(check)) {
			findings.push({
				path: "reviewPolicy.requiredChecks",
				expected: check,
				actual: undefined,
				severity: "critical",
				description: `Missing required check: ${check}`,
			});
		}
	}

	// Compare branch protection required checks
	const baseBranchChecks = base.branchProtection?.requiredChecks ?? [];
	const actualBranchChecksSet = new Set(
		actual.branchProtection?.requiredChecks ?? [],
	);

	for (const check of baseBranchChecks) {
		if (!actualBranchChecksSet.has(check)) {
			findings.push({
				path: "branchProtection.requiredChecks",
				expected: check,
				actual: undefined,
				severity: "critical",
				description: `Missing branch protection check: ${check}`,
			});
		}
	}

	// Compare diff budget
	if (base.diffBudget && actual.diffBudget) {
		if (base.diffBudget.maxFiles < actual.diffBudget.maxFiles) {
			findings.push({
				path: "diffBudget.maxFiles",
				expected: base.diffBudget.maxFiles,
				actual: actual.diffBudget.maxFiles,
				severity: "warning",
				description: `Diff budget allows more files than base (${actual.diffBudget.maxFiles} > ${base.diffBudget.maxFiles})`,
			});
		}

		if (base.diffBudget.maxNetLOC < actual.diffBudget.maxNetLOC) {
			findings.push({
				path: "diffBudget.maxNetLOC",
				expected: base.diffBudget.maxNetLOC,
				actual: actual.diffBudget.maxNetLOC,
				severity: "warning",
				description: `Diff budget allows more lines than base (${actual.diffBudget.maxNetLOC} > ${base.diffBudget.maxNetLOC})`,
			});
		}
	}

	// Compare evidence policy
	if (base.evidencePolicy?.requiredFor && actual.evidencePolicy?.requiredFor) {
		const baseRequired = base.evidencePolicy.requiredFor;
		const actualRequiredSet = new Set(actual.evidencePolicy.requiredFor);

		for (const pattern of baseRequired) {
			if (!actualRequiredSet.has(pattern)) {
				findings.push({
					path: "evidencePolicy.requiredFor",
					expected: pattern,
					actual: undefined,
					severity: "warning",
					description: `Missing evidence requirement for: ${pattern}`,
				});
			}
		}
	}

	// Compare risk tier rules coverage
	const baseRules = Object.keys(base.riskTierRules ?? {});
	const actualRulesSet = new Set(Object.keys(actual.riskTierRules ?? {}));

	for (const rule of baseRules) {
		if (!actualRulesSet.has(rule)) {
			findings.push({
				path: "riskTierRules",
				expected: rule,
				actual: undefined,
				severity: "info",
				description: `Missing risk tier rule: ${rule}`,
			});
		}
	}

	// Compare tooling policy surface when present in the base contract.
	if (base.toolingPolicy && actual.toolingPolicy) {
		const actualDocTerms = new Set(
			actual.toolingPolicy.requiredDocumentationTerms,
		);
		for (const term of base.toolingPolicy.requiredDocumentationTerms) {
			if (!actualDocTerms.has(term)) {
				findings.push({
					path: "toolingPolicy.requiredDocumentationTerms",
					expected: term,
					actual: undefined,
					severity: "warning",
					description: `Missing required tooling documentation term: ${term}`,
				});
			}
		}

		const actualBinaries = new Set(actual.toolingPolicy.requiredBinaries);
		for (const binary of base.toolingPolicy.requiredBinaries) {
			if (!actualBinaries.has(binary)) {
				findings.push({
					path: "toolingPolicy.requiredBinaries",
					expected: binary,
					actual: undefined,
					severity: "critical",
					description: `Missing required tooling binary: ${binary}`,
				});
			}
		}

		const actualMiseTools = new Map(
			actual.toolingPolicy.requiredMiseTools.map((item) => [
				item.tool,
				item.version,
			]),
		);
		for (const item of base.toolingPolicy.requiredMiseTools) {
			if (!actualMiseTools.has(item.tool)) {
				findings.push({
					path: "toolingPolicy.requiredMiseTools",
					expected: item,
					actual: undefined,
					severity: "critical",
					description: `Missing required mise tool pin: ${item.tool}`,
				});
				continue;
			}
			const actualVersion = actualMiseTools.get(item.tool);
			if (actualVersion !== item.version) {
				findings.push({
					path: `toolingPolicy.requiredMiseTools.${item.tool}`,
					expected: item.version,
					actual: actualVersion,
					severity: "warning",
					description: `Pinned version drift for ${item.tool}: ${String(actualVersion)} != ${item.version}`,
				});
			}
		}

		const actualActions = new Set(
			actual.toolingPolicy.codexEnvironment.requiredActions.map(
				(action) => `${action.name}|${action.icon}`,
			),
		);
		for (const action of base.toolingPolicy.codexEnvironment.requiredActions) {
			const actionKey = `${action.name}|${action.icon}`;
			if (!actualActions.has(actionKey)) {
				findings.push({
					path: "toolingPolicy.codexEnvironment.requiredActions",
					expected: actionKey,
					actual: undefined,
					severity: "warning",
					description: `Missing Codex action mapping: ${actionKey}`,
				});
			}
		}

		const actualTargets = new Set(
			actual.toolingPolicy.makefile.requiredTargets,
		);
		for (const target of base.toolingPolicy.makefile.requiredTargets) {
			if (!actualTargets.has(target)) {
				findings.push({
					path: "toolingPolicy.makefile.requiredTargets",
					expected: target,
					actual: undefined,
					severity: "warning",
					description: `Missing required Makefile target: ${target}`,
				});
			}
		}
	}

	return findings;
}

/**
 * Summarize scan results for reporting.
 */
export function summarizeResults(results: ScanResult[]): {
	total: number;
	success: number;
	errors: number;
	noContract: number;
	totalDrift: number;
	criticalDrift: number;
	warningDrift: number;
} {
	let totalDrift = 0;
	let criticalDrift = 0;
	let warningDrift = 0;

	for (const result of results) {
		if (result.drift) {
			totalDrift += result.drift.length;
			for (const finding of result.drift) {
				if (finding.severity === "critical") criticalDrift++;
				if (finding.severity === "warning") warningDrift++;
			}
		}
	}

	return {
		total: results.length,
		success: results.filter((r) => r.status === "success").length,
		errors: results.filter((r) => r.status === "error").length,
		noContract: results.filter((r) => r.status === "no-contract").length,
		totalDrift,
		criticalDrift,
		warningDrift,
	};
}
