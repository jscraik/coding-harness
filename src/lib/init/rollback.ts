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
import { atomicWrite } from "./migration.js";
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
	preferredCiProvider?: CIProvider;
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
type ManifestErrorResult = Extract<ManifestResult, { ok: false }>;

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
		if (!existsSync(targetPath) || !lstatSync(targetPath).isSymbolicLink()) {
			return {
				ok: false,
				error: {
					code: "PATH_TRAVERSAL",
					message: `Symlink detected in path: ${relativePath}`,
					path: relativePath,
				},
			};
		}

		const realTargetPath = realpathSync(targetPath);
		if (!isPathWithinBase(baseRealPath, realTargetPath)) {
			return {
				ok: false,
				error: {
					code: "PATH_TRAVERSAL",
					message: `Symlink detected in path: ${relativePath}`,
					path: relativePath,
				},
			};
		}

		return { ok: true, value: realTargetPath };
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

function readContractProvider(targetDir: string): CIProvider | null {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return null;
	}

	try {
		const parsed = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			ciProviderPolicy?: { activeProvider?: string | undefined } | undefined;
		};
		const activeProvider = parsed.ciProviderPolicy?.activeProvider;
		if (activeProvider === "github-actions" || activeProvider === "circleci") {
			return activeProvider;
		}
	} catch {
		// Best-effort legacy detection only.
	}

	return null;
}

function inferLegacyManifestProvider(
	targetDir: string,
	preferredCiProvider?: CIProvider,
): { provider: CIProvider; source: string } | null {
	const contractProvider = readContractProvider(targetDir);
	if (contractProvider) {
		return {
			provider: contractProvider,
			source: "harness.contract.json ciProviderPolicy.activeProvider",
		};
	}

	const hasCircleCIConfig = existsSync(
		resolve(targetDir, ".circleci", "config.yml"),
	);
	const hasGitHubWorkflows = existsSync(
		resolve(targetDir, ".github", "workflows"),
	);

	if (hasCircleCIConfig && !hasGitHubWorkflows) {
		return { provider: "circleci", source: ".circleci/config.yml" };
	}
	if (hasGitHubWorkflows && !hasCircleCIConfig) {
		return { provider: "github-actions", source: ".github/workflows" };
	}
	if (preferredCiProvider) {
		return {
			provider: preferredCiProvider,
			source: "requested/default CI provider",
		};
	}

	return null;
}

function maybeRepairLegacyManifestProvider(
	targetDir: string,
	manifestPath: string,
	manifest: Record<string, unknown>,
	preferredCiProvider?: CIProvider,
): ManifestResult | null {
	const inferred = inferLegacyManifestProvider(targetDir, preferredCiProvider);
	if (!inferred) {
		return null;
	}

	const repairedManifest = {
		...manifest,
		ciProvider: inferred.provider,
	};
	const writeResult = atomicWrite(
		manifestPath,
		JSON.stringify(repairedManifest, null, 2),
	);
	if (!writeResult.ok) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to repair legacy restore manifest with inferred ciProvider "${inferred.provider}" from ${inferred.source}: ${writeResult.error.message}`,
				path: MANIFEST_FILE,
			},
		};
	}

	manifest.ciProvider = inferred.provider;
	return null;
}

function manifestError(
	message: string,
	path = MANIFEST_FILE,
): ManifestErrorResult {
	return {
		ok: false,
		error: {
			code: "WRITE_ERROR",
			message,
			path,
		},
	};
}

function parseManifestRecord(
	manifestPath: string,
): Record<string, unknown> | null {
	const content = readFileSync(manifestPath, "utf-8");
	const data = JSON.parse(content) as unknown;
	if (typeof data !== "object" || data === null) {
		return null;
	}
	return data as Record<string, unknown>;
}

function validateManifestFiles(
	targetDir: string,
	manifest: Record<string, unknown>,
	options: LoadManifestOptions,
): ManifestErrorResult | { ok: true; value: ManifestEntry[] } {
	if (!Array.isArray(manifest.files)) {
		return manifestError("Restore manifest is corrupted: missing files array");
	}

	const validatedFiles: ManifestEntry[] = [];
	const allowSafeRepoSymlinks =
		options.operation === "check-updates" ||
		options.operation === "update" ||
		options.operation === "upgrade";
	for (const entry of manifest.files) {
		if (typeof entry !== "object" || entry === null) {
			return manifestError("Restore manifest is corrupted: invalid entry");
		}
		const e = entry as Record<string, unknown>;
		if (typeof e.path !== "string") {
			return manifestError("Restore manifest is corrupted: missing path");
		}

		const pathResult = sanitizePath(targetDir, e.path);
		if (
			!pathResult.ok &&
			!(
				allowSafeRepoSymlinks &&
				resolveSafeWorkspaceSymlink(targetDir, e.path).ok
			)
		) {
			return manifestError(
				`Path traversal blocked in manifest: ${e.path}`,
				e.path,
			);
		}

		if (e.action === "created") {
			validatedFiles.push({ path: e.path, action: "created" });
			continue;
		}
		if (e.action === "modified" && typeof e.backupHash === "string") {
			if (!/^[a-f0-9]{16}$/.test(e.backupHash)) {
				return manifestError(
					`Invalid backup hash format: ${e.backupHash}`,
					e.path,
				);
			}
			if (e.backupHash !== calculateBackupHash(e.path)) {
				return manifestError(
					`Manifest backup hash mismatch for ${e.path}`,
					e.path,
				);
			}
			validatedFiles.push({
				path: e.path,
				action: "modified",
				backupHash: e.backupHash,
			});
			continue;
		}

		return manifestError(
			`Invalid manifest entry: action=${e.action}, backupHash=${e.backupHash}`,
			e.path,
		);
	}

	return { ok: true, value: validatedFiles };
}

function resolveManifestMetadata(
	manifest: Record<string, unknown>,
	options: LoadManifestOptions,
):
	| ManifestErrorResult
	| {
			ok: true;
			value: Pick<
				RestoreManifest,
				"harnessVersion" | "ciProvider" | "issueTracker" | "minimal"
			>;
	  } {
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
			...(manifest.minimal === true ? { minimal: true } : {}),
			...(issueTracker ? { issueTracker } : {}),
		},
	};
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
		return manifestError(
			"No restore manifest found. Run `harness init --track` first.",
		);
	}

	try {
		const manifest = parseManifestRecord(manifestPath);
		if (!manifest) {
			return manifestError("Restore manifest is corrupted: not an object");
		}

		const shouldRepairProvider =
			manifest.ciProvider !== "github-actions" &&
			manifest.ciProvider !== "circleci";
		if (shouldRepairProvider) {
			const repairResult = maybeRepairLegacyManifestProvider(
				targetDir,
				manifestPath,
				manifest,
				options.preferredCiProvider,
			);
			if (repairResult) {
				return repairResult;
			}
		}

		const filesResult = validateManifestFiles(targetDir, manifest, options);
		if (!filesResult.ok) {
			return filesResult;
		}
		const metadataResult = resolveManifestMetadata(manifest, options);
		if (!metadataResult.ok) {
			return metadataResult;
		}

		return {
			ok: true,
			value: {
				...metadataResult.value,
				files: filesResult.value,
			},
		};
	} catch (e) {
		return manifestError(`Failed to load manifest: ${sanitizeError(e)}`);
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
