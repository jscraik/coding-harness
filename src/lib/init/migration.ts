/**
 * Schema migration functions for init command.
 *
 * Provides contract schema version detection and migration:
 * - Version detection from existing contract files
 * - Sequential migration chain from old to new versions
 * - Schema normalization with defaults
 *
 * @module lib/init/migration
 */

import { randomUUID } from "node:crypto";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import semver from "semver";
import { DEFAULT_CONTRACT, type HarnessContract } from "../contract/types.js";
import { sanitizeError } from "../input/sanitize.js";
import {
	CURRENT_SCHEMA_VERSION,
	type ContractSchema,
	type InitErrorOutput,
	type Migration,
	type MigrationResult,
	type MigrationResultType,
} from "./types.js";

// Re-export for convenience
export type { MigrationResultType };

// === Constants ===

/** Contract file name */
const CONTRACT_FILE = "harness.contract.json";

export { CONTRACT_FILE };

// === Types ===

type WriteResult =
	| { ok: true; value: undefined }
	| { ok: false; error: InitErrorOutput };

// === Atomic Write Helper ===

/**
 * Atomic file write with temp file + rename pattern.
 * Ensures file is either fully written or not touched at all.
 */
export function atomicWrite(filePath: string, content: string): WriteResult {
	const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
	const executableMode = 0o755;
	const existingMode = existsSync(filePath)
		? statSync(filePath).mode & 0o777
		: undefined;
	const targetMode = content.startsWith("#!") ? executableMode : existingMode;

	try {
		mkdirSync(dirname(filePath), { recursive: true });
		if (targetMode !== undefined) {
			writeFileSync(tempPath, content, {
				encoding: "utf-8",
				mode: targetMode,
			});
		} else {
			writeFileSync(tempPath, content, "utf-8");
		}
		renameSync(tempPath, filePath);
		if (targetMode !== undefined) {
			chmodSync(filePath, targetMode);
		}
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

// === Schema Defaults ===

/**
 * Add default values for missing schema fields.
 * Merges user contract with defaults, preserving user values.
 */
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

// === Migration Registry ===

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
	{
		fromVersion: "1.5.0",
		toVersion: "1.6.0",
		description:
			"Inject canonical north-star contract surfaces and trusted reviewer defaults",
		migrate: (contract) =>
			({
				...addSchemaDefaults(contract),
				version: "1.6.0",
			}) as ContractSchema,
	},
];

// === Public Functions ===

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

// === Internal Functions ===

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
export function executeMigration(targetDir: string): MigrationResultType {
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
