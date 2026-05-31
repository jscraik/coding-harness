import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
	files?: string[];
	scripts?: Record<string, string>;
};

const packageJson = JSON.parse(
	readFileSync(join(process.cwd(), "package.json"), "utf8"),
) as PackageJson;

const requiredPackagedQualityScripts = {
	"quality:behavior-tests": "scripts/check-behavior-tests.mjs",
	"quality:git-env-sanitizer": "scripts/check-git-env-sanitizer.mjs",
	"harness:audit-tracking": "scripts/check-harness-audit-tracking.mjs",
} as const;

describe("package files for quality scripts", () => {
	it("packages quality guard scripts that pnpm check invokes", () => {
		const packageFiles = packageJson.files ?? [];
		const packageScripts = packageJson.scripts ?? {};

		for (const [scriptName, scriptPath] of Object.entries(
			requiredPackagedQualityScripts,
		)) {
			expect(packageScripts[scriptName]).toBe(`node ${scriptPath}`);
			expect(packageFiles).toContain(scriptPath);
		}
	});
});
