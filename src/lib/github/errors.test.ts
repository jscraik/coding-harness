import { RequestError } from "@octokit/request-error";
import { describe, expect, it } from "vitest";
import { GitHubApiError, classifyError } from "./errors.js";

type RequestErrorOptions = NonNullable<
	ConstructorParameters<typeof RequestError>[2]
>;
type RequestErrorResponse = NonNullable<RequestErrorOptions["response"]>;

function createRequestError(
	status: number,
	message: string,
	headers: Record<string, string> = {},
): RequestError {
	const response = {
		status,
		url: "https://api.github.com/repos/acme/example",
		headers,
		data: {},
	};

	return new RequestError(message, status, {
		request: {
			method: "GET",
			url: "https://api.github.com/repos/acme/example",
			headers: {},
		},
		response: response as RequestErrorResponse,
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

	it("classifies 403 with x-ratelimit-remaining=0 as RATE_LIMITED", () => {
		const error = GitHubApiError.fromError(
			createRequestError(403, "Rate limit exceeded", {
				"x-ratelimit-remaining": "0",
			}),
		);

		expect(error.name).toBe("ForbiddenError");
		expect(error.code).toBe("RATE_LIMITED");
		expect(classifyError(error)).toBe("RATE_LIMITED");
	});

	it("classifies 403 with x-ratelimit-remaining=0 and reset header with ISO timestamp in message", () => {
		const resetEpoch = "1700000000";
		const expectedIso = new Date(Number(resetEpoch) * 1000).toISOString();
		const error = GitHubApiError.fromError(
			createRequestError(403, "Rate limit exceeded", {
				"x-ratelimit-remaining": "0",
				"x-ratelimit-reset": resetEpoch,
			}),
		);

		expect(error.code).toBe("RATE_LIMITED");
		expect(error.message).toBe(`Rate limit exceeded. Resets at ${expectedIso}`);
	});

	it("classifies 422 as VALIDATION_FAILED", () => {
		const error = GitHubApiError.fromError(
			createRequestError(422, "Unprocessable Entity"),
		);

		expect(error.code).toBe("VALIDATION_FAILED");
		expect(classifyError(error)).toBe("VALIDATION_FAILED");
	});

	it("classifies 500 as SYSTEM_ERROR", () => {
		const error = GitHubApiError.fromError(
			createRequestError(500, "Internal Server Error"),
		);

		expect(error.code).toBe("SYSTEM_ERROR");
		expect(error.status).toBe(500);
		expect(classifyError(error)).toBe("SYSTEM_ERROR");
	});

	it("classifies 503 as SYSTEM_ERROR", () => {
		const error = GitHubApiError.fromError(
			createRequestError(503, "Service Unavailable"),
		);

		expect(error.code).toBe("SYSTEM_ERROR");
		expect(classifyError(error)).toBe("SYSTEM_ERROR");
	});

	it("propagates requestId from x-github-request-id header", () => {
		const error = GitHubApiError.fromError(
			createRequestError(404, "Not Found", {
				"x-github-request-id": "ABC:123:XYZ",
			}),
		);

		expect(error.requestId).toBe("ABC:123:XYZ");
	});

	it("has undefined requestId when header is absent", () => {
		const error = GitHubApiError.fromError(
			createRequestError(404, "Not Found"),
		);

		expect(error.requestId).toBeUndefined();
	});

	it("classifies non-RequestError as SYSTEM_ERROR with original message", () => {
		const plain = new Error("network failure");
		const error = GitHubApiError.fromError(plain);

		expect(error.code).toBe("SYSTEM_ERROR");
		expect(error.status).toBe(0);
		expect(error.message).toBe("network failure");
	});

	it("classifies non-Error unknown value as SYSTEM_ERROR with Unknown error message", () => {
		const error = GitHubApiError.fromError("string-thrown");

		expect(error.code).toBe("SYSTEM_ERROR");
		expect(error.message).toBe("Unknown error");
	});

	it("createRequestError helper constructs valid RequestError without retryCount", () => {
		// Regression: createRequestError no longer includes retryCount; verify it
		// produces a proper RequestError that fromError can classify.
		const requestError = createRequestError(404, "Not Found");
		expect(requestError).toBeInstanceOf(RequestError);
		expect(requestError.status).toBe(404);
		const apiError = GitHubApiError.fromError(requestError);
		expect(apiError.code).toBe("NOT_FOUND");
	});
});

describe("classifyError", () => {
	it("returns SYSTEM_ERROR for non-GitHubApiError values", () => {
		expect(classifyError(new Error("oops"))).toBe("SYSTEM_ERROR");
		expect(classifyError(null)).toBe("SYSTEM_ERROR");
		expect(classifyError(undefined)).toBe("SYSTEM_ERROR");
		expect(classifyError("string")).toBe("SYSTEM_ERROR");
	});

	it("returns the code from GitHubApiError instances", () => {
		const error = GitHubApiError.fromError(
			createRequestError(422, "Unprocessable"),
		);
		expect(classifyError(error)).toBe("VALIDATION_FAILED");
	});
});
