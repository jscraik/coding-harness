import { describe, expect, it } from "vitest";
import {
	expectBehavior,
	formatBehaviorExpectation,
} from "./expect-behavior.js";

describe("expectBehavior", () => {
	it("formats failures with given and should context", () => {
		expect(
			formatBehaviorExpectation({
				given: "a skipped required check",
				should: "block closeout success",
			}),
		).toBe("Given a skipped required check: should block closeout success");
	});

	it("passes when actual and expected are deeply equal", () => {
		expectBehavior({
			given: "a current evidence packet",
			should: "preserve claim-support status",
			actual: {
				blockerClass: null,
				status: "pass",
			},
			expected: {
				blockerClass: null,
				status: "pass",
			},
		});
	});

	it("throws with behavior context when actual and expected diverge", () => {
		expect(() =>
			expectBehavior({
				given: "a stale evidence packet",
				should: "block claim support",
				actual: { status: "pass" },
				expected: { status: "blocked" },
			}),
		).toThrow(/Given a stale evidence packet: should block claim support/u);
	});
});
