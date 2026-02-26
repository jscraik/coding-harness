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
		// Path doesn't exist - validate by walking up to find existing ancestor
		let currentDir = dirname(resolved);
		while (currentDir !== baseDir && currentDir !== dirname(currentDir)) {
			try {
				const realCurrent = realpathSync(currentDir);
				if (isWithinBase(realCurrent)) {
					// Found an existing ancestor within base, path is safe
					return resolved;
				}
				break;
			} catch {
				// Parent doesn't exist either, keep walking up
				currentDir = dirname(currentDir);
			}
		}
		// If we reached baseDir or root without finding an existing dir,
		// check if baseDir itself exists and validates
		try {
			if (isWithinBase(realpathSync(baseDir))) {
				return resolved;
			}
		} catch {
			// Base dir doesn't exist - cannot validate
		}
		throw new PathTraversalError();
	}

	if (!isWithinBase(realResolved)) {
		throw new PathTraversalError();
	}
	return realResolved;
}
