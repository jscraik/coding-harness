/**
 * Validate snapshot attestation payload shape and required values.
 */
export function hasValidSnapshotAttestationShape(
	value: unknown,
	snapshotId: string,
	signatureAlgorithm: string,
): boolean {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Record<string, unknown>;
	return (
		parsed.schemaVersion === "ci-migrate-snapshot-attestation/v1" &&
		parsed.snapshotId === snapshotId &&
		typeof parsed.createdAt === "string" &&
		typeof parsed.expiresAt === "string" &&
		typeof parsed.payloadPath === "string" &&
		typeof parsed.payloadDigest === "string" &&
		typeof parsed.externalControlPlaneStatePath === "string" &&
		typeof parsed.externalControlPlaneStateDigest === "string" &&
		parsed.signatureAlgorithm === signatureAlgorithm &&
		typeof parsed.signingKeyId === "string"
	);
}

/**
 * Validate external control-plane snapshot payload shape and artifact entries.
 */
export function hasValidExternalControlPlaneStateSnapshotShape(
	value: unknown,
	snapshotId: string,
	allowedArtifactPaths: ReadonlySet<string>,
): boolean {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Record<string, unknown>;
	if (
		parsed.schemaVersion !== "ci-migrate-external-control-plane-state/v1" ||
		parsed.snapshotId !== snapshotId ||
		typeof parsed.capturedAt !== "string" ||
		!Array.isArray(parsed.artifacts)
	) {
		return false;
	}
	return parsed.artifacts.every((artifact) => {
		if (!artifact || typeof artifact !== "object") {
			return false;
		}
		const parsedArtifact = artifact as Record<string, unknown>;
		if (
			typeof parsedArtifact.relativePath !== "string" ||
			typeof parsedArtifact.existed !== "boolean" ||
			!allowedArtifactPaths.has(parsedArtifact.relativePath)
		) {
			return false;
		}
		if (parsedArtifact.existed) {
			return (
				typeof parsedArtifact.content === "string" &&
				typeof parsedArtifact.contentDigest === "string"
			);
		}
		return true;
	});
}

/**
 * Validate migration-state attestation payload shape and lifecycle fields.
 */
export function hasValidMigrationStateAttestationShape(
	value: unknown,
	snapshotId: string,
	signatureAlgorithm: string,
): boolean {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Record<string, unknown>;
	return (
		parsed.schemaVersion === "ci-migrate-state-attestation/v1" &&
		parsed.snapshotId === snapshotId &&
		(parsed.stage === "prepared" ||
			parsed.stage === "committed" ||
			parsed.stage === "aborted" ||
			parsed.stage === "rollback-failed") &&
		typeof parsed.createdAt === "string" &&
		typeof parsed.expiresAt === "string" &&
		typeof parsed.payloadPath === "string" &&
		typeof parsed.payloadDigest === "string" &&
		typeof parsed.reportDigest === "string" &&
		typeof parsed.requiredChecksDigest === "string" &&
		(parsed.proofPackPayloadSha256 === undefined ||
			typeof parsed.proofPackPayloadSha256 === "string") &&
		parsed.signatureAlgorithm === signatureAlgorithm &&
		typeof parsed.signingKeyId === "string"
	);
}
