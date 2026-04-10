import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT_CODES as LOCAL_MEMORY_PREFLIGHT_EXIT_CODES } from "../../commands/local-memory-preflight.js";
import {
	MIGRATED_COMMAND_AND_ALIAS_NAMES,
	MIGRATED_COMMAND_NAMES,
	dispatchRegistryCommand,
	fuzzyFindCommand,
	getRegistryCommandHelpRows,
	normalizeCommandName,
	suggestCommands,
} from "./command-registry.js";
import {
	compareRegistryToReadme,
	extractReadmeCommandNames,
} from "./doc-parity.js";

describe("command registry", () => {
	it("exposes migrated command names", () => {
		expect(MIGRATED_COMMAND_NAMES).toEqual([
			"repo",
			"gate",
			"work",
			"ui",
			"pilot",
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
		]);
	});

	it("routes grouped gate action to legacy gate implementation", () => {
		const result = dispatchRegistryCommand("gate", [
			"gate",
			"policy",
			"--json",
		]);
		expect(result?.spec.name).toBe("gate");
	});

	it("routes grouped repo action to legacy repo implementation", () => {
		const result = dispatchRegistryCommand("repo", [
			"repo",
			"contract",
			"validate",
			"--json",
		]);
		expect(result?.spec.name).toBe("repo");
	});

	it("rejects inherited-key grouped actions without crashing", () => {
		const invoke = () => dispatchRegistryCommand("repo", ["repo", "toString"]);
		expect(invoke).not.toThrow();
		expect(invoke()?.result).toBe(2);
	});

	it("resolves alias to policy-gate spec", () => {
		const result = dispatchRegistryCommand("risk-policy-gate", []);
		expect(result?.spec.name).toBe("policy-gate");
	});

	it("resolves symphony:check alias to symphony-check spec", () => {
		const result = dispatchRegistryCommand("symphony:check", []);
		expect(result?.spec.name).toBe("symphony-check");
	});

	it("resolves workflow-generate alias to workflow:generate spec", () => {
		const result = dispatchRegistryCommand("workflow-generate", []);
		expect(result?.spec.name).toBe("workflow:generate");
	});

	it("exposes migrated aliases alongside canonical command names", () => {
		expect(MIGRATED_COMMAND_AND_ALIAS_NAMES).toContain("risk-policy-gate");
		expect(MIGRATED_COMMAND_AND_ALIAS_NAMES).toContain("policy-gate");
		expect(MIGRATED_COMMAND_AND_ALIAS_NAMES).toContain("pr-template-check");
		expect(MIGRATED_COMMAND_AND_ALIAS_NAMES).toContain("pr-template-gate");
		expect(MIGRATED_COMMAND_AND_ALIAS_NAMES).toContain("symphony:check");
		expect(MIGRATED_COMMAND_AND_ALIAS_NAMES).toContain("symphony-check");
		expect(MIGRATED_COMMAND_AND_ALIAS_NAMES).toContain("workflow-generate");
		expect(MIGRATED_COMMAND_AND_ALIAS_NAMES).toContain("workflow:generate");
	});

	it("returns undefined for unknown commands", () => {
		expect(dispatchRegistryCommand("unknown", [])).toBeUndefined();
	});

	it("rejects local-memory-preflight when --config is missing a value", () => {
		const result = dispatchRegistryCommand("local-memory-preflight", [
			"local-memory-preflight",
			"--config",
			"--json",
		]);
		expect(result?.result).toBe(LOCAL_MEMORY_PREFLIGHT_EXIT_CODES.USAGE_ERROR);
	});

	it("rejects local-memory-preflight when --daemon-log is missing a value", () => {
		const result = dispatchRegistryCommand("local-memory-preflight", [
			"local-memory-preflight",
			"--daemon-log",
			"--json",
		]);
		expect(result?.result).toBe(LOCAL_MEMORY_PREFLIGHT_EXIT_CODES.USAGE_ERROR);
	});

	it("rejects verify-work when --resume-from is missing a value", () => {
		const result = dispatchRegistryCommand("verify-work", [
			"verify-work",
			"--resume-from",
			"--fast",
		]);
		expect(result?.result).toBe(2);
	});

	it("rejects verify-work when --repo-root is missing a value", () => {
		const result = dispatchRegistryCommand("verify-work", [
			"verify-work",
			"--repo-root",
			"--fast",
		]);
		expect(result?.result).toBe(2);
	});

	it("provides unique help rows", () => {
		const names = getRegistryCommandHelpRows().map((row) => row.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("shows focused help rows by default and legacy rows on demand", () => {
		const focusedNames = new Set(
			getRegistryCommandHelpRows().map((row) => row.name),
		);
		expect(focusedNames.has("repo")).toBe(true);
		expect(focusedNames.has("gate")).toBe(true);
		expect(focusedNames.has("check")).toBe(false);
		expect(focusedNames.has("policy-gate")).toBe(false);

		const fullNames = new Set(
			getRegistryCommandHelpRows({ includeLegacy: true }).map(
				(row) => row.name,
			),
		);
		expect(fullNames.has("check")).toBe(true);
		expect(fullNames.has("policy-gate")).toBe(true);
	});

	it("ensures migrated commands exist in README command index", () => {
		const readmePath = join(process.cwd(), "README.md");
		const readmeContent = readFileSync(readmePath, "utf-8");
		const readmeCommands = extractReadmeCommandNames(readmeContent);
		const result = compareRegistryToReadme(
			MIGRATED_COMMAND_NAMES,
			readmeCommands,
		);

		expect(result.missingInReadme).toEqual([]);
	});
});

describe("normalizeCommandName", () => {
	it("converts camelCase to kebab-case", () => {
		expect(normalizeCommandName("blastRadius")).toBe("blast-radius");
		expect(normalizeCommandName("riskTier")).toBe("risk-tier");
	});

	it("converts snake_case to kebab-case", () => {
		expect(normalizeCommandName("blast_radius")).toBe("blast-radius");
	});

	it("lowercases uppercase", () => {
		expect(normalizeCommandName("DOCTOR")).toBe("doctor");
	});

	it("leaves valid kebab-case unchanged", () => {
		expect(normalizeCommandName("blast-radius")).toBe("blast-radius");
		expect(normalizeCommandName("workflow:generate")).toBe("workflow:generate");
	});
});

describe("fuzzyFindCommand", () => {
	it("returns undefined for exact canonical names", () => {
		expect(fuzzyFindCommand("blast-radius")).toBeUndefined();
	});

	it("resolves camelCase variant with normalized confidence", () => {
		const result = fuzzyFindCommand("blastRadius");
		expect(result?.spec.name).toBe("blast-radius");
		expect(result?.confidence).toBe("normalized");
	});

	it("resolves snake_case variant with normalized confidence", () => {
		const result = fuzzyFindCommand("blast_radius");
		expect(result?.spec.name).toBe("blast-radius");
		expect(result?.confidence).toBe("normalized");
	});

	it("resolves single-character typo with near confidence", () => {
		const result = fuzzyFindCommand("dotor");
		expect(result?.spec.name).toBe("doctor");
		expect(result?.confidence).toBe("near");
	});

	it("resolves single-character typo in long command name", () => {
		expect(fuzzyFindCommand("blast-raduis")?.spec.name).toBe("blast-radius");
	});

	it("returns undefined for completely unrelated input", () => {
		expect(
			fuzzyFindCommand("xyzzy-nonexistent-totally-random"),
		).toBeUndefined();
	});
});

describe("suggestCommands", () => {
	it("returns top-3 closest commands by default", () => {
		const suggestions = suggestCommands("doktor");
		expect(suggestions).toHaveLength(3);
		expect(suggestions[0]?.spec.name).toBe("doctor");
	});

	it("respects the limit parameter", () => {
		expect(suggestCommands("blast-raduis", 2)).toHaveLength(2);
	});

	it("returns results sorted by ascending edit distance", () => {
		const suggestions = suggestCommands("blast-radius-x");
		const distances = suggestions.map((s) => s.distance);
		expect(distances).toEqual([...distances].sort((a, b) => a - b));
	});
});

describe("command registry architecture boundaries", () => {
	it("keeps command-registry loader small and free of direct command imports", () => {
		const registryPath = join(process.cwd(), "src/lib/cli/command-registry.ts");
		const content = readFileSync(registryPath, "utf-8");
		const lineCount = content.split("\n").length;
		expect(lineCount).toBeLessThanOrEqual(300);
		expect(content).not.toContain("../../commands/");
	});

	it("ensures command-registry imports only from registry folder", () => {
		const registryPath = join(
			process.cwd(),
			"src/lib/cli/command-registry.ts",
		);
		const content = readFileSync(registryPath, "utf-8");
		// Verify registry imports come from registry/ folder
		expect(content).toMatch(/import.*from\s+["']\.\/registry\//);
		// Verify no direct imports from commands folder
		expect(content).not.toContain("../../commands/");
		// Verify no runtime helpers like fuzzyFindCommand or dispatchRegistryCommand in imports
		expect(content).not.toContain('from "./fuzzy-find-command');
		expect(content).not.toContain('from "./dispatch-registry-command');
	});
});