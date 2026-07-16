import { spawnSync } from "node:child_process";
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
});
