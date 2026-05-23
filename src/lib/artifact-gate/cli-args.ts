import { inspectFlagValue, parseCsvList } from "../cli/parse-utils.js";
import type { ArtifactGateCliArgsResult } from "./types.js";

/**
 * Converts raw artifact-gate CLI argv into a typed command contract.
 *
 * @param args - Raw CLI arguments (e.g. `process.argv.slice(2)`)
 * @returns An `ArtifactGateCliArgsResult` indicating parsed options on success or a structured error when a required flag is missing.
 *          When `ok` is `true`, `options` contains:
 *            - `files` — optional array of file paths parsed from `--files`
 *            - `registryPath` — the value of `--registry` (or `undefined` if not provided)
 *            - `json` — whether `--json` was present
 *          When `ok` is `false`, `error.code` will be either
 *            `'artifact-gate.files_missing_value'` or `'artifact-gate.registry_missing_value'`.
 */
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
