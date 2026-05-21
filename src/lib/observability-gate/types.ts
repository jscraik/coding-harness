import type { CardinalityViolation } from "../policy/cardinality.js";

/** Exit codes for observability-gate programmatic consumers. */
export const EXIT_CODES = {
	SUCCESS: 0,
	VIOLATION_FOUND: 1,
	VALIDATION_ERROR: 2,
	SYSTEM_ERROR: 10,
} as const;

/** Options accepted by the metric-label cardinality gate. */
export interface ObservabilityGateOptions {
	/** Metric labels to validate as a JSON object string. */
	labels?: string;
	/** Output as JSON. */
	json?: boolean;
	/** Maximum allowed label cardinality. */
	maxCardinality?: number;
	/** Maximum safe string length before labels must be hashed or categorized. */
	maxLength?: number;
}

/** Machine-readable result emitted by the metric-label cardinality gate. */
export interface ObservabilityGateOutput {
	/** Whether validation passed. */
	passed: boolean;
	/** Violations found. */
	violations: CardinalityViolation[];
	/** Labels checked. */
	labelsChecked: number;
}

/** Success or structured failure from metric-label cardinality validation. */
export type ObservabilityGateResult =
	| { ok: true; output: ObservabilityGateOutput }
	| { ok: false; error: { code: string; message: string } };
