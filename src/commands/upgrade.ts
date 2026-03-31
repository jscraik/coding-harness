/**
 * JSC-66: `harness upgrade` command.
 *
 * Version-aware upgrade that:
 * 1. Detects fromVersion → toVersion
 * 2. Classifies files as stock / customized / absent
 * 3. Applies contract schema migrations
 * 4. Re-renders stock templates (skips customized unless --force)
 * 5. Updates upgrade-manifest.json with new fingerprints
 *
 * Also exports detectExistingInstall for use by `harness init` to auto-detect
 * upgrade mode and emit a prompt.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { mergeContracts } from "../lib/contract/merger.js";
import { DEFAULT_CONTRACT, type HarnessContract } from "../lib/contract/types.js";
import { atomicWrite } from "../lib/init/migration.js";
import { loadManifest } from "../lib/init/rollback.js";
import {
	createTemplateRenderContext,
	detectPackageManager,
	getTemplatesForProvider,
	normalizeCIProvider,
} from "../lib/init/scaffold.js";
import {
	formatMigrationChanges,
	migrateContractSchema,
} from "../lib/init/schema-migrate.js";
import { type CIProvider, EXIT_CODES, HARNESS_DIR } from "../lib/init/types.js";
import {
	UPGRADE_MANIFEST_FILE,
	type UpgradeManifest,
	type UpgradeManifestEntry,
	buildUpgradeManifest,
	classifyFiles,
	detectExistingInstall,
	detectUpgradeContext,
	fingerprintContent,
	formatUpgradeSummary,
} from "../lib/init/upgrade.js";
import { sanitizeError } from "../lib/input/sanitize.js";

export { detectExistingInstall } from "../lib/init/upgrade.js";

// ─── Upgrade manifest persistence ─────────────────────────────────────────────

function writeUpgradeManifest(
	targetDir: string,
	manifest: UpgradeManifest,
): { ok: true } | { ok: false; error: string } {
	const path = resolve(targetDir, HARNESS_DIR, UPGRADE_MANIFEST_FILE);
	try {
		const result = atomicWrite(path, JSON.stringify(manifest, null, 2));
		if (!result.ok) {
			return { ok: false, error: result.error.message };
		}
		return { ok: true };
	} catch (err) {
		return { ok: false, error: sanitizeError(err) };
	}
}

function readUpgradeManifest(targetDir: string): UpgradeManifest | null {
	const path = resolve(targetDir, HARNESS_DIR, UPGRADE_MANIFEST_FILE);
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as UpgradeManifest;
	} catch {
		return null;
	}
}

// ─── Contract schema migration ─────────────────────────────────────────────────

function applyContractMigration(
	targetDir: string,
	fromVersion: string,
	toVersion: string,
	dryRun: boolean,
): { ok: true; summary: string } | { ok: false; error: string } {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return { ok: true, summary: "" };
	}

	let contract: Record<string, unknown>;
	try {
		contract = JSON.parse(readFileSync(contractPath, "utf-8")) as Record<
			string,
			unknown
		>;
	} catch (err) {
		return {
			ok: false,
			error: `Could not parse harness.contract.json: ${sanitizeError(err)}`,
		};
	}

	const migrationResult = migrateContractSchema(contract, fromVersion);
	const summary = formatMigrationChanges(
		migrationResult.changes,
		fromVersion,
		toVersion,
	);

	if (migrationResult.changes.length > 0 && !dryRun) {
		const writeResult = atomicWrite(
			contractPath,
			JSON.stringify(migrationResult.contract, null, 2),
		);
		if (!writeResult.ok) {
			return {
				ok: false,
				error: `Failed to write migrated contract: ${writeResult.error.message}`,
			};
		}
	}

	return { ok: true, summary };
}

function backfillContractDefaults(
	targetDir: string,
	dryRun: boolean,
): { ok: true; summary: string; changed: boolean } | { ok: false; error: string } {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return { ok: true, summary: "", changed: false };
	}

	let existingContract: Record<string, unknown>;
	try {
		existingContract = JSON.parse(readFileSync(contractPath, "utf-8")) as Record<
			string,
			unknown
		>;
	} catch (err) {
		return {
			ok: false,
			error: `Could not parse harness.contract.json: ${sanitizeError(err)}`,
		};
	}

	const mergedContract = mergeContracts(
		DEFAULT_CONTRACT,
		existingContract as Partial<HarnessContract>,
	) as unknown as Record<string, unknown>;
	if (typeof existingContract.version === "string") {
		mergedContract.version = existingContract.version;
	}

	const changed =
		JSON.stringify(existingContract) !== JSON.stringify(mergedContract);
	if (!changed) {
		return { ok: true, summary: "", changed: false };
	}

	if (!dryRun) {
		const writeResult = atomicWrite(
			contractPath,
			`${JSON.stringify(mergedContract, null, 2)}\n`,
		);
		if (!writeResult.ok) {
			return {
				ok: false,
				error: `Failed to write healed contract defaults: ${writeResult.error.message}`,
			};
		}
	}

	return {
		ok: true,
		summary:
			"Contract defaults backfilled (including missing policy keys such as docsGatePolicy).",
		changed: true,
	};
}

// ─── Template upgrade ──────────────────────────────────────────────────────────

interface TemplateUpgradeResult {
	updated: string[];
	skipped: string[];
	forced: string[];
}

function upgradeTemplates(
	targetDir: string,
	ciProvider: CIProvider,
	upgradeManifest: UpgradeManifest | null,
	force: boolean,
	dryRun: boolean,
): { ok: true; value: TemplateUpgradeResult } | { ok: false; error: string } {
	const packageManager = detectPackageManager(targetDir);
	const renderContext = createTemplateRenderContext(targetDir, ciProvider);
	const templates = getTemplatesForProvider(ciProvider);

	const classified = upgradeManifest
		? classifyFiles(targetDir, upgradeManifest)
		: [];
	const customizedPaths = new Set(
		classified.filter((c) => c.status === "customized").map((c) => c.path),
	);

	const result: TemplateUpgradeResult = {
		updated: [],
		skipped: [],
		forced: [],
	};
	const newEntries: Array<{ path: string; content: string }> = [];

	for (const template of templates) {
		const absPath = resolve(targetDir, template.path);
		if (!existsSync(absPath)) {
			// Don't create new files on upgrade (only update tracked ones)
			result.skipped.push(template.path);
			continue;
		}
		const content = template.render(packageManager, renderContext);
		newEntries.push({ path: template.path, content });

		const isCustomized = customizedPaths.has(template.path);
		const onDiskHash = fingerprintContent(readFileSync(absPath, "utf-8"));
		const newHash = fingerprintContent(content);

		if (onDiskHash === newHash) {
			result.skipped.push(template.path);
			continue;
		}

		if (isCustomized && !force) {
			result.skipped.push(template.path); // Preserve customization
			continue;
		}

		if (!dryRun) {
			const writeResult = atomicWrite(absPath, content);
			if (!writeResult.ok) {
				return {
					ok: false,
					error: `Failed to update ${template.path}: ${writeResult.error.message}`,
				};
			}
		}

		if (isCustomized && force) {
			result.forced.push(template.path);
		} else {
			result.updated.push(template.path);
		}
	}

	// Update upgrade-manifest with new fingerprints
	if (!dryRun && newEntries.length > 0) {
		const newManifest = buildUpgradeManifest(newEntries);
		const reClassified = classifyFiles(targetDir, newManifest);
		const finalEntries: UpgradeManifestEntry[] = newManifest.files.map(
			(entry) => {
				const cls = reClassified.find((c) => c.path === entry.path);
				return { ...entry, customized: cls?.status === "customized" };
			},
		);
		const writeResult = writeUpgradeManifest(targetDir, {
			...newManifest,
			files: finalEntries,
		});
		if (!writeResult.ok) {
			return {
				ok: false,
				error: `Failed to write upgrade manifest: ${writeResult.error}`,
			};
		}
	}

	return { ok: true, value: result };
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

export interface HarnessUpgradeOptions {
	force?: boolean | undefined;
	dryRun?: boolean | undefined;
	provider?: string | undefined;
	skipContractMigration?: boolean | undefined;
}

/**
 * JSC-66: `harness upgrade` CLI entry point.
 *
 * Usage:
 *   harness upgrade [targetDir] [--dry-run] [--force] [--provider circleci]
 */
export function runUpgradeCLI(
	targetDir: string | undefined,
	options: HarnessUpgradeOptions,
): number {
	const dir = targetDir ?? cwd();
	const dryRun = options.dryRun === true;
	const force = options.force === true;

	// 1. Detect existing install
	const installCheck = detectExistingInstall(dir);
	if (!installCheck.isExistingInstall) {
		console.info(
			[
				"",
				"ℹ️  No existing harness installation detected.",
				"   Run `harness init` to install harness in this directory.",
				"",
			].join("\n"),
		);
		return EXIT_CODES.SUCCESS;
	}

	// 2. Detect upgrade context
	const upgradeResult = detectUpgradeContext(dir);
	if (!upgradeResult.ok) {
		console.error(`Error: ${upgradeResult.error}`);
		return EXIT_CODES.INVALID_PATH;
	}
	const ctx = upgradeResult.value;

	// 3. Print summary
	console.info(formatUpgradeSummary(ctx));

	const defaultsBackfillResult = backfillContractDefaults(dir, dryRun);
	if (!defaultsBackfillResult.ok) {
		console.error(`Error: ${defaultsBackfillResult.error}`);
		return EXIT_CODES.WRITE_ERROR;
	}
	if (defaultsBackfillResult.summary) {
		const prefix = dryRun ? "[DRY RUN] " : "";
		console.info(`${prefix}${defaultsBackfillResult.summary}`);
	}

	if (!ctx.upgradeNeeded && !ctx.downgradeDetected) {
		return EXIT_CODES.SUCCESS;
	}

	if (ctx.downgradeDetected && !force) {
		console.error(
			"Error: downgrade detected. Use --force to override (not recommended).",
		);
		return EXIT_CODES.INVALID_PATH;
	}

	// 4. Determine CI provider
	const manifestResult = loadManifest(dir, {
		requireMetadata: true,
		operation: "upgrade",
	});
	if (!manifestResult.ok && options.provider === undefined) {
		console.error(`Error: ${manifestResult.error.message}`);
		return EXIT_CODES.WRITE_ERROR;
	}
	const rawProvider =
		options.provider ??
		(manifestResult.ok ? manifestResult.value.ciProvider : undefined);
	if (!rawProvider) {
		console.error(
			"Error: Restore manifest is incomplete for upgrade: missing ciProvider.",
		);
		return EXIT_CODES.WRITE_ERROR;
	}

	const providerResult = normalizeCIProvider(rawProvider);
	if (!providerResult.ok) {
		console.error(`Error: invalid CI provider "${rawProvider}"`);
		return EXIT_CODES.INVALID_PATH;
	}
	const ciProvider = providerResult.value;

	// 5. Contract schema migration
	if (!options.skipContractMigration) {
		const migrationResult = applyContractMigration(
			dir,
			ctx.fromVersion,
			ctx.toVersion,
			dryRun,
		);
		if (!migrationResult.ok) {
			console.error(`Error: ${migrationResult.error}`);
			return EXIT_CODES.WRITE_ERROR;
		}
		if (migrationResult.summary) {
			console.info(migrationResult.summary);
		}
	}

	// 6. Template upgrade
	const upgradeManifest = readUpgradeManifest(dir);
	const templateResult = upgradeTemplates(
		dir,
		ciProvider,
		upgradeManifest,
		force,
		dryRun,
	);
	if (!templateResult.ok) {
		console.error(`Error: ${templateResult.error}`);
		return EXIT_CODES.WRITE_ERROR;
	}
	const { updated, skipped, forced } = templateResult.value;

	// 7. Summary
	const prefix = dryRun ? "[DRY RUN] " : "";
	if (updated.length > 0) {
		console.info(`${prefix}Updated ${updated.length} stock template(s):`);
		for (const f of updated) console.info(`  ✓ ${f}`);
	}
	if (forced.length > 0) {
		console.info(`${prefix}Force-updated ${forced.length} customized file(s):`);
		for (const f of forced) console.info(`  ⚠️  ${f}`);
	}
	if (skipped.length > 0 && (updated.length > 0 || forced.length > 0)) {
		console.info(
			`${prefix}Skipped ${skipped.length} file(s) (unchanged or customized).`,
		);
	}

	if (updated.length === 0 && forced.length === 0) {
		console.info(
			`${prefix}No templates updated — all files are current or customized.`,
		);
	}

	if (dryRun) {
		console.info(
			"\n[DRY RUN] No files were written. Remove --dry-run to apply.",
		);
	} else {
		console.info(
			`\n✅ Upgrade complete: ${ctx.fromVersion} → ${ctx.toVersion}`,
		);
		if (updated.length > 0 || forced.length > 0) {
			console.info(
				"   Run `harness doctor` to verify the installation is healthy.",
			);
		}
	}

	return EXIT_CODES.SUCCESS;
}
