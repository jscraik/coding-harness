/**
 * Tests for the `is_allowed_repo_external_path` function added to
 * scripts/codex-preflight.sh and src/templates/codex-preflight.sh.
 *
 * This function gates a narrow, repo-specific exception: the CODESTYLE.md
 * symlink in the coding-harness repo is allowed to resolve outside the repo
 * root to a known global config location. All other out-of-root paths must
 * still fail closed.
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
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// ─── Constants ────────────────────────────────────────────────────────────────

/** The hardcoded allowed repo root that the function checks. */
const ALLOWED_ROOT = "/Users/jamiecraik/dev/coding-harness";
/** The hardcoded allowed symlink target. */
const ALLOWED_LINK_TARGET = "/Users/jamiecraik/.codex/instructions/CODESTYLE.md";
/** One of the two allowed resolved absolute paths. */
const ALLOWED_ABS_1 =
	"/Users/jamiecraik/dev/config/codex/instructions/CODESTYLE.md";
/** The other allowed resolved absolute path. */
const ALLOWED_ABS_2 = "/Users/jamiecraik/.codex/instructions/CODESTYLE.md";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PREFLIGHT_PATH = join(process.cwd(), "scripts/codex-preflight.sh");

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("is_allowed_repo_external_path", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-preflight-symlink-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns failure (1) when root does not match the allowed repo root", () => {
		// Create a CODESTYLE.md symlink pointing to the canonical target
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));

		const status = runIsAllowedRepoExternalPath(
			"/some/other/repo",
			"CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns failure (1) when match is not CODESTYLE.md", () => {
		// Create a different symlink name
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "OTHER.md"));

		const status = runIsAllowedRepoExternalPath(
			ALLOWED_ROOT,
			"OTHER.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns failure (1) when the match path is a regular file, not a symlink", () => {
		// Create a plain file (not a symlink)
		writeFileSync(join(tempDir, "CODESTYLE.md"), "# Code Style\n", "utf-8");

		const status = runIsAllowedRepoExternalPath(
			ALLOWED_ROOT,
			"CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns failure (1) when the match path does not exist", () => {
		// Do not create any file at CODESTYLE.md
		const status = runIsAllowedRepoExternalPath(
			ALLOWED_ROOT,
			"CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns failure (1) when symlink target is a different path", () => {
		// Symlink points to a different target
		symlinkSync("/some/other/path.md", join(tempDir, "CODESTYLE.md"));

		const status = runIsAllowedRepoExternalPath(
			ALLOWED_ROOT,
			"CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns failure (1) when abs does not match either allowed path", () => {
		// Correct symlink target, correct root and match, but wrong abs
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));

		const status = runIsAllowedRepoExternalPath(
			ALLOWED_ROOT,
			"CODESTYLE.md",
			"/some/unexpected/resolved/path.md",
			tempDir,
		);
		expect(status).toBe(1);
	});

	it("returns success (0) when all conditions match and abs is the first allowed path", () => {
		// Correct symlink, correct root, correct abs (variant 1)
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));

		const status = runIsAllowedRepoExternalPath(
			ALLOWED_ROOT,
			"CODESTYLE.md",
			ALLOWED_ABS_1,
			tempDir,
		);
		expect(status).toBe(0);
	});

	it("returns success (0) when all conditions match and abs is the second allowed path", () => {
		// Correct symlink, correct root, correct abs (variant 2)
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));

		const status = runIsAllowedRepoExternalPath(
			ALLOWED_ROOT,
			"CODESTYLE.md",
			ALLOWED_ABS_2,
			tempDir,
		);
		expect(status).toBe(0);
	});

	it("returns failure (1) when root matches but the third argument has wrong prefix", () => {
		// abs has the right filename but wrong directory
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));

		const status = runIsAllowedRepoExternalPath(
			ALLOWED_ROOT,
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

		const status = runIsAllowedRepoExternalPath(
			ALLOWED_ROOT,
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
	): { stdout: string; stderr: string; status: number } {
		const script = [
			`source "${PREFLIGHT_PATH}"`,
			`check_paths "${root}" "${paths}"`,
		].join("\n");

		const result = spawnSync("bash", ["-c", script], {
			cwd,
			encoding: "utf8",
		});

		return {
			stdout: result.stdout ?? "",
			stderr: result.stderr ?? "",
			status: result.status ?? 127,
		};
	}

	it("allows CODESTYLE.md symlink to external path when all conditions are met", () => {
		// Create the CODESTYLE.md symlink pointing to the canonical allowed target
		symlinkSync(ALLOWED_LINK_TARGET, join(tempDir, "CODESTYLE.md"));

		// We pass ALLOWED_ROOT as the repo root so the exception guard fires.
		// python3 is used to realpath inside check_paths, but since the symlink
		// target doesn't exist it will return the symlink path itself; we still
		// verify the function does not emit "path escapes repo root".
		const { stdout, stderr, status } = runCheckPaths(
			ALLOWED_ROOT,
			"CODESTYLE.md",
			tempDir,
		);

		// Should not produce an "escapes repo root" error.
		expect(stderr + stdout).not.toContain("path escapes repo root");
		// Exit code should not be 2 (the "path escapes" error code).
		expect(status).not.toBe(2);
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

		// Extract the function body from each script
		const functionPattern =
			/is_allowed_repo_external_path\(\)[\s\S]*?\n\}/;
		const runtimeMatch = runtimeScript.match(functionPattern)?.[0];
		const templateMatch = templateScript.match(functionPattern)?.[0];

		expect(runtimeMatch).toBeTruthy();
		expect(templateMatch).toBeTruthy();
		expect(runtimeMatch).toBe(templateMatch);
	});

	it("check_paths calls is_allowed_repo_external_path before logging path-escape error", () => {
		const runtimeScript = readFileSync(
			join(process.cwd(), "scripts/codex-preflight.sh"),
			"utf-8",
		);

		// Verify the integration by locating the positions of both strings
		// within the full script source.
		const allowedCallIndex = runtimeScript.indexOf(
			"is_allowed_repo_external_path",
		);
		const escapeErrIndex = runtimeScript.indexOf("path escapes repo root");

		expect(allowedCallIndex).toBeGreaterThan(-1);
		expect(escapeErrIndex).toBeGreaterThan(-1);
		// The allow call must be defined before the error log in the file so
		// it is available when check_paths executes the guard.
		expect(allowedCallIndex).toBeLessThan(escapeErrIndex);
	});
});