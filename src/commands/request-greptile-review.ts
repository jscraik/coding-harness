/**
 * Request Greptile Review command
 *
 * Triggers a Greptile review by posting a comment on a PR.
 * Greptile will respond to the comment and create a review.
 */

import { GitHubClient } from "../lib/github/client.js";
import { sanitizeError } from "../lib/input/sanitize.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	SYSTEM_ERROR: 10,
} as const;

export interface RequestGreptileReviewOptions {
	token?: string;
	owner?: string;
	repo?: string;
	pr?: number;
	message?: string;
	json?: boolean;
}

export interface RequestGreptileReviewResult {
	ok: boolean;
	commentUrl?: string;
	error?: {
		code: string;
		message: string;
	};
}

function normalizeToken(value: string | undefined): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (
		trimmed.length === 0 ||
		trimmed.toLowerCase() === "undefined" ||
		trimmed.toLowerCase() === "null"
	) {
		return undefined;
	}
	return trimmed;
}

/**
 * Request a Greptile review on a PR by posting a triggering comment
 */
export async function requestGreptileReview(
	options: RequestGreptileReviewOptions,
): Promise<RequestGreptileReviewResult> {
	const token =
		normalizeToken(options.token) ??
		normalizeToken(process.env.GITHUB_TOKEN) ??
		normalizeToken(process.env.GITHUB_PERSONAL_ACCESS_TOKEN);

	if (!token) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message:
					"Missing GitHub token. Provide --token or set GITHUB_TOKEN/GITHUB_PERSONAL_ACCESS_TOKEN.",
			},
		};
	}

	const owner = options.owner?.trim();
	const repo = options.repo?.trim();

	if (!owner || !repo) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "Missing required --owner and --repo values.",
			},
		};
	}

	if (!options.pr || options.pr <= 0) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "Missing or invalid --pr value. Provide a valid PR number.",
			},
		};
	}

	try {
		const client = new GitHubClient({ token, owner, repo });

		// Default trigger message
		const message =
			options.message?.trim() || "@greptileai please review the latest changes";

		// Post comment to trigger Greptile
		const comment = await client.createIssueComment(options.pr, message);

		return {
			ok: true,
			commentUrl: comment.html_url,
		};
	} catch (error) {
		const errorMessage = sanitizeError(error);

		if (errorMessage.includes("404")) {
			return {
				ok: false,
				error: {
					code: "NOT_FOUND",
					message: `PR #${options.pr} not found in ${owner}/${repo}.`,
				},
			};
		}

		if (errorMessage.includes("403") || errorMessage.includes("401")) {
			return {
				ok: false,
				error: {
					code: "PERMISSION_DENIED",
					message: "Token lacks permission to post comments on this PR.",
				},
			};
		}

		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: `Failed to request review: ${errorMessage}`,
			},
		};
	}
}

/**
 * Run the request-greptile-review command from CLI
 */
export async function runRequestGreptileReviewCLI(
	options: RequestGreptileReviewOptions,
): Promise<number> {
	const result = await requestGreptileReview(options);

	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		if (result.ok) {
			console.info("✓ Greptile review requested successfully");
			console.info(`  Comment: ${result.commentUrl}`);
			console.info("  Greptile will respond shortly with a review.");
		} else {
			console.error(`✗ ${result.error?.code}: ${result.error?.message}`);
		}
	}

	return result.ok ? EXIT_CODES.SUCCESS : EXIT_CODES.VALIDATION_ERROR;
}
