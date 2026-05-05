/**
 * Silent error detection command
 *
 * Detects silent error handling anti-patterns in code.
 */

import { runSilentErrorDetector } from "../lib/silent-error/detector.js";
import {
	EXIT_CODES,
	type SilentErrorDetectorOptions,
} from "../lib/silent-error/types.js";

export { runSilentErrorDetector, EXIT_CODES };
export type { SilentErrorDetectorOptions };

/**
 * CLI entry point for silent error detection
 */
export function runSilentErrorDetectorCLI(
	options: SilentErrorDetectorOptions,
): number {
	const result = runSilentErrorDetector(options);

	if (options.json) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		// Print summary header
		const statusIcon = result.passed ? "✓" : "✗";
		const statusText = result.passed ? "PASSED" : "FAILED";
		console.log(`${statusIcon} Silent error detection ${statusText}`);
		console.log();

		if (result.detections.length > 0) {
			// Group by file
			const byFile = new Map<string, typeof result.detections>();
			for (const d of result.detections) {
				const existing = byFile.get(d.file) ?? [];
				existing.push(d);
				byFile.set(d.file, existing);
			}

			for (const [file, detections] of byFile) {
				console.log(`📁 ${file}`);
				for (const d of detections) {
					const icon = d.severity === "error" ? "✗" : "⚠";
					console.log(
						`  ${icon} Line ${d.line}:${d.column} - ${d.description}`,
					);
					console.log(`     ${d.snippet.slice(0, 60)}...`);
					if (options.suggestions && d.suggestion) {
						console.log(`     💡 ${d.suggestion}`);
					}
				}
				console.log();
			}
		}

		console.log(`Summary: ${result.filesAnalyzed} files analyzed`);
		console.log(
			`  ${result.summary.errors} errors, ${result.summary.warnings} warnings`,
		);

		// Show breakdown by type if any found
		if (result.summary.total > 0) {
			console.log("  By type:");
			for (const [type, count] of Object.entries(result.summary.byType)) {
				if (count > 0) {
					console.log(`    - ${type}: ${count}`);
				}
			}
		}
	}

	return result.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.SILENT_ERRORS_FOUND;
}
