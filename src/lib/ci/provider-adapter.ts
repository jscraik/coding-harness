import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CIProvider } from "../init/types.js";

export interface RequiredCheckIdentity {
	policyId: string;
	displayName: string;
	sourceAppSlug: string;
	sourceAppId: string;
	externalIdPattern: string;
	requiredOnEvents?: Array<"pull_request" | "merge_group">;
	freshnessWindowDays?: number;
	class: "required" | "informational" | "shadow";
}

export type AdapterResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string };

export interface CIProviderAdapter {
	discoverConfigPaths(targetDir: string): string[];
	readRequiredChecks(targetDir: string): AdapterResult<RequiredCheckIdentity[]>;
}

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
			value: checks.filter((check) => check.class === "required"),
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
