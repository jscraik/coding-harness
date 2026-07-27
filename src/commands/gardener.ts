/**
 * Gardener CLI Command
 *
 * Detects stale docs and broken links without publishing a circular score.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { checkLinks } from "../lib/gardener/link-checker.js";
import { detectStaleDocs } from "../lib/gardener/stale-detector.js";
import {
	type BrokenLink,
	DEFAULT_STALE_DAYS,
	EXIT_CODES,
	type GardenerOptions,
	type GardenerOutput,
	type GardenerResult,
	type StaleDoc,
} from "../lib/gardener/types.js";
import { sanitizePathForDisplay } from "../lib/input/sanitize.js";

/**
 * Run gardener analysis and return structured result.
 * This function is usable as a library (does not output to console).
 */
export function runGardener(options: GardenerOptions): GardenerResult {
	const docsPath = resolve(options.docsPath ?? "docs");
	const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS;

	// Check if docs directory exists
	if (!existsSync(docsPath)) {
		return {
			ok: false,
			error: {
				code: "DOCS_PATH_NOT_FOUND",
				message: `Docs directory not found: ${sanitizePathForDisplay(docsPath)}`,
			},
		};
	}

	try {
		// Detect stale documents
		const staleDocs: StaleDoc[] = detectStaleDocs(docsPath, staleDays);

		// Check for broken links
		const brokenLinks: BrokenLink[] = checkLinks(docsPath);

		// Determine if PR is needed
		const needsPR = staleDocs.length > 0 || brokenLinks.length > 0;

		const output: GardenerOutput = {
			staleDocs,
			brokenLinks,
			needsPR,
		};

		return {
			ok: true,
			output,
		};
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: error instanceof Error ? error.message : "Unknown error",
			},
		};
	}
}

/**
 * Format a list with truncation (show first N, then ellipsis).
 */
function formatTruncatedList<T>(
	items: T[],
	format: (item: T) => string,
	max = 5,
): string[] {
	const lines = items.slice(0, max).map(format);
	if (items.length > max) {
		lines.push(`  ... and ${items.length - max} more`);
	}
	return lines;
}

/**
 * CLI entry point with console output formatting and exit codes.
 */
export function runGardenerCLI(options: GardenerOptions): number {
	const result = runGardener(options);

	if (result.ok) {
		const output = result.output;
		const exitCode = output.needsPR
			? EXIT_CODES.ISSUES_FOUND
			: EXIT_CODES.SUCCESS;
		renderGardenerSuccess(result, options);
		return exitCode;
	}

	renderGardenerError(result.error, Boolean(options.json));
	return gardenerErrorExitCode(result.error.code);
}

/** Render a successful documentation scan without claiming publication work. */
function renderGardenerSuccess(
	result: Extract<GardenerResult, { ok: true }>,
	options: GardenerOptions,
): void {
	if (options.json) {
		console.info(JSON.stringify(result.output, null, 2));
		return;
	}

	const output = result.output;
	console.info("\n📊 Summary:");
	console.info(`  Docs path: ${options.docsPath ?? "docs"}`);
	console.info(`  Stale docs: ${output.staleDocs.length}`);
	console.info(`  Broken links: ${output.brokenLinks.length}`);
	renderStaleDocs(output.staleDocs);
	renderBrokenLinks(output.brokenLinks);
	renderGardenerCompletion(output, Boolean(options.dryRun));
	console.info("");
}

/** Print bounded stale-document diagnostics for interactive CLI users. */
function renderStaleDocs(staleDocs: StaleDoc[]): void {
	if (staleDocs.length === 0) return;
	console.info("\n📄 Stale Documents:");
	const lines = formatTruncatedList(staleDocs, (doc) =>
		doc.daysSinceValidation === Number.POSITIVE_INFINITY
			? `  - ${doc.path} (never validated)`
			: `  - ${doc.path} (${doc.daysSinceValidation} days)`,
	);
	for (const line of lines) console.info(line);
}

function renderBrokenLinks(brokenLinks: BrokenLink[]): void {
	if (brokenLinks.length === 0) return;
	console.info("\n🔗 Broken Links:");
	const lines = formatTruncatedList(brokenLinks, (link) => {
		const status = link.statusCode ? ` [${link.statusCode}]` : "";
		return `  - ${link.file}: ${link.link}${status}`;
	});
	for (const line of lines) console.info(line);
}

/** Describe the scan result while preserving dry-run and follow-up boundaries. */
function renderGardenerCompletion(
	output: GardenerOutput,
	dryRun: boolean,
): void {
	if (output.needsPR) {
		console.info("\n✅ Documentation scan completed");
		if (!dryRun) {
			console.info(
				"   Issues detected. Manual review and fixes may be required.",
			);
		}
	}
}

function renderGardenerError(
	error: Extract<GardenerResult, { ok: false }>["error"],
	json: boolean,
): void {
	if (json) {
		console.error(JSON.stringify({ error }));
		return;
	}
	console.error(error.message);
}

function gardenerErrorExitCode(errorCode: string): number {
	return errorCode === "DOCS_PATH_NOT_FOUND"
		? EXIT_CODES.FILE_NOT_FOUND
		: EXIT_CODES.SYSTEM_ERROR;
}

// Re-export types and constants for external use
export {
	EXIT_CODES,
	type GardenerOptions,
	type GardenerOutput,
	type GardenerResult,
};
