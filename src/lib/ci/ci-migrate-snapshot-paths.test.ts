import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HARNESS_DIR } from "../init/types.js";
import {
	defaultSnapshotId,
	getReportPath,
	getSnapshotArtifactsDirectory,
	getSnapshotAttestationPath,
	getSnapshotDigestPath,
	getSnapshotPath,
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
});
