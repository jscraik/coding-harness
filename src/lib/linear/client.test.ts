import { afterEach, describe, expect, it, vi } from "vitest";
import { type LinearAPIError, LinearClient } from "./client.js";

function mockFetchJson(payload: unknown, ok = true): void {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok,
			json: async () => payload,
		})),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("LinearClient", () => {
	it("maps team issue labels from GraphQL nodes", async () => {
		mockFetchJson({
			data: {
				team: {
					issues: {
						nodes: [
							{
								id: "issue-1",
								identifier: "JSC-200",
								title: "Issue title",
								url: "https://linear.app/jscraik/issue/JSC-200/example",
								branchName: null,
								description: "desc",
								priority: 2,
								estimate: 3,
								team: {
									id: "team-1",
									key: "JSC",
									name: "Jscraik",
								},
								state: {
									id: "state-triage",
									name: "Triage",
									type: "unstarted",
								},
								cycle: null,
								labels: {
									nodes: [
										{ id: "label-1", name: "Bug" },
										{ id: "label-2", name: "Lane A - Active Stabilization" },
									],
								},
							},
						],
					},
				},
			},
		});

		const client = new LinearClient({ token: "linear-token" });
		const issues = await client.listTeamIssues("team-1");

		expect(issues).toHaveLength(1);
		expect(issues[0]?.labels).toEqual([
			{ id: "label-1", name: "Bug" },
			{ id: "label-2", name: "Lane A - Active Stabilization" },
		]);
	});

	it("paginates team issues until all pages are fetched", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: {
						team: {
							issues: {
								nodes: [
									{
										id: "issue-1",
										identifier: "JSC-200",
										title: "Page one issue",
										url: "https://linear.app/jscraik/issue/JSC-200/example",
										branchName: null,
										description: "",
										priority: 2,
										estimate: 3,
										team: {
											id: "team-1",
											key: "JSC",
											name: "Jscraik",
										},
										state: {
											id: "state-triage",
											name: "Triage",
											type: "unstarted",
										},
										cycle: null,
										project: null,
										labels: { nodes: [{ id: "label-1", name: "Feature" }] },
									},
								],
								pageInfo: {
									hasNextPage: true,
									endCursor: "cursor-1",
								},
							},
						},
					},
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: {
						team: {
							issues: {
								nodes: [
									{
										id: "issue-2",
										identifier: "JSC-201",
										title: "Page two issue",
										url: "https://linear.app/jscraik/issue/JSC-201/example",
										branchName: null,
										description: "",
										priority: 2,
										estimate: 2,
										team: {
											id: "team-1",
											key: "JSC",
											name: "Jscraik",
										},
										state: {
											id: "state-triage",
											name: "Backlog",
											type: "unstarted",
										},
										cycle: null,
										project: null,
										labels: { nodes: [{ id: "label-2", name: "Bug" }] },
									},
								],
								pageInfo: {
									hasNextPage: false,
									endCursor: null,
								},
							},
						},
					},
				}),
			});
		vi.stubGlobal("fetch", fetchMock);

		const client = new LinearClient({ token: "linear-token" });
		const issues = await client.listTeamIssues("team-1");

		expect(issues.map((issue) => issue.identifier)).toEqual([
			"JSC-200",
			"JSC-201",
		]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("creates a label and returns the created object", async () => {
		mockFetchJson({
			data: {
				issueLabelCreate: {
					issueLabel: {
						id: "label-100",
						name: "Feature",
						team: {
							id: "team-1",
							key: "JSC",
							name: "Jscraik",
						},
					},
				},
			},
		});

		const client = new LinearClient({ token: "linear-token" });
		const label = await client.createLabel({
			name: "Feature",
			teamId: "team-1",
		});

		expect(label).toEqual({
			id: "label-100",
			name: "Feature",
			team: {
				id: "team-1",
				key: "JSC",
				name: "Jscraik",
			},
		});
	});

	it("fails when createLabel does not return a label object", async () => {
		mockFetchJson({
			data: {
				issueLabelCreate: {
					issueLabel: null,
				},
			},
		});

		const client = new LinearClient({ token: "linear-token" });
		await expect(
			client.createLabel({ name: "Feature", teamId: "team-1" }),
		).rejects.toEqual(
			expect.objectContaining<Partial<LinearAPIError>>({
				code: "LINEAR_API_ERROR",
			}),
		);
	});

	it("paginates team issue fetches beyond the first page", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: {
						team: {
							issues: {
								nodes: [
									{
										id: "issue-1",
										identifier: "JSC-600",
										title: "First page issue",
										url: "https://linear.app/jscraik/issue/JSC-600/example",
										branchName: null,
										description: null,
										priority: null,
										estimate: null,
										team: {
											id: "team-1",
											key: "JSC",
											name: "Jscraik",
										},
										state: {
											id: "state-triage",
											name: "Triage",
											type: "unstarted",
										},
										cycle: null,
										project: null,
										labels: { nodes: [] },
									},
								],
								pageInfo: {
									hasNextPage: true,
									endCursor: "cursor-1",
								},
							},
						},
					},
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: {
						team: {
							issues: {
								nodes: [
									{
										id: "issue-2",
										identifier: "JSC-601",
										title: "Second page issue",
										url: "https://linear.app/jscraik/issue/JSC-601/example",
										branchName: null,
										description: null,
										priority: null,
										estimate: null,
										team: {
											id: "team-1",
											key: "JSC",
											name: "Jscraik",
										},
										state: {
											id: "state-triage",
											name: "Triage",
											type: "unstarted",
										},
										cycle: null,
										project: null,
										labels: { nodes: [] },
									},
								],
								pageInfo: {
									hasNextPage: false,
									endCursor: null,
								},
							},
						},
					},
				}),
			});
		vi.stubGlobal("fetch", fetchMock);

		const client = new LinearClient({ token: "linear-token" });
		const issues = await client.listTeamIssues("team-1");

		expect(issues.map((issue) => issue.identifier)).toEqual([
			"JSC-600",
			"JSC-601",
		]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
