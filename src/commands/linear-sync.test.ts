import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HarnessFinding, LinearSyncOptions } from "./linear-sync.js";
import { runLinearSync } from "./linear-sync.js";

// ---------------------------------------------------------------------------
// Mock LinearClient
// ---------------------------------------------------------------------------

const mockTeams = [{ id: "team-1", key: "JSC", name: "Jscraik" }];
const mockLabels: Array<{ id: string; name: string; team?: { id: string } }> =
	[];
const mockIssues: Array<{ identifier: string; title: string; url: string }> =
	[];
const mockComments: Array<{ issueId: string; body: string }> = [];
const mockUpdates: Array<{ issueId: string; input: Record<string, unknown> }> =
	[];
const mockCreated: Array<{ input: Record<string, unknown> }> = [];

vi.mock("../lib/linear/client.js", () => {
	return {
		LinearAPIError: class LinearAPIError extends Error {
			code: string;
			constructor(code: string, message: string) {
				super(message);
				this.code = code;
			}
		},
		LinearClient: vi.fn().mockImplementation(() => ({
			listTeams: vi.fn().mockResolvedValue(mockTeams),
			listLabels: vi.fn().mockResolvedValue(mockLabels),
			searchIssues: vi.fn().mockImplementation((term: string) => {
				// Return issues whose title includes the search term
				return Promise.resolve(
					mockIssues.filter(
						(i) =>
							i.title.includes(term) ||
							// Simulate fingerprint search by checking if any mock issue
							// has a comment with the label name — simplified: just title match
							(term.startsWith("harness-sync:") &&
								i.title.includes("harness-sync")),
					),
				);
			}),
			createComment: vi
				.fn()
				.mockImplementation((issueId: string, body: string) => {
					mockComments.push({ issueId, body });
					return Promise.resolve();
				}),
			updateIssue: vi
				.fn()
				.mockImplementation(
					(issueId: string, input: Record<string, unknown>) => {
						mockUpdates.push({ issueId, input });
						return Promise.resolve();
					},
				),
			createIssue: vi
				.fn()
				.mockImplementation((input: Record<string, unknown>) => {
					mockCreated.push({ input });
					const id = `JSC-${100 + mockCreated.length}`;
					return Promise.resolve({
						id,
						identifier: id,
						title: input.title as string,
						url: `https://linear.app/jscraik/issue/${id}`,
					});
				}),
		})),
	};
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleFinding: HarnessFinding = {
	id: "drift-gate:command.surface.sources.missing",
	title: "Missing CLI source surface",
	severity: "error",
	description: "The command surface file is missing.",
	fixCommands: ["touch src/cli.ts"],
	gate: "drift-gate",
};

const baseOptions: LinearSyncOptions = {
	token: "lin_api_test",
	team: "JSC",
	findingsData: [sampleFinding],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runLinearSync", () => {
	beforeEach(() => {
		mockIssues.length = 0;
		mockComments.length = 0;
		mockUpdates.length = 0;
		mockCreated.length = 0;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns error when token is missing", async () => {
		const saved = process.env.LINEAR_API_KEY;
		process.env.LINEAR_API_KEY = undefined;
		try {
			const result = await runLinearSync({
				findingsData: [sampleFinding],
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
				expect(result.error.message).toContain("LINEAR_API_KEY");
			}
		} finally {
			if (saved !== undefined) process.env.LINEAR_API_KEY = saved;
		}
	});

	it("returns ok with empty results when no findings provided", async () => {
		const result = await runLinearSync({ ...baseOptions, findingsData: [] });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.results).toHaveLength(0);
		}
	});

	it("creates a new issue for a new finding", async () => {
		const result = await runLinearSync(baseOptions);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.results).toHaveLength(1);
		const r = result.results[0];
		expect(r).toBeDefined();
		if (!r) return;
		expect(r.action).toBe("created");
		expect(r.issue?.identifier).toBe("JSC-101");
		expect(mockCreated).toHaveLength(1);
	});

	it("includes fix commands in issue description", async () => {
		await runLinearSync(baseOptions);
		expect(mockCreated[0]?.input?.description).toContain("touch src/cli.ts");
	});

	it("maps error severity to high priority (2)", async () => {
		await runLinearSync(baseOptions);
		expect(mockCreated[0]?.input?.priority).toBe(2);
	});

	it("maps warn severity to normal priority (3)", async () => {
		const result = await runLinearSync({
			...baseOptions,
			findingsData: [{ ...sampleFinding, severity: "warn" }],
		});
		expect(result.ok).toBe(true);
		expect(mockCreated[0]?.input?.priority).toBe(3);
	});

	it("skips creating issues in dry-run mode", async () => {
		const result = await runLinearSync({ ...baseOptions, dryRun: true });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// No Linear calls should create issues
		expect(mockCreated).toHaveLength(0);
		expect(result.dryRun).toBe(true);
		const r = result.results[0];
		expect(r).toBeDefined();
		if (!r) return;
		expect(r.action).toBe("skipped");
		expect(r.skippedReason).toBe("dry-run");
	});

	it("creates comment fingerprint on new issue", async () => {
		await runLinearSync(baseOptions);
		// One createIssue → then a fingerprint comment
		const fingerprintComment = mockComments.find((c) =>
			c.body.includes("harness-sync fingerprint"),
		);
		expect(fingerprintComment).toBeDefined();
	});

	it("processes multiple findings in one call", async () => {
		const finding2: HarnessFinding = {
			id: "drift-gate:status.matrix.missing",
			title: "Missing status matrix",
			severity: "warn",
			gate: "drift-gate",
		};
		const result = await runLinearSync({
			...baseOptions,
			findingsData: [sampleFinding, finding2],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.results).toHaveLength(2);
		expect(mockCreated).toHaveLength(2);
	});

	it("returns NOT_FOUND when team does not exist", async () => {
		const result = await runLinearSync({
			...baseOptions,
			team: "NONEXISTENT",
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});
});
