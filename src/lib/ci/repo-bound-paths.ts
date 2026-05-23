import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeError } from "../input/sanitize.js";

/** Result for repository-bounded path resolution helpers. */
export type RepoBoundPathResult =
	| { ok: true; absolutePath: string }
	| { ok: false; error: string };

/**
 * Determines whether `path` is equal to or a descendant of `rootPath`.
 *
 * @param rootPath - The root directory path to test against (lexical form)
 * @param path - The path to check (lexical form)
 * @returns `true` if `path` is `rootPath` or is located inside `rootPath`, `false` otherwise
 */
function isWithinRoot(rootPath: string, path: string): boolean {
	return path === rootPath || path.startsWith(`${rootPath}${sep}`);
}

/**
 * Validates that a non-existent target path can be safely created inside the repository and returns the resolved absolute path.
 *
 * Performs the following checks:
 * - Finds the nearest existing ancestor directory of `absolutePath`.
 * - Fails if no existing ancestor is found before hitting the filesystem root (indicates escaping `targetDir`).
 * - Fails if the nearest existing ancestor is not a directory or is a symbolic link.
 * - Fails if the real (resolved) ancestor is outside the repository root.
 *
 * @param targetDir - Repository root directory against which containment is enforced
 * @param absolutePath - Absolute filesystem path that may not exist yet
 * @param label - Human-readable label used in error messages
 * @param configuredPath - Original configured path string used in error messages
 * @returns `{ ok: true; absolutePath }` when the original `absolutePath` is accepted; otherwise `{ ok: false; error: string }` describing why the path is unsafe
 */
function resolveSafeAncestor(
	targetDir: string,
	absolutePath: string,
	label: string,
	configuredPath: string,
): RepoBoundPathResult {
	let ancestor = dirname(absolutePath);
	while (!existsSync(ancestor)) {
		const parent = dirname(ancestor);
		if (parent === ancestor) {
			return {
				ok: false,
				error: `${label} path escapes repository root: ${configuredPath}`,
			};
		}
		ancestor = parent;
	}
	const ancestorStat = lstatSync(ancestor);
	if (!ancestorStat.isDirectory() || ancestorStat.isSymbolicLink()) {
		return {
			ok: false,
			error: `${label} path parent is not a safe directory: ${configuredPath}`,
		};
	}
	if (!isWithinRoot(realpathSync(targetDir), realpathSync(ancestor))) {
		return {
			ok: false,
			error: `${label} path escapes repository root: ${configuredPath}`,
		};
	}
	return { ok: true, absolutePath };
}

/**
 * Resolve a configured relative path against a repository root, rejecting paths that escape the root or are symbolic links.
 *
 * @param targetDir - Repository root directory on disk
 * @param configuredPath - Configured relative path to resolve (whitespace is ignored)
 * @param label - Human-readable label used in generated error messages
 * @param mustExist - If true, fail when the resolved path does not exist
 * @param expectedKind - Expected filesystem kind for an existing path: `"file"` or `"directory"`
 * @returns `{ ok: true; absolutePath: string }` when resolution succeeds, or `{ ok: false; error: string }` with a descriptive error when it fails
 */
export function resolveRepoBoundPath(
	targetDir: string,
	configuredPath: string,
	label: string,
	mustExist: boolean,
	expectedKind: "file" | "directory" = "file",
): RepoBoundPathResult {
	const candidatePath = configuredPath.trim();
	if (candidatePath.length === 0) {
		return {
			ok: false,
			error: `${label} path cannot be empty.`,
		};
	}
	let rootPath: string;
	try {
		rootPath = realpathSync(targetDir);
	} catch (error) {
		return {
			ok: false,
			error: `${label} target directory cannot be resolved: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
	const lexicalRootPath = resolve(targetDir);
	const absolutePath = resolve(targetDir, candidatePath);
	if (!isWithinRoot(lexicalRootPath, absolutePath)) {
		return {
			ok: false,
			error: `${label} path escapes repository root: ${configuredPath}`,
		};
	}

	if (existsSync(absolutePath)) {
		const stat = lstatSync(absolutePath);
		if (stat.isSymbolicLink()) {
			return {
				ok: false,
				error: `${label} path cannot be a symbolic link: ${configuredPath}`,
			};
		}
		if (expectedKind === "file" && !stat.isFile()) {
			return {
				ok: false,
				error: `${label} must be a file: ${configuredPath}`,
			};
		}
		if (expectedKind === "directory" && !stat.isDirectory()) {
			return {
				ok: false,
				error: `${label} must be a directory: ${configuredPath}`,
			};
		}
		if (!isWithinRoot(rootPath, realpathSync(absolutePath))) {
			return {
				ok: false,
				error: `${label} path escapes repository root: ${configuredPath}`,
			};
		}
		return { ok: true, absolutePath };
	}

	if (mustExist) {
		return {
			ok: false,
			error: `${label} not found: ${configuredPath}`,
		};
	}

	return resolveSafeAncestor(targetDir, absolutePath, label, configuredPath);
}

/**
 * Resolve a file:// URL to an on-disk file path that is inside the repository and is not a symlink.
 *
 * Converts `url` to a filesystem path, verifies the path exists, is a regular file (not a symbolic link),
 * and that the file's realpath is contained within the resolved `targetDir`.
 *
 * @param targetDir - Repository root directory used to validate containment.
 * @param url - The file URL to resolve.
 * @param label - Human-readable label included in error messages.
 * @returns `{ ok: true; absolutePath: string }` when the URL resolves to an allowed file; `{ ok: false; error: string }` otherwise.
 *          Errors are returned for an invalid file URL, missing path, symbolic link, non-file target, or repository-root escape.
 */
export function resolveRepoBoundFileUrl(
	targetDir: string,
	url: string,
	label: string,
): RepoBoundPathResult {
	let filePath: string;
	try {
		filePath = fileURLToPath(url);
	} catch (error) {
		return {
			ok: false,
			error: `${label} is not a valid file URL: ${sanitizeError(error)}`,
		};
	}
	const rootPath = realpathSync(targetDir);
	const absolutePath = resolve(filePath);

	if (!existsSync(absolutePath)) {
		return {
			ok: false,
			error: `${label} not found: ${url}`,
		};
	}
	const stat = lstatSync(absolutePath);
	if (stat.isSymbolicLink()) {
		return {
			ok: false,
			error: `${label} cannot be a symbolic link: ${url}`,
		};
	}
	if (!stat.isFile()) {
		return {
			ok: false,
			error: `${label} must be a file: ${url}`,
		};
	}
	if (!isWithinRoot(rootPath, realpathSync(absolutePath))) {
		return {
			ok: false,
			error: `${label} escapes repository root: ${url}`,
		};
	}
	return { ok: true, absolutePath };
}

/**
 * Determine whether a relative restore path is permitted and remains within the repository.
 *
 * Checks that `relativePath` is present in `allowedRelativePaths`, that the resolved path does not traverse or end at a symbolic link, and that the path (or its nearest existing ancestor when the path does not exist) is contained within `targetDir`.
 *
 * @param targetDir - Repository root directory on disk
 * @param relativePath - Candidate relative path to validate
 * @param allowedRelativePaths - Set of allowed relative paths; `relativePath` must be a member
 * @returns `true` if `relativePath` is allowlisted and resolves (or has a safe existing ancestor) strictly inside `targetDir` without any symbolic links, `false` otherwise
 */
export function isSafeAllowedRestorePath(
	targetDir: string,
	relativePath: string,
	allowedRelativePaths: ReadonlySet<string>,
): boolean {
	if (!allowedRelativePaths.has(relativePath)) {
		return false;
	}
	const rootPath = realpathSync(targetDir);
	const absolutePath = resolve(targetDir, relativePath);

	if (existsSync(absolutePath)) {
		const stat = lstatSync(absolutePath);
		if (stat.isSymbolicLink()) {
			return false;
		}
		return isWithinRoot(rootPath, realpathSync(absolutePath));
	}

	let ancestor = dirname(absolutePath);
	while (!existsSync(ancestor)) {
		const parent = dirname(ancestor);
		if (parent === ancestor) {
			return false;
		}
		ancestor = parent;
	}
	const ancestorStat = lstatSync(ancestor);
	if (!ancestorStat.isDirectory() || ancestorStat.isSymbolicLink()) {
		return false;
	}
	return isWithinRoot(rootPath, realpathSync(ancestor));
}
