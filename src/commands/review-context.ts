import { buildReviewContext } from "../lib/learnings/review-context.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/** Run the `harness review-context` command. */
export function runReviewContextCLI(args: string[]): number {
	const json = args.includes("--json");
	const source = readOptionalFlag(args, "--source").value;
	const output = readOptionalFlag(args, "--output").value;
	const repoRoot = readOptionalFlag(args, "--repo-root").value;
	const enforcementStatusPath = readOptionalFlag(
		args,
		"--enforcement-status",
	).value;
	const files = readRequiredFlag(args, "--files");
	if (!files.ok) {
		return emitError({
			json,
			errorCode: "review-context.files_required",
			message: "harness review-context requires --files.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	const result = buildReviewContext({
		...(source ? { source } : {}),
		...(output ? { output } : {}),
		...(repoRoot ? { repoRoot } : {}),
		...(enforcementStatusPath ? { enforcementStatusPath } : {}),
		files: files.value.split(","),
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
