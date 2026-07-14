import {
	BEHAVIOR_LANE_ID,
	FEEDBACK_LANE_ID,
	LINT_LANE_ID,
	QUALITY_LANE_ID,
	TYPECHECK_LANE_ID,
} from "./artifact-normalizers.js";
import {
	AGENT_ROUTING_LANE_ID,
	DOCUMENTATION_LIFECYCLE_LANE_ID,
	PROGRAM_DESIGN_LANE_ID,
	TEST_CONFIDENCE_LANE_ID,
} from "./optional-artifact-normalizers.js";
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
	{
		category: "agent-native-routing-and-context",
		concern:
			"Skill, policy, and active-route drift that can send Codex to the wrong authority or stale context.",
		laneIds: [AGENT_ROUTING_LANE_ID],
		commands: [
			FITNESS_COMMANDS.AGENT_ROUTING,
			"pnpm run route:surface:validate",
		],
		coverage:
			"Coding-policy routing artifacts provide deterministic local evidence for agent entrypoint selection and route-surface integrity.",
		claimBoundary:
			"Agent-routing evidence is local routing metadata; it does not prove Codex runtime parity, hosted CI, tracker, review, or merge state.",
	},
	{
		category: "documentation-lifecycle-and-test-confidence",
		concern:
			"Governed documentation drift and self-affirming tests that can create false confidence in an agent-produced change.",
		laneIds: [DOCUMENTATION_LIFECYCLE_LANE_ID, TEST_CONFIDENCE_LANE_ID],
		commands: [
			FITNESS_COMMANDS.DOCUMENTATION_LIFECYCLE,
			FITNESS_COMMANDS.TEST_CONFIDENCE,
			"pnpm docs:gitbook:check",
		],
		coverage:
			"Documentation lifecycle and test-confidence artifacts make the context route and test oracle quality mechanically inspectable without claiming product or hosted readiness.",
		claimBoundary:
			"Documentation and test-confidence evidence is local-only; publication, product behavior, CI, review, tracker, branch, and merge truth remain separate.",
	},
	{
		category: "expressive-intent",
		concern:
			"Names, vocabulary, comments, and public API documentation that make the programmer's intent discoverable without requiring readers to reconstruct hidden context.",
		laneIds: [QUALITY_LANE_ID, FEEDBACK_LANE_ID],
		commands: [
			"pnpm run quality:docstrings",
			"bash scripts/validate-codestyle.sh --fast",
			FITNESS_COMMANDS.AUTOREVIEW,
		],
		coverage:
			"Docstring and CODESTYLE gates provide the deterministic documentation and naming route; independent review evaluates domain vocabulary, misleading comments, and whether the design expresses its intent.",
		claimBoundary:
			"Expressive-intent coverage routes local CODESTYLE and review evidence; it does not prove semantic clarity, product behavior, or external delivery state.",
	},
	{
		category: "boundary-correctness",
		concern:
			"Input, output, integration, error, and corner-case boundaries where intuitive code can produce incorrect behavior or leak coupling across modules.",
		laneIds: [ARCHITECTURE_LANE_ID, BEHAVIOR_LANE_ID],
		commands: [
			FITNESS_COMMANDS.BEHAVIOR_TESTS,
			FITNESS_COMMANDS.ARCHITECTURE_CHECK,
			FITNESS_COMMANDS.AUTOREVIEW,
		],
		coverage:
			"Behavior tests and architecture checks own executable and module-boundary evidence; CODESTYLE and independent review route missing corner cases, hidden temporal coupling, leaky abstractions, and transitive navigation concerns.",
		claimBoundary:
			"Boundary-correctness coverage identifies the proving route; it does not prove every boundary case without current targeted test evidence.",
	},
	{
		category: "program-design",
		concern:
			"Low-level design debt: oversized methods, high complexity, duplicate blocks, leaky factoring, and change amplification inside otherwise valid architecture.",
		laneIds: [PROGRAM_DESIGN_LANE_ID],
		commands: [FITNESS_COMMANDS.PROGRAM_DESIGN],
		coverage:
			"The existing quality-debt baseline is promoted as deterministic program-design evidence when its JSON artifact is admitted.",
		claimBoundary:
			"Program-design evidence is local static evidence; CODESTYLE review and behavior tests still decide whether a proposed abstraction is appropriate.",
	},
];

/** Build anti-pattern and engineering-judgement coverage metadata. */
export function fitnessCoverage(): FitnessCoverage[] {
	return FITNESS_COVERAGE.map((entry) => ({
		...entry,
		laneIds: [...entry.laneIds],
		commands: [...entry.commands],
	}));
}
