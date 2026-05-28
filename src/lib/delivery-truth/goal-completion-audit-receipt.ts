import { createHash } from "node:crypto";
import type {
	PrCloseoutBlockerClassification,
	PrCloseoutClaimStatus,
	PrCloseoutEvidenceFreshness,
} from "../pr-closeout/types.js";

export const GOAL_COMPLETION_AUDIT_RECEIPT_SCHEMA_VERSION =
	"goal-completion-audit-receipt/v1" as const;

export const GOAL_COMPLETION_OBJECTIVE_CANONICALIZATION_VERSION =
	"goal-objective-text-lf/v1" as const;

export const GOAL_COMPLETION_BLOCKED_THRESHOLD = 3 as const;

const SAFE_POINTER_PATTERN = /^[A-Za-z0-9#][A-Za-z0-9._:/#@+-]{0,511}$/u;

/** Stable identity proof for the canonical goal objective under audit. */
export interface GoalCompletionObjectiveIdentity {
	objectiveRef: string;
	objectiveSourcePath: string;
	objectivePointer: string;
	objectiveSourceHeadSha: string;
	objectiveSourceSha256: string;
	objectiveHash: string;
	hashAlgorithm: "sha256";
	canonicalizationVersion: typeof GOAL_COMPLETION_OBJECTIVE_CANONICALIZATION_VERSION;
}

/** Requirement row evaluated before a done/goal-ready claim can be supported. */
export interface GoalCompletionRequirement {
	id: string;
	description: string;
	required: boolean;
	status: PrCloseoutClaimStatus;
	freshness: PrCloseoutEvidenceFreshness;
	evidenceRefs: string[];
	blockerRefs: string[];
	verdictRef: string | null;
}

/** Current blocker with recurrence derived from prior goal history. */
export interface GoalCompletionBlocker {
	id: string;
	stableKey: string;
	blockerClass: PrCloseoutBlockerClassification;
	owner: string;
	nextAction: string;
	evidenceRefs: string[];
	consecutiveGoalTurns: number;
	firstObservedAt: string;
	latestObservedAt: string;
}

/** Recommendation for the goal-governor layer; it is advisory and does not mutate goal state. */
export type GoalCompletionRecommendation = "complete" | "continue" | "blocked";

/** Machine-readable reason the receipt could not support a done claim. */
export type GoalCompletionAuditBlockerCode =
	| "missing_objective_identity"
	| "objective_source_head_mismatch"
	| "objective_source_hash_mismatch"
	| "missing_required_requirement"
	| "requirement_not_passed"
	| "requirement_evidence_not_current"
	| "unresolved_blocker"
	| "repeated_blocker_threshold_met"
	| "missing_blocker_history"
	| "invalid_receipt";

/** Final verdict for whether a goal done claim can be supported. */
export interface GoalCompletionAuditVerdict {
	status: PrCloseoutClaimStatus;
	freshness: PrCloseoutEvidenceFreshness;
	readyForDoneClaim: boolean;
	goalStatusRecommendation: GoalCompletionRecommendation;
	blockerCode: GoalCompletionAuditBlockerCode | null;
	blockerClass: PrCloseoutBlockerClassification | null;
	blockerRefs: string[];
	evidenceRefs: string[];
	verifiedAt: string;
}

/** Pre-closeout receipt that binds the goal objective, requirements, blockers, and verdict. */
export interface GoalCompletionAuditReceipt {
	schemaVersion: typeof GOAL_COMPLETION_AUDIT_RECEIPT_SCHEMA_VERSION;
	generatedAt: string;
	producer: string;
	runtimeStatus: "not_yet_emitted";
	evidenceUse: "audit_trail";
	headSha: string;
	objectiveIdentity: GoalCompletionObjectiveIdentity;
	requirements: GoalCompletionRequirement[];
	blockers: GoalCompletionBlocker[];
	verdict: GoalCompletionAuditVerdict;
	sourceRefs: string[];
	blockedBy: string;
}

/** Caller-supplied requirement evidence before it is normalized into the receipt. */
export interface GoalCompletionRequirementInput {
	id: string;
	description: string;
	required: boolean;
	status: PrCloseoutClaimStatus;
	freshness: PrCloseoutEvidenceFreshness;
	evidenceRefs?: readonly string[];
	blockerRefs?: readonly string[];
	verdictRef?: string | null;
}

/** Caller-supplied current blocker; recurrence is derived from blocker history, not this input. */
export interface GoalCompletionBlockerInput {
	id: string;
	stableKey: string;
	blockerClass: PrCloseoutBlockerClassification;
	owner: string;
	nextAction: string;
	evidenceRefs?: readonly string[];
	observedAt: string;
}

/** Prior blocker occurrence used to derive consecutive blocked goal turns by stable key. */
export interface GoalCompletionBlockerHistoryEntry {
	stableKey: string;
	observedAt: string;
}

/** Input for building a pre-closeout goal audit receipt from objective, requirement, and blocker evidence. */
export interface GoalCompletionAuditReceiptInput {
	generatedAt: string;
	producer: string;
	headSha: string;
	objectiveRef: string;
	objectiveSourcePath: string;
	objectivePointer: string;
	objectiveSourceHeadSha: string;
	objectiveSourceText: string | null;
	requirements: readonly GoalCompletionRequirementInput[];
	blockers: readonly GoalCompletionBlockerInput[];
	blockerHistory: readonly GoalCompletionBlockerHistoryEntry[];
	blockerHistoryAvailable: boolean;
	sourceRefs: readonly string[];
	blockedBy?: string;
}

/** Normalize goal objective text before hashing so CRLF/LF storage differences do not drift identity. */
export function canonicalizeGoalObjectiveText(text: string): string {
	return text.replace(/\r\n?/gu, "\n");
}

/** Return the canonical sha256 objective hash used by GoalCompletionAuditReceipt/v1. */
export function hashGoalObjectiveText(text: string): string {
	return sha256(canonicalizeGoalObjectiveText(text));
}

/** Build a fail-closed pre-closeout receipt without mutating goal state. */
export function buildGoalCompletionAuditReceipt(
	input: GoalCompletionAuditReceiptInput,
): GoalCompletionAuditReceipt {
	const objectiveHash = input.objectiveSourceText
		? hashGoalObjectiveText(input.objectiveSourceText)
		: "sha256:0000000000000000000000000000000000000000000000000000000000000000";
	const objectiveIdentity: GoalCompletionObjectiveIdentity = {
		objectiveRef: input.objectiveRef,
		objectiveSourcePath: input.objectiveSourcePath,
		objectivePointer: input.objectivePointer,
		objectiveSourceHeadSha: input.objectiveSourceHeadSha,
		objectiveSourceSha256: objectiveHash,
		objectiveHash,
		hashAlgorithm: "sha256",
		canonicalizationVersion: GOAL_COMPLETION_OBJECTIVE_CANONICALIZATION_VERSION,
	};
	const requirements = input.requirements.map((requirement) => ({
		id: requirement.id,
		description: requirement.description,
		required: requirement.required,
		status: requirement.status,
		freshness: requirement.freshness,
		evidenceRefs: uniqueStrings(requirement.evidenceRefs ?? []),
		blockerRefs: uniqueStrings(requirement.blockerRefs ?? []),
		verdictRef: requirement.verdictRef ?? null,
	}));
	const blockers = buildBlockers(input.blockers, input.blockerHistory);
	const blockerHistoryUsable =
		input.blockerHistoryAvailable &&
		isChronologicalBlockerHistory(input.blockerHistory);
	const verdict = buildVerdict({
		generatedAt: input.generatedAt,
		headSha: input.headSha,
		objectiveIdentity,
		objectiveSourceText: input.objectiveSourceText,
		requirements,
		blockers,
		blockerHistoryAvailable: blockerHistoryUsable,
	});
	return {
		schemaVersion: GOAL_COMPLETION_AUDIT_RECEIPT_SCHEMA_VERSION,
		generatedAt: input.generatedAt,
		producer: input.producer,
		runtimeStatus: "not_yet_emitted",
		evidenceUse: "audit_trail",
		headSha: input.headSha,
		objectiveIdentity,
		requirements,
		blockers,
		verdict,
		sourceRefs: uniqueStrings(input.sourceRefs),
		blockedBy:
			input.blockedBy ??
			"PU-029 defines the pre-closeout receipt contract before production closeout wiring.",
	};
}

function buildBlockers(
	blockers: readonly GoalCompletionBlockerInput[],
	history: readonly GoalCompletionBlockerHistoryEntry[],
): GoalCompletionBlocker[] {
	return blockers.map((blocker) => {
		const consecutiveGoalTurns = deriveConsecutiveTurns(
			blocker.stableKey,
			history,
		);
		return {
			id: blocker.id,
			stableKey: blocker.stableKey,
			blockerClass: blocker.blockerClass,
			owner: blocker.owner,
			nextAction: blocker.nextAction,
			evidenceRefs: uniqueStrings(blocker.evidenceRefs ?? []),
			consecutiveGoalTurns,
			firstObservedAt: firstObservedAt(blocker, history, consecutiveGoalTurns),
			latestObservedAt: blocker.observedAt,
		};
	});
}

function deriveConsecutiveTurns(
	stableKey: string,
	history: readonly GoalCompletionBlockerHistoryEntry[],
): number {
	let count = 1;
	for (let index = history.length - 1; index >= 0; index -= 1) {
		if (history[index]?.stableKey !== stableKey) break;
		count += 1;
	}
	return count;
}

function isChronologicalBlockerHistory(
	history: readonly GoalCompletionBlockerHistoryEntry[],
): boolean {
	let previousObservedAt = Number.NEGATIVE_INFINITY;
	for (const entry of history) {
		const observedAt = Date.parse(entry.observedAt);
		if (Number.isNaN(observedAt) || observedAt < previousObservedAt) {
			return false;
		}
		previousObservedAt = observedAt;
	}
	return true;
}

function firstObservedAt(
	blocker: GoalCompletionBlockerInput,
	history: readonly GoalCompletionBlockerHistoryEntry[],
	consecutiveGoalTurns: number,
): string {
	if (consecutiveGoalTurns <= 1) return blocker.observedAt;
	const startIndex = history.length - (consecutiveGoalTurns - 1);
	return history[startIndex]?.observedAt ?? blocker.observedAt;
}

function buildVerdict(input: {
	generatedAt: string;
	headSha: string;
	objectiveIdentity: GoalCompletionObjectiveIdentity;
	objectiveSourceText: string | null;
	requirements: GoalCompletionRequirement[];
	blockers: GoalCompletionBlocker[];
	blockerHistoryAvailable: boolean;
}): GoalCompletionAuditVerdict {
	const objectiveBlocker = objectiveIdentityBlocker(input);
	if (objectiveBlocker) return objectiveBlocker;
	const requirementBlocker = requirementsBlocker(
		input.requirements,
		input.generatedAt,
	);
	if (requirementBlocker) return requirementBlocker;
	const blockerVerdict = blockersBlocker(
		input.blockers,
		input.blockerHistoryAvailable,
		input.generatedAt,
	);
	if (blockerVerdict) return blockerVerdict;
	return {
		status: "pass",
		freshness: "current",
		readyForDoneClaim: true,
		goalStatusRecommendation: "complete",
		blockerCode: null,
		blockerClass: null,
		blockerRefs: [],
		evidenceRefs: uniqueStrings(
			input.requirements.flatMap((requirement) => requirement.evidenceRefs),
		),
		verifiedAt: input.generatedAt,
	};
}

function objectiveIdentityBlocker(input: {
	generatedAt: string;
	headSha: string;
	objectiveIdentity: GoalCompletionObjectiveIdentity;
	objectiveSourceText: string | null;
}): GoalCompletionAuditVerdict | null {
	if (
		!input.objectiveSourceText ||
		!safePointer(input.objectiveIdentity.objectiveRef) ||
		!safePointer(input.objectiveIdentity.objectiveSourcePath) ||
		!safePointer(input.objectiveIdentity.objectivePointer)
	) {
		return verdictBlocker(
			"missing_objective_identity",
			"unknown",
			"unknown",
			[],
			[],
			input.generatedAt,
		);
	}
	if (input.objectiveIdentity.objectiveSourceHeadSha !== input.headSha) {
		return verdictBlocker(
			"objective_source_head_mismatch",
			"blocked",
			"unknown",
			[input.objectiveIdentity.objectiveRef],
			[],
			input.generatedAt,
		);
	}
	const computed = hashGoalObjectiveText(input.objectiveSourceText);
	if (
		input.objectiveIdentity.objectiveHash !== computed ||
		input.objectiveIdentity.objectiveSourceSha256 !== computed
	) {
		return verdictBlocker(
			"objective_source_hash_mismatch",
			"blocked",
			"unknown",
			[input.objectiveIdentity.objectiveRef],
			[],
			input.generatedAt,
		);
	}
	return null;
}

function requirementsBlocker(
	requirements: GoalCompletionRequirement[],
	verifiedAt: string,
): GoalCompletionAuditVerdict | null {
	if (!requirements.some((requirement) => requirement.required)) {
		return verdictBlocker(
			"missing_required_requirement",
			"unknown",
			"unknown",
			[],
			[],
			verifiedAt,
		);
	}
	const blockingRequirement = requirements.find(
		(requirement) =>
			requirement.required &&
			(requirement.status !== "pass" || requirement.freshness !== "current"),
	);
	if (!blockingRequirement) return null;
	const code =
		blockingRequirement.status === "pass"
			? "requirement_evidence_not_current"
			: "requirement_not_passed";
	const status =
		blockingRequirement.status === "fail"
			? "fail"
			: blockingRequirement.status === "unknown"
				? "unknown"
				: "blocked";
	return verdictBlocker(
		code,
		status,
		"unknown",
		blockingRequirement.blockerRefs,
		blockingRequirement.evidenceRefs,
		verifiedAt,
	);
}

function blockersBlocker(
	blockers: GoalCompletionBlocker[],
	blockerHistoryAvailable: boolean,
	verifiedAt: string,
): GoalCompletionAuditVerdict | null {
	if (!blockerHistoryAvailable) {
		return verdictBlocker(
			"missing_blocker_history",
			"unknown",
			"unknown",
			blockers.map((blocker) => blocker.id),
			blockers.flatMap((blocker) => blocker.evidenceRefs),
			verifiedAt,
		);
	}
	if (blockers.length === 0) return null;
	const repeatedBlocker = blockers.find(
		(blocker) =>
			blocker.consecutiveGoalTurns >= GOAL_COMPLETION_BLOCKED_THRESHOLD,
	);
	if (repeatedBlocker) {
		return verdictBlocker(
			"repeated_blocker_threshold_met",
			"blocked",
			repeatedBlocker.blockerClass,
			[repeatedBlocker.id],
			repeatedBlocker.evidenceRefs,
			verifiedAt,
			"blocked",
		);
	}
	return verdictBlocker(
		"unresolved_blocker",
		"blocked",
		blockers[0]?.blockerClass ?? "unknown",
		blockers.map((blocker) => blocker.id),
		blockers.flatMap((blocker) => blocker.evidenceRefs),
		verifiedAt,
	);
}

function verdictBlocker(
	blockerCode: GoalCompletionAuditBlockerCode,
	status: PrCloseoutClaimStatus,
	blockerClass: PrCloseoutBlockerClassification,
	blockerRefs: readonly string[],
	evidenceRefs: readonly string[],
	verifiedAt: string,
	goalStatusRecommendation: GoalCompletionRecommendation = "continue",
): GoalCompletionAuditVerdict {
	return {
		status,
		freshness: status === "unknown" ? "unknown" : "current",
		readyForDoneClaim: false,
		goalStatusRecommendation,
		blockerCode,
		blockerClass,
		blockerRefs: uniqueStrings(blockerRefs),
		evidenceRefs: uniqueStrings(evidenceRefs),
		verifiedAt,
	};
}

function safePointer(value: string): boolean {
	return SAFE_POINTER_PATTERN.test(value);
}

function uniqueStrings(values: readonly string[]): string[] {
	return [...new Set(values.filter((value) => typeof value === "string"))];
}

function sha256(value: string): string {
	return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}
