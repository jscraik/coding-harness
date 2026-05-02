import { describe, expect, it } from "vitest";
import {
	SENSITIVE_TEXT_REDACTION,
	detectSensitiveText,
	redactSensitiveText,
} from "./sensitive-text.js";

describe("sensitive text handling", () => {
	it("detects token-like values without returning the token", () => {
		const value = "Use token=github_pat_abcdefghijklmnopqrstuvwxyz123456";

		const findings = detectSensitiveText(value);

		expect(findings.map((finding) => finding.code)).toContain(
			"sensitive.github_pat",
		);
		expect(JSON.stringify(findings)).not.toContain(
			"abcdefghijklmnopqrstuvwxyz",
		);
	});

	it("redacts local user paths and token assignments", () => {
		const redacted = redactSensitiveText(
			"Read /Users/jamiecraik/Downloads/learnings.csv, /home/jamie/learnings.csv, ~/private/learnings.csv, C:\\Users\\Jamie\\secret.txt, and \\\\server\\share\\secret.txt with api_key=secret123456",
		);

		expect(redacted).toContain(SENSITIVE_TEXT_REDACTION);
		expect(redacted).not.toContain("/Users/jamiecraik");
		expect(redacted).not.toContain("/home/jamie");
		expect(redacted).not.toContain("~/private");
		expect(redacted).not.toContain("C:\\Users\\Jamie");
		expect(redacted).not.toContain("\\\\server\\share");
		expect(redacted).not.toContain("secret123456");
	});
});
