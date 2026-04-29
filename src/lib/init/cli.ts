import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { detectProjectType } from "../project-type/detector.js";
import {
	type ProjectType,
	VALID_OVERRIDE_TYPES,
} from "../project-type/types.js";
import {
	getExitCodeFromError,
	probeManifest,
	validateModeExclusivity,
} from "./init-helpers.js";
import { applyApprovedChanges, promptForChanges } from "./init-interactive.js";
import {
	handleCheckUpdates,
	handleInteractive,
	handleMigrate,
	handleRollback,
	handleUpdate,
} from "./init-modes.js";
import { executeNormalInstall } from "./init-ops.js";
import {
	printCheckUpdatesOutput,
	printErrorOutput,
	printInstallOutput,
	printInteractiveSummary,
	printMigrateOutput,
	printRollbackOutput,
	printUpdateOutput,
	warnIfUnknownProjectType,
} from "./init-output.js";
import { CONTRACT_FILE, detectContractVersion } from "./migration.js";
import {
	createTemplateRenderContext,
	detectPackageManager,
	getTemplatesForProvider,
	normalizeCIProvider,
} from "./scaffold.js";
import {
	BACKUPS_DIR,
	CURRENT_SCHEMA_VERSION,
	EXIT_CODES,
	HARNESS_DIR,
	type InitOptions,
	type InitResult,
	MANIFEST_FILE,
} from "./types.js";

/**
 * Perform initialization (install, update, migrate, rollback, or interactive changes) for a repository directory and return a structured result describing created/skipped files and metadata.
 *
 * The behavior is controlled by `options` (provider and project-type overrides, tracking, dry-run, update/migrate/rollback/interactive modes, etc.). This function performs filesystem reads/writes and manifest handling but does not print to stdout/stderr.
 *
 * @param targetDir - Directory to operate on; when omitted the current working directory is used
 * @param options - Initialization options that control mode and policy (provider/project-type overrides, tracking, dry-run, update/migrate/rollback/interactive flags, and related settings)
 * @returns An InitResult: on success `output` contains package manager, lists of `created` and `skipped` templates and related metadata; on failure `error` contains a `code`, `message`, and optional `path`.
 *
 * Possible error `code` values include (but are not limited to): `INVALID_PATH`, `INVALID_OPTIONS`, `PATH_TRAVERSAL`, `WRITE_ERROR`, `INCOMPLETE_MANIFEST`.
 */
export function runInit(
	targetDir: string | undefined,
	options: InitOptions,
): InitResult {
	const dir = targetDir ?? cwd();
	const requestedCiProviderResult = normalizeCIProvider(options.ciProvider);
	if (!requestedCiProviderResult.ok) {
		return requestedCiProviderResult;
	}
	const requestedCiProvider = requestedCiProviderResult.value;
	let ciProvider = requestedCiProvider;
	let existingManifest: import("./types.js").RestoreManifest | null = null;

	// P2: Validate --project-type flag if provided (SA10, SA16)
	if (options.projectType !== undefined) {
		if (
			!(VALID_OVERRIDE_TYPES as readonly string[]).includes(options.projectType)
		) {
			return {
				ok: false,
				error: {
					code: "INVALID_PATH",
					message: `Invalid --project-type value: "${options.projectType}". Valid values: ${VALID_OVERRIDE_TYPES.join(" | ")}.`,
				},
			};
		}
	}

	// P2: Detect project type (SA1–SA9, SA15). Pure read-only call.
	const detectionResult = detectProjectType(
		dir,
		options.projectType as ProjectType | undefined,
	);

	// P2: Idempotency — read existing contract to preserve existing projectType on re-init unless
	// --project-type override was explicitly supplied (I2, I3, SA11, SA12)
	let projectTypeToWrite: ProjectType = detectionResult.projectType;
	if (!options.projectType) {
		const contractPath = resolve(dir, CONTRACT_FILE);
		if (existsSync(contractPath)) {
			try {
				const existing = JSON.parse(
					readFileSync(contractPath, "utf-8"),
				) as Record<string, unknown>;
				if (
					typeof existing.projectType === "string" &&
					existing.projectType.length > 0
				) {
					projectTypeToWrite = existing.projectType as ProjectType;
				}
			} catch {
				// unreadable or malformed — proceed with detected value
			}
		}
	}

	const packageManager = detectPackageManager(dir);
	const renderContext = createTemplateRenderContext(
		dir,
		ciProvider,
		projectTypeToWrite !== "unknown" ? projectTypeToWrite : undefined,
		options,
	);
	const templates = getTemplatesForProvider(ciProvider, options);

	const modeError = validateModeExclusivity(options);
	if (modeError) {
		return modeError;
	}

	const probeResult = probeManifest(dir, options, requestedCiProvider);
	if (probeResult.error) {
		return probeResult.error;
	}
	existingManifest = probeResult.existingManifest;
	ciProvider = probeResult.ciProvider;

	// Handle --rollback: restore from manifest
	if (options.rollback) {
		return handleRollback(dir, existingManifest, ciProvider, packageManager);
	}

	// Handle --check-updates: compare versions
	if (options.checkUpdates) {
		return handleCheckUpdates(dir, ciProvider, packageManager);
	}

	// Handle --update: apply template updates
	if (options.update) {
		return handleUpdate(
			dir,
			existingManifest,
			ciProvider,
			packageManager,
			options,
		);
	}

	// Handle --migrate: apply schema migrations to contract
	if (options.migrate) {
		return handleMigrate(dir, packageManager);
	}

	// Handle --interactive: collect proposed changes without writing
	if (options.interactive) {
		return handleInteractive(dir, options, ciProvider, packageManager);
	}

	return executeNormalInstall(
		dir,
		templates,
		options,
		packageManager,
		renderContext,
		ciProvider,
		detectionResult,
	);
}

/**
 * Async CLI entry point for interactive mode.
 * Prompts user for each proposed change and applies approved ones.
 */
export async function runInteractiveInitCLI(
	targetDir: string | undefined,
	options: InitOptions,
): Promise<number> {
	const dir = targetDir ?? cwd();
	const packageManager = detectPackageManager(dir);

	// Check TTY - fall back to non-interactive if not a terminal
	if (!process.stdin.isTTY) {
		console.info("Warning: Not a TTY, falling back to non-interactive mode");
		return runInitCLI(targetDir, { ...options, interactive: false });
	}

	console.info(`Installing harness (package manager: ${packageManager})\n`);

	const result = runInit(targetDir, { ...options, interactive: true });
	if (!result.ok) {
		console.error(`Error: ${result.error.message}`);
		if (result.error.path) {
			console.error(`  Path: ${result.error.path}`);
		}
		return getExitCodeFromError(result.error);
	}

	const proposedChanges = result.output.proposedChanges ?? [];
	const { approved, rejected, cancelled } =
		await promptForChanges(proposedChanges);
	if (cancelled) {
		return EXIT_CODES.SUCCESS;
	}

	const { applied, failed } = applyApprovedChanges(dir, approved);

	return printInteractiveSummary(applied, rejected, failed, !!options.track);
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
		const {
			packageManager,
			created,
			skipped,
			ownershipDecisions,
			updateMode,
			updateCheck,
			projectTypeDetection,
		} = result.output;

		// --json: emit full structured output (SA13, SA14)
		if (options.json) {
			console.info(JSON.stringify(result.output, null, 2));
			return EXIT_CODES.SUCCESS;
		}

		// Handle rollback output
		if (options.rollback) {
			printRollbackOutput(skipped);
			return EXIT_CODES.SUCCESS;
		}

		// Handle --check-updates output
		if (options.checkUpdates && updateCheck) {
			printCheckUpdatesOutput(updateCheck);
			return EXIT_CODES.SUCCESS;
		}

		// Handle --update output
		if (options.update) {
			printUpdateOutput(
				created,
				skipped,
				ownershipDecisions,
				options,
				updateMode,
			);
			return EXIT_CODES.SUCCESS;
		}

		// Handle --migrate output
		if (options.migrate) {
			printMigrateOutput(created, migrationStartVersion);
			return EXIT_CODES.SUCCESS;
		}

		// SA9: warn when detection returned unknown
		warnIfUnknownProjectType(projectTypeDetection);

		printInstallOutput(
			packageManager,
			created,
			skipped,
			options,
			projectTypeDetection,
			result.output,
		);

		return EXIT_CODES.SUCCESS;
	}

	// Error output
	printErrorOutput(options, result.error);
	return getExitCodeFromError(result.error);
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
} from "./types.js";
// Re-export constants (using local bindings to avoid duplicate identifier errors)
export {
	BACKUPS_DIR,
	CURRENT_SCHEMA_VERSION,
	EXIT_CODES,
	HARNESS_DIR,
	MANIFEST_FILE,
};
// Re-export interactive functions for test compatibility
export { generateDiff } from "./interactive.js";
