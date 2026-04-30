import { describe, expect, it } from "vitest";
import {
	parseLearningLiveCompanion,
	validateLearningLiveCompanion,
} from "./live-companion.js";

describe("live companion metadata", () => {
	it("accepts coarse CodeRabbit provider metadata", () => {
		const result = validateLearningLiveCompanion({
			schemaVersion: "live-companion/v1",
			provider: "coderabbit",
			evidenceLevel: "coarse_provider_metadata",
			rowLevelEvidence: false,
			sourceLabel: "coderabbit stats",
			collectedAt: "2026-04-30T00:00:00.000Z",
			stats: {
				totalLearnings: 12,
				fresh: true,
			},
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.companion.rowLevelEvidence).toBe(false);
			expect(result.companion.evidenceLevel).toBe("coarse_provider_metadata");
		}
	});

	it("rejects ambiguous row-level evidence", () => {
		const result = validateLearningLiveCompanion({
			schemaVersion: "live-companion/v1",
			provider: "coderabbit",
			evidenceLevel: "row_level",
			rowLevelEvidence: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toContain("evidenceLevel");
		}
	});

	it("rejects non-JSON companion data", () => {
		const result = parseLearningLiveCompanion("not json");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("learnings.live_companion.invalid_json");
		}
	});

	it("redacts schema diagnostics and stats keys", () => {
		const invalid = validateLearningLiveCompanion({
			schemaVersion: "/Users/jamiecraik/private/schema.json",
			provider: "coderabbit",
			evidenceLevel: "coarse_provider_metadata",
			rowLevelEvidence: false,
		});

		expect(invalid.ok).toBe(false);
		if (!invalid.ok) {
			expect(invalid.message).not.toContain("/Users/jamiecraik");
		}

		const valid = validateLearningLiveCompanion({
			schemaVersion: "live-companion/v1",
			provider: "coderabbit",
			evidenceLevel: "coarse_provider_metadata",
			rowLevelEvidence: false,
			stats: {
				"/Users/jamiecraik/private/path": "safe",
				"/home/jamie/private/path": "/home/jamie/secret",
			},
		});

		expect(valid.ok).toBe(true);
		if (valid.ok) {
			expect(JSON.stringify(valid.companion.stats)).not.toContain(
				"/Users/jamiecraik",
			);
			expect(JSON.stringify(valid.companion.stats)).not.toContain(
				"/home/jamie",
			);
		}
	});
});
