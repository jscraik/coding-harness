import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";

const MAX_ARTIFACT_BYTES = 1_000_000;
type KnownJsonArtifact = {
	segments: readonly string[];
};

type ContainedJsonArtifact = {
	absolutePath: string;
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

/** Resolve an allowlisted artifact path only after repo containment checks pass. */
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
		const artifact = knownArtifact(artifactPath, allowedPaths);
		if (artifact === null || !hasSafeArtifactParents(realRepoRoot, artifact)) {
			return null;
		}
		const stat = lstatSync(absolutePath);
		if (!isReadableArtifactFile(stat)) return null;
		const realPath = realpathSync(absolutePath);
		if (escapesRepoRoot(realRepoRoot, realPath)) return null;
		return {
			absolutePath,
		};
	} catch {
		return null;
	}
}

/** Read the validated artifact path through a bounded no-follow file read. */
function readValidatedArtifactFile(file: ContainedJsonArtifact): string {
	try {
		const stat = lstatSync(file.absolutePath);
		if (!isReadableArtifactFile(stat)) return "";
		return readFileSync(file.absolutePath, {
			encoding: "utf8",
			flag: "r",
		});
	} catch {
		return "";
	}
}

/** Return the original artifact path when the allowlisted file currently exists. */
function existingArtifactPath(
	repoRoot: string,
	artifactPath: string,
	allowedPaths: readonly string[],
): string | null {
	try {
		const realRepoRoot = realpathSync(repoRoot);
		const artifact = knownArtifact(artifactPath, allowedPaths);
		if (artifact === null) return null;
		const absolutePath = [realRepoRoot, ...artifact.segments].join(sep);
		if (escapesRepoRoot(realRepoRoot, absolutePath)) return null;
		if (!hasSafeArtifactParents(realRepoRoot, artifact)) return null;
		lstatSync(absolutePath);
		return artifactPath;
	} catch {
		return null;
	}
}

function hasSafeArtifactParents(
	realRepoRoot: string,
	artifact: KnownJsonArtifact,
): boolean {
	let currentPath = realRepoRoot;
	for (const segment of artifact.segments.slice(0, -1)) {
		currentPath = [currentPath, segment].join(sep);
		if (escapesRepoRoot(realRepoRoot, currentPath)) return false;
		const stat = lstatSync(currentPath);
		if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
	}
	return true;
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
