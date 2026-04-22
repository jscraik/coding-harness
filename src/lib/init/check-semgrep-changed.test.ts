import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SEMGREP_VERSION = "1.153.1";

function writeExecutable(path: string, content: string): void {
	writeFileSync(path, content, "utf-8");
	chmodSync(path, 0o755);
}

function run(
	cwd: string,
	args: string[],
	env: Record<string, string | undefined> = {},
) {
	return spawnSync(
		"bash",
		[join(cwd, "scripts/check-semgrep-changed.sh"), ...args],
		{
			cwd,
			encoding: "utf-8",
			env: {
				...process.env,
				...env,
			},
		},
	);
}

function installFakeSemgrep(cwd: string, callsLogPath: string): string {
	const semgrepCacheRoot = join(cwd, ".fake-semgrep-cache");
	const fakeSemgrepBin = join(
		semgrepCacheRoot,
		`semgrep-venv-${SEMGREP_VERSION}/bin/semgrep`,
	);
	mkdirSync(join(fakeSemgrepBin, ".."), { recursive: true });
	writeExecutable(
		fakeSemgrepBin,
		`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
	echo "${SEMGREP_VERSION}"
	exit 0
fi
printf '%s\\n' "$*" >> "${callsLogPath}"
`,
	);
	return semgrepCacheRoot;
}

function initRepository(cwd: string): void {
	const initResult = spawnSync("git", ["init"], { cwd, encoding: "utf-8" });
	if (initResult.status !== 0) {
		throw new Error(`git init failed: ${initResult.stderr}`);
	}
	spawnSync("git", ["config", "user.email", "test@example.com"], {
		cwd,
		encoding: "utf-8",
	});
	spawnSync("git", ["config", "user.name", "Harness Test"], {
		cwd,
		encoding: "utf-8",
	});
}

function commitAll(cwd: string, message: string): void {
	const addResult = spawnSync("git", ["add", "."], { cwd, encoding: "utf-8" });
	if (addResult.status !== 0) {
		throw new Error(`git add failed: ${addResult.stderr}`);
	}
	const commitResult = spawnSync("git", ["commit", "-m", message], {
		cwd,
		encoding: "utf-8",
	});
	if (commitResult.status !== 0) {
		throw new Error(`git commit failed: ${commitResult.stderr}`);
	}
}

function extractScannedSourceFiles(callsLogPath: string): string[] {
	const callsLog = readFileSync(callsLogPath, "utf-8");
	return callsLog
		.split(/\r?\n/)
		.flatMap((line) => line.trim().split(/\s+/))
		.filter((token) => /^src\/.+\.(ts|tsx|js|jsx|mts|cts)$/.test(token));
}

describe("scripts/check-semgrep-changed.sh", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	function scaffoldScriptRoot(): string {
		const tempDir = mkdtempSync(join(tmpdir(), "semgrep-script-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(
			join(tempDir, "scripts/check-semgrep-changed.sh"),
			readFileSync(
				join(process.cwd(), "scripts/check-semgrep-changed.sh"),
				"utf-8",
			),
			"utf-8",
		);
		chmodSync(join(tempDir, "scripts/check-semgrep-changed.sh"), 0o755);
		writeFileSync(
			join(tempDir, "scripts/semgrep-pre-push.yml"),
			readFileSync(
				join(process.cwd(), "scripts/semgrep-pre-push.yml"),
				"utf-8",
			),
			"utf-8",
		);
		return tempDir;
	}

	it("returns usage error for unknown options", () => {
		const tempDir = scaffoldScriptRoot();
		const result = run(tempDir, ["--invalid-option"]);

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("Error: unknown option '--invalid-option'");
		expect(result.stderr).toContain(
			"Usage: bash scripts/check-semgrep-changed.sh [--changed|--all]",
		);
	});

	it("prints help and exits successfully when --help is passed", () => {
		const tempDir = scaffoldScriptRoot();
		const result = run(tempDir, ["--help"]);

		expect(result.status).toBe(0);
		expect(result.stderr).toContain(
			"Usage: bash scripts/check-semgrep-changed.sh [--changed|--all]",
		);
	});

	it("fails when the Semgrep ruleset file is missing", () => {
		const tempDir = scaffoldScriptRoot();
		rmSync(join(tempDir, "scripts/semgrep-pre-push.yml"));

		const result = run(tempDir, []);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain("Error: missing Semgrep ruleset");
	});

	it("exits cleanly when no comparison base is available for changed-file scans", () => {
		const tempDir = scaffoldScriptRoot();
		writeFileSync(join(tempDir, "src/feature.ts"), "export const ok = 1;\n");
		const callsLogPath = join(tempDir, "semgrep-calls.log");
		const semgrepCacheRoot = installFakeSemgrep(tempDir, callsLogPath);

		const result = run(tempDir, [], {
			SEMGREP_CACHE_ROOT: semgrepCacheRoot,
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"No comparison base available for Semgrep changed-file scan.",
		);
	});

	it("exits cleanly when no changed implementation files are detected", () => {
		const tempDir = scaffoldScriptRoot();
		initRepository(tempDir);
		writeFileSync(join(tempDir, "src/feature.ts"), "export const ok = 1;\n");
		commitAll(tempDir, "initial");
		writeFileSync(join(tempDir, "README.md"), "docs only change\n");
		commitAll(tempDir, "docs change");

		const callsLogPath = join(tempDir, "semgrep-calls.log");
		const semgrepCacheRoot = installFakeSemgrep(tempDir, callsLogPath);
		const result = run(tempDir, ["--changed"], {
			SEMGREP_CACHE_ROOT: semgrepCacheRoot,
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"No changed src/** implementation files detected for Semgrep.",
		);
	});

	it("reinstalls Semgrep when the cached binary version mismatches", () => {
		const tempDir = scaffoldScriptRoot();
		writeFileSync(join(tempDir, "src/feature.ts"), "export const ok = 1;\n");

		const semgrepCacheRoot = join(tempDir, ".fake-semgrep-cache");
		const isolatedHostCache = join(tempDir, ".isolated-host-cache");
		const semgrepVenvDir = join(
			semgrepCacheRoot,
			`semgrep-venv-${SEMGREP_VERSION}`,
		);
		const semgrepBin = join(semgrepVenvDir, "bin", "semgrep");
		const reinstallLog = join(tempDir, "semgrep-reinstall.log");
		const semgrepCallsLog = join(tempDir, "semgrep-calls.log");
		mkdirSync(join(semgrepBin, ".."), { recursive: true });
		writeExecutable(
			semgrepBin,
			`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
	echo "0.0.0"
	exit 0
fi
printf '%s\\n' "$*" >> "${semgrepCallsLog}"
`,
		);

		const binDir = join(tempDir, "bin");
		mkdirSync(binDir, { recursive: true });
		writeExecutable(
			join(binDir, "python3"),
			`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "-m" && "\${2:-}" == "venv" ]]; then
	venv_dir="\${3:?missing-venv-dir}"
	mkdir -p "$venv_dir/bin"
	cat > "$venv_dir/bin/python" <<'PY'
#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "-m" && "\${2:-}" == "pip" ]]; then
	bin_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
	cat > "$bin_dir/semgrep" <<'SG'
#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
	echo "${SEMGREP_VERSION}"
	exit 0
fi
printf '%s\\n' "$*" >> "${semgrepCallsLog}"
SG
	chmod +x "$bin_dir/semgrep"
	exit 0
fi
exit 0
PY
	chmod +x "$venv_dir/bin/python"
	printf 'venv-created\\n' >> "${reinstallLog}"
	exit 0
fi
exit 1
`,
		);

		const result = run(tempDir, ["--all"], {
			SEMGREP_CACHE_ROOT: semgrepCacheRoot,
			XDG_CACHE_HOME: isolatedHostCache,
			PATH: `${binDir}:${process.env.PATH ?? ""}`,
		});

		expect(result.status).toBe(0);
		expect(readFileSync(reinstallLog, "utf-8")).toContain("venv-created");
		const scannedFiles = extractScannedSourceFiles(semgrepCallsLog);
		expect(scannedFiles).toContain("src/feature.ts");
	});

	it("scans only implementation files in --all mode", () => {
		const tempDir = scaffoldScriptRoot();
		writeFileSync(join(tempDir, "src/feature.ts"), "export const ok = 1;\n");
		writeFileSync(
			join(tempDir, "src/feature.test.ts"),
			"import { ok } from './feature';\n",
		);
		writeFileSync(join(tempDir, "src/types.d.ts"), "export type T = string;\n");
		mkdirSync(join(tempDir, "src/nested"), { recursive: true });
		writeFileSync(
			join(tempDir, "src/nested/view.tsx"),
			"export const View = 1;\n",
		);

		const callsLogPath = join(tempDir, "semgrep-calls.log");
		const semgrepCacheRoot = installFakeSemgrep(tempDir, callsLogPath);
		const result = run(tempDir, ["--all"], {
			SEMGREP_CACHE_ROOT: semgrepCacheRoot,
		});

		expect(result.status).toBe(0);
		const scannedFiles = extractScannedSourceFiles(callsLogPath);
		expect(new Set(scannedFiles)).toEqual(
			new Set(["src/feature.ts", "src/nested/view.tsx"]),
		);
	});

	it("uses changed-file mode against git merge-base fallback", () => {
		const tempDir = scaffoldScriptRoot();
		initRepository(tempDir);
		writeFileSync(
			join(tempDir, "src/unchanged.ts"),
			"export const unchanged = 1;\n",
		);
		writeFileSync(join(tempDir, "src/changed.ts"), "export const value = 1;\n");
		commitAll(tempDir, "initial");
		const checkoutResult = spawnSync(
			"git",
			["checkout", "-b", "feature/semgrep-test"],
			{
				cwd: tempDir,
				encoding: "utf-8",
			},
		);
		if (checkoutResult.status !== 0) {
			throw new Error(`git checkout failed: ${checkoutResult.stderr}`);
		}
		writeFileSync(join(tempDir, "src/changed.ts"), "export const value = 2;\n");
		writeFileSync(
			join(tempDir, "src/changed.spec.ts"),
			"import { value } from './changed';\n",
		);
		commitAll(tempDir, "changed implementation");

		const callsLogPath = join(tempDir, "semgrep-calls.log");
		const semgrepCacheRoot = installFakeSemgrep(tempDir, callsLogPath);
		const result = run(tempDir, [], {
			SEMGREP_CACHE_ROOT: semgrepCacheRoot,
		});

		expect(result.status).toBe(0);
		const scannedFiles = extractScannedSourceFiles(callsLogPath);
		expect(new Set(scannedFiles)).toEqual(new Set(["src/changed.ts"]));
	});

	it("uses changed-file mode when --changed is passed explicitly", () => {
		const tempDir = scaffoldScriptRoot();
		initRepository(tempDir);
		writeFileSync(
			join(tempDir, "src/unchanged.ts"),
			"export const unchanged = 1;\n",
		);
		writeFileSync(join(tempDir, "src/changed.ts"), "export const value = 1;\n");
		commitAll(tempDir, "initial");
		const checkoutResult = spawnSync(
			"git",
			["checkout", "-b", "feature/semgrep-test-changed-flag"],
			{
				cwd: tempDir,
				encoding: "utf-8",
			},
		);
		if (checkoutResult.status !== 0) {
			throw new Error(`git checkout failed: ${checkoutResult.stderr}`);
		}
		writeFileSync(join(tempDir, "src/changed.ts"), "export const value = 2;\n");
		writeFileSync(
			join(tempDir, "src/changed.spec.ts"),
			"import { value } from './changed';\n",
		);
		commitAll(tempDir, "changed implementation");

		const callsLogPath = join(tempDir, "semgrep-calls.log");
		const semgrepCacheRoot = installFakeSemgrep(tempDir, callsLogPath);
		const result = run(tempDir, ["--changed"], {
			SEMGREP_CACHE_ROOT: semgrepCacheRoot,
		});

		expect(result.status).toBe(0);
		const scannedFiles = extractScannedSourceFiles(callsLogPath);
		expect(new Set(scannedFiles)).toEqual(new Set(["src/changed.ts"]));
	});

	it("batches --all scans and covers every file exactly once", () => {
		const tempDir = scaffoldScriptRoot();
		const fileCount = 205;
		const expectedFiles: string[] = [];
		for (let index = 0; index < fileCount; index += 1) {
			const filePath = `src/file-${String(index).padStart(3, "0")}.ts`;
			expectedFiles.push(filePath);
			writeFileSync(
				join(tempDir, filePath),
				`export const value${index} = ${index};\n`,
			);
		}

		const callsLogPath = join(tempDir, "semgrep-calls.log");
		const semgrepCacheRoot = installFakeSemgrep(tempDir, callsLogPath);
		const result = run(tempDir, ["--all"], {
			SEMGREP_CACHE_ROOT: semgrepCacheRoot,
		});

		expect(result.status).toBe(0);
		const callLines = readFileSync(callsLogPath, "utf-8")
			.split(/\r?\n/)
			.filter((line) => line.trim().length > 0);
		expect(callLines).toHaveLength(2);

		const scannedFiles = extractScannedSourceFiles(callsLogPath);
		expect(scannedFiles).toHaveLength(fileCount);
		expect(new Set(scannedFiles)).toEqual(new Set(expectedFiles));
	});
});
