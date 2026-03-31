/**
 * Interactive mode functions for init command.
 *
 * Provides user-interactive change approval:
 * - Collect proposed changes for review
 * - Generate unified diffs for display
 * - Apply approved changes
 *
 * @module lib/init/interactive
 */

import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { dirname } from "node:path";
import { diffLines } from "diff";
import { sanitizeError } from "../input/sanitize.js";
import { atomicWrite } from "./migration.js";
import { sanitizePath } from "./rollback.js";
import {
	createTemplateRenderContext,
	detectPackageManager,
	getTemplatesForProvider,
	shouldAutoUpdateTemplate,
	shouldSkipDueToNewerToolingVersion,
} from "./scaffold.js";
import {
	type CIProvider,
	type InitErrorOutput,
	type InitOptions,
	MAX_INTERACTIVE_FILE_BYTES,
	type ProposedChange,
} from "./types.js";

/**
 * Collect all proposed changes for interactive review.
 * Returns an array of changes with current/new content for diffing.
 */
export function collectProposedChanges(
	targetDir: string,
	options: InitOptions,
	ciProvider: CIProvider,
): ProposedChange[] {
	const packageManager = detectPackageManager(targetDir);
	const renderContext = createTemplateRenderContext(
		targetDir,
		ciProvider,
		undefined,
		options,
	);
	const templates = getTemplatesForProvider(ciProvider, options);
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

		// JSC-57: If existing tooling version is newer, treat as skip in interactive mode too
		if (
			exists &&
			!options.force &&
			shouldSkipDueToNewerToolingVersion(template.path, targetPath)
		) {
			proposed.push({
				path: template.path,
				action: "skip",
				currentContent: null,
				newContent,
			});
			continue;
		}

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
export function applyProposedChange(
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
