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
	const trackedManifest = asBoolean(result.trackedManifest);
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
	const errors = [...schemaErrors, ...asStringArray(result.errors)];
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
