#!/usr/bin/env node

const {
	chmodSync,
	existsSync,
	readFileSync,
	statSync,
	writeFileSync,
} = require("node:fs");
const { resolve } = require("node:path");

const REPO_ROOT = resolve(__dirname, "..");
const EXECUTABLE_MODE = 0o755;
const DEFAULT_PAIRS = [
	{
		name: "project-preflight",
		sourcePath: resolve(REPO_ROOT, "src/templates/codex-preflight.sh"),
		targetPath: resolve(REPO_ROOT, "scripts/codex-preflight.sh"),
		enforceContentMatch: false,
	},
	{
		name: "legacy-local-memory-fallback",
		sourcePath: resolve(
			REPO_ROOT,
			"src/templates/codex-preflight-local-memory-legacy.sh",
		),
		targetPath: resolve(
			REPO_ROOT,
			"scripts/codex-preflight-local-memory-legacy.sh",
		),
		enforceContentMatch: true,
	},
];

/**
 * Print the CLI usage and help message to standard error.
 *
 * Describes available modes (`--check`, `--write`), optional overrides (`--source`, `--target`),
 * and the help flag (`-h`, `--help`).
 */
function usage() {
	console.error(`Usage: node scripts/sync-codex-preflight.cjs [--check|--write] [--source <path>] [--target <path>]

Synchronize codex preflight runtime scripts from scaffold templates.

Options:
  --check           Validate executable bit and enforce content parity where configured
  --write           Copy source content to target and set executable bit
  --source <path>   Override canonical source path
  --target <path>   Override runtime target path
  -h, --help        Show help

Notes:
  - Default checks allow project-specific drift for scripts/codex-preflight.sh.
  - Default checks still enforce content parity for
    scripts/codex-preflight-local-memory-legacy.sh.
`);
}

/**
 * Log an error message (prefixed with "[codex-preflight-sync]") and terminate the process with the specified exit code.
 * @param {string} message - Message to display after the "[codex-preflight-sync]" prefix.
 * @param {number} [exitCode=1] - Exit code to terminate the process with.
 */
function fail(message, exitCode = 1) {
	console.error(`[codex-preflight-sync] ${message}`);
	process.exit(exitCode);
}

/**
 * Parse CLI arguments to determine the operation mode and optional source/target paths.
 *
 * Processes flags:
 * - `--check` (default) or `--write` to set the mode.
 * - `--source <path>` and `--target <path>` to override a single file pair.
 * - `-h`/`--help` prints usage and exits.
 *
 * @param {string[]} argv - CLI arguments (typically process.argv.slice(2)).
 * @returns {{mode: "check"|"write", sourcePath?: string, targetPath?: string}|null}
 *   An object with:
 *   - `mode`: either `"check"` or `"write"`.
 *   - `sourcePath` / `targetPath`: resolved absolute paths when provided; omitted otherwise.
 *   Returns `null` if help was requested (`-h` or `--help`).
 *
 * Note: Unknown arguments or missing values for `--source`/`--target` will terminate the process via the script's error handler.
 */
function parseArgs(argv) {
	let mode = "check";
	let sourcePath;
	let targetPath;

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		switch (argument) {
			case "--check":
				mode = "check";
				break;
			case "--write":
				mode = "write";
				break;
			case "--source":
				sourcePath = argv[index + 1] ? resolve(argv[index + 1]) : "";
				index += 1;
				break;
			case "--target":
				targetPath = argv[index + 1] ? resolve(argv[index + 1]) : "";
				index += 1;
				break;
			case "-h":
			case "--help":
				usage();
				process.exit(0);
				return null;
			default:
				fail(`unknown argument: ${argument}`, 2);
		}
	}

	if (!sourcePath) {
		if (targetPath) {
			fail("missing value for --source", 2);
		}
	}
	if (!targetPath) {
		if (sourcePath) {
			fail("missing value for --target", 2);
		}
	}

	return { mode, sourcePath, targetPath };
}

/**
 * Ensure the given filesystem path exists, otherwise terminate the process with an error.
 * @param {string} filePath - Path to the file or directory to verify.
 * @param {string} label - Human-readable name used in the error message if the path is missing.
 */
function assertFileExists(filePath, label) {
	if (!existsSync(filePath)) {
		fail(`${label} not found: ${filePath}`);
	}
}

/**
 * Read a file and return its raw Buffer contents.
 * @param {string} filePath - Path to the file to read.
 * @returns {Buffer} The file contents as a Buffer.
 */
function readBuffer(filePath) {
	return readFileSync(filePath);
}

/**
 * Determines whether the filesystem entry at the given path has any executable permission bits set.
 * @param {string} filePath - Path to the file or filesystem entry to check.
 * @returns {boolean} `true` if any execute bit is set (owner, group, or others), `false` otherwise or if the path cannot be stat-ed.
 */
function hasExecutableBit(filePath) {
	try {
		return (statSync(filePath).mode & 0o111) !== 0;
	} catch {
		return false;
	}
}

/**
 * Verify that a target file matches the canonical source file and is executable.
 *
 * If the files differ or the target lacks an executable bit, the process exits with an error message.
 *
 * @param {string} sourcePath - Path to the canonical template file.
 * @param {string} targetPath - Path to the target runtime script to validate.
 */
function checkPair(pair) {
	const {
		sourcePath,
		targetPath,
		enforceContentMatch = true,
		name = "pair",
	} = pair;
	assertFileExists(sourcePath, "source");
	assertFileExists(targetPath, "target");

	const sourceContent = readBuffer(sourcePath);
	const targetContent = readBuffer(targetPath);
	if (!sourceContent.equals(targetContent) && enforceContentMatch) {
		fail(
			`target drift detected: ${targetPath} no longer matches canonical template ${sourcePath}. Run \`node scripts/sync-codex-preflight.cjs --write\`.`,
		);
	}
	if (!sourceContent.equals(targetContent) && !enforceContentMatch) {
		console.error(
			`[codex-preflight-sync] info: ${targetPath} differs from template ${sourcePath}; drift is allowed for ${name}.`,
		);
	}
	if (!hasExecutableBit(targetPath)) {
		fail(
			`target is not executable: ${targetPath}. Run \`node scripts/sync-codex-preflight.cjs --write\`.`,
		);
	}
	console.error(`[codex-preflight-sync] ok: ${targetPath} is executable`);
}

/**
 * Synchronizes a target file with a canonical source template and sets executable permissions.
 * @param {string} sourcePath - Path to the canonical template file to copy from.
 * @param {string} targetPath - Path to the target file to overwrite and make executable.
 */
function writePair(sourcePath, targetPath) {
	assertFileExists(sourcePath, "source");

	const sourceContent = readBuffer(sourcePath);
	writeFileSync(targetPath, sourceContent);
	chmodSync(targetPath, EXECUTABLE_MODE);
	console.error(
		`[codex-preflight-sync] wrote ${targetPath} from canonical template ${sourcePath}`,
	);
}

/**
 * Parse CLI arguments and synchronize one or more template→target file pairs.
 *
 * Parses command-line options to determine the operation mode and optional
 * source/target overrides, then for each resolved pair either updates the
 * target from the canonical source (when mode is "write") or verifies the
 * target's contents and that it is executable (when mode is "check").
 */
function run() {
	const { mode, sourcePath, targetPath } = parseArgs(process.argv.slice(2));
	const pairs =
		sourcePath || targetPath
			? [{ sourcePath, targetPath, enforceContentMatch: true, name: "custom" }]
			: DEFAULT_PAIRS;

	for (const pair of pairs) {
		if (mode === "write") {
			writePair(pair.sourcePath, pair.targetPath);
			continue;
		}
		checkPair(pair);
	}
}

run();
