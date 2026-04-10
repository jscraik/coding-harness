import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { EXIT_CODES as LOCAL_MEMORY_PREFLIGHT_EXIT_CODES } from "../../commands/local-memory-preflight.js";
import {
	COMMAND_CATALOG_SCHEMA_VERSION,
	MIGRATED_COMMAND_AND_ALIAS_NAMES,
	MIGRATED_COMMAND_NAMES,
	dispatchRegistryCommand,
	fuzzyFindCommand,
	getRegistryCommandCapabilities,
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
			"commands",
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

	it("exposes a stable machine-readable command capability catalog", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const dispatch = dispatchRegistryCommand("commands", [
				"commands",
				"--json",
			]);
			expect(dispatch?.result).toBe(0);

			const output = infoSpy.mock.calls.at(-1)?.[0];
			expect(typeof output).toBe("string");
			const parsed = JSON.parse(String(output));
			expect(parsed.schemaVersion).toBe(COMMAND_CATALOG_SCHEMA_VERSION);
			expect(parsed.commandCount).toBe(MIGRATED_COMMAND_NAMES.length);
			expect(Array.isArray(parsed.commands)).toBe(true);

			const policyGate = parsed.commands.find(
				(item: { name: string }) => item.name === "policy-gate",
			);
			expect(policyGate).toBeDefined();
			expect(policyGate).toMatchObject({
				category: "review-policy",
				mutability: "read",
				requiredFlags: ["--files"],
			});
			expect(Array.isArray(policyGate.expectedArtifacts)).toBe(true);
			expect(typeof policyGate.retryability).toBe("string");
			expect(Array.isArray(policyGate.safeFirstAlternatives)).toBe(true);
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("derives help rows from the capability catalog", () => {
		const helpRows = getRegistryCommandHelpRows();
		const capabilities = getRegistryCommandCapabilities();
		expect(helpRows.map((row) => row.name)).toEqual(
			capabilities.map((capability) => capability.name),
		);
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