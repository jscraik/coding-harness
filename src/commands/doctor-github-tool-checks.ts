import type { DoctorCheckFn } from "./doctor-checks.js";
import {
	createDoctorGitHubToolCheck,
	parseGithubAuthTimeout,
} from "./doctor-github-tool-check.js";

export { parseGithubAuthTimeout };

/** GitHub CLI prerequisite checks used by harness doctor. */
export const DOCTOR_GITHUB_TOOL_CHECKS: DoctorCheckFn[] = [
	createDoctorGitHubToolCheck(process.env),
];
