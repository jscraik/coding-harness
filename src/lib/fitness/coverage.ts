import {
	BEHAVIOR_LANE_ID,
	FEEDBACK_LANE_ID,
	LINT_LANE_ID,
	QUALITY_LANE_ID,
	TYPECHECK_LANE_ID,
} from "./artifact-normalizers.js";
import { FITNESS_COMMANDS } from "./commands.js";
import type { FitnessCoverage } from "./types.js";

const ARCHITECTURE_LANE_ID = "architecture-fitness";

const FITNESS_COVERAGE: FitnessCoverage[] = [
	{
		category: "typescript-type-discipline",
		concern:
			"any, unsafe casts, non-null assertions, ts-ignore, strict-mode drift, duplicate types, and unvalidated external data.",
		laneIds: [TYPECHECK_LANE_ID, LINT_LANE_ID],
		commands: [
			FITNESS_COMMANDS.TYPECHECK_ARTIFACT,
			FITNESS_COMMANDS.LINT_ARTIFACT,
			"pnpm run quality:docstrings",
		],
		coverage:
			"Typecheck and lint artifacts provide deterministic evidence; docstring checks preserve typed public API intent.",
		claimBoundary:
			"Type and lint evidence does not prove runtime behavior or review-thread resolution.",
	},
	{
		category: "structure-and-architecture",
		concern:
			"God functions, oversized modules, god classes, circular imports, deep nesting, massive utility files, and boundary drift.",
		laneIds: [ARCHITECTURE_LANE_ID, QUALITY_LANE_ID],
		commands: [
			FITNESS_COMMANDS.ARCHITECTURE_CHECK,
			FITNESS_COMMANDS.QUALITY_SIZE,
			"pnpm run quality:debt",
		],
		coverage:
			"Architecture, quality-size, and code-quality debt artifacts normalize boundary, file-size, function-size, complexity, duplicate-block, and legacy-debt findings.",
		claimBoundary:
			"Structural evidence does not prove API compatibility, product behavior, or deployment readiness.",
	},
	{
		category: "python-and-script-hygiene",
		concern:
			"Untyped Python boundaries, swallowed exceptions, mutable defaults, subprocess misuse, print-only diagnostics, and script drift.",
		laneIds: [LINT_LANE_ID, BEHAVIOR_LANE_ID],
		commands: [
			"pnpm run python:types",
			"pnpm run quality:scripts",
			FITNESS_COMMANDS.BEHAVIOR_TESTS,
		],
		coverage:
			"Python type/artifact checks and script syntax checks sit in the same validation ladder; behavior artifacts catch executable regressions.",
		claimBoundary:
			"Fitness coverage names the required adjacent gates; a fitness report is not proof those gates ran unless artifacts or command evidence are present.",
	},
	{
		category: "config-and-contract-data",
		concern:
			"Missing schemas, duplicate or mixed-shape config, ambiguous YAML scalars, excessive nesting, hidden defaults, and secrets in config.",
		laneIds: [LINT_LANE_ID, FEEDBACK_LANE_ID],
		commands: [
			"pnpm run artifact:types",
			"pnpm run coding-policy:validate",
			FITNESS_COMMANDS.AUDIT_TRACKING,
		],
		coverage:
			"Artifact type validation and coding-policy validation cover JSON/YAML/TOML contract shape, while audit tracking catches learned policy drift.",
		claimBoundary:
			"Schema and policy evidence does not prove secrets scanning, hosted CI, or external service state.",
	},
	{
		category: "engineering-judgment-and-agent-safety",
		concern:
			"API contract drift, security basics, missing observability, weak tests, CI hygiene, AI prompt/tool sprawl, blind model trust, and missing human approval boundaries.",
		laneIds: [ARCHITECTURE_LANE_ID, BEHAVIOR_LANE_ID, FEEDBACK_LANE_ID],
		commands: [
			FITNESS_COMMANDS.ARCHITECTURE_CHECK,
			FITNESS_COMMANDS.BEHAVIOR_TESTS,
			FITNESS_COMMANDS.AUDIT_TRACKING,
			"pnpm run quality:debt",
			"bash scripts/validate-codestyle.sh --fast",
		],
		coverage:
			"Fitness preserves the review frame by linking local structure, behavior, and feedback-learning evidence without collapsing them into readiness claims.",
		claimBoundary:
			"Engineering judgment coverage is routing metadata; current CI, PR, tracker, security-service, and mergeability truth require separate evidence.",
	},
];

/** Build anti-pattern and engineering-judgement coverage metadata. */
export function fitnessCoverage(): FitnessCoverage[] {
	return FITNESS_COVERAGE;
}
