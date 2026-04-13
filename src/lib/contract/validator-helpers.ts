import type { RiskTier } from "./types.js";

export const FORBIDDEN_KEYS = [
	"__proto__",
	"constructor",
	"prototype",
] as const;
export const VALID_RISK_TIERS: RiskTier[] = ["high", "medium", "low"];
export const VALID_TIMEOUT_ACTIONS = ["fail", "warn"] as const;
export const VALID_POLICY_ACTIONS = ["allow", "block", "warn"] as const;
export const VALID_GATE_VERDICTS = ["pass", "fail"] as const;
export const VALID_IMAGE_FORMATS = ["png", "jpeg"] as const;

export function hasForbiddenKey(value: string): boolean {
	return FORBIDDEN_KEYS.includes(value as (typeof FORBIDDEN_KEYS)[number]);
}

export function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidRiskTier(value: unknown): value is RiskTier {
	return (
		typeof value === "string" && VALID_RISK_TIERS.includes(value as RiskTier)
	);
}

export function isValidRiskTierRules(
	value: unknown,
): value is Record<string, RiskTier> {
	if (!isPlainObject(value)) return false;

	for (const [pattern, tier] of Object.entries(value)) {
		if (hasForbiddenKey(pattern)) {
			return false;
		}
		if (typeof pattern !== "string" || !isValidRiskTier(tier)) return false;
	}
	return true;
}

export function isValidPolicyAction(
	value: unknown,
): value is (typeof VALID_POLICY_ACTIONS)[number] {
	return (
		typeof value === "string" &&
		VALID_POLICY_ACTIONS.includes(
			value as (typeof VALID_POLICY_ACTIONS)[number],
		)
	);
}

export function isValidGateVerdict(
	value: unknown,
): value is (typeof VALID_GATE_VERDICTS)[number] {
	return (
		typeof value === "string" &&
		VALID_GATE_VERDICTS.includes(value as (typeof VALID_GATE_VERDICTS)[number])
	);
}

export function isValidTimeoutAction(
	value: unknown,
): value is (typeof VALID_TIMEOUT_ACTIONS)[number] {
	return (
		typeof value === "string" &&
		VALID_TIMEOUT_ACTIONS.includes(
			value as (typeof VALID_TIMEOUT_ACTIONS)[number],
		)
	);
}

export function isValidRequiredChecks(value: unknown): value is string[] {
	if (!Array.isArray(value)) {
		return false;
	}
	for (const check of value) {
		if (typeof check !== "string" || check.trim().length === 0) {
			return false;
		}
	}
	return true;
}

export function isNonEmptyStringArray(value: unknown): value is string[] {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.every(
		(item) => typeof item === "string" && item.trim().length > 0,
	);
}

export function isStringArray(
	value: unknown,
	options: { minLength?: number } = {},
): value is string[] {
	if (!Array.isArray(value)) {
		return false;
	}
	if (options.minLength !== undefined && value.length < options.minLength) {
		return false;
	}
	return value.every((entry) => typeof entry === "string" && entry.length > 0);
}

export function isValidLinearProjectUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			url.hostname === "linear.app" &&
			url.pathname.includes("/project/")
		);
	} catch {
		return false;
	}
}

export function isValidImageFormat(
	value: unknown,
): value is (typeof VALID_IMAGE_FORMATS)[number] {
	return (
		typeof value === "string" &&
		VALID_IMAGE_FORMATS.includes(value as (typeof VALID_IMAGE_FORMATS)[number])
	);
}
