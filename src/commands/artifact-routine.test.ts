import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runArtifactRoutineCLI } from "./artifact-routine.js";

describe("artifact-routine command", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	it("prints JSON and exits successfully for a valid active index", () => {
		const repoRoot = makeRepo(tempDirs);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runArtifactRoutineCLI([
			"--repo-root",
			repoRoot,
			"--today",
			"2026-05-18",
			"--json",
		]);

		expect(exitCode).toBe(0);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
			'"schemaVersion": "artifact-handling-routine/v1"',
		);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain('"status": "pass"');
	});

	it("returns a usage error when a flag value is missing", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runArtifactRoutineCLI(["--repo-root", "--json"]);

		expect(exitCode).toBe(2);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
			"artifact-routine.flag_value_required",
		);
	});

	it("returns failure status and findings for invalid active artifacts", () => {
		const repoRoot = makeRepo(tempDirs, { reconciledDate: "2026-05-17" });
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runArtifactRoutineCLI([
			"--repo-root",
			repoRoot,
			"--today",
			"2026-05-18",
			"--json",
		]);

		expect(exitCode).toBe(1);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
			'"code": "active_index_stale"',
		);
	});
});

function makeRepo(
	tempDirs: string[],
	options: { reconciledDate?: string } = {},
): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "artifact-routine-cli-"));
	const tick = String.fromCharCode(96);
	tempDirs.push(repoRoot);
	mkdirSync(join(repoRoot, ".harness/plan"), { recursive: true });
	mkdirSync(join(repoRoot, "docs"), { recursive: true });
	writeFileSync(
		join(repoRoot, ".harness/active-artifacts.md"),
		[
			"# Active Harness Specs And Plans",
			"",
			"## Scope",
			"",
			`Last reconciled: ${options.reconciledDate ?? "2026-05-18"}.`,
			"",
			"## Current Active Route",
			"",
			"| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |",
			"| --- | --- | --- | --- | --- |",
			"| Harness assurance | JSC-331 | " +
				tick +
				".harness/plan/current.md" +
				tick +
				" | Active | Run artifact-routine. |",
			"",
			"## Artifact Index",
			"",
			"| Linear Key | Canonical Slug | Active Spec | Active Plan | Local Status | Notes |",
			"| --- | --- | --- | --- | --- | --- |",
			"| JSC-331 | harness-assurance | n.a. | " +
				tick +
				".harness/plan/current.md" +
				tick +
				" | Active assurance | Current. |",
			"",
		].join("\n"),
		"utf8",
	);
	writeFileSync(join(repoRoot, "docs/spec.md"), "# Spec\n", "utf8");
	writeFileSync(
		join(repoRoot, ".harness/plan/current.md"),
		[
			"---",
			"schema_version: 1",
			"status: active",
			"linear_issue: JSC-331",
			"source_spec: docs/spec.md",
			"owner: coding-harness-maintainers",
			"---",
			"",
			"# Plan",
			"",
			`Source: ${tick}docs/spec.md${tick}`,
		].join("\n"),
		"utf8",
	);
	return repoRoot;
}
