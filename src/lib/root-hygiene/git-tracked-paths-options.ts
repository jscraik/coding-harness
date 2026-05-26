const GIT_LS_FILES_MAX_BUFFER_ENV =
	"ROOT_HYGIENE_GIT_LS_FILES_MAX_BUFFER_BYTES";

// git ls-files output is normally tiny; 10MB covers unusually large repos while
// keeping child-process buffer overflow failures explicit. Set the env var or
// pass maxBufferBytes when a very large tracked-path inventory needs more room.
const DEFAULT_GIT_LS_FILES_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

/** Optional git inventory tuning for unusually large repositories. */
export interface ReadGitTrackedPathsOptions {
	maxBufferBytes?: number;
}

/** Resolve the child-process buffer budget for git tracked-path inventory. */
export function gitLsFilesMaxBufferBytes(
	options: ReadGitTrackedPathsOptions,
): number {
	const configured = options.maxBufferBytes ?? gitLsFilesMaxBufferFromEnv();
	if (!Number.isInteger(configured) || configured <= 0) {
		throw new Error(
			`root-hygiene git ls-files maxBufferBytes must be a positive integer: ${configured}`,
		);
	}
	return configured;
}

function gitLsFilesMaxBufferFromEnv(): number {
	const value = process.env[GIT_LS_FILES_MAX_BUFFER_ENV];
	if (value === undefined) {
		return DEFAULT_GIT_LS_FILES_MAX_BUFFER_BYTES;
	}
	const trimmed = value.trim();
	if (trimmed === "") {
		return DEFAULT_GIT_LS_FILES_MAX_BUFFER_BYTES;
	}
	if (!/^\d+$/.test(trimmed)) {
		return NaN;
	}
	return Number.parseInt(trimmed, 10);
}
