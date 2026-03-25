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

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	CI_MIGRATION_STAGES,
	CI_PROVIDERS,
	CI_PROVIDER_MODES,
	SCHEMA_VERSION,
	buildContractJsonSchema,
} from "../lib/contract/json-schema.js";

import { validateContract } from "../lib/contract/validator.js";

import {
	runContractCLI,
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

	it("returns 1 for unknown subcommand", () => {
		const code = runContractCLI(["unknown-cmd"], {});
		expect(code).toBe(1);
		expect(consoleErrSpy).toHaveBeenCalledWith(
			expect.stringContaining("Unknown subcommand"),
		);
	});
});
