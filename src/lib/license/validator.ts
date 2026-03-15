/**
 * License validation logic
 *
 * Detects and validates open-source licenses from package.json or LICENSE files.
 * Implements security hardening: path traversal prevention, file size limits.
 */

import { readFileSync, statSync } from "node:fs";

import { resolve } from "node:path";
import {
	ALL_LICENSES,
	type SpdxLicense,
	getLicenseBySpdxId,
	isLicenseAllowed,
} from "./spdx.js";

/** Maximum file size to read (100KB) - prevents ReDoS on malicious files */
const MAX_FILE_SIZE = 100_000;

/** License file names to check */
export const LICENSE_FILE_NAMES = [
	"LICENSE",
	"LICENSE.md",
	"LICENSE.txt",
	"LICENSE-MIT",
	"LICENSE-APACHE",
	"COPYING",
	"COPYING.md",
];

/** Package.json license field names to check */
const PACKAGE_JSON_LICENSE_FIELDS = ["license", "licenses"];

export interface LicenseValidationOptions {
	/** Repository root directory */
	repoRoot: string;
	/** List of allowed SPDX license IDs */
	allowedLicenses: string[];
	/** Require OSI-approved licenses */
	requireOsiApproved?: boolean;
	/** Allow copyleft licenses (default: true) */
	allowCopyleft?: boolean;
}

export type LicenseConfidence = "high" | "medium" | "low";

export interface LicenseValidationResult {
	/** Whether any license was found */
	licenseFound: boolean;
	/** Detected SPDX ID */
	spdxId?: string;
	/** Human-readable license name */
	licenseName?: string;
	/** Path to the license file (if detected from file) */
	licenseFile?: string;
	/** Detection confidence level */
	confidence: LicenseConfidence;
	/** Whether the license is OSI-approved */
	osiApproved?: boolean;
	/** Whether the license is copyleft */
	copyleft?: boolean;
	/** Whether the license is in the allowed list */
	allowed?: boolean;
	/** Error messages */
	errors: string[];
}

/**
 * Normalize a path to prevent directory traversal attacks
 */
function normalizePath(input: string, cwd: string): string {
	const resolved = resolve(cwd, input);
	if (!resolved.startsWith(cwd)) {
		throw new Error("Path traversal detected");
	}
	return resolved;
}

/**
 * Sanitize a path for display in error messages
 */
function sanitizePathForDisplay(input: string): string {
	return input.replace(/[^\w\-./]/g, "?");
}

/**
 * Read a file with safety limits
 */
function safeReadFile(path: string): string | undefined {
	try {
		const stats = statSync(path);
		if (stats.size > MAX_FILE_SIZE) {
			return undefined;
		}
		return readFileSync(path, { encoding: "utf-8" });
	} catch {
		return undefined;
	}
}

/**
 * Detect license from package.json content
 */
function detectLicenseFromPackageJson(content: string): {
	spdxId?: string;
	confidence: LicenseConfidence;
} {
	try {
		const pkg = JSON.parse(content) as Record<string, unknown>;

		// Check license field (string or object)
		for (const field of PACKAGE_JSON_LICENSE_FIELDS) {
			const value = pkg[field];
			if (typeof value === "string") {
				const license = getLicenseBySpdxId(value);
				if (license) {
					return { spdxId: license.spdxId, confidence: "high" };
				}
				// Try to match against aliases
				const normalized = value.toLowerCase().trim();
				const matched = getLicenseBySpdxId(normalized);
				if (matched) {
					return { spdxId: matched.spdxId, confidence: "high" };
				}
			}
			// Handle array of licenses
			if (Array.isArray(value)) {
				for (const item of value) {
					if (typeof item === "string") {
						const license = getLicenseBySpdxId(item);
						if (license) {
							return { spdxId: license.spdxId, confidence: "high" };
						}
					}
					if (
						typeof item === "object" &&
						item !== null &&
						"type" in item &&
						typeof item.type === "string"
					) {
						const license = getLicenseBySpdxId(item.type);
						if (license) {
							return { spdxId: license.spdxId, confidence: "high" };
						}
					}
				}
			}
		}
	} catch {
		// Invalid JSON, fall through
	}

	return { confidence: "low" };
}

/**
 * Detect license from LICENSE file content using pattern matching
 */
function detectLicenseFromFile(content: string): {
	spdxId?: string;
	confidence: LicenseConfidence;
} {
	const contentLower = content.toLowerCase();

	// Try exact pattern matches first
	for (const license of ALL_LICENSES) {
		for (const pattern of license.patterns) {
			if (contentLower.includes(pattern.toLowerCase())) {
				return { spdxId: license.spdxId, confidence: "high" };
			}
		}
	}

	// Fallback to SPDX ID detection in text
	const spdxMatch = content.match(/SPDX-License-Identifier:\s*([\w\-.]+)/i);
	const spdxIdentifier = spdxMatch?.[1];
	if (spdxIdentifier) {
		const detected = getLicenseBySpdxId(spdxIdentifier);
		if (detected) {
			return { spdxId: detected.spdxId, confidence: "high" };
		}
	}

	// Try keyword detection
	const keywords = [
		{
			spdxId: "MIT",
			keywords: ["mit license", "permission is hereby granted"],
		},
		{ spdxId: "Apache-2.0", keywords: ["apache license", "version 2.0"] },
		{
			spdxId: "GPL-3.0",
			keywords: ["gnu general public license", "version 3"],
		},
		{
			spdxId: "GPL-2.0",
			keywords: ["gnu general public license", "version 2"],
		},
		{
			spdxId: "BSD-3-Clause",
			keywords: ["bsd 3-clause", "redistribution and use"],
		},
		{ spdxId: "BSD-2-Clause", keywords: ["bsd 2-clause"] },
		{ spdxId: "ISC", keywords: ["isc license"] },
	];

	for (const { spdxId, keywords: kw } of keywords) {
		if (kw.some((k) => contentLower.includes(k))) {
			return { spdxId, confidence: "medium" };
		}
	}

	return { confidence: "low" };
}

/**
 * Validate license in a repository
 */
export function validateLicense(
	options: LicenseValidationOptions,
): LicenseValidationResult {
	const errors: string[] = [];
	let detectedLicense: SpdxLicense | undefined;
	let licenseFile: string | undefined;
	let confidence: LicenseConfidence = "low";

	try {
		const normalizedRoot = resolve(options.repoRoot);

		// First, try to detect from package.json
		const packageJsonPath = normalizePath("package.json", normalizedRoot);
		const packageContent = safeReadFile(packageJsonPath);
		if (packageContent) {
			const detection = detectLicenseFromPackageJson(packageContent);
			if (detection.spdxId) {
				detectedLicense = getLicenseBySpdxId(detection.spdxId);
				confidence = detection.confidence;
			}
		}

		// If not found in package.json, check LICENSE files
		if (!detectedLicense) {
			for (const fileName of LICENSE_FILE_NAMES) {
				const filePath = normalizePath(fileName, normalizedRoot);
				const content = safeReadFile(filePath);
				if (content) {
					const detection = detectLicenseFromFile(content);
					if (detection.spdxId) {
						detectedLicense = getLicenseBySpdxId(detection.spdxId);
						licenseFile = fileName;
						confidence = detection.confidence;
						break;
					}
				}
			}
		}
	} catch (error) {
		const sanitizedError =
			error instanceof Error ? error.message : String(error);
		if (sanitizedError.includes("Path traversal")) {
			errors.push("Security violation: path traversal attempt detected");
		} else {
			errors.push(
				`Validation error: ${sanitizePathForDisplay(sanitizedError)}`,
			);
		}
	}

	// Build result
	const result: LicenseValidationResult = {
		licenseFound: detectedLicense !== undefined,
		confidence,
		errors,
	};

	if (detectedLicense) {
		result.spdxId = detectedLicense.spdxId;
		result.licenseName = detectedLicense.name;
		result.osiApproved = detectedLicense.osiApproved;
		result.copyleft = detectedLicense.copyleft;
		result.allowed = isLicenseAllowed(
			detectedLicense.spdxId,
			options.allowedLicenses,
		);

		if (licenseFile) {
			result.licenseFile = licenseFile;
		}

		// Validate against options
		if (!result.allowed) {
			errors.push(
				`License "${detectedLicense.spdxId}" is not in the allowed licenses list`,
			);
		}

		if (options.requireOsiApproved && !detectedLicense.osiApproved) {
			errors.push(`License "${detectedLicense.spdxId}" is not OSI-approved`);
		}

		if (options.allowCopyleft === false && detectedLicense.copyleft) {
			errors.push(
				`License "${detectedLicense.spdxId}" is copyleft and copyleft is not allowed`,
			);
		}
	} else {
		errors.push("No valid open-source license detected");
	}

	return result;
}
