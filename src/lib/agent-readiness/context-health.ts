import {
	evidence,
	fileContainsAll,
	fileExists,
	readText,
} from "./repo-evidence.js";
import { assessActiveRouteRefs } from "./active-route-refs.js";
import type {
	AgentReadinessContextHealth,
	AgentReadinessMissingContextRef,
	AgentReadinessContextSurface,
	AgentReadinessContextSurfaceId,
	AgentReadinessFinding,
	AgentReadinessStatus,
} from "./types.js";
import { overallStatus } from "./status.js";
import { validatePromptContextDriftReport } from "../prompt-context-drift/index.js";

const DEEP_CONTEXT_HEALTH_COMMAND =
	"node --import tsx src/cli.ts context-health --json";
const CONTEXT_HEALTH_HELP_COMMAND =
	"node --import tsx src/cli.ts --help --all-commands";
const INIT_DRY_RUN_COMMAND =
	"node --import tsx src/cli.ts init --dry-run --json";
const ACTIVE_ARTIFACT_REFRESH_COMMAND =
	"node --import tsx src/cli.ts artifact-routine --active-index .harness/active-artifacts.md --json";
const BRAIN_STATUS_COMMAND = "node --import tsx src/cli.ts brain status --json";
const BRAIN_STALE_COMMAND = "node --import tsx src/cli.ts brain stale --json";
const RUNTIME_CARD_COMMAND =
	"node --import tsx src/cli.ts runtime-card --json --repo .";
const PROMPT_CONTEXT_DRIFT_WRITE_COMMAND =
	"node scripts/write-prompt-context-drift-report.cjs --repo-root .";
const PROMPT_CONTEXT_DRIFT_VALIDATE_COMMAND =
	"node scripts/validate-prompt-context-drift.cjs artifacts/context-integrity/prompt-context-drift-report.json --repo-root .";

const ACTIVE_ARTIFACTS_PATH = ".harness/active-artifacts.md";
const PROJECT_BRAIN_MEMORY_PATH = ".harness/memory/LEARNINGS.md";
const PROJECT_BRAIN_KNOWLEDGE_PATH = ".harness/knowledge/INDEX.md";
const HARNESS_CONTRACT_PATH = "harness.contract.json";
const PROMPT_CONTEXT_DRIFT_REPORT_PATHS = [
	"artifacts/context-integrity/prompt-context-drift-report.json",
	"artifacts/prompt-context-drift-report.json",
	".harness/runtime/prompt-context-drift-report.json",
] as const;
const PROMPT_CONTEXT_DRIFT_CANONICAL_REPORT =
	PROMPT_CONTEXT_DRIFT_REPORT_PATHS[0];

/** Build the advisory context-health projection for agent-readiness. */
export function buildContextHealthProjection(
	repoRoot: string,
): AgentReadinessContextHealth {
	const contextPolicyAvailable = hasContextIntegrityPolicy(repoRoot);
	const prerequisiteCommands = contextPolicyAvailable
		? [DEEP_CONTEXT_HEALTH_COMMAND]
		: [CONTEXT_HEALTH_HELP_COMMAND, INIT_DRY_RUN_COMMAND];
	const surfaces = buildContextSurfaces(repoRoot);

	return {
		schemaVersion: "agent-readiness-context-health/v1",
		status: overallStatus(summarizeSurfaces(surfaces)),
		evidenceUse: "orientation",
		canonicalReport: {
			schemaVersion: "context-health-report/v1",
			command: DEEP_CONTEXT_HEALTH_COMMAND,
			available: fileExists(repoRoot, "src/commands/context-health.ts"),
			prerequisiteStatus: contextPolicyAvailable ? "pass" : "warn",
			prerequisiteEvidence: evidence(repoRoot, [HARNESS_CONTRACT_PATH]),
		},
		surfaces,
		suggestedRefreshCommands: uniqueStrings([
			...prerequisiteCommands,
			...surfaces.flatMap((surface) => surface.suggestedRefreshCommands),
		]),
	};
}

/** Convert context surfaces into normal agent-readiness findings. */
export function contextHealthFindings(
	contextHealth: AgentReadinessContextHealth,
): AgentReadinessFinding[] {
	return contextHealth.surfaces.map((surface) => ({
		id: `context_health.${surface.id}`,
		category: "context_health",
		status: surface.status,
		message:
			surface.status === "pass"
				? `${surface.id} context is available for orientation.`
				: `${surface.id} context is missing, stale, or unobserved.`,
		evidence: surface.evidence,
		recommendation:
			surface.status === "pass"
				? undefined
				: commandOptionRecommendation(surface.suggestedRefreshCommands),
	}));
}

function buildContextSurfaces(
	repoRoot: string,
): AgentReadinessContextSurface[] {
	const activeArtifactsText = readText(repoRoot, ACTIVE_ARTIFACTS_PATH);
	const activeRouteRefs = assessActiveRouteRefs({
		repoRoot,
		activeArtifactsText,
		activeArtifactsPath: ACTIVE_ARTIFACTS_PATH,
	});

	return [
		activeArtifactsSurface(repoRoot),
		activeRouteRefsSurface(repoRoot, activeRouteRefs),
		projectBrainMemorySurface(repoRoot),
		projectBrainKnowledgeSurface(repoRoot),
		runtimeCardSurface(repoRoot),
		promptContextDriftSurface(repoRoot),
		externalHorizonSurface(repoRoot),
	];
}

function activeArtifactsSurface(
	repoRoot: string,
): AgentReadinessContextSurface {
	const staleReasons = activeArtifactsStaleReasons(repoRoot);

	return contextSurface({
		id: "active_artifacts",
		status: staleReasons.length === 0 ? "pass" : "warn",
		evidence: evidence(repoRoot, [ACTIVE_ARTIFACTS_PATH]),
		staleReasons,
		suggestedRefreshCommands: [ACTIVE_ARTIFACT_REFRESH_COMMAND],
	});
}

function activeArtifactsStaleReasons(repoRoot: string): string[] {
	if (!fileExists(repoRoot, ACTIVE_ARTIFACTS_PATH)) {
		return [`${ACTIVE_ARTIFACTS_PATH} is missing.`];
	}
	const requiredSections = ["Current Active Route", "Artifact Index"];
	return requiredSections
		.filter(
			(section) => !fileContainsAll(repoRoot, ACTIVE_ARTIFACTS_PATH, [section]),
		)
		.map(
			(section) =>
				`${ACTIVE_ARTIFACTS_PATH} is missing the ${section} section.`,
		);
}

function activeRouteRefsSurface(
	repoRoot: string,
	activeRouteState: {
		evidenceRefs: string[];
		staleReasons: string[];
		missingRefs: AgentReadinessMissingContextRef[];
	},
): AgentReadinessContextSurface {
	return contextSurface({
		id: "active_route_refs",
		status:
			activeRouteState.evidenceRefs.length > 0 &&
			activeRouteState.staleReasons.length === 0
				? "pass"
				: "warn",
		evidence: evidence(repoRoot, [
			ACTIVE_ARTIFACTS_PATH,
			...activeRouteState.evidenceRefs,
		]),
		staleReasons: activeRouteState.staleReasons,
		missingRefs: activeRouteState.missingRefs,
		suggestedRefreshCommands: [ACTIVE_ARTIFACT_REFRESH_COMMAND],
	});
}

function projectBrainMemorySurface(
	repoRoot: string,
): AgentReadinessContextSurface {
	return contextSurface({
		id: "project_brain_memory",
		status: fileExists(repoRoot, PROJECT_BRAIN_MEMORY_PATH) ? "pass" : "warn",
		evidence: evidence(repoRoot, [PROJECT_BRAIN_MEMORY_PATH]),
		staleReasons: fileExists(repoRoot, PROJECT_BRAIN_MEMORY_PATH)
			? []
			: [`${PROJECT_BRAIN_MEMORY_PATH} is missing.`],
		suggestedRefreshCommands: [BRAIN_STATUS_COMMAND],
	});
}

function projectBrainKnowledgeSurface(
	repoRoot: string,
): AgentReadinessContextSurface {
	return contextSurface({
		id: "project_brain_knowledge",
		status: fileExists(repoRoot, PROJECT_BRAIN_KNOWLEDGE_PATH)
			? "pass"
			: "warn",
		evidence: evidence(repoRoot, [PROJECT_BRAIN_KNOWLEDGE_PATH]),
		staleReasons: fileExists(repoRoot, PROJECT_BRAIN_KNOWLEDGE_PATH)
			? []
			: [`${PROJECT_BRAIN_KNOWLEDGE_PATH} is missing.`],
		suggestedRefreshCommands: [BRAIN_STATUS_COMMAND, BRAIN_STALE_COMMAND],
	});
}

function runtimeCardSurface(repoRoot: string): AgentReadinessContextSurface {
	const runtimeCardEvidence = evidence(repoRoot, [
		".harness/runtime/runtime-card.json",
		".harness/runtime-card.json",
		"artifacts/runtime-card.json",
		"artifacts/runtime/runtime-card.json",
		"artifacts/runtime-cards/runtime-card.json",
	]);

	return contextSurface({
		id: "runtime_card",
		status: runtimeCardEvidence.length > 0 ? "pass" : "warn",
		evidence: runtimeCardEvidence,
		staleReasons:
			runtimeCardEvidence.length > 0
				? []
				: ["No local runtime-card artifact was discovered."],
		suggestedRefreshCommands: [RUNTIME_CARD_COMMAND],
	});
}

function promptContextDriftSurface(
	repoRoot: string,
): AgentReadinessContextSurface {
	const promptContextDriftEvidence = evidence(repoRoot, [
		...PROMPT_CONTEXT_DRIFT_REPORT_PATHS,
	]);
	if (promptContextDriftEvidence.length === 0) {
		return contextSurface({
			id: "prompt_context_drift",
			status: "warn",
			evidence: [`missing:${PROMPT_CONTEXT_DRIFT_CANONICAL_REPORT}`],
			staleReasons: [
				"No prompt-context-drift report was provided for agent-readable orientation.",
			],
			suggestedRefreshCommands: [
				PROMPT_CONTEXT_DRIFT_WRITE_COMMAND,
				PROMPT_CONTEXT_DRIFT_VALIDATE_COMMAND,
			],
		});
	}
	if (promptContextDriftEvidence.length > 1) {
		return contextSurface({
			id: "prompt_context_drift",
			status: "warn",
			evidence: promptContextDriftEvidence,
			staleReasons: [
				"Multiple prompt-context-drift reports were discovered; keep a single canonical artifacts/context-integrity/prompt-context-drift-report.json report before using this surface.",
			],
			suggestedRefreshCommands: [
				PROMPT_CONTEXT_DRIFT_WRITE_COMMAND,
				PROMPT_CONTEXT_DRIFT_VALIDATE_COMMAND,
			],
		});
	}
	const reportText = readText(repoRoot, promptContextDriftEvidence[0] ?? "");
	const reportStatus = promptContextDriftReportStatus(reportText, repoRoot);
	return contextSurface({
		id: "prompt_context_drift",
		status: reportStatus.status,
		evidence: promptContextDriftEvidence,
		staleReasons: reportStatus.staleReasons,
		suggestedRefreshCommands: [
			PROMPT_CONTEXT_DRIFT_WRITE_COMMAND,
			PROMPT_CONTEXT_DRIFT_VALIDATE_COMMAND,
		],
	});
}

function promptContextDriftReportStatus(
	text: string,
	repoRoot: string,
): { status: AgentReadinessStatus; staleReasons: string[] } {
	if (text.length === 0) {
		return {
			status: "warn",
			staleReasons: ["Prompt-context-drift report is empty."],
		};
	}
	try {
		const parsed = JSON.parse(text) as { overallStatus?: unknown };
		const validation = validatePromptContextDriftReport(parsed, { repoRoot });
		if (validation.status !== "pass") {
			return {
				status: "warn",
				staleReasons: [
					`Prompt-context-drift report failed validation: ${validation.errors[0] ?? "unknown validation error"}.`,
				],
			};
		}
		return parsed.overallStatus === "pass"
			? { status: "pass", staleReasons: [] }
			: {
					status: "warn",
					staleReasons: [
						"Prompt-context-drift report is not pass for orientation.",
					],
				};
	} catch (error) {
		return {
			status: "warn",
			staleReasons: [
				`Prompt-context-drift report is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
			],
		};
	}
}

function externalHorizonSurface(
	repoRoot: string,
): AgentReadinessContextSurface {
	const externalHorizonEvidence = evidence(repoRoot, [
		".harness/external-state-snapshot.json",
		"artifacts/external-state-snapshot.json",
		"artifacts/external-state/external-state-snapshot.json",
	]);

	return contextSurface({
		id: "external_horizon",
		status: externalHorizonEvidence.length > 0 ? "pass" : "warn",
		evidence: externalHorizonEvidence,
		staleReasons:
			externalHorizonEvidence.length > 0
				? []
				: [
						"No local PR, CI, Linear, or review-state snapshot was provided to agent-readiness.",
					],
		suggestedRefreshCommands: [],
	});
}

function contextSurface(input: {
	id: AgentReadinessContextSurfaceId;
	status: AgentReadinessStatus;
	evidence: string[];
	staleReasons: string[];
	missingRefs?: AgentReadinessMissingContextRef[] | undefined;
	suggestedRefreshCommands: string[];
}): AgentReadinessContextSurface {
	return {
		...input,
		evidenceUse: "orientation",
	};
}

function hasContextIntegrityPolicy(repoRoot: string): boolean {
	const contractText = readText(repoRoot, HARNESS_CONTRACT_PATH);
	if (contractText.length === 0) return false;
	try {
		const parsed = JSON.parse(contractText) as {
			contextIntegrityPolicy?: unknown;
		};
		return parsed.contextIntegrityPolicy !== undefined;
	} catch {
		return false;
	}
}

function summarizeSurfaces(surfaces: AgentReadinessContextSurface[]) {
	return surfaces.reduce(
		(summary, surface) => {
			summary[surface.status] += 1;
			return summary;
		},
		{ pass: 0, warn: 0, fail: 0 },
	);
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values)];
}

function commandOptionRecommendation(commands: string[]): string | undefined {
	const uniqueCommands = uniqueStrings(commands);
	if (uniqueCommands.length === 0) return undefined;
	if (uniqueCommands.length === 1) return uniqueCommands[0];
	return `Try one of these refresh commands: ${uniqueCommands.join(", ")}`;
}
