import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import type { DetectionResult } from "../project-type/types.js";
import { getVersion } from "../version.js";
import { CONTRACT_FILE, atomicWrite } from "./migration.js";
import { createBackup, sanitizePath } from "./rollback.js";
import {
	TEMPLATES,
	getToolingVersionDecision,
	shouldAutoUpdateTemplate,
} from "./scaffold.js";
import type { Template, TemplateRenderContext } from "./types.js";
import {
	BACKUPS_DIR,
	type CIProvider,
	HARNESS_DIR,
	type InitOptions,
	type InitResult,
	MANIFEST_FILE,
	type ManifestEntry,
} from "./types.js";

/**
 * Sanitize all target paths before creating directories or writing files.
 */
export function sanitizeInstallPaths(
	dir: string,
	templates: Template[],
	options: InitOptions,
): {
	sanitizedTemplatePaths: Map<string, string>;
	sanitizedHarnessDir: string | null;
	sanitizedBackupsDir: string | null;
	sanitizedManifestPath: string | null;
	error?: InitResult;
} {
	const sanitizedTemplatePaths = new Map<string, string>();
	let sanitizedHarnessDir: string | null = null;
	let sanitizedBackupsDir: string | null = null;
	let sanitizedManifestPath: string | null = null;
	const trackingEnabled = options.track && !options.dryRun;

	for (const template of templates) {
		const pathResult = sanitizePath(dir, template.path);
		if (!pathResult.ok) {
			return {
				sanitizedTemplatePaths,
				sanitizedHarnessDir,
				sanitizedBackupsDir,
				sanitizedManifestPath,
				error: pathResult,
			};
		}
		sanitizedTemplatePaths.set(template.path, pathResult.value);
	}

	if (trackingEnabled) {
		const harnessDirResult = sanitizePath(dir, HARNESS_DIR);
		if (!harnessDirResult.ok) {
			return {
				sanitizedTemplatePaths,
				sanitizedHarnessDir,
				sanitizedBackupsDir,
				sanitizedManifestPath,
				error: harnessDirResult,
			};
		}
		sanitizedHarnessDir = harnessDirResult.value;

		const backupsDirResult = sanitizePath(dir, `${HARNESS_DIR}/${BACKUPS_DIR}`);
		if (!backupsDirResult.ok) {
			return {
				sanitizedTemplatePaths,
				sanitizedHarnessDir,
				sanitizedBackupsDir,
				sanitizedManifestPath,
				error: backupsDirResult,
			};
		}
		sanitizedBackupsDir = backupsDirResult.value;

		const manifestPathResult = sanitizePath(
			dir,
			`${HARNESS_DIR}/${MANIFEST_FILE}`,
		);
		if (!manifestPathResult.ok) {
			return {
				sanitizedTemplatePaths,
				sanitizedHarnessDir,
				sanitizedBackupsDir,
				sanitizedManifestPath,
				error: manifestPathResult,
			};
		}
		sanitizedManifestPath = manifestPathResult.value;
	}

	return {
		sanitizedTemplatePaths,
		sanitizedHarnessDir,
		sanitizedBackupsDir,
		sanitizedManifestPath,
	};
}

/**
 * Render and write templates, tracking changes for rollback if enabled.
 */
export function executeTemplateWrites(
	dir: string,
	templates: Template[],
	sanitizedTemplatePaths: Map<string, string>,
	options: InitOptions,
	packageManager: string,
	renderContext: TemplateRenderContext,
	manifestEntries: ManifestEntry[],
	created: string[],
	skipped: string[],
): InitResult | null {
	for (const template of templates) {
		const targetPath = sanitizedTemplatePaths.get(template.path);
		if (!targetPath) {
			return {
				ok: false,
				error: {
					code: "INVALID_PATH",
					message: `missing validated template path for ${template.path}`,
					path: template.path,
				},
			};
		}
		const exists = existsSync(targetPath);
		const autoUpdate =
			exists && shouldAutoUpdateTemplate(template.path, targetPath);

		const versionDecision =
			exists && !options.force
				? getToolingVersionDecision(template.path, targetPath)
				: "no_opinion";

		if (versionDecision === "skip") {
			skipped.push(template.path);
			continue;
		}

		const versionForcedUpdate = versionDecision === "force_update";

		if (exists && !options.force && !autoUpdate && !versionForcedUpdate) {
			skipped.push(template.path);
			continue;
		}

		if (options.dryRun) {
			created.push(template.path); // Track as "would create"
			continue;
		}

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
			manifestEntries.push({
				path: template.path,
				action: "created",
			});
		}

		const content = template.render(packageManager, renderContext);
		const writeResult = atomicWrite(targetPath, content);
		if (!writeResult.ok) {
			return writeResult;
		}

		created.push(template.path);
	}

	return null;
}

/**
 * Remove retired and legacy template files during force init.
 */
export function cleanupLegacyTemplates(
	dir: string,
	templates: Template[],
	options: InitOptions,
): InitResult | null {
	if (!(options.force && !options.dryRun)) {
		return null;
	}

	const removeIfPresent = (relativePath: string): InitResult | null => {
		const sanitizedPathResult = sanitizePath(dir, relativePath);
		if (!sanitizedPathResult.ok) {
			return sanitizedPathResult;
		}
		if (existsSync(sanitizedPathResult.value)) {
			rmSync(sanitizedPathResult.value, { force: true });
		}
		return null;
	};

	const activeTemplatePaths = new Set(
		templates.map((template) => template.path),
	);
	for (const retiredPath of [
		".github/ISSUE_TEMPLATE/issue.yml",
		".github/ISSUE_TEMPLATE/feature.yml",
		".github/ISSUE_TEMPLATE/security.yml",
	]) {
		const removeResult = removeIfPresent(retiredPath);
		if (removeResult) {
			return removeResult;
		}
	}
	for (const template of TEMPLATES) {
		if (activeTemplatePaths.has(template.path)) {
			continue;
		}
		const removeResult = removeIfPresent(template.path);
		if (removeResult) {
			return removeResult;
		}
	}

	return null;
}

/**
 * Atomically patch the projectType field in an existing contract.
 */
export function patchContractProjectType(
	dir: string,
	options: InitOptions,
	created: string[],
	skipped: string[],
): InitResult | null {
	if (!options.projectType || options.dryRun) {
		return null;
	}

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
			if (!created.includes(CONTRACT_FILE)) {
				created.push(CONTRACT_FILE);
				const skipIdx = skipped.indexOf(CONTRACT_FILE);
				if (skipIdx !== -1) skipped.splice(skipIdx, 1);
			}
		} catch {
			// Malformed JSON — skip the patch; contract will be regenerated on next --force init
		}
	}

	return null;
}

/**
 * Serialize and write the rollback manifest when tracking is enabled.
 */
export function writeTrackingManifest(
	sanitizedManifestPath: string | null,
	options: InitOptions,
	ciProvider: CIProvider,
	manifestEntries: ManifestEntry[],
): InitResult | null {
	const trackingEnabled = options.track && !options.dryRun;
	if (!trackingEnabled || manifestEntries.length === 0) {
		return null;
	}

	if (!sanitizedManifestPath) {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: "missing validated manifest path",
				path: MANIFEST_FILE,
			},
		};
	}
	const manifest: import("./types.js").RestoreManifest = {
		harnessVersion: getVersion(),
		ciProvider,
		...(options.minimal ? { minimal: true } : {}),
		...(options.issueTracker
			? { issueTracker: options.issueTracker }
			: options.minimal
				? { issueTracker: "none" }
				: {}),
		files: manifestEntries,
	};
	const manifestResult = atomicWrite(
		sanitizedManifestPath,
		JSON.stringify(manifest, null, 2),
	);
	if (!manifestResult.ok) {
		return manifestResult;
	}

	return null;
}

/**
 * Execute a normal (non-mode) install: sanitize paths, write templates, cleanup, manifest.
 */
export function executeNormalInstall(
	dir: string,
	templates: Template[],
	options: InitOptions,
	packageManager: string,
	renderContext: TemplateRenderContext,
	ciProvider: CIProvider,
	detectionResult: DetectionResult,
): InitResult {
	const created: string[] = [];
	const skipped: string[] = [];
	const manifestEntries: ManifestEntry[] = [];
	const trackingEnabled = options.track && !options.dryRun;

	const pathResult = sanitizeInstallPaths(dir, templates, options);
	if (pathResult.error) {
		return pathResult.error;
	}
	const {
		sanitizedTemplatePaths,
		sanitizedHarnessDir,
		sanitizedBackupsDir,
		sanitizedManifestPath,
	} = pathResult;

	if (trackingEnabled) {
		if (
			!sanitizedHarnessDir ||
			!sanitizedBackupsDir ||
			!sanitizedManifestPath
		) {
			return {
				ok: false,
				error: {
					code: "INVALID_PATH",
					message: "missing validated tracking paths",
					path: HARNESS_DIR,
				},
			};
		}
		mkdirSync(sanitizedHarnessDir, { recursive: true });
		mkdirSync(sanitizedBackupsDir, { recursive: true });
	}

	const writeResult = executeTemplateWrites(
		dir,
		templates,
		sanitizedTemplatePaths,
		options,
		packageManager,
		renderContext,
		manifestEntries,
		created,
		skipped,
	);
	if (writeResult) {
		return writeResult;
	}

	const cleanupResult = cleanupLegacyTemplates(dir, templates, options);
	if (cleanupResult) {
		return cleanupResult;
	}

	const patchResult = patchContractProjectType(dir, options, created, skipped);
	if (patchResult) {
		return patchResult;
	}

	const manifestWriteResult = writeTrackingManifest(
		sanitizedManifestPath,
		options,
		ciProvider,
		manifestEntries,
	);
	if (manifestWriteResult) {
		return manifestWriteResult;
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
