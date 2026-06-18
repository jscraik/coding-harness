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

type SilentErrorResult = ReturnType<typeof runSilentErrorDetector>;
type SilentErrorDetection = SilentErrorResult["detections"][number];

function detectionsByFile(
	detections: SilentErrorDetection[],
): Map<string, SilentErrorDetection[]> {
	const byFile = new Map<string, SilentErrorDetection[]>();
	for (const detection of detections) {
		const existing = byFile.get(detection.file) ?? [];
		existing.push(detection);
		byFile.set(detection.file, existing);
	}
	return byFile;
}

function printHeader(passed: boolean): void {
	const statusIcon = passed ? "✓" : "✗";
	const statusText = passed ? "PASSED" : "FAILED";
	console.log(`${statusIcon} Silent error detection ${statusText}`);
	console.log();
}

function printDetection(
	detection: SilentErrorDetection,
	showSuggestions: boolean | undefined,
): void {
	const icon = detection.severity === "error" ? "✗" : "⚠";
	console.log(
		`  ${icon} Line ${detection.line}:${detection.column} - ${detection.description}`,
	);
	console.log(`     ${detection.snippet.slice(0, 60)}...`);
	if (showSuggestions && detection.suggestion) {
		console.log(`     💡 ${detection.suggestion}`);
	}
}

function printDetections(
	result: SilentErrorResult,
	showSuggestions?: boolean,
): void {
	for (const [file, detections] of detectionsByFile(result.detections)) {
		console.log(`📁 ${file}`);
		for (const detection of detections) {
			printDetection(detection, showSuggestions);
		}
		console.log();
	}
}

function printSummary(result: SilentErrorResult): void {
	console.log(`Summary: ${result.filesAnalyzed} files analyzed`);
	console.log(
		`  ${result.summary.errors} errors, ${result.summary.warnings} warnings`,
	);
	if (result.summary.total === 0) {
		return;
	}
	console.log("  By type:");
	for (const [type, count] of Object.entries(result.summary.byType)) {
		if (count > 0) {
			console.log(`    - ${type}: ${count}`);
		}
	}
}

function printHumanResult(
	result: SilentErrorResult,
	options: SilentErrorDetectorOptions,
): void {
	printHeader(result.passed);
	if (result.detections.length > 0) {
		printDetections(result, options.suggestions);
	}
	printSummary(result);
}

/**
 * Run the silent error detector and print the results to stdout.
 *
 * Runs the detector with the provided options and formats output either as
 * pretty JSON (when `options.json` is true) or as a human-readable report that
 * includes a pass/fail header, per-file grouped detections, per-detection
 * location, description, a 60-character snippet, optional suggestions, and a
 * summary with counts by severity and type.
 *
 * @param options - Configuration for the detection run and output (for example
 *   controls whether JSON output is produced and whether suggestions are shown).
 * @returns `EXIT_CODES.SUCCESS` when no silent errors were found, `EXIT_CODES.SILENT_ERRORS_FOUND` otherwise.
 */
export function runSilentErrorDetectorCLI(
	options: SilentErrorDetectorOptions,
): number {
	const result = runSilentErrorDetector(options);

	if (options.json) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		printHumanResult(result, options);
	}

	return result.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.SILENT_ERRORS_FOUND;
}
