import { readFileSync } from "node:fs";

export const FLEET_PLAN_SCHEMA_VERSION = "harness-fleet-remediation-plan/v1";

type FleetRepoStatus =
	| "ready"
	| "needs-adoption"
	| "needs-circleci-migration"
	| "needs-coderabbit-setup"
	| "needs-codestyle-install"
	| "needs-codestyle-refresh"
	| "needs-greptile-cleanup"
	| "blocked";

type FleetRisk = "low" | "medium" | "high" | "unknown";

interface MatrixMissingSurface {
	group?: unknown;
	path?: unknown;
	fix?: unknown;
	reason?: unknown;
}

interface MatrixRepoResult {
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

interface MatrixReport {
	schemaVersion?: unknown;
	pass?: unknown;
	repoCount?: unknown;
	results?: unknown;
}

interface RepoSignals {
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

interface RepoRecommendation {
	status: FleetRepoStatus;
	risk: FleetRisk;
	nextAction: string;
	nextCommandArgv: string[] | null;
	safeToRun: boolean;
	requiresApprovalBeforeMutation: boolean;
}

function isMatrixOutputValidationError(error: string): boolean {
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
function recommendation(args: {
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
function initDryRunRecommendation(args: {
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
	};
	/** Human-readable reasons live upgrades are currently unsafe. */
	liveUpgradeBlockedBecause: string[];
	/** Bounded dry-run-only command wave for agents to try before live mutation. */
	firstSafeWave: FleetPlanCommand[];
	/** Ordered per-repo remediation recommendations. */
	repos: FleetPlanRepo[];
}

interface ParsedFleetPlanArgs {
	from?: string;
	json: boolean;
	help: boolean;
	error?: string;
}

/**
 * Normalize a value to a non-empty string or indicate missing content.
 *
 * @returns The original string if it is non-empty, `null` otherwise.
 */
function asString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Coerces an unknown input to a boolean, returning `null` when the input is not a boolean.
 *
 * @param value - The value to inspect; boolean values are returned unchanged.
 * @returns The input boolean if `value` is a boolean, `null` otherwise.
 */
function asBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

/**
 * Extracts string elements from an array, returning them in their original order.
 *
 * @param value - The value to inspect; if it's an array, string entries will be kept.
 * @returns The array of string elements, or an empty array if `value` is not an array or contains no strings.
 */
function asStringArray(value: unknown): string[] {
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
function asMissingSurfaces(value: unknown): MatrixMissingSurface[] {
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
function hasMissingSurface(
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
function surfacePaths(surfaces: MatrixMissingSurface[]): string[] {
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
function hasCodestyleFailureReason(
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
function commandText(argv: string[]): string {
	return argv.map((part) => shellQuote(part)).join(" ");
}

/**
 * Produce a shell-escaped token for safe use as a single POSIX shell argv element.
 *
 * @param value - The input string to quote when necessary
 * @returns The input as a shell-safe token: returned unchanged if already safe, otherwise wrapped in single quotes with embedded single quotes escaped
 */
function shellQuote(value: string): string {
	if (/^[A-Za-z0-9_./:=@%+,-]+$/.test(value)) return value;
	return `'${value.replaceAll("'", "'\\''")}'`;
}

/**
 * Assembles an ordered list of stable blocking reason codes for a repository based on dry-run results, exit status, detected gaps, and reported errors.
 *
 * @param args.statusChangedByDryRun - Whether a dry-run reported repository mutations.
 * @param args.trackedManifest - `true` if the repo is tracked by Harness, `false` if explicitly untracked, `null` if unknown.
 * @returns An array of reason codes describing why the repo is not live-upgrade ready, for example:
 * `dry-run-mutated-repository`, `matrix-command-failed`, `invalid-matrix-json-output`,
 * `repo-not-harness-tracked`, `tracked-repo-missing-circleci`, `missing-coderabbit`,
 * `missing-codestyle`, `stale-codestyle`, `legacy-greptile-present`. The reasons are returned in evaluation order.
 */
function buildBlockingReasons(args: {
	statusChangedByDryRun: boolean;
	exitCode?: number;
	errors: string[];
	trackedManifest: boolean | null;
	hasCircleCiGap: boolean;
	hasCodeRabbitGap: boolean;
	hasCodestyleGap: boolean;
	hasCodestyleMissingFailure: boolean;
	codestyleParityFailurePaths: string[];
	hasGreptileGap: boolean;
}): string[] {
	const blockingReasons: string[] = [];
	if (args.statusChangedByDryRun) {
		blockingReasons.push("dry-run-mutated-repository");
	}
	if (args.exitCode !== undefined && args.exitCode !== 0) {
		blockingReasons.push("matrix-command-failed");
	}
	if (args.errors.some(isMatrixOutputValidationError)) {
		blockingReasons.push("invalid-matrix-json-output");
	}
	if (args.trackedManifest === false) {
		blockingReasons.push("repo-not-harness-tracked");
	}
	if (args.trackedManifest === true && args.hasCircleCiGap) {
		blockingReasons.push("tracked-repo-missing-circleci");
	}
	if (args.hasCodeRabbitGap) {
		blockingReasons.push("missing-coderabbit");
	}
	if (args.hasCodestyleGap || args.hasCodestyleMissingFailure) {
		blockingReasons.push("missing-codestyle");
	}
	if (args.codestyleParityFailurePaths.length > 0) {
		blockingReasons.push("stale-codestyle");
	}
	if (args.hasGreptileGap) {
		blockingReasons.push("legacy-greptile-present");
	}
	return blockingReasons;
}

/**
 * Choose a remediation recommendation for a repository based on normalized matrix signals.
 *
 * Selects a definitive per-repo remediation status and constructs a `RepoRecommendation`
 * containing the risk level, a human-facing `nextAction`, an optional `nextCommandArgv`
 * (command argv for a dry-run preview or null when not safe), and whether the next step
 * is considered safe to run.
 *
 * @param repo - Repository identifier or path used to build command arguments and messages
 * @param signals - Normalized `RepoSignals` extracted from the matrix row
 * @returns A `RepoRecommendation` describing the chosen status, `risk`, `nextAction`,
 *          `nextCommandArgv` (or `null`), and `safeToRun`; the recommendation will also
 *          indicate whether approval is required before mutation.
 */
function recommendRepoAction(
	repo: string,
	signals: RepoSignals,
): RepoRecommendation {
	const invalidJson = signals.errors.some(isMatrixOutputValidationError);
	if (
		signals.statusChangedByDryRun ||
		(signals.exitCode !== undefined && signals.exitCode !== 0) ||
		invalidJson
	) {
		return recommendation({
			status: "blocked",
			risk: "high",
			nextAction:
				"Inspect the matrix failure before running remediation; dry-run safety is not established.",
			nextCommandArgv: null,
			safeToRun: false,
		});
	}
	if (signals.trackedManifest === false) {
		return initDryRunRecommendation({
			repo,
			status: "needs-adoption",
			nextAction: "Run first-adoption dry-run before tracking the repo.",
			update: false,
		});
	}
	if (signals.hasCircleCiGap) {
		return recommendation({
			status: "needs-circleci-migration",
			risk: "medium",
			nextAction: "Prepare CircleCI migration snapshot in dry-run mode.",
			nextCommandArgv: [
				"harness",
				"ci-migrate",
				"prepare",
				repo,
				"--provider",
				"circleci",
				"--dry-run",
				"--json",
			],
			safeToRun: true,
		});
	}
	if (signals.hasCodeRabbitGap) {
		return initDryRunRecommendation({
			repo,
			status: "needs-coderabbit-setup",
			nextAction: "Refresh the CodeRabbit review baseline in dry-run mode.",
			update: true,
		});
	}
	if (signals.hasCodestyleGap || signals.hasCodestyleMissingFailure) {
		return initDryRunRecommendation({
			repo,
			status: "needs-codestyle-install",
			nextAction: "Install the canonical CODESTYLE pack in dry-run mode.",
			update: true,
		});
	}
	if (signals.codestyleParityFailurePaths.length > 0) {
		return initDryRunRecommendation({
			repo,
			status: "needs-codestyle-refresh",
			nextAction: "Refresh the canonical CODESTYLE pack in dry-run mode.",
			update: true,
		});
	}
	if (signals.hasGreptileGap) {
		return recommendation({
			status: "needs-greptile-cleanup",
			risk: "medium",
			nextAction:
				"Preview harness-managed cleanup for legacy Greptile artifacts.",
			nextCommandArgv: ["harness", "eject", repo, "--dry-run", "--json"],
			safeToRun: true,
		});
	}
	if (signals.errors.length > 0) {
		return recommendation({
			status: "blocked",
			risk: "unknown",
			nextAction: "Inspect remaining matrix errors before remediation.",
			nextCommandArgv: null,
			safeToRun: false,
		});
	}
	return recommendation({
		status: "ready",
		risk: "low",
		nextAction: "Run live upgrade dry-run before applying update.",
		nextCommandArgv: ["harness", "upgrade", repo, "--dry-run", "--json"],
		safeToRun: true,
	});
}

/**
 * Convert a single matrix row into a normalized FleetPlanRepo containing the chosen recommendation, blocking reasons, and retained evidence.
 *
 * @param result - A single repository result object from a parsed matrix artifact.
 * @param matrixArtifact - The source matrix artifact path or identifier included in the repo's evidence.
 * @returns A FleetPlanRepo describing the repo's status, risk, whether it is safe to run, the recommended next action/command, any blocking reason codes, and the evidence extracted from the matrix row.
 */
function classifyRepo(
	result: MatrixRepoResult,
	matrixArtifact: string,
): FleetPlanRepo {
	const repo = asString(result.repo) ?? "<unknown-repo>";
	const updateMode = asString(result.updateMode);
	const trackedManifest = asBoolean(result.trackedManifest);
	const errors = asStringArray(result.errors);
	const missingSurfaces = asMissingSurfaces(
		result.missingFleetContractSurfaces,
	);
	const missingSurfacePaths = surfacePaths(missingSurfaces);
	const legacyGreptilePaths = asStringArray(result.legacyGreptilePaths);
	const codestyleParityFailures = asMissingSurfaces(
		result.codestyleParityFailures,
	);
	const codestyleParityFailurePaths = surfacePaths(codestyleParityFailures);
	const hasCodestyleMissingFailure = hasCodestyleFailureReason(
		codestyleParityFailures,
		"missing",
	);
	const statusChangedByDryRun = result.statusChangedByDryRun === true;
	const exitCode =
		typeof result.exitCode === "number" ? result.exitCode : undefined;

	const hasCircleCiGap = hasMissingSurface(missingSurfaces, "circleci");
	const hasCodeRabbitGap = hasMissingSurface(missingSurfaces, "coderabbit");
	const hasCodestyleGap = hasMissingSurface(missingSurfaces, "codestyle");
	const hasGreptileGap = legacyGreptilePaths.length > 0;
	const recommendation = recommendRepoAction(repo, {
		statusChangedByDryRun,
		...(exitCode === undefined ? {} : { exitCode }),
		errors,
		trackedManifest,
		hasCircleCiGap,
		hasCodeRabbitGap,
		hasCodestyleGap,
		codestyleParityFailurePaths,
		hasCodestyleMissingFailure,
		hasGreptileGap,
	});
	const blockingReasons = buildBlockingReasons({
		statusChangedByDryRun,
		...(exitCode === undefined ? {} : { exitCode }),
		errors,
		trackedManifest,
		hasCircleCiGap,
		hasCodeRabbitGap,
		hasCodestyleGap,
		hasCodestyleMissingFailure,
		codestyleParityFailurePaths,
		hasGreptileGap,
	});

	return {
		repo,
		status: recommendation.status,
		risk: recommendation.risk,
		safeToRun: recommendation.safeToRun,
		nextAction: recommendation.nextAction,
		nextCommand: recommendation.nextCommandArgv
			? commandText(recommendation.nextCommandArgv)
			: null,
		nextCommandArgv: recommendation.nextCommandArgv,
		requiresApprovalBeforeMutation:
			recommendation.requiresApprovalBeforeMutation,
		writesFiles: false,
		blockingReasons,
		evidence: {
			matrixArtifact,
			updateMode,
			trackedManifest,
			missingSurfaces: missingSurfacePaths,
			legacyGreptilePaths,
			codestyleParityFailures: codestyleParityFailurePaths,
			errors,
		},
	};
}

/**
 * Compute aggregated counts of repository statuses for inclusion in a fleet remediation summary.
 *
 * @returns An object containing counts keyed by status:
 * - `repoCount`: total number of repos
 * - `ready`: repos classified as `ready`
 * - `needsAdoption`: repos classified as `needs-adoption`
 * - `needsCircleCiMigration`: repos classified as `needs-circleci-migration`
 * - `needsCodeRabbitSetup`: repos classified as `needs-coderabbit-setup`
 * - `needsCodestyleInstall`: repos classified as `needs-codestyle-install`
 * - `needsCodestyleRefresh`: repos classified as `needs-codestyle-refresh`
 * - `needsGreptileCleanup`: repos classified as `needs-greptile-cleanup`
 * - `blocked`: repos classified as `blocked`
 */
function buildSummary(repos: FleetPlanRepo[]): FleetRemediationPlan["summary"] {
	return {
		repoCount: repos.length,
		ready: repos.filter((repo) => repo.status === "ready").length,
		needsAdoption: repos.filter((repo) => repo.status === "needs-adoption")
			.length,
		needsCircleCiMigration: repos.filter(
			(repo) => repo.status === "needs-circleci-migration",
		).length,
		needsCodeRabbitSetup: repos.filter(
			(repo) => repo.status === "needs-coderabbit-setup",
		).length,
		needsCodestyleInstall: repos.filter(
			(repo) => repo.status === "needs-codestyle-install",
		).length,
		needsCodestyleRefresh: repos.filter(
			(repo) => repo.status === "needs-codestyle-refresh",
		).length,
		needsGreptileCleanup: repos.filter(
			(repo) => repo.status === "needs-greptile-cleanup",
		).length,
		blocked: repos.filter((repo) => repo.status === "blocked").length,
	};
}

/**
 * Count repositories that include a specific blocking reason code.
 *
 * @param repos - The list of per-repo plan entries to inspect
 * @param reason - The blocking reason code to count (e.g., `needs-codestyle-install`)
 * @returns The number of repositories whose `blockingReasons` include `reason`
 */
function countReposWithReason(repos: FleetPlanRepo[], reason: string): number {
	return repos.filter((repo) => repo.blockingReasons.includes(reason)).length;
}

/**
 * Compute aggregated counts of predefined finding categories from a list of per-repo recommendations.
 *
 * @param repos - Array of per-repo remediation recommendations to aggregate
 * @returns An object with numeric counts for each finding category:
 *  - `notHarnessTracked`: repos not tracked by Harness
 *  - `missingCircleCi`: repos missing CircleCI surfaces
 *  - `missingCodeRabbit`: repos missing CodeRabbit surfaces
 *  - `missingCodestyle`: repos missing codestyle installation
 *  - `staleCodestyle`: repos with codestyle parity failures
 *  - `legacyGreptile`: repos containing legacy Greptile artifacts
 *  - `dryRunMutatedRepository`: repos whose dry-run mutated repository state
 *  - `matrixCommandFailed`: repos where the matrix command returned a non-zero exit code
 *  - `invalidMatrixJsonOutput`: repos with invalid JSON reported by the matrix
 */
function buildFindingCounts(
	repos: FleetPlanRepo[],
): FleetRemediationPlan["findingCounts"] {
	return {
		notHarnessTracked: countReposWithReason(repos, "repo-not-harness-tracked"),
		missingCircleCi: countReposWithReason(
			repos,
			"tracked-repo-missing-circleci",
		),
		missingCodeRabbit: countReposWithReason(repos, "missing-coderabbit"),
		missingCodestyle: countReposWithReason(repos, "missing-codestyle"),
		staleCodestyle: countReposWithReason(repos, "stale-codestyle"),
		legacyGreptile: countReposWithReason(repos, "legacy-greptile-present"),
		dryRunMutatedRepository: countReposWithReason(
			repos,
			"dry-run-mutated-repository",
		),
		matrixCommandFailed: countReposWithReason(repos, "matrix-command-failed"),
		invalidMatrixJsonOutput: countReposWithReason(
			repos,
			"invalid-matrix-json-output",
		),
	};
}

/**
 * Format a numeric count with the appropriate singular or plural noun.
 *
 * @param count - The numeric quantity to format
 * @param singular - Noun to use when `count` is 1
 * @param plural - Noun to use when `count` is any value other than 1
 * @returns A string in the form `"<count> <noun>"`, using `singular` when `count` is 1 and `plural` otherwise
 */
function pluralize(count: number, singular: string, plural: string): string {
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
function repoVerb(count: number, singular: string, plural: string): string {
	return count === 1 ? singular : plural;
}

/**
 * Build human-readable top-level live-upgrade blocker messages from finding counts.
 *
 * @param findingCounts - Counts of categorized findings used to generate blocker messages
 * @returns An array of human-readable blocker strings; empty when no blockers are present
 */
function buildLiveUpgradeBlockers(
	findingCounts: FleetRemediationPlan["findingCounts"],
): string[] {
	const blockers: string[] = [];
	if (findingCounts.dryRunMutatedRepository > 0) {
		blockers.push(
			`${pluralize(findingCounts.dryRunMutatedRepository, "repo", "repos")} changed git status during dry-run`,
		);
	}
	if (findingCounts.matrixCommandFailed > 0) {
		blockers.push(
			`${pluralize(findingCounts.matrixCommandFailed, "repo", "repos")} failed the matrix command`,
		);
	}
	if (findingCounts.invalidMatrixJsonOutput > 0) {
		blockers.push(
			`${pluralize(findingCounts.invalidMatrixJsonOutput, "repo", "repos")} emitted invalid matrix JSON`,
		);
	}
	if (findingCounts.notHarnessTracked > 0) {
		blockers.push(
			`${pluralize(findingCounts.notHarnessTracked, "repo", "repos")} ${repoVerb(findingCounts.notHarnessTracked, "needs", "need")} harness adoption before live upgrade`,
		);
	}
	if (findingCounts.missingCircleCi > 0) {
		blockers.push(
			`${pluralize(findingCounts.missingCircleCi, "repo", "repos")} ${repoVerb(findingCounts.missingCircleCi, "is", "are")} missing CircleCI governance surfaces`,
		);
	}
	if (findingCounts.missingCodeRabbit > 0) {
		blockers.push(
			`${pluralize(findingCounts.missingCodeRabbit, "repo", "repos")} ${repoVerb(findingCounts.missingCodeRabbit, "is", "are")} missing CodeRabbit review surfaces`,
		);
	}
	if (findingCounts.missingCodestyle > 0) {
		blockers.push(
			`${pluralize(findingCounts.missingCodestyle, "repo", "repos")} ${repoVerb(findingCounts.missingCodestyle, "is", "are")} missing CODESTYLE surfaces`,
		);
	}
	if (findingCounts.staleCodestyle > 0) {
		blockers.push(
			`${pluralize(findingCounts.staleCodestyle, "repo", "repos")} ${repoVerb(findingCounts.staleCodestyle, "has", "have")} CODESTYLE parity failures`,
		);
	}
	if (findingCounts.legacyGreptile > 0) {
		blockers.push(
			`${pluralize(findingCounts.legacyGreptile, "repo", "repos")} still ${repoVerb(findingCounts.legacyGreptile, "contains", "contain")} legacy Greptile artifacts`,
		);
	}
	return blockers;
}

/**
 * Builds a bounded list of agent-ready, read-only commands representing the first safe wave of remediation.
 *
 * Filters the provided per-repo recommendations by status priority and safety, selecting up to five commands total and enforcing per-status limits:
 * adoption (max 3), circleci migration (2), coderabbit setup (2), codestyle install (2), codestyle refresh (2), greptile cleanup (2).
 * Only repos with `safeToRun`, a non-null `nextCommand`, and a `nextCommandArgv` are included.
 *
 * @param repos - Array of per-repo recommendations from which to select the first safe wave
 * @returns An ordered array of `FleetPlanCommand` objects suitable for agents to run as the first safe wave
 */
function buildFirstSafeWave(repos: FleetPlanRepo[]): FleetPlanCommand[] {
	const wave: FleetPlanCommand[] = [];
	const statusOrder: Array<{ status: FleetRepoStatus; limit: number }> = [
		{ status: "needs-adoption", limit: 3 },
		{ status: "needs-circleci-migration", limit: 2 },
		{ status: "needs-coderabbit-setup", limit: 2 },
		{ status: "needs-codestyle-install", limit: 2 },
		{ status: "needs-codestyle-refresh", limit: 2 },
		{ status: "needs-greptile-cleanup", limit: 2 },
	];
	for (const { status, limit } of statusOrder) {
		let addedForStatus = 0;
		for (const repo of repos) {
			if (wave.length >= 5 || addedForStatus >= limit) {
				break;
			}
			if (
				repo.status !== status ||
				!repo.safeToRun ||
				!repo.nextCommandArgv ||
				repo.nextCommand === null
			) {
				continue;
			}
			wave.push({
				repo: repo.repo,
				status: repo.status,
				risk: repo.risk,
				nextCommand: repo.nextCommand,
				nextCommandArgv: repo.nextCommandArgv,
				nextAction: repo.nextAction,
			});
			addedForStatus += 1;
		}
	}
	return wave;
}

/** Build the first live-upgrade dry-run wave when every matrix repo is ready. */
function buildReadyUpgradeWave(repos: FleetPlanRepo[]): FleetPlanCommand[] {
	return repos
		.filter(
			(repo) =>
				repo.status === "ready" &&
				repo.safeToRun &&
				repo.nextCommandArgv &&
				repo.nextCommand !== null,
		)
		.slice(0, 5)
		.map((repo) => ({
			repo: repo.repo,
			status: repo.status,
			risk: repo.risk,
			nextCommand: repo.nextCommand as string,
			nextCommandArgv: repo.nextCommandArgv as string[],
			nextAction: repo.nextAction,
		}));
}

/**
 * Build a read-only remediation plan from a Harness upgrade matrix report.
 *
 * @param args.matrix - The parsed matrix report produced by the upgrade dry-run.
 * @param args.matrixArtifact - Path or identifier of the source matrix artifact (recorded in plan evidence).
 * @param args.generatedAt - Optional ISO timestamp to embed as the plan generation time; defaults to now.
 * @returns A complete FleetRemediationPlan describing per-repo recommendations, summary counts, live-upgrade blockers, the first safe command wave, and the selected next runnable action and command.
 */
export function buildFleetRemediationPlan(args: {
	matrix: MatrixReport;
	matrixArtifact: string;
	generatedAt?: string;
}): FleetRemediationPlan {
	const rawResults = Array.isArray(args.matrix.results)
		? args.matrix.results.filter(
				(result): result is MatrixRepoResult =>
					typeof result === "object" && result !== null,
			)
		: [];
	const repos = rawResults.map((result) =>
		classifyRepo(result, args.matrixArtifact),
	);
	const summary = buildSummary(repos);
	const findingCounts = buildFindingCounts(repos);
	const liveUpgradeBlockedBecause =
		rawResults.length === 0
			? ["matrix artifact contained no repository results"]
			: buildLiveUpgradeBlockers(findingCounts);
	// Avoid empty-artifact true positives: require repos.length > 0
	const liveUpgradeReady =
		repos.length > 0 && repos.every((repo) => repo.status === "ready");
	const firstSafeWave = liveUpgradeReady
		? buildReadyUpgradeWave(repos)
		: buildFirstSafeWave(repos);
	// Derive nextRunnable from firstSafeWave to reflect wave priority
	const nextRunnable = firstSafeWave.length > 0 ? firstSafeWave[0] : undefined;
	return {
		schemaVersion: FLEET_PLAN_SCHEMA_VERSION,
		generatedAt: args.generatedAt ?? new Date().toISOString(),
		generatedFrom: args.matrixArtifact,
		liveUpgradeReady,
		safeToRun: liveUpgradeReady || nextRunnable !== undefined,
		nextAction: liveUpgradeReady
			? "Run upgrade dry-runs for ready repos before live update."
			: (nextRunnable?.nextAction ??
				"Inspect blocked matrix results before running remediation."),
		nextCommand: nextRunnable?.nextCommand ?? null,
		nextCommandArgv: nextRunnable?.nextCommandArgv ?? null,
		summary,
		findingCounts,
		liveUpgradeBlockedBecause,
		firstSafeWave,
		repos,
	};
}

/**
 * Parse CLI arguments for the fleet-plan command.
 *
 * Recognizes `--help`/`-h`, `--json`, and `--from <path>`. Validates that `--from` is followed by a non-flag value and returns a descriptive `error` when an unknown flag is encountered or `--from` is missing its path.
 *
 * @param argv - Array of command-line arguments (typically process.argv.slice(n))
 * @returns An object with:
 *  - `from` — the matrix artifact path when provided,
 *  - `json` — `true` when `--json` was present,
 *  - `help` — `true` when `--help` or `-h` was present,
 *  - `error` — an error message when arguments are invalid
 */
function parseArgs(argv: string[]): ParsedFleetPlanArgs {
	let from: string | undefined;
	let json = false;
	let help = false;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--help" || arg === "-h") {
			help = true;
			continue;
		}
		if (arg === "--json") {
			json = true;
			continue;
		}
		if (arg === "--from") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				return { json, help, error: "--from requires a matrix artifact path" };
			}
			from = value;
			index += 1;
			continue;
		}
		return { json, help, error: `Unknown argument: ${arg}` };
	}
	return {
		...(from === undefined ? {} : { from }),
		json,
		help,
	};
}

/**
 * Print usage instructions and a brief description for the `harness fleet-plan` CLI.
 *
 * Outputs the expected flags (`--from <matrix.json>`, optional `--json`) and a one-line summary
 * of what the command does.
 */
function printUsage(): void {
	console.info("Usage: harness fleet-plan --from <matrix.json> [--json]");
	console.info("");
	console.info(
		"Build an agent-native, read-only remediation plan from a harness upgrade matrix artifact.",
	);
}

/**
 * Prints a human-readable summary of a fleet remediation plan to stdout.
 *
 * Renders overall plan metadata (source and live-upgrade readiness), aggregated status counts,
 * any live-upgrade blocker messages, the first safe wave of agent commands, and a per-repo
 * listing that includes the repo status, next action/command, and blocking reasons.
 *
 * @param plan - The remediation plan to render
 */
function printHuman(plan: FleetRemediationPlan): void {
	console.info(`Fleet remediation plan: ${plan.generatedFrom}`);
	console.info(`Live upgrade ready: ${plan.liveUpgradeReady ? "yes" : "no"}`);
	console.info(
		`Ready=${plan.summary.ready} adoption=${plan.summary.needsAdoption} circleci=${plan.summary.needsCircleCiMigration} coderabbit=${plan.summary.needsCodeRabbitSetup} codestyleInstall=${plan.summary.needsCodestyleInstall} codestyleRefresh=${plan.summary.needsCodestyleRefresh} greptile=${plan.summary.needsGreptileCleanup} blocked=${plan.summary.blocked}`,
	);
	if (plan.liveUpgradeBlockedBecause.length > 0) {
		console.info("");
		console.info("Live upgrade blockers:");
		for (const blocker of plan.liveUpgradeBlockedBecause) {
			console.info(`  - ${blocker}`);
		}
	}
	if (plan.firstSafeWave.length > 0) {
		console.info("");
		console.info("First safe wave:");
		for (const command of plan.firstSafeWave) {
			console.info(`  - ${command.nextCommand}`);
		}
	}
	console.info("");
	for (const repo of plan.repos) {
		console.info(`${repo.status}: ${repo.repo}`);
		console.info(`  next: ${repo.nextCommand ?? repo.nextAction}`);
		if (repo.blockingReasons.length > 0) {
			console.info(`  reasons: ${repo.blockingReasons.join(", ")}`);
		}
	}
}

/**
 * Entrypoint for the `harness fleet-plan` CLI.
 *
 * Parses CLI arguments, requires `--from <path>` to a matrix JSON artifact, builds a fleet remediation
 * plan from that artifact, and writes either the plan as JSON (when `--json` is provided) or a
 * human-readable summary to stdout.
 *
 * @param argv - The CLI arguments (typically `process.argv.slice(2)`)
 * @returns `0` on success, `1` if the matrix artifact could not be read or parsed, `2` for invalid or missing CLI arguments
 */
export function runFleetPlanCLI(argv: string[]): number {
	const parsed = parseArgs(argv);
	if (parsed.help) {
		printUsage();
		return 0;
	}
	if (parsed.error) {
		console.error(parsed.error);
		printUsage();
		return 2;
	}
	if (!parsed.from) {
		console.error("--from is required");
		printUsage();
		return 2;
	}

	let matrix: MatrixReport;
	try {
		matrix = JSON.parse(readFileSync(parsed.from, "utf8")) as MatrixReport;
	} catch (error) {
		console.error(
			`Failed to read matrix artifact: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}

	const plan = buildFleetRemediationPlan({
		matrix,
		matrixArtifact: parsed.from,
	});
	if (parsed.json) {
		console.info(JSON.stringify(plan, null, 2));
	} else {
		printHuman(plan);
	}
	return 0;
}
