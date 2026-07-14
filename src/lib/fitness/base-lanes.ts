import {
	AGENT_ROUTING_LANE_ID,
	DOCUMENTATION_LIFECYCLE_LANE_ID,
	PROGRAM_DESIGN_LANE_ID,
	TEST_CONFIDENCE_LANE_ID,
} from "./optional-artifact-normalizers.js";
import {
	BEHAVIOR_LANE_ID,
	FEEDBACK_LANE_ID,
	LINT_LANE_ID,
	QUALITY_LANE_ID,
	TYPECHECK_LANE_ID,
} from "./artifact-normalizers.js";
import { FITNESS_COMMANDS } from "./commands.js";
import type { FitnessLane } from "./types.js";

type BaseLane = Omit<FitnessLane, "findings">;

const BASE_LANE_DEFINITIONS: readonly BaseLane[] = [
	{
		id: "architecture-fitness",
		label: "Architecture fitness",
		command: FITNESS_COMMANDS.ARCHITECTURE_CHECK,
		capability: "architecture_fitness",
		applicability: "required",
		principle: "protect_deep_module_boundaries",
		enforcement: "architecture_fitness",
		status: "not_run",
		evidenceSource: "package.json scripts.architecture:check",
	},
	{
		id: QUALITY_LANE_ID,
		label: "Quality structure",
		command: FITNESS_COMMANDS.QUALITY_SIZE,
		capability: "quality_structure",
		applicability: "required",
		principle: "reduce_cognitive_load",
		enforcement: "quality_structure",
		status: "not_run",
		evidenceSource: "package.json scripts.quality:size",
	},
	{
		id: TYPECHECK_LANE_ID,
		label: "Type safety",
		command: FITNESS_COMMANDS.TYPECHECK_ARTIFACT,
		capability: "type_safety",
		applicability: "required",
		principle: "prove_type_safety",
		enforcement: "type_safety",
		status: "not_run",
		evidenceSource: "package.json scripts.fitness:typecheck-artifact",
	},
	{
		id: LINT_LANE_ID,
		label: "Static lint",
		command: FITNESS_COMMANDS.LINT_ARTIFACT,
		capability: "static_analysis",
		applicability: "required",
		principle: "preserve_static_contracts",
		enforcement: "static_analysis",
		status: "not_run",
		evidenceSource: "package.json scripts.fitness:lint-artifact",
	},
	{
		id: BEHAVIOR_LANE_ID,
		label: "Behavior proof",
		command: FITNESS_COMMANDS.BEHAVIOR_TESTS,
		capability: "behavior_proof",
		applicability: "required",
		principle: "prove_behavior_outcomes",
		enforcement: "hard_blocker",
		status: "not_run",
		evidenceSource: "package.json scripts.quality:behavior-tests",
	},
	{
		id: FEEDBACK_LANE_ID,
		label: "Feedback learning",
		command: FITNESS_COMMANDS.AUDIT_TRACKING,
		capability: "feedback_learning",
		applicability: "required",
		principle: "compound_feedback_to_harness",
		enforcement: "hard_blocker",
		status: "not_run",
		evidenceSource: "package.json scripts.harness:audit-tracking",
	},
	...optionalLaneDefinitions(),
];

/** Define optional capability lanes without creating evidence debt by default. */
function optionalLaneDefinitions(): BaseLane[] {
	return [
		{
			id: AGENT_ROUTING_LANE_ID,
			label: "Agent routing",
			command: FITNESS_COMMANDS.AGENT_ROUTING,
			capability: "agent_routing",
			applicability: "not_applicable",
			principle: "preserve_static_contracts",
			enforcement: "static_analysis",
			status: "not_run",
			evidenceSource: "package.json scripts.coding-policy:route",
		},
		{
			id: DOCUMENTATION_LIFECYCLE_LANE_ID,
			label: "Documentation lifecycle",
			command: FITNESS_COMMANDS.DOCUMENTATION_LIFECYCLE,
			capability: "documentation_lifecycle",
			applicability: "not_applicable",
			principle: "reduce_cognitive_load",
			enforcement: "quality_structure",
			status: "not_run",
			evidenceSource: "package.json scripts.docs:lifecycle",
		},
		{
			id: TEST_CONFIDENCE_LANE_ID,
			label: "Test confidence",
			command: FITNESS_COMMANDS.TEST_CONFIDENCE,
			capability: "test_confidence",
			applicability: "not_applicable",
			principle: "prove_behavior_outcomes",
			enforcement: "hard_blocker",
			status: "not_run",
			evidenceSource: "package.json scripts.quality:self-affirming",
		},
		{
			id: PROGRAM_DESIGN_LANE_ID,
			label: "Program design",
			command: FITNESS_COMMANDS.PROGRAM_DESIGN,
			capability: "program_design",
			applicability: "not_applicable",
			principle: "reduce_cognitive_load",
			enforcement: "quality_structure",
			status: "not_run",
			evidenceSource: "package.json scripts.quality:debt",
		},
	];
}

/** Build the canonical required and optional local fitness lanes. */
export function createBaseFitnessLanes(): FitnessLane[] {
	return BASE_LANE_DEFINITIONS.map((lane) => ({ ...lane, findings: [] }));
}
