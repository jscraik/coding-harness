import {
	resolveBlastRadiusRules,
	resolveChecks,
	summarizeBlastRadius,
} from "../lib/blast-radius/resolver.js";
import { ContractLoadError, loadContract } from "../lib/contract/loader.js";
import type {
	BlastRadiusRule,
	BlastRadiusRulesMode,
} from "../lib/contract/types.js";
import { DEFAULT_CONTRACT } from "../lib/contract/types.js";
import type { HarnessContract } from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	NO_FILES: 1,
	VALIDATION_ERROR: 2,
	SYSTEM_ERROR: 10,
} as const;

export interface BlastRadiusOptions {
	/** Comma-separated list of changed file paths */
	files: string[];
	/** Output as JSON */
	json?: boolean;
	/** Show detailed analysis */
	verbose?: boolean;
	/** Path to the harness.contract.json file */
	contractPath?: string;
}

export interface BlastRadiusOutput {
	/** Changed files analyzed */
	files: string[];
	/** Required checks */
	checks: string[];
	/** Whether default checks were used */
	usedDefaults: boolean;
	/** File-to-check mapping */
	fileChecks: Record<string, string[]>;
	/** Resolved rules mode from contract */
	rulesMode: BlastRadiusRulesMode;
	/** Rules used for this run */
	rules: BlastRadiusRule[];
}

export type BlastRadiusResult =
	| { ok: true; output: BlastRadiusOutput }
	| { ok: false; error: { code: string; message: string } };

/**
 * Run blast radius analysis.
 */
export function runBlastRadius(options: BlastRadiusOptions): BlastRadiusResult {
	try {
		if (options.files.length === 0) {
			return {
				ok: false,
				error: {
					code: "NO_FILES",
					message: "No files provided for analysis",
				},
			};
		}

		const contractPath = options.contractPath ?? "harness.contract.json";
		const explicitContract = options.contractPath !== undefined;

		let contract: HarnessContract;
		try {
			contract = loadContract(contractPath);
		} catch (error) {
			if (
				!explicitContract &&
				error instanceof Error &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				contract = { ...DEFAULT_CONTRACT };
			} else {
				throw error;
			}
		}

		const rules = resolveBlastRadiusRules(
			contract.blastRadiusRules,
			contract.blastRadiusRulesMode,
		);

		const { checks, fileChecks, useDefaults } = resolveChecks(
			options.files,
			rules,
		);

		const fileChecksRecord: Record<string, string[]> = {};
		for (const [file, fileChecksList] of fileChecks) {
			fileChecksRecord[file] = fileChecksList;
		}

		const output: BlastRadiusOutput = {
			files: options.files,
			checks,
			usedDefaults: useDefaults,
			fileChecks: fileChecksRecord,
			rulesMode: contract.blastRadiusRulesMode ?? "merge",
			rules,
		};

		return { ok: true, output };
	} catch (error) {
		if (error instanceof ContractLoadError) {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: sanitizeError(error),
				},
			};
		}
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: sanitizeError(error),
				},
			};
		}

		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: error instanceof Error ? error.message : "Unknown error",
			},
		};
	}
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export function runBlastRadiusCLI(options: BlastRadiusOptions): number {
	const result = runBlastRadius(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(`Error: ${result.error.message}`);
		}
		if (result.error.code === "VALIDATION_ERROR") {
			return EXIT_CODES.VALIDATION_ERROR;
		}
		return result.error.code === "NO_FILES"
			? EXIT_CODES.NO_FILES
			: EXIT_CODES.SYSTEM_ERROR;
	}

	const { output } = result;

	if (options.json) {
		console.info(JSON.stringify(output, null, 2));
	} else {
		if (options.verbose) {
			console.info(summarizeBlastRadius(output.files, output.rules));
		} else {
			console.info(`Changed files: ${output.files.length}`);
			console.info(`Required checks: ${output.checks.length}`);

			if (output.usedDefaults) {
				console.info("(using default checks)");
			}

			if (output.checks.length > 0) {
				console.info("");
				console.info("Checks:");
				for (const check of output.checks.sort()) {
					console.info(`  - ${check}`);
				}
			}
		}
	}

	return EXIT_CODES.SUCCESS;
}
