import { buildReviewContext } from "../lib/learnings/review-context.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

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
	const json = args.includes("--json");
	const sourceFlag = readOptionalFlag(args, "--source");
	const outputFlag = readOptionalFlag(args, "--output");
	const repoRootFlag = readOptionalFlag(args, "--repo-root");
	const enforcementStatusFlag = readOptionalFlag(args, "--enforcement-status");
	const missingValueFlag = [
		sourceFlag,
		outputFlag,
		repoRootFlag,
		enforcementStatusFlag,
	].find((flag) => flag.present && flag.value === undefined);
	if (missingValueFlag) {
		return emitError({
			json,
			errorCode: "review-context.flag_value_required",
			message: `harness review-context requires a value after ${missingValueFlag.flag}.`,
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const source = sourceFlag.value;
	const output = outputFlag.value;
	const repoRoot = repoRootFlag.value;
	const enforcementStatusPath = enforcementStatusFlag.value;
	const files = readRequiredFlag(args, "--files");
	if (!files.ok) {
		return emitError({
			json,
			errorCode: "review-context.files_required",
			message: "harness review-context requires --files.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const parsedFiles = files.value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	if (parsedFiles.length === 0) {
		return emitError({
			json,
			errorCode: "review-context.files_required",
			message: "harness review-context requires at least one file in --files.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const result = buildReviewContext({
		...(source ? { source } : {}),
		...(output ? { output } : {}),
		...(repoRoot ? { repoRoot } : {}),
		...(enforcementStatusPath ? { enforcementStatusPath } : {}),
		files: parsedFiles,
	});
	if (json) {
		console.info(JSON.stringify(result, null, 2));
	} else if (result.status === "error") {
		console.error(
			`Error: ${result.error?.message ?? "Review context failed."}`,
		);
	} else {
		console.info(
			[
				`Applicable learnings: ${result.summary.applicableLearnings}`,
				`Validation commands: ${result.summary.validationCommands}`,
				...(result.outputPath ? [`Artifact: ${result.outputPath}`] : []),
			].join("\n"),
		);
	}
	return result.status === "error" ? EXIT_CODES.FAILURE : EXIT_CODES.SUCCESS;
}

/**
 * Retrieves the value for a required command-line flag from an argv-style array.
 *
 * @param args - The argument list to search (e.g., process.argv.slice(2))
 * @param flag - The flag token to find (e.g., `--files`)
 * @returns `{ ok: true, value }` when `flag` is present and followed by a non-flag value, `{ ok: false }` when the flag is missing or has no valid value
 */
function readRequiredFlag(
	args: string[],
	flag: string,
): { ok: true; value: string } | { ok: false } {
	const value = readOptionalFlag(args, flag).value;
	return value === undefined ? { ok: false } : { ok: true, value };
}

/**
 * Read an optional flag value from an argv-style array.
 *
 * Finds `flag` in `args` and, if a following argument exists and does not start with `-`,
 * returns it as `value`.
 *
 * @param args - The command-line arguments array to search.
 * @param flag - The flag name to locate (for example, `--files`).
 * @returns An object with `value` set to the flag's argument when present and not another flag; otherwise an empty object.
 */
function readOptionalFlag(
	args: string[],
	flag: string,
): { present: boolean; flag: string; value?: string } {
	const index = args.indexOf(flag);
	if (index === -1) return { present: false, flag };
	const value = args[index + 1];
	if (value === undefined || value.startsWith("-")) {
		return { present: true, flag };
	}
	return { present: true, flag, value };
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
