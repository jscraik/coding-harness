import { describe, expect, it } from "vitest";
import { buildPrCloseoutReport, type PrCloseoutInput } from "./pr-closeout.js";

function baseInput(overrides: Partial<PrCloseoutInput> = {}): PrCloseoutInput {
	return {
		pullRequest: {
			number: 258,
			state: "OPEN",
			isDraft: false,
			mergeStateStatus: "CLEAN",
			url: "https://github.com/jscraik/coding-harness/pull/258",
			reviewDecision: "APPROVED",
			body: "Refs JSC-327\n",
		},
		branch: {
			clean: true,
			pushed: true,
			behindBase: false,
			hasConflicts: false,
		},
		checks: [
			{
				name: "pr-pipeline",
				state: "SUCCESS",
				source: "github",
			},
		],
		reviewThreads: {
			unresolved: 0,
			needsHuman: 0,
			autofixable: 0,
		},
		traceability: {
			sessionIds: ["codex-session:2026-05-16"],
			traceIds: ["circleci:workflow-123"],
			aiSessionTraceability:
				"JSC-327 -> PR #258 -> Codex session -> commit -> validation",
		},
		tools: [
			{
				name: "github_cli",
				available: true,
				ref: "command:gh --version",
				status: "usable",
				failureClass: null,
			},
		],
		...overrides,
	};
}

describe("buildPrCloseoutReport", () => {
	it("marks a fully evidenced PR ready to merge", () => {
		const report = buildPrCloseoutReport(baseInput(), {
			now: new Date("2026-05-16T12:00:00.000Z"),
		});

		expect(report).toMatchObject({
			schemaVersion: "pr-closeout/v1",
			generatedAt: "2026-05-16T12:00:00.000Z",
			pr: 258,
			status: "ready",
			mergeable: true,
			nextAction: "ready_to_merge",
			checks: {
				total: 1,
				failed: 0,
				pending: 0,
				passed: 1,
				unknown: 0,
			},
			traceability: {
				complete: true,
			},
		});
		expect(report.blockers).toEqual([]);
	});

	it("classifies failed checks and missing traceability as Codex-fixable", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [{ name: "linear-gate", state: "FAILURE", source: "github" }],
				traceability: {
					sessionIds: [],
					traceIds: [],
					aiSessionTraceability: null,
				},
			}),
		);

		expect(report.status).toBe("fixable");
		expect(report.nextAction).toBe("codex_can_fix_now");
		expect(report.mergeable).toBe(false);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "checks",
					reason: "Check failed: linear-gate.",
					fixableByCodex: true,
				}),
				expect.objectContaining({
					surface: "traceability",
					fixableByCodex: true,
				}),
			]),
		);
	});

	it("prioritizes unrelated local noise as cleanup before closeout", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				dirtyPaths: [
					{
						path: "tmp/reference.md",
						classification: "unrelated_local_noise",
					},
				],
			}),
		);

		expect(report.status).toBe("cleanup_required");
		expect(report.nextAction).toBe("cleanup_before_continue");
		expect(report.blockers[0]).toMatchObject({
			surface: "worktree",
			classification: "unrelated_dirty_worktree",
			fixableByCodex: false,
		});
	});

	it("waits when checks are still pending", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				checks: [{ name: "pr-pipeline", state: "PENDING", source: "circleci" }],
			}),
		);

		expect(report.status).toBe("waiting");
		expect(report.nextAction).toBe("wait_for_external_check");
		expect(report.blockers[0]).toMatchObject({
			surface: "checks",
			classification: "external_service",
			fixableByCodex: false,
		});
	});

	it("requires pushed branch evidence before closeout", () => {
		const report = buildPrCloseoutReport(
			baseInput({
				branch: {
					clean: true,
					pushed: false,
					behindBase: false,
					hasConflicts: false,
				},
			}),
		);

		expect(report.status).toBe("cleanup_required");
		expect(report.nextAction).toBe("cleanup_before_continue");
		expect(report.blockers[0]).toMatchObject({
			surface: "branch",
			reason: "Branch has not been pushed to the remote PR head.",
			fixableByCodex: true,
		});
	});
});
