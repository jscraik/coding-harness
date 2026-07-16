import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("architecture registry validator", () => {
	it("distinguishes package scripts from same-named pnpm built-ins", () => {
		const result = spawnSync(
			process.execPath,
			["scripts/validate-architecture-registries.cjs"],
			{ cwd: process.cwd(), encoding: "utf8" },
		);
		const report = JSON.parse(result.stdout) as {
			status: string;
			violations: unknown[];
		};

		expect(result.status).toBe(0);
		expect(report).toEqual({
			schemaVersion: "architecture-registries-validation/v1",
			status: "pass",
			violations: [],
		});
	});

	it("keeps Make and machine policy on the governed audit wrapper", () => {
		expect(readFileSync("Makefile", "utf8")).toMatch(
			/^audit:[^\n]*\n\tpnpm run audit$/m,
		);
		const policy = JSON.parse(readFileSync("coding-policy.json", "utf8")) as {
			policyModules: Array<{ requiredGates?: string[] }>;
		};
		const requiredGates = policy.policyModules.flatMap(
			(module) => module.requiredGates ?? [],
		);
		expect(requiredGates).toContain("pnpm run audit");
		expect(requiredGates).not.toContain("pnpm audit");
	});
});
