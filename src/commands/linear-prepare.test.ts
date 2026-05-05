import { type PartialDeep, fromPartial } from "@total-typescript/shoehorn";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/linear/client.js", () => ({
	LinearClient: vi.fn(),
	LinearAPIError: class LinearAPIError extends Error {
		readonly code: string;

		constructor(code: string, message: string) {
			super(message);
			this.name = "LinearAPIError";
			this.code = code;
		}
	},
}));

import { LinearClient } from "../lib/linear/client.js";
import { runLinearPrepare } from "./linear-prepare.js";

const mockLinearClient = vi.mocked(LinearClient);
const mockLinearPrepareClient = (client: PartialDeep<LinearClient>) =>
	fromPartial<LinearClient>(client);
const mockLinearClientImplementation = (createClient: () => LinearClient) => {
	mockLinearClient.mockImplementation(function LinearClient() {
		return createClient();
	});
};

const baseIssue = {
	id: "issue-id",
	identifier: "JSC-37",
	title:
		"Enable GitHub to Linear branch and PR automation for the coding-harness workflow",
	url: "https://linear.app/jscraik/issue/JSC-37/example",
	branchName:
		"jscraik/jsc-37-enable-github-to-linear-branch-and-pr-automation-for-the",
	team: {
		id: "team-1",
		key: "JSC",
		name: "Jscraik",
	},
	state: {
		id: "state-backlog",
		name: "Backlog",
		type: "backlog",
	},
};

describe("runLinearPrepare", () => {
	const client = {
		searchIssues: vi.fn(async () => [baseIssue]),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("LINEAR_API_KEY", "");
		client.searchIssues.mockResolvedValue([baseIssue]);
		mockLinearClientImplementation(() => mockLinearPrepareClient(client));
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("requires a Linear API key", async () => {
		const result = await runLinearPrepare({ issue: "JSC-37" });
		expect(result).toEqual({
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message:
					"Missing Linear API key. Provide --token or set LINEAR_API_KEY.",
			},
		});
	});

	it("builds codex branch and PR metadata from the Linear issue", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");

		const result = await runLinearPrepare({ issue: "JSC-37" });
		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(client.searchIssues).toHaveBeenCalledWith("JSC-37");
		expect(result.output.branchName).toBe(
			"codex/jsc-37-enable-github-to-linear-branch-and-pr-automation-for-the",
		);
		expect(result.output.prTitle).toBe(
			"JSC-37: Enable GitHub to Linear branch and PR automation for the coding-harness workflow",
		);
		expect(result.output.closingLine).toBe("Fixes JSC-37");
	});

	it("supports custom branch prefixes", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");

		const result = await runLinearPrepare({
			issue: "JSC-37",
			branchPrefix: "feature",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.output.branchName).toBe(
			"feature/jsc-37-enable-github-to-linear-branch-and-pr-automation-for-the",
		);
	});
});
