/**
 * License Gate Command
 *
 * Validates that a repository has a valid open-source license (MIT, Apache-2.0, etc.)
 * following the same architectural pattern as policy-gate and pr-template-gate.
 */

import {
	sanitizeError,
	sanitizePathForDisplay,
} from "../lib/input/sanitize.js";
import {
	type LicenseValidationResult,
	validateLicense,
} from "../lib/license/validator.js";

export const EXIT_CODES = {
	/** Success - valid license found */
	SUCCESS: 0,
	/** Policy violation - disallowed or invalid license */
	POLICY_VIOLATION: 1,
	/** Validation error - could not complete validation */
	VALIDATION_ERROR: 2,
	/** No license found */
	NO_LICENSE: 3,
	/** Disallowed license */
	DISALLOWED_LICENSE: 4,
} as const;

export interface LicenseGateOptions {
	/** Repository root directory */
	repoRoot?: string;
	/** Comma-separated list of allowed SPDX license IDs */
	allowedLicenses?: string[];
	/** Require OSI-approved licenses */
	requireOsiApproved?: boolean;
	/** Allow copyleft licenses */
	allowCopyleft?: boolean;
	/** Output as JSON */
	json?: boolean;
}

export interface LicenseGateResult {
	/** Whether the gate passed */
	ok: boolean;
	/** Exit code to use */
	exitCode: number;
	/** Validation result details */
	result: LicenseValidationResult;
}

const DEFAULT_ALLOWED_LICENSES = [
	"MIT",
	"Apache-2.0",
	"BSD-2-Clause",
	"BSD-3-Clause",
	"ISC",
];

/**
 * Run the license gate validation
 */
export function runLicenseGate(options: LicenseGateOptions): LicenseGateResult {
	const repoRoot = options.repoRoot ?? process.cwd();
	const allowedLicenses = options.allowedLicenses?.length
		? options.allowedLicenses
		: DEFAULT_ALLOWED_LICENSES;

	try {
		const validationOptions: {
			repoRoot: string;
			allowedLicenses: string[];
			requireOsiApproved?: boolean;
			allowCopyleft: boolean;
		} = {
			repoRoot,
			allowedLicenses,
			allowCopyleft: options.allowCopyleft ?? true,
		};
		if (options.requireOsiApproved !== undefined) {
			validationOptions.requireOsiApproved = options.requireOsiApproved;
		}
		const result = validateLicense(validationOptions);

		// Determine exit code
		let exitCode: number = EXIT_CODES.SUCCESS;
		if (!result.licenseFound) {
			exitCode = EXIT_CODES.NO_LICENSE;
		} else if (!result.allowed) {
			exitCode = EXIT_CODES.DISALLOWED_LICENSE;
		} else if (result.errors.length > 0) {
			exitCode = EXIT_CODES.POLICY_VIOLATION;
		}

		return {
			ok: Boolean(
				result.licenseFound && result.allowed && result.errors.length === 0,
			),
			exitCode,
			result,
		};
	} catch (error) {
		const sanitizedError = sanitizeError(error);
		return {
			ok: false,
			exitCode: EXIT_CODES.VALIDATION_ERROR,
			result: {
				licenseFound: false,
				confidence: "low",
				errors: [
					`Validation failed: ${sanitizePathForDisplay(sanitizedError)}`,
				],
			},
		};
	}
}

/**
 * Run the license gate CLI and exit with appropriate code
 */
export function runLicenseGateCLI(options: LicenseGateOptions): number {
	const gateResult = runLicenseGate(options);

	if (options.json) {
		// biome-ignore lint/suspicious/noConsoleLog: CLI output
		console.log(
			JSON.stringify(
				{
					ok: gateResult.ok,
					exitCode: gateResult.exitCode,
					license: gateResult.result.spdxId ?? null,
					licenseName: gateResult.result.licenseName ?? null,
					licenseFile: gateResult.result.licenseFile ?? null,
					osiApproved: gateResult.result.osiApproved ?? null,
					copyleft: gateResult.result.copyleft ?? null,
					confidence: gateResult.result.confidence,
					errors: gateResult.result.errors,
				},
				null,
				2,
			),
		);
	} else {
		if (gateResult.ok) {
			// biome-ignore lint/suspicious/noConsoleLog: CLI output
			console.log(
				`✓ License validated: ${gateResult.result.licenseName} (${gateResult.result.spdxId})`,
			);
			if (gateResult.result.licenseFile) {
				// biome-ignore lint/suspicious/noConsoleLog: CLI output
				console.log(`  Detected in: ${gateResult.result.licenseFile}`);
			}
			// biome-ignore lint/suspicious/noConsoleLog: CLI output
			console.log(
				`  OSI-approved: ${gateResult.result.osiApproved ? "Yes" : "No"}`,
			);
			// biome-ignore lint/suspicious/noConsoleLog: CLI output
			console.log(`  Copyleft: ${gateResult.result.copyleft ? "Yes" : "No"}`);
		} else {
			console.error("✗ License validation failed");
			for (const error of gateResult.result.errors) {
				console.error(`  - ${error}`);
			}
			if (gateResult.result.spdxId) {
				console.error(
					`\n  Detected: ${gateResult.result.licenseName} (${gateResult.result.spdxId})`,
				);
				console.error(
					`  OSI-approved: ${gateResult.result.osiApproved ? "Yes" : "No"}`,
				);
				console.error(
					`  Copyleft: ${gateResult.result.copyleft ? "Yes" : "No"}`,
				);
			}
		}
	}

	return gateResult.exitCode;
}
