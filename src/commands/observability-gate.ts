import type {
	CardinalityPolicy,
	CardinalityViolation,
} from "../lib/observability/cardinality.js";
import {
	DEFAULT_CARDINALITY_POLICY,
	validateMetricLabels,
} from "../lib/observability/cardinality.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	VIOLATION_FOUND: 1,
	VALIDATION_ERROR: 2,
	SYSTEM_ERROR: 10,
} as const;

export interface ObservabilityGateOptions {
	/** Metric labels to validate (as JSON string) */
	labels?: string;
	/** Path to labels JSON file */
	labelsFile?: string;
	/** Output as JSON */
	json?: boolean;
	/** Maximum label cardinality */
	maxCardinality?: number;
	/** Maximum string length */
	maxLength?: number;
}

export interface ObservabilityGateOutput {
	/** Whether validation passed */
	passed: boolean;
	/** Violations found */
	violations: CardinalityViolation[];
	/** Labels checked */
	labelsChecked: number;
}

export type ObservabilityGateResult =
	| { ok: true; output: ObservabilityGateOutput }
	| { ok: false; error: { code: string; message: string } };

function isStringRecord(value: unknown): value is Record<string, string> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	return Object.entries(value).every(
		([key, entry]) => key.length > 0 && typeof entry === "string",
	);
}

/**
 * Run observability gate validation.
 */
export function runObservabilityGate(
	options: ObservabilityGateOptions,
): ObservabilityGateResult {
		try {
			// Parse labels
			let labels: Record<string, string> = {};

			if (options.labels) {
				try {
					const parsed = JSON.parse(options.labels) as unknown;
					if (!isStringRecord(parsed)) {
						return {
							ok: false,
							error: {
								code: "VALIDATION_ERROR",
								message:
									"Invalid labels format: expected JSON object of string:string",
							},
						};
					}
					labels = parsed;
				} catch {
					return {
						ok: false,
						error: {
							code: "VALIDATION_ERROR",
						message: "Invalid JSON in labels",
					},
				};
			}
		}

		// Build policy
		const policy: CardinalityPolicy = {
			...DEFAULT_CARDINALITY_POLICY,
			...(options.maxCardinality !== undefined && {
				maxLabelCardinality: options.maxCardinality,
			}),
			...(options.maxLength !== undefined && {
				maxStringLength: options.maxLength,
			}),
		};

		// Validate labels
		const violations = validateMetricLabels(labels, policy);

		const output: ObservabilityGateOutput = {
			passed: violations.length === 0,
			violations,
			labelsChecked: Object.keys(labels).length,
		};

		return { ok: true, output };
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

/**
 * CLI entry point with output formatting and exit codes.
 */
export function runObservabilityGateCLI(
	options: ObservabilityGateOptions,
): number {
	const result = runObservabilityGate(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(`Error: ${result.error.message}`);
		}
		return result.error.code === "VALIDATION_ERROR"
			? EXIT_CODES.VALIDATION_ERROR
			: EXIT_CODES.SYSTEM_ERROR;
	}

	const { output } = result;

	if (options.json) {
		console.info(JSON.stringify(output, null, 2));
	} else {
		console.info("Observability Gate");
		console.info(`Labels checked: ${output.labelsChecked}`);
		console.info(`Violations: ${output.violations.length}`);

		if (output.violations.length > 0) {
			console.error("");
			console.error("Violations found:");
			for (const violation of output.violations) {
				console.error(`  [${violation.type}] ${violation.name}`);
				console.error(`    ${violation.message}`);
				console.error(`    Suggestion: ${violation.suggestion}`);
				console.error("");
			}
		} else {
			console.info("All labels pass cardinality checks.");
		}
	}

	return output.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.VIOLATION_FOUND;
}
