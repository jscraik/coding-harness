/**
 * Canonical north-star sidecar artifact names and paths.
 *
 * Runtime gates use these helpers so AC3 artifact paths do not drift between
 * review, drift, preflight, and doctor integrations.
 *
 * @module lib/contract/north-star-artifacts
 */

export const NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS = {
	alignmentDecision: "north-star-alignment-decision/v1",
	driftFindings: "north-star-drift-findings/v1",
	surfaceClassificationSnapshot: "north-star-surface-classification/v1",
	overrideAcknowledgement: "north-star-override-acknowledgement/v1",
	durableGuardrail: "north-star-durable-guardrail/v1",
} as const;

/**
 * Supported north-star sidecar artifact families.
 */
export type NorthStarArtifactKind =
	keyof typeof NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS;

export const NORTH_STAR_ARTIFACT_FILENAMES = {
	alignmentDecision: "alignment-decision.json",
	driftFindings: "drift-findings.json",
	surfaceClassificationSnapshot: "surface-classification-snapshot.json",
	overrideAcknowledgement: "override-acknowledgement.json",
	durableGuardrail: "guardrail.json",
} as const satisfies Record<NorthStarArtifactKind, string>;

export const NORTH_STAR_GUARDRAIL_ROOT = ".harness/guardrails/north-star";
export const NORTH_STAR_OVERRIDE_ROOT =
	".harness/overrides/north-star-alignment";

/**
 * Joins path segments into a single normalized path.
 *
 * Each segment is trimmed of leading and trailing slashes; empty segments are dropped and remaining segments are joined with `/`.
 *
 * @param parts - Path segments to join; segments may contain leading/trailing slashes or be empty
 * @returns The normalized, slash-separated path with no empty segments or leading/trailing slashes
 */
function joinPath(...parts: string[]): string {
	return parts
		.map((part) => part.replace(/^\/+|\/+$/g, ""))
		.filter((part) => part.length > 0)
		.join("/");
}

/**
 * Get the canonical repository-relative path for the alignment decision sidecar artifact.
 *
 * @returns The repository-relative path to the alignment decision artifact
 */
export function getNorthStarAlignmentDecisionPath(): string {
	return joinPath(
		NORTH_STAR_GUARDRAIL_ROOT,
		NORTH_STAR_ARTIFACT_FILENAMES.alignmentDecision,
	);
}

/**
 * Canonical repository-relative path for the north-star drift findings artifact.
 *
 * @returns The repository-relative path to the drift findings artifact
 */
export function getNorthStarDriftFindingsPath(): string {
	return joinPath(
		NORTH_STAR_GUARDRAIL_ROOT,
		NORTH_STAR_ARTIFACT_FILENAMES.driftFindings,
	);
}

/**
 * Get the canonical repository-relative path for north-star surface classification snapshots.
 *
 * @returns The repository-relative path for surface classification snapshot artifacts
 */
export function getNorthStarSurfaceClassificationSnapshotPath(): string {
	return joinPath(
		NORTH_STAR_GUARDRAIL_ROOT,
		NORTH_STAR_ARTIFACT_FILENAMES.surfaceClassificationSnapshot,
	);
}

/**
 * Get the canonical repository-relative path for an override acknowledgement artifact partitioned by date and override ID.
 *
 * @param date - Date partition in `YYYY-MM-DD` format.
 * @param overrideId - Stable override identifier.
 * @returns The canonical repository-relative path to the override acknowledgement artifact.
 */
export function getNorthStarOverrideAcknowledgementPath(
	date: string,
	overrideId: string,
): string {
	return joinPath(
		NORTH_STAR_OVERRIDE_ROOT,
		date,
		overrideId,
		NORTH_STAR_ARTIFACT_FILENAMES.overrideAcknowledgement,
	);
}

/**
 * Get the canonical repository-relative path for a durable north-star guardrail artifact.
 *
 * @param failureClass - Stable north-star failure class used as a path partition
 * @param guardrailId - Stable guardrail identifier for the failure recurrence used as a path partition
 * @returns The repository-relative path to the durable guardrail artifact file
 */
export function getNorthStarDurableGuardrailPath(
	failureClass: string,
	guardrailId: string,
): string {
	return joinPath(
		NORTH_STAR_GUARDRAIL_ROOT,
		failureClass,
		guardrailId,
		NORTH_STAR_ARTIFACT_FILENAMES.durableGuardrail,
	);
}

/**
 * Create a stable durable guardrail identifier from recurrence inputs.
 *
 * @param input - Failure class and governed surface IDs that identify recurrence.
 * @returns Deterministic identifier suitable for duplicate prevention.
 */
export function createNorthStarGuardrailId(input: {
	failureClass: string;
	surfaceIds: readonly string[];
}): string {
	const normalizedFailureClass = input.failureClass
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const normalizedSurfaces = [...input.surfaceIds]
		.map((surfaceId) =>
			surfaceId
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, ""),
		)
		.filter((surfaceId) => surfaceId.length > 0)
		.sort();
	const surfaceSuffix =
		normalizedSurfaces.length > 0 ? normalizedSurfaces.join("-") : "global";

	return joinPath(
		normalizedFailureClass || "unknown",
		surfaceSuffix,
	).replaceAll("/", "--");
}
