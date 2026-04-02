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
import {
	loadManifest,
	resolveSafeWorkspaceSymlink,
	sanitizePath,
} from "./rollback.js";
import {
	createTemplateRenderContext,
	detectPackageManager,
	getTemplatesForProvider,
} from "./scaffold.js";
import {
	type CIProvider,
	HARNESS_DIR,
	type InitErrorOutput,
	type InitOptions,
	type IssueTracker,
	MANIFEST_FILE,
	type OwnershipDecision,
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIssueTracker(value: unknown): value is IssueTracker {
	return value === "linear" || value === "github" || value === "none";
}

function valuesEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function collectOwnershipDecisions(
	existingValue: Record<string, unknown>,
	renderedValue: Record<string, unknown>,
	mergedValue: Record<string, unknown>,
	basePath = "",
): OwnershipDecision[] {
	const decisions: OwnershipDecision[] = [];
	const keys = new Set([
		...Object.keys(existingValue),
		...Object.keys(renderedValue),
		...Object.keys(mergedValue),
	]);

	for (const key of keys) {
		const path = basePath ? `${basePath}.${key}` : key;
		const hasExisting = Object.prototype.hasOwnProperty.call(
			existingValue,
			key,
		);
		const hasRendered = Object.prototype.hasOwnProperty.call(
			renderedValue,
			key,
		);
		const existingEntry = existingValue[key];
		const renderedEntry = renderedValue[key];
		const mergedEntry = mergedValue[key];

		if (
			isPlainObject(mergedEntry) &&
			(isPlainObject(existingEntry) || isPlainObject(renderedEntry))
		) {
			decisions.push(
				...collectOwnershipDecisions(
					isPlainObject(existingEntry) ? existingEntry : {},
					isPlainObject(renderedEntry) ? renderedEntry : {},
					mergedEntry,
					path,
				),
			);
			continue;
		}

		if (
			!hasExisting &&
			hasRendered &&
			valuesEqual(mergedEntry, renderedEntry)
		) {
			decisions.push({
				file: CONTRACT_FILE,
				path,
				owner: "template",
				action: "added",
			});
			continue;
		}

		if (
			hasExisting &&
			!hasRendered &&
			valuesEqual(mergedEntry, existingEntry)
		) {
			decisions.push({
				file: CONTRACT_FILE,
				path,
				owner: "repo",
				action: "preserved",
			});
			continue;
		}

		if (
			!hasExisting ||
			!hasRendered ||
			valuesEqual(existingEntry, renderedEntry)
		) {
			continue;
		}

		if (valuesEqual(mergedEntry, existingEntry)) {
			decisions.push({
				file: CONTRACT_FILE,
				path,
				owner: "repo",
				action: "preserved",
			});
			continue;
		}

		if (valuesEqual(mergedEntry, renderedEntry)) {
			decisions.push({
				file: CONTRACT_FILE,
				path,
				owner: "template",
				action: "updated",
			});
		}
	}

	return decisions;
}

function prepareContractRefresh(
	targetPath: string,
	renderedContent: string,
):
	| {
			ok: true;
			value: { content: string; ownershipDecisions: OwnershipDecision[] };
	  }
	| { ok: false; error: InitErrorOutput } {
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
	const ownershipDecisions = collectOwnershipDecisions(
		existingContract.value,
		renderedContract.value,
		mergedContract,
	);

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

	return {
		ok: true,
		value: {
			content: JSON.stringify(mergedContract, null, 2),
			ownershipDecisions,
		},
	};
}

/**
 * Determine whether the project's init templates are out-of-date compared to the running CLI.
 *
 * @param preferredCiProvider - Optional preferred CI provider to pass to manifest loading which may influence manifest resolution.
 * @returns On success, an object containing `currentVersion` (CLI version), `installedVersion` (manifest's harnessVersion), and `updateAvailable` (`true` if `currentVersion` is greater than `installedVersion`, `false` otherwise). On failure, an error result describing the validation or manifest problem.
 */
export function checkForUpdates(
	targetDir: string,
	preferredCiProvider?: CIProvider,
): UpdateCheckResult {
	const manifestResult = loadManifest(targetDir, {
		requireMetadata: true,
		operation: "check-updates",
		...(preferredCiProvider !== undefined ? { preferredCiProvider } : {}),
	});
	if (!manifestResult.ok) {
		return manifestResult;
	}

	const currentVersion = getVersion();
	const installedVersion = manifestResult.value.harnessVersion;
	if (installedVersion === undefined) {
		return {
			ok: false,
			error: {
				code: "INCOMPLETE_MANIFEST",
				message:
					"Restore manifest is incomplete for check-updates: missing harnessVersion.",
				path: MANIFEST_FILE,
			},
		};
	}

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
 * Re-render tracked and new templates for a workspace, refresh the contracts file when applicable, and update the init manifest's harnessVersion.
 *
 * @returns On success, an object containing `updated` (paths that were written), `skipped` (paths that were not written), and `ownershipDecisions` (contract ownership decisions produced during refresh). On failure, an error result describing the write/validation failure.
 */
export function executeUpdate(
	targetDir: string,
	manifest: RestoreManifest,
	ciProvider: CIProvider,
): UpdateResult {
	const packageManager = detectPackageManager(targetDir);

	const extractedOptions: InitOptions = {
		dryRun: false,
		force: false,
		...(manifest.minimal === true ? { minimal: true } : {}),
	};

	if (manifest.issueTracker) {
		extractedOptions.issueTracker = manifest.issueTracker;
	}

	const contractPath = resolve(targetDir, CONTRACT_FILE);
	const tracksContract = manifest.files.some(
		(entry) => entry.path === CONTRACT_FILE,
	);
	if (!existsSync(contractPath)) {
		if (!tracksContract && manifest.files.length === 0) {
			const newManifest: RestoreManifest = {
				...manifest,
				harnessVersion: getVersion(),
				ciProvider,
				...(extractedOptions.minimal ? { minimal: true } : {}),
				...(extractedOptions.issueTracker
					? { issueTracker: extractedOptions.issueTracker }
					: {}),
			};
			const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);
			const manifestResult = atomicWrite(
				manifestPath,
				JSON.stringify(newManifest, null, 2),
			);
			if (!manifestResult.ok) {
				return manifestResult;
			}

			return {
				ok: true,
				value: { updated: [], skipped: [], ownershipDecisions: [] },
			};
		}

		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Update requires ${CONTRACT_FILE}; re-run \`harness init --track\` or restore the missing contract before updating.`,
				path: CONTRACT_FILE,
			},
		};
	}
	const rawContractResult = parseContractRecord(
		readFileSync(contractPath, "utf-8"),
		CONTRACT_FILE,
		"existing",
	);
	if (!rawContractResult.ok) {
		return {
			ok: false,
			error: rawContractResult.error,
		};
	}
	const rawContract = rawContractResult.value;
	const rawIssueTrackingPolicy =
		isPlainObject(rawContract) && isPlainObject(rawContract.issueTrackingPolicy)
			? rawContract.issueTrackingPolicy
			: undefined;
	const rawReviewPolicy =
		isPlainObject(rawContract) && isPlainObject(rawContract.reviewPolicy)
			? rawContract.reviewPolicy
			: undefined;
	const rawRemediationPolicy =
		isPlainObject(rawContract) && isPlainObject(rawContract.remediationPolicy)
			? rawContract.remediationPolicy
			: undefined;
	const rawProviderDefaults =
		rawRemediationPolicy && isPlainObject(rawRemediationPolicy.providerDefaults)
			? rawRemediationPolicy.providerDefaults
			: undefined;
	if (
		rawIssueTrackingPolicy &&
		isIssueTracker(rawIssueTrackingPolicy.provider)
	) {
		extractedOptions.issueTracker = rawIssueTrackingPolicy.provider;
	} else if (manifest.issueTracker) {
		extractedOptions.issueTracker = manifest.issueTracker;
	} else if (existsSync(resolve(targetDir, ".linear"))) {
		extractedOptions.issueTracker = "linear";
	} else if (
		existsSync(resolve(targetDir, ".github/ISSUE_TEMPLATE/config.yml"))
	) {
		extractedOptions.issueTracker = "github";
	} else {
		extractedOptions.issueTracker = "none";
	}

	if (!rawReviewPolicy && !rawProviderDefaults?.greptile) {
		extractedOptions.greptile = false;
	}

	const renderContext = createTemplateRenderContext(
		targetDir,
		ciProvider,
		undefined,
		extractedOptions,
	);
	const templates = getTemplatesForProvider(ciProvider, extractedOptions);
	const updated: string[] = [];
	const skipped: string[] = [];
	const ownershipDecisions: OwnershipDecision[] = [];
	const trackedPaths = new Set(manifest.files.map((entry) => entry.path));
	const nextManifestEntries = [...manifest.files];

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
			const symlinkPathResult = resolveSafeWorkspaceSymlink(
				targetDir,
				entry.path,
			);
			if (!symlinkPathResult.ok) {
				return pathResult;
			}
			const targetPath = symlinkPathResult.value;

			// SECURITY: keep rejecting escaping parent-directory hops even when the
			// tracked path is a safe in-repo symlink such as .mise.toml -> mise/config.toml.
			try {
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

			if (!existsSync(targetPath)) {
				skipped.push(entry.path);
				continue;
			}

			let content = template.render(packageManager, renderContext);
			if (entry.path === CONTRACT_FILE) {
				const contractRefreshResult = prepareContractRefresh(
					targetPath,
					content,
				);
				if (!contractRefreshResult.ok) {
					return contractRefreshResult;
				}
				content = contractRefreshResult.value.content;
				ownershipDecisions.push(
					...contractRefreshResult.value.ownershipDecisions,
				);
			}
			const writeResult = atomicWrite(targetPath, content);
			if (!writeResult.ok) {
				return writeResult;
			}

			updated.push(entry.path);
			continue;
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
			content = contractRefreshResult.value.content;
			ownershipDecisions.push(
				...contractRefreshResult.value.ownershipDecisions,
			);
		}
		const writeResult = atomicWrite(targetPath, content);
		if (!writeResult.ok) {
			return writeResult;
		}

		updated.push(entry.path);
	}

	for (const template of templates) {
		if (trackedPaths.has(template.path)) {
			continue;
		}

		const pathResult = sanitizePath(targetDir, template.path);
		if (!pathResult.ok) {
			return pathResult;
		}

		const targetPath = pathResult.value;
		if (existsSync(targetPath)) {
			skipped.push(template.path);
			continue;
		}

		let content = template.render(packageManager, renderContext);
		if (template.path === CONTRACT_FILE) {
			const contractRefreshResult = prepareContractRefresh(targetPath, content);
			if (!contractRefreshResult.ok) {
				return contractRefreshResult;
			}
			content = contractRefreshResult.value.content;
			ownershipDecisions.push(
				...contractRefreshResult.value.ownershipDecisions,
			);
		}

		const writeResult = atomicWrite(targetPath, content);
		if (!writeResult.ok) {
			return writeResult;
		}

		updated.push(template.path);
		nextManifestEntries.push({ path: template.path, action: "created" });
	}

	// Update manifest version
	const newManifest: RestoreManifest = {
		...manifest,
		harnessVersion: getVersion(),
		ciProvider,
		...(extractedOptions.minimal ? { minimal: true } : {}),
		...(extractedOptions.issueTracker
			? { issueTracker: extractedOptions.issueTracker }
			: {}),
		files: nextManifestEntries,
	};
	const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);
	const manifestResult = atomicWrite(
		manifestPath,
		JSON.stringify(newManifest, null, 2),
	);
	if (!manifestResult.ok) {
		return manifestResult;
	}

	return { ok: true, value: { updated, skipped, ownershipDecisions } };
}
