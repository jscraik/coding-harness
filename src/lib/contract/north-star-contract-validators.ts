import type {
	NorthStarContract,
	NorthStarDecisionQuestion,
	OverrideReviewerRegistry,
	ProductSurfaceClass,
	ProductSurfaceRegistry,
	SurfaceRegistration,
	TrustedReviewerStatus,
	TrustedReviewerType,
} from "./types.js";
import {
	NORTH_STAR_DECISION_QUESTION_SPECS,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
} from "./types.js";
import { isPlainObject, isStringArray } from "./validator-helpers.js";

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
const VALID_PRODUCT_SURFACE_KEYS = [
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
const VALID_PRODUCT_SURFACE_CLASSES: ProductSurfaceClass[] = [
	"core",
	"adjacent",
	"experimental",
];
const VALID_PRODUCT_SURFACE_TYPES = [
	"command",
	"document",
	"policy",
	"workflow",
] as const;
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

function isValidNorthStarDecisionQuestions(
	value: unknown,
): value is NorthStarDecisionQuestion[] {
	if (!Array.isArray(value)) {
		return false;
	}
	if (value.length !== NORTH_STAR_DECISION_QUESTION_SPECS.length) {
		return false;
	}

	for (const [index, question] of value.entries()) {
		if (!isPlainObject(question)) {
			return false;
		}

		const decisionQuestion = question as Record<string, unknown>;
		const unknownKeys = Object.keys(decisionQuestion).filter(
			(key) =>
				!VALID_NORTH_STAR_DECISION_QUESTION_KEYS.includes(
					key as (typeof VALID_NORTH_STAR_DECISION_QUESTION_KEYS)[number],
				),
		);
		if (unknownKeys.length > 0) {
			return false;
		}

		const canonical = NORTH_STAR_DECISION_QUESTION_SPECS[index];
		if (canonical === undefined) {
			return false;
		}
		if (
			decisionQuestion.id !== canonical.id ||
			decisionQuestion.prompt !== canonical.prompt
		) {
			return false;
		}
	}

	return true;
}

export function isValidNorthStarContract(
	value: unknown,
): value is NorthStarContract {
	if (!isPlainObject(value)) {
		return false;
	}

	const northStar = value as Record<string, unknown>;
	const unknownKeys = Object.keys(northStar).filter(
		(key) =>
			!VALID_NORTH_STAR_KEYS.includes(
				key as (typeof VALID_NORTH_STAR_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	if (
		typeof northStar.mission !== "string" ||
		northStar.mission.trim().length === 0
	) {
		return false;
	}
	if (northStar.primaryMetric !== NORTH_STAR_PRIMARY_METRIC) {
		return false;
	}
	if (northStar.primaryBottleneck !== NORTH_STAR_PRIMARY_BOTTLENECK) {
		return false;
	}
	if (
		typeof northStar.autonomyBoundary !== "string" ||
		northStar.autonomyBoundary.trim().length === 0
	) {
		return false;
	}
	if (!isStringArray(northStar.safetyFloor, { minLength: 1 })) {
		return false;
	}
	if (!isStringArray(northStar.nonGoals, { minLength: 1 })) {
		return false;
	}

	return isValidNorthStarDecisionQuestions(northStar.decisionQuestions);
}

function isValidSurfaceRegistration(
	value: unknown,
): value is SurfaceRegistration {
	if (!isPlainObject(value)) {
		return false;
	}

	const surface = value as Record<string, unknown>;
	const unknownKeys = Object.keys(surface).filter(
		(key) =>
			!VALID_PRODUCT_SURFACE_KEYS.includes(
				key as (typeof VALID_PRODUCT_SURFACE_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	if (
		typeof surface.surfaceId !== "string" ||
		surface.surfaceId.trim().length === 0
	) {
		return false;
	}
	if (
		typeof surface.surfaceType !== "string" ||
		!VALID_PRODUCT_SURFACE_TYPES.includes(
			surface.surfaceType as (typeof VALID_PRODUCT_SURFACE_TYPES)[number],
		)
	) {
		return false;
	}
	if (
		typeof surface.class !== "string" ||
		!VALID_PRODUCT_SURFACE_CLASSES.includes(
			surface.class as ProductSurfaceClass,
		)
	) {
		return false;
	}
	if (typeof surface.owner !== "string" || surface.owner.trim().length === 0) {
		return false;
	}
	if (
		typeof surface.northStarContribution !== "string" ||
		surface.northStarContribution.trim().length === 0
	) {
		return false;
	}
	if (
		typeof surface.manualGlueReductionClaim !== "string" ||
		surface.manualGlueReductionClaim.trim().length === 0
	) {
		return false;
	}
	if (
		typeof surface.reliabilityContribution !== "string" ||
		surface.reliabilityContribution.trim().length === 0
	) {
		return false;
	}
	if (
		typeof surface.evidenceReference !== "string" ||
		surface.evidenceReference.trim().length === 0
	) {
		return false;
	}
	if (!isStringArray(surface.ownedPaths, { minLength: 1 })) {
		return false;
	}
	if (
		typeof surface.lastReviewedAt !== "string" ||
		surface.lastReviewedAt.trim().length === 0
	) {
		return false;
	}
	if (
		surface.reviewCadence !== undefined &&
		(typeof surface.reviewCadence !== "string" ||
			surface.reviewCadence.trim().length === 0)
	) {
		return false;
	}
	if (
		(surface.class === "adjacent" || surface.class === "experimental") &&
		(typeof surface.reviewCadence !== "string" ||
			surface.reviewCadence.trim().length === 0)
	) {
		return false;
	}

	return true;
}

export function isValidProductSurfaceRegistry(
	value: unknown,
): value is ProductSurfaceRegistry {
	if (!isPlainObject(value)) {
		return false;
	}

	const registry = value as Record<string, unknown>;
	const unknownKeys = Object.keys(registry).filter(
		(key) =>
			!VALID_PRODUCT_SURFACE_REGISTRY_KEYS.includes(
				key as (typeof VALID_PRODUCT_SURFACE_REGISTRY_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}
	if (!Array.isArray(registry.surfaces)) {
		return false;
	}
	if (registry.surfaces.length === 0) {
		return false;
	}

	const surfaceIds = new Set<string>();
	for (const entry of registry.surfaces) {
		if (!isValidSurfaceRegistration(entry)) {
			return false;
		}
		const normalizedSurfaceId = entry.surfaceId.trim();
		if (surfaceIds.has(normalizedSurfaceId)) {
			return false;
		}
		surfaceIds.add(normalizedSurfaceId);
	}

	return true;
}

export function isValidOverrideReviewerRegistry(
	value: unknown,
): value is OverrideReviewerRegistry {
	if (!isPlainObject(value)) {
		return false;
	}
	const registry = value as Record<string, unknown>;
	const unknownKeys = Object.keys(registry).filter(
		(key) =>
			!VALID_OVERRIDE_REVIEWER_REGISTRY_KEYS.includes(
				key as (typeof VALID_OVERRIDE_REVIEWER_REGISTRY_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}
	if (!Array.isArray(registry.trustedReviewers)) {
		return false;
	}
	if (registry.trustedReviewers.length === 0) {
		return false;
	}

	const reviewerIds = new Set<string>();
	const signatureRefs = new Set<string>();
	let activeReviewerCount = 0;

	for (const reviewer of registry.trustedReviewers) {
		if (!isPlainObject(reviewer)) {
			return false;
		}
		const item = reviewer as Record<string, unknown>;
		const itemUnknownKeys = Object.keys(item).filter(
			(key) =>
				!VALID_TRUSTED_REVIEWER_KEYS.includes(
					key as (typeof VALID_TRUSTED_REVIEWER_KEYS)[number],
				),
		);
		if (itemUnknownKeys.length > 0) {
			return false;
		}
		if (
			typeof item.reviewerId !== "string" ||
			item.reviewerId.trim().length === 0
		) {
			return false;
		}
		if (
			typeof item.reviewerType !== "string" ||
			!VALID_TRUSTED_REVIEWER_TYPES.includes(
				item.reviewerType as TrustedReviewerType,
			)
		) {
			return false;
		}
		if (
			typeof item.signatureRef !== "string" ||
			item.signatureRef.trim().length === 0
		) {
			return false;
		}
		if (
			typeof item.displayName !== "string" ||
			item.displayName.trim().length === 0
		) {
			return false;
		}
		if (
			typeof item.status !== "string" ||
			!VALID_TRUSTED_REVIEWER_STATUSES.includes(
				item.status as TrustedReviewerStatus,
			)
		) {
			return false;
		}

		if (reviewerIds.has(item.reviewerId)) {
			return false;
		}
		reviewerIds.add(item.reviewerId);
		if (signatureRefs.has(item.signatureRef)) {
			return false;
		}
		signatureRefs.add(item.signatureRef);
		if (item.status === "active") {
			activeReviewerCount += 1;
		}
	}

	return activeReviewerCount > 0;
}
