/**
 * Tests for codex preflight path-guard contracts across runtime and scaffold templates.
 *
 * This function gates a narrow, repo-configured exception: the CODESTYLE.md
 * symlink may resolve outside the repo root only when the link target or the
 * resolved absolute path matches an entry in the repo-local allow-list.
 */
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// ─── Constants ────────────────────────────────────────────────────────────────

/** The canonical symlink target pattern accepted by the guard. */
const ALLOWED_LINK_TARGET = join(
	homedir(),
	".codex",
	"instructions",
	"CODESTYLE.md",
);
/** One allowed resolved absolute path. */
const ALLOWED_ABS_1 = join(tmpdir(), "codex-preflight-allowed", "CODESTYLE.md");
/** Another allowed resolved absolute path. */
const ALLOWED_ABS_2 = join(homedir(), ".codex", "instructions", "CODESTYLE.md");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PREFLIGHT_PATH = join(process.cwd(), "scripts/codex-preflight.sh");
const SYNC_SCRIPT_PATH = join(
	process.cwd(),
	"scripts/sync-codex-preflight.cjs",
);

function writeAllowList(root: string, entries: string[]): void {
	mkdirSync(join(root, ".codex"), { recursive: true });
	writeFileSync(
		join(root, ".codex/preflight-allowed-external-paths.txt"),
		`${entries.join("\n")}\n`,
		"utf-8",
	);
}

/**
 * Runs a bash snippet that sources codex-preflight.sh and then calls
 * is_allowed_repo_external_path with the provided arguments. Returns the exit
 * code of the function call.
 */
function runIsAllowedRepoExternalPath(
	root: string,
	matchArg: string,
	abs: string,
	cwd: string,
): number {
	const script = [
		`source "${PREFLIGHT_PATH}"`,
		`is_allowed_repo_external_path "${root}" "${matchArg}" "${abs}"`,
	].join("\n");

	const result = spawnSync("bash", ["-c", script], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, CODEX_PREFLIGHT_ALLOW_SOURCE: "1" },
	});

	return result.status ?? 127;
}

type SpawnEnv = Record<string, string | undefined>;

function runEmitNorthStarSummary(
	contractPath: string,
	cwd: string,
	env: SpawnEnv = {},
): { status: number; stdout: string; stderr: string } {
	const script = [
		`source "${PREFLIGHT_PATH}"`,
		`emit_north_star_summary "${contractPath}"`,
	].join("\n");

	const result = spawnSync("bash", ["-c", script], {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			...env,
			CODEX_PREFLIGHT_ALLOW_SOURCE: "1",
		},
	});

	return {
		status: result.status ?? 127,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("is_allowed_repo_external_path", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-preflight-symlink-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns failure (1) when root has no allow-list entry for the symlink target", () => {
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));

		const status = runIsAllowedRepoExternalPath(
			tempDir,
			"CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns failure (1) when match is not CODESTYLE.md", () => {
		// Create a different symlink name
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "OTHER.md"));
		writeAllowList(tempDir, [ALLOWED_LINK_TARGET]);

		const status = runIsAllowedRepoExternalPath(
			tempDir,
			"OTHER.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns failure (1) when the match path is a regular file, not a symlink", () => {
		// Create a plain file (not a symlink)
		writeFileSync(join(tempDir, "CODESTYLE.md"), "# Code Style\n", "utf-8");
		writeAllowList(tempDir, [ALLOWED_LINK_TARGET]);

		const status = runIsAllowedRepoExternalPath(
			tempDir,
			"CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns failure (1) when the match path does not exist", () => {
		// Do not create any file at CODESTYLE.md
		writeAllowList(tempDir, [ALLOWED_LINK_TARGET]);
		const status = runIsAllowedRepoExternalPath(
			tempDir,
			"CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns failure (1) when symlink target is a different path", () => {
		// Symlink points to a different target
		symlinkSync("/some/other/path.md", join(tempDir, "CODESTYLE.md"));
		writeAllowList(tempDir, [ALLOWED_LINK_TARGET]);

		const status = runIsAllowedRepoExternalPath(
			tempDir,
			"CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns success (0) when the symlink target itself matches an allow-list entry", () => {
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));
		writeAllowList(tempDir, [ALLOWED_LINK_TARGET]);

		const status = runIsAllowedRepoExternalPath(
			tempDir,
			"CODESTYLE.md",
			"/some/unexpected/resolved/path.md",
			tempDir,
		);
		expect(status).toBe(0);
	});

	it("returns success (0) when all conditions match and abs is the first allowed path", () => {
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));
		writeAllowList(tempDir, [ALLOWED_ABS_1]);

		const status = runIsAllowedRepoExternalPath(
			tempDir,
			"CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(0);
	});

	it("returns success (0) when all conditions match and abs is the second allowed path", () => {
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));
		writeAllowList(tempDir, [ALLOWED_ABS_2]);

		const status = runIsAllowedRepoExternalPath(
			tempDir,
			"CODESTYLE.md",
			ALLOWED_ABS_2,
			tempDir,
		);
		expect(status).toBe(0);
	});

	it("returns failure (1) when neither link_target nor abs match the allow-list", () => {
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));
		writeAllowList(tempDir, ["/Users/jamiecraik/.codex/instructions/OTHER.md"]);

		const status = runIsAllowedRepoExternalPath(
			tempDir,
			"CODESTYLE.md",
			"/Users/jamiecraik/.codex/instructions/DIFFERENT.md",
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("is a narrowly-scoped guard: second argument must be exactly 'CODESTYLE.md', not a path", () => {
		// match with a path prefix should not be allowed
		mkdirSync(join(tempDir, "subdir"), { recursive: true });
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "subdir/CODESTYLE.md"));
		writeAllowList(tempDir, [ALLOWED_LINK_TARGET]);

		const status = runIsAllowedRepoExternalPath(
			tempDir,
			"subdir/CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});
});

// ─── check_paths integration ──────────────────────────────────────────────────

describe("check_paths with is_allowed_repo_external_path exemption", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-check-paths-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	/**
	 * Runs check_paths from the sourced preflight script and returns stdout+stderr
	 * and exit code.
	 */
	function runCheckPaths(
		root: string,
		paths: string,
		cwd: string,
		env?: SpawnEnv,
	): { stdout: string; stderr: string; status: number } {
		const script = [
			`source "${PREFLIGHT_PATH}"`,
			`check_paths "${root}" "${paths}"`,
		].join("\n");

		const result = spawnSync("bash", ["-c", script], {
			cwd,
			encoding: "utf8",
			env: {
				...process.env,
				...env,
				CODEX_PREFLIGHT_ALLOW_SOURCE: "1",
			},
		});

		return {
			stdout: result.stdout ?? "",
			stderr: result.stderr ?? "",
			status: result.status ?? 127,
		};
	}

	it("allows CODESTYLE.md symlink to external path when all conditions are met", () => {
		const fakeHome = join(tempDir, "home");
		const fakeTarget = join(fakeHome, ".codex", "instructions", "CODESTYLE.md");
		mkdirSync(join(fakeHome, ".codex", "instructions"), { recursive: true });
		writeFileSync(fakeTarget, "# Code Style\n", "utf-8");
		// Create the CODESTYLE.md symlink pointing to the canonical allowed target
		symlinkSync(fakeTarget, join(tempDir, "CODESTYLE.md"));

		writeAllowList(tempDir, ["$HOME/.codex/instructions/CODESTYLE.md"]);

		const { stdout, stderr, status } = runCheckPaths(
			tempDir,
			"CODESTYLE.md",
			tempDir,
			{ HOME: fakeHome },
		);

		// Should not produce an "escapes repo root" error.
		expect(stderr + stdout).not.toContain("path escapes repo root");
		// Exit code should be 0 (success).
		expect(status).toBe(0);
	});

	it("still fails when a non-CODESTYLE.md path resolves outside repo root", () => {
		// Create a symlink for a different file that points outside repo root
		symlinkSync("/etc/hosts", join(tempDir, "OUTSIDE.md"));

		const { stdout, stderr, status } = runCheckPaths(
			tempDir,
			"OUTSIDE.md",
			tempDir,
		);

		// Should produce an "escapes repo root" error
		expect(stderr + stdout).toContain("path escapes repo root");
		expect(status).toBe(2);
	});
});

describe("workspace git resolution fallback", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-preflight-git-root-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	function runResolveWorkspaceGitRoot(workspaceRoot: string): {
		stdout: string;
		stderr: string;
		status: number;
	} {
		const script = [
			`source "${PREFLIGHT_PATH}"`,
			`WORKSPACE_ROOT="${workspaceRoot}"`,
			"if ! resolve_workspace_git_root; then",
			'  echo "resolve_failed"',
			"  exit 64",
			"fi",
			'echo "resolved_root=${WORKSPACE_GIT_ROOT}"',
			'echo "used_override=${WORKSPACE_GIT_USE_WORKTREE_OVERRIDE}"',
			'[[ "$(workspace_git rev-parse --is-inside-work-tree)" == "true" ]]',
		].join("\n");

		const result = spawnSync("bash", ["-c", script], {
			cwd: workspaceRoot,
			encoding: "utf8",
			env: {
				...process.env,
				CODEX_PREFLIGHT_ALLOW_SOURCE: "1",
			},
		});

		return {
			stdout: result.stdout ?? "",
			stderr: result.stderr ?? "",
			status: result.status ?? 127,
		};
	}

	it("falls back to core.worktree override when repository metadata points at stale worktree path", () => {
		const repoRoot = join(tempDir, "repo");
		mkdirSync(repoRoot, { recursive: true });
		expect(
			spawnSync("git", ["init"], {
				cwd: repoRoot,
				encoding: "utf8",
			}).status,
		).toBe(0);
		expect(
			spawnSync(
				"git",
				["config", "core.worktree", join(tempDir, "stale-worktree-path")],
				{
					cwd: repoRoot,
					encoding: "utf8",
				},
			).status,
		).toBe(0);

		const result = runResolveWorkspaceGitRoot(repoRoot);
		const canonicalRepoRoot = realpathSync(repoRoot);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`resolved_root=${canonicalRepoRoot}`);
		expect(result.stdout).toContain("used_override=1");
	});

	it("uses normal git context when core.worktree metadata is valid", () => {
		const repoRoot = join(tempDir, "repo");
		mkdirSync(repoRoot, { recursive: true });
		expect(
			spawnSync("git", ["init"], {
				cwd: repoRoot,
				encoding: "utf8",
			}).status,
		).toBe(0);

		const result = runResolveWorkspaceGitRoot(repoRoot);
		const canonicalRepoRoot = realpathSync(repoRoot);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`resolved_root=${canonicalRepoRoot}`);
		expect(result.stdout).toContain("used_override=0");
	});
});

describe("codex-preflight entrypoint failure paths", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-preflight-entrypoint-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("succeeds in main flow when core.worktree is stale by using workspace override fallback", () => {
		const repoRoot = join(tempDir, "repo");
		mkdirSync(repoRoot, { recursive: true });
		expect(
			spawnSync("git", ["init"], {
				cwd: repoRoot,
				encoding: "utf8",
			}).status,
		).toBe(0);
		expect(
			spawnSync(
				"git",
				["config", "core.worktree", join(tempDir, "stale-worktree-path")],
				{
					cwd: repoRoot,
					encoding: "utf8",
				},
			).status,
		).toBe(0);

		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		const copiedScript = join(scriptsDir, "codex-preflight.sh");
		copyFileSync(PREFLIGHT_PATH, copiedScript);
		chmodSync(copiedScript, 0o755);

		const result = spawnSync(
			"bash",
			[
				copiedScript,
				"--stack",
				"repo",
				"--mode",
				"off",
				"--bins",
				"git",
				"--paths",
				"scripts",
			],
			{
				cwd: repoRoot,
				encoding: "utf8",
				env: {
					...process.env,
				},
			},
		);

		const canonicalRepoRoot = realpathSync(repoRoot);
		expect(result.status).toBe(0);
		expect(`${result.stdout}${result.stderr}`).toContain(
			`git root: ${canonicalRepoRoot}`,
		);
		expect(`${result.stdout}${result.stderr}`).toContain("preflight passed");
	});

	it("returns usage-style failure when workspace git validation fails", () => {
		const scriptsDir = join(tempDir, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		const copiedScript = join(scriptsDir, "codex-preflight.sh");
		copyFileSync(PREFLIGHT_PATH, copiedScript);
		chmodSync(copiedScript, 0o755);

		const binDir = join(tempDir, "bin");
		mkdirSync(binDir, { recursive: true });
		const fakeGitPath = join(binDir, "git");
		writeFileSync(
			fakeGitPath,
			`#!/usr/bin/env bash
set -euo pipefail
workspace="$PWD"
if [[ "$#" -ge 2 && "$1" == "-C" ]]; then
	workspace="$2"
	shift 2
fi
if [[ "$#" -ge 2 && "$1" == "rev-parse" && "$2" == "--show-toplevel" ]]; then
	echo "$workspace"
	exit 0
fi
if [[ "$#" -ge 2 && "$1" == "rev-parse" && "$2" == "--is-inside-work-tree" ]]; then
	echo "false"
	exit 0
fi
exit 0
`,
			"utf-8",
		);
		chmodSync(fakeGitPath, 0o755);

		const result = spawnSync(
			"bash",
			[
				copiedScript,
				"--stack",
				"repo",
				"--mode",
				"off",
				"--bins",
				"git",
				"--paths",
				"",
			],
			{
				cwd: tempDir,
				encoding: "utf8",
				env: {
					...process.env,
					PATH: `${binDir}:${process.env.PATH ?? ""}`,
				},
			},
		);

		expect(result.status).toBe(2);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"git workspace validation failed for current workspace root",
		);
	});

	it("fails closed in required mode when north-star summary cannot be resolved", () => {
		const repoRoot = join(tempDir, "repo-required");
		mkdirSync(repoRoot, { recursive: true });
		expect(
			spawnSync("git", ["init"], {
				cwd: repoRoot,
				encoding: "utf8",
			}).status,
		).toBe(0);

		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		const copiedScript = join(scriptsDir, "codex-preflight.sh");
		copyFileSync(PREFLIGHT_PATH, copiedScript);
		chmodSync(copiedScript, 0o755);
		writeFileSync(
			join(repoRoot, "harness.contract.json"),
			JSON.stringify({ version: "1.6.0" }),
			"utf-8",
		);

		const result = spawnSync(
			"bash",
			[
				copiedScript,
				"--stack",
				"repo",
				"--mode",
				"required",
				"--bins",
				"git",
				"--paths",
				"scripts,harness.contract.json",
			],
			{
				cwd: repoRoot,
				encoding: "utf8",
				env: {
					...process.env,
				},
			},
		);

		expect(result.status).toBe(2);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"north-star summary unresolved (required mode)",
		);
	});

	it("keeps unresolved north-star summary advisory in optional mode", () => {
		const repoRoot = join(tempDir, "repo-optional");
		mkdirSync(repoRoot, { recursive: true });
		expect(
			spawnSync("git", ["init"], {
				cwd: repoRoot,
				encoding: "utf8",
			}).status,
		).toBe(0);

		const scriptsDir = join(repoRoot, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		const copiedScript = join(scriptsDir, "codex-preflight.sh");
		copyFileSync(PREFLIGHT_PATH, copiedScript);
		chmodSync(copiedScript, 0o755);
		writeFileSync(
			join(repoRoot, "harness.contract.json"),
			JSON.stringify({ version: "1.6.0" }),
			"utf-8",
		);

		const result = spawnSync(
			"bash",
			[
				copiedScript,
				"--stack",
				"repo",
				"--mode",
				"optional",
				"--bins",
				"git",
				"--paths",
				"scripts,harness.contract.json",
			],
			{
				cwd: repoRoot,
				encoding: "utf8",
				env: {
					...process.env,
				},
			},
		);

		expect(result.status).toBe(0);
		expect(`${result.stdout}${result.stderr}`).toContain(
			"north-star summary unresolved (optional mode)",
		);
	});
});

describe("emit_north_star_summary", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-preflight-north-star-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("prints mission/metric/bottleneck/autonomy/safety output when northStar is present", () => {
		const contractPath = join(tempDir, "harness.contract.json");
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.6.0",
				northStar: {
					mission:
						"Coding Harness exists to let humans steer and agents execute safely.",
					primaryMetric: "pr_lead_time",
					primaryBottleneck: "review_rework_loop",
					autonomyBoundary: "low-medium only",
					safetyFloor: ["strict sha", "deterministic evidence"],
				},
			}),
			"utf-8",
		);

		const result = runEmitNorthStarSummary(contractPath, tempDir);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(0);
		expect(combinedOutput).toContain("North-Star Summary");
		expect(combinedOutput).toContain(
			"mission: Coding Harness exists to let humans steer and agents execute safely.",
		);
		expect(combinedOutput).toContain("primary metric: pr_lead_time");
		expect(combinedOutput).toContain("primary bottleneck: review_rework_loop");
		expect(combinedOutput).toContain("autonomy boundary: low-medium only");
		expect(combinedOutput).toContain(
			"safety floor: strict sha | deterministic evidence",
		);
	});

	it("logs a missing warning when contract northStar block is absent", () => {
		const contractPath = join(tempDir, "harness.contract.json");
		writeFileSync(contractPath, JSON.stringify({ version: "1.6.0" }), "utf-8");

		const result = runEmitNorthStarSummary(contractPath, tempDir);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain(
			"north-star summary skipped: contract northStar block missing",
		);
	});

	it("logs an error::* warning when contract JSON parsing fails", () => {
		const contractPath = join(tempDir, "harness.contract.json");
		writeFileSync(contractPath, "{invalid-json", "utf-8");

		const result = runEmitNorthStarSummary(contractPath, tempDir);
		const combinedOutput = `${result.stdout}${result.stderr}`;

		expect(result.status).toBe(1);
		expect(combinedOutput).toContain("north-star summary skipped:");
		expect(combinedOutput).not.toContain("unexpected parser output");
	});

	it("logs unexpected parser output warning for unknown parser status", () => {
		const contractPath = join(tempDir, "harness.contract.json");
		writeFileSync(contractPath, JSON.stringify({ version: "1.6.0" }), "utf-8");
		const script = [
			`source "${PREFLIGHT_PATH}"`,
			"python3() { printf 'mystery-status\\n'; }",
			`emit_north_star_summary "${contractPath}"`,
		].join("\n");
		const spawned = spawnSync("bash", ["-c", script], {
			cwd: tempDir,
			encoding: "utf8",
			env: {
				...process.env,
				CODEX_PREFLIGHT_ALLOW_SOURCE: "1",
			},
		});
		const combinedOutput = `${spawned.stdout ?? ""}${spawned.stderr ?? ""}`;

		expect(spawned.status).toBe(1);
		expect(combinedOutput).toContain(
			"north-star summary skipped: unexpected parser output",
		);
	});
});

// ─── Template sync guard ──────────────────────────────────────────────────────

describe("codex-preflight.sh contract coverage", () => {
	function extractShellFunction(
		script: string,
		functionName: string,
	): string | undefined {
		// Escape special regex characters to prevent ReDoS
		const escapedFunctionName = functionName.replace(
			/[.*+?^${}()|[\]\\]/g,
			"\\$&",
		);
		const functionPattern = new RegExp(
			`${escapedFunctionName}\\(\\)[\\s\\S]*?(?=\\n[A-Za-z_][A-Za-z0-9_]*\\(\\)\\s*\\{|$)`,
		);
		return script.match(functionPattern)?.[0];
	}

	it("scripts/codex-preflight.sh and src/templates/codex-preflight.sh both contain is_allowed_repo_external_path", () => {
		const runtimeScript = readFileSync(
			join(process.cwd(), "scripts/codex-preflight.sh"),
			"utf-8",
		);
		const templateScript = readFileSync(
			join(process.cwd(), "src/templates/codex-preflight.sh"),
			"utf-8",
		);

		expect(runtimeScript).toContain("is_allowed_repo_external_path");
		expect(templateScript).toContain("is_allowed_repo_external_path");
	});

	it("both script copies include worktree-aware git root fallback helper", () => {
		const runtimeScript = readFileSync(
			join(process.cwd(), "scripts/codex-preflight.sh"),
			"utf-8",
		);
		const templateScript = readFileSync(
			join(process.cwd(), "src/templates/codex-preflight.sh"),
			"utf-8",
		);

		expect(runtimeScript).toContain("resolve_workspace_git_root");
		expect(runtimeScript).toContain('GIT_WORK_TREE="${WORKSPACE_ROOT}"');
		expect(runtimeScript).toContain(
			"workspace_git rev-parse --is-inside-work-tree",
		);
		expect(templateScript).toContain("resolve_workspace_git_root");
		expect(templateScript).toContain('GIT_WORK_TREE="${WORKSPACE_ROOT}"');
		expect(templateScript).toContain(
			"workspace_git rev-parse --is-inside-work-tree",
		);
	});

	it("both script copies contain is_allowed_repo_external_path guard semantics", () => {
		const runtimeScript = readFileSync(
			join(process.cwd(), "scripts/codex-preflight.sh"),
			"utf-8",
		);
		const templateScript = readFileSync(
			join(process.cwd(), "src/templates/codex-preflight.sh"),
			"utf-8",
		);

		const runtimeMatch = extractShellFunction(
			runtimeScript,
			"is_allowed_repo_external_path",
		);
		const templateMatch = extractShellFunction(
			templateScript,
			"is_allowed_repo_external_path",
		);

		expect(runtimeMatch).toBeTruthy();
		expect(templateMatch).toBeTruthy();
		expect(runtimeMatch).toContain('if [[ "${match}" != "CODESTYLE.md" ]]');
		expect(runtimeMatch).toContain('case "${link_target}" in');
		expect(runtimeMatch).toContain("*/.codex/instructions/CODESTYLE.md)");
		expect(templateMatch).toContain('if [[ "${match}" != "CODESTYLE.md" ]]');
		expect(templateMatch).toContain('case "${link_target}" in');
		expect(templateMatch).toContain("*/.codex/instructions/CODESTYLE.md)");
	});

	it("check_paths calls is_allowed_repo_external_path before logging path-escape error", () => {
		const runtimeScript = readFileSync(
			join(process.cwd(), "scripts/codex-preflight.sh"),
			"utf-8",
		);
		const templateScript = readFileSync(
			join(process.cwd(), "src/templates/codex-preflight.sh"),
			"utf-8",
		);

		function expectCallOrder(script: string): void {
			const checkPathsMatch = extractShellFunction(script, "check_paths");
			expect(checkPathsMatch).toBeTruthy();

			const checkPathsBlock = checkPathsMatch!;

			// Search within check_paths for the invocation pattern.
			const allowedCallIndex = checkPathsBlock.indexOf(
				'is_allowed_repo_external_path "${root}" "${match}" "${abs}"',
			);
			const escapeErrIndex = checkPathsBlock.indexOf("path escapes repo root");

			expect(allowedCallIndex).toBeGreaterThan(-1);
			expect(escapeErrIndex).toBeGreaterThan(-1);
			// The allow call invocation must come before the error log in check_paths.
			expect(allowedCallIndex).toBeLessThan(escapeErrIndex);
		}

		expectCallOrder(runtimeScript);
		expectCallOrder(templateScript);
	});
	it("scaffolds the legacy Local Memory fallback script in both runtime and template locations", () => {
		const runtimeFallback = readFileSync(
			join(process.cwd(), "scripts/codex-preflight-local-memory-legacy.sh"),
			"utf-8",
		);
		const templateFallback = readFileSync(
			join(
				process.cwd(),
				"src/templates/codex-preflight-local-memory-legacy.sh",
			),
			"utf-8",
		);

		expect(runtimeFallback).toContain("preflight_local_memory_shell_fallback");
		expect(templateFallback).toContain("preflight_local_memory_shell_fallback");
		expect(runtimeFallback).toBe(templateFallback);
	});

	it("keeps the legacy Local Memory fallback on targeted rest_api validation and bounded health retries", () => {
		const runtimeFallback = readFileSync(
			join(process.cwd(), "scripts/codex-preflight-local-memory-legacy.sh"),
			"utf-8",
		);
		const templateFallback = readFileSync(
			join(
				process.cwd(),
				"src/templates/codex-preflight-local-memory-legacy.sh",
			),
			"utf-8",
		);

		function expectFallbackContracts(script: string): void {
			expect(script).toContain(
				'curl -fsS --connect-timeout 2 --max-time 5 "${health_url}"',
			);
			expect(script).toContain(
				'rest_host="$(extract_local_memory_rest_value "${lm_config_path}" host)"',
			);
			expect(script).toContain(
				'rest_auto_port="$(extract_local_memory_rest_value "${lm_config_path}" auto_port)"',
			);
			expect(script).not.toContain(
				'rg -q \'^[[:space:]]*host:[[:space:]]*"?127\\.0\\.0\\.1"?',
			);
		}

		expectFallbackContracts(runtimeFallback);
		expectFallbackContracts(templateFallback);
	});

	it("continues to the next harness runner when a Local Memory helper returns sentinel 3", () => {
		const runtimeScript = readFileSync(
			join(process.cwd(), "scripts/codex-preflight.sh"),
			"utf-8",
		);
		const templateScript = readFileSync(
			join(process.cwd(), "src/templates/codex-preflight.sh"),
			"utf-8",
		);

		function expectSentinelFallback(script: string): void {
			const helperMatch = extractShellFunction(
				script,
				"run_local_memory_preflight_via_harness",
			);
			expect(helperMatch).toBeTruthy();

			const helperBlock = helperMatch!;
			expect(helperBlock).toContain("local status=3");
			expect(helperBlock).not.toContain("return $?");
			expect(
				helperBlock.match(/if \[\[ "\$\{status\}" -ne 3 \]\]; then/g)?.length,
			).toBe(5);
		}

		expectSentinelFallback(runtimeScript);
		expectSentinelFallback(templateScript);
	});
});

describe("codex-preflight sync script", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-preflight-sync-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	function runSyncScript(args: string[]): {
		stdout: string;
		stderr: string;
		status: number;
	} {
		const result = spawnSync("node", [SYNC_SCRIPT_PATH, ...args], {
			cwd: process.cwd(),
			encoding: "utf8",
		});

		return {
			stdout: result.stdout ?? "",
			stderr: result.stderr ?? "",
			status: result.status ?? 127,
		};
	}

	it("fails in check mode when the runtime copy drifts from the canonical template", () => {
		const sourcePath = join(tempDir, "canonical.sh");
		const targetPath = join(tempDir, "runtime.sh");

		writeFileSync(sourcePath, "#!/usr/bin/env bash\necho canonical\n", "utf-8");
		writeFileSync(targetPath, "#!/usr/bin/env bash\necho drifted\n", "utf-8");

		const result = runSyncScript([
			"--check",
			"--source",
			sourcePath,
			"--target",
			targetPath,
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("target drift detected");
	});

	it("writes the runtime copy from the canonical template and sets executable mode", () => {
		const sourcePath = join(tempDir, "canonical.sh");
		const targetPath = join(tempDir, "runtime.sh");

		writeFileSync(sourcePath, "#!/usr/bin/env bash\necho canonical\n", "utf-8");
		writeFileSync(targetPath, "#!/usr/bin/env bash\necho drifted\n", "utf-8");

		const writeResult = runSyncScript([
			"--write",
			"--source",
			sourcePath,
			"--target",
			targetPath,
		]);
		expect(writeResult.status).toBe(0);

		const checkResult = runSyncScript([
			"--check",
			"--source",
			sourcePath,
			"--target",
			targetPath,
		]);
		expect(checkResult.status).toBe(0);
		expect(readFileSync(targetPath, "utf-8")).toBe(
			readFileSync(sourcePath, "utf-8"),
		);
		expect(statSync(targetPath).mode & 0o111).toBeTruthy();
	});
});
