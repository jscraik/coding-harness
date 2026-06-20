import type { runBrainStatus } from "../../../commands/brain.js";
import { parseIntegerArg } from "../parse-utils.js";
import { COMMAND_SPECS as CORE_COMMAND_SPECS } from "./command-specs-core.js";
import type { CommandSpec } from "./types.js";

/** Public API export. */
export type CommandSpecTypeMarker = CommandSpec;
/** Public API export. */
export type BrainStatusFn = typeof runBrainStatus;
/** Public API export. */
export const parseIntegerArgForCommandSpecs = parseIntegerArg;

export const COMMAND_SPECS: CommandSpec[] = [...CORE_COMMAND_SPECS];
