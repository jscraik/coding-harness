import { runPrCloseoutCLI } from "../../../commands/pr-closeout.js";
import type { CommandSpec } from "./types.js";

/** Build the PR closeout registry seam. */
export function createPrCloseoutCommandSpec(): CommandSpec {
	return {
		name: "pr-closeout",
		summary:
			"Build a read-only PR closeout evidence report from GitHub, CircleCI, CodeRabbit, Snyk, Coding Harness closeout gates, and normalized handoff state",
		example:
			"pr-closeout --pr 258 --gates artifacts/pr-closeout/closeout-gates.json --json",
		errorLabel: "PR Closeout Error",
		execute: (args) => runPrCloseoutCLI(args),
	};
}
