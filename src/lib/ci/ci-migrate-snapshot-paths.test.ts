import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HARNESS_DIR } from "../init/types.js";
import {
	defaultSnapshotId,
	getExternalControlPlaneStatePath,
	getReportPath,
	getSnapshotArtifactsDirectory,
	getSnapshotAttestationPath,
	getSnapshotAttestationSignaturePath,
	getSnapshotDigestPath,
	getSnapshotPath,
	getSnapshotSignaturePath,
	getStateAttestationPath,
	getStateAttestationSignaturePath,
	getStateDigestPath,
	getStatePath,
	getStateSignaturePath,
	validateSnapshotId,
} from "./ci-migrate-snapshot-paths.js";

describe("ci-migrate snapshot paths", () => {
	it("builds snapshot artifact paths in the harness snapshot directory", () => {
		const targetDir = "/tmp/repo";
		const snapshotId = "snapshot-2026-04-12";
		const snapshotDir = resolve(targetDir, HARNESS_DIR, "ci-migrate-snapshots");

		expect(getSnapshotArtifactsDirectory(targetDir)).toBe(snapshotDir);
		expect(getSnapshotPath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.json`),
		);
		expect(getSnapshotDigestPath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.sha256`),
		);
		expect(getSnapshotAttestationPath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.attestation.json`),
		);
		expect(getSnapshotSignaturePath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.sig`),
		);
		expect(getSnapshotAttestationSignaturePath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.attestation.sig`),
		);
		expect(getExternalControlPlaneStatePath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.external-control-plane.json`),
		);
		expect(getStatePath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.state.json`),
		);
		expect(getStateDigestPath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.state.sha256`),
		);
		expect(getStateSignaturePath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.state.sig`),
		);
		expect(getStateAttestationPath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.state.attestation.json`),
		);
		expect(getStateAttestationSignaturePath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.state.attestation.sig`),
		);
		expect(getReportPath(targetDir, snapshotId)).toBe(
			resolve(snapshotDir, `${snapshotId}.report.json`),
		);
	});
});

describe("snapshot id helpers", () => {
	it("generates a timestamped default snapshot id", () => {
		expect(defaultSnapshotId()).toMatch(
			/^snapshot-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/,
		);
	});

	it("accepts valid ids and trims whitespace", () => {
		expect(validateSnapshotId(" snapshot-1 ")).toEqual({
			ok: true,
			value: "snapshot-1",
		});
	});

	it("rejects invalid id shapes", () => {
		expect(validateSnapshotId("bad..id")).toEqual({
			ok: false,
			error: "Snapshot id cannot contain consecutive dots ('..').",
		});
		expect(validateSnapshotId("-bad")).toEqual({
			ok: false,
			error:
				"Snapshot id must start and end with a letter or number and may only include '.', '_' or '-' in the middle.",
		});
		expect(validateSnapshotId("a".repeat(65))).toEqual({
			ok: false,
			error: "Snapshot id is too long. Maximum length is 64 characters.",
		});
	});

	it("path builders throw on invalid snapshot ids", () => {
		const targetDir = "/tmp/repo";
		const invalidIds = ["bad..id", "-bad", "a".repeat(65)];

		for (const invalidId of invalidIds) {
			expect(() => getSnapshotPath(targetDir, invalidId)).toThrow(
				/Invalid snapshot id:/,
			);
			expect(() => getSnapshotDigestPath(targetDir, invalidId)).toThrow(
				/Invalid snapshot id:/,
			);
			expect(() => getSnapshotAttestationPath(targetDir, invalidId)).toThrow(
				/Invalid snapshot id:/,
			);
			expect(() => getSnapshotSignaturePath(targetDir, invalidId)).toThrow(
				/Invalid snapshot id:/,
			);
			expect(() =>
				getSnapshotAttestationSignaturePath(targetDir, invalidId),
			).toThrow(/Invalid snapshot id:/);
			expect(() =>
				getExternalControlPlaneStatePath(targetDir, invalidId),
			).toThrow(/Invalid snapshot id:/);
			expect(() => getStatePath(targetDir, invalidId)).toThrow(
				/Invalid snapshot id:/,
			);
			expect(() => getStateDigestPath(targetDir, invalidId)).toThrow(
				/Invalid snapshot id:/,
			);
			expect(() => getStateSignaturePath(targetDir, invalidId)).toThrow(
				/Invalid snapshot id:/,
			);
			expect(() => getStateAttestationPath(targetDir, invalidId)).toThrow(
				/Invalid snapshot id:/,
			);
			expect(() => getStateAttestationSignaturePath(targetDir, invalidId)).toThrow(
				/Invalid snapshot id:/,
			);
			expect(() => getReportPath(targetDir, invalidId)).toThrow(
				/Invalid snapshot id:/,
			);
		}
	});
});