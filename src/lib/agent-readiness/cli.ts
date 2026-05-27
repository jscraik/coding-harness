import { inspectFlagValue } from "../cli/parse-utils.js";
import { assessAgentReadiness } from "./checker.js";
import type { AgentReadinessUsageError } from "./types.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/**
 * Run the read-only agent-readiness audit from CLI arguments.
 *
 * @param args - Command-line arguments, supporting path, --repo-root, and --json.
 * @returns Exit code: 0 for pass/warn, 1 for fail, and 2 for usage errors.
 */
export function runAgentReadinessCLI(args: string[]): number {
	const json = args.includes("--json");
	const repoRootFlag = inspectFlagValue(args, "--repo-root");
	if (repoRootFlag.missingValue) {
		return emitUsage(
			json,
			"harness agent-readiness requires a value after --repo-root.",
		);
	}

	const targetDir = args.find((arg) => !arg.startsWith("-"));
	const report = assessAgentReadiness({
		repoRoot: repoRootFlag.value ?? targetDir,
	});

	if (json) {
		console.info(JSON.stringify(report, null, 2));
	} else {
		emitHumanReport(report);
	}

	return report.status === "fail" ? EXIT_CODES.FAILURE : EXIT_CODES.SUCCESS;
}

function emitHumanReport(
	report: ReturnType<typeof assessAgentReadiness>,
): void {
	console.info(`agent-readiness: ${report.status}`);
	console.info(
		`summary: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail`,
	);
	console.info(
		`context-health: ${report.contextHealth.status} (${report.contextHealth.schemaVersion}, ${report.contextHealth.evidenceUse})`,
	);
	if (report.contextHealth.suggestedRefreshCommands.length > 0) {
		console.info("context-refresh options:");
		for (const command of report.contextHealth.suggestedRefreshCommands) {
			console.info(`  - ${command}`);
		}
	}
	for (const finding of report.findings) {
		const evidence =
			finding.evidence.length > 0 ? ` [${finding.evidence.join(", ")}]` : "";
		console.info(
			`- ${finding.status} ${finding.category}/${finding.id}: ${finding.message}${evidence}`,
		);
	}
}

function emitUsage(json: boolean, message: string): number {
	if (json) {
		const payload: AgentReadinessUsageError = {
			schemaVersion: "agent-readiness-error/v1",
			status: "error",
			error: {
				code: "agent-readiness.flag_value_required",
				message,
			},
		};
		console.info(JSON.stringify(payload, null, 2));
	} else {
		console.error(`Error: ${message}`);
	}
	return EXIT_CODES.USAGE;
}
