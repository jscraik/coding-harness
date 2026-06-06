import semver from "semver";
import { detectHarnessVersionCoherence } from "../lib/version-coherence.js";
import { commandExists, getCommandVersion } from "./doctor-check-utils.js";
import type { DoctorCheckFn } from "./doctor-checks.js";
import { DOCTOR_GITHUB_TOOL_CHECKS } from "./doctor-github-tool-checks.js";

const REQUIRED_NODE_VERSION = "26.3.0";

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
				fix: `Install Node.js >= ${REQUIRED_NODE_VERSION} via mise: mise install node@${REQUIRED_NODE_VERSION}`,
			};
		}
		if (!semver.satisfies(version, `>=${REQUIRED_NODE_VERSION}`)) {
			return {
				id: "tool:node",
				category: "tool",
				label: "Node.js",
				status: "fail",
				message: `Node ${version} found — harness requires v${REQUIRED_NODE_VERSION}+`,
				fix: `Upgrade via mise: mise install node@${REQUIRED_NODE_VERSION} && mise use node@${REQUIRED_NODE_VERSION}`,
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
				fix: "Install git using your system package manager and verify with: git --version",
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

	...DOCTOR_GITHUB_TOOL_CHECKS,
];
