/**
 * Rollback and backup functions for init command.
 *
 * Provides secure backup/restore operations with:
 * - Hash-based backup file naming
 * - Manifest-based tracking
 * - Symlink attack prevention
 * - Path traversal defense
 *
 * @module lib/init/rollback
 */

import { createHash } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { sanitizeError } from "../input/sanitize.js";
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

interface LoadManifestOptions {
	requireMetadata?: boolean;
	operation?: string;
}

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

/**
 * Sanitize a path to prevent directory traversal attacks.
 * Returns resolved absolute path or error.
 *
 * Guards applied (in order):
 * 1. Input validation — base and relativePath must be non-empty strings.
 * 2. Lexical containment — resolved path must start with base.
 * 3. Symlink-walk — every existing segment is checked with lstatSync;
 *    a symlinked directory anywhere in the chain is rejected.
 *    Prevents ".github -> /etc" style escapes that pass the prefix check.
 * 4. Realpath ancestor check — the nearest existing ancestor is canonicalised
 *    with realpathSync and verified to reside within the real base dir.
 *    This catches races and any edge case the walk misses.
 */
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

	// SECURITY: Walk each existing path segment and reject any symlink.
	// resolve() is purely lexical — it doesn't follow symlinks, so a
	// directory symlink (.github -> /etc) passes the prefix check above
	// but would redirect reads/writes outside the workspace.
	const relToBase = relative(normalizedBase, resolved);
	const segments = relToBase.split(sep).filter((s) => s.length > 0);
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

	// SECURITY: Realpath check on the nearest existing ancestor.
	// This is a second line of defence: even if the walk missed something,
	// canonicalising the ancestor and verifying it stays within the real
	// base dir catches cases where a symlink was created between the walk
	// and the eventual file operation (TOCTOU hardening).
	let nearestExisting = resolved;
	while (!existsSync(nearestExisting)) {
		const parent = dirname(nearestExisting);
		if (parent === nearestExisting) break; // filesystem root
		nearestExisting = parent;
	}
	try {
		const realNearest = realpathSync(nearestExisting);
		const baseRealWithSep = baseRealPath.endsWith(sep)
			? baseRealPath
			: `${baseRealPath}${sep}`;
		if (
			realNearest !== baseRealPath &&
			!realNearest.startsWith(baseRealWithSep)
		) {
			return {
				ok: false,
				error: {
					code: "PATH_TRAVERSAL",
					message: `Path traversal blocked: ${relativePath}`,
					path: relativePath,
				},
			};
		}
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: `Failed to resolve path safety: ${sanitizeError(e)}`,
				path: relativePath,
			},
		};
	}

	return { ok: true, value: resolved };
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
	const backupPath = resolve(
		targetDir,
		HARNESS_DIR,
		BACKUPS_DIR,
		`${backupHash}.bak`,
	);

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
 * Load and validate manifest from disk.
 * Re-validates all paths to prevent manifest tampering.
 */
function buildIncompleteManifestError(
	missingFields: string[],
	options: LoadManifestOptions,
): ManifestResult {
	const operationSuffix = options.operation ? ` for ${options.operation}` : "";
	return {
		ok: false,
		error: {
			code: "INCOMPLETE_MANIFEST",
			message: `Restore manifest is incomplete${operationSuffix}: missing ${missingFields.join(", ")}. Repair .harness/${MANIFEST_FILE} from a known-good tracked install, or remove .harness and re-run \`harness init --track\` when bootstrapping a fresh repo.`,
			path: MANIFEST_FILE,
		},
	};
}

export function loadManifest(
	targetDir: string,
	options: LoadManifestOptions = {},
): ManifestResult {
	const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);

	if (!existsSync(manifestPath)) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: "No restore manifest found. Run `harness init --track` first.",
				path: MANIFEST_FILE,
			},
		};
	}

	try {
		const content = readFileSync(manifestPath, "utf-8");
		const data = JSON.parse(content) as unknown;

		// Validate manifest structure
		if (typeof data !== "object" || data === null) {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: "Restore manifest is corrupted: not an object",
					path: MANIFEST_FILE,
				},
			};
		}

		const manifest = data as Record<string, unknown>;

		if (!Array.isArray(manifest.files)) {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: "Restore manifest is corrupted: missing files array",
					path: MANIFEST_FILE,
				},
			};
		}

		// CRITICAL: Re-validate all paths to prevent manifest tampering attacks
		const validatedFiles: ManifestEntry[] = [];
		for (const entry of manifest.files) {
			if (typeof entry !== "object" || entry === null) {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: "Restore manifest is corrupted: invalid entry",
						path: MANIFEST_FILE,
					},
				};
			}

			const e = entry as Record<string, unknown>;
			if (typeof e.path !== "string") {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: "Restore manifest is corrupted: missing path",
						path: MANIFEST_FILE,
					},
				};
			}

			// Re-apply path sanitization to every entry
			const pathResult = sanitizePath(targetDir, e.path);
			if (!pathResult.ok) {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: `Path traversal blocked in manifest: ${e.path}`,
						path: e.path,
					},
				};
			}

			// Validate action and backupHash
			if (e.action === "created") {
				validatedFiles.push({ path: e.path, action: "created" });
			} else if (e.action === "modified" && typeof e.backupHash === "string") {
				// Validate backupHash format (16-char hex)
				if (!/^[a-f0-9]{16}$/.test(e.backupHash)) {
					return {
						ok: false,
						error: {
							code: "WRITE_ERROR",
							message: `Invalid backup hash format: ${e.backupHash}`,
							path: e.path,
						},
					};
				}
				const expectedBackupHash = calculateBackupHash(e.path);
				if (e.backupHash !== expectedBackupHash) {
					return {
						ok: false,
						error: {
							code: "WRITE_ERROR",
							message: `Manifest backup hash mismatch for ${e.path}`,
							path: e.path,
						},
					};
				}
				validatedFiles.push({
					path: e.path,
					action: "modified",
					backupHash: e.backupHash,
				});
			} else {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: `Invalid manifest entry: action=${e.action}, backupHash=${e.backupHash}`,
						path: e.path,
					},
				};
			}
		}

		const missingFields: string[] = [];
		if (
			typeof manifest.harnessVersion !== "string" ||
			manifest.harnessVersion.length === 0
		) {
			missingFields.push("harnessVersion");
		}
		if (
			manifest.ciProvider !== "github-actions" &&
			manifest.ciProvider !== "circleci"
		) {
			missingFields.push("ciProvider");
		}
		if (options.requireMetadata && missingFields.length > 0) {
			return buildIncompleteManifestError(missingFields, options);
		}

		const harnessVersion =
			typeof manifest.harnessVersion === "string"
				? manifest.harnessVersion
				: "0.0.0";
		const ciProvider =
			manifest.ciProvider === "circleci" ? "circleci" : "github-actions";
		const issueTracker =
			manifest.issueTracker === "github" || manifest.issueTracker === "none"
				? manifest.issueTracker
				: manifest.issueTracker === "linear"
					? "linear"
					: undefined;

		return {
			ok: true,
			value: {
				harnessVersion,
				ciProvider,
				...(issueTracker ? { issueTracker } : {}),
				files: validatedFiles,
			},
		};
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to load manifest: ${sanitizeError(e)}`,
				path: MANIFEST_FILE,
			},
		};
	}
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
