import {
	closeSync,
	constants,
	fstatSync,
	lstatSync,
	openSync as openReportNoFollow,
	readSync,
	realpathSync,
} from "node:fs";
import { isAbsolute, relative, sep } from "node:path";

const MAX_ARTIFACT_BYTES = 1_000_000;
const ARTIFACT_OPEN_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW;

type KnownJsonArtifact = {
	segments: readonly string[];
};

type ContainedJsonArtifact = {
	realPath: string;
};

/** Return discovered JSON artifact paths within the repo boundary. */
export function jsonArtifactEvidence(
	repoRoot: string,
	allowedPaths: readonly string[],
): string[] {
	return allowedPaths.filter(
		(artifactPath) =>
			existingArtifactPath(repoRoot, artifactPath, allowedPaths) !== null,
	);
}

/** Read an allowed JSON artifact through a bounded no-follow descriptor. */
export function readJsonArtifact(
	repoRoot: string,
	artifactPath: string,
	allowedPaths: readonly string[],
): string {
	const file = containedArtifactFile(repoRoot, artifactPath, allowedPaths);
	return file === null ? "" : readValidatedArtifactFile(file);
}

function containedArtifactFile(
	repoRoot: string,
	artifactPath: string,
	allowedPaths: readonly string[],
): ContainedJsonArtifact | null {
	try {
		const realRepoRoot = realpathSync(repoRoot);
		const absolutePath = knownArtifactAbsolutePath(
			realRepoRoot,
			artifactPath,
			allowedPaths,
		);
		if (absolutePath === null || escapesRepoRoot(realRepoRoot, absolutePath)) {
			return null;
		}
		const stat = lstatSync(absolutePath);
		if (!isReadableArtifactFile(stat)) return null;
		const realPath = realpathSync(absolutePath);
		if (escapesRepoRoot(realRepoRoot, realPath)) return null;
		if (knownArtifact(artifactPath, allowedPaths) === null) return null;
		return {
			realPath,
		};
	} catch {
		return null;
	}
}

function readValidatedArtifactFile(file: ContainedJsonArtifact): string {
	let fileDescriptor: number | null = null;
	try {
		fileDescriptor = openReportNoFollow(file.realPath, ARTIFACT_OPEN_FLAGS);
		const stat = fstatSync(fileDescriptor);
		if (!isReadableArtifactFile(stat)) return "";
		const buffer = Buffer.alloc(stat.size);
		const bytesRead = readSync(fileDescriptor, buffer, 0, buffer.length, 0);
		return buffer.subarray(0, bytesRead).toString("utf8");
	} catch {
		return "";
	} finally {
		if (fileDescriptor !== null) {
			closeSync(fileDescriptor);
		}
	}
}

function existingArtifactPath(
	repoRoot: string,
	artifactPath: string,
	allowedPaths: readonly string[],
): string | null {
	try {
		const realRepoRoot = realpathSync(repoRoot);
		if (isInvalidArtifactPath(artifactPath)) {
			return null;
		}
		const absolutePath = knownArtifactAbsolutePath(
			realRepoRoot,
			artifactPath,
			allowedPaths,
		);
		if (absolutePath === null) return null;
		if (escapesRepoRoot(realRepoRoot, absolutePath)) return null;
		lstatSync(absolutePath);
		return artifactPath;
	} catch {
		return null;
	}
}

function isInvalidArtifactPath(artifactPath: string): boolean {
	return typeof artifactPath !== "string" || /[\r\n\0]/.test(artifactPath);
}

function isReadableArtifactFile(stat: {
	isSymbolicLink(): boolean;
	isFile(): boolean;
	size: number;
}): boolean {
	return (
		!stat.isSymbolicLink() && stat.isFile() && stat.size <= MAX_ARTIFACT_BYTES
	);
}

function knownArtifactAbsolutePath(
	realRepoRoot: string,
	artifactPath: string,
	allowedPaths: readonly string[],
): string | null {
	const artifact = knownArtifact(artifactPath, allowedPaths);
	return artifact === null
		? null
		: [realRepoRoot, ...artifact.segments].join(sep);
}

function knownArtifact(
	artifactPath: string,
	allowedPaths: readonly string[],
): KnownJsonArtifact | null {
	if (!allowedPaths.includes(artifactPath)) return null;
	if (isInvalidArtifactPath(artifactPath)) return null;
	const segments = artifactPath.split("/");
	if (segments.some((segment) => segment.length === 0 || segment === "..")) {
		return null;
	}
	return { segments };
}

function escapesRepoRoot(repoRoot: string, absolutePath: string): boolean {
	const relativePath = relative(repoRoot, absolutePath);
	return (
		relativePath === ".." ||
		relativePath.startsWith(`..${sep}`) ||
		isAbsolute(relativePath)
	);
}
