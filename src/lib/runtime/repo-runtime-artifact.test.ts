import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readRepoRuntimeArtifactText } from "./repo-runtime-artifact.js";

describe("repo runtime artifact boundary reads", () => {
	it("rejects final symlink entries even when the target stays inside the repo", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-runtime-artifact-"));
		try {
			mkdirSync(join(repoRoot, "artifacts"));
			writeFileSync(join(repoRoot, "artifacts", "source.json"), "{}", "utf8");
			symlinkSync(
				join(repoRoot, "artifacts", "source.json"),
				join(repoRoot, "artifacts", "evidence.json"),
			);

			expect(() =>
				readRepoRuntimeArtifactText(
					repoRoot,
					"artifacts/evidence.json",
					"--evidence",
				),
			).toThrow("--evidence must stay within --repo");
		} finally {
			rmSync(repoRoot, { force: true, recursive: true });
		}
	});
});
