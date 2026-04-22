import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMAND_SPECS } from "./command-specs.js";
import type { CommandSpec } from "./types.js";

afterEach(() => {
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Structural / shape tests
// ---------------------------------------------------------------------------

describe("COMMAND_SPECS structural integrity", () => {
	it("is a non-empty array", () => {
		expect(Array.isArray(COMMAND_SPECS)).toBe(true);
		expect(COMMAND_SPECS.length).toBeGreaterThan(0);
	});

	it("every entry satisfies the CommandSpec interface shape", () => {
		for (const spec of COMMAND_SPECS) {
			expect(typeof spec.name).toBe("string");
			expect(spec.name.length).toBeGreaterThan(0);
			expect(typeof spec.summary).toBe("string");
			expect(spec.summary.length).toBeGreaterThan(0);
			expect(typeof spec.errorLabel).toBe("string");
			expect(spec.errorLabel.length).toBeGreaterThan(0);
			expect(typeof spec.execute).toBe("function");

			// Optional fields must be correct types when present
			if (spec.aliases !== undefined) {
				expect(Array.isArray(spec.aliases)).toBe(true);
				for (const alias of spec.aliases) {
					expect(typeof alias).toBe("string");
					expect(alias.length).toBeGreaterThan(0);
				}
			}
			if (spec.example !== undefined) {
				expect(typeof spec.example).toBe("string");
			}
		}
	});

	it("has no duplicate command names", () => {
		const names = COMMAND_SPECS.map((s) => s.name);
		const unique = new Set(names);
		expect(unique.size).toBe(names.length);
	});

	it("has no duplicate aliases within a single spec", () => {
		for (const spec of COMMAND_SPECS) {
			if (!spec.aliases) continue;
			const unique = new Set(spec.aliases);
			expect(unique.size).toBe(spec.aliases.length);
		}
	});

	it("has no alias that collides with any canonical command name", () => {
		const canonicalNames = new Set(COMMAND_SPECS.map((s) => s.name));
		for (const spec of COMMAND_SPECS) {
			if (!spec.aliases) continue;
			for (const alias of spec.aliases) {
				expect(canonicalNames.has(alias)).toBe(false);
			}
		}
	});

	it("has no alias that collides with another spec's alias", () => {
		const allAliases: string[] = [];
		for (const spec of COMMAND_SPECS) {
			if (spec.aliases) allAliases.push(...spec.aliases);
		}
		const unique = new Set(allAliases);
		expect(unique.size).toBe(allAliases.length);
	});

	it("includes all expected canonical command names", () => {
		const names = new Set(COMMAND_SPECS.map((s) => s.name));
		const required = [
			"linear",
			"linear-gate",
			"pr-template-gate",
			"policy-gate",
			"evidence-verify",
			"preflight-gate",
			"review-gate",
			"branch-protect",
			"check-authz",
			"check-environment",
			"local-memory-preflight",
			"docs-gate",
			"license-gate",
			"symphony-check",
			"workflow:generate",
			"org-audit",
			"tooling-audit",
			"preset",
			"check",
			"doctor",
			"health",
			"eject",
			"verify-work",
			"verify-coderabbit",
			"contract",
			"risk-tier",
			"replay",
			"gardener",
			"memory-gate",
			"silent-error",
			"brainstorm-gate",
			"plan-gate",
			"prompt-gate",
			"drift-gate",
			"ui:fast",
			"blast-radius",
			"automation-run",
			"remediate",
			"observability-gate",
			"gap-case",
			"ui:verify",
			"ui:explore",
			"simulate",
			"context",
			"search",
			"index-context",
			"context-health",
			"init",
			"upgrade",
			"ci-migrate",
			"diff-budget",
			"pilot-rollback",
			"pilot-evaluate",
		];
		for (const name of required) {
			expect(names.has(name)).toBe(true);
		}
	});

	it("expected aliases are present", () => {
		const allAliasesFlat = COMMAND_SPECS.flatMap((s) => s.aliases ?? []);
		const aliasSet = new Set(allAliasesFlat);
		expect(aliasSet.has("risk-policy-gate")).toBe(true);
		expect(aliasSet.has("pr-template-check")).toBe(true);
		expect(aliasSet.has("symphony:check")).toBe(true);
		expect(aliasSet.has("workflow-generate")).toBe(true);
		expect(aliasSet.has("license-check")).toBe(true);
		expect(aliasSet.has("ui-fast")).toBe(true);
		expect(aliasSet.has("ui-verify")).toBe(true);
		expect(aliasSet.has("ui-explore")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Helper to find a spec by name
// ---------------------------------------------------------------------------

function findSpec(name: string): CommandSpec {
	const spec = COMMAND_SPECS.find((s) => s.name === name);
	if (!spec) throw new Error(`Spec "${name}" not found`);
	return spec;
}

async function withTempWorkspace<T>(
	run: (workspacePath: string) => Promise<T>,
): Promise<T> {
	const workspacePath = mkdtempSync(join(tmpdir(), "command-specs-"));
	try {
		return await run(workspacePath);
	} finally {
		rmSync(workspacePath, { recursive: true, force: true });
	}
}

async function withCwd<T>(cwd: string, run: () => Promise<T>): Promise<T> {
	const previousCwd = process.cwd();
	process.chdir(cwd);
	try {
		return await run();
	} finally {
		process.chdir(previousCwd);
	}
}

// ---------------------------------------------------------------------------
// execute() validation tests — only for handlers that do synchronous
// argument validation and return a number without invoking external CLIs.
// ---------------------------------------------------------------------------

describe("linear execute validation", () => {
	const spec = findSpec("linear");

	it("returns 2 when action is missing", () => {
		expect(spec.execute([])).toBe(2);
	});

	it("returns 2 when action is invalid", () => {
		expect(spec.execute(["unknown-action"])).toBe(2);
	});

	it("returns 2 when action is a flag (no positional)", () => {
		expect(spec.execute(["--json"])).toBe(2);
	});

	it("delegates valid actions to the expected linear handlers with parsed payloads", async () => {
		const workflowModule = await import("../../../commands/linear-workflow.js");
		const prepareModule = await import("../../../commands/linear-prepare.js");
		const syncModule = await import("../../../commands/linear-sync.js");
		const triageModule = await import("../../../commands/linear-triage.js");

		const workflowSpy = vi
			.spyOn(workflowModule, "runLinearWorkflowCLI")
			.mockResolvedValue(41);
		const prepareSpy = vi
			.spyOn(prepareModule, "runLinearPrepareCLI")
			.mockResolvedValue(42);
		const syncSpy = vi
			.spyOn(syncModule, "runLinearSyncCLI")
			.mockResolvedValue(43);
		const triageSpy = vi
			.spyOn(triageModule, "runLinearTriageCLI")
			.mockResolvedValue(44);

		expect(await spec.execute(["claim", "--issue", "JSC-1", "--json"])).toBe(
			41,
		);
		expect(workflowSpy).toHaveBeenCalledWith({
			action: "claim",
			issue: "JSC-1",
			json: true,
		});
		expect(workflowSpy).toHaveBeenCalledTimes(1);

		expect(await spec.execute(["handoff", "--issue", "JSC-2", "--json"])).toBe(
			41,
		);
		expect(workflowSpy).toHaveBeenCalledWith({
			action: "handoff",
			issue: "JSC-2",
			json: true,
		});

		expect(await spec.execute(["close", "--issue", "JSC-3", "--json"])).toBe(
			41,
		);
		expect(workflowSpy).toHaveBeenCalledWith({
			action: "close",
			issue: "JSC-3",
			json: true,
		});
		expect(workflowSpy).toHaveBeenCalledTimes(3);

		expect(
			await spec.execute(["prepare", "--issue", "JSC-4", "--field", "branch"]),
		).toBe(42);
		expect(prepareSpy).toHaveBeenCalledWith({
			issue: "JSC-4",
			field: "branch",
		});
		expect(prepareSpy).toHaveBeenCalledTimes(1);

		expect(await spec.execute(["sync", "--team", "Core", "--dry-run"])).toBe(
			43,
		);
		expect(syncSpy).toHaveBeenCalledWith({
			team: "Core",
			dryRun: true,
		});
		expect(syncSpy).toHaveBeenCalledTimes(1);

		expect(
			await spec.execute([
				"triage",
				"--team",
				"Core",
				"--limit",
				"5",
				"--apply",
			]),
		).toBe(44);
		expect(triageSpy).toHaveBeenCalledWith({
			team: "Core",
			limit: 5,
			apply: true,
		});
		expect(triageSpy).toHaveBeenCalledTimes(1);
	});
});

describe("prompt-gate execute validation", () => {
	const spec = findSpec("prompt-gate");

	it("returns 2 when --type is missing", () => {
		expect(spec.execute(["--file", "foo.md"])).toBe(2);
	});

	it("returns 2 when --file is missing", () => {
		expect(spec.execute(["--type", "feature"])).toBe(2);
	});

	it("returns 2 when both flags are missing", () => {
		expect(spec.execute([])).toBe(2);
	});

	it("returns 2 when --type is an invalid value", () => {
		expect(spec.execute(["--type", "invalid-type", "--file", "foo.md"])).toBe(
			2,
		);
	});

	it("delegates all valid --type values with parsed options", async () => {
		const promptGateModule = await import("../../../commands/prompt-gate.js");
		const promptGateSpy = vi
			.spyOn(promptGateModule, "runPromptGateCLI")
			.mockResolvedValue(52);
		const validTypes = ["feature", "bugfix", "refactor", "release"];
		for (const type of validTypes) {
			const result = await spec.execute(["--type", type, "--file", "foo.md"]);
			expect(result).toBe(52);
			expect(promptGateSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type,
					file: "foo.md",
				}),
			);
		}
		expect(promptGateSpy).toHaveBeenCalledTimes(validTypes.length);
	});
});

describe("blast-radius execute validation", () => {
	const spec = findSpec("blast-radius");

	it("returns 2 when --files is missing", () => {
		expect(spec.execute(["--json"])).toBe(2);
	});

	it("delegates when --files is provided with parsed options", async () => {
		const blastRadiusModule = await import("../../../commands/blast-radius.js");
		const blastRadiusSpy = vi
			.spyOn(blastRadiusModule, "runBlastRadiusCLI")
			.mockResolvedValue(53);
		const result = await spec.execute(["--files", "src/auth.ts", "--json"]);
		expect(result).toBe(53);
		expect(blastRadiusSpy).toHaveBeenCalledWith({
			files: ["src/auth.ts"],
			json: true,
			verbose: false,
		});
		expect(blastRadiusSpy).toHaveBeenCalledTimes(1);
	});
});

describe("simulate execute validation", () => {
	const spec = findSpec("simulate");

	it("returns 2 when --contract-a is missing", () => {
		expect(spec.execute(["--contract-b", "b.json"])).toBe(2);
	});

	it("returns 2 when --contract-b is missing", () => {
		expect(spec.execute(["--contract-a", "a.json"])).toBe(2);
	});

	it("returns 2 when both contract flags are missing", () => {
		expect(spec.execute(["--json"])).toBe(2);
	});

	it("prints usage and returns 0 for --help", () => {
		const result = spec.execute(["--help"]);
		expect(result).toBe(0);
	});

	it("prints usage and returns 0 for -h", () => {
		const result = spec.execute(["-h"]);
		expect(result).toBe(0);
	});

	it("delegates when both contract flags are provided", async () => {
		const simulateModule = await import("../../../commands/simulate.js");
		const simulateSpy = vi
			.spyOn(simulateModule, "runSimulateCLI")
			.mockResolvedValue(54);
		const result = await spec.execute([
			"--contract-a",
			"a.json",
			"--contract-b",
			"b.json",
			"--artifacts",
			"artifacts",
			"--traces",
			"traces",
			"--json",
		]);
		expect(result).toBe(54);
		expect(simulateSpy).toHaveBeenCalledWith({
			contractA: "a.json",
			contractB: "b.json",
			artifactsDir: "artifacts",
			tracesDir: "traces",
			json: true,
		});
		expect(simulateSpy).toHaveBeenCalledTimes(1);
	});
});

describe("drift-gate execute validation", () => {
	const spec = findSpec("drift-gate");
	const writeDriftGateFixture = (workspacePath: string): void => {
		mkdirSync(join(workspacePath, "src"), { recursive: true });
		writeFileSync(
			join(workspacePath, "src/cli.ts"),
			[
				'if (command === "init") {}',
				'if (command === "drift-gate") {}',
				'console.info("  init             Install harness");',
				'console.info("  drift-gate       Check consistency drift");',
			].join("\n"),
			"utf-8",
		);
		writeFileSync(
			join(workspacePath, "README.md"),
			[
				"| Command | Purpose |",
				"| --- | --- |",
				"| `init` | Install harness. |",
				"| `drift-gate` | Check consistency drift. |",
			].join("\n"),
			"utf-8",
		);
		mkdirSync(join(workspacePath, "docs"), { recursive: true });
		writeFileSync(
			join(workspacePath, "docs/QUALITY_SCORE.md"),
			[
				"---",
				"last_updated: 2026-03-05",
				"calculated_by: harness-gardener",
				"---",
				"",
				"# Documentation Quality Score",
				"",
				"**Score:** 90/100",
			].join("\n"),
			"utf-8",
		);
		mkdirSync(join(workspacePath, "docs/roadmap"), { recursive: true });
		writeFileSync(
			join(workspacePath, "docs/roadmap/agent-first-status.md"),
			[
				"# Matrix",
				"",
				"| Metric | Current | Trend |",
				"| --- | --- | --- |",
				"| `pr_lead_time_p50` | 18h | improving |",
				"| `pr_lead_time_p90` | 30h | improving |",
				"| `review_rework_retry_rate` | 0.9 | improving |",
				"| `manual_interventions_per_agent_change` | 0.4 | improving |",
				"| `merge_readiness_block_time` | 6h | improving |",
				"| `north_star_alignment_pass_rate` | 97% | improving |",
				"| `blocking_drift_findings_count` | 1 | improving |",
				"| `surface_class_counts{core,adjacent,experimental}` | 7/3/1 | flat |",
				"| `policy_surface_additions_without_glue_reduction` | 0 | flat |",
				"| `cadence_breach_count` | 0 | flat |",
				"| `repeated_failure_class_count` | 1 | improving |",
				"| `durable_guardrail_added_count` | 1 | flat |",
				"| `post_guardrail_recurrence_rate` | 0.0 | improving |",
				"",
				"### Phase A",
				"**Status:** ✅ Complete",
				"",
				"### Phase B",
				"**Status:** 🔶 Partial",
			].join("\n"),
			"utf-8",
		);
		mkdirSync(join(workspacePath, "todos"), { recursive: true });
		writeFileSync(
			join(workspacePath, "todos/001-complete-test.md"),
			["---", "status: complete", "---", "", "# complete todo"].join("\n"),
			"utf-8",
		);
		writeFileSync(
			join(workspacePath, "harness.contract.json"),
			JSON.stringify({ version: "0.13.0" }, null, 2),
			"utf-8",
		);
	};

	it("returns 2 when --mode is an invalid value", () => {
		expect(spec.execute(["--mode", "strict"])).toBe(2);
	});

	it("returns 2 when --mode is missing its value", () => {
		expect(spec.execute(["--mode", "--json"])).toBe(2);
	});

	it("returns 2 when --out is missing its value", () => {
		expect(spec.execute(["--out", "--json"])).toBe(2);
	});

	it("returns 2 when --baseline is missing its value", () => {
		expect(spec.execute(["--baseline", "--json"])).toBe(2);
	});

	it("returns 2 when --suppress is missing its value", () => {
		expect(spec.execute(["--suppress", "--json"])).toBe(2);
	});

	it("returns 2 when --repo-root is missing its value", () => {
		expect(spec.execute(["--repo-root", "--json"])).toBe(2);
	});

	it("returns 0 for --mode advisory with a clean fixture", async () => {
		await withTempWorkspace(async (workspacePath) => {
			writeDriftGateFixture(workspacePath);
			const result = await withCwd(workspacePath, () =>
				Promise.resolve(spec.execute(["--mode", "advisory", "--no-seed"])),
			);
			expect(result).toBe(0);
		});
	});

	it("returns 1 for --mode health when status-surface drift is present", async () => {
		await withTempWorkspace(async (workspacePath) => {
			writeDriftGateFixture(workspacePath);
			rmSync(join(workspacePath, "docs/roadmap/agent-first-status.md"));

			const result = await withCwd(workspacePath, () =>
				Promise.resolve(spec.execute(["--mode", "health", "--no-seed"])),
			);
			expect(result).toBe(1);
		});
	});

	it("returns 0 for --mode health with a clean status surface fixture", async () => {
		await withTempWorkspace(async (workspacePath) => {
			writeDriftGateFixture(workspacePath);

			const result = await withCwd(workspacePath, () =>
				Promise.resolve(spec.execute(["--mode", "health", "--no-seed"])),
			);
			expect(result).toBe(0);
		});
	});

	it("returns 0 when --mode is absent and fixture is clean", async () => {
		await withTempWorkspace(async (workspacePath) => {
			writeDriftGateFixture(workspacePath);
			const result = await withCwd(workspacePath, () =>
				Promise.resolve(spec.execute(["--no-seed"])),
			);
			expect(result).toBe(0);
		});
	});

	it("passes --repo-root through to drift-gate execution", async () => {
		await withTempWorkspace(async (workspacePath) => {
			writeDriftGateFixture(workspacePath);
			const invalidRepoRoot = join(workspacePath, "not-a-repo-root");
			mkdirSync(invalidRepoRoot, { recursive: true });
			const result = await withCwd(workspacePath, () =>
				Promise.resolve(
					spec.execute([
						"--mode",
						"health",
						"--no-seed",
						"--repo-root",
						invalidRepoRoot,
					]),
				),
			);
			expect(result).toBe(1);
		});
	});
});

describe("verify-work execute validation", () => {
	const spec = findSpec("verify-work");

	function writeVerifyWorkWrapper(workspacePath: string): string {
		const scriptsDir = join(workspacePath, "scripts");
		const argsLogPath = join(workspacePath, "verify-work-args.log");
		mkdirSync(scriptsDir, { recursive: true });
		writeFileSync(
			join(scriptsDir, "verify-work.sh"),
			`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "${argsLogPath}"
`,
			"utf-8",
		);
		return argsLogPath;
	}

	it("passes --workspace-governance through to verify-work wrapper", async () => {
		await withTempWorkspace(async (workspacePath) => {
			const argsLogPath = writeVerifyWorkWrapper(workspacePath);
			const result = await withCwd(workspacePath, () =>
				Promise.resolve(spec.execute(["--workspace-governance"])),
			);
			expect(result).toBe(0);
			const args = readFileSync(argsLogPath, "utf-8");
			expect(args).toContain("--workspace-governance");
			expect(args).not.toContain("--project-governance");
		});
	});

	it("passes --project-governance through to verify-work wrapper", async () => {
		await withTempWorkspace(async (workspacePath) => {
			const argsLogPath = writeVerifyWorkWrapper(workspacePath);
			const result = await withCwd(workspacePath, () =>
				Promise.resolve(spec.execute(["--project-governance"])),
			);
			expect(result).toBe(0);
			const args = readFileSync(argsLogPath, "utf-8");
			expect(args).toContain("--project-governance");
			expect(args).not.toContain("--workspace-governance");
		});
	});

	it("returns 2 when governance scope flags are both provided", () => {
		expect(
			spec.execute(["--project-governance", "--workspace-governance"]),
		).toBe(2);
	});
});

describe("preflight-gate execute validation", () => {
	const spec = findSpec("preflight-gate");

	it("returns 2 when --admission-file is missing its value", () => {
		expect(spec.execute(["--admission-file", "--json"])).toBe(2);
	});

	it("returns 2 when --admission-file contains malformed JSON", async () => {
		await withTempWorkspace(async (workspacePath) => {
			const admissionPath = join(workspacePath, "admission.invalid.json");
			writeFileSync(admissionPath, "{invalid-json", "utf-8");
			const preflightModule = await import(
				"../../../commands/preflight-gate.js"
			);
			const preflightSpy = vi.spyOn(preflightModule, "runPreflightGateCLI");

			const result = await spec.execute(["--admission-file", admissionPath]);
			expect(result).toBe(2);
			expect(preflightSpy).not.toHaveBeenCalled();
		});
	});

	it("returns 2 when --admission-file contains a non-object payload", async () => {
		await withTempWorkspace(async (workspacePath) => {
			const admissionPath = join(workspacePath, "admission.array.json");
			writeFileSync(admissionPath, JSON.stringify(["not-an-object"]), "utf-8");
			const preflightModule = await import(
				"../../../commands/preflight-gate.js"
			);
			const preflightSpy = vi.spyOn(preflightModule, "runPreflightGateCLI");

			const result = await spec.execute(["--admission-file", admissionPath]);
			expect(result).toBe(2);
			expect(preflightSpy).not.toHaveBeenCalled();
		});
	});

	it("delegates parsed admission payload from --admission-file", async () => {
		await withTempWorkspace(async (workspacePath) => {
			const admissionPath = join(workspacePath, "admission.json");
			writeFileSync(
				admissionPath,
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
						"Tightens admission declaration routing in CLI dispatch.",
				}),
				"utf-8",
			);

			const preflightModule = await import(
				"../../../commands/preflight-gate.js"
			);
			const preflightSpy = vi
				.spyOn(preflightModule, "runPreflightGateCLI")
				.mockResolvedValue(66);

			const result = await spec.execute([
				"--admission-file",
				admissionPath,
				"--json",
			]);
			expect(result).toBe(66);
			expect(preflightSpy).toHaveBeenCalledWith({
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
						"Tightens admission declaration routing in CLI dispatch.",
				},
				json: true,
			});
		});
	});
});

describe("review-gate execute validation", () => {
	const spec = findSpec("review-gate");

	it("returns 2 when required flags are missing", () => {
		expect(spec.execute(["--json"])).toBe(2);
	});

	it("returns 2 when a required flag is missing its value", () => {
		expect(
			spec.execute([
				"--token",
				"--owner",
				"octo",
				"--repo",
				"harness",
				"--pr",
				"123",
				"--sha",
				"0123456789abcdef0123456789abcdef01234567",
			]),
		).toBe(2);
	});

	it("returns 2 when each required flag is present without a value", () => {
		const baseArgs = [
			"--token",
			"token",
			"--owner",
			"octo",
			"--repo",
			"harness",
			"--pr",
			"123",
			"--sha",
			"0123456789abcdef0123456789abcdef01234567",
		];
		const requiredFlags = ["--token", "--owner", "--repo", "--pr", "--sha"];
		for (const flag of requiredFlags) {
			const flagIndex = baseArgs.indexOf(flag);
			const args = [...baseArgs];
			args[flagIndex + 1] = "--json";
			expect(spec.execute(args)).toBe(2);
		}
	});

	it("returns 2 when --pr is not a positive integer", () => {
		expect(
			spec.execute([
				"--token",
				"token",
				"--owner",
				"octo",
				"--repo",
				"harness",
				"--pr",
				"abc",
				"--sha",
				"0123456789abcdef0123456789abcdef01234567",
			]),
		).toBe(2);
	});

	it("returns 2 when --pr is zero or negative", () => {
		const commonArgs = [
			"--token",
			"token",
			"--owner",
			"octo",
			"--repo",
			"harness",
			"--sha",
			"0123456789abcdef0123456789abcdef01234567",
		];
		expect(spec.execute([...commonArgs, "--pr", "0"])).toBe(2);
		expect(spec.execute([...commonArgs, "--pr", "-1"])).toBe(2);
	});

	it("uses GH_TOKEN fallback when --token is omitted", async () => {
		const reviewGateModule = await import("../../../commands/review-gate.js");
		const reviewGateSpy = vi
			.spyOn(reviewGateModule, "runReviewGateCLI")
			.mockResolvedValue(45);
		const previousGhToken = process.env.GH_TOKEN;
		process.env.GH_TOKEN = "ghs_env_token";
		try {
			const result = await spec.execute([
				"--owner",
				"octo",
				"--repo",
				"harness",
				"--pr",
				"123",
				"--sha",
				"0123456789abcdef0123456789abcdef01234567",
				"--json",
			]);
			expect(result).toBe(45);
			expect(reviewGateSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					token: "ghs_env_token",
					owner: "octo",
					repo: "harness",
					prNumber: 123,
					headSha: "0123456789abcdef0123456789abcdef01234567",
					json: true,
				}),
			);
		} finally {
			process.env.GH_TOKEN = previousGhToken;
		}
	});
});

describe("pilot-rollback execute validation", () => {
	const spec = findSpec("pilot-rollback");

	it("returns 2 when --mode is missing", () => {
		expect(spec.execute(["--incident-id", "INC-1"])).toBe(2);
	});

	it("returns 2 when --mode is invalid", () => {
		expect(spec.execute(["--mode", "fast", "--incident-id", "INC-1"])).toBe(2);
	});

	it("delegates autonomous mode with parsed options", async () => {
		const pilotRollbackModule = await import(
			"../../../commands/pilot-rollback.js"
		);
		const pilotRollbackSpy = vi
			.spyOn(pilotRollbackModule, "runPilotRollbackCLI")
			.mockResolvedValue(55);
		const result = await spec.execute([
			"--mode",
			"autonomous",
			"--incident-id",
			"INC-1",
		]);
		expect(result).toBe(55);
		expect(pilotRollbackSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: "autonomous",
				incidentId: "INC-1",
			}),
		);
		expect(pilotRollbackSpy).toHaveBeenCalledTimes(1);
	});

	it("delegates manual mode with parsed options", async () => {
		const pilotRollbackModule = await import(
			"../../../commands/pilot-rollback.js"
		);
		const pilotRollbackSpy = vi
			.spyOn(pilotRollbackModule, "runPilotRollbackCLI")
			.mockResolvedValue(56);
		const result = await spec.execute([
			"--mode",
			"manual",
			"--incident-id",
			"INC-1",
		]);
		expect(result).toBe(56);
		expect(pilotRollbackSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: "manual",
				incidentId: "INC-1",
			}),
		);
		expect(pilotRollbackSpy).toHaveBeenCalledTimes(1);
	});
});

describe("remediate execute validation", () => {
	const spec = findSpec("remediate");

	it("returns 2 when subcommand is missing", () => {
		expect(spec.execute([])).toBe(2);
	});

	it("returns 2 when subcommand is invalid", () => {
		expect(spec.execute(["start"])).toBe(2);
	});

	it("delegates subcommand run with parsed options", async () => {
		const remediateModule = await import("../../../commands/remediate.js");
		const remediateSpy = vi
			.spyOn(remediateModule, "runRemediateCLI")
			.mockResolvedValue(57);
		const result = await spec.execute([
			"run",
			"--findings",
			"findings.json",
			"--json",
			"--provider",
			"codex",
		]);
		expect(result).toBe(57);
		expect(remediateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				subcommand: "run",
				findings: "findings.json",
				json: true,
				provider: "codex",
			}),
		);
		expect(remediateSpy).toHaveBeenCalledTimes(1);
	});

	it("delegates subcommand apply with parsed options", async () => {
		const remediateModule = await import("../../../commands/remediate.js");
		const remediateSpy = vi
			.spyOn(remediateModule, "runRemediateCLI")
			.mockResolvedValue(58);
		const result = await spec.execute([
			"apply",
			"--findings",
			"findings.json",
			"--mode",
			"autonomous",
		]);
		expect(result).toBe(58);
		expect(remediateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				subcommand: "apply",
				findings: "findings.json",
				mode: "autonomous",
			}),
		);
		expect(remediateSpy).toHaveBeenCalledTimes(1);
	});
});

describe("gap-case execute validation", () => {
	const spec = findSpec("gap-case");

	it("returns 2 when action is missing", () => {
		expect(spec.execute([])).toBe(2);
	});

	it("returns 2 when action is invalid", () => {
		expect(spec.execute(["update"])).toBe(2);
	});

	it("delegates action open with parsed options", async () => {
		const gapCaseModule = await import("../../../commands/gap-case.js");
		const gapCaseSpy = vi
			.spyOn(gapCaseModule, "runGapCaseCLI")
			.mockResolvedValue(59);
		const result = await spec.execute(["open", "--json"]);
		expect(result).toBe(59);
		expect(gapCaseSpy).toHaveBeenCalledWith({
			action: "open",
			json: true,
		});
		expect(gapCaseSpy).toHaveBeenCalledTimes(1);
	});

	it("delegates action resolve with parsed options", async () => {
		const gapCaseModule = await import("../../../commands/gap-case.js");
		const gapCaseSpy = vi
			.spyOn(gapCaseModule, "runGapCaseCLI")
			.mockResolvedValue(60);
		const result = await spec.execute(["resolve", "--case-id", "GAP-1"]);
		expect(result).toBe(60);
		expect(gapCaseSpy).toHaveBeenCalledWith({
			action: "resolve",
			caseId: "GAP-1",
		});
		expect(gapCaseSpy).toHaveBeenCalledTimes(1);
	});
});

describe("branch-protect execute validation", () => {
	const spec = findSpec("branch-protect");

	it("returns 2 when --required-approvals is not a number", () => {
		expect(spec.execute(["--required-approvals", "not-a-number"])).toBe(2);
	});

	it("accepts --required-approvals of 0 without error", async () => {
		const branchProtectModule = await import(
			"../../../commands/branch-protect.js"
		);
		const branchProtectSpy = vi
			.spyOn(branchProtectModule, "runBranchProtectCLI")
			.mockResolvedValue(61);
		const result = await spec.execute(["--required-approvals", "0"]);
		expect(result).toBe(61);
		expect(branchProtectSpy).toHaveBeenCalledWith({
			requiredApprovingReviewCount: 0,
		});
		expect(branchProtectSpy).toHaveBeenCalledTimes(1);
	});

	it("accepts --required-approvals of a positive integer", async () => {
		const branchProtectModule = await import(
			"../../../commands/branch-protect.js"
		);
		const branchProtectSpy = vi
			.spyOn(branchProtectModule, "runBranchProtectCLI")
			.mockResolvedValue(62);
		const result = await spec.execute(["--required-approvals", "2"]);
		expect(result).toBe(62);
		expect(branchProtectSpy).toHaveBeenCalledWith({
			requiredApprovingReviewCount: 2,
		});
		expect(branchProtectSpy).toHaveBeenCalledTimes(1);
	});
});

describe("policy-gate execute validation", () => {
	const spec = findSpec("policy-gate");

	it("does not return 2 with no arguments (uses defaults)", async () => {
		const policyGateModule = await import("../../../commands/policy-gate.js");
		const policyGateSpy = vi
			.spyOn(policyGateModule, "runPolicyGateCLI")
			.mockResolvedValue(63);
		const result = await spec.execute([]);
		expect(result).toBe(63);
		expect(policyGateSpy).toHaveBeenCalledWith({
			contractPath: "harness.contract.json",
			files: [],
		});
		expect(policyGateSpy).toHaveBeenCalledTimes(1);
	});

	it("delegates valid --max-tier values with parsed options", async () => {
		const policyGateModule = await import("../../../commands/policy-gate.js");
		const policyGateSpy = vi
			.spyOn(policyGateModule, "runPolicyGateCLI")
			.mockResolvedValue(64);
		for (const tier of ["high", "medium", "low"]) {
			const result = await spec.execute(["--max-tier", tier]);
			expect(result).toBe(64);
			expect(policyGateSpy).toHaveBeenCalledWith({
				contractPath: "harness.contract.json",
				files: [],
				maxTier: tier,
			});
		}
		expect(policyGateSpy).toHaveBeenCalledTimes(3);
	});

	it("returns 2 when --contract is missing a value", () => {
		expect(spec.execute(["--contract"])).toBe(2);
	});

	it("returns 2 when --files is missing a value", () => {
		expect(spec.execute(["--files"])).toBe(2);
	});

	it("returns 2 when --max-tier is missing a value", () => {
		expect(spec.execute(["--max-tier"])).toBe(2);
	});

	it("returns 2 when --max-tier is invalid", () => {
		expect(spec.execute(["--max-tier", "bogus"])).toBe(2);
	});
});

describe("ci-migrate execute validation", () => {
	const spec = findSpec("ci-migrate");

	it("returns 2 when more than one positional argument is passed", () => {
		// Two positional args after the action => error
		const result = spec.execute(["prepare", "dir1", "extra-arg"]);
		expect(result).toBe(2);
	});
});

describe("pilot-evaluate execute validation", () => {
	const spec = findSpec("pilot-evaluate");

	it("returns 2 when --artifacts is missing", () => {
		expect(spec.execute(["--json"])).toBe(2);
	});

	it("delegates when --artifacts is provided with parsed options", async () => {
		const pilotEvaluateModule = await import(
			"../../../commands/pilot-evaluate.js"
		);
		const pilotEvaluateSpy = vi
			.spyOn(pilotEvaluateModule, "runPilotEvaluateCLI")
			.mockResolvedValue(65);
		const result = await spec.execute([
			"--artifacts",
			"artifacts",
			"--contract",
			"harness.contract.json",
			"--adapter-registry",
			"contracts/agent-adapter-registry.json",
			"--metric-registry",
			"contracts/agent-metric-registry.json",
			"--json",
		]);
		expect(result).toBe(65);
		expect(pilotEvaluateSpy).toHaveBeenCalledWith({
			artifactsDir: "artifacts",
			contractPath: "harness.contract.json",
			adapterRegistryPath: "contracts/agent-adapter-registry.json",
			metricRegistryPath: "contracts/agent-metric-registry.json",
			json: true,
		});
		expect(pilotEvaluateSpy).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// CommandSpec type contract (types.ts interface)
// ---------------------------------------------------------------------------

describe("CommandSpec type contract", () => {
	it("satisfies required fields of CommandSpec interface", () => {
		// TypeScript compile-time check exercised at runtime
		const sample: CommandSpec = {
			name: "test-cmd",
			summary: "A test command",
			errorLabel: "Test Error",
			execute: (_args: string[]) => 0,
		};
		expect(sample.name).toBe("test-cmd");
		expect(sample.summary).toBe("A test command");
		expect(sample.errorLabel).toBe("Test Error");
		expect(typeof sample.execute).toBe("function");
		expect(sample.aliases).toBeUndefined();
		expect(sample.example).toBeUndefined();
	});

	it("allows optional fields aliases and example", () => {
		const sample: CommandSpec = {
			name: "test-cmd",
			summary: "A test command",
			errorLabel: "Test Error",
			example: "test-cmd --foo",
			aliases: ["test", "tc"],
			execute: (_args: string[]) => Promise.resolve(0),
		};
		expect(sample.aliases).toEqual(["test", "tc"]);
		expect(sample.example).toBe("test-cmd --foo");
	});

	it("execute can return a number synchronously", () => {
		const spec: CommandSpec = {
			name: "sync-cmd",
			summary: "sync",
			errorLabel: "Sync Error",
			execute: () => 0,
		};
		const result = spec.execute([]);
		expect(result).toBe(0);
	});

	it("execute can return a Promise<number>", async () => {
		const spec: CommandSpec = {
			name: "async-cmd",
			summary: "async",
			errorLabel: "Async Error",
			execute: () => Promise.resolve(42),
		};
		const result = await spec.execute([]);
		expect(result).toBe(42);
	});
});

// ---------------------------------------------------------------------------
// Architecture boundary tests for command-specs.ts
// ---------------------------------------------------------------------------

describe("command-specs.ts architecture boundaries", () => {
	it("imports from ../../../commands/ (three levels up, commands folder)", () => {
		const filePath = fileURLToPath(
			new URL("./command-specs.ts", import.meta.url),
		);
		const content = readFileSync(filePath, "utf-8");
		// Verify imports come from ../../../commands/ path
		expect(content).toMatch(/from\s+["']\.\.\/\.\.\/\.\.\/commands\//);
	});

	it("does not import from ../../commands/ (wrong relative path)", () => {
		const filePath = fileURLToPath(
			new URL("./command-specs.ts", import.meta.url),
		);
		const content = readFileSync(filePath, "utf-8");
		// Two-levels-up imports would be wrong from the registry/ subfolder
		expect(content).not.toMatch(/from\s+["']\.\.\/\.\.\/commands\//);
	});

	it("only imports CommandSpec type from ./types.js (not from command-registry)", () => {
		const filePath = fileURLToPath(
			new URL("./command-specs.ts", import.meta.url),
		);
		const content = readFileSync(filePath, "utf-8");
		// Verify CommandSpec is imported as type-only from ./types
		expect(content).toMatch(
			/import\s+type\s+\{[^}]*CommandSpec[^}]*\}\s+from\s+["']\.\/types\.js["']/,
		);
		expect(content).not.toContain('from "../command-registry');
	});

	it("imports parse-utils from ../parse-utils.js (correct relative path)", () => {
		const filePath = fileURLToPath(
			new URL("./command-specs.ts", import.meta.url),
		);
		const content = readFileSync(filePath, "utf-8");
		// Verify parse-utils is imported from ../parse-utils.js with required .js extension
		expect(content).toMatch(
			/(?:import|require)[\s\S]*from\s+["']\.\.\/parse-utils\.js["']/,
		);
	});
});

// ---------------------------------------------------------------------------
// types.ts architecture boundary test
// ---------------------------------------------------------------------------

describe("types.ts architecture boundaries", () => {
	it("has no imports (pure interface declarations)", () => {
		const filePath = fileURLToPath(new URL("./types.ts", import.meta.url));
		const content = readFileSync(filePath, "utf-8");
		// Should have no import statements
		expect(content).not.toMatch(/^import /m);
	});

	it("exports CommandSpec interface", () => {
		const filePath = fileURLToPath(new URL("./types.ts", import.meta.url));
		const content = readFileSync(filePath, "utf-8");
		expect(content).toContain("export interface CommandSpec");
	});

	it("exports RegistryDispatchResult interface", () => {
		const filePath = fileURLToPath(new URL("./types.ts", import.meta.url));
		const content = readFileSync(filePath, "utf-8");
		expect(content).toContain("export interface RegistryDispatchResult");
	});

	it("RegistryDispatchResult references CommandSpec and result type", () => {
		const filePath = fileURLToPath(new URL("./types.ts", import.meta.url));
		const content = readFileSync(filePath, "utf-8");
		// Verify the interface exists and mentions CommandSpec
		expect(content).toContain("export interface RegistryDispatchResult");
		expect(content).toContain("CommandSpec");
		// TypeScript compilation validates actual field types
	});
});
