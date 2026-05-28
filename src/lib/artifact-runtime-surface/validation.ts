import {
	ARTIFACT_RUNTIME_SURFACE_SCHEMA_VERSION,
	type ArtifactRuntimeSurfaceValidationError,
	type ArtifactRuntimeSurfaceValidationResult,
} from "./types.js";
import {
	validateClaimSupportSemantics,
	validateTimestampOrdering,
} from "./claim-support-semantics.js";
import {
	ARTIFACT_KEYS,
	BLOCKER_CLASSES,
	BLOCKER_KEYS,
	CLAIM_REF_PATTERN,
	CLAIM_SUPPORT_KEYS,
	CLAIM_SUPPORT_STATUS,
	EVIDENCE_USE,
	FRESHNESS,
	FRONT_MATTER_STATUS,
	LINEAGE_KEYS,
	MEDIA_TYPE_PATTERN,
	PACKET_KEYS,
	PREVIEW_KEYS,
	PREVIEW_STATUS,
	SURFACE_KINDS,
	VERIFIER_REF_KEYS,
} from "./validation-constants.js";
import {
	addError,
	isRecord,
	isSha256,
	requireAllowedKeys,
	requireArray,
	requireEnum,
	requireIso,
	requireLiteral,
	requireNullableHeadSha,
	requirePointer,
	requirePreviewRef,
	requireRepoPath,
	validateNoRawKeys,
	validateScalarValues,
} from "./validation-helpers.js";

/** Validate an ArtifactRuntimeSurface/v1 packet and semantic invariants. */
export function validateArtifactRuntimeSurface(
	value: unknown,
): ArtifactRuntimeSurfaceValidationResult {
	const errors: ArtifactRuntimeSurfaceValidationError[] = [];
	validateNoRawKeys(value, "packet", errors);
	validateScalarValues(value, "packet", errors);
	if (!isRecord(value)) {
		addError(errors, "invalid_packet", "packet", "must be an object");
		return { valid: false, errors };
	}
	validatePacketShape(value, errors);
	validateArtifact(value.artifact, "artifact", errors);
	validateLineage(value.lineage, "lineage", errors);
	validatePreview(value.preview, "preview", errors);
	validateClaimSupport(value.claimSupport, "claimSupport", errors);
	validateBlockers(value.blockers, "blockers", errors);
	validateClaimSupportSemantics(value, errors);
	validateTimestampOrdering(value, errors);
	return { valid: errors.length === 0, errors };
}

function validatePacketShape(
	value: Record<string, unknown>,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	requireAllowedKeys(value, PACKET_KEYS, "packet", errors);
	requireLiteral(
		value.schemaVersion,
		ARTIFACT_RUNTIME_SURFACE_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requirePointer(value.surfaceId, "surfaceId", errors);
	requireIso(value.generatedAt, "generatedAt", errors);
	requirePointer(value.producer, "producer", errors);
	requireLiteral(
		value.runtimeStatus,
		"not_yet_emitted",
		"runtimeStatus",
		errors,
	);
	requireEnum(value.evidenceUse, EVIDENCE_USE, "evidenceUse", errors);
	requireEnum(value.surfaceKind, SURFACE_KINDS, "surfaceKind", errors);
	requireNullableHeadSha(value.headSha, "headSha", errors);
	requireNullableHeadSha(value.currentHeadSha, "currentHeadSha", errors);
	requireEnum(value.freshness, FRESHNESS, "freshness", errors);
	requireArray(value.blockers, "blockers", errors);
	requirePointer(value.nextAction, "nextAction", errors);
}

function validateArtifact(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_artifact", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, ARTIFACT_KEYS, path, errors);
	requireRepoPath(value.path, `${path}.path`, errors);
	if (typeof value.exists !== "boolean") {
		addError(errors, "invalid_exists", `${path}.exists`, "must be boolean");
	}
	if (!Number.isInteger(value.sizeBytes) || Number(value.sizeBytes) < 0) {
		addError(
			errors,
			"invalid_size",
			`${path}.sizeBytes`,
			"must be a non-negative integer",
		);
	}
	if (value.sha256 !== null && !isSha256(value.sha256)) {
		addError(
			errors,
			"invalid_checksum",
			`${path}.sha256`,
			"must be sha256:<64 lowercase hex> or null",
		);
	}
	if (
		typeof value.mediaType !== "string" ||
		!MEDIA_TYPE_PATTERN.test(value.mediaType)
	) {
		addError(
			errors,
			"invalid_media_type",
			`${path}.mediaType`,
			"must be a bounded media type",
		);
	}
	requireEnum(
		value.frontMatterStatus,
		FRONT_MATTER_STATUS,
		`${path}.frontMatterStatus`,
		errors,
	);
	requireIso(value.producedAt, `${path}.producedAt`, errors);
}

function validateLineage(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_lineage", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, LINEAGE_KEYS, path, errors);
	requirePointer(value.producer, `${path}.producer`, errors);
	requirePointerArray(value.sourceRefs, `${path}.sourceRefs`, errors);
	requirePointerArray(
		value.runtimeIdentityRefs,
		`${path}.runtimeIdentityRefs`,
		errors,
	);
	requireVerifierRefs(value.verifierRefs, `${path}.verifierRefs`, errors);
	requireNullableHeadSha(value.headSha, `${path}.headSha`, errors);
}

function requireVerifierRefs(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (!Array.isArray(value) || value.length === 0) {
		addError(
			errors,
			"invalid_verifier_refs",
			path,
			"must be a non-empty array",
		);
		return;
	}
	value.forEach((entry, index) => {
		const entryPath = `${path}[${index}]`;
		if (!isRecord(entry)) {
			addError(errors, "invalid_verifier_ref", entryPath, "must be an object");
			return;
		}
		requireAllowedKeys(entry, VERIFIER_REF_KEYS, entryPath, errors);
		requirePointer(entry.ref, `${entryPath}.ref`, errors);
		requireIso(entry.verifiedAt, `${entryPath}.verifiedAt`, errors);
	});
}

function validatePreview(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_preview", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, PREVIEW_KEYS, path, errors);
	requireEnum(value.status, PREVIEW_STATUS, `${path}.status`, errors);
	if (value.ref !== null) requirePreviewRef(value.ref, `${path}.ref`, errors);
	if (
		value.status === "not_applicable" &&
		value.ref !== "preview:not-applicable"
	) {
		addError(
			errors,
			"invalid_preview_ref",
			`${path}.ref`,
			"not_applicable previews must use preview:not-applicable",
		);
	}
	if (
		value.status !== "not_applicable" &&
		value.ref === "preview:not-applicable"
	) {
		addError(
			errors,
			"invalid_preview_ref",
			`${path}.ref`,
			"preview:not-applicable is only valid when status is not_applicable",
		);
	}
	if (value.status !== "not_applicable" && value.ref === null) {
		addError(
			errors,
			"missing_preview_ref",
			`${path}.ref`,
			"applicable previews require a bounded preview ref",
		);
	}
	if (value.checkedAt !== null)
		requireIso(value.checkedAt, `${path}.checkedAt`, errors);
	if (value.status !== "not_applicable" && value.checkedAt === null) {
		addError(
			errors,
			"missing_preview_check",
			`${path}.checkedAt`,
			"applicable previews require checkedAt",
		);
	}
}

function validateClaimSupport(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_claim_support", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, CLAIM_SUPPORT_KEYS, path, errors);
	requireEnum(value.status, CLAIM_SUPPORT_STATUS, `${path}.status`, errors);
	requireClaimRefArray(
		value.supportedClaimRefs,
		`${path}.supportedClaimRefs`,
		errors,
	);
	requirePointer(value.reason, `${path}.reason`, errors);
}

function validateBlockers(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (!Array.isArray(value)) return;
	value.forEach((blocker, index) => {
		const blockerPath = `${path}[${index}]`;
		if (!isRecord(blocker)) {
			addError(errors, "invalid_blocker", blockerPath, "must be an object");
			return;
		}
		requireAllowedKeys(blocker, BLOCKER_KEYS, blockerPath, errors);
		requireEnum(blocker.class, BLOCKER_CLASSES, `${blockerPath}.class`, errors);
		requirePointer(blocker.reason, `${blockerPath}.reason`, errors);
		requirePointer(blocker.nextAction, `${blockerPath}.nextAction`, errors);
	});
}

function requireClaimRefArray(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (!Array.isArray(value)) {
		addError(errors, "invalid_claim_refs", path, "must be an array");
		return;
	}
	for (const [index, ref] of value.entries()) {
		const refPath = `${path}[${index}]`;
		if (typeof ref !== "string" || !CLAIM_REF_PATTERN.test(ref)) {
			addError(
				errors,
				"invalid_claim_ref",
				refPath,
				"must use a typed claim ref taxonomy",
			);
			continue;
		}
		if (
			ref.includes("artifact-runtime-surface") ||
			ref.includes("artifact-exists")
		) {
			addError(
				errors,
				"self_referential_claim",
				refPath,
				"artifact surfaces cannot support self-referential or generic artifact claims",
			);
		}
	}
}

function requirePointerArray(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (!Array.isArray(value) || value.length === 0) {
		addError(
			errors,
			"invalid_pointer_array",
			path,
			"must be a non-empty array",
		);
		return;
	}
	value.forEach((item, index) => {
		requirePointer(item, `${path}[${index}]`, errors);
	});
}
