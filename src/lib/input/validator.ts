import { lstatSync, realpathSync } from "node:fs";
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

	// First check: does the resolved path even potentially start with base (non-canonical)?
	// This catches obvious traversal attempts early (e.g., "../../../etc/passwd")
	// Use baseDir here, not realBase, since resolved is relative to baseDir
	if (!resolved.startsWith(`${baseDir}${sep}`) && resolved !== baseDir) {
		throw new PathTraversalError();
	}

	// CRITICAL: Canonicalize resolved path BEFORE final comparison
	let realResolved: string;
	try {
		realResolved = realpathSync(resolved);
	} catch {
		// Path doesn't exist OR is a dangling symlink.
		// Use lstatSync (no symlink follow) to detect symlinks explicitly:
		// a dangling symlink has lstat but no realpath, and may point outside the base.
		try {
			const lstat = lstatSync(resolved);
			if (lstat.isSymbolicLink()) {
				// Dangling symlink - always reject regardless of where its target points
				throw new PathTraversalError();
			}
		} catch (e) {
			if (e instanceof PathTraversalError) throw e;
			// lstatSync threw ENOENT - path truly doesn't exist, proceed to ancestor walk
		}

		// Path doesn't exist - validate by walking up to find existing ancestor
		let currentDir = dirname(resolved);
		// Keep walking up until we go past the base or hit the filesystem root
		while (currentDir !== dirname(currentDir)) {
			try {
				const realCurrent = realpathSync(currentDir);
				if (isWithinBase(realCurrent)) {
					// Found an existing ancestor within base, path is safe
					return resolved;
				}
				// Ancestor exists but is outside base - traversal detected
				throw new PathTraversalError();
			} catch (e) {
				if (e instanceof PathTraversalError) throw e;
				// Parent doesn't exist either, keep walking up
				currentDir = dirname(currentDir);
			}
		}
		// Reached filesystem root without finding an existing directory
		throw new PathTraversalError();
	}

	if (!isWithinBase(realResolved)) {
		throw new PathTraversalError();
	}
	return realResolved;
}
