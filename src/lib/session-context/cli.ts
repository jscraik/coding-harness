import { existsSync, statSync } from "node:fs";
import { inspectFlagValue } from "../cli/parse-utils.js";
import { collectSessionContext } from "./collector.js";
import type {
	SessionContextReport,
	SessionContextUsageError,
} from "./types.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/** Run the read-only session-context command from CLI arguments. */
export function runSessionContextCLI(args: string[]): number {
	const json = args.includes("--json");
	const repoRootFlag = inspectFlagValue(args, "--repo-root");
	if (repoRootFlag.missingValue) {
		return emitUsage(
			json,
			"session-context.flag_value_required",
			"harness session-context requires a value after --repo-root.",
		);
	}

	const targetDir = args.find((arg) => !arg.startsWith("-"));
	const repoRoot = repoRootFlag.value ?? targetDir ?? process.cwd();
	if (!isDirectory(repoRoot)) {
		return emitUsage(
			json,
			"session-context.invalid_repo_root",
			"harness session-context requires --repo-root to point at an existing directory.",
		);
	}

	const report = collectSessionContext({ repoRoot });
	if (json) {
		console.info(JSON.stringify(report, null, 2));
	} else {
		emitHumanReport(report);
	}
	return report.status === "fail" ? EXIT_CODES.FAILURE : EXIT_CODES.SUCCESS;
}

function emitHumanReport(report: SessionContextReport): void {
	console.info(`session-context: ${report.status}`);
	console.info(`schema: ${report.schemaVersion} (${report.evidenceUse})`);
	console.info(`repo: ${report.repository}`);
	console.info(`branch: ${report.branch ?? "unknown"}`);
	console.info(`head: ${report.headSha ?? "unknown"}`);
	console.info(`issue: ${report.issueRef ?? "unknown"}`);
	console.info(`active artifacts: ${report.activeArtifacts.length}`);
	console.info(`runtime cards: ${report.runtimeCards.length}`);
	console.info(`review artifacts: ${report.reviewArtifacts.length}`);
	console.info(`session evidence refs: ${report.sessionEvidence.length}`);
	if (report.staleState.length > 0) {
		console.info("stale state:");
		for (const state of report.staleState) {
			const reason = state.reason ? ` (${state.reason})` : "";
			console.info(`  - ${state.surface}: ${state.freshness}${reason}`);
		}
	}
	console.info("next traversal hints:");
	for (const hint of report.nextTraversalHints) {
		console.info(`  - ${hint.command} - ${hint.reason}`);
	}
}

function emitUsage(
	json: boolean,
	code: SessionContextUsageError["error"]["code"],
	message: string,
): number {
	if (json) {
		const payload: SessionContextUsageError = {
			schemaVersion: "session-context-error/v1",
			status: "error",
			error: { code, message },
		};
		console.info(JSON.stringify(payload, null, 2));
	} else {
		console.error(`Error: ${message}`);
	}
	return EXIT_CODES.USAGE;
}

function isDirectory(path: string): boolean {
	try {
		return existsSync(path) && statSync(path).isDirectory();
	} catch {
		return false;
	}
}
