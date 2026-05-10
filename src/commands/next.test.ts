import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	validateHarnessDecision,
	validateHarnessDecisionOperationalMeta,
} from "../lib/decision/harness-decision.js";
import { parseGitStatusShort, runHarnessNext, runNextCLI } from "./next.js";

function captureNextCLI(
	args: string[],
	options: Parameters<typeof runNextCLI>[1],
): { exitCode: number; output: string } {
	const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
	const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	try {
		const exitCode = runNextCLI(args, options);
		const output = String(infoSpy.mock.calls.at(-1)?.[0] ?? "");
		expect(errorSpy).not.toHaveBeenCalled();
		return { exitCode, output };
	} finally {
		infoSpy.mockRestore();
		errorSpy.mockRestore();
	}
}

function parseDecision(output: string): ReturnType<typeof runHarnessNext> {
	const parsed = JSON.parse(output) as ReturnType<typeof runHarnessNext>;
	expect(validateHarnessDecision(parsed)).toEqual({ valid: true, errors: [] });
	return parsed;
}

describe("parseGitStatusShort", () => {
	it("parses changed, untracked, and renamed paths", () => {
		expect(
			parseGitStatusShort(
				" M src/commands/next.ts\n?? docs/plan.md\nR  old.ts -> new.ts\n",
			),
		).toEqual(["docs/plan.md", "new.ts", "src/commands/next.ts"]);
	});

	it("uses the final rename marker when old filenames contain arrows", () => {
		expect(parseGitStatusShort('R  "old -> name.ts" -> new.ts\n')).toEqual([
			"new.ts",
		]);
	});

	it("decodes git C-quoted paths before producing file arguments", () => {
		expect(parseGitStatusShort(' M "caf\\303\\251.txt"\n')).toEqual([
			"café.txt",
		]);
	});
});

describe("runHarnessNext", () => {
	it("recommends a safe validation command from changed files", () => {
		const decision = runHarnessNext({
			files: ["src/commands/next.ts"],
			mode: "local",
		});

		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision.status).toBe("action_required");
		expect(decision.failureClass).toBeNull();
		expect(decision.nextAction).toBe(
			"Generate a repo-canonical validation plan for the changed files.",
		);
		expect(decision.nextCommand).toBe(
			"harness validation-plan --files src/commands/next.ts --json",
		);
		expect(decision.phase).toBe("verify");
		expect(decision.objective).toBe(
			"Produce the repo-canonical validation plan for the changed files.",
		);
		expect(decision.requiredEvidence).toEqual([
			"input:files",
			"command-catalog:harness-command-catalog/v3",
			"harness validation-plan --files src/commands/next.ts --json output",
		]);
		expect(decision.stopConditions).toEqual([
			"Stop if validation-plan cannot produce JSON for the changed files.",
		]);
		expect(decision.followUpCommands).toEqual([
			"harness review-context --files src/commands/next.ts --json",
		]);
		expect(decision.hiddenPlumbing).toEqual([
			"git:status",
			"command-catalog",
			"risk-tier",
		]);
		expect(decision.safeToRun).toBe(true);
		expect(decision.requiresNetwork).toBe(false);
		expect(decision.writesFiles).toBe(false);
		expect(decision.retry).toBe("safe");
		expect(decision.evidenceRef).toContain("input:files");
		expect(validateHarnessDecisionOperationalMeta(decision.meta)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision.meta).toMatchObject({
			frictionClass: "none",
			delayClass: "normal",
			execution: {
				profile: "read_only",
				startupCost: "low",
				permissionPlan: {
					requiresHuman: false,
					requiresNetwork: false,
					writesFiles: false,
					requiresGitWrite: false,
					filesystemWrite: [],
					commands: [
						"harness validation-plan --files src/commands/next.ts --json",
					],
					secrets: [],
				},
			},
		});
	});

	it("returns a pass decision when no changed files are detected", () => {
		const decision = runHarnessNext({
			inspectChangedFiles: () => [],
			repoRoot: "/tmp/repo",
		});

		expect(decision.status).toBe("pass");
		expect(decision.failureClass).toBeNull();
		expect(decision.nextAction).toBe(
			"Run harness check --json to confirm repo readiness.",
		);
		expect(decision.nextCommand).toBe("harness check --json");
		expect(decision.phase).toBe("handoff");
		expect(decision.objective).toBe(
			"Confirm the repository is ready when no changed files are detected.",
		);
		expect(decision.requiredEvidence).toEqual([
			"git:status",
			"harness check --json output",
		]);
		expect(decision.stopConditions).toEqual([
			"Stop if harness check reports a blocked or failed gate.",
		]);
		expect(decision.retry).toBe("safe");
		expect(decision.evidenceRef).toEqual(["git:status"]);
		expect(decision.meta).toMatchObject({
			frictionClass: "none",
			delayClass: "normal",
			execution: {
				profile: "read_only",
				startupCost: "low",
				permissionPlan: {
					commands: ["harness check --json"],
					requiresNetwork: false,
					writesFiles: false,
				},
			},
		});
	});

	it("blocks empty --files overrides instead of inspecting git", () => {
		const decision = runHarnessNext({ files: [] });

		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("files_override_empty");
		expect(decision.nextAction).toContain("omit --files");
		expect(decision.nextCommand).toBeNull();
		expect(decision.phase).toBe("repair");
		expect(decision.requiredEvidence).toEqual(["input:files"]);
		expect(decision.stopConditions).toEqual([
			"Stop until files_override_empty is resolved.",
		]);
		expect(decision.humanEscalation).toBe(
			"Pass one or more changed files, or omit --files so harness next can inspect git state.",
		);
		expect(decision.retry).toBe("manual");
		expect(decision.evidenceRef).toEqual(["input:files"]);
		expect(decision.meta).toMatchObject({
			frictionClass: "unclear_instruction",
			delayClass: "human_needed",
			execution: {
				startupCost: "none",
				permissionPlan: {
					requiresHuman: true,
					commands: [],
				},
			},
		});
	});

	it("blocks when git state cannot be inspected", () => {
		const decision = runHarnessNext({
			inspectChangedFiles: () => {
				throw new Error("not a git repo");
			},
			repoRoot: "/tmp/repo",
		});

		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("git_state_unavailable");
		expect(decision.nextAction).toContain("Run harness doctor --json");
		expect(decision.nextCommand).toBe("harness doctor --json");
		expect(decision.phase).toBe("repair");
		expect(decision.objective).toBe(
			"Restore git-state visibility before choosing workflow work.",
		);
		expect(decision.requiredEvidence).toEqual([
			"git:status",
			"harness doctor --json output",
		]);
		expect(decision.followUpCommands).toEqual(["harness next --json"]);
		expect(decision.safeToRun).toBe(true);
		expect(decision.retry).toBe("manual");
		expect(decision.evidenceRef).toEqual(["git:status"]);
		expect(decision.meta).toMatchObject({
			frictionClass: "repo_state",
			delayClass: "human_needed",
			execution: {
				profile: "read_only",
				startupCost: "low",
				permissionPlan: {
					requiresHuman: false,
					requiresNetwork: false,
					writesFiles: false,
					commands: ["harness doctor --json"],
				},
			},
		});
	});

	it("changes recommendation posture for pr mode", () => {
		const decision = runHarnessNext({
			files: ["docs/spec.md"],
			mode: "pr",
		});

		expect(decision.status).toBe("action_required");
		expect(decision.nextAction).toBe(
			"Generate reviewer context for the changed files.",
		);
		expect(decision.nextCommand).toBe(
			"harness review-context --files docs/spec.md --json",
		);
		expect(decision.phase).toBe("review");
		expect(decision.objective).toBe(
			"Prepare reviewer-facing context for the changed files.",
		);
		expect(decision.requiredEvidence).toEqual([
			"input:files",
			"command-catalog:harness-command-catalog/v3",
			"harness review-context --files docs/spec.md --json output",
		]);
		expect(decision.followUpCommands).toEqual([
			"bash scripts/validate-codestyle.sh --fast",
		]);
		expect(decision.meta).toMatchObject({
			mode: "pr",
			sourceErrors: [
				{
					kind: "linear",
					ref: "network:linear",
					freshness: "unknown",
					sha: null,
					status: "blocked",
					failureClass: "network_unavailable",
				},
				{
					kind: "pr",
					ref: "network:github",
					freshness: "unknown",
					sha: null,
					status: "blocked",
					failureClass: "network_unavailable",
				},
			],
		});
	});

	it("carries source errors without corrupting JSON recommendations", () => {
		const decision = runHarnessNext({
			files: ["src/commands/next.ts"],
			decisionSources: [
				{
					kind: "learning",
					ref: ".harness/learnings/coderabbit.local.json",
					freshness: "missing",
					sha: null,
					status: "invalid",
					failureClass: "learning_missing",
				},
				{
					kind: "run",
					ref: ".harness/runs/stale.json",
					freshness: "stale",
					sha: "b".repeat(40),
					status: "usable",
					failureClass: "run_head_mismatch",
				},
			],
		});

		expect(decision.status).toBe("action_required");
		expect(decision.nextCommand).toBe(
			"harness validation-plan --files src/commands/next.ts --json",
		);
		expect(decision.meta).toMatchObject({
			sourceErrors: [
				{
					kind: "learning",
					status: "invalid",
					failureClass: "learning_missing",
				},
				{
					kind: "run",
					freshness: "stale",
					failureClass: "run_head_mismatch",
				},
			],
		});
	});

	it("fails closed when a required local decision source is blocked", () => {
		const decision = runHarnessNext({
			files: ["src/commands/next.ts"],
			decisionSources: [
				{
					kind: "contract",
					ref: "harness.contract.json",
					freshness: "unknown",
					sha: null,
					status: "blocked",
					failureClass: "contract_blocked",
				},
			],
		});

		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("contract_blocked");
		expect(decision.nextCommand).toBe("harness doctor --json");
		expect(decision.meta).toMatchObject({
			sourceErrors: [
				{
					kind: "contract",
					ref: "harness.contract.json",
					status: "blocked",
					failureClass: "contract_blocked",
				},
			],
		});
	});

	it("replays identical recommendations and source error ordering", () => {
		const options = {
			files: ["src/b.ts", "src/a.ts"],
			decisionSources: [
				{
					kind: "run" as const,
					ref: ".harness/runs/z.json",
					freshness: "stale" as const,
					sha: "b".repeat(40),
					status: "usable" as const,
					failureClass: "run_head_mismatch",
				},
				{
					kind: "learning" as const,
					ref: ".harness/learnings/local.json",
					freshness: "missing" as const,
					sha: null,
					status: "invalid" as const,
					failureClass: "learning_missing",
				},
			],
		};

		const first = runHarnessNext(options);
		const second = runHarnessNext(options);

		expect(second.nextCommand).toBe(first.nextCommand);
		expect(second.evidenceRef).toEqual(first.evidenceRef);
		expect(second.meta).toMatchObject({
			sourceErrors: (first.meta as { sourceErrors: unknown[] }).sourceErrors,
		});
	});

	it("recommends fleet-plan for ci mode when a matrix artifact exists", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-fleet-"));
		try {
			mkdirSync(join(repoRoot, "artifacts"), { recursive: true });
			writeFileSync(
				join(repoRoot, "artifacts/harness-upgrade-matrix-dev.json"),
				"{}",
			);

			const decision = runHarnessNext({
				mode: "ci",
				repoRoot,
				inspectChangedFiles: () => {
					throw new Error("git should not be inspected");
				},
			});

			expect(decision.status).toBe("action_required");
			expect(decision.nextCommand).toBe(
				"harness fleet-plan --from artifacts/harness-upgrade-matrix-dev.json --json",
			);
			expect(decision.phase).toBe("orient");
			expect(decision.objective).toBe(
				"Convert the detected upgrade matrix into a safe remediation plan.",
			);
			expect(decision.requiredEvidence).toEqual([
				"artifact:artifacts/harness-upgrade-matrix-dev.json",
			]);
			expect(decision.stopConditions).toEqual([
				"Stop if fleet-plan cannot parse the upgrade matrix artifact.",
			]);
			expect(decision.followUpCommands).toEqual([]);
			expect(decision.hiddenPlumbing).toEqual([
				"artifact-discovery",
				"fleet-plan",
			]);
			expect(decision.evidenceRef).toEqual([
				"artifact:artifacts/harness-upgrade-matrix-dev.json",
			]);
			expect(decision.meta).toMatchObject({
				mode: "ci",
				nextCommandArgv: [
					"harness",
					"fleet-plan",
					"--from",
					"artifacts/harness-upgrade-matrix-dev.json",
					"--json",
				],
			});
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("includes machine-safe argv and shell-safe display commands", () => {
		const decision = runHarnessNext({
			files: ["docs/My Plan.md", "src/$(bad).ts"],
			mode: "local",
		});

		expect(decision.nextCommand).toBe(
			"harness validation-plan --files 'docs/My Plan.md' 'src/$(bad).ts' --json",
		);
		expect(decision.meta).toMatchObject({
			nextCommandArgv: [
				"harness",
				"validation-plan",
				"--files",
				"docs/My Plan.md",
				"src/$(bad).ts",
				"--json",
			],
		});
	});
});

describe("runNextCLI", () => {
	it("emits a valid JSON HarnessDecision for --json without required context flags", () => {
		const { exitCode, output } = captureNextCLI(["--json"], {
			inspectChangedFiles: () => ["docs/spec.md"],
		});

		expect(exitCode).toBe(0);
		const decision = parseDecision(output);
		expect(decision.status).toBe("action_required");
		expect(decision.failureClass).toBeNull();
		expect(decision.nextCommand).toBe(
			"harness validation-plan --files docs/spec.md --json",
		);
	});

	it("emits a valid blocked decision for invalid --mode", () => {
		const { exitCode, output } = captureNextCLI(
			["--json", "--mode", "remote"],
			{},
		);

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		const directDecision = runHarnessNext({ mode: "remote" as never });
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("invalid_mode");
		expect(decision.nextAction).toBe(
			"Use --mode local, --mode pr, or --mode ci.",
		);
		expect(decision.retry).toBe("manual");
		expect(decision).toEqual(directDecision);
	});

	it("emits a usage decision for empty --files values", () => {
		const { exitCode, output } = captureNextCLI(["--json", "--files", ","], {});

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("files_override_empty");
		expect(decision.nextAction).toContain("omit --files");
	});

	it("preserves comma-containing file paths passed as one --files value", () => {
		const { exitCode, output } = captureNextCLI(
			["--json", "--files", "src/a,b.ts"],
			{},
		);

		expect(exitCode).toBe(0);
		const decision = parseDecision(output);
		expect(decision.nextCommand).toBe(
			"harness validation-plan --files src/a,b.ts --json",
		);
		expect(decision.meta).toMatchObject({
			nextCommandArgv: [
				"harness",
				"validation-plan",
				"--files",
				"src/a,b.ts",
				"--json",
			],
		});
	});

	it("rejects unknown flags before producing a recommendation", () => {
		const { exitCode, output } = captureNextCLI(["--json", "--mod", "pr"], {});

		expect(exitCode).toBe(2);
		const decision = parseDecision(output);
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("unknown_argument");
		expect(decision.meta).toMatchObject({ argument: "--mod" });
	});

	it("does not mutate files while producing a recommendation", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-"));
		const before = readdirSync(repoRoot);

		const { exitCode, output } = captureNextCLI(["--json"], {
			repoRoot,
			inspectChangedFiles: () => ["src/commands/next.ts"],
		});

		expect(exitCode).toBe(0);
		expect(parseDecision(output).writesFiles).toBe(false);
		expect(readdirSync(repoRoot)).toEqual(before);
		rmSync(repoRoot, { recursive: true, force: true });
	});
});
