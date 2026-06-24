import {
	buildRepeatSignalKey,
	inferReviewFeedbackFailureClass,
	isUnsafeReviewFeedback,
} from "./review-feedback-signals.js";

/** Schema version for review feedback classification reports. */
export const REVIEW_FEEDBACK_CLASSIFICATION_SCHEMA_VERSION =
	"review-feedback-classification/v1" as const;

/** Structured input for a single PR review comment. */
export interface ReviewFeedbackCommentInput {
	id: string;
	provider: string;
	body: string;
	file?: string | null;
	url?: string | null;
	isResolved?: boolean;
	isOutdated?: boolean;
	severity?: "low" | "medium" | "high" | "critical" | "unknown";
	repeatCount?: number;
}

/** Review feedback state after current-evidence classification. */
export type ReviewFeedbackState = "current" | "stale" | "unmapped" | "unsafe";

/** Bounded issue classes that can become future guardrails or eval seeds. */
export type ReviewFeedbackFailureClass =
	| "installed_command_drift"
	| "schema_type_drift"
	| "path_safety"
	| "validation_gap"
	| "review_noise"
	| "unknown";

/** Durable next destination recommended for repeated feedback. */
export type ReviewFeedbackPromotionDestination =
	| "eval_seed"
	| "guardrail"
	| "tracked_exception"
	| "none";

/** Classified review feedback item. */
export interface ReviewFeedbackClassification {
	id: string;
	provider: string;
	state: ReviewFeedbackState;
	failureClass: ReviewFeedbackFailureClass;
	repeatCount: number;
	file: string | null;
	sourceUrl: string | null;
	summary: string;
	evidenceRef: string[];
	promotion: {
		destination: ReviewFeedbackPromotionDestination;
		targetSurface: string | null;
		reason: string;
	};
	productionTrace: false;
}

/** Result for a batch of review feedback comments. */
export interface ReviewFeedbackClassificationReport {
	schemaVersion: typeof REVIEW_FEEDBACK_CLASSIFICATION_SCHEMA_VERSION;
	status: "pass";
	repeatThreshold: number;
	items: ReviewFeedbackClassification[];
	summary: {
		total: number;
		current: number;
		stale: number;
		unmapped: number;
		unsafe: number;
		promotionCandidates: number;
		byFailureClass: Partial<Record<ReviewFeedbackFailureClass, number>>;
	};
}

/** Options for tuning review feedback classification. */
export interface ReviewFeedbackClassificationOptions {
	repeatThreshold?: number;
}

const DEFAULT_REPEAT_THRESHOLD = 2;
interface PreparedReviewFeedbackComment {
	comment: ReviewFeedbackCommentInput;
	failureClass: ReviewFeedbackFailureClass;
	state: ReviewFeedbackState;
	repeatKey: string;
}

/** Classify raw PR review comments into bounded future guardrail/eval seed candidates. */
export function classifyReviewFeedback(
	comments: ReviewFeedbackCommentInput[],
	options: ReviewFeedbackClassificationOptions = {},
): ReviewFeedbackClassificationReport {
	const repeatThreshold = toPositiveFiniteInt(
		options.repeatThreshold,
		DEFAULT_REPEAT_THRESHOLD,
	);
	const preparedComments = comments.map(prepareReviewFeedbackComment);
	const repeatCounts = countPreparedRepeatKeys(preparedComments);
	const items = preparedComments.map((preparedComment) =>
		classifyReviewFeedbackComment({
			preparedComment,
			repeatThreshold,
			inferredRepeatCount: repeatCounts.get(preparedComment.repeatKey) ?? 1,
		}),
	);
	return {
		schemaVersion: REVIEW_FEEDBACK_CLASSIFICATION_SCHEMA_VERSION,
		status: "pass",
		repeatThreshold,
		items,
		summary: {
			total: items.length,
			current: countState(items, "current"),
			stale: countState(items, "stale"),
			unmapped: countState(items, "unmapped"),
			unsafe: countState(items, "unsafe"),
			promotionCandidates: items.filter(
				(item) => item.promotion.destination !== "none",
			).length,
			byFailureClass: countFailureClasses(items),
		},
	};
}

function prepareReviewFeedbackComment(
	comment: ReviewFeedbackCommentInput,
): PreparedReviewFeedbackComment {
	const failureClass = inferReviewFeedbackFailureClass(comment);
	const state = classifyReviewFeedbackState(comment, failureClass);
	return {
		comment,
		failureClass,
		state,
		repeatKey: buildRepeatKey(comment, failureClass, state),
	};
}

function classifyReviewFeedbackComment(args: {
	preparedComment: PreparedReviewFeedbackComment;
	repeatThreshold: number;
	inferredRepeatCount: number;
}): ReviewFeedbackClassification {
	const { comment, failureClass, state } = args.preparedComment;
	const file = normalizeReviewFeedbackFile(comment.file);
	const repeatCount = toPositiveFiniteInt(
		comment.repeatCount,
		args.inferredRepeatCount,
	);
	return {
		id: comment.id,
		provider: comment.provider,
		state,
		failureClass,
		repeatCount,
		file,
		sourceUrl: comment.url ?? null,
		summary: summarizeReviewFeedback(comment, failureClass, state),
		evidenceRef: buildReviewFeedbackEvidenceRef(comment),
		promotion: recommendFeedbackPromotion({
			failureClass,
			hasConcreteFile: file != null,
			state,
			repeatCount,
			repeatThreshold: args.repeatThreshold,
		}),
		productionTrace: false,
	};
}

function countPreparedRepeatKeys(
	preparedComments: PreparedReviewFeedbackComment[],
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const preparedComment of preparedComments) {
		if (preparedComment.state !== "current") continue;
		if (preparedComment.failureClass === "unknown") {
			continue;
		}
		counts.set(
			preparedComment.repeatKey,
			(counts.get(preparedComment.repeatKey) ?? 0) + 1,
		);
	}
	return counts;
}

function buildRepeatKey(
	comment: ReviewFeedbackCommentInput,
	failureClass: ReviewFeedbackFailureClass,
	state: ReviewFeedbackState,
): string {
	if (state !== "current" || failureClass === "unknown") {
		return `${state}:${failureClass}:${comment.id}`;
	}
	return `${failureClass}\0${buildRepeatSignalKey(comment.body, failureClass)}`;
}

function toPositiveFiniteInt(
	value: number | undefined,
	fallback: number,
): number {
	if (value == null || !Number.isFinite(value)) return fallback;
	const normalized = Math.floor(value);
	return normalized >= 1 ? normalized : fallback;
}

function normalizeReviewFeedbackFile(
	file: string | null | undefined,
): string | null {
	const normalized = file?.trim();
	return normalized ? normalized : null;
}

function classifyReviewFeedbackState(
	comment: ReviewFeedbackCommentInput,
	failureClass: ReviewFeedbackFailureClass,
): ReviewFeedbackState {
	if (isUnsafeReviewFeedback(comment.body)) return "unsafe";
	if (comment.isResolved === true || comment.isOutdated === true)
		return "stale";
	if (failureClass === "unknown") return "unmapped";
	return "current";
}

function recommendFeedbackPromotion(args: {
	failureClass: ReviewFeedbackFailureClass;
	hasConcreteFile: boolean;
	state: ReviewFeedbackState;
	repeatCount: number;
	repeatThreshold: number;
}): ReviewFeedbackClassification["promotion"] {
	if (args.state !== "current") {
		return {
			destination: "none",
			targetSurface: null,
			reason:
				"Only current mapped review feedback can become a durable candidate.",
		};
	}
	if (args.repeatCount < args.repeatThreshold) {
		return {
			destination: "none",
			targetSurface: null,
			reason: `Repeat count ${args.repeatCount} is below threshold ${args.repeatThreshold}.`,
		};
	}
	if (args.failureClass === "review_noise") {
		return {
			destination: "tracked_exception",
			targetSurface: ".harness/review-log.md",
			reason:
				"Repeated low-severity review noise needs an explicit exception before automation.",
		};
	}
	if (args.failureClass === "unknown") {
		return {
			destination: "none",
			targetSurface: null,
			reason: "Unmapped review feedback is not safe to promote.",
		};
	}
	if (!args.hasConcreteFile) {
		return {
			destination: "none",
			targetSurface: null,
			reason: "Durable promotion requires a concrete reviewed file path.",
		};
	}
	if (args.failureClass === "path_safety") {
		return {
			destination: "guardrail",
			targetSurface: ".harness/guardrails/north-star",
			reason:
				"Repeated path safety feedback should become a deterministic guardrail candidate.",
		};
	}
	return {
		destination: "eval_seed",
		targetSurface: "evals/scenarios/north-star-agent-delivery/registry.json",
		reason: `Repeated ${args.failureClass} feedback should become a deterministic eval seed candidate.`,
	};
}

function summarizeReviewFeedback(
	comment: ReviewFeedbackCommentInput,
	failureClass: ReviewFeedbackFailureClass,
	state: ReviewFeedbackState,
): string {
	const file = comment.file ? ` for ${comment.file}` : "";
	return `${comment.provider} review feedback${file} classified as ${state}/${failureClass}.`;
}

function buildReviewFeedbackEvidenceRef(
	comment: ReviewFeedbackCommentInput,
): string[] {
	return [
		comment.url
			? `review-comment:${comment.url}`
			: `review-comment:${comment.id}`,
	];
}

function countState(
	items: ReviewFeedbackClassification[],
	state: ReviewFeedbackState,
): number {
	return items.filter((item) => item.state === state).length;
}

function countFailureClasses(
	items: ReviewFeedbackClassification[],
): Partial<Record<ReviewFeedbackFailureClass, number>> {
	const counts: Partial<Record<ReviewFeedbackFailureClass, number>> = {};
	for (const item of items) {
		counts[item.failureClass] = (counts[item.failureClass] ?? 0) + 1;
	}
	return counts;
}
