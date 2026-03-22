/**
 * Workflow Artifact Registry Types and Loader
 *
 * Loads and validates `docs/workflow-artifact-registry.json`.
 * Provides programmatic access to the registry for:
 * - Checking if a workflow artifact exists at its declared path
 * - Filtering by status, owner, or deprecation policy
 * - Ensuring all promoted artifacts are tracked
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Lifecycle status of a workflow artifact. */
export type ArtifactStatus = "active" | "deprecated" | "draft" | "archived";

/** Deprecation policy determines when/how an artifact may be removed. */
export type DeprecationPolicy =
	| "none"
	| "sunset-date"
	| "superseded-by-completion"
	| "on-demand";

/** A single entry in the workflow artifact registry. */
export interface WorkflowArtifactEntry {
	/** Unique kebab-case identifier. */
	id: string;
	/** Repo-relative path to the artifact file. */
	path: string;
	/** Accountable maintainer or team. */
	owner: string;
	/** Current lifecycle status. */
	status: ArtifactStatus;
	/** ISO 8601 timestamp of last validation pass. */
	last_validated_at: string;
	/** When and how the artifact may be deprecated. */
	deprecation_policy: DeprecationPolicy;
	/** Human-readable description. */
	description?: string;
	/** ID of the artifact that supersedes this one. */
	superseded_by?: string;
	/** ISO 8601 date for sunset. */
	sunset_date?: string;
	/** Optional classification tags. */
	tags?: string[];
}

/** The full registry document. */
export interface WorkflowArtifactRegistry {
	version: string;
	description?: string;
	artifacts: WorkflowArtifactEntry[];
}

// ─── Registry Finding ───────────────────────────────────────────────────────────

export interface RegistryFinding {
	code: string;
	severity: "error" | "warning";
	message: string;
	artifactId?: string;
}

export interface RegistryValidationResult {
	pass: boolean;
	findings: RegistryFinding[];
	summary: {
		total_artifacts: number;
		active: number;
		deprecated: number;
		draft: number;
		archived: number;
		errors: number;
		warnings: number;
	};
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const VALID_STATUSES: ArtifactStatus[] = [
	"active",
	"deprecated",
	"draft",
	"archived",
];

const VALID_DEPRECATION_POLICIES: DeprecationPolicy[] = [
	"none",
	"sunset-date",
	"superseded-by-completion",
	"on-demand",
];

const KEBAB_CASE_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

// ─── Loader ─────────────────────────────────────────────────────────────────────

/**
 * Default registry path relative to repo root.
 */
export const REGISTRY_PATH = "docs/workflow-artifact-registry.json";

/**
 * Load the workflow artifact registry from disk.
 *
 * @param repoRoot - Absolute path to the repo root.
 * @returns Parsed registry or throws on read/parse failure.
 */
export async function loadRegistry(
	repoRoot: string,
): Promise<WorkflowArtifactRegistry> {
	const registryPath = resolve(repoRoot, REGISTRY_PATH);
	const raw = await readFile(registryPath, "utf-8");
	const data: unknown = JSON.parse(raw);

	if (!data || typeof data !== "object") {
		throw new Error("Registry file is not a valid JSON object");
	}

	const registry = data as WorkflowArtifactRegistry;

	if (!registry.version || typeof registry.version !== "string") {
		throw new Error("Registry missing required 'version' field");
	}

	if (!Array.isArray(registry.artifacts)) {
		throw new Error("Registry missing required 'artifacts' array");
	}

	return registry;
}

// ─── Validator ──────────────────────────────────────────────────────────────────

/**
 * Validate the registry's internal consistency.
 *
 * Checks:
 * - Each entry has all required fields
 * - IDs are unique and kebab-case
 * - Status and deprecation_policy are valid enum values
 * - Deprecated entries have superseded_by set
 * - Sunset-date entries have sunset_date set
 *
 * Does NOT check if files exist on disk — use `validateRegistryPaths()` for that.
 */
export function validateRegistry(
	registry: WorkflowArtifactRegistry,
): RegistryValidationResult {
	const findings: RegistryFinding[] = [];
	const seenIds = new Set<string>();

	if (!registry.version) {
		findings.push({
			code: "MISSING_VERSION",
			severity: "error",
			message: "Registry must declare a version",
		});
	}

	for (const entry of registry.artifacts) {
		// ID checks
		if (!entry.id) {
			findings.push({
				code: "MISSING_ID",
				severity: "error",
				message: "Artifact entry is missing an id",
			});
			continue;
		}

		if (!KEBAB_CASE_RE.test(entry.id)) {
			findings.push({
				code: "INVALID_ID_FORMAT",
				severity: "error",
				message: `Artifact '${entry.id}' has an invalid id (must be kebab-case)`,
				artifactId: entry.id,
			});
		}

		if (seenIds.has(entry.id)) {
			findings.push({
				code: "DUPLICATE_ID",
				severity: "error",
				message: `Duplicate artifact id '${entry.id}'`,
				artifactId: entry.id,
			});
		}
		seenIds.add(entry.id);

		// Required fields
		if (!entry.path) {
			findings.push({
				code: "MISSING_PATH",
				severity: "error",
				message: `Artifact '${entry.id}' is missing a path`,
				artifactId: entry.id,
			});
		}

		if (!entry.owner) {
			findings.push({
				code: "MISSING_OWNER",
				severity: "error",
				message: `Artifact '${entry.id}' is missing an owner`,
				artifactId: entry.id,
			});
		}

		// Status validation
		if (!entry.status || !VALID_STATUSES.includes(entry.status)) {
			findings.push({
				code: "INVALID_STATUS",
				severity: "error",
				message: `Artifact '${entry.id}' has invalid status '${entry.status}' (must be: ${VALID_STATUSES.join(", ")})`,
				artifactId: entry.id,
			});
		}

		// Deprecation policy
		if (
			!entry.deprecation_policy ||
			!VALID_DEPRECATION_POLICIES.includes(entry.deprecation_policy)
		) {
			findings.push({
				code: "INVALID_DEPRECATION_POLICY",
				severity: "error",
				message: `Artifact '${entry.id}' has invalid deprecation_policy '${entry.deprecation_policy}'`,
				artifactId: entry.id,
			});
		}

		// Cross-field invariants
		if (entry.status === "deprecated" && !entry.superseded_by) {
			findings.push({
				code: "DEPRECATED_NEEDS_SUCCESSOR",
				severity: "warning",
				message: `Deprecated artifact '${entry.id}' should have a superseded_by field`,
				artifactId: entry.id,
			});
		}

		if (
			entry.deprecation_policy === "sunset-date" &&
			!entry.sunset_date
		) {
			findings.push({
				code: "SUNSET_NEEDS_DATE",
				severity: "warning",
				message: `Artifact '${entry.id}' with sunset-date policy should have a sunset_date`,
				artifactId: entry.id,
			});
		}

		if (!entry.last_validated_at) {
			findings.push({
				code: "MISSING_LAST_VALIDATED",
				severity: "warning",
				message: `Artifact '${entry.id}' is missing last_validated_at timestamp`,
				artifactId: entry.id,
			});
		}
	}

	const errors = findings.filter((f) => f.severity === "error").length;
	const warnings = findings.filter((f) => f.severity === "warning").length;

	const statusCounts = {
		active: 0,
		deprecated: 0,
		draft: 0,
		archived: 0,
	};
	for (const entry of registry.artifacts) {
		if (entry.status in statusCounts) {
			statusCounts[entry.status as ArtifactStatus]++;
		}
	}

	return {
		pass: errors === 0,
		findings,
		summary: {
			total_artifacts: registry.artifacts.length,
			...statusCounts,
			errors,
			warnings,
		},
	};
}

/**
 * Validate that all artifact paths in the registry exist on disk.
 *
 * @param registry - The parsed registry
 * @param repoRoot - Absolute path to the repo root
 * @returns List of findings for missing files
 */
export async function validateRegistryPaths(
	registry: WorkflowArtifactRegistry,
	repoRoot: string,
): Promise<RegistryFinding[]> {
	const { access } = await import("node:fs/promises");
	const findings: RegistryFinding[] = [];

	for (const entry of registry.artifacts) {
		if (!entry.path) continue;

		const fullPath = resolve(repoRoot, entry.path);

		// Security: ensure resolved path is still within repoRoot
		const resolvedDir = dirname(fullPath);
		const resolvedRepo = resolve(repoRoot);
		if (!resolvedDir.startsWith(resolvedRepo)) {
			findings.push({
				code: "PATH_TRAVERSAL",
				severity: "error",
				message: `Artifact '${entry.id}' path '${entry.path}' resolves outside repo root`,
				artifactId: entry.id,
			});
			continue;
		}

		try {
			await access(fullPath);
		} catch {
			findings.push({
				code: "FILE_NOT_FOUND",
				severity: "error",
				message: `Artifact '${entry.id}' path '${entry.path}' does not exist`,
				artifactId: entry.id,
			});
		}
	}

	return findings;
}
