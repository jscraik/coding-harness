import type { PilotGapCasePolicy, RiskTier } from "../contract/types.js";
import type {
	GapCaseOpenOptions,
	GapCaseResolveOptions,
	GapCaseResult,
} from "./types.js";

/**
 * Return whether a value is a 40-character hexadecimal commit SHA.
 */
export function isValidSha(sha: string | undefined): boolean {
	if (!sha) return false;
	return /^[a-f0-9]{40}$/i.test(sha);
}

/**
 * Return whether a value is a supported gap-case severity tier.
 */
export function isValidSeverity(value: string): value is RiskTier {
	return value === "high" || value === "medium" || value === "low";
}

/**
 * Return whether a value is a syntactically valid HTTPS URL.
 */
export function isValidHttpsUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Validate all required fields for opening a gap-case.
 */
export function validateOpenOptions(
	options: GapCaseOpenOptions,
): GapCaseResult | undefined {
	if (!options.incidentId?.trim()) {
		return {
			ok: false,
			error: { code: "E_VALIDATION", message: "incidentId is required" },
		};
	}

	if (!options.summary?.trim()) {
		return {
			ok: false,
			error: { code: "E_VALIDATION", message: "summary is required" },
		};
	}

	if (!options.owner?.trim()) {
		return {
			ok: false,
			error: { code: "E_VALIDATION", message: "owner is required" },
		};
	}

	if (!options.severity || !isValidSeverity(options.severity)) {
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: "severity must be one of: high, medium, low",
			},
		};
	}

	if (options.headSha && !isValidSha(options.headSha)) {
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: "headSha must be a valid 40-character hex SHA",
			},
		};
	}

	if (options.slaHours !== undefined) {
		if (
			!Number.isInteger(options.slaHours) ||
			options.slaHours <= 0 ||
			options.slaHours > 8760
		) {
			return {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: "slaHours must be a positive integer (max 8760)",
				},
			};
		}
	}

	return undefined;
}

/**
 * Validate all required fields for resolving a gap-case.
 */
export function validateResolveOptions(
	options: GapCaseResolveOptions,
	policy: PilotGapCasePolicy,
): GapCaseResult | undefined {
	if (!options.caseId?.trim()) {
		return {
			ok: false,
			error: { code: "E_VALIDATION", message: "caseId is required" },
		};
	}

	if (!options.evidenceUrl?.trim()) {
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: `evidenceUrl is required${policy.requireClosureEvidence ? " by policy" : ""}`,
			},
		};
	}

	if (!isValidHttpsUrl(options.evidenceUrl)) {
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: "evidenceUrl must be a valid HTTPS URL",
			},
		};
	}

	return undefined;
}
