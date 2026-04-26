import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LEGACY_MODULE_RATCHETS = [
	{
		path: "src/commands/ci-migrate.ts",
		maxLines: 10_400,
		reason: "CI migration must move toward a control-plane service seam.",
	},
	{
		path: "src/lib/init/scaffold.ts",
		maxLines: 5_650,
		reason: "Scaffold rendering must move toward surface-specific modules.",
	},
	{
		path: "src/lib/output/normalise.ts",
		maxLines: 1_100,
		reason: "Output normalisation should not keep absorbing command types.",
	},
] as const;

const TRANSITIONAL_LIB_TO_COMMAND_IMPORTS = new Set([
	"src/lib/cli/registry/command-specs.ts",
	"src/lib/init/index.ts",
	"src/lib/output/normalise.ts",
]);

const COMMAND_IMPORT_PATTERN = /from\s+(?:type\s+)?["'](?:\.\.\/)+commands\//;

function countFileLines(path: string): number {
	const content = readFileSync(join(process.cwd(), path), "utf-8");
	return content.split("\n").length;
}

function collectTypeScriptFiles(directory: string): string[] {
	const root = join(process.cwd(), directory);
	const files: string[] = [];

	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const relativePath = `${directory}/${entry.name}`;

		if (entry.isDirectory()) {
			files.push(...collectTypeScriptFiles(relativePath));
			continue;
		}

		if (
			entry.isFile() &&
			relativePath.endsWith(".ts") &&
			!relativePath.endsWith(".test.ts") &&
			!relativePath.endsWith(".spec.ts")
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

	it("ratchets legacy drift seams while they are decomposed", () => {
		for (const moduleRatchet of LEGACY_MODULE_RATCHETS) {
			const lineCount = countFileLines(moduleRatchet.path);

			expect(
				lineCount,
				`${moduleRatchet.path} has ${lineCount} lines; ${moduleRatchet.reason}`,
			).toBeLessThanOrEqual(moduleRatchet.maxLines);
		}
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
