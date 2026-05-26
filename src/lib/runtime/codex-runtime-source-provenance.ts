/** One pinned Codex source file used to justify a runtime-evidence decision. */
export interface CodexRuntimeSourceSnapshotFile {
	/** Absolute or repo-relative source path observed during intent review. */
	path: string;
	/** Codex repository commit SHA where this source observation was captured. */
	repoHeadSha: string;
	/** Git blob SHA for the source file at repoHeadSha. */
	gitBlobSha: string;
}

/** Pinned source snapshot used to block stale Codex-runtime assumptions. */
export interface CodexRuntimeSourceSnapshot {
	/** Absolute path to the Codex checkout used as source evidence. */
	repoPath: string;
	/** Codex repository commit SHA observed by the coordinator. */
	repoHeadSha: string;
	/** Source files that were inspected to select a bridge boundary. */
	files: CodexRuntimeSourceSnapshotFile[];
}

/** Observed source state from the active Codex checkout. */
export interface CodexRuntimeObservedSourceSnapshot {
	/** Current Codex repository commit SHA. */
	repoHeadSha: string;
	/** Current git blob SHA keyed by source path. */
	gitBlobShas: Record<string, string>;
}

/** Finding emitted when an observed Codex source snapshot no longer matches intent. */
export interface CodexRuntimeSourceSnapshotFinding {
	/** Machine-stable finding code. */
	code: string;
	/** Path or field that drifted. */
	path: string;
	/** Human-readable explanation for review artifacts. */
	message: string;
}

/** Result of comparing pinned source evidence with current source observations. */
export interface CodexRuntimeSourceSnapshotValidationResult {
	/** True when all pinned source observations still match. */
	valid: boolean;
	/** Drift or invalid-shape findings. */
	findings: CodexRuntimeSourceSnapshotFinding[];
}

/** Compare pinned Codex source evidence with an observed checkout snapshot. */
export function validateCodexRuntimeSourceSnapshot(
	expected: CodexRuntimeSourceSnapshot,
	observed: CodexRuntimeObservedSourceSnapshot,
): CodexRuntimeSourceSnapshotValidationResult {
	const findings = [
		...validateSnapshotIdentity(expected, observed),
		...validatePinnedSourceFiles(expected, observed),
	];
	return { valid: findings.length === 0, findings };
}

function validateSnapshotIdentity(
	expected: CodexRuntimeSourceSnapshot,
	observed: CodexRuntimeObservedSourceSnapshot,
): CodexRuntimeSourceSnapshotFinding[] {
	const findings: CodexRuntimeSourceSnapshotFinding[] = [];
	if (expected.repoPath.trim().length === 0) {
		findings.push({
			code: "codex_source_repo_path_missing",
			path: "repoPath",
			message: "Codex source snapshot requires a repoPath.",
		});
	}
	if (expected.repoHeadSha.trim().length === 0) {
		findings.push({
			code: "codex_source_expected_head_missing",
			path: "repoHeadSha",
			message: "Codex source snapshot requires an expected repoHeadSha.",
		});
	}
	if (observed.repoHeadSha.trim().length === 0) {
		findings.push({
			code: "codex_source_observed_head_missing",
			path: "observed.repoHeadSha",
			message: "Observed Codex source snapshot requires repoHeadSha.",
		});
	}
	if (
		expected.repoHeadSha.trim().length > 0 &&
		observed.repoHeadSha.trim().length > 0 &&
		expected.repoHeadSha !== observed.repoHeadSha
	) {
		findings.push({
			code: "codex_source_head_mismatch",
			path: "repoHeadSha",
			message:
				"Observed Codex source HEAD does not match pinned intent evidence.",
		});
	}
	return findings;
}

function validatePinnedSourceFiles(
	expected: CodexRuntimeSourceSnapshot,
	observed: CodexRuntimeObservedSourceSnapshot,
): CodexRuntimeSourceSnapshotFinding[] {
	const findings: CodexRuntimeSourceSnapshotFinding[] = [];
	if (expected.files.length === 0) {
		findings.push({
			code: "codex_source_files_missing",
			path: "files",
			message:
				"Codex source snapshot requires at least one pinned source file.",
		});
	}
	for (const [index, file] of expected.files.entries()) {
		const path = `files[${index}]`;
		if (file.path.trim().length === 0) {
			findings.push({
				code: "codex_source_file_path_missing",
				path: `${path}.path`,
				message: "Pinned Codex source file path must be non-empty.",
			});
			continue;
		}
		if (file.repoHeadSha !== expected.repoHeadSha) {
			findings.push({
				code: "codex_source_file_head_mismatch",
				path: `${path}.repoHeadSha`,
				message:
					"Pinned source file repoHeadSha must match the snapshot repoHeadSha.",
			});
		}
		if (file.gitBlobSha.trim().length === 0) {
			findings.push({
				code: "codex_source_blob_missing",
				path: `${path}.gitBlobSha`,
				message: "Pinned Codex source file requires a gitBlobSha.",
			});
			continue;
		}
		const observedBlobSha = observed.gitBlobShas[file.path];
		if (observedBlobSha === undefined) {
			findings.push({
				code: "codex_source_blob_observation_missing",
				path: `${path}.gitBlobSha`,
				message:
					"Observed Codex source snapshot is missing a pinned file blob.",
			});
			continue;
		}
		if (observedBlobSha !== file.gitBlobSha) {
			findings.push({
				code: "codex_source_blob_mismatch",
				path: `${path}.gitBlobSha`,
				message:
					"Observed Codex source file blob does not match pinned intent evidence.",
			});
		}
	}
	return findings;
}
