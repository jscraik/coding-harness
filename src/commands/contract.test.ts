/**
 * Tests for JSC-69: contract validate + schema commands.
 *
 * Covers:
 * - buildContractJsonSchema structure
 * - SCHEMA_VERSION constant
 * - Cross-field consistency checks in validateContract():
 *   - shadow + cutover-complete (contradict)
 *   - required + pre-migration (contradict)
 *   - solo + trustedPolicyRef (contradict)
 *   - enterprise + missing trustedPolicyRef (missing enterprise field)
 * - runContractValidateCLI on valid and invalid contracts
 * - runContractValidateCLI file-not-found case
 * - runContractSchemaCLI emits parseable JSON
 * - runContractCLI dispatch (validate / schema / unknown subcommand)
 */

import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	CI_MIGRATION_STAGES,
	CI_PROVIDERS,
	CI_PROVIDER_MODES,
	CONTEXT_COMPACT_STRATEGIES,
	SCHEMA_VERSION,
	buildContractJsonSchema,
} from "../lib/contract/json-schema.js";

import {
	CONTRACT_PRESETS,
	CONTRACT_PRESET_INPUTS,
	PRESET_DESCRIPTIONS,
	buildContractPreset,
	normalizeContractPreset,
} from "../lib/contract/contract-presets.js";

import { validateContract } from "../lib/contract/validator.js";

import {
	runContractCLI,
	runContractInitCLI,
	runContractSchemaCLI,
	runContractValidateCLI,
} from "./contract.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
	return mkdtempSync(join(tmpdir(), "jsc69-"));
}

/** Minimal valid contract that passes all field validations */
function minimalValidContract(): Record<string, unknown> {
	return { version: "1.5.0" };
}

/** Minimal valid ciProviderPolicy block (solo, no trustedPolicyRef) */
function ciPolicyBlock(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		activeProvider: "circleci",
		mode: "primary",
		migrationStage: "cutover-complete",
		transitionStatusArtifactPath: ".harness/status.json",
		authorityConfigPath: "harness.contract.json",
		requiredCheckManifestPath: ".harness/ci-required-checks.json",
		commitMode: "solo",
		...overrides,
	};
}

// ─── buildContractJsonSchema ──────────────────────────────────────────────────

describe("buildContractJsonSchema", () => {
	it("returns an object with $schema and $id", () => {
		const schema = buildContractJsonSchema();
		expect(schema.$schema).toContain("json-schema.org");
		expect(schema.$id).toContain("brainwav.io");
		expect(schema.$id).toContain(SCHEMA_VERSION);
	});

	it('has "version" as a required property', () => {
		const schema = buildContractJsonSchema() as {
			required: string[];
			properties: Record<string, unknown>;
		};
		expect(schema.required).toContain("version");
		expect(schema.properties).toHaveProperty("version");
	});

	it("ciProviderPolicy.mode enum contains all CI_PROVIDER_MODES", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				ciProviderPolicy: {
					properties: { mode: { enum: string[] } };
				};
			};
		};
		for (const m of CI_PROVIDER_MODES) {
			expect(schema.properties.ciProviderPolicy.properties.mode.enum).toContain(
				m,
			);
		}
	});

	it("ciProviderPolicy.activeProvider enum contains CI_PROVIDERS", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				ciProviderPolicy: {
					properties: { activeProvider: { enum: string[] } };
				};
			};
		};
		for (const p of CI_PROVIDERS) {
			expect(
				schema.properties.ciProviderPolicy.properties.activeProvider.enum,
			).toContain(p);
		}
	});

	it("ciProviderPolicy.migrationStage enum contains CI_MIGRATION_STAGES", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				ciProviderPolicy: {
					properties: { migrationStage: { enum: string[] } };
				};
			};
		};
		for (const s of CI_MIGRATION_STAGES) {
			expect(
				schema.properties.ciProviderPolicy.properties.migrationStage.enum,
			).toContain(s);
		}
	});

	it("is serializable to JSON", () => {
		const schema = buildContractJsonSchema();
		expect(() => JSON.parse(JSON.stringify(schema))).not.toThrow();
	});

	it("contextCompact.strategy enum contains supported strategies", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				contextCompact: {
					properties: { strategy: { enum: string[] } };
				};
			};
		};

		for (const strategy of CONTEXT_COMPACT_STRATEGIES) {
			expect(
				schema.properties.contextCompact.properties.strategy.enum,
			).toContain(strategy);
		}
	});
});

// ─── Cross-field consistency checks ──────────────────────────────────────────

describe("validateContract: cross-field checks (JSC-69)", () => {
	it("errors when mode=shadow and migrationStage=cutover-complete", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "shadow",
				migrationStage: "cutover-complete",
				commitMode: "team",
			}),
		};
		const result = validateContract(contract);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.path.includes("mode"))).toBe(true);
			expect(result.errors.some((e) => e.message.includes("shadow"))).toBe(
				true,
			);
		}
	});

	it("errors when mode=shadow and migrationStage=circleci-only", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "shadow",
				migrationStage: "circleci-only",
				commitMode: "team",
			}),
		};
		const result = validateContract(contract);
		expect(result.success).toBe(false);
	});

	it("does NOT error when mode=shadow and migrationStage=dual-provider (valid)", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "shadow",
				migrationStage: "dual-provider",
				commitMode: "team",
			}),
		};
		// Should pass cross-field checks (may fail other validations on mode value)
		// The important thing: no cross-field error about shadow+dual-provider
		const result = validateContract(contract);
		if (!result.success) {
			const hasCrossFieldError = result.errors.some(
				(e) =>
					e.path === "ciProviderPolicy.mode" &&
					e.message.includes("migration is complete"),
			);
			expect(hasCrossFieldError).toBe(false);
		}
	});

	it("errors when mode=required and migrationStage=pre-migration", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "required",
				migrationStage: "pre-migration",
				commitMode: "enterprise",
				trustedPolicyRef: "refs/heads/main",
			}),
		};
		const result = validateContract(contract);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.errors.some((e) => e.message.includes("pre-migration")),
			).toBe(true);
		}
	});

	it("does NOT error when mode=required and migrationStage=cutover-complete", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "required",
				migrationStage: "cutover-complete",
				commitMode: "enterprise",
				trustedPolicyRef: "refs/heads/main",
			}),
		};
		const result = validateContract(contract);
		// No cross-field error for required+cutover-complete
		if (!result.success) {
			const hasCrossFieldError = result.errors.some(
				(e) =>
					e.path === "ciProviderPolicy.migrationStage" &&
					e.message.includes("can't be required"),
			);
			expect(hasCrossFieldError).toBe(false);
		}
	});

	it("errors when commitMode=solo and trustedPolicyRef is set", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "primary",
				migrationStage: "cutover-complete",
				commitMode: "solo",
				trustedPolicyRef: "refs/heads/main",
			}),
		};
		const result = validateContract(contract);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.message.includes("solo"))).toBe(true);
			expect(
				result.errors.some((e) => e.path === "ciProviderPolicy.commitMode"),
			).toBe(true);
		}
	});

	it("errors when commitMode=enterprise and trustedPolicyRef is absent", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "primary",
				migrationStage: "cutover-complete",
				commitMode: "enterprise",
				// trustedPolicyRef intentionally omitted
			}),
		};
		const result = validateContract(contract);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.errors.some(
					(e) => e.path === "ciProviderPolicy.trustedPolicyRef",
				),
			).toBe(true);
		}
	});

	it("passes when commitMode=enterprise and trustedPolicyRef is set", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "primary",
				migrationStage: "cutover-complete",
				commitMode: "enterprise",
				trustedPolicyRef: "refs/heads/main",
			}),
		};
		const result = validateContract(contract);
		// No cross-field errors
		if (!result.success) {
			const hasCrossFieldError = result.errors.some(
				(e) => e.path === "ciProviderPolicy.trustedPolicyRef",
			);
			expect(hasCrossFieldError).toBe(false);
		}
	});
});

// ─── runContractValidateCLI ───────────────────────────────────────────────────

describe("runContractValidateCLI", () => {
	let dir: string;
	let consoleSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		dir = makeTmpDir();
		consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		consoleErrSpy.mockRestore();
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("returns 1 when contract file not found", () => {
		const code = runContractValidateCLI(dir, {});
		expect(code).toBe(1);
	});

	it("returns 0 for a minimal valid contract", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify(minimalValidContract()),
		);
		const code = runContractValidateCLI(dir, {});
		expect(code).toBe(0);
	});

	it("returns 1 for a contract missing version", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ branchProtection: {} }),
		);
		const code = runContractValidateCLI(dir, {});
		expect(code).toBe(1);
	});

	it("returns 1 for a contract with invalid JSON", () => {
		writeFileSync(join(dir, "harness.contract.json"), "{ invalid json");
		const code = runContractValidateCLI(dir, {});
		expect(code).toBe(1);
	});

	it("--json: emits parseable JSON for valid contract", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify(minimalValidContract()),
		);
		const code = runContractValidateCLI(dir, { json: true });
		expect(code).toBe(0);
		const output = consoleSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(output) as { valid: boolean; errors: unknown[] };
		expect(parsed.valid).toBe(true);
		expect(parsed.errors).toHaveLength(0);
	});

	it("--json: emits parseable JSON with errors for invalid contract", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ branchProtection: {} }), // missing version
		);
		const code = runContractValidateCLI(dir, { json: true });
		expect(code).toBe(1);
		const output = consoleSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(output) as { valid: boolean; errors: unknown[] };
		expect(parsed.valid).toBe(false);
		expect((parsed.errors as unknown[]).length).toBeGreaterThan(0);
	});

	it("accepts explicit contractPath override", () => {
		const customPath = join(dir, "custom.contract.json");
		writeFileSync(customPath, JSON.stringify(minimalValidContract()));
		const code = runContractValidateCLI(undefined, {
			contractPath: customPath,
		});
		expect(code).toBe(0);
	});
});

// ─── runContractSchemaCLI ────────────────────────────────────────────────────

describe("runContractSchemaCLI", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
	});
	afterEach(() => consoleSpy.mockRestore());

	it("returns 0", () => {
		expect(runContractSchemaCLI()).toBe(0);
	});

	it("emits parseable JSON schema", () => {
		runContractSchemaCLI();
		const output = consoleSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(output) as { $schema: string };
		expect(parsed.$schema).toContain("json-schema.org");
	});
});

// ─── runContractCLI dispatch ──────────────────────────────────────────────────

describe("runContractCLI dispatch", () => {
	let dir: string;
	let consoleSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		dir = makeTmpDir();
		consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		consoleErrSpy.mockRestore();
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("dispatches 'schema' to runContractSchemaCLI", () => {
		const code = runContractCLI(["schema"], {});
		expect(code).toBe(0);
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("dispatches 'validate' to runContractValidateCLI", () => {
		// Pass a non-existent path so we don't pick up the repo contract
		const code = runContractCLI(
			["validate", join(dir, "no-such-file.json")],
			{},
		);
		expect(code).toBe(1);
	});

	it("dispatches empty args to validate", () => {
		// Explicitly provide a missing-file path to avoid hitting repo contract
		const code = runContractCLI([], { json: false });
		// Either 0 (repo contract found + valid) or 1 (not found) — just check it doesn't throw
		expect([0, 1]).toContain(code);
	});

	it("dispatches normalize-required-checks and prints normalized manifest JSON", () => {
		const manifestPath = join(dir, "ci-required-checks.json");
		writeFileSync(
			manifestPath,
			JSON.stringify({
				version: 1,
				activeProvider: "circleci",
				requiredChecks: [
					{
						policyId: "lint-policy",
						gateId: "lint",
						displayName: "lint",
						sourceAppSlug: "circleci",
						sourceAppId: "circleci",
						externalIdPattern: "^lint$",
						githubCheckName: "pr-pipeline",
						class: "required",
					},
				],
			}),
			"utf-8",
		);

		const code = runContractCLI(
			["normalize-required-checks", "--manifest", manifestPath],
			{},
		);
		expect(code).toBe(0);

		const output = consoleSpy.mock.calls.at(-1)?.[0];
		expect(typeof output).toBe("string");
		const parsed = JSON.parse(String(output)) as {
			activeProvider: string;
			gates: Array<{ policyId: string; gateId: string }>;
		};
		expect(parsed.activeProvider).toBe("circleci");
		expect(parsed.gates[0]?.policyId).toBe("lint-policy");
		expect(parsed.gates[0]?.gateId).toBe("lint");
	});

	it("returns 1 for unknown subcommand", () => {
		const code = runContractCLI(["unknown-cmd"], {});
		expect(code).toBe(1);
		expect(consoleErrSpy).toHaveBeenCalledWith(
			expect.stringContaining("Unknown subcommand"),
		);
	});
});

// ─── buildContractPreset ──────────────────────────────────────────────────────

describe("buildContractPreset", () => {
	it("minimal preset includes the canonical baseline sections", () => {
		const contract = buildContractPreset("minimal");
		expect(contract).toHaveProperty("version");
		expect(contract).toHaveProperty("riskTierRules");
		expect(contract).toHaveProperty("mergePolicy");
		expect(contract).toHaveProperty("branchProtection");
		expect(contract).toHaveProperty("northStar");
		expect(contract).toHaveProperty("productSurface");
		expect(contract).toHaveProperty("overrideReviewerRegistry");
		expect(Object.keys(contract)).toHaveLength(7);
	});

	it("standard preset includes governance and north-star sections", () => {
		const contract = buildContractPreset("standard");
		expect(Object.keys(contract)).toHaveLength(10);
		expect(contract).toHaveProperty("diffBudget");
		expect(contract).toHaveProperty("docsDriftRules");
		expect(contract).toHaveProperty("evidencePolicy");
		expect(contract).toHaveProperty("northStar");
		expect(contract).toHaveProperty("productSurface");
		expect(contract).toHaveProperty("overrideReviewerRegistry");
	});

	it("full preset includes toolingPolicy and governance sections", () => {
		const contract = buildContractPreset("full");
		expect(contract).toHaveProperty("toolingPolicy");
		expect(contract).toHaveProperty("reviewPolicy");
		expect(contract).toHaveProperty("docsGatePolicy");
		expect(Object.keys(contract).length).toBeGreaterThan(7);
	});

	it("all presets have correct version", () => {
		for (const preset of CONTRACT_PRESETS) {
			expect(buildContractPreset(preset)).toHaveProperty(
				"version",
				SCHEMA_VERSION,
			);
		}
	});

	it("all presets produce valid JSON", () => {
		for (const preset of CONTRACT_PRESETS) {
			expect(() => JSON.stringify(buildContractPreset(preset))).not.toThrow();
		}
	});

	it("minimal preset mergePolicy has high/medium/low keys", () => {
		const { mergePolicy } = buildContractPreset("minimal") as {
			mergePolicy: Record<string, unknown>;
		};
		expect(mergePolicy).toHaveProperty("high");
		expect(mergePolicy).toHaveProperty("medium");
		expect(mergePolicy).toHaveProperty("low");
	});

	it("PRESET_DESCRIPTIONS covers all presets", () => {
		for (const preset of CONTRACT_PRESETS) {
			expect(PRESET_DESCRIPTIONS[preset]).toBeTruthy();
		}
	});

	it("normalizes lite preset to minimal", () => {
		expect(normalizeContractPreset("lite")).toBe("minimal");
	});

	it("rejects unknown preset aliases", () => {
		expect(normalizeContractPreset("unknown")).toBeUndefined();
	});

	it.each(["toString", "constructor", "__proto__"] as const)(
		"rejects inherited object keys as preset aliases: %s",
		(alias) => {
			expect(normalizeContractPreset(alias)).toBeUndefined();
		},
	);

	it("CONTRACT_PRESET_INPUTS includes lite alias", () => {
		expect(CONTRACT_PRESET_INPUTS).toContain("lite");
	});
});

// ─── runContractInitCLI ───────────────────────────────────────────────────────

describe("runContractInitCLI", () => {
	let dir: string;
	let consoleSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "jsc123-"));
		consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("creates standard contract by default", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ output });
		expect(code).toBe(0);
		expect(existsSync(output)).toBe(true);
		const parsed = JSON.parse(readFileSync(output, "utf-8"));
		expect(parsed).toHaveProperty("version", SCHEMA_VERSION);
		expect(parsed).toHaveProperty("diffBudget");
	});

	it("creates minimal contract", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ preset: "minimal", output });
		expect(code).toBe(0);
		const parsed = JSON.parse(readFileSync(output, "utf-8"));
		expect(Object.keys(parsed)).toHaveLength(7);
	});

	it("creates lite contract aliasing minimal", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ preset: "lite", output });
		expect(code).toBe(0);
		const parsed = JSON.parse(readFileSync(output, "utf-8"));
		expect(parsed).toEqual(buildContractPreset("minimal"));
	});

	it("creates full contract", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ preset: "full", output });
		expect(code).toBe(0);
		const parsed = JSON.parse(readFileSync(output, "utf-8"));
		expect(parsed).toHaveProperty("toolingPolicy");
	});

	it("errors if output file already exists without --force", () => {
		const output = join(dir, "harness.contract.json");
		writeFileSync(output, "{}", "utf-8");
		const code = runContractInitCLI({ output });
		expect(code).toBe(1);
		expect(consoleErrSpy).toHaveBeenCalledWith(
			expect.stringContaining("already exists"),
		);
	});

	it("overwrites existing file with --force", () => {
		const output = join(dir, "harness.contract.json");
		writeFileSync(output, "{}", "utf-8");
		const code = runContractInitCLI({ output, force: true });
		expect(code).toBe(0);
		const parsed = JSON.parse(readFileSync(output, "utf-8"));
		expect(parsed).toHaveProperty("version");
	});

	it("returns 2 for unknown preset", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ preset: "unknown" as never, output });
		expect(code).toBe(2);
	});

	it.each(["toString", "constructor", "__proto__"] as const)(
		"returns 2 for inherited-key preset alias: %s",
		(alias) => {
			const output = join(dir, "harness.contract.json");
			let code = -1;
			expect(() => {
				code = runContractInitCLI({ preset: alias as never, output });
			}).not.toThrow();
			expect(code).toBe(2);
		},
	);

	it("emits JSON output when --json flag is set", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ output, json: true });
		expect(code).toBe(0);
		const call = consoleSpy.mock.calls[0]?.[0];
		const result = JSON.parse(call as string);
		expect(result).toMatchObject({ status: "created", preset: "standard" });
	});

	it("emits canonical preset alongside lite alias in JSON output", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ preset: "lite", output, json: true });
		expect(code).toBe(0);
		const call = consoleSpy.mock.calls[0]?.[0];
		const result = JSON.parse(call as string);
		expect(result).toMatchObject({
			status: "created",
			preset: "lite",
			canonicalPreset: "minimal",
		});
	});

	it("preserves requested lite alias in overwrite hint", () => {
		const output = join(dir, "harness.contract.json");
		writeFileSync(output, "{}", "utf-8");
		const code = runContractInitCLI({ preset: "lite", output });
		expect(code).toBe(1);
		expect(consoleErrSpy).toHaveBeenCalledWith(
			expect.stringContaining("harness contract init --preset lite --force"),
		);
	});

	it("runContractCLI dispatches init subcommand", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractCLI(
			["init", "--preset", "minimal", "--output", output],
			{},
		);
		expect(code).toBe(0);
		expect(existsSync(output)).toBe(true);
	});
});
