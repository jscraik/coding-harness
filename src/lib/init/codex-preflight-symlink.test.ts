/**
 * Tests for the `is_allowed_repo_external_path` function added to
 * scripts/codex-preflight.sh and src/templates/codex-preflight.sh.
 *
 * This function gates a narrow, repo-configured exception: the CODESTYLE.md
 * symlink may resolve outside the repo root only when the link target or the
 * resolved absolute path matches an entry in the repo-local allow-list.
 */
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
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
	});

	return result.status ?? 127;
}

type SpawnEnv = Record<string, string | undefined>;

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
			env: { ...process.env, ...env },
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

// ─── Template sync guard ──────────────────────────────────────────────────────

describe("codex-preflight.sh template sync", () => {
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

	it("both script copies have identical is_allowed_repo_external_path function body", () => {
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
		expect(runtimeMatch).toBe(templateMatch);
	});

	it("check_paths calls is_allowed_repo_external_path before logging path-escape error", () => {
		const runtimeScript = readFileSync(
			join(process.cwd(), "scripts/codex-preflight.sh"),
			"utf-8",
		);

		const checkPathsMatch = extractShellFunction(runtimeScript, "check_paths");
		expect(checkPathsMatch).toBeTruthy();

		const checkPathsBlock = checkPathsMatch!;

		// Search within check_paths for the invocation pattern
		const allowedCallIndex = checkPathsBlock.indexOf(
			'is_allowed_repo_external_path "${root}" "${match}" "${abs}"',
		);
		const escapeErrIndex = checkPathsBlock.indexOf("path escapes repo root");

		expect(allowedCallIndex).toBeGreaterThan(-1);
		expect(escapeErrIndex).toBeGreaterThan(-1);
		// The allow call invocation must come before the error log in check_paths
		expect(allowedCallIndex).toBeLessThan(escapeErrIndex);
	});
});
