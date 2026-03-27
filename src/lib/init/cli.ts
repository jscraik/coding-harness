import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { cwd } from "node:process";
import { sanitizeError } from "../input/sanitize.js";
import { detectProjectType } from "../project-type/detector.js";
import {
	type ProjectType,
	VALID_OVERRIDE_TYPES,
} from "../project-type/types.js";
import { getVersion } from "../version.js";
import {
	applyProposedChange,
	collectProposedChanges,
	generateDiff,
} from "./interactive.js";
import {
	CONTRACT_FILE,
	atomicWrite,
	detectContractVersion,
	executeMigration,
} from "./migration.js";
import { createBackup, executeRollback, loadManifest } from "./rollback.js";
import {
	TEMPLATES,
	createTemplateRenderContext,
	detectPackageManager,
	getTemplatesForProvider,
	getToolingVersionDecision,
	isTemplateEnabledForProvider,
	normalizeCIProvider,
	shouldAutoUpdateTemplate,
} from "./scaffold.js";
import {
	BACKUPS_DIR,
	CURRENT_SCHEMA_VERSION,
	EXIT_CODES,
	HARNESS_DIR,
	type InitErrorOutput,
	type InitOptions,
	type InitResult,
	MANIFEST_FILE,
	type ManifestEntry,
	type ProposedChange,
	type RestoreManifest,
} from "./types.js";
import { checkForUpdates, executeUpdate } from "./update.js";

// Retired template paths that should be cleaned up during init
const RETIRED_TEMPLATE_PATHS = [
	".github/ISSUE_TEMPLATE/issue.yml",
	".github/ISSUE_TEMPLATE/feature.yml",
	".github/ISSUE_TEMPLATE/security.yml",
] as const;

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

	if (options.update && options.track) {
		return {
			ok: false,
			error: {
				code: "INVALID_OPTIONS",
				message:
					"--update cannot be combined with --track. Use `harness upgrade --dry-run` for existing installs, or run `harness init --track` separately when bootstrapping tracked files.",
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
		const manifestResult = loadManifest(dir, {
			requireMetadata: true,
			operation: "update",
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

		// JSC-57: Version-aware handling for tooling configs (e.g. biome.json)
		// - existing newer  → skip (don't downgrade)
		// - existing older  → allow overwrite even without --force (upgrade)
		// - no version info → fall through to normal skip/force logic
		const versionDecision =
			exists && !options.force
				? getToolingVersionDecision(template.path, targetPath)
				: "no_opinion";

		if (versionDecision === "skip") {
			skipped.push(template.path);
			continue;
		}

		const versionForcedUpdate = versionDecision === "force_update";

		// Skip existing files unless --force or auto-update or version-forced
		if (exists && !options.force && !autoUpdate && !versionForcedUpdate) {
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

	// I3: If --project-type was explicitly provided and harness.contract.json already existed
	// (and was skipped by the template loop), patch only the projectType field atomically.
	// This avoids requiring --force alongside --project-type (which would be a footgun).
	if (options.projectType && !options.dryRun) {
		const contractPath = resolve(dir, CONTRACT_FILE);
		if (existsSync(contractPath)) {
			try {
				const raw = readFileSync(contractPath, "utf-8");
				const parsed = JSON.parse(raw) as Record<string, unknown>;
				parsed.projectType = options.projectType;
				const patchResult = atomicWrite(
					contractPath,
					`${JSON.stringify(parsed, null, 2)}\n`,
				);
				if (!patchResult.ok) {
					return patchResult;
				}
				// Track in created if not already there (template loop may have skipped it)
				if (!created.includes(CONTRACT_FILE)) {
					created.push(CONTRACT_FILE);
					// Remove from skipped if it was recorded there
					const skipIdx = skipped.indexOf(CONTRACT_FILE);
					if (skipIdx !== -1) skipped.splice(skipIdx, 1);
				}
			} catch {
				// Malformed JSON — skip the patch; contract will be regenerated on next --force init
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
			projectTypeDetection: detectionResult,
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
		if (
			result.error.code === "WRITE_ERROR" ||
			result.error.code === "INCOMPLETE_MANIFEST"
		) {
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
		const {
			packageManager,
			created,
			skipped,
			ownershipDecisions,
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
				console.info("\n  Run: harness upgrade --dry-run");
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
			console.info("  Note: --migrate only updates harness.contract.json.");
			console.info("  Use `harness ci-migrate ...` for CI provider cutovers.");
			return EXIT_CODES.SUCCESS;
		}

		// SA9: warn when detection returned unknown
		if (projectTypeDetection?.projectType === "unknown") {
			console.warn(
				"Warning: Could not detect project type. Using universal defaults.",
			);
			console.warn(
				"  Run `harness init --project-type <cli|desktop|library|web>` to specify it explicitly.",
			);
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
	if (
		result.error.code === "WRITE_ERROR" ||
		result.error.code === "INCOMPLETE_MANIFEST"
	) {
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
