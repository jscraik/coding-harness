import { runFleetPlanCLI } from "../../../commands/fleet-plan-cli.js";
import { defineCommandSpec } from "./define-command-spec.js";
import type { CommandSpec } from "./types.js";

/** Build the fleet-plan registry seam. */
export function createFleetPlanCommandSpec(): CommandSpec {
	return defineCommandSpec({
		name: "fleet-plan",
		summary:
			"Build an agent-native remediation plan from a harness upgrade matrix artifact",
		example:
			"fleet-plan --from artifacts/harness-upgrade-matrix-dev.json --json",
		errorLabel: "Fleet Plan Error",
		runner: runFleetPlanCLI,
	});
}
