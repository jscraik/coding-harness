import { describe, expect, it } from "vitest";
import {
	DEFAULT_PR_CLOSEOUT_ARTIFACT,
	prCloseoutDecisionMeta,
} from "./next-pr-closeout.js";
import { prCloseoutReport } from "./next-pr-closeout.test-support.js";

describe("harness next pr-closeout metadata", () => {
	it("sanitizes stack evidence before projecting metadata", () => {
		const report = prCloseoutReport({
			stackState: {
				status: "unknown",
				required: false,
				reason: "Inspect /Users/jamie/private?token=secret",
				evidenceRefs: ["/Users/jamie/private?token=secret"],
				blockerRefs: ["/home/jamie/private?api_key=secret"],
				parentPr: 436,
				lowerPrs: [435],
				baseSha: "abc123",
			},
		});
		const metadata = prCloseoutDecisionMeta({
			report,
			artifactPath: DEFAULT_PR_CLOSEOUT_ARTIFACT,
		});
		const serialized = JSON.stringify(metadata);
		expect(metadata).toMatchObject({
			prCloseout: {
				stackState: {
					status: "unknown",
					required: false,
					reason: expect.stringContaining("[HOME]"),
					evidenceRefs: [expect.stringContaining("[REDACTED]")],
					blockerRefs: [expect.stringContaining("[REDACTED]")],
					parentPr: 436,
					lowerPrs: [435],
					baseSha: "abc123",
				},
			},
		});
		expect(serialized).not.toMatch(
			/\/Users\/|\/home\/|token=secret|api_key=secret/,
		);
	});
});
