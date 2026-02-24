/**
 * Cardinality tripwires for observability.
 *
 * Enforces:
 * - Never place raw prompts/user input in metric labels
 * - Truncate or hash high-cardinality strings
 * - Gate raw payload logging behind explicit debug flags
 */

export interface CardinalityViolation {
	/** Type of violation */
	type:
		| "HIGH_CARDINALITY_LABEL"
		| "RAW_PAYLOAD_LOGGING"
		| "USER_INPUT_IN_LABEL";
	/** Metric or log name */
	name: string;
	/** Violation details */
	message: string;
	/** Suggested fix */
	suggestion: string;
}

export interface CardinalityPolicy {
	/** Maximum unique values allowed for a label */
	maxLabelCardinality: number;
	/** Maximum string length before hashing required */
	maxStringLength: number;
	/** Whether raw payloads require debug flag */
	requireDebugFlagForPayloads: boolean;
	/** Forbidden patterns in metric labels */
	forbiddenLabelPatterns: RegExp[];
}

export const DEFAULT_CARDINALITY_POLICY: CardinalityPolicy = {
	maxLabelCardinality: 100,
	maxStringLength: 100,
	requireDebugFlagForPayloads: true,
	forbiddenLabelPatterns: [
		/\{.*\}/, // JSON objects
		/\[.*\]/, // Array contents
		/^.+@.+\..+$/, // Email-like
		/^\d{4}-\d{2}-\d{2}/, // ISO dates
		/^[a-f0-9]{32}$/i, // MD5 hashes
		/^[a-f0-9]{64}$/i, // SHA256 hashes
	],
};

/**
 * Hash a high-cardinality string to a fixed length.
 */
export function hashString(input: string, _maxLength = 16): string {
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		const char = input.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	const hex = Math.abs(hash).toString(16).padStart(8, "0");
	return `hash_${hex}`;
}

/**
 * Truncate or hash a string for safe use in metric labels.
 */
export function sanitizeLabelValue(
	value: string,
	policy: CardinalityPolicy = DEFAULT_CARDINALITY_POLICY,
): string {
	if (value.length <= policy.maxStringLength) {
		return value;
	}
	return hashString(value);
}

/**
 * Check if a string looks like user input (high cardinality risk).
 */
export function looksLikeUserInput(value: string): boolean {
	// Long strings are likely user input
	if (value.length > 50) return true;

	// Contains whitespace patterns typical of text
	if (/\s+/.test(value) && value.length > 20) return true;

	// Looks like a sentence
	if (/^[A-Z][^.!?]{10,}[.!?]$/i.test(value)) return true;

	return false;
}

/**
 * Validate a metric label value against cardinality policy.
 */
export function validateLabelValue(
	labelName: string,
	value: string,
	policy: CardinalityPolicy = DEFAULT_CARDINALITY_POLICY,
): CardinalityViolation | null {
	// Check for forbidden patterns
	for (const pattern of policy.forbiddenLabelPatterns) {
		if (pattern.test(value)) {
			return {
				type: "HIGH_CARDINALITY_LABEL",
				name: labelName,
				message: `Label "${labelName}" contains high-cardinality pattern: ${value.slice(0, 50)}`,
				suggestion: `Hash the value: "${sanitizeLabelValue(value, policy)}"`,
			};
		}
	}

	// Check for user input
	if (looksLikeUserInput(value)) {
		return {
			type: "USER_INPUT_IN_LABEL",
			name: labelName,
			message: `Label "${labelName}" appears to contain user input: ${value.slice(0, 50)}`,
			suggestion: "Use a categorical value or hash the input",
		};
	}

	// Check length
	if (value.length > policy.maxStringLength) {
		return {
			type: "HIGH_CARDINALITY_LABEL",
			name: labelName,
			message: `Label "${labelName}" value exceeds max length (${value.length} > ${policy.maxStringLength})`,
			suggestion: `Truncate or hash: "${sanitizeLabelValue(value, policy)}"`,
		};
	}

	return null;
}

/**
 * Check if payload logging is allowed.
 */
export function isPayloadLoggingAllowed(
	isDebugEnabled: boolean,
	policy: CardinalityPolicy = DEFAULT_CARDINALITY_POLICY,
): boolean {
	if (!policy.requireDebugFlagForPayloads) return true;
	return isDebugEnabled;
}

/**
 * Validate a complete set of metric labels.
 */
export function validateMetricLabels(
	labels: Record<string, string>,
	policy: CardinalityPolicy = DEFAULT_CARDINALITY_POLICY,
): CardinalityViolation[] {
	const violations: CardinalityViolation[] = [];

	for (const [name, value] of Object.entries(labels)) {
		const violation = validateLabelValue(name, value, policy);
		if (violation) {
			violations.push(violation);
		}
	}

	return violations;
}

/**
 * Get cardinality estimate for a set of values.
 */
export function estimateCardinality(values: string[]): {
	unique: number;
	ratio: number;
	highCardinality: boolean;
} {
	const unique = new Set(values).size;
	const ratio = values.length > 0 ? unique / values.length : 0;
	return {
		unique,
		ratio,
		highCardinality: unique > 100 || ratio > 0.9,
	};
}
