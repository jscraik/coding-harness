import { spawnSync } from "node:child_process";
import semver from "semver";
import { detectHarnessVersionCoherence } from "../lib/version-coherence.js";
import { commandExists, getCommandVersion } from "./doctor-check-utils.js";
import type { DoctorCheckFn } from "./doctor-checks.js";

/** Tool and CLI prerequisite checks used by harness doctor. */
export const DOCTOR_TOOL_CHECKS: DoctorCheckFn[] = [
	// ── Tool: Node.js ────────────────────────────────────────────────────────
	(_dir) => {
		const version = getCommandVersion("node");
		if (!version) {
			return {
				id: "tool:node",
				category: "tool",
				label: "Node.js",
				status: "fail",
				message: "node not found in PATH",
				fix: "Install Node.js >= 24 via mise: mise install node@24",
			};
		}
		// Extract major version number
		const match = version.match(/v?(\d+)/);
		const major = match ? Number.parseInt(match[1] ?? "0", 10) : 0;
		if (major < 24) {
			return {
				id: "tool:node",
				category: "tool",
				label: "Node.js",
				status: "fail",
				message: `Node ${version} found — harness requires v24+`,
				fix: "Upgrade via mise: mise install node@24 && mise use node@24",
			};
		}
		return {
			id: "tool:node",
			category: "tool",
			label: "Node.js",
			status: "ok",
			message: version,
		};
	},

	// ── Tool: pnpm ────────────────────────────────────────────────────────────
	(_dir) => {
		const exists = commandExists("pnpm");
		if (!exists) {
			return {
				id: "tool:pnpm",
				category: "tool",
				label: "pnpm",
				status: "fail",
				message: "pnpm not found in PATH",
				fix: "npm install -g pnpm@10",
			};
		}
		const version = getCommandVersion("pnpm");
		if (!version) {
			return {
				id: "tool:pnpm",
				category: "tool",
				label: "pnpm",
				status: "fail",
				message: "Unable to determine pnpm version",
				fix: "npm install -g pnpm@10.33.0",
			};
		}
		const requiredVersion = "10.33.0";
		if (!semver.satisfies(version, `>=${requiredVersion}`)) {
			return {
				id: "tool:pnpm",
				category: "tool",
				label: "pnpm",
				status: "fail",
				message: `pnpm ${version} found — harness requires v${requiredVersion}+`,
				fix: `npm install -g pnpm@${requiredVersion}`,
			};
		}
		return {
			id: "tool:pnpm",
			category: "tool",
			label: "pnpm",
			status: "ok",
			message: version,
		};
	},

	// ── Tool: harness version coherence ───────────────────────────────────────
	(dir) => {
		const coherence = detectHarnessVersionCoherence(dir);
		if (coherence.status === "drift") {
			return {
				id: "tool:harness-version-coherence",
				category: "tool",
				label: "Harness version coherence",
				status: "fail",
				message: coherence.message,
				...(coherence.remediation ? { fix: coherence.remediation } : {}),
			};
		}
		if (coherence.status === "error") {
			return {
				id: "tool:harness-version-coherence",
				category: "tool",
				label: "Harness version coherence",
				status: "warn",
				message: coherence.message,
				...(coherence.remediation ? { fix: coherence.remediation } : {}),
			};
		}
		if (coherence.status === "skip") {
			return {
				id: "tool:harness-version-coherence",
				category: "tool",
				label: "Harness version coherence",
				status: "skip",
				message: coherence.message,
			};
		}
		return {
			id: "tool:harness-version-coherence",
			category: "tool",
			label: "Harness version coherence",
			status: "ok",
			message: coherence.message,
		};
	},

	// ── Tool: git ─────────────────────────────────────────────────────────────
	(_dir) => {
		const version = getCommandVersion("git");
		if (!version) {
			return {
				id: "tool:git",
				category: "tool",
				label: "git",
				status: "fail",
				message: "git not found in PATH",
				fix: "Install git via Homebrew: brew install git",
			};
		}
		return {
			id: "tool:git",
			category: "tool",
			label: "git",
			status: "ok",
			message: version,
		};
	},

	// ── Tool: gh (GitHub CLI) ─────────────────────────────────────────────────
	(_dir) => {
		const exists = commandExists("gh");
		if (!exists) {
			return {
				id: "tool:gh",
				category: "tool",
				label: "GitHub CLI (gh)",
				status: "warn",
				message: "gh not found — required for branch-protect and PR workflows",
				fix: "brew install gh && gh auth login",
			};
		}
		// Check auth status
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
