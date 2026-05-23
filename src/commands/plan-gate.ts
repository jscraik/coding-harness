export {
	runPlanGateCLI,
	runPlanGateFromCliArgs,
} from "../lib/plan-gate/cli.js";
export {
	EXIT_CODES,
	runPlanGate,
} from "../lib/plan-gate/detector.js";
export type { PlanGateOptions } from "../lib/plan-gate/types.js";

// Re-export workflow plan utilities for plan management
export {
	createPlan,
	findPlans,
	loadPlan,
	updatePlanStatus,
	checkMissingOrigin,
	generatePlanFilename,
	type PlanFrontmatter,
	type PlanMetadata,
	type CreatePlanOptions,
} from "../lib/workflow/plan.js";
