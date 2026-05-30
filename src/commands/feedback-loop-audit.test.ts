import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runFeedbackLoopAuditCLI } from "./feedback-loop-audit.js";

const tempDirs: string[] = [];

afterEach(() => {
	vi.restoreAllMocks();
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function makeIndex(): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "feedback-loop-audit-cli-"));
	tempDirs.push(repoRoot);
	const indexDir = join(repoRoot, ".harness", "feedback-loops");
	mkdirSync(indexDir, { recursive: true });
	writeFileSync(
		join(indexDir, "index.json"),
		JSON.stringify(
			{
				schemaVersion: "feedback-loop-index/v1",
				generatedAt: "2026-05-30T20:54:32.000Z",
				sourceAudit: ".harness/audits/2026-05-30-feedback-loops-audit.md",
				status: "implemented",
				owner: "coding-harness",
				summary: {
					loopCount: 19,
					crossLoopGapCount: 5,
					recommendationCount: 7,
					openFindingCount: 0,
				},
				loops: Array.from({ length: 19 }, (_, index) => ({
					rank: index + 1,
					id: `loop-${(index + 1).toString()}`,
					name: `Loop ${(index + 1).toString()}`,
					leverage: "high",
					owner: "owner",
					sources: ["source"],
					recipients: ["recipient"],
					expectedDelay: "minutes",
					failureClass: "failure",
					action: "act",
					closureState: "implemented",
					evidenceRefs: ["evidence"],
				})),
				crossLoopGaps: Array.from({ length: 5 }, (_, index) => ({
					id: `gap-${(index + 1).toString()}`,
					description: `Gap ${(index + 1).toString()}`,
					closureState: "implemented",
					evidenceRefs: ["evidence"],
				})),
				recommendations: Array.from({ length: 7 }, (_, index) => ({
					id: `recommendation-${(index + 1).toString()}`,
					description: `Recommendation ${(index + 1).toString()}`,
					closureState: "implemented",
					evidenceRefs: ["evidence"],
				})),
			},
			null,
			2,
		),
	);
	return repoRoot;
}

describe("runFeedbackLoopAuditCLI", () => {
	it("emits JSON for the local feedback-loop audit", () => {
		const repoRoot = makeIndex();
		const info = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runFeedbackLoopAuditCLI([
			"--repo-root",
			repoRoot,
			"--json",
		]);

		expect(exitCode).toBe(0);
		const parsed = JSON.parse(String(info.mock.calls.at(-1)?.[0]));
		expect(parsed.schemaVersion).toBe("feedback-loop-audit/v1");
		expect(parsed.status).toBe("pass");
		expect(parsed.summary.implementedLoopCount).toBe(19);
		expect(parsed.summary.implementedRecommendationCount).toBe(7);
	});

	it("returns a JSON usage error for unknown flags", () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runFeedbackLoopAuditCLI(["--json", "--wat"]);

		expect(exitCode).toBe(2);
		const parsed = JSON.parse(String(info.mock.calls.at(-1)?.[0]));
		expect(parsed.error).toMatchObject({
			code: "feedback_loop_audit_usage",
			message: "Unknown argument: --wat",
		});
	});
});
