import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
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

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
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
		followUpCommands: [
			"harness next --json",
			"pnpm exec harness commands --json",
			"pnpm test",
		],
		retry: "safe",
		riskTier: "low",
	});
}

function passNextDecisionFixture() {
	return buildHarnessDecision("next", {
		status: "pass",
		summary: "Fixture next decision passed.",
		nextAction: "Continue with current lane.",
		nextCommand: "pnpm exec harness next --json",
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: ["fixture:next-pass"],
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
		writeWorkspaceFile("dist/cli.js", "export {};\n");
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
		expect(report.nextDecision.nextCommand).toBe(
			"pnpm exec harness validation-plan --json",
		);
		expect(report.nextDecision.followUpCommands).toEqual([
			"pnpm exec harness next --json",
			"pnpm exec harness commands --json",
			"pnpm test",
		]);
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
		const repoRef = shellQuote(realpathSync(workspacePath));
		expect(report.contextCommands.map((command) => command.command)).toEqual([
			`cd ${repoRef} && pnpm exec harness next --json`,
			`cd ${repoRef} && pnpm exec harness session-context --json --repo-root ${repoRef}`,
			`cd ${repoRef} && pnpm exec harness agent-readiness --json --repo-root ${repoRef}`,
			`cd ${repoRef} && pnpm exec harness commands --json --for-agent --mode orient`,
		]);
		expect(
			report.sessionContext.nextTraversalHints.map((hint) => hint.command),
		).toEqual([
			`cd ${repoRef} && pnpm exec harness next --json`,
			`cd ${repoRef} && pnpm exec harness runtime-card --json --repo ${repoRef}`,
			`cd ${repoRef} && pnpm exec harness agent-readiness --json --repo-root ${repoRef}`,
			`cd ${repoRef} && pnpm exec harness commands --json --for-agent --mode orient`,
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

	it("warns when Project Brain validation has errors", () => {
		writeWorkspaceFile(
			"package.json",
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeWorkspaceFile("src/cli.ts", "export {};\n");
		writeWorkspaceFile("dist/cli.js", "export {};\n");
		writeWorkspaceFile("AGENTS.md", "# Agents\n");
		writeWorkspaceFile("CODESTYLE.md", "# Codestyle\n");
		writeWorkspaceFile("AI/context/diagram-context.md", "# Diagram context\n");
		writeWorkspaceFile(
			".harness/runtime/codex-preflight-status.json",
			JSON.stringify({
				schemaVersion: "codex-preflight-status/v1",
				generatedAt: "2026-06-28T10:00:00.000Z",
				status: "pass",
				mode: "required",
				command: "bash scripts/codex-preflight.sh --stack auto --mode required",
				checks: [],
			}),
		);
		writeWorkspaceFile(".harness/README.md", "# Project Brain\n");

		const report = collectHarnessOrient({
			repoRoot: workspacePath,
			now: new Date("2026-06-28T10:00:00.000Z"),
			nextDecisionProvider: passNextDecisionFixture,
		});

		expect(report.projectBrain.validationSummary?.errors).toBeGreaterThan(0);
		expect(report.status).toBe("warn");
	});

	it("warns when a passing preflight receipt used a non-required mode", () => {
		writeWorkspaceFile(
			"package.json",
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeWorkspaceFile("src/cli.ts", "export {};\n");
		writeWorkspaceFile("dist/cli.js", "export {};\n");
		writeWorkspaceFile("AGENTS.md", "# Agents\n");
		writeWorkspaceFile("CODESTYLE.md", "# Codestyle\n");
		writeWorkspaceFile("AI/context/diagram-context.md", "# Diagram context\n");
		writeWorkspaceFile(
			".harness/runtime/codex-preflight-status.json",
			JSON.stringify({
				schemaVersion: "codex-preflight-status/v1",
				generatedAt: "2026-06-28T10:00:00.000Z",
				status: "pass",
				mode: "optional",
				command: "bash scripts/codex-preflight.sh --stack auto --mode optional",
				checks: [],
			}),
		);
		writeWorkspaceFile(
			".harness/knowledge/INDEX.md",
			"# Index\n\n**Last updated:** 2026-06-28\n\n| Domain | Focus |\n| --- | --- |\n| [cli](./cli/) | CLI delivery evidence |\n",
		);
		writeWorkspaceFile(
			".harness/knowledge/cli/knowledge.md",
			"# CLI Knowledge\n\n**Last verified:** 2026-06-28\n**Verification source:** manual\n**Confidence:** high\n**Owner:** harness-maintainers\n\nThe CLI domain is verified for orient tests.\n",
		);
		writeWorkspaceFile(
			".harness/knowledge/cli/hypotheses.md",
			"# CLI Hypotheses\n\n- H-1: Orient should warn on weaker preflight modes.\n",
		);
		writeWorkspaceFile(
			".harness/knowledge/cli/rules.md",
			"# CLI Rules\n\n- **R-1**: Required preflight mode is the orient proof lane.\n",
		);
		writeWorkspaceFile(
			".harness/quality/criteria.md",
			"# Quality Criteria\n\n- Q-1 Gate: orient warns on weaker preflight modes.\n",
		);
		writeWorkspaceFile(
			".harness/review-log.md",
			"# Review Log\n\n- 2026-06-28: Orient preflight mode reviewed.\n",
		);

		const report = collectHarnessOrient({
			repoRoot: workspacePath,
			now: new Date("2026-06-28T10:00:00.000Z"),
			nextDecisionProvider: passNextDecisionFixture,
		});

		expect(report.preflightReceipt).toMatchObject({
			status: "pass",
			mode: "optional",
		});
		expect(report.projectBrain.validationSummary?.errors).toBe(0);
		expect(report.status).toBe("warn");
	});

	it("treats schema-mismatched preflight receipts as invalid", () => {
		writeWorkspaceFile(
			"package.json",
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeWorkspaceFile("src/cli.ts", "export {};\n");
		writeWorkspaceFile("dist/cli.js", "export {};\n");
		writeWorkspaceFile(
			".harness/runtime/codex-preflight-status.json",
			JSON.stringify({
				schemaVersion: "foreign-status/v1",
				status: "pass",
				generatedAt: "2026-06-28T10:00:00.000Z",
				mode: "required",
			}),
		);

		const report = collectHarnessOrient({
			repoRoot: workspacePath,
			now: new Date("2026-06-28T10:00:00.000Z"),
			nextDecisionProvider: passNextDecisionFixture,
		});

		expect(report.preflightReceipt).toMatchObject({
			status: "invalid",
			schemaVersion: null,
			reason: "Receipt schemaVersion was not codex-preflight-status/v1.",
		});
		expect(report.status).toBe("warn");
	});

	it("uses installed harness traversal hints for downstream repositories", () => {
		writeWorkspaceFile("package.json", JSON.stringify({ name: "fixture-app" }));

		const report = collectHarnessOrient({
			repoRoot: workspacePath,
			now: new Date("2026-06-28T10:00:00.000Z"),
			nextDecisionProvider: nextDecisionFixture,
		});

		const repoRef = shellQuote(realpathSync(workspacePath));
		expect(report.contextCommands.map((command) => command.command)).toEqual([
			`cd ${repoRef} && harness next --json`,
			`cd ${repoRef} && harness session-context --json --repo-root ${repoRef}`,
			`cd ${repoRef} && harness agent-readiness --json --repo-root ${repoRef}`,
			`cd ${repoRef} && harness commands --json --for-agent --mode orient`,
		]);
		expect(
			report.sessionContext.nextTraversalHints.map((hint) => hint.command),
		).toEqual([
			`cd ${repoRef} && harness next --json`,
			`cd ${repoRef} && harness runtime-card --json --repo ${repoRef}`,
			`cd ${repoRef} && harness agent-readiness --json --repo-root ${repoRef}`,
			`cd ${repoRef} && harness commands --json --for-agent --mode orient`,
		]);
		expect(
			report.sessionContext.nextTraversalHints.some((hint) =>
				hint.command.includes("src/cli.ts"),
			),
		).toBe(false);
		expect(report.nextDecision.nextCommand).toBe(
			"harness validation-plan --json",
		);
		expect(report.nextDecision.followUpCommands).toEqual([
			"harness next --json",
			"harness commands --json",
			"pnpm test",
		]);
	});

	it("uses the source probe command rail before the source checkout is built", () => {
		writeWorkspaceFile(
			"package.json",
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeWorkspaceFile("src/cli.ts", "export {};\n");

		const report = collectHarnessOrient({
			repoRoot: workspacePath,
			now: new Date("2026-06-28T10:00:00.000Z"),
			nextDecisionProvider: nextDecisionFixture,
		});

		const repoRef = shellQuote(realpathSync(workspacePath));
		expect(report.contextCommands.map((command) => command.command)).toEqual([
			`cd ${repoRef} && node --import tsx src/cli.ts next --json`,
			`cd ${repoRef} && node --import tsx src/cli.ts session-context --json --repo-root ${repoRef}`,
			`cd ${repoRef} && node --import tsx src/cli.ts agent-readiness --json --repo-root ${repoRef}`,
			`cd ${repoRef} && node --import tsx src/cli.ts commands --json --for-agent --mode orient`,
		]);
		expect(
			report.sessionContext.nextTraversalHints.map((hint) => hint.command),
		).toEqual([
			`cd ${repoRef} && node --import tsx src/cli.ts next --json`,
			`cd ${repoRef} && node --import tsx src/cli.ts runtime-card --json --repo ${repoRef}`,
			`cd ${repoRef} && node --import tsx src/cli.ts agent-readiness --json --repo-root ${repoRef}`,
			`cd ${repoRef} && node --import tsx src/cli.ts commands --json --for-agent --mode orient`,
		]);
		expect(report.nextDecision.nextCommand).toBe(
			"node --import tsx src/cli.ts validation-plan --json",
		);
		expect(report.nextDecision.followUpCommands).toEqual([
			"node --import tsx src/cli.ts next --json",
			"node --import tsx src/cli.ts commands --json",
			"pnpm test",
		]);
		expect(
			report.conditionalContext.find(
				(context) => context.read === "docs/cli-reference.md",
			)?.validate,
		).toBe(
			`cd ${repoRef} && node --import tsx src/cli.ts commands --json --for-agent`,
		);
	});
});
