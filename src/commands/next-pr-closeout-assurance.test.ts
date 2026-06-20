import { describe, expect, it } from "vitest";
import type { HarnessAssuranceEntry } from "../lib/harness-assurance.js";
import { hasValidReadyPrCloseoutAssuranceEntries } from "./next-pr-closeout-assurance.js";

const lifecycleState = {
	automationState: "none",
	branchWorktreeState: "clean",
	linearState: "aligned",
	mergeState: "mergeable",
	nextLaneRouting: "merge",
	prState: "open",
	reviewThreadState: "resolved",
};

function readyAssuranceEntries(): HarnessAssuranceEntry[] {
	return [
		{ layer: "unit", status: "pass", evidence: ["unit"] },
		{ layer: "boundary", status: "pass", evidence: ["boundary"] },
		{
			layer: "mock_integration",
			status: "pass",
			evidence: ["mock integration"],
		},
		{ layer: "e2e", status: "pass", evidence: ["e2e"] },
		{ layer: "security", status: "pass", evidence: ["security"] },
		{
			layer: "load_stress",
			status: "pass",
			evidence: ["load"],
			threshold: {
				metric: "p95_latency",
				operator: "<=",
				unit: "ms",
				value: 2500,
			},
		},
		{
			layer: "lifecycle_closeout",
			status: "pass",
			evidence: ["closeout"],
			lifecycleState,
		},
	];
}

describe("hasValidReadyPrCloseoutAssuranceEntries", () => {
	it("rejects malformed nested threshold fields without throwing", () => {
		const entries = readyAssuranceEntries().map((entry) =>
			entry.layer === "load_stress"
				? {
						...entry,
						threshold: {
							metric: 95 as unknown as string,
							operator: "<=",
							unit: "ms",
							value: 2500,
						},
					}
				: entry,
		);

		expect(hasValidReadyPrCloseoutAssuranceEntries(entries)).toBe(false);
	});

	it("rejects malformed nested lifecycle fields without throwing", () => {
		const entries = readyAssuranceEntries().map((entry) =>
			entry.layer === "lifecycle_closeout"
				? {
						...entry,
						lifecycleState: {
							...lifecycleState,
							automationState: 42 as unknown as string,
						},
					}
				: entry,
		);

		expect(hasValidReadyPrCloseoutAssuranceEntries(entries)).toBe(false);
	});
});
