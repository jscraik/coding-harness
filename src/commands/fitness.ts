import { inspectFlagValue } from "../lib/cli/parse-utils.js";
import { buildFitnessReport } from "../lib/fitness/report.js";
import type { FitnessReport } from "../lib/fitness/types.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/** Run the repository fitness command. */
export function runFitnessCLI(args: string[]): number {
	const json = args.includes("--json");
	if (args.includes("--help") || args.includes("-h")) {
		printFitnessHelp();
		return EXIT_CODES.SUCCESS;
	}
	const architectureReportFlag = inspectFlagValue(
		args,
		"--architecture-report",
	);
	if (architectureReportFlag.missingValue) {
		return emitFitnessError({
			json,
			code: "fitness.architecture_report_required",
			message: "harness fitness requires a value after --architecture-report.",
			exitCode: EXIT_CODES.USAGE,
		});
	}
	try {
		const report = buildFitnessReport({
			...(architectureReportFlag.value
				? { architectureReportPath: architectureReportFlag.value }
				: {}),
		});
		renderFitnessReport(report, json);
		return report.status === "pass" || report.status === "warn"
			? EXIT_CODES.SUCCESS
			: EXIT_CODES.FAILURE;
	} catch (error) {
		return emitFitnessError({
			json,
			code: "fitness.report_unreadable",
			message:
				error instanceof Error
					? error.message
					: "Fitness report input could not be read.",
			exitCode: EXIT_CODES.FAILURE,
		});
	}
}

function printFitnessHelp(): void {
	console.info(
		"Usage: harness fitness [--json] [--architecture-report <path>]",
	);
	console.info("");
	console.info(
		"Build a normalized repository fitness report over existing harness gates.",
	);
	console.info("");
	console.info("Options:");
	console.info("  --json                         Emit machine-readable JSON");
	console.info(
		"  --architecture-report <path>   Ingest pnpm architecture:check JSON output",
	);
}

function renderFitnessReport(report: FitnessReport, json: boolean): void {
	if (json) {
		console.info(JSON.stringify(report, null, 2));
		return;
	}
	console.info(`Repository fitness: ${report.status}`);
	console.info(
		`Lanes: ${report.summary.lanes}; findings: ${report.summary.findings}; evidence needed: ${report.summary.lanesNeedingEvidence}`,
	);
	for (const lane of report.lanes) {
		console.info(`- ${lane.label}: ${lane.status} (${lane.command})`);
		for (const finding of lane.findings) {
			const file = finding.evidence.file ? ` [${finding.evidence.file}]` : "";
			console.info(
				`  ${finding.severity.toUpperCase()}: ${finding.title}${file}`,
			);
		}
	}
}

function emitFitnessError(options: {
	json: boolean;
	code: string;
	message: string;
	exitCode: number;
}): number {
	if (options.json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: "harness-fitness/v1",
					status: "error",
					error: { code: options.code, message: options.message },
				},
				null,
				2,
			),
		);
	} else {
		console.error(`Fitness Error: ${options.message}`);
	}
	return options.exitCode;
}
