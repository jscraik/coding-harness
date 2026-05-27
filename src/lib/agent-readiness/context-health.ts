import {
	evidence,
	fileContainsAll,
	fileExists,
	readText,
} from "./repo-evidence.js";
import type {
	AgentReadinessContextHealth,
	AgentReadinessContextSurface,
	AgentReadinessContextSurfaceId,
	AgentReadinessFinding,
	AgentReadinessStatus,
} from "./types.js";
import { overallStatus } from "./status.js";

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

const ACTIVE_ARTIFACTS_PATH = ".harness/active-artifacts.md";
const PROJECT_BRAIN_MEMORY_PATH = ".harness/memory/LEARNINGS.md";
const PROJECT_BRAIN_KNOWLEDGE_PATH = ".harness/knowledge/INDEX.md";
const HARNESS_CONTRACT_PATH = "harness.contract.json";

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
	const activeRouteText = sectionText(
		activeArtifactsText,
		"Current Active Route",
	);
	const activeRouteRefs = extractRepoRelativeBacktickPaths(activeRouteText);
	const missingActiveRouteRefs = activeRouteRefs.filter(
		(path) => !fileExists(repoRoot, path),
	);
	const activeRouteStaleReasons = activeRouteSectionStaleReasons(
		activeRouteText,
		activeRouteRefs,
		missingActiveRouteRefs,
	);

	return [
		activeArtifactsSurface(repoRoot),
		activeRouteRefsSurface(repoRoot, activeRouteRefs, activeRouteStaleReasons),
		projectBrainMemorySurface(repoRoot),
		projectBrainKnowledgeSurface(repoRoot),
		runtimeCardSurface(repoRoot),
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
	activeRouteRefs: string[],
	staleReasons: string[],
): AgentReadinessContextSurface {
	return contextSurface({
		id: "active_route_refs",
		status:
			activeRouteRefs.length > 0 && staleReasons.length === 0 ? "pass" : "warn",
		evidence: evidence(repoRoot, [ACTIVE_ARTIFACTS_PATH, ...activeRouteRefs]),
		staleReasons,
		suggestedRefreshCommands: [ACTIVE_ARTIFACT_REFRESH_COMMAND],
	});
}

function activeRouteSectionStaleReasons(
	activeRouteText: string,
	activeRouteRefs: string[],
	missingActiveRouteRefs: string[],
): string[] {
	const staleReasons =
		activeRouteRefs.length === 0
			? ["Current Active Route does not contain repo-relative artifact refs."]
			: missingActiveRouteRefs.map((path) => `${path} is missing.`);
	if (
		activeRouteText.toLowerCase().includes("not the current execution route")
	) {
		staleReasons.push(
			"Current Active Route contains a row marked not the current execution route.",
		);
	}
	return staleReasons;
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

function sectionText(markdown: string, heading: string): string {
	const lines = markdown.split(/\r?\n/);
	const start = lines.findIndex(
		(line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`,
	);
	if (start === -1) return "";
	const nextHeading = lines.findIndex(
		(line, index) => index > start && /^##\s+/.test(line.trim()),
	);
	return lines
		.slice(start + 1, nextHeading === -1 ? undefined : nextHeading)
		.join("\n");
}

function extractRepoRelativeBacktickPaths(markdown: string): string[] {
	const paths: string[] = [];
	const pathPattern = /\x60([^\x60]+)\x60/g;
	let match = pathPattern.exec(markdown);
	while (match !== null) {
		const token = match[1]?.trim() ?? "";
		const repoPath = normalizeRepoRelativePathToken(token);
		if (repoPath !== undefined) {
			paths.push(repoPath);
		}
		match = pathPattern.exec(markdown);
	}
	return uniqueStrings(paths);
}

function normalizeRepoRelativePathToken(token: string): string | undefined {
	const value = token.trim();
	if (value.length === 0) return undefined;
	if (value.startsWith("/") || value.startsWith("~")) return undefined;
	if (value.includes("://") || value.includes("\\")) return undefined;
	if (/[;&|$<>]/.test(value)) return undefined;

	const normalized = value.startsWith("./") ? value.slice(2) : value;
	if (normalized.length === 0 || normalized === ".") return undefined;
	if (normalized.split("/").includes("..")) return undefined;
	return normalized;
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
