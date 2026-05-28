import type { ArtifactRuntimeSurfaceValidationError } from "./types.js";
import { PREVIEW_REQUIRED_KINDS } from "./validation-constants.js";
import {
	addError,
	isHeadSha,
	isRecord,
	isSha256,
	parseIso,
} from "./validation-helpers.js";

/** Validate the additional evidence requirements for claim-support surfaces. */
export function validateClaimSupportSemantics(
	packet: Record<string, unknown>,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (packet.evidenceUse !== "claim_support") return;
	const artifact = isRecord(packet.artifact) ? packet.artifact : {};
	const lineage = isRecord(packet.lineage) ? packet.lineage : {};
	const preview = isRecord(packet.preview) ? packet.preview : {};
	const claimSupport = isRecord(packet.claimSupport) ? packet.claimSupport : {};
	validateClaimSupportFreshnessAndHead(packet, errors);
	validateClaimSupportArtifact(artifact, errors);
	validateClaimSupportPreview(packet, preview, errors);
	validateClaimSupportLineage(packet, lineage, errors);
	validateClaimSupportClaims(claimSupport, errors);
	if (Array.isArray(packet.blockers) && packet.blockers.length > 0) {
		addError(
			errors,
			"blocked_claim_support",
			"blockers",
			"claim-support artifacts cannot have blockers",
		);
	}
}

function validateClaimSupportFreshnessAndHead(
	packet: Record<string, unknown>,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (packet.freshness !== "current") {
		addError(
			errors,
			"stale_surface",
			"freshness",
			"claim-support artifacts must be current",
		);
	}
	if (!isHeadSha(packet.headSha)) {
		addError(
			errors,
			"missing_head_sha",
			"headSha",
			"claim-support artifacts require a current head SHA",
		);
	}
}

function validateClaimSupportArtifact(
	artifact: Record<string, unknown>,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (artifact.exists !== true) {
		addError(
			errors,
			"missing_path",
			"artifact.exists",
			"claim-support artifacts must exist",
		);
	}
	if (
		!Number.isInteger(artifact.sizeBytes) ||
		Number(artifact.sizeBytes) <= 0
	) {
		addError(
			errors,
			"zero_size",
			"artifact.sizeBytes",
			"claim-support artifacts must be non-empty",
		);
	}
	if (!isSha256(artifact.sha256)) {
		addError(
			errors,
			"missing_checksum",
			"artifact.sha256",
			"claim-support artifacts require a checksum",
		);
	}
	if (
		!["current", "not_applicable"].includes(String(artifact.frontMatterStatus))
	) {
		addError(
			errors,
			"stale_front_matter",
			"artifact.frontMatterStatus",
			"claim-support artifacts require current or not_applicable front matter",
		);
	}
}

function validateClaimSupportPreview(
	packet: Record<string, unknown>,
	preview: Record<string, unknown>,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (!["current", "not_applicable"].includes(String(preview.status))) {
		addError(
			errors,
			"broken_preview",
			"preview.status",
			"claim-support artifacts require current or not_applicable preview",
		);
	}
	if (
		PREVIEW_REQUIRED_KINDS.includes(String(packet.surfaceKind) as never) &&
		preview.status === "not_applicable"
	) {
		addError(
			errors,
			"preview_required",
			"preview.status",
			"this surfaceKind requires a current preview for claim support",
		);
	}
}

function validateClaimSupportLineage(
	packet: Record<string, unknown>,
	lineage: Record<string, unknown>,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (lineage.headSha !== packet.headSha) {
		addError(
			errors,
			"mismatched_lineage",
			"lineage.headSha",
			"lineage head SHA must match packet head SHA for claim support",
		);
	}
	if (packet.currentHeadSha !== packet.headSha) {
		addError(
			errors,
			"current_head_mismatch",
			"currentHeadSha",
			"claim-support artifacts must match current repository head SHA",
		);
	}
}

function validateClaimSupportClaims(
	claimSupport: Record<string, unknown>,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (claimSupport.status !== "supported") {
		addError(
			errors,
			"unsupported_claim",
			"claimSupport.status",
			"claim-support evidenceUse requires supported claimSupport status",
		);
	}
	if (
		!Array.isArray(claimSupport.supportedClaimRefs) ||
		claimSupport.supportedClaimRefs.length === 0
	) {
		addError(
			errors,
			"unsupported_claim",
			"claimSupport.supportedClaimRefs",
			"claim support requires at least one typed claim ref",
		);
	}
}

/** Validate timestamp ordering across artifact, preview, verifier, and packet times. */
export function validateTimestampOrdering(
	packet: Record<string, unknown>,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	const artifact = isRecord(packet.artifact) ? packet.artifact : {};
	const preview = isRecord(packet.preview) ? packet.preview : {};
	const lineage = isRecord(packet.lineage) ? packet.lineage : {};
	const producedAt = parseIso(artifact.producedAt);
	const checkedAt = parseIso(preview.checkedAt);
	const generatedAt = parseIso(packet.generatedAt);
	if (producedAt !== null && checkedAt !== null && producedAt > checkedAt) {
		addError(
			errors,
			"timestamp_order",
			"preview.checkedAt",
			"preview checkedAt cannot predate artifact producedAt",
		);
	}
	if (checkedAt !== null && generatedAt !== null && checkedAt > generatedAt) {
		addError(
			errors,
			"timestamp_order",
			"preview.checkedAt",
			"preview checkedAt cannot be after packet generatedAt",
		);
	}
	if (Array.isArray(lineage.verifierRefs)) {
		lineage.verifierRefs.forEach((entry, index) => {
			if (!isRecord(entry)) return;
			const verifiedAt = parseIso(entry.verifiedAt);
			if (producedAt !== null && verifiedAt !== null && verifiedAt < producedAt) {
				addError(
					errors,
					"timestamp_order",
					`lineage.verifierRefs[${index}].verifiedAt`,
					"verifier refs cannot predate artifact producedAt",
				);
			}
			if (generatedAt !== null && verifiedAt !== null && verifiedAt > generatedAt) {
				addError(
					errors,
					"timestamp_order",
					`lineage.verifierRefs[${index}].verifiedAt`,
					"verifier refs cannot be after packet generatedAt",
				);
			}
		});
	}
}
