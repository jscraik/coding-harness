import {
	NORTH_STAR_FEEDBACK_SCHEMA_VERSION,
	type NorthStarFeedbackResult,
	buildNorthStarFeedback,
} from "../lib/learnings/north-star-feedback.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;
const MISSING_VALUE_ERROR_CODE = "north_star_feedback.missing_value";
const INVALID_NUMBER_ERROR_CODE = "north_star_feedback.invalid_number";

/**
 * Execute the `harness north-star-feedback` CLI command using the provided argument tokens.
 *
 * Recognizes presence-only flag `--json`; optional string flags `--source`, `--enforcement-status`,
 * `--gate-result`, and `--output`; and optional numeric flags `--min-usage`, `--review-thread-count`,
 * and `--validation-reruns`. If a numeric flag is present but missing or invalid, emits a usage
 * error (JSON when `--json` is present) and returns the usage exit code.
 *
 * @param args - Array of command-line argument tokens (typically process.argv.slice(2))
 * @returns `0` on success, `1` if execution produced an error result, or `2` for usage errors
 */
export function runNorthStarFeedbackCLI(args: string[]): number {
	const json = args.includes("--json");
	const source = readOptionalValue(args, "--source");
	const enforcementStatusPath = readOptionalValue(args, "--enforcement-status");
	const gateResultPath = readOptionalValue(args, "--gate-result");
	const output = readOptionalValue(args, "--output");
	if (!source.ok) {
		return emitUsageError(json, source.message, MISSING_VALUE_ERROR_CODE);
	}
	if (!enforcementStatusPath.ok) {
		return emitUsageError(
			json,
			enforcementStatusPath.message,
			MISSING_VALUE_ERROR_CODE,
		);
	}
	if (!gateResultPath.ok) {
		return emitUsageError(
			json,
			gateResultPath.message,
			MISSING_VALUE_ERROR_CODE,
		);
	}
	if (!output.ok) {
		return emitUsageError(json, output.message, MISSING_VALUE_ERROR_CODE);
	}
	const minUsage = readOptionalNumber(args, "--min-usage");
	const reviewThreadCount = readOptionalNumber(args, "--review-thread-count");
	const validationReruns = readOptionalNumber(args, "--validation-reruns");

	const invalidNumber = [minUsage, reviewThreadCount, validationReruns].find(
		(value) => value?.ok === false,
	);
	if (invalidNumber?.ok === false) {
		return emitUsageError(
			json,
			invalidNumber.message,
			INVALID_NUMBER_ERROR_CODE,
		);
	}
	const minUsageValue = readNumberValue(minUsage);
	const reviewThreadCountValue = readNumberValue(reviewThreadCount);
	const validationRerunsValue = readNumberValue(validationReruns);

	const result = buildNorthStarFeedback({
		...(source.value !== undefined ? { source: source.value } : {}),
		...(enforcementStatusPath.value !== undefined
			? { enforcementStatusPath: enforcementStatusPath.value }
			: {}),
		...(gateResultPath.value !== undefined
			? { gateResultPath: gateResultPath.value }
			: {}),
		...(output.value !== undefined ? { output: output.value } : {}),
		...(minUsageValue !== undefined ? { minUsage: minUsageValue } : {}),
		...(reviewThreadCountValue !== undefined
			? { reviewThreadCount: reviewThreadCountValue }
			: {}),
		...(validationRerunsValue !== undefined
			? { validationReruns: validationRerunsValue }
			: {}),
	});

	if (json) {
		console.info(JSON.stringify(result, null, 2));
	} else if (result.status === "error") {
		console.error(
			`Error: ${result.error?.message ?? "North-star feedback failed."}`,
		);
	} else {
		console.info(
			[
				`Promotion candidates: ${result.metrics.promotionCandidates}`,
				`Promoted learnings: ${result.metrics.promotedLearnings}`,
				`High-usage unenforced: ${result.metrics.highUsageLearningsUnenforced}`,
				...(result.outputPath ? [`Artifact: ${result.outputPath}`] : []),
			].join("\n"),
		);
	}
	return result.status === "error" ? EXIT_CODES.FAILURE : EXIT_CODES.SUCCESS;
}

type ParsedFlag =
	| { present: false }
	| { present: true; missingValue: true }
	| { present: true; value: string };

/**
 * Retrieves the string value for an optional CLI flag from an argument list.
 *
 * @param args - The command-line arguments array to search (e.g., process.argv.slice(2)).
 * @param flag - The flag token to look for (e.g., "--source").
 * @returns `{ ok: true, value?: string }` when `flag` is absent or has a valid non-empty value; `{ ok: false, message: string }` when `flag` is present but missing or empty.
 */
function readOptionalValue(
	args: string[],
	flag: string,
): { ok: true; value?: string } | { ok: false; message: string } {
	const parsed = readOptionalFlag(args, flag);
	if (!parsed.present) return { ok: true };
	if ("missingValue" in parsed || parsed.value.trim().length === 0) {
		return { ok: false, message: `${flag} requires a non-empty value.` };
	}
	return { ok: true, value: parsed.value };
}

/**
 * Reads whether a command-line flag is present in an array of tokens and returns its parsed presence/value.
 *
 * @param args - Array of command-line tokens (e.g., process.argv slice)
 * @param flag - The flag token to search for (e.g., `--source`)
 * @returns `{ present: false }` if the flag is not found; `{ present: true, missingValue: true }` if the flag is found but the next token is missing or starts with `-`; `{ present: true, value: string }` if the flag is found and followed by a non-flag value
 */
function readOptionalFlag(args: string[], flag: string): ParsedFlag {
	const index = args.indexOf(flag);
	if (index === -1) return { present: false };
	const value = args[index + 1];
	if (value === undefined || value.trim() === "" || value.startsWith("-")) {
		return { present: true, missingValue: true };
	}
	return { present: true, value };
}

/**
 * Parses the value of an optional command-line flag and validates it as a non-negative integer.
 *
 * @param args - The list of command-line tokens to inspect (e.g., a slice of process.argv).
 * @param flag - The flag name to look for (including leading dashes, e.g., `--min-usage`).
 * @returns `{ ok: true; value?: number }` when the flag is absent or present with a valid non-negative integer `value`; `{ ok: false; message: string }` when the flag is present but missing a value or the value is not a non-negative integer, with `message` describing the problem.
 */
function readOptionalNumber(
	args: string[],
	flag: string,
): { ok: true; value?: number } | { ok: false; message: string } {
	const raw = readOptionalFlag(args, flag);
	if (!raw.present) return { ok: true };
	if ("missingValue" in raw) {
		return { ok: false, message: `${flag} requires a value.` };
	}
	if (!/^\d+$/.test(raw.value)) {
		return {
			ok: false,
			message: `${flag} must be a non-negative integer.`,
		};
	}
	const value = Number.parseInt(raw.value, 10);
	return { ok: true, value };
}

/**
 * Extracts the numeric value from a `readOptionalNumber` result.
 *
 * @param result - The parse result returned by `readOptionalNumber`
 * @returns `number` if the input indicates a successful parse, `undefined` otherwise
 */
function readNumberValue(
	result: ReturnType<typeof readOptionalNumber>,
): number | undefined {
	return result.ok ? result.value : undefined;
}

/**
 * Emit a usage error and return the usage exit code.
 *
 * If `json` is true, writes a standardized JSON error payload to stdout describing the invalid input
 * (including the supplied machine-readable `error.code`); otherwise writes a single-line
 * error message to stderr.
 *
 * @param json - Whether to emit the error as structured JSON
 * @param message - The human-readable error message to include in the output
 * @param errorCode - Machine-readable usage error code
 * @returns The usage exit code (`EXIT_CODES.USAGE`)
 */
function emitUsageError(
	json: boolean,
	message: string,
	errorCode: string,
): number {
	if (json) {
		const payload: NorthStarFeedbackResult = {
			schemaVersion: NORTH_STAR_FEEDBACK_SCHEMA_VERSION,
			status: "error",
			source: "",
			minUsage: 25,
			generatedAt: new Date().toISOString(),
			evidence: {
				learningArtifact: "insufficient_evidence",
				enforcementStatus: "insufficient_evidence",
				gateResult: "insufficient_evidence",
				reviewThreadCount: "insufficient_evidence",
				validationReruns: "insufficient_evidence",
			},
			metrics: {
				learningHits: null,
				learningGateBlocks: null,
				learningGateWarnings: null,
				promotionCandidates: 0,
				promotedLearnings: 0,
				highUsageLearningsUnenforced: 0,
				reviewThreadCount: null,
				validationReruns: null,
			},
			summary: {
				insufficientEvidence: [
					"enforcementStatus",
					"gateResult",
					"learningArtifact",
					"reviewThreadCount",
					"validationReruns",
				],
			},
			error: {
				code: errorCode,
				message,
			},
		};
		console.info(JSON.stringify(payload, null, 2));
	} else {
		console.error(`Error: ${message}`);
	}
	return EXIT_CODES.USAGE;
}
