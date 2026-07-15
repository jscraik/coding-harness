import { existsSync } from "node:fs";
import { join } from "node:path";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import { sanitizeError, sanitizeEvidenceText } from "../lib/input/sanitize.js";
import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutBlocker,
	type PrCloseoutReport,
} from "../lib/pr-closeout.js";
import { readRepoRuntimeArtifactText } from "../lib/runtime/repo-runtime-artifact.js";
import { isPrCloseoutReport } from "./next-pr-closeout-contract.js";
import {
	createNextDecision,
	nextDecisionOperationalMeta,
} from "./next-decision-meta.js";
import type { HarnessNextMode } from "./next-decision-types.js";
import { humanRequiredDecisionMeta } from "./next-support.js";
import { blockedDecision } from "./next-blocked-decisions.js";

export const DEFAULT_PR_CLOSEOUT_ARTIFACT =
	"artifacts/pr-closeout/pr-closeout.json";

/** PR closeout evidence accepted by harness next. */
export interface HarnessNextPrCloseoutEvidence {
	report: PrCloseoutReport;
	artifactPath?: string;
}

/** Return the default pr-closeout artifact path when the current repo has one. */
export function discoverPrCloseoutArtifactPath(
	repoRoot: string,
): string | undefined {
	return existsSync(join(repoRoot, DEFAULT_PR_CLOSEOUT_ARTIFACT))
		? DEFAULT_PR_CLOSEOUT_ARTIFACT
		: undefined;
}

function prCloseoutEvidenceRef(
	evidence: HarnessNextPrCloseoutEvidence,
): string {
	return evidence.artifactPath
		? `artifact:${evidence.artifactPath}`
		: `pr-closeout:${evidence.report.pr}`;
}

function blockerEvidenceRefs(
	report: PrCloseoutReport,
	fallbackRef: string,
): string[] {
	const refs = report.blockers
		.map((blocker) => blocker.ref)
		.filter((ref): ref is string => typeof ref === "string" && ref.length > 0)
		.map(sanitizeEvidenceText);
	return refs.length > 0 ? refs : [fallbackRef];
}

function summarizeBlockers(blockers: PrCloseoutBlocker[]): Array<{
	surface: PrCloseoutBlocker["surface"];
	classification: PrCloseoutBlocker["classification"];
	reason: string;
	fixableByCodex: boolean;
	ref?: string;
}> {
	return blockers.slice(0, 5).map((blocker) => ({
		surface: blocker.surface,
		classification: blocker.classification,
		reason: sanitizeEvidenceText(blocker.reason),
		fixableByCodex: blocker.fixableByCodex,
		...(blocker.ref ? { ref: sanitizeEvidenceText(blocker.ref) } : {}),
	}));
}

/** Project validated closeout evidence into compact harness-next metadata. */
function prCloseoutMeta(
	evidence: HarnessNextPrCloseoutEvidence,
): Record<string, unknown> {
	const { report } = evidence;
	return {
		prCloseout: {
			schemaVersion: report.schemaVersion,
			artifactPath: evidence.artifactPath ?? null,
			pr: report.pr,
			status: report.status,
			mergeable: report.mergeable,
			nextAction: report.nextAction,
			blockerCount: report.blockers.length,
			blockers: summarizeBlockers(report.blockers),
			reviewThreads: report.reviewThreads,
			checks: report.checks,
			stackState: report.stackState ?? null,
		},
	};
}

function nextActionForPrCloseout(report: PrCloseoutReport): string {
	switch (report.nextAction) {
		case "codex_can_fix_now":
			return "Resolve the fixable PR closeout blockers, regenerate pr-closeout/v1 evidence, then rerun harness next --json.";
		case "wait_for_external_check":
			return "Wait for external PR checks or reviewers to finish, then regenerate pr-closeout/v1 evidence.";
		case "resolve_conflicts":
			return "Resolve branch conflicts or stack instability before continuing handoff.";
		case "needs_jamie_decision":
			return "Ask Jamie for the required PR closeout decision before continuing.";
		case "cleanup_before_continue":
			return "Clean up the local worktree or closeout evidence before continuing.";
		case "ready_to_merge":
			return "Regenerate pr-closeout/v1 evidence if this report is expected to be ready.";
	}
}

function isCodexFixablePrCloseout(report: PrCloseoutReport): boolean {
	return (
		report.nextAction === "codex_can_fix_now" &&
		report.blockers.length > 0 &&
		report.blockers.every((blocker) => blocker.fixableByCodex)
	);
}

function prCloseoutArtifactDecision(args: {
	artifactPath: string;
	mode: HarnessNextMode;
	summary: string;
	nextAction: string;
	failureClass: string;
	frictionClass: "repo_state" | "validation_failure";
	extra: Record<string, unknown>;
}): HarnessDecision {
	return blockedDecision({
		summary: args.summary,
		nextAction: args.nextAction,
		failureClass: args.failureClass,
		evidenceRef: [`artifact:${args.artifactPath}`],
		meta: humanRequiredDecisionMeta({
			mode: args.mode,
			frictionClass: args.frictionClass,
			extra: {
				artifactPath: args.artifactPath,
				...args.extra,
			},
		}),
	});
}

/** Load and validate a pr-closeout/v1 artifact for the harness next CLI. */
export function loadPrCloseoutArtifact(
	repoRoot: string,
	artifactPath: string,
	mode: HarnessNextMode,
):
	| { prCloseout: HarnessNextPrCloseoutEvidence }
	| { decision: HarnessDecision } {
	let rawArtifact: string;
	let parsed: unknown;
	try {
		rawArtifact = readRepoRuntimeArtifactText(
			repoRoot,
			artifactPath,
			"--pr-closeout",
		);
	} catch (error) {
		return {
			decision: prCloseoutArtifactDecision({
				artifactPath,
				mode,
				summary: `PR closeout artifact could not be read: ${artifactPath}.`,
				nextAction:
					"Provide a readable pr-closeout/v1 JSON artifact or omit --pr-closeout.",
				failureClass: "pr_closeout_artifact_unreadable",
				frictionClass: "repo_state",
				extra: { error: sanitizeError(error) },
			}),
		};
	}

	try {
		parsed = JSON.parse(rawArtifact);
	} catch (error) {
		return {
			decision: prCloseoutArtifactDecision({
				artifactPath,
				mode,
				summary: `PR closeout artifact is not valid JSON: ${artifactPath}.`,
				nextAction:
					"Provide a parseable pr-closeout/v1 JSON artifact or omit --pr-closeout.",
				failureClass: "pr_closeout_artifact_invalid",
				frictionClass: "validation_failure",
				extra: { error: sanitizeError(error) },
			}),
		};
	}

	if (!isPrCloseoutReport(parsed)) {
		return {
			decision: prCloseoutArtifactDecision({
				artifactPath,
				mode,
				summary: `PR closeout artifact is not valid pr-closeout/v1: ${artifactPath}.`,
				nextAction:
					"Regenerate the PR closeout report with valid current-state evidence, then rerun harness next --json.",
				failureClass: "pr_closeout_artifact_invalid",
				frictionClass: "validation_failure",
				extra: { schemaVersion: PR_CLOSEOUT_SCHEMA_VERSION },
			}),
		};
	}

	return { prCloseout: { report: parsed, artifactPath } };
}

/** Return whether pr-closeout/v1 evidence prevents handoff recommendations. */
export function prCloseoutBlocksHandoff(
	evidence: HarnessNextPrCloseoutEvidence | undefined,
): boolean {
	return evidence
		? evidence.report.status !== "ready" || !evidence.report.mergeable
		: false;
}

/** Build a decision from non-ready pr-closeout/v1 evidence. */
export function prCloseoutBlockedDecision(args: {
	mode: HarnessNextMode;
	prCloseout: HarnessNextPrCloseoutEvidence;
}): HarnessDecision {
	const { report } = args.prCloseout;
	const evidenceRef = prCloseoutEvidenceRef(args.prCloseout);
	const blockerRefs = blockerEvidenceRefs(report, evidenceRef);
	const escalationBlocker =
		report.blockers.find((blocker) => !blocker.fixableByCodex) ??
		report.blockers[0];
	const blockerSummary =
		escalationBlocker?.reason ??
		`PR closeout status is ${report.status}; mergeable=${String(report.mergeable)}.`;
	const sanitizedBlockerSummary = sanitizeEvidenceText(blockerSummary);
	const codexFixable = isCodexFixablePrCloseout(report);
	return createNextDecision({
		status: "blocked",
		summary: `PR closeout evidence blocks handoff for PR #${report.pr}.`,
		nextAction: nextActionForPrCloseout(report),
		nextCommand: null,
		phase: "repair",
		objective:
			"Resolve current PR closeout evidence before claiming handoff or merge readiness.",
		requiredEvidence: [evidenceRef, ...blockerRefs],
		stopConditions: [
			"Stop until pr-closeout/v1 reports status=ready and mergeable=true for the current PR evidence.",
		],
		humanEscalation: codexFixable ? null : sanitizedBlockerSummary,
		followUpCommands: ["harness next --json"],
		hiddenPlumbing: ["pr-closeout", "claim-vs-evidence"],
		safeToRun: false,
		requiresHuman: !codexFixable,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: [evidenceRef, ...blockerRefs],
		failureClass: "pr_closeout_blocked",
		retry: codexFixable ? "conditional" : "manual",
		riskTier: "medium",
		meta: nextDecisionOperationalMeta({
			mode: args.mode,
			frictionClass: "repo_state",
			delayClass: codexFixable ? "waiting_on_agent" : "human_needed",
			startupCost: "none",
			requiresHuman: !codexFixable,
			extra: prCloseoutMeta(args.prCloseout),
		}),
	});
}

/** Compact pr-closeout metadata attached to normal harness-next decisions. */
export function prCloseoutDecisionMeta(
	evidence: HarnessNextPrCloseoutEvidence | undefined,
): Record<string, unknown> | undefined {
	return evidence ? prCloseoutMeta(evidence) : undefined;
}
