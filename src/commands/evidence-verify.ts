import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import type { EvidencePolicy } from "../lib/contract/types.js";
import type {
	EvidenceError,
	EvidenceFile,
	EvidenceVerifyOutput,
	EvidenceVerifyResult,
} from "../lib/evidence/index.js";
import { loadEvidenceFile } from "../lib/evidence/index.js";
import { DEFAULT_MAX_FILE_SIZE_BYTES } from "../lib/evidence/index.js";
import { logger } from "../lib/evidence/logger.js";
import { enforceEvidencePolicy } from "../lib/evidence/policy.js";
import { sanitizeError } from "../lib/input/sanitize.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	FILE_NOT_FOUND: 2,
	PATH_TRAVERSAL: 3,
	SYSTEM_ERROR: 10,
} as const;

export interface EvidenceVerifyOptions {
	/** Comma-separated list of file paths to verify */
	files: string[];
	/** Path to contract file for policy-gated verification */
	contract?: string | undefined;
	/** Output as JSON */
	json?: boolean | undefined;
	/** Base directory for path resolution (defaults to cwd) */
	baseDir?: string | undefined;
	/** Maximum file size in bytes (defaults to 1MB) */
	maxFileSizeBytes?: number | undefined;
	/** Changed files to check against evidence policy (e.g., --changed src/ui/**.tsx) */
	changed?: string[] | undefined;
}

/**
 * Determine the most severe exit code from multiple errors.
 */
function getWorstExitCode(errors: EvidenceError[]): number {
	if (errors.length === 0) {
		return EXIT_CODES.SUCCESS;
	}

	// Priority: PATH_TRAVERSAL > FILE_NOT_FOUND > VALIDATION_ERROR
	for (const error of errors) {
		if (error.code === "PATH_TRAVERSAL") {
			return EXIT_CODES.PATH_TRAVERSAL;
		}
	}
	for (const error of errors) {
		if (error.code === "FILE_NOT_FOUND") {
			return EXIT_CODES.FILE_NOT_FOUND;
		}
	}
	return EXIT_CODES.VALIDATION_ERROR;
}

/**
 * Verify evidence files and return structured result.
 * This function is usable as a library (does not output to console).
 *
 * @param options - Verification options
 * @returns EvidenceVerifyResult with output or error
 */
export function runEvidenceVerify(
	options: EvidenceVerifyOptions,
): EvidenceVerifyResult {
	const baseDir = options.baseDir ?? process.cwd();
	const maxFileSizeBytes =
		options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
	const verifiedFiles: EvidenceFile[] = [];
	const errors: EvidenceError[] = [];

	// Load contract and evidence policy if provided
	let evidencePolicy: EvidencePolicy | undefined;
	if (options.contract) {
		const contractPath = resolve(baseDir, options.contract);
		if (!existsSync(contractPath)) {
			return {
				ok: false,
				error: {
					code: "FILE_NOT_FOUND",
					message: `Contract file not found: ${options.contract}`,
				},
			};
		}

		// Load and validate contract
		try {
			const contract = loadContract(contractPath);
			evidencePolicy = contract.evidencePolicy;
		} catch (e) {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: sanitizeError(e),
				},
			};
		}
	}

	// Verify each evidence file
	for (const filePath of options.files) {
		logger.debug("Verifying evidence file", { file: filePath });
		const result = loadEvidenceFile(filePath, baseDir, maxFileSizeBytes);

		if (result.ok) {
			logger.debug("Evidence file verified", {
				file: filePath,
				type: result.file.type,
				sizeBytes: result.file.sizeBytes,
			});
			verifiedFiles.push(result.file);
		} else {
			logger.warn("Evidence file failed verification", {
				file: filePath,
				code: result.code,
				message: result.message,
			});
			errors.push(result);
		}
	}

	// Apply evidence policy if we have both policy and changed files
	if (evidencePolicy && options.changed && options.changed.length > 0) {
		const policyResult = enforceEvidencePolicy(
			verifiedFiles,
			options.changed,
			evidencePolicy,
		);

		// Add policy violations to errors
		if (!policyResult.passed) {
			errors.push(...policyResult.violations);
		}
	}

	const output: EvidenceVerifyOutput = {
		verified: verifiedFiles.length,
		failed: errors.length,
		files: verifiedFiles,
		errors,
	};

	logger.debug("Evidence verification complete", {
		verified: output.verified,
		failed: output.failed,
	});

	return { ok: true, output };
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export function runEvidenceVerifyCLI(options: EvidenceVerifyOptions): number {
	const result = runEvidenceVerify(options);

	if (result.ok) {
		const { output } = result;

		if (options.json) {
			console.info(JSON.stringify(output, null, 2));
		} else {
			// Human-readable output
			if (output.verified > 0) {
				console.info(`Verified ${output.verified} evidence file(s):`);
				for (const file of output.files) {
					console.info(
						`  ✓ ${file.path} (${file.type}, ${file.sizeBytes} bytes)`,
					);
				}
			}

			if (output.failed > 0) {
				console.error(`Failed to verify ${output.failed} file(s):`);
				for (const error of output.errors) {
					console.error(`  ✗ ${error.path}: ${error.message}`);
				}
			}

			if (output.verified > 0 && output.failed === 0) {
				console.info("All evidence files verified successfully.");
			}
		}

		// Return worst exit code from errors
		return getWorstExitCode(output.errors);
	}

	// Command-level error
	console.error(result.error.message);
	if (options.json) {
		console.error(JSON.stringify({ error: result.error }, null, 2));
	}

	// Map error code to exit code
	if (result.error.code === "FILE_NOT_FOUND") {
		return EXIT_CODES.FILE_NOT_FOUND;
	}
	if (result.error.code === "VALIDATION_ERROR") {
		return EXIT_CODES.VALIDATION_ERROR;
	}
	return EXIT_CODES.SYSTEM_ERROR;
}
