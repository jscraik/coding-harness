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
import { runLinearWorkflow } from "./linear-workflow.js";

const mockLinearClient = vi.mocked(LinearClient);

const baseIssue = {
	id: "issue-id",
	identifier: "JSC-36",
	title: "Implement Linear-first harness commands",
	url: "https://linear.app/jscraik/issue/JSC-36/test",
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

const baseStates = [
	{
		id: "state-progress",
		name: "In Progress",
		type: "started",
		team: baseIssue.team,
	},
	{
		id: "state-review",
		name: "In Review",
		type: "started",
		team: baseIssue.team,
	},
	{
		id: "state-done",
		name: "Done",
		type: "completed",
		team: baseIssue.team,
	},
];

describe("runLinearWorkflow", () => {
	const client = {
		searchIssues: vi.fn(async () => [baseIssue]),
		listWorkflowStates: vi.fn(async () => baseStates),
		getViewer: vi.fn(async () => ({
			id: "viewer-1",
			name: "Jamie",
			email: "jamie@example.com",
		})),
		updateIssue: vi.fn(async () => undefined),
		createComment: vi.fn(async () => undefined),
		createAttachment: vi.fn(async () => undefined),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("LINEAR_API_KEY", "");
		client.searchIssues.mockResolvedValue([baseIssue]);
		client.listWorkflowStates.mockResolvedValue(baseStates);
		client.getViewer.mockResolvedValue({
			id: "viewer-1",
			name: "Jamie",
			email: "jamie@example.com",
		});
		mockLinearClient.mockImplementation(
			() => client as unknown as LinearClient,
		);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns a validation error when the Linear token is missing", async () => {
		const result = await runLinearWorkflow({
			action: "claim",
			issue: "JSC-36",
		});

		expect(result).toEqual({
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message:
					"Missing Linear API key. Provide --token or set LINEAR_API_KEY.",
			},
		});
	});

	it("claims an issue by moving it to In Progress, assigning the viewer, and posting a comment", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");

		const result = await runLinearWorkflow({
			action: "claim",
			issue: "https://linear.app/jscraik/issue/JSC-36/test",
			branch: "codex/jsc-36-linear-claim",
			workspace: "/tmp/worktrees/jsc-36",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(client.searchIssues).toHaveBeenCalledWith("JSC-36");
		expect(client.updateIssue).toHaveBeenCalledWith("JSC-36", {
			stateId: "state-progress",
			assigneeId: "viewer-1",
		});
		expect(client.createComment).toHaveBeenCalledWith(
			"JSC-36",
			expect.stringContaining("branch: `codex/jsc-36-linear-claim`"),
		);
		expect(client.createComment).toHaveBeenCalledWith(
			"JSC-36",
			expect.stringContaining("workspace: `/tmp/worktrees/jsc-36`"),
		);
		expect(client.createAttachment).not.toHaveBeenCalled();
		expect(result.output.state).toEqual({
			before: "Backlog",
			after: "In Progress",
			changed: true,
		});
		expect(result.output.assignee).toBe("jamie@example.com");
	});

	it("hands off an issue with attachments for PR, evidence, and references", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");

		const result = await runLinearWorkflow({
			action: "handoff",
			issue: "JSC-36",
			prUrl: "https://github.com/jscraik/coding-harness/pull/123",
			evidenceUrls: [
				"https://example.com/evidence.json",
				"https://example.com/evidence.json",
			],
			links: ["https://example.com/runbook"],
			comment: "Ready for review.",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(client.updateIssue).toHaveBeenCalledWith("JSC-36", {
			stateId: "state-review",
		});
		expect(client.createComment).toHaveBeenCalledWith(
			"JSC-36",
			expect.stringContaining("Ready for review."),
		);
		expect(client.createAttachment).toHaveBeenCalledTimes(3);
		expect(client.createAttachment).toHaveBeenNthCalledWith(1, {
			issueId: "JSC-36",
			title: "Pull request",
			url: "https://github.com/jscraik/coding-harness/pull/123",
		});
		expect(client.createAttachment).toHaveBeenNthCalledWith(2, {
			issueId: "JSC-36",
			title: "Evidence",
			url: "https://example.com/evidence.json",
		});
		expect(client.createAttachment).toHaveBeenNthCalledWith(3, {
			issueId: "JSC-36",
			title: "Reference 1",
			url: "https://example.com/runbook",
		});
		expect(result.output.attachments).toEqual([
			{
				title: "Pull request",
				url: "https://github.com/jscraik/coding-harness/pull/123",
			},
			{ title: "Evidence", url: "https://example.com/evidence.json" },
			{ title: "Reference 1", url: "https://example.com/runbook" },
		]);
	});

	it("rejects unsupported assignee values", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");

		const result = await runLinearWorkflow({
			action: "claim",
			issue: "JSC-36",
			assignee: "jamie@example.com",
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}
		expect(result.error.code).toBe("VALIDATION_ERROR");
		expect(result.error.message).toContain("supports me or a Linear user UUID");
	});

	it("rejects branch names that do not preserve codex prefix and issue key", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");

		const result = await runLinearWorkflow({
			action: "claim",
			issue: "JSC-36",
			branch: "feature/cleanup",
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}
		expect(result.error.code).toBe("VALIDATION_ERROR");
		expect(result.error.message).toContain("Branch must start with codex/.");
		expect(result.error.message).toContain(
			"Branch must include the Linear issue key JSC-36",
		);
	});
});
