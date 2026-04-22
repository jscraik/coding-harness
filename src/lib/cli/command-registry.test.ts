import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES as LOCAL_MEMORY_PREFLIGHT_EXIT_CODES } from "../../commands/local-memory-preflight.js";
import {
	COMMAND_CATALOG_SCHEMA_VERSION,
	type CommandCapability,
	MIGRATED_COMMAND_AND_ALIAS_NAMES,
	MIGRATED_COMMAND_NAMES,
	dispatchRegistryCommand,
	fuzzyFindCommand,
	getRegistryCommandCapabilities,
	getRegistryCommandCatalogDocument,
	getRegistryCommandHelpRows,
	normalizeCommandName,
	suggestCommandCapabilities,
	suggestCommands,
} from "./command-registry.js";
import {
	compareRegistryToReadme,
	extractReadmeCommandNames,
} from "./doc-parity.js";

describe("command registry", () => {
	it("exposes migrated command names", () => {
		const capabilityNames = getRegistryCommandCapabilities().map(
			(capability) => capability.name,
		);
		expect(MIGRATED_COMMAND_NAMES).toEqual(capabilityNames);
		expect(MIGRATED_COMMAND_NAMES).toContain("commands");
		expect(MIGRATED_COMMAND_NAMES).toContain("contract");
		expect(MIGRATED_COMMAND_NAMES).not.toContain("repo");
		expect(MIGRATED_COMMAND_NAMES).not.toContain("gate");
	});

	it("dispatches commands catalog from registry", () => {
		const result = dispatchRegistryCommand("commands", ["commands", "--json"]);
		expect(result?.spec.name).toBe("commands");
		expect(result?.result).toBe(0);
	});

	it("rejects inherited-key-like unknown commands without crashing", () => {
		const inherited = Object.create({ repo: "repo" }) as { repo?: string };
		const invoke = () => dispatchRegistryCommand(inherited.repo, ["repo"]);
		expect(invoke).not.toThrow();
		expect(invoke()).toBeUndefined();
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
				requiredFlags: [],
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

	it("ensures migrated commands exist in docs command catalog", () => {
		const commandCatalogPath = join(process.cwd(), "docs/cli-reference.md");
		const commandCatalogContent = readFileSync(commandCatalogPath, "utf-8");
		const readmeCommands = extractReadmeCommandNames(commandCatalogContent);
		const result = compareRegistryToReadme(
			MIGRATED_COMMAND_NAMES,
			readmeCommands,
		);

		expect(result.missingInReadme).toEqual([]);
		expect(readmeCommands).not.toContain("repo");
		expect(readmeCommands).not.toContain("gate");
		expect(readmeCommands).not.toContain("pilot");
		expect(readmeCommands).not.toContain("work");
		expect(readmeCommands).not.toContain("ui");
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

describe("suggestCommandCapabilities", () => {
	it("returns top-3 closest capability commands by default", () => {
		const suggestions = suggestCommandCapabilities("doktor");
		expect(suggestions).toHaveLength(3);
		expect(suggestions[0]?.capability.name).toBe("doctor");
	});

	it("respects the limit parameter", () => {
		expect(suggestCommandCapabilities("blast-raduis", 2)).toHaveLength(2);
	});

	it("returns capabilities that come from the catalog document", () => {
		const catalogNames = new Set(
			getRegistryCommandCatalogDocument().commands.map(
				(capability) => capability.name,
			),
		);
		const suggestions = suggestCommandCapabilities("blast-radius-x");
		for (const { capability } of suggestions) {
			expect(catalogNames.has(capability.name)).toBe(true);
		}
	});
});

describe("COMMAND_CATALOG_SCHEMA_VERSION", () => {
	it("equals the stable literal 'harness-command-catalog/v1'", () => {
		expect(COMMAND_CATALOG_SCHEMA_VERSION).toBe("harness-command-catalog/v1");
	});
});

describe("getRegistryCommandCapabilities", () => {
	it("returns one capability per registered command", () => {
		const capabilities = getRegistryCommandCapabilities();
		expect(capabilities).toHaveLength(MIGRATED_COMMAND_NAMES.length);
	});

	it("preserves command name order matching MIGRATED_COMMAND_NAMES", () => {
		const capabilityNames = getRegistryCommandCapabilities().map((c) => c.name);
		expect(capabilityNames).toEqual(MIGRATED_COMMAND_NAMES);
	});

	it("every capability has required shape fields", () => {
		const capabilities = getRegistryCommandCapabilities();
		for (const capability of capabilities) {
			expect(typeof capability.name).toBe("string");
			expect(Array.isArray(capability.aliases)).toBe(true);
			expect(typeof capability.summary).toBe("string");
			expect(typeof capability.category).toBe("string");
			expect(typeof capability.mutability).toBe("string");
			expect(Array.isArray(capability.requiredFlags)).toBe(true);
			expect(Array.isArray(capability.expectedArtifacts)).toBe(true);
			expect(typeof capability.retryability).toBe("string");
			expect(Array.isArray(capability.safeFirstAlternatives)).toBe(true);
		}
	});

	it("capability mutability is always 'read' or 'write'", () => {
		const capabilities = getRegistryCommandCapabilities();
		for (const capability of capabilities) {
			expect(["read", "write"]).toContain(capability.mutability);
		}
	});

	it("capability retryability is always 'safe', 'conditional', or 'manual'", () => {
		const capabilities = getRegistryCommandCapabilities();
		for (const capability of capabilities) {
			expect(["safe", "conditional", "manual"]).toContain(
				capability.retryability,
			);
		}
	});

	it("capability category is one of the known union values", () => {
		const validCategories = new Set([
			"discovery",
			"bootstrap-governance",
			"review-policy",
			"workflow-linear",
			"pilot-remediation",
			"drift-search-evidence",
		]);
		const capabilities = getRegistryCommandCapabilities();
		for (const capability of capabilities) {
			expect(validCategories.has(capability.category)).toBe(true);
		}
	});

	describe("'commands' capability", () => {
		let commandsCapability: CommandCapability | undefined;
		beforeEach(() => {
			commandsCapability = getRegistryCommandCapabilities().find(
				(c) => c.name === "commands",
			);
		});

		it("has category 'discovery'", () => {
			expect(commandsCapability?.category).toBe("discovery");
		});

		it("has mutability 'read'", () => {
			expect(commandsCapability?.mutability).toBe("read");
		});

		it("has retryability 'safe'", () => {
			expect(commandsCapability?.retryability).toBe("safe");
		});

		it("exposes 'commands --json' as its example", () => {
			expect(commandsCapability?.example).toBe("commands --json");
		});

		it("has empty requiredFlags", () => {
			expect(commandsCapability?.requiredFlags).toEqual([]);
		});

		it("has empty safeFirstAlternatives", () => {
			expect(commandsCapability?.safeFirstAlternatives).toEqual([]);
		});
	});

	describe("write command mutability", () => {
		const EXPECTED_WRITE_COMMANDS = [
			"init",
			"eject",
			"upgrade",
			"ci-migrate",
			"branch-protect",
			"linear",
			"linear-gate",
			"automation-run",
			"gap-case",
			"remediate",
			"pilot-rollback",
		] as const;

		it.each(EXPECTED_WRITE_COMMANDS)(
			"'%s' has mutability 'write'",
			(commandName) => {
				const capability = getRegistryCommandCapabilities().find(
					(c) => c.name === commandName,
				);
				expect(capability?.mutability).toBe("write");
			},
		);
	});

	describe("read command mutability", () => {
		const EXPECTED_READ_COMMANDS = [
			"commands",
			"check",
			"doctor",
			"health",
			"contract",
			"policy-gate",
			"preflight-gate",
			"blast-radius",
			"risk-tier",
			"review-gate",
			"drift-gate",
			"search",
			"context",
		] as const;

		it.each(EXPECTED_READ_COMMANDS)(
			"'%s' has mutability 'read'",
			(commandName) => {
				const capability = getRegistryCommandCapabilities().find(
					(c) => c.name === commandName,
				);
				expect(capability?.mutability).toBe("read");
			},
		);
	});

	describe("required flags", () => {
		it("policy-gate has no required flags", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "policy-gate",
			);
			expect(cap?.requiredFlags).toEqual([]);
		});

		it("preflight-gate has no required flags", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "preflight-gate",
			);
			expect(cap?.requiredFlags).toEqual([]);
		});

		it("risk-tier has no required flags", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "risk-tier",
			);
			expect(cap?.requiredFlags).toEqual([]);
		});

		it("blast-radius requires --files", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "blast-radius",
			);
			expect(cap?.requiredFlags).toEqual(["--files"]);
		});

		it("review-gate requires multiple flags", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "review-gate",
			);
			expect(cap?.requiredFlags).toEqual([
				"--token",
				"--owner",
				"--repo",
				"--pr",
				"--sha",
			]);
		});

		it("workflow:generate requires --source", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "workflow:generate",
			);
			expect(cap?.requiredFlags).toEqual(["--source"]);
		});

		it("linear-gate requires branch, pr-title, and pr-body flags", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "linear-gate",
			);
			expect(cap?.requiredFlags).toEqual([
				"--branch",
				"--pr-title",
				"--pr-body",
			]);
		});

		it("commands has empty requiredFlags", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "commands",
			);
			expect(cap?.requiredFlags).toEqual([]);
		});

		it("doctor has empty requiredFlags", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "doctor",
			);
			expect(cap?.requiredFlags).toEqual([]);
		});
	});

	describe("expected artifacts", () => {
		it("check-environment declares environment-attestation artifact", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "check-environment",
			);
			expect(cap?.expectedArtifacts).toEqual([
				"artifacts/policy/environment-attestation.json",
			]);
		});

		it("context-health declares index-source-inventory artifact", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "context-health",
			);
			expect(cap?.expectedArtifacts).toEqual([
				"artifacts/context-integrity/index-source-inventory.json",
			]);
		});

		it("ci-migrate declares ci-provider-transition-status artifact", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "ci-migrate",
			);
			expect(cap?.expectedArtifacts).toEqual([
				".harness/ci-provider-transition-status.json",
			]);
		});

		it("policy-gate has empty expectedArtifacts", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "policy-gate",
			);
			expect(cap?.expectedArtifacts).toEqual([]);
		});
	});

	describe("retryability overrides", () => {
		it("automation-run has retryability 'manual'", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "automation-run",
			);
			expect(cap?.retryability).toBe("manual");
		});

		it("pilot-rollback has retryability 'manual'", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "pilot-rollback",
			);
			expect(cap?.retryability).toBe("manual");
		});

		it("branch-protect has retryability 'manual'", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "branch-protect",
			);
			expect(cap?.retryability).toBe("manual");
		});

		it("index-context has retryability 'conditional'", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "index-context",
			);
			expect(cap?.retryability).toBe("conditional");
		});

		it("check has explicit retryability 'safe'", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "check",
			);
			expect(cap?.retryability).toBe("safe");
		});

		it("local-memory-preflight has explicit retryability 'safe'", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "local-memory-preflight",
			);
			expect(cap?.retryability).toBe("safe");
		});

		it("read-only commands without explicit override default to 'safe'", () => {
			// drift-gate is read, has no explicit override
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "drift-gate",
			);
			expect(cap?.mutability).toBe("read");
			expect(cap?.retryability).toBe("safe");
		});

		it("write commands without explicit override default to 'conditional'", () => {
			// eject is write, has no explicit override
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "eject",
			);
			expect(cap?.mutability).toBe("write");
			expect(cap?.retryability).toBe("conditional");
		});
	});

	describe("safe-first alternatives", () => {
		it("init has dry-run and check alternatives", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "init",
			);
			expect(cap?.safeFirstAlternatives).toEqual([
				"init --dry-run",
				"check --json",
			]);
		});

		it("upgrade has dry-run and contract-validate alternatives", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "upgrade",
			);
			expect(cap?.safeFirstAlternatives).toEqual([
				"upgrade --dry-run",
				"contract validate --json",
			]);
		});

		it("ci-migrate has prepare dry-run alternative", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "ci-migrate",
			);
			expect(cap?.safeFirstAlternatives).toEqual([
				"ci-migrate prepare --dry-run --json",
			]);
		});

		it("remediate has run alternative", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "remediate",
			);
			expect(cap?.safeFirstAlternatives).toEqual(["remediate run --json"]);
		});

		it("linear has prepare and triage alternatives", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "linear",
			);
			expect(cap?.safeFirstAlternatives).toEqual([
				"linear prepare --issue <KEY>",
				"linear triage --dry-run --json",
			]);
		});

		it("pilot-rollback has pilot-evaluate alternative", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "pilot-rollback",
			);
			expect(cap?.safeFirstAlternatives).toEqual([
				"pilot-evaluate --artifacts <PATH> --json",
			]);
		});

		it("automation-run has check alternative", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "automation-run",
			);
			expect(cap?.safeFirstAlternatives).toEqual(["check --json"]);
		});

		it("commands has no safe-first alternatives", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "commands",
			);
			expect(cap?.safeFirstAlternatives).toEqual([]);
		});

		it("policy-gate has no safe-first alternatives", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "policy-gate",
			);
			expect(cap?.safeFirstAlternatives).toEqual([]);
		});
	});

	describe("category assignments", () => {
		const CATEGORY_CASES: Array<[string, string]> = [
			["commands", "discovery"],
			["init", "bootstrap-governance"],
			["eject", "bootstrap-governance"],
			["check", "bootstrap-governance"],
			["doctor", "bootstrap-governance"],
			["health", "bootstrap-governance"],
			["contract", "bootstrap-governance"],
			["upgrade", "bootstrap-governance"],
			["ci-migrate", "bootstrap-governance"],
			["branch-protect", "bootstrap-governance"],
			["verify-work", "bootstrap-governance"],
			["verify-coderabbit", "bootstrap-governance"],
			["preset", "bootstrap-governance"],
			["symphony-check", "bootstrap-governance"],
			["policy-gate", "review-policy"],
			["preflight-gate", "review-policy"],
			["review-gate", "review-policy"],
			["docs-gate", "review-policy"],
			["plan-gate", "review-policy"],
			["brainstorm-gate", "review-policy"],
			["prompt-gate", "review-policy"],
			["pr-template-gate", "review-policy"],
			["license-gate", "review-policy"],
			["check-authz", "review-policy"],
			["check-environment", "review-policy"],
			["local-memory-preflight", "review-policy"],
			["blast-radius", "review-policy"],
			["risk-tier", "review-policy"],
			["diff-budget", "review-policy"],
			["observability-gate", "review-policy"],
			["silent-error", "review-policy"],
			["memory-gate", "review-policy"],
			["linear", "workflow-linear"],
			["linear-gate", "workflow-linear"],
			["workflow:generate", "workflow-linear"],
			["pilot-evaluate", "pilot-remediation"],
			["pilot-rollback", "pilot-remediation"],
			["simulate", "pilot-remediation"],
			["automation-run", "pilot-remediation"],
			["gap-case", "pilot-remediation"],
			["remediate", "pilot-remediation"],
			["replay", "pilot-remediation"],
			["drift-gate", "drift-search-evidence"],
			["org-audit", "drift-search-evidence"],
			["tooling-audit", "drift-search-evidence"],
			["gardener", "drift-search-evidence"],
			["context-health", "drift-search-evidence"],
			["search", "drift-search-evidence"],
			["context", "drift-search-evidence"],
			["index-context", "drift-search-evidence"],
			["evidence-verify", "drift-search-evidence"],
			["ui:fast", "drift-search-evidence"],
			["ui:verify", "drift-search-evidence"],
			["ui:explore", "drift-search-evidence"],
		];

		it.each(CATEGORY_CASES)(
			"'%s' has category '%s'",
			(commandName, expectedCategory) => {
				const cap = getRegistryCommandCapabilities().find(
					(c) => c.name === commandName,
				);
				expect(cap?.category).toBe(expectedCategory);
			},
		);
	});

	describe("capability example field", () => {
		it("'commands' capability includes example", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "commands",
			);
			expect(cap).toBeDefined();
			expect(Object.hasOwn(cap!, "example")).toBe(true);
			expect(cap?.example).toBe("commands --json");
		});

		it("aliases array is always present and is an array", () => {
			const capabilities = getRegistryCommandCapabilities();
			for (const cap of capabilities) {
				expect(Array.isArray(cap.aliases)).toBe(true);
			}
		});

		it("'policy-gate' aliases include 'risk-policy-gate'", () => {
			const cap = getRegistryCommandCapabilities().find(
				(c) => c.name === "policy-gate",
			);
			expect(cap?.aliases).toContain("risk-policy-gate");
		});
	});
});

describe("'commands' command execution", () => {
	it("non-JSON mode prints catalog header and hint, returns 0", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const dispatch = dispatchRegistryCommand("commands", ["commands"]);
			expect(dispatch?.result).toBe(0);
			const calls = infoSpy.mock.calls.map((c) => String(c[0]));
			expect(calls[0]).toBe("Command capability catalog:");
			const lastMeaningfulCall = calls.at(-1);
			expect(lastMeaningfulCall).toContain("harness commands --json");
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("non-JSON mode prints a row for each capability", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			dispatchRegistryCommand("commands", ["commands"]);
			const capabilities = getRegistryCommandCapabilities();
			// header + N capability rows + empty line + hint = N + 3
			expect(infoSpy.mock.calls.length).toBe(capabilities.length + 3);
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("JSON mode catalog document has valid ISO 8601 generatedAt", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			dispatchRegistryCommand("commands", ["commands", "--json"]);
			const output = infoSpy.mock.calls.at(-1)?.[0];
			const parsed = JSON.parse(String(output));
			const date = new Date(parsed.generatedAt as string);
			expect(date.toISOString()).toBe(parsed.generatedAt);
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("JSON mode commandCount matches commands array length", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			dispatchRegistryCommand("commands", ["commands", "--json"]);
			const output = infoSpy.mock.calls.at(-1)?.[0];
			const parsed = JSON.parse(String(output));
			expect(parsed.commandCount).toBe((parsed.commands as unknown[]).length);
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("JSON mode output is a single console.info call (no extra output)", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			dispatchRegistryCommand("commands", ["commands", "--json"]);
			expect(infoSpy.mock.calls).toHaveLength(1);
		} finally {
			infoSpy.mockRestore();
		}
	});
});

describe("getRegistryCommandHelpRows (updated)", () => {
	it("returns same names as getRegistryCommandCapabilities", () => {
		const helpRows = getRegistryCommandHelpRows();
		const capabilities = getRegistryCommandCapabilities();
		expect(helpRows.map((r) => r.name)).toEqual(
			capabilities.map((c) => c.name),
		);
	});

	it("returns same summaries as getRegistryCommandCapabilities", () => {
		const helpRows = getRegistryCommandHelpRows();
		const capabilities = getRegistryCommandCapabilities();
		expect(helpRows.map((r) => r.summary)).toEqual(
			capabilities.map((c) => c.summary),
		);
	});

	it("includeLegacy option appends alias rows for full help output", () => {
		const withLegacy = getRegistryCommandHelpRows({ includeLegacy: true });
		const withoutLegacy = getRegistryCommandHelpRows({ includeLegacy: false });
		const defaults = getRegistryCommandHelpRows();
		expect(withoutLegacy.map((r) => r.name)).toEqual(
			defaults.map((r) => r.name),
		);
		expect(withLegacy.length).toBeGreaterThan(withoutLegacy.length);
		expect(withLegacy.map((r) => r.name)).toContain("risk-policy-gate");
	});

	it("does not include legacy grouped commands like 'repo' or 'gate'", () => {
		const names = new Set(getRegistryCommandHelpRows().map((r) => r.name));
		expect(names.has("repo")).toBe(false);
		expect(names.has("gate")).toBe(false);
		expect(names.has("work")).toBe(false);
		expect(names.has("ui")).toBe(false);
		expect(names.has("pilot")).toBe(false);
	});

	it("includes 'commands' in help rows", () => {
		const names = getRegistryCommandHelpRows().map((r) => r.name);
		expect(names).toContain("commands");
	});
});

describe("command-registry.ts architecture boundaries", () => {
	it("keeps command wiring concentrated in extracted modules", () => {
		const filePath = join(process.cwd(), "src/lib/cli/command-registry.ts");
		const content = readFileSync(filePath, "utf-8");

		expect(content).toContain("...EXTRACTED_COMMAND_SPECS");
		expect(content).not.toMatch(/from\s+["']\.\.\/\.\.\/commands\//);
		expect(content).not.toMatch(/run[A-Z].*CLI/);
	});
});
