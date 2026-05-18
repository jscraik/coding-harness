import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./commands/policy-gate.js", () => ({
	runPolicyGateCLI: vi.fn(() => 42),
}));

vi.mock("./commands/check-authz.js", () => ({
	runCheckAuthzCLI: vi.fn(async () => 0),
}));

vi.mock("./commands/check-environment.js", () => ({
	runCheckEnvironmentCLI: vi.fn(async () => 0),
}));

vi.mock("./commands/pilot-evaluate.js", () => ({
	runPilotEvaluateCLI: vi.fn(() => 0),
}));

vi.mock("./commands/risk-tier.js", () => ({
	runRiskTierCLI: vi.fn(() => 41),
}));

vi.mock("./commands/memory-gate.js", () => ({
	runMemoryGateCLI: vi.fn(() => 48),
}));

vi.mock("./commands/gardener.js", () => ({
	runGardenerCLI: vi.fn(() => 49),
}));

vi.mock("./commands/brainstorm-gate.js", () => ({
	runBrainstormGateCLI: vi.fn(() => 50),
}));

vi.mock("./commands/plan-gate.js", () => ({
	runPlanGateCLI: vi.fn(() => 51),
}));

vi.mock("./commands/evidence-verify.js", () => ({
	runEvidenceVerifyCLI: vi.fn(() => 52),
}));

vi.mock("./commands/replay.js", () => ({
	runReplayCLI: vi.fn(async () => 47),
}));

vi.mock("./commands/init.js", () => ({
	runInitCLI: vi.fn(() => 61),
	runInteractiveInitCLI: vi.fn(async () => 62),
}));

vi.mock("./commands/learnings.js", () => ({
	runLearningsCLI: vi.fn(() => 71),
}));

vi.mock("./commands/review-context.js", () => ({
	runReviewContextCLI: vi.fn(() => 74),
}));

vi.mock("./commands/north-star-feedback.js", () => ({
	runNorthStarFeedbackCLI: vi.fn(() => 75),
}));

vi.mock("./commands/ci-migrate.js", () => ({
	runCIMigrateCLI: vi.fn(() => 69),
	runPromoteModeCLI: vi.fn(() => 73),
	runSyncBranchProtectionCLI: vi.fn(() => 72),
}));

vi.mock("./commands/remediate.js", () => ({
	runRemediateCLI: vi.fn(async () => 43),
}));

vi.mock("./commands/diff-budget.js", () => ({
	runDiffBudgetCLI: vi.fn(() => 44),
}));

vi.mock("./commands/preflight-gate.js", () => ({
	runPreflightGateCLI: vi.fn(async () => 46),
}));

vi.mock("./commands/silent-error.js", () => ({
	runSilentErrorDetectorCLI: vi.fn(() => 53),
}));

vi.mock("./commands/ui-loop.js", () => ({
	runUIFastCLI: vi.fn(() => 58),
	runUIVerifyCLI: vi.fn(() => 54),
	runUIExploreCLI: vi.fn(() => 55),
}));

vi.mock("./commands/observability-gate.js", () => ({
	runObservabilityGateCLI: vi.fn(() => 56),
}));

vi.mock("./commands/prompt-gate.js", () => ({
	runPromptGateCLI: vi.fn(() => 57),
}));

vi.mock("./commands/review-gate.js", () => ({
	runReviewGateCLI: vi.fn(async () => 45),
}));

vi.mock("./commands/branch-protect.js", () => ({
	runBranchProtectCLI: vi.fn(async () => 64),
}));

vi.mock("./commands/linear-workflow.js", () => ({
	runLinearWorkflowCLI: vi.fn(async () => 65),
}));

vi.mock("./commands/linear-prepare.js", () => ({
	runLinearPrepareCLI: vi.fn(async () => 66),
}));

vi.mock("./commands/linear-triage.js", () => ({
	runLinearTriageCLI: vi.fn(async () => 70),
}));

vi.mock("./commands/linear-gate.js", () => ({
	runLinearGateCLI: vi.fn(async () => 67),
}));

vi.mock("./commands/blast-radius.js", () => ({
	runBlastRadiusCLI: vi.fn(() => 59),
}));

vi.mock("./commands/pattern-scope.js", () => ({
	runPatternScopeCLI: vi.fn(() => 76),
}));

vi.mock("./commands/artifact-routine.js", () => ({
	runArtifactRoutineCLI: vi.fn(() => 77),
}));

vi.mock("./commands/index-context.js", () => ({
	runIndexContextCLI: vi.fn(async () => 60),
}));

vi.mock("./commands/tooling-audit.js", () => ({
	runToolingAuditCLI: vi.fn(async () => ({ exitCode: 68 })),
}));

describe("cli command dispatch", () => {
	const cleanupDirs: string[] = [];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		for (const dir of cleanupDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	it("lists all migrated commands in --help --all-commands output", async () => {
		const { run } = await import("./cli.js");
		const { MIGRATED_COMMAND_NAMES } = await import(
			"./lib/cli/command-registry.js"
		);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		run(["--help", "--all-commands"]);

		const lines = infoSpy.mock.calls.map(([line]) => String(line));
		for (const name of MIGRATED_COMMAND_NAMES) {
			const found = lines.some(
				(line) =>
					line.trimStart().startsWith(`${name} `) ||
					line.trimStart().startsWith(`${name}\t`),
			);
			expect(found).toBe(true);
		}
		expect(lines.join("\n")).toContain("Usage: harness <command> [options]");
		expect(lines.join("\n")).toContain("--help, -h");
	});

	it("keeps focused help grouped and alias-free", async () => {
		const { run } = await import("./cli.js");
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		run(["--help"]);

		const output = infoSpy.mock.calls.map(([line]) => String(line)).join("\n");
		const lines = output.split("\n");
		const hasCommandRow = (name: string) =>
			lines.some((line) => {
				const trimmed = line.trimStart();
				return trimmed.startsWith(`${name} `) || trimmed === name;
			});
		expect(output).toContain("Commands (focused):");
		expect(output).toContain("Agent Cockpit:");
		expect(output).toContain('Run "harness --help --all-commands"');
		expect(hasCommandRow("check")).toBe(false);
		expect(hasCommandRow("next")).toBe(true);
		expect(hasCommandRow("pr-ready")).toBe(false);
		expect(hasCommandRow("fix-review")).toBe(false);
		expect(hasCommandRow("learn")).toBe(false);
		expect(
			lines.some(
				(line) =>
					line.trimStart().startsWith("risk-policy-gate ") ||
					line.trimStart().startsWith("risk-policy-gate\t"),
			),
		).toBe(false);
		expect(
			lines.some(
				(line) =>
					line.trimStart().startsWith("symphony:check ") ||
					line.trimStart().startsWith("symphony:check\t"),
			),
		).toBe(false);
	});

	it("includes aliases in --help --all output", async () => {
		const { run } = await import("./cli.js");
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		run(["--help", "--all"]);

		const output = infoSpy.mock.calls.map(([line]) => String(line)).join("\n");
		expect(output).toContain("Commands (full, with aliases):");
		expect(output).toContain("risk-policy-gate");
		expect(output).toContain("symphony:check");
	});

	it("dispatches risk-tier command and ignores missing contract value", async () => {
		const { run } = await import("./cli.js");
		const { runRiskTierCLI } = await import("./commands/risk-tier.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"risk-tier",
				"--contract",
				"--files",
				"src/a.ts,src/b.ts",
				"--json",
			]),
		).toThrowError("EXIT_41");

		expect(vi.mocked(runRiskTierCLI)).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			files: ["src/a.ts", "src/b.ts"],
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(41);
	});

	it("dispatches risk-tier command and ignores missing --files value", async () => {
		const { run } = await import("./cli.js");
		const { runRiskTierCLI } = await import("./commands/risk-tier.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() => run(["risk-tier", "--files", "--json"])).toThrowError(
			"EXIT_41",
		);

		expect(vi.mocked(runRiskTierCLI)).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			files: [],
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(41);
	});

	it("does not short-circuit to top-level help when -h appears after another risk-tier flag", async () => {
		const { run } = await import("./cli.js");
		const { runRiskTierCLI } = await import("./commands/risk-tier.js");
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() => run(["risk-tier", "--contract", "-h", "--json"])).toThrowError(
			"EXIT_41",
		);

		expect(vi.mocked(runRiskTierCLI)).toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(41);
	});

	it("dispatches memory-gate and ignores missing --memory value", async () => {
		const { run } = await import("./cli.js");
		const { runMemoryGateCLI } = await import("./commands/memory-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["memory-gate", "--memory", "--forjamie", "FORJAMIE.md", "--json"]),
		).toThrowError("EXIT_48");

		expect(vi.mocked(runMemoryGateCLI)).toHaveBeenCalledWith({
			forjamiePath: "FORJAMIE.md",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(48);
	});

	it("dispatches gardener and ignores missing --docs value", async () => {
		const { run } = await import("./cli.js");
		const { runGardenerCLI } = await import("./commands/gardener.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["gardener", "--docs", "--stale-days", "7", "--json"]),
		).toThrowError("EXIT_49");

		expect(vi.mocked(runGardenerCLI)).toHaveBeenCalledWith({
			staleDays: 7,
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(49);
	});

	it("dispatches linear claim workflow command", async () => {
		const { run } = await import("./cli.js");
		const { runLinearWorkflowCLI } = await import(
			"./commands/linear-workflow.js"
		);

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"linear",
			"claim",
			"--issue",
			"JSC-36",
			"--branch",
			"codex/jsc-36-linear-claim",
			"--workspace",
			"/tmp/worktrees/jsc-36",
			"--evidence-url",
			"https://example.com/one,https://example.com/two",
			"--links",
			"https://example.com/runbook",
			"--json",
		]);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runLinearWorkflowCLI)).toHaveBeenCalledWith({
			action: "claim",
			issue: "JSC-36",
			branch: "codex/jsc-36-linear-claim",
			workspace: "/tmp/worktrees/jsc-36",
			evidenceUrls: ["https://example.com/one", "https://example.com/two"],
			links: ["https://example.com/runbook"],
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(65);
	});

	it("dispatches linear prepare command", async () => {
		const { run } = await import("./cli.js");
		const { runLinearPrepareCLI } = await import(
			"./commands/linear-prepare.js"
		);

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"linear",
			"prepare",
			"--issue",
			"JSC-37",
			"--branch-prefix",
			"codex",
			"--field",
			"branch",
			"--json",
		]);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runLinearPrepareCLI)).toHaveBeenCalledWith({
			issue: "JSC-37",
			branchPrefix: "codex",
			field: "branch",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(66);
	});

	it("dispatches linear-gate command", async () => {
		const { run } = await import("./cli.js");
		const { runLinearGateCLI } = await import("./commands/linear-gate.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"linear-gate",
			"--contract",
			"harness.contract.json",
			"--repo-root",
			"/tmp/repo",
			"--branch",
			"codex/jsc-42-enforce-linear-policy",
			"--pr-title",
			"JSC-42: Enforce Linear policy",
			"--pr-body",
			"Refs JSC-42",
			"--allow-missing-pr",
			"--allow-missing-branch",
			"--json",
		]);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runLinearGateCLI)).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			repoRoot: "/tmp/repo",
			branch: "codex/jsc-42-enforce-linear-policy",
			prTitle: "JSC-42: Enforce Linear policy",
			prBody: "Refs JSC-42",
			allowMissingPrMetadata: true,
			allowMissingBranch: true,
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(67);
	});

	it("dispatches linear triage command", async () => {
		const { run } = await import("./cli.js");
		const { runLinearTriageCLI } = await import("./commands/linear-triage.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"linear",
			"triage",
			"--team",
			"JSC",
			"--project",
			"coding-harness",
			"--issue",
			"JSC-123",
			"--limit",
			"8",
			"--metadata-threshold",
			"0.9",
			"--in-progress-cap",
			"3",
			"--max-promote",
			"2",
			"--apply",
			"--confirm",
			"--dry-run",
			"--no-type-label-sync",
			"--json",
		]);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runLinearTriageCLI)).toHaveBeenCalledWith({
			team: "JSC",
			project: "coding-harness",
			issue: "JSC-123",
			limit: 8,
			metadataThreshold: 0.9,
			inProgressCap: 3,
			maxPromote: 2,
			apply: true,
			confirm: true,
			dryRun: true,
			syncTypeLabels: false,
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(70);
	});

	it("dispatches brainstorm-gate and ignores missing --topic value", async () => {
		const { run } = await import("./cli.js");
		const { runBrainstormGateCLI } = await import(
			"./commands/brainstorm-gate.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["brainstorm-gate", "--topic", "--max-age", "14", "--json"]),
		).toThrowError("EXIT_50");

		expect(vi.mocked(runBrainstormGateCLI)).toHaveBeenCalledWith({
			maxAgeDays: 14,
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(50);
	});

	it("dispatches plan-gate and ignores missing --plans value", async () => {
		const { run } = await import("./cli.js");
		const { runPlanGateCLI } = await import("./commands/plan-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["plan-gate", "--plans", "--type", "feature", "--max-age", "30"]),
		).toThrowError("EXIT_51");

		expect(vi.mocked(runPlanGateCLI)).toHaveBeenCalledWith({
			type: "feature",
			maxAge: 30,
		});
		expect(exitSpy).toHaveBeenCalledWith(51);
	});

	it("dispatches evidence-verify and ignores missing flag values", async () => {
		const { run } = await import("./cli.js");
		const { runEvidenceVerifyCLI } = await import(
			"./commands/evidence-verify.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"evidence-verify",
				"--files",
				"--changed",
				"src/a.ts",
				"--contract",
				"--json",
			]),
		).toThrowError("EXIT_52");

		expect(vi.mocked(runEvidenceVerifyCLI)).toHaveBeenCalledWith({
			files: [],
			contract: undefined,
			json: true,
			changed: ["src/a.ts"],
		});
		expect(exitSpy).toHaveBeenCalledWith(52);
	});

	it("dispatches policy-gate command", async () => {
		const { run } = await import("./cli.js");
		const { runPolicyGateCLI } = await import("./commands/policy-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"policy-gate",
				"--contract",
				"custom.contract.json",
				"--files",
				"src/a.ts,src/b.ts",
				"--max-tier",
				"medium",
				"--json",
			]),
		).toThrowError("EXIT_42");

		expect(vi.mocked(runPolicyGateCLI)).toHaveBeenCalledWith({
			contractPath: "custom.contract.json",
			files: ["src/a.ts", "src/b.ts"],
			maxTier: "medium",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(42);
	});

	it("rejects policy-gate when --files value is missing even if --help is present later", async () => {
		const { run } = await import("./cli.js");
		const { runPolicyGateCLI } = await import("./commands/policy-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["policy-gate", "--files", "--help", "--json"]),
		).toThrowError("EXIT_2");

		expect(vi.mocked(runPolicyGateCLI)).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("dispatches replay command and ignores missing trace-id value", async () => {
		const { run } = await import("./cli.js");
		const { runReplayCLI } = await import("./commands/replay.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run(["replay", "--trace-id", "--list", "--json"]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runReplayCLI)).toHaveBeenCalledWith({
			json: true,
			dryRun: false,
			list: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(47);
	});

	it("shows top-level help when -h is passed after replay command", async () => {
		const { run } = await import("./cli.js");
		const { runReplayCLI } = await import("./commands/replay.js");
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		run(["replay", "-h", "--json"]);

		expect(vi.mocked(runReplayCLI)).not.toHaveBeenCalled();
		expect(infoSpy).toHaveBeenCalledWith(
			expect.stringContaining("Usage: harness <command> [options]"),
		);
	});

	it("dispatches init command and does not treat short flags as targetDir", async () => {
		const { run } = await import("./cli.js");
		const { runInitCLI } = await import("./commands/init.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() => run(["init", "--force", "-f"])).toThrowError("EXIT_61");

		expect(vi.mocked(runInitCLI)).toHaveBeenCalledWith(undefined, {
			dryRun: false,
			force: true,
			track: false,
			rollback: false,
			checkUpdates: false,
			update: false,
			explainOwnership: false,
			interactive: false,
			migrate: false,
			json: false,
		});
		expect(exitSpy).toHaveBeenCalledWith(61);
	});

	it("dispatches learnings import through the command registry", async () => {
		const { run } = await import("./cli.js");
		const { runLearningsCLI } = await import("./commands/learnings.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"learnings",
				"import",
				"--provider",
				"coderabbit-csv",
				"--source",
				"learnings.csv",
				"--repo",
				"coding-harness",
				"--json",
			]),
		).toThrowError("EXIT_71");

		expect(vi.mocked(runLearningsCLI)).toHaveBeenCalledWith([
			"import",
			"--provider",
			"coderabbit-csv",
			"--source",
			"learnings.csv",
			"--repo",
			"coding-harness",
			"--json",
		]);
		expect(exitSpy).toHaveBeenCalledWith(71);
	});

	it("dispatches learnings gate through the command registry", async () => {
		const { run } = await import("./cli.js");
		const { runLearningsCLI } = await import("./commands/learnings.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"learnings",
				"gate",
				"--source",
				".harness/learnings/coderabbit.local.json",
				"--files",
				"src/cli.ts",
				"--json",
			]),
		).toThrowError("EXIT_71");

		expect(vi.mocked(runLearningsCLI)).toHaveBeenCalledWith([
			"gate",
			"--source",
			".harness/learnings/coderabbit.local.json",
			"--files",
			"src/cli.ts",
			"--json",
		]);
		expect(exitSpy).toHaveBeenCalledWith(71);
	});

	it("dispatches review-context through the command registry", async () => {
		const { run } = await import("./cli.js");
		const { runReviewContextCLI } = await import(
			"./commands/review-context.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"review-context",
				"--source",
				".harness/learnings/coderabbit.local.json",
				"--files",
				"src/cli.ts",
				"--json",
			]),
		).toThrowError("EXIT_74");

		expect(vi.mocked(runReviewContextCLI)).toHaveBeenCalledWith([
			"--source",
			".harness/learnings/coderabbit.local.json",
			"--files",
			"src/cli.ts",
			"--json",
		]);
		expect(exitSpy).toHaveBeenCalledWith(74);
	});

	it("dispatches north-star-feedback through the command registry", async () => {
		const { run } = await import("./cli.js");
		const { runNorthStarFeedbackCLI } = await import(
			"./commands/north-star-feedback.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"north-star-feedback",
				"--source",
				".harness/learnings/coderabbit.local.json",
				"--json",
			]),
		).toThrowError("EXIT_75");

		expect(vi.mocked(runNorthStarFeedbackCLI)).toHaveBeenCalledWith([
			"--source",
			".harness/learnings/coderabbit.local.json",
			"--json",
		]);
		expect(exitSpy).toHaveBeenCalledWith(75);
	});

	it("dispatches pattern-scope through the command registry", async () => {
		const { run } = await import("./cli.js");
		const { runPatternScopeCLI } = await import("./commands/pattern-scope.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"pattern-scope",
				"--files",
				"src/cli.ts",
				"--feedback",
				"same things in multiple places",
				"--json",
			]),
		).toThrowError("EXIT_76");

		expect(vi.mocked(runPatternScopeCLI)).toHaveBeenCalledWith([
			"--files",
			"src/cli.ts",
			"--feedback",
			"same things in multiple places",
			"--json",
		]);
		expect(exitSpy).toHaveBeenCalledWith(76);
	});

	it("dispatches artifact-routine through the command registry", async () => {
		const { run } = await import("./cli.js");
		const { runArtifactRoutineCLI } = await import(
			"./commands/artifact-routine.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"artifact-routine",
				"--active-index",
				".harness/active-artifacts.md",
				"--json",
			]),
		).toThrowError("EXIT_77");

		expect(vi.mocked(runArtifactRoutineCLI)).toHaveBeenCalledWith([
			"--active-index",
			".harness/active-artifacts.md",
			"--json",
		]);
		expect(exitSpy).toHaveBeenCalledWith(77);
	});

	it("dispatches ci-migrate with positional action and target directory", async () => {
		const { run } = await import("./cli.js");
		const { runCIMigrateCLI } = await import("./commands/ci-migrate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"ci-migrate",
				"prepare",
				"/tmp/cutover-repo",
				"--provider",
				"circleci",
				"--snapshot",
				"cutover-window-1",
				"--apply",
				"--break-glass-approval",
				".harness/ci-migrate-approvals/cutover-window-1.json",
				"--merge-queue-evidence",
				".harness/control-plane/merge-queue-cutover-evidence.json",
				"--merge-queue-orchestrator",
				".harness/control-plane/merge-queue-cutover-orchestrator",
				"--auto-generate-proof-pack",
			]),
		).toThrowError("EXIT_69");

		expect(vi.mocked(runCIMigrateCLI)).toHaveBeenCalledWith(
			"/tmp/cutover-repo",
			{
				provider: "circleci",
				dryRun: false,
				apply: true,
				rollback: false,
				snapshot: "cutover-window-1",
				action: "prepare",
				breakGlassApprovalPath:
					".harness/ci-migrate-approvals/cutover-window-1.json",
				mergeQueueEvidencePath:
					".harness/control-plane/merge-queue-cutover-evidence.json",
				mergeQueueOrchestratorPath:
					".harness/control-plane/merge-queue-cutover-orchestrator",
				autoGenerateProofPack: true,
				commitMode: undefined,
				force: false,
			},
		);
		expect(exitSpy).toHaveBeenCalledWith(69);
	});

	it("dispatches ci-migrate with explicit --action and optional dry-run", async () => {
		const { run } = await import("./cli.js");
		const { runCIMigrateCLI } = await import("./commands/ci-migrate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"ci-migrate",
				"/tmp/cutover-repo",
				"--provider",
				"circleci",
				"--action",
				"commit",
				"--snapshot",
				"cutover-window-2",
				"--dry-run",
			]),
		).toThrowError("EXIT_69");

		expect(vi.mocked(runCIMigrateCLI)).toHaveBeenCalledWith(
			"/tmp/cutover-repo",
			{
				provider: "circleci",
				dryRun: true,
				apply: false,
				rollback: false,
				snapshot: "cutover-window-2",
				action: "commit",
				breakGlassApprovalPath: undefined,
				mergeQueueEvidencePath: undefined,
				mergeQueueOrchestratorPath: undefined,
				autoGenerateProofPack: false,
				commitMode: undefined,
				force: false,
			},
		);
		expect(exitSpy).toHaveBeenCalledWith(69);
	});

	for (const scenario of [
		{
			label: "sync-branch-protection positional action",
			argv: [
				"ci-migrate",
				"sync-branch-protection",
				"/tmp/cutover-repo",
				"--provider",
				"circleci",
				"--json",
			],
			expectedExit: 72,
			expectedRunner: "sync-branch-protection",
		},
		{
			label: "sync-branch-protection explicit --action",
			argv: [
				"ci-migrate",
				"/tmp/cutover-repo",
				"--action",
				"sync-branch-protection",
				"--provider",
				"circleci",
				"--json",
			],
			expectedExit: 72,
			expectedRunner: "sync-branch-protection",
		},
		{
			label: "promote-mode positional action",
			argv: [
				"ci-migrate",
				"promote-mode",
				"/tmp/cutover-repo",
				"--provider",
				"circleci",
				"--json",
			],
			expectedExit: 73,
			expectedRunner: "promote-mode",
		},
		{
			label: "promote-mode explicit --action",
			argv: [
				"ci-migrate",
				"/tmp/cutover-repo",
				"--action",
				"promote-mode",
				"--provider",
				"circleci",
				"--json",
			],
			expectedExit: 73,
			expectedRunner: "promote-mode",
		},
	] as const) {
		it(`dispatches ci-migrate delegated ${scenario.label}`, async () => {
			const { run } = await import("./cli.js");
			const { runCIMigrateCLI, runPromoteModeCLI, runSyncBranchProtectionCLI } =
				await import("./commands/ci-migrate.js");

			const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
				code?: number,
			) => {
				throw new Error(`EXIT_${String(code)}`);
			}) as never);

			expect(() => run([...scenario.argv])).toThrowError(
				`EXIT_${String(scenario.expectedExit)}`,
			);

			expect(vi.mocked(runCIMigrateCLI)).not.toHaveBeenCalled();
			if (scenario.expectedRunner === "sync-branch-protection") {
				expect(vi.mocked(runSyncBranchProtectionCLI)).toHaveBeenCalledWith(
					"/tmp/cutover-repo",
					["/tmp/cutover-repo", "--provider", "circleci", "--json"],
				);
				expect(vi.mocked(runPromoteModeCLI)).not.toHaveBeenCalled();
			} else {
				expect(vi.mocked(runPromoteModeCLI)).toHaveBeenCalledWith(
					"/tmp/cutover-repo",
					["/tmp/cutover-repo", "--provider", "circleci", "--json"],
				);
				expect(vi.mocked(runSyncBranchProtectionCLI)).not.toHaveBeenCalled();
			}
			expect(exitSpy).toHaveBeenCalledWith(scenario.expectedExit);
		});
	}

	it("passes unsupported explicit ci-migrate --action to runtime validation", async () => {
		const { run } = await import("./cli.js");
		const { runCIMigrateCLI, runPromoteModeCLI, runSyncBranchProtectionCLI } =
			await import("./commands/ci-migrate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"ci-migrate",
				"/tmp/cutover-repo",
				"--action",
				"launch",
				"--dry-run",
			]),
		).toThrowError("EXIT_69");

		expect(vi.mocked(runCIMigrateCLI)).toHaveBeenCalledWith(
			"/tmp/cutover-repo",
			expect.objectContaining({
				action: "launch",
				dryRun: true,
			}),
		);
		expect(vi.mocked(runPromoteModeCLI)).not.toHaveBeenCalled();
		expect(vi.mocked(runSyncBranchProtectionCLI)).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(69);
	});

	it("does not treat --action value as target dir when a value flag is missing", async () => {
		const { run } = await import("./cli.js");
		const { runCIMigrateCLI } = await import("./commands/ci-migrate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["ci-migrate", "--provider", "--action", "commit", "--dry-run"]),
		).toThrowError("EXIT_69");

		expect(vi.mocked(runCIMigrateCLI)).toHaveBeenCalledWith(undefined, {
			provider: undefined,
			dryRun: true,
			apply: false,
			rollback: false,
			snapshot: undefined,
			action: "commit",
			breakGlassApprovalPath: undefined,
			mergeQueueEvidencePath: undefined,
			mergeQueueOrchestratorPath: undefined,
			autoGenerateProofPack: false,
			commitMode: undefined,
			force: false,
		});
		expect(exitSpy).toHaveBeenCalledWith(69);
	});

	it("treats empty ci-migrate --action as absent while preserving target dir", async () => {
		const { run } = await import("./cli.js");
		const { runCIMigrateCLI } = await import("./commands/ci-migrate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["ci-migrate", "/tmp/cutover-repo", "--action", "--dry-run"]),
		).toThrowError("EXIT_69");

		expect(vi.mocked(runCIMigrateCLI)).toHaveBeenCalledWith(
			"/tmp/cutover-repo",
			expect.objectContaining({
				action: undefined,
				dryRun: true,
			}),
		);
		expect(exitSpy).toHaveBeenCalledWith(69);
	});

	it("fails ci-migrate dispatch when multiple target directories are provided", async () => {
		const { run } = await import("./cli.js");
		const { runCIMigrateCLI } = await import("./commands/ci-migrate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// silence expected error output
		});

		expect(() =>
			run(["ci-migrate", "prepare", "/tmp/repo-a", "/tmp/repo-b", "--apply"]),
		).toThrowError("EXIT_2");

		expect(vi.mocked(runCIMigrateCLI)).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalledWith(
			"Error: ci-migrate accepts at most one target directory positional argument.",
		);
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("rejects policy-gate command when --contract is missing a value", async () => {
		const { run } = await import("./cli.js");
		const { runPolicyGateCLI } = await import("./commands/policy-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// silence expected error output
		});

		expect(() =>
			run([
				"policy-gate",
				"--contract",
				"--files",
				"src/a.ts",
				"--max-tier",
				"low",
				"--json",
			]),
		).toThrowError("EXIT_2");

		expect(vi.mocked(runPolicyGateCLI)).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalledWith(
			"policy-gate requires a value for --contract.",
		);
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("dispatches policy-gate command and preserves explicit empty contract value", async () => {
		const { run } = await import("./cli.js");
		const { runPolicyGateCLI } = await import("./commands/policy-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"policy-gate",
				"--contract",
				"",
				"--files",
				"src/a.ts",
				"--max-tier",
				"low",
				"--json",
			]),
		).toThrowError("EXIT_42");

		expect(vi.mocked(runPolicyGateCLI)).toHaveBeenCalledWith({
			contractPath: "",
			files: ["src/a.ts"],
			maxTier: "low",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(42);
	});

	it("dispatches remediate command", async () => {
		const { run } = await import("./cli.js");
		const { runRemediateCLI } = await import("./commands/remediate.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"remediate",
			"run",
			"--findings",
			"findings.json",
			"--dry-run",
			"--json",
			"--sha",
			"a".repeat(40),
		]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runRemediateCLI)).toHaveBeenCalledWith(
			expect.objectContaining({
				subcommand: "run",
				findings: "findings.json",
				dryRun: true,
				json: true,
				headSha: "a".repeat(40),
			}),
		);
		expect(exitSpy).toHaveBeenCalledWith(43);
	});

	it("dispatches remediate command and ignores missing flag values", async () => {
		const { run } = await import("./cli.js");
		const { runRemediateCLI } = await import("./commands/remediate.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"remediate",
			"run",
			"--findings",
			"--dry-run",
			"--json",
			"--sha",
			"a".repeat(40),
		]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runRemediateCLI)).toHaveBeenCalledWith(
			expect.objectContaining({
				subcommand: "run",
				dryRun: true,
				json: true,
				headSha: "a".repeat(40),
			}),
		);
		expect(exitSpy).toHaveBeenCalledWith(43);
	});

	it("dispatches preflight-gate and ignores missing contract value", async () => {
		const { run } = await import("./cli.js");
		const { runPreflightGateCLI } = await import(
			"./commands/preflight-gate.js"
		);

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"preflight-gate",
			"--contract",
			"--files",
			"src/a.ts,src/b.ts",
			"--max-tier",
			"medium",
			"--json",
		]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runPreflightGateCLI)).toHaveBeenCalledWith({
			files: ["src/a.ts", "src/b.ts"],
			maxTier: "medium",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(46);
	});

	it("dispatches preflight-gate and ignores missing --files and --skip values", async () => {
		const { run } = await import("./cli.js");
		const { runPreflightGateCLI } = await import(
			"./commands/preflight-gate.js"
		);

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"preflight-gate",
			"--files",
			"--skip",
			"--max-tier",
			"medium",
			"--json",
		]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runPreflightGateCLI)).toHaveBeenCalledWith({
			maxTier: "medium",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(46);
	});

	it("dispatches preflight-gate with --head-sha flag", async () => {
		const { run } = await import("./cli.js");
		const { runPreflightGateCLI } = await import(
			"./commands/preflight-gate.js"
		);

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"preflight-gate",
			"--files",
			"src/a.ts",
			"--head-sha",
			"abc123",
			"--json",
		]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runPreflightGateCLI)).toHaveBeenCalledWith({
			files: ["src/a.ts"],
			headSha: "abc123",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(46);
	});

	it("dispatches preflight-gate with admission declaration loaded from --admission-file", async () => {
		const { run } = await import("./cli.js");
		const { runPreflightGateCLI } = await import(
			"./commands/preflight-gate.js"
		);
		const tempDir = mkdtempSync(join(tmpdir(), "cli-dispatch-preflight-"));
		cleanupDirs.push(tempDir);
		const admissionFile = join(tempDir, "admission.json");
		writeFileSync(
			admissionFile,
			JSON.stringify({
				north_star_metric: "pr_lead_time",
				primary_bottleneck: "review_rework_loop",
				affected_surface_ids: ["preflight-gate"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: -1,
				metric_impact_declared: "path_strengthening",
				evidence_links: ["docs/roadmap/north-star.md"],
				why_this_improves_throughput_or_reliability:
					"Tightens preflight contract alignment.",
			}),
			"utf-8",
		);

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run(["preflight-gate", "--admission-file", admissionFile, "--json"]);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runPreflightGateCLI)).toHaveBeenCalledWith({
			admission: {
				north_star_metric: "pr_lead_time",
				primary_bottleneck: "review_rework_loop",
				affected_surface_ids: ["preflight-gate"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: -1,
				metric_impact_declared: "path_strengthening",
				evidence_links: ["docs/roadmap/north-star.md"],
				why_this_improves_throughput_or_reliability:
					"Tightens preflight contract alignment.",
			},
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(46);
	});

	it("dispatches blast-radius command without explicit contract path", async () => {
		const { run } = await import("./cli.js");
		const { runBlastRadiusCLI } = await import("./commands/blast-radius.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run(["blast-radius", "--files", "src/a.ts,src/b.ts", "--json"]);

		expect(vi.mocked(runBlastRadiusCLI)).toHaveBeenCalledWith({
			files: ["src/a.ts", "src/b.ts"],
			json: true,
			verbose: false,
		});
		expect(exitSpy).toHaveBeenCalledWith(59);
	});

	it("dispatches blast-radius command with explicit contract path", async () => {
		const { run } = await import("./cli.js");
		const { runBlastRadiusCLI } = await import("./commands/blast-radius.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"blast-radius",
			"--contract",
			"custom.contract.json",
			"--files",
			"src/a.ts",
			"--verbose",
		]);

		expect(vi.mocked(runBlastRadiusCLI)).toHaveBeenCalledWith({
			files: ["src/a.ts"],
			json: false,
			verbose: true,
			contractPath: "custom.contract.json",
		});
		expect(exitSpy).toHaveBeenCalledWith(59);
	});

	it("rejects remediate command when subcommand is missing", async () => {
		const { run } = await import("./cli.js");
		const { runRemediateCLI } = await import("./commands/remediate.js");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"remediate",
			"--findings",
			"findings.json",
			"--dry-run",
			"--json",
			"--contract",
			"harness.contract.json",
			"--sha",
			"a".repeat(40),
		]);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runRemediateCLI)).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalledWith(
			"Error: remediate command requires subcommand `run` or `apply`",
		);
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("rejects remediate command with missing subcommand even when flags are malformed", async () => {
		const { run } = await import("./cli.js");
		const { runRemediateCLI } = await import("./commands/remediate.js");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"remediate",
			"--findings",
			"--dry-run",
			"--json",
			"--contract",
			"--sha",
			"a".repeat(40),
		]);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runRemediateCLI)).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalledWith(
			"Error: remediate command requires subcommand `run` or `apply`",
		);
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("dispatches diff-budget command and ignores missing flag values", async () => {
		const { run } = await import("./cli.js");
		const { runDiffBudgetCLI } = await import("./commands/diff-budget.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"diff-budget",
				"--base",
				"--json",
				"--head",
				"feature-branch",
				"--contract",
				"--override",
				"diff-override.json",
			]),
		).toThrowError("EXIT_44");

		expect(vi.mocked(runDiffBudgetCLI)).toHaveBeenCalledWith({
			head: "feature-branch",
			overridePath: "diff-override.json",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(44);
	});

	it("fails review-gate dispatch when required flag values are missing", async () => {
		const { run } = await import("./cli.js");
		const { runReviewGateCLI } = await import("./commands/review-gate.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"review-gate",
			"--token",
			"--owner",
			"octo",
			"--repo",
			"harness",
			"--pr",
			"123",
			"--sha",
			"--json",
			"--check",
			"lint",
			"--contract",
			"--foo",
		]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runReviewGateCLI)).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("rejects malformed review-gate invocations even when --help appears after a missing flag value", async () => {
		const { run } = await import("./cli.js");
		const { runReviewGateCLI } = await import("./commands/review-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"review-gate",
				"--token",
				"--owner",
				"octo",
				"--repo",
				"harness",
				"--pr",
				"123",
				"--sha",
				"--help",
			]),
		).toThrowError("EXIT_2");

		expect(vi.mocked(runReviewGateCLI)).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("dispatches review-gate with GH_TOKEN fallback when --token is omitted", async () => {
		const { run } = await import("./cli.js");
		const { runReviewGateCLI } = await import("./commands/review-gate.js");

		const previousGhToken = process.env.GH_TOKEN;
		process.env.GH_TOKEN = "ghs_from_env";
		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);
		try {
			run([
				"review-gate",
				"--owner",
				"octo",
				"--repo",
				"harness",
				"--pr",
				"123",
				"--sha",
				"a".repeat(40),
				"--json",
			]);

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(vi.mocked(runReviewGateCLI)).toHaveBeenCalledWith({
				token: "ghs_from_env",
				owner: "octo",
				repo: "harness",
				prNumber: 123,
				headSha: "a".repeat(40),
				checkName: "",
				contractPath: "harness.contract.json",
				json: true,
			});
			expect(exitSpy).toHaveBeenCalledWith(45);
		} finally {
			process.env.GH_TOKEN = previousGhToken;
		}
	});

	it("dispatches review-gate command and preserves --auto-resolve-bot-threads flag", async () => {
		const { run } = await import("./cli.js");
		const { runReviewGateCLI } = await import("./commands/review-gate.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"review-gate",
			"--token",
			"ghs_123",
			"--owner",
			"octo",
			"--repo",
			"harness",
			"--pr",
			"123",
			"--sha",
			"a".repeat(40),
			"--auto-resolve-bot-threads",
			"--json",
		]);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runReviewGateCLI)).toHaveBeenCalledWith({
			token: "ghs_123",
			owner: "octo",
			repo: "harness",
			prNumber: 123,
			headSha: "a".repeat(40),
			checkName: "",
			contractPath: "harness.contract.json",
			autoResolveBotThreads: true,
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(45);
	});

	it("dispatches branch-protect command and ignores missing flag values", async () => {
		const { run } = await import("./cli.js");
		const { runBranchProtectCLI } = await import(
			"./commands/branch-protect.js"
		);

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"branch-protect",
			"--token",
			"--owner",
			"octo",
			"--repo",
			"harness",
			"--checks",
			"CodeRabbit,Socket Security: Pull Request Alerts",
			"--required-approvals",
			"2",
			"--dry-run",
			"--json",
			"--ruleset",
			"protect",
			"--branch",
			"main",
		]);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runBranchProtectCLI)).toHaveBeenCalledWith({
			owner: "octo",
			repo: "harness",
			requiredChecks: ["CodeRabbit", "Socket Security: Pull Request Alerts"],
			requiredApprovingReviewCount: 2,
			dryRun: true,
			json: true,
			rulesetName: "protect",
			branch: "main",
		});
		expect(exitSpy).toHaveBeenCalledWith(64);
	});

	it("rejects branch-protect --required-approvals when value is negative", async () => {
		const { run } = await import("./cli.js");
		const { runBranchProtectCLI } = await import(
			"./commands/branch-protect.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		expect(() =>
			run([
				"branch-protect",
				"--owner",
				"octo",
				"--repo",
				"harness",
				"--required-approvals",
				"-1",
			]),
		).toThrowError("EXIT_2");

		expect(errorSpy).toHaveBeenCalledWith(
			"--required-approvals expects a non-negative integer.",
		);
		expect(vi.mocked(runBranchProtectCLI)).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("rejects branch-protect --required-approvals when value is non-numeric", async () => {
		const { run } = await import("./cli.js");
		const { runBranchProtectCLI } = await import(
			"./commands/branch-protect.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		expect(() =>
			run([
				"branch-protect",
				"--owner",
				"octo",
				"--repo",
				"harness",
				"--required-approvals",
				"two",
			]),
		).toThrowError("EXIT_2");

		expect(errorSpy).toHaveBeenCalledWith(
			"--required-approvals expects a non-negative integer.",
		);
		expect(vi.mocked(runBranchProtectCLI)).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("dispatches tooling-audit command", async () => {
		const { run } = await import("./cli.js");
		const { runToolingAuditCLI } = await import("./commands/tooling-audit.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run(["tooling-audit", "--path", "/tmp/repos", "--json"]);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runToolingAuditCLI)).toHaveBeenCalledWith([
			"--path",
			"/tmp/repos",
			"--json",
		]);
		expect(exitSpy).toHaveBeenCalledWith(68);
	});

	it("rejects policy-gate command when --files is missing a value", async () => {
		const { run } = await import("./cli.js");
		const { runPolicyGateCLI } = await import("./commands/policy-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// silence expected error output
		});

		expect(() =>
			run(["policy-gate", "--files", "--max-tier", "low", "--json"]),
		).toThrowError("EXIT_2");

		expect(vi.mocked(runPolicyGateCLI)).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalledWith(
			"policy-gate requires a value for --files.",
		);
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("dispatches risk-policy-gate alias to policy-gate command", async () => {
		const { run } = await import("./cli.js");
		const { runPolicyGateCLI } = await import("./commands/policy-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"risk-policy-gate",
				"--contract",
				"custom.contract.json",
				"--files",
				"src/a.ts",
				"--max-tier",
				"medium",
				"--json",
			]),
		).toThrowError("EXIT_42");

		expect(vi.mocked(runPolicyGateCLI)).toHaveBeenCalledWith({
			contractPath: "custom.contract.json",
			files: ["src/a.ts"],
			maxTier: "medium",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(42);
	});

	it("dispatches check-authz command", async () => {
		const { run } = await import("./cli.js");
		const { runCheckAuthzCLI } = await import("./commands/check-authz.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"check-authz",
			"--contract",
			"harness.contract.json",
			"--repo",
			"owner/repo",
			"--branch",
			"main",
			"--check-scopes",
			"--json",
		]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runCheckAuthzCLI)).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			repo: "owner/repo",
			branch: "main",
			checkScopes: true,
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("dispatches check-authz command and ignores missing flag values", async () => {
		const { run } = await import("./cli.js");
		const { runCheckAuthzCLI } = await import("./commands/check-authz.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run(["check-authz", "--contract", "--repo", "--branch", "--json"]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Missing flag values are not included in the options object
		expect(vi.mocked(runCheckAuthzCLI)).toHaveBeenCalledWith({
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("dispatches check-environment command", async () => {
		const { run } = await import("./cli.js");
		const { runCheckEnvironmentCLI } = await import(
			"./commands/check-environment.js"
		);

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"check-environment",
			"--contract",
			"harness.contract.json",
			"--check-secrets",
			"--allowed-sandbox",
			"full-access,sandboxed",
			"--attestation",
			"attestation.json",
			"--json",
		]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runCheckEnvironmentCLI)).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			checkSecrets: true,
			allowedSandboxModes: ["full-access", "sandboxed"],
			attestationPath: "attestation.json",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("dispatches check-environment command and ignores missing flag values", async () => {
		const { run } = await import("./cli.js");
		const { runCheckEnvironmentCLI } = await import(
			"./commands/check-environment.js"
		);

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run([
			"check-environment",
			"--contract",
			"--allowed-sandbox",
			"--attestation",
			"--json",
		]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Missing flag values are not included in the options object
		expect(vi.mocked(runCheckEnvironmentCLI)).toHaveBeenCalledWith({
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("dispatches pilot-evaluate command", async () => {
		const { run } = await import("./cli.js");
		const { runPilotEvaluateCLI } = await import(
			"./commands/pilot-evaluate.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"pilot-evaluate",
				"--artifacts",
				"artifacts/pilot",
				"--contract",
				"harness.contract.json",
				"--output",
				"result.json",
				"--docs-gate-report",
				"artifacts/pilot/docs-gate.json",
				"--evaluation-mode",
				"pr",
				"--rollout-stage",
				"advisory",
				"--pr-template-status",
				"passed",
				"--pr-template-ref",
				"artifacts/pilot/pr-template.json",
				"--actor-id",
				"jamie",
				"--client-family",
				"codex",
				"--provider-id",
				"openai",
				"--model-descriptor",
				"gpt-5.4",
				"--execution-mode",
				"automation",
				"--operator-type",
				"automation",
				"--override-authorized-principal",
				"jamie",
				"--override-scope",
				"temporary_promote",
				"--override-reason",
				"Manual release approval",
				"--override-ticket",
				"JSC-123",
				"--override-approved-by",
				"jamie,alex",
				"--override-created-at",
				"2026-03-10T10:00:00Z",
				"--override-expires-at",
				"2026-03-10T18:00:00Z",
				"--json",
			]),
		).toThrowError("EXIT_0");

		expect(vi.mocked(runPilotEvaluateCLI)).toHaveBeenCalledWith({
			artifactsDir: "artifacts/pilot",
			contractPath: "harness.contract.json",
			outputPath: "result.json",
			docsGateReportPath: "artifacts/pilot/docs-gate.json",
			evaluationMode: "pr",
			rolloutStage: "advisory",
			prTemplateStatus: "passed",
			prTemplateRef: "artifacts/pilot/pr-template.json",
			actorId: "jamie",
			clientFamily: "codex",
			providerId: "openai",
			modelDescriptor: "gpt-5.4",
			executionMode: "automation",
			operatorType: "automation",
			overrideAuthorizedPrincipal: "jamie",
			overrideScope: "temporary_promote",
			overrideReason: "Manual release approval",
			overrideTicketRef: "JSC-123",
			overrideApprovedBy: ["jamie", "alex"],
			overrideCreatedAt: "2026-03-10T10:00:00Z",
			overrideExpiresAt: "2026-03-10T18:00:00Z",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("dispatches pilot-evaluate command and ignores missing optional flag values", async () => {
		const { run } = await import("./cli.js");
		const { runPilotEvaluateCLI } = await import(
			"./commands/pilot-evaluate.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["pilot-evaluate", "--artifacts", "artifacts/pilot", "--json"]),
		).toThrowError("EXIT_0");

		// Missing flag values are not included in the options object
		expect(vi.mocked(runPilotEvaluateCLI)).toHaveBeenCalledWith({
			artifactsDir: "artifacts/pilot",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("dispatches silent-error command and ignores missing --files value", async () => {
		const { run } = await import("./cli.js");
		const { runSilentErrorDetectorCLI } = await import(
			"./commands/silent-error.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["silent-error", "--files", "--dirs", "src/lib", "--json"]),
		).toThrowError("EXIT_53");

		expect(vi.mocked(runSilentErrorDetectorCLI)).toHaveBeenCalledWith({
			dirs: ["src/lib"],
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(53);
	});

	it("dispatches ui:verify and ignores missing --output and --shard values", async () => {
		const { run } = await import("./cli.js");
		const { runUIVerifyCLI } = await import("./commands/ui-loop.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["ui:verify", "--output", "--timeout", "30", "--shard", "--json"]),
		).toThrowError("EXIT_54");

		expect(vi.mocked(runUIVerifyCLI)).toHaveBeenCalledWith({
			timeout: 30,
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(54);
	});

	it("maps ui:verify --dry-run to mode=prepare", async () => {
		const { run } = await import("./cli.js");
		const { runUIVerifyCLI } = await import("./commands/ui-loop.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["ui:verify", "--mode", "execute", "--dry-run", "--json"]),
		).toThrowError("EXIT_54");

		expect(vi.mocked(runUIVerifyCLI)).toHaveBeenCalledWith({
			mode: "prepare",
			dryRun: true,
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(54);
	});

	it("maps ui:fast --dry-run to mode=prepare", async () => {
		const { run } = await import("./cli.js");
		const { runUIFastCLI } = await import("./commands/ui-loop.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["ui:fast", "--ci", "--mode", "execute", "--dry-run", "--json"]),
		).toThrowError("EXIT_58");

		expect(vi.mocked(runUIFastCLI)).toHaveBeenCalledWith({
			ci: true,
			mode: "prepare",
			dryRun: true,
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(58);
	});

	it("dispatches ui:explore and ignores missing --url value", async () => {
		const { run } = await import("./cli.js");
		const { runUIExploreCLI } = await import("./commands/ui-loop.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["ui:explore", "--url", "--output", "artifacts/ui", "--json"]),
		).toThrowError("EXIT_55");

		expect(vi.mocked(runUIExploreCLI)).toHaveBeenCalledWith({
			outputDir: "artifacts/ui",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(55);
	});

	it("maps ui:explore --dry-run to mode=prepare", async () => {
		const { run } = await import("./cli.js");
		const { runUIExploreCLI } = await import("./commands/ui-loop.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"ui:explore",
				"--mode",
				"execute",
				"--dry-run",
				"--output",
				"artifacts/ui",
				"--json",
			]),
		).toThrowError("EXIT_55");

		expect(vi.mocked(runUIExploreCLI)).toHaveBeenCalledWith({
			mode: "prepare",
			dryRun: true,
			outputDir: "artifacts/ui",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(55);
	});

	it("dispatches observability-gate and ignores missing --labels value", async () => {
		const { run } = await import("./cli.js");
		const { runObservabilityGateCLI } = await import(
			"./commands/observability-gate.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"observability-gate",
				"--labels",
				"--max-cardinality",
				"10",
				"--max-length",
				"20",
				"--json",
			]),
		).toThrowError("EXIT_56");

		expect(vi.mocked(runObservabilityGateCLI)).toHaveBeenCalledWith({
			maxCardinality: 10,
			maxLength: 20,
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(56);
	});

	it("dispatches observability-gate and ignores malformed numeric values", async () => {
		const { run } = await import("./cli.js");
		const { runObservabilityGateCLI } = await import(
			"./commands/observability-gate.js"
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run([
				"observability-gate",
				"--max-cardinality",
				"10abc",
				"--max-length",
				"20ms",
				"--json",
			]),
		).toThrowError("EXIT_56");

		expect(vi.mocked(runObservabilityGateCLI)).toHaveBeenCalledWith({
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(56);
	});

	it("rejects prompt-gate when --file value is missing", async () => {
		const { run } = await import("./cli.js");
		const { runPromptGateCLI } = await import("./commands/prompt-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["prompt-gate", "--type", "feature", "--file", "--json"]),
		).toThrowError("EXIT_2");

		expect(vi.mocked(runPromptGateCLI)).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("rejects blast-radius when --files value is missing", async () => {
		const { run } = await import("./cli.js");
		const { runBlastRadiusCLI } = await import("./commands/blast-radius.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() => run(["blast-radius", "--files", "--json"])).toThrowError(
			"EXIT_2",
		);

		expect(vi.mocked(runBlastRadiusCLI)).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(2);
	});

	it("shows top-level help when -h is passed after index-context command", async () => {
		const { run } = await import("./cli.js");
		const { runIndexContextCLI } = await import("./commands/index-context.js");
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		run(["index-context", "-h"]);

		expect(vi.mocked(runIndexContextCLI)).not.toHaveBeenCalled();
		expect(infoSpy).toHaveBeenCalledWith(
			expect.stringContaining("Usage: harness <command> [options]"),
		);
	});
});
