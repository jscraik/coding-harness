import { inspectFlagValue } from "../lib/cli/parse-utils.js";
import { createCliErrorEnvelope } from "../lib/cli/error-envelope.js";
import { FITNESS_COMMANDS } from "../lib/fitness/commands.js";
import { buildFitnessReport } from "../lib/fitness/report.js";
import type { FitnessReport } from "../lib/fitness/types.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

type FitnessFlag = ReturnType<typeof inspectFlagValue>;

const FITNESS_REQUIRED_FLAGS = [
	{
		key: "architectureReport",
		flag: "--architecture-report",
		code: "fitness.architecture_report_required",
		help:
			"  --architecture-report <path>   Ingest " +
			FITNESS_COMMANDS.ARCHITECTURE_CHECK +
			" JSON output",
	},
	{
		key: "artifactsDir",
		flag: "--from-existing-artifacts",
		code: "fitness.artifacts_dir_required",
		help: "  --from-existing-artifacts <dir> Discover conventional gate JSON artifacts",
	},
	{
		key: "qualitySizeReport",
		flag: "--quality-size-report",
		code: "fitness.quality_size_report_required",
		help:
			"  --quality-size-report <path>   Ingest " +
			FITNESS_COMMANDS.QUALITY_SIZE +
			" JSON output",
	},
	{
		key: "typecheckReport",
		flag: "--typecheck-report",
		code: "fitness.typecheck_report_required",
		help:
			"  --typecheck-report <path>      Ingest " +
			FITNESS_COMMANDS.TYPECHECK_ARTIFACT +
			" output",
	},
	{
		key: "lintReport",
		flag: "--lint-report",
		code: "fitness.lint_report_required",
		help:
			"  --lint-report <path>           Ingest " +
			FITNESS_COMMANDS.LINT_ARTIFACT +
			" output",
	},
	{
		key: "behaviorTestsReport",
		flag: "--behavior-tests-report",
		code: "fitness.behavior_tests_report_required",
		help:
			"  --behavior-tests-report <path> Ingest " +
			FITNESS_COMMANDS.BEHAVIOR_TESTS +
			" JSON output",
	},
	{
		key: "auditTrackingReport",
		flag: "--audit-tracking-report",
		code: "fitness.audit_tracking_report_required",
		help:
			"  --audit-tracking-report <path> Ingest " +
			FITNESS_COMMANDS.AUDIT_TRACKING +
			" JSON output",
	},
	{
		key: "agentRoutingReport",
		flag: "--agent-routing-report",
		code: "fitness.agent_routing_report_required",
		help: "  --agent-routing-report <path> Ingest pnpm run coding-policy:route JSON output",
	},
	{
		key: "documentationLifecycleReport",
		flag: "--documentation-lifecycle-report",
		code: "fitness.documentation_lifecycle_report_required",
		help: "  --documentation-lifecycle-report <path> Ingest pnpm run docs:lifecycle JSON output",
	},
	{
		key: "testConfidenceReport",
		flag: "--test-confidence-report",
		code: "fitness.test_confidence_report_required",
		help: "  --test-confidence-report <path> Ingest pnpm run quality:self-affirming JSON output",
	},
	{
		key: "programDesignReport",
		flag: "--program-design-report",
		code: "fitness.program_design_report_required",
		help: "  --program-design-report <path> Ingest pnpm run quality:debt JSON output",
	},
	{
		key: "advisoryReviewReport",
		flag: "--advisory-review-report",
		code: "fitness.advisory_review_report_required",
		help: "  --advisory-review-report <path> Ingest structured AI review output as advisory",
	},
	{
		key: "trendBaseline",
		flag: "--trend-baseline",
		code: "fitness.trend_baseline_required",
		help: "  --trend-baseline <path>       Compare against a previous harness-fitness/v1 report",
	},
] as const;

type FitnessRequiredFlag = (typeof FITNESS_REQUIRED_FLAGS)[number];
type FitnessFlagKey = FitnessRequiredFlag["key"];

interface FitnessFlags {
	architectureReport: FitnessFlag;
	artifactsDir: FitnessFlag;
	qualitySizeReport: FitnessFlag;
	typecheckReport: FitnessFlag;
	lintReport: FitnessFlag;
	behaviorTestsReport: FitnessFlag;
	auditTrackingReport: FitnessFlag;
	agentRoutingReport: FitnessFlag;
	documentationLifecycleReport: FitnessFlag;
	testConfidenceReport: FitnessFlag;
	programDesignReport: FitnessFlag;
	advisoryReviewReport: FitnessFlag;
	trendBaseline: FitnessFlag;
}

interface MissingFitnessFlag {
	flag: FitnessFlag;
	code: string;
	name: string;
}

const FITNESS_PATH_OPTIONS = [
	["architectureReport", "architectureReportPath"],
	["qualitySizeReport", "qualitySizeReportPath"],
	["typecheckReport", "typecheckReportPath"],
	["lintReport", "lintReportPath"],
	["behaviorTestsReport", "behaviorTestsReportPath"],
	["auditTrackingReport", "auditTrackingReportPath"],
	["agentRoutingReport", "agentRoutingReportPath"],
	["documentationLifecycleReport", "documentationLifecycleReportPath"],
	["testConfidenceReport", "testConfidenceReportPath"],
	["programDesignReport", "programDesignReportPath"],
	["advisoryReviewReport", "advisoryReviewReportPath"],
	["trendBaseline", "trendBaselinePath"],
] as const;

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

/** Parse required fitness artifact flags from command arguments. */
function parseFitnessFlags(args: string[]): FitnessFlags {
	const flags = {} as FitnessFlags;
	for (const { key, flag } of FITNESS_REQUIRED_FLAGS) {
		flags[key as FitnessFlagKey] = inspectFlagValue(args, flag);
	}
	return flags;
}

/** Return the first required fitness flag that was provided without a value. */
function missingFitnessFlag(
	flags: FitnessFlags,
): MissingFitnessFlag | undefined {
	return FITNESS_REQUIRED_FLAGS.map(({ key, code, flag }) => ({
		flag: flags[key as FitnessFlagKey],
		code,
		name: flag,
	})).find(({ flag }) => flag.missingValue);
}

/** Map parsed CLI flags into the normalized fitness report options. */
function fitnessReportOptions(flags: FitnessFlags) {
	const options: Record<string, string> = {};
	if (flags.artifactsDir.value) options.artifactsDir = flags.artifactsDir.value;
	for (const [flagKey, optionKey] of FITNESS_PATH_OPTIONS) {
		const value = flags[flagKey].value;
		if (value) options[optionKey] = value;
	}
	return options;
}

/** Print human-readable usage for the fitness command. */
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
	for (const { help } of FITNESS_REQUIRED_FLAGS) {
		console.info(help);
	}
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

/** Emit a fitness command error in JSON or text form and return its exit code. */
function emitFitnessError(options: {
	json: boolean;
	code: string;
	message: string;
	exitCode: number;
}): number {
	if (options.json) {
		console.info(
			JSON.stringify(
				createCliErrorEnvelope({
					code: options.code,
					message: options.message,
				}),
				null,
				2,
			),
		);
	} else {
		console.error(`Fitness Error: ${options.message}`);
	}
	return options.exitCode;
}
