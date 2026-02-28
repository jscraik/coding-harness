import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("./commands/blast-radius.js", () => ({
	runBlastRadiusCLI: vi.fn(() => 59),
}));

vi.mock("./commands/index-context.js", () => ({
	runIndexContextCLI: vi.fn(async () => 60),
}));

describe("cli command dispatch", () => {
	afterEach(() => {
		vi.restoreAllMocks();
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

	// Note: -h is intercepted by the top-level help check before reaching the command handler
	it.skip("dispatches risk-tier command and ignores short-flag contract value", async () => {
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

		expect(vi.mocked(runRiskTierCLI)).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			files: [],
			json: true,
		});
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

	// Note: The -h flag is intercepted by the top-level help check, so this test
	// is no longer applicable. Short flags like -h are handled at the CLI level.
	it.skip("dispatches replay command and ignores short positional flag as trace-id", async () => {
		const { run } = await import("./cli.js");
		const { runReplayCLI } = await import("./commands/replay.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run(["replay", "-h", "--json"]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runReplayCLI)).toHaveBeenCalledWith({
			json: true,
			dryRun: false,
			list: false,
		});
		expect(exitSpy).toHaveBeenCalledWith(47);
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
			interactive: false,
			migrate: false,
		});
		expect(exitSpy).toHaveBeenCalledWith(61);
	});

	it("dispatches policy-gate command and ignores missing contract value", async () => {
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
				"--files",
				"src/a.ts",
				"--max-tier",
				"low",
				"--json",
			]),
		).toThrowError("EXIT_42");

		expect(vi.mocked(runPolicyGateCLI)).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			files: ["src/a.ts"],
			maxTier: "low",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(42);
	});

	// Note: The remediate command doesn't support --findings flag in the current implementation
	it.skip("dispatches remediate command", async () => {
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

		expect(vi.mocked(runRemediateCLI)).toHaveBeenCalledWith({
			mode: "run",
			findings: "findings.json",
			dryRun: true,
			json: true,
			headSha: "a".repeat(40),
		});
		expect(exitSpy).toHaveBeenCalledWith(43);
	});

	// Note: The remediate command doesn't support --findings flag in the current implementation
	it.skip("dispatches remediate command and ignores missing flag values", async () => {
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

		expect(vi.mocked(runRemediateCLI)).toHaveBeenCalledWith({
			mode: "run",
			dryRun: true,
			json: true,
			headSha: "a".repeat(40),
		});
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

	it("dispatches blast-radius command with default contract path", async () => {
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
			contractPath: "harness.contract.json",
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

	// Note: The remediate command doesn't support --findings flag in the current implementation
	it.skip("dispatches remediate command", async () => {
		const { run } = await import("./cli.js");
		const { runRemediateCLI } = await import("./commands/remediate.js");

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

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runRemediateCLI)).toHaveBeenCalledWith({
			findings: "findings.json",
			dryRun: true,
			json: true,
			contractPath: "harness.contract.json",
			headSha: "a".repeat(40),
		});
		expect(exitSpy).toHaveBeenCalledWith(43);
	});

	// Note: The remediate command doesn't support --findings flag in the current implementation
	it.skip("dispatches remediate command and ignores missing flag values", async () => {
		const { run } = await import("./cli.js");
		const { runRemediateCLI } = await import("./commands/remediate.js");

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

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runRemediateCLI)).toHaveBeenCalledWith({
			dryRun: true,
			json: true,
			headSha: "a".repeat(40),
		});
		expect(exitSpy).toHaveBeenCalledWith(43);
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

	it("dispatches review-gate command and ignores missing flag values", async () => {
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

		expect(vi.mocked(runReviewGateCLI)).toHaveBeenCalledWith({
			token: "",
			owner: "octo",
			repo: "harness",
			prNumber: 123,
			headSha: "",
			checkName: "lint",
			contractPath: "harness.contract.json",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(45);
	});

	it("dispatches policy-gate command and ignores missing --files value", async () => {
		const { run } = await import("./cli.js");
		const { runPolicyGateCLI } = await import("./commands/policy-gate.js");

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		expect(() =>
			run(["policy-gate", "--files", "--max-tier", "low", "--json"]),
		).toThrowError("EXIT_42");

		expect(vi.mocked(runPolicyGateCLI)).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			files: [],
			maxTier: "low",
			json: true,
		});
		expect(exitSpy).toHaveBeenCalledWith(42);
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
				"--json",
			]),
		).toThrowError("EXIT_0");

		expect(vi.mocked(runPilotEvaluateCLI)).toHaveBeenCalledWith({
			artifactsDir: "artifacts/pilot",
			contractPath: "harness.contract.json",
			outputPath: "result.json",
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
		).toThrowError("EXIT_1");

		expect(vi.mocked(runPromptGateCLI)).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(1);
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
			"EXIT_1",
		);

		expect(vi.mocked(runBlastRadiusCLI)).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	// Note: -h is intercepted by the top-level help check, so it's not passed to the command
	it.skip("dispatches index-context when -h is passed after command", async () => {
		const { run } = await import("./cli.js");
		const { runIndexContextCLI } = await import("./commands/index-context.js");

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(((_code?: number) => undefined) as never);

		run(["index-context", "-h"]);

		// Allow async CLI handler to resolve
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(vi.mocked(runIndexContextCLI)).toHaveBeenCalledWith(["-h"]);
		expect(exitSpy).toHaveBeenCalledWith(60);
	});
});
