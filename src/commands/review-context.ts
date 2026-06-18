import { inspectFlagList, inspectFlagValue } from "../lib/cli/parse-utils.js";
import { buildReviewContext } from "../lib/learnings/review-context.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

type FlagInspection = ReturnType<typeof inspectFlagValue>;

type ReviewContextCliOptions =
	| {
			ok: true;
			json: boolean;
			source?: string;
			output?: string;
			repoRoot?: string;
			enforcementStatusPath?: string;
			files: string[];
	  }
	| {
			ok: false;
			json: boolean;
			errorCode: string;
			message: string;
	  };

function flagInspections(args: string[]): Array<{
	flag: string;
	inspection: FlagInspection;
}> {
	return [
		{ flag: "--source", inspection: inspectFlagValue(args, "--source") },
		{ flag: "--output", inspection: inspectFlagValue(args, "--output") },
		{ flag: "--repo-root", inspection: inspectFlagValue(args, "--repo-root") },
		{
			flag: "--enforcement-status",
			inspection: inspectFlagValue(args, "--enforcement-status"),
		},
	];
}

function parseReviewContextArgs(args: string[]): ReviewContextCliOptions {
	const json = args.includes("--json");
	const inspections = flagInspections(args);
	const missingValueFlag = inspections.find(
		({ inspection }) => inspection.missingValue,
	);
	if (missingValueFlag) {
		return {
			ok: false,
			json,
			errorCode: "review-context.flag_value_required",
			message: `harness review-context requires a value after ${missingValueFlag.flag}.`,
		};
	}
	const files = inspectFlagList(args, "--files");
	if (!files.present || files.missingValue) {
		return {
			ok: false,
			json,
			errorCode: "review-context.files_required",
			message: "harness review-context requires --files.",
		};
	}
	return {
		ok: true,
		json,
		...(inspections[0]?.inspection.value
			? { source: inspections[0].inspection.value }
			: {}),
		...(inspections[1]?.inspection.value
			? { output: inspections[1].inspection.value }
			: {}),
		...(inspections[2]?.inspection.value
			? { repoRoot: inspections[2].inspection.value }
			: {}),
		...(inspections[3]?.inspection.value
			? { enforcementStatusPath: inspections[3].inspection.value }
			: {}),
		files: files.values,
	};
}

function renderReviewContextResult(
	result: ReturnType<typeof buildReviewContext>,
	json: boolean,
): void {
	if (json) {
		console.info(JSON.stringify(result, null, 2));
		return;
	}
	if (result.status === "error") {
		console.error(
			`Error: ${result.error?.message ?? "Review context failed."}`,
		);
		return;
	}
	console.info(
		[
			`Applicable learnings: ${result.summary.applicableLearnings}`,
			`Validation commands: ${result.summary.validationCommands}`,
			...(result.outputPath ? [`Artifact: ${result.outputPath}`] : []),
		].join("\n"),
	);
}

/**
 * Execute the `harness review-context` CLI workflow.
 *
 * Parses command-line flags (including `--json`, required `--files`, and optional
 * `--source`, `--output`, `--repo-root`, `--enforcement-status`), builds a
 * review context, and prints either a JSON payload or a human-readable summary.
 *
 * @param args - The CLI arguments to parse (e.g., `--files`, `--json`, and other flags listed above)
 * @returns The process exit code: `EXIT_CODES.SUCCESS` (0) for success, `EXIT_CODES.FAILURE` (1) for runtime errors, or `EXIT_CODES.USAGE` (2) for usage/flag errors
 */
export function runReviewContextCLI(args: string[]): number {
	const parsed = parseReviewContextArgs(args);
	if (!parsed.ok) {
		return emitError({
			json: parsed.json,
			errorCode: parsed.errorCode,
			message: parsed.message,
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const result = buildReviewContext({
		...(parsed.source ? { source: parsed.source } : {}),
		...(parsed.output ? { output: parsed.output } : {}),
		...(parsed.repoRoot ? { repoRoot: parsed.repoRoot } : {}),
		...(parsed.enforcementStatusPath
			? { enforcementStatusPath: parsed.enforcementStatusPath }
			: {}),
		files: parsed.files,
	});
	renderReviewContextResult(result, parsed.json);
	return result.status === "error" ? EXIT_CODES.FAILURE : EXIT_CODES.SUCCESS;
}

/**
 * Emit an error message in either structured JSON form or a human-readable line, then return the provided exit code.
 *
 * @param options - Configuration for the emitted error
 * @param options.json - When `true`, output a structured JSON error payload; otherwise output a plain error line
 * @param options.errorCode - Machine-readable error code included in the JSON payload
 * @param options.message - Human-readable error message to include in the output
 * @param options.exitCode - Exit code to return
 * @returns The `exitCode` value from `options`
 */
function emitError(options: {
	json: boolean;
	errorCode: string;
	message: string;
	exitCode: number;
}): number {
	if (options.json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: "review-context/v1",
					status: "error",
					source: "",
					repo: "unknown",
					changedFiles: [],
					applicableLearnings: [],
					validationPlan: [],
					networkRequired: [],
					reviewerLikelyConcerns: [],
					mustMentionInPr: [],
					evidenceRequired: [],
					knownRepeatedFailures: [],
					recommendedReviewers: [],
					doNotClaim: [],
					summary: {
						applicableLearnings: 0,
						validationCommands: 0,
						networkRequired: 0,
					},
					error: {
						code: options.errorCode,
						message: options.message,
					},
				},
				null,
				2,
			),
		);
	} else {
		console.error(`Error: ${options.message}`);
	}
	return options.exitCode;
}
