import type {
	HeGateId,
	HeGateStatus,
	HePhaseExit,
} from "../decision/he-phase-exit.js";
import type {
	HarnessAssuranceEntry,
	HarnessAssuranceFinding,
} from "../harness-assurance.js";
import type { MissingContextClassification } from "../missing-context/classifier.js";
import type {
	RuntimeEvidenceContract,
	RuntimeEvidenceContractFinding,
	RuntimeEvidenceVerifierStatus,
} from "../runtime/runtime-evidence-contract.js";

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

/** Owner expected to unblock a non-ready PR closeout attempt. */
export type PrCloseoutRecoveryOwner = "codex" | "external_service" | "operator";

/** Retry posture for the current PR closeout attempt. */
export type PrCloseoutRetryDecision = "none" | "wait" | "stop";

/** Ownership classification for a closeout blocker. */
export type PrCloseoutBlockerClassification =
	| "introduced"
	| "pre_existing"
	| "unrelated_dirty_worktree"
	| "external_service"
	| "needs_jamie_decision"
	| "unknown";

/** Verifier-backed status for one required PR closeout claim. */
export type PrCloseoutClaimStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "unknown"
	| "not_applicable";

/** Freshness classification for the evidence attached to a closeout claim. */
export type PrCloseoutEvidenceFreshness =
	| "current"
	| "stale"
	| "missing"
	| "unknown"
	| "not_applicable";

/** Evidence surface that produced a closeout claim. */
export type PrCloseoutClaimSource =
	| "pr"
	| "branch"
	| "checks"
	| "review"
	| "linear"
	| "harness_gates";

/** PR closeout summary for the seven-layer harness assurance matrix. */
export interface PrCloseoutAssuranceSummary {
	present: boolean;
	valid: boolean;
	entries: HarnessAssuranceEntry[];
	findings: HarnessAssuranceFinding[];
}

/** PR closeout summary for verifier-owned runtime evidence. */
export interface PrCloseoutRuntimeEvidenceSummary {
	present: boolean;
	valid: boolean;
	verifierStatus: RuntimeEvidenceVerifierStatus | null;
	outcome: string | null;
	exitClassification: string | null;
	findings: RuntimeEvidenceContractFinding[];
}

/** Compact projection of supplied delivery-truth verdicts inside pr-closeout. */
export interface PrCloseoutDeliveryTruthVerdict {
	schemaVersion: "delivery-truth/v1";
	claim: string;
	status: PrCloseoutClaimStatus;
	statusLabel?: string;
	source: string;
	evidenceRef: string | null;
	evidenceRefs?: string[];
	blockerRefs?: string[];
	headSha: string | null;
	verdictHeadSha?: string | null;
	freshness: PrCloseoutEvidenceFreshness;
	blockerClass: PrCloseoutBlockerClassification | null;
	blockerCode?: string | null;
	verifiedAt: string;
	evidenceUse?: string | null;
}

/** Compact summary of supplied delivery-truth verdicts inside pr-closeout. */
export interface PrCloseoutDeliveryTruthSummary {
	present: boolean;
	verdicts: PrCloseoutDeliveryTruthVerdict[];
	blockingVerdicts: PrCloseoutDeliveryTruthVerdict[];
	mergeReady: PrCloseoutDeliveryTruthVerdict | null;
}

/** One required claim in the pr-closeout/v1 evidence contract. */
export interface PrCloseoutClaim {
	claim:
		| "tests_passed"
		| "ci_green"
		| "review_threads_resolved"
		| "pr_metadata_ready"
		| "branch_current_with_base"
		| "linear_tracker_state_aligned"
		| "independent_review_status_known"
		| "required_checks_match_current_head"
		| "rollback_path_named_or_not_applicable";
	status: PrCloseoutClaimStatus;
	evidenceRef: string | null;
	source: PrCloseoutClaimSource;
	headSha: string | null;
	freshness: PrCloseoutEvidenceFreshness;
	blockerClass: PrCloseoutBlockerClassification | null;
	missingContext: MissingContextClassification | null;
	verifiedAt: string;
}

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
	assurance?: HarnessAssuranceEntry[];
	runtimeEvidence?: RuntimeEvidenceContract;
	deliveryTruth?: PrCloseoutDeliveryTruthVerdict[];
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
		| "assurance"
		| "runtime_evidence"
		| "delivery_truth"
		| "tool";
	classification: PrCloseoutBlockerClassification;
	kind?: "state" | "closeout_claim";
	conflict?: boolean;
	reason: string;
	fixableByCodex: boolean;
	ref?: string;
	missingContext?: MissingContextClassification;
}

/** Replayable attempt metadata for the read-only PR closeout classifier. */
export interface PrCloseoutAttemptLedger {
	schemaVersion: "attempt-ledger/v1";
	command: "pr-closeout";
	attempt: number;
	maxAttempts: number;
	firstFailure: {
		attempt: number;
		status: PrCloseoutStatus;
		nextAction: PrCloseoutNextAction;
	} | null;
	retryDecision: PrCloseoutRetryDecision;
	owner: PrCloseoutRecoveryOwner;
	stopReason: string | null;
	nextAction: PrCloseoutNextAction;
	evidenceRefs: string[];
}

/** Failure/recovery event emitted when closeout cannot safely finish. */
export interface PrCloseoutRecoveryEvent {
	schemaVersion: "recovery-event/v1";
	eventId: string;
	command: "pr-closeout";
	attempt: number;
	owner: PrCloseoutRecoveryOwner;
	failureClass: PrCloseoutBlockerClassification;
	stopReason: string;
	nextAction: PrCloseoutNextAction;
	retryDecision: PrCloseoutRetryDecision;
	evidenceRefs: string[];
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
	assurance: PrCloseoutAssuranceSummary;
	runtimeEvidence: PrCloseoutRuntimeEvidenceSummary;
	deliveryTruth: PrCloseoutDeliveryTruthSummary;
	tools: PrCloseoutToolInput[];
	dirtyPathsExcluded: PrCloseoutDirtyPathInput[];
	attemptLedger: PrCloseoutAttemptLedger;
	recoveryEvent: PrCloseoutRecoveryEvent | null;
	snapshot?: PrCloseoutConstraintSnapshot;
}

/** Lane-level stale-class labels used by compact delivery-lifecycle snapshots. */
export type PrCloseoutStaleEvidenceClass =
	| "stale-pr-metadata"
	| "stale-ci"
	| "stale-review"
	| "stale-linear"
	| "stale-external";

/** Compact evidence pointer used in snapshot handoff output. */
export interface PrCloseoutSnapshotHandoffPointer {
	claim: string;
	surface: PrCloseoutClaim["source"] | PrCloseoutBlocker["surface"];
	status: PrCloseoutClaimStatus;
	freshness: PrCloseoutEvidenceFreshness;
	evidenceRef: string | null;
	blockerClass: PrCloseoutBlockerClassification | null;
	verifiedAt: string;
}

/** Compact lane projection for compact closeout snapshots. */
export interface PrCloseoutConstraintSnapshotLane {
	status: "ready" | "blocked" | "stale" | "missing" | "unknown";
	blockerCount: number;
	staleEvidence: boolean;
	freshness: PrCloseoutEvidenceFreshness;
	evidenceRefs: string[];
}

/** Compact delivery-lifecycle snapshot derived from a PR closeout report. */
export interface PrCloseoutConstraintSnapshot {
	schemaVersion: "pr-closeout-snapshot/v1";
	generatedAt: string;
	pr: number;
	url: string | null;
	overallStatus: PrCloseoutStatus;
	nextAction: PrCloseoutNextAction;
	staleEvidenceClasses: PrCloseoutStaleEvidenceClass[];
	lanes: {
		pr: PrCloseoutConstraintSnapshotLane;
		checks: PrCloseoutConstraintSnapshotLane;
		review: PrCloseoutConstraintSnapshotLane;
		linear: PrCloseoutConstraintSnapshotLane;
		branch: PrCloseoutConstraintSnapshotLane;
		deliveryTruth: PrCloseoutConstraintSnapshotLane;
	};
	handoffRequirements: PrCloseoutSnapshotHandoffPointer[];
}
