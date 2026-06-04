import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { collectDistributionBoundaryViolations } from "./doc-lifecycle-distribution.js";
import { parseMarkdownFrontmatter } from "./doc-lifecycle-frontmatter.js";
import {
	collectHarnessLifecycleFindings,
	isCoveredHarnessLifecyclePath,
} from "./doc-lifecycle-harness.js";
import { safeRepoPath } from "./doc-lifecycle-paths.js";
import { buildDocLifecycleReport } from "./doc-lifecycle-report.js";
import {
	AUTHORITIES,
	CANON_CLASSES,
	DATE_PATTERN,
	DISTRIBUTIONS,
	DOC_LIFECYCLE_MANIFEST_SCHEMA,
	DOC_LIFECYCLE_SCHEMA,
	DOC_TYPES,
	LIFECYCLE_STATES,
	REQUIRED_METADATA_KEYS,
	SEMVER_IMPACTS,
} from "./doc-lifecycle-types.js";
import type {
	DocLifecycleManifest,
	DocLifecycleManifestEntry,
	DocLifecycleMetadata,
	DocLifecycleReport,
	DocLifecycleViolation,
} from "./doc-lifecycle-types.js";

export {
	DOC_LIFECYCLE_MANIFEST_SCHEMA,
	DOC_LIFECYCLE_RULE_ID,
	DOC_LIFECYCLE_SCHEMA,
} from "./doc-lifecycle-types.js";
export type {
	DocLifecycleManifest,
	DocLifecycleManifestEntry,
	DocLifecycleMetadata,
	DocLifecycleReport,
	DocLifecycleViolation,
} from "./doc-lifecycle-types.js";

/** Validate the repository documentation lifecycle manifest and governed docs. */
export function validateDocLifecycle(options: {
	repoRoot: string;
	changedFiles?: string[];
}): DocLifecycleReport {
	const repoRoot = resolve(options.repoRoot);
	const violations: DocLifecycleViolation[] = [];
	const advisoryFindings: DocLifecycleViolation[] = [];
	const manifest = loadManifest(repoRoot, violations);
	if (!manifest) {
		return buildDocLifecycleReport([], violations);
	}
	if (manifest.schema !== DOC_LIFECYCLE_MANIFEST_SCHEMA) {
		violations.push({
			path: "docs/doc-lifecycle-manifest.json",
			severity: "error",
			message: "Documentation lifecycle manifest schema is invalid.",
			fix: `Set schema to ${DOC_LIFECYCLE_MANIFEST_SCHEMA}.`,
		});
	}
	const seenPaths = new Set<string>();
	for (const entry of manifest.documents) {
		validateManifestEntry(entry, seenPaths, violations);
		validateDocumentEntry(repoRoot, entry, violations);
	}
	violations.push(
		...collectDistributionBoundaryViolations(repoRoot, manifest.documents),
	);
	const harnessReport = collectHarnessLifecycleFindings(
		options.changedFiles
			? { repoRoot, changedFiles: options.changedFiles }
			: { repoRoot },
	);
	violations.push(...harnessReport.requiredFindings);
	advisoryFindings.push(...harnessReport.advisoryFindings);
	return buildDocLifecycleReport(
		manifest.documents.map((entry) => entry.path).sort(),
		violations,
		harnessReport.checkedArtifacts,
		advisoryFindings,
	);
}

/** Collect docs-gate lifecycle violations only when the current change affects governed surfaces. */
export function collectDocLifecycleViolations(options: {
	repoRoot: string;
	changedFiles: string[];
	deletedFiles?: Set<string>;
}): DocLifecycleViolation[] {
	const repoRoot = resolve(options.repoRoot);
	const manifestPath = join(repoRoot, "docs/doc-lifecycle-manifest.json");
	if (!existsSync(manifestPath)) return [];
	const deletedFiles = options.deletedFiles ?? new Set<string>();
	const manifestViolations: DocLifecycleViolation[] = [];
	const manifest = loadManifest(repoRoot, manifestViolations);
	if (!manifest) return manifestViolations;
	const governedPaths = new Set(manifest.documents.map((entry) => entry.path));
	const changed = [...new Set(options.changedFiles)].filter(
		(file) => !deletedFiles.has(file),
	);
	const affectsLifecycle = changed.some(
		(file) =>
			file === "docs/doc-lifecycle-manifest.json" ||
			file === "docs/doc-lifecycle.schema.json" ||
			file.startsWith("src/templates/") ||
			isCoveredHarnessLifecyclePath(file) ||
			governedPaths.has(file),
	);
	if (!affectsLifecycle) return [];
	return validateDocLifecycle({ repoRoot, changedFiles: changed })
		.requiredFindings;
}

function loadManifest(
	repoRoot: string,
	violations: DocLifecycleViolation[],
): DocLifecycleManifest | null {
	const manifestPath = join(repoRoot, "docs/doc-lifecycle-manifest.json");
	if (!existsSync(manifestPath)) {
		violations.push({
			path: "docs/doc-lifecycle-manifest.json",
			severity: "error",
			message: "Documentation lifecycle manifest is missing.",
			fix: "Create docs/doc-lifecycle-manifest.json.",
		});
		return null;
	}
	try {
		const parsed = JSON.parse(readFileSync(manifestPath, "utf-8"));
		if (!Array.isArray(parsed.documents)) {
			violations.push({
				path: "docs/doc-lifecycle-manifest.json",
				severity: "error",
				message:
					"Documentation lifecycle manifest must contain documents array.",
				fix: "Add a documents array with governed document entries.",
			});
			return null;
		}
		return parsed as DocLifecycleManifest;
	} catch (error) {
		violations.push({
			path: "docs/doc-lifecycle-manifest.json",
			severity: "error",
			message: "Documentation lifecycle manifest is not valid JSON.",
			fix: error instanceof Error ? error.message : "Fix JSON syntax.",
		});
		return null;
	}
}

function validateManifestEntry(
	entry: DocLifecycleManifestEntry,
	seenPaths: Set<string>,
	violations: DocLifecycleViolation[],
): void {
	if (!entry.path) {
		violations.push({
			path: "docs/doc-lifecycle-manifest.json",
			severity: "error",
			message: "Manifest entry is missing path.",
			fix: "Add a repo-relative path to every manifest entry.",
		});
		return;
	}
	if (seenPaths.has(entry.path)) {
		violations.push({
			path: entry.path,
			severity: "error",
			message: "Document appears more than once in lifecycle manifest.",
			fix: "Keep one manifest entry per governed document.",
		});
	}
	seenPaths.add(entry.path);
	for (const [value, allowed, label] of [
		[entry.docType, DOC_TYPES, "docType"],
		[entry.canonicality, AUTHORITIES, "canonicality"],
		[entry.distribution, DISTRIBUTIONS, "distribution"],
		[entry.lifecycleState, LIFECYCLE_STATES, "lifecycleState"],
		[entry.semverDefault, SEMVER_IMPACTS, "semverDefault"],
	] as const) {
		if (!allowed.has(value)) {
			violations.push({
				path: entry.path,
				severity: "error",
				message: `Manifest ${label} is invalid.`,
				fix: `Use one of: ${[...allowed].join(", ")}.`,
			});
		}
	}
}

function validateDocumentEntry(
	repoRoot: string,
	entry: DocLifecycleManifestEntry,
	violations: DocLifecycleViolation[],
): void {
	const filePath = safeRepoPath(repoRoot, entry.path);
	if (!filePath || !existsSync(filePath)) {
		violations.push({
			path: entry.path,
			severity: "error",
			message: "Governed document listed in manifest does not exist.",
			fix: "Create the document, remove it from the manifest, or mark the lifecycle transition in a replacement doc.",
		});
		return;
	}
	const parsed = parseMarkdownFrontmatter(readFileSync(filePath, "utf-8"));
	if (!parsed) {
		violations.push({
			path: entry.path,
			severity: "error",
			message: "Governed document is missing YAML frontmatter.",
			fix: "Add documentation lifecycle frontmatter before the first heading.",
		});
		return;
	}
	const metadata = parsed as Partial<DocLifecycleMetadata>;
	for (const key of REQUIRED_METADATA_KEYS) {
		if (metadata[key] === undefined || metadata[key] === null) {
			violations.push({
				path: entry.path,
				severity: "error",
				message: `Governed document is missing ${key} metadata.`,
				fix: `Add ${key} to the document frontmatter.`,
			});
		}
	}
	validateMetadataEnums(entry, metadata, violations);
	validateMetadataDates(entry.path, metadata, violations);
	validateMetadataArrays(entry.path, metadata, violations);
	validateMetadataAlignment(entry, metadata, violations);
	validateDependencies(repoRoot, entry, metadata.depends_on, violations);
}

function validateMetadataEnums(
	entry: DocLifecycleManifestEntry,
	metadata: Partial<DocLifecycleMetadata>,
	violations: DocLifecycleViolation[],
): void {
	for (const [value, allowed, label] of [
		[metadata.doc_type, DOC_TYPES, "doc_type"],
		[metadata.authority, AUTHORITIES, "authority"],
		[metadata.canon_class, CANON_CLASSES, "canon_class"],
		[metadata.distribution, DISTRIBUTIONS, "distribution"],
		[metadata.lifecycle_state, LIFECYCLE_STATES, "lifecycle_state"],
		[metadata.semver_impact, SEMVER_IMPACTS, "semver_impact"],
	] as const) {
		if (typeof value === "string" && !allowed.has(value)) {
			violations.push({
				path: entry.path,
				severity: "error",
				message: `Document ${label} metadata is invalid.`,
				fix: `Use one of: ${[...allowed].join(", ")}.`,
			});
		}
	}
	if (metadata.doc_schema && metadata.doc_schema !== DOC_LIFECYCLE_SCHEMA) {
		violations.push({
			path: entry.path,
			severity: "error",
			message: "Document lifecycle schema metadata is invalid.",
			fix: `Set doc_schema to ${DOC_LIFECYCLE_SCHEMA}.`,
		});
	}
}

function validateMetadataDates(
	path: string,
	metadata: Partial<DocLifecycleMetadata>,
	violations: DocLifecycleViolation[],
): void {
	for (const key of ["created", "last_reviewed", "remove_after"] as const) {
		const value = metadata[key];
		if (value && !DATE_PATTERN.test(value)) {
			violations.push({
				path,
				severity: "error",
				message: `${key} must use YYYY-MM-DD format.`,
				fix: "Use an ISO date without a time component.",
			});
		}
	}
	if (metadata.lifecycle_state === "deprecated" && !metadata.remove_after) {
		violations.push({
			path,
			severity: "error",
			message: "Deprecated documents must declare remove_after.",
			fix: "Add remove_after with the planned removal date.",
		});
	}
	if (
		(metadata.lifecycle_state === "deprecated" ||
			metadata.lifecycle_state === "superseded") &&
		!metadata.superseded_by
	) {
		violations.push({
			path,
			severity: "error",
			message: "Deprecated or superseded documents must declare superseded_by.",
			fix: "Point superseded_by at the replacement document or decision.",
		});
	}
}

function validateMetadataArrays(
	path: string,
	metadata: Partial<DocLifecycleMetadata>,
	violations: DocLifecycleViolation[],
): void {
	for (const key of [
		"audience",
		"maintenance_trigger",
		"validated_by",
		"depends_on",
	] as const) {
		const value = metadata[key];
		if (!Array.isArray(value) || value.length === 0) {
			violations.push({
				path,
				severity: "error",
				message: `${key} must be a non-empty array.`,
				fix: `Use a YAML list for ${key}.`,
			});
		}
	}
}

function validateMetadataAlignment(
	entry: DocLifecycleManifestEntry,
	metadata: Partial<DocLifecycleMetadata>,
	violations: DocLifecycleViolation[],
): void {
	const expected = [
		["doc_type", metadata.doc_type, entry.docType],
		["authority", metadata.authority, entry.canonicality],
		[
			"canon_class",
			metadata.canon_class,
			entry.canonicality === "canon" ? "canonical" : entry.canonicality,
		],
		["distribution", metadata.distribution, entry.distribution],
		["lifecycle_state", metadata.lifecycle_state, entry.lifecycleState],
		["owner", metadata.owner, entry.owner],
		["semver_impact", metadata.semver_impact, entry.semverDefault],
	] as const;
	for (const [label, actual, wanted] of expected) {
		if (actual && actual !== wanted) {
			violations.push({
				path: entry.path,
				severity: "error",
				message: `${label} metadata does not match lifecycle manifest.`,
				fix:
					"Set " +
					label +
					" to " +
					wanted +
					" or update the manifest intentionally.",
			});
		}
	}
}

function validateDependencies(
	repoRoot: string,
	entry: DocLifecycleManifestEntry,
	dependsOn: string[] | undefined,
	violations: DocLifecycleViolation[],
): void {
	for (const dependency of [...(entry.dependsOn ?? []), ...(dependsOn ?? [])]) {
		const dependencyPath = safeRepoPath(repoRoot, dependency);
		if (!dependencyPath || !existsSync(dependencyPath)) {
			violations.push({
				path: entry.path,
				severity: "error",
				message: `Documentation dependency is missing: ${dependency}`,
				fix: "Create the dependency, correct the path, or remove stale dependency metadata.",
			});
		}
	}
}
