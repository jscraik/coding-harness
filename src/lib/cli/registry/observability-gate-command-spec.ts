import * as observabilityGate from "../../observability-gate.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Build the metric-label cardinality gate command adapter. */
export function createObservabilityGateCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "observability-gate",
		summary: "Check cardinality limits in metrics",
		errorLabel: "Observability Gate Error",
		runner: (args) => observabilityGate.runObservabilityGateFromCliArgs(args),
	});
}
