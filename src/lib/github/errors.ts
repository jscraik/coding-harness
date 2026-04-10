import { RequestError } from "@octokit/request-error";

export type GitHubErrorCode =
	| "NOT_FOUND"
	| "FORBIDDEN"
	| "RATE_LIMITED"
	| "UNAUTHORIZED"
	| "VALIDATION_FAILED"
	| "SYSTEM_ERROR";

export interface GitHubErrorDetails {
	code: GitHubErrorCode;
	status: number;
	message: string;
	requestId?: string | undefined;
}

function legacyErrorNameForCode(code: GitHubErrorCode): string {
	switch (code) {
		case "NOT_FOUND":
			return "NotFoundError";
		case "FORBIDDEN":
		case "RATE_LIMITED":
			return "ForbiddenError";
		case "UNAUTHORIZED":
			return "UnauthorizedError";
		default:
			return "GitHubApiError";
	}
}

export class GitHubApiError extends Error {
	public readonly code: GitHubErrorCode;
	public readonly status: number;
	public readonly requestId?: string | undefined;

	constructor(details: GitHubErrorDetails) {
		super(details.message);
		this.name = legacyErrorNameForCode(details.code);
		this.code = details.code;
		this.status = details.status;
		this.requestId = details.requestId;
	}

	static fromError(error: unknown): GitHubApiError {
		if (!(error instanceof RequestError)) {
			return new GitHubApiError({
				code: "SYSTEM_ERROR",
				status: 0,
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}

		const status = error.status;
		const requestId = error.response?.headers?.["x-github-request-id"];

		let code: GitHubErrorCode;
		let message: string;

		switch (status) {
			case 404:
				code = "NOT_FOUND";
				message = "Resource not found";
				break;
			case 403: {
				const remaining = error.response?.headers?.["x-ratelimit-remaining"];
				if (remaining === "0") {
					code = "RATE_LIMITED";
					const resetTime = error.response?.headers?.["x-ratelimit-reset"];
					message = resetTime
						? `Rate limit exceeded. Resets at ${new Date(Number.parseInt(resetTime, 10) * 1000).toISOString()}`
						: "Rate limit exceeded";
				} else {
					code = "FORBIDDEN";
					message = "Permission denied";
				}
				break;
			}
			case 401:
				code = "UNAUTHORIZED";
				message = "Authentication failed";
				break;
			case 422:
				code = "VALIDATION_FAILED";
				message = "Validation failed";
				break;
			default:
				code = status >= 500 ? "SYSTEM_ERROR" : "VALIDATION_FAILED";
				message = `GitHub API error: ${status}`;
		}

		return new GitHubApiError({
			code,
			status,
			message:
				code === "RATE_LIMITED" && message.includes("Resets at")
					? message
					: error.message || message,
			requestId,
		});
	}
}

export function classifyError(error: unknown): GitHubErrorCode {
	if (error instanceof GitHubApiError) {
		return error.code;
	}
	return "SYSTEM_ERROR";
}
