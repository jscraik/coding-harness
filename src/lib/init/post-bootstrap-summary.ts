/**
 * Post-bootstrap summary for init command (JSC-126).
 *
 * Generates a human-readable summary that shows what was found,
 * what was created or protected, and recommended next commands.
 * A new user can see concrete value from `init` without reading deeper docs.
 *
 * @module lib/init/post-bootstrap-summary
 */

import type { InitOutput } from "./types.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BootstrapSummary {
	/** What was detected about the repo */
	detected: DetectionSection;
	/** What was created */
	created: string[];
	/** What was protected (existed, kept safe) */
	protected: string[];
	/** Recommended next commands */
	nextCommands: string[];
}

export interface DetectionSection {
	projectType: string;
	confidence: string;
	packageManager: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FILE_CATEGORIES: Record<string, string> = {
	"harness.contract.json": "Governance contract",
	"WORKFLOW.md": "Workflow documentation",
	"AGENTS.md": "Agent instructions",
	"CLAUDE.md": "Claude-specific instructions",
	"CONTRIBUTING.md": "Contributor guide",
	".github/workflows/ci.yml": "CI pipeline",
	".github/workflows/ci-fallback.yml": "CI fallback pipeline",
	".github/workflows/secret-scan.yml": "Secret scanning",
	".github/ISSUE_TEMPLATE/": "Issue templates",
	".codex/environments/environment.toml": "Codex environment",
	".mise.toml": "Tool version management",
	Makefile: "Build targets",
	".pre-commit-config.yaml": "Pre-commit hooks",
	".harness/": "Harness data directory",
};

function describeFile(path: string): string {
	for (const [pattern, label] of Object.entries(FILE_CATEGORIES)) {
		if (path.includes(pattern)) return label;
	}
	return path;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a structured bootstrap summary from init output.
 */
export function generateBootstrapSummary(
	output: InitOutput,
	packageManager: string,
): BootstrapSummary {
	const detection = output.projectTypeDetection;
	const detected: DetectionSection = {
		projectType: detection?.projectType ?? "unknown",
		confidence: detection?.confidence ?? "none",
		packageManager,
	};

	const created = output.created.map(describeFile);
	const protected_ = output.skipped.map(describeFile);

	const nextCommands: string[] = [];

	// Always recommend health check
	nextCommands.push("harness check  — quick health snapshot");

	// Recommend contract validation if contract was created
	if (output.created.includes("harness.contract.json")) {
		nextCommands.push(
			"harness contract validate  — validate the scaffolded contract",
		);
	}

	// Recommend branch protection if CI files were created
	if (
		output.created.some(
			(p) => p.includes("workflows/") || p.includes(".circleci/"),
		)
	) {
		nextCommands.push(
			"harness branch-protect  — sync required checks to GitHub",
		);
	}

	// Recommend docs-gate if governance docs were created
	if (
		output.created.some(
			(p) =>
				p.includes("AGENTS.md") ||
				p.includes("CONTRIBUTING.md") ||
				p.includes("docs/"),
		)
	) {
		nextCommands.push(
			"harness docs-gate --mode advisory  — check governance doc parity",
		);
	}

	// Recommend index-context if new install
	if (output.created.length > 3) {
		nextCommands.push(
			"harness index-context --json  — index for semantic search",
		);
	}

	return {
		detected,
		created,
		protected: protected_,
		nextCommands,
	};
}

/**
 * Format the bootstrap summary for human-readable CLI output.
 */
export function formatBootstrapSummary(summary: BootstrapSummary): string {
	const lines: string[] = [];

	// Detection section
	lines.push("── What we found ──");
	lines.push(
		`  Project type: ${summary.detected.projectType} (confidence: ${summary.detected.confidence})`,
	);
	lines.push(`  Package manager: ${summary.detected.packageManager}`);

	// Created section
	if (summary.created.length > 0) {
		lines.push("");
		lines.push("── What we created ──");
		for (const item of summary.created) {
			lines.push(`  ✓ ${item}`);
		}
	}

	// Protected section
	if (summary.protected.length > 0) {
		lines.push("");
		lines.push("── What we protected (already exists) ──");
		for (const item of summary.protected) {
			lines.push(`  🔒 ${item}`);
		}
	}

	// Next commands
	if (summary.nextCommands.length > 0) {
		lines.push("");
		lines.push("── Recommended next commands ──");
		for (const cmd of summary.nextCommands) {
			lines.push(`  → ${cmd}`);
		}
	}

	return lines.join("\n");
}
