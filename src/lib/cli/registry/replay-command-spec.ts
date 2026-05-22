import { runReplayCLI } from "../../../commands/replay.js";
import { buildReplayOptionsFromCliArgs } from "../../replay/cli-args.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical replay command adapter. */
export function createReplayCommandSpec(): CommandSpec {
	return {
		name: "replay",
		summary: "Replay or list captured agent automation traces",
		errorLabel: "Replay Error",
		execute: (args) => runReplayCLI(buildReplayOptionsFromCliArgs(args)),
	};
}
