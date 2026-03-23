import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * JSC-59: CI config syntax validation for ci-migrate verify.
 *
 * Validates CI configuration files WITHOUT a full YAML parser to avoid adding
 * external dependencies. Catches the class of bugs that failed silently:
 *   - Missing required CircleCI top-level keys (version, jobs/workflows/orbs)
 *   - Invalid top-level anchor keys like `defaults:` that CircleCI rejects
 *   - Config file missing entirely
 */

export interface CIConfigValidationViolation {
	configPath: string;
	message: string;
}

/**
 * Known invalid top-level keys for CircleCI that are commonly confused with
 * YAML anchors or GitHub Actions syntax. These cause silent pipeline failure.
 */
const CIRCLECI_FORBIDDEN_TOP_LEVEL_KEYS = new Set([
	"defaults", // Confusable with YAML anchors — CircleCI silently ignores/rejects
	"env",
	"on", // GitHub Actions specific
	"runs-on", // GitHub Actions specific
	"name", // Top-level name is GHA, not CircleCI
	"jobs-filter", // Not a valid CircleCI key
]);

/**
 * Required top-level keys for a valid CircleCI config.
 * A valid config needs `version` and at least one of: jobs, workflows, orbs.
 */
const CIRCLECI_REQUIRED_KEYS = ["version"];
const CIRCLECI_CONTENT_KEYS = ["jobs", "workflows", "orbs"];

/**
 * Parse only the top-level keys from a YAML file without a full YAML parser.
 * Returns keys that appear at column 0 (no indentation) followed by `:`.
 * Ignores YAML comments and blank lines.
 */
function parseTopLevelYAMLKeys(content: string): string[] {
	const keys: string[] = [];
	for (const line of content.split("\n")) {
		// Skip blank lines and comments
		if (/^\s*#/.test(line) || /^\s*$/.test(line)) {
			continue;
		}
		// Match top-level key: starts at column 0, followed by colon
		const match = line.match(/^([A-Za-z0-9_-]+)\s*:/);
		if (match?.[1]) {
			keys.push(match[1]);
		}
	}
	return keys;
}

/**
 * Validate a CircleCI config file for structural correctness.
 * Returns a list of violation messages.
 */
function validateCircleCIConfig(
	configPath: string,
	content: string,
): string[] {
	const violations: string[] = [];
	const topLevelKeys = parseTopLevelYAMLKeys(content);

	// Check for required keys
	for (const required of CIRCLECI_REQUIRED_KEYS) {
		if (!topLevelKeys.includes(required)) {
			violations.push(
				`Missing required top-level key '${required}:' in CircleCI config ${configPath}`,
			);
		}
	}

	// Check that at least one content section exists
	const hasContentKey = CIRCLECI_CONTENT_KEYS.some((k) =>
		topLevelKeys.includes(k),
	);
	if (!hasContentKey) {
		violations.push(
			`CircleCI config ${configPath} must define at least one of: ${CIRCLECI_CONTENT_KEYS.map((k) => `'${k}:'`).join(", ")}`,
		);
	}

	// Check for forbidden/invalid top-level keys
	for (const key of topLevelKeys) {
		if (CIRCLECI_FORBIDDEN_TOP_LEVEL_KEYS.has(key)) {
			violations.push(
				`CircleCI config ${configPath} contains invalid top-level key '${key}:' (this may be a GitHub Actions or YAML anchor pattern). CircleCI will silently reject the config.`,
			);
		}
	}

	return violations;
}

/**
 * Validate a GitHub Actions workflow file for structural correctness.
 * Returns a list of violation messages.
 */
function validateGitHubActionsConfig(
	configPath: string,
	content: string,
): string[] {
	const violations: string[] = [];
	const topLevelKeys = parseTopLevelYAMLKeys(content);

	// GHA required top-level keys
	if (!topLevelKeys.includes("on")) {
		violations.push(
			`GitHub Actions workflow ${configPath} is missing required top-level key 'on:' (trigger definition).`,
		);
	}
	if (!topLevelKeys.includes("jobs")) {
		violations.push(
			`GitHub Actions workflow ${configPath} is missing required top-level key 'jobs:'.`,
		);
	}

	return violations;
}

/**
 * JSC-59: Validate CI config syntax for the target provider.
 *
 * Called during `ci-migrate verify` to catch config errors that would cause
 * silent pipeline failures (like the `defaults:` key bug in trace-narrative).
 *
 * Returns an array of violation strings suitable for adding to verificationViolations.
 */
export function validateCIConfigSyntax(
	dir: string,
	provider: "circleci" | "github-actions",
): CIConfigValidationViolation[] {
	const violations: CIConfigValidationViolation[] = [];

	if (provider === "circleci") {
		const candidates = [
			".circleci/config.yml",
			".circleci/config.yaml",
		] as const;
		const existing = candidates.filter((c) => existsSync(resolve(dir, c)));

		if (existing.length === 0) {
			violations.push({
				configPath: ".circleci/config.yml",
				message:
					"CircleCI config not found at .circleci/config.yml. Create it before verify.",
			});
			return violations;
		}

		for (const configRelPath of existing) {
			const configPath = resolve(dir, configRelPath);
			try {
				const content = readFileSync(configPath, "utf-8");
				const configViolations = validateCircleCIConfig(
					configRelPath,
					content,
				);
				for (const message of configViolations) {
					violations.push({ configPath: configRelPath, message });
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				violations.push({
					configPath: configRelPath,
					message: `Failed to read CircleCI config ${configRelPath}: ${message}`,
				});
			}
		}
	} else if (provider === "github-actions") {
		const workflowsDir = resolve(dir, ".github", "workflows");
		if (!existsSync(workflowsDir)) {
			violations.push({
				configPath: ".github/workflows/",
				message:
					"GitHub Actions workflows directory not found at .github/workflows/. Create it before verify.",
			});
			return violations;
		}

		let workflowFiles: string[] = [];
		try {
			workflowFiles = readdirSync(workflowsDir)
				.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
				.map((f) => join(".github", "workflows", f));
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			violations.push({
				configPath: ".github/workflows/",
				message: `Failed to list GitHub Actions workflows: ${message}`,
			});
			return violations;
		}

		if (workflowFiles.length === 0) {
			violations.push({
				configPath: ".github/workflows/",
				message:
					"No .yml/.yaml workflow files found in .github/workflows/.",
			});
			return violations;
		}

		for (const relPath of workflowFiles) {
			const fullPath = resolve(dir, relPath);
			try {
				const content = readFileSync(fullPath, "utf-8");
				const configViolations = validateGitHubActionsConfig(
					relPath,
					content,
				);
				for (const message of configViolations) {
					violations.push({ configPath: relPath, message });
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				violations.push({
					configPath: relPath,
					message: `Failed to read GitHub Actions workflow ${relPath}: ${message}`,
				});
			}
		}
	}

	return violations;
}
