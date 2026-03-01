/**
 * Canonical Ralph runtime dependency contract.
 *
 * This module is the single source of truth for Ralph install pins used by:
 * - runtime environment preflight checks
 * - generated workflow templates
 * - repo-native workflow checks
 */

export const RALPH_PACKAGE_NAME = "ralph-gold";
export const RALPH_VERSION_PIN = "0.8.1";

export const RALPH_PYTHON_VERSION_PIN = "3.12";
export const RALPH_UV_VERSION_PIN = "0.9.5";
export const RALPH_FALLBACK_ENV_FLAG = "HARNESS_ALLOW_RALPH_PIPX_FALLBACK";
export const RALPH_FALLBACK_WARNING_ARTIFACT_PATH =
	"artifacts/policy/ralph-fallback-warning.json";
export const RALPH_GIT_FALLBACK_REPO_URL =
	"https://github.com/jscraik/ralph-gold.git";
export const RALPH_GIT_FALLBACK_COMMIT_SHA =
	"5d4b57537a29c3edb566665c9482ae5ca1d49eed";

export const SETUP_PYTHON_ACTION_VERSION = "v6";
export const SETUP_UV_ACTION_VERSION = "v7";

export function getRalphPackageSpec(): string {
	return `${RALPH_PACKAGE_NAME}==${RALPH_VERSION_PIN}`;
}

export function getPinnedRalphGitSpec(
	repoUrl: string,
	commitSha: string,
): string {
	return `git+${repoUrl}@${commitSha}`;
}

export function getPinnedRalphGitFallbackSpec(): string {
	return getPinnedRalphGitSpec(
		RALPH_GIT_FALLBACK_REPO_URL,
		RALPH_GIT_FALLBACK_COMMIT_SHA,
	);
}

export function extractVersionFromRalphVersionOutput(
	output: string,
): string | undefined {
	// Expected forms include:
	// - "ralph-gold 0.8.1"
	// - "ralph 0.8.1"
	const match = output.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/);
	return match?.[1];
}
