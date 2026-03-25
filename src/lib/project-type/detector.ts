import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import picomatch from "picomatch";
import {
	type DetectionResult,
	type DetectionRule,
	OVERRIDE_RULE_NAME,
	type ProjectType,
} from "./types.js";

// === Detection rules (priority order, lowest number = checked first) ===

export const DETECTION_RULES: DetectionRule[] = [
	{
		name: "tauri",
		projectType: "desktop",
		priority: 1,
		signals: [{ type: "directory", path: "src-tauri" }],
	},
	{
		name: "cli-ts",
		projectType: "cli",
		priority: 2,
		signals: [{ type: "file", path: "src/cli.ts" }],
	},
	{
		name: "cli-js",
		projectType: "cli",
		priority: 3,
		signals: [{ type: "file", path: "src/cli.js" }],
	},
	{
		name: "vite",
		projectType: "web",
		priority: 4,
		signals: [{ type: "file", path: "", pattern: "vite.config.*" }],
	},
	{
		name: "next",
		projectType: "web",
		priority: 5,
		signals: [{ type: "file", path: "", pattern: "next.config.*" }],
	},
	{
		name: "nuxt",
		projectType: "web",
		priority: 6,
		signals: [{ type: "file", path: "", pattern: "nuxt.config.*" }],
	},
	{
		name: "library",
		projectType: "library",
		priority: 7,
		signals: [{ type: "file", path: "src/index.ts" }],
	},
];

/**
 * Detect the project type from filesystem signals.
 *
 * Pure, read-only function — makes zero write calls. SA15.
 *
 * @param targetDir - Absolute path to the repo root to scan.
 * @param override - Explicit ProjectType from --project-type flag. When provided,
 *   skip all scanning and return an OVERRIDE_RULE_NAME result immediately.
 * @param rules - Optional rules array for testing. Defaults to DETECTION_RULES.
 */
export function detectProjectType(
	targetDir: string,
	override?: ProjectType,
	rules: DetectionRule[] = DETECTION_RULES,
): DetectionResult {
	// Override path: explicit flag always wins (I3, SA9, SA12)
	if (override !== undefined) {
		return {
			projectType: override,
			matchedRule: OVERRIDE_RULE_NAME,
			confidence: "high",
			signals: [],
		};
	}

	// Cache root-level directory listing for glob matching (one call per invocation)
	let rootEntries: string[] | null = null;
	function getRootEntries(): string[] {
		if (rootEntries !== null) return rootEntries;
		try {
			rootEntries = readdirSync(targetDir);
		} catch {
			// Unreadable directory: no glob matches possible (degrades safely)
			rootEntries = [];
		}
		return rootEntries;
	}

	// Sort rules by priority (ascending: lower number = higher priority)
	const sorted = [...rules].sort((a, b) => a.priority - b.priority);

	for (const rule of sorted) {
		if (matchesRule(rule, targetDir, getRootEntries)) {
			return {
				projectType: rule.projectType,
				matchedRule: rule.name,
				confidence: "high",
				signals: rule.signals
					.map((s) => s.pattern ?? s.path)
					.filter((p) => p.length > 0),
			};
		}
	}

	// No rule matched — unknown (SA7)
	return {
		projectType: "unknown",
		matchedRule: null,
		confidence: "low",
		signals: [],
	};
}

/**
 * Returns true when ALL signals in a rule match.
 * A picomatch error on a malformed pattern causes the signal (and rule) to be skipped. SA18.
 */
function matchesRule(
	rule: DetectionRule,
	targetDir: string,
	getRootEntries: () => string[],
): boolean {
	for (const signal of rule.signals) {
		if (signal.pattern !== undefined && signal.pattern.length > 0) {
			// Glob signal: match against root-level filenames
			let matcher: ((filename: string) => boolean) | null = null;
			try {
				matcher = picomatch(signal.pattern);
			} catch {
				// Malformed pattern — skip this rule entirely (SA18)
				return false;
			}
			const entries = getRootEntries();
			const matched = entries.some((entry) => {
				try {
					return matcher?.(entry) ?? false;
				} catch {
					return false;
				}
			});
			if (!matched) return false;
		} else {
			// Exact path signal
			const fullPath = resolve(targetDir, signal.path);
			if (!existsSync(fullPath)) return false;

			if (signal.type === "directory") {
				try {
					if (!statSync(fullPath).isDirectory()) return false;
				} catch {
					return false;
				}
			}
		}
	}
	return true;
}
