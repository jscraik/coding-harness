#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CRITICAL_SURFACES = [
	"harness.contract.json",
	".coderabbit.yaml",
	".circleci/config.yml",
	".github/workflows/pr-pipeline.yml",
	".harness/ci-required-checks.json",
	"scripts/check-semgrep-changed.sh",
	"scripts/check-semgrep-full.sh",
	"scripts/semgrep-bootstrap.sh",
	"scripts/semgrep-pre-push.yml",
	".harness/memory/LEARNINGS.md",
	".harness/knowledge/INDEX.md",
];

const CRITICAL_SURFACE_GROUPS = {
	contract: ["harness.contract.json"],
	"code-review": [".coderabbit.yaml"],
	ci: [".circleci/config.yml", ".github/workflows/pr-pipeline.yml"],
	"required-checks": [".harness/ci-required-checks.json"],
	semgrep: [
		"scripts/check-semgrep-changed.sh",
		"scripts/check-semgrep-full.sh",
		"scripts/semgrep-bootstrap.sh",
		"scripts/semgrep-pre-push.yml",
	],
	"project-brain": [
		".harness/memory/LEARNINGS.md",
		".harness/knowledge/INDEX.md",
	],
};

function usage() {
	return `Usage: node scripts/test-harness-upgrade-matrix.mjs [--cli <path>] [--json] <repo>...

Runs the current harness CLI against existing repositories with:
  init <repo> --update --dry-run --json

The matrix fails if any target repo exits non-zero, emits invalid JSON, changes
git status, omits update-mode metadata, or breaks the update-mode
created-to-updated compatibility alias.`;
}

function parseArgs(argv) {
	const repos = [];
	let cli = process.env.HARNESS_MATRIX_CLI ?? resolve("dist/cli.js");
	let json = false;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--") {
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			return { ok: true, help: true, cli, json, repos };
		}
		if (arg === "--json") {
			json = true;
			continue;
		}
		if (arg === "--cli") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				return { ok: false, error: "--cli requires a path" };
			}
			cli = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--")) {
			return { ok: false, error: `Unknown flag: ${arg}` };
		}
		repos.push(arg);
	}

	if (repos.length === 0) {
		return { ok: false, error: "At least one repository path is required" };
	}

	return { ok: true, help: false, cli, json, repos };
}

function run(command, args, options = {}) {
	return spawnSync(command, args, {
		encoding: "utf8",
		maxBuffer: 20 * 1024 * 1024,
		...options,
	});
}

function gitStatus(repo) {
	const result = run("git", ["-C", repo, "status", "--short"]);
	return {
		ok: result.status === 0,
		status: result.stdout,
		error: result.stderr.trim() || result.error?.message || "",
	};
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

function criticalSurfaceStates(output) {
	const updated = new Set(Array.isArray(output?.updated) ? output.updated : []);
	const skipped = new Set(Array.isArray(output?.skipped) ? output.skipped : []);

	return Object.fromEntries(
		DEFAULT_CRITICAL_SURFACES.map((surface) => {
			if (updated.has(surface)) {
				return [surface, "updated"];
			}
			if (skipped.has(surface)) {
				return [surface, "skipped"];
			}
			return [surface, "not-reported"];
		}),
	);
}

function missingCriticalSurfaceGroups(output) {
	const updated = new Set(Array.isArray(output?.updated) ? output.updated : []);
	const skipped = new Set(Array.isArray(output?.skipped) ? output.skipped : []);
	const reported = (path) => updated.has(path) || skipped.has(path);

	return Object.entries(CRITICAL_SURFACE_GROUPS)
		.filter(([, paths]) => !paths.some(reported))
		.map(([group]) => group);
}

function summarizeRepo(repo, cli) {
	const absoluteRepo = resolve(repo);
	const before = gitStatus(absoluteRepo);
	const errors = [];
	if (!before.ok) {
		errors.push(`git status before failed: ${before.error}`);
	}

	const commandResult = run(process.execPath, [
		cli,
		"init",
		absoluteRepo,
		"--update",
		"--dry-run",
		"--json",
	]);
	const parsed = parseJson(commandResult.stdout);
	const output = parsed.ok ? parsed.value : null;
	const after = gitStatus(absoluteRepo);
	if (!after.ok) {
		errors.push(`git status after failed: ${after.error}`);
	}

	const statusChangedByDryRun =
		before.ok && after.ok ? before.status !== after.status : null;
	if (statusChangedByDryRun) {
		errors.push("git status changed during dry-run");
	}
	if (commandResult.status !== 0) {
		errors.push(
			`harness dry-run exited ${commandResult.status ?? "unknown"}: ${
				commandResult.stderr.trim() || commandResult.stdout.trim()
			}`,
		);
	}
	if (!parsed.ok) {
		errors.push(`invalid JSON output: ${parsed.error}`);
	}
	if (parsed.ok && !Array.isArray(output.updated)) {
		errors.push("JSON output missing updated array");
	}
	if (parsed.ok && !Array.isArray(output.skipped)) {
		errors.push("JSON output missing skipped array");
	}
	const hasValidUpdateMode =
		parsed.ok &&
		(output.updateMode === "tracked-update" ||
			output.updateMode === "adoption-preview");
	if (parsed.ok && !hasValidUpdateMode) {
		errors.push("JSON output missing valid updateMode");
	}
	if (parsed.ok && typeof output.trackedManifest !== "boolean") {
		errors.push("JSON output missing trackedManifest boolean");
	}
	const missingCriticalGroups = parsed.ok
		? missingCriticalSurfaceGroups(output)
		: [];
	for (const group of missingCriticalGroups) {
		errors.push(
			`JSON output missing critical governance surface group: ${group}`,
		);
	}
	const createdAliasMatchesUpdated =
		parsed.ok &&
		Array.isArray(output.created) &&
		Array.isArray(output.updated) &&
		JSON.stringify(output.created) === JSON.stringify(output.updated);
	if (parsed.ok && !createdAliasMatchesUpdated) {
		errors.push("created array no longer matches updated array");
	}

	return {
		repo: absoluteRepo,
		exitCode: commandResult.status,
		packageManager: output?.packageManager,
		updatedCount: Array.isArray(output?.updated) ? output.updated.length : null,
		skippedCount: Array.isArray(output?.skipped) ? output.skipped.length : null,
		updateMode: output?.updateMode ?? null,
		trackedManifest: output?.trackedManifest ?? null,
		createdAliasMatchesUpdated,
		statusChangedByDryRun,
		missingCriticalGroups,
		criticalSurfaces: parsed.ok ? criticalSurfaceStates(output) : {},
		errors,
	};
}

export function runUpgradeMatrix({ cli, repos }) {
	const resolvedCli = resolve(cli);
	const setupErrors = [];
	if (!existsSync(resolvedCli)) {
		setupErrors.push(`CLI not found: ${resolvedCli}`);
	}

	const results = setupErrors.length
		? []
		: repos.map((repo) => summarizeRepo(repo, resolvedCli));
	const failedRepos = results.filter((result) => result.errors.length > 0);
	return {
		schemaVersion: "harness-upgrade-matrix/v1",
		cli: resolvedCli,
		repoCount: repos.length,
		pass: setupErrors.length === 0 && failedRepos.length === 0,
		setupErrors,
		results,
	};
}

function printHuman(report) {
	if (report.setupErrors.length > 0) {
		for (const error of report.setupErrors) {
			console.error(error);
		}
		return;
	}

	for (const result of report.results) {
		const status = result.errors.length === 0 ? "pass" : "fail";
		console.info(
			`${status}: ${result.repo} mode=${result.updateMode} trackedManifest=${result.trackedManifest} updated=${result.updatedCount} skipped=${result.skippedCount} mutated=${result.statusChangedByDryRun}`,
		);
		for (const error of result.errors) {
			console.error(`  - ${error}`);
		}
	}
}

export function runCli(argv) {
	const parsed = parseArgs(argv);
	if (!parsed.ok) {
		console.error(parsed.error);
		console.error(usage());
		return 2;
	}
	if (parsed.help) {
		console.info(usage());
		return 0;
	}

	const report = runUpgradeMatrix({ cli: parsed.cli, repos: parsed.repos });
	if (parsed.json) {
		console.info(JSON.stringify(report, null, 2));
	} else {
		printHuman(report);
	}
	return report.pass ? 0 : 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
	process.exitCode = runCli(process.argv.slice(2));
}
