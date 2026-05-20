import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DOCTOR_CI_CHECK_ALIGNMENT } from "./doctor-ci-check-alignment.js";
import type { DoctorCheckFn } from "./doctor-checks.js";

/** CI readiness checks used by harness doctor. */
export const DOCTOR_CI_CHECKS: DoctorCheckFn[] = [
	// ── CI: GITHUB_PERSONAL_ACCESS_TOKEN / GH_TOKEN awareness ────────────────
	(dir) => {
		// This is an advisory check — we can't verify CI secrets from local,
		// but we can check if .circleci/config.yml exists and contains expected env refs
		const circleciConfig = resolve(dir, ".circleci/config.yml");
		if (!existsSync(circleciConfig)) {
			return {
				id: "ci:circleci-config",
				category: "ci",
				label: ".circleci/config.yml",
				status: "warn",
				message:
					".circleci/config.yml not found — ci-migrate may not have been run yet",
				fix: "harness ci-migrate init  to generate CircleCI config",
			};
		}
		let configContent: string;
		try {
			configContent = readFileSync(circleciConfig, "utf-8");
		} catch {
			return {
				id: "ci:circleci-config",
				category: "ci",
				label: ".circleci/config.yml",
				status: "fail",
				message: "exists but could not be read",
				fix: "Check file permissions: chmod 644 .circleci/config.yml",
			};
		}
		// Check for GH_TOKEN (required by gh CLI steps in CircleCI)
		const hasGhToken =
			configContent.includes("GH_TOKEN") ||
			configContent.includes("GITHUB_PERSONAL_ACCESS_TOKEN");
		if (!hasGhToken) {
			return {
				id: "ci:circleci-config",
				category: "ci",
				label: ".circleci/config.yml",
				status: "warn",
				message:
					".circleci/config.yml does not reference GH_TOKEN — gh CLI steps may fail in CI",
				fix: "Add GH_TOKEN env var to CircleCI project settings and reference in config",
			};
		}
		return {
			id: "ci:circleci-config",
			category: "ci",
			label: ".circleci/config.yml",
			status: "ok",
			message: "present and references GH_TOKEN",
		};
	},

	...DOCTOR_CI_CHECK_ALIGNMENT,
];
