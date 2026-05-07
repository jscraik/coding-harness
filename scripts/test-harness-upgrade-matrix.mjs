#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const HARNESS_ROOT = resolve(dirname(CURRENT_FILE), "..");
const CANONICAL_CODESTYLE_MANIFEST = resolve(
	HARNESS_ROOT,
	"src/templates/codestyle/CHECKSUMS.sha256",
);

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

const REQUIRED_FLEET_CONTRACT_SURFACES = {
	circleci: [".circleci/config.yml"],
	coderabbit: [".coderabbit.yaml"],
	codestyle: ["CODESTYLE.md", "codestyle/CHECKSUMS.sha256"],
};

const LEGACY_GREPTILE_PATHS = [
	".greptile",
	".github/workflows/greptile-review.yml",
];

const CRITICAL_SURFACE_GROUPS = {
	contract: ["harness.contract.json"],
	"code-review": [".coderabbit.yaml"],
	ci: [".circleci/config.yml", ".github/workflows/pr-pipeline.yml"],
	codestyle: ["CODESTYLE.md", "codestyle/CHECKSUMS.sha256"],
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

/**
 * Provide the usage and failure criteria text for the harness upgrade matrix CLI.
 *
 * The returned string describes command-line options (`--cli`, `--json`, and repository
 * positional arguments) and enumerates conditions that cause the matrix to fail.
 * @returns {string} The usage/help text for the CLI.
 */
function usage() {
	return `Usage: node scripts/test-harness-upgrade-matrix.mjs [--cli <path>] [--json] <repo>...

Runs the current harness CLI against existing repositories with:
  init <repo> --update --dry-run --json

The matrix fails if any target repo exits non-zero, emits invalid JSON, changes
git status, omits update-mode metadata, or breaks the update-mode
created-to-updated compatibility alias.

Fleet readiness also requires CircleCI, CodeRabbit, and CODESTYLE surfaces to be
reported by the dry-run, rejects legacy Greptile artifacts, and fails closed
when codestyleParityFailures reports stale or malformed CODESTYLE parity data.`;
}

/**
 * Parse command-line arguments into validated CLI options and error/help indicators.
 *
 * Recognizes `--help` / `-h`, `--json`, and `--cli <path>` flags; treats remaining positional arguments as repository paths.
 *
 * @param {string[]} argv - Array of command-line arguments (typically process.argv.slice(2)).
 * @returns {{ ok: true, help: boolean, cli: string, json: boolean, repos: string[] } | { ok: false, error: string }}
 * An object with:
 *  - `ok: true` and `help: boolean, cli: string, json: boolean, repos: string[]` when parsing succeeds (help mode sets `help` to true).
 *  - `ok: false` and `error: string` when parsing fails (missing value for `--cli`, unknown flag, or no repos provided).
 */
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

/**
 * Runs a command synchronously and returns its spawn result.
 *
 * @param {string} command - The executable to run.
 * @param {string[]} args - Array of string arguments to pass to the command.
 * @param {import('child_process').SpawnSyncOptions} [options] - Additional spawn options; `encoding` and `maxBuffer` are set by the function but can be overridden.
 * @returns {import('child_process').SpawnSyncReturns<string>} The synchronous spawn result object containing `status`, `stdout`, `stderr`, and `error` (when present).
 */
function run(command, args, options = {}) {
	return spawnSync(command, args, {
		encoding: "utf8",
		maxBuffer: 20 * 1024 * 1024,
		...options,
	});
}

/**
 * Retrieve the git working-tree short status for a repository.
 *
 * @param {string} repo - Filesystem path to the repository to inspect.
 * @returns {{ok: boolean, status: string, error: string}} An object where
 *  - `ok` is `true` if the `git` command exited with code 0, `false` otherwise.
 *  - `status` is the stdout produced by `git status --short` for the repo.
 *  - `error` is stderr from the command, or the execution error message, or an empty string.
 */
function gitStatus(repo) {
	const result = run("git", ["-C", repo, "status", "--short"]);
	return {
		ok: result.status === 0,
		status: result.stdout,
		error: result.stderr.trim() || result.error?.message || "",
	};
}

/**
 * Ensure the given repository path is available as a local git-backed fixture.
 *
 * If the supplied path already contains a `.git` directory, the function returns
 * the repository's absolute path and `cleanup: null`. Otherwise it creates a
 * temporary copy of the repository (excluding any original `.git`), initializes
 * a new git repository there, and returns the materialized path plus the temp
 * root which should be removed when no longer needed. On failure to initialize
 * git, the temp root is removed and an `error` message is returned with
 * `cleanup: null`.
 *
 * @param {string} repo - Path to the repository to materialize.
 * @returns {{ repo: string, cleanup: string|null, error?: string }}
 *   An object containing:
 *   - `repo`: absolute path to the repository to use for testing (original or materialized copy).
 *   - `cleanup`: temporary root directory to remove after testing, or `null` when no cleanup is required.
 *   - `error` (optional): error message when repository materialization failed.
 */
function materializeRepo(repo) {
	const absoluteRepo = resolve(repo);
	if (existsSync(resolve(absoluteRepo, ".git"))) {
		return { repo: absoluteRepo, cleanup: null };
	}
	const tempRoot = mkdtempSync(join(tmpdir(), "harness-upgrade-fixture-"));
	const materializedRepo = join(tempRoot, basename(absoluteRepo));
	cpSync(absoluteRepo, materializedRepo, {
		recursive: true,
		filter: (source) => !source.endsWith(`${basename(absoluteRepo)}/.git`),
	});
	const init = run("git", ["-C", materializedRepo, "init"]);
	if (init.status !== 0) {
		rmSync(tempRoot, { recursive: true, force: true });
		return {
			repo: materializedRepo,
			cleanup: null,
			error: `git init failed: ${init.stderr.trim() || init.stdout.trim()}`,
		};
	}
	return { repo: materializedRepo, cleanup: tempRoot };
}

/**
 * Parse a JSON string and return either the parsed value or a parse error message.
 * @param {string} stdout - The string containing JSON to parse.
 * @returns {{ok: true, value: any} | {ok: false, error: string}} `{ok: true, value}` when parsing succeeds; `{ok: false, error}` when parsing fails, where `error` is the parser's error message.
 */
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

/**
 * Determine the reported state for each default critical surface from harness output.
 *
 * @param {object} output - Harness CLI JSON output that may contain `updated` and `skipped` arrays.
 * @returns {Record<string, "updated" | "skipped" | "not-reported">} An object mapping each path in DEFAULT_CRITICAL_SURFACES to its state: `"updated"` if present in `output.updated`, `"skipped"` if present in `output.skipped`, or `"not-reported"` otherwise.
 */
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

/**
 * Identify groups whose configured critical paths are not present in the CLI output.
 * @param {object} output - Parsed CLI JSON output with optional `updated` and `skipped` arrays of paths.
 * @returns {string[]} Group names from CRITICAL_SURFACE_GROUPS that contain no paths appearing in either `output.updated` or `output.skipped`.
 */
function missingCriticalSurfaceGroups(output) {
	const updated = new Set(Array.isArray(output?.updated) ? output.updated : []);
	const skipped = new Set(Array.isArray(output?.skipped) ? output.skipped : []);
	const reported = (path) => updated.has(path) || skipped.has(path);

	return Object.entries(CRITICAL_SURFACE_GROUPS)
		.filter(([, paths]) => !paths.some(reported))
		.map(([group]) => group);
}

/**
 * Determine whether the parsed harness output reported a path as updated or skipped.
 * @param {object} output - Parsed CLI JSON output with optional `updated` and `skipped` arrays.
 * @param {string} path - Repository-relative path to inspect.
 * @returns {boolean} `true` when the path appears in `updated` or `skipped`.
 */
function reportedSurface(output, path) {
	const updated = new Set(Array.isArray(output?.updated) ? output.updated : []);
	const skipped = new Set(Array.isArray(output?.skipped) ? output.skipped : []);
	return updated.has(path) || skipped.has(path);
}

/**
 * Determine which required fleet-contract surfaces are missing from the dry-run JSON output.
 *
 * Examines `output.updated` and `output.skipped` (treated as empty if absent) to decide whether each
 * path defined in REQUIRED_FLEET_CONTRACT_SURFACES was reported; uses `output.trackedManifest` to
 * select an appropriate remediation suggestion for CircleCI projects.
 *
 * @param {object} output - Parsed dry-run JSON; typically contains `updated` and `skipped` arrays and an optional `trackedManifest` boolean.
 * @returns {Array<{group: string, path: string, fix: string}>} Array of missing-surface records where `fix` contains a remediation command or guidance.
 */
function missingFleetContractSurfaces(output) {
	const missing = [];
	const adoptionFix =
		"run `harness init <repo> --dry-run --json`, then `harness init <repo> --track` for first adoption or `harness init <repo> --update` for tracked refresh";
	for (const [group, paths] of Object.entries(
		REQUIRED_FLEET_CONTRACT_SURFACES,
	)) {
		for (const path of paths) {
			if (!reportedSurface(output, path)) {
				missing.push({
					group,
					path,
					fix:
						group === "circleci" && output?.trackedManifest === true
							? "run `harness ci-migrate prepare <repo> --provider circleci --dry-run --json`, then apply/verify/commit the snapshot before live update"
							: adoptionFix,
				});
			}
		}
	}
	return missing;
}

/**
 * Find legacy Greptile artifact paths that currently exist under a repository.
 * @param {string} repo - Filesystem path to the repository root to inspect.
 * @returns {string[]} Repository-relative paths of legacy Greptile artifacts that are present on disk.
 */
function existingLegacyGreptilePaths(repo) {
	return LEGACY_GREPTILE_PATHS.filter((path) => existsSync(join(repo, path)));
}

/**
 * Parse a SHA-256 checksum manifest into an array of expected path/hash entries.
 *
 * Lines that are empty or start with `#` are ignored. Valid manifest lines must
 * match `<sha256>  <path>` where `<sha256>` is a 64-character hex string
 * (case-insensitive). Returned entries contain the file `path` and the
 * `expectedSha256` value normalized to lowercase.
 *
 * @param {string} raw - Manifest text with `<sha256>  <path>` rows.
 * @returns {Array<{path: string, expectedSha256: string}>} Array of parsed manifest rows.
 * @throws {Error} When any non-comment line is malformed, points outside the CODESTYLE pack, or omits the root/front-door CODESTYLE surfaces.
 */
function parseChecksumManifest(raw) {
	const entries = [];
	for (const [index, rawLine] of raw.split(/\r?\n/).entries()) {
		const line = rawLine.trim();
		if (line.length === 0 || line.startsWith("#")) {
			continue;
		}
		const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
		if (!match) {
			throw new Error(`malformed checksum manifest line ${index + 1}`);
		}
		const path = match[2];
		if (
			path.startsWith("/") ||
			path.includes("\\") ||
			path.split("/").includes("..") ||
			(path !== "CODESTYLE.md" && !path.startsWith("codestyle/"))
		) {
			throw new Error(`unsafe checksum manifest path ${path}`);
		}
		entries.push({ expectedSha256: match[1].toLowerCase(), path });
	}
	if (!entries.some((entry) => entry.path === "CODESTYLE.md")) {
		throw new Error("checksum manifest missing CODESTYLE.md");
	}
	if (!entries.some((entry) => entry.path.startsWith("codestyle/"))) {
		throw new Error("checksum manifest missing codestyle/ entries");
	}
	return entries;
}

/**
 * Compute the sha256 for a repository-relative file path.
 * @param {string} repo - Repository root.
 * @param {string} path - Repository-relative file path.
 * @returns {string} Lower-case sha256 hex digest.
 */
function sha256File(repo, path) {
	return createHash("sha256")
		.update(readFileSync(join(repo, path)))
		.digest("hex");
}

/**
 * Identify CODESTYLE files that are missing or whose SHA-256 digest differs from the canonical manifest.
 * @param {string} repo - Filesystem path to the repository root to inspect.
 * @returns {Array<{path: string, expectedSha256: string, actualSha256: string|null, reason: string}>} An array of failure records for files that are missing, have a hash mismatch, or when the canonical checksum manifest is malformed.
 */
function codestyleParityFailures(repo) {
	let manifest;
	try {
		manifest = parseChecksumManifest(
			readFileSync(CANONICAL_CODESTYLE_MANIFEST, "utf8"),
		);
	} catch (error) {
		return [
			{
				path: "src/templates/codestyle/CHECKSUMS.sha256",
				expectedSha256: "",
				actualSha256: null,
				reason: `manifest-error: ${error.message}`,
			},
		];
	}
	const failures = [];
	for (const entry of manifest) {
		const absolutePath = join(repo, entry.path);
		if (!existsSync(absolutePath)) {
			failures.push({
				path: entry.path,
				expectedSha256: entry.expectedSha256,
				actualSha256: null,
				reason: "missing",
			});
			continue;
		}
		let actualSha256;
		try {
			actualSha256 = sha256File(repo, entry.path);
		} catch (error) {
			failures.push({
				path: entry.path,
				expectedSha256: entry.expectedSha256,
				actualSha256: null,
				reason: `read-error: ${error instanceof Error ? error.message : String(error)}`,
			});
			continue;
		}
		if (actualSha256 !== entry.expectedSha256) {
			failures.push({
				path: entry.path,
				expectedSha256: entry.expectedSha256,
				actualSha256,
				reason: "hash-mismatch",
			});
		}
	}
	return failures;
}

/**
 * Summarizes CODESTYLE checksum mismatches into a single-line error message.
 *
 * @param {Array<{path: string, reason: string}>} failures - List of parity failures; each entry must include `path` and `reason`, where `reason` is typically `"missing"` or `"hash-mismatch"`.
 * @returns {string|null} `null` if there are no failures, otherwise a concise summary string that includes total failure count, counts by reason, and up to three sample paths.
 */
function codestyleParityError(failures) {
	if (failures.length === 0) {
		return null;
	}
	const reasonCounts = new Map();
	for (const failure of failures) {
		reasonCounts.set(
			failure.reason,
			(reasonCounts.get(failure.reason) ?? 0) + 1,
		);
	}
	const breakdown = [...reasonCounts.entries()]
		.map(([reason, count]) => `${count} ${reason}`)
		.join(", ");
	const samplePaths = failures
		.slice(0, 3)
		.map((failure) => failure.path)
		.join(", ");
	const suffix = failures.length > 3 ? ", ..." : "";
	return `codestyle parity mismatch: ${failures.length} file(s) (${breakdown}); sample: ${samplePaths}${suffix}; see codestyleParityFailures and run harness init <repo> --update --dry-run --json before live upgrade`;
}

/**
 * Run the harness CLI dry-run upgrade against a repository and produce a structured summary of results and validation errors.
 *
 * @param {string} repo - Path to the repository to test (can be relative or absolute).
 * @param {string} cli - Path to the harness CLI executable to invoke.
 * @returns {Object} A summary object containing execution metadata, validations, and any errors.
 * @property {string} repo - The resolved input repository path.
 * @property {string} executionRepo - The absolute path actually used for execution (may be a temporary materialized copy).
 * @property {string|null} cleanup - Path to a temporary directory to remove after testing, or `null` if no materialization occurred.
 * @property {boolean} materializedFixture - `true` if the repository was copied into a temporary fixture, `false` if tested in place.
 * @property {number|null} exitCode - The harness CLI process exit code from the dry-run invocation, or `null` if not available.
 * @property {string|undefined} packageManager - The package manager reported by the harness output, or `undefined` if not present.
 * @property {number|null} updatedCount - Number of entries in the reported `updated` array, or `null` if unavailable.
 * @property {number|null} skippedCount - Number of entries in the reported `skipped` array, or `null` if unavailable.
 * @property {string|null} updateMode - The reported `updateMode` value (e.g. `"tracked-update"` or `"adoption-preview"`), or `null` if unavailable.
 * @property {boolean|null} trackedManifest - The reported `trackedManifest` flag, or `null` if unavailable.
 * @property {boolean|null} createdAliasMatchesUpdated - `true` if `created` and `updated` arrays are present and identical, `false` if present and different, or `null` if comparison could not be performed.
 * @property {boolean|null} statusChangedByDryRun - `true` if `git status --short` differed before vs after the dry-run, `false` if unchanged, or `null` if git status could not be determined.
 * @property {string[]} missingCriticalGroups - Names of critical governance groups that were not reported in either `updated` or `skipped`.
 * @property {Array<{group: string, path: string, fix: string}>} missingFleetContractSurfaces - Required fleet surfaces absent from output.
 * @property {string[]} legacyGreptilePaths - Existing legacy Greptile artifacts found on disk.
 * @property {Array<{path: string, expectedSha256: string, actualSha256: string|null, reason: string}>} codestyleParityFailures - CODESTYLE pack parity failures against the canonical checksum manifest.
 * @property {Object} criticalSurfaces - Mapping of each critical surface path to its observed state (`"updated"`, `"skipped"`, or `"not-reported"`); empty if JSON could not be parsed.
 * @property {string[]} errors - Accumulated human-readable error messages describing setup, execution, validation, and invariant failures.
 */
function summarizeRepo(repo, cli) {
	const materialized = materializeRepo(repo);
	const absoluteRepo = materialized.repo;
	const cleanup = materialized.cleanup;
	const errors = [];
	if (materialized.error) {
		errors.push(materialized.error);
	}
	if (materialized.cleanup !== null && !materialized.error) {
		const bootstrapResult = run(process.execPath, [
			cli,
			"init",
			absoluteRepo,
			"--track",
			"--json",
		]);
		if (bootstrapResult.status !== 0) {
			errors.push(
				`harness fixture bootstrap exited ${
					bootstrapResult.status ?? "unknown"
				}: ${bootstrapResult.stderr.trim() || bootstrapResult.stdout.trim()}`,
			);
		}
	}

	const before = gitStatus(absoluteRepo);
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
	const missingFleetSurfaces = parsed.ok
		? missingFleetContractSurfaces(output)
		: [];
	for (const surface of missingFleetSurfaces) {
		errors.push(
			`fleet contract missing ${surface.group} surface ${surface.path}; ${surface.fix}`,
		);
	}
	const legacyGreptilePaths = existingLegacyGreptilePaths(absoluteRepo);
	for (const path of legacyGreptilePaths) {
		errors.push(
			`legacy Greptile artifact still present: ${path}; remove via harness-managed migration/eject cleanup before live upgrade`,
		);
	}
	const codestyleFailures = codestyleParityFailures(absoluteRepo);
	const codestyleError = codestyleParityError(codestyleFailures);
	if (codestyleError !== null) {
		errors.push(codestyleError);
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
		repo: resolve(repo),
		executionRepo: absoluteRepo,
		cleanup,
		materializedFixture: materialized.cleanup !== null,
		exitCode: commandResult.status,
		packageManager: output?.packageManager,
		updatedCount: Array.isArray(output?.updated) ? output.updated.length : null,
		skippedCount: Array.isArray(output?.skipped) ? output.skipped.length : null,
		updateMode: output?.updateMode ?? null,
		trackedManifest: output?.trackedManifest ?? null,
		createdAliasMatchesUpdated,
		statusChangedByDryRun,
		missingCriticalGroups,
		missingFleetContractSurfaces: missingFleetSurfaces,
		legacyGreptilePaths,
		codestyleParityFailures: codestyleFailures,
		criticalSurfaces: parsed.ok ? criticalSurfaceStates(output) : {},
		errors,
	};
}

/**
 * Run the harness upgrade matrix against the given repositories and produce a structured report.
 * @param {{cli: string, repos: string[]}} options - Run options.
 * @param {string} options.cli - Path to the harness CLI to execute.
 * @param {string[]} options.repos - Repository paths to test.
 * @returns {{schemaVersion: string, cli: string, repoCount: number, pass: boolean, setupErrors: string[], results: object[]}} A report containing the resolved CLI path, number of repositories processed, overall pass/fail, any setup errors, and detailed per-repo results.
 */
export function runUpgradeMatrix({ cli, repos }) {
	const resolvedCli = resolve(cli);
	const setupErrors = [];
	if (!existsSync(resolvedCli)) {
		setupErrors.push(`CLI not found: ${resolvedCli}`);
	}

	const materializedCleanups = [];
	const results = setupErrors.length
		? []
		: repos.map((repo) => {
				const result = summarizeRepo(repo, resolvedCli);
				if (result.cleanup) {
					materializedCleanups.push(result.cleanup);
				}
				return result;
			});
	for (const path of materializedCleanups) {
		rmSync(path, { recursive: true, force: true });
	}
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

/**
 * Print a human-readable report to stdout/stderr: print setup errors if any, otherwise print one-line summaries for each repository and their error lines.
 * @param {object} report - Test run report.
 * @param {string[]} report.setupErrors - Setup-level errors; when non-empty they are printed to stderr and per-repo summaries are skipped.
 * @param {Array<object>} report.results - Per-repo results to summarize.
 * @param {string} report.results[].repo - Repository path or identifier.
 * @param {string} report.results[].updateMode - The reported update mode for the repository.
 * @param {boolean} report.results[].trackedManifest - Whether the repository uses a tracked manifest.
 * @param {number} report.results[].updatedCount - Number of updated surfaces reported.
 * @param {number} report.results[].skippedCount - Number of skipped surfaces reported.
 * @param {boolean} report.results[].statusChangedByDryRun - Whether git status changed during the dry-run.
 * @param {string[]} report.results[].errors - List of error messages for the repository; each is printed on its own stderr line prefixed with "  - ".
 */
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

/**
 * Parse CLI arguments, run the upgrade-matrix workflow, and print results.
 *
 * @param {string[]} argv - Command-line arguments to parse (typically process.argv.slice(2)).
 * @returns {number} Exit code: `0` when all checks pass, `1` when any repository failed, `2` on argument parsing error.
 */
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

if (process.argv[1] === CURRENT_FILE) {
	process.exitCode = runCli(process.argv.slice(2));
}
