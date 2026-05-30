#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const sourceRoot = resolve(repoRoot, "src");
const allowedFiles = new Set([
	"src/lib/git/safe-env.ts",
	"src/lib/git/safe-env.test.ts",
]);
const forbiddenPatterns = [
	{
		pattern: /delete\s+\w+\.GIT_[A-Z0-9_]+/u,
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

for (const file of listFiles(sourceRoot)) {
	const relativePath = relative(repoRoot, file);
	if (allowedFiles.has(relativePath) || !/\.[cm]?[jt]sx?$/u.test(relativePath)) {
		continue;
	}
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
