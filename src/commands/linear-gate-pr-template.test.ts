import { describe, expect, it } from "vitest";
import { isStandaloneUntrackedPr } from "./linear-gate-pr-template.js";

describe("isStandaloneUntrackedPr", () => {
	it("accepts PR-template metadata for standalone untracked work", () => {
		expect(
			isStandaloneUntrackedPr(`
- Linear reference: n/a because this PR is standalone review remediation.
- Linked issue relationship: standalone/untracked work; no Linear issue was provided.
			`),
		).toBe(true);
	});

	it("rejects n/a metadata without a standalone relationship", () => {
		expect(
			isStandaloneUntrackedPr(`
- Linear reference: n/a because this PR is standalone review remediation.
- Linked issue relationship: follow-up for JSC-123.
			`),
		).toBe(false);
	});
});
