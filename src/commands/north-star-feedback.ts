import { buildNorthStarFeedback } from "../lib/learnings/north-star-feedback.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/** Run the `harness north-star-feedback` command. */
export function runNorthStarFeedbackCLI(args: string[]): number {
	const json = args.includes("--json");
	const source = readOptionalFlag(args, "--source").value;
	const enforcementStatusPath = readOptionalFlag(
		args,
		"--enforcement-status",
	).value;
	const gateResultPath = readOptionalFlag(args, "--gate-result").value;
	const output = readOptionalFlag(args, "--output").value;
	const minUsage = readOptionalNumber(args, "--min-usage");
	const reviewThreadCount = readOptionalNumber(args, "--review-thread-count");
	const validationReruns = readOptionalNumber(args, "--validation-reruns");

	const invalidNumber = [minUsage, reviewThreadCount, validationReruns].find(
		(value) => value?.ok === false,
	);
	if (invalidNumber?.ok === false) {
		return emitUsageError(json, invalidNumber.message);
	}
	const minUsageValue = readNumberValue(minUsage);
	const reviewThreadCountValue = readNumberValue(reviewThreadCount);
	const validationRerunsValue = readNumberValue(validationReruns);

	const result = buildNorthStarFeedback({
		...(source ? { source } : {}),
		...(enforcementStatusPath ? { enforcementStatusPath } : {}),
		...(gateResultPath ? { gateResultPath } : {}),
		...(output ? { output } : {}),
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

function readOptionalFlag(args: string[], flag: string): { value?: string } {
	const index = args.indexOf(flag);
	if (index === -1) return {};
	const value = args[index + 1];
	if (value === undefined || value.startsWith("-")) return {};
	return { value };
}

function readOptionalNumber(
	args: string[],
	flag: string,
): { ok: true; value?: number } | { ok: false; message: string } {
	const raw = readOptionalFlag(args, flag).value;
	if (raw === undefined) return { ok: true };
	const value = Number.parseInt(raw, 10);
	if (!Number.isFinite(value) || value < 0) {
		return {
			ok: false,
			message: `${flag} must be a non-negative integer.`,
		};
	}
	return { ok: true, value };
}

function readNumberValue(
	result: ReturnType<typeof readOptionalNumber>,
): number | undefined {
	return result.ok ? result.value : undefined;
}

function emitUsageError(json: boolean, message: string): number {
	if (json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: "north-star-feedback/v1",
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
						code: "north_star_feedback.invalid_number",
						message,
					},
				},
				null,
				2,
			),
		);
	} else {
		console.error(`Error: ${message}`);
	}
	return EXIT_CODES.USAGE;
}
