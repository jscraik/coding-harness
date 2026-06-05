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

	it("resolves bare Markdown links relative to the source file directory", () => {
		const refs = extractRepoPathReferences(
			"docs/agents/guide.md",
			[
				"[Sibling](quickstart.md)",
				"[Nested](references/checklist.md#top)",
				"[Root](docs/architecture/root-surface-classification.md)",
				"depends_on: docs/agents/01-instruction-map.md",
			].join("\n"),
		);

		expect(refs).toEqual([
			"docs/agents/01-instruction-map.md",
			"docs/agents/quickstart.md",
			"docs/agents/references/checklist.md",
			"docs/architecture/root-surface-classification.md",
		]);
	});

	it("normalizes root-level dot-slash Markdown links to repository paths", () => {
		const refs = extractRepoPathReferences(
			"README.md",
			[
				"[CLI](./docs/cli-reference.md)",
				"[Harness](./.harness/README.md#tracked-control-plane)",
			].join("\n"),
		);

		expect(refs).toEqual([".harness/README.md", "docs/cli-reference.md"]);
	});

	it("extracts YAML list-valued metadata references", () => {
		const refs = extractRepoPathReferences(
			"docs/agents/guide.md",
			[
				"depends_on:",
				"  - docs/support.md",
				"  - '.harness/specs/current.md'",
				"validated_by:",
				"  - docs/agents/checklist.md",
			].join("\n"),
		);

		expect(refs).toEqual([
			".harness/specs/current.md",
			"docs/agents/checklist.md",
			"docs/support.md",
		]);
	});
});
