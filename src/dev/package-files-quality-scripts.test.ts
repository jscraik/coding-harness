import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
	scripts?: Record<string, string>;
};

type PackOutput = {
	filename?: string;
};

const requiredPackagedQualityScripts = {
	"quality:behavior-tests": "scripts/check-behavior-tests.mjs",
	"quality:git-env-sanitizer": "scripts/check-git-env-sanitizer.mjs",
	"harness:audit-tracking": "scripts/check-harness-audit-tracking.mjs",
} as const;

const requiredRuntimeInputs = [
	"src/lib/git/safe-env.ts",
	"src/lib/testing/behavior-test-suites.json",
	"src/lib/testing/expect-behavior.ts",
] as const;

function run(command: string, args: string[]) {
	const result = spawnSync(command, args, {
		cwd: process.cwd(),
		encoding: "utf8",
	});
	expect(result.error).toBeUndefined();
	expect(result.status, result.stderr || result.stdout).toBe(0);
	return result.stdout;
}

function firstPackOutput(stdout: string): PackOutput {
	const parsed = JSON.parse(stdout) as PackOutput | PackOutput[];
	return Array.isArray(parsed) ? (parsed[0] ?? {}) : parsed;
}

function packagePath(path: string): string {
	return `package/${path}`;
}

function packFilenamePath(packDirectory: string, filename: string): string {
	return isAbsolute(filename) ? filename : join(packDirectory, filename);
}

describe("package files for quality scripts", () => {
	it("packages quality guard scripts and their runtime inputs", () => {
		const packDirectory = mkdtempSync(join(tmpdir(), "coding-harness-pack-"));
		try {
			const packOutput = firstPackOutput(
				run("pnpm", ["pack", "--pack-destination", packDirectory, "--json"]),
			);
			expect(packOutput.filename).toEqual(expect.any(String));
			const tarballPath = packFilenamePath(
				packDirectory,
				packOutput.filename ?? "",
			);
			const tarballFiles = new Set(
				run("tar", ["-tzf", tarballPath]).trim().split("\n"),
			);
			const packageJson = JSON.parse(
				run("tar", ["-xOf", tarballPath, packagePath("package.json")]),
			) as PackageJson;
			const packageScripts = packageJson.scripts ?? {};

			for (const [scriptName, scriptPath] of Object.entries(
				requiredPackagedQualityScripts,
			)) {
				expect(packageScripts[scriptName]).toBe(`node ${scriptPath}`);
				expect(tarballFiles.has(packagePath(scriptPath))).toBe(true);
			}

			for (const runtimeInput of requiredRuntimeInputs) {
				expect(tarballFiles.has(packagePath(runtimeInput))).toBe(true);
			}

			const behaviorSuites = JSON.parse(
				run("tar", [
					"-xOf",
					tarballPath,
					packagePath("src/lib/testing/behavior-test-suites.json"),
				]),
			) as Array<{ path?: string }>;
			const expectedSuitePaths = new Set<string>();
			for (const suite of behaviorSuites) {
				expect(typeof suite.path).toBe("string");
				const suitePath = suite.path ?? "";
				expectedSuitePaths.add(packagePath(suitePath));
				expect(tarballFiles.has(packagePath(suitePath))).toBe(true);
			}
			for (const file of tarballFiles) {
				expect(file.startsWith(packagePath("src/dev/"))).toBe(false);
				if (file.startsWith(packagePath("src/")) && file.endsWith(".test.ts")) {
					expect(expectedSuitePaths.has(file)).toBe(true);
				}
			}
		} finally {
			rmSync(packDirectory, { force: true, recursive: true });
		}
	});
});
