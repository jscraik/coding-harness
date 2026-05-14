export const FLEET_PLAN_SCHEMA_VERSION = "harness-fleet-remediation-plan/v1";

/** Remediation status classification for a single repository in the fleet. */
export type FleetRepoStatus =
	| "ready"
	| "needs-adoption"
	| "needs-circleci-migration"
	| "needs-coderabbit-setup"
	| "needs-codestyle-install"
	| "needs-codestyle-refresh"
	| "needs-greptile-cleanup"
	| "blocked";

/** Relative risk level assigned to a recommended next step. */
export type FleetRisk = "low" | "medium" | "high" | "unknown";

/** A missing fleet-contract surface entry reported by the upgrade matrix. */
export interface MatrixMissingSurface {
	group?: unknown;
	path?: unknown;
	fix?: unknown;
	reason?: unknown;
}

/** A single repository result entry from an upgrade matrix report. */
export interface MatrixRepoResult {
	repo?: unknown;
	updateMode?: unknown;
	trackedManifest?: unknown;
	missingFleetContractSurfaces?: unknown;
	legacyGreptilePaths?: unknown;
	codestyleParityFailures?: unknown;
	errors?: unknown;
	statusChangedByDryRun?: unknown;
	exitCode?: unknown;
}

/** Top-level upgrade matrix report containing per-repository results. */
export interface MatrixReport {
	schemaVersion?: unknown;
	pass?: unknown;
	repoCount?: unknown;
	results?: unknown;
}

/** Normalized signals extracted from a single matrix result for classification. */
export interface RepoSignals {
	statusChangedByDryRun: boolean;
	exitCode?: number;
	errors: string[];
	trackedManifest: boolean | null;
	hasCircleCiGap: boolean;
	hasCodeRabbitGap: boolean;
	hasCodestyleGap: boolean;
	codestyleParityFailurePaths: string[];
	hasCodestyleMissingFailure: boolean;
	hasGreptileGap: boolean;
}

/** Remediation recommendation for a single repository including risk and next action. */
export interface RepoRecommendation {
	status: FleetRepoStatus;
	risk: FleetRisk;
	nextAction: string;
	nextCommandArgv: string[] | null;
	safeToRun: boolean;
	requiresApprovalBeforeMutation: boolean;
}

/** Read-only command recommendation included in the first safe remediation wave. */
export interface FleetPlanCommand {
	/** Repository the command targets. */
	repo: string;
	/** Current fleet status for the repository. */
	status: FleetRepoStatus;
	/** Relative risk for the dry-run command. */
	risk: FleetRisk;
	/** Shell-display command for humans. */
	nextCommand: string;
	/** Machine-safe argv for agents. */
	nextCommandArgv: string[];
	/** Human-readable description of the recommended next action. */
	nextAction: string;
}

/** Per-repository remediation recommendation derived from one matrix result. */
export interface FleetPlanRepo {
	/** Absolute or input repository path reported by the matrix. */
	repo: string;
	/** Fleet remediation classification for the repository. */
	status: FleetRepoStatus;
	/** Relative risk of the recommended next step. */
	risk: FleetRisk;
	/** True when the recommended command is read-only and safe to run now. */
	safeToRun: boolean;
	/** Human-readable next step. */
	nextAction: string;
	/** Shell-display command for the next step, or null when blocked. */
	nextCommand: string | null;
	/** Machine-safe argv for the next step, or null when blocked. */
	nextCommandArgv: string[] | null;
	/** True when the eventual mutating follow-up still needs human approval. */
	requiresApprovalBeforeMutation: boolean;
	/** True when this recommendation itself writes files. */
	writesFiles: boolean;
	/** Stable reason codes explaining why the repository is not live-upgrade ready. */
	blockingReasons: string[];
	/** Matrix evidence retained so agents do not need to re-parse stderr text. */
	evidence: {
		matrixArtifact: string;
		updateMode: string | null;
		trackedManifest: boolean | null;
		missingSurfaces: string[];
		legacyGreptilePaths: string[];
		codestyleParityFailures: string[];
		errors: string[];
	};
}

/** Agent-native fleet remediation plan produced from an upgrade matrix artifact. */
export interface FleetRemediationPlan {
	/** Schema identifier for downstream automation. */
	schemaVersion: typeof FLEET_PLAN_SCHEMA_VERSION;
	/** ISO timestamp when the plan was generated. */
	generatedAt: string;
	/** Matrix artifact path used as source evidence. */
	generatedFrom: string;
	/** True only when every repo is already classified as ready. */
	liveUpgradeReady: boolean;
	/** True when at least one read-only next command can be run safely. */
	safeToRun: boolean;
	/** Human-readable top-level next step. */
	nextAction: string;
	/** Shell-display top-level command, or null when all results are blocked. */
	nextCommand: string | null;
	/** Machine-safe top-level argv, or null when all results are blocked. */
	nextCommandArgv: string[] | null;
	/** Status counts for quick fleet triage. */
	summary: {
		repoCount: number;
		ready: number;
		needsAdoption: number;
		needsCircleCiMigration: number;
		needsCodeRabbitSetup: number;
		needsCodestyleInstall: number;
		needsCodestyleRefresh: number;
		needsGreptileCleanup: number;
		blocked: number;
	};
	/** Cross-cutting finding counts that may be hidden behind higher-priority statuses. */
	findingCounts: {
		notHarnessTracked: number;
		missingCircleCi: number;
		missingCodeRabbit: number;
		missingCodestyle: number;
		staleCodestyle: number;
		legacyGreptile: number;
		dryRunMutatedRepository: number;
		matrixCommandFailed: number;
		invalidMatrixJsonOutput: number;
		matrixReportedErrors: number;
	};
	/** Human-readable reasons live upgrades are currently unsafe. */
	liveUpgradeBlockedBecause: string[];
	/** Bounded dry-run-only command wave for agents to try before live mutation. */
	firstSafeWave: FleetPlanCommand[];
	/** Ordered per-repo remediation recommendations. */
	repos: FleetPlanRepo[];
}

/** Parsed CLI arguments for the fleet-plan command. */
export interface ParsedFleetPlanArgs {
	from?: string;
	json: boolean;
	help: boolean;
	error?: string;
}

/**
 * Determines whether a matrix error string indicates an output validation failure.
 *
 * @param error - The error message to inspect
 * @returns `true` when the error represents invalid or missing JSON output
 */
export function isMatrixOutputValidationError(error: string): boolean {
	return (
		error.includes("invalid JSON output") ||
		error.startsWith("JSON output missing ") ||
		error === "created array no longer matches updated array"
	);
}

/**
 * Builds a RepoRecommendation from the provided fields and marks it as requiring approval before any mutation.
 *
 * @returns A `RepoRecommendation` containing the supplied `status`, `risk`, `nextAction`, `nextCommandArgv`, and `safeToRun` fields, with `requiresApprovalBeforeMutation` set to `true`.
 */
export function recommendation(args: {
	status: FleetRepoStatus;
	risk: FleetRisk;
	nextAction: string;
	nextCommandArgv: string[] | null;
	safeToRun: boolean;
}): RepoRecommendation {
	return {
		...args,
		requiresApprovalBeforeMutation: true,
	};
}

/**
 * Create a read-only "init" dry-run recommendation for a single repository.
 *
 * The recommendation is marked `safeToRun` with `risk` set to `low` and includes a
 * `nextCommandArgv` that runs `harness init <repo> --dry-run --json`. When
 * `update` is true, the `--update` flag is included in the command.
 *
 * @param repo - Repository identifier (passed as the positional argument to `harness init`)
 * @param status - Classification status to assign to the recommendation
 * @param nextAction - Short human-readable description of the recommended next action
 * @param update - If true, include `--update` in the generated init command
 * @returns A `RepoRecommendation` representing a read-only init dry-run for the repo
 */
export function initDryRunRecommendation(args: {
	repo: string;
	status: FleetRepoStatus;
	nextAction: string;
	update: boolean;
}): RepoRecommendation {
	return recommendation({
		status: args.status,
		risk: "low",
		nextAction: args.nextAction,
		nextCommandArgv: [
			"harness",
			"init",
			args.repo,
			...(args.update ? ["--update"] : []),
			"--dry-run",
			"--json",
		],
		safeToRun: true,
	});
}

/**
 * Normalize a value to a non-empty string or indicate missing content.
 *
 * @returns The original string if it is non-empty, `null` otherwise.
 */
export function asString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Coerces an unknown input to a boolean, returning `null` when the input is not a boolean.
 *
 * @param value - The value to inspect; boolean values are returned unchanged.
 * @returns The input boolean if `value` is a boolean, `null` otherwise.
 */
export function asBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

/**
 * Extracts string elements from an array, returning them in their original order.
 *
 * @param value - The value to inspect; if it's an array, string entries will be kept.
 * @returns The array of string elements, or an empty array if `value` is not an array or contains no strings.
 */
export function asStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === "string")
		: [];
}

/**
 * Normalize a value to an array of matrix missing-surface objects.
 *
 * @param value - The input to coerce; expected to be an array of entries that may represent missing-surface objects.
 * @returns An array of entries from `value` that are plain objects, typed as `MatrixMissingSurface`; returns an empty array if `value` is not an array.
 */
export function asMissingSurfaces(value: unknown): MatrixMissingSurface[] {
	return Array.isArray(value)
		? value.filter(
				(entry): entry is MatrixMissingSurface =>
					typeof entry === "object" && entry !== null,
			)
		: [];
}

/**
 * Checks whether any missing-surface entry belongs to the specified group.
 *
 * @param surfaces - Array of missing-surface entries to search
 * @param group - The group name to match against each surface's `group` field
 * @returns `true` if at least one entry has `group` equal to `group`, `false` otherwise
 */
export function hasMissingSurface(
	surfaces: MatrixMissingSurface[],
	group: string,
): boolean {
	return surfaces.some((surface) => surface.group === group);
}

/**
 * Extracts `path` string values from an array of missing-surface entries.
 *
 * @param surfaces - Array of objects that may contain a `path` property
 * @returns The list of `path` values present on the input entries; entries without a string `path` are omitted
 */
export function surfacePaths(surfaces: MatrixMissingSurface[]): string[] {
	return surfaces
		.map((surface) => asString(surface.path))
		.filter((path): path is string => path !== null);
}

/**
 * Determines whether any missing-surface entry in `surfaces` has the given `reason`.
 *
 * @param surfaces - Array of missing-surface entries to inspect
 * @param reason - Reason string to match against each surface's `reason` field
 * @returns `true` if any entry's `reason` equals `reason`, `false` otherwise
 */
export function hasCodestyleFailureReason(
	surfaces: MatrixMissingSurface[],
	reason: string,
): boolean {
	return surfaces.some((surface) => surface.reason === reason);
}

/**
 * Create a shell-escaped command line from an argv array.
 *
 * @param argv - Array of command arguments in order
 * @returns The command string with each argument shell-escaped and joined by spaces
 */
export function commandText(argv: string[]): string {
	return argv.map((part) => shellQuote(part)).join(" ");
}

/**
 * Produce a shell-escaped token for safe use as a single POSIX shell argv element.
 *
 * @param value - The input string to quote when necessary
 * @returns The input as a shell-safe token: returned unchanged if already safe, otherwise wrapped in single quotes with embedded single quotes escaped
 */
export function shellQuote(value: string): string {
	if (/^[A-Za-z0-9_./:=@%+,-]+$/.test(value)) return value;
	return `'${value.replaceAll("'", "'\\''")}'`;
}

/**
 * Format a numeric count with the appropriate singular or plural noun.
 *
 * @param count - The numeric quantity to format
 * @param singular - Noun to use when `count` is 1
 * @param plural - Noun to use when `count` is any value other than 1
 * @returns A string in the form `"<count> <noun>"`, using `singular` when `count` is 1 and `plural` otherwise
 */
export function pluralize(
	count: number,
	singular: string,
	plural: string,
): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Selects the appropriate singular or plural word form based on a numeric count.
 *
 * @param count - The quantity used to choose between forms
 * @param singular - The singular form to use when `count` is 1
 * @param plural - The plural form to use when `count` is not 1
 * @returns The `singular` form if `count` is 1, otherwise the `plural` form
 */
export function repoVerb(
	count: number,
	singular: string,
	plural: string,
): string {
	return count === 1 ? singular : plural;
}

/**
 * Count repositories that include a specific blocking reason code.
 *
 * @param repos - The list of per-repo plan entries to inspect
 * @param reason - The blocking reason code to count (e.g., `needs-codestyle-install`)
 * @returns The number of repositories whose `blockingReasons` include `reason`
 */
export function countReposWithReason(
	repos: FleetPlanRepo[],
	reason: string,
): number {
	return repos.filter((repo) => repo.blockingReasons.includes(reason)).length;
}
