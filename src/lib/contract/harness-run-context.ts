/** Schema version for Codex-aligned harness runtime context. */
export const HARNESS_RUN_CONTEXT_SCHEMA_VERSION = "harness-run-context/v1";

/** Bounded operation mode for a harness run. */
export type HarnessOperationProfile =
	| "triage"
	| "fix"
	| "review"
	| "ci-babysit"
	| "linear-mutate"
	| "release"
	| "unknown";

/** Lifecycle status for a harness or agent operation. */
export type HarnessLifecycleStatus =
	| "running"
	| "waiting_on_ci"
	| "waiting_on_review"
	| "waiting_on_user"
	| "waiting_on_auth"
	| "blocked_by_repo_mismatch"
	| "blocked_by_merge_conflict"
	| "blocked_by_required_check"
	| "blocked_by_external_service"
	| "ready_to_merge"
	| "merged"
	| "closed"
	| "unknown";

/** Network availability observed or declared for the run. */
export type HarnessNetworkAccess = "enabled" | "disabled" | "unknown";

/** Permission and sandbox evidence captured without depending on Codex internals. */
export interface HarnessPermissionContext {
	/** Sandbox mode reported by the runtime, or "unknown" when unavailable. */
	sandboxMode: string;
	/** Runtime permission profile label, or "unknown" when unavailable. */
	permissionProfile: string;
	/** Network access state. */
	network: HarnessNetworkAccess;
	/** Read roots visible to the operation. */
	readableRoots: string[];
	/** Writable roots visible to the operation. */
	writableRoots: string[];
}

/** Repository and worktree identity for a harness run. */
export interface HarnessRunRepoContext {
	/** Current working directory used by the operation. */
	cwd: string;
	/** Repository root resolved for the operation. */
	repoRoot: string;
	/** Git worktree root, or "unknown" when unavailable. */
	worktreeRoot: string;
	/** Git common directory, or "unknown" when unavailable. */
	gitCommonDir: string;
	/** Current branch, or "unknown" when detached or unavailable. */
	branch: string;
	/** Current head SHA, or "unknown" when unavailable. */
	headSha: string;
}

/** External or local target references associated with the run. */
export interface HarnessRunTargets {
	/** Linear issue ids associated with the work. */
	linearIssueIds: string[];
	/** Pull request references associated with the work. */
	pullRequests: string[];
	/** External target repository, or null when the current repo is the only target. */
	externalRepo: string | null;
}

/** Stable context packet that lets harness surfaces share runtime evidence. */
export interface HarnessRunContext {
	/** Schema version for this context packet. */
	schemaVersion: typeof HARNESS_RUN_CONTEXT_SCHEMA_VERSION;
	/** Bounded operation mode for the run. */
	operationProfile: HarnessOperationProfile;
	/** Current lifecycle status. */
	lifecycleStatus: HarnessLifecycleStatus;
	/** Repository and worktree identity. */
	repo: HarnessRunRepoContext;
	/** Runtime/session identifiers associated with the run. */
	sessionIds: string[];
	/** CI, harness, eval, review, or runtime trace identifiers associated with the run. */
	traceIds: string[];
	/** Workspace roots that the runtime selected or exposed. */
	workspaceRoots: string[];
	/** Permission and sandbox evidence. */
	permissionContext: HarnessPermissionContext;
	/** Validation evidence references, such as command outcomes or CI jobs. */
	validationEvidenceRefs: string[];
	/** Review artifact references, such as CodeRabbit, Codex, or reviewer outputs. */
	reviewArtifactRefs: string[];
	/** Target issue, PR, or repository references. */
	targets: HarnessRunTargets;
	/** Blocking conditions observed for the operation. */
	blockers: string[];
}

/** One validation problem found in a candidate harness run context. */
export interface HarnessRunContextValidationError {
	/** Dot-path to the invalid field. */
	path: string;
	/** Human-readable validation failure. */
	message: string;
}

/** Validation result for a candidate harness run context. */
export interface HarnessRunContextValidationResult {
	/** Whether the context satisfies the v1 contract. */
	valid: boolean;
	/** Validation errors, empty when valid. */
	errors: HarnessRunContextValidationError[];
}

const OPERATION_PROFILES = new Set<HarnessOperationProfile>([
	"triage",
	"fix",
	"review",
	"ci-babysit",
	"linear-mutate",
	"release",
	"unknown",
]);

const LIFECYCLE_STATUSES = new Set<HarnessLifecycleStatus>([
	"running",
	"waiting_on_ci",
	"waiting_on_review",
	"waiting_on_user",
	"waiting_on_auth",
	"blocked_by_repo_mismatch",
	"blocked_by_merge_conflict",
	"blocked_by_required_check",
	"blocked_by_external_service",
	"ready_to_merge",
	"merged",
	"closed",
	"unknown",
]);

const NETWORK_ACCESS = new Set<HarnessNetworkAccess>([
	"enabled",
	"disabled",
	"unknown",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.every((item) => typeof item === "string" && item.trim().length > 0)
	);
}

function requireString(
	value: unknown,
	path: string,
	errors: HarnessRunContextValidationError[],
): void {
	if (typeof value !== "string" || value.trim().length === 0) {
		errors.push({ path, message: "must be a non-empty string" });
	}
}

function requireStringArray(
	value: unknown,
	path: string,
	errors: HarnessRunContextValidationError[],
): void {
	if (!isStringArray(value)) {
		errors.push({ path, message: "must be an array of non-empty strings" });
	}
}

function requireHeadSha(
	value: unknown,
	errors: HarnessRunContextValidationError[],
): void {
	if (
		value !== "unknown" &&
		(typeof value !== "string" || !/^[a-f0-9]{40}$/.test(value))
	) {
		errors.push({
			path: "repo.headSha",
			message: "must be a 40-character lowercase hex SHA or unknown",
		});
	}
}

function validateRepo(
	value: unknown,
	errors: HarnessRunContextValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push({ path: "repo", message: "must be an object" });
		return;
	}
	requireString(value.cwd, "repo.cwd", errors);
	requireString(value.repoRoot, "repo.repoRoot", errors);
	requireString(value.worktreeRoot, "repo.worktreeRoot", errors);
	requireString(value.gitCommonDir, "repo.gitCommonDir", errors);
	requireString(value.branch, "repo.branch", errors);
	requireHeadSha(value.headSha, errors);
}

function validatePermissionContext(
	value: unknown,
	errors: HarnessRunContextValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push({ path: "permissionContext", message: "must be an object" });
		return;
	}
	requireString(value.sandboxMode, "permissionContext.sandboxMode", errors);
	requireString(
		value.permissionProfile,
		"permissionContext.permissionProfile",
		errors,
	);
	if (!NETWORK_ACCESS.has(value.network as HarnessNetworkAccess)) {
		errors.push({
			path: "permissionContext.network",
			message: "must be enabled, disabled, or unknown",
		});
	}
	requireStringArray(
		value.readableRoots,
		"permissionContext.readableRoots",
		errors,
	);
	requireStringArray(
		value.writableRoots,
		"permissionContext.writableRoots",
		errors,
	);
}

function validateTargets(
	value: unknown,
	errors: HarnessRunContextValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push({ path: "targets", message: "must be an object" });
		return;
	}
	requireStringArray(value.linearIssueIds, "targets.linearIssueIds", errors);
	requireStringArray(value.pullRequests, "targets.pullRequests", errors);
	if (typeof value.externalRepo !== "string" && value.externalRepo !== null) {
		errors.push({
			path: "targets.externalRepo",
			message: "must be a string or null",
		});
	}
}

/** Validate a candidate context against the harness-run-context/v1 contract. */
export function validateHarnessRunContext(
	value: unknown,
): HarnessRunContextValidationResult {
	const errors: HarnessRunContextValidationError[] = [];
	if (!isRecord(value)) {
		return {
			valid: false,
			errors: [{ path: "$", message: "must be an object" }],
		};
	}

	if (value.schemaVersion !== HARNESS_RUN_CONTEXT_SCHEMA_VERSION) {
		errors.push({
			path: "schemaVersion",
			message: "must be harness-run-context/v1",
		});
	}
	if (
		!OPERATION_PROFILES.has(value.operationProfile as HarnessOperationProfile)
	) {
		errors.push({
			path: "operationProfile",
			message: "must be a known harness operation profile",
		});
	}
	if (
		!LIFECYCLE_STATUSES.has(value.lifecycleStatus as HarnessLifecycleStatus)
	) {
		errors.push({
			path: "lifecycleStatus",
			message: "must be a known harness lifecycle status",
		});
	}

	validateRepo(value.repo, errors);
	requireStringArray(value.sessionIds, "sessionIds", errors);
	requireStringArray(value.traceIds, "traceIds", errors);
	requireStringArray(value.workspaceRoots, "workspaceRoots", errors);
	validatePermissionContext(value.permissionContext, errors);
	requireStringArray(
		value.validationEvidenceRefs,
		"validationEvidenceRefs",
		errors,
	);
	requireStringArray(value.reviewArtifactRefs, "reviewArtifactRefs", errors);
	validateTargets(value.targets, errors);
	requireStringArray(value.blockers, "blockers", errors);

	return { valid: errors.length === 0, errors };
}

/** Return true when a candidate satisfies the harness-run-context/v1 contract. */
export function isValidHarnessRunContext(
	value: unknown,
): value is HarnessRunContext {
	return validateHarnessRunContext(value).valid;
}
