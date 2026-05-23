import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(
	new URL("../../scripts/validate-he-artifacts.sh", import.meta.url),
);

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

describe("validate-he-artifacts script", () => {
	it("fails closed outside a git repository instead of falling back to cwd", () => {
		const root = mkdtempSync(join(tmpdir(), "he-artifacts-"));
		roots.push(root);

		const result = spawnSync("bash", [SCRIPT_PATH, "plan.md", "spec.md"], {
			cwd: root,
			encoding: "utf8",
			env: {
				...process.env,
				HE_AGENT_SKILLS_ROOT: "",
			},
		});
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "repo_root_unavailable",
			status: "blocked",
		});
	});

	it("rejects paths outside the repository", () => {
		const root = mkdtempSync(join(tmpdir(), "he-artifacts-"));
		roots.push(root);

		const result = spawnSync("bash", [SCRIPT_PATH, "../plan.md", "../spec.md"], {
			cwd: root,
			encoding: "utf8",
			env: {
				...process.env,
				HE_AGENT_SKILLS_ROOT: "",
			},
		});
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(1);
		expect(report.status).toBe("blocked");
		expect(report.blockerClass).toMatch(/repo_root_unavailable|missing_plan/);
	});
});
