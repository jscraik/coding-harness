import {
	asBoolean,
	asMissingSurfaces,
	asString,
	asStringArray,
	commandText,
	hasCodestyleFailureReason,
	hasMissingSurface,
	initDryRunRecommendation,
	isMatrixOutputValidationError,
	recommendation,
	surfacePaths,
	type FleetPlanRepo,
	type MatrixRepoResult,
	type RepoRecommendation,
	type RepoSignals,
} from "./fleet-plan-types.js";

type BlockingReasonArgs = {
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
};

type BlockingReasonCheck = {
	reason: string;
	matches: (args: BlockingReasonArgs) => boolean;
};

type RepoActionRule = {
	matches: (signals: RepoSignals) => boolean;
	build: (repo: string) => RepoRecommendation;
};

const BLOCKING_REASON_CHECKS: BlockingReasonCheck[] = [
	{
		reason: "dry-run-mutated-repository",
		matches: (args) => args.statusChangedByDryRun,
	},
	{
		reason: "matrix-command-failed",
		matches: (args) => args.exitCode !== undefined && args.exitCode !== 0,
	},
	{
		reason: "invalid-matrix-json-output",
		matches: (args) => args.errors.some(isMatrixOutputValidationError),
	},
	{
		reason: "repo-not-harness-tracked",
		matches: (args) => args.trackedManifest === false,
	},
	{
		reason: "tracked-repo-missing-circleci",
		matches: (args) => args.trackedManifest === true && args.hasCircleCiGap,
	},
	{
		reason: "missing-coderabbit",
		matches: (args) => args.hasCodeRabbitGap,
	},
	{
		reason: "missing-codestyle",
		matches: hasUnsafeCodestyleGap,
	},
	{
		reason: "stale-codestyle",
		matches: (args) => args.codestyleParityFailurePaths.length > 0,
	},
	{
		reason: "legacy-greptile-present",
		matches: (args) => args.hasGreptileGap,
	},
];

const REPO_ACTION_RULES: RepoActionRule[] = [
	{
		matches: hasUnsafeMatrixSignals,
		build: blockedMatrixRecommendation,
	},
	{
		matches: (signals) => signals.trackedManifest === false,
		build: (repo) =>
			initDryRunRecommendation({
				repo,
				status: "needs-adoption",
				nextAction: "Run first-adoption dry-run before tracking the repo.",
				update: false,
			}),
	},
	{
		matches: (signals) => signals.hasCircleCiGap,
		build: circleCiMigrationRecommendation,
	},
	{
		matches: (signals) => signals.hasCodeRabbitGap,
		build: (repo) =>
			initDryRunRecommendation({
				repo,
				status: "needs-coderabbit-setup",
				nextAction: "Refresh the CodeRabbit review baseline in dry-run mode.",
				update: true,
			}),
	},
	{
		matches: hasUnsafeCodestyleGap,
		build: (repo) =>
			initDryRunRecommendation({
				repo,
				status: "needs-codestyle-install",
				nextAction: "Install the canonical CODESTYLE pack in dry-run mode.",
				update: true,
			}),
	},
	{
		matches: (signals) => signals.codestyleParityFailurePaths.length > 0,
		build: (repo) =>
			initDryRunRecommendation({
				repo,
				status: "needs-codestyle-refresh",
				nextAction: "Refresh the canonical CODESTYLE pack in dry-run mode.",
				update: true,
			}),
	},
	{
		matches: (signals) => signals.hasGreptileGap,
		build: (repo) =>
			recommendation({
				status: "needs-greptile-cleanup",
				risk: "medium",
				nextAction:
					"Preview harness-managed cleanup for legacy Greptile artifacts.",
				nextCommandArgv: ["harness", "eject", repo, "--dry-run", "--json"],
				safeToRun: true,
			}),
	},
	{
		matches: (signals) => signals.errors.length > 0,
		build: remainingErrorsRecommendation,
	},
];

function hasUnsafeCodestyleGap(
	input: Pick<RepoSignals, "hasCodestyleGap" | "hasCodestyleMissingFailure">,
): boolean {
	return input.hasCodestyleGap || input.hasCodestyleMissingFailure;
}

function hasUnsafeMatrixSignals(signals: RepoSignals): boolean {
	return (
		signals.statusChangedByDryRun ||
		(signals.exitCode !== undefined && signals.exitCode !== 0) ||
		signals.errors.some(isMatrixOutputValidationError)
	);
}

function blockedMatrixRecommendation(): RepoRecommendation {
	return recommendation({
		status: "blocked",
		risk: "high",
		nextAction:
			"Inspect the matrix failure before running remediation; dry-run safety is not established.",
		nextCommandArgv: null,
		safeToRun: false,
	});
}

function circleCiMigrationRecommendation(repo: string): RepoRecommendation {
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

function remainingErrorsRecommendation(): RepoRecommendation {
	return recommendation({
		status: "blocked",
		risk: "unknown",
		nextAction: "Inspect remaining matrix errors before remediation.",
		nextCommandArgv: null,
		safeToRun: false,
	});
}

function readyRecommendation(repo: string): RepoRecommendation {
	return recommendation({
		status: "ready",
		risk: "low",
		nextAction: "Run live upgrade dry-run before applying update.",
		nextCommandArgv: ["harness", "upgrade", repo, "--dry-run", "--json"],
		safeToRun: true,
	});
}

function schemaErrorsFor(
	result: MatrixRepoResult,
	repoCandidate: string | null,
	trackedManifest: boolean | null,
): string[] {
	const schemaErrors: string[] = [];
	if (!repoCandidate || repoCandidate.length === 0) {
		schemaErrors.push("JSON output missing repo");
	}
	if (!Array.isArray(result.errors)) {
		schemaErrors.push("JSON output missing errors array");
	}
	if (!Array.isArray(result.missingFleetContractSurfaces)) {
		schemaErrors.push("JSON output missing missingFleetContractSurfaces array");
	}
	if (trackedManifest === null) {
		schemaErrors.push("JSON output missing trackedManifest");
	}
	return schemaErrors;
}

function repoSignalsFor(result: MatrixRepoResult): RepoSignals {
	const trackedManifest = asBoolean(result.trackedManifest);
	const repoCandidate = asString(result.repo);
	const schemaErrors = schemaErrorsFor(result, repoCandidate, trackedManifest);
	const missingSurfaces = asMissingSurfaces(
		result.missingFleetContractSurfaces,
	);
	const legacyGreptilePaths = asStringArray(result.legacyGreptilePaths);
	const codestyleParityFailures = asMissingSurfaces(
		result.codestyleParityFailures,
	);
	const exitCode =
		typeof result.exitCode === "number" ? result.exitCode : undefined;
	return {
		statusChangedByDryRun: result.statusChangedByDryRun === true,
		...(exitCode === undefined ? {} : { exitCode }),
		errors: [...schemaErrors, ...asStringArray(result.errors)],
		trackedManifest,
		hasCircleCiGap: hasMissingSurface(missingSurfaces, "circleci"),
		hasCodeRabbitGap: hasMissingSurface(missingSurfaces, "coderabbit"),
		hasCodestyleGap: hasMissingSurface(missingSurfaces, "codestyle"),
		codestyleParityFailurePaths: surfacePaths(codestyleParityFailures),
		hasCodestyleMissingFailure: hasCodestyleFailureReason(
			codestyleParityFailures,
			"missing",
		),
		hasGreptileGap: legacyGreptilePaths.length > 0,
	};
}

/**
 * Assembles an ordered list of stable blocking reason codes for a repository based on dry-run results, exit status, detected gaps, and reported errors.
 *
 * @param args.statusChangedByDryRun - Whether a dry-run reported repository mutations.
 * @param args.trackedManifest - `true` if the repo is tracked by Harness, `false` if explicitly untracked, `null` if unknown.
 * @returns An array of reason codes describing why the repo is not live-upgrade ready, for example:
 * `dry-run-mutated-repository`, `matrix-command-failed`, `invalid-matrix-json-output`,
 * `matrix-reported-errors`, `repo-not-harness-tracked`, `tracked-repo-missing-circleci`,
 * `missing-coderabbit`, `missing-codestyle`, `stale-codestyle`, `legacy-greptile-present`.
 * The reasons are returned in evaluation order.
 */
export function buildBlockingReasons(args: {
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
	const blockingReasons = BLOCKING_REASON_CHECKS.filter((check) =>
		check.matches(args),
	).map((check) => check.reason);
	if (
		args.errors.some((error) => !isMatrixOutputValidationError(error)) &&
		blockingReasons.length === 0
	) {
		blockingReasons.push("matrix-reported-errors");
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
export function recommendRepoAction(
	repo: string,
	signals: RepoSignals,
): RepoRecommendation {
	for (const rule of REPO_ACTION_RULES) {
		if (rule.matches(signals)) {
			return rule.build(repo);
		}
	}
	return readyRecommendation(repo);
}

/**
 * Convert a single matrix row into a normalized FleetPlanRepo containing the chosen recommendation, blocking reasons, and retained evidence.
 *
 * @param result - A single repository result object from a parsed matrix artifact.
 * @param matrixArtifact - The source matrix artifact path or identifier included in the repo's evidence.
 * @returns A FleetPlanRepo describing the repo's status, risk, whether it is safe to run, the recommended next action/command, any blocking reason codes, and the evidence extracted from the matrix row.
 */
export function classifyRepo(
	result: MatrixRepoResult,
	matrixArtifact: string,
): FleetPlanRepo {
	const repoCandidate = asString(result.repo);
	const repo =
		repoCandidate && repoCandidate.length > 0
			? repoCandidate
			: "<unknown-repo>";
	const updateMode = asString(result.updateMode);
	const signals = repoSignalsFor(result);
	const missingSurfaces = asMissingSurfaces(
		result.missingFleetContractSurfaces,
	);
	const missingSurfacePaths = surfacePaths(missingSurfaces);
	const legacyGreptilePaths = asStringArray(result.legacyGreptilePaths);
	const recommendation = recommendRepoAction(repo, signals);
	const blockingReasons = buildBlockingReasons(signals);

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
			trackedManifest: signals.trackedManifest,
			missingSurfaces: missingSurfacePaths,
			legacyGreptilePaths,
			codestyleParityFailures: signals.codestyleParityFailurePaths,
			errors: signals.errors,
		},
	};
}
