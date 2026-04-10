import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMAND_SPECS } from "./command-specs.js";
import type { CommandSpec } from "./types.js";

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

	it("accepts valid actions and passes validation (does not return 2)", () => {
		const validActions = ["claim", "handoff", "close", "prepare", "sync", "triage"];
		for (const action of validActions) {
			// Valid actions pass the synchronous validation gate and delegate to the
			// real CLI (returning a Promise). A Promise is not 2.
			const result = spec.execute([action]);
			expect(result).not.toBe(2);
		}
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
		expect(spec.execute(["--type", "invalid-type", "--file", "foo.md"])).toBe(2);
	});

	it("accepts all valid --type values without returning 2 from validation", () => {
		const validTypes = ["feature", "bugfix", "refactor", "release"];
		for (const type of validTypes) {
			const result = spec.execute(["--type", type, "--file", "foo.md"]);
			expect(result).not.toBe(2);
		}
	});
});

describe("blast-radius execute validation", () => {
	const spec = findSpec("blast-radius");

	it("returns 2 when --files is missing", () => {
		expect(spec.execute(["--json"])).toBe(2);
	});

	it("does not return 2 when --files is provided", () => {
		const result = spec.execute(["--files", "src/auth.ts"]);
		expect(result).not.toBe(2);
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

	it("does not return 2 when both contract flags are provided", () => {
		const result = spec.execute(["--contract-a", "a.json", "--contract-b", "b.json"]);
		expect(result).not.toBe(2);
	});
});

describe("drift-gate execute validation", () => {
	const spec = findSpec("drift-gate");

	it("returns 2 when --mode is an invalid value", () => {
		expect(spec.execute(["--mode", "strict"])).toBe(2);
	});

	it("does not return 2 for --mode advisory", () => {
		const result = spec.execute(["--mode", "advisory"]);
		expect(result).not.toBe(2);
	});

	it("does not return 2 for --mode health", () => {
		const result = spec.execute(["--mode", "health"]);
		expect(result).not.toBe(2);
	});

	it("does not return 2 when --mode is absent", () => {
		const result = spec.execute([]);
		expect(result).not.toBe(2);
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

	it("does not return 2 for --mode autonomous", () => {
		const result = spec.execute(["--mode", "autonomous", "--incident-id", "INC-1"]);
		expect(result).not.toBe(2);
	});

	it("does not return 2 for --mode manual", () => {
		const result = spec.execute(["--mode", "manual", "--incident-id", "INC-1"]);
		expect(result).not.toBe(2);
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

	it("does not return 2 for subcommand run", () => {
		const result = spec.execute(["run"]);
		expect(result).not.toBe(2);
	});

	it("does not return 2 for subcommand apply", () => {
		const result = spec.execute(["apply"]);
		expect(result).not.toBe(2);
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

	it("does not return 2 for action open", () => {
		const result = spec.execute(["open"]);
		expect(result).not.toBe(2);
	});

	it("does not return 2 for action resolve", () => {
		const result = spec.execute(["resolve"]);
		expect(result).not.toBe(2);
	});
});

describe("branch-protect execute validation", () => {
	const spec = findSpec("branch-protect");

	it("returns 2 when --required-approvals is not a number", () => {
		expect(
			spec.execute(["--required-approvals", "not-a-number"]),
		).toBe(2);
	});

	it("accepts --required-approvals of 0 without error", () => {
		const result = spec.execute(["--required-approvals", "0"]);
		expect(result).not.toBe(2);
	});

	it("accepts --required-approvals of a positive integer", () => {
		const result = spec.execute(["--required-approvals", "2"]);
		expect(result).not.toBe(2);
	});
});

describe("policy-gate execute validation", () => {
	const spec = findSpec("policy-gate");

	it("does not return 2 with no arguments (uses defaults)", () => {
		const result = spec.execute([]);
		expect(result).not.toBe(2);
	});

	it("accepts valid --max-tier values", () => {
		for (const tier of ["high", "medium", "low"]) {
			const result = spec.execute(["--max-tier", tier]);
			expect(result).not.toBe(2);
		}
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

	it("does not return 2 when --artifacts is provided", () => {
		const result = spec.execute(["--artifacts", "artifacts/"]);
		expect(result).not.toBe(2);
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
		const filePath = join(
			process.cwd(),
			"src/lib/cli/registry/command-specs.ts",
		);
		const content = readFileSync(filePath, "utf-8");
		// Verify imports come from ../../../commands/ path
		expect(content).toMatch(/from\s+["']\.\.\/\.\.\/\.\.\/commands\//);
	});

	it("does not import from ../../commands/ (wrong relative path)", () => {
		const filePath = join(
			process.cwd(),
			"src/lib/cli/registry/command-specs.ts",
		);
		const content = readFileSync(filePath, "utf-8");
		// Two-levels-up imports would be wrong from the registry/ subfolder
		expect(content).not.toMatch(/from\s+["']\.\.\/\.\.\/commands\//);
	});

	it("only imports CommandSpec type from ./types.js (not from command-registry)", () => {
		const filePath = join(
			process.cwd(),
			"src/lib/cli/registry/command-specs.ts",
		);
		const content = readFileSync(filePath, "utf-8");
		// Verify CommandSpec is imported and not from command-registry
		expect(content).toContain("CommandSpec");
		expect(content).not.toContain('from "../command-registry');
	});

	it("imports parse-utils from ../parse-utils.js (correct relative path)", () => {
		const filePath = join(
			process.cwd(),
			"src/lib/cli/registry/command-specs.ts",
		);
		const content = readFileSync(filePath, "utf-8");
		// Verify parse-utils is imported from ../parse-utils with optional .js extension
		expect(content).toMatch(/(?:import|require)\s+.*from\s+["']\.\.\/parse-utils(?:\.js)?["']/);
	});
});

// ---------------------------------------------------------------------------
// types.ts architecture boundary test
// ---------------------------------------------------------------------------

describe("types.ts architecture boundaries", () => {
	it("has no imports (pure interface declarations)", () => {
		const filePath = join(
			process.cwd(),
			"src/lib/cli/registry/types.ts",
		);
		const content = readFileSync(filePath, "utf-8");
		// Should have no import statements
		expect(content).not.toMatch(/^import /m);
	});

	it("exports CommandSpec interface", () => {
		const filePath = join(
			process.cwd(),
			"src/lib/cli/registry/types.ts",
		);
		const content = readFileSync(filePath, "utf-8");
		expect(content).toContain("export interface CommandSpec");
	});

	it("exports RegistryDispatchResult interface", () => {
		const filePath = join(
			process.cwd(),
			"src/lib/cli/registry/types.ts",
		);
		const content = readFileSync(filePath, "utf-8");
		expect(content).toContain("export interface RegistryDispatchResult");
	});

	it("RegistryDispatchResult references CommandSpec and result type", () => {
		const filePath = join(
			process.cwd(),
			"src/lib/cli/registry/types.ts",
		);
		const content = readFileSync(filePath, "utf-8");
		// Verify the interface exists and mentions CommandSpec
		expect(content).toContain("export interface RegistryDispatchResult");
		expect(content).toContain("CommandSpec");
		// TypeScript compilation validates actual field types
	});
});