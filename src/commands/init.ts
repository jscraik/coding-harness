import { createHash, randomUUID } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { cwd } from "node:process";
import { diffLines } from "diff";
import semver from "semver";
import {
	DEFAULT_CONTRACT,
	type HarnessContract,
} from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { getVersion } from "../lib/version.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	PATH_TRAVERSAL: 1,
	WRITE_ERROR: 2,
	INVALID_PATH: 3,
} as const;

export interface InitOptions {
	dryRun: boolean;
	force: boolean;
	track?: boolean; // Create manifest + backups for rollback
	rollback?: boolean; // Restore from manifest
	checkUpdates?: boolean; // Check for template updates
	update?: boolean; // Apply template updates
	interactive?: boolean; // Interactive prompts for each change
	migrate?: boolean; // Migrate contract schema to latest version
}

// === Rollback Types ===

// Discriminated union for type-safe rollback handling
export type ManifestEntry =
	| { path: string; action: "created" } // New file, no backup
	| { path: string; action: "modified"; backupHash: string }; // Existing file, backed up

// Minimal manifest - no YAGNI metadata
export interface RestoreManifest {
	harnessVersion?: string; // CLI version at install/update time
	files: ManifestEntry[];
}

// Result types for rollback operations
export type BackupResult =
	| { ok: true; value: string | null } // backupHash or null for new files
	| { ok: false; error: InitErrorOutput };

export type ManifestResult =
	| { ok: true; value: RestoreManifest }
	| { ok: false; error: InitErrorOutput };

export type RollbackResult =
	| { ok: true; value: { restored: string[]; deleted: string[] } }
	| { ok: false; error: InitErrorOutput };

// === Update Detection Types ===

export interface UpdateCheckInfo {
	currentVersion: string;
	installedVersion: string;
	updateAvailable: boolean;
}

export type UpdateCheckResult =
	| { ok: true; value: UpdateCheckInfo }
	| { ok: false; error: InitErrorOutput };

export type UpdateResult =
	| { ok: true; value: { updated: string[]; skipped: string[] } }
	| { ok: false; error: InitErrorOutput };

// === Interactive Mode Types ===

export interface ProposedChange {
	path: string;
	action: "create" | "modify" | "skip";
	currentContent: string | null; // null for new files
	newContent: string;
}

// === Schema Migration Types ===

/** Typed contract schema for version-aware handling */
export interface ContractSchema {
	version: string;
	riskTierRules?: Record<string, unknown>;
	reviewPolicy?:
		| {
				timeoutSeconds: number;
				timeoutAction: "fail" | "warn";
		  }
		| undefined;
	evidencePolicy?: {
		requiredFor: unknown[];
		allowedTypes: unknown[];
		maxFileSizeBytes?: unknown;
	};
	mergePolicy?: unknown;
	docsDriftRules?: Record<string, unknown>;
	diffBudget?: {
		maxFiles?: unknown;
		maxNetLOC?: unknown;
		overrideLabel?: unknown;
	};
	runtimePolicy?: unknown;
	memoryPolicy?: unknown;
	memoryMaintenancePolicy?: unknown;
	memoryEvalPolicy?: unknown;
	observabilityPolicy?: unknown;
	packageManagerPolicy?: unknown;
	remediationPolicy?: unknown;
	gapCasePolicy?: unknown;
	uiLoopPolicy?: {
		fastCommand?: unknown;
		verifyCommand?: unknown;
		exploreCommand?: unknown;
		sloTargets?: {
			fastLoopSeconds?: unknown;
			verifyLoopSeconds?: unknown;
		};
	};
	[key: string]: unknown; // Allow additional user-defined fields
}

/** Migration function that transforms a contract from one version to the next */
export interface Migration {
	fromVersion: string;
	toVersion: string;
	description: string;
	migrate: (contract: ContractSchema) => ContractSchema;
}

/** Result of a migration operation */
export interface MigrationResult {
	originalVersion: string;
	finalVersion: string;
	migrationsApplied: string[]; // List of migration descriptions
	migratedContract: ContractSchema;
}

export type MigrationResultType =
	| { ok: true; value: MigrationResult }
	| { ok: false; error: InitErrorOutput };

// Current latest schema version (must match template)
export const CURRENT_SCHEMA_VERSION = "1.2.0";

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
		remediationPolicy:
			contract.remediationPolicy ??
			(DEFAULT_CONTRACT.remediationPolicy as HarnessContract["remediationPolicy"]),
		gapCasePolicy:
			contract.gapCasePolicy ??
			(DEFAULT_CONTRACT.gapCasePolicy as HarnessContract["gapCasePolicy"]),
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
];

export interface InitOutput {
	packageManager: string;
	created: string[];
	skipped: string[];
	updateCheck?: UpdateCheckInfo; // Populated when --check-updates used
	proposedChanges?: ProposedChange[]; // Populated in interactive dry-run
}

export interface InitErrorOutput {
	code: string;
	message: string;
	path?: string;
}

export type InitResult =
	| { ok: true; output: InitOutput }
	| { ok: false; error: InitErrorOutput };

// === Rollback Constants ===

const HARNESS_DIR = ".harness";
const BACKUPS_DIR = "backups";
const MANIFEST_FILE = "restore-manifest.json";

// === Templates (inline) ===

interface Template {
	path: string;
	render: (pm: string) => string;
}

const TEMPLATES: Template[] = [
	{
		path: "harness.contract.json",
		render: (pm) =>
			JSON.stringify(
				{
					version: "1.2.0",
					riskTierRules: {
						"src/auth/**": "high",
						"src/api/**": "high",
						"src/lib/**": "medium",
						"**/*.test.ts": "low",
					},
					mergePolicy: {
						high: ["review-gate", "evidence-verify"],
						medium: ["review-gate"],
						low: [],
					},
					docsDriftRules: {},
					reviewPolicy: {
						timeoutSeconds: 600,
						timeoutAction: "fail" as const,
					},
					evidencePolicy: {
						requiredFor: [],
						allowedTypes: ["png", "jpeg"],
						maxFileSizeBytes: 1048576,
					},
					diffBudget: {
						maxFiles: 10,
						maxNetLOC: 400,
						overrideLabel: "diff-budget-override",
					},
					uiLoopPolicy: {
						fastCommand: `${pm} ui:fast`,
						verifyCommand: `${pm} ui:verify`,
						exploreCommand: `${pm} ui:explore`,
						sloTargets: {
							fastLoopSeconds: 30,
							verifyLoopSeconds: 120,
						},
					},
					runtimePolicy: {
						nodeVersion: "20.x",
					},
					memoryPolicy: {
						enabled: true,
						provider: "local",
						sessionIdTemplate: "repo:<name>:task:<id>",
						domain: "default",
						requiredTags: ["repo", "area", "type"],
						maxObservationsPerStep: 3,
						allowedLevels: ["observation", "learning", "pattern"],
						requireStartRead: true,
						requireCloseoutSummary: true,
						forbiddenContentPatterns: [
							"token",
							"api[_-]?key",
							"secret",
							"password",
							"credential",
						],
					},
					memoryMaintenancePolicy: {
						validateSchedule: "weekly",
						reflectSchedule: "weekly",
						questionSlaDays: 7,
						duplicateThreshold: 0.8,
					},
					memoryEvalPolicy: {
						trialsPerTask: 3,
						requiredMetrics: ["pass^k", "tool_errors", "duplicate_rate"],
						passPowKThreshold: 0.8,
					},
					observabilityPolicy: {
						provider: "logs",
						collectorEndpoint: "http://localhost:4318",
					},
					packageManagerPolicy: {
						allowedManagers: ["pnpm", "npm", "yarn"],
						requiredManager: null,
					},
					remediationPolicy: {
						providerDefaults: {
							codeql: {
								autoApplyMaxTier: "medium",
								dryRunOnlyByDefault: true,
							},
							codex: {
								autoApplyMaxTier: "medium",
								dryRunOnlyByDefault: true,
							},
						},
						canonicalRerunWorkflow: "greptile-rerun.yml",
						marker: "<!-- harness-remediation-rerun -->",
						timeoutMinutes: 20,
						retryLimit: 3,
						requireEvidence: true,
					},
					gapCasePolicy: {
						requiredEvidenceStatuses: ["passed", "approved"],
						requiredCloseReasons: ["fix", "workaround", "waived"],
						defaultDueDays: 7,
						caseIdPrefix: "gap-",
						caseStore: ".harness/gap-cases.json",
						allowEvidencelessResolve: false,
					},
				},
				null,
				2,
			),
	},
	{
		path: ".github/workflows/pr-pipeline.yml",
		render: (pm) => `name: Harness PR Pipeline

on: pull_request

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: ${pm} install
      - run: ${pm} test
`,
	},
];

// === Package Manager Detection ===

function detectPackageManager(dir: string): string {
	if (existsSync(resolve(dir, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(resolve(dir, "yarn.lock"))) return "yarn";
	if (existsSync(resolve(dir, "package-lock.json"))) return "npm";
	return "npm";
}

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

	// Ensure base ends with separator for proper prefix matching
	// This prevents /app from matching /app-secrets
	const baseWithSep = normalizedBase.endsWith(sep)
		? normalizedBase
		: normalizedBase + sep;

	// Check if resolved is exactly base or starts with base + separator
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

	// Use SHA256 hash of relative path for collision-safe naming
	// foo/bar.yml -> a1b2c3d4e5f6g7h8.bak (not foo-bar.yml.bak)
	const backupHash = createHash("sha256")
		.update(relativePath)
		.digest("hex")
		.slice(0, 16);
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

		return {
			ok: true,
			value: { harnessVersion, files: validatedFiles },
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
): UpdateResult {
	const packageManager = detectPackageManager(targetDir);
	const updated: string[] = [];
	const skipped: string[] = [];

	for (const entry of manifest.files) {
		// Find matching template
		const template = TEMPLATES.find((t) => t.path === entry.path);
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
		const content = template.render(packageManager);
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
): ProposedChange[] {
	const packageManager = detectPackageManager(targetDir);
	const proposed: ProposedChange[] = [];

	for (const template of TEMPLATES) {
		// Sanitize the template path
		const pathResult = sanitizePath(targetDir, template.path);
		if (!pathResult.ok) {
			// Skip invalid paths - they would fail in actual run anyway
			continue;
		}

		const targetPath = pathResult.value;
		const exists = existsSync(targetPath);
		const newContent = template.render(packageManager);

		if (exists && !options.force) {
			// File exists and not forcing - would skip
			proposed.push({
				path: template.path,
				action: "skip",
				currentContent: readFileSync(targetPath, "utf-8"),
				newContent,
			});
		} else if (exists) {
			// File exists and forcing - would modify
			proposed.push({
				path: template.path,
				action: "modify",
				currentContent: readFileSync(targetPath, "utf-8"),
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
	const packageManager = detectPackageManager(dir);

	// Handle --rollback: restore from manifest
	if (options.rollback) {
		const manifestResult = loadManifest(dir);
		if (!manifestResult.ok) {
			return manifestResult;
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

		const updateResult = executeUpdate(dir, manifestResult.value);
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
		const proposedChanges = collectProposedChanges(dir, options);
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

	for (const template of TEMPLATES) {
		// Sanitize the template path
		const pathResult = sanitizePath(dir, template.path);
		if (!pathResult.ok) {
			return pathResult;
		}

		const targetPath = pathResult.value;
		const exists = existsSync(targetPath);

		// Skip existing files unless --force
		if (exists && !options.force) {
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
		const content = template.render(packageManager);
		const writeResult = atomicWrite(targetPath, content);
		if (!writeResult.ok) {
			return writeResult;
		}

		created.push(template.path);
	}

	// Write manifest if tracking
	if (options.track && !options.dryRun && manifestEntries.length > 0) {
		const manifest: RestoreManifest = {
			harnessVersion: getVersion(),
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
			const contractVersion = detectContractVersion(targetDir ?? cwd());
			if (created.length === 0) {
				console.info(
					`Contract already up to date (v${contractVersion ?? "unknown"})`,
				);
			} else {
				console.info("Migrating contract schema\n");
				console.info(
					`  ${CONTRACT_FILE}: v${contractVersion ?? "unknown"} → v${CURRENT_SCHEMA_VERSION}`,
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
