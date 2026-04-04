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
		sourcePath: resolve(REPO_ROOT, "src/templates/codex-preflight.sh"),
		targetPath: resolve(REPO_ROOT, "scripts/codex-preflight.sh"),
	},
	{
		sourcePath: resolve(
			REPO_ROOT,
			"src/templates/codex-preflight-local-memory-legacy.sh",
		),
		targetPath: resolve(
			REPO_ROOT,
			"scripts/codex-preflight-local-memory-legacy.sh",
		),
	},
];

function usage() {
	console.error(`Usage: node scripts/sync-codex-preflight.cjs [--check|--write] [--source <path>] [--target <path>]

Synchronize the project runtime codex-preflight script from the canonical
scaffold template source.

Options:
  --check           Fail if target content differs from source or is not executable
  --write           Copy source content to target and set executable bit
  --source <path>   Override canonical source path
  --target <path>   Override runtime target path
  -h, --help        Show help
`);
}

function fail(message, exitCode = 1) {
	console.error(`[codex-preflight-sync] ${message}`);
	process.exit(exitCode);
}

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

function assertFileExists(filePath, label) {
	if (!existsSync(filePath)) {
		fail(`${label} not found: ${filePath}`);
	}
}

function readBuffer(filePath) {
	return readFileSync(filePath);
}

function hasExecutableBit(filePath) {
	try {
		return (statSync(filePath).mode & 0o111) !== 0;
	} catch {
		return false;
	}
}

function checkPair(sourcePath, targetPath) {
	assertFileExists(sourcePath, "source");
	assertFileExists(targetPath, "target");

	const sourceContent = readBuffer(sourcePath);
	const targetContent = readBuffer(targetPath);
	if (!sourceContent.equals(targetContent)) {
		fail(
			`target drift detected: ${targetPath} no longer matches canonical template ${sourcePath}. Run \`node scripts/sync-codex-preflight.cjs --write\`.`,
		);
	}
	if (!hasExecutableBit(targetPath)) {
		fail(
			`target is not executable: ${targetPath}. Run \`node scripts/sync-codex-preflight.cjs --write\`.`,
		);
	}
	console.error(
		`[codex-preflight-sync] ok: ${targetPath} matches canonical template ${sourcePath}`,
	);
}

function writePair(sourcePath, targetPath) {
	assertFileExists(sourcePath, "source");

	const sourceContent = readBuffer(sourcePath);
	writeFileSync(targetPath, sourceContent);
	chmodSync(targetPath, EXECUTABLE_MODE);
	console.error(
		`[codex-preflight-sync] wrote ${targetPath} from canonical template ${sourcePath}`,
	);
}

function run() {
	const { mode, sourcePath, targetPath } = parseArgs(process.argv.slice(2));
	const pairs =
		sourcePath || targetPath ? [{ sourcePath, targetPath }] : DEFAULT_PAIRS;

	for (const pair of pairs) {
		if (mode === "write") {
			writePair(pair.sourcePath, pair.targetPath);
			continue;
		}
		checkPair(pair.sourcePath, pair.targetPath);
	}
}

run();
