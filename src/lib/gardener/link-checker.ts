/**
 * Link Checker Integration
 *
 * Integrates with lychee (Rust-based link checker) to detect broken links
 * in documentation files.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { validatePath } from "../input/sanitize.js";
import type { BrokenLink } from "./types.js";

/**
 * Interface for lychee JSON report structure
 */
interface LycheeReport {
	fail_map?: Record<
		string,
		Array<{ url: string; status_code?: number; error?: string }>
	>;
}

/**
 * Default lychee output file
 */
const LYCHEE_REPORT_FILE = "lychee-report.json";

/**
 * Check if lychee is available in the system
 */
export function isLycheeAvailable(): boolean {
	const result = spawnSync("lychee", ["--version"], {
		encoding: "utf-8",
		timeout: 5000,
	});
	return result.status === 0;
}

/**
 * Check links in documentation files using lychee
 *
 * @param basePath - Path to the docs directory
 * @returns Array of broken links found
 */
export function checkLinks(basePath: string): BrokenLink[] {
	const brokenLinks: BrokenLink[] = [];

	// Check if lychee is available
	if (!isLycheeAvailable()) {
		console.warn("Lychee not found. Skipping link checking.");
		console.warn("Install lychee: https://lychee.cli.rs/#installation");
		return brokenLinks;
	}

	// Validate and sanitize the path (throws on failure for caller to handle)
	const validatedPath = validatePath(process.cwd(), basePath);

	if (!existsSync(validatedPath)) {
		return brokenLinks;
	}

	const reportPath = join(process.cwd(), LYCHEE_REPORT_FILE);

	try {
		// Re-validate path immediately before use to minimize TOCTOU window
		const realValidatedPath = realpathSync(validatedPath);
		const realCwd = realpathSync(process.cwd());
		if (!realValidatedPath.startsWith(realCwd)) {
			throw new Error("Path traversal detected");
		}

		// Run lychee with JSON output
		const result = spawnSync(
			"lychee",
			[
				"--format",
				"json",
				"--output",
				reportPath,
				"--config",
				".lychee.toml",
				realValidatedPath,
			],
			{
				encoding: "utf-8",
				timeout: 120000, // 2 minutes max
				cwd: process.cwd(),
			},
		);

		// Lychee returns non-zero when broken links are found
		// We still want to parse the report in that case
		if (result.error) {
			console.error("Lychee execution error:", result.error.message);
			return brokenLinks;
		}

		// Read and parse the JSON report
		if (!existsSync(reportPath)) {
			return brokenLinks;
		}

		const reportContent = readFileSync(reportPath, "utf-8");
		const report: LycheeReport = JSON.parse(reportContent);

		if (report.fail_map) {
			for (const [file, links] of Object.entries(report.fail_map)) {
				for (const link of links) {
					const brokenLink: BrokenLink = {
						file: file
							.replace(`${realValidatedPath}/`, "")
							.replace(realValidatedPath, ""),
						link: link.url,
						statusCode: link.status_code ?? null,
					};
					if (link.error) {
						brokenLink.error = link.error;
					}
					brokenLinks.push(brokenLink);
				}
			}
		}

		return brokenLinks;
	} catch (error) {
		console.error("Link checking failed:", error);
		return brokenLinks;
	} finally {
		// Clean up report file
		if (existsSync(reportPath)) {
			try {
				unlinkSync(reportPath);
			} catch {
				// Ignore cleanup errors
			}
		}
	}
}

/**
 * Get a summary of link check results
 */
export function getLinkCheckSummary(brokenLinks: BrokenLink[]): {
	totalBroken: number;
	filesAffected: number;
	errorTypes: Record<string, number>;
} {
	const filesAffected = new Set(brokenLinks.map((l) => l.file));
	const errorTypes: Record<string, number> = {};

	for (const link of brokenLinks) {
		const errorType =
			link.error ?? (link.statusCode ? `HTTP ${link.statusCode}` : "Unknown");
		errorTypes[errorType] = (errorTypes[errorType] ?? 0) + 1;
	}

	return {
		totalBroken: brokenLinks.length,
		filesAffected: filesAffected.size,
		errorTypes,
	};
}
