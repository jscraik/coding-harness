import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { atomicWrite } from "../init/migration.js";
import {
	createTemplateRenderContext,
	detectPackageManager,
	getTemplatesForProvider,
} from "../init/scaffold.js";
import { type CIProvider, HARNESS_DIR } from "../init/types.js";
import {
	UPGRADE_MANIFEST_FILE,
	type UpgradeManifest,
	type UpgradeManifestEntry,
	buildUpgradeManifest,
	classifyFiles,
	fingerprintContent,
} from "../init/upgrade.js";
import { sanitizeError } from "../input/sanitize.js";

/** Result of applying upgrade template updates. */
export interface TemplateUpgradeResult {
	updated: string[];
	skipped: string[];
	forced: string[];
}

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

/** Read the tracked upgrade manifest when a downstream install has one. */
export function readUpgradeManifest(targetDir: string): UpgradeManifest | null {
	const path = resolve(targetDir, HARNESS_DIR, UPGRADE_MANIFEST_FILE);
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as UpgradeManifest;
	} catch (err) {
		throw new Error(`Could not parse ${path}: ${sanitizeError(err)}`);
	}
}

/** Apply tracked template upgrades while preserving customized downstream files. */
export function upgradeTemplates(
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
			result.skipped.push(template.path);
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

	return persistUpgradeManifest(targetDir, newEntries, dryRun, result);
}

function persistUpgradeManifest(
	targetDir: string,
	newEntries: Array<{ path: string; content: string }>,
	dryRun: boolean,
	result: TemplateUpgradeResult,
): { ok: true; value: TemplateUpgradeResult } | { ok: false; error: string } {
	if (dryRun || newEntries.length === 0) {
		return { ok: true, value: result };
	}
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
	return { ok: true, value: result };
}

/** Print terminal output summarizing template upgrade work. */
export function printTemplateUpgradeSummary(
	result: TemplateUpgradeResult,
	dryRun: boolean,
): void {
	const { updated, skipped, forced } = result;
	const prefix = dryRun ? "[DRY RUN] " : "";
	if (updated.length > 0) {
		console.info(`${prefix}Updated ${updated.length} stock template(s):`);
		for (const filePath of updated) {
			console.info(`  ✓ ${filePath}`);
		}
	}
	if (forced.length > 0) {
		console.info(`${prefix}Force-updated ${forced.length} customized file(s):`);
		for (const filePath of forced) {
			console.info(`  ⚠️  ${filePath}`);
		}
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
}
