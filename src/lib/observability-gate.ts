export {
	runObservabilityGateCLI,
	runObservabilityGateFromCliArgs,
} from "./observability-gate/cli.js";
export { buildObservabilityGateOptionsFromCliArgs } from "./observability-gate/cli-args.js";
export { runObservabilityGate } from "./observability-gate/label-cardinality.js";
export { EXIT_CODES } from "./observability-gate/types.js";
export type {
	ObservabilityGateOptions,
	ObservabilityGateOutput,
	ObservabilityGateResult,
} from "./observability-gate/types.js";
