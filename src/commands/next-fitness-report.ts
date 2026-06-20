import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import { readRepoRuntimeArtifactText } from "../lib/runtime/repo-runtime-artifact.js";
import { selectTopDeterministicFitnessFinding } from "../lib/fitness/report.js";
import type { FitnessFinding, FitnessReport } from "../lib/fitness/types.js";
import { validateFitnessReport } from "../lib/fitness/validation.js";
import { sanitizeEvidenceText } from "../lib/input/sanitize.js";
import { createNextDecision } from "./next-decision-meta.js";
import { blockedDecision, type HarnessNextMode } from "./next-decisions.js";
import { decisionMeta } from "./next-support.js";

function fitnessReportDecision(args: {
	artifactPath: string;
	mode: HarnessNextMode;
	summary: string;
	nextAction: string;
	nextCommand: string | null;
	failureClass: string;
	fitnessFinding?: FitnessFinding;
	frictionClass: "repo_state" | "validation_failure";
	safeToRun?: boolean;
	requiresHuman?: boolean;
}): HarnessDecision {
	const safeToRun = args.safeToRun ?? false;
	const requiresHuman = args.requiresHuman ?? !safeToRun;
	return {
		...blockedDecision({
			summary: args.summary,
			nextAction: args.nextAction,
			failureClass: args.failureClass,
			evidenceRef: [`artifact:${args.artifactPath}`],
			meta: decisionMeta({
				mode: args.mode,
				frictionClass: args.frictionClass,
				delayClass: "normal",
				requiresHuman,
				commands: args.nextCommand ? [args.nextCommand] : [],
				extra: {
					artifactPath: args.artifactPath,
					...(args.fitnessFinding
						? { fitnessFinding: args.fitnessFinding }
						: {}),
				},
			}),
		}),
		nextCommand: args.nextCommand,
		safeToRun,
		requiresHuman,
	};
}

function parseFitnessReportArtifact(rawArtifact: string): unknown {
	return JSON.parse(rawArtifact);
}

function readFitnessReportArtifact(
	repoRoot: string,
	artifactPath: string,
	mode: HarnessNextMode,
): { fitnessReport: FitnessReport } | { decision: HarnessDecision } {
	let rawArtifact: string;
	let parsed: unknown;
	try {
		rawArtifact = readRepoRuntimeArtifactText(
			repoRoot,
			artifactPath,
			"--fitness-report",
		);
	} catch {
		return {
			decision: fitnessReportDecision({
				artifactPath,
				mode,
				summary: `Fitness report artifact could not be read: ${artifactPath}.`,
				nextAction:
					"Provide a readable harness-fitness/v1 JSON artifact or omit --fitness-report.",
				nextCommand: null,
				failureClass: "fitness_report_artifact_unreadable",
				frictionClass: "repo_state",
			}),
		};
	}

	try {
		parsed = parseFitnessReportArtifact(rawArtifact);
	} catch {
		return {
			decision: fitnessReportDecision({
				artifactPath,
				mode,
				summary: `Fitness report artifact is not valid JSON: ${artifactPath}.`,
				nextAction:
					"Provide a parseable harness-fitness/v1 JSON artifact or omit --fitness-report.",
				nextCommand: null,
				failureClass: "fitness_report_artifact_invalid",
				frictionClass: "validation_failure",
			}),
		};
	}

	const validation = validateFitnessReport(parsed);
	if (!validation.valid) {
		return {
			decision: fitnessReportDecision({
				artifactPath,
				mode,
				summary: `Fitness report artifact is not valid harness-fitness/v1: ${artifactPath}.`,
				nextAction:
					"Regenerate the fitness report with valid gate artifacts, then rerun harness next --json.",
				nextCommand: null,
				failureClass: "fitness_report_artifact_invalid",
				frictionClass: "validation_failure",
			}),
		};
	}

	const fitnessReport = parsed as FitnessReport;
	return { fitnessReport };
}

function topFitnessFinding(
	fitnessReport: FitnessReport,
): FitnessFinding | null {
	return selectTopDeterministicFitnessFinding(
		fitnessReport.lanes.flatMap((lane) => lane.findings),
	);
}

const TRUSTED_FITNESS_COMMANDS = new Set([
	"pnpm architecture:check",
	"pnpm run quality:size",
	"pnpm typecheck",
	"pnpm lint",
	"pnpm run quality:behavior-tests",
	"pnpm run harness:audit-tracking",
]);

function trustedFitnessCommand(command: string): string | null {
	const normalized = command.trim();
	return TRUSTED_FITNESS_COMMANDS.has(normalized) ? normalized : null;
}

function deterministicFitnessDecision(args: {
	artifactPath: string;
	mode: HarnessNextMode;
	topFinding: FitnessFinding;
}): HarnessDecision {
	const { artifactPath, mode, topFinding } = args;
	const nextCommand = trustedFitnessCommand(topFinding.recommendedCommand);
	return createNextDecision({
		status: "blocked",
		summary: `Repository fitness is blocked by ${topFinding.title}.`,
		nextAction: topFinding.risk,
		nextCommand,
		phase: "repair",
		objective:
			"Resolve the highest-priority deterministic repository fitness finding.",
		requiredEvidence: [
			`artifact:${artifactPath}`,
			...(nextCommand ? [`${nextCommand} output`] : []),
		],
		stopConditions: [
			"Stop if the deterministic fitness finding remains after rerunning the recommended command.",
		],
		followUpCommands: [
			"harness fitness --json --from-existing-artifacts <artifact-dir>",
			`harness next --json --fitness-report ${artifactPath}`,
		],
		hiddenPlumbing: ["harness-fitness/v1"],
		safeToRun: nextCommand !== null,
		requiresHuman: nextCommand === null,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: [`artifact:${artifactPath}`],
		failureClass: "fitness_deterministic_finding",
		retry: "safe",
		riskTier: topFinding.severity === "critical" ? "critical" : "medium",
		meta: decisionMeta({
			mode,
			frictionClass: "validation_failure",
			delayClass: "normal",
			requiresHuman: nextCommand === null,
			commands: nextCommand ? [nextCommand] : [],
			extra: {
				artifactPath,
				fitnessFinding: topFinding,
			},
		}),
	});
}

function nonPassingFitnessDecision(args: {
	artifactPath: string;
	mode: HarnessNextMode;
	fitnessReport: FitnessReport;
}): HarnessDecision {
	const { artifactPath, mode, fitnessReport } = args;
	return fitnessReportDecision({
		artifactPath,
		mode,
		summary: `Fitness report status is ${fitnessReport.status}; handoff evidence is incomplete.`,
		nextAction:
			"Regenerate the fitness report with all required gate artifacts before continuing handoff.",
		nextCommand: "harness fitness --json",
		failureClass: "fitness_report_blocks_handoff",
		frictionClass: "validation_failure",
	});
}

function missingFitnessEvidenceDecision(args: {
	artifactPath: string;
	mode: HarnessNextMode;
	fitnessReport: FitnessReport;
}): HarnessDecision {
	const missingLanes = args.fitnessReport.lanes.filter(
		(lane) => lane.status === "not_run",
	);
	const firstMissingLane = missingLanes[0];
	const nextCommand =
		firstMissingLane === undefined
			? null
			: trustedFitnessCommand(firstMissingLane.command);
	const displayCommand =
		firstMissingLane === undefined
			? null
			: sanitizeEvidenceText(firstMissingLane.command);
	return fitnessReportDecision({
		artifactPath: args.artifactPath,
		mode: args.mode,
		summary:
			"Repository fitness report still needs deterministic gate evidence.",
		nextAction:
			firstMissingLane === undefined
				? "Regenerate the harness-fitness/v1 report with complete deterministic gate artifacts."
				: `Run ${displayCommand}, regenerate the fitness report, then rerun harness next --json.`,
		nextCommand,
		failureClass: "fitness_report_needs_evidence",
		frictionClass: "validation_failure",
		safeToRun: nextCommand !== null,
		requiresHuman: nextCommand === null,
	});
}

/** Load a harness-fitness/v1 report for the harness next CLI. */
export function loadFitnessReportArtifact(
	repoRoot: string,
	artifactPath: string,
	mode: HarnessNextMode,
): { fitnessReport: FitnessReport } | { decision: HarnessDecision } {
	const loaded = readFitnessReportArtifact(repoRoot, artifactPath, mode);
	if ("decision" in loaded) return loaded;
	const fitnessReport = loaded.fitnessReport;
	if (fitnessReport.status === "needs_evidence") {
		return {
			decision: missingFitnessEvidenceDecision({
				artifactPath,
				mode,
				fitnessReport,
			}),
		};
	}
	const topFinding = topFitnessFinding(fitnessReport);
	if (topFinding) {
		return {
			decision: deterministicFitnessDecision({
				artifactPath,
				mode,
				topFinding,
			}),
		};
	}
	if (fitnessReport.status !== "pass" && fitnessReport.status !== "warn") {
		return {
			decision: nonPassingFitnessDecision({
				artifactPath,
				mode,
				fitnessReport,
			}),
		};
	}

	return { fitnessReport };
}
