import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
	findCircleCIJobNamedCheckNames,
	normalizeRequiredChecksManifest,
} from "../lib/policy/required-checks.js";
import { readJsonFile } from "./doctor-check-utils.js";
import type { DoctorCheckFn } from "./doctor-checks.js";
import type { DoctorCheck } from "./doctor.js";

function ciAlignmentCheck(
	status: DoctorCheck["status"],
	message: string,
	fix?: string,
): DoctorCheck {
	return {
		id: "ci:check-alignment",
		category: "ci",
		label: "CI check alignment",
		status,
		message,
		...(fix ? { fix } : {}),
	};
}

function githubCheckNamesForActiveProvider(manifest: {
	activeProvider: string;
	gates: { provider: string; githubCheckName: string | null }[];
}): string[] {
	return manifest.gates
		.filter((gate) => gate.provider === manifest.activeProvider)
		.map((gate) => gate.githubCheckName)
		.filter(
			(checkName): checkName is string =>
				typeof checkName === "string" && checkName.length > 0,
		);
}

/** Required-check identity alignment checks used by harness doctor. */
export const DOCTOR_CI_CHECK_ALIGNMENT: DoctorCheckFn[] = [
	(dir) => {
		const manifestPath = resolve(dir, ".harness/ci-required-checks.json");
		if (!existsSync(manifestPath)) {
			return ciAlignmentCheck(
				"skip",
				".harness/ci-required-checks.json not found — skipping alignment check",
			);
		}

		const manifest = readJsonFile(manifestPath);
		const normalized = normalizeRequiredChecksManifest(manifest);
		if (!normalized.ok) {
			return ciAlignmentCheck(
				"warn",
				".harness/ci-required-checks.json exists but is not valid — cannot check alignment",
				"Run: harness ci-migrate bootstrap to regenerate the manifest (" +
					normalized.error +
					")",
			);
		}

		const provider = normalized.value.activeProvider;

		if (!provider || normalized.value.gates.length === 0) {
			return ciAlignmentCheck(
				"warn",
				".harness/ci-required-checks.json exists but is not valid — cannot check alignment",
				"Run: harness ci-migrate bootstrap to regenerate the manifest (required checks list is empty)",
			);
		}

		const githubCheckNames = githubCheckNamesForActiveProvider(
			normalized.value,
		);

		if (githubCheckNames.length === 0) {
			return ciAlignmentCheck(
				"warn",
				"ci-check-alignment: no githubCheckName values found for active provider " +
					JSON.stringify(provider) +
					' — canonical check identity requires workflow-level check contexts (for example "pr-pipeline")',
				"Add workflow-level githubCheckName values to active-provider entries in .harness/ci-required-checks.json." +
					" See docs/agents/17-ci-required-checks.md",
			);
		}

		if (provider === "circleci") {
			const suspicious = findCircleCIJobNamedCheckNames(githubCheckNames);
			if (suspicious.length > 0) {
				return ciAlignmentCheck(
					"warn",
					"ci-check-alignment: CircleCI job-like githubCheckName values detected: " +
						suspicious.join(", ") +
						'. Canonical check identity requires workflow-level githubCheckName values (for example "pr-pipeline"), not job names.',
					"Update githubCheckName fields to workflow-level check names (pr-pipeline / harness-gates)." +
						" See docs/agents/17-ci-required-checks.md",
				);
			}
		}

		return ciAlignmentCheck(
			"ok",
			"Canonical githubCheckName check identity looks correct for provider " +
				JSON.stringify(provider),
		);
	},
];
