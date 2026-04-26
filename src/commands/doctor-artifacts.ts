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

/** Return the canonical north-star surface classification artifact reference. */
export function createNorthStarSurfaceClassificationArtifactRef(): NorthStarSurfaceClassificationArtifactRef {
	return {
		type: "north-star-surface-classification",
		path: getNorthStarSurfaceClassificationSnapshotPath(),
		schemaVersion:
			NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.surfaceClassificationSnapshot,
	};
}

/** Return the canonical relative path for north-star surface classifications. */
export function getNorthStarSurfaceClassificationArtifactPath(): string {
	return getNorthStarSurfaceClassificationSnapshotPath();
}

function isNorthStarSurfaceCheck(check: DoctorCheck): boolean {
	return (
		check.id.includes("north-star") ||
		check.message.includes("north-star") ||
		check.message.includes("productSurface")
	);
}

function buildNorthStarSurfaceClassificationSnapshot(
	report: DoctorReport,
): NorthStarSurfaceClassificationSnapshot {
	const surfaces = report.checks.filter(isNorthStarSurfaceCheck);
	return {
		schemaVersion:
			NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.surfaceClassificationSnapshot,
		command: "doctor",
		generatedAt: report.timestamp,
		repoRoot: report.dir,
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

/** Write the canonical north-star surface classification artifact and return its path. */
export function writeNorthStarSurfaceClassificationSnapshot(
	repoRoot: string,
	report: DoctorReport,
): string {
	const artifactPath = getNorthStarSurfaceClassificationSnapshotPath();
	const resolvedArtifactPath = validatePath(repoRoot, artifactPath);
	mkdirSync(dirname(resolvedArtifactPath), { recursive: true });
	writeFileSync(
		resolvedArtifactPath,
		`${JSON.stringify(buildNorthStarSurfaceClassificationSnapshot(report), null, 2)}\n`,
		"utf-8",
	);
	return artifactPath;
}
