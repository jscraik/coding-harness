import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMMAND_SURFACE_DECOMPOSITION_RATCHETS = [
	{
		path: "src/commands/ci-migrate.ts",
		maxLines: 10_400,
		reason: "CI migration must move toward a control-plane service seam.",
	},
	{
		path: "src/commands/drift-gate.ts",
		maxLines: 1_000,
		reason:
			"Drift gate must move toward evaluator, artifact, and runner seams before it absorbs more policy.",
	},
	{
		path: "src/lib/output/normalise.ts",
		maxLines: 1_100,
		reason: "Output normalisation should not keep absorbing command types.",
	},
] as const;

const DOCTOR_SURFACE_RATCHETS = [
	{
		path: "src/commands/doctor.ts",
		maxLines: 260,
		reason:
			"Doctor runner must stay thin; move prerequisite checks and artifacts behind focused command seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-checks.ts",
		maxLines: 40,
		reason:
			"Doctor check catalogue must stay a thin composition module after check families have been split.",
	},
	{
		path: "src/commands/doctor-check-utils.ts",
		maxLines: 80,
		reason:
			"Doctor check utilities must stay generic; move surface-specific behavior into check-family modules.",
	},
	{
		path: "src/commands/doctor-tool-checks.ts",
		maxLines: 200,
		reason:
			"Doctor tool checks must stay focused; split larger tool groups before raising this limit.",
	},
	{
		path: "src/commands/doctor-file-checks.ts",
		maxLines: 260,
		reason:
			"Doctor file checks must stay focused; split baseline checks before raising this limit.",
	},
	{
		path: "src/commands/doctor-config-checks.ts",
		maxLines: 220,
		reason:
			"Doctor config checks must stay focused; split contract policy families before raising this limit.",
	},
	{
		path: "src/commands/doctor-ci-checks.ts",
		maxLines: 200,
		reason:
			"Doctor CI checks must stay focused; split provider-specific checks before raising this limit.",
	},
] as const;

const SCAFFOLD_SURFACE_RATCHETS = [
	{
		path: "src/lib/init/scaffold.ts",
		maxLines: 450,
		reason:
			"Scaffold entrypoint must stay a thin orchestrator; extract surface-specific rendering modules before raising this limit.",
	},
	{
		path: "src/lib/init/scaffold-template-registry.ts",
		maxLines: 425,
		reason:
			"Scaffold template registry must stay an inventory seam; extract focused template groups before raising this limit.",
	},
	{
		path: "src/lib/init/scaffold-script-template-registry.ts",
		maxLines: 225,
		reason:
			"Scaffold script template registry must stay focused; extract script-family renderers before raising this limit.",
	},
] as const;

const TRANSITIONAL_LIB_TO_COMMAND_IMPORTS = new Set([
	"src/lib/cli/registry/command-specs.ts",
	"src/lib/cli/registry/command-specs-core.ts",
	"src/lib/init/index.ts",
	"src/lib/output/normalise.ts",
	"src/lib/output/normalise-core-v2.ts",
]);

const COMMAND_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+commands\//;

function countFileLines(path: string): number {
	const content = readFileSync(join(process.cwd(), path), "utf-8");
	return content.split("\n").length;
}

function expectRatchetsWithinBudget(
	ratchets: readonly { path: string; maxLines: number; reason: string }[],
): void {
	for (const moduleRatchet of ratchets) {
		const lineCount = countFileLines(moduleRatchet.path);

		expect(
			lineCount,
			`${moduleRatchet.path} has ${lineCount} lines; ${moduleRatchet.reason}`,
		).toBeLessThanOrEqual(moduleRatchet.maxLines);
	}
}

function collectTypeScriptFiles(directory: string): string[] {
	const root = join(process.cwd(), directory);
	const files: string[] = [];

	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const relativePath = join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...collectTypeScriptFiles(relativePath));
			continue;
		}

		if (
			entry.isFile() &&
			relativePath.endsWith(".ts") &&
			!relativePath.endsWith(".test.ts") &&
			!relativePath.endsWith(".spec.ts") &&
			!relativePath.endsWith(".d.ts")
		) {
			files.push(relativePath);
		}
	}

	return files;
}

describe("module boundaries", () => {
	it("keeps command registry as a thin loader module", () => {
		const registryPath = "src/lib/cli/command-registry.ts";
		const content = readFileSync(join(process.cwd(), registryPath), "utf-8");
		expect(content).toContain("./registry/command-capabilities.js");
		expect(content).toContain("./registry/fuzzy-resolution.js");
		expect(countFileLines(registryPath)).toBeLessThanOrEqual(220);
	});

	it("keeps validator entrypoint below monolith threshold and split by domain", () => {
		const validatorPath = "src/lib/contract/validator.ts";
		const content = readFileSync(join(process.cwd(), validatorPath), "utf-8");
		expect(content).toContain("./policy-validators.js");
		expect(content).toContain("./validator-helpers.js");
		expect(countFileLines(validatorPath)).toBeLessThanOrEqual(2700);
	});

	it("ratchets seam decomposition while they are extracted", () => {
		expectRatchetsWithinBudget(COMMAND_SURFACE_DECOMPOSITION_RATCHETS);
	});

	it("keeps doctor surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(DOCTOR_SURFACE_RATCHETS);
	});

	it("keeps scaffold surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(SCAFFOLD_SURFACE_RATCHETS);
	});

	it("prevents new lib-to-command imports outside transitional adapters", () => {
		const violations = collectTypeScriptFiles("src/lib")
			.filter((path) => !TRANSITIONAL_LIB_TO_COMMAND_IMPORTS.has(path))
			.filter((path) =>
				COMMAND_IMPORT_PATTERN.test(
					readFileSync(join(process.cwd(), path), "utf-8"),
				),
			);

		expect(violations).toEqual([]);
	});
});
