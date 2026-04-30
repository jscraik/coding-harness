import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

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

/** Evaluate changed files against the artifact provenance registry. */
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

function isArtifactProvenanceRegistry(
	value: unknown,
): value is ArtifactProvenanceRegistry {
	if (!isRecord(value)) return false;
	if (value.schemaVersion !== "artifact-provenance/v1") return false;
	if (!Array.isArray(value.artifacts)) return false;
	return value.artifacts.every(isArtifactProvenanceEntry);
}

function isArtifactProvenanceEntry(
	value: unknown,
): value is ArtifactProvenanceEntry {
	if (!isRecord(value)) return false;
	return typeof value.path === "string" && typeof value.source === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRepoRelativePath(path: string, repoRoot: string): string {
	const relativePath = isAbsolute(path) ? relative(repoRoot, path) : path;
	return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function resolveRegistryPath(repoRoot: string, registryPath: string): string {
	return isAbsolute(registryPath)
		? registryPath
		: resolve(repoRoot, registryPath);
}

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
