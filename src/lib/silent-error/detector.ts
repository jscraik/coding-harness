/**
 * Silent error pattern detector
 *
 * Detects anti-patterns in error handling that swallow or hide errors:
 * - Empty catch blocks
 * - Error variables not used
 * - Console-only error handling
 * - Silent fallbacks that hide failures
 */

import { lstatSync, readFileSync, readdirSync } from "node:fs";

import { join, resolve } from "node:path";
import {
	EXIT_CODES,
	type PatternDefinition,
	type SilentErrorDetection,
	type SilentErrorDetectorOptions,
	type SilentErrorDetectorResult,
	type SilentErrorPatternType,
} from "./types.js";

/**
 * Pattern definitions for silent error detection
 */
const PATTERNS: PatternDefinition[] = [
	{
		id: "empty-catch",
		name: "Empty Catch Block",
		description: "Catch block with no error handling",
		severity: "error",
		regexes: [
			// Empty catch: catch { } or catch (e) { }
			/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g,
			// catch with only whitespace/comments
			/catch\s*(?:\([^)]*\))?\s*\{\s*(?:(?:\/\/[^\n]*)|(?:\/\*[\s\S]*?\*\/)|\s)*\}/g,
		],
		suggestion: "Add error logging or re-throw the error",
	},
	{
		id: "swallowed-error",
		name: "Swallowed Error",
		description: "Error caught but not logged or re-thrown",
		severity: "error",
		regexes: [
			// catch with only return/default value
			/catch\s*\([^)]*\)\s*\{\s*return\s+[^;]+;?\s*\}/g,
			// catch with assignment only
			/catch\s*\([^)]*\)\s*\{\s*[^=]+=\s*[^;]+;?\s*\}/g,
		],
		suggestion: "Log the error before handling or re-throw",
	},
	{
		id: "console-only",
		name: "Console-Only Error Handling",
		description: "Error only logged to console, not properly handled",
		severity: "warning",
		regexes: [
			// catch with only console.log/error/warn
			/catch\s*\([^)]*\)\s*\{\s*console\.(log|error|warn|info)\s*\([^)]+\);?\s*\}/g,
			// Multiple console statements but nothing else meaningful
			/catch\s*\([^)]*\)\s*\{[^}]*console\.(log|error|warn)[^}]*\}/g,
		],
		suggestion: "Consider proper error handling beyond console logging",
	},
	{
		id: "silent-fallback",
		name: "Silent Fallback",
		description: "Error silently falls back to default without logging",
		severity: "error",
		regexes: [
			// try/catch where catch returns default/null/undefined
			/try\s*\{[^}]*\}\s*catch\s*\([^)]*\)\s*\{\s*return\s+(?:null|undefined|"[^"]*"|\{[^}]*\});?\s*\}/g,
			// try/catch with catch that assigns default
			/try\s*\{[^}]*\}\s*catch\s*\([^)]*\)\s*\{\s*[^}]*\s*=\s*(?:null|undefined|\[\]);?\s*\}/g,
		],
		suggestion: "Log the error before returning fallback value",
	},
	{
		id: "unused-error-variable",
		name: "Unused Error Variable",
		description: "Error variable declared but never used in catch",
		severity: "warning",
		regexes: [
			// catch (e) where e is not referenced in block
			/catch\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)\s*\{[^{}]*\}/g,
		],
		suggestion: "Use the error variable or use catch { } syntax",
	},
];

/**
 * Check if a file should be ignored based on patterns
 */
function shouldIgnore(entry: string, ignore: string[]): boolean {
	// Skip hidden files/directories
	if (entry.startsWith(".")) return true;

	for (const pattern of ignore) {
		// Handle glob patterns like *.test.ts
		if (pattern.startsWith("*.")) {
			const suffix = pattern.slice(1); // Get ".test.ts" from "*.test.ts"
			if (entry.endsWith(suffix)) return true;
		} else if (entry === pattern || entry.includes(pattern)) {
			return true;
		}
	}
	return false;
}

/**
 * Recursively get all files matching extension patterns
 */
function getFilesRecursive(
	dir: string,
	extensions: string[],
	ignore: string[],
): string[] {
	const files: string[] = [];

	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			const fullPath = join(dir, entry);

			// Check if path should be ignored
			if (shouldIgnore(entry, ignore)) {
				continue;
			}

			const stats = lstatSync(fullPath);

			// Skip symlinks — following them can escape the repo tree (path traversal / DoS).
			if (stats.isSymbolicLink()) {
				continue;
			}

			if (stats.isDirectory()) {
				files.push(...getFilesRecursive(fullPath, extensions, ignore));
			} else if (
				extensions.some((ext) => entry.endsWith(ext.replace("*", "")))
			) {
				files.push(fullPath);
			}
		}
	} catch {
		// Skip directories we can't read
	}

	return files;
}

/**
 * Get file list to analyze
 */
function getFiles(options: SilentErrorDetectorOptions): string[] {
	const files: string[] = [];
	const extensions = [".ts", ".tsx", ".js", ".jsx"];
	const ignore = ["node_modules", "dist", ".git"];

	// Add explicit files
	if (options.files) {
		files.push(...options.files);
	}

	// Add files from directories
	if (options.dirs) {
		for (const dir of options.dirs) {
			const resolvedDir = resolve(dir);
			const matches = getFilesRecursive(resolvedDir, extensions, ignore);
			files.push(...matches);
		}
	}

	// Default: scan src directory
	if (files.length === 0) {
		const srcDir = resolve("src");
		const matches = getFilesRecursive(srcDir, extensions, [
			...ignore,
			"*.test.ts",
		]);
		files.push(...matches);
	}

	// Remove duplicates
	return [...new Set(files)];
}

/**
 * Find line and column for a match
 */
function findPosition(
	content: string,
	matchIndex: number,
): { line: number; column: number } {
	const lines = content.slice(0, matchIndex).split("\n");
	const lastLine = lines[lines.length - 1];
	return {
		line: lines.length,
		column: lastLine ? lastLine.length + 1 : 1,
	};
}

/**
 * Extract snippet around match
 */
function extractSnippet(
	content: string,
	matchIndex: number,
	matchLength: number,
): string {
	const start = Math.max(0, matchIndex - 40);
	const end = Math.min(content.length, matchIndex + matchLength + 40);
	return content.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Check if error variable is actually used in catch block
 */
function isErrorVariableUsed(
	content: string,
	varName: string,
	catchStart: number,
	catchEnd: number,
): boolean {
	const catchBlock = content.slice(catchStart, catchEnd);
	// Simple check: does the variable name appear after the catch declaration
	const varRegex = new RegExp(`\\b${varName}\\b`, "g");
	const matches = [...catchBlock.matchAll(varRegex)];
	// Need more than 1 match (the declaration itself)
	return matches.length > 1;
}

/**
 * Analyze a single file for silent error patterns
 */
function analyzeFile(filePath: string): SilentErrorDetection[] {
	const detections: SilentErrorDetection[] = [];
	// Track detections by location to avoid duplicates from multiple regexes
	const seenLocations = new Set<string>();

	try {
		const content = readFileSync(filePath, "utf-8");

		for (const pattern of PATTERNS) {
			for (const regex of pattern.regexes) {
				// Reset regex lastIndex
				regex.lastIndex = 0;

				let match: RegExpExecArray | null = regex.exec(content);
				while (match !== null) {
					const { line, column } = findPosition(content, match.index);
					const locationKey = `${filePath}:${line}:${column}:${pattern.id}`;

					// Skip if we've already detected this pattern at this location
					if (seenLocations.has(locationKey)) {
						match = regex.exec(content);
						continue;
					}
					seenLocations.add(locationKey);

					const snippet = extractSnippet(content, match.index, match[0].length);

					// Special handling for unused-error-variable
					if (pattern.id === "unused-error-variable" && match[1]) {
						// Find the catch block boundaries
						const catchStart = match.index + match[0].indexOf("{");
						let braceCount = 1;
						let catchEnd = catchStart + 1;
						while (braceCount > 0 && catchEnd < content.length) {
							if (content[catchEnd] === "{") braceCount++;
							if (content[catchEnd] === "}") braceCount--;
							catchEnd++;
						}

						// Skip if variable is actually used
						if (isErrorVariableUsed(content, match[1], catchStart, catchEnd)) {
							match = regex.exec(content);
							continue;
						}
					}

					const detection: SilentErrorDetection = {
						type: pattern.id,
						description: pattern.description,
						severity: pattern.severity,
						file: filePath,
						line,
						column,
						snippet,
					};

					if (pattern.suggestion) {
						detection.suggestion = pattern.suggestion;
					}

					detections.push(detection);

					match = regex.exec(content);
				}
			}
		}
	} catch {
		// Skip files we can't read
	}

	return detections;
}

/**
 * Run silent error detection
 */
export function runSilentErrorDetector(
	options: SilentErrorDetectorOptions,
): SilentErrorDetectorResult {
	const files = getFiles(options);
	const allDetections: SilentErrorDetection[] = [];

	for (const file of files) {
		const detections = analyzeFile(file);
		allDetections.push(...detections);
	}

	// Calculate summary
	const byType: Record<SilentErrorPatternType, number> = {
		"empty-catch": 0,
		"swallowed-error": 0,
		"console-only": 0,
		"silent-fallback": 0,
		"unused-error-variable": 0,
	};

	for (const detection of allDetections) {
		byType[detection.type]++;
	}

	const errors = allDetections.filter((d) => d.severity === "error").length;
	const warnings = allDetections.filter((d) => d.severity === "warning").length;

	// Pass if no errors (warnings OK unless strict mode)
	const passed = options.strict ? allDetections.length === 0 : errors === 0;

	return {
		passed,
		detections: allDetections,
		filesAnalyzed: files.length,
		summary: {
			total: allDetections.length,
			errors,
			warnings,
			byType,
		},
	};
}

export { EXIT_CODES };
