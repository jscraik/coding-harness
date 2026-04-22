import picomatch from "picomatch";
import type { EvidencePolicy } from "../contract/types.js";
import type {
	EvidenceError,
	EvidenceFile,
	EvidenceFormat,
	ImageFormat,
	VideoFormat,
} from "./types.js";

/**
 * Module-level cache for compiled picomatch matchers.
 * Key: pattern string, Value: compiled matcher function.
 */
const MATCHER_CACHE = new Map<string, ReturnType<typeof picomatch>>();

/**
 * Get or create a compiled matcher for the given pattern.
 * Isomorphic: identical matching behavior, but caches compilation.
 */
function getMatcher(pattern: string): ReturnType<typeof picomatch> {
	let matcher = MATCHER_CACHE.get(pattern);
	if (!matcher) {
		matcher = picomatch(pattern);
		MATCHER_CACHE.set(pattern, matcher);
	}
	return matcher;
}

/**
 * Policy violation error codes.
 */
export type PolicyViolationCode =
	| "EVIDENCE_REQUIRED"
	| "EVIDENCE_TYPE_NOT_ALLOWED"
	| "MISSING_REQUIRED_EVIDENCE";

/**
 * Policy check result for a single file.
 */
export interface PolicyCheckResult {
	ok: boolean;
	path: string;
	violation?: {
		code: PolicyViolationCode;
		message: string;
	};
}

/**
 * Policy enforcement result for changed files.
 */
export interface PolicyEnforcementResult {
	/** Whether all policy checks passed */
	passed: boolean;
	/** Files that passed policy checks */
	passedFiles: string[];
	/** Policy violations found */
	violations: EvidenceError[];
	/** Required evidence patterns that weren't satisfied */
	missingEvidence: string[];
}

/**
 * Extract base name from a file path (filename without extension).
 */
function getBaseName(filePath: string): string {
	const fileName = filePath.split("/").pop() ?? "";
	return fileName.replace(/\.[^.]+$/, "").toLowerCase();
}

/**
 * Check if a file path matches any of the required patterns.
 *
 * @param filePath - Path to check
 * @param patterns - Glob patterns for files requiring evidence
 * @returns True if file matches any pattern
 */
export function requiresEvidence(
	filePath: string,
	patterns: string[],
): boolean {
	for (const pattern of patterns) {
		const matcher = getMatcher(pattern);
		if (matcher(filePath)) {
			return true;
		}
	}
	return false;
}

/**
 * Check if an image format is allowed by policy.
 *
 * @param format - Image format to check
 * @param allowedTypes - Allowed formats from policy
 * @returns True if format is allowed
 */
export function isFormatAllowed(
	format: EvidenceFormat,
	allowedTypes: ImageFormat[],
	allowedVideoTypes?: VideoFormat[],
): boolean {
	// Check if it's an image format
	if (allowedTypes.includes(format as ImageFormat)) {
		return true;
	}
	// Check if it's a video format (and video types are specified)
	if (allowedVideoTypes?.includes(format as VideoFormat)) {
		return true;
	}
	return false;
}

/**
 * Find evidence file that matches a changed file by base name.
 */
function findMatchingEvidence(
	changedFile: string,
	evidenceFiles: EvidenceFile[],
): EvidenceFile | undefined {
	const changedBase = getBaseName(changedFile);

	const isEquivalentBaseName = (left: string, right: string): boolean => {
		if (left === right) {
			return true;
		}
		// Allow singular/plural suffix variance while preventing broad substring collisions.
		if (left.endsWith("s") && left.slice(0, -1) === right) {
			return true;
		}
		if (right.endsWith("s") && right.slice(0, -1) === left) {
			return true;
		}
		return false;
	};

	return evidenceFiles.find((ev) => {
		const evBase = getBaseName(ev.path);
		return isEquivalentBaseName(evBase, changedBase);
	});
}

/**
 * Validate evidence files against policy.
 *
 * @param verifiedFiles - Successfully verified evidence files
 * @param changedFiles - Files that were changed in the PR/change
 * @param policy - Evidence policy from contract
 * @returns Policy enforcement result
 */
export function enforceEvidencePolicy(
	verifiedFiles: EvidenceFile[],
	changedFiles: string[],
	policy: EvidencePolicy,
): PolicyEnforcementResult {
	const violations: EvidenceError[] = [];
	const passedFiles: string[] = [];

	// Check each evidence file against allowed types
	for (const file of verifiedFiles) {
		if (
			!isFormatAllowed(file.type, policy.allowedTypes, policy.allowedVideoTypes)
		) {
			violations.push({
				ok: false,
				code: "INVALID_FORMAT",
				message: `Evidence type "${file.type}" not allowed. Allowed: ${policy.allowedTypes.join(", ")}`,
				path: file.path,
			});
		} else {
			passedFiles.push(file.path);
		}
	}

	// Check if changed files require evidence
	const filesRequiringEvidence = changedFiles.filter((f) =>
		requiresEvidence(f, policy.requiredFor),
	);

	const missingEvidence: string[] = [];
	for (const changedFile of filesRequiringEvidence) {
		// Find matching evidence for this changed file
		const matchingEvidence = findMatchingEvidence(changedFile, verifiedFiles);

		if (!matchingEvidence) {
			missingEvidence.push(changedFile);
			violations.push({
				ok: false,
				code: "FILE_NOT_FOUND",
				message: `Evidence required for changed file: ${changedFile}`,
				path: changedFile,
			});
		}
	}

	return {
		passed: violations.length === 0,
		passedFiles,
		violations,
		missingEvidence,
	};
}

/**
 * Get list of changed files that require evidence.
 *
 * @param changedFiles - All changed files
 * @param policy - Evidence policy
 * @returns Files requiring evidence
 */
export function getFilesRequiringEvidence(
	changedFiles: string[],
	policy: EvidencePolicy,
): string[] {
	return changedFiles.filter((file) =>
		requiresEvidence(file, policy.requiredFor),
	);
}

/**
 * Create a human-readable policy summary.
 *
 * @param policy - Evidence policy
 * @returns Summary string
 */
export function summarizePolicy(policy: EvidencePolicy): string {
	const lines = [
		"Evidence Policy:",
		`  Allowed types: ${policy.allowedTypes.join(", ")}`,
		`  Max file size: ${(policy.maxFileSizeBytes ?? 1024 * 1024) / 1024 / 1024}MB`,
	];

	if (policy.requiredFor.length > 0) {
		lines.push("  Required for:");
		for (const pattern of policy.requiredFor) {
			lines.push(`    - ${pattern}`);
		}
	} else {
		lines.push("  No files require evidence (requiredFor is empty)");
	}

	return lines.join("\n");
}
