import { RequestError } from "@octokit/request-error";
import { describe, expect, it, vi } from "vitest";
import { GitHubClient, type PullRequestCommit } from "./client.js";

type RequestErrorOptions = NonNullable<
	ConstructorParameters<typeof RequestError>[2]
>;
type RequestErrorResponse = NonNullable<RequestErrorOptions["response"]>;

function createRequestError(status: number, message: string): RequestError {
	const response = {
		status,
		url: "https://api.github.com/repos/acme/example/pulls/1/commits",
		headers: {},
		data: {},
	};

	return new RequestError(message, status, {
		request: {
			method: "GET",
			url: "https://api.github.com/repos/acme/example/pulls/1/commits",
			headers: {},
		},
		response: response as RequestErrorResponse,
	});
}

describe("GitHubClient.listPullRequestCommits", () => {
	it("uses octokit paginate against pulls.listCommits and returns commit payload", async () => {
		const client = new GitHubClient({
			token: "token",
			owner: "acme",
			repo: "example",
		});
		const expectedCommits: PullRequestCommit[] = [
			{
				sha: "0123456789abcdef0123456789abcdef01234567",
				author: { login: "coder" },
				committer: { login: "coder" },
			},
		];
		const listCommits = vi.fn();
		const paginate = vi.fn().mockResolvedValue(expectedCommits);
		(client as unknown as { octokit: unknown }).octokit = {
			paginate,
			pulls: {
				listCommits,
			},
		};

		const result = await client.listPullRequestCommits(17);

		expect(result).toEqual(expectedCommits);
		expect(paginate).toHaveBeenCalledWith(listCommits, {
			owner: "acme",
			repo: "example",
			pull_number: 17,
			per_page: 100,
		});
	});

	it("maps request failures to classified GitHub API errors", async () => {
		const client = new GitHubClient({
			token: "token",
			owner: "acme",
			repo: "example",
		});
		const listCommits = vi.fn();
		const paginate = vi
			.fn()
			.mockRejectedValue(createRequestError(404, "Not Found"));
		(client as unknown as { octokit: unknown }).octokit = {
			paginate,
			pulls: {
				listCommits,
			},
		};

		await expect(client.listPullRequestCommits(17)).rejects.toMatchObject({
			name: "NotFoundError",
			code: "NOT_FOUND",
		});
	});
});

describe("GitHubClient.listCheckRunsForRef", () => {
	it("maps check-run app identity metadata for provider-aware filtering", async () => {
		const client = new GitHubClient({
			token: "token",
			owner: "acme",
			repo: "example",
		});
		const listForRef = vi.fn();
		const paginate = vi.fn().mockResolvedValue([
			{
				id: 101,
				name: "security-scan",
				status: "completed",
				conclusion: "success",
				head_sha: "0123456789abcdef0123456789abcdef01234567",
				app: {
					id: 99,
					slug: "github-actions",
					name: "GitHub Actions",
				},
			},
			{
				id: 102,
				name: "security-scan",
				status: "completed",
				conclusion: "failure",
				head_sha: "0123456789abcdef0123456789abcdef01234567",
			},
		]);
		(client as unknown as { octokit: unknown }).octokit = {
			paginate,
			checks: {
				listForRef,
			},
		};

		const result = await client.listCheckRunsForRef(
			"0123456789abcdef0123456789abcdef01234567",
		);

		expect(result).toEqual([
			{
				id: 101,
				name: "security-scan",
				status: "completed",
				conclusion: "success",
				head_sha: "0123456789abcdef0123456789abcdef01234567",
				app: {
					id: 99,
					slug: "github-actions",
					name: "GitHub Actions",
				},
			},
			{
				id: 102,
				name: "security-scan",
				status: "completed",
				conclusion: "failure",
				head_sha: "0123456789abcdef0123456789abcdef01234567",
			},
		]);
		expect(paginate).toHaveBeenCalledWith(listForRef, {
			owner: "acme",
			repo: "example",
			ref: "0123456789abcdef0123456789abcdef01234567",
			per_page: 100,
		});
	});

	it("coerces malformed check-run head_sha payloads to empty strings", async () => {
		const client = new GitHubClient({
			token: "token",
			owner: "acme",
			repo: "example",
		});
		const listForRef = vi.fn();
		const paginate = vi.fn().mockResolvedValue([
			{
				id: 201,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: null,
			},
		]);
		(client as unknown as { octokit: unknown }).octokit = {
			paginate,
			checks: {
				listForRef,
			},
		};

		const result = await client.listCheckRunsForRef(
			"0123456789abcdef0123456789abcdef01234567",
		);

		expect(result).toEqual([
			{
				id: 201,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: "",
			},
		]);
	});

	it("maps request failures to classified GitHub API errors", async () => {
		const client = new GitHubClient({
			token: "token",
			owner: "acme",
			repo: "example",
		});
		const listForRef = vi.fn();
		const paginate = vi
			.fn()
			.mockRejectedValue(createRequestError(403, "Forbidden"));
		(client as unknown as { octokit: unknown }).octokit = {
			paginate,
			checks: {
				listForRef,
			},
		};

		await expect(
			client.listCheckRunsForRef("0123456789abcdef0123456789abcdef01234567"),
		).rejects.toMatchObject({
			name: "ForbiddenError",
			code: "FORBIDDEN",
		});
	});

	it("retries transient server failures when listing check runs", async () => {
		const client = new GitHubClient({
			token: "token",
			owner: "acme",
			repo: "example",
		});
		const listForRef = vi.fn();
		const paginate = vi
			.fn()
			.mockRejectedValueOnce(createRequestError(504, "Gateway Timeout"))
			.mockResolvedValueOnce([
				{
					id: 301,
					name: "review-check",
					status: "completed",
					conclusion: "success",
					head_sha: "0123456789abcdef0123456789abcdef01234567",
				},
			]);
		(client as unknown as { octokit: unknown }).octokit = {
			paginate,
			checks: {
				listForRef,
			},
		};

		const result = await client.listCheckRunsForRef(
			"0123456789abcdef0123456789abcdef01234567",
		);

		expect(result).toEqual([
			{
				id: 301,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: "0123456789abcdef0123456789abcdef01234567",
			},
		]);
		expect(paginate).toHaveBeenCalledTimes(2);
	});
});
