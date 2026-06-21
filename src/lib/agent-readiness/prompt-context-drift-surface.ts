import { readCurrentHeadSha } from "../prompt-context-drift/git-head.js";
import {
	PROMPT_CONTEXT_DRIFT_REPORT_PATHS,
	PROMPT_CONTEXT_DRIFT_SURFACES,
	type PromptContextDriftBlocker,
	type PromptContextDriftNextActionClass,
	validatePromptContextDriftReport,
} from "../prompt-context-drift/index.js";
import {
	promptContextDriftReportEvidence,
	readPromptContextDriftReport,
} from "./prompt-context-drift-report-reader.js";
import type {
	AgentReadinessContextSurface,
	AgentReadinessStatus,
} from "./types.js";

const WRITE_COMMAND = "harness prompt-context-drift:write";
const VALIDATE_COMMAND =
	"harness prompt-context-drift:validate artifacts/context-integrity/prompt-context-drift-report.json";
const ACTIVE_ARTIFACT_REFRESH_COMMAND =
	"harness artifact-routine --active-index .harness/active-artifacts.md --json";
const PROJECT_BRAIN_REFRESH_COMMAND = "harness brain status --json";
const RUNTIME_CARD_REFRESH_COMMAND =
	"harness runtime-card --json --repo . --out artifacts/runtime-card.json";
const writeCommandFor = (reportPath: string) =>
	`harness prompt-context-drift:write --output ${reportPath}`;
const validateCommandFor = (reportPath: string) =>
	`harness prompt-context-drift:validate ${reportPath}`;
const CANONICAL_REPORT = PROMPT_CONTEXT_DRIFT_REPORT_PATHS[0];

/** Project prompt-context drift evidence into the agent-readiness context surface. */
export function promptContextDriftSurface(
	repoRoot: string,
): AgentReadinessContextSurface {
	const reportEvidence = promptContextDriftReportEvidence(repoRoot);
	if (reportEvidence.length === 0) {
		return contextSurface({
			status: "warn",
			evidence: [`missing:${CANONICAL_REPORT}`],
			staleReasons: [
				"No prompt-context-drift report was provided for agent-readable orientation.",
			],
		});
	}
	if (reportEvidence.length > 1) {
		return contextSurface({
			status: "warn",
			evidence: reportEvidence,
			staleReasons: [
				"Multiple prompt-context-drift reports were discovered; keep a single canonical artifacts/context-integrity/prompt-context-drift-report.json report before using this surface.",
			],
			suggestedRefreshCommands: duplicateReportCleanupCommands(reportEvidence),
		});
	}
	const reportStatus = promptContextDriftReportStatus(
		readPromptContextDriftReport(repoRoot, reportEvidence[0] ?? ""),
		repoRoot,
		reportEvidence[0] ?? "",
	);
	return contextSurface({
		status: reportStatus.status,
		evidence: reportEvidence,
		staleReasons: reportStatus.staleReasons,
		suggestedRefreshCommands:
			reportStatus.suggestedRefreshCommands ??
			refreshCommandsFor(reportEvidence[0] ?? ""),
	});
}

function refreshCommandsFor(reportPath: string): string[] {
	return reportPath === CANONICAL_REPORT
		? [WRITE_COMMAND, VALIDATE_COMMAND]
		: [writeCommandFor(reportPath), validateCommandFor(reportPath)];
}

function duplicateReportCleanupCommands(
	reportPaths: readonly string[],
): string[] {
	const survivor = reportPaths.includes(CANONICAL_REPORT)
		? CANONICAL_REPORT
		: reportPaths.at(-1);
	return reportPaths
		.filter((reportPath) => reportPath !== survivor)
		.map((reportPath) => `rm ${reportPath}`);
}

function promptContextDriftReportStatus(
	text: string,
	repoRoot: string,
	reportPath: string,
): {
	status: AgentReadinessStatus;
	staleReasons: string[];
	suggestedRefreshCommands?: string[] | undefined;
} {
	if (text.length === 0) {
		return {
			status: "warn",
			staleReasons: ["Prompt-context-drift report is empty."],
		};
	}
	try {
		const parsed = JSON.parse(text) as {
			blockers?: unknown;
			currentHeadSha?: unknown;
			overallStatus?: unknown;
			surfaces?: unknown;
		};
		const validation = validatePromptContextDriftReport(parsed, { repoRoot });
		if (validation.status !== "pass") {
			return {
				status: "warn",
				staleReasons: [
					`Prompt-context-drift report failed validation: ${validation.errors[0] ?? "unknown validation error"}.`,
				],
			};
		}
		const liveHeadError = liveHeadBindingError(parsed, repoRoot);
		if (liveHeadError !== null) {
			return { status: "warn", staleReasons: [liveHeadError] };
		}
		const consistencyError = reportPassConsistencyError(parsed);
		if (consistencyError !== null) {
			return { status: "warn", staleReasons: [consistencyError] };
		}
		return parsed.overallStatus === "pass"
			? { status: "pass", staleReasons: [] }
			: {
					status: "warn",
					staleReasons: [
						"Prompt-context-drift report is not pass for orientation.",
					],
					suggestedRefreshCommands: repairCommandsForReportBlockers(
						parsed,
						reportPath,
					),
				};
	} catch (error) {
		return {
			status: "warn",
			staleReasons: [
				`Prompt-context-drift report is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
			],
		};
	}
}

function repairCommandsForReportBlockers(
	report: { blockers?: unknown },
	reportPath: string,
): string[] {
	const repairCommands = blockerRepairCommands(report.blockers);
	return repairCommands.length > 0
		? repairCommands
		: refreshCommandsFor(reportPath);
}

function blockerRepairCommands(blockers: unknown): string[] {
	if (!Array.isArray(blockers)) return [];
	return uniqueStrings(
		blockers.flatMap((blocker) =>
			isPromptContextDriftBlocker(blocker)
				? repairCommandsForNextAction(blocker.nextActionClass)
				: [],
		),
	);
}

function repairCommandsForNextAction(
	nextActionClass: PromptContextDriftNextActionClass,
): string[] {
	switch (nextActionClass) {
		case "refresh_active_artifacts":
			return [ACTIVE_ARTIFACT_REFRESH_COMMAND];
		case "refresh_project_brain":
			return [PROJECT_BRAIN_REFRESH_COMMAND];
		case "refresh_runtime_card":
			return [RUNTIME_CARD_REFRESH_COMMAND];
		case "refresh_prompt_context":
		case "rerun_validator":
		case "refresh_receipts":
		case "none":
			return [];
		default:
			return [];
	}
}

function isPromptContextDriftBlocker(
	value: unknown,
): value is PromptContextDriftBlocker {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		typeof (value as { nextActionClass?: unknown }).nextActionClass === "string"
	);
}

function reportPassConsistencyError(report: {
	blockers?: unknown;
	overallStatus?: unknown;
	surfaces?: unknown;
}): string | null {
	if (report.overallStatus !== "pass") return null;
	if (Array.isArray(report.blockers) && report.blockers.length > 0) {
		return "Prompt-context-drift report claims pass while report blockers are present.";
	}
	if (!Array.isArray(report.surfaces)) return null;
	const seenSurfaces = new Set<string>();
	for (const surface of report.surfaces) {
		const surfaceError = surfacePassConsistencyError(surface, seenSurfaces);
		if (surfaceError !== null) return surfaceError;
	}
	return missingRequiredSurfaceError(seenSurfaces);
}

function surfacePassConsistencyError(
	surface: unknown,
	seenSurfaces: Set<string>,
): string | null {
	if (!isSurfaceRecord(surface)) return null;
	seenSurfaces.add(surface.surfaceId);
	if (surface.status === "pass" && !hasSurfaceBlockers(surface)) return null;
	return `Prompt-context-drift report claims pass while surface ${surface.surfaceId} is degraded.`;
}

function missingRequiredSurfaceError(seenSurfaces: Set<string>): string | null {
	const missingSurface = PROMPT_CONTEXT_DRIFT_SURFACES.find(
		(surfaceId) => !seenSurfaces.has(surfaceId),
	);
	return missingSurface
		? `Prompt-context-drift report claims pass while required surface ${missingSurface} is missing.`
		: null;
}

function hasSurfaceBlockers(surface: { blockers?: unknown }): boolean {
	return Array.isArray(surface.blockers) && surface.blockers.length > 0;
}

function isSurfaceRecord(value: unknown): value is {
	blockers?: unknown;
	status?: unknown;
	surfaceId: string;
} {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		typeof (value as { surfaceId?: unknown }).surfaceId === "string"
	);
}

function liveHeadBindingError(
	report: { currentHeadSha?: unknown },
	repoRoot: string,
): string | null {
	const liveHead = readCurrentHeadSha(repoRoot);
	if (liveHead === null) {
		return "Prompt-context-drift report live HEAD could not be verified.";
	}
	return report.currentHeadSha === liveHead
		? null
		: "Prompt-context-drift report currentHeadSha does not match live repository HEAD.";
}

function contextSurface(input: {
	status: AgentReadinessStatus;
	evidence: string[];
	staleReasons: string[];
	suggestedRefreshCommands?: string[] | undefined;
}): AgentReadinessContextSurface {
	return {
		id: "prompt_context_drift",
		...input,
		suggestedRefreshCommands: input.suggestedRefreshCommands ?? [
			WRITE_COMMAND,
			VALIDATE_COMMAND,
		],
		evidenceUse: "orientation",
	};
}

function uniqueStrings(values: readonly string[]): string[] {
	return [...new Set(values)];
}
