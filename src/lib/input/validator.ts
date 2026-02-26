import { realpathSync } from "node:fs";
import { dirname, normalize, resolve, sep } from "node:path";

export class PathTraversalError extends Error {
	constructor() {
		super("Path traversal detected");
		this.name = "PathTraversalError";
	}
}

function resolveNearestExistingAncestor(path: string): string {
	let current = path;

	while (true) {
		try {
			return realpathSync(current);
		} catch {
			const parent = dirname(current);
			if (parent === current) {
				throw new PathTraversalError();
			}
			current = parent;
		}
	}
}

function isWithinBase(realBase: string, realTarget: string): boolean {
	if (realTarget === realBase) {
		return true;
	}
	const baseWithSep = realBase.endsWith(sep) ? realBase : `${realBase}${sep}`;
	return realTarget.startsWith(baseWithSep);
}

/**
 * Validate that a user-provided path stays within the base directory.
 * Handles symlink attacks by canonicalizing the resolved path.
 */
export function validatePath(baseDir: string, userPath: string): string {
	const resolved = resolve(baseDir, normalize(userPath));
	const realBase = realpathSync(baseDir);

	// CRITICAL: Canonicalize resolved path BEFORE comparison
	let realResolved: string;
	try {
		realResolved = realpathSync(resolved);
	} catch {
		// Path doesn't exist - validate nearest existing ancestor directory
		try {
			const realAncestor = resolveNearestExistingAncestor(resolved);
			if (!isWithinBase(realBase, realAncestor)) {
				throw new PathTraversalError();
			}
		} catch {
			throw new PathTraversalError();
		}
		return resolved;
	}

	if (!isWithinBase(realBase, realResolved)) {
		throw new PathTraversalError();
	}
	return realResolved;
}
