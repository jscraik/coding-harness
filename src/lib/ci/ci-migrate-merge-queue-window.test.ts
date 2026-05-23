import { describe, expect, it } from "vitest";
import { isValidMergeQueueCutoverWindow } from "./ci-migrate-merge-queue-window.js";

const preCutover = {
	status: "satisfied" as const,
	scannedOpenPrs: 0,
	failingPrs: [],
};

describe("merge queue cutover window validation", () => {
	it("rejects lifecycle timestamps that move backwards", () => {
		const pausedAt = "2026-05-21T12:00:00.000Z";
		const beforePause = "2026-05-21T11:59:00.000Z";
		const afterPause = "2026-05-21T12:01:00.000Z";

		expect(
			isValidMergeQueueCutoverWindow({
				schemaVersion: "ci-migrate-merge-queue-window/v1",
				snapshotId: "drained-backwards",
				stage: "drained",
				pausedAt,
				drainedAt: beforePause,
				preCutover,
			}),
		).toBe(false);
		expect(
			isValidMergeQueueCutoverWindow({
				schemaVersion: "ci-migrate-merge-queue-window/v1",
				snapshotId: "aborted-backwards",
				stage: "aborted",
				pausedAt,
				abortedAt: beforePause,
				preCutover,
			}),
		).toBe(false);
		expect(
			isValidMergeQueueCutoverWindow({
				schemaVersion: "ci-migrate-merge-queue-window/v1",
				snapshotId: "revalidated-backwards",
				stage: "revalidated",
				pausedAt,
				drainedAt: afterPause,
				revalidatedAt: pausedAt,
				preCutover,
				postCutover: preCutover,
			}),
		).toBe(false);
	});
});
