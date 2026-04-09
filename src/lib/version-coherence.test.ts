import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectHarnessVersionCoherence } from "./version-coherence.js";

function makeTmpDir(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

function writeExecutable(path: string, content: string): void {
	writeFileSync(path, content, { encoding: "utf-8" });
	chmodSync(path, 0o755);
}

function createLocalHarnessWrapper(repoDir: string, version: string): void {
	const scriptsDir = join(repoDir, "scripts");
	mkdirSync(scriptsDir, { recursive: true });
	writeExecutable(
		join(scriptsDir, "harness-cli.sh"),
		`#!/usr/bin/env bash\necho "harness v${version}"\n`,
	);
}

function createGlobalHarnessBinary(binDir: string, version: string): void {
	mkdirSync(binDir, { recursive: true });
	writeExecutable(
		join(binDir, "harness"),
		`#!/usr/bin/env bash\necho "harness v${version}"\n`,
	);
}

describe("detectHarnessVersionCoherence", () => {
	const originalPath = process.env.PATH ?? "";
	const cleanupPaths: string[] = [];

	afterEach(() => {
		process.env.PATH = originalPath;
		for (const dir of cleanupPaths.splice(0, cleanupPaths.length)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("reports drift when repo-local and global harness versions differ", () => {
		const repoDir = makeTmpDir("coherence-repo-");
		const binDir = makeTmpDir("coherence-bin-");
		cleanupPaths.push(repoDir, binDir);
		createLocalHarnessWrapper(repoDir, "0.12.0");
		createGlobalHarnessBinary(binDir, "0.6.0");
		process.env.PATH = `${binDir}${delimiter}${originalPath}`;

		const result = detectHarnessVersionCoherence(repoDir);
		expect(result.status).toBe("drift");
		expect(result.repoLocalVersion).toBe("0.12.0");
		expect(result.globalVersion).toBe("0.6.0");
		expect(result.message).toContain("Version drift detected");
		expect(result.remediation).toContain("scripts/harness-cli.sh");
	});

	it("reports ok when repo-local and global harness versions match", () => {
		const repoDir = makeTmpDir("coherence-repo-");
		const binDir = makeTmpDir("coherence-bin-");
		cleanupPaths.push(repoDir, binDir);
		createLocalHarnessWrapper(repoDir, "0.12.0");
		createGlobalHarnessBinary(binDir, "0.12.0");
		process.env.PATH = `${binDir}${delimiter}${originalPath}`;

		const result = detectHarnessVersionCoherence(repoDir);
		expect(result.status).toBe("ok");
		expect(result.repoLocalVersion).toBe("0.12.0");
		expect(result.globalVersion).toBe("0.12.0");
	});
});
