import { RequestError } from "@octokit/request-error";
import { describe, expect, it } from "vitest";
import { GitHubApiError, classifyError } from "./errors.js";

function createRequestError(
	status: number,
	message: string,
	headers: Record<string, string> = {},
): RequestError {
	return new RequestError(message, status, {
		request: {
			method: "GET",
			url: "https://api.github.com/repos/acme/example",
			headers: {},
		},
		response: {
			status,
			url: "https://api.github.com/repos/acme/example",
			headers,
			data: {},
			retryCount: 0,
		},
	});
}

describe("GitHubApiError", () => {
	it("preserves NotFoundError for 404 responses", () => {
		const error = GitHubApiError.fromError(
			createRequestError(404, "Not Found"),
		);

		expect(error.name).toBe("NotFoundError");
		expect(error.code).toBe("NOT_FOUND");
		expect(classifyError(error)).toBe("NOT_FOUND");
	});

	it("preserves ForbiddenError for 403 responses", () => {
		const error = GitHubApiError.fromError(
			createRequestError(403, "Forbidden"),
		);

		expect(error.name).toBe("ForbiddenError");
		expect(error.code).toBe("FORBIDDEN");
		expect(classifyError(error)).toBe("FORBIDDEN");
	});

	it("preserves UnauthorizedError for 401 responses", () => {
		const error = GitHubApiError.fromError(
			createRequestError(401, "Bad credentials"),
		);

		expect(error.name).toBe("UnauthorizedError");
		expect(error.code).toBe("UNAUTHORIZED");
		expect(classifyError(error)).toBe("UNAUTHORIZED");
	});
});