/**
 * Project type auto-detection types.
 *
 * @module project-type/types
 */

/** Canonical project type union. "unknown" is auto-only; never a valid --project-type argument. */
export type ProjectType = "cli" | "desktop" | "library" | "web" | "unknown";

/** Rule name used in DetectionResult.matchedRule when --project-type override is supplied. */
export const OVERRIDE_RULE_NAME = "override" as const;

/** Valid values for the --project-type CLI flag (excludes "unknown"). */
export const VALID_OVERRIDE_TYPES: ProjectType[] = [
	"cli",
	"desktop",
	"library",
	"web",
];

/** A single filesystem signal that must match for a detection rule to fire. */
export interface DetectionSignal {
	type: "file" | "directory";
	/** Repo-relative path for exact match. Required. Used for existsSync checks. */
	path: string;
	/** Glob pattern matched with picomatch against root filenames (root level only). */
	pattern?: string;
}

/**
 * A detection rule. All signals must match for the rule to apply.
 * Rules are evaluated in ascending priority order; first match wins.
 */
export interface DetectionRule {
	/** Canonical identifier. Returned as DetectionResult.matchedRule. */
	name: string;
	projectType: ProjectType;
	/** All signals must match (AND within rule). */
	signals: DetectionSignal[];
	/** Lower number = checked first. */
	priority: number;
}

/** Result returned by detectProjectType(). */
export interface DetectionResult {
	projectType: ProjectType;
	/** Rule name, OVERRIDE_RULE_NAME, or null for "unknown". */
	matchedRule: string | null;
	/** "high" = explicit match or override; "low" = "unknown". */
	confidence: "high" | "low";
	/** Matched signal paths for structured logs and JSON output. */
	signals: string[];
}
