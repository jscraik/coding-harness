/**
 * Preflight policy validator
 *
 * Fast, lightweight checks designed to run before expensive operations
 * like full test suites or builds.
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { isMissingContractError } from "../contract/errors.js";
import { loadContract } from "../contract/loader.js";
import type {
	HarnessContract,
	PreflightGateExtensionsPolicy,
	RiskTier,
} from "../contract/types.js";
import { resolveOverallTier } from "../policy/risk-tier.js";
import { detectHarnessVersionCoherence } from "../version-coherence.js";
import {
	EXIT_CODES,
	type PreflightAdmissionDeclaration,
	type PreflightCheck,
	type PreflightCheckFn,
	type PreflightCheckRegistry,
	type PreflightGateOptions,
	type PreflightGateResult,
	type PreflightHookDecision,
	type PreflightNorthStarSummary,
} from "./types.js";

export type { PreflightGateOptions };

/**
 * Quick file size check (large files slow down review)
 */
const fileSizeCheck: PreflightCheckFn = (options) => {
	const start = Date.now();
	const files = options.files ?? [];
	const largeFiles: string[] = [];
	const MAX_SIZE_BYTES = 500 * 1024; // 500KB

	for (const file of files) {
		try {
			if (existsSync(file)) {
				const stats = readFileSync(file);
				if (stats.length > MAX_SIZE_BYTES) {
					largeFiles.push(file);
				}
			}
		} catch {
			// Skip files we can't read
		}
	}

	return {
		id: "file-size",
		description: "Check for oversized files",
		severity: "warning",
		passed: largeFiles.length === 0,
		message:
			largeFiles.length > 0
				? `${largeFiles.length} files exceed 500KB: ${largeFiles.join(", ")}`
				: undefined,
		files: largeFiles,
		durationMs: Date.now() - start,
	};
};

/**
 * Contract existence check
 */
const contractExistsCheck: PreflightCheckFn = (options) => {
	const start = Date.now();
	const contractPath = resolve(options.contractPath ?? "harness.contract.json");
	const exists = existsSync(contractPath);

	return {
		id: "contract-exists",
		description: "Verify harness contract exists",
		severity: "error",
		passed: exists,
		message: exists ? undefined : `Contract not found: ${contractPath}`,
		durationMs: Date.now() - start,
	};
};

/**
 * Risk tier validation (quick version)
 */
const riskTierCheck: PreflightCheckFn = (options) => {
	const start = Date.now();
	const contractPath = resolve(options.contractPath ?? "harness.contract.json");

	if (!existsSync(contractPath) || !options.files?.length) {
		return {
			id: "risk-tier",
			description: "Validate risk tier against contract",
			severity: "error",
			passed: true,
			message: "Skipped: no contract or files provided",
			durationMs: Date.now() - start,
		};
	}

	try {
		const contract = loadContract(contractPath);
		const tier = resolveOverallTier(options.files ?? [], contract);

		// Check against max tier if specified
		if (options.maxTier) {
			const TIER_ORDER: RiskTier[] = ["high", "medium", "low"];
			const maxIndex = TIER_ORDER.indexOf(options.maxTier);
			const actualIndex = TIER_ORDER.indexOf(tier);

			if (actualIndex < maxIndex) {
				return {
					id: "risk-tier",
					description: "Validate risk tier against policy",
					severity: "error",
					passed: false,
					message: `Risk tier '${tier}' exceeds maximum allowed '${options.maxTier}'`,
					durationMs: Date.now() - start,
				};
			}
		}

		return {
			id: "risk-tier",
			description: "Validate risk tier against contract",
			severity: "error",
			passed: true,
			message: `Current tier: ${tier}`,
			durationMs: Date.now() - start,
		};
	} catch (error) {
		return {
			id: "risk-tier",
			description: "Validate risk tier against contract",
			severity: "error",
			passed: false,
			message: `Failed to evaluate: ${(error as Error).message}`,
			durationMs: Date.now() - start,
		};
	}
};

/**
 * Forbidden pattern check (quick regex scan)
 */
const forbiddenPatternCheck: PreflightCheckFn = (options) => {
	const start = Date.now();
	const files = options.files ?? [];
	const violations: Array<{ file: string; pattern: string }> = [];

	// Common forbidden patterns
	const forbiddenPatterns: Array<{ pattern: RegExp; name: string }> = [
		{ pattern: /console\.log\s*\(/, name: "console.log" },
		{ pattern: /debugger\s*;/, name: "debugger statement" },
		{ pattern: /TODO\s*:\s*FIXME/i, name: "TODO FIXME marker" },
		{ pattern: /\.skip\s*\(/, name: "skipped test" },
	];

	for (const file of files) {
		if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;

		try {
			const content = readFileSync(file, "utf-8");
			for (const { pattern, name } of forbiddenPatterns) {
				if (pattern.test(content)) {
					violations.push({ file, pattern: name });
				}
			}
		} catch {
			// Skip files we can't read
		}
	}

	return {
		id: "forbidden-patterns",
		description: "Check for forbidden code patterns",
		severity: "warning",
		passed: violations.length === 0,
		message:
			violations.length > 0
				? `Found ${violations.length} violations: ${violations.map((v) => `${v.file} (${v.pattern})`).join(", ")}`
				: undefined,
		files: violations.map((v) => v.file),
		durationMs: Date.now() - start,
	};
};

/**
 * Git repository check
 */
const gitRepositoryCheck: PreflightCheckFn = () => {
	const start = Date.now();
	const gitDir = resolve(".git");
	const exists = existsSync(gitDir);

	return {
		id: "git-repository",
		description: "Verify git repository exists",
		severity: "error",
		passed: exists,
		message: exists ? undefined : "Not a git repository",
		durationMs: Date.now() - start,
	};
};

/**
 * Global vs repo-local harness version coherence check
 */
const harnessVersionCoherenceCheck: PreflightCheckFn = () => {
	const start = Date.now();
	const coherence = detectHarnessVersionCoherence(process.cwd());

	if (coherence.status === "drift") {
		return {
			id: "harness-version-coherence",
			description: "Verify harness version coherence",
			severity: "error",
			passed: false,
			message: coherence.remediation
				? `${coherence.message}. ${coherence.remediation}`
				: coherence.message,
			durationMs: Date.now() - start,
		};
	}

	if (coherence.status === "error") {
		return {
			id: "harness-version-coherence",
			description: "Verify harness version coherence",
			severity: "warning",
			passed: false,
			message: coherence.remediation
				? `${coherence.message}. ${coherence.remediation}`
				: coherence.message,
			durationMs: Date.now() - start,
		};
	}

	return {
		id: "harness-version-coherence",
		description: "Verify harness version coherence",
		severity: "error",
		passed: true,
		message: coherence.message,
		durationMs: Date.now() - start,
	};
};

/**
 * Registry of all available preflight checks
 */
export const PREFLIGHT_CHECKS: PreflightCheckRegistry = {
	"git-repository": {
		name: "Git Repository",
		description: "Verify this is a git repository",
		severity: "error",
		fn: gitRepositoryCheck,
	},
	"harness-version-coherence": {
		name: "Harness Version Coherence",
		description: "Detect global vs repo-local harness version drift",
		severity: "error",
		fn: harnessVersionCoherenceCheck,
	},
	"contract-exists": {
		name: "Contract Exists",
		description: "Verify harness.contract.json exists",
		severity: "error",
		fn: contractExistsCheck,
	},
	"risk-tier": {
		name: "Risk Tier",
		description: "Validate files against risk tier policy",
		severity: "error",
		fn: riskTierCheck,
	},
	"file-size": {
		name: "File Size",
		description: "Check for oversized files",
		severity: "warning",
		fn: fileSizeCheck,
	},
	"forbidden-patterns": {
		name: "Forbidden Patterns",
		description:
			"Check for forbidden code patterns (console.log, debugger, etc.)",
		severity: "warning",
		fn: forbiddenPatternCheck,
	},
};

/**
 * Run preflight gate with selected checks
 */
export async function runPreflightGate(
	options: PreflightGateOptions,
): Promise<PreflightGateResult> {
	const start = Date.now();
	const checks: PreflightCheck[] = [];
	const hookDecisions: PreflightHookDecision[] = [];
	const contractPath = resolve(options.contractPath ?? "harness.contract.json");
	const contractLoad = loadPreflightContract(contractPath);
	if (contractLoad.errorMessage) {
		checks.push({
			id: "contract-load",
			description: "Load and validate harness contract",
			severity: "error",
			passed: false,
			message: contractLoad.errorMessage,
			durationMs: contractLoad.durationMs,
		});
		return buildPreflightResult(false, checks, start, undefined, hookDecisions);
	}
	const contract = contractLoad.contract;
	const extensions = contract?.gateExtensions?.preflightGate;
	const riskTier = resolveRiskTier(options, contract);
	const northStarSummary = buildNorthStarSummary(contract);

	// Run pre-gate extension hooks before native checks.
	const shortCircuit = runPreHooks(extensions, checks, hookDecisions);
	if (shortCircuit !== undefined) {
		return buildPreflightResult(
			shortCircuit,
			checks,
			start,
			riskTier,
			hookDecisions,
			northStarSummary,
			options.admission,
		);
	}

	const admissionCheck = validateAdmissionDeclaration(
		options.admission,
		contract,
		contractLoad.northStarDeclared,
		options,
	);
	if (admissionCheck) {
		checks.push(admissionCheck);
	}

	// Determine which checks to run
	const checkIds = Object.keys(PREFLIGHT_CHECKS).filter(
		(id) => !options.skip?.includes(id),
	);

	// Run all checks in parallel
	const checkPromises = checkIds.map(async (id) => {
		const check = PREFLIGHT_CHECKS[id];
		if (!check) return null;
		return check.fn(options);
	});

	const results = await Promise.all(checkPromises);

	for (const result of results) {
		if (result) {
			checks.push(result);
		}
	}

	// Run post-gate extension hooks after native checks.
	runPostHooks(extensions, checks, hookDecisions);

	const passed = evaluatePass(checks, options.strict === true);

	return buildPreflightResult(
		passed,
		checks,
		start,
		riskTier,
		hookDecisions,
		northStarSummary,
		options.admission,
	);
}

function loadPreflightContract(contractPath: string): {
	contract: HarnessContract | undefined;
	errorMessage: string | undefined;
	durationMs: number;
	northStarDeclared: boolean;
} {
	const start = Date.now();
	if (!existsSync(contractPath)) {
		return {
			contract: undefined,
			errorMessage: undefined,
			durationMs: Date.now() - start,
			northStarDeclared: false,
		};
	}

	let northStarDeclared = false;
	try {
		const contractSource = readFileSync(contractPath, "utf-8");
		const parsedSource = JSON.parse(contractSource) as unknown;
		if (typeof parsedSource === "object" && parsedSource !== null) {
			northStarDeclared = Object.prototype.hasOwnProperty.call(
				parsedSource,
				"northStar",
			);
		}
	} catch {
		// Ignore source-parse failures here. loadContract will report parsing errors.
	}

	try {
		return {
			contract: loadContract(contractPath),
			errorMessage: undefined,
			durationMs: Date.now() - start,
			northStarDeclared,
		};
	} catch (error) {
		if (isMissingContractError(error)) {
			return {
				contract: undefined,
				errorMessage: undefined,
				durationMs: Date.now() - start,
				northStarDeclared: false,
			};
		}
		const message = error instanceof Error ? error.message : String(error);
		return {
			contract: undefined,
			errorMessage: `Invalid contract: ${message}`,
			durationMs: Date.now() - start,
			northStarDeclared,
		};
	}
}
function resolveRiskTier(
	options: PreflightGateOptions,
	contract: HarnessContract | undefined,
): RiskTier | undefined {
	if (!contract || !options.files?.length) {
		return undefined;
	}
	try {
		return resolveOverallTier(options.files, contract);
	} catch {
		return undefined;
	}
}

function evaluatePass(checks: PreflightCheck[], strict: boolean): boolean {
	const failedChecks = checks.filter((check) => !check.passed);
	const hasError = failedChecks.some((check) => check.severity === "error");
	const hasWarning = failedChecks.some((check) => check.severity === "warning");
	return !hasError && (!strict || !hasWarning);
}

function buildPreflightResult(
	passed: boolean,
	checks: PreflightCheck[],
	start: number,
	riskTier: RiskTier | undefined,
	hookDecisions: PreflightHookDecision[],
	northStarSummary?: PreflightNorthStarSummary,
	admissionDeclaration?: PreflightAdmissionDeclaration,
): PreflightGateResult {
	const failedChecks = checks.filter((check) => !check.passed);
	const warningChecks = failedChecks.filter(
		(check) => check.severity === "warning",
	);

	return {
		passed,
		checks,
		summary: {
			total: checks.length,
			passed: checks.filter((check) => check.passed).length,
			failed: failedChecks.length,
			warnings: warningChecks.length,
			durationMs: Date.now() - start,
		},
		riskTier,
		hookDecisions: hookDecisions.length > 0 ? hookDecisions : undefined,
		northStarSummary,
		admissionDeclaration,
	};
}

function buildNorthStarSummary(
	contract: HarnessContract | undefined,
): PreflightNorthStarSummary | undefined {
	const northStar = contract?.northStar;
	if (!northStar) {
		return undefined;
	}
	return {
		mission: northStar.mission,
		primary_metric: northStar.primaryMetric,
		primary_bottleneck: northStar.primaryBottleneck,
		autonomy_boundary: northStar.autonomyBoundary,
		safety_floor: northStar.safetyFloor,
	};
}

function validateAdmissionDeclaration(
	declaration: PreflightAdmissionDeclaration | undefined,
	contract: HarnessContract | undefined,
	northStarDeclared: boolean,
	options?: Pick<PreflightGateOptions, "skip" | "files">,
): PreflightCheck | undefined {
	if (options?.skip?.includes("admission-declaration")) {
		return undefined;
	}

	if (!declaration) {
		if (!northStarDeclared) {
			return undefined;
		}
		return {
			id: "admission-declaration",
			description: "Validate north-star admission declaration",
			severity: "error",
			passed: false,
			message:
				"admission_incomplete: admission declaration is required when contract northStar is defined; provide --admission-file or explicitly bypass with --skip admission-declaration",
			durationMs: 0,
		};
	}

	const start = Date.now();
	type AdmissionFailureClass =
		| "admission_incomplete"
		| "admission_unjustified"
		| "surface_registration_gap";
	type AdmissionIssue = {
		failureClass: AdmissionFailureClass;
		message: string;
	};
	const issues: AdmissionIssue[] = [];
	const addIssue = (
		message: string,
		failureClass: AdmissionFailureClass = "admission_incomplete",
	): void => {
		issues.push({ failureClass, message });
	};
	const asNonEmptyString = (value: unknown): string | undefined => {
		if (typeof value !== "string") {
			return undefined;
		}
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	};
	const asNonEmptyStringArray = (value: unknown): string[] | undefined => {
		if (!Array.isArray(value)) {
			return undefined;
		}
		return value
			.map((item) => (typeof item === "string" ? item.trim() : ""))
			.filter((item) => item.length > 0);
	};
	const normalizeRepoRelativePath = (value: string): string => {
		const normalizedSlashes = value.replace(/\\/g, "/").trim();
		const withoutDotPrefix = normalizedSlashes.replace(/^\.\//, "");
		if (!isAbsolute(withoutDotPrefix)) {
			return withoutDotPrefix;
		}
		const cwdRelative = relative(process.cwd(), withoutDotPrefix).replace(
			/\\/g,
			"/",
		);
		return cwdRelative.startsWith("../") ? withoutDotPrefix : cwdRelative;
	};
	const toGlobRegex = (pattern: string): RegExp => {
		const escapedPattern = pattern.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
		const regexPattern = escapedPattern
			.replace(/\\\*\\\*/g, "<<<DOUBLE_STAR>>>")
			.replace(/\\\?/g, "[^/]")
			.replace(/\\\*/g, "[^/]*")
			.replace(/<<<DOUBLE_STAR>>>/g, ".*");
		return new RegExp(`^${regexPattern}$`);
	};
	const matchesOwnedPath = (
		changedPath: string,
		ownedPath: string,
	): boolean => {
		const normalizedChangedPath = normalizeRepoRelativePath(changedPath);
		const normalizedOwnedPath = normalizeRepoRelativePath(ownedPath);
		if (normalizedOwnedPath.length === 0) {
			return false;
		}
		if (/[?*]/u.test(normalizedOwnedPath)) {
			return toGlobRegex(normalizedOwnedPath).test(normalizedChangedPath);
		}
		return (
			normalizedChangedPath === normalizedOwnedPath ||
			normalizedChangedPath.startsWith(`${normalizedOwnedPath}/`)
		);
	};
	const deriveGovernedRootsFromOwnedPath = (ownedPath: string): string[] => {
		const normalizedOwnedPath = normalizeRepoRelativePath(ownedPath).replace(
			/\/+$/,
			"",
		);
		if (normalizedOwnedPath.length === 0) {
			return [];
		}

		const wildcardMatch = normalizedOwnedPath.match(/[?*]/u);
		if (wildcardMatch && wildcardMatch.index !== undefined) {
			const staticPrefix = normalizedOwnedPath
				.slice(0, wildcardMatch.index)
				.replace(/\/+$/, "");
			if (staticPrefix.length === 0) {
				return [];
			}
			const parentPrefix = staticPrefix.replace(/\/[^/]*$/, "");
			return parentPrefix.length > 0
				? [staticPrefix, parentPrefix]
				: [staticPrefix];
		}

		const pathSegments = normalizedOwnedPath.split("/").filter(Boolean);
		if (pathSegments.length <= 1) {
			return [normalizedOwnedPath];
		}
		return [normalizedOwnedPath, pathSegments.slice(0, -1).join("/")];
	};
	const legacyGovernedRoots = [
		"harness.contract.json",
		"docs/roadmap/",
		"README.md",
		"scripts/codex-preflight.sh",
		"scripts/verify-work.sh",
		"src/commands/",
	];
	const hasExplicitProductSurfaceRegistry =
		(contract?.productSurface?.surfaces?.length ?? 0) > 0;
	const rootlessWildcardOwnedPaths = new Set<string>();
	const governedRoots = (() => {
		const contractOwnedRoots = new Set<string>();
		for (const surface of contract?.productSurface?.surfaces ?? []) {
			for (const ownedPath of surface.ownedPaths ?? []) {
				const normalizedOwnedPath = normalizeRepoRelativePath(
					ownedPath,
				).replace(/\/+$/, "");
				const wildcardMatch = normalizedOwnedPath.match(/[?*]/u);
				if (normalizedOwnedPath.length > 0 && wildcardMatch?.index === 0) {
					rootlessWildcardOwnedPaths.add(normalizedOwnedPath);
				}
				for (const root of deriveGovernedRootsFromOwnedPath(ownedPath)) {
					const normalizedRoot = normalizeRepoRelativePath(root).replace(
						/\/+$/,
						"",
					);
					if (normalizedRoot.length > 0) {
						contractOwnedRoots.add(normalizedRoot);
					}
				}
			}
		}
		return contractOwnedRoots.size > 0 || hasExplicitProductSurfaceRegistry
			? [...contractOwnedRoots]
			: legacyGovernedRoots.map((root) =>
					normalizeRepoRelativePath(root).replace(/\/+$/, ""),
				);
	})();
	const isGovernedPath = (pathValue: string): boolean => {
		const normalizedPath = normalizeRepoRelativePath(pathValue);
		if (
			governedRoots.some(
				(normalizedRoot) =>
					normalizedPath === normalizedRoot ||
					normalizedPath.startsWith(`${normalizedRoot}/`),
			)
		) {
			return true;
		}
		return [...rootlessWildcardOwnedPaths].some((ownedPath) =>
			matchesOwnedPath(normalizedPath, ownedPath),
		);
	};
	const isEvidenceReference = (value: string): boolean => {
		const lineRefPath = value.split(":")[0] ?? "";
		if (/^https?:\/\/\S+$/iu.test(value)) {
			return true;
		}
		if (/^\[[^\]]+\]\([^)]+\)$/u.test(value)) {
			return true;
		}
		if (/^[^:\s]+:\d+$/u.test(value) && /[./\\]/u.test(lineRefPath)) {
			return true;
		}
		if (/^[A-Za-z0-9._~/-]+\.[A-Za-z0-9_-]+(?::\d+)?$/u.test(value)) {
			return true;
		}
		if (
			/^(artifacts|docs|src|scripts|tests|todos|codex|\.codex|\.harness)\//u.test(
				value,
			)
		) {
			return true;
		}
		return false;
	};
	const northStarMetric = asNonEmptyString(declaration.north_star_metric);
	const primaryBottleneck = asNonEmptyString(declaration.primary_bottleneck);
	const affectedSurfaceIds = asNonEmptyStringArray(
		declaration.affected_surface_ids,
	);
	const affectedSurfaceClasses = asNonEmptyStringArray(
		declaration.affected_surface_classes,
	);
	const evidenceLinks = asNonEmptyStringArray(declaration.evidence_links);
	const metricImpactDeclared =
		typeof declaration.metric_impact_declared === "string"
			? declaration.metric_impact_declared
			: undefined;
	const validMetricImpacts = new Set(["direct", "path_strengthening", "none"]);
	const throughputRationale = asNonEmptyString(
		declaration.why_this_improves_throughput_or_reliability,
	);
	if (!northStarMetric) {
		addIssue("north_star_metric is required");
	}
	if (!primaryBottleneck) {
		addIssue("primary_bottleneck is required");
	}
	if (affectedSurfaceIds === undefined || affectedSurfaceIds.length === 0) {
		addIssue("affected_surface_ids must contain at least one surface id");
	}
	if (
		affectedSurfaceClasses === undefined ||
		affectedSurfaceClasses.length === 0
	) {
		addIssue(
			"affected_surface_classes must contain at least one surface class",
		);
	}
	if (!Number.isFinite(declaration.policy_surface_delta)) {
		addIssue("policy_surface_delta must be a finite number");
	}
	if (!Number.isFinite(declaration.manual_glue_delta)) {
		addIssue("manual_glue_delta must be a finite number");
	}
	if (evidenceLinks === undefined || evidenceLinks.length === 0) {
		addIssue("evidence_links must contain at least one evidence reference");
	} else {
		const invalidEvidenceReferences = evidenceLinks.filter(
			(reference) => !isEvidenceReference(reference),
		);
		if (invalidEvidenceReferences.length > 0) {
			addIssue(
				`evidence_links entries must be URL, markdown link, path, or file:line reference (invalid: ${invalidEvidenceReferences.join(", ")})`,
			);
		}
	}
	if (!throughputRationale) {
		addIssue("why_this_improves_throughput_or_reliability is required");
	}
	if (
		metricImpactDeclared === undefined ||
		!validMetricImpacts.has(metricImpactDeclared)
	) {
		addIssue(
			"metric_impact_declared must be one of: direct, path_strengthening, none",
		);
	}
	if (
		declaration.policy_surface_delta > 0 &&
		declaration.metric_impact_declared === "none"
	) {
		addIssue(
			"metric_impact_declared cannot be 'none' when policy_surface_delta > 0",
			"admission_unjustified",
		);
	}
	if (contract?.northStar) {
		if (
			northStarMetric &&
			northStarMetric !== contract.northStar.primaryMetric
		) {
			addIssue(
				`north_star_metric must match contract primaryMetric '${contract.northStar.primaryMetric}'`,
			);
		}
		if (
			primaryBottleneck &&
			primaryBottleneck !== contract.northStar.primaryBottleneck
		) {
			addIssue(
				`primary_bottleneck must match contract primaryBottleneck '${contract.northStar.primaryBottleneck}'`,
			);
		}
	}
	if (contract?.productSurface?.surfaces) {
		const registeredSurfaces = contract.productSurface.surfaces;
		const registeredSurfaceIds = new Set(
			registeredSurfaces
				.map((surface) => surface.surfaceId?.trim())
				.filter((surfaceId): surfaceId is string => Boolean(surfaceId)),
		);
		if (
			registeredSurfaceIds.size > 0 &&
			affectedSurfaceIds &&
			affectedSurfaceIds.length > 0
		) {
			const unknownSurfaceIds = affectedSurfaceIds.filter(
				(surfaceId) => !registeredSurfaceIds.has(surfaceId),
			);
			if (unknownSurfaceIds.length > 0) {
				addIssue(
					`affected_surface_ids contains unknown surface id(s): ${unknownSurfaceIds.join(", ")}`,
					"surface_registration_gap",
				);
			}
		}
		if (
			affectedSurfaceIds &&
			affectedSurfaceIds.length > 0 &&
			affectedSurfaceClasses &&
			affectedSurfaceClasses.length > 0
		) {
			const expectedClasses = new Set(
				registeredSurfaces
					.filter((surface) => affectedSurfaceIds.includes(surface.surfaceId))
					.map((surface) => surface.class?.trim())
					.filter(
						(surfaceClass): surfaceClass is string =>
							typeof surfaceClass === "string" && surfaceClass.length > 0,
					),
			);
			const mismatchedClasses = affectedSurfaceClasses.filter(
				(surfaceClass) => !expectedClasses.has(surfaceClass),
			);
			if (expectedClasses.size > 0 && mismatchedClasses.length > 0) {
				addIssue(
					`affected_surface_classes contains class(es) not registered for affected_surface_ids: ${mismatchedClasses.join(", ")}; expected: ${[...expectedClasses].join(", ")}`,
					"surface_registration_gap",
				);
			}
		}
		if (registeredSurfaces.length > 0) {
			const governedChangedFiles = (options?.files ?? [])
				.map((filePath) => normalizeRepoRelativePath(filePath))
				.filter((filePath) => isGovernedPath(filePath));
			for (const governedFile of governedChangedFiles) {
				const matchedByInventory = registeredSurfaces.some((surface) =>
					(surface.ownedPaths ?? []).some((ownedPath) =>
						matchesOwnedPath(governedFile, ownedPath),
					),
				);
				if (!matchedByInventory) {
					addIssue(
						`governed changed file '${governedFile}' is not covered by productSurface.surfaces[].ownedPaths`,
						"surface_registration_gap",
					);
				}
			}
		}
	}

	return {
		id: "admission-declaration",
		description: "Validate north-star admission declaration",
		severity: "error",
		passed: issues.length === 0,
		message:
			issues.length === 0
				? "Admission declaration is complete and aligned to contract north-star fields"
				: issues
						.map((issue) => `${issue.failureClass}: ${issue.message}`)
						.join("; "),
		durationMs: Date.now() - start,
	};
}

function runPreHooks(
	extensions: PreflightGateExtensionsPolicy | undefined,
	checks: PreflightCheck[],
	hookDecisions: PreflightHookDecision[],
): boolean | undefined {
	for (const hook of extensions?.pre ?? []) {
		if (hook.enabled === false) {
			continue;
		}
		const startedAt = Date.now();
		if (hook.id === "skip-all-checks") {
			const message =
				"Pre-hook short-circuited preflight gate and skipped native checks";
			checks.push({
				id: "hook:pre:skip-all-checks",
				description: "Apply pre-hook skip-all-checks",
				severity: "info",
				passed: true,
				message,
				durationMs: Date.now() - startedAt,
			});
			hookDecisions.push({
				phase: "pre",
				hookId: hook.id,
				action: "short-circuit",
				message,
			});
			return true;
		}
		if (hook.id === "force-fail") {
			const message =
				"Pre-hook force-fail overrode execution and failed preflight gate";
			checks.push({
				id: "hook:pre:force-fail",
				description: "Apply pre-hook force-fail",
				severity: "error",
				passed: false,
				message,
				durationMs: Date.now() - startedAt,
			});
			hookDecisions.push({
				phase: "pre",
				hookId: hook.id,
				action: "override",
				message,
			});
			return false;
		}

		const message = `Unsupported pre-hook id '${hook.id}'`;
		checks.push({
			id: `hook:pre:${hook.id}`,
			description: "Apply pre-hook",
			severity: "error",
			passed: false,
			message,
			durationMs: Date.now() - startedAt,
		});
		hookDecisions.push({
			phase: "pre",
			hookId: hook.id,
			action: "block",
			message,
		});
		return false;
	}
	return undefined;
}

function runPostHooks(
	extensions: PreflightGateExtensionsPolicy | undefined,
	checks: PreflightCheck[],
	hookDecisions: PreflightHookDecision[],
): void {
	for (const hook of extensions?.post ?? []) {
		if (hook.enabled === false) {
			continue;
		}
		const startedAt = Date.now();
		if (hook.id === "fail-on-warnings") {
			const warningCount = checks.filter(
				(check) => !check.passed && check.severity === "warning",
			).length;
			const passed = warningCount === 0;
			const message = passed
				? "No warning findings detected"
				: `Post-hook blocked gate because ${warningCount} warning finding(s) were emitted`;
			checks.push({
				id: "hook:post:fail-on-warnings",
				description: "Apply post-hook fail-on-warnings",
				severity: "error",
				passed,
				message,
				durationMs: Date.now() - startedAt,
			});
			hookDecisions.push({
				phase: "post",
				hookId: hook.id,
				action: passed ? "continue" : "block",
				message,
			});
			continue;
		}

		const message = `Unsupported post-hook id '${hook.id}'`;
		checks.push({
			id: `hook:post:${hook.id}`,
			description: "Apply post-hook",
			severity: "error",
			passed: false,
			message,
			durationMs: Date.now() - startedAt,
		});
		hookDecisions.push({
			phase: "post",
			hookId: hook.id,
			action: "block",
			message,
		});
	}
}

export { EXIT_CODES };

// Re-export performance overload precheck for timing-sensitive check consumers
export {
	runPerformanceOverloadPrecheck,
	formatTimingAssertionSkipDiagnostic,
	PERFORMANCE_PRECHECK_ENV,
	type PerformanceOverloadPrecheckResult,
	type PerformanceOverloadPrecheckOptions,
	type PerformanceOverloadThresholds,
	type PerformanceOverloadObserved,
} from "./performance-overload.js";

// Re-export timing assertion overload guard for test suite consumers
export {
	evaluateTimingAssertionOverload,
	runTimingAssertionWithOverloadGuard,
	type TimingAssertionOverloadCheck,
} from "../test/overload-guard.js";
