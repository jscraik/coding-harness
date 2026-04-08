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

import {
	LinearClient,
	type LinearLabelSummary,
	type LinearTeamIssue,
	type LinearTeamSummary,
	type LinearWorkflowState,
} from "../lib/linear/client.js";
import { runLinearTriage } from "./linear-triage.js";

const mockLinearClient = vi.mocked(LinearClient);

const baseTeam = {
	id: "team-1",
	key: "JSC",
	name: "Jscraik",
};

describe("runLinearTriage", () => {
	const client = {
		listTeams: vi.fn<() => Promise<LinearTeamSummary[]>>(async () => [
			baseTeam,
		]),
		listTeamIssues: vi.fn<() => Promise<LinearTeamIssue[]>>(async () => []),
		listWorkflowStates: vi.fn<() => Promise<LinearWorkflowState[]>>(
			async () => [],
		),
		listLabels: vi.fn<() => Promise<LinearLabelSummary[]>>(async () => []),
		createLabel: vi.fn<() => Promise<LinearLabelSummary>>(async () => ({
			id: "label-feature",
			name: "Feature",
			team: baseTeam,
		})),
		updateIssue: vi.fn(async () => undefined),
		createComment: vi.fn(async () => undefined),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("LINEAR_API_KEY", "");
		mockLinearClient.mockImplementation(
			() => client as unknown as LinearClient,
		);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns validation error when token is missing", async () => {
		const result = await runLinearTriage({ team: "JSC" });
		expect(result).toEqual({
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message:
					"Missing Linear API key. Provide --token or set LINEAR_API_KEY.",
			},
		});
	});

	it("reports missing type labels in report mode", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");
		client.listTeamIssues.mockResolvedValueOnce([
			{
				id: "issue-1",
				identifier: "JSC-200",
				title: "Enable first-run adoption path",
				url: "https://linear.app/jscraik/issue/JSC-200/example",
				description: [
					"- impact: 5",
					"- unblock_value: 4",
					"- urgency: 3",
					"- confidence: 3",
					"- effort: 2",
				].join("\n"),
				priority: 2,
				estimate: 3,
				labels: [{ id: "lane-b", name: "Lane B - Adoption Path" }],
				cycle: null,
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
		]);

		const result = await runLinearTriage({
			team: "JSC",
			limit: 5,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.recommendations).toHaveLength(1);
		expect(result.output.recommendations[0]?.typeLabel.expected).toBe(
			"Feature",
		);
		expect(result.output.recommendations[0]?.typeLabel.needsLabel).toBe(true);
		expect(result.output.summary.recommendedTypeLabels).toBe(1);
		expect(client.updateIssue).not.toHaveBeenCalled();
	});

	it("applies promotion and syncs missing type labels when requested", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");
		client.listTeamIssues.mockResolvedValueOnce([
			{
				id: "issue-1",
				identifier: "JSC-201",
				title: "Enable init adoption flow",
				url: "https://linear.app/jscraik/issue/JSC-201/example",
				description: [
					"- impact: 5",
					"- unblock_value: 5",
					"- urgency: 4",
					"- confidence: 3",
					"- effort: 2",
				].join("\n"),
				priority: 1,
				estimate: 2,
				labels: [{ id: "lane-b", name: "Lane B - Adoption Path" }],
				cycle: null,
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
		]);
		client.listWorkflowStates.mockResolvedValueOnce([
			{
				id: "state-progress",
				name: "In Progress",
				type: "started",
				team: baseTeam,
			},
		]);
		client.listLabels.mockResolvedValueOnce([]);

		const result = await runLinearTriage({
			team: "JSC",
			apply: true,
			confirm: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(client.createLabel).toHaveBeenCalledWith({
			name: "Feature",
			teamId: "team-1",
		});
		expect(client.updateIssue).toHaveBeenCalledWith("JSC-201", {
			stateId: "state-progress",
			labelIds: ["lane-b", "label-feature"],
		});
		expect(client.createComment).toHaveBeenCalledWith(
			"JSC-201",
			expect.stringContaining("type_label: Feature"),
		);
		expect(result.output.summary.appliedPromotions).toBe(1);
		expect(result.output.summary.appliedTypeLabels).toBe(1);
	});

	it("normalizes multiple primary type labels down to one in apply mode", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");
		client.listTeamIssues.mockResolvedValueOnce([
			{
				id: "issue-1",
				identifier: "JSC-275",
				title: "Fix regression in triage output",
				url: "https://linear.app/jscraik/issue/JSC-275/example",
				description: "",
				priority: 2,
				estimate: 3,
				labels: [
					{ id: "lane-b", name: "Lane B - Adoption Path" },
					{ id: "label-feature", name: "Feature" },
					{ id: "label-bug", name: "Bug" },
				],
				cycle: null,
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
		]);
		client.listLabels.mockResolvedValueOnce([
			{ id: "label-feature", name: "Feature", team: baseTeam },
			{ id: "label-bug", name: "Bug", team: baseTeam },
		]);

		const result = await runLinearTriage({
			team: "JSC",
			apply: true,
			confirm: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(client.updateIssue).toHaveBeenCalledWith("JSC-275", {
			labelIds: ["lane-b", "label-bug"],
		});
		expect(client.createLabel).not.toHaveBeenCalled();
		expect(client.createComment).not.toHaveBeenCalled();
		expect(result.output.summary.recommendedTypeLabels).toBe(1);
		expect(result.output.summary.appliedTypeLabels).toBe(1);
		expect(result.output.recommendations[0]?.typeLabel.needsNormalization).toBe(
			true,
		);
	});

	it("filters triage scope by project when provided", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");
		client.listTeamIssues.mockResolvedValueOnce([
			{
				id: "issue-1",
				identifier: "JSC-401",
				title: "Scoped issue",
				url: "https://linear.app/jscraik/issue/JSC-401/example",
				description: "- impact: 4\n- unblock_value: 3\n- urgency: 3",
				priority: 2,
				estimate: 2,
				labels: [],
				cycle: null,
				project: {
					id: "proj-1",
					name: "coding-harness",
					slugId: "coding-harness",
				},
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
			{
				id: "issue-2",
				identifier: "JSC-402",
				title: "Out-of-scope issue",
				url: "https://linear.app/jscraik/issue/JSC-402/example",
				description: "- impact: 4\n- unblock_value: 3\n- urgency: 3",
				priority: 2,
				estimate: 2,
				labels: [],
				cycle: null,
				project: {
					id: "proj-2",
					name: "other-project",
					slugId: "other-project",
				},
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
		]);

		const result = await runLinearTriage({
			team: "JSC",
			project: "coding-harness",
			limit: 10,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.summary.totalIssues).toBe(1);
		expect(result.output.recommendations).toHaveLength(1);
		expect(result.output.recommendations[0]?.issue.identifier).toBe("JSC-401");
	});

	it("fails apply mode when multiple promotions are selected without confirmation", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");
		client.listTeamIssues.mockResolvedValueOnce([
			{
				id: "issue-1",
				identifier: "JSC-301",
				title: "Enable path one",
				url: "https://linear.app/jscraik/issue/JSC-301/example",
				description:
					"- impact: 5\n- unblock_value: 5\n- urgency: 4\n- confidence: 3\n- effort: 2",
				priority: 1,
				estimate: 2,
				labels: [{ id: "lane-b", name: "Lane B - Adoption Path" }],
				cycle: null,
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
			{
				id: "issue-2",
				identifier: "JSC-302",
				title: "Enable path two",
				url: "https://linear.app/jscraik/issue/JSC-302/example",
				description:
					"- impact: 5\n- unblock_value: 5\n- urgency: 4\n- confidence: 3\n- effort: 2",
				priority: 1,
				estimate: 2,
				labels: [{ id: "lane-b", name: "Lane B - Adoption Path" }],
				cycle: null,
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
		]);

		const result = await runLinearTriage({
			team: "JSC",
			apply: true,
			maxPromote: 2,
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("VALIDATION_ERROR");
		expect(result.error.message).toContain("--confirm");
	});

	it("fails apply mode when type-label sync mutates multiple issues without confirmation", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");
		client.listTeamIssues.mockResolvedValueOnce([
			{
				id: "issue-1",
				identifier: "JSC-510",
				title: "Enable path one",
				url: "https://linear.app/jscraik/issue/JSC-510/example",
				description:
					"- impact: 5\n- unblock_value: 5\n- urgency: 4\n- confidence: 3\n- effort: 2",
				priority: 1,
				estimate: 2,
				labels: [{ id: "lane-b", name: "Lane B - Adoption Path" }],
				cycle: null,
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
			{
				id: "issue-2",
				identifier: "JSC-511",
				title: "Investigate guardrail docs",
				url: "https://linear.app/jscraik/issue/JSC-511/example",
				description:
					"- impact: 2\n- unblock_value: 1\n- urgency: 2\n- confidence: 1\n- effort: 3\n- blocked by JSC-999",
				priority: 3,
				estimate: 3,
				labels: [{ id: "lane-e", name: "Lane E - Docs Efficiency" }],
				cycle: null,
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
		]);

		const result = await runLinearTriage({
			team: "JSC",
			apply: true,
			maxPromote: 2,
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("VALIDATION_ERROR");
		expect(result.error.message).toContain("--confirm");
	});

	it("fails apply mode when multiple normalization-only type label mutations are selected without confirmation", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");
		client.listTeamIssues.mockResolvedValueOnce([
			{
				id: "issue-1",
				identifier: "JSC-710",
				title: "Fix regression in init output",
				url: "https://linear.app/jscraik/issue/JSC-710/example",
				description: "",
				priority: 2,
				estimate: 3,
				labels: [
					{ id: "lane-b", name: "Lane B - Adoption Path" },
					{ id: "label-feature", name: "Feature" },
					{ id: "label-bug", name: "Bug" },
				],
				cycle: null,
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
			{
				id: "issue-2",
				identifier: "JSC-711",
				title: "Fix regression in docs rendering",
				url: "https://linear.app/jscraik/issue/JSC-711/example",
				description: "",
				priority: 2,
				estimate: 3,
				labels: [
					{ id: "lane-e", name: "Lane E - Docs Efficiency" },
					{ id: "label-feature-2", name: "Feature" },
					{ id: "label-bug-2", name: "Bug" },
				],
				cycle: null,
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
		]);

		const result = await runLinearTriage({
			team: "JSC",
			apply: true,
			maxPromote: 0,
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("VALIDATION_ERROR");
		expect(result.error.message).toContain("--confirm");
		expect(client.updateIssue).not.toHaveBeenCalled();
	});

	it("resolves dependency guard against full team scope when project filter is set", async () => {
		vi.stubEnv("LINEAR_API_KEY", "linear-token");
		client.listTeamIssues.mockResolvedValueOnce([
			{
				id: "issue-1",
				identifier: "JSC-520",
				title: "Adoption task",
				url: "https://linear.app/jscraik/issue/JSC-520/example",
				description:
					"- impact: 5\n- unblock_value: 4\n- urgency: 4\n- confidence: 3\n- effort: 2\n- blocked by JSC-521",
				priority: 2,
				estimate: 2,
				labels: [{ id: "lane-b", name: "Lane B - Adoption Path" }],
				cycle: null,
				project: {
					id: "proj-a",
					name: "coding-harness",
					slugId: "coding-harness",
				},
				team: baseTeam,
				state: { id: "state-triage", name: "Triage", type: "unstarted" },
			},
			{
				id: "issue-2",
				identifier: "JSC-521",
				title: "External dependency",
				url: "https://linear.app/jscraik/issue/JSC-521/example",
				description: "Completed dependency issue",
				priority: 3,
				estimate: 1,
				labels: [{ id: "lane-c", name: "Lane C - Architecture Foundations" }],
				cycle: null,
				project: {
					id: "proj-b",
					name: "other-project",
					slugId: "other-project",
				},
				team: baseTeam,
				state: { id: "state-done", name: "Done", type: "completed" },
			},
		]);

		const result = await runLinearTriage({
			team: "JSC",
			project: "coding-harness",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.recommendations).toHaveLength(1);
		expect(result.output.recommendations[0]?.dependencies.unresolved).toEqual(
			[],
		);
		expect(result.output.recommendations[0]?.promotable).toBe(true);
		expect(result.output.summary.recommendedPromotions).toBe(1);
	});
});
