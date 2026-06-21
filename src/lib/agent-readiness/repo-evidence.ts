import {
	existsSync,
	lstatSync,
	readFileSync,
	readdirSync,
	statSync,
} from "node:fs";
import { join, relative } from "node:path";

/** Return existing repo-relative evidence paths from a candidate list. */
export function evidence(repoRoot: string, paths: readonly string[]): string[] {
	return paths.filter((path) => fileExists(repoRoot, path));
}

/** Find nested AGENTS.md files below the repository root. */
export function findScopedInstructionFiles(repoRoot: string): string[] {
	return findFiles(repoRoot, "AGENTS.md")
		.filter((path) => path !== "AGENTS.md")
		.sort();
}

/** Return true when a repo-relative file contains every requested token. */
export function fileContainsAll(
	repoRoot: string,
	path: string,
	needles: string[],
): boolean {
	const text = readText(repoRoot, path).toLowerCase();
	return (
		text.length > 0 &&
		needles.every((needle) => text.includes(needle.toLowerCase()))
	);
}

/** Return true when a repo-relative file contains at least one requested token. */
export function fileContainsAny(
	repoRoot: string,
	path: string,
	needles: string[],
): boolean {
	const text = readText(repoRoot, path).toLowerCase();
	return (
		text.length > 0 &&
		needles.some((needle) => text.includes(needle.toLowerCase()))
	);
}

/** Return true when a repo-relative path exists. */
export function fileExists(repoRoot: string, path: string): boolean {
	return existsSync(join(repoRoot, path));
}

/** Return true when a repo-relative path exists and is a directory. */
export function directoryExists(repoRoot: string, path: string): boolean {
	try {
		return statSync(join(repoRoot, path)).isDirectory();
	} catch {
		return false;
	}
}

/** Read a repo-relative UTF-8 file, returning an empty string when unavailable. */
export function readText(repoRoot: string, path: string): string {
	try {
		return readFileSync(join(repoRoot, path), "utf8");
	} catch {
		return "";
	}
}

function findFiles(repoRoot: string, fileName: string): string[] {
	const ignored = new Set([
		".git",
		".local",
		".playwright-mcp",
		".pytest_cache",
		".worktrees",
		"artifacts",
		"node_modules",
		"dist",
		"coverage",
		".cache",
		"tmp",
	]);
	const ignoredRepoPaths = new Set([
		".harness/archive",
		".harness/artifacts",
		".harness/backups",
		".harness/cache",
		".harness/ci-migrate-snapshots",
		".harness/evals",
		".harness/media",
		".harness/metrics",
		".harness/runs",
	]);
	const found: string[] = [];
	const stack = [repoRoot];

	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined) continue;
		const entries = safeReadDir(current);

		for (const entry of entries) {
			if (ignored.has(entry)) continue;
			const fullPath = join(current, entry);
			const repoPath = relative(repoRoot, fullPath);
			if (ignoredRepoPaths.has(repoPath)) continue;
			const stats = safeLstat(fullPath);
			if (!stats) continue;
			if (stats.isSymbolicLink()) continue;
			if (stats.isDirectory()) {
				stack.push(fullPath);
			} else if (entry === fileName) {
				found.push(relative(repoRoot, fullPath));
			}
		}
	}

	return found;
}

function safeReadDir(path: string): string[] {
	try {
		return readdirSync(path);
	} catch {
		return [];
	}
}

function safeLstat(path: string): ReturnType<typeof lstatSync> | null {
	try {
		return lstatSync(path);
	} catch {
		return null;
	}
}
