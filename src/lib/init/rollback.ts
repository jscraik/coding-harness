import { createHash } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	realpathSync,
	rmSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { sanitizeError } from "../input/sanitize.js";
import { atomicWrite } from "./migration.js";
import {
	type LoadManifestOptions,
	loadManifestData,
} from "./rollback-manifest-validation.js";
import {
	BACKUPS_DIR,
	type BackupResult,
	type CIProvider,
	HARNESS_DIR,
	MANIFEST_FILE,
	type ManifestEntry,
	type ManifestResult,
	type RestoreManifest,
	type RollbackResult,
} from "./types.js";

// Re-export for convenience
export type {
	BackupResult,
	ManifestResult,
	RollbackResult,
	ManifestEntry,
	RestoreManifest,
	CIProvider,
};

/**
 * Calculate backup hash from relative path.
 * Uses SHA256 hash of relative path for collision-safe naming.
 * foo/bar.yml -> a1b2c3d4e5f6g7h8.bak (not foo-bar.yml.bak)
 */
export function calculateBackupHash(relativePath: string): string {
	return createHash("sha256").update(relativePath).digest("hex").slice(0, 16);
}

/**
 * Path sanitization result type (internal use)
 */
type PathResult =
	| { ok: true; value: string }
	| { ok: false; error: { code: string; message: string; path?: string } };

function isPathWithinBase(
	baseRealPath: string,
	candidatePath: string,
): boolean {
	return (
		candidatePath === baseRealPath ||
		candidatePath.startsWith(`${baseRealPath}${sep}`)
	);
}

function checkPathSymlinks(
	normalizedBase: string,
	resolvedPath: string,
	relativePath: string,
): PathResult {
	const relToBase = relative(normalizedBase, resolvedPath);
	const segments = relToBase.split(sep).filter((segment) => segment.length > 0);
	let walkPath = normalizedBase;
	for (const segment of segments) {
		walkPath = join(walkPath, segment);
		if (!existsSync(walkPath)) {
			break;
		}
		try {
			if (lstatSync(walkPath).isSymbolicLink()) {
				return {
					ok: false,
					error: {
						code: "PATH_TRAVERSAL",
						message: `Symlink detected in path: ${relativePath}`,
						path: relativePath,
					},
				};
			}
		} catch (error) {
			return {
				ok: false,
				error: {
					code: "INVALID_PATH",
					message: `Failed to validate path safety: ${sanitizeError(error)}`,
					path: relativePath,
				},
			};
		}
	}
	return { ok: true, value: resolvedPath };
}

function verifyRealpathContained(
	resolvedPath: string,
	baseRealPath: string,
	relativePath: string,
): PathResult {
	let nearestExisting = resolvedPath;
	while (!existsSync(nearestExisting)) {
		const parent = dirname(nearestExisting);
		if (parent === nearestExisting) {
			break;
		}
		nearestExisting = parent;
	}

	try {
		const realNearest = realpathSync(nearestExisting);
		if (!isPathWithinBase(baseRealPath, realNearest)) {
			return {
				ok: false,
				error: {
					code: "PATH_TRAVERSAL",
					message: `Path traversal blocked: ${relativePath}`,
					path: relativePath,
				},
			};
		}
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: `Failed to resolve path safety: ${sanitizeError(error)}`,
				path: relativePath,
			},
		};
	}

	return { ok: true, value: resolvedPath };
}

/** Sanitize a path to prevent traversal and symlink escapes. */
export function sanitizePath(base: string, relativePath: string): PathResult {
	if (!base || typeof base !== "string") {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: "Base directory must be a non-empty string",
			},
		};
	}

	if (!relativePath || typeof relativePath !== "string") {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: "Relative path must be a non-empty string",
			},
		};
	}

	const resolved = resolve(base, relativePath);
	const normalizedBase = resolve(base);

	// Resolve the real base dir (must exist).
	let baseRealPath: string;
	try {
		baseRealPath = realpathSync(normalizedBase);
	} catch {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: `Base directory must exist and be resolvable: ${base}`,
			},
		};
	}

	const baseWithSep = normalizedBase.endsWith(sep)
		? normalizedBase
		: normalizedBase + sep;

	if (resolved !== normalizedBase && !resolved.startsWith(baseWithSep)) {
		return {
			ok: false,
			error: {
				code: "PATH_TRAVERSAL",
				message: `Path traversal blocked: ${relativePath}`,
				path: relativePath,
			},
		};
	}

	const symlinkCheck = checkPathSymlinks(
		normalizedBase,
		resolved,
		relativePath,
	);
	if (!symlinkCheck.ok) {
		return symlinkCheck;
	}

	const realpathCheck = verifyRealpathContained(
		resolved,
		baseRealPath,
		relativePath,
	);
	if (!realpathCheck.ok) {
		return realpathCheck;
	}

	return { ok: true, value: resolved };
}

/**
 * Resolves a known workspace symlink and verifies its real target stays within the repository.
 *
 * @param base - Repository root directory
 * @param relativePath - Repository-relative symlink path
 * @returns Resolved real target path or structured validation error
 */
export function resolveSafeWorkspaceSymlink(
	base: string,
	relativePath: string,
): PathResult {
	const targetPath = resolve(base, relativePath);
	const normalizedBase = resolve(base);

	let baseRealPath: string;
	try {
		baseRealPath = realpathSync(normalizedBase);
	} catch {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: `Base directory must exist and be resolvable: ${base}`,
			},
		};
	}

	try {
		const relToBase = relative(normalizedBase, targetPath);
		const segments = relToBase
			.split(sep)
			.filter((segment) => segment.length > 0);
		let walkPath = normalizedBase;
		let nearestExisting = normalizedBase;
		let sawWorkspaceSymlink = false;

		for (const segment of segments) {
			walkPath = join(walkPath, segment);
			if (!existsSync(walkPath)) {
				break;
			}
			nearestExisting = walkPath;
			if (lstatSync(walkPath).isSymbolicLink()) {
				sawWorkspaceSymlink = true;
			}
		}

		if (!sawWorkspaceSymlink) {
			return {
				ok: false,
				error: {
					code: "PATH_TRAVERSAL",
					message: `Symlink detected in path: ${relativePath}`,
					path: relativePath,
				},
			};
		}

		const realNearestPath = realpathSync(nearestExisting);
		if (!isPathWithinBase(baseRealPath, realNearestPath)) {
			return {
				ok: false,
				error: {
					code: "PATH_TRAVERSAL",
					message: `Symlink detected in path: ${relativePath}`,
					path: relativePath,
				},
			};
		}

		return {
			ok: true,
			value: existsSync(targetPath) ? realpathSync(targetPath) : targetPath,
		};
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: `Failed to validate path safety: ${sanitizeError(e)}`,
				path: relativePath,
			},
		};
	}
}

/**
 * Create backup of existing file with symlink detection and hash-based naming.
 * Returns backupHash (16-char SHA256 prefix) or null for new files.
 */
export function createBackup(
	targetDir: string,
	relativePath: string,
): BackupResult {
	const pathResult = sanitizePath(targetDir, relativePath);
	if (!pathResult.ok) return pathResult;

	const source = pathResult.value;

	// Check if file exists
	if (!existsSync(source)) {
		return { ok: true, value: null }; // New file, no backup needed
	}

	// CRITICAL: Reject symlinks to prevent arbitrary file read
	try {
		const stat = lstatSync(source);
		if (stat.isSymbolicLink()) {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: `Symlink detected at ${relativePath} - rejected for security`,
					path: relativePath,
				},
			};
		}
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to check file type: ${sanitizeError(e)}`,
				path: relativePath,
			},
		};
	}

	const backupHash = calculateBackupHash(relativePath);
	const backupPathResult = sanitizePath(
		targetDir,
		`${HARNESS_DIR}/${BACKUPS_DIR}/${backupHash}.bak`,
	);
	if (!backupPathResult.ok) {
		return backupPathResult;
	}
	const backupPath = backupPathResult.value;

	try {
		mkdirSync(dirname(backupPath), { recursive: true });
		copyFileSync(source, backupPath);
		return { ok: true, value: backupHash };
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to create backup: ${sanitizeError(e)}`,
				path: relativePath,
			},
		};
	}
}

/**
 * Loads and validates the harness restore manifest from `.harness/restore-manifest.json`.
 *
 * @param targetDir - Repository root
 * @param options - Load behavior flags and CI provider hint
 * @returns Validated manifest entries or structured load error
 */
export function loadManifest(
	targetDir: string,
	options: LoadManifestOptions = {},
): ManifestResult {
	const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);

	if (!existsSync(manifestPath)) {
		return {
			ok: false,
			error: {
				code: "MANIFEST_NOT_FOUND",
				message: "No restore manifest found. Run `harness init --track` first.",
				path: MANIFEST_FILE,
			},
		};
	}

	return loadManifestData(targetDir, manifestPath, options, {
		atomicWrite,
		calculateBackupHash,
		resolveSafeWorkspaceSymlink,
		sanitizePath,
	});
}

/**
 * Execute rollback: restore files from backups, delete created files.
 * Cleans up backups and manifest after successful restore.
 */
export function executeRollback(
	targetDir: string,
	manifest: RestoreManifest,
): RollbackResult {
	const restored: string[] = [];
	const deleted: string[] = [];
	const backupDir = resolve(targetDir, HARNESS_DIR, BACKUPS_DIR);

	try {
		for (const entry of manifest.files) {
			// Re-validate path (defense in depth)
			const pathResult = sanitizePath(targetDir, entry.path);
			if (!pathResult.ok) {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: `Path validation failed during rollback: ${entry.path}`,
						path: entry.path,
					},
				};
			}

			const targetPath = pathResult.value;

			if (entry.action === "created") {
				// Delete created file
				if (existsSync(targetPath)) {
					rmSync(targetPath, { force: true });
					deleted.push(entry.path);
				}
			} else {
				// Restore from backup
				const backupPath = resolve(backupDir, `${entry.backupHash}.bak`);
				if (!existsSync(backupPath)) {
					return {
						ok: false,
						error: {
							code: "WRITE_ERROR",
							message: `Backup file missing: ${entry.backupHash}`,
							path: entry.path,
						},
					};
				}

				// SECURITY: reject any symlink at the target path or in its
				// parent directory to prevent symlink-based rollback overwrite.
				try {
					if (
						existsSync(targetPath) &&
						lstatSync(targetPath).isSymbolicLink()
					) {
						return {
							ok: false,
							error: {
								code: "WRITE_ERROR",
								message: `Symlink detected at rollback target: ${entry.path} — rollback rejected`,
								path: entry.path,
							},
						};
					}
					const realTargetDir = realpathSync(targetDir);
					const parentDir = dirname(targetPath);
					const realParent = existsSync(parentDir)
						? realpathSync(parentDir)
						: parentDir;
					if (
						realParent !== realTargetDir &&
						!realParent.startsWith(`${realTargetDir}${sep}`)
					) {
						return {
							ok: false,
							error: {
								code: "WRITE_ERROR",
								message: `Rollback path escaped workspace: ${entry.path}`,
								path: entry.path,
							},
						};
					}
				} catch (e) {
					return {
						ok: false,
						error: {
							code: "WRITE_ERROR",
							message: `Failed to validate rollback target: ${sanitizeError(e)}`,
							path: entry.path,
						},
					};
				}

				copyFileSync(backupPath, targetPath);
				restored.push(entry.path);
			}
		}

		// Cleanup backups and manifest
		rmSync(backupDir, { recursive: true, force: true });
		rmSync(resolve(targetDir, HARNESS_DIR, MANIFEST_FILE), { force: true });

		// Try to remove .harness dir if empty
		try {
			rmSync(resolve(targetDir, HARNESS_DIR), { recursive: true });
		} catch {
			// Directory not empty, leave it
		}

		return { ok: true, value: { restored, deleted } };
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Rollback failed: ${sanitizeError(e)}`,
			},
		};
	}
}
