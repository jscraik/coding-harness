import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const CHECK_SCRIPT = "scripts/check-validation-locks.sh";
const LOCK_SCRIPT = "scripts/with-validation-lock.sh";

let tempDirs: string[] = [];

afterEach(() => {
	for (const tempDir of tempDirs) {
		rmSync(tempDir, { force: true, recursive: true });
	}
	tempDirs = [];
});

function makeTempDir(): string {
	const tempDir = mkdtempSync(join(tmpdir(), "harness-validation-lock-"));
	tempDirs.push(tempDir);
	return tempDir;
}

describe("validation lock scripts", () => {
	it("passes when no validation locks exist", () => {
		const lockRoot = makeTempDir();
		const output = execFileSync("bash", [CHECK_SCRIPT], {
			encoding: "utf8",
			env: { ...process.env, HARNESS_VALIDATION_LOCK_ROOT: lockRoot },
		});

		expect(output).toContain("[validation-lock] no active validation locks.");
	});

	it("cleans dead validation locks", () => {
		const lockRoot = makeTempDir();
		const lockDir = join(lockRoot, "test-ci.lock");
		execFileSync("mkdir", ["-p", lockDir]);
		writeFileSync(join(lockDir, "metadata.env"), "pid=999999\n");

		const output = execFileSync("bash", [CHECK_SCRIPT], {
			encoding: "utf8",
			env: { ...process.env, HARNESS_VALIDATION_LOCK_ROOT: lockRoot },
		});

		expect(output).toContain("removing stale test-ci validation lock");
		expect(existsSync(lockDir)).toBe(false);
	});

	it("blocks when another validation lane is still active", () => {
		const lockRoot = makeTempDir();
		const lockDir = join(lockRoot, "test-ci.lock");
		execFileSync("mkdir", ["-p", lockDir]);
		writeFileSync(
			join(lockDir, "metadata.env"),
			`pid=${String(process.pid)}\n`,
		);

		const result = spawnSync("bash", [CHECK_SCRIPT], {
			encoding: "utf8",
			env: { ...process.env, HARNESS_VALIDATION_LOCK_ROOT: lockRoot },
		});

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"active test-ci validation already running",
		);
	});

	it("removes the lock after the wrapped command exits", () => {
		const lockRoot = makeTempDir();
		const output = execFileSync(
			"bash",
			[LOCK_SCRIPT, "behavior-tests", "--", "node", "-e", "console.log('ok')"],
			{
				encoding: "utf8",
				env: { ...process.env, HARNESS_VALIDATION_LOCK_ROOT: lockRoot },
			},
		);

		expect(output.trim()).toBe("ok");
		expect(existsSync(join(lockRoot, "behavior-tests.lock"))).toBe(false);
	});
});
