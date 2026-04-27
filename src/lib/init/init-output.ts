import type { DetectionResult } from "../project-type/types.js";
import { getVersion } from "../version.js";
import { CONTRACT_FILE } from "./migration.js";
import {
	formatBootstrapSummary,
	generateBootstrapSummary,
} from "./post-bootstrap-summary.js";
import {
	CURRENT_SCHEMA_VERSION,
	EXIT_CODES,
	type InitErrorOutput,
	type InitOptions,
	type InitOutput,
	type OwnershipDecision,
	type UpdateCheckInfo,
} from "./types.js";

/**
 * Print rollback completion output.
 */
export function printRollbackOutput(skipped: string[]): void {
	console.info("Rollback complete\n");
	for (const path of skipped) {
		console.info(`  restored ${path}`);
	}
	console.info("\n✓ Restored to pre-install state");
}

/**
 * Print check-updates result output.
 */
export function printCheckUpdatesOutput(updateCheck: UpdateCheckInfo): void {
	if (updateCheck.updateAvailable) {
		console.info(
			`Update available: v${updateCheck.installedVersion} → v${updateCheck.currentVersion}`,
		);
		console.info("\n  Run: harness upgrade --dry-run");
	} else {
		console.info(`Up to date (v${updateCheck.currentVersion})`);
	}
}

/**
 * Print template update result output.
 */
export function printUpdateOutput(
	created: string[],
	skipped: string[],
	ownershipDecisions: OwnershipDecision[] | undefined,
	options: InitOptions,
): void {
	if (created.length === 0 && skipped.length === 0) {
		console.info("Already up to date.");
	} else {
		console.info(`Refreshing tracked templates (v${getVersion()})\n`);
		for (const path of created) {
			console.info(`  updated ${path}`);
		}
		for (const path of skipped) {
			console.info(`  skipped ${path}`);
		}
		console.info(`\n✓ Updated ${created.length} file(s)`);
		console.info(
			"  Prefer `harness upgrade --dry-run` for routine upgrades in existing installs.",
		);
		if (options.explainOwnership && ownershipDecisions?.length) {
			console.info("\n  Ownership decisions:");
			for (const decision of ownershipDecisions) {
				console.info(
					`    ${decision.action.padEnd(9)} ${decision.owner.padEnd(8)} ${decision.path}`,
				);
			}
		}
	}
}

/**
 * Print contract migration result output.
 */
export function printMigrateOutput(
	created: string[],
	migrationStartVersion: string | null,
): void {
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
	console.info("  Note: --migrate only updates harness.contract.json.");
	console.info("  Use `harness ci-migrate ...` for CI provider cutovers.");
}

/**
 * Warn when project type detection returns unknown.
 */
export function warnIfUnknownProjectType(
	projectTypeDetection: DetectionResult | undefined,
): void {
	if (projectTypeDetection?.projectType === "unknown") {
		console.warn(
			"Warning: Could not detect project type. Using universal defaults.",
		);
		console.warn(
			"  Run `harness init --project-type <cli|desktop|library|web>` to specify it explicitly.",
		);
	}
}

/**
 * Print standard install result output.
 */
export function printInstallOutput(
	packageManager: string,
	created: string[],
	skipped: string[],
	options: InitOptions,
	projectTypeDetection: DetectionResult | undefined,
	resultOutput: InitOutput,
): void {
	console.info(`Installing harness (package manager: ${packageManager})\n`);

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

		const detectedType = projectTypeDetection?.projectType ?? "unknown";
		const typeLabel =
			detectedType === "unknown"
				? "unknown (use --project-type to set)"
				: projectTypeDetection?.confidence === "low"
					? `${detectedType} (low confidence)`
					: detectedType;
		console.info(`  Type: ${typeLabel} • Manager: ${packageManager}`);
		console.info(
			`  Created: ${created.length} file${created.length === 1 ? "" : "s"}, Skipped: ${skipped.length}`,
		);

		const summary = generateBootstrapSummary(resultOutput, packageManager);
		console.info(formatBootstrapSummary(summary));

		if (options.track) {
			console.info("\n  Rollback: harness init --rollback");
		} else if (created.length > 0) {
			console.info(
				"\n  Tip: Review changes with 'git diff', undo with 'git checkout .'",
			);
		}
	}
}

/**
 * Print error output in JSON or text format.
 */
export function printErrorOutput(
	options: InitOptions,
	error: InitErrorOutput,
): void {
	if (options.json) {
		console.info(JSON.stringify({ error }, null, 2));
	} else {
		console.error(`Error: ${error.message}`);
		if (error.path) {
			console.error(`  Path: ${error.path}`);
		}
		console.error("\n  Try: harness init --dry-run to preview changes");
	}
}

/**
 * Print interactive mode summary and return exit code.
 */
export function printInteractiveSummary(
	applied: string[],
	rejected: string[],
	failed: string[],
	track: boolean,
): number {
	console.info("\n✓ Harness installed!");
	console.info(`  Created: ${applied.length}, Skipped: ${rejected.length}`);

	if (failed.length > 0) {
		console.info(`  Failed: ${failed.length}`);
		return EXIT_CODES.WRITE_ERROR;
	}

	if (track && applied.length > 0) {
		console.info("\n  Rollback: harness init --rollback");
	} else if (applied.length > 0) {
		console.info(
			"\n  Tip: Review changes with 'git diff', undo with 'git checkout .'",
		);
	}

	return EXIT_CODES.SUCCESS;
}
