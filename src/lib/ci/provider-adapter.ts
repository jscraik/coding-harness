import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CIProvider } from "../init/types.js";

export interface RequiredCheckIdentity {
	policyId: string;
	displayName: string;
	sourceAppSlug: string;
	sourceAppId: string;
	externalIdPattern: string;
	githubCheckName: string | null;
	requiredOnEvents?: Array<"pull_request" | "merge_group">;
	freshnessWindowDays?: number;
	class: "required" | "informational" | "shadow";
	enabled?: boolean;
}

export type AdapterResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string };

export interface CIProviderAdapter {
	discoverConfigPaths(targetDir: string): string[];
	readRequiredChecks(targetDir: string): AdapterResult<RequiredCheckIdentity[]>;
}

/**
 * Checks whether a runtime value matches the shape and constraints of a RequiredCheckIdentity.
 *
 * Validates that required string fields are present (`policyId`, `displayName`, `sourceAppSlug`, `sourceAppId`, `externalIdPattern`), that `githubCheckName` is a `string` or `null`, and that `class` is one of `"required"`, `"informational"`, or `"shadow"`. If present, validates `requiredOnEvents` is an array containing only `"pull_request"` and/or `"merge_group"`, `freshnessWindowDays` is an integer between 1 and 7, and `enabled` is boolean.
 *
 * @param value - The runtime value to validate
 * @returns `true` if `value` satisfies the `RequiredCheckIdentity` shape and constraints, `false` otherwise.
 */
function isRequiredCheckIdentity(
	value: unknown,
): value is RequiredCheckIdentity {
	if (!value || typeof value !== "object") {
		return false;
	}
	const record = value as Record<string, unknown>;
	const baseShapeValid =
		typeof record.policyId === "string" &&
		typeof record.displayName === "string" &&
		typeof record.sourceAppSlug === "string" &&
		typeof record.sourceAppId === "string" &&
		typeof record.externalIdPattern === "string" &&
		(typeof record.githubCheckName === "string" ||
			record.githubCheckName === null) &&
		(record.class === "required" ||
			record.class === "informational" ||
			record.class === "shadow");
	if (!baseShapeValid) {
		return false;
	}

	if (
		record.requiredOnEvents !== undefined &&
		(!Array.isArray(record.requiredOnEvents) ||
			record.requiredOnEvents.some(
				(event) => event !== "pull_request" && event !== "merge_group",
			))
	) {
		return false;
	}

	if (
		record.freshnessWindowDays !== undefined &&
		(typeof record.freshnessWindowDays !== "number" ||
			!Number.isInteger(record.freshnessWindowDays) ||
			record.freshnessWindowDays < 1 ||
			record.freshnessWindowDays > 7)
	) {
		return false;
	}

	if (record.enabled !== undefined && typeof record.enabled !== "boolean") {
		return false;
	}

	return true;
}

function toRepoRelativePath(targetDir: string, absolutePath: string): string {
	const normalizedTargetDir = resolve(targetDir);
	const normalizedAbsolutePath = resolve(absolutePath);
	if (!normalizedAbsolutePath.startsWith(normalizedTargetDir)) {
		return normalizedAbsolutePath;
	}
	const relative = normalizedAbsolutePath
		.slice(normalizedTargetDir.length)
		.replaceAll("\\", "/");
	return relative.startsWith("/") ? relative.slice(1) : relative;
}

/**
 * Discover GitHub Actions workflow files under a repository directory.
 *
 * @param targetDir - Path to the repository root to search for workflows
 * @returns A sorted array of repository-relative paths to workflow files (files ending with `.yml` or `.yaml` located under `.github/workflows`). Returns an empty array if the workflows directory does not exist.
 */
function listWorkflowFiles(targetDir: string): string[] {
	const workflowsDir = resolve(targetDir, ".github", "workflows");
	if (!existsSync(workflowsDir)) {
		return [];
	}
	const queue: string[] = [workflowsDir];
	const discovered = new Set<string>();
	while (queue.length > 0) {
		const currentDir = queue.pop();
		if (!currentDir) {
			continue;
		}
		for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
			const absolutePath = join(currentDir, entry.name);
			if (entry.isDirectory()) {
				queue.push(absolutePath);
				continue;
			}
			if (!entry.isFile()) {
				continue;
			}
			if (!entry.name.endsWith(".yml") && !entry.name.endsWith(".yaml")) {
				continue;
			}
			discovered.add(toRepoRelativePath(targetDir, absolutePath));
		}
	}
	return [...discovered].sort();
}

/**
 * Read and validate the repository's required-checks manifest and return enabled required-check identities.
 *
 * @param targetDir - Repository root directory used to locate `.harness/ci-required-checks.json`
 * @returns On success, an object with `ok: true` and `value` containing only entries from the manifest's `requiredChecks` array where `class === "required"` and `enabled !== false`. On failure, an object with `ok: false` and `error` describing why (missing manifest, non-array `requiredChecks`, invalid entries, or JSON parse failure).
 */
function readRequiredChecksManifest(
	targetDir: string,
): AdapterResult<RequiredCheckIdentity[]> {
	const manifestPath = resolve(
		targetDir,
		".harness",
		"ci-required-checks.json",
	);
	if (!existsSync(manifestPath)) {
		return {
			ok: false,
			error:
				"Required checks manifest missing: .harness/ci-required-checks.json",
		};
	}
	try {
		const parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			requiredChecks?: unknown;
		};
		if (!Array.isArray(parsed.requiredChecks)) {
			return {
				ok: false,
				error:
					"Required checks manifest must define requiredChecks as an array.",
			};
		}
		const checks = parsed.requiredChecks.filter(isRequiredCheckIdentity);
		if (checks.length !== parsed.requiredChecks.length) {
			return {
				ok: false,
				error:
					"Required checks manifest contains invalid check entries. Refusing to ignore malformed migration evidence.",
			};
		}
		return {
			ok: true,
			value: checks.filter(
				(check) => check.class === "required" && check.enabled !== false,
			),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: `Failed to parse required checks manifest: ${message}`,
		};
	}
}

function createGitHubActionsAdapter(): CIProviderAdapter {
	return {
		discoverConfigPaths(targetDir: string): string[] {
			return listWorkflowFiles(targetDir);
		},
		readRequiredChecks(
			targetDir: string,
		): AdapterResult<RequiredCheckIdentity[]> {
			return readRequiredChecksManifest(targetDir);
		},
	};
}

function createCircleCIAdapter(): CIProviderAdapter {
	return {
		discoverConfigPaths(targetDir: string): string[] {
			const candidates = [
				".circleci/config.yml",
				".circleci/config.yaml",
			] as const;
			return candidates
				.filter((candidate) => existsSync(resolve(targetDir, candidate)))
				.map((candidate) => candidate);
		},
		readRequiredChecks(
			targetDir: string,
		): AdapterResult<RequiredCheckIdentity[]> {
			return readRequiredChecksManifest(targetDir);
		},
	};
}

export function createCIProviderAdapter(
	provider: CIProvider,
): CIProviderAdapter {
	if (provider === "github-actions") {
		return createGitHubActionsAdapter();
	}
	return createCircleCIAdapter();
}
