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
	"quality:behavior-tests": {
		command:
			"bash scripts/with-validation-lock.sh behavior-tests -- node scripts/check-behavior-tests.mjs",
		scriptPath: "scripts/check-behavior-tests.mjs",
	},
	"quality:git-env-sanitizer": {
		command: "node scripts/check-git-env-sanitizer.mjs",
		scriptPath: "scripts/check-git-env-sanitizer.mjs",
	},
	"harness:audit-tracking": {
		command: "node scripts/check-harness-audit-tracking.mjs",
		scriptPath: "scripts/check-harness-audit-tracking.mjs",
	},
} as const;

const requiredRuntimeInputs = [
	"scripts/with-validation-lock.sh",
	"scripts/lib/safe-git-env.mjs",
	"src/lib/testing/behavior-test-suites.json",
	"src/lib/testing/expect-behavior.ts",
	"evals/scenarios/north-star-agent-delivery/packet-surface-baseline.json",
] as const;

const requiredPackagedCanaryScripts = {
	"test:harness-canary": {
		command: "node scripts/run-harness-canary-audit.mjs",
		scriptPath: "scripts/run-harness-canary-audit.mjs",
	},
	"test:harness-upgrade-matrix": {
		command: "node scripts/test-harness-upgrade-matrix.mjs",
		scriptPath: "scripts/test-harness-upgrade-matrix.mjs",
	},
} as const;

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

			for (const [scriptName, script] of Object.entries(
				requiredPackagedQualityScripts,
			)) {
				expect(packageScripts[scriptName]).toBe(script.command);
				expect(tarballFiles.has(packagePath(script.scriptPath))).toBe(true);
			}

			for (const [scriptName, script] of Object.entries(
				requiredPackagedCanaryScripts,
			)) {
				expect(packageScripts[scriptName]).toBe(script.command);
				expect(tarballFiles.has(packagePath(script.scriptPath))).toBe(true);
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
