import type { CardinalityPolicy } from "../policy/cardinality.js";
import {
	DEFAULT_CARDINALITY_POLICY,
	validateMetricLabels,
} from "../policy/cardinality.js";
import type {
	ObservabilityGateOptions,
	ObservabilityGateResult,
} from "./types.js";

function isStringRecord(value: unknown): value is Record<string, string> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	return Object.entries(value).every(
		([key, entry]) => key.length > 0 && typeof entry === "string",
	);
}

type ParsedLabels =
	| { ok: true; labels: Record<string, string> }
	| { ok: false; result: ObservabilityGateResult };

function parseLabels(labels?: string): ParsedLabels {
	if (!labels) {
		return { ok: true, labels: {} };
	}

	try {
		const parsed = JSON.parse(labels) as unknown;
		if (!isStringRecord(parsed)) {
			return {
				ok: false,
				result: {
					ok: false,
					error: {
						code: "VALIDATION_ERROR",
						message:
							"Invalid labels format: expected JSON object of string:string",
					},
				},
			};
		}
		return { ok: true, labels: parsed };
	} catch {
		return {
			ok: false,
			result: {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Invalid JSON in labels",
				},
			},
		};
	}
}

function buildPolicy(options: ObservabilityGateOptions): CardinalityPolicy {
	return {
		...DEFAULT_CARDINALITY_POLICY,
		...(options.maxCardinality !== undefined && {
			maxLabelCardinality: options.maxCardinality,
		}),
		...(options.maxLength !== undefined && {
			maxStringLength: options.maxLength,
		}),
	};
}

/** Run the metric-label cardinality gate. */
export function runObservabilityGate(
	options: ObservabilityGateOptions,
): ObservabilityGateResult {
	try {
		const parsed = parseLabels(options.labels);
		if (!parsed.ok) {
			return parsed.result;
		}

		const labels = parsed.labels;
		const violations = validateMetricLabels(labels, buildPolicy(options));
		return {
			ok: true,
			output: {
				passed: violations.length === 0,
				violations,
				labelsChecked: Object.keys(labels).length,
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: error instanceof Error ? error.message : "Unknown error",
			},
		};
	}
}
