import { resolve } from "node:path";
import type { DocsGatePolicy, HarnessContract } from "../lib/contract/types.js";
import {
	DOC_LIFECYCLE_RULE_ID,
	collectDocLifecycleViolations,
} from "../lib/docs-surface/doc-lifecycle.js";
import { collectFrontmatterMetadataViolations } from "../lib/docs-surface/frontmatter-metadata-gate.js";
import {
	normaliseDocsGateResult,
	renderGateDecision,
} from "../lib/output/normalise.js";
import { collectArchiveCandidateDocsGateProjection } from "./docs-gate-archive-candidates.js";
import { classifyChanges } from "./docs-gate-classification.js";
import { collectContradictionFindings } from "./docs-gate-contradictions.js";
import {
	buildExecutionContext,
	loadValidatedContract,
	resolveChangedFiles,
} from "./docs-gate-files.js";
import {
	checkSurfacePresence,
	collectDeepModuleReadmeFindings,
	resolveRequiredSurfaces,
} from "./docs-gate-surfaces.js";
import {
	baseReport,
	buildReport,
	exitCodeFor,
	writeFallbackReport,
	writeReportAndHistory,
} from "./docs-gate-report.js";
import type {
	ChangedFilesResolution,
	ContradictionFinding,
	DocsFinding,
	DocsGateExecutionContext,
	DocsGateMode,
	DocsGateOptions,
	DocsGateOutcome,
	DocsGateReport,
	DocsGateResult,
} from "./docs-gate-types.js";
import { CONTRACT_PATH } from "./docs-gate-types.js";

export type {
	ChangedFilesResolution,
	ContradictionFinding,
	ContradictionRecord,
	DocsFinding,
	DocsGateErrorClass,
	DocsGateExecutionContext,
	DocsGateMode,
	DocsGateOptions,
	DocsGateOutcome,
	DocsGateReport,
	DocsGateResult,
	DocsGateStatus,
	DocsGateTrigger,
	DocsRuleResult,
	DocsSeverity,
} from "./docs-gate-types.js";

interface EvaluationSummary {
	categories: DocsGateReport["categories"];
	requiredSurfaces: string[];
	missing: string[];
	unknownFiles: string[];
	contradictionFindings: ContradictionFinding[];
	outcome: DocsGateOutcome;
	findings: DocsFinding[];
	archiveCounts: Partial<DocsGateReport["summary"]>;
}

interface RunContext {
	mode: DocsGateMode;
	repoRoot: string;
	changedFiles: string[];
	deletedFiles: Set<string>;
	resolution: ChangedFilesResolution;
	executionContext: DocsGateExecutionContext;
}

/**
 * Evaluate repository documentation policy and produce a report plus an exit code.
 *
 * @param options - Docs-gate invocation options and environment hints.
 * @returns Generated docs-gate report and the matching command exit code.
 */
export function runDocsGate(options: DocsGateOptions = {}): DocsGateResult {
	const context = buildRunContext(options);
	const contractResult = loadValidatedContract(context.repoRoot, CONTRACT_PATH);
	const contract = contractResult.loaded?.contract;
	const policy = contract?.docsGatePolicy;
	if (contractResult.error || !contract || !policy) {
		return bootstrapGapResult(context, contractResult.error);
	}
	context.executionContext = buildExecutionContext(
		options,
		policy,
		context.resolution.source,
	);
	if (!policy.enabled) return disabledResult(context);
	const evaluation = evaluateDocsPolicy(context, contract, policy);
	const report = buildReport(context, evaluation, options.trustedBaseRef);
	writeReportAndHistory(report, context.repoRoot, options.outPath, evaluation);
	return { report, exitCode: exitCodeFor(report.outcome, context.mode) };
}

function buildRunContext(options: DocsGateOptions): RunContext {
	const mode = options.mode ?? "advisory";
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const resolution = resolveChangedFiles(options, repoRoot);
	return {
		mode,
		repoRoot,
		changedFiles: resolution.changedFiles,
		deletedFiles: new Set(resolution.deletedFiles),
		resolution,
		executionContext: buildExecutionContext(
			options,
			undefined,
			resolution.source,
		),
	};
}

function bootstrapGapResult(
	context: RunContext,
	error?: string,
): DocsGateResult {
	const findings = [bootstrapFinding(context.mode, error)];
	const report = baseReport(context, {
		categories: [],
		requiredSurfaces: [],
		missing: [],
		unknownFiles: [],
		contradictionFindings: [],
		outcome: "bootstrap_gap",
		findings,
		archiveCounts: {},
	});
	report.status = context.mode === "required" ? "blocked" : "partial";
	report.summary.bootstrap_gap_count = 1;
	writeFallbackReport(report, context.repoRoot);
	return { report, exitCode: context.mode === "required" ? 11 : 0 };
}

function bootstrapFinding(mode: DocsGateMode, error?: string): DocsFinding {
	return {
		rule_id: "docs.gate.bootstrap_gap",
		category: "system",
		surface: "docsGatePolicy",
		rule_result: "error",
		result: "error",
		severity: mode === "required" ? "error" : "warning",
		message: error ?? "docsGatePolicy is missing from contract",
		details:
			"Add docsGatePolicy to harness.contract.json, run 'harness upgrade --dry-run' for the safe upgrade path, or use 'harness init --update' when tracked baseline files must be re-scaffolded. For downstream repos without tracked contract surfaces, run 'harness init --track' once (or manually add docsGatePolicy defaults) before re-running docs-gate.",
	};
}

function disabledResult(context: RunContext): DocsGateResult {
	const report = baseReport(context, {
		categories: [],
		requiredSurfaces: [],
		missing: [],
		unknownFiles: [],
		contradictionFindings: [],
		outcome: "ok",
		findings: [disabledFinding()],
		archiveCounts: {},
	});
	report.summary.finding_count = 0;
	return { report, exitCode: 0 };
}

function disabledFinding(): DocsFinding {
	return {
		rule_id: "docs.gate.disabled",
		category: "system",
		surface: "docsGatePolicy",
		rule_result: "not_applicable",
		result: "not_applicable",
		severity: "info",
		message: "docs-gate is disabled in contract policy",
	};
}

function evaluateDocsPolicy(
	context: RunContext,
	contract: HarnessContract,
	policy: DocsGatePolicy,
): EvaluationSummary {
	const classified = classifyChanges(context.changedFiles);
	const findings = [
		...resolutionFindings(context),
		...unknownFindings(classified.unknownFiles, context.mode),
	];
	const surfaceResult = collectSurfaceFindings(
		context,
		policy,
		classified.categories,
	);
	findings.push(...surfaceResult.findings);
	const metadata = metadataFindings(context);
	const contradictions = collectContradictionFindings(
		context.repoRoot,
		contract,
		context.mode,
	);
	const archive = collectArchiveCandidateDocsGateProjection(context.repoRoot);
	findings.push(...metadata.findings, ...contradictions, ...archive.findings);
	return {
		categories: classified.categories,
		requiredSurfaces: surfaceResult.requiredSurfaces,
		missing: surfaceResult.missing,
		unknownFiles: classified.unknownFiles,
		contradictionFindings: contradictions,
		outcome: resolveOutcome(context, {
			findings,
			contradictions,
			hasPolicyDrift:
				classified.unknownFiles.length > 0 ||
				surfaceResult.missing.length > 0 ||
				metadata.hasDrift,
			archiveHasError: archive.findings.some(
				(finding) => finding.severity === "error",
			),
		}),
		findings,
		archiveCounts: archive.counts,
	};
}

function collectSurfaceFindings(
	context: RunContext,
	policy: DocsGatePolicy,
	categories: DocsGateReport["categories"],
) {
	const { surfaces, ruleFindings } = resolveRequiredSurfaces(
		categories,
		policy,
	);
	const presence = checkSurfacePresence(
		surfaces,
		context.changedFiles,
		policy,
		context.deletedFiles,
	);
	const deepReadmes = collectDeepModuleReadmeFindings(
		context.repoRoot,
		context.changedFiles,
		context.deletedFiles,
		context.mode,
	);
	return {
		requiredSurfaces: surfaces,
		missing: [...presence.missing, ...deepReadmes.missing],
		findings: [...ruleFindings, ...presence.findings, ...deepReadmes.findings],
	};
}

function metadataFindings(context: RunContext): {
	findings: DocsFinding[];
	hasDrift: boolean;
} {
	const frontmatter = collectFrontmatterMetadataViolations(context).map(
		(violation) => frontmatterFinding(violation, context.mode),
	);
	const lifecycle = collectDocLifecycleViolations(context).map((violation) =>
		lifecycleFinding(violation, context.mode),
	);
	return {
		findings: [...frontmatter, ...lifecycle],
		hasDrift: frontmatter.length > 0 || lifecycle.length > 0,
	};
}

function frontmatterFinding(
	violation: ReturnType<typeof collectFrontmatterMetadataViolations>[number],
	mode: DocsGateMode,
): DocsFinding {
	return {
		rule_id: "docs.frontmatter.metadata_not_prose",
		category: "doc_only",
		surface: violation.path,
		rule_result: "fail",
		result: "fail",
		severity: mode === "required" ? "error" : "warning",
		message:
			"YAML frontmatter fields are machine-readable metadata and must not be represented as prose headings or Table of Contents entries.",
		path: violation.path,
		details: violation.fix,
		source_of_truth_ref: violation.sourceLearningId,
	};
}

function lifecycleFinding(
	violation: ReturnType<typeof collectDocLifecycleViolations>[number],
	mode: DocsGateMode,
): DocsFinding {
	return {
		rule_id: DOC_LIFECYCLE_RULE_ID,
		category: "doc_only",
		surface: violation.path,
		rule_result: "fail",
		result: "fail",
		severity: mode === "required" ? violation.severity : "warning",
		message: violation.message,
		path: violation.path,
		details: violation.fix,
		source_of_truth_ref: "docs/doc-lifecycle-manifest.json",
	};
}

function resolutionFindings(context: RunContext): DocsFinding[] {
	if (!context.resolution.error) return [];
	return [
		{
			rule_id: "docs.gate.changed_files_resolution_error",
			category: "system",
			surface: "changed_files",
			rule_result: context.mode === "required" ? "error" : "fail",
			result: context.mode === "required" ? "error" : "fail",
			severity: context.mode === "required" ? "error" : "warning",
			message: context.resolution.error,
			details:
				"Pass --files explicitly, or run docs-gate in a git worktree where changed files can be resolved.",
		},
	];
}

function unknownFindings(
	files: readonly string[],
	mode: DocsGateMode,
): DocsFinding[] {
	if (files.length === 0) return [];
	return [
		{
			rule_id: "docs.gate.unknown_governance_change",
			category: "unknown_governance_change",
			surface: "unknown",
			rule_result: "fail",
			result: "fail",
			severity: mode === "required" ? "error" : "warning",
			message: `Files changed without clear governance category: ${files.join(", ")}`,
			details:
				"These files may require documentation updates but no rule covers them yet",
		},
	];
}

function resolveOutcome(
	context: RunContext,
	input: {
		findings: DocsFinding[];
		contradictions: ContradictionFinding[];
		hasPolicyDrift: boolean;
		archiveHasError: boolean;
	},
): DocsGateOutcome {
	if (context.resolution.error && context.mode === "required")
		return "policy_error";
	if (
		input.contradictions.some(
			(finding) => finding.category === "source_truth_missing",
		)
	) {
		return "policy_error";
	}
	if (
		input.contradictions.some(
			(finding) =>
				finding.category === "required_check_conflict" ||
				finding.category === "workflow_policy_conflict",
		)
	) {
		return "trust_mismatch";
	}
	if (input.archiveHasError) return "runtime_error";
	if (input.contradictions.length > 0 || input.hasPolicyDrift) {
		return "drift_detected";
	}
	return "ok";
}

/** CLI entry point for docs-gate. */
export function runDocsGateCLI(options: DocsGateOptions = {}): number {
	const result = runDocsGate(options);
	const gateResult = normaliseDocsGateResult(result);
	if (options.json) {
		process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
	} else {
		renderGateDecision(gateResult);
	}
	return result.exitCode;
}
