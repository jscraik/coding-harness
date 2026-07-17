import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
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
		output?: string;
	}): {
		status: "pass" | "warn" | "fail";
		errors?: string[];
		outputPathAllowed?: boolean;
		repositories: Array<{
			status: "pass" | "warn" | "fail";
			errors: string[];
			git: {
				before: { head: string | null; status: string };
				after: { head: string | null; status: string };
				statusUnchanged: boolean;
			} | null;
			probes?: Record<string, { command: string }>;
		}>;
	};
	run(
		command: string,
		args: string[],
		cwd: string,
	): { status: number | null; stdout: string; stderr: string };
};

const { parseArgs, run, runCanaryAudit } = requireScript(
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

	it("resolves relative CLI paths before changing probe cwd", () => {
		const repo = createGitFixture();
		const missingCli = join(repo, "missing-cli.js");
		const report = runCanaryAudit({
			repos: [repo],
			cli: relative(process.cwd(), missingCli),
		});

		expect(report.repositories[0]?.probes?.orient?.command ?? "").toContain(
			resolve(missingCli),
		);
	});

	it("rejects output paths inside audited repositories", () => {
		const repo = createGitFixture();
		const output = join(repo, "artifacts", "canary.json");
		const report = runCanaryAudit({
			repos: [repo],
			cli: join(repo, "missing-cli.js"),
			output,
		});

		expect(report.status).toBe("fail");
		expect(report.outputPathAllowed).toBe(false);
		expect(report.repositories).toHaveLength(0);
		expect(report.errors?.[0]).toContain(
			"--output must not be inside audited repository",
		);
		expect(existsSync(output)).toBe(false);
	});

	it("sanitizes inherited Git environment variables for child probes", () => {
		const repo = createGitFixture();
		const keys = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"] as const;
		const originals = Object.fromEntries(
			keys.map((key) => [key, process.env[key]]),
		) as Record<(typeof keys)[number], string | undefined>;
		Object.assign(process.env, {
			GIT_DIR: "/tmp/foreign.git",
			GIT_WORK_TREE: "/tmp/foreign-worktree",
			GIT_INDEX_FILE: "/tmp/foreign-index",
		});

		try {
			const result = run(
				process.execPath,
				[
					"-e",
					"process.stdout.write([process.env.GIT_DIR, process.env.GIT_WORK_TREE, process.env.GIT_INDEX_FILE].filter(Boolean).join('|'))",
				],
				repo,
			);
			expect(result.status).toBe(0);
			expect(result.stdout).toBe("");
		} finally {
			for (const key of keys) {
				if (originals[key] === undefined) delete process.env[key];
				else process.env[key] = originals[key];
			}
		}
	});
});
