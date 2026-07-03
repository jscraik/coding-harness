/**
 * Tests for rollback.ts path sanitization and backup functions.
 *
 * Regression coverage for:
 *   - Symlinked parent directory escape (finding 4de066376354819197871d4df2c7f1f5)
 *     The original sanitizePath only did a lexical prefix check, so a repo
 *     that placed ".github -> /etc" could cause createBackup to copyFileSync
 *     files outside the workspace into .harness/backups.
 */

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBackup, sanitizePath } from "./rollback.js";

let root: string;
let outside: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "rollback-test-root-"));
	outside = mkdtempSync(join(tmpdir(), "rollback-test-outside-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
	rmSync(outside, { recursive: true, force: true });
});

describe("sanitizePath", () => {
	it("accepts a normal relative path within base", () => {
		const result = sanitizePath(root, ".github/workflows/ci.yml");
		expect(result.ok).toBe(true);
	});

	it("rejects a plain traversal (../)", () => {
		const result = sanitizePath(root, "../outside.txt");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("PATH_TRAVERSAL");
		}
	});

	// Security regression: symlinked parent directory must be rejected.
	// Before the fix, sanitizePath only checked the resolved string prefix.
	// A symlink at .github -> /etc passes the prefix check because resolve()
	// doesn't follow symlinks — the path starts with <root>/.github which
	// looks like it's inside root. With the segment-walk + realpathSync
	// ancestor check, the symlink is detected and rejected.
	it("rejects a path whose parent directory is a symlink escaping base", () => {
		// Create .github -> outside dir symlink inside root
		const symlinkPath = join(root, ".github");
		symlinkSync(outside, symlinkPath);

		const result = sanitizePath(root, ".github/secret.txt");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("PATH_TRAVERSAL");
		}
	});

	it("accepts a path through a symlinked parent directory inside base", () => {
		const realScripts = join(root, "Infrastructure", "scripts");
		mkdirSync(realScripts, { recursive: true });
		writeFileSync(join(realScripts, "validate-commit-msg.js"), "ok");

		const symlinkPath = join(root, "scripts");
		symlinkSync("Infrastructure/scripts", symlinkPath);

		const result = sanitizePath(root, "scripts/validate-commit-msg.js");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(
				join(root, "scripts", "validate-commit-msg.js"),
			);
		}
	});

	it("rejects a path that is itself a symlink escaping base", () => {
		const externalFile = join(outside, "passwd");
		writeFileSync(externalFile, "root:x:0:0");

		const symlinkPath = join(root, "passwd-link");
		symlinkSync(externalFile, symlinkPath);

		const result = sanitizePath(root, "passwd-link");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("PATH_TRAVERSAL");
		}
	});

	it("rejects when base itself does not exist", () => {
		const result = sanitizePath(join(root, "nonexistent-base"), "file.txt");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_PATH");
		}
	});
});

describe("createBackup", () => {
	it("returns null for a file that does not exist yet (new file)", () => {
		const result = createBackup(root, "new-file.txt");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBeNull();
		}
	});

	it("creates a backup for an existing file", () => {
		writeFileSync(join(root, "existing.txt"), "original content");
		const result = createBackup(root, "existing.txt");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(typeof result.value).toBe("string");
			expect(result.value).toHaveLength(16);
		}
	});

	// Security regression: symlinked parent directory must be rejected before
	// copyFileSync runs. The PoC for finding 4de066376354819197871d4df2c7f1f5
	// showed that createBackup would copy /etc/passwd into .harness/backups
	// when .github was a symlink pointing to /etc.
	it("refuses to backup a file through a symlinked parent directory", () => {
		// Place an external file the attacker wants to exfiltrate
		const externalFile = join(outside, "secret.txt");
		writeFileSync(externalFile, "sensitive-data");

		// Attacker adds .github -> outside dir symlink in the repo
		const symlinkDir = join(root, ".github");
		symlinkSync(outside, symlinkDir);

		// createBackup should refuse — not copy secret.txt into backups
		const result = createBackup(root, ".github/secret.txt");
		expect(result.ok).toBe(false);

		// Verify the backup dir was NOT created with the external file's content
		const backupDir = join(root, ".harness", "backups");
		if (existsSync(backupDir)) {
			const baks = readdirSync(backupDir).filter((f) => f.endsWith(".bak"));
			for (const bak of baks) {
				const content = readFileSync(join(backupDir, bak), "utf-8");
				expect(content).not.toContain("sensitive-data");
			}
		}
	});

	it("backs up a file through a symlinked parent directory inside base", () => {
		const realScripts = join(root, "Infrastructure", "scripts");
		mkdirSync(realScripts, { recursive: true });
		writeFileSync(join(realScripts, "validate-commit-msg.js"), "ok");

		const symlinkDir = join(root, "scripts");
		symlinkSync("Infrastructure/scripts", symlinkDir);

		const result = createBackup(root, "scripts/validate-commit-msg.js");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).not.toBeNull();
		}
	});

	it("rejects a direct symlink at the file path", () => {
		const externalFile = join(outside, "external.txt");
		writeFileSync(externalFile, "do-not-read");

		const symlinkFile = join(root, "link.txt");
		symlinkSync(externalFile, symlinkFile);

		const result = createBackup(root, "link.txt");
		expect(result.ok).toBe(false);
	});
});
