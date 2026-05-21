import { inspectFlagValue, parseCsvList } from "../cli/parse-utils.js";
import type { ArtifactGateCliArgsResult } from "./types.js";

/** Convert raw artifact-gate argv into the typed command contract. */
export function buildArtifactGateOptionsFromCliArgs(
	args: string[],
): ArtifactGateCliArgsResult {
	const filesFlag = inspectFlagValue(args, "--files");
	const registryFlag = inspectFlagValue(args, "--registry");
	const json = args.includes("--json");

	if (filesFlag.missingValue) {
		return {
			ok: false,
			json,
			error: {
				code: "artifact-gate.files_missing_value",
				message: "--files requires a value",
			},
		};
	}

	if (registryFlag.missingValue) {
		return {
			ok: false,
			json,
			error: {
				code: "artifact-gate.registry_missing_value",
				message: "--registry requires a value",
			},
		};
	}

	return {
		ok: true,
		options: {
			files:
				filesFlag.value !== undefined
					? parseCsvList(filesFlag.value)
					: undefined,
			registryPath: registryFlag.value,
			json,
		},
	};
}
