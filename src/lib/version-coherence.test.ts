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
		`#!/usr/bin/env bash\n[[ "$1" == "--version" ]] && echo "harness v${version}" && exit 0\necho "harness v${version}"\n`,
	);
}

function createGlobalHarnessBinary(binDir: string, version: string): void {
	mkdirSync(binDir, { recursive: true });
	writeExecutable(
		join(binDir, "harness"),
		`#!/usr/bin/env bash\n[[ "$1" == "--version" ]] && echo "harness v${version}" && exit 0\necho "harness v${version}"\n`,
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
		expect(result.repoLocalOriginPath).toContain("scripts/harness-cli.sh");
		expect(result.globalBinaryPath).toContain("harness");
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

	it("reports skip when no repo-local harness runner is found", () => {
		const repoDir = makeTmpDir("coherence-repo-no-runner-");
		cleanupPaths.push(repoDir);
		// No scripts/harness-cli.sh, no src/cli.ts, no dist/cli.js

		const result = detectHarnessVersionCoherence(repoDir);
		expect(result.status).toBe("skip");
		expect(result.message).toContain("no repo-local harness runner");
		expect(result.repoLocalVersion).toBeUndefined();
		expect(result.globalVersion).toBeUndefined();
	});

	it("reports ok when repo-local runner exists but no global harness binary on PATH", () => {
		const repoDir = makeTmpDir("coherence-repo-no-global-");
		cleanupPaths.push(repoDir);
		createLocalHarnessWrapper(repoDir, "0.12.0");
		// Keep core system tools discoverable while ensuring no global harness binary.
		const emptyBinDir = makeTmpDir("coherence-emptybin-");
		cleanupPaths.push(emptyBinDir);
		process.env.PATH = `${emptyBinDir}${delimiter}/usr/bin${delimiter}/bin`;

		const result = detectHarnessVersionCoherence(repoDir);
		expect(result.status).toBe("ok");
		expect(result.repoLocalVersion).toBe("0.12.0");
		expect(result.globalVersion).toBeUndefined();
		expect(result.globalBinaryPath).toBeUndefined();
		expect(result.message).toContain("no global harness binary found on PATH");
	});

	it("reports error when repo-local runner outputs unparseable version string", () => {
		const repoDir = makeTmpDir("coherence-repo-badver-");
		const binDir = makeTmpDir("coherence-bin-badver-");
		cleanupPaths.push(repoDir, binDir);

		// Wrapper outputs something that doesn't look like a version number
		const scriptsDir = join(repoDir, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		writeExecutable(
			join(scriptsDir, "harness-cli.sh"),
			'#!/usr/bin/env bash\necho "not-a-version-string"\n',
		);
		process.env.PATH = `${binDir}${delimiter}${originalPath}`;

		const result = detectHarnessVersionCoherence(repoDir);
		expect(result.status).toBe("error");
		expect(result.message).toContain(
			"Could not parse repo-local harness version",
		);
		expect(result.remediation).toContain("scripts/harness-cli.sh");
		expect(result.repoLocalVersion).toBeUndefined();
	});

	it("reports error when global harness binary exists but outputs unparseable version", () => {
		const repoDir = makeTmpDir("coherence-repo-global-badver-");
		const binDir = makeTmpDir("coherence-bin-global-badver-");
		cleanupPaths.push(repoDir, binDir);
		createLocalHarnessWrapper(repoDir, "0.12.0");

		// Global binary outputs no parseable version
		mkdirSync(binDir, { recursive: true });
		writeExecutable(
			join(binDir, "harness"),
			'#!/usr/bin/env bash\necho "unknown"\n',
		);
		process.env.PATH = `${binDir}${delimiter}${originalPath}`;

		const result = detectHarnessVersionCoherence(repoDir);
		expect(result.status).toBe("error");
		expect(result.message).toContain("could not determine its version");
		expect(result.repoLocalVersion).toBe("0.12.0");
		expect(result.globalBinaryPath).toBe(join(binDir, "harness"));
	});

	it("parses semver with prerelease suffix correctly", () => {
		const repoDir = makeTmpDir("coherence-repo-prerelease-");
		const binDir = makeTmpDir("coherence-bin-prerelease-");
		cleanupPaths.push(repoDir, binDir);

		const scriptsDir = join(repoDir, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		writeExecutable(
			join(scriptsDir, "harness-cli.sh"),
			'#!/usr/bin/env bash\necho "harness v1.0.0-beta.1"\n',
		);
		createGlobalHarnessBinary(binDir, "1.0.0-beta.1");
		process.env.PATH = `${binDir}${delimiter}${originalPath}`;

		const result = detectHarnessVersionCoherence(repoDir);
		expect(result.status).toBe("ok");
		expect(result.repoLocalVersion).toBe("1.0.0-beta.1");
		expect(result.globalVersion).toBe("1.0.0-beta.1");
	});
});
