import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { cwd } from "node:process";
import { diffLines } from "diff";
import {
	CONTRACT_FILE,
	detectContractVersion,
	executeMigration,
} from "../lib/init/migration.js";
import { atomicWrite } from "../lib/init/migration.js";
import {
	createBackup,
	executeRollback,
	loadManifest,
} from "../lib/init/rollback.js";
import {
	type CIProvider,
	TEMPLATES,
	createTemplateRenderContext,
	detectPackageManager,
	getTemplatesForProvider,
	isTemplateEnabledForProvider,
	normalizeCIProvider,
	shouldAutoUpdateTemplate,
} from "../lib/init/scaffold.js";
import {
	BACKUPS_DIR,
	CURRENT_SCHEMA_VERSION,
	EXIT_CODES,
	HARNESS_DIR,
	type InitErrorOutput,
	type InitOptions,
	type InitResult,
	MANIFEST_FILE,
	MAX_INTERACTIVE_FILE_BYTES,
	type ManifestEntry,
	type ProposedChange,
	type RestoreManifest,
} from "../lib/init/types.js";
import { checkForUpdates, executeUpdate } from "../lib/init/update.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { getVersion } from "../lib/version.js";

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
