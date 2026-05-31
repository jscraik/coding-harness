import { appendFileSync } from "node:fs";
import { expect } from "vitest";

/** Context-rich assertion payload for evidence-bearing tests. */
export interface BehaviorExpectation<TActual, TExpected = TActual> {
	given: string;
	should: string;
	actual: TActual;
	expected: TExpected;
}

/** Assert behavior with explicit evidence context for high-trust tests. */
export function expectBehavior<TActual, TExpected = TActual>({
	given,
	should,
	actual,
	expected,
}: BehaviorExpectation<TActual, TExpected>): void {
	const traceFile = process.env.HARNESS_EXPECT_BEHAVIOR_TRACE_FILE;
	if (traceFile) {
		appendFileSync(
			traceFile,
			`${JSON.stringify({
				given,
				should,
				token: process.env.HARNESS_EXPECT_BEHAVIOR_TRACE_TOKEN ?? "",
				stack: new Error().stack ?? "",
			})}\n`,
		);
	}
	expect(given).toEqual(expect.any(String));
	expect(should).toEqual(expect.any(String));
	expect(actual).toEqual(expected);
}
