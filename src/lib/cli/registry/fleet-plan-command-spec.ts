import { runFleetPlanCLI } from "../../../commands/fleet-plan.js";
import type { CommandSpec } from "./types.js";

/** Build the fleet-plan registry seam. */
export function createFleetPlanCommandSpec(): CommandSpec {
	return {
		name: "fleet-plan",
		summary:
			"Build an agent-native remediation plan from a harness upgrade matrix artifact",
		example:
			"fleet-plan --from artifacts/harness-upgrade-matrix-dev.json --json",
		errorLabel: "Fleet Plan Error",
		execute: (args) => runFleetPlanCLI(args),
	};
}
