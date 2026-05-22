/**
 * JSC-66: `harness upgrade` runner.
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

import { cwd } from "node:process";
import { runInitCLI } from "../init/cli.js";
import { loadManifest } from "../init/rollback.js";
import { normalizeCIProvider } from "../init/scaffold.js";
import { type CIProvider, EXIT_CODES } from "../init/types.js";
import {
	detectExistingInstall,
	detectUpgradeContext,
	formatUpgradeSummary,
} from "../init/upgrade.js";
import type { HarnessUpgradeOptions } from "./types.js";
import {
	applyContractMigration,
	backfillContractDefaults,
} from "./contract.js";
import {
	printTemplateUpgradeSummary,
	readUpgradeManifest,
	type TemplateUpgradeResult,
	upgradeTemplates,
} from "./templates.js";

export { detectExistingInstall } from "../init/upgrade.js";
export type { HarnessUpgradeOptions } from "./types.js";

function printNoExistingInstallNotice(): void {
	console.info(
		[
			"",
			"ℹ️  No existing harness installation detected.",
			"   Run `harness init` to install harness in this directory.",
			"   For downstream repair flows, run `harness init --track` so future",
			"   `harness init --update`/`harness upgrade` can repair contract defaults.",
			"",
		].join("\n"),
	);
}

function resolveUpgradeCiProvider(
	targetDir: string,
	options: HarnessUpgradeOptions,
	preferredCiProvider: CIProvider | undefined,
): { ok: true; value: CIProvider } | { ok: false; exitCode: number } {
	const manifestResult = loadManifest(targetDir, {
		requireMetadata: true,
		operation: "upgrade",
		...(preferredCiProvider ? { preferredCiProvider } : {}),
	});
	if (!manifestResult.ok && options.provider === undefined) {
		console.error(`Error: ${manifestResult.error.message}`);
		return { ok: false, exitCode: EXIT_CODES.WRITE_ERROR };
	}

	const rawProvider =
		options.provider ??
		(manifestResult.ok ? manifestResult.value.ciProvider : undefined);
	if (!rawProvider) {
		console.error(
			"Error: Restore manifest is incomplete for upgrade: missing ciProvider.",
		);
		return { ok: false, exitCode: EXIT_CODES.WRITE_ERROR };
	}

	const providerResult = normalizeCIProvider(rawProvider);
	if (!providerResult.ok) {
		console.error(`Error: invalid CI provider "${rawProvider}"`);
		return { ok: false, exitCode: EXIT_CODES.INVALID_PATH };
	}

	return { ok: true, value: providerResult.value };
}

function runJsonDryRunUpgrade(
	dir: string,
	force: boolean,
	preferredCiProvider: CIProvider | undefined,
	options: HarnessUpgradeOptions,
): number | null {
	if (options.json !== true) return null;
	if (!options.dryRun) {
		console.error(
			"Error: --json is currently supported for upgrade dry-runs only.",
		);
		return EXIT_CODES.WRITE_ERROR;
	}
	if (options.skipContractMigration) {
		console.error(
			"Error: --json cannot be combined with --skip-contract-migration.",
		);
		return EXIT_CODES.WRITE_ERROR;
	}
	return runInitCLI(dir, {
		dryRun: true,
		force,
		update: true,
		json: true,
		...(preferredCiProvider ? { ciProvider: preferredCiProvider } : {}),
	});
}

function applyUpgradeContractDefaults(
	dir: string,
	dryRun: boolean,
): number | null {
	const defaultsBackfillResult = backfillContractDefaults(dir, dryRun);
	if (!defaultsBackfillResult.ok) {
		console.error(`Error: ${defaultsBackfillResult.error}`);
		return EXIT_CODES.WRITE_ERROR;
	}
	if (defaultsBackfillResult.summary) {
		const prefix = dryRun ? "[DRY RUN] " : "";
		console.info(`${prefix}${defaultsBackfillResult.summary}`);
	}
	return null;
}

function applyUpgradeContractSchemaMigration(
	dir: string,
	dryRun: boolean,
	fromVersion: string,
	toVersion: string,
): number | null {
	const migrationResult = applyContractMigration(
		dir,
		fromVersion,
		toVersion,
		dryRun,
	);
	if (!migrationResult.ok) {
		console.error(`Error: ${migrationResult.error}`);
		return EXIT_CODES.WRITE_ERROR;
	}
	if (migrationResult.summary) {
		console.info(migrationResult.summary);
	}
	return null;
}

interface UpgradeExecutionContext {
	fromVersion: string;
	toVersion: string;
	upgradeNeeded: boolean;
	downgradeDetected: boolean;
}

function resolveUpgradeExecutionContext(
	dir: string,
	preferredCiProvider: CIProvider | undefined,
	dryRun: boolean,
):
	| { ok: true; value: UpgradeExecutionContext }
	| { ok: false; exitCode: number } {
	const installCheck = detectExistingInstall(dir);
	if (!installCheck.isExistingInstall) {
		printNoExistingInstallNotice();
		return { ok: false, exitCode: EXIT_CODES.SUCCESS };
	}

	const upgradeResult = detectUpgradeContext(dir, preferredCiProvider, {
		dryRun,
	});
	if (!upgradeResult.ok) {
		console.error(`Error: ${upgradeResult.error}`);
		return { ok: false, exitCode: EXIT_CODES.INVALID_PATH };
	}

	console.info(formatUpgradeSummary(upgradeResult.value));
	return { ok: true, value: upgradeResult.value };
}

function executeTemplateUpgrade(
	dir: string,
	ciProvider: CIProvider,
	force: boolean,
	dryRun: boolean,
):
	| { ok: true; value: TemplateUpgradeResult }
	| { ok: false; exitCode: number } {
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
		return { ok: false, exitCode: EXIT_CODES.WRITE_ERROR };
	}
	return templateResult;
}

function printUpgradeCompletion(
	fromVersion: string,
	toVersion: string,
	result: TemplateUpgradeResult,
	dryRun: boolean,
): void {
	if (dryRun) {
		console.info(
			"\n[DRY RUN] No files were written. Remove --dry-run to apply.",
		);
		return;
	}

	console.info(`\n✅ Upgrade complete: ${fromVersion} → ${toVersion}`);
	if (result.updated.length > 0 || result.forced.length > 0) {
		console.info(
			"   Run `harness doctor` to verify the installation is healthy.",
		);
	}
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

/**
 * Run the harness upgrade CLI flow, performing installation detection, optional contract backfill and migration, CI provider resolution, and template upgrades while printing progress and summaries.
 *
 * Performs a complete upgrade workflow including: detecting an existing installation and upgrade context, optionally backfilling contract defaults and applying schema migrations, resolving the CI provider, upgrading templates (respecting `--force` and `--dry-run`), and printing summaries and final messages. Supports a `--json` short-circuit that delegates to the init flow for a dry-run JSON output.
 *
 * @param targetDir - Optional target directory; when omitted the current working directory is used
 * @param options - CLI options (supports `dryRun`, `force`, `json`, `provider`, `skipContractMigration`)
 * @returns A numeric exit code from `EXIT_CODES` indicating success or the type of failure encountered
 */
export function runUpgradeCLI(
	targetDir: string | undefined,
	options: HarnessUpgradeOptions,
): number {
	const dir = targetDir ?? cwd();
	const dryRun = options.dryRun === true;
	const force = options.force === true;
	const preferredProviderResult = normalizeCIProvider(options.provider);
	if (!preferredProviderResult.ok) {
		console.error(`Error: ${preferredProviderResult.error.message}`);
		return EXIT_CODES.INVALID_PATH;
	}
	const preferredCiProvider = preferredProviderResult.value;
	const jsonExitCode = runJsonDryRunUpgrade(
		dir,
		force,
		preferredCiProvider,
		options,
	);
	if (jsonExitCode !== null) return jsonExitCode;
	const contextResult = resolveUpgradeExecutionContext(
		dir,
		preferredCiProvider,
		dryRun,
	);
	if (!contextResult.ok) return contextResult.exitCode;
	const ctx = contextResult.value;
	const defaultsExitCode = applyUpgradeContractDefaults(dir, dryRun);
	if (defaultsExitCode !== null) return defaultsExitCode;
	if (!ctx.upgradeNeeded && !ctx.downgradeDetected) {
		return EXIT_CODES.SUCCESS;
	}
	if (ctx.downgradeDetected && !force) {
		console.error(
			"Error: downgrade detected. Use --force to override (not recommended).",
		);
		return EXIT_CODES.INVALID_PATH;
	}
	const ciProviderResult = resolveUpgradeCiProvider(
		dir,
		options,
		preferredCiProvider,
	);
	if (!ciProviderResult.ok) {
		return ciProviderResult.exitCode;
	}
	const ciProvider = ciProviderResult.value;
	if (!options.skipContractMigration) {
		const migrationExitCode = applyUpgradeContractSchemaMigration(
			dir,
			dryRun,
			ctx.fromVersion,
			ctx.toVersion,
		);
		if (migrationExitCode !== null) return migrationExitCode;
	}
	const templateResult = executeTemplateUpgrade(dir, ciProvider, force, dryRun);
	if (!templateResult.ok) return templateResult.exitCode;
	printTemplateUpgradeSummary(templateResult.value, dryRun);
	printUpgradeCompletion(
		ctx.fromVersion,
		ctx.toVersion,
		templateResult.value,
		dryRun,
	);

	return EXIT_CODES.SUCCESS;
}
