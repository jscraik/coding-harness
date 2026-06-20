import { inspectFlagValue } from "../lib/cli/parse-utils.js";
import { buildFitnessReport } from "../lib/fitness/report.js";
import type { FitnessReport } from "../lib/fitness/types.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

type FitnessFlag = ReturnType<typeof inspectFlagValue>;

interface FitnessFlags {
	architectureReport: FitnessFlag;
	artifactsDir: FitnessFlag;
	qualitySizeReport: FitnessFlag;
	typecheckReport: FitnessFlag;
	lintReport: FitnessFlag;
	behaviorTestsReport: FitnessFlag;
	auditTrackingReport: FitnessFlag;
	advisoryReviewReport: FitnessFlag;
	trendBaseline: FitnessFlag;
}

interface MissingFitnessFlag {
	flag: FitnessFlag;
	code: string;
	name: string;
}

/** Run the repository fitness command. */
export function runFitnessCLI(args: string[]): number {
	const json = args.includes("--json");
	if (args.includes("--help") || args.includes("-h")) {
		printFitnessHelp();
		return EXIT_CODES.SUCCESS;
	}
	const flags = parseFitnessFlags(args);
	const missingFlag = missingFitnessFlag(flags);
	if (missingFlag) {
		return emitFitnessError({
			json,
			code: missingFlag.code,
			message: `harness fitness requires a value after ${missingFlag.name}.`,
			exitCode: EXIT_CODES.USAGE,
		});
	}
	try {
		const report = buildFitnessReport(fitnessReportOptions(flags));
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

function parseFitnessFlags(args: string[]): FitnessFlags {
	return {
		architectureReport: inspectFlagValue(args, "--architecture-report"),
		artifactsDir: inspectFlagValue(args, "--from-existing-artifacts"),
		qualitySizeReport: inspectFlagValue(args, "--quality-size-report"),
		typecheckReport: inspectFlagValue(args, "--typecheck-report"),
		lintReport: inspectFlagValue(args, "--lint-report"),
		behaviorTestsReport: inspectFlagValue(args, "--behavior-tests-report"),
		auditTrackingReport: inspectFlagValue(args, "--audit-tracking-report"),
		advisoryReviewReport: inspectFlagValue(args, "--advisory-review-report"),
		trendBaseline: inspectFlagValue(args, "--trend-baseline"),
	};
}

function missingFitnessFlag(
	flags: FitnessFlags,
): MissingFitnessFlag | undefined {
	return [
		{
			flag: flags.architectureReport,
			code: "fitness.architecture_report_required",
			name: "--architecture-report",
		},
		{
			flag: flags.artifactsDir,
			code: "fitness.artifacts_dir_required",
			name: "--from-existing-artifacts",
		},
		{
			flag: flags.qualitySizeReport,
			code: "fitness.quality_size_report_required",
			name: "--quality-size-report",
		},
		{
			flag: flags.typecheckReport,
			code: "fitness.typecheck_report_required",
			name: "--typecheck-report",
		},
		{
			flag: flags.lintReport,
			code: "fitness.lint_report_required",
			name: "--lint-report",
		},
		{
			flag: flags.behaviorTestsReport,
			code: "fitness.behavior_tests_report_required",
			name: "--behavior-tests-report",
		},
		{
			flag: flags.auditTrackingReport,
			code: "fitness.audit_tracking_report_required",
			name: "--audit-tracking-report",
		},
		{
			flag: flags.advisoryReviewReport,
			code: "fitness.advisory_review_report_required",
			name: "--advisory-review-report",
		},
		{
			flag: flags.trendBaseline,
			code: "fitness.trend_baseline_required",
			name: "--trend-baseline",
		},
	].find(({ flag }) => flag.missingValue);
}

function fitnessReportOptions(flags: FitnessFlags) {
	return {
		...(flags.artifactsDir.value
			? { artifactsDir: flags.artifactsDir.value }
			: {}),
		...(flags.architectureReport.value
			? { architectureReportPath: flags.architectureReport.value }
			: {}),
		...(flags.qualitySizeReport.value
			? { qualitySizeReportPath: flags.qualitySizeReport.value }
			: {}),
		...(flags.typecheckReport.value
			? { typecheckReportPath: flags.typecheckReport.value }
			: {}),
		...(flags.lintReport.value
			? { lintReportPath: flags.lintReport.value }
			: {}),
		...(flags.behaviorTestsReport.value
			? { behaviorTestsReportPath: flags.behaviorTestsReport.value }
			: {}),
		...(flags.auditTrackingReport.value
			? { auditTrackingReportPath: flags.auditTrackingReport.value }
			: {}),
		...(flags.advisoryReviewReport.value
			? { advisoryReviewReportPath: flags.advisoryReviewReport.value }
			: {}),
		...(flags.trendBaseline.value
			? { trendBaselinePath: flags.trendBaseline.value }
			: {}),
	};
}

function printFitnessHelp(): void {
	console.info(
		"Usage: harness fitness [--json] [--from-existing-artifacts <dir>] [artifact flags]",
	);
	console.info("");
	console.info(
		"Build a normalized repository fitness report over existing harness gates.",
	);
	console.info("");
	console.info("Options:");
	console.info("  --json                         Emit machine-readable JSON");
	console.info(
		"  --from-existing-artifacts <dir> Discover conventional gate JSON artifacts",
	);
	console.info(
		"  --architecture-report <path>   Ingest pnpm architecture:check JSON output",
	);
	console.info(
		"  --quality-size-report <path>   Ingest pnpm run quality:size JSON output",
	);
	console.info(
		"  --typecheck-report <path>      Ingest pnpm run fitness:typecheck-artifact output",
	);
	console.info(
		"  --lint-report <path>           Ingest pnpm run fitness:lint-artifact output",
	);
	console.info(
		"  --behavior-tests-report <path> Ingest pnpm run quality:behavior-tests JSON output",
	);
	console.info(
		"  --audit-tracking-report <path> Ingest pnpm run harness:audit-tracking JSON output",
	);
	console.info(
		"  --advisory-review-report <path> Ingest structured AI review output as advisory",
	);
	console.info(
		"  --trend-baseline <path>       Compare against a previous harness-fitness/v1 report",
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
					schemaVersion: "harness-cli-error/v1",
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
