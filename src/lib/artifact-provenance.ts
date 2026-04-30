import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, normalize, relative, resolve } from "node:path";

export const DEFAULT_ARTIFACT_PROVENANCE_REGISTRY =
	".harness/artifact-provenance.json";

/** Enforcement level for a registered generated artifact. */
export type ArtifactProvenanceEnforcement = "advisory" | "required";

/** Registry entry that maps one generated artifact to its source of truth. */
export interface ArtifactProvenanceEntry {
	/** Generated artifact path relative to the repository root. */
	path: string;
	/** Source or template path that should change with the generated artifact. */
	source: string;
	/** Optional command that checks generated output is synchronized. */
	checkCommand?: string | undefined;
	/** Optional command that regenerates the artifact from its source. */
	writeCommand?: string | undefined;
	/** Human review policy for this artifact relationship. */
	reviewPolicy?: string | undefined;
	/** Whether source-drift findings are advisory or blocking. */
	enforcement?: ArtifactProvenanceEnforcement | undefined;
	/** Optional human-readable context for operators and reviewers. */
	description?: string | undefined;
}

/** Versioned artifact provenance registry consumed by artifact-gate. */
export interface ArtifactProvenanceRegistry {
	/** Schema version for artifact provenance data. */
	schemaVersion: "artifact-provenance/v1";
	/** Generated artifacts tracked by the registry. */
	artifacts: ArtifactProvenanceEntry[];
}

/** Top-level artifact-gate outcome. */
export type ArtifactGateStatus = "pass" | "warn" | "fail";
/** Severity for a single artifact-gate finding. */
export type ArtifactGateSeverity = "info" | "warning" | "error";

/** Structured artifact-gate finding emitted for changed artifacts. */
export interface ArtifactGateFinding {
	/** Stable finding identifier. */
	id: string;
	/** Finding severity. */
	severity: ArtifactGateSeverity;
	/** Human-readable finding message. */
	message: string;
	/** Changed artifact path when applicable. */
	path?: string | undefined;
	/** Expected source/template path when applicable. */
	source?: string | undefined;
	/** Optional command that checks synchronization. */
	checkCommand?: string | undefined;
	/** Optional command that regenerates the artifact. */
	writeCommand?: string | undefined;
	/** Review policy associated with the registry entry. */
	reviewPolicy?: string | undefined;
	/** Enforcement level associated with the registry entry. */
	enforcement?: ArtifactProvenanceEnforcement | undefined;
	/** Suggested remediation text. */
	fix?: string | undefined;
}

/** Machine-readable result envelope for artifact-gate. */
export interface ArtifactGateResult {
	/** Schema version for artifact-gate output. */
	schemaVersion: "artifact-gate/v1";
	/** Aggregate gate status. */
	status: ArtifactGateStatus;
	/** Registry path used for evaluation. */
	registry: string;
	/** Normalized changed files passed to the gate. */
	changedFiles: string[];
	/** Findings emitted by the gate. */
	findings: ArtifactGateFinding[];
	/** Aggregate finding counts and registry size. */
	summary: {
		/** Blocking finding count. */
		errors: number;
		/** Advisory finding count. */
		warnings: number;
		/** Informational finding count. */
		info: number;
		/** Total finding count. */
		total: number;
		/** Number of artifacts tracked by the loaded registry. */
		trackedArtifacts: number;
	};
}

/** Options for running artifact-gate programmatically. */
export interface RunArtifactGateOptions {
	/** Repository root used to resolve relative paths. */
	repoRoot?: string | undefined;
	/** Changed files to evaluate. */
	files: string[];
	/** Optional registry path; defaults to .harness/artifact-provenance.json. */
	registryPath?: string | undefined;
}

interface LoadRegistryResult {
	ok: boolean;
	registry?: ArtifactProvenanceRegistry;
	finding?: ArtifactGateFinding;
}

/**
 * Produces an artifact gate result by comparing provided changed files to the artifact provenance registry.
 *
 * @param options - Options controlling the run. `options.files` is the list of file paths to evaluate (these are normalized to repo-relative forward-slash paths). `options.repoRoot` overrides the repository root used for path resolution (defaults to the current working directory). `options.registryPath` overrides the registry file path (defaults to .harness/artifact-provenance.json).
 * @returns An ArtifactGateResult containing the normalized registry path, the normalized and sorted unique changed files, collected findings describing synchronized or drifting artifacts, counts of errors/warnings/info, the overall gate status (`pass`/`warn`/`fail`), and the number of tracked artifacts.
 */
export function runArtifactGate(
	options: RunArtifactGateOptions,
): ArtifactGateResult {
	const repoRoot = options.repoRoot ?? process.cwd();
	const registryPath =
		options.registryPath ?? DEFAULT_ARTIFACT_PROVENANCE_REGISTRY;
	const changedFiles = [
		...new Set(
			options.files.map((file) => normalizeRepoRelativePath(file, repoRoot)),
		),
	].sort();
	const changedFileSet = new Set(changedFiles);
	const loaded = loadArtifactProvenanceRegistry(repoRoot, registryPath);
	const findings: ArtifactGateFinding[] = [];

	if (!loaded.ok) {
		if (loaded.finding) findings.push(loaded.finding);
		return buildArtifactGateResult({
			registry: normalizeRepoRelativePath(registryPath, repoRoot),
			changedFiles,
			findings,
			trackedArtifacts: 0,
		});
	}

	for (const artifact of loaded.registry?.artifacts ?? []) {
		const artifactPath = normalizeRepoRelativePath(artifact.path, repoRoot);
		const sourcePath = normalizeRepoRelativePath(artifact.source, repoRoot);
		const artifactChanged = changedFileSet.has(artifactPath);
		const sourceChanged = changedFileSet.has(sourcePath);
		if (!artifactChanged && !sourceChanged) continue;
		if (artifactChanged && sourceChanged) {
			findings.push({
				id: "artifact-gate.source.synced",
				severity: "info",
				message: `${artifactPath} changed with its source ${sourcePath}.`,
				path: artifactPath,
				source: sourcePath,
				checkCommand: artifact.checkCommand,
				writeCommand: artifact.writeCommand,
				reviewPolicy: artifact.reviewPolicy,
				enforcement: artifact.enforcement ?? "advisory",
			});
			continue;
		}

		const enforcement = artifact.enforcement ?? "advisory";
		if (sourceChanged) {
			findings.push({
				id: "artifact-gate.source_without_generated",
				severity: enforcement === "required" ? "error" : "warning",
				message: `${sourcePath} is registered as the source for generated artifact ${artifactPath}, but the generated artifact was not changed.`,
				path: sourcePath,
				source: artifactPath,
				checkCommand: artifact.checkCommand,
				writeCommand: artifact.writeCommand,
				reviewPolicy: artifact.reviewPolicy,
				enforcement,
				fix: buildSourceOnlyFix(sourcePath, artifactPath, artifact),
			});
			continue;
		}
		findings.push({
			id: "artifact-gate.generated_without_source",
			severity: enforcement === "required" ? "error" : "warning",
			message: `${artifactPath} is registered as a generated artifact but ${sourcePath} was not changed.`,
			path: artifactPath,
			source: sourcePath,
			checkCommand: artifact.checkCommand,
			writeCommand: artifact.writeCommand,
			reviewPolicy: artifact.reviewPolicy,
			enforcement,
			fix: buildArtifactFix(artifactPath, sourcePath, artifact),
		});
	}

	return buildArtifactGateResult({
		registry: normalizeRepoRelativePath(registryPath, repoRoot),
		changedFiles,
		findings,
		trackedArtifacts: loaded.registry?.artifacts.length ?? 0,
	});
}

/**
 * Loads and validates an artifact provenance registry file from disk.
 *
 * @param repoRoot - Repository root path used to resolve relative registry paths
 * @param registryPath - Path to the registry file (absolute or repo-relative)
 * @returns An object with `ok: true` and the parsed `registry` when a valid registry is found; otherwise `ok: false` and a `finding` describing why the registry is missing, unreadable, or invalid
 */
function loadArtifactProvenanceRegistry(
	repoRoot: string,
	registryPath: string,
): LoadRegistryResult {
	const resolvedPath = resolveRegistryPath(repoRoot, registryPath);
	if (!existsSync(resolvedPath)) {
		return {
			ok: false,
			finding: {
				id: "artifact-gate.registry.missing",
				severity: "warning",
				message:
					"Artifact provenance registry is missing; generated artifact checks are advisory until a registry is adopted.",
				path: normalizeRepoRelativePath(registryPath, repoRoot),
				fix: `Create ${DEFAULT_ARTIFACT_PROVENANCE_REGISTRY} with generated artifact source mappings.`,
			},
		};
	}

	try {
		const parsed = JSON.parse(readFileSync(resolvedPath, "utf-8")) as unknown;
		if (!isArtifactProvenanceRegistry(parsed)) {
			return {
				ok: false,
				finding: {
					id: "artifact-gate.registry.invalid",
					severity: "error",
					message:
						"Artifact provenance registry must use schemaVersion artifact-provenance/v1 and an artifacts array.",
					path: normalizeRepoRelativePath(registryPath, repoRoot),
				},
			};
		}
		return { ok: true, registry: parsed };
	} catch (error) {
		return {
			ok: false,
			finding: {
				id: "artifact-gate.registry.read_failed",
				severity: "error",
				message: `Could not read artifact provenance registry: ${error instanceof Error ? error.message : String(error)}`,
				path: normalizeRepoRelativePath(registryPath, repoRoot),
			},
		};
	}
}

/**
 * Builds a normalized artifact gate result envelope summarizing findings and changed files.
 *
 * @param registry - Repo-relative normalized path of the provenance registry used for the check
 * @param changedFiles - Unique, sorted, repo-relative forward-slash paths of changed files
 * @param findings - Collected artifact gate findings to include in the result
 * @param trackedArtifacts - Number of artifacts recorded in the provided registry
 * @returns An ArtifactGateResult envelope with `schemaVersion: "artifact-gate/v1"`, the provided `registry`, `changedFiles`, and `findings`. The `status` is `fail` if any finding has severity `error`, otherwise `warn` if any finding has severity `warning`, otherwise `pass`. The `summary` includes counts for `errors`, `warnings`, `info`, `total` (total findings), and `trackedArtifacts`.
 */
function buildArtifactGateResult(input: {
	registry: string;
	changedFiles: string[];
	findings: ArtifactGateFinding[];
	trackedArtifacts: number;
}): ArtifactGateResult {
	const errors = input.findings.filter(
		(finding) => finding.severity === "error",
	).length;
	const warnings = input.findings.filter(
		(finding) => finding.severity === "warning",
	).length;
	const info = input.findings.filter(
		(finding) => finding.severity === "info",
	).length;
	return {
		schemaVersion: "artifact-gate/v1",
		status: errors > 0 ? "fail" : warnings > 0 ? "warn" : "pass",
		registry: input.registry,
		changedFiles: input.changedFiles,
		findings: input.findings,
		summary: {
			errors,
			warnings,
			info,
			total: input.findings.length,
			trackedArtifacts: input.trackedArtifacts,
		},
	};
}

/**
 * Type guard that determines whether a value conforms to the `artifact-provenance/v1` registry schema.
 *
 * @param value - The value to validate
 * @returns `true` if `value` has `schemaVersion` equal to `"artifact-provenance/v1"` and an `artifacts` array of valid entries, `false` otherwise.
 */
function isArtifactProvenanceRegistry(
	value: unknown,
): value is ArtifactProvenanceRegistry {
	if (!isRecord(value)) return false;
	if (value.schemaVersion !== "artifact-provenance/v1") return false;
	if (!Array.isArray(value.artifacts)) return false;
	return value.artifacts.every(isArtifactProvenanceEntry);
}

/**
 * Determines whether a value conforms to the ArtifactProvenanceEntry shape.
 *
 * Checks that required `path` and `source` properties are strings, that
 * `enforcement` (if present) is `"advisory"` or `"required"`, and that
 * optional fields `checkCommand`, `writeCommand`, `reviewPolicy`, and
 * `description` (if present) are strings.
 *
 * @param value - The value to validate as an ArtifactProvenanceEntry
 * @returns `true` if `value` matches the ArtifactProvenanceEntry shape, `false` otherwise.
 */
function isArtifactProvenanceEntry(
	value: unknown,
): value is ArtifactProvenanceEntry {
	if (!isRecord(value)) return false;
	if (typeof value.path !== "string" || typeof value.source !== "string") {
		return false;
	}
	if (
		value.enforcement !== undefined &&
		value.enforcement !== "advisory" &&
		value.enforcement !== "required"
	) {
		return false;
	}
	if (
		value.checkCommand !== undefined &&
		typeof value.checkCommand !== "string"
	) {
		return false;
	}
	if (
		value.writeCommand !== undefined &&
		typeof value.writeCommand !== "string"
	) {
		return false;
	}
	if (
		value.reviewPolicy !== undefined &&
		typeof value.reviewPolicy !== "string"
	) {
		return false;
	}
	if (
		value.description !== undefined &&
		typeof value.description !== "string"
	) {
		return false;
	}
	return true;
}

/**
 * Determine whether a value is a non-null object that is not an array.
 *
 * @param value - The value to test
 * @returns `true` if `value` is an object, not `null`, and not an array; `false` otherwise.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalize a filesystem path to a repository-relative, forward-slash path without a leading "./".
 *
 * @param path - The input path; may be absolute or already repo-relative.
 * @param repoRoot - Repository root used to convert an absolute `path` into a repo-relative path.
 * @returns The normalized repo-relative path with Windows backslashes converted to `/` and any leading `./` removed.
 */
function normalizeRepoRelativePath(path: string, repoRoot: string): string {
	const relativePath = isAbsolute(path)
		? relative(repoRoot, path)
		: relative(repoRoot, resolve(repoRoot, path));
	return normalize(relativePath).replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Resolve a registry path to an absolute filesystem path.
 *
 * @param repoRoot - Base directory used when `registryPath` is relative.
 * @param registryPath - Absolute path or a path relative to `repoRoot`.
 * @returns The resolved absolute filesystem path to the registry.
 */
function resolveRegistryPath(repoRoot: string, registryPath: string): string {
	return isAbsolute(registryPath)
		? registryPath
		: resolve(repoRoot, registryPath);
}

/**
 * Builds a human-readable remediation message for resolving drift between a generated artifact and its source.
 *
 * @param artifactPath - Repo-relative path to the generated artifact
 * @param sourcePath - Repo-relative path to the source or template that should produce the artifact
 * @param artifact - Registry entry that may contain `writeCommand` or `checkCommand` used to tailor the remediation
 * @returns A remediation message advising how to update the source or run the entry's commands to regenerate or verify the artifact
 */
function buildArtifactFix(
	artifactPath: string,
	sourcePath: string,
	artifact: ArtifactProvenanceEntry,
): string {
	if (artifact.writeCommand) {
		return `Update ${sourcePath}, then run ${artifact.writeCommand} to regenerate ${artifactPath}.`;
	}
	if (artifact.checkCommand) {
		return `Update ${sourcePath}, then run ${artifact.checkCommand} to confirm ${artifactPath} is synchronized.`;
	}
	return `Update ${sourcePath} alongside ${artifactPath}, or document why this generated artifact change is intentional.`;
}

/**
 * Constructs a short remediation message for when only the source file changed.
 *
 * @param sourcePath - Repo-relative path to the source/template file that changed
 * @param artifactPath - Repo-relative path to the generated artifact affected by the source
 * @param artifact - The registry entry for the artifact (may contain `writeCommand` or `checkCommand` used to tailor the message)
 * @returns A concise instruction string advising how to remediate the mismatch between the source and its generated artifact
 */
function buildSourceOnlyFix(
	sourcePath: string,
	artifactPath: string,
	artifact: ArtifactProvenanceEntry,
): string {
	if (artifact.writeCommand) {
		return `Run ${artifact.writeCommand} after changing ${sourcePath} so ${artifactPath} is regenerated.`;
	}
	if (artifact.checkCommand) {
		return `Update ${artifactPath}, then run ${artifact.checkCommand} to confirm it is synchronized with ${sourcePath}.`;
	}
	return `Update ${artifactPath} alongside ${sourcePath}, or document why this source-only change is intentional.`;
}
