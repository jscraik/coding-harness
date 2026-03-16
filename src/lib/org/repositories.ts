import { existsSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Find git repositories in a directory.
 *
 * Looks for directories containing a `.git` directory or `.git` file
 * (for worktree-style repositories).
 */
export function findRepositories(basePath: string): string[] {
	const repos: string[] = [];

	if (!existsSync(basePath)) {
		return repos;
	}

	const baseGitPath = join(basePath, ".git");
	if (existsSync(baseGitPath)) {
		try {
			const baseGitStat = lstatSync(baseGitPath);
			if (baseGitStat.isDirectory() || baseGitStat.isFile()) {
				repos.push(basePath);
			}
		} catch {
			// Ignore invalid .git metadata and continue scanning children.
		}
	}

	const entries = readdirSync(basePath, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const fullPath = join(basePath, entry.name);
			const gitPath = join(fullPath, ".git");

			if (existsSync(gitPath)) {
				try {
					const gitStat = lstatSync(gitPath);
					if (gitStat.isDirectory() || gitStat.isFile()) {
						repos.push(fullPath);
					}
				} catch {
					// Ignore invalid .git metadata and continue.
				}
			}
		}
	}

	return repos;
}
