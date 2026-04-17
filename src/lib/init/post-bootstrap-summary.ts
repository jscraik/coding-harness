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

function normalizeRepoPath(filePath: string): string {
	return filePath.split("\\").join("/").replace(/^\.\//, "");
}

function matchesPattern(filePath: string, pattern: string): boolean {
	const normalizedPath = normalizeRepoPath(filePath);
	const normalizedPattern = normalizeRepoPath(pattern);
	if (normalizedPattern.endsWith("/")) {
		return normalizedPath.startsWith(normalizedPattern);
	}
	return normalizedPath === normalizedPattern;
}

function describeFile(path: string): string {
	for (const [pattern, label] of Object.entries(FILE_CATEGORIES)) {
		if (matchesPattern(path, pattern)) return label;
	}
	return path;
}

function mapUniqueLabels(paths: string[]): string[] {
	const labels: string[] = [];
	const seen = new Set<string>();
	for (const path of paths) {
		const label = describeFile(path);
		if (seen.has(label)) continue;
		seen.add(label);
		labels.push(label);
	}
	return labels;
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

	const created = mapUniqueLabels(output.created);
	const protectedFiles = mapUniqueLabels(output.skipped);

	const nextCommands: string[] = [];

	// Always recommend health check
	nextCommands.push("harness check  — quick health snapshot");

	// Recommend contract validation if contract was created
	if (
		output.created.some((path) => matchesPattern(path, "harness.contract.json"))
	) {
		nextCommands.push(
			"harness contract validate  — validate the scaffolded contract",
		);
	}

	// Recommend branch protection if CI files were created
	if (
		output.created.some(
			(p) =>
				matchesPattern(p, ".github/workflows/") ||
				matchesPattern(p, ".circleci/"),
		)
	) {
		nextCommands.push(
			"harness branch-protect --owner <owner> --repo <repo> --token $GITHUB_TOKEN  — sync required checks to GitHub",
		);
	}

	// Recommend docs-gate if governance docs were created
	if (
		output.created.some(
			(p) =>
				matchesPattern(p, "AGENTS.md") ||
				matchesPattern(p, "CONTRIBUTING.md") ||
				matchesPattern(p, "docs/"),
		)
	) {
		nextCommands.push(
			"harness docs-gate --mode advisory  — check governance doc parity",
		);
	}

	// Recommend index-context for fresh bootstrap scaffolds, not arbitrary churn.
	const hasBootstrapArtifacts = output.created.some(
		(path) =>
			matchesPattern(path, "harness.contract.json") ||
			matchesPattern(path, "WORKFLOW.md") ||
			matchesPattern(path, "AGENTS.md") ||
			matchesPattern(path, "CONTRIBUTING.md") ||
			matchesPattern(path, "docs/") ||
			matchesPattern(path, ".github/workflows/"),
	);
	if (hasBootstrapArtifacts && output.created.length > 3) {
		nextCommands.push(
			"harness index-context --json --lexical-fallback  — index for semantic search",
		);
	}

	return {
		detected,
		created,
		protected: protectedFiles,
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
