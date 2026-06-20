import { describe, expect, it } from "vitest";
import { nextDecisionOperationalMeta } from "./next-decision-meta.js";

describe("nextDecisionOperationalMeta", () => {
	it("keeps canonical evidence metadata ahead of caller extras", () => {
		const meta = nextDecisionOperationalMeta({
			mode: "local",
			extra: {
				sourceErrors: [{ kind: "git", ref: "caller" }],
			},
			sourceErrors: [
				{
					kind: "git",
					ref: "canonical",
					freshness: "current",
					sha: null,
					status: "usable",
					failureClass: null,
				},
			],
		});

		expect(meta.sourceErrors).toEqual([
			expect.objectContaining({ ref: "canonical" }),
		]);
	});
});
