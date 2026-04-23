import {
	NORTH_STAR_DECISION_QUESTION_SPECS,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
} from "./types.js";
import type {
	NorthStarContract,
	NorthStarDecisionQuestionId,
	OverrideReviewerRegistry,
	ProductSurfaceClass,
	ProductSurfaceRegistry,
	ProductSurfaceType,
	SurfaceRegistration,
	TrustedReviewerStatus,
	TrustedReviewerType,
} from "./types.js";
import {
	hasForbiddenKey,
	isNonEmptyStringArray,
	isPlainObject,
} from "./validator-helpers.js";

const VALID_NORTH_STAR_KEYS = [
	"mission",
	"primaryMetric",
	"primaryBottleneck",
	"autonomyBoundary",
	"safetyFloor",
	"nonGoals",
	"decisionQuestions",
] as const;
const VALID_NORTH_STAR_DECISION_QUESTION_KEYS = ["id", "prompt"] as const;
const VALID_PRODUCT_SURFACE_REGISTRY_KEYS = ["surfaces"] as const;
const VALID_SURFACE_REGISTRATION_KEYS = [
	"surfaceId",
	"surfaceType",
	"class",
	"owner",
	"northStarContribution",
	"manualGlueReductionClaim",
	"reliabilityContribution",
	"evidenceReference",
	"reviewCadence",
	"ownedPaths",
	"lastReviewedAt",
] as const;
const VALID_SURFACE_TYPES: ProductSurfaceType[] = [
	"command",
	"document",
	"policy",
	"workflow",
];
const VALID_SURFACE_CLASSES: ProductSurfaceClass[] = [
	"core",
	"adjacent",
	"experimental",
];
const VALID_OVERRIDE_REVIEWER_REGISTRY_KEYS = ["trustedReviewers"] as const;
const VALID_TRUSTED_REVIEWER_KEYS = [
	"reviewerId",
	"reviewerType",
	"signatureRef",
	"displayName",
	"status",
] as const;
const VALID_TRUSTED_REVIEWER_TYPES: TrustedReviewerType[] = [
	"user",
	"team",
	"service",
];
const VALID_TRUSTED_REVIEWER_STATUSES: TrustedReviewerStatus[] = [
	"active",
	"revoked",
];
const EXPECTED_NORTH_STAR_DECISION_QUESTION_IDS =
	new Set<NorthStarDecisionQuestionId>(
		NORTH_STAR_DECISION_QUESTION_SPECS.map(({ id }) => id),
	);

function isValidNorthStarDecisionQuestion(
	value: unknown,
): value is NorthStarContract["decisionQuestions"][number] {
	if (!isPlainObject(value)) {
		return false;
	}
	const record = value as Record<string, unknown>;
	if (Object.keys(record).some((key) => hasForbiddenKey(key))) {
		return false;
	}
	const keys = Object.keys(record);
	if (keys.length !== VALID_NORTH_STAR_DECISION_QUESTION_KEYS.length) {
		return false;
	}
	if (
		!keys.every((key) =>
			VALID_NORTH_STAR_DECISION_QUESTION_KEYS.includes(
				key as (typeof VALID_NORTH_STAR_DECISION_QUESTION_KEYS)[number],
			),
		)
	) {
		return false;
	}
	if (
		typeof record.id !== "string" ||
		!EXPECTED_NORTH_STAR_DECISION_QUESTION_IDS.has(
			record.id as NorthStarDecisionQuestionId,
		)
	) {
		return false;
	}
	return typeof record.prompt === "string" && record.prompt.trim().length > 0;
}

export function isValidNorthStarContract(
	value: unknown,
): value is NorthStarContract {
	if (!isPlainObject(value)) {
		return false;
	}
	const record = value as Record<string, unknown>;
	if (Object.keys(record).some((key) => hasForbiddenKey(key))) {
		return false;
	}
	const keys = Object.keys(record);
	if (keys.length !== VALID_NORTH_STAR_KEYS.length) {
		return false;
	}
	if (
		!keys.every((key) =>
			VALID_NORTH_STAR_KEYS.includes(
				key as (typeof VALID_NORTH_STAR_KEYS)[number],
			),
		)
	) {
		return false;
	}
	if (
		typeof record.mission !== "string" ||
		record.mission.trim().length === 0
	) {
		return false;
	}
	if (record.primaryMetric !== NORTH_STAR_PRIMARY_METRIC) {
		return false;
	}
	if (record.primaryBottleneck !== NORTH_STAR_PRIMARY_BOTTLENECK) {
		return false;
	}
	if (
		typeof record.autonomyBoundary !== "string" ||
		record.autonomyBoundary.trim().length === 0
	) {
		return false;
	}
	if (!isNonEmptyStringArray(record.safetyFloor)) {
		return false;
	}
	if (!isNonEmptyStringArray(record.nonGoals)) {
		return false;
	}
	if (
		!Array.isArray(record.decisionQuestions) ||
		record.decisionQuestions.length === 0
	) {
		return false;
	}
	if (
		!record.decisionQuestions.every((question) =>
			isValidNorthStarDecisionQuestion(question),
		)
	) {
		return false;
	}
	const seenQuestionIds = new Set<NorthStarDecisionQuestionId>();
	for (const question of record.decisionQuestions) {
		const questionId = question.id as NorthStarDecisionQuestionId;
		if (seenQuestionIds.has(questionId)) {
			return false;
		}
		seenQuestionIds.add(questionId);
	}
	if (seenQuestionIds.size !== EXPECTED_NORTH_STAR_DECISION_QUESTION_IDS.size) {
		return false;
	}
	return true;
}

function isValidSurfaceRegistration(
	value: unknown,
): value is SurfaceRegistration {
	if (!isPlainObject(value)) {
		return false;
	}
	const record = value as Record<string, unknown>;
	if (Object.keys(record).some((key) => hasForbiddenKey(key))) {
		return false;
	}
	const keys = Object.keys(record);
	if (
		!keys.every((key) =>
			VALID_SURFACE_REGISTRATION_KEYS.includes(
				key as (typeof VALID_SURFACE_REGISTRATION_KEYS)[number],
			),
		)
	) {
		return false;
	}
	const requiredKeys: Array<keyof SurfaceRegistration> = [
		"surfaceId",
		"surfaceType",
		"class",
		"owner",
		"northStarContribution",
		"manualGlueReductionClaim",
		"reliabilityContribution",
		"evidenceReference",
		"ownedPaths",
		"lastReviewedAt",
	];
	if (
		!requiredKeys.every((key) =>
			Object.prototype.hasOwnProperty.call(record, key),
		)
	) {
		return false;
	}
	if (
		typeof record.surfaceId !== "string" ||
		record.surfaceId.trim().length === 0
	) {
		return false;
	}
	if (
		typeof record.surfaceType !== "string" ||
		!VALID_SURFACE_TYPES.includes(record.surfaceType as ProductSurfaceType)
	) {
		return false;
	}
	if (
		typeof record.class !== "string" ||
		!VALID_SURFACE_CLASSES.includes(record.class as ProductSurfaceClass)
	) {
		return false;
	}
	const nonEmptyFields = [
		record.owner,
		record.northStarContribution,
		record.manualGlueReductionClaim,
		record.reliabilityContribution,
		record.evidenceReference,
		record.lastReviewedAt,
	];
	if (
		!nonEmptyFields.every(
			(field) => typeof field === "string" && field.trim().length > 0,
		)
	) {
		return false;
	}
	if (!isNonEmptyStringArray(record.ownedPaths)) {
		return false;
	}
	return (
		record.reviewCadence === undefined ||
		(typeof record.reviewCadence === "string" &&
			record.reviewCadence.trim().length > 0)
	);
}

export function isValidProductSurfaceRegistry(
	value: unknown,
): value is ProductSurfaceRegistry {
	if (!isPlainObject(value)) {
		return false;
	}
	const record = value as Record<string, unknown>;
	if (Object.keys(record).some((key) => hasForbiddenKey(key))) {
		return false;
	}
	const keys = Object.keys(record);
	if (keys.length !== VALID_PRODUCT_SURFACE_REGISTRY_KEYS.length) {
		return false;
	}
	if (
		!keys.every((key) =>
			VALID_PRODUCT_SURFACE_REGISTRY_KEYS.includes(
				key as (typeof VALID_PRODUCT_SURFACE_REGISTRY_KEYS)[number],
			),
		)
	) {
		return false;
	}
	return (
		Array.isArray(record.surfaces) &&
		record.surfaces.length > 0 &&
		record.surfaces.every((surface) => isValidSurfaceRegistration(surface))
	);
}

export function isValidOverrideReviewerRegistry(
	value: unknown,
): value is OverrideReviewerRegistry {
	if (!isPlainObject(value)) {
		return false;
	}
	const record = value as Record<string, unknown>;
	if (Object.keys(record).some((key) => hasForbiddenKey(key))) {
		return false;
	}
	const keys = Object.keys(record);
	if (keys.length !== VALID_OVERRIDE_REVIEWER_REGISTRY_KEYS.length) {
		return false;
	}
	if (
		!keys.every((key) =>
			VALID_OVERRIDE_REVIEWER_REGISTRY_KEYS.includes(
				key as (typeof VALID_OVERRIDE_REVIEWER_REGISTRY_KEYS)[number],
			),
		)
	) {
		return false;
	}
	if (!Array.isArray(record.trustedReviewers)) {
		return false;
	}
	return record.trustedReviewers.every((reviewer) => {
		if (!isPlainObject(reviewer)) {
			return false;
		}
		const reviewerRecord = reviewer as Record<string, unknown>;
		if (Object.keys(reviewerRecord).some((key) => hasForbiddenKey(key))) {
			return false;
		}
		const reviewerKeys = Object.keys(reviewerRecord);
		if (reviewerKeys.length !== VALID_TRUSTED_REVIEWER_KEYS.length) {
			return false;
		}
		if (
			!reviewerKeys.every((key) =>
				VALID_TRUSTED_REVIEWER_KEYS.includes(
					key as (typeof VALID_TRUSTED_REVIEWER_KEYS)[number],
				),
			)
		) {
			return false;
		}
		if (
			typeof reviewerRecord.reviewerType !== "string" ||
			!VALID_TRUSTED_REVIEWER_TYPES.includes(
				reviewerRecord.reviewerType as TrustedReviewerType,
			)
		) {
			return false;
		}
		if (
			typeof reviewerRecord.status !== "string" ||
			!VALID_TRUSTED_REVIEWER_STATUSES.includes(
				reviewerRecord.status as TrustedReviewerStatus,
			)
		) {
			return false;
		}
		const requiredNonEmptyStringFields = [
			reviewerRecord.reviewerId,
			reviewerRecord.signatureRef,
			reviewerRecord.displayName,
		];
		return requiredNonEmptyStringFields.every(
			(field) => typeof field === "string" && field.trim().length > 0,
		);
	});
}
