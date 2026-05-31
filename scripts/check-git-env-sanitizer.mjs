#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { execFileSync } from "node:child_process";
import { tsImport } from "tsx/esm/api";

const { sanitizeGitEnvironment } = await tsImport(
	"../src/lib/git/safe-env.ts",
	import.meta.url,
);

const repoRoot = process.cwd();
const sourceFiles = [
	...new Set(
		execFileSync(
			"git",
			["ls-files", "--cached", "--others", "--exclude-standard", "--", "src"],
			{
				cwd: repoRoot,
				encoding: "utf8",
				env: sanitizeGitEnvironment(process.env, { policy: "minimal" }),
			},
		)
			.split("\n")
			.filter(Boolean)
			.filter((path) => path.endsWith(".ts"))
			.filter((path) => !path.endsWith(".test.ts"))
			.filter((path) => path !== "src/lib/git/safe-env.ts"),
	),
];

const manualGitEnvPatterns = [
	/delete\s+[\w.]+\.GIT_[A-Z0-9_]+/,
	/delete\s+[\w.]+\[\s*["'`]GIT_[A-Z0-9_]+["'`]\s*\]/,
	/GIT_[A-Z0-9_]+[\s\S]{0,200}delete\s+[\w.]+\[[^\]]+\]/,
	/\.startsWith\(["']GIT_["']\)[\s\S]{0,200}delete\s+[\w.]+\[[^\]]+\]/,
	/\/\^GIT_\/\.test\([^)]*\)[\s\S]{0,200}delete\s+[\w.]+\[[^\]]+\]/,
];

const violations = [];
for (const path of sourceFiles) {
	const content = readFileSync(path, "utf8");
	for (const pattern of manualGitEnvPatterns) {
		if (pattern.test(content)) {
			violations.push(relative(repoRoot, path));
			break;
		}
	}
}

if (violations.length > 0) {
	console.error(
		[
			"[git-env-sanitizer] manual git environment cleanup found outside src/lib/git/safe-env.ts:",
			...violations.map((path) => `  - ${path}`),
			"Use sanitizeGitEnvironment with policy minimal or strict.",
		].join("\n"),
	);
	process.exit(1);
}

console.log("[git-env-sanitizer] no manual git environment cleanup found");
