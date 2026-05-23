import { existsSync, readFileSync } from "node:fs";
import { inspectFlagValue, parseIntegerArg } from "../lib/cli/parse-utils.js";
import {
	buildCommandRuntimeBudgetReport,
	validateCommandRuntimeBudgetReport,
	type CommandRuntimeBudgetObservation,
} from "../lib/runtime/command-runtime-budget.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/**
 * Parse CLI arguments for the runtime-budget command, produce a `command-runtime-budget/v1` report, print the report (JSON or human-readable), and return an exit code.
 *
 * @param args - The command-line arguments to parse (e.g., process.argv.slice(2)).
 * @returns `0` when the report status is "pass", `1` when the report status is "fail", `2` for usage or input errors.
 */
export function runRuntimeBudgetCLI(args: string[]): number {
	const json = args.includes("--json");
	const inputFlag = inspectFlagValue(args, "--input");
	const commandFlag = inspectFlagValue(args, "--command");
	const durationFlag = inspectFlagValue(args, "--duration-ms");
	const budgetFlag = inspectFlagValue(args, "--budget-ms");
	const evidenceFlag = inspectFlagValue(args, "--evidence-ref");
	const missingFlag = [
		{ flag: "--input", inspection: inputFlag },
		{ flag: "--command", inspection: commandFlag },
		{ flag: "--duration-ms", inspection: durationFlag },
		{ flag: "--budget-ms", inspection: budgetFlag },
		{ flag: "--evidence-ref", inspection: evidenceFlag },
	].find(({ inspection }) => inspection.missingValue);

	if (missingFlag) {
		return emitUsage(
			json,
			`runtime-budget requires a value after ${missingFlag.flag}.`,
		);
	}

	const observations = inputFlag.value
		? readObservations(inputFlag.value, json)
		: observationFromFlags(
				commandFlag.value,
				durationFlag.value,
				budgetFlag.value,
				evidenceFlag.value,
			);
	if (observations === null) {
		return EXIT_CODES.USAGE;
	}

	const report = buildCommandRuntimeBudgetReport(observations);
	const errors = validateCommandRuntimeBudgetReport(report);
	if (errors.length > 0) {
		return emitUsage(json, errors.join("; "));
	}

	if (json) {
		console.info(JSON.stringify(report, null, 2));
	} else if (report.status === "pass") {
		console.info("runtime-budget: pass");
	} else {
		console.error("runtime-budget: fail");
		for (const breach of report.breaches) {
			console.error(`- ${breach.command} exceeded ${breach.budgetMs}ms`);
		}
	}
	return report.status === "pass" ? EXIT_CODES.SUCCESS : EXIT_CODES.FAILURE;
}

/**
 * Build a single runtime budget observation from raw CLI flag values or return `null` if inputs are missing/invalid.
 *
 * @param command - The command string from `--command`
 * @param duration - The duration value from `--duration-ms` (string form); expected to parse to an integer number of milliseconds
 * @param budget - The budget value from `--budget-ms` (string form); expected to parse to an integer number of milliseconds
 * @param evidenceRef - The evidence reference from `--evidence-ref`
 * @returns A single-element `CommandRuntimeBudgetObservation[]` with parsed `durationMs` and `budgetMs`, or `null` if any required flag is missing or integer parsing fails
 */
function observationFromFlags(
	command: string | undefined,
	duration: string | undefined,
	budget: string | undefined,
	evidenceRef: string | undefined,
): CommandRuntimeBudgetObservation[] | null {
	const durationMs = parseIntegerArg(duration, 0);
	const budgetMs = parseIntegerArg(budget, 1);
	if (
		!command ||
		durationMs === undefined ||
		budgetMs === undefined ||
		!evidenceRef
	) {
		return null;
	}
	return [{ command, durationMs, budgetMs, evidenceRef }];
}

/**
 * Load command runtime budget observations from a JSON file.
 *
 * Attempts to read and parse `inputPath` as JSON. If the top-level value is an
 * array it is returned as the observations array. If the top-level value is
 * an object with an `observations` array property, that array is returned.
 * On missing file or unexpected JSON shape this emits a usage error (JSON or
 * plain text depending on `json`) and returns `null`.
 *
 * @param inputPath - Filesystem path to the JSON input file
 * @param json - If `true`, format usage/error output as JSON
 * @returns The parsed `CommandRuntimeBudgetObservation[]` on success, or `null` on error
 */
function readObservations(
	inputPath: string,
	json: boolean,
): CommandRuntimeBudgetObservation[] | null {
	if (!existsSync(inputPath)) {
		emitUsage(json, `runtime-budget input file is missing: ${inputPath}`);
		return null;
	}
	const parsed = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
	if (Array.isArray(parsed)) {
		return parsed as CommandRuntimeBudgetObservation[];
	}
	if (
		typeof parsed === "object" &&
		parsed !== null &&
		Array.isArray((parsed as { observations?: unknown }).observations)
	) {
		return (parsed as { observations: CommandRuntimeBudgetObservation[] })
			.observations;
	}
	emitUsage(
		json,
		"runtime-budget input must be an array or object with observations.",
	);
	return null;
}

/**
 * Emit a usage-formatted error message and return the usage exit code.
 *
 * @param json - If true, output a JSON error object; otherwise print a human-readable error to stderr
 * @param message - The error message to include in the output
 * @returns The usage exit code (2)
 */
function emitUsage(json: boolean, message: string): number {
	if (json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: "command-runtime-budget/v1",
					status: "error",
					error: { code: "runtime-budget.usage", message },
				},
				null,
			),
		);
	} else {
		console.error(`Runtime Budget Error: ${message}`);
	}
	return EXIT_CODES.USAGE;
}
