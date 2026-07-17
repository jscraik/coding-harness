import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const requireScript = createRequire(import.meta.url);
type CanaryAuditModule = {
	parseArgs(argv: string[]):
		| {
				ok: true;
				help: boolean;
				cli: string;
				fitnessArtifacts?: string;
				output?: string;
				json: boolean;
				repos: string[];
		  }
		| { ok: false; error: string };
	runCanaryAudit(options: {
		repos: string[];
		cli: string;
		fitnessArtifacts?: string;
	}): {
		status: "pass" | "warn" | "fail";
		repositories: Array<{
			status: "pass" | "warn" | "fail";
			errors: string[];
			git: {
				before: { head: string | null; status: string };
				after: { head: string | null; status: string };
				statusUnchanged: boolean;
			} | null;
		}>;
	};
};

const { parseArgs, runCanaryAudit } = requireScript(
	"../../scripts/run-harness-canary-audit.mjs",
) as CanaryAuditModule;

const tempRoots: string[] = [];

function createGitFixture(): string {
	const repo = mkdtempSync(join(tmpdir(), "harness-canary-test-"));
	tempRoots.push(repo);
	writeFileSync(join(repo, "README.md"), "# Canary fixture\n");
	for (const args of [
		["init", "-q"],
		["config", "user.email", "canary@example.invalid"],
		["config", "user.name", "Canary Test"],
		["add", "README.md"],
		["commit", "-q", "-m", "fixture"],
	]) {
		const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
		if (result.status !== 0) {
			throw new Error(result.stderr || `git ${args.join(" ")} failed`);
		}
	}
	return repo;
}

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("run-harness-canary-audit CLI", () => {
	it("parses read-only canary inputs", () => {
		expect(
			parseArgs([
				"--",
				"--json",
				"--cli",
				"dist/cli.js",
				"--fitness-artifacts",
				"artifacts",
				"--output",
				"artifacts/canary.json",
				"repo-a",
			]),
		).toEqual({
			ok: true,
			help: false,
			cli: "dist/cli.js",
			fitnessArtifacts: "artifacts",
			output: "artifacts/canary.json",
			json: true,
			repos: ["repo-a"],
		});
	});

	it("fails closed when no repository is supplied", () => {
		expect(parseArgs(["--json"])).toEqual({
			ok: false,
			error: "At least one repository path is required",
		});
	});

	it("preserves target HEAD and status when probes fail", () => {
		const repo = createGitFixture();
		const report = runCanaryAudit({
			repos: [repo],
			cli: join(repo, "missing-cli.js"),
		});

		expect(report.status).toBe("fail");
		expect(report.repositories).toHaveLength(1);
		const repository = report.repositories[0];
		expect(repository?.git, repository?.errors.join("; ")).not.toBeNull();
		expect(repository?.git).toMatchObject({
			statusUnchanged: true,
			before: { status: "" },
			after: { status: "" },
		});
		expect(repository?.git?.before.head).toBe(repository?.git?.after.head);
		expect(repository?.errors.length).toBeGreaterThan(0);
		expect(repository?.errors.every((message) => message.length > 0)).toBe(
			true,
		);
	});
});
