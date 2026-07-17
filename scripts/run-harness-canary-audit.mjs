#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const MATRIX_SCRIPT = resolve(
	SCRIPT_ROOT,
	"scripts/test-harness-upgrade-matrix.mjs",
);
const DEFAULT_CLI = resolve(SCRIPT_ROOT, "dist/cli.js");

function usage() {
	return "Usage: node scripts/run-harness-canary-audit.mjs [--cli <path>] [--fitness-artifacts <dir>] [--output <path>] [--json] <repo>...";
}

export function parseArgs(argv) {
	const state = {
		repos: [],
		cli: process.env.HARNESS_CANARY_CLI ?? DEFAULT_CLI,
		fitnessArtifacts: undefined,
		output: undefined,
		json: false,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const result = consumeCanaryArg(state, argv[index], argv[index + 1]);
		if (result.error) return { ok: false, error: result.error };
		if (result.help) return { ok: true, help: true, ...state };
		index += result.consumed;
	}
	if (state.repos.length === 0)
		return { ok: false, error: "At least one repository path is required" };
	return { ok: true, help: false, ...state };
}

function consumeCanaryArg(state, arg, nextArg) {
	if (arg === "--") return { consumed: 0 };
	if (arg === "--help" || arg === "-h") return { consumed: 0, help: true };
	if (arg === "--json") {
		state.json = true;
		return { consumed: 0 };
	}
	const pathKey = {
		"--cli": "cli",
		"--fitness-artifacts": "fitnessArtifacts",
		"--output": "output",
	}[arg];
	if (pathKey) {
		if (!nextArg || nextArg.startsWith("--"))
			return { consumed: 0, error: `${arg} requires a path` };
		state[pathKey] = nextArg;
		return { consumed: 1 };
	}
	if (arg.startsWith("--"))
		return { consumed: 0, error: `Unknown flag: ${arg}` };
	state.repos.push(arg);
	return { consumed: 0 };
}

function run(command, args, cwd) {
	return spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		maxBuffer: 20 * 1024 * 1024,
	});
}

function parseJson(stdout) {
	try {
		return { ok: true, value: JSON.parse(stdout) };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function describeJsonFailure(value, exitCode) {
	const directErrors = Array.isArray(value?.errors) ? value.errors : [];
	const resultErrors = Array.isArray(value?.results)
		? value.results.flatMap((result) =>
				Array.isArray(result?.errors) ? result.errors : [],
			)
		: [];
	const messages = [...directErrors, ...resultErrors].filter(
		(message) => typeof message === "string" && message.length > 0,
	);
	if (messages.length > 0) return messages.join("; ");
	if (typeof value?.status === "string")
		return `command reported status ${value.status}`;
	return `command exited ${exitCode ?? "without a status"}`;
}

function gitSnapshot(repo) {
	const status = run(
		"git",
		["status", "--short", "--untracked-files=all"],
		repo,
	);
	const head = run("git", ["rev-parse", "HEAD"], repo);
	return {
		ok: status.status === 0 && head.status === 0,
		status: status.stdout,
		head: head.status === 0 ? head.stdout.trim() : null,
		error: status.stderr.trim() || head.stderr.trim() || "",
	};
}

function materializeRepo(repoInput) {
	const repo = realpathSync(resolve(repoInput));
	const root = run("git", ["rev-parse", "--show-toplevel"], repo);
	if (root.status === 0 && realpathSync(root.stdout.trim()) === repo) {
		return { repo, cleanup: null, materialized: false };
	}
	const cleanup = mkdtempSync(join(tmpdir(), "harness-canary-fixture-"));
	const materializedRepo = join(cleanup, basename(repo));
	const sourceGitDir = join(repo, ".git");
	cpSync(repo, materializedRepo, {
		recursive: true,
		filter: (source) => source !== sourceGitDir,
	});
	const init = run("git", ["init", "-q"], materializedRepo);
	if (init.status !== 0) {
		rmSync(cleanup, { recursive: true, force: true });
		throw new Error(
			`cannot materialize non-git target: ${init.stderr.trim() || init.stdout.trim()}`,
		);
	}
	run(
		"git",
		["config", "user.email", "harness-canary@example.invalid"],
		materializedRepo,
	);
	run("git", ["config", "user.name", "Harness Canary"], materializedRepo);
	const commit = run("git", ["add", "-A"], materializedRepo);
	if (commit.status !== 0) {
		rmSync(cleanup, { recursive: true, force: true });
		throw new Error(
			`cannot stage materialized target: ${commit.stderr.trim() || commit.stdout.trim()}`,
		);
	}
	const initialCommit = run(
		"git",
		["commit", "-q", "-m", "canary baseline"],
		materializedRepo,
	);
	if (initialCommit.status !== 0) {
		rmSync(cleanup, { recursive: true, force: true });
		throw new Error(
			`cannot commit materialized target: ${initialCommit.stderr.trim() || initialCommit.stdout.trim()}`,
		);
	}
	return { repo: materializedRepo, cleanup, materialized: true };
}

function cliProbe(repo, cli, args) {
	const result = run(process.execPath, [cli, ...args], repo);
	const parsed = parseJson(result.stdout);
	const passed = result.status === 0 && parsed.ok;
	return {
		command: `${cli} ${args.join(" ")}`,
		exitCode: result.status,
		status: passed ? "pass" : "fail",
		json: parsed.ok ? parsed.value : null,
		error: passed
			? result.stderr.trim()
			: parsed.ok
				? result.stderr.trim() ||
					describeJsonFailure(parsed.value, result.status)
				: parsed.error,
	};
}

function matrixProbe(repo, cli) {
	const result = run(
		process.execPath,
		[MATRIX_SCRIPT, "--cli", cli, "--json", repo],
		SCRIPT_ROOT,
	);
	const parsed = parseJson(result.stdout);
	const passed = result.status === 0 && parsed.ok;
	return {
		command: `${MATRIX_SCRIPT} --cli ${cli} --json ${repo}`,
		exitCode: result.status,
		status: passed ? "pass" : "fail",
		json: parsed.ok ? parsed.value : null,
		error: passed
			? result.stderr.trim()
			: parsed.ok
				? result.stderr.trim() ||
					describeJsonFailure(parsed.value, result.status)
				: parsed.error,
	};
}

function fitnessProbe(repo, cli, artifactsDir) {
	const resolvedArtifacts = artifactsDir
		? resolve(repo, artifactsDir)
		: resolve(repo, "artifacts");
	if (!existsSync(resolvedArtifacts)) {
		return {
			command: `${cli} fitness --from-existing-artifacts ${resolvedArtifacts} --json`,
			status: "blocked",
			reason:
				"fitness artifact directory is absent; run the deterministic fitness lanes first",
			artifactsDir: resolvedArtifacts,
		};
	}
	const probe = cliProbe(repo, cli, [
		"fitness",
		"--from-existing-artifacts",
		resolvedArtifacts,
		"--json",
	]);
	if (probe.json?.status === "needs_evidence") {
		return {
			...probe,
			status: "blocked",
			reason: `fitness evidence is incomplete: ${probe.json.summary?.lanesNeedingEvidence ?? "unknown"} lane(s) need evidence`,
		};
	}
	return {
		...probe,
		artifactsDir: resolvedArtifacts,
	};
}

function auditRepo(repoInput, options) {
	let materialized;
	try {
		materialized = materializeRepo(repoInput);
		return auditMaterializedRepo(repoInput, materialized, options);
	} catch (error) {
		return {
			repo: resolve(repoInput),
			status: "fail",
			executionRepo: null,
			materializedFixture: false,
			git: null,
			probes: {},
			blocked: [],
			errors: [error instanceof Error ? error.message : String(error)],
			claimsBoundary: {
				localExecution: "not_proven",
				hostedCi: "not_checked",
				reviewState: "not_checked",
				mergeReadiness: "not_checked",
			},
		};
	} finally {
		if (materialized?.cleanup)
			rmSync(materialized.cleanup, { recursive: true, force: true });
	}
}

function auditMaterializedRepo(repoInput, materialized, options) {
	const repo = materialized.repo;
	const before = gitSnapshot(repo);
	const probes = {
		orient: cliProbe(repo, options.cli, ["orient", "--json"]),
		next: cliProbe(repo, options.cli, [
			"next",
			"--worktree-role",
			"dirty-with-justification",
			"--json",
		]),
		upgradeMatrix: matrixProbe(repo, options.cli),
		fitness: fitnessProbe(repo, options.cli, options.fitnessArtifacts),
	};
	const after = gitSnapshot(repo);
	const statusUnchanged = snapshotsMatch(before, after);
	const probeFailures = collectProbeMessages(probes, "fail");
	const blocked = collectProbeMessages(probes, "blocked");
	return {
		repo: resolve(repoInput),
		executionRepo: repo,
		materializedFixture: materialized.materialized,
		status:
			!statusUnchanged || probeFailures.length > 0
				? "fail"
				: blocked.length > 0
					? "warn"
					: "pass",
		git: { before, after, statusUnchanged },
		probes,
		blocked,
		errors: [
			...(!statusUnchanged
				? ["target git status or HEAD changed during read-only audit"]
				: []),
			...probeFailures,
		],
		claimsBoundary: {
			localExecution: "proven for probes that passed",
			hostedCi: "not_checked",
			reviewState: "not_checked",
			mergeReadiness: "not_checked",
		},
	};
}

function snapshotsMatch(before, after) {
	return (
		before.ok &&
		after.ok &&
		before.status === after.status &&
		before.head === after.head
	);
}

function collectProbeMessages(probes, status) {
	return Object.entries(probes)
		.filter(([, probe]) => probe.status === status)
		.map(
			([name, probe]) =>
				`${name}: ${probe.reason || probe.error || "probe failed"}`,
		);
}

export function runCanaryAudit(options) {
	const repos = options.repos.map((repo) => auditRepo(repo, options));
	const status = repos.some((repo) => repo.status === "fail")
		? "fail"
		: repos.some((repo) => repo.status === "warn")
			? "warn"
			: "pass";
	return {
		schemaVersion: "harness-canary-audit/v1",
		status,
		generatedAt: new Date().toISOString(),
		readOnly: true,
		repositories: repos,
		summary: {
			total: repos.length,
			passed: repos.filter((repo) => repo.status === "pass").length,
			warned: repos.filter((repo) => repo.status === "warn").length,
			failed: repos.filter((repo) => repo.status === "fail").length,
		},
	};
}

function main() {
	const parsed = parseArgs(process.argv.slice(2));
	if (!parsed.ok) {
		console.error(`${parsed.error}\n${usage()}`);
		process.exitCode = 2;
		return;
	}
	if (parsed.help) {
		console.log(usage());
		return;
	}
	const report = runCanaryAudit(parsed);
	if (parsed.output)
		writeFileSync(
			resolve(parsed.output),
			`${JSON.stringify(report, null, 2)}\n`,
		);
	console.log(JSON.stringify(report, null, parsed.json ? 2 : 0));
	if (report.status === "fail") process.exitCode = 1;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	main();
