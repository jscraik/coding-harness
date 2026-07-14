import { readFileSync } from "node:fs";
import type { FitnessFinding, FitnessLane } from "./types.js";
import {
	isArtifactRecord,
	malformedArtifactFinding,
} from "./artifact-evidence.js";
import { gateArtifactFindings } from "./gate-artifact-findings.js";
import { FITNESS_COMMANDS } from "./commands.js";

export const AGENT_ROUTING_LANE_ID = "agent-routing";
export const DOCUMENTATION_LIFECYCLE_LANE_ID = "documentation-lifecycle";
export const TEST_CONFIDENCE_LANE_ID = "test-confidence";
export const PROGRAM_DESIGN_LANE_ID = "program-design";

/** Conventional artifact paths for optional SynAIpse capability lanes. */
export interface OptionalFitnessArtifactPaths {
	agentRoutingPath?: string;
	documentationLifecyclePath?: string;
	testConfidencePath?: string;
	programDesignPath?: string;
}

/** Normalize an optional gate artifact whose findings are object records. */
function optionalDeterministicFindings(args: {
	path: string;
	lane: string;
	command: string;
	principle: FitnessFinding["principle"];
	enforcement: FitnessFinding["enforcement"];
	idPrefix: string;
	title: string;
	risk: string;
	claimBoundary: string;
	detailsField?: string;
}): FitnessFinding[] {
	return gateArtifactFindings({
		path: args.path,
		detailsField: args.detailsField ?? "violations",
		lane: args.lane,
		command: args.command,
		principle: args.principle,
		enforcement: args.enforcement,
		idPrefix: args.idPrefix,
		title: args.title,
		severity: "error",
		risk: args.risk,
		claimBoundary: args.claimBoundary,
		messageFields: ["message", "description", "reason", "name"],
		fileFields: ["path", "file"],
		lineFields: ["line"],
	});
}

/** Normalize coding-policy route or validation output into routing findings. */
function agentRoutingFindings(path: string): FitnessFinding[] {
	const parsed = readRoutingArtifact(path);
	if (parsed.error) {
		return [
			malformedArtifactFinding({
				path,
				lane: AGENT_ROUTING_LANE_ID,
				command: FITNESS_COMMANDS.AGENT_ROUTING,
				principle: "preserve_static_contracts",
				enforcement: "static_analysis",
				message: `Failed to read or parse routing artifact: ${parsed.error}`,
			}),
		];
	}
	if (!isArtifactRecord(parsed.report)) {
		return [
			agentRoutingMalformed(
				path,
				"Expected routing artifact JSON to be an object.",
			),
		];
	}
	if (isValidRoutingArtifact(parsed.report)) {
		return [];
	}
	const validationFindings = routingValidationFindings(parsed.report, path);
	if (validationFindings) return validationFindings;
	return [
		agentRoutingMalformed(
			path,
			"Expected coding-policy route or validation artifact schema.",
		),
	];
}

/** Read a coding-policy artifact while preserving parse failures as evidence. */
function readRoutingArtifact(path: string): {
	report?: unknown;
	error?: string;
} {
	try {
		return { report: JSON.parse(readFileSync(path, "utf8")) };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}

/** Return true when a coding-policy route has the required route collections. */
function isValidRoutingArtifact(report: Record<string, unknown>): boolean {
	return (
		report.schemaVersion === "coding-policy-route/v1" &&
		Array.isArray(report.policyModules) &&
		Array.isArray(report.requiredGates)
	);
}

/** Convert coding-policy validation errors into deterministic routing findings. */
function routingValidationFindings(
	report: Record<string, unknown>,
	path: string,
): FitnessFinding[] | undefined {
	if (report.schemaVersion !== "coding-policy-validation/v1") return undefined;
	if (report.status === "pass") return [];
	if (report.status !== "fail" || !Array.isArray(report.errors))
		return undefined;
	return report.errors.map((error, index) =>
		agentRoutingFailure(
			path,
			typeof error === "string" ? error : `Routing validation error ${index}.`,
			index,
		),
	);
}

/** Build a stable malformed routing-artifact finding. */
function agentRoutingMalformed(path: string, message: string): FitnessFinding {
	return malformedArtifactFinding({
		path,
		lane: AGENT_ROUTING_LANE_ID,
		command: FITNESS_COMMANDS.AGENT_ROUTING,
		principle: "preserve_static_contracts",
		enforcement: "static_analysis",
		message,
	});
}

/** Build one deterministic routing-policy failure finding. */
function agentRoutingFailure(
	path: string,
	message: string,
	index: number,
): FitnessFinding {
	return {
		id: `agent-routing:${index}`,
		title: "Agent routing policy finding",
		severity: "error",
		lane: AGENT_ROUTING_LANE_ID,
		principle: "preserve_static_contracts",
		enforcement: "static_analysis",
		evidence: { file: path, message },
		risk: "Routing drift can send Codex to the wrong skill, command, or authority boundary.",
		recommendedCommand: FITNESS_COMMANDS.AGENT_ROUTING,
		claimBoundary:
			"Agent-routing evidence only; this does not prove hosted CI, review, tracker, branch, or merge state.",
	};
}

/** Normalize documentation lifecycle violations into local findings. */
function documentationLifecycleFindings(path: string): FitnessFinding[] {
	return optionalDeterministicFindings({
		path,
		lane: DOCUMENTATION_LIFECYCLE_LANE_ID,
		command: FITNESS_COMMANDS.DOCUMENTATION_LIFECYCLE,
		principle: "reduce_cognitive_load",
		enforcement: "quality_structure",
		idPrefix: "documentation-lifecycle",
		title: "Documentation lifecycle finding",
		risk: "Stale or malformed governed documentation weakens the context route that agents use to act safely.",
		claimBoundary:
			"Documentation-lifecycle evidence only; this does not prove GitBook publication, hosted CI, review, tracker, or merge state.",
	});
}

/** Normalize self-affirming-test findings into a hard local lane. */
function testConfidenceFindings(path: string): FitnessFinding[] {
	return gateArtifactFindings({
		path,
		detailsField: "findings",
		lane: TEST_CONFIDENCE_LANE_ID,
		command: FITNESS_COMMANDS.TEST_CONFIDENCE,
		principle: "prove_behavior_outcomes",
		enforcement: "hard_blocker",
		idPrefix: "test-confidence",
		title: "Test-confidence finding",
		severity: "error",
		risk: "Self-affirming tests can make a green suite look stronger than the behavior it actually proves.",
		claimBoundary:
			"Test-confidence evidence only; this does not prove product behavior, hosted CI, review, tracker, or merge state.",
		messageFields: ["message", "reason"],
		fileFields: ["path", "file"],
		lineFields: ["line"],
	});
}

/** Normalize quality-debt new findings into the program-design lane. */
function programDesignFindings(path: string): FitnessFinding[] {
	const findings = optionalDeterministicFindings({
		path,
		lane: PROGRAM_DESIGN_LANE_ID,
		command: FITNESS_COMMANDS.PROGRAM_DESIGN,
		principle: "reduce_cognitive_load",
		enforcement: "quality_structure",
		idPrefix: "program-design",
		title: "Program design debt finding",
		risk: "Low-level design debt makes generated changes harder to reason about and increases long-term change amplification.",
		claimBoundary:
			"Program-design evidence only; this does not prove behavior, hosted CI, review, tracker, branch, or merge state.",
		detailsField: "newDebt",
	});
	const burnDownFinding = findings[0];
	if (
		findings.length === 1 &&
		burnDownFinding?.id === `${PROGRAM_DESIGN_LANE_ID}:artifact:malformed` &&
		burnDownFinding.evidence.message ===
			"Artifact status is warn but the required details array is empty."
	) {
		return [
			{
				...burnDownFinding,
				id: `${PROGRAM_DESIGN_LANE_ID}:burn-down`,
				title: "Program design debt burn-down",
				evidence: {
					...burnDownFinding.evidence,
					message:
						"Quality-debt baseline reports burn-down with no new unbaselined debt.",
				},
				risk: "A burn-down warning is advisory evidence that the baseline changed; it is not proof that all low-level design choices are appropriate.",
				claimBoundary:
					"Program-design burn-down evidence only; this does not prove behavior, hosted CI, review, tracker, branch, or merge state.",
			},
		];
	}
	return findings;
}

/** Admit one optional lane only when its artifact path is supplied. */
function applyOptionalLaneArtifact(
	lane: FitnessLane | undefined,
	path: string | undefined,
	findingsForPath: (path: string) => FitnessFinding[],
): void {
	if (!lane || !path) return;
	lane.applicability = "admitted";
	lane.findings = findingsForPath(path);
	lane.status = laneStatus(lane.findings);
	lane.evidenceSource = path;
}

/** Derive an optional lane status from its normalized findings. */
function laneStatus(
	findings: readonly FitnessFinding[],
): FitnessLane["status"] {
	if (
		findings.some(
			(finding) =>
				finding.severity === "critical" || finding.severity === "error",
		)
	)
		return "fail";
	if (findings.some((finding) => finding.severity === "warning")) return "warn";
	return "pass";
}

/** Apply optional SynAIpse capability artifacts without changing required lanes. */
export function applyOptionalFitnessArtifactReports(
	lanes: FitnessLane[],
	paths: OptionalFitnessArtifactPaths,
): void {
	applyOptionalLaneArtifact(
		lanes.find((lane) => lane.id === AGENT_ROUTING_LANE_ID),
		paths.agentRoutingPath,
		agentRoutingFindings,
	);
	applyOptionalLaneArtifact(
		lanes.find((lane) => lane.id === DOCUMENTATION_LIFECYCLE_LANE_ID),
		paths.documentationLifecyclePath,
		documentationLifecycleFindings,
	);
	applyOptionalLaneArtifact(
		lanes.find((lane) => lane.id === TEST_CONFIDENCE_LANE_ID),
		paths.testConfidencePath,
		testConfidenceFindings,
	);
	applyOptionalLaneArtifact(
		lanes.find((lane) => lane.id === PROGRAM_DESIGN_LANE_ID),
		paths.programDesignPath,
		programDesignFindings,
	);
}
