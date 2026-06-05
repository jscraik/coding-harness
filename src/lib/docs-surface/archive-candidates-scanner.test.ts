import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeGitEnvironment } from "../git/safe-env.js";
import {
	extractRepoPathReferences,
	scanArchiveCandidateSources,
} from "./archive-candidates-scanner.js";

describe("scanArchiveCandidateSources", () => {
	it("loads tracked documentation-like files from git ls-files", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "archive-scan-"));
		const env = sanitizeGitEnvironment({ policy: "strict" });
		execFileSync("git", ["init"], { cwd: repoRoot, env });
		writeFileSync(join(repoRoot, "README.md"), "# Root\n", "utf8");
		writeFileSync(join(repoRoot, "local-note.md"), "# Local only\n", "utf8");
		execFileSync("git", ["add", "README.md"], { cwd: repoRoot, env });

		const result = scanArchiveCandidateSources({ repoRoot });

		expect(result.fileListSource).toBe("git-index");
		expect(result.files.map((file) => file.path)).toEqual(["README.md"]);
		expect(result.files.map((file) => file.path)).not.toContain(
			"local-note.md",
		);
	});

	it("extracts repository-relative links and ignores external URLs", () => {
		const refs = extractRepoPathReferences(
			"docs/index.md",
			[
				"[Spec](../.harness/specs/example.md)",
				"[Root](../README.md#intro)",
				"[Web](https://example.com)",
				"depends_on: docs/agents/01-instruction-map.md",
			].join("\n"),
		);

		expect(refs).toEqual([
			".harness/specs/example.md",
			"README.md",
			"docs/agents/01-instruction-map.md",
		]);
	});
});
