/**
 * Silent error detection command
 *
 * Detects silent error handling anti-patterns in code.
 */

import {
  EXIT_CODES,
  runSilentErrorDetector,
  type SilentErrorDetectorOptions,
} from "../lib/silent-error/detector.js";

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
    // biome-ignore lint/suspicious/noConsoleLog: CLI output
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Print summary header
    const statusIcon = result.passed ? "✓" : "✗";
    const statusText = result.passed ? "PASSED" : "FAILED";
    // biome-ignore lint/suspicious/noConsoleLog: CLI output
    console.log(`${statusIcon} Silent error detection ${statusText}`);
    // biome-ignore lint/suspicious/noConsoleLog: CLI output
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
        // biome-ignore lint/suspicious/noConsoleLog: CLI output
        console.log(`📁 ${file}`);
        for (const d of detections) {
          const icon = d.severity === "error" ? "✗" : "⚠";
          // biome-ignore lint/suspicious/noConsoleLog: CLI output
          console.log(`  ${icon} Line ${d.line}:${d.column} - ${d.description}`);
          // biome-ignore lint/suspicious/noConsoleLog: CLI output
          console.log(`     ${d.snippet.slice(0, 60)}...`);
          if (options.suggestions && d.suggestion) {
            // biome-ignore lint/suspicious/noConsoleLog: CLI output
            console.log(`     💡 ${d.suggestion}`);
          }
        }
        // biome-ignore lint/suspicious/noConsoleLog: CLI output
        console.log();
      }
    }

    // biome-ignore lint/suspicious/noConsoleLog: CLI output
    console.log(`Summary: ${result.filesAnalyzed} files analyzed`);
    // biome-ignore lint/suspicious/noConsoleLog: CLI output
    console.log(
      `  ${result.summary.errors} errors, ${result.summary.warnings} warnings`,
    );

    // Show breakdown by type if any found
    if (result.summary.total > 0) {
      // biome-ignore lint/suspicious/noConsoleLog: CLI output
      console.log("  By type:");
      for (const [type, count] of Object.entries(result.summary.byType)) {
        if (count > 0) {
          // biome-ignore lint/suspicious/noConsoleLog: CLI output
          console.log(`    - ${type}: ${count}`);
        }
      }
    }
  }

  return result.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.SILENT_ERRORS_FOUND;
}
