/**
 * template update functions for init command.
 *
 * Provides update detection and execution:
 * - Version comparison against manifest
 * - Template re-rendering for updates
 * - Manifest version bumping
 *
 * @module lib/init/update
 */

import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { sanitizeError } from "../input/sanitize.js";
import semver from "semver";
import { getVersion } from "../version.js";
import { atomicWrite } from "./migration.js";
import { loadManifest, sanitizePath } from "./rollback.js";
import {
	createTemplateRenderContext,
	detectPackageManager,
	getTemplatesForProvider,
} from "./scaffold.js";
import {
	type CIProvider,
	HARNESS_DIR,
	MANIFEST_FILE,
	type RestoreManifest,
	type UpdateCheckResult,
	type UpdateResult,
} from "./types.js";

/**
 * Check if template updates are available.
 * Compares manifest version against current CLI version.
 */
export function checkForUpdates(targetDir: string): UpdateCheckResult {
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
export function executeUpdate(
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
		const template = templates.find((template) => template.path === entry.path);
		if (!template) {
			// Template no longer exists, skip
			skipped.push(entry.path);
			continue;
		}

		// Re-validate path
		const pathResult = sanitizePath(targetDir, entry.path);
		if (!pathResult.ok) {
			return pathResult;
		}

		const targetPath = pathResult.value;

		// SECURITY: reject symlinked targets and parent-directory escapes.
		// sanitizePath is lexical-only and does not resolve realpaths, so a
		// symlinked directory (e.g. .github -> /etc) passes the prefix check.
		// We mirror the same guard used in executeRollback.
		try {
			if (existsSync(targetPath) && lstatSync(targetPath).isSymbolicLink()) {
				return {
					ok: false,
					error: {
						code: "WRITE_ERROR",
						message: `Symlink detected at update target: ${entry.path} — update rejected`,
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
						message: `Update path escaped workspace: ${entry.path}`,
						path: entry.path,
					},
				};
			}
		} catch (e) {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: `Failed to validate update target: ${sanitizeError(e)}`,
					path: entry.path,
				},
			};
		}

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
