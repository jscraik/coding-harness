import { resolve } from "node:path";

import type {
	AgentReadinessFinding,
	AgentReadinessOptions,
	AgentReadinessReport,
} from "./types.js";
import {
	directoryExists,
	evidence,
	fileContainsAll,
	fileContainsAny,
	fileExists,
	findScopedInstructionFiles,
	readText,
} from "./repo-evidence.js";
import { hasRunnableTestScripts } from "./package-scripts.js";
import {
	buildContextHealthProjection,
	contextHealthFindings,
} from "./context-health.js";
import { readSharedStateActionPolicy } from "./shared-state-policy.js";
import { overallStatus, summarize } from "./status.js";

const MISSING_SURFACE_RECOMMENDATION =
	"Add the missing surface or document why this repository intentionally uses a different agent-ready contract.";

/**
 * Inspect a repository for the core agent-readiness surfaces used by Coding Harness.
 *
 * The check is intentionally read-only. It validates that agents can discover instructions,
 * execution artifacts, capability proof, approval boundaries, and traceability surfaces without
 * relying on chat-only context.
 *
 * @param options - Optional target repository root and deterministic clock for tests.
 * @returns A versioned readiness report with severity-ranked findings.
 */
export function assessAgentReadiness(
	options: AgentReadinessOptions = {},
): AgentReadinessReport {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const contextHealth = buildContextHealthProjection(repoRoot);
	const findings = [
		...checkInstructionSurfaces(repoRoot),
		...checkArtifactSurfaces(repoRoot),
		...checkCapabilitySurfaces(repoRoot),
		...checkApprovalGateSurfaces(repoRoot),
		...checkTraceabilitySurfaces(repoRoot),
		...contextHealthFindings(contextHealth),
	];
	const summary = summarize(findings);

	return {
		schemaVersion: "agent-readiness/v1",
		status: overallStatus(summary),
		repoRoot,
		generatedAt: (options.now ?? new Date()).toISOString(),
		summary,
		contextHealth,
		findings,
	};
}

function checkInstructionSurfaces(repoRoot: string): AgentReadinessFinding[] {
	const rootAgents = "AGENTS.md";
	const instructionMap = "docs/agents/01-instruction-map.md";
	const rootCodestyle = "CODESTYLE.md";
	const codestyleMap = "codestyle/README.md";
	const scopedInstructions = findScopedInstructionFiles(repoRoot);
	const hasProgressiveRouting =
		fileExists(repoRoot, instructionMap) &&
		fileContainsAll(repoRoot, instructionMap, [
			"AGENTS.md",
			"task-specific",
			"docs/agents",
		]);

	return [
		finding({
			id: "instructions.root_agents",
			category: "instructions",
			status: fileExists(repoRoot, rootAgents) ? "pass" : "fail",
			message: fileExists(repoRoot, rootAgents)
				? "Root AGENTS.md is present for baseline agent instructions."
				: "Root AGENTS.md is missing.",
			evidence: evidence(repoRoot, [rootAgents]),
			recommendation: fileExists(repoRoot, rootAgents)
				? undefined
				: "Add a root AGENTS.md with the stable repository operating contract.",
		}),
		finding({
			id: "instructions.scoped_rules",
			category: "instructions",
			status:
				scopedInstructions.length > 0 || hasProgressiveRouting
					? "pass"
					: "warn",
			message:
				scopedInstructions.length > 0 || hasProgressiveRouting
					? "Scoped instruction routing is discoverable."
					: "No path-scoped instruction routing was found.",
			evidence:
				scopedInstructions.length > 0
					? scopedInstructions
					: evidence(repoRoot, [instructionMap]),
			recommendation:
				scopedInstructions.length > 0 || hasProgressiveRouting
					? undefined
					: "Add scoped AGENTS.md files or a tracked instruction map that routes agents to path-specific rules.",
		}),
		finding({
			id: "instructions.codestyle_front_door",
			category: "instructions",
			status:
				fileExists(repoRoot, rootCodestyle) &&
				fileExists(repoRoot, codestyleMap)
					? "pass"
					: "warn",
			message:
				fileExists(repoRoot, rootCodestyle) &&
				fileExists(repoRoot, codestyleMap)
					? "Codestyle front door and module map are present."
					: "Codestyle front door or module map is missing.",
			evidence: evidence(repoRoot, [rootCodestyle, codestyleMap]),
			recommendation:
				fileExists(repoRoot, rootCodestyle) &&
				fileExists(repoRoot, codestyleMap)
					? undefined
					: "Keep CODESTYLE.md and codestyle/README.md synchronized as the coding-rule entrypoint.",
		}),
	];
}

function checkArtifactSurfaces(repoRoot: string): AgentReadinessFinding[] {
	const harnessMap = ".harness/README.md";
	const activeArtifacts = ".harness/active-artifacts.md";
	const specDirs = [".harness/specs", ".harness/plan", "docs/specs"];
	const hasSpecOrPlanDir = specDirs.some((path) =>
		directoryExists(repoRoot, path),
	);

	return [
		finding({
			id: "artifacts.harness_map",
			category: "artifacts",
			status:
				fileExists(repoRoot, harnessMap) &&
				fileContainsAll(repoRoot, harnessMap, [
					"execution-input",
					"durable",
					"authority",
				])
					? "pass"
					: "fail",
			message: fileExists(repoRoot, harnessMap)
				? "Harness artifact authority is documented in a tracked file."
				: "Harness artifact authority is not documented in a tracked file.",
			evidence: evidence(repoRoot, [harnessMap]),
			recommendation: fileExists(repoRoot, harnessMap)
				? undefined
				: MISSING_SURFACE_RECOMMENDATION,
		}),
		finding({
			id: "artifacts.active_index",
			category: "artifacts",
			status:
				fileExists(repoRoot, activeArtifacts) &&
				fileContainsAll(repoRoot, activeArtifacts, [
					"Current Active Route",
					"Artifact Index",
				])
					? "pass"
					: "warn",
			message: fileExists(repoRoot, activeArtifacts)
				? "Active specs and plans have a route-driving index."
				: "No active artifact index was found.",
			evidence: evidence(repoRoot, [activeArtifacts]),
			recommendation: fileExists(repoRoot, activeArtifacts)
				? undefined
				: "Add .harness/active-artifacts.md so future runs can find current specs and plans.",
		}),
		finding({
			id: "artifacts.spec_plan_dirs",
			category: "artifacts",
			status: hasSpecOrPlanDir ? "pass" : "warn",
			message: hasSpecOrPlanDir
				? "Spec or plan directories are present."
				: "No tracked spec or plan directory was found.",
			evidence: specDirs.filter((path) => directoryExists(repoRoot, path)),
			recommendation: hasSpecOrPlanDir
				? undefined
				: "Create a small tracked specs/plans surface and route it through the active artifact index.",
		}),
	];
}

function checkCapabilitySurfaces(repoRoot: string): AgentReadinessFinding[] {
	const packageJson = "package.json";
	const toolingPolicy = "docs/agents/02-tooling-policy.md";
	const auditTrailPolicy = "docs/agents/09-audit-trail-policy.md";
	const runRecords = "docs/architecture/agent-run-records.md";
	const packageText = readText(repoRoot, packageJson);
	const hasTestScripts = hasRunnableTestScripts(packageText);
	const hasBrowserOrScreenshot = fileContainsAny(repoRoot, toolingPolicy, [
		"agent-browser",
		"Argos",
		"screenshot",
		"browser",
	]);
	const hasLogEvidence =
		fileExists(repoRoot, auditTrailPolicy) && fileExists(repoRoot, runRecords);

	return [
		finding({
			id: "capabilities.tests",
			category: "capabilities",
			status: hasTestScripts ? "pass" : "fail",
			message: hasTestScripts
				? "Package scripts expose local test capability."
				: "Package scripts do not expose the required test capability.",
			evidence: evidence(repoRoot, [packageJson]),
			recommendation: hasTestScripts
				? undefined
				: "Add canonical test scripts so agents can prove behavior with repository-native commands.",
		}),
		finding({
			id: "capabilities.browser_or_screenshot",
			category: "capabilities",
			status: hasBrowserOrScreenshot ? "pass" : "warn",
			message: hasBrowserOrScreenshot
				? "Browser or screenshot capability is documented for agent validation."
				: "Browser or screenshot capability is not documented.",
			evidence: evidence(repoRoot, [toolingPolicy]),
			recommendation: hasBrowserOrScreenshot
				? undefined
				: "Document a browser, screenshot, or visual-regression tool so UI work has observable proof.",
		}),
		finding({
			id: "capabilities.logs",
			category: "capabilities",
			status: hasLogEvidence ? "pass" : "warn",
			message: hasLogEvidence
				? "Run logs and audit-trail evidence surfaces are documented."
				: "Run logs or audit-trail evidence surfaces are missing.",
			evidence: evidence(repoRoot, [auditTrailPolicy, runRecords]),
			recommendation: hasLogEvidence
				? undefined
				: "Add a tracked audit-trail or run-record contract so agents can cite prior execution evidence.",
		}),
	];
}

function checkApprovalGateSurfaces(repoRoot: string): AgentReadinessFinding[] {
	const securityPolicy = "docs/agents/06-security-and-governance.md";
	const contractPolicy = "harness.contract.json";
	const skillPolicy = ".agents/skills/coding-harness/SKILL.md";
	const hasDestructiveBoundary = fileContainsAll(repoRoot, securityPolicy, [
		"destructive",
		"global",
		"unsafe side effects",
	]);
	const sharedStatePolicy = readSharedStateActionPolicy(repoRoot);
	const hasDryRunOrApprovalRouting = fileContainsAny(repoRoot, skillPolicy, [
		"dry-run",
		"approval",
		"destructive",
	]);

	return [
		finding({
			id: "approval_gates.destructive_actions",
			category: "approval_gates",
			status: hasDestructiveBoundary ? "pass" : "fail",
			message: hasDestructiveBoundary
				? "Destructive, global, and unsafe actions have a documented boundary."
				: "Destructive action boundaries are not explicit enough.",
			evidence: evidence(repoRoot, [securityPolicy]),
			recommendation: hasDestructiveBoundary
				? undefined
				: "State which destructive, expensive, credentialed, or unsafe operations require approval.",
		}),
		finding({
			id: "approval_gates.shared_state",
			category: "approval_gates",
			status: sharedStatePolicy.complete ? "pass" : "warn",
			message: sharedStatePolicy.complete
				? "Shared-state action authority is machine-readable in the harness contract."
				: "Shared-state action authority is incomplete in the harness contract.",
			evidence: evidence(repoRoot, [contractPolicy]),
			recommendation: sharedStatePolicy.complete
				? undefined
				: `Add shared-state authority entries for: ${sharedStatePolicy.missing.join(", ")}.`,
		}),
		finding({
			id: "approval_gates.skill_boundary",
			category: "approval_gates",
			status: hasDryRunOrApprovalRouting ? "pass" : "warn",
			message: hasDryRunOrApprovalRouting
				? "The distributed harness skill documents restrained operation."
				: "The distributed harness skill does not expose approval or dry-run language.",
			evidence: evidence(repoRoot, [skillPolicy]),
			recommendation: hasDryRunOrApprovalRouting
				? undefined
				: "Document approval or dry-run expectations in the exported harness skill.",
		}),
	];
}

function checkTraceabilitySurfaces(repoRoot: string): AgentReadinessFinding[] {
	const linearWorkflow = "docs/agents/13-linear-production-workflow.md";
	const runRecords = "docs/architecture/agent-run-records.md";
	const rootAgents = "AGENTS.md";
	const hasTicketDocsCommitFlow = fileContainsAll(repoRoot, linearWorkflow, [
		"Linear",
		"GitHub",
		"branch",
		"commit",
		"validation evidence",
	]);
	const hasSessionEvidence = fileContainsAll(repoRoot, runRecords, [
		"session",
		"trace",
		"headSha",
		"artifact",
	]);
	const hasPrTraceability = fileContainsAll(repoRoot, rootAgents, [
		"PR bodies",
		"session",
		"traceability",
	]);

	return [
		finding({
			id: "traceability.ticket_doc_commit_links",
			category: "traceability",
			status: hasTicketDocsCommitFlow ? "pass" : "warn",
			message: hasTicketDocsCommitFlow
				? "Ticket, docs, branch, commit, and validation linking is documented."
				: "Ticket-to-doc-to-commit linking is incomplete.",
			evidence: evidence(repoRoot, [linearWorkflow]),
			recommendation: hasTicketDocsCommitFlow
				? undefined
				: "Document how issues, branches, PRs, commits, and validation evidence are linked.",
		}),
		finding({
			id: "traceability.session_records",
			category: "traceability",
			status: hasSessionEvidence ? "pass" : "warn",
			message: hasSessionEvidence
				? "Session and run-record traceability is documented."
				: "Session and run-record traceability is missing.",
			evidence: evidence(repoRoot, [runRecords]),
			recommendation: hasSessionEvidence
				? undefined
				: "Add a run-record contract with session IDs, trace IDs, head SHA, and artifact references.",
		}),
		finding({
			id: "traceability.pr_closeout_reference",
			category: "traceability",
			status: hasPrTraceability ? "pass" : "warn",
			message: hasPrTraceability
				? "PR closeout requires a concrete session or traceability reference."
				: "PR closeout does not require a session or traceability reference.",
			evidence: evidence(repoRoot, [rootAgents]),
			recommendation: hasPrTraceability
				? undefined
				: "Require PR bodies to cite a concrete session, trace, run, or explicit n.a. reason.",
		}),
	];
}

function finding(
	input: Omit<AgentReadinessFinding, "evidence"> & {
		evidence?: string[];
	},
): AgentReadinessFinding {
	return {
		...input,
		evidence: input.evidence ?? [],
	};
}
