import { describe, expect, it } from "vitest";
import { expectBehavior } from "./expect-behavior.js";

describe("expectBehavior", () => {
	it("keeps behavior assertions tied to given and should context", () => {
		expect(() =>
			expectBehavior({
				given: "a verifier result with explicit status",
				should:
					"pin the expected status without using the implementation as oracle",
				actual: "blocked",
				expected: "blocked",
			}),
		).not.toThrow();
	});

	it("fails when the actual value does not match the requirement-derived expected value", () => {
		expect(() =>
			expectBehavior({
				given: "a verifier result with stale evidence",
				should: "classify stale evidence as blocked",
				actual: "pass",
				expected: "blocked",
			}),
		).toThrow();
	});

	it("fails when an object actual only partially matches the expected shape", () => {
		expect(() =>
			expectBehavior({
				given: "a behavior result with extra unapproved fields",
				should: "match the requirement-derived object exactly",
				actual: { blockers: 1, status: "ready" },
				expected: { status: "ready" },
			}),
		).toThrow();
	});
});
