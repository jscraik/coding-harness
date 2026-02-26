import { realpathSync } from "node:fs";
import { dirname, normalize, resolve, sep } from "node:path";

export class PathTraversalError extends Error {
	constructor() {
		super("Path traversal detected");
		this.name = "PathTraversalError";
	}
}

/**
 * Validate that a user-provided path stays within the base directory.
 * Handles symlink attacks by canonicalizing the resolved path.
 */
export function validatePath(baseDir: string, userPath: string): string {
	const resolved = resolve(baseDir, normalize(userPath));
	const realBase = realpathSync(baseDir);
	const isWithinBase = (candidate: string): boolean =>
		candidate === realBase || candidate.startsWith(`${realBase}${sep}`);

	// CRITICAL: Canonicalize resolved path BEFORE comparison
	let realResolved: string;
	try {
		realResolved = realpathSync(resolved);
	} catch {
		// Path doesn't exist - validate parent directory
			const parentDir = dirname(resolved);
			try {
				const realParent = realpathSync(parentDir);
				if (!isWithinBase(realParent)) {
					throw new PathTraversalError();
				}
			} catch {
				throw new PathTraversalError();
			}
		return resolved;
	}

	if (!isWithinBase(realResolved)) {
		throw new PathTraversalError();
	}
	return realResolved;
}
