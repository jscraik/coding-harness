import { inspectFlagList, inspectFlagValue } from "../lib/cli/parse-utils.js";
import { buildValidationPlan } from "../lib/learnings/validation-plan.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/**
 * Handle the `harness validation-plan` CLI command.
 *
 * Parses `args` for the flags `--json` (output as JSON), optional `--source <value>`, and required `--files <value...>`.
 *
 * @param args - Command-line arguments passed to the command; expects `--files` with comma-separated paths or multiple following path tokens, optionally `--source <value>`, and optionally `--json`.
 * @returns CLI exit code: `0` on success, `1` if the validation plan failed, `2` for usage errors (e.g., missing or empty `--files`).
 */
export function runValidationPlanCLI(args: string[]): number {
	const json = args.includes("--json");
	const sourceFlag = inspectFlagValue(args, "--source");
	if (sourceFlag.missingValue) {
		return emitError({
			json,
			errorCode: "validation-plan.flag_value_required",
			message: "harness validation-plan requires a value after --source.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const source = sourceFlag.value;
	const files = inspectFlagList(args, "--files");
	if (!files.present || files.missingValue) {
		return emitError({
			json,
			errorCode: "validation-plan.files_required",
			message: "harness validation-plan requires --files.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const result = buildValidationPlan({
		...(source ? { source } : {}),
		files: files.values,
	});
	if (json) {
		console.info(JSON.stringify(result, null, 2));
	} else if (result.status === "error") {
		console.error(
			`Error: ${result.error?.message ?? "Validation plan failed."}`,
		);
	} else {
		console.info(
			[
				`Validation commands: ${result.summary.commands}`,
				`Network-required commands: ${result.summary.networkRequired}`,
			].join("\n"),
		);
	}
	return result.status === "error" ? EXIT_CODES.FAILURE : EXIT_CODES.SUCCESS;
}

/**
 * Emit an error response (JSON or plain text) and return the specified exit code.
 *
 * If `options.json` is true, writes a structured validation-plan error payload to stdout;
 * otherwise writes `Error: <message>` to stderr.
 *
 * @param options - Configuration for the emitted error
 * @param options.json - When true, output a structured JSON payload to stdout
 * @param options.errorCode - Machine-readable error code included in the JSON payload
 * @param options.message - Human-readable error message
 * @param options.exitCode - Exit code to return
 * @returns The `options.exitCode` value
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
					schemaVersion: "validation-plan/v1",
					status: "error",
					source: "",
					changedFiles: [],
					commands: [],
					networkRequired: [],
					summary: {
						commands: 0,
						networkRequired: 0,
						matchedLearnings: 0,
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
