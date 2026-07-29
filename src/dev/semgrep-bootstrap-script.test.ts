import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), "semgrep-bootstrap-test-"));
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { force: true, recursive: true });
	}
});

describe("semgrep bootstrap", () => {
	it("prepares isolated runtime paths before probing a scanner", () => {
		const directory = createTemporaryDirectory();
		const stateRoot = join(directory, "state");

		const result = spawnSync(
			"bash",
			[
				"-lc",
				'unset SEMGREP_CACHE_PATHS_READY && source "$SEMGREP_BOOTSTRAP_SCRIPT" && ensure_semgrep_cache_paths && test -d "$SEMGREP_STATE_ROOT" && test -d "$SEMGREP_RUNTIME_CACHE_ROOT" && test -d "$SEMGREP_RUNTIME_USER_HOME" && test -d "$(dirname "$SEMGREP_RUNTIME_LOG_FILE")"',
			],
			{
				cwd: resolve(import.meta.dirname, "../.."),
				encoding: "utf8",
				env: {
					...process.env,
					SEMGREP_BOOTSTRAP_SCRIPT: resolve(
						import.meta.dirname,
						"../../scripts/semgrep-bootstrap.sh",
					),
					SEMGREP_STATE_ROOT: stateRoot,
				},
			},
		);

		expect(result.status, result.stderr).toBe(0);
	});

	it("fails when an isolated runtime path cannot become a directory", () => {
		const directory = createTemporaryDirectory();
		const stateRoot = join(directory, "state-file");
		writeFileSync(stateRoot, "not a directory");

		const result = spawnSync(
			"bash",
			[
				"-lc",
				'unset SEMGREP_CACHE_PATHS_READY && source "$SEMGREP_BOOTSTRAP_SCRIPT" && ensure_semgrep_cache_paths',
			],
			{
				cwd: resolve(import.meta.dirname, "../.."),
				encoding: "utf8",
				env: {
					...process.env,
					SEMGREP_BOOTSTRAP_SCRIPT: resolve(
						import.meta.dirname,
						"../../scripts/semgrep-bootstrap.sh",
					),
					SEMGREP_STATE_ROOT: stateRoot,
				},
			},
		);

		expect(result.status).not.toBe(0);
	});
});
