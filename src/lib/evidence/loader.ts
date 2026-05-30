import { existsSync, statSync } from "node:fs";
import { realpathSync } from "node:fs";
import {
	basename,
	dirname,
	isAbsolute,
	normalize,
	relative,
	resolve,
} from "node:path";

/** Evidence path resolution status for repo-contained artifact references. */
export type EvidencePathResolutionStatus =
	| "valid"
	| "missing_file"
	| "missing_parent"
	| "outside_repo";

/** Resolved evidence path metadata and blocker details. */
export interface EvidencePathResolution {
	/** Classification for the requested path. */
	status: EvidencePathResolutionStatus;
	/** Original caller-provided path. */
	inputPath: string;
	/** Absolute path produced from the repo root and input path. */
	absolutePath: string;
	/** Real path for the evidence file when it exists and can be resolved. */
	realPath: string | null;
	/** Real path for the parent directory when it can be resolved. */
	parentRealPath: string | null;
	/** File size when the evidence file exists and is repo-contained. */
	sizeBytes: number | null;
	/** Human-readable blocker for non-valid statuses. */
	blocker: string | null;
}

/**
 * Resolve a repo-contained evidence artifact path in one typed result.
 */
export function resolveEvidencePath(
	repoRoot: string,
	userPath: string,
): EvidencePathResolution {
	const repoRealPath = getRealPath(repoRoot);
	const absolutePath = resolvePath(repoRealPath ?? repoRoot, userPath);
	const parentRealPath = getParentRealPath(absolutePath);
	const inputPath = userPath;
	if (!repoRealPath || !parentRealPath) {
		return {
			status: "missing_parent",
			inputPath,
			absolutePath,
			realPath: null,
			parentRealPath,
			sizeBytes: null,
			blocker: "Evidence parent directory could not be resolved.",
		};
	}
	if (!isContainedPath(repoRealPath, absolutePath)) {
		return {
			status: "outside_repo",
			inputPath,
			absolutePath,
			realPath: null,
			parentRealPath,
			sizeBytes: null,
			blocker: "Evidence path resolves outside the repository.",
		};
	}
	if (!isContainedPath(repoRealPath, parentRealPath)) {
		return {
			status: "outside_repo",
			inputPath,
			absolutePath,
			realPath: null,
			parentRealPath,
			sizeBytes: null,
			blocker: "Evidence parent directory resolves outside the repository.",
		};
	}
	const realPath = getRealPath(absolutePath);
	if (!realPath) {
		return {
			status: "missing_file",
			inputPath,
			absolutePath,
			realPath: null,
			parentRealPath,
			sizeBytes: null,
			blocker: `Evidence file does not exist: ${basename(absolutePath)}`,
		};
	}
	if (!isContainedPath(repoRealPath, realPath)) {
		return {
			status: "outside_repo",
			inputPath,
			absolutePath,
			realPath,
			parentRealPath,
			sizeBytes: null,
			blocker: "Evidence file resolves outside the repository.",
		};
	}
	return {
		status: "valid",
		inputPath,
		absolutePath,
		realPath,
		parentRealPath,
		sizeBytes: getFileSize(realPath),
		blocker: null,
	};
}

/**
 * Check if a file exists at the given path.
 */
export function fileExists(filePath: string): boolean {
	try {
		return existsSync(filePath);
	} catch {
		return false;
	}
}

/**
 * Get file size in bytes, or null if file doesn't exist.
 */
export function getFileSize(filePath: string): number | null {
	try {
		const stats = statSync(filePath);
		return stats.size;
	} catch {
		return null;
	}
}

/**
 * Resolve a path relative to a base directory with normalization.
 */
export function resolvePath(baseDir: string, userPath: string): string {
	return resolve(baseDir, normalize(userPath));
}

/**
 * Get the real (canonical) path, handling symlinks.
 * Returns null if the path doesn't exist.
 */
export function getRealPath(filePath: string): string | null {
	try {
		return realpathSync(filePath);
	} catch {
		return null;
	}
}

/**
 * Get the real path of the parent directory.
 * Returns null if the parent doesn't exist.
 */
export function getParentRealPath(filePath: string): string | null {
	try {
		const parent = dirname(filePath);
		return realpathSync(parent);
	} catch {
		return null;
	}
}

function isContainedPath(parentPath: string, childPath: string): boolean {
	const pathFromParent = relative(parentPath, childPath);
	return (
		pathFromParent === "" ||
		(!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent))
	);
}
