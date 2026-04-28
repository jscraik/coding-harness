import type { runBrainStatus } from "../../../commands/brain.js";
import { parseIntegerArg } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Public API export. */
export type CommandSpecTypeMarker = CommandSpec;
/** Public API export. */
export type BrainStatusFn = typeof runBrainStatus;
/** Public API export. */
export const parseIntegerArgForCommandSpecs = parseIntegerArg;

export * from "./command-specs-core.js";
