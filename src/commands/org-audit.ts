/**
 * Org Audit Command - Multi-repo governance visibility and drift detection
 *
 * Commands:
 * - `harness org-audit --path ~/dev` - Scan all repos in directory
 * - `harness org-audit --drift-only --base ~/base.contract.json` - Detect drift (`--drift` alias supported)
 * - `harness org-audit --format json` - Output as JSON
 */

import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import type { HarnessContract } from "../lib/contract/types.js";
import {
	type ScanResult,
	scanRepositories,
	summarizeResults,
} from "../lib/governance/repo-scanner.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";
import { type CliResult, err, ok } from "../lib/result/types.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	NO_REPOS_FOUND: 1,
	SCAN_ERRORS: 2,
	DRIFT_DETECTED: 3,
	INVALID_ARGUMENT: 4,
} as const;

/**
 * Supported output formats for org-audit reports.
 */
export type OutputFormat = "json" | "markdown" | "table";

/**
 * Options accepted by `harness org-audit`.
 */
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

/**
 * Aggregated multi-repo org-audit results.
 */
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

function validatePathInput(
	rawPath: string,
	field: string,
): CliResult<{ absolutePath: string; safePath: string }> {
	const absolutePath = resolve(rawPath);
	try {
		const safePath = validatePath(dirname(absolutePath), absolutePath);
		return ok({ absolutePath, safePath });
	} catch (error) {
		if (error instanceof PathTraversalError) {
			return err({
				code: "VALIDATION_ERROR",
				message: `${field} contains an unsafe path traversal sequence`,
			});
		}
		return err({
			code: "VALIDATION_ERROR",
			message: `${field} is not a valid path`,
		});
	}
}

import { findRepositories } from "../lib/org/repositories.js";

/**
 * Run the org audit and return results.
 *
 * Uses Result types for explicit error handling.
 */
export async function runOrgAudit(
	options: OrgAuditOptions,
): Promise<CliResult<{ result: OrgAuditResult; exitCode: number }>> {
	// Validate path parameter
	const pathValidation = validatePathInput(options.path, "path");
	if (!pathValidation.ok) {
		return err(pathValidation.error);
	}
	const validatedPath = pathValidation.value.safePath;

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

function formatRepoScanError(repoResult: ScanResult): string {
	if (repoResult.error) {
		return repoResult.error;
	}
	if (repoResult.errors && repoResult.errors.length > 0) {
		return repoResult.errors.join("; ");
	}
	return "Unknown error";
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
				lines.push(
					`- **${repoResult.path}**: ${formatRepoScanError(repoResult)}`,
				);
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
				lines.push(`❌ ${repoResult.path}: ${formatRepoScanError(repoResult)}`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Parse org-audit CLI arguments into structured options.
 */
function parseOrgAuditArgs(args: string[]):
	| {
			ok: true;
			path?: string;
			base?: string;
			format?: string;
			driftOnly: boolean;
			includeMissing: boolean;
			noCache: boolean;
			json: boolean;
	  }
	| {
			ok: false;
			exitCode: number;
			message: string;
	  } {
	const flagsWithValues = new Set(["--path", "--base", "--format"]);
	const booleanFlags = new Set([
		"--drift-only",
		"--drift",
		"--include-missing",
		"--no-cache",
		"--json",
	]);
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (!arg) {
			continue;
		}
		if (!arg.startsWith("-")) {
			return {
				ok: false,
				exitCode: EXIT_CODES.INVALID_ARGUMENT,
				message: `Unexpected positional argument '${arg}'`,
			};
		}
		if (flagsWithValues.has(arg)) {
			const next = args[i + 1];
			if (!next || next.startsWith("-")) {
				return {
					ok: false,
					exitCode: EXIT_CODES.INVALID_ARGUMENT,
					message: `${arg} requires a value`,
				};
			}
			i += 1;
			continue;
		}
		if (booleanFlags.has(arg)) {
			continue;
		}
		return {
			ok: false,
			exitCode: EXIT_CODES.INVALID_ARGUMENT,
			message: `Unknown flag '${arg}'`,
		};
	}

	const pathIndex = args.indexOf("--path");
	const baseIndex = args.indexOf("--base");
	const formatIndex = args.indexOf("--format");

	const parsed: {
		ok: true;
		path?: string;
		base?: string;
		format?: string;
		driftOnly: boolean;
		includeMissing: boolean;
		noCache: boolean;
		json: boolean;
	} = {
		ok: true,
		driftOnly: args.includes("--drift-only") || args.includes("--drift"),
		includeMissing: args.includes("--include-missing"),
		noCache: args.includes("--no-cache"),
		json: args.includes("--json"),
	};
	const pathArg = pathIndex !== -1 ? args[pathIndex + 1] : undefined;
	const baseArg = baseIndex !== -1 ? args[baseIndex + 1] : undefined;
	const formatArg = formatIndex !== -1 ? args[formatIndex + 1] : undefined;
	if (pathArg !== undefined) parsed.path = pathArg;
	if (baseArg !== undefined) parsed.base = baseArg;
	if (formatArg !== undefined) parsed.format = formatArg;
	return parsed;
}

/**
 * Resolve and validate the scan path for org-audit.
 */
function resolveScanPath(scanPath: string | undefined): CliResult<string> {
	const resolvedScanPath = scanPath ?? process.cwd();
	const validation = validatePathInput(resolvedScanPath, "--path");
	if (!validation.ok) {
		return validation;
	}
	const absolutePath = validation.value.absolutePath;

	if (!existsSync(absolutePath)) {
		return err({
			code: "VALIDATION_ERROR",
			message: `Path does not exist: ${absolutePath}`,
		});
	}
	const stats = statSync(absolutePath);
	if (!stats.isDirectory()) {
		return err({
			code: "VALIDATION_ERROR",
			message: `Path is not a directory: ${absolutePath}`,
		});
	}
	return ok(absolutePath);
}

/**
 * Load base contract from CLI argument.
 */
function loadBaseContractArg(
	basePath: string | undefined,
): CliResult<HarnessContract | undefined> {
	if (!basePath) {
		return ok(undefined);
	}
	const validation = validatePathInput(basePath, "--base");
	if (!validation.ok) {
		return err(validation.error);
	}
	const resolvedBasePath = validation.value.safePath;
	try {
		const contract = loadContract(resolvedBasePath, dirname(resolvedBasePath));
		return ok(contract);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return err({
			code: "VALIDATION_ERROR",
			message: `Error loading base contract: ${message}`,
		});
	}
}

/**
 * Determine output format from CLI flags.
 */
function resolveOutputFormat(
	jsonFlag: boolean,
	formatArg: string | undefined,
): OutputFormat {
	if (jsonFlag || formatArg) {
		const resolved = jsonFlag ? "json" : formatArg;
		if (
			resolved === "json" ||
			resolved === "markdown" ||
			resolved === "table"
		) {
			return resolved;
		}
	}
	return "table";
}

/**
 * Run the org-audit CLI command.
 */
export async function runOrgAuditCLI(args: string[]): Promise<{
	exitCode: number;
	output?: string;
}> {
	const parsed = parseOrgAuditArgs(args);
	if (!parsed.ok) {
		console.error(`Error: ${parsed.message}`);
		return { exitCode: parsed.exitCode };
	}

	const scanPathResult = resolveScanPath(parsed.path);
	if (!scanPathResult.ok) {
		console.error(`Error: ${scanPathResult.error.message}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}
	const scanPath = scanPathResult.value;

	const baseContractResult = loadBaseContractArg(parsed.base);
	if (!baseContractResult.ok) {
		console.error(`Error: ${baseContractResult.error.message}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}
	const baseContract = baseContractResult.value;

	const format = resolveOutputFormat(parsed.json, parsed.format);

	if (format === "table") {
		console.info(`Scanning for repositories in: ${scanPath}`);
		console.info("");
	}

	const auditResult = await runOrgAudit({
		path: scanPath,
		baseContract,
		format,
		includeMissing: parsed.includeMissing,
		driftOnly: parsed.driftOnly,
		useCache: !parsed.noCache,
	});

	if (!auditResult.ok) {
		console.error(`Error: ${auditResult.error.message}`);
		return { exitCode: EXIT_CODES.INVALID_ARGUMENT };
	}

	const { result, exitCode } = auditResult.value;

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

	console.info(output);

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
