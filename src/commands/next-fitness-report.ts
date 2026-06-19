import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import { readRepoRuntimeArtifactText } from "../lib/runtime/repo-runtime-artifact.js";
import { selectTopDeterministicFitnessFinding } from "../lib/fitness/report.js";
import type { FitnessFinding, FitnessReport } from "../lib/fitness/types.js";
import { validateFitnessReport } from "../lib/fitness/validation.js";
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
}): HarnessDecision {
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
				requiresHuman: true,
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
		safeToRun: args.nextCommand !== null,
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
	return (
		fitnessReport.topDeterministicFinding ??
		selectTopDeterministicFitnessFinding(
			fitnessReport.lanes.flatMap((lane) => lane.findings),
		)
	);
}

function deterministicFitnessDecision(args: {
	artifactPath: string;
	mode: HarnessNextMode;
	topFinding: FitnessFinding;
}): HarnessDecision {
	const { artifactPath, mode, topFinding } = args;
	return createNextDecision({
		status: "blocked",
		summary: `Repository fitness is blocked by ${topFinding.title}.`,
		nextAction: topFinding.risk,
		nextCommand: topFinding.recommendedCommand,
		phase: "repair",
		objective:
			"Resolve the highest-priority deterministic repository fitness finding.",
		requiredEvidence: [
			`artifact:${artifactPath}`,
			`${topFinding.recommendedCommand} output`,
		],
		stopConditions: [
			"Stop if the deterministic fitness finding remains after rerunning the recommended command.",
		],
		followUpCommands: [
			"harness fitness --json --from-existing-artifacts <artifact-dir>",
			`harness next --json --fitness-report ${artifactPath}`,
		],
		hiddenPlumbing: ["harness-fitness/v1"],
		safeToRun: true,
		requiresHuman: false,
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
			commands: [topFinding.recommendedCommand],
			extra: {
				artifactPath,
				fitnessFinding: topFinding,
			},
		}),
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

	return { fitnessReport };
}
