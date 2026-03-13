import { createHash, randomUUID } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { cwd } from "node:process";
import { diffLines } from "diff";
import semver from "semver";
import {
	DEFAULT_CONTRACT,
	type HarnessContract,
} from "../lib/contract/types.js";
import {
	type CIProvider,
	TEMPLATES,
	type Template,
	createTemplateRenderContext,
	shouldAutoUpdateTemplate,
} from "../lib/init/scaffold.js";
import {
	BACKUPS_DIR,
	type BackupResult,
	CURRENT_SCHEMA_VERSION,
	type ContractSchema,
	EXIT_CODES,
	HARNESS_DIR,
	type InitErrorOutput,
	type InitOptions,
	type InitResult,
	MANIFEST_FILE,
	MAX_INTERACTIVE_FILE_BYTES,
	type ManifestEntry,
	type ManifestResult,
	type Migration,
	type MigrationResult,
	type MigrationResultType,
	type PackageManager,
	type ProposedChange,
	type RestoreManifest,
	type RollbackResult,
	type UpdateCheckResult,
	type UpdateResult,
} from "../lib/init/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { getVersion } from "../lib/version.js";

// Local constants (not in types module)
const DEFAULT_CI_PROVIDER: CIProvider = "github-actions";

// Retired template paths that should be cleaned up during init
const RETIRED_TEMPLATE_PATHS = [
	".github/ISSUE_TEMPLATE/issue.yml",
	".github/ISSUE_TEMPLATE/feature.yml",
	".github/ISSUE_TEMPLATE/security.yml",
] as const;

// Helper function to detect package manager from lock files
function detectPackageManager(dir: string): PackageManager {
	if (existsSync(resolve(dir, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(resolve(dir, "yarn.lock"))) return "yarn";
	if (existsSync(resolve(dir, "package-lock.json"))) return "npm";
	return "npm";
}

function normalizeCIProvider(
	value: string | undefined,
): { ok: true; value: CIProvider } | { ok: false; error: InitErrorOutput } {
	if (!value || value.trim().length === 0) {
		return { ok: true, value: DEFAULT_CI_PROVIDER };
	}

	if (value === "github-actions" || value === "circleci") {
		return { ok: true, value };
	}

	return {
		ok: false,
		error: {
			code: "INVALID_PATH",
			message: `Unsupported CI provider: ${value}. Expected one of: github-actions, circleci.`,
		},
	};
}

function isTemplateEnabledForProvider(
	templatePath: string,
	ciProvider: CIProvider,
): boolean {
	if (templatePath.startsWith(".github/workflows/")) {
		return ciProvider === "github-actions";
	}
	if (templatePath === ".circleci/config.yml") {
		return ciProvider === "circleci";
	}
	return true;
}

function getTemplatesForProvider(ciProvider: CIProvider): Template[] {
	return TEMPLATES.filter((template) =>
		isTemplateEnabledForProvider(template.path, ciProvider),
	);
}

function addSchemaDefaults(contract: ContractSchema): ContractSchema {
	return {
		...DEFAULT_CONTRACT,
		...contract,
		version: contract.version,
		riskTierRules: contract.riskTierRules ?? DEFAULT_CONTRACT.riskTierRules,
		reviewPolicy: contract.reviewPolicy ?? DEFAULT_CONTRACT.reviewPolicy,
		evidencePolicy: contract.evidencePolicy ?? DEFAULT_CONTRACT.evidencePolicy,
		mergePolicy: contract.mergePolicy ?? DEFAULT_CONTRACT.mergePolicy,
		docsDriftRules: contract.docsDriftRules ?? DEFAULT_CONTRACT.docsDriftRules,
		diffBudget: contract.diffBudget ?? DEFAULT_CONTRACT.diffBudget,
		uiLoopPolicy:
			(contract.uiLoopPolicy as HarnessContract["uiLoopPolicy"]) ??
			DEFAULT_CONTRACT.uiLoopPolicy,
		runtimePolicy:
			contract.runtimePolicy ??
			(DEFAULT_CONTRACT.runtimePolicy as HarnessContract["runtimePolicy"]),
		memoryPolicy:
			contract.memoryPolicy ??
			(DEFAULT_CONTRACT.memoryPolicy as HarnessContract["memoryPolicy"]),
		memoryMaintenancePolicy:
			contract.memoryMaintenancePolicy ??
			(DEFAULT_CONTRACT.memoryMaintenancePolicy as HarnessContract["memoryMaintenancePolicy"]),
		memoryEvalPolicy:
			contract.memoryEvalPolicy ??
			(DEFAULT_CONTRACT.memoryEvalPolicy as HarnessContract["memoryEvalPolicy"]),
		observabilityPolicy:
			contract.observabilityPolicy ??
			(DEFAULT_CONTRACT.observabilityPolicy as HarnessContract["observabilityPolicy"]),
		packageManagerPolicy:
			contract.packageManagerPolicy ??
			(DEFAULT_CONTRACT.packageManagerPolicy as HarnessContract["packageManagerPolicy"]),
		contextIntegrityPolicy:
			contract.contextIntegrityPolicy ??
			(DEFAULT_CONTRACT.contextIntegrityPolicy as HarnessContract["contextIntegrityPolicy"]),
		remediationPolicy:
			contract.remediationPolicy ??
			(DEFAULT_CONTRACT.remediationPolicy as HarnessContract["remediationPolicy"]),
		gapCasePolicy:
			contract.gapCasePolicy ??
			(DEFAULT_CONTRACT.gapCasePolicy as HarnessContract["gapCasePolicy"]),
		branchProtection:
			contract.branchProtection === undefined
				? (DEFAULT_CONTRACT.branchProtection as HarnessContract["branchProtection"])
				: ({
						...(DEFAULT_CONTRACT.branchProtection as HarnessContract["branchProtection"]),
						...contract.branchProtection,
						allowedMergeMethods:
							contract.branchProtection.allowedMergeMethods === undefined
								? (DEFAULT_CONTRACT.branchProtection
										?.allowedMergeMethods as HarnessContract["branchProtection"] extends {
										allowedMergeMethods?: infer T;
									}
										? T
										: never)
								: {
										...(DEFAULT_CONTRACT.branchProtection
											?.allowedMergeMethods ?? {}),
										...contract.branchProtection.allowedMergeMethods,
									},
						codeQuality:
							contract.branchProtection.codeQuality === undefined
								? DEFAULT_CONTRACT.branchProtection?.codeQuality
								: {
										...(DEFAULT_CONTRACT.branchProtection?.codeQuality ?? {}),
										...contract.branchProtection.codeQuality,
									},
						publicCodeScanning:
							contract.branchProtection.publicCodeScanning === undefined
								? DEFAULT_CONTRACT.branchProtection?.publicCodeScanning
								: {
										...(DEFAULT_CONTRACT.branchProtection?.publicCodeScanning ??
											{}),
										...contract.branchProtection.publicCodeScanning,
									},
					} as HarnessContract["branchProtection"]),
		toolingPolicy:
			contract.toolingPolicy === undefined
				? DEFAULT_CONTRACT.toolingPolicy
				: ({
						...(DEFAULT_CONTRACT.toolingPolicy ?? {}),
						...contract.toolingPolicy,
						requiredDocumentationTerms:
							contract.toolingPolicy.requiredDocumentationTerms ??
							DEFAULT_CONTRACT.toolingPolicy?.requiredDocumentationTerms,
						requiredBinaries:
							contract.toolingPolicy.requiredBinaries ??
							DEFAULT_CONTRACT.toolingPolicy?.requiredBinaries,
						requiredMiseTools:
							contract.toolingPolicy.requiredMiseTools ??
							DEFAULT_CONTRACT.toolingPolicy?.requiredMiseTools,
						codexEnvironment:
							contract.toolingPolicy.codexEnvironment === undefined
								? DEFAULT_CONTRACT.toolingPolicy?.codexEnvironment
								: {
										...(DEFAULT_CONTRACT.toolingPolicy?.codexEnvironment ?? {}),
										...contract.toolingPolicy.codexEnvironment,
										requiredActions:
											contract.toolingPolicy.codexEnvironment.requiredActions ??
											DEFAULT_CONTRACT.toolingPolicy?.codexEnvironment
												?.requiredActions,
									},
						makefile:
							contract.toolingPolicy.makefile === undefined
								? DEFAULT_CONTRACT.toolingPolicy?.makefile
								: {
										...(DEFAULT_CONTRACT.toolingPolicy?.makefile ?? {}),
										...contract.toolingPolicy.makefile,
										requiredTargets:
											contract.toolingPolicy.makefile.requiredTargets ??
											DEFAULT_CONTRACT.toolingPolicy?.makefile?.requiredTargets,
									},
						packagePolicy:
							contract.toolingPolicy.packagePolicy === undefined
								? DEFAULT_CONTRACT.toolingPolicy?.packagePolicy
								: {
										...(DEFAULT_CONTRACT.toolingPolicy?.packagePolicy ?? {}),
										...contract.toolingPolicy.packagePolicy,
										explicitCapabilities:
											contract.toolingPolicy.packagePolicy
												.explicitCapabilities ??
											DEFAULT_CONTRACT.toolingPolicy?.packagePolicy
												?.explicitCapabilities,
										capabilityDetectors:
											contract.toolingPolicy.packagePolicy
												.capabilityDetectors ??
											DEFAULT_CONTRACT.toolingPolicy?.packagePolicy
												?.capabilityDetectors,
										requiredPackages:
											contract.toolingPolicy.packagePolicy.requiredPackages ??
											DEFAULT_CONTRACT.toolingPolicy?.packagePolicy
												?.requiredPackages,
									},
					} as HarnessContract["toolingPolicy"]),
		ciProviderPolicy:
			contract.ciProviderPolicy ??
			(DEFAULT_CONTRACT.ciProviderPolicy as HarnessContract["ciProviderPolicy"]),
		issueTrackingPolicy:
			contract.issueTrackingPolicy ??
			(DEFAULT_CONTRACT.issueTrackingPolicy as HarnessContract["issueTrackingPolicy"]),
	} as ContractSchema;
}

/**
 * Migration registry - ordered list of schema migrations.
 * Each migration transforms a contract from fromVersion to toVersion.
 * Migrations are applied sequentially to bring a contract up to date.
 */
/**
 * Migration registry - ordered list of schema migrations.
 * Each migration transforms a contract from fromVersion to toVersion.
 * Migrations are applied sequentially to bring a contract up to date.
 * Note: Version normalization via semver.coerce() converts "1.0" → "1.0.0"
 * before migration, so migrations should use semver-normalized versions.
 */
const MIGRATIONS: Migration[] = [
	{
		fromVersion: "1.0.0",
		toVersion: "1.1.0",
		description:
			"Normalize v1.0.0 schema to v1.1.0 and inject default policy surfaces",
		migrate: (contract) =>
			({
				...addSchemaDefaults(contract),
				version: "1.1.0",
			}) as ContractSchema,
	},
	{
		fromVersion: "1.1.0",
		toVersion: "1.2.0",
		description: "Inject remediation and gap-case policy defaults",
		migrate: (contract) =>
			({
				...addSchemaDefaults(contract),
				version: "1.2.0",
			}) as ContractSchema,
	},
	{
		fromVersion: "1.2.0",
		toVersion: "1.3.0",
		description: "Inject docs-gate policy for governance documentation parity",
		migrate: (contract) =>
			({
				...addSchemaDefaults(contract),
				version: "1.3.0",
			}) as ContractSchema,
	},
	{
		fromVersion: "1.3.0",
		toVersion: "1.4.0",
		description:
			"Inject tooling policy defaults for repo-managed readiness surfaces",
		migrate: (contract) =>
			({
				...addSchemaDefaults(contract),
				version: "1.4.0",
			}) as ContractSchema,
	},
	{
		fromVersion: "1.4.0",
		toVersion: "1.5.0",
		description:
			"Inject conditional package policy defaults for UI and ChatGPT Apps SDK repositories",
		migrate: (contract) =>
			({
				...addSchemaDefaults(contract),
				version: "1.5.0",
			}) as ContractSchema,
	},
];

// === Path Sanitization ===

type PathResult =
	| { ok: true; value: string }
	| { ok: false; error: InitErrorOutput };

function sanitizePath(base: string, relativePath: string): PathResult {
	// Validate inputs
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

	// Normalize paths
	const normalizedBase = resolve(base);
	const resolved = resolve(base, relativePath);

	// Resolve the true canonical base dir — reject if it doesn't exist yet.
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

	// Ensure base ends with separator for proper prefix matching
	// This prevents /app from matching /app-secrets
	const baseWithSep = normalizedBase.endsWith(sep)
		? normalizedBase
		: normalizedBase + sep;

	// Lexical containment check (fast path — still needed for the no-symlink case)
	if (resolved !== normalizedBase && !resolved.startsWith(baseWithSep)) {
		return {
			ok: false,
			error: {
				code: "PATH_TRAVERSAL",
				message: `Path traversal blocked: ${relativePath} resolves outside target directory`,
				path: relativePath,
			},
		};
	}

	// SECURITY: Walk each existing path segment and reject any symlink.
	// resolve() is purely lexical — it doesn't follow symlinks, so a
	// directory symlink (.github -> /etc) passes the prefix check above
	// but mkdirSync/renameSync will follow it at write time.
	const relToBase = relative(normalizedBase, resolved);
	const segments = relToBase.split(sep).filter((s) => s.length > 0);
	let walkPath = normalizedBase;
	for (const segment of segments) {
		walkPath = join(walkPath, segment);
		if (!existsSync(walkPath)) {
			// Not yet created — safe to skip (atomicWrite will create it)
			break;
		}
		try {
			if (lstatSync(walkPath).isSymbolicLink()) {
				return {
					ok: false,
					error: {
						code: "PATH_TRAVERSAL",
						message: `Path traversal blocked: ${relativePath} contains a symbolic link`,
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

	// SECURITY: Canonical ancestor check — realpathSync on the nearest
	// existing ancestor to catch symlink-based escapes in parent dirs.
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
					message: `Path traversal blocked: ${relativePath} resolves outside target directory`,
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

// === Atomic Write ===

type WriteResult =
	| { ok: true; value: undefined }
	| { ok: false; error: InitErrorOutput };

function atomicWrite(filePath: string, content: string): WriteResult {
	const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

	try {
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(tempPath, content, "utf-8");
		renameSync(tempPath, filePath);
		return { ok: true, value: undefined };
	} catch (e) {
		// Cleanup temp file on failure
		try {
			rmSync(tempPath, { force: true });
		} catch {
			// Best-effort cleanup; ignore failures
		}
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to write file: ${sanitizeError(e)}`,
				path: filePath,
			},
		};
	}
}

// === Backup Functions ===

/**
 * Create backup of existing file with symlink detection and hash-based naming.
 * Returns backupHash (16-char SHA256 prefix) or null for new files.
 */
function createBackup(targetDir: string, relativePath: string): BackupResult {
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

function calculateBackupHash(relativePath: string): string {
	// Use SHA256 hash of relative path for collision-safe naming.
	// foo/bar.yml -> a1b2c3d4e5f6g7h8.bak (not foo-bar.yml.bak)
	return createHash("sha256").update(relativePath).digest("hex").slice(0, 16);
}

// === Rollback Functions ===

/**
 * Load and validate manifest from disk.
 * Re-validates all paths to prevent manifest tampering.
 */
function loadManifest(targetDir: string): ManifestResult {
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

		// Extract harnessVersion (defaults to "0.0.0" for backward compatibility)
		const harnessVersion =
			typeof manifest.harnessVersion === "string"
				? manifest.harnessVersion
				: "0.0.0";
		const ciProvider =
			manifest.ciProvider === "circleci" ? "circleci" : "github-actions";

		return {
			ok: true,
			value: { harnessVersion, ciProvider, files: validatedFiles },
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
function executeRollback(
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

// === Update Detection Functions ===

/**
 * Check if template updates are available.
 * Compares manifest version against current CLI version.
 */
function checkForUpdates(targetDir: string): UpdateCheckResult {
	const manifestResult = loadManifest(targetDir);
	if (!manifestResult.ok) {
		return manifestResult;
	}

	const currentVersion = getVersion();
	const installedVersion = manifestResult.value.harnessVersion || "0.0.0";

	// Validate versions
	if (!semver.valid(currentVersion)) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Invalid current version: ${currentVersion}`,
			},
		};
	}

	if (!semver.valid(installedVersion)) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Invalid installed version: ${installedVersion}`,
			},
		};
	}

	const updateAvailable = semver.gt(currentVersion, installedVersion);

	return {
		ok: true,
		value: {
			currentVersion,
			installedVersion,
			updateAvailable,
		},
	};
}

/**
 * Execute template updates.
 * Re-renders all tracked templates and updates manifest version.
 */
function executeUpdate(
	targetDir: string,
	manifest: RestoreManifest,
	ciProvider: CIProvider,
): UpdateResult {
	const packageManager = detectPackageManager(targetDir);
	const renderContext = createTemplateRenderContext(targetDir, ciProvider);
	const templates = getTemplatesForProvider(ciProvider);
	const updated: string[] = [];
	const skipped: string[] = [];

	for (const entry of manifest.files) {
		// Find matching template
		const template = templates.find((t) => t.path === entry.path);
		if (!template) {
			// Template no longer exists, skip
			skipped.push(entry.path);
			continue;
		}

		// Re-validate path
		const pathResult = sanitizePath(targetDir, entry.path);
		if (!pathResult.ok) {
			return {
				ok: false,
				error: pathResult.error,
			};
		}

		const targetPath = pathResult.value;

		// Check if file exists
		if (!existsSync(targetPath)) {
			skipped.push(entry.path);
			continue;
		}

		// Render and write
		const content = template.render(packageManager, renderContext);
		const writeResult = atomicWrite(targetPath, content);
		if (!writeResult.ok) {
			return writeResult;
		}

		updated.push(entry.path);
	}

	// Update manifest version
	const newManifest: RestoreManifest = {
		...manifest,
		harnessVersion: getVersion(),
		ciProvider,
	};
	const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);
	const manifestResult = atomicWrite(
		manifestPath,
		JSON.stringify(newManifest, null, 2),
	);
	if (!manifestResult.ok) {
		return manifestResult;
	}

	return { ok: true, value: { updated, skipped } };
}

// === Schema Migration Functions ===

const CONTRACT_FILE = "harness.contract.json";

/**
 * Detect the version of an existing contract file.
 * Returns null if file doesn't exist or doesn't have a valid version.
 */
export function detectContractVersion(targetDir: string): string | null {
	const contractPath = resolve(targetDir, CONTRACT_FILE);

	if (!existsSync(contractPath)) {
		return null;
	}

	try {
		const content = readFileSync(contractPath, "utf-8");
		const data = JSON.parse(content) as unknown;

		if (typeof data !== "object" || data === null) {
			return null;
		}

		const contract = data as Record<string, unknown>;
		if (typeof contract.version !== "string") {
			return null;
		}

		return contract.version;
	} catch {
		return null;
	}
}

/**
 * Load and validate a contract file.
 * Returns the parsed contract or an error.
 */
function loadContract(
	targetDir: string,
): { ok: true; value: ContractSchema } | { ok: false; error: InitErrorOutput } {
	const contractPath = resolve(targetDir, CONTRACT_FILE);

	if (!existsSync(contractPath)) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Contract file not found: ${CONTRACT_FILE}`,
				path: CONTRACT_FILE,
			},
		};
	}

	try {
		const content = readFileSync(contractPath, "utf-8");
		const data = JSON.parse(content) as unknown;

		if (typeof data !== "object" || data === null) {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: "Contract file is not a valid JSON object",
					path: CONTRACT_FILE,
				},
			};
		}

		const contract = data as ContractSchema;

		// Validate required fields
		if (typeof contract.version !== "string") {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: "Contract file missing required 'version' field",
					path: CONTRACT_FILE,
				},
			};
		}

		return { ok: true, value: contract };
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to parse contract: ${sanitizeError(e)}`,
				path: CONTRACT_FILE,
			},
		};
	}
}

/**
 * Apply all applicable migrations to bring a contract up to the latest version.
 * Chains migrations sequentially, preserving user customizations.
 */
function migrateContract(contract: ContractSchema): MigrationResult {
	const originalVersion = contract.version;
	const migrationsApplied: string[] = [];
	let currentContract = { ...contract };

	// Find and apply migrations sequentially
	for (const migration of MIGRATIONS) {
		if (currentContract.version === migration.fromVersion) {
			currentContract = migration.migrate(currentContract);
			migrationsApplied.push(
				`${migration.fromVersion} → ${migration.toVersion}: ${migration.description}`,
			);
		}
	}

	return {
		originalVersion,
		finalVersion: currentContract.version,
		migrationsApplied,
		migratedContract: currentContract,
	};
}

/**
 * Check if contract needs migration by comparing versions.
 */
function needsMigration(contractVersion: string): boolean {
	const normalizedVersion = semver.coerce(contractVersion)?.version;
	if (!normalizedVersion) {
		return false;
	}
	return semver.lt(normalizedVersion, CURRENT_SCHEMA_VERSION);
}

/**
 * Execute contract schema migration.
 * Loads contract, applies migrations, and writes result.
 */
function executeMigration(targetDir: string): MigrationResultType {
	const loadResult = loadContract(targetDir);
	if (!loadResult.ok) {
		return loadResult;
	}

	const contract = loadResult.value;
	const normalizedVersion = semver.coerce(contract.version)?.version;

	// Surface error for unparseable versions instead of silently skipping
	if (!normalizedVersion) {
		return {
			ok: false,
			error: {
				code: "E_INVALID_VERSION",
				message: `Cannot parse contract version: "${contract.version}". Version must be semver-compatible (e.g., "1.0.0").`,
			},
		};
	}

	const normalizedContract = { ...contract, version: normalizedVersion };

	// Check if migration is needed
	if (!needsMigration(normalizedContract.version)) {
		return {
			ok: true,
			value: {
				originalVersion: normalizedContract.version,
				finalVersion: normalizedContract.version,
				migrationsApplied: [],
				migratedContract: normalizedContract,
			},
		};
	}

	// Apply migrations
	const result = migrateContract(normalizedContract);
	if (
		result.migrationsApplied.length === 0 ||
		result.finalVersion !== CURRENT_SCHEMA_VERSION
	) {
		return {
			ok: false,
			error: {
				code: "E_UNSUPPORTED_MIGRATION_PATH",
				message: `No supported migration path from ${normalizedContract.version} to ${CURRENT_SCHEMA_VERSION}.`,
				path: CONTRACT_FILE,
			},
		};
	}

	// Write migrated contract
	const contractPath = resolve(targetDir, CONTRACT_FILE);
	const writeResult = atomicWrite(
		contractPath,
		JSON.stringify(result.migratedContract, null, 2),
	);

	if (!writeResult.ok) {
		return writeResult;
	}

	return { ok: true, value: result };
}
function collectProposedChanges(
	targetDir: string,
	options: InitOptions,
	ciProvider: CIProvider,
): ProposedChange[] {
	const packageManager = detectPackageManager(targetDir);
	const renderContext = createTemplateRenderContext(targetDir, ciProvider);
	const templates = getTemplatesForProvider(ciProvider);
	const proposed: ProposedChange[] = [];

	for (const template of templates) {
		// Sanitize the template path
		const pathResult = sanitizePath(targetDir, template.path);
		if (!pathResult.ok) {
			// Skip invalid paths - they would fail in actual run anyway
			continue;
		}

		const targetPath = pathResult.value;
		const exists = existsSync(targetPath);
		const newContent = template.render(packageManager, renderContext);
		const autoUpdate =
			exists && shouldAutoUpdateTemplate(template.path, targetPath);

		if (exists && !options.force && !autoUpdate) {
			// File exists and not forcing - would skip; no content read needed
			// (diff for skip is not shown; reading here is unnecessary and risky).
			proposed.push({
				path: template.path,
				action: "skip",
				currentContent: null,
				newContent,
			});
		} else if (exists) {
			// File exists and forcing or auto-updating - read safely.
			proposed.push({
				path: template.path,
				action: "modify",
				currentContent: readInteractiveCurrentContent(targetPath),
				newContent,
			});
		} else {
			// File doesn't exist - would create
			proposed.push({
				path: template.path,
				action: "create",
				currentContent: null,
				newContent,
			});
		}
	}

	return proposed;
}

/**
 * Safely read a file for interactive diff display.
 * Returns null for symlinks, non-regular files, or files exceeding the size cap
 * to prevent symlink traversal and denial-of-service via unbounded reads.
 */
function readInteractiveCurrentContent(path: string): string | null {
	try {
		// lstatSync does NOT follow symlinks; reject symlink entries immediately.
		const lstat = lstatSync(path);
		if (lstat.isSymbolicLink()) {
			return null;
		}

		// statSync follows symlinks but we've already excluded them above;
		// this second check guards against non-regular files (FIFOs, devices).
		const stat = statSync(path);
		if (!stat.isFile() || stat.size > MAX_INTERACTIVE_FILE_BYTES) {
			return null;
		}

		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
}

/**
 * Generate a unified diff for a proposed change.
 * Returns a formatted diff string suitable for display.
 */
export function generateDiff(change: ProposedChange): string {
	const lines: string[] = [];

	if (change.action === "create") {
		// For new files, show all content as additions
		lines.push("--- /dev/null");
		lines.push(`+++ b/${change.path}`);
		const contentLines = change.newContent.split("\n");
		for (const line of contentLines) {
			lines.push(`+${line}`);
		}
	} else if (change.action === "modify") {
		// For modifications, use diffLines for unified diff
		lines.push(`--- a/${change.path}`);
		lines.push(`+++ b/${change.path}`);

		const changes = diffLines(change.currentContent ?? "", change.newContent);

		for (const changePart of changes) {
			const prefix = changePart.added ? "+" : changePart.removed ? "-" : " ";
			const contentLines = changePart.value.split("\n");
			// Remove trailing empty string if content ends with newline
			if (contentLines[contentLines.length - 1] === "") {
				contentLines.pop();
			}
			for (const line of contentLines) {
				lines.push(`${prefix}${line}`);
			}
		}
	}
	// For "skip" action, no diff needed

	return lines.join("\n");
}

/**
 * Apply a single proposed change to the filesystem.
 * Used by interactive mode after user approval.
 */
function applyProposedChange(
	targetDir: string,
	change: ProposedChange,
): { ok: true } | { ok: false; error: InitErrorOutput } {
	// Skip actions don't need to write anything
	if (change.action === "skip") {
		return { ok: true };
	}

	// Validate and sanitize path
	const pathResult = sanitizePath(targetDir, change.path);
	if (!pathResult.ok) {
		return pathResult;
	}

	const targetPath = pathResult.value;

	// Ensure parent directory exists
	const parentDir = dirname(targetPath);
	try {
		mkdirSync(parentDir, { recursive: true });
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to create directory: ${sanitizeError(e)}`,
				path: change.path,
			},
		};
	}

	// Write the file
	const writeResult = atomicWrite(targetPath, change.newContent);
	if (!writeResult.ok) {
		return writeResult;
	}

	return { ok: true };
}

/**
 * Run harness init and return structured result.
 * This function is usable as a library (does not output to console).
 */
export function runInit(
	targetDir: string | undefined,
	options: InitOptions,
): InitResult {
	const dir = targetDir ?? cwd();
	const ciProviderResult = normalizeCIProvider(options.ciProvider);
	if (!ciProviderResult.ok) {
		return ciProviderResult;
	}
	const ciProvider = ciProviderResult.value;
	const packageManager = detectPackageManager(dir);
	const renderContext = createTemplateRenderContext(dir, ciProvider);
	const templates = getTemplatesForProvider(ciProvider);

	if (options.migrate && options.dryRun) {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: "--migrate cannot be combined with --dry-run.",
			},
		};
	}

	if (options.migrate && options.interactive) {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: "--migrate cannot be combined with --interactive.",
			},
		};
	}

	// Handle --rollback: restore from manifest
	if (options.rollback) {
		const manifestResult = loadManifest(dir);
		if (!manifestResult.ok) {
			return manifestResult;
		}
		if (
			manifestResult.value.ciProvider &&
			manifestResult.value.ciProvider !== ciProvider
		) {
			return {
				ok: false,
				error: {
					code: "INVALID_PATH",
					message: `manifest provider "${manifestResult.value.ciProvider}" does not match current CI provider "${ciProvider}"`,
					path: MANIFEST_FILE,
				},
			};
		}

		const rollbackResult = executeRollback(dir, manifestResult.value);
		if (!rollbackResult.ok) {
			return rollbackResult;
		}

		return {
			ok: true,
			output: {
				packageManager,
				created: [], // Rollback doesn't create files
				skipped: rollbackResult.value.restored.concat(
					rollbackResult.value.deleted,
				),
			},
		};
	}

	// Handle --check-updates: compare versions
	if (options.checkUpdates) {
		const checkResult = checkForUpdates(dir);
		if (!checkResult.ok) {
			return checkResult;
		}

		return {
			ok: true,
			output: {
				packageManager,
				created: [], // Check doesn't create files
				skipped: [], // Check doesn't skip files
				updateCheck: checkResult.value,
			},
		};
	}

	// Handle --update: apply template updates
	if (options.update) {
		const manifestResult = loadManifest(dir);
		if (!manifestResult.ok) {
			return manifestResult;
		}
		if (
			manifestResult.value.ciProvider &&
			manifestResult.value.ciProvider !== ciProvider
		) {
			return {
				ok: false,
				error: {
					code: "INVALID_PATH",
					message: `manifest provider "${manifestResult.value.ciProvider}" does not match current CI provider "${ciProvider}"`,
					path: MANIFEST_FILE,
				},
			};
		}

		const updateResult = executeUpdate(dir, manifestResult.value, ciProvider);
		if (!updateResult.ok) {
			return updateResult;
		}

		return {
			ok: true,
			output: {
				packageManager,
				created: updateResult.value.updated,
				skipped: updateResult.value.skipped,
			},
		};
	}

	// Handle --migrate: apply schema migrations to contract
	if (options.migrate) {
		const migrationResult = executeMigration(dir);
		if (!migrationResult.ok) {
			return migrationResult;
		}

		return {
			ok: true,
			output: {
				packageManager,
				created:
					migrationResult.value.migrationsApplied.length > 0
						? [CONTRACT_FILE]
						: [],
				skipped: [],
			},
		};
	}

	// Handle --interactive: collect proposed changes without writing
	if (options.interactive) {
		const proposedChanges = collectProposedChanges(dir, options, ciProvider);
		return {
			ok: true,
			output: {
				packageManager,
				created: [],
				skipped: [],
				proposedChanges,
			},
		};
	}

	const created: string[] = [];
	const skipped: string[] = [];
	const manifestEntries: ManifestEntry[] = [];

	// Ensure .harness dir exists if tracking
	if (options.track && !options.dryRun) {
		mkdirSync(resolve(dir, HARNESS_DIR), { recursive: true });
		mkdirSync(resolve(dir, HARNESS_DIR, BACKUPS_DIR), { recursive: true });
	}

	for (const template of templates) {
		// Sanitize the template path
		const pathResult = sanitizePath(dir, template.path);
		if (!pathResult.ok) {
			return pathResult;
		}

		const targetPath = pathResult.value;
		const exists = existsSync(targetPath);
		const autoUpdate =
			exists && shouldAutoUpdateTemplate(template.path, targetPath);

		// Skip existing files unless --force
		if (exists && !options.force && !autoUpdate) {
			skipped.push(template.path);
			continue;
		}

		// Dry-run: don't write, just track what would happen
		if (options.dryRun) {
			created.push(template.path); // Track as "would create"
			continue;
		}

		// Create backup if tracking and file exists
		if (options.track && exists) {
			const backupResult = createBackup(dir, template.path);
			if (!backupResult.ok) {
				return backupResult;
			}
			if (backupResult.value !== null) {
				manifestEntries.push({
					path: template.path,
					action: "modified",
					backupHash: backupResult.value,
				});
			} else {
				manifestEntries.push({
					path: template.path,
					action: "created",
				});
			}
		} else if (options.track) {
			// New file, track as created
			manifestEntries.push({
				path: template.path,
				action: "created",
			});
		}

		// Render and write
		const content = template.render(packageManager, renderContext);
		const writeResult = atomicWrite(targetPath, content);
		if (!writeResult.ok) {
			return writeResult;
		}

		created.push(template.path);
	}

	if (options.force && !options.dryRun) {
		for (const retiredPath of RETIRED_TEMPLATE_PATHS) {
			const retiredResult = sanitizePath(dir, retiredPath);
			if (!retiredResult.ok) {
				return retiredResult;
			}
			if (existsSync(retiredResult.value)) {
				rmSync(retiredResult.value, { force: true });
			}
		}
		for (const template of TEMPLATES) {
			if (isTemplateEnabledForProvider(template.path, ciProvider)) {
				continue;
			}
			const legacyResult = sanitizePath(dir, template.path);
			if (!legacyResult.ok) {
				return legacyResult;
			}
			if (existsSync(legacyResult.value)) {
				rmSync(legacyResult.value, { force: true });
			}
		}
	}

	// Write manifest if tracking
	if (options.track && !options.dryRun && manifestEntries.length > 0) {
		const manifest: RestoreManifest = {
			harnessVersion: getVersion(),
			ciProvider,
			files: manifestEntries,
		};
		const manifestPath = resolve(dir, HARNESS_DIR, MANIFEST_FILE);
		const manifestResult = atomicWrite(
			manifestPath,
			JSON.stringify(manifest, null, 2),
		);
		if (!manifestResult.ok) {
			return manifestResult;
		}
	}

	return {
		ok: true,
		output: {
			packageManager,
			created,
			skipped,
		},
	};
}

/**
 * Async CLI entry point for interactive mode.
 * Prompts user for each proposed change and applies approved ones.
 */
export async function runInteractiveInitCLI(
	targetDir: string | undefined,
	options: InitOptions,
): Promise<number> {
	// Dynamic import for ESM compatibility with inquirer
	const { select, confirm } = await import("@inquirer/prompts");

	const dir = targetDir ?? cwd();
	const packageManager = detectPackageManager(dir);

	// Check TTY - fall back to non-interactive if not a terminal
	if (!process.stdin.isTTY) {
		console.info("Warning: Not a TTY, falling back to non-interactive mode");
		return runInitCLI(targetDir, { ...options, interactive: false });
	}

	console.info(`Installing harness (package manager: ${packageManager})\n`);

	// Collect proposed changes
	const result = runInit(targetDir, { ...options, interactive: true });
	if (!result.ok) {
		console.error(`Error: ${result.error.message}`);
		if (result.error.path) {
			console.error(`  Path: ${result.error.path}`);
		}
		if (result.error.code === "PATH_TRAVERSAL") {
			return EXIT_CODES.PATH_TRAVERSAL;
		}
		if (result.error.code === "WRITE_ERROR") {
			return EXIT_CODES.WRITE_ERROR;
		}
		return EXIT_CODES.INVALID_PATH;
	}

	const proposedChanges = result.output.proposedChanges ?? [];
	const approved: ProposedChange[] = [];
	const rejected: string[] = [];

	// Process each proposed change
	for (const change of proposedChanges) {
		// Format the prompt message based on action type
		let message: string;
		if (change.action === "create") {
			message = `${change.path} does not exist. Create?`;
		} else if (change.action === "modify") {
			message = `${change.path} exists. Overwrite?`;
		} else {
			// Skip action - no prompt needed, just record
			rejected.push(change.path);
			continue;
		}

		try {
			const answer = await select({
				message,
				choices: [
					{ value: "yes", name: "Yes" },
					{ value: "no", name: "No" },
					{ value: "diff", name: "Show diff" },
				],
				default: change.action === "create" ? "yes" : "no",
			});

			if (answer === "diff") {
				// Show the diff
				console.info(`\n${generateDiff(change)}\n`);

				// Confirm after showing diff
				const confirmApply = await confirm({
					message: "Apply this change?",
					default: false,
				});

				if (confirmApply) {
					approved.push(change);
				} else {
					rejected.push(change.path);
				}
			} else if (answer === "yes") {
				approved.push(change);
			} else {
				rejected.push(change.path);
			}
		} catch (e) {
			// Handle Ctrl+C gracefully
			if (e instanceof Error && e.name === "ExitPromptError") {
				console.info("\nCancelled by user");
				return EXIT_CODES.SUCCESS;
			}
			throw e;
		}
	}

	// Apply approved changes
	const applied: string[] = [];
	const failed: string[] = [];

	for (const change of approved) {
		const applyResult = applyProposedChange(dir, change);
		if (applyResult.ok) {
			applied.push(change.path);
			console.info(`  ✓ ${change.path}`);
		} else {
			failed.push(change.path);
			console.error(`  ✗ ${change.path}: ${applyResult.error.message}`);
		}
	}

	// Summary
	console.info("\n✓ Harness installed!");
	console.info(`  Created: ${applied.length}, Skipped: ${rejected.length}`);

	if (failed.length > 0) {
		console.info(`  Failed: ${failed.length}`);
		return EXIT_CODES.WRITE_ERROR;
	}

	// Show rollback tip if tracking enabled
	if (options.track && applied.length > 0) {
		console.info("\n  Rollback: harness init --rollback");
	} else if (applied.length > 0) {
		console.info(
			"\n  Tip: Review changes with 'git diff', undo with 'git checkout .'",
		);
	}

	return EXIT_CODES.SUCCESS;
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export function runInitCLI(
	targetDir: string | undefined,
	options: InitOptions,
): number {
	const migrationStartVersion = options.migrate
		? detectContractVersion(targetDir ?? cwd())
		: null;
	const result = runInit(targetDir, options);

	if (result.ok) {
		const { packageManager, created, skipped, updateCheck } = result.output;

		// Handle rollback output
		if (options.rollback) {
			console.info("Rollback complete\n");
			for (const path of skipped) {
				console.info(`  restored ${path}`);
			}
			console.info("\n✓ Restored to pre-install state");
			return EXIT_CODES.SUCCESS;
		}

		// Handle --check-updates output
		if (options.checkUpdates && updateCheck) {
			if (updateCheck.updateAvailable) {
				console.info(
					`Update available: v${updateCheck.installedVersion} → v${updateCheck.currentVersion}`,
				);
				console.info("\n  Run: harness init --update");
			} else {
				console.info(`Up to date (v${updateCheck.currentVersion})`);
			}
			return EXIT_CODES.SUCCESS;
		}

		// Handle --update output
		if (options.update) {
			if (created.length === 0 && skipped.length === 0) {
				console.info("Already up to date.");
			} else {
				console.info(`Updating harness (v${getVersion()})\n`);
				for (const path of created) {
					console.info(`  updated ${path}`);
				}
				for (const path of skipped) {
					console.info(`  skipped ${path}`);
				}
				console.info(`\n✓ Updated ${created.length} file(s)`);
			}
			return EXIT_CODES.SUCCESS;
		}

		// Handle --migrate output
		if (options.migrate) {
			if (created.length === 0) {
				console.info(
					`Contract already up to date (v${migrationStartVersion ?? "unknown"})`,
				);
			} else {
				console.info("Migrating contract schema\n");
				console.info(
					`  ${CONTRACT_FILE}: v${migrationStartVersion ?? "unknown"} → v${CURRENT_SCHEMA_VERSION}`,
				);
				console.info("\n✓ Contract migrated");
			}
			return EXIT_CODES.SUCCESS;
		}

		console.info(`Installing harness (package manager: ${packageManager})\n`);

		// Show what happened
		for (const path of skipped) {
			console.info(`  skip ${path} (exists)`);
		}
		for (const path of created) {
			if (options.dryRun) {
				console.info(`  would create ${path}`);
			} else {
				console.info(`  + ${path}`);
			}
		}

		if (options.dryRun) {
			console.info("\nDry run complete. No files were modified.");
			console.info("  Run without --dry-run to apply changes.");
		} else {
			console.info("\n✓ Harness installed!");
			console.info(`  Created: ${created.length}, Skipped: ${skipped.length}`);

			// Show rollback tip if tracking enabled
			if (options.track) {
				console.info("\n  Rollback: harness init --rollback");
			} else if (created.length > 0) {
				console.info(
					"\n  Tip: Review changes with 'git diff', undo with 'git checkout .'",
				);
			}
		}

		return EXIT_CODES.SUCCESS;
	}

	// Error output
	console.error(`Error: ${result.error.message}`);
	if (result.error.path) {
		console.error(`  Path: ${result.error.path}`);
	}
	console.error("\n  Try: harness init --dry-run to preview changes");

	if (result.error.code === "PATH_TRAVERSAL") {
		return EXIT_CODES.PATH_TRAVERSAL;
	}
	if (result.error.code === "WRITE_ERROR") {
		return EXIT_CODES.WRITE_ERROR;
	}
	return EXIT_CODES.INVALID_PATH;
}

// Re-export types for backward compatibility
export type {
	BackupResult,
	ContractSchema,
	InitErrorOutput,
	InitOptions,
	InitOutput,
	InitResult,
	ManifestEntry,
	ManifestResult,
	Migration,
	MigrationResult,
	MigrationResultType,
	PackageManager,
	ProposedChange,
	RestoreManifest,
	RollbackResult,
	Template,
	TemplateRenderContext,
	UpdateCheckInfo,
	UpdateCheckResult,
	UpdateResult,
} from "../lib/init/types.js";
// Re-export constants (using local bindings to avoid duplicate identifier errors)
export {
	BACKUPS_DIR,
	CURRENT_SCHEMA_VERSION,
	EXIT_CODES,
	HARNESS_DIR,
	MANIFEST_FILE,
};
