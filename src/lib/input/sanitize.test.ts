import { describe, expect, it } from "vitest";
import { sanitizeError, sanitizeEvidenceText } from "./sanitize.js";

describe("sanitizeError", () => {
	it("redacts GitHub PATs", () => {
		const error = new Error(
			"Failed with token: ghp_abcdefghijklmnopqrstuvwxyz0123456789",
		);
		expect(sanitizeError(error)).not.toContain("ghp_");
		expect(sanitizeError(error)).toContain("[REDACTED]");
	});

	it("redacts home paths", () => {
		const error = new Error("File not found: /Users/john/secrets/key.pem");
		expect(sanitizeError(error)).not.toContain("/Users/john");
		expect(sanitizeError(error)).toContain("[HOME]");
	});

	it("preserves commit hashes (not 20+ alphanumeric)", () => {
		const error = new Error("Commit: d5a105f4e8c9b7a6d3e2f1a0b9c8d7e6f5a4b3c2");
		// Commit hashes are 40 chars but shouldn't trigger broad pattern anymore
		expect(sanitizeError(error)).toContain("d5a105f");
	});
});

describe("sanitizeEvidenceText", () => {
	it("rewrites gh auth token command substitution to placeholder", () => {
		const input = 'Validation: git push --force-with-lease "$(gh auth token)"';
		const output = sanitizeEvidenceText(input);
		expect(output).toContain("$GITHUB_TOKEN");
		expect(output).not.toContain("$(gh auth token)");
	});

	it("redacts token query params in URLs", () => {
		const input = "https://example.com/callback?token=abc123&state=ok";
		const output = sanitizeEvidenceText(input);
		expect(output).toContain("token=[REDACTED]");
		expect(output).not.toContain("token=abc123");
	});

	it("redacts expanded GitHub PAT values", () => {
		const input = "token=ghp_abcdefghijklmnopqrstuvwxyz0123456789";
		const output = sanitizeEvidenceText(input);
		expect(output).toContain("[REDACTED]");
		expect(output).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123456789");
	});
});
