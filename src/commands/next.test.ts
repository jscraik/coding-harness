import { mkdirSync, readdirSync } from "node:fs";
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
		expect(decision.meta).toMatchObject({ mode: "pr" });
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
		expect(decision.status).toBe("blocked");
		expect(decision.failureClass).toBe("invalid_mode");
		expect(decision.nextAction).toBe(
			"Use --mode local, --mode pr, or --mode ci.",
		);
		expect(decision.retry).toBe("manual");
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
		const repoRoot = join(tmpdir(), `harness-next-${Date.now()}`);
		mkdirSync(repoRoot);
		const before = readdirSync(repoRoot);

		const { exitCode, output } = captureNextCLI(["--json"], {
			repoRoot,
			inspectChangedFiles: () => ["src/commands/next.ts"],
		});

		expect(exitCode).toBe(0);
		expect(parseDecision(output).writesFiles).toBe(false);
		expect(readdirSync(repoRoot)).toEqual(before);
	});
});
