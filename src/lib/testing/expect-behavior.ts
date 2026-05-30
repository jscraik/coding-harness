import { expect } from "vitest";

/**
 * Describes one evidence-bearing behavior assertion.
 */
export type BehaviorExpectation = {
	given: string;
	should: string;
	actual: unknown;
	expected: unknown;
};

/**
 * Formats the behavior context used in evidence-bearing assertion failures.
 */
export function formatBehaviorExpectation({
	given,
	should,
}: Pick<BehaviorExpectation, "given" | "should">): string {
	return `Given ${given}: should ${should}`;
}

/**
 * Asserts a behavior-shaped actual/expected pair with agent-readable context.
 */
export function expectBehavior(expectation: BehaviorExpectation): void {
	expect(
		expectation.actual,
		formatBehaviorExpectation(expectation),
	).toStrictEqual(expectation.expected);
}
