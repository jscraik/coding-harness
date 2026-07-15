import { describe, expect, it } from "vitest";
import { parseInput } from "../../commands/pr-closeout-input.js";
import { buildPrCloseoutReport } from "./evaluator.js";
import { isPrCloseoutStackState } from "./stack-state.js";

describe("stack-aware PR closeout evidence", () => {
	it("blocks unknown stack state without collapsing it into CI or review truth", () => {
		const report = buildPrCloseoutReport({
			pullRequest: {
				number: 463,
				state: "OPEN",
				body: "Refs JSC-463",
			},
			stackState: {
				status: "unknown",
				evidenceRefs: ["stack:parent-pr"],
			},
		});

		expect(report.stackState).toMatchObject({ status: "unknown" });
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "branch",
					classification: "unknown",
					reason: expect.stringContaining("Stack state is unknown"),
				}),
			]),
		);
	});

	it("blocks an unstable lower stack layer and preserves its evidence refs", () => {
		const report = buildPrCloseoutReport({
			pullRequest: {
				number: 463,
				state: "OPEN",
				body: "Refs JSC-463",
			},
			stackState: {
				status: "unstable",
				parentPr: 462,
				lowerPrs: [461],
				blockerRefs: ["stack:lower-pr-461"],
				reason: "Lower stack layer is conflicted.",
			},
		});

		expect(report.status).not.toBe("ready");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "branch",
					classification: "introduced",
					reason: "Lower stack layer is conflicted.",
					ref: "stack:lower-pr-461",
				}),
			]),
		);
	});

	it("routes optional unstable stack state to the operator path", () => {
		const report = buildPrCloseoutReport({
			pullRequest: {
				number: 463,
				state: "OPEN",
				body: "Refs JSC-463",
			},
			stackState: {
				status: "unstable",
				required: false,
				blockerRefs: ["artifact:stack.json"],
				reason: "Lower stack layer is conflicted.",
			},
		});

		expect(report.status).toBe("needs_jamie");
		expect(report.nextAction).toBe("needs_jamie_decision");
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "branch",
					ref: "stack:artifact:stack.json",
					fixableByCodex: false,
				}),
			]),
		);
	});

	it("accepts explicitly stable stack evidence without adding a stack blocker", () => {
		const report = buildPrCloseoutReport({
			pullRequest: {
				number: 463,
				state: "OPEN",
				body: "Refs JSC-463",
			},
			stackState: { status: "stable", evidenceRefs: ["stack:base-sha"] },
		});

		expect(report.stackState?.status).toBe("stable");
		expect(
			report.blockers.some((blocker) => blocker.reason.includes("Stack state")),
		).toBe(false);
	});

	it("preserves an explicitly optional stack lane without requiring evidence", () => {
		const report = buildPrCloseoutReport({
			pullRequest: {
				number: 463,
				state: "OPEN",
				body: "Refs JSC-463",
			},
			stackState: { status: "unknown", required: false },
		});

		expect(report.stackState).toMatchObject({
			status: "unknown",
			required: false,
		});
		expect(
			report.blockers.some((blocker) => blocker.reason.includes("Stack state")),
		).toBe(false);
	});

	it("rejects malformed stack status at the normalized input boundary", () => {
		expect(() =>
			parseInput(
				JSON.stringify({
					pullRequest: { number: 463 },
					stackState: { status: "maybe" },
				}),
				"fixture",
			),
		).toThrow("fixture stackState must be a valid stack state object");
		expect(isPrCloseoutStackState({ status: "maybe" })).toBe(false);
	});

	it("rejects malformed stack metadata, references, and identifiers", () => {
		const malformedStates: unknown[] = [
			{},
			{ status: "stable" },
			{ status: "stable", required: false },
			{ status: "stable", required: "yes" },
			{ status: "stable", evidenceRefs: [123] },
			{ status: "stable", blockerRefs: [""] },
			{ status: "stable", parentPr: 0 },
			{ status: "stable", lowerPrs: [0] },
		];

		for (const stackState of malformedStates) {
			expect(() =>
				parseInput(
					JSON.stringify({
						pullRequest: { number: 463 },
						stackState,
					}),
					"fixture",
				),
			).toThrow("fixture stackState must be a valid stack state object");
			expect(isPrCloseoutStackState(stackState)).toBe(false);
		}
	});
});
