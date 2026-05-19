import { spawnSync } from "node:child_process";
import { commandExists } from "./doctor-check-utils.js";
import type { DoctorCheckFn } from "./doctor-checks.js";

/** GitHub CLI prerequisite checks used by harness doctor. */
export const DOCTOR_GITHUB_TOOL_CHECKS: DoctorCheckFn[] = [
	(_dir) => {
		const exists = commandExists("gh");
		if (!exists) {
			return {
				id: "tool:gh",
				category: "tool",
				label: "GitHub CLI (gh)",
				status: "warn",
				message: "gh not found — required for branch-protect and PR workflows",
				fix: "Install GitHub CLI (gh) with your package manager, then run: gh auth login",
			};
		}
		const authResult = spawnSync("gh", ["auth", "status"], {
			stdio: "pipe",
			encoding: "utf-8",
			timeout: 5000,
		});
		if (authResult.error) {
			return {
				id: "tool:gh",
				category: "tool",
				label: "GitHub CLI (gh)",
				status: "warn",
				message: `gh auth check failed: ${authResult.error.message}`,
				fix: "Verify gh installation/PATH, then run gh auth login",
			};
		}
		if (authResult.status !== 0) {
			return {
				id: "tool:gh",
				category: "tool",
				label: "GitHub CLI (gh)",
				status: "warn",
				message: "gh found but not authenticated",
				fix: "gh auth login",
			};
		}
		return {
			id: "tool:gh",
			category: "tool",
			label: "GitHub CLI (gh)",
			status: "ok",
			message: "found and authenticated",
		};
	},
];
