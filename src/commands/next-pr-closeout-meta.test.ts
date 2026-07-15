import { describe, expect, it } from "vitest";
import type { PrCloseoutReport } from "../lib/pr-closeout.js";
import {
	DEFAULT_PR_CLOSEOUT_ARTIFACT,
	prCloseoutDecisionMeta,
} from "./next-pr-closeout.js";

describe("harness next pr-closeout metadata", () => {
	it("sanitizes stack evidence before projecting metadata", () => {
		const report = {
			schemaVersion: "pr-closeout/v1",
			pr: 437,
			status: "ready",
			mergeable: true,
			nextAction: "ready_to_merge",
			blockers: [],
			reviewThreads: { unresolved: 0, needsHuman: 0, autofixable: 0 },
			checks: { total: 0, failed: 0, pending: 0, passed: 0, unknown: 0 },
			stackState: {
				status: "unknown",
				reason: "Inspect /Users/jamie/private?token=secret",
				evidenceRefs: ["/Users/jamie/private?token=secret"],
				blockerRefs: ["/home/jamie/private?api_key=secret"],
				parentPr: 436,
				lowerPrs: [435],
				baseSha: "abc123",
			},
		} as unknown as PrCloseoutReport;
		const metadata = prCloseoutDecisionMeta({
			report,
			artifactPath: DEFAULT_PR_CLOSEOUT_ARTIFACT,
		});
		const serialized = JSON.stringify(metadata);
		expect(metadata).toMatchObject({
			prCloseout: {
				stackState: {
					status: "unknown",
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
