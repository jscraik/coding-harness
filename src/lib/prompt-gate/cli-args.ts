import { getFlagValue } from "../cli/parse-utils.js";
import { isPromptType, PROMPT_TYPES, type PromptGateOptions } from "./types.js";

/** Parsed prompt-gate CLI arguments or a usage error message. */
export type ParsedPromptGateCliArgs =
	| { ok: true; options: PromptGateOptions }
	| { ok: false; message: string };

/** Build prompt-gate options from raw command-line arguments. */
export function buildPromptGateOptionsFromCliArgs(
	args: string[],
): ParsedPromptGateCliArgs {
	const typeArg = getFlagValue(args, args.indexOf("--type"));
	const fileArg = getFlagValue(args, args.indexOf("--file"));

	if (!typeArg) {
		return {
			ok: false,
			message: `Error: --type is required (${PROMPT_TYPES.join("|")})`,
		};
	}
	if (!fileArg) {
		return { ok: false, message: "Error: --file is required" };
	}
	if (!isPromptType(typeArg)) {
		return {
			ok: false,
			message: `Error: Invalid type "${typeArg}". Must be one of: ${PROMPT_TYPES.join(", ")}`,
		};
	}

	return {
		ok: true,
		options: {
			type: typeArg,
			file: fileArg,
			json: args.includes("--json"),
		},
	};
}
