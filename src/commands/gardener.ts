/**
 * Gardener CLI Command
 *
 * Detects stale docs, broken links, and updates quality scores.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { checkLinks } from "../lib/gardener/link-checker.js";
import {
	calculateQualityScore,
	updateQualityScoreFile,
} from "../lib/gardener/quality-scorer.js";
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
				message: `Docs directory not found: ${docsPath}`,
			},
		};
	}

	try {
		// Detect stale documents
		const staleDocs: StaleDoc[] = detectStaleDocs(docsPath, staleDays);

		// Check for broken links
		const brokenLinks: BrokenLink[] = checkLinks(docsPath);

		// Calculate quality score
		const qualityScore = calculateQualityScore(staleDocs, brokenLinks);

		// Determine if PR is needed
		const needsPR = staleDocs.length > 0 || brokenLinks.length > 0;

		const output: GardenerOutput = {
			staleDocs,
			brokenLinks,
			qualityScore,
			needsPR,
		};

		// Update quality score file (always, even in dry-run)
		const updateResult = updateQualityScoreFile(
			docsPath,
			qualityScore,
			staleDocs,
			brokenLinks,
		);

		if (!updateResult.ok) {
			console.warn(
				`Warning: Failed to update quality score file: ${updateResult.error}`,
			);
		}

		return { ok: true, output };
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
 * CLI entry point with console output formatting and exit codes.
 */
export function runGardenerCLI(options: GardenerOptions): number {
	const result = runGardener(options);

	if (result.ok) {
		const output = result.output;

		// JSON output
		if (options.json) {
			console.info(JSON.stringify(result.output, null, 2));
		}

		// Human-readable console output
		console.info("\n📊 Summary:");
		console.info(`  Docs path: ${options.docsPath ?? "docs"}`);
		console.info(`  Stale docs: ${output.staleDocs.length}`);
		console.info(`  Broken links: ${output.brokenLinks.length}`);

		if (output.staleDocs.length > 0) {
			console.info("\n📄 Stale Documents:");
			for (const doc of output.staleDocs.slice(0, 5)) {
				if (doc.daysSinceValidation === Number.POSITIVE_INFINITY) {
					console.info(`  - ${doc.path} (never validated)`);
				} else {
					console.info(`  - ${doc.path} (${doc.daysSinceValidation} days)`);
				}
			}
			if (output.staleDocs.length > 5) {
				console.info(`  ... and ${output.staleDocs.length - 5} more`);
			}
		}

		if (output.brokenLinks.length > 0) {
			console.info("\n🔗 Broken Links:");
			for (const link of output.brokenLinks.slice(0, 5)) {
				const status = link.statusCode ? ` [${link.statusCode}]` : "";
				console.info(`  - ${link.file}: ${link.link}${status}`);
			}
			if (output.brokenLinks.length > 5) {
				console.info(`  ... and ${output.brokenLinks.length - 5} more`);
			}
		}

		if (options.dryRun) {
			console.info("\n[DRY-RUN] No PR would be created");
		} else if (output.needsPR) {
			console.info("\n✅ Quality score updated");
		}

		console.info("");

		// Return exit code based on issues found
		return output.needsPR ? EXIT_CODES.ISSUES_FOUND : EXIT_CODES.SUCCESS;
	}

	// Error output always to stderr
	console.error(result.error.message);
	if (options.json) {
		console.error(JSON.stringify({ error: result.error }));
	}

	// Map error codes to exit codes
	if (result.error.code === "DOCS_PATH_NOT_FOUND") {
		return EXIT_CODES.FILE_NOT_FOUND;
	}
	return EXIT_CODES.SYSTEM_ERROR;
}

// Re-export types and constants for external use
export {
	EXIT_CODES,
	type GardenerOptions,
	type GardenerOutput,
	type GardenerResult,
};
