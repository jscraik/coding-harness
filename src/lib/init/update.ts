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

import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import semver from "semver";
import { mergeContracts } from "../contract/merger.js";
import type { HarnessContract } from "../contract/types.js";
import { sanitizeError } from "../input/sanitize.js";
import { getVersion } from "../version.js";
import { CONTRACT_FILE, atomicWrite } from "./migration.js";
import { loadManifest, sanitizePath } from "./rollback.js";
import {
	createTemplateRenderContext,
	detectPackageManager,
	getTemplatesForProvider,
} from "./scaffold.js";
import {
	type CIProvider,
	HARNESS_DIR,
	type InitErrorOutput,
	MANIFEST_FILE,
	type RestoreManifest,
	type UpdateCheckResult,
	type UpdateResult,
} from "./types.js";

const PROTECTED_CONTRACT_KEYS = [
	"ciProviderPolicy",
	"contextIntegrityPolicy",
	"docsGatePolicy",
	"mergeQueueEvidenceBinding",
] as const;

function parseContractRecord(
	content: string,
	path: string,
	label: string,
):
	| { ok: true; value: Record<string, unknown> }
	| {
			ok: false;
			error: InitErrorOutput;
	  } {
	try {
		const parsed = JSON.parse(content) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {
				ok: false,
				error: {
					code: "WRITE_ERROR",
					message: `${label} contract must be a JSON object`,
					path,
				},
			};
		}

		return {
			ok: true,
			value: parsed as Record<string, unknown>,
		};
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to parse ${label} contract JSON: ${sanitizeError(error)}`,
				path,
			},
		};
	}
}

function prepareContractRefresh(
	targetPath: string,
	renderedContent: string,
): { ok: true; value: string } | { ok: false; error: InitErrorOutput } {
	const existingContract = parseContractRecord(
		readFileSync(targetPath, "utf-8"),
		CONTRACT_FILE,
		"existing",
	);
	if (!existingContract.ok) {
		return existingContract;
	}

	const renderedContract = parseContractRecord(
		renderedContent,
		CONTRACT_FILE,
		"rendered",
	);
	if (!renderedContract.ok) {
		return renderedContract;
	}

	const existingVersion =
		typeof existingContract.value.version === "string"
			? existingContract.value.version
			: null;
	const renderedVersion =
		typeof renderedContract.value.version === "string"
			? renderedContract.value.version
			: null;
	if (
		existingVersion &&
		renderedVersion &&
		semver.valid(existingVersion) &&
		semver.valid(renderedVersion) &&
		semver.gt(existingVersion, renderedVersion)
	) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Update would downgrade ${CONTRACT_FILE} from v${existingVersion} to v${renderedVersion}. Use \`harness upgrade --dry-run\` to preview a safe upgrade path instead.`,
				path: CONTRACT_FILE,
			},
		};
	}

	const mergedContract = mergeContracts(
		renderedContract.value as unknown as HarnessContract,
		existingContract.value as unknown as Partial<HarnessContract>,
	) as unknown as Record<string, unknown>;
	if (renderedVersion) {
		mergedContract.version = renderedVersion;
	}

	const removedProtectedKeys = PROTECTED_CONTRACT_KEYS.filter((key) => {
		return (
			Object.prototype.hasOwnProperty.call(existingContract.value, key) &&
			!Object.prototype.hasOwnProperty.call(mergedContract, key)
		);
	});
	if (removedProtectedKeys.length > 0) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Update would remove protected contract keys (${removedProtectedKeys.join(", ")}). Use \`harness upgrade --dry-run\` to preview a safe upgrade path instead.`,
				path: CONTRACT_FILE,
			},
		};
	}

	return { ok: true, value: JSON.stringify(mergedContract, null, 2) };
}

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
		let content = template.render(packageManager, renderContext);
		if (entry.path === CONTRACT_FILE) {
			const contractRefreshResult = prepareContractRefresh(targetPath, content);
			if (!contractRefreshResult.ok) {
				return contractRefreshResult;
			}
			content = contractRefreshResult.value;
		}
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
