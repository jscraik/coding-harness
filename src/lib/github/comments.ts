import type { Comment } from "./client.js";
import { isValidSha } from "./sha.js";

const RERUN_MARKER = "<!-- harness-review-rerun -->";
const DEDUP_MAX_AGE_HOURS = 24;

/**
 * Escape markdown special characters to prevent injection attacks.
 * Escapes: backslashes, backticks, asterisks, underscores, braces,
 * brackets, parentheses, hash, plus, minus, dot, exclamation, pipe,
 * angle brackets, @ mentions, and URLs.
 */
export function escapeMarkdown(text: string): string {
	return (
		text
			// Escape backslashes first
			.replace(/\\/g, "\\\\")
			// Escape backticks (code blocks)
			.replace(/`/g, "\\`")
			// Escape markdown formatting characters
			.replace(/([*_{}[\]()#+\-.!|])/g, "\\$1")
			// Escape angle brackets (HTML)
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			// Escape @ mentions by zero-width space insertion
			.replace(/@/g, "@\u200B")
			// Neutralize potential URLs in text
			.replace(/(https?:\/\/)/gi, "$1\u200B")
	);
}

export function formatRerunComment(headSha: string, reason: string): string {
	if (!isValidSha(headSha)) {
		throw new Error(`Invalid SHA format: ${headSha}`);
	}

	const safeReason = escapeMarkdown(reason);
	const timestamp = new Date().toISOString();

	return `${RERUN_MARKER}
## Review Rerun Requested

**SHA:** \`${headSha}\`
**Reason:** ${safeReason}
**Timestamp:** ${timestamp}

An agent will re-run the review for this SHA.
`;
}

export interface RerunCommentMatch {
	found: boolean;
	sha: string;
	timestamp: Date;
}

/**
 * Check if a rerun comment already exists for the given SHA.
 * Uses time-bound (24h) and bot-only deduping to prevent spam.
 */
export function hasRerunCommentForSha(
	comments: Comment[],
	headSha: string,
	botLogin: string,
): RerunCommentMatch {
	if (!isValidSha(headSha)) {
		return { found: false, sha: headSha, timestamp: new Date(0) };
	}

	const cutoff = new Date(Date.now() - DEDUP_MAX_AGE_HOURS * 60 * 60 * 1000);

	for (const comment of comments) {
		// Only check comments from the bot
		if (comment.user.login !== botLogin) continue;
		// Must have the rerun marker
		if (!comment.body.includes(RERUN_MARKER)) continue;

		const commentTime = new Date(comment.created_at);
		// Skip comments older than dedup window
		if (commentTime < cutoff) continue;

		// Extract SHA from comment body
		const shaMatch = comment.body.match(/\*\*SHA:\*\* `([0-9a-f]{40})`/);
		if (shaMatch !== null && shaMatch[1] === headSha) {
			return { found: true, sha: headSha, timestamp: commentTime };
		}
	}

	return { found: false, sha: headSha, timestamp: new Date(0) };
}
