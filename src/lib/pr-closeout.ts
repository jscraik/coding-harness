import type {
	HeGateId,
	HeGateStatus,
	HePhaseExit,
} from "./decision/he-phase-exit.js";
import type { MissingContextClassification } from "./missing-context/classifier.js";
import {
	buildHarnessGateSummary,
	collectCheckBlockers,
	collectHarnessGateBlockers,
	collectPullRequestBlockers,
	collectReviewBlockers,
	collectToolBlockers,
	collectTraceabilityBlocker,
	collectWorktreeBlockers,
} from "./pr-closeout/blockers.js";
import {
	buildCloseoutClaims,
	collectClaimBlockers,
	type PrCloseoutClaim,
} from "./pr-closeout/claims.js";
import {
	isFailedCheck,
	isPassingCheck,
	isPendingCheck,
} from "./pr-closeout/evidence.js";
import { deriveNextAction } from "./pr-closeout/status.js";

/** Schema version for the first read-only pull request closeout evidence report. */
export const PR_CLOSEOUT_SCHEMA_VERSION = "pr-closeout/v1" as const;

/** Closeout action recommended by the PR evidence classifier. */
export type PrCloseoutNextAction =
	| "ready_to_merge"
	| "codex_can_fix_now"
	| "wait_for_external_check"
	| "resolve_conflicts"
	| "needs_jamie_decision"
	| "cleanup_before_continue";

/** Collapsed closeout status for one pull request. */
export type PrCloseoutStatus =
	| "ready"
	| "fixable"
	| "waiting"
	| "blocked"
	| "needs_jamie"
	| "cleanup_required";

/** Ownership classification for a closeout blocker. */
export type PrCloseoutBlockerClassification =
	| "introduced"
	| "pre_existing"
	| "unrelated_dirty_worktree"
	| "external_service"
	| "needs_jamie_decision"
	| "unknown";

/** Normalized pull request state consumed by the closeout classifier. */
export interface PrCloseoutPullRequestInput {
	number: number;
	title?: string | null;
	state?: string | null;
	isDraft?: boolean | null;
	mergeStateStatus?: string | null;
	url?: string | null;
	headSha?: string | null;
	headRefName?: string | null;
	baseRefName?: string | null;
	reviewDecision?: string | null;
	body?: string | null;
}

/** Normalized check state consumed by the closeout classifier. */
export interface PrCloseoutCheckInput {
	name: string;
	state?: string | null;
	conclusion?: string | null;
	required?: boolean | null;
	url?: string | null;
	headSha?: string | null;
	source?: "github" | "circleci" | "coderabbit" | "other" | null;
}

/** Local branch/worktree state consumed by the closeout classifier. */
export interface PrCloseoutBranchInput {
	clean?: boolean | null;
	pushed?: boolean | null;
	behindBase?: boolean | null;
	hasConflicts?: boolean | null;
	headSha?: string | null;
}

/** Review-thread counts consumed by the closeout classifier. */
export interface PrCloseoutReviewThreadsInput {
	unresolved: number | null;
	needsHuman?: number | null;
	autofixable?: number | null;
}

/** Session and trace references expected in professional PR handoff evidence. */
export interface PrCloseoutTraceabilityInput {
	sessionIds?: string[];
	traceIds?: string[];
	aiSessionTraceability?: string | null;
}

/** Rollback evidence named by the PR closeout caller. */
export interface PrCloseoutRollbackInput {
	path?: string | null;
	notApplicable?: boolean | null;
	evidenceRef?: string | null;
}

/** Closeout posture for one Coding Harness gate. */
export interface PrCloseoutHarnessGateEvidence {
	gateId: HeGateId;
	required: boolean;
	status: HeGateStatus | "missing";
	evidenceRefs: string[];
	requiresHuman: boolean;
	blocker: string | null;
}

/** Origin of the closeout gate evidence consumed by PR closeout. */
export type PrCloseoutHarnessGateEvidenceSource =
	| "closeout_gates"
	| "phase_exit"
	| "missing";

/** Coding Harness closeout gates consumed by PR closeout. */
export interface PrCloseoutHarnessGateSummary {
	evidenceSource: PrCloseoutHarnessGateEvidenceSource;
	/** Whether first-class Coding Harness closeout gate evidence was supplied. */
	closeoutGatesPresent: boolean;
	/** Backwards-compatible visibility for older phase-exit consumers. */
	phaseExitPresent: boolean;
	recommendation: HePhaseExit["recommendation"] | "missing";
	commitAllowed: boolean;
	exitAllowed: boolean;
	gates: PrCloseoutHarnessGateEvidence[];
}

/** Dirty path classification supplied by a caller that has inspected the worktree. */
export interface PrCloseoutDirtyPathInput {
	path: string;
	classification:
		| "intended_source"
		| "generated_artifact"
		| "validation_output"
		| "temp_reference"
		| "unrelated_local_noise";
}

/** Tool availability and command evidence captured during live closeout inspection. */
export interface PrCloseoutToolInput {
	name:
		| "codex_env"
		| "github_cli"
		| "circleci_cli"
		| "coderabbit_cli"
		| "snyk_cli";
	available: boolean;
	ref: string;
	status: "usable" | "blocked" | "missing";
	failureClass: string | null;
}

/** Complete normalized input for one PR closeout classification pass. */
export interface PrCloseoutInput {
	pullRequest: PrCloseoutPullRequestInput;
	branch?: PrCloseoutBranchInput;
	checks?: PrCloseoutCheckInput[];
	reviewThreads?: PrCloseoutReviewThreadsInput;
	traceability?: PrCloseoutTraceabilityInput;
	rollback?: PrCloseoutRollbackInput;
	/** First-class Coding Harness closeout-gates evidence. Preferred for PR closeout. */
	closeoutGates?: HePhaseExit;
	/** Backwards-compatible HE phase-exit evidence accepted from older workflows. */
	phaseExit?: HePhaseExit;
	dirtyPaths?: PrCloseoutDirtyPathInput[];
	tools?: PrCloseoutToolInput[];
}

/** One blocker that prevents the PR from being safely closed out. */
export interface PrCloseoutBlocker {
	surface:
		| "pr"
		| "branch"
		| "checks"
		| "review"
		| "linear"
		| "traceability"
		| "worktree"
		| "harness_gates"
		| "tool";
	classification: PrCloseoutBlockerClassification;
	reason: string;
	fixableByCodex: boolean;
	ref?: string;
	missingContext?: MissingContextClassification;
}

/** Read-only closeout evidence report for one pull request. */
export interface PrCloseoutReport {
	schemaVersion: typeof PR_CLOSEOUT_SCHEMA_VERSION;
	generatedAt: string;
	pr: number;
	url: string | null;
	status: PrCloseoutStatus;
	mergeable: boolean;
	nextAction: PrCloseoutNextAction;
	blockers: PrCloseoutBlocker[];
	claims: PrCloseoutClaim[];
	checks: {
		total: number;
		failed: number;
		pending: number;
		passed: number;
		unknown: number;
	};
	reviewThreads: {
		unresolved: number | null;
		needsHuman: number | null;
		autofixable: number | null;
	};
	traceability: {
		sessionIds: string[];
		traceIds: string[];
		aiSessionTraceability: string | null;
		complete: boolean;
	};
	harnessGates: PrCloseoutHarnessGateSummary;
	tools: PrCloseoutToolInput[];
	dirtyPathsExcluded: PrCloseoutDirtyPathInput[];
}

function summarizeChecks(checks: readonly PrCloseoutCheckInput[]): {
	total: number;
	failed: number;
	pending: number;
	passed: number;
	unknown: number;
} {
	let failed = 0;
	let pending = 0;
	let passed = 0;
	let unknown = 0;
	for (const check of checks) {
		if (isFailedCheck(check)) failed += 1;
		else if (isPendingCheck(check)) pending += 1;
		else if (isPassingCheck(check)) passed += 1;
		else unknown += 1;
	}
	return { total: checks.length, failed, pending, passed, unknown };
}

/** Build a read-only PR closeout evidence report from normalized PR closeout inputs. */
export function buildPrCloseoutReport(
	input: PrCloseoutInput,
	options: { now?: Date } = {},
): PrCloseoutReport {
	const blockers: PrCloseoutBlocker[] = [];
	const generatedAt = (options.now ?? new Date()).toISOString();
	const pr = input.pullRequest;
	const checks = input.checks ?? [];
	const reviewThreads = input.reviewThreads ?? { unresolved: null };
	const traceability = input.traceability ?? {};
	const harnessGateEvidenceSource: PrCloseoutHarnessGateEvidenceSource =
		input.closeoutGates !== undefined
			? "closeout_gates"
			: input.phaseExit !== undefined
				? "phase_exit"
				: "missing";
	const harnessGates = buildHarnessGateSummary(
		input.closeoutGates ?? input.phaseExit,
		harnessGateEvidenceSource,
	);
	const dirtyPaths = input.dirtyPaths ?? [];
	const tools = input.tools ?? [];
	const dirtyPathsExcluded = dirtyPaths.filter(
		(path) => path.classification === "unrelated_local_noise",
	);

	const sessionIds = traceability.sessionIds ?? [];
	const traceIds = traceability.traceIds ?? [];
	const aiSessionTraceability = traceability.aiSessionTraceability ?? null;
	const traceabilityComplete =
		sessionIds.length > 0 &&
		traceIds.length > 0 &&
		Boolean(aiSessionTraceability?.trim());
	const claims = buildCloseoutClaims(input, checks, reviewThreads, generatedAt);
	collectWorktreeBlockers(input, dirtyPathsExcluded, blockers);
	collectPullRequestBlockers(pr, blockers);
	collectCheckBlockers(checks, blockers);
	collectReviewBlockers(pr, reviewThreads, blockers);
	collectTraceabilityBlocker(traceabilityComplete, blockers);
	collectHarnessGateBlockers(harnessGates, blockers);
	collectToolBlockers(tools, blockers);
	collectClaimBlockers(claims, blockers);

	const decision = deriveNextAction(blockers);
	return {
		schemaVersion: PR_CLOSEOUT_SCHEMA_VERSION,
		generatedAt,
		pr: pr.number,
		url: pr.url ?? null,
		status: decision.status,
		mergeable: decision.mergeable,
		nextAction: decision.nextAction,
		blockers,
		claims,
		checks: summarizeChecks(checks),
		reviewThreads: {
			unresolved: reviewThreads.unresolved,
			needsHuman: reviewThreads.needsHuman ?? null,
			autofixable: reviewThreads.autofixable ?? null,
		},
		traceability: {
			sessionIds,
			traceIds,
			aiSessionTraceability,
			complete: traceabilityComplete,
		},
		harnessGates,
		tools,
		dirtyPathsExcluded,
	};
}
