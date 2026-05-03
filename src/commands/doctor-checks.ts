import { DOCTOR_CI_CHECKS } from "./doctor-ci-checks.js";
import { DOCTOR_CONFIG_CHECKS } from "./doctor-config-checks.js";
import { DOCTOR_FILE_CHECKS } from "./doctor-file-checks.js";
import { DOCTOR_TOOL_CHECKS } from "./doctor-tool-checks.js";
import type { DoctorCheck } from "./doctor.js";

/** Function that evaluates one doctor prerequisite against a repository root. */
export type DoctorCheckFn = (dir: string) => DoctorCheck;

/** Canonical catalogue of doctor prerequisite checks. */
export const DOCTOR_CHECKS: DoctorCheckFn[] = [
	...DOCTOR_TOOL_CHECKS,
	...DOCTOR_FILE_CHECKS,
	...DOCTOR_CONFIG_CHECKS,
	...DOCTOR_CI_CHECKS,
];
