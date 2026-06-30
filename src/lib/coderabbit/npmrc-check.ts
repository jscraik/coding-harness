import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { CodeRabbitCheck } from "./local-checks.js";

/**
 * Inspect the repository's `.npmrc` security-relevant settings.
 *
 * @param repoPath - Repository root where `.npmrc` should be inspected
 * @returns A check describing scoped registry, token, and script settings
 */
export function verifyNpmrc(repoPath: string): CodeRabbitCheck {
	const npmrcPath = resolve(repoPath, ".npmrc");
	if (!existsSync(npmrcPath)) {
		return {
			name: ".npmrc configuration",
			status: "fail",
			message:
				"No .npmrc file found. Run 'harness init' to scaffold the repo security baseline with ignore-scripts=true.",
			details: { path: npmrcPath },
		};
	}

	try {
		return npmrcCheck(npmrcPath, readFileSync(npmrcPath, "utf-8"));
	} catch (e) {
		return readFailureCheck(".npmrc configuration", npmrcPath, e);
	}
}

/** Build an npmrc check from already-read file content. */
function npmrcCheck(npmrcPath: string, content: string): CodeRabbitCheck {
	const activeLines = activeConfigLines(content);
	const hasBrainwavScopedRegistry = activeLines.some((line) =>
		/^@brainwav:registry\s*=\s*https:\/\/registry\.npmjs\.org\/?$/i.test(line),
	);
	const hasAuthToken = activeLines.some((line) => /_authToken\s*=/.test(line));
	const hasIgnoreScripts = activeLines.some((line) =>
		/^ignore-scripts\s*=\s*true$/i.test(line),
	);
	const features = [
		...(hasBrainwavScopedRegistry ? ["@brainwav scoped registry"] : []),
		...(hasIgnoreScripts ? ["ignore-scripts=true (security)"] : []),
	];
	const issues = npmrcIssues(
		hasBrainwavScopedRegistry,
		hasIgnoreScripts,
		hasAuthToken,
	);
	if (issues.length > 0)
		return npmrcIssueCheck(
			npmrcPath,
			features,
			issues,
			hasBrainwavScopedRegistry,
			hasAuthToken,
		);
	return {
		name: ".npmrc configuration",
		status: "pass",
		message: `Valid .npmrc${features.length > 0 ? ` with: ${features.join(", ")}` : ""}`,
		details: { path: npmrcPath, features },
	};
}

/**
 * Return non-comment package-manager config lines.
 *
 * @param content - Raw npmrc content
 * @returns Trimmed active lines excluding blank and comment lines
 */
function activeConfigLines(content: string): string[] {
	return content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(
			(line) =>
				line.length > 0 && !line.startsWith("#") && !line.startsWith(";"),
		);
}

/** Build npmrc issue messages from detected package-manager settings. */
function npmrcIssues(
	hasBrainwavScopedRegistry: boolean,
	hasIgnoreScripts: boolean,
	hasAuthToken: boolean,
): string[] {
	return [
		...(!hasBrainwavScopedRegistry
			? ["add @brainwav:registry=https://registry.npmjs.org/ for scope routing"]
			: []),
		...(!hasIgnoreScripts
			? ["consider setting ignore-scripts=true for security"]
			: []),
		...(hasAuthToken
			? [
					"move auth token config to user-level ~/.npmrc or CI-injected ~/.npmrc instead of repo .npmrc",
				]
			: []),
	];
}

/** Build a warning or failure check for npmrc issues. */
function npmrcIssueCheck(
	npmrcPath: string,
	features: string[],
	issues: string[],
	hasBrainwavScopedRegistry: boolean,
	hasAuthToken: boolean,
): CodeRabbitCheck {
	const hasCriticalIssue = !hasBrainwavScopedRegistry || hasAuthToken;
	return {
		name: ".npmrc configuration",
		status: hasCriticalIssue ? "fail" : "warn",
		message: `.npmrc exists but has ${hasCriticalIssue ? "critical issues" : "recommendations"}: ${issues.join(", ")}`,
		details: { path: npmrcPath, features, issues },
	};
}

/** Return a read-failure check with a sanitized unknown-error fallback. */
function readFailureCheck(
	name: string,
	path: string,
	error: unknown,
): CodeRabbitCheck {
	return {
		name,
		status: "fail",
		message: `Failed to read ${path}: ${error instanceof Error ? error.message : "Unknown error"}`,
		details: { path },
	};
}
