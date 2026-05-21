import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeError } from "../input/sanitize.js";

/** Result for repository-bounded path resolution helpers. */
export type RepoBoundPathResult =
	| { ok: true; absolutePath: string }
	| { ok: false; error: string };

function isWithinRoot(rootPath: string, path: string): boolean {
	return path === rootPath || path.startsWith(`${rootPath}${sep}`);
}

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

/** Resolve a configured relative path while rejecting symlinks and repository escapes. */
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

/** Resolve a file URL while rejecting symlinks and repository escapes. */
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

/** Return true only for allowlisted restore paths that stay inside the repository. */
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
