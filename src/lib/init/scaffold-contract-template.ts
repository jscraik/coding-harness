/**
 * Contract scaffold renderer for `harness init`.
 *
 * This module owns the generated `harness.contract.json` policy object so the
 * scaffold registry does not need to understand every nested governance knob.
 *
 * @module lib/init/scaffold-contract-template
 */

import {
	DEFAULT_CI_PROVIDER_POLICY,
	DEFAULT_CONTRACT,
	type HarnessContract,
	NORTH_STAR_DECISION_QUESTION_SPECS,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
} from "../contract/types.js";
import { CURRENT_SCHEMA_VERSION, type TemplateRenderContext } from "./types.js";

/**
 * Inputs required to render a scaffolded `harness.contract.json`.
 */
export interface ScaffoldContractTemplateOptions {
	agentBranchPrefix: string;
	context: TemplateRenderContext;
	packageManager: string;
	requiredChecks: readonly string[];
}

function renderScriptCommand(packageManager: string, script: string): string {
	if (packageManager === "npm") {
		return `npm run ${script}`;
	}
	return `${packageManager} ${script}`;
}

function renderScaffoldNorthStar(
	context: TemplateRenderContext,
): NonNullable<HarnessContract["northStar"]> {
	const projectName = context.projectName?.trim() || "This repository";
	return {
		mission: `${projectName} uses Coding Harness to reduce PR lead time while preserving safe, evidence-backed human oversight.`,
		primaryMetric: NORTH_STAR_PRIMARY_METRIC,
		primaryBottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
		autonomyBoundary:
			"Low and medium-risk changes may be automated when evidence is deterministic and rollback remains explicit; high-risk changes remain human-mediated.",
		safetyFloor: [
			"deterministic evidence over intuition",
			"strict current-head SHA discipline",
			"bounded auto-remediation instead of open-ended write access",
			"explicit rollback paths for higher-risk automation",
			"independent review surfaces that do not collapse back into self-approval",
		],
		nonGoals: [
			"governance surface area as a proxy for progress",
			"feature count without measurable throughput or reliability benefit",
			"manual coordination steps that recur every run or every PR",
			"broad autonomy expansion without evidence that the review or rework loop got cheaper",
		],
		decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map((question) => ({
			id: question.id,
			prompt: question.prompt,
		})),
	};
}

function renderScaffoldProductSurface(): NonNullable<
	HarnessContract["productSurface"]
> {
	return {
		surfaces: [
			{
				surfaceId: "automation-control-plane",
				surfaceType: "policy",
				class: "core",
				owner: "maintainers",
				northStarContribution:
					"Keeps delivery automation aligned to PR lead-time outcomes.",
				manualGlueReductionClaim:
					"Converts recurring reviewer reminders into explicit policy checks.",
				reliabilityContribution:
					"Centralizes automation guardrails in one deterministic contract surface.",
				evidenceReference: "harness.contract.json",
				ownedPaths: ["harness.contract.json"],
				lastReviewedAt: "2026-04-22",
			},
		],
	};
}

function renderScaffoldOverrideReviewerRegistry(
	context: TemplateRenderContext,
): NonNullable<HarnessContract["overrideReviewerRegistry"]> {
	const projectName = context.projectName?.trim() || "Project";
	return {
		trustedReviewers: [
			{
				reviewerId: "project-maintainers",
				reviewerType: "team",
				signatureRef: "refs/reviewers/project-maintainers",
				displayName: `${projectName} Maintainers`,
				status: "active",
			},
		],
	};
}

function renderIssueTrackingPolicy(
	context: TemplateRenderContext,
	agentBranchPrefix: string,
): HarnessContract["issueTrackingPolicy"] {
	if (context.issueTracker === "github" || context.issueTracker === "none") {
		return undefined;
	}
	return {
		provider: "linear",
		...(context.issueTrackingUrl
			? { projectUrl: context.issueTrackingUrl }
			: {}),
		requirePackageBugsUrl: true,
		disableGitHubIssues: true,
		requireBranchIssueKey: true,
		requirePrIssueKey: true,
		prReferenceMode: "either",
		branchPrefix: agentBranchPrefix,
	};
}

function renderScaffoldContract(
	options: ScaffoldContractTemplateOptions,
): HarnessContract {
	const { agentBranchPrefix, context, packageManager, requiredChecks } =
		options;
	const issueTrackingPolicy = renderIssueTrackingPolicy(
		context,
		agentBranchPrefix,
	);
	return {
		version: CURRENT_SCHEMA_VERSION,
		riskTierRules: {
			"src/auth/**": "high",
			"src/api/**": "high",
			"src/lib/**": "medium",
			"**/*.test.ts": "low",
		},
		mergePolicy: {
			high: ["review-gate", "evidence-verify"],
			medium: ["review-gate"],
			low: [],
		},
		docsDriftRules: {},
		branchProtection: {
			...(DEFAULT_CONTRACT.branchProtection ?? {}),
			requiredChecks: [...requiredChecks],
			requiredApprovingReviewCount: 1,
		},
		toolingPolicy: DEFAULT_CONTRACT.toolingPolicy,
		...(issueTrackingPolicy ? { issueTrackingPolicy } : {}),
		evidencePolicy: DEFAULT_CONTRACT.evidencePolicy,
		northStar: renderScaffoldNorthStar(context),
		productSurface: renderScaffoldProductSurface(),
		overrideReviewerRegistry: renderScaffoldOverrideReviewerRegistry(context),
		diffBudget: {
			maxFiles: 10,
			maxNetLOC: 400,
			overrideLabel: "diff-budget-override",
		},
		uiLoopPolicy: {
			fastCommand: renderScriptCommand(packageManager, "ui:fast"),
			verifyCommand: renderScriptCommand(packageManager, "ui:verify"),
			exploreCommand: renderScriptCommand(packageManager, "ui:explore"),
			sloTargets: {
				fastLoopSeconds: 30,
				verifyLoopSeconds: 120,
			},
		},
		runtimePolicy: {
			nodeVersion: "26.3.0",
			createIssueOnAgentFindings: true,
		},
		memoryPolicy: {
			enabled: true,
			provider: "local",
			sessionIdTemplate: "repo:<name>:task:<id>",
			domain: "default",
			requiredTags: ["repo", "area", "type"],
			maxObservationsPerStep: 3,
			allowedLevels: ["observation", "learning", "pattern"],
			requireStartRead: true,
			requireCloseoutSummary: true,
			forbiddenContentPatterns: [
				"token",
				"api[_-]?key",
				"secret",
				"password",
				"credential",
			],
		},
		memoryMaintenancePolicy: {
			validateSchedule: "weekly",
			reflectSchedule: "weekly",
			questionSlaDays: 7,
			duplicateThreshold: 0.8,
		},
		memoryEvalPolicy: {
			trialsPerTask: 3,
			requiredMetrics: ["pass^k", "tool_errors", "duplicate_rate"],
			passPowKThreshold: 0.8,
		},
		observabilityPolicy: {
			provider: "logs",
			collectorEndpoint: "http://localhost:4318",
		},
		packageManagerPolicy: {
			allowedManagers: ["pnpm", "npm", "yarn"],
			requiredManager: null,
		},
		remediationPolicy: {
			providerDefaults: {
				codex: {
					autoApplyMaxTier: "medium",
					dryRunOnlyByDefault: false,
				},
			},
			marker: "[auto-remediate]",
			timeoutMinutes: 10,
			retryLimit: 3,
			requireEvidence: true,
		},
		loopStageContracts: DEFAULT_CONTRACT.loopStageContracts,
		docsGatePolicy: DEFAULT_CONTRACT.docsGatePolicy,
		pilotGapCasePolicy: DEFAULT_CONTRACT.pilotGapCasePolicy,
		pilotRollbackPolicy: DEFAULT_CONTRACT.pilotRollbackPolicy,
		pilotAuthzPolicy: DEFAULT_CONTRACT.pilotAuthzPolicy,
		controlPlanePolicy: DEFAULT_CONTRACT.controlPlanePolicy,
		ciProviderPolicy: {
			...DEFAULT_CI_PROVIDER_POLICY,
			activeProvider:
				context.ciProvider ?? DEFAULT_CI_PROVIDER_POLICY.activeProvider,
		},
		contextIntegrityPolicy: DEFAULT_CONTRACT.contextIntegrityPolicy,
		...(context.projectType !== undefined
			? { projectType: context.projectType }
			: {}),
	};
}

/**
 * Render the generated `harness.contract.json` contents for a scaffolded repo.
 *
 * @param options - Contract policy inputs discovered by the scaffold registry.
 * @returns Pretty-printed JSON for the scaffolded contract file.
 */
export function renderHarnessContractTemplate(
	options: ScaffoldContractTemplateOptions,
): string {
	return `${JSON.stringify(renderScaffoldContract(options), null, 2)}\n`;
}
