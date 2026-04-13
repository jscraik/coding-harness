import { resolve } from "node:path";
import { HARNESS_DIR } from "../init/types.js";

export const CI_MIGRATE_SNAPSHOT_DIR = "ci-migrate-snapshots";
const REPORT_SUFFIX = ".report.json";
const MAX_SNAPSHOT_ID_LENGTH = 64;
const SNAPSHOT_ID_PATTERN =
	/^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$|^[A-Za-z0-9]$/;

function resolveSnapshotArtifactPath(
	targetDir: string,
	snapshotId: string,
	suffix: string,
): string {
	const validated = validateSnapshotId(snapshotId);
	if (!validated.ok) {
		throw new Error(`Invalid snapshot id: ${validated.error}`);
	}
	return resolve(
		targetDir,
		HARNESS_DIR,
		CI_MIGRATE_SNAPSHOT_DIR,
		`${validated.value}${suffix}`,
	);
}

export function getSnapshotArtifactsDirectory(targetDir: string): string {
	return resolve(targetDir, HARNESS_DIR, CI_MIGRATE_SNAPSHOT_DIR);
}

export function getSnapshotPath(targetDir: string, snapshotId: string): string {
	return resolveSnapshotArtifactPath(targetDir, snapshotId, ".json");
}

export function getSnapshotDigestPath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolveSnapshotArtifactPath(targetDir, snapshotId, ".sha256");
}

export function getSnapshotAttestationPath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolveSnapshotArtifactPath(
		targetDir,
		snapshotId,
		".attestation.json",
	);
}

export function getSnapshotSignaturePath(
	targetDir: string,
	snapshotId: string,
): string {
	return getSnapshotAttestationSignaturePath(targetDir, snapshotId);
}

export function getSnapshotAttestationSignaturePath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolveSnapshotArtifactPath(targetDir, snapshotId, ".attestation.sig");
}

export function getExternalControlPlaneStatePath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolveSnapshotArtifactPath(
		targetDir,
		snapshotId,
		".external-control-plane.json",
	);
}

export function getStatePath(targetDir: string, snapshotId: string): string {
	return resolveSnapshotArtifactPath(targetDir, snapshotId, ".state.json");
}

export function getStateDigestPath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolveSnapshotArtifactPath(targetDir, snapshotId, ".state.sha256");
}

export function getStateSignaturePath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolveSnapshotArtifactPath(targetDir, snapshotId, ".state.sig");
}

export function getStateAttestationPath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolveSnapshotArtifactPath(
		targetDir,
		snapshotId,
		".state.attestation.json",
	);
}

export function getStateAttestationSignaturePath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolveSnapshotArtifactPath(
		targetDir,
		snapshotId,
		".state.attestation.sig",
	);
}

export function getReportPath(targetDir: string, snapshotId: string): string {
	return resolveSnapshotArtifactPath(targetDir, snapshotId, REPORT_SUFFIX);
}

export function defaultSnapshotId(): string {
	return `snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

export function validateSnapshotId(
	value: string,
): { ok: true; value: string } | { ok: false; error: string } {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return {
			ok: false,
			error: "Snapshot id cannot be empty.",
		};
	}
	if (!SNAPSHOT_ID_PATTERN.test(trimmed)) {
		return {
			ok: false,
			error:
				"Snapshot id must start and end with a letter or number and may only include '.', '_' or '-' in the middle.",
		};
	}
	if (trimmed.length > MAX_SNAPSHOT_ID_LENGTH) {
		return {
			ok: false,
			error: `Snapshot id is too long. Maximum length is ${MAX_SNAPSHOT_ID_LENGTH} characters.`,
		};
	}
	if (trimmed.includes("..")) {
		return {
			ok: false,
			error: "Snapshot id cannot contain consecutive dots ('..').",
		};
	}
	return { ok: true, value: trimmed };
}
