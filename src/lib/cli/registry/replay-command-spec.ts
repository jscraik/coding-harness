import { runReplayCLI } from "../../../commands/replay.js";
import { buildReplayOptionsFromCliArgs } from "../../replay/cli-args.js";
import type { CommandSpec } from "./types.js";

/**
 * Create the canonical `replay` CommandSpec for the CLI.
 *
 * The spec defines the command name, user-facing summary, error label, and an
 * execute handler that runs the replay CLI flow using options derived from
 * the provided command-line arguments.
 *
 * @returns A CommandSpec configured for the `replay` command
 */
export function createReplayCommandSpec(): CommandSpec {
	return {
		name: "replay",
		summary: "Replay or list captured agent automation traces",
		errorLabel: "Replay Error",
		execute: (args) => runReplayCLI(buildReplayOptionsFromCliArgs(args)),
	};
}
