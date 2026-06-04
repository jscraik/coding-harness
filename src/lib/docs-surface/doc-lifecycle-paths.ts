import { readdirSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

/** Resolve a repo-relative path while rejecting escapes outside the repository. */
export function safeRepoPath(
	repoRoot: string,
	relativePath: string,
): string | null {
	const candidate = resolve(join(repoRoot, relativePath));
	return candidate === repoRoot || candidate.startsWith(repoRoot + sep)
		? candidate
		: null;
}

/** Walk source-like files beneath a root path for distribution-boundary scans. */
export function walkFiles(root: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(root)) {
		const path = join(root, entry);
		const stat = statSync(path);
		if (stat.isDirectory()) {
			files.push(...walkFiles(path));
			continue;
		}
		if (/\.(cjs|js|json|md|mjs|sh|ts|ya?ml)$/.test(path)) {
			files.push(path);
		}
	}
	return files.sort();
}

/** Convert an absolute path inside the repo to a normalized repo-relative path. */
export function repoRelative(repoRoot: string, path: string): string {
	return path.slice(resolve(repoRoot).length + 1).replace(/\\/g, "/");
}
