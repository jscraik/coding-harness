/**
 * Tests for JSC-66: version-aware upgrade path.
 *
 * Covers:
 * - fingerprintContent determinism
 * - buildUpgradeManifest structure
 * - classifyFiles (stock / customized / absent)
 * - detectExistingInstall
 * - detectUpgradeContext (fromVersion resolution)
 * - migrateContractSchema (incremental transforms)
 * - formatMigrationChanges
 * - formatUpgradeSummary
 */

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type UpgradeManifest,
	buildUpgradeManifest,
	classifyFiles,
	detectExistingInstall,
	detectUpgradeContext,
	fingerprintContent,
	formatUpgradeSummary,
} from "../lib/init/upgrade.js";

import {
	formatMigrationChanges,
	migrateContractSchema,
} from "../lib/init/schema-migrate.js";
import { runUpgradeCLI } from "./upgrade.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
	return mkdtempSync(join(tmpdir(), "jsc66-"));
}

function ensureHarnessDir(dir: string): void {
	mkdirSync(join(dir, ".harness"), { recursive: true });
}

/** Write a minimal restore-manifest so detectExistingInstall finds an install */
function writeRestoreManifest(
	dir: string,
	harnessVersion: string,
	ciProvider = "circleci",
): void {
	ensureHarnessDir(dir);
	writeFileSync(
		join(dir, ".harness", "restore-manifest.json"),
		JSON.stringify({ harnessVersion, ciProvider, files: [] }),
	);
}

// ─── fingerprintContent ───────────────────────────────────────────────────────

describe("fingerprintContent", () => {
	it("returns a hex SHA-256 string", () => {
		const hash = fingerprintContent("hello");
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is deterministic for the same input", () => {
		expect(fingerprintContent("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("differs for different inputs", () => {
		expect(fingerprintContent("abc")).not.toBe(fingerprintContent("ABC"));
	});
});

// ─── buildUpgradeManifest ─────────────────────────────────────────────────────

describe("buildUpgradeManifest", () => {
	it("records templateHash for each entry", () => {
		const entries = [
			{ path: ".github/ci.yml", content: "name: ci" },
			{ path: "harness-gates.yml", content: "gates: []" },
		];
		const manifest = buildUpgradeManifest(entries);
		expect(manifest.schemaVersion).toBe("upgrade-manifest/v1");
		expect(manifest.files).toHaveLength(2);
		expect(manifest.files[0]?.templateHash).toBe(
			fingerprintContent("name: ci"),
		);
		expect(manifest.files[1]?.templateHash).toBe(
			fingerprintContent("gates: []"),
		);
	});

	it("sets customized=false on all entries at write time", () => {
		const manifest = buildUpgradeManifest([{ path: "foo.yml", content: "a" }]);
		expect(manifest.files[0]?.customized).toBe(false);
	});

	it("stores a valid ISO timestamp in updatedAt", () => {
		const manifest = buildUpgradeManifest([{ path: "x", content: "y" }]);
		expect(() => new Date(manifest.updatedAt).toISOString()).not.toThrow();
	});
});

// ─── classifyFiles ────────────────────────────────────────────────────────────

describe("classifyFiles", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("classifies a stock file (on-disk hash === templateHash)", () => {
		const content = "stock content";
		writeFileSync(join(dir, "file.txt"), content);

		const manifest: UpgradeManifest = {
			schemaVersion: "upgrade-manifest/v1",
			harnessVersion: "1.0.0",
			updatedAt: new Date().toISOString(),
			files: [
				{
					path: "file.txt",
					templateHash: fingerprintContent(content),
					version: "1.0.0",
					customized: false,
				},
			],
		};

		const result = classifyFiles(dir, manifest);
		expect(result[0]?.status).toBe("stock");
	});

	it("classifies a customized file (on-disk hash ≠ templateHash)", () => {
		writeFileSync(join(dir, "file.txt"), "modified content");

		const manifest: UpgradeManifest = {
			schemaVersion: "upgrade-manifest/v1",
			harnessVersion: "1.0.0",
			updatedAt: new Date().toISOString(),
			files: [
				{
					path: "file.txt",
					templateHash: fingerprintContent("original content"),
					version: "1.0.0",
					customized: false,
				},
			],
		};

		const result = classifyFiles(dir, manifest);
		expect(result[0]?.status).toBe("customized");
	});

	it("classifies an absent file", () => {
		const manifest: UpgradeManifest = {
			schemaVersion: "upgrade-manifest/v1",
			harnessVersion: "1.0.0",
			updatedAt: new Date().toISOString(),
			files: [
				{
					path: "missing.txt",
					templateHash: "abc123",
					version: "1.0.0",
					customized: false,
				},
			],
		};

		const result = classifyFiles(dir, manifest);
		expect(result[0]?.status).toBe("absent");
	});
});

// ─── detectExistingInstall ────────────────────────────────────────────────────

describe("detectExistingInstall", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("returns isExistingInstall=false when no restore-manifest", () => {
		const result = detectExistingInstall(dir);
		expect(result.isExistingInstall).toBe(false);
		expect(result.installedVersion).toBeNull();
	});

	it("returns isExistingInstall=true when restore-manifest exists", () => {
		writeRestoreManifest(dir, "0.7.4");
		const result = detectExistingInstall(dir);
		expect(result.isExistingInstall).toBe(true);
		expect(result.installedVersion).toBe("0.7.4");
	});

	it("sets upgradeAvailable=true when installedVersion < current", () => {
		writeRestoreManifest(dir, "0.0.1"); // very old
		const result = detectExistingInstall(dir);
		// current version from package.json will be > 0.0.1
		expect(result.upgradeAvailable).toBe(true);
	});
});

// ─── detectUpgradeContext ─────────────────────────────────────────────────────

describe("detectUpgradeContext", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("returns fromVersion=0.0.0 when no manifest exists (fresh install path)", () => {
		const result = detectUpgradeContext(dir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.fromVersion).toBe("0.0.0");
		}
	});

	it("reads fromVersion from restore-manifest", () => {
		writeRestoreManifest(dir, "0.8.0");
		const result = detectUpgradeContext(dir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.fromVersion).toBe("0.8.0");
		}
	});

	it("sets upgradeNeeded=true when toVersion > fromVersion", () => {
		writeRestoreManifest(dir, "0.0.1");
		const result = detectUpgradeContext(dir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.upgradeNeeded).toBe(true);
		}
	});

	it("sets downgradeDetected=false for fresh installs", () => {
		const result = detectUpgradeContext(dir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.downgradeDetected).toBe(false);
		}
	});

	it("fails when restore-manifest is missing harnessVersion", () => {
		ensureHarnessDir(dir);
		writeFileSync(
			join(dir, ".harness", "restore-manifest.json"),
			JSON.stringify({ ciProvider: "circleci", files: [] }),
		);
		const result = detectUpgradeContext(dir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Restore manifest is incomplete");
			expect(result.error).toContain("harnessVersion");
		}
	});

	it("auto-repairs restore-manifest when contract declares ciProvider", () => {
		ensureHarnessDir(dir);
		writeFileSync(
			join(dir, ".harness", "restore-manifest.json"),
			JSON.stringify({ harnessVersion: "0.8.0", files: [] }),
		);
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({
				ciProviderPolicy: { activeProvider: "circleci" },
			}),
		);
		const result = detectUpgradeContext(dir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.fromVersion).toBe("0.8.0");
		}
		const repairedManifest = JSON.parse(
			readFileSync(join(dir, ".harness", "restore-manifest.json"), "utf-8"),
		) as { ciProvider?: string | undefined };
		expect(repairedManifest.ciProvider).toBe("circleci");
	});

	it("auto-repairs restore-manifest when ci layout is unambiguous", () => {
		ensureHarnessDir(dir);
		writeFileSync(
			join(dir, ".harness", "restore-manifest.json"),
			JSON.stringify({ harnessVersion: "0.8.0", files: [] }),
		);
		mkdirSync(join(dir, ".circleci"), { recursive: true });
		writeFileSync(join(dir, ".circleci", "config.yml"), "version: 2.1\n");
		const result = detectUpgradeContext(dir);
		expect(result.ok).toBe(true);
		const repairedManifest = JSON.parse(
			readFileSync(join(dir, ".harness", "restore-manifest.json"), "utf-8"),
		) as { ciProvider?: string | undefined };
		expect(repairedManifest.ciProvider).toBe("circleci");
	});

	it("infers legacy restore-manifest provider without writing during dry-run", () => {
		ensureHarnessDir(dir);
		const manifestPath = join(dir, ".harness", "restore-manifest.json");
		const legacyManifest = JSON.stringify({
			harnessVersion: "0.8.0",
			files: [],
		});
		writeFileSync(manifestPath, legacyManifest);
		mkdirSync(join(dir, ".github", "workflows"), { recursive: true });

		const result = detectUpgradeContext(dir, undefined, { dryRun: true });

		expect(result.ok).toBe(true);
		expect(readFileSync(manifestPath, "utf-8")).toBe(legacyManifest);
	});

	it("prefers the requested/default provider when ci layout is ambiguous", () => {
		ensureHarnessDir(dir);
		writeFileSync(
			join(dir, ".harness", "restore-manifest.json"),
			JSON.stringify({ harnessVersion: "0.8.0", files: [] }),
		);
		mkdirSync(join(dir, ".circleci"), { recursive: true });
		writeFileSync(join(dir, ".circleci", "config.yml"), "version: 2.1\n");
		mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
		const result = detectUpgradeContext(dir, "circleci");
		expect(result.ok).toBe(true);
		const repairedManifest = JSON.parse(
			readFileSync(join(dir, ".harness", "restore-manifest.json"), "utf-8"),
		) as { ciProvider?: string | undefined };
		expect(repairedManifest.ciProvider).toBe("circleci");
	});

	it("fails when restore-manifest is missing ciProvider and provider cannot be inferred", () => {
		ensureHarnessDir(dir);
		writeFileSync(
			join(dir, ".harness", "restore-manifest.json"),
			JSON.stringify({ harnessVersion: "0.8.0", files: [] }),
		);
		const result = detectUpgradeContext(dir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("Restore manifest is incomplete");
			expect(result.error).toContain("ciProvider");
		}
	});
});

// ─── migrateContractSchema ────────────────────────────────────────────────────

describe("migrateContractSchema", () => {
	it("adds ciProviderPolicy.mode=shadow for pre-0.8.0 installs", () => {
		const contract: Record<string, unknown> = { ciProviderPolicy: {} };
		const result = migrateContractSchema(contract, "0.7.4");
		const policy = result.contract.ciProviderPolicy as Record<string, unknown>;
		expect(policy.mode).toBe("shadow");
		expect(
			result.changes.some((c) => c.field === "ciProviderPolicy.mode"),
		).toBe(true);
	});

	it("does NOT overwrite existing ciProviderPolicy.mode", () => {
		const contract: Record<string, unknown> = {
			ciProviderPolicy: { mode: "required" },
		};
		migrateContractSchema(contract, "0.7.4");
		const policy = contract.ciProviderPolicy as Record<string, unknown>;
		expect(policy.mode).toBe("required"); // preserved
	});

	it("skips transforms whose sinceVersion <= fromVersion", () => {
		const contract: Record<string, unknown> = { ciProviderPolicy: {} };
		// Already at 0.8.2 — all transforms up to that version should be skipped
		const result = migrateContractSchema(contract, "0.8.2");
		expect(result.changes).toHaveLength(0);
	});

	it("adds branchProtection.requiredChecks for pre-0.8.1 installs", () => {
		const contract: Record<string, unknown> = { branchProtection: {} };
		const result = migrateContractSchema(contract, "0.8.0");
		const bp = result.contract.branchProtection as Record<string, unknown>;
		expect(Array.isArray(bp.requiredChecks)).toBe(true);
	});

	it("adds commitMode=solo when enterprise fields absent (0.8.2 transform)", () => {
		const contract: Record<string, unknown> = { ciProviderPolicy: {} };
		const result = migrateContractSchema(contract, "0.8.1");
		const policy = result.contract.ciProviderPolicy as Record<string, unknown>;
		expect(policy.commitMode).toBe("solo");
	});

	it("does NOT add commitMode=solo when trustedPolicyRef is present", () => {
		const contract: Record<string, unknown> = {
			ciProviderPolicy: { trustedPolicyRef: "abc123" },
		};
		const result = migrateContractSchema(contract, "0.8.1");
		const policy = result.contract.ciProviderPolicy as Record<string, unknown>;
		expect(policy.commitMode).toBeUndefined();
	});

	it("is idempotent — running twice produces no extra changes", () => {
		const contract: Record<string, unknown> = { ciProviderPolicy: {} };
		migrateContractSchema(contract, "0.0.0"); // first run
		const secondResult = migrateContractSchema(contract, "0.0.0"); // second run (same fromVersion on already-migrated contract)
		expect(secondResult.changes).toHaveLength(0);
	});
});

// ─── formatMigrationChanges ───────────────────────────────────────────────────

describe("formatMigrationChanges", () => {
	it("returns a no-op message when changes is empty", () => {
		const out = formatMigrationChanges([], "0.8.2", "0.8.2");
		expect(out).toContain("no migration needed");
	});

	it("lists each changed field when changes is non-empty", () => {
		const changes = [
			{
				description: "Added mode",
				field: "ciProviderPolicy.mode",
				defaultValue: "shadow",
			},
		];
		const out = formatMigrationChanges(changes, "0.7.4", "0.8.0");
		expect(out).toContain("ciProviderPolicy.mode");
		expect(out).toContain("shadow");
	});
});

// ─── formatUpgradeSummary ─────────────────────────────────────────────────────

describe("formatUpgradeSummary", () => {
	const baseCtx = {
		fromVersion: "0.8.0",
		toVersion: "0.9.0",
		upgradeNeeded: true,
		downgradeDetected: false,
		customizedFiles: [],
		absentFiles: [],
		upgradeManifestPath: "/tmp/.harness/upgrade-manifest.json",
		hasUpgradeManifest: false,
	};

	it("shows UPGRADE READY when upgradeNeeded=true", () => {
		const out = formatUpgradeSummary(baseCtx);
		expect(out).toContain("UPGRADE READY");
		expect(out).toContain("0.8.0");
		expect(out).toContain("0.9.0");
	});

	it("shows already-at-version when no upgrade needed", () => {
		const ctx = { ...baseCtx, upgradeNeeded: false, toVersion: "0.8.0" };
		const out = formatUpgradeSummary(ctx);
		expect(out).toContain("Already at");
	});

	it("shows DOWNGRADE DETECTED when downgradeDetected=true", () => {
		const ctx = {
			...baseCtx,
			upgradeNeeded: false,
			downgradeDetected: true,
			toVersion: "0.7.0",
		};
		const out = formatUpgradeSummary(ctx);
		expect(out).toContain("DOWNGRADE DETECTED");
	});

	it("shows customized file list when hasUpgradeManifest=true and customizedFiles non-empty", () => {
		const ctx = {
			...baseCtx,
			hasUpgradeManifest: true,
			customizedFiles: [".github/workflows/harness-gates.yml"],
		};
		const out = formatUpgradeSummary(ctx);
		expect(out).toContain("customized");
		expect(out).toContain(".github/workflows/harness-gates.yml");
	});
});

// ─── runUpgradeCLI defaults backfill ─────────────────────────────────────────

describe("runUpgradeCLI", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("backfills missing docsGatePolicy even when version is already current", () => {
		const { version: currentVersion } = JSON.parse(
			readFileSync(join(process.cwd(), "package.json"), "utf-8"),
		) as { version: string };
		writeRestoreManifest(dir, currentVersion);
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({
				version: "1.5.0",
				riskTierRules: {},
				mergePolicy: { high: [], medium: [], low: [] },
			}),
		);

		const exitCode = runUpgradeCLI(dir, { dryRun: false });
		expect(exitCode).toBe(0);

		const contract = JSON.parse(
			readFileSync(join(dir, "harness.contract.json"), "utf-8"),
		) as { docsGatePolicy?: unknown };
		expect(contract.docsGatePolicy).toBeDefined();
	});

	it("prints downstream repair guidance when no install is detected", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const exitCode = runUpgradeCLI(dir, { dryRun: true });
			expect(exitCode).toBe(0);
			const output = infoSpy.mock.calls
				.map((call) => String(call[0] ?? ""))
				.join("\n");
			expect(output).toContain("harness init --track");
			expect(output).toContain("harness upgrade");
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("delegates upgrade dry-run JSON to current-repo adoption preview", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({
				version: "1.6.0",
				riskTierRules: {},
				mergePolicy: { high: [], medium: [], low: [] },
			}),
		);
		writeFileSync(join(dir, ".coderabbit.yaml"), "language: en-US\n");
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const exitCode = runUpgradeCLI(dir, { dryRun: true, json: true });
			expect(exitCode).toBe(0);
			expect(infoSpy).toHaveBeenCalledOnce();
			const emitted = JSON.parse(String(infoSpy.mock.calls[0]?.[0] ?? "")) as {
				created?: string[];
				updated?: string[];
				updateMode?: string;
				trackedManifest?: boolean;
				updateDetails?: Array<Record<string, unknown>>;
			};
			expect(emitted.updateMode).toBe("adoption-preview");
			expect(emitted.trackedManifest).toBe(false);
			expect(emitted.created).toEqual(emitted.updated);
			expect(emitted.updated).toEqual(
				expect.arrayContaining(["harness.contract.json", ".coderabbit.yaml"]),
			);
			expect(emitted.updateDetails).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ".coderabbit.yaml",
						category: "code-review",
					}),
				]),
			);
			expect(existsSync(join(dir, ".harness/restore-manifest.json"))).toBe(
				false,
			);
			expect(readFileSync(join(dir, ".coderabbit.yaml"), "utf-8")).toBe(
				"language: en-US\n",
			);
		} finally {
			infoSpy.mockRestore();
		}
	});
});
