/**
 * Org Audit Command - Multi-repo governance visibility and drift detection
 *
 * Commands:
 * - `harness org-audit --path ~/dev` - Scan all repos in directory
 * - `harness org-audit --drift --base ~/base.contract.json` - Detect drift
 * - `harness org-audit --format json` - Output as JSON
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import type { HarnessContract } from "../lib/contract/types.js";
import {
	type ScanResult,
	scanRepositories,
	summarizeResults,
} from "../lib/governance/repo-scanner.js";
import {
	validatePathComponent,
	validateSafeArgument,
} from "../lib/input/validation.js";
import { type CliResult, err, ok } from "../lib/result/types.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	NO_REPOS_FOUND: 1,
	SCAN_ERRORS: 2,
	DRIFT_DETECTED: 3,
	INVALID_ARGUMENT: 4,
} as const;

export type OutputFormat = "json" | "markdown" | "table";

export interface OrgAuditOptions {
	/** Path to scan (directory containing repos) */
	path: string;
	/** Base contract for drift detection */
	baseContract?: HarnessContract | undefined;
	/** Output format */
	format: OutputFormat;
	/** Include repos without contracts */
	includeMissing?: boolean | undefined;
	/** Show only repos with drift */
	driftOnly?: boolean | undefined;
	/** Enable caching for repeated scans (default: true) */
	useCache?: boolean | undefined;
}

export interface OrgAuditResult {
	/** Total repositories scanned */
	totalRepos: number;
	/** Repositories with valid contracts */
	validContracts: number;
	/** Repositories with errors */
	errors: number;
	/** Repositories without contracts */
	noContract: number;
	/** Detailed scan results */
	results: ScanResult[];
	/** Summary statistics */
	summary: {
		totalDrift: number;
		criticalDrift: number;
		warningDrift: number;
		infoDrift: number;
	};
}

/**
 * Find git repositories in a directory.
 *
 * Looks for directories containing a .git folder.
 */
export function findRepositories(basePath: string): string[] {
	const repos: string[] = [];

	if (!existsSync(basePath)) {
		return repos;
	}

	const entries = readdirSync(basePath, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const fullPath = join(basePath, entry.name);
			const gitPath = join(fullPath, ".git");

			if (existsSync(gitPath)) {
				repos.push(fullPath);
			}
		}
	}

	return repos;
}

/**
 * Run the org audit and return results.
 *
 * Uses Result types for explicit error handling.
 */
export async function runOrgAudit(
	options: OrgAuditOptions,
): Promise<CliResult<{ result: OrgAuditResult; exitCode: number }>> {
	// Validate path parameter
	const pathValidation = validateSafeArgument(options.path, "path");
	if (!pathValidation.ok) {
		return err(pathValidation.error);
	}
	const validatedPath = pathValidation.value;

	// Find repositories
	const repos = findRepositories(validatedPath);

	if (repos.length === 0) {
		return ok({
			result: {
				totalRepos: 0,
				validContracts: 0,
				errors: 0,
				noContract: 0,
				results: [],
				summary: {
					totalDrift: 0,
					criticalDrift: 0,
					warningDrift: 0,
					infoDrift: 0,
				},
			},
			exitCode: EXIT_CODES.NO_REPOS_FOUND,
		});
	}

	// Scan repositories
	const results = await scanRepositories(repos, {
		baseContract: options.baseContract,
		includeMissing: options.includeMissing,
		useCache: options.useCache,
	});

	// Filter for drift-only if requested
	const filteredResults = options.driftOnly
		? results.filter((r) => r.drift && r.drift.length > 0)
		: results;

	// Calculate summary
	const summary = summarizeResults(results);
	const infoDrift =
		summary.totalDrift - summary.criticalDrift - summary.warningDrift;

	const result: OrgAuditResult = {
		totalRepos: repos.length,
		validContracts: summary.success,
		errors: summary.errors,
		noContract: summary.noContract,
		results: filteredResults,
		summary: {
			totalDrift: summary.totalDrift,
			criticalDrift: summary.criticalDrift,
			warningDrift: summary.warningDrift,
			infoDrift,
		},
	};

	// Determine exit code
	let exitCode: number = EXIT_CODES.SUCCESS;
	if (summary.errors > 0) {
		exitCode = EXIT_CODES.SCAN_ERRORS;
	} else if (summary.criticalDrift > 0 || summary.warningDrift > 0) {
		exitCode = EXIT_CODES.DRIFT_DETECTED;
	}

	return ok({ result, exitCode });
}

/**
 * Format results as JSON.
 */
function formatJson(result: OrgAuditResult): string {
	return JSON.stringify(result, null, 2);
}

/**
 * Format results as Markdown table.
 */
function formatMarkdown(result: OrgAuditResult): string {
	const lines: string[] = [];

	lines.push("# Org Audit Report");
	lines.push("");
	lines.push("## Summary");
	lines.push("");
	lines.push(`- **Total Repositories**: ${result.totalRepos}`);
	lines.push(`- **Valid Contracts**: ${result.validContracts}`);
	lines.push(`- **Errors**: ${result.errors}`);
	lines.push(`- **No Contract**: ${result.noContract}`);
	lines.push("");

	if (result.summary.totalDrift > 0) {
		lines.push("## Drift Summary");
		lines.push("");
		lines.push(`- **Total Drift Findings**: ${result.summary.totalDrift}`);
		lines.push(`- **Critical**: ${result.summary.criticalDrift}`);
		lines.push(`- **Warning**: ${result.summary.warningDrift}`);
		lines.push(`- **Info**: ${result.summary.infoDrift}`);
		lines.push("");

		lines.push("## Drift Details");
		lines.push("");

		for (const repoResult of result.results) {
			if (repoResult.drift && repoResult.drift.length > 0) {
				lines.push(`### ${repoResult.path}`);
				lines.push("");
				lines.push("| Severity | Path | Description |");
				lines.push("|----------|------|-------------|");

				for (const finding of repoResult.drift) {
					const severity = finding.severity.toUpperCase();
					lines.push(
						`| ${severity} | ${finding.path} | ${finding.description} |`,
					);
				}
				lines.push("");
			}
		}
	}

	if (result.errors > 0) {
		lines.push("## Errors");
		lines.push("");

		for (const repoResult of result.results) {
			if (repoResult.status === "error") {
				lines.push(`- **${repoResult.path}**: ${repoResult.error}`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Format results as a table (console output).
 */
function formatTable(result: OrgAuditResult): string {
	const lines: string[] = [];

	lines.push("Org Audit Report");
	lines.push("================");
	lines.push("");
	lines.push(`Total Repositories: ${result.totalRepos}`);
	lines.push(`Valid Contracts: ${result.validContracts}`);
	lines.push(`Errors: ${result.errors}`);
	lines.push(`No Contract: ${result.noContract}`);
	lines.push("");

	if (result.summary.totalDrift > 0) {
		lines.push("Drift Summary");
		lines.push("-------------");
		lines.push(`Total: ${result.summary.totalDrift}`);
		lines.push(`Critical: ${result.summary.criticalDrift}`);
		lines.push(`Warning: ${result.summary.warningDrift}`);
		lines.push(`Info: ${result.summary.infoDrift}`);
		lines.push("");

		lines.push("Drift Details");
		lines.push("-------------");
		lines.push("");

		for (const repoResult of result.results) {
			if (repoResult.drift && repoResult.drift.length > 0) {
				lines.push(`${repoResult.path}:`);
				for (const finding of repoResult.drift) {
					const icon =
						finding.severity === "critical"
							? "❌"
							: finding.severity === "warning"
								? "⚠️"
								: "ℹ️";
					lines.push(`  ${icon} [${finding.severity}] ${finding.description}`);
				}
				lines.push("");
			}
		}
	}

	if (result.errors > 0) {
		lines.push("Errors");
		lines.push("------");
		lines.push("");

		for (const repoResult of result.results) {
			if (repoResult.status === "error") {
				lines.push(`❌ ${repoResult.path}: ${repoResult.error}`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Run the org-audit CLI command.
 */
export async function runOrgAuditCLI(args: string[]): Promise<{
	exitCode: number;
	output?: string;
}> {
	// Parse arguments
	const pathIndex = args.indexOf("--path");
	const baseIndex = args.indexOf("--base");
	const formatIndex = args.indexOf("--format");
	const driftOnlyFlag = args.includes("--drift-only");
	const includeMissingFlag = args.includes("--include-missing");
	const noCacheFlag = args.includes("--no-cache");
	const jsonFlag = args.includes("--json");

	// Get path (required)
	let scanPath: string | undefined;
	if (pathIndex !== -1) {
		scanPath = args[pathIndex + 1];
	}

	// Default to current directory if not specified
	if (!scanPath) {
		scanPath = process.cwd();
	}

	// Resolve to absolute path
	scanPath = resolve(scanPath);

	// Load base contract if specified
	let baseContract: HarnessContract | undefined;
	if (baseIndex !== -1) {
		const rawBasePath = args[baseIndex + 1];
		if (!rawBasePath) {
			console.error("Error: --base requires a path argument");
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
		// Validate base contract path (prevent path traversal)
		const pathValidation = validatePathComponent(
			basename(rawBasePath),
			undefined,
			"base contract path",
		);
		if (!pathValidation.ok) {
			console.error(`Error: ${pathValidation.error.message}`);
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
		try {
			baseContract = loadContract(rawBasePath);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(`Error loading base contract: ${message}`);
			return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
		}
	}

	// Determine output format
	let format: OutputFormat = "table";
	if (jsonFlag || formatIndex !== -1) {
		const formatArg = jsonFlag ? "json" : args[formatIndex + 1];
		if (
			formatArg === "json" ||
			formatArg === "markdown" ||
			formatArg === "table"
		) {
			format = formatArg;
		}
	}

	// Check if path exists
	if (!existsSync(scanPath)) {
		console.error(`Error: Path does not exist: ${scanPath}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}

	// Check if path is a directory
	const stats = statSync(scanPath);
	if (!stats.isDirectory()) {
		console.error(`Error: Path is not a directory: ${scanPath}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}

	// Show progress
	if (format === "table") {
		console.info(`Scanning for repositories in: ${scanPath}`);
		console.info("");
	}

	// Run audit
	const auditResult = await runOrgAudit({
		path: scanPath,
		baseContract,
		format,
		includeMissing: includeMissingFlag,
		driftOnly: driftOnlyFlag,
		useCache: !noCacheFlag,
	});

	if (!auditResult.ok) {
		console.error(`Error: ${auditResult.error.message}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}

	const { result, exitCode } = auditResult.value;

	// Format output
	let output: string;
	switch (format) {
		case "json":
			output = formatJson(result);
			break;
		case "markdown":
			output = formatMarkdown(result);
			break;
		default:
			output = formatTable(result);
			break;
	}

	// Print output
	console.info(output);

	// Print summary for table format
	if (format === "table") {
		console.info("");
		if (exitCode === EXIT_CODES.SUCCESS) {
			console.info("✅ All repositories compliant");
		} else if (exitCode === EXIT_CODES.DRIFT_DETECTED) {
			console.info("⚠️  Policy drift detected");
		} else if (exitCode === EXIT_CODES.SCAN_ERRORS) {
			console.info("❌ Errors encountered during scan");
		} else if (exitCode === EXIT_CODES.NO_REPOS_FOUND) {
			console.info("ℹ️  No repositories found");
		}
	}

	return { exitCode, output };
}
