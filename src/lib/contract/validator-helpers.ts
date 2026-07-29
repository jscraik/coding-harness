import semver from "semver";
import type { DocsDriftRules, RiskTier } from "./types.js";

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

/** Return whether a property name is unsafe to accept from external contract JSON. */
export function hasForbiddenKey(value: string): boolean {
	return FORBIDDEN_KEYS.includes(value as (typeof FORBIDDEN_KEYS)[number]);
}

/** Narrow an unknown value to a non-array object record. */
export function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether a value is one of the supported contract risk tiers. */
export function isValidRiskTier(value: unknown): value is RiskTier {
	return (
		typeof value === "string" && VALID_RISK_TIERS.includes(value as RiskTier)
	);
}

/** Validate the external risk-pattern-to-tier map. */
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

/** Return whether a value is a supported policy action. */
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

/** Return whether a value is a supported deterministic gate verdict. */
export function isValidGateVerdict(
	value: unknown,
): value is (typeof VALID_GATE_VERDICTS)[number] {
	return (
		typeof value === "string" &&
		VALID_GATE_VERDICTS.includes(value as (typeof VALID_GATE_VERDICTS)[number])
	);
}

/** Return whether a value is a supported timeout action. */
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

/** Validate a non-blank required-check list. */
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

/** Validate an array whose entries are all non-blank strings. */
export function isNonEmptyStringArray(value: unknown): value is string[] {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.every(
		(item) => typeof item === "string" && item.trim().length > 0,
	);
}

/** Validate a string array with an optional minimum length. */
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

/** Return whether a URL identifies a Linear project page. */
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

/** Return whether a value is a supported evidence image format. */
export function isValidImageFormat(
	value: unknown,
): value is (typeof VALID_IMAGE_FORMATS)[number] {
	return (
		typeof value === "string" &&
		VALID_IMAGE_FORMATS.includes(value as (typeof VALID_IMAGE_FORMATS)[number])
	);
}

/** Validate the pattern-to-documentation-rule map. */
export function isValidDocsDriftRules(value: unknown): value is DocsDriftRules {
	if (!isPlainObject(value)) {
		return false;
	}
	for (const [pattern, rules] of Object.entries(value)) {
		if (hasForbiddenKey(pattern) || !Array.isArray(rules)) {
			return false;
		}
		if (!rules.every((rule) => typeof rule === "string")) {
			return false;
		}
	}
	return true;
}

/** Parsed numeric parts of a contract version string. */
export interface ParsedContractVersion {
	major: number;
	minor: number;
	patch: number | undefined;
}

/** Parse a canonical numeric semver-style contract version. */
export function parseContractVersion(
	version: unknown,
): ParsedContractVersion | undefined {
	if (typeof version !== "string") {
		return undefined;
	}
	const match = version.match(/^(0|[1-9]\d*)\.(\d+)(?:\.(\d+))?$/);
	if (!match) {
		return undefined;
	}
	const patchRaw = match[3];
	const canonicalVersion = patchRaw === undefined ? `${version}.0` : version;
	const parsed = semver.parse(canonicalVersion, { loose: false });
	if (!parsed) {
		return undefined;
	}
	return {
		major: parsed.major,
		minor: parsed.minor,
		patch: patchRaw === undefined ? undefined : parsed.patch,
	};
}

/** Return whether a value is a canonical numeric semver-style version. */
export function isValidContractVersionString(version: unknown): boolean {
	return parseContractVersion(version) !== undefined;
}
