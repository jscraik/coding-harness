import {
	type FeedbackLoopAuditReport,
	FEEDBACK_LOOP_AUDIT_SCHEMA_VERSION,
	buildFeedbackLoopAudit,
} from "./feedback-loop-audit.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

type ParsedFeedbackLoopAuditArgs =
	| {
			ok: true;
			json: boolean;
			repoRoot?: string;
			indexPath?: string;
	  }
	| {
			ok: false;
			json: boolean;
			message: string;
	  };

function parseFeedbackLoopAuditArgs(
	args: string[],
): ParsedFeedbackLoopAuditArgs {
	let json = false;
	let repoRoot: string | undefined;
	let indexPath: string | undefined;
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--json") {
			json = true;
			continue;
		}
		if (arg === "--repo-root" || arg === "--index") {
			const value = args[index + 1];
			if (value === undefined || value.startsWith("-")) {
				return { ok: false, json, message: `${arg} requires a value.` };
			}
			if (arg === "--repo-root") {
				repoRoot = value;
			} else {
				indexPath = value;
			}
			index += 1;
			continue;
		}
		return { ok: false, json, message: `Unknown argument: ${arg}` };
	}
	return {
		ok: true,
		json,
		...(repoRoot !== undefined ? { repoRoot } : {}),
		...(indexPath !== undefined ? { indexPath } : {}),
	};
}

function emitUsageError(json: boolean, message: string): number {
	if (json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: FEEDBACK_LOOP_AUDIT_SCHEMA_VERSION,
					status: "fail",
					error: {
						code: "feedback_loop_audit_usage",
						message,
					},
				},
				null,
				2,
			),
		);
	} else {
		console.error(`Error: ${message}`);
	}
	return EXIT_CODES.USAGE;
}

function renderTextReport(report: FeedbackLoopAuditReport): string {
	return [
		`Feedback-loop audit: ${report.status}`,
		"Loops implemented: " +
			report.summary.implementedLoopCount.toString() +
			"/" +
			report.summary.loopCount.toString(),
		"Cross-loop gaps implemented: " +
			report.summary.implementedGapCount.toString() +
			"/" +
			report.summary.crossLoopGapCount.toString(),
		"Recommendations implemented: " +
			report.summary.implementedRecommendationCount.toString() +
			"/" +
			report.summary.recommendationCount.toString(),
		`Open findings: ${report.summary.openFindingCount.toString()}`,
		`Index: ${report.indexPath}`,
	].join("\n");
}

/**
 * Execute the read-only feedback-loop audit CLI.
 *
 * @param args - Command-line arguments after the command token
 * @returns 0 when all audit findings are closed, 1 when the report fails, or 2 for usage errors
 */
export function runFeedbackLoopAuditCLI(args: string[]): number {
	const parsed = parseFeedbackLoopAuditArgs(args);
	if (!parsed.ok) {
		return emitUsageError(parsed.json, parsed.message);
	}
	const report = buildFeedbackLoopAudit({
		...(parsed.repoRoot !== undefined ? { repoRoot: parsed.repoRoot } : {}),
		...(parsed.indexPath !== undefined ? { indexPath: parsed.indexPath } : {}),
	});
	if (parsed.json) {
		console.info(JSON.stringify(report, null, 2));
	} else {
		console.info(renderTextReport(report));
	}
	return report.status === "pass" ? EXIT_CODES.SUCCESS : EXIT_CODES.FAILURE;
}
