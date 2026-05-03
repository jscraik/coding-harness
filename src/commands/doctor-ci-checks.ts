import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	findCircleCIJobNamedCheckNames,
	normalizeRequiredChecksManifest,
} from "../lib/policy/required-checks.js";
import { readJsonFile } from "./doctor-check-utils.js";
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

	// ── CI: check alignment (JSC-70) — advisory ─────────────────────────────
	// Warns when githubCheckName entries in ci-required-checks.json do not
	// satisfy canonical check identity for the active CI provider.
	// CircleCI: one check run per workflow (not per job) — branch protection
	// must use workflow-level githubCheckName values (for example "pr-pipeline").
	(dir) => {
		const manifestPath = resolve(dir, ".harness/ci-required-checks.json");
		if (!existsSync(manifestPath)) {
			return {
				id: "ci:check-alignment",
				category: "ci",
				label: "CI check alignment",
				status: "skip",
				message:
					".harness/ci-required-checks.json not found — skipping alignment check",
			};
		}

		const manifest = readJsonFile(manifestPath);
		const normalized = normalizeRequiredChecksManifest(manifest);
		if (!normalized.ok) {
			return {
				id: "ci:check-alignment",
				category: "ci",
				label: "CI check alignment",
				status: "warn",
				message:
					".harness/ci-required-checks.json exists but is not valid — cannot check alignment",
				fix: `Run: harness ci-migrate bootstrap to regenerate the manifest (${normalized.error})`,
			};
		}

		const provider = normalized.value.activeProvider;
		const gatesForAlignment = normalized.value.gates.map((gate) => ({
			provider: gate.provider,
			githubCheckName: gate.githubCheckName,
		}));
		const gatesForActiveProvider = gatesForAlignment.filter(
			(gate) => gate.provider === provider,
		);

		if (!provider || gatesForAlignment.length === 0) {
			return {
				id: "ci:check-alignment",
				category: "ci",
				label: "CI check alignment",
				status: "warn",
				message:
					".harness/ci-required-checks.json exists but is not valid — cannot check alignment",
				fix: "Run: harness ci-migrate bootstrap to regenerate the manifest (required checks list is empty)",
			};
		}

		// Collect all non-empty githubCheckName values
		const githubCheckNames = gatesForActiveProvider
			.map((gate) => gate.githubCheckName)
			.filter(
				(name): name is string => typeof name === "string" && name.length > 0,
			);

		if (githubCheckNames.length === 0) {
			// Advisory: file exists but no githubCheckName fields set
			return {
				id: "ci:check-alignment",
				category: "ci",
				label: "CI check alignment",
				status: "warn",
				message: `ci-check-alignment: no githubCheckName values found for active provider "${provider}" — canonical check identity requires workflow-level check contexts (for example "pr-pipeline")`,
				fix:
					"Add workflow-level githubCheckName values to active-provider entries in .harness/ci-required-checks.json." +
					" See docs/agents/17-ci-required-checks.md",
			};
		}

		if (provider === "circleci") {
			const suspicious = findCircleCIJobNamedCheckNames(
				gatesForActiveProvider
					.map((gate) => gate.githubCheckName)
					.filter(
						(checkName): checkName is string =>
							typeof checkName === "string" && checkName.length > 0,
					),
			);
			if (suspicious.length > 0) {
				return {
					id: "ci:check-alignment",
					category: "ci",
					label: "CI check alignment",
					status: "warn",
					message: `ci-check-alignment: CircleCI job-like githubCheckName values detected: ${suspicious.join(", ")}. Canonical check identity requires workflow-level githubCheckName values (for example "pr-pipeline"), not job names.`,
					fix:
						"Update githubCheckName fields to workflow-level check names (pr-pipeline / harness-gates)." +
						" See docs/agents/17-ci-required-checks.md",
				};
			}
		}

		return {
			id: "ci:check-alignment",
			category: "ci",
			label: "CI check alignment",
			status: "ok",
			message: `Canonical githubCheckName check identity looks correct for provider "${provider}"`,
		};
	},
];
