import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
	loadRegistry,
	validateRegistry,
	validateRegistryPaths,
	type WorkflowArtifactRegistry,
	type RegistryFinding,
} from "./registry.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function validRegistry(): WorkflowArtifactRegistry {
	return {
		version: "1.0",
		artifacts: [
			{
				id: "test-workflow",
				path: "WORKFLOW.md",
				owner: "test-team",
				status: "active",
				last_validated_at: "2026-03-21T00:00:00Z",
				deprecation_policy: "none",
				description: "A test workflow",
			},
		],
	};
}

function hasFinding(findings: RegistryFinding[], code: string): boolean {
	return findings.some((f: RegistryFinding) => f.code === code);
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe("validateRegistry", () => {
	it("passes a valid registry", () => {
		const result = validateRegistry(validRegistry());
		expect(result.pass).toBe(true);
		expect(result.summary.errors).toBe(0);
	});

	it("reports correct summary counts", () => {
		const registry = validRegistry();
		registry.artifacts.push({
			id: "deprecated-flow",
			path: "old.md",
			owner: "team",
			status: "deprecated",
			last_validated_at: "2026-01-01T00:00:00Z",
			deprecation_policy: "none",
			superseded_by: "test-workflow",
		});
		registry.artifacts.push({
			id: "draft-flow",
			path: "draft.md",
			owner: "team",
			status: "draft",
			last_validated_at: "2026-01-01T00:00:00Z",
			deprecation_policy: "none",
		});

		const result = validateRegistry(registry);
		expect(result.summary.total_artifacts).toBe(3);
		expect(result.summary.active).toBe(1);
		expect(result.summary.deprecated).toBe(1);
		expect(result.summary.draft).toBe(1);
	});

	it("fails when version is missing", () => {
		const registry = validRegistry();
		(registry as unknown as Record<string, unknown>).version = "";

		const result = validateRegistry(registry);
		expect(result.pass).toBe(false);
		expect(hasFinding(result.findings, "MISSING_VERSION")).toBe(true);
	});

	it("fails when artifact id is missing", () => {
		const registry = validRegistry();
		(
			registry.artifacts[0] as unknown as Record<string, unknown>
		).id = "";

		const result = validateRegistry(registry);
		expect(result.pass).toBe(false);
		expect(hasFinding(result.findings, "MISSING_ID")).toBe(true);
	});

	it("fails on duplicate ids", () => {
		const registry = validRegistry();
		registry.artifacts.push({
			...registry.artifacts[0]!,
			path: "other.md",
		});

		const result = validateRegistry(registry);
		expect(result.pass).toBe(false);
		expect(hasFinding(result.findings, "DUPLICATE_ID")).toBe(true);
	});

	it("fails on invalid id format (non-kebab)", () => {
		const registry = validRegistry();
		(
			registry.artifacts[0] as unknown as Record<string, unknown>
		).id = "CamelCase";

		const result = validateRegistry(registry);
		expect(result.pass).toBe(false);
		expect(hasFinding(result.findings, "INVALID_ID_FORMAT")).toBe(true);
	});

	it("fails when path is missing", () => {
		const registry = validRegistry();
		(
			registry.artifacts[0] as unknown as Record<string, unknown>
		).path = "";

		const result = validateRegistry(registry);
		expect(result.pass).toBe(false);
		expect(hasFinding(result.findings, "MISSING_PATH")).toBe(true);
	});

	it("fails when owner is missing", () => {
		const registry = validRegistry();
		(
			registry.artifacts[0] as unknown as Record<string, unknown>
		).owner = "";

		const result = validateRegistry(registry);
		expect(result.pass).toBe(false);
		expect(hasFinding(result.findings, "MISSING_OWNER")).toBe(true);
	});

	it("fails on invalid status", () => {
		const registry = validRegistry();
		(
			registry.artifacts[0] as unknown as Record<string, unknown>
		).status = "unknown";

		const result = validateRegistry(registry);
		expect(result.pass).toBe(false);
		expect(hasFinding(result.findings, "INVALID_STATUS")).toBe(true);
	});

	it("fails on invalid deprecation_policy", () => {
		const registry = validRegistry();
		(
			registry.artifacts[0] as unknown as Record<string, unknown>
		).deprecation_policy = "yolo";

		const result = validateRegistry(registry);
		expect(result.pass).toBe(false);
		expect(
			hasFinding(result.findings, "INVALID_DEPRECATION_POLICY"),
		).toBe(true);
	});

	it("warns when deprecated artifact lacks superseded_by", () => {
		const registry = validRegistry();
		registry.artifacts[0]!.status = "deprecated";

		const result = validateRegistry(registry);
		// warning, not error
		expect(
			hasFinding(result.findings, "DEPRECATED_NEEDS_SUCCESSOR"),
		).toBe(true);
		expect(
			result.findings.find(
				(f: RegistryFinding) =>
					f.code === "DEPRECATED_NEEDS_SUCCESSOR",
			)?.severity,
		).toBe("warning");
	});

	it("warns when sunset-date policy lacks sunset_date", () => {
		const registry = validRegistry();
		registry.artifacts[0]!.deprecation_policy = "sunset-date";

		const result = validateRegistry(registry);
		expect(hasFinding(result.findings, "SUNSET_NEEDS_DATE")).toBe(true);
	});

	it("warns when last_validated_at is missing", () => {
		const registry = validRegistry();
		(
			registry.artifacts[0] as unknown as Record<string, unknown>
		).last_validated_at = "";

		const result = validateRegistry(registry);
		expect(hasFinding(result.findings, "MISSING_LAST_VALIDATED")).toBe(
			true,
		);
	});
});

describe("loadRegistry", () => {
	it("loads the real registry from the repo root", async () => {
		const repoRoot = resolve(__dirname, "../../..");
		const registry = await loadRegistry(repoRoot);

		expect(registry.version).toBe("1.0");
		expect(registry.artifacts.length).toBeGreaterThan(0);
	});

	it("throws on non-existent file", async () => {
		await expect(loadRegistry("/tmp/does-not-exist")).rejects.toThrow();
	});
});

describe("validateRegistryPaths", () => {
	it("finds no errors for real artifacts", async () => {
		const repoRoot = resolve(__dirname, "../../..");
		const registry = await loadRegistry(repoRoot);
		const findings = await validateRegistryPaths(registry, repoRoot);

		const errors = findings.filter(
			(f: RegistryFinding) => f.code === "FILE_NOT_FOUND",
		);
		expect(errors).toEqual([]);
	});

	it("reports missing files", async () => {
		const registry: WorkflowArtifactRegistry = {
			version: "1.0",
			artifacts: [
				{
					id: "ghost-workflow",
					path: "does-not-exist.md",
					owner: "test",
					status: "active",
					last_validated_at: "2026-01-01T00:00:00Z",
					deprecation_policy: "none",
				},
			],
		};

		const repoRoot = resolve(__dirname, "../../..");
		const findings = await validateRegistryPaths(registry, repoRoot);
		expect(hasFinding(findings, "FILE_NOT_FOUND")).toBe(true);
	});

	it("catches path traversal attempts", async () => {
		const registry: WorkflowArtifactRegistry = {
			version: "1.0",
			artifacts: [
				{
					id: "evil-workflow",
					path: "../../etc/passwd",
					owner: "test",
					status: "active",
					last_validated_at: "2026-01-01T00:00:00Z",
					deprecation_policy: "none",
				},
			],
		};

		const repoRoot = resolve(__dirname, "../../..");
		const findings = await validateRegistryPaths(registry, repoRoot);
		expect(hasFinding(findings, "PATH_TRAVERSAL")).toBe(true);
	});
});

describe("real registry validation", () => {
	it("validates the actual workflow-artifact-registry.json", async () => {
		const repoRoot = resolve(__dirname, "../../..");
		const registry = await loadRegistry(repoRoot);
		const result = validateRegistry(registry);

		expect(result.pass).toBe(true);
		expect(result.summary.errors).toBe(0);
		expect(result.summary.active).toBeGreaterThan(0);
	});
});
