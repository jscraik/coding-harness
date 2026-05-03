import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
	NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS,
	getNorthStarSurfaceClassificationSnapshotPath,
} from "../lib/contract/north-star-artifacts.js";
import { validatePath } from "../lib/input/validator.js";
import type { DoctorCheck, DoctorReport } from "./doctor.js";

/** Reference to the canonical north-star surface classification artifact. */
export interface NorthStarSurfaceClassificationArtifactRef {
	type: "north-star-surface-classification";
	path: string;
	schemaVersion: typeof NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.surfaceClassificationSnapshot;
}

interface NorthStarSurfaceClassificationSnapshot {
	schemaVersion: typeof NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.surfaceClassificationSnapshot;
	command: "doctor";
	generatedAt: string;
	repoRoot: string;
	sourceReport: {
		version: string;
		generatedAt: string;
		hasFailures: boolean;
		counts: DoctorReport["counts"];
	};
	summary: {
		checkCount: number;
		okCount: number;
		warnCount: number;
		failCount: number;
		skipCount: number;
		northStarSurfaceCount: number;
	};
	surfaces: DoctorCheck[];
}

/**
 * Create the canonical north-star surface classification artifact reference.
 *
 * @returns A `NorthStarSurfaceClassificationArtifactRef` containing the canonical `path`, `type` set to `"north-star-surface-classification"`, and the snapshot `schemaVersion`
 */
export function createNorthStarSurfaceClassificationArtifactRef(): NorthStarSurfaceClassificationArtifactRef {
	return {
		type: "north-star-surface-classification",
		path: getNorthStarSurfaceClassificationSnapshotPath(),
		schemaVersion:
			NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.surfaceClassificationSnapshot,
	};
}

/**
 * Get the canonical relative artifact path for north-star surface classification snapshots.
 *
 * @returns The canonical relative path to the north-star surface classification snapshot artifact
 */
export function getNorthStarSurfaceClassificationArtifactPath(): string {
	return getNorthStarSurfaceClassificationSnapshotPath();
}

/**
 * Determines whether a DoctorCheck pertains to a north-star surface.
 *
 * @param check - The check to evaluate
 * @returns `true` if the check's `id` or `message` contains `"north-star"`, or the `message` contains `"productSurface"`, `false` otherwise.
 */
function isNorthStarSurfaceCheck(check: DoctorCheck): boolean {
	const idLower = check.id?.toLowerCase() ?? "";
	const messageLower = check.message?.toLowerCase() ?? "";
	return (
		idLower.includes("north-star") ||
		messageLower.includes("north-star") ||
		messageLower.includes("productsurface")
	);
}

/**
 * Builds a North Star surface classification snapshot from a doctor report.
 *
 * @param report - The doctor run report providing provenance, aggregated counts, and checks to classify
 * @returns The constructed `NorthStarSurfaceClassificationSnapshot` containing schema metadata, repository and report provenance, a summary of counts (including `northStarSurfaceCount`), and the filtered `surfaces` array
 */
function buildNorthStarSurfaceClassificationSnapshot(
	report: DoctorReport,
	repoRoot: string,
): NorthStarSurfaceClassificationSnapshot {
	const surfaces = report.checks.filter(isNorthStarSurfaceCheck);
	return {
		schemaVersion:
			NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.surfaceClassificationSnapshot,
		command: "doctor",
		generatedAt: report.timestamp,
		repoRoot,
		sourceReport: {
			version: report.version,
			generatedAt: report.timestamp,
			hasFailures: report.hasFailures,
			counts: report.counts,
		},
		summary: {
			checkCount: report.checks.length,
			okCount: report.counts.ok,
			warnCount: report.counts.warn,
			failCount: report.counts.fail,
			skipCount: report.counts.skip,
			northStarSurfaceCount: surfaces.length,
		},
		surfaces,
	};
}

/**
 * Write the canonical north-star surface classification snapshot artifact to disk.
 *
 * @param repoRoot - Repository root used to resolve the artifact output location
 * @param report - Doctor report used to build the snapshot
 * @returns The canonical relative artifact path where the snapshot was written
 */
export function writeNorthStarSurfaceClassificationSnapshot(
	repoRoot: string,
	report: DoctorReport,
): string {
	const artifactPath = getNorthStarSurfaceClassificationSnapshotPath();
	const resolvedArtifactPath = validatePath(repoRoot, artifactPath);
	mkdirSync(dirname(resolvedArtifactPath), { recursive: true });
	writeFileSync(
		resolvedArtifactPath,
		`${JSON.stringify(buildNorthStarSurfaceClassificationSnapshot(report, repoRoot), null, 2)}\n`,
		"utf-8",
	);
	return artifactPath;
}
