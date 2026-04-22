import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function countFileLines(path: string): number {
	const content = readFileSync(join(process.cwd(), path), "utf-8");
	return content.split("\n").length;
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
		expect(countFileLines(validatorPath)).toBeLessThanOrEqual(2650);
	});
});
