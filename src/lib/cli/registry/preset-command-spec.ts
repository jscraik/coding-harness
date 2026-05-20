import { runPresetCLI } from "../../../commands/preset.js";
import type { CommandSpec } from "./types.js";

/** Build the preset registry seam. */
export function createPresetCommandSpec(): CommandSpec {
	return {
		name: "preset",
		summary: "List and show bundled harness presets",
		errorLabel: "Preset Error",
		execute: runPresetCommand,
	};
}

async function runPresetCommand(args: string[]): Promise<number> {
	const { exitCode } = await runPresetCLI(args);
	return exitCode;
}
