import { describe, expect, it } from "vitest";
import {
	detectIssueKey,
	issueKeysMatch,
	normalizeIssueKeyForMatch,
} from "./issue-key.js";

describe("issue key helpers", () => {
	it("normalizes issue keys only for matching", () => {
		expect(normalizeIssueKeyForMatch("codex/jsc-331-trust-boundary")).toBe(
			"JSC-331",
		);
		expect(normalizeIssueKeyForMatch("jSc-331")).toBe("JSC-331");
	});

	it("detects issue keys without rewriting display value", () => {
		expect(detectIssueKey("codex/jsc-331-trust-boundary")).toBe("jsc-331");
		expect(detectIssueKey(null, "Linear JSC-331 evidence")).toBe("JSC-331");
		expect(detectIssueKey("no issue key here")).toBeNull();
	});

	it("compares issue keys case-insensitively without requiring matching display form", () => {
		expect(issueKeysMatch("jSc-331", "JSC-331")).toBe(true);
		expect(issueKeysMatch("JSC-331", "JSC-332")).toBe(false);
		expect(issueKeysMatch("no issue key", "JSC-331")).toBe(false);
	});
});
