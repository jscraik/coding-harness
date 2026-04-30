import { buildValidationPlan } from "../lib/learnings/validation-plan.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/** Run the `harness validation-plan` command. */
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

function readRequiredFlag(
	args: string[],
	flag: string,
): { ok: true; value: string } | { ok: false } {
	const value = readOptionalFlag(args, flag).value;
	return value === undefined ? { ok: false } : { ok: true, value };
}

function readOptionalFlag(args: string[], flag: string): { value?: string } {
	const index = args.indexOf(flag);
	if (index === -1) return {};
	const value = args[index + 1];
	if (value === undefined || value.startsWith("-")) return {};
	return { value };
}

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
