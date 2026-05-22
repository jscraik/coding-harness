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

/** Parse command runtime observations and print a command-runtime-budget/v1 report. */
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

function readObservations(
	inputPath: string,
	json: boolean,
): CommandRuntimeBudgetObservation[] | null {
	if (!existsSync(inputPath)) {
		emitUsage(json, `runtime-budget input file is missing: ${inputPath}`);
		return null;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
	} catch {
		emitUsage(
			json,
			`runtime-budget input file is malformed JSON: ${inputPath}`,
		);
		return null;
	}
	if (Array.isArray(parsed)) {
		return validateObservations(parsed, json);
	}
	if (
		typeof parsed === "object" &&
		parsed !== null &&
		Array.isArray((parsed as { observations?: unknown }).observations)
	) {
		return validateObservations(
			(parsed as { observations: unknown[] }).observations,
			json,
		);
	}
	emitUsage(
		json,
		"runtime-budget input must be an array or object with observations.",
	);
	return null;
}

function validateObservations(
	observations: unknown[],
	json: boolean,
): CommandRuntimeBudgetObservation[] | null {
	const normalized: CommandRuntimeBudgetObservation[] = [];
	for (const [index, observation] of observations.entries()) {
		if (!isObservationRecord(observation)) {
			emitUsage(json, `runtime-budget observations[${index}] is malformed.`);
			return null;
		}
		normalized.push(observation);
	}
	return normalized;
}

function isObservationRecord(
	value: unknown,
): value is CommandRuntimeBudgetObservation {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.command === "string" &&
		typeof candidate.durationMs === "number" &&
		typeof candidate.budgetMs === "number" &&
		typeof candidate.evidenceRef === "string"
	);
}

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
