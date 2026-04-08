import { describe, expect, it } from "vitest";
import {
	TRIAGE_SCORE_DEFAULTS,
	parseTriageScoreInputs,
	scoreIssue,
} from "./triage-scoring.js";

describe("parseTriageScoreInputs", () => {
	it("extracts score fields from markdown text", () => {
		const parsed = parseTriageScoreInputs(`
## Triage Inputs
- impact: 5
- unblock_value: 4
- urgency: 3
- confidence: 2
- effort: 1
`);

		expect(parsed).toEqual({
			impact: 5,
			unblockValue: 4,
			urgency: 3,
			confidence: 2,
			effort: 1,
		});
	});

	it("returns empty object for empty input", () => {
		expect(parseTriageScoreInputs(undefined)).toEqual({});
		expect(parseTriageScoreInputs("  ")).toEqual({});
	});
});

describe("scoreIssue", () => {
	it("computes weighted score with exact formula", () => {
		const result = scoreIssue({
			impact: 5,
			unblockValue: 5,
			urgency: 4,
			confidence: 3,
			effort: 2,
		});

		expect(result.score).toBe(37);
		expect(result.band).toBe("pull_now");
		expect(result.metadata.completeness).toBe(1);
		expect(result.metadata.fallbackUsed).toBe(false);
	});

	it("classifies all score bands at boundaries", () => {
		expect(
			scoreIssue({
				impact: 2,
				unblockValue: 1,
				urgency: 1,
				confidence: 1,
				effort: 1,
			}).band,
		).toBe("next_pull"); // 10

		expect(
			scoreIssue({
				impact: 1,
				unblockValue: 1,
				urgency: 2,
				confidence: 1,
				effort: 1,
			}).band,
		).toBe("triage_hold"); // 8

		expect(
			scoreIssue({
				impact: 1,
				unblockValue: 1,
				urgency: 1,
				confidence: 1,
				effort: 2,
			}).band,
		).toBe("backlog_or_rescope"); // 5
	});

	it("uses deterministic fallback values for missing fields", () => {
		const result = scoreIssue({ impact: 5 });
		expect(result.inputs).toEqual({
			impact: 5,
			unblockValue: TRIAGE_SCORE_DEFAULTS.unblockValue,
			urgency: TRIAGE_SCORE_DEFAULTS.urgency,
			confidence: TRIAGE_SCORE_DEFAULTS.confidence,
			effort: TRIAGE_SCORE_DEFAULTS.effort,
		});
		expect(result.metadata.fallbackUsed).toBe(true);
		expect(result.metadata.missingFields).toEqual([
			"unblockValue",
			"urgency",
			"confidence",
			"effort",
		]);
	});

	it("throws for out-of-range values", () => {
		expect(() => scoreIssue({ impact: 6 })).toThrow(/Invalid impact value/);
		expect(() => scoreIssue({ effort: 0 })).toThrow(/Invalid effort value/);
	});
});
