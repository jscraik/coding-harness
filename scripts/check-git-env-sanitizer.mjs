#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const sourceRoot = resolve(repoRoot, "src");

// Fail-closed: ensure src directory exists
if (!existsSync(sourceRoot)) {
	console.error("[check-git-env-sanitizer] src directory does not exist");
	process.exit(1);
}

try {
	const stats = statSync(sourceRoot);
	if (!stats.isDirectory()) {
		console.error("[check-git-env-sanitizer] src is not a directory");
		process.exit(1);
	}
} catch (error) {
	console.error(
		`[check-git-env-sanitizer] cannot access src directory: ${error.message}`,
	);
	process.exit(1);
}

const allowedFiles = new Set([
	"src/lib/git/safe-env.ts",
	"src/lib/git/safe-env.test.ts",
]);
const forbiddenPatterns = [
	{
		pattern: /delete\s+(?:\w+\.)*\w+\.GIT_[A-Z0-9_]+/u,
		message:
			"manual deletion of GIT_* variables must route through sanitizeGitEnvironment",
	},
	{
		pattern: /delete\s+(?:\w+\.)*\w+\[\s*["']GIT_[A-Z0-9_]+["']\s*\]/u,
		message:
			"manual deletion of GIT_* variables must route through sanitizeGitEnvironment",
	},
	{
		pattern: /\.startsWith\(\s*["']GIT_["']\s*\)/u,
		message:
			"manual broad GIT_* filtering must route through sanitizeGitEnvironment",
	},
];

const findings = [];

const sourceFiles = listFiles(sourceRoot);
if (sourceFiles.length === 0) {
	console.error(
		"[check-git-env-sanitizer] no source files found in src directory",
	);
	process.exit(1);
}

for (const file of sourceFiles) {
	const relativePath = relative(repoRoot, file);
	if (
		allowedFiles.has(relativePath) ||
		relativePath.endsWith(".test.ts") ||
		relativePath.endsWith(".test.tsx") ||
		!/\.[cm]?[jt]sx?$/u.test(relativePath)
	) {
		continue;
	}

	const source = readFileSync(file, "utf8");
	const lines = source.split("\n");
	for (const [index, line] of lines.entries()) {
		for (const { pattern, message } of forbiddenPatterns) {
			if (pattern.test(line)) {
				findings.push({
					line: index + 1,
					message,
					path: relativePath,
				});
			}
		}
	}
}

if (findings.length > 0) {
	console.error("[check-git-env-sanitizer] manual git env cleanup found:");
	for (const finding of findings) {
		console.error(`  ${finding.path}:${finding.line}: ${finding.message}`);
	}
	process.exit(1);
}

console.info(
	"[check-git-env-sanitizer] git env cleanup routes through src/lib/git/safe-env.ts.",
);

function listFiles(directory) {
	if (!existsSync(directory)) return [];
	const files = [];
	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);
		const stats = statSync(path);
		if (stats.isDirectory()) {
			files.push(...listFiles(path));
		} else if (stats.isFile()) {
			files.push(path);
		}
	}
	return files;
}
