import { describe, expect, it } from "vitest";
import type { Comment } from "./client.js";
import {
	escapeMarkdown,
	formatRerunComment,
	hasRerunCommentForSha,
} from "./comments.js";

describe("escapeMarkdown", () => {
	it("escapes backslashes", () => {
		expect(escapeMarkdown("\\test\\")).toBe("\\\\test\\\\");
	});

	it("escapes backticks", () => {
		expect(escapeMarkdown("`code`")).toBe("\\`code\\`");
	});

	it("escapes asterisks and underscores", () => {
		expect(escapeMarkdown("*bold* _italic_")).toBe("\\*bold\\* \\_italic\\_");
	});

	it("escapes angle brackets", () => {
		expect(escapeMarkdown("<script>")).toBe("&lt;script&gt;");
	});

	it("escapes @ mentions with zero-width space", () => {
		expect(escapeMarkdown("@user")).toBe("@\u200Buser");
	});

	it("escapes URLs with zero-width space", () => {
		// Note: dots are also escaped by markdown escaping, so we get both
		expect(escapeMarkdown("https://example.com")).toBe(
			"https://\u200Bexample\\.com",
		);
		expect(escapeMarkdown("http://test.com")).toBe("http://\u200Btest\\.com");
	});

	it("escapes multiple special characters together", () => {
		const input = "Check @user's `code` at https://example.com *important*";
		const escaped = escapeMarkdown(input);
		expect(escaped).toContain("@\u200B");
		expect(escaped).toContain("\\`");
		expect(escaped).toContain("https://\u200B");
		expect(escaped).toContain("\\*");
	});
});

describe("formatRerunComment", () => {
	it("creates valid comment for valid SHA", () => {
		const sha = "0123456789abcdef0123456789abcdef01234567";
		const comment = formatRerunComment(sha, "Test reason");

		expect(comment).toContain("<!-- harness-review-rerun -->");
		expect(comment).toContain(`**SHA:** \`${sha}\``);
		expect(comment).toContain("**Reason:** Test reason");
		expect(comment).toContain("**Timestamp:**");
	});

	it("escapes markdown in reason", () => {
		const sha = "0123456789abcdef0123456789abcdef01234567";
		const comment = formatRerunComment(sha, "*bold* `code`");

		expect(comment).toContain("\\*bold\\*");
		expect(comment).toContain("\\`code\\`");
	});

	it("throws for invalid SHA", () => {
		expect(() => formatRerunComment("invalid", "reason")).toThrow(
			"Invalid SHA format: invalid",
		);
	});

	it("includes timestamp in ISO format", () => {
		const sha = "0123456789abcdef0123456789abcdef01234567";
		const comment = formatRerunComment(sha, "reason");

		// Match ISO 8601 format: YYYY-MM-DDTHH:MM:SS.sssZ
		const isoPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
		expect(comment).toMatch(isoPattern);
	});

	it("sanitizes token substitutions and values in reason text", () => {
		const sha = "0123456789abcdef0123456789abcdef01234567";
		const reason =
			"rerun using $(gh auth token) and ghp_abcdefghijklmnopqrstuvwxyz0123456789";
		const comment = formatRerunComment(sha, reason);

		expect(comment).toContain("$GITHUB\\_TOKEN");
		expect(comment).toContain("\\[REDACTED\\]");
		expect(comment).not.toContain("$(gh auth token)");
		expect(comment).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123456789");
	});
});

describe("hasRerunCommentForSha", () => {
	const botLogin = "harness-bot";
	const sha = "0123456789abcdef0123456789abcdef01234567";

	it("returns found:false when no comments match", () => {
		const comments: Comment[] = [];
		const result = hasRerunCommentForSha(comments, sha, botLogin);

		expect(result.found).toBe(false);
	});

	it("returns found:false for comments from other users", () => {
		const comments: Comment[] = [
			{
				id: 1,
				body: `<!-- harness-review-rerun -->\n**SHA:** \`${sha}\``,
				created_at: new Date().toISOString(),
				html_url: "https://github.com/test/repo/issues/1#issuecomment-1",
				user: { login: "other-bot" },
			},
		];

		const result = hasRerunCommentForSha(comments, sha, botLogin);
		expect(result.found).toBe(false);
	});

	it("returns found:false for comments without marker", () => {
		const comments: Comment[] = [
			{
				id: 1,
				body: `**SHA:** \`${sha}\``,
				created_at: new Date().toISOString(),
				html_url: "https://github.com/test/repo/issues/1#issuecomment-1",
				user: { login: botLogin },
			},
		];

		const result = hasRerunCommentForSha(comments, sha, botLogin);
		expect(result.found).toBe(false);
	});

	it("returns found:false for comments older than 24 hours", () => {
		const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
		const comments: Comment[] = [
			{
				id: 1,
				body: `<!-- harness-review-rerun -->\n**SHA:** \`${sha}\``,
				created_at: oldDate.toISOString(),
				html_url: "https://github.com/test/repo/issues/1#issuecomment-1",
				user: { login: botLogin },
			},
		];

		const result = hasRerunCommentForSha(comments, sha, botLogin);
		expect(result.found).toBe(false);
	});

	it("returns found:true for matching comment within 24 hours", () => {
		const comments: Comment[] = [
			{
				id: 1,
				body: `<!-- harness-review-rerun -->\n**SHA:** \`${sha}\``,
				created_at: new Date().toISOString(),
				html_url: "https://github.com/test/repo/issues/1#issuecomment-1",
				user: { login: botLogin },
			},
		];

		const result = hasRerunCommentForSha(comments, sha, botLogin);
		expect(result.found).toBe(true);
		expect(result.sha).toBe(sha);
	});

	it("returns found:false for different SHA", () => {
		const otherSha = "1111111111111111111111111111111111111111";
		const comments: Comment[] = [
			{
				id: 1,
				body: `<!-- harness-review-rerun -->\n**SHA:** \`${otherSha}\``,
				created_at: new Date().toISOString(),
				html_url: "https://github.com/test/repo/issues/1#issuecomment-1",
				user: { login: botLogin },
			},
		];

		const result = hasRerunCommentForSha(comments, sha, botLogin);
		expect(result.found).toBe(false);
	});

	it("returns found:false for invalid SHA input", () => {
		const comments: Comment[] = [];
		const result = hasRerunCommentForSha(comments, "invalid-sha", botLogin);

		expect(result.found).toBe(false);
	});
});
