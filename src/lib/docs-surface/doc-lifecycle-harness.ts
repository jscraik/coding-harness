import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdownFrontmatter } from "./doc-lifecycle-frontmatter.js";
import {
	repoRelative,
	safeRepoPath,
	walkFiles,
} from "./doc-lifecycle-paths.js";
import {
	DATE_PATTERN,
	HARNESS_AUTHORITIES,
	HARNESS_DOCUMENT_LIFECYCLE_SCHEMA,
	HARNESS_EXECUTION_ARTIFACT_SCHEMAS,
	HARNESS_LIFECYCLE_STATUSES,
	REQUIRED_HARNESS_LIFECYCLE_KEYS,
} from "./doc-lifecycle-types.js";
import type {
	DocLifecycleMetadata,
	DocLifecycleViolation,
	HarnessLifecycleMetadata,
} from "./doc-lifecycle-types.js";

/** Collect lifecycle findings for .harness cognition artifacts. */
export function collectHarnessLifecycleFindings(options: {
	repoRoot: string;
	changedFiles?: string[];
}): {
	checkedArtifacts: string[];
	requiredFindings: DocLifecycleViolation[];
	advisoryFindings: DocLifecycleViolation[];
} {
	const requiredFindings: DocLifecycleViolation[] = [];
	const advisoryFindings: DocLifecycleViolation[] = [];
	const paths = collectHarnessLifecyclePaths(
		options.repoRoot,
		options.changedFiles,
	);
	for (const path of paths) {
		validateHarnessLifecycleArtifact(
			options.repoRoot,
			path,
			requiredFindings,
			advisoryFindings,
			Boolean(options.changedFiles),
		);
	}
	return {
		checkedArtifacts: paths,
		requiredFindings,
		advisoryFindings,
	};
}

/** Check whether a repo-relative path is governed by the .harness lifecycle contract. */
export function isCoveredHarnessLifecyclePath(path: string): boolean {
	return (
		path.endsWith(".md") &&
		(path.startsWith(".harness/research/") ||
			path.startsWith(".harness/audits/") ||
			path.startsWith(".harness/implementation-notes/") ||
			path.startsWith(".harness/specs/") ||
			path.startsWith(".harness/plan/") ||
			path.startsWith(".harness/linear/"))
	);
}

function collectHarnessLifecyclePaths(
	repoRoot: string,
	changedFiles: string[] | undefined,
): string[] {
	if (changedFiles) {
		return [...new Set(changedFiles)]
			.filter((path) => isCoveredHarnessLifecyclePath(path))
			.sort();
	}
	const harnessRoot = join(repoRoot, ".harness");
	if (!existsSync(harnessRoot)) return [];
	return walkFiles(harnessRoot)
		.map((path) => repoRelative(repoRoot, path))
		.filter((path) => isCoveredHarnessLifecyclePath(path))
		.filter((path) => {
			const filePath = safeRepoPath(repoRoot, path);
			if (!filePath || !existsSync(filePath)) return false;
			const metadata = parseMarkdownFrontmatter(
				readFileSync(filePath, "utf-8"),
			);
			return Boolean(metadata && isOptedIntoHarnessLifecycle(metadata));
		})
		.sort();
}

function validateHarnessLifecycleArtifact(
	repoRoot: string,
	path: string,
	requiredFindings: DocLifecycleViolation[],
	advisoryFindings: DocLifecycleViolation[],
	isChangedScope: boolean,
): void {
	const filePath = safeRepoPath(repoRoot, path);
	if (!filePath || !existsSync(filePath)) return;
	const parsed = parseMarkdownFrontmatter(readFileSync(filePath, "utf-8"));
	if (!parsed) {
		pushHarnessFinding({
			findings: isChangedScope ? requiredFindings : advisoryFindings,
			path,
			severity: isChangedScope ? "error" : "warning",
			message: ".harness lifecycle artifact is missing YAML frontmatter.",
			fix: "Add frontmatter with lifecycle_schema, source_type, authority, lifecycle_status, canonical_destination, owner, dates, validation, and dependencies.",
			classification: isChangedScope ? "required" : "advisory",
		});
		return;
	}
	const metadata = parsed as Partial<HarnessLifecycleMetadata>;
	const targetFindings = isChangedScope ? requiredFindings : advisoryFindings;
	const classification = isChangedScope ? "required" : "advisory";
	for (const key of REQUIRED_HARNESS_LIFECYCLE_KEYS) {
		if (metadata[key] === undefined || metadata[key] === null) {
			pushHarnessFinding({
				findings: targetFindings,
				path,
				severity: isChangedScope ? "error" : "warning",
				message: `.harness lifecycle artifact is missing ${key} metadata.`,
				fix: `Add ${key} to the artifact frontmatter.`,
				classification,
			});
		}
	}
	validateHarnessIdentity(path, metadata, targetFindings, classification);
	validateHarnessEnums(path, metadata, targetFindings, classification);
	validateHarnessArrays(path, metadata, targetFindings, classification);
	validateHarnessDates(path, metadata, targetFindings, classification);
	validateHarnessPromotion(path, metadata, targetFindings, classification);
}

function validateHarnessIdentity(
	path: string,
	metadata: Partial<HarnessLifecycleMetadata>,
	findings: DocLifecycleViolation[],
	classification: "required" | "advisory",
): void {
	const hasSchema =
		metadata.lifecycle_schema === HARNESS_DOCUMENT_LIFECYCLE_SCHEMA ||
		(metadata.artifact_schema !== undefined &&
			HARNESS_EXECUTION_ARTIFACT_SCHEMAS.has(metadata.artifact_schema)) ||
		metadata.schema_version !== undefined;
	if (!hasSchema) {
		pushHarnessFinding({
			findings,
			path,
			severity: classification === "required" ? "error" : "warning",
			message: ".harness lifecycle artifact is missing schema identity.",
			fix: `Add lifecycle_schema: ${HARNESS_DOCUMENT_LIFECYCLE_SCHEMA} or keep a recognized Harness artifact schema.`,
			classification,
		});
	}
	if (
		!metadata.artifact_id &&
		!metadata.artifact_type &&
		!metadata.canonical_slug &&
		!metadata.plan_id &&
		!metadata.selected_stage
	) {
		pushHarnessFinding({
			findings,
			path,
			severity: classification === "required" ? "error" : "warning",
			message: ".harness lifecycle artifact is missing artifact identity.",
			fix: "Add artifact_id, artifact_type, canonical_slug, plan_id, or selected_stage.",
			classification,
		});
	}
}

function validateHarnessEnums(
	path: string,
	metadata: Partial<HarnessLifecycleMetadata>,
	findings: DocLifecycleViolation[],
	classification: "required" | "advisory",
): void {
	for (const [value, allowed, label] of [
		[metadata.authority, HARNESS_AUTHORITIES, "authority"],
		[metadata.lifecycle_status, HARNESS_LIFECYCLE_STATUSES, "lifecycle_status"],
	] as const) {
		if (typeof value === "string" && !allowed.has(value)) {
			pushHarnessFinding({
				findings,
				path,
				severity: classification === "required" ? "error" : "warning",
				message: `.harness ${label} metadata is invalid.`,
				fix: `Use one of: ${[...allowed].join(", ")}.`,
				classification,
			});
		}
	}
}

function validateHarnessArrays(
	path: string,
	metadata: Partial<HarnessLifecycleMetadata>,
	findings: DocLifecycleViolation[],
	classification: "required" | "advisory",
): void {
	for (const key of ["validated_by", "depends_on"] as const) {
		const value = metadata[key];
		if (value !== undefined && (!Array.isArray(value) || value.length === 0)) {
			pushHarnessFinding({
				findings,
				path,
				severity: classification === "required" ? "error" : "warning",
				message: `${key} must be a non-empty array.`,
				fix: `Use a YAML list for ${key}.`,
				classification,
			});
		}
	}
}

function validateHarnessDates(
	path: string,
	metadata: Partial<HarnessLifecycleMetadata>,
	findings: DocLifecycleViolation[],
	classification: "required" | "advisory",
): void {
	for (const key of ["created", "last_reviewed"] as const) {
		const value = metadata[key];
		if (value && !DATE_PATTERN.test(value)) {
			pushHarnessFinding({
				findings,
				path,
				severity: classification === "required" ? "error" : "warning",
				message: `${key} must use YYYY-MM-DD format.`,
				fix: "Use an ISO date without a time component.",
				classification,
			});
		}
	}
}

function validateHarnessPromotion(
	path: string,
	metadata: Partial<HarnessLifecycleMetadata>,
	findings: DocLifecycleViolation[],
	classification: "required" | "advisory",
): void {
	if (
		(metadata.lifecycle_status === "distilled" ||
			metadata.lifecycle_status === "promoted" ||
			metadata.lifecycle_status === "execution-input") &&
		!metadata.canonical_destination
	) {
		pushHarnessFinding({
			findings,
			path,
			severity: classification === "required" ? "error" : "warning",
			message:
				"Routable .harness lifecycle artifacts must declare canonical_destination.",
			fix: "Add canonical_destination pointing at the promoted target or execution route.",
			classification,
		});
	}
	if (metadata.lifecycle_status === "superseded" && !metadata.superseded_by) {
		pushHarnessFinding({
			findings,
			path,
			severity: classification === "required" ? "error" : "warning",
			message: "Superseded .harness artifacts must declare superseded_by.",
			fix: "Add superseded_by pointing at the replacement artifact.",
			classification,
		});
	}
	if (metadata.lifecycle_status === "archived" && !metadata.archive_decision) {
		pushHarnessFinding({
			findings,
			path,
			severity: classification === "required" ? "error" : "warning",
			message: "Archived .harness artifacts must declare archive_decision.",
			fix: "Add archive_decision with the reviewed archive decision reference.",
			classification,
		});
	}
}

function isOptedIntoHarnessLifecycle(
	metadata: Partial<DocLifecycleMetadata>,
): boolean {
	const harnessMetadata = metadata as Partial<HarnessLifecycleMetadata>;
	return (
		harnessMetadata.lifecycle_schema === HARNESS_DOCUMENT_LIFECYCLE_SCHEMA ||
		harnessMetadata.lifecycle_status !== undefined
	);
}

function pushHarnessFinding(args: {
	findings: DocLifecycleViolation[];
	path: string;
	severity: "warning" | "error";
	message: string;
	fix: string;
	classification: "required" | "advisory";
}): void {
	args.findings.push({
		path: args.path,
		severity: args.severity,
		message: args.message,
		fix: args.fix,
		classification: args.classification,
	});
}
