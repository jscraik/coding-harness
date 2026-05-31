import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import { validateBrowserEvidenceManifest } from "../lib/browser-evidence/index.js";
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

/** Options for evidence file and browser evidence manifest verification. */
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
	/** Browser evidence manifest to validate with browser-specific policy checks */
	browserEvidence?: string | undefined;
	/** Required viewport IDs for browser evidence coverage */
	browserRequiredViewports?: string[] | undefined;
}

type EvidencePolicyLoadResult =
	| { ok: true; policy?: EvidencePolicy }
	| { ok: false; error: { code: string; message: string } };

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

function verifyBrowserEvidence(
	options: EvidenceVerifyOptions,
	baseDir: string,
): EvidenceVerifyOutput["browserEvidence"] {
	if (!options.browserEvidence) return undefined;
	return validateBrowserEvidenceManifest({
		manifestPath: options.browserEvidence,
		baseDir,
		...(options.browserRequiredViewports
			? { requiredViewportIds: options.browserRequiredViewports }
			: {}),
	});
}

function loadEvidencePolicy(
	options: EvidenceVerifyOptions,
	baseDir: string,
): EvidencePolicyLoadResult {
	if (!options.contract) return { ok: true };
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
	try {
		const contract = loadContract(contractPath, baseDir);
		return contract.evidencePolicy
			? { ok: true, policy: contract.evidencePolicy }
			: { ok: true };
	} catch (e) {
		return {
			ok: false,
			error: { code: "VALIDATION_ERROR", message: sanitizeError(e) },
		};
	}
}

function verifyEvidenceFiles(
	options: EvidenceVerifyOptions,
	baseDir: string,
	maxFileSizeBytes: number,
): { verifiedFiles: EvidenceFile[]; errors: EvidenceError[] } {
	const verifiedFiles: EvidenceFile[] = [];
	const errors: EvidenceError[] = [];
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
	return { verifiedFiles, errors };
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
	const policyResult = loadEvidencePolicy(options, baseDir);
	if (!policyResult.ok) return policyResult;
	const { verifiedFiles, errors } = verifyEvidenceFiles(
		options,
		baseDir,
		maxFileSizeBytes,
	);

	// Apply evidence policy if we have both policy and changed files
	if (policyResult.policy && options.changed && options.changed.length > 0) {
		const evidencePolicyResult = enforceEvidencePolicy(
			verifiedFiles,
			options.changed,
			policyResult.policy,
		);

		// Add policy violations to errors
		if (!evidencePolicyResult.passed) {
			errors.push(...evidencePolicyResult.violations);
		}
	}

	const output: EvidenceVerifyOutput = {
		verified: verifiedFiles.length,
		failed: errors.length,
		files: verifiedFiles,
		errors,
	};
	const browserEvidence = verifyBrowserEvidence(options, baseDir);
	if (browserEvidence) {
		output.browserEvidence = browserEvidence;
		if (!browserEvidence.passed) {
			output.failed += browserEvidence.errors.length;
		}
	}

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
				for (const error of output.browserEvidence?.errors ?? []) {
					console.error(
						`  ✗ ${error.path ?? output.browserEvidence?.manifestPath}: ${error.message}`,
					);
				}
			}

			if (output.verified > 0 && output.failed === 0) {
				console.info("All evidence files verified successfully.");
			}
		}

		const fileExitCode = getWorstExitCode(output.errors);
		if (output.browserEvidence && !output.browserEvidence.passed) {
			return fileExitCode === EXIT_CODES.SUCCESS
				? EXIT_CODES.VALIDATION_ERROR
				: fileExitCode;
		}
		return fileExitCode;
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
