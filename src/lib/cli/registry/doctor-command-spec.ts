import { runDoctorCLI } from "../../../commands/doctor.js";
import type { getVersion } from "../../version.js";
import type { CommandSpec } from "./types.js";

/** Build the doctor registry seam. */
export function createDoctorCommandSpec(
	versionProvider: typeof getVersion,
): CommandSpec {
	return {
		name: "doctor",
		summary: "Diagnose harness installation and environment issues",
		example: "doctor --json",
		errorLabel: "Doctor Error",
		execute: (args) => runDoctorCLI(args, versionProvider),
	};
}
