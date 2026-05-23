import * as observabilityGate from "../../observability-gate.js";
import type { CommandSpec } from "./types.js";

/** Build the metric-label cardinality gate command adapter. */
export function createObservabilityGateCommandSpec(): CommandSpec {
	return {
		name: "observability-gate",
		summary: "Check cardinality limits in metrics",
		errorLabel: "Observability Gate Error",
		execute: (args) => observabilityGate.runObservabilityGateFromCliArgs(args),
	};
}
