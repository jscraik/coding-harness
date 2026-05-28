/** Status for the read-only session-context orientation packet. */
export type SessionContextStatus = "pass" | "warn" | "fail";

/** Freshness classification for local orientation evidence. */
export type SessionContextFreshness =
	| "current"
	| "stale"
	| "missing"
	| "unknown"
	| "not_applicable";

/** Bounded use of session-context evidence. */
export type SessionContextEvidenceUse = "orientation";

/** Runtime emission status for session-context/v1. */
export type SessionContextRuntimeStatus = "emitted";

/** Changed git path included in the local worktree projection. */
export interface SessionContextChangedFile {
	path: string;
	status: string;
}

/** Repo-local artifact pointer with no embedded file contents. */
export interface SessionContextArtifactRef {
	path: string;
	status: SessionContextStatus;
	source: string;
	sizeBytes?: number;
}

/** Stale or missing evidence classification. */
export interface SessionContextStaleState {
	surface: string;
	freshness: SessionContextFreshness;
	reason: string | null;
}

/** Next safe read-only action an agent can take from this packet. */
export interface SessionContextTraversalHint {
	label: string;
	command: string;
	reason: string;
}

/** Versioned read-only packet for current local session/workstream orientation. */
export interface SessionContextReport {
	schemaVersion: "session-context/v1";
	generatedAt: string;
	producer: "harness:session-context";
	status: SessionContextStatus;
	evidenceUse: SessionContextEvidenceUse;
	runtimeStatus: SessionContextRuntimeStatus;
	repository: string;
	repoRoot: string;
	issueRef: string | null;
	branch: string | null;
	headSha: string | null;
	changedFiles: SessionContextChangedFile[];
	activeArtifacts: SessionContextArtifactRef[];
	runtimeCards: SessionContextArtifactRef[];
	reviewArtifacts: SessionContextArtifactRef[];
	sessionEvidence: SessionContextArtifactRef[];
	staleState: SessionContextStaleState[];
	nextTraversalHints: SessionContextTraversalHint[];
}

/** Versioned usage-error payload for invalid session-context CLI arguments. */
export interface SessionContextUsageError {
	schemaVersion: "session-context-error/v1";
	status: "error";
	error: {
		code:
			| "session-context.flag_value_required"
			| "session-context.invalid_repo_root";
		message: string;
	};
}

/** Options for running the read-only session context collection. */
export interface SessionContextOptions {
	repoRoot?: string | undefined;
	now?: Date;
}
