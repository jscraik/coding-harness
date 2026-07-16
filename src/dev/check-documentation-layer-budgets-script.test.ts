import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(
	process.cwd(),
	"scripts/check-documentation-layer-budgets.mjs",
);

function run(repoRoot: string) {
	return spawnSync(
		process.execPath,
		[SCRIPT_PATH, "--repo-root", repoRoot, "--json"],
		{ encoding: "utf8" },
	);
}

describe("check-documentation-layer-budgets", () => {
	const roots: string[] = [];
	afterEach(() => {
		for (const root of roots.splice(0))
			rmSync(root, { recursive: true, force: true });
	});

	it("passes when Layer 0 and Layer 1 stay inside their budgets", () => {
		const root = mkdtempSync(join(tmpdir(), "layer-budgets-pass-"));
		roots.push(root);
		mkdirSync(join(root, "docs/agents"), { recursive: true });
		writeFileSync(join(root, "AGENTS.md"), "# Agents\n", "utf8");
		writeFileSync(
			join(root, "docs/agents/quickstart.md"),
			"# Quickstart\n",
			"utf8",
		);

		const result = run(root);
		expect(result.status).toBe(0);
		const report = JSON.parse(result.stdout);
		expect(report).toMatchObject({
			schemaVersion: "documentation-layer-budgets/v1",
			status: "pass",
			surfaces: [
				{ path: "AGENTS.md", layer: 0, lineCount: 1, status: "pass" },
				{
					path: "docs/agents/quickstart.md",
					layer: 1,
					lineCount: 1,
					status: "pass",
				},
			],
		});
	});

	it("fails with an assertion-shaped diagnostic when a surface is over budget", () => {
		const root = mkdtempSync(join(tmpdir(), "layer-budgets-fail-"));
		roots.push(root);
		mkdirSync(join(root, "docs/agents"), { recursive: true });
		writeFileSync(join(root, "AGENTS.md"), "line\n".repeat(131), "utf8");
		writeFileSync(
			join(root, "docs/agents/quickstart.md"),
			"# Quickstart\n",
			"utf8",
		);

		const result = run(root);
		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout);
		const surface = report.surfaces.find(
			(entry: { layer: number }) => entry.layer === 0,
		);
		expect(surface).toMatchObject({
			status: "fail",
			lineCount: 131,
			maxLines: 130,
			diagnostic: expect.stringContaining("exceeds its 130-line budget"),
		});
	});

	it("blocks when a required surface is missing", () => {
		const root = mkdtempSync(join(tmpdir(), "layer-budgets-blocked-"));
		roots.push(root);
		const result = run(root);
		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout);
		expect(report.surfaces).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "AGENTS.md", status: "blocked" }),
			]),
		);
	});
});
