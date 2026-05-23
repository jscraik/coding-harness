import * as observabilityGate from "../../observability-gate.js";
import type { CommandSpec } from "./types.js";

/**
 * Create a CommandSpec for the `observability-gate` CLI command.
 *
 * The returned spec defines the `observability-gate` command with a summary,
 * an error label, and an execution handler that invokes the observability gate runner.
 *
 * @returns A CommandSpec that configures the `observability-gate` command used to check metric-label cardinality limits
 */
export function createObservabilityGateCommandSpec(): CommandSpec {
	return {
		name: "observability-gate",
		summary: "Check cardinality limits in metrics",
		errorLabel: "Observability Gate Error",
		execute: (args) => observabilityGate.runObservabilityGateFromCliArgs(args),
	};
}
