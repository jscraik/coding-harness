import { collectProposedChanges } from "./interactive.js";
import { CONTRACT_FILE, executeMigration } from "./migration.js";
import { executeRollback, loadManifest } from "./rollback.js";
import {
	type CIProvider,
	type InitOptions,
	type InitResult,
	MANIFEST_FILE,
	type RestoreManifest,
} from "./types.js";
import { checkForUpdates, executeUpdate } from "./update.js";

/**
 * Execute rollback mode: restore files from manifest.
 */
export function handleRollback(
	dir: string,
	existingManifest: RestoreManifest | null,
	ciProvider: CIProvider,
	packageManager: string,
): InitResult {
	const manifestResult =
		existingManifest !== null
			? ({ ok: true, value: existingManifest } as const)
			: loadManifest(dir);
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

/**
 * Execute check-updates mode: compare installed vs current template versions.
 */
export function handleCheckUpdates(
	dir: string,
	ciProvider: CIProvider,
	packageManager: string,
): InitResult {
	const checkResult = checkForUpdates(dir, ciProvider);
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

/**
 * Execute update mode: apply template updates from tracked manifest.
 */
export function handleUpdate(
	dir: string,
	existingManifest: RestoreManifest | null,
	ciProvider: CIProvider,
	packageManager: string,
): InitResult {
	const manifestResult =
		existingManifest !== null
			? ({ ok: true, value: existingManifest } as const)
			: loadManifest(dir, {
					requireMetadata: true,
					operation: "update",
					preferredCiProvider: ciProvider,
				});
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
			...(updateResult.value.ownershipDecisions
				? { ownershipDecisions: updateResult.value.ownershipDecisions }
				: {}),
		},
	};
}

/**
 * Execute migrate mode: apply schema migrations to contract.
 */
export function handleMigrate(dir: string, packageManager: string): InitResult {
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

/**
 * Execute interactive mode: collect proposed changes without writing.
 */
export function handleInteractive(
	dir: string,
	options: InitOptions,
	ciProvider: CIProvider,
	packageManager: string,
): InitResult {
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
