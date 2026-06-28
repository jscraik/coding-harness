import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildHarnessDecision } from "../decision/harness-decision.js";
import { collectHarnessOrient } from "./collector.js";

let workspacePath: string;

beforeEach(() => {
	workspacePath = mkdtempSync(join(tmpdir(), "harness-orient-"));
});

afterEach(() => {
	rmSync(workspacePath, { recursive: true, force: true });
});

function writeWorkspaceFile(path: string, contents: string): void {
	const targetPath = join(workspacePath, path);
	mkdirSync(dirname(targetPath), { recursive: true });
	writeFileSync(targetPath, contents);
}

function nextDecisionFixture() {
	return buildHarnessDecision("next", {
		status: "action_required",
		summary: "Fixture next decision.",
		nextAction: "Run fixture validation.",
		nextCommand: "pnpm exec harness validation-plan --json",
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: ["fixture:next"],
		failureClass: null,
		retry: "safe",
		riskTier: "low",
	});
}

describe("collectHarnessOrient", () => {
	it("emits a compact cold-start packet without requiring a preflight receipt", () => {
		writeWorkspaceFile(
			"package.json",
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeWorkspaceFile("src/cli.ts", "export {};\n");
		writeWorkspaceFile("AGENTS.md", "# Agents\n");
		writeWorkspaceFile("CODESTYLE.md", "# Codestyle\n");
		writeWorkspaceFile("AI/context/diagram-context.md", "# Diagram context\n");
		writeWorkspaceFile(
			".harness/active-artifacts.md",
			"# Current Active Route\n\n# Artifact Index\n",
		);
		writeWorkspaceFile(".harness/knowledge/INDEX.md", "# Knowledge\n");
		writeWorkspaceFile(".harness/memory/LEARNINGS.md", "# Learnings\n");
		writeWorkspaceFile(".harness/review-log.md", "# Review log\n");
		writeWorkspaceFile("docs/cli-reference.md", "# CLI\n");

		const report = collectHarnessOrient({
			repoRoot: workspacePath,
			now: new Date("2026-06-28T10:00:00.000Z"),
			nextDecisionProvider: nextDecisionFixture,
		});

		expect(report.schemaVersion).toBe("harness-orient/v1");
		expect(report.generatedAt).toBe("2026-06-28T10:00:00.000Z");
		expect(report.evidenceUse).toBe("orientation");
		expect(report.status).toBe("warn");
		expect(report.nextDecision.schemaVersion).toBe("harness-decision/v1");
		expect(report.sessionContext.schemaVersion).toBe("session-context/v1");
		expect(report.agentReadinessContextHealth.schemaVersion).toBe(
			"agent-readiness-context-health/v1",
		);
		expect(report.preflightReceipt).toMatchObject({
			path: ".harness/runtime/codex-preflight-status.json",
			status: "unobserved",
			command: "bash scripts/codex-preflight.sh --stack auto --mode required",
		});
		expect(report.architectureContext).toMatchObject({
			path: "AI/context/diagram-context.md",
			status: "present",
			validateWhenChangedCommand: "bash scripts/check-diagram-freshness.sh",
		});
		expect(report.projectBrain.authority).toBe("orientation_only");
		expect(report.orientationRefs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "AGENTS.md", status: "present" }),
				expect.objectContaining({
					path: "AI/context/diagram-context.md",
					status: "present",
				}),
			]),
		);
		expect(report.contextCommands.map((command) => command.command)).toEqual([
			"pnpm exec harness next --json",
			"pnpm exec harness session-context --json --repo-root .",
			"pnpm exec harness agent-readiness . --json",
			"pnpm exec harness commands --json --for-agent --mode orient",
		]);
		expect(report.conditionalContext).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					read: "AI/context/diagram-context.md",
					validate: "bash scripts/check-diagram-freshness.sh",
				}),
			]),
		);
		expect(report.truthLaneWarnings.map((warning) => warning.lane)).toEqual([
			"local_code",
			"runtime_artifact",
			"pr_ci",
			"review_threads",
			"tracker",
			"merge_readiness",
		]);
	});
});
