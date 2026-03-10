import { describe, expect, it } from "vitest";
import {
	MAX_ARRAY_SIZE,
	MAX_GIT_REF_LENGTH,
	MAX_IDENTIFIER_LENGTH,
	MAX_INPUT_LENGTH,
	validateArray,
	validateArraySize,
	validateCliString,
	validateGitRef,
	validateIdentifier,
	validateLength,
	validateNoShellInjection,
	validatePathComponent,
	validateSafeArgument,
	validateSafeString,
	validateSafeUrl,
} from "./validation.js";

describe("validation", () => {
	describe("validateLength", () => {
		it("passes for strings within limit", () => {
			const result = validateLength("hello", 10, "test");
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe("hello");
		});

		it("fails for strings exceeding limit", () => {
			const result = validateLength("hello world", 5, "test");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
				expect(result.error.message).toContain("exceeds maximum length");
			}
		});

		it("passes for empty string", () => {
			const result = validateLength("", 10, "test");
			expect(result.ok).toBe(true);
		});
	});

	describe("validateNoShellInjection", () => {
		it("passes for safe strings", () => {
			const safe = ["hello", "world.txt", "path/to/file", "my-variable"];
			for (const str of safe) {
				const result = validateNoShellInjection(str);
				expect(result.ok).toBe(true);
			}
		});

		it("fails for strings with dangerous shell chars", () => {
			const dangerous = [
				"hello; rm -rf /",
				"world | cat /etc/passwd",
				"file`whoami`",
				"var$(echo hacked)",
				"test && evil",
			];
			for (const str of dangerous) {
				const result = validateNoShellInjection(str);
				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.code).toBe("VALIDATION_ERROR");
				}
			}
		});

		it("fails for command substitution patterns", () => {
			const subs = ["$(echo test)", "`whoami`", "text$(id)more"];
			for (const str of subs) {
				const result = validateNoShellInjection(str);
				expect(result.ok).toBe(false);
			}
		});
	});

	describe("validateSafeArgument", () => {
		it("passes for safe arguments", () => {
			const safe = [
				"hello",
				"file.txt",
				"path/to/file",
				"my_variable",
				"some-thing",
			];
			for (const str of safe) {
				const result = validateSafeArgument(str);
				expect(result.ok).toBe(true);
			}
		});

		it("fails for arguments with special chars", () => {
			const unsafe = [
				"hello world", // space
				"file;txt", // semicolon
				"path|to", // pipe
				"var$name", // dollar
			];
			for (const str of unsafe) {
				const result = validateSafeArgument(str);
				expect(result.ok).toBe(false);
			}
		});
	});

	describe("validateArraySize", () => {
		it("passes for arrays within limit", () => {
			const result = validateArraySize([1, 2, 3], 5, "items");
			expect(result.ok).toBe(true);
		});

		it("fails for arrays exceeding limit", () => {
			const result = validateArraySize([1, 2, 3, 4, 5], 3, "items");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("exceeds maximum size");
			}
		});

		it("passes for empty array", () => {
			const result = validateArraySize([], 10, "items");
			expect(result.ok).toBe(true);
		});
	});

	describe("validateSafeString", () => {
		it("passes for safe strings within length", () => {
			const result = validateSafeString("hello world", 100);
			expect(result.ok).toBe(true);
		});

		it("fails for strings exceeding max length", () => {
			const long = "a".repeat(MAX_INPUT_LENGTH + 1);
			const result = validateSafeString(long);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("exceeds maximum length");
			}
		});

		it("fails for strings with shell injection", () => {
			const result = validateSafeString("hello; rm -rf /");
			expect(result.ok).toBe(false);
		});
	});

	describe("validateGitRef", () => {
		it("passes for valid branch names", () => {
			const valid = ["main", "feature/test", "bugfix-123", "v1.0.0"];
			for (const ref of valid) {
				const result = validateGitRef(ref);
				expect(result.ok).toBe(true);
			}
		});

		it("passes for valid SHAs", () => {
			const result = validateGitRef("abc123def456");
			expect(result.ok).toBe(true);
		});

		it("fails for refs starting with dash", () => {
			const result = validateGitRef("--force");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("invalid pattern");
			}
		});

		it("fails for refs with path traversal", () => {
			const result = validateGitRef("../main");
			expect(result.ok).toBe(false);
		});

		it("fails for refs with double slash", () => {
			const result = validateGitRef("feature//test");
			expect(result.ok).toBe(false);
		});

		it("fails for refs exceeding max length", () => {
			const long = "a".repeat(MAX_GIT_REF_LENGTH + 1);
			const result = validateGitRef(long);
			expect(result.ok).toBe(false);
		});
	});

	describe("validateIdentifier", () => {
		it("passes for valid identifiers", () => {
			const valid = ["hello", "test123", "my_id", "some-thing", "ABC"];
			for (const id of valid) {
				const result = validateIdentifier(id);
				expect(result.ok).toBe(true);
			}
		});

		it("fails for identifiers with special chars", () => {
			const invalid = ["hello.world", "test/id", "my$id", "foo;bar"];
			for (const id of invalid) {
				const result = validateIdentifier(id);
				expect(result.ok).toBe(false);
			}
		});

		it("fails for identifiers exceeding max length", () => {
			const long = "a".repeat(MAX_IDENTIFIER_LENGTH + 1);
			const result = validateIdentifier(long);
			expect(result.ok).toBe(false);
		});
	});

	describe("validatePathComponent", () => {
		it("passes for valid filenames", () => {
			const valid = ["file.txt", "my-file", "test_123", "README"];
			for (const name of valid) {
				const result = validatePathComponent(name);
				expect(result.ok).toBe(true);
			}
		});

		it("fails for path components with separators", () => {
			const result1 = validatePathComponent("path/to/file");
			expect(result1.ok).toBe(false);

			const result2 = validatePathComponent("path\\to\\file");
			expect(result2.ok).toBe(false);
		});

		it("fails for relative path specials", () => {
			const result1 = validatePathComponent(".");
			expect(result1.ok).toBe(false);

			const result2 = validatePathComponent("..");
			expect(result2.ok).toBe(false);
		});

		it("fails for null bytes", () => {
			const result = validatePathComponent("file\0.txt");
			expect(result.ok).toBe(false);
		});
	});

	describe("validateSafeUrl", () => {
		it("passes for safe URLs", () => {
			const safe = [
				"https://example.com",
				"http://localhost:3000",
				"https://api.github.com/v1/repos",
			];
			for (const url of safe) {
				const result = validateSafeUrl(url);
				expect(result.ok).toBe(true);
			}
		});

		it("fails for javascript: URLs", () => {
			const result = validateSafeUrl("javascript:alert(1)");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("disallowed URL scheme");
			}
		});

		it("fails for data: URLs", () => {
			const result = validateSafeUrl(
				"data:text/html,<script>alert(1)</script>",
			);
			expect(result.ok).toBe(false);
		});

		it("fails for file: URLs", () => {
			const result = validateSafeUrl("file:///etc/passwd");
			expect(result.ok).toBe(false);
		});

		it("fails for URLs exceeding max length", () => {
			const long = `https://example.com/${"a".repeat(MAX_INPUT_LENGTH)}`;
			const result = validateSafeUrl(long);
			expect(result.ok).toBe(false);
		});
	});

	describe("validateArray", () => {
		it("validates all elements successfully", () => {
			const values = ["hello", "world", "test"];
			const result = validateArray(values, (v) => validateIdentifier(v));
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toEqual(values);
		});

		it("fails if any element fails validation", () => {
			const values = ["hello", "world/path", "test"];
			const result = validateArray(values, (v) => validateIdentifier(v));
			expect(result.ok).toBe(false);
		});

		it("fails if array exceeds max size", () => {
			const values = Array(MAX_ARRAY_SIZE + 1).fill("test");
			const result = validateArray(values, (v) => ok(v));
			expect(result.ok).toBe(false);
		});
	});

	describe("validateCliString", () => {
		it("passes with default options", () => {
			const result = validateCliString("hello world");
			expect(result.ok).toBe(true);
		});

		it("allows shell chars when explicitly allowed", () => {
			const result = validateCliString("hello | world", {
				allowShellChars: true,
			});
			expect(result.ok).toBe(true);
		});

		it("respects custom max length", () => {
			const result = validateCliString("hello", { maxLength: 3 });
			expect(result.ok).toBe(false);
		});

		it("fails for shell injection by default", () => {
			const result = validateCliString("hello; rm -rf /");
			expect(result.ok).toBe(false);
		});
	});
});

// Helper function for tests
function ok<T>(value: T): { ok: true; value: T } {
	return { ok: true, value };
}
