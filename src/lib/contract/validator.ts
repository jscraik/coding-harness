import type {
	HarnessContract,
	ReviewPolicy,
	RiskTier,
	TimeoutAction,
} from "./types.js";

const VALID_RISK_TIERS: RiskTier[] = ["high", "medium", "low"];
const VALID_TIMEOUT_ACTIONS: TimeoutAction[] = ["fail", "warn"];
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"] as const;

// Machine-readable error codes for programmatic handling
export enum ValidationErrorCode {
	MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
	INVALID_TYPE = "INVALID_TYPE",
	INVALID_VALUE = "INVALID_VALUE",
	FORBIDDEN_KEY = "FORBIDDEN_KEY",
}

export interface ValidationError {
	code: ValidationErrorCode;
	path: string;
	message: string;
	expected?: string;
	received?: string;
	fix?: string;
}

export interface ValidationResult<T> {
	success: boolean;
	data?: T;
	errors: ValidationError[];
}

function isValidRiskTier(value: unknown): value is RiskTier {
	return (
		typeof value === "string" && VALID_RISK_TIERS.includes(value as RiskTier)
	);
}

function isValidRiskTierRules(
	value: unknown,
): value is Record<string, RiskTier> {
	if (typeof value !== "object" || value === null) return false;
	for (const [pattern, tier] of Object.entries(
		value as Record<string, unknown>,
	)) {
		// Block prototype pollution
		if (FORBIDDEN_KEYS.includes(pattern as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
		if (typeof pattern !== "string" || !isValidRiskTier(tier)) return false;
	}
	return true;
}

function isValidTimeoutAction(value: unknown): value is TimeoutAction {
	return (
		typeof value === "string" &&
		VALID_TIMEOUT_ACTIONS.includes(value as TimeoutAction)
	);
}

function isValidReviewPolicy(value: unknown): value is ReviewPolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	// Validate timeoutSeconds
	if (
		typeof policy.timeoutSeconds !== "number" ||
		policy.timeoutSeconds <= 0 ||
		!Number.isInteger(policy.timeoutSeconds)
	) {
		return false;
	}

	// Validate timeoutAction
	if (!isValidTimeoutAction(policy.timeoutAction)) {
		return false;
	}

	return true;
}

export function validateContract(
	data: unknown,
): ValidationResult<HarnessContract> {
	const errors: ValidationError[] = [];

	if (typeof data !== "object" || data === null) {
		errors.push({
			code: ValidationErrorCode.INVALID_TYPE,
			path: "root",
			message: "Contract must be an object",
			expected: "object",
			received: data === null ? "null" : typeof data,
		});
		return { success: false, errors };
	}

	const obj = data as Record<string, unknown>;

	// Validate version (required)
	if (typeof obj.version !== "string") {
		errors.push({
			code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
			path: "version",
			message: "Required field 'version' must be a string",
			expected: "string (e.g., '1.0')",
			received: typeof obj.version,
			fix: 'Add "version": "1.0" to your contract',
		});
	}

	// Validate riskTierRules
	if ("riskTierRules" in obj) {
		const rules = obj.riskTierRules;
		if (typeof rules !== "object" || rules === null) {
			errors.push({
				code: ValidationErrorCode.INVALID_TYPE,
				path: "riskTierRules",
				message: "Must be an object mapping glob patterns to risk tiers",
				expected: "{ 'src/auth/**': 'high' | 'medium' | 'low' }",
				received: typeof rules,
			});
		} else {
			// Check for forbidden keys (prototype pollution)
			for (const key of Object.keys(rules as Record<string, unknown>)) {
				if (FORBIDDEN_KEYS.includes(key as (typeof FORBIDDEN_KEYS)[number])) {
					errors.push({
						code: ValidationErrorCode.FORBIDDEN_KEY,
						path: `riskTierRules.${key}`,
						message: `Forbidden key '${key}' is not allowed`,
						fix: `Remove '${key}' from riskTierRules`,
					});
				}
			}
			// Validate tier values
			if (!isValidRiskTierRules(rules)) {
				errors.push({
					code: ValidationErrorCode.INVALID_VALUE,
					path: "riskTierRules",
					message: "All tier values must be 'high', 'medium', or 'low'",
					fix: "Ensure all tier values are valid risk tiers",
				});
			}
		}
	}

	// Validate reviewPolicy (optional)
	let reviewPolicy: ReviewPolicy | undefined;
	if ("reviewPolicy" in obj && obj.reviewPolicy !== undefined) {
		if (!isValidReviewPolicy(obj.reviewPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "reviewPolicy",
				message:
					"reviewPolicy must have timeoutSeconds (positive integer) and timeoutAction ('fail' | 'warn')",
				expected: "{ timeoutSeconds: 600, timeoutAction: 'fail' | 'warn' }",
				received: JSON.stringify(obj.reviewPolicy),
				fix: "Ensure reviewPolicy has valid timeoutSeconds and timeoutAction",
			});
		} else {
			reviewPolicy = obj.reviewPolicy as ReviewPolicy;
		}
	}

	if (errors.length > 0) {
		return { success: false, errors };
	}

	return {
		success: true,
		data: {
			version: obj.version as string,
			riskTierRules: (obj.riskTierRules as Record<string, RiskTier>) ?? {},
			reviewPolicy,
		},
		errors: [],
	};
}
