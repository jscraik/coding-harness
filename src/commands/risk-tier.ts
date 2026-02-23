import { ContractLoadError, loadContract } from "../lib/contract/loader.js";
import type { RiskTier } from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { createResolver, resolveOverallTier } from "../lib/policy/risk-tier.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	FILE_NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	SYSTEM_ERROR: 10,
} as const;

export interface RiskTierOptions {
	contractPath: string;
	files: string[];
	json?: boolean;
}

export interface RiskTierOutput {
	tier: RiskTier;
	filesAnalyzed: number;
	fileTiers: Record<string, RiskTier>;
}

export interface RiskTierErrorOutput {
	code: string;
	message: string;
	details?: unknown;
}

export type RiskTierResult =
	| { ok: true; output: RiskTierOutput }
	| { ok: false; error: RiskTierErrorOutput };

/**
 * Run risk-tier analysis and return structured result.
 * This function is usable as a library (does not output to console).
 */
export function runRiskTier(options: RiskTierOptions): RiskTierResult {
	try {
		const contract = loadContract(options.contractPath);
		const resolve = createResolver(contract.riskTierRules);
		const fileTiers = Object.fromEntries(
			options.files.map((f) => [f, resolve(f)]),
		);
		const tier = resolveOverallTier(options.files, contract);

		return {
			ok: true,
			output: {
				tier,
				filesAnalyzed: options.files.length,
				fileTiers,
			},
		};
	} catch (e) {
		if (e instanceof ContractLoadError) {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: sanitizeError(e),
					details: e.errors,
				},
			};
		}
		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: sanitizeError(e),
			},
		};
	}
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export function runRiskTierCLI(options: RiskTierOptions): number {
	const result = runRiskTier(options);

	if (result.ok) {
		if (options.json) {
			console.info(JSON.stringify(result.output));
		} else {
			console.info(`Risk Tier: ${result.output.tier}`);
			console.info(`Files analyzed: ${result.output.filesAnalyzed}`);
		}
		return EXIT_CODES.SUCCESS;
	}

	// Error output always to stderr
	console.error(result.error.message);
	if (options.json) {
		console.error(JSON.stringify({ error: result.error }));
	}

	// Map error codes to exit codes
	if (result.error.code === "VALIDATION_ERROR") {
		return EXIT_CODES.VALIDATION_ERROR;
	}
	return EXIT_CODES.SYSTEM_ERROR;
}
