/**
 * JSC-66: Version-aware upgrade path.
 *
 * Provides:
 * - Template fingerprinting (stock vs customized detection)
 * - Upgrade context detection (fromVersion → toVersion)
 * - Per-file change classification
 * - Upgrade summary formatting
 *
 * This module has no side effects — all writes are in update.ts / rollback.ts.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import semver from "semver";
import { getVersion } from "../version.js";
import { loadManifest } from "./rollback.js";
import { HARNESS_DIR, MANIFEST_FILE } from "./types.js";

// ─── Template fingerprinting ──────────────────────────────────────────────────

/**
 * SHA-256 hash of file content, used to detect stock-vs-customized files.
 */
export function fingerprintContent(content: string): string {
	return createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Read a file from disk and return its fingerprint, or null if absent.
 */
export function fingerprintFile(absPath: string): string | null {
	if (!existsSync(absPath)) return null;
	try {
		return fingerprintContent(readFileSync(absPath, "utf-8"));
	} catch {
		return null;
	}
}

// ─── Upgrade manifest entry ───────────────────────────────────────────────────

/**
 * Extended manifest entry for upgrade-aware tracking.
 * Written alongside the restore-manifest at init time.
 */
export interface UpgradeManifestEntry {
	/** Repo-relative file path */
	path: string;
	/** SHA-256 of the template content at install/update time */
	templateHash: string;
	/** Harness version that generated this template */
	version: string;
	/** True if the on-disk file hash differs from templateHash */
	customized: boolean;
}

export interface UpgradeManifest {
	schemaVersion: "upgrade-manifest/v1";
	/** Harness version that last updated this manifest */
	harnessVersion: string;
	/** ISO timestamp */
	updatedAt: string;
	files: UpgradeManifestEntry[];
}

export const UPGRADE_MANIFEST_FILE = "upgrade-manifest.json";

// ─── File classification ──────────────────────────────────────────────────────

export type FileStatus = "stock" | "customized" | "absent" | "untracked";

export interface FileClassification {
	path: string;
	status: FileStatus;
	onDiskHash: string | null;
	templateHash: string | null;
}

/**
 * Classify each file tracked in the upgrade manifest as stock/customized/absent.
 * Files on disk that are not in the manifest are "untracked".
 */
export function classifyFiles(
	targetDir: string,
	manifest: UpgradeManifest,
): FileClassification[] {
	const results: FileClassification[] = [];
	for (const entry of manifest.files) {
		const absPath = resolve(targetDir, entry.path);
		const onDiskHash = fingerprintFile(absPath);
		let status: FileStatus;
		if (onDiskHash === null) {
			status = "absent";
		} else if (onDiskHash === entry.templateHash) {
			status = "stock";
		} else {
			status = "customized";
		}
		results.push({
			path: entry.path,
			status,
			onDiskHash,
			templateHash: entry.templateHash,
		});
	}
	return results;
}

// ─── Upgrade context detection ────────────────────────────────────────────────

export interface UpgradeContext {
	/** Harness version from the existing restore-manifest or upgrade-manifest */
	fromVersion: string;
	/** Current harness version */
	toVersion: string;
	/** True when toVersion > fromVersion (semver) */
	upgradeNeeded: boolean;
	/** True when toVersion < fromVersion (downgrade) */
	downgradeDetected: boolean;
	/** Files classified as customized (on-disk hash ≠ template hash) */
	customizedFiles: string[];
	/** Files classified as absent (tracked but deleted) */
	absentFiles: string[];
	/** Path to the upgrade manifest (may not exist yet) */
	upgradeManifestPath: string;
	/** Whether an upgrade-manifest.json exists */
	hasUpgradeManifest: boolean;
}

/**
 * JSC-66: Detect the upgrade context from an existing harness installation.
 *
 * Reads the restore-manifest for the installed version, then cross-checks
 * the upgrade-manifest (if it exists) to classify stock vs customized files.
 */
export function detectUpgradeContext(targetDir: string): {
	ok: true;
	value: UpgradeContext;
} | {
	ok: false;
	error: string;
} {
	const upgradeManifestPath = resolve(
		targetDir,
		HARNESS_DIR,
		UPGRADE_MANIFEST_FILE,
	);
	const toVersion = getVersion();

	// Read from restore-manifest for installed version
	const manifestResult = loadManifest(targetDir);
	const fromVersion = manifestResult.ok
		? manifestResult.value.harnessVersion ?? "0.0.0"
		: "0.0.0";

	if (!semver.valid(fromVersion)) {
		return {
			ok: false,
			error: `Invalid installed version in manifest: "${fromVersion}"`,
		};
	}
	if (!semver.valid(toVersion)) {
		return {
			ok: false,
			error: `Invalid current harness version: "${toVersion}"`,
		};
	}

	const upgradeNeeded = semver.gt(toVersion, fromVersion);
	const downgradeDetected = semver.lt(toVersion, fromVersion);

	// Load upgrade manifest if present to classify files
	let customizedFiles: string[] = [];
	let absentFiles: string[] = [];
	const hasUpgradeManifest = existsSync(upgradeManifestPath);

	if (hasUpgradeManifest) {
		try {
			const upgradeManifest = JSON.parse(
				readFileSync(upgradeManifestPath, "utf-8"),
			) as UpgradeManifest;
			const classifications = classifyFiles(targetDir, upgradeManifest);
			customizedFiles = classifications
				.filter((c) => c.status === "customized")
				.map((c) => c.path);
			absentFiles = classifications
				.filter((c) => c.status === "absent")
				.map((c) => c.path);
		} catch {
			// Best-effort — upgrade-manifest may be malformed
		}
	}

	return {
		ok: true,
		value: {
			fromVersion,
			toVersion,
			upgradeNeeded,
			downgradeDetected,
			customizedFiles,
			absentFiles,
			upgradeManifestPath,
			hasUpgradeManifest,
		},
	};
}

// ─── Upgrade manifest writer ──────────────────────────────────────────────────

/**
 * Build an UpgradeManifest from a set of template writes.
 * Call this during `harness init --track` and `harness upgrade` to record
 * template fingerprints alongside the restore-manifest.
 */
export function buildUpgradeManifest(
	entries: Array<{ path: string; content: string }>,
): UpgradeManifest {
	const version = getVersion();
	return {
		schemaVersion: "upgrade-manifest/v1",
		harnessVersion: version,
		updatedAt: new Date().toISOString(),
		files: entries.map(({ path, content }) => ({
			path,
			templateHash: fingerprintContent(content),
			version,
			customized: false, // always false at write time
		})),
	};
}

// ─── Upgrade summary formatter ────────────────────────────────────────────────

/**
 * Format a human-readable upgrade context notice for the CLI.
 */
export function formatUpgradeSummary(ctx: UpgradeContext): string {
	const lines: string[] = [];

	if (ctx.downgradeDetected) {
		lines.push(
			`⚠️  DOWNGRADE DETECTED: installed=${ctx.fromVersion} → current=${ctx.toVersion}`,
		);
		lines.push(
			"   This may overwrite files with older templates. Use --commit-mode=enterprise to abort.",
		);
	} else if (ctx.upgradeNeeded) {
		lines.push(
			`🔄 UPGRADE READY: ${ctx.fromVersion} → ${ctx.toVersion}`,
		);
	} else {
		lines.push(`✅ Already at ${ctx.toVersion} — no template changes needed.`);
		return lines.join("\n");
	}

	if (!ctx.hasUpgradeManifest) {
		lines.push("");
		lines.push(
			"   ℹ️  No upgrade-manifest.json found. Run `harness init --track` first to enable",
		);
		lines.push(
			"      stock-vs-customized tracking for future upgrades.",
		);
	} else {
		if (ctx.customizedFiles.length > 0) {
			lines.push("");
			lines.push(
				`   ✏️  ${ctx.customizedFiles.length} customized file(s) — will NOT be auto-updated:`,
			);
			for (const f of ctx.customizedFiles) {
				lines.push(`     - ${f}`);
			}
			lines.push(
				"   Review these manually or re-run with --force-update to overwrite.",
			);
		}
		if (ctx.absentFiles.length > 0) {
			lines.push("");
			lines.push(
				`   🗑️  ${ctx.absentFiles.length} tracked file(s) no longer on disk:`,
			);
			for (const f of ctx.absentFiles) {
				lines.push(`     - ${f}`);
			}
		}
	}

	lines.push("");
	lines.push("   To upgrade:");
	lines.push(
		"     harness upgrade              — auto-update stock files, skip customized",
	);
	lines.push(
		"     harness upgrade --force      — overwrite all files including customized",
	);
	lines.push(
		"     harness upgrade --dry-run    — preview changes without writing",
	);
	lines.push("");

	return lines.join("\n");
}

// ─── Upgrade-detect integration for `harness init` ─────────────────────────

/**
 * Check whether the target directory looks like an existing harness installation.
 * Used by `harness init` to auto-detect upgrade mode.
 */
export function detectExistingInstall(targetDir: string): {
	isExistingInstall: boolean;
	/** Installed version (from manifest), null if fresh install */
	installedVersion: string | null;
	/** True when installed version < current CLI version */
	upgradeAvailable: boolean;
} {
	const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);
	if (!existsSync(manifestPath)) {
		return {
			isExistingInstall: false,
			installedVersion: null,
			upgradeAvailable: false,
		};
	}

	const manifestResult = loadManifest(targetDir);
	if (!manifestResult.ok) {
		// Manifest exists but is corrupted — still existing install
		return {
			isExistingInstall: true,
			installedVersion: null,
			upgradeAvailable: false,
		};
	}

	const installedVersion = manifestResult.value.harnessVersion ?? null;
	const currentVersion = getVersion();
	const upgradeAvailable =
		installedVersion !== null &&
		semver.valid(installedVersion) !== null &&
		semver.valid(currentVersion) !== null &&
		semver.gt(currentVersion, installedVersion);

	return { isExistingInstall: true, installedVersion, upgradeAvailable };
}
