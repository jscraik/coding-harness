import { buildValidationPlan } from "../lib/learnings/validation-plan.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/**
 * Handle the `harness validation-plan` CLI command.
 *
 * Parses `args` for the flags `--json` (output as JSON), optional `--source <value>`, and required `--files <comma-separated>`.
 *
 * @param args - Command-line arguments passed to the command; expects `--files` with a comma-separated list of file paths, optionally `--source <value>`, and optionally `--json`.
 * @returns CLI exit code: `0` on success, `1` if the validation plan failed, `2` for usage errors (e.g., missing or empty `--files`).
 */
export function runValidationPlanCLI(args: string[]): number {
	const json = args.includes("--json");
	const source = readOptionalFlag(args, "--source").value;
	const files = readRequiredFlag(args, "--files");
	if (!files.ok) {
		return emitError({
			json,
			errorCode: "validation-plan.files_required",
			message: "harness validation-plan requires --files.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const parsedFiles = files.value
		.split(",")
		.map((file) => file.trim())
		.filter((file) => file.length > 0);
	if (parsedFiles.length === 0) {
		return emitError({
			json,
			errorCode: "validation-plan.files_required",
			message: "harness validation-plan requires at least one file in --files.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const result = buildValidationPlan({
		...(source ? { source } : {}),
		files: parsedFiles,
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
 * Retrieves the value for a required CLI flag from an argument list.
 *
 * @param args - Argument vector to search (e.g., process.argv.slice(2))
 * @param flag - Flag name to find (e.g., "--files")
 * @returns `{ ok: true, value }` when the flag is present and followed by a non-flag value, `{ ok: false }` when the flag is absent or not followed by a valid value
 */
function readRequiredFlag(
	args: string[],
	flag: string,
): { ok: true; value: string } | { ok: false } {
	const value = readOptionalFlag(args, flag).value;
	return value === undefined ? { ok: false } : { ok: true, value };
}

/**
 * Finds `flag` in an argv-style `args` array and, if present, returns the next token as its value.
 *
 * @param args - Argument list to search (e.g., process.argv slice)
 * @param flag - Flag to locate (exact match)
 * @returns An object containing `value` when the flag has a following token that is not undefined and does not start with `-`; otherwise an empty object
 */
function readOptionalFlag(args: string[], flag: string): { value?: string } {
	const index = args.indexOf(flag);
	if (index === -1) return {};
	const value = args[index + 1];
	if (value === undefined || value.startsWith("-")) return {};
	return { value };
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
