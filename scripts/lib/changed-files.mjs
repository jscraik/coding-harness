#!/usr/bin/env node
import { execFileSync } from "node:child_process";

function runGit(repoRoot, args) {
	try {
		return execFileSync("git", args, {
			cwd: repoRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
	} catch {
		return "";
	}
}

/**
 * Collects the same changed-file set used by local quality gates.
 *
 * The default mode includes staged, unstaged, and branch-vs-main files so agents
 * cannot accidentally pass a narrow check after touching related files earlier
 * in the branch.
 *
 * @param {{
 *   repoRoot: string;
 *   modeAll?: boolean;
 *   modeStaged?: boolean;
 * }} options
 * @returns {string[]}
 */
export function collectChangedPaths({
	repoRoot,
	modeAll = false,
	modeStaged = false,
}) {
	if (modeAll) {
		return runGit(repoRoot, ["ls-files"]).split(/\r?\n/);
	}

	const paths = new Set();
	const diffModes = modeStaged
		? [["diff", "--cached", "--name-only", "--diff-filter=ACMR"]]
		: [
				["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
				["diff", "--name-only", "--diff-filter=ACMR"],
				["ls-files", "--others", "--exclude-standard"],
			];

	for (const gitArgs of diffModes) {
		for (const path of runGit(repoRoot, gitArgs).split(/\r?\n/)) {
			if (path) {
				paths.add(path);
			}
		}
	}

	if (!modeStaged) {
		const base =
			runGit(repoRoot, ["merge-base", "HEAD", "origin/main"]).trim() ||
			runGit(repoRoot, ["merge-base", "HEAD", "main"]).trim();
		if (base) {
			for (const path of runGit(repoRoot, [
				"diff",
				"--name-only",
				"--diff-filter=ACMR",
				`${base}...HEAD`,
			]).split(/\r?\n/)) {
				if (path) {
					paths.add(path);
				}
			}
		}
	}

	return [...paths];
}
