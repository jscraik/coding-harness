import { describe, expect, it } from "vitest";
import {
	hasValidExternalControlPlaneStateSnapshotShape,
	hasValidMigrationStateAttestationShape,
	hasValidSnapshotAttestationShape,
} from "./ci-migrate-attestation-validators.js";

describe("ci-migrate-attestation-validators", () => {
	it("validates snapshot attestation shape", () => {
		const valid = hasValidSnapshotAttestationShape(
			{
				schemaVersion: "ci-migrate-snapshot-attestation/v1",
				snapshotId: "snap-1",
				createdAt: "2026-04-28T00:00:00.000Z",
				expiresAt: "2026-04-29T00:00:00.000Z",
				payloadPath: ".harness/ci-migrate/snap-1.json",
				payloadDigest: "abc",
				externalControlPlaneStatePath: ".harness/control-plane/state.json",
				externalControlPlaneStateDigest: "def",
				signatureAlgorithm: "hmac-sha256",
				signingKeyId: "deadbeefdeadbeef",
			},
			"snap-1",
			"hmac-sha256",
		);
		expect(valid).toBe(true);
	});

	it("rejects snapshot attestation with wrong snapshot id", () => {
		const valid = hasValidSnapshotAttestationShape(
			{
				schemaVersion: "ci-migrate-snapshot-attestation/v1",
				snapshotId: "snap-2",
			},
			"snap-1",
			"hmac-sha256",
		);
		expect(valid).toBe(false);
	});

	it("validates external control-plane snapshot artifacts", () => {
		const valid = hasValidExternalControlPlaneStateSnapshotShape(
			{
				schemaVersion: "ci-migrate-external-control-plane-state/v1",
				snapshotId: "snap-1",
				capturedAt: "2026-04-28T00:00:00.000Z",
				artifacts: [
					{
						relativePath: ".harness/control-plane/github-rulesets.json",
						existed: true,
						content: "{}",
						contentDigest: "abc",
					},
				],
			},
			"snap-1",
			new Set([".harness/control-plane/github-rulesets.json"]),
		);
		expect(valid).toBe(true);
	});

	it("rejects external control-plane artifact outside allow-list", () => {
		const valid = hasValidExternalControlPlaneStateSnapshotShape(
			{
				schemaVersion: "ci-migrate-external-control-plane-state/v1",
				snapshotId: "snap-1",
				capturedAt: "2026-04-28T00:00:00.000Z",
				artifacts: [{ relativePath: "bad/path.json", existed: false }],
			},
			"snap-1",
			new Set([".harness/control-plane/github-rulesets.json"]),
		);
		expect(valid).toBe(false);
	});

	it("validates migration state attestation shape", () => {
		const valid = hasValidMigrationStateAttestationShape(
			{
				schemaVersion: "ci-migrate-state-attestation/v1",
				snapshotId: "snap-1",
				stage: "prepared",
				createdAt: "2026-04-28T00:00:00.000Z",
				expiresAt: "2026-04-29T00:00:00.000Z",
				payloadPath: ".harness/ci-migrate/state.json",
				payloadDigest: "abc",
				reportDigest: "def",
				requiredChecksDigest: "ghi",
				signatureAlgorithm: "hmac-sha256",
				signingKeyId: "deadbeefdeadbeef",
			},
			"snap-1",
			"hmac-sha256",
		);
		expect(valid).toBe(true);
	});
});
