/**
 * harness audit — JSC-158
 *
 * Comprehensive governance state check. Checks all critical files,
 * CI config, review tools, and governance gates. Produces a unified
 * report with actionable recommendations.
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — warnings present
 *   2 — errors / critical missing
 *
 * Usage:
 *   harness audit [--dir <path>] [--json]
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// ─── Exit codes ──────────────────────────────────────────────────────────────

export const EXIT_CODES = {
	SUCCESS: 0,
	WARNINGS: 1,
	ERRORS: 2,
	NOT_FOUND: 3,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuditSeverity = "ok" | "warning" | "error" | "missing";

export interface AuditFinding {
	/** Category: core, ci, review, governance, brain */
	category: string;
	/** What was checked */
	check: string;
	/** Result severity */
	severity: AuditSeverity;
	/** Human-readable description */
	message: string;
	/** Optional remediation command or action */
	remediation?: string | undefined;
}

export interface AuditResult {
	/** Target directory */
	dir: string;
	/** ISO timestamp */
	timestamp: string;
	/** Version string */
	version: string;
	findings: AuditFinding[];
	summary: {
		ok: number;
		warnings: number;
		errors: number;
		missing: number;
		total: number;
	};
	recommendations: string[];
}

// ─── Checkers ────────────────────────────────────────────────────────────────

function checkCoreFiles(dir: string, findings: AuditFinding[]): void {
	// harness.contract.json
	const contractPath = join(dir, "harness.contract.json");
	if (existsSync(contractPath)) {
		try {
			const raw = readFileSync(contractPath, "utf-8");
			JSON.parse(raw);
			findings.push({
				category: "core",
				check: "harness.contract.json",
				severity: "ok",
				message: "Contract file present and valid JSON",
			});
		} catch {
			findings.push({
				category: "core",
				check: "harness.contract.json",
				severity: "error",
				message: "Contract file exists but is not valid JSON",
				remediation: "Run `harness contract validate` to diagnose",
			});
		}
	} else {
		findings.push({
			category: "core",
			check: "harness.contract.json",
			severity: "missing",
			message: "Contract file not found",
			remediation: "Run `harness init --track` to create contract",
		});
	}

	// package.json scripts
	const pkgPath = join(dir, "package.json");
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			const scripts = pkg.scripts ?? {};
			const requiredScripts = ["check", "lint", "test"];
			const missing = requiredScripts.filter((s) => !scripts[s]);
			if (missing.length === 0) {
				findings.push({
					category: "core",
					check: "package.json scripts",
					severity: "ok",
					message: "Required scripts present (check, lint, test)",
				});
			} else {
				findings.push({
					category: "core",
					check: "package.json scripts",
					severity: "warning",
					message: `Missing scripts: ${missing.join(", ")}`,
					remediation: "Add the missing scripts to package.json",
				});
			}
		} catch {
			findings.push({
				category: "core",
				check: "package.json",
				severity: "warning",
				message: "package.json exists but is not valid JSON",
			});
		}
	}

	// Biome config
	const biomeCandidates = ["biome.json", "biome.jsonc"];
	const biomeFound = biomeCandidates.some((c) => existsSync(join(dir, c)));
	if (biomeFound) {
		findings.push({
			category: "core",
			check: "biome config",
			severity: "ok",
			message: "Biome configuration found",
		});
	} else {
		findings.push({
			category: "core",
			check: "biome config",
			severity: "warning",
			message: "No biome.json or biome.jsonc found",
			remediation: "Run `harness init` to scaffold biome config",
		});
	}
}

function checkCIConfig(dir: string, findings: AuditFinding[]): void {
	// CircleCI
	const circleciPath = join(dir, ".circleci", "config.yml");
	if (existsSync(circleciPath)) {
		findings.push({
			category: "ci",
			check: "CircleCI config",
			severity: "ok",
			message: ".circleci/config.yml present",
		});
	} else {
		findings.push({
			category: "ci",
			check: "CircleCI config",
			severity: "missing",
			message: "No .circleci/config.yml found",
			remediation: "Run `harness ci-migrate prepare` to set up CircleCI",
		});
	}

	// CI required checks manifest
	const checksPath = join(dir, ".harness", "ci-required-checks.json");
	if (existsSync(checksPath)) {
		try {
			const checks = JSON.parse(readFileSync(checksPath, "utf-8"));
			const count = Array.isArray(checks)
				? checks.length
				: Object.keys(checks).length;
			findings.push({
				category: "ci",
				check: "CI required checks manifest",
				severity: "ok",
				message: `ci-required-checks.json present (${count} check${count !== 1 ? "s" : ""})`,
			});
		} catch {
			findings.push({
				category: "ci",
				check: "CI required checks manifest",
				severity: "warning",
				message: "ci-required-checks.json exists but is not valid JSON",
			});
		}
	} else {
		findings.push({
			category: "ci",
			check: "CI required checks manifest",
			severity: "warning",
			message: "No .harness/ci-required-checks.json found",
			remediation: "Run `harness ci-migrate prepare` to generate",
		});
	}

	// GitHub Actions (legacy check)
	const ghaDir = join(dir, ".github", "workflows");
	if (existsSync(ghaDir)) {
		const workflows = readdirSync(ghaDir).filter(
			(f) => f.endsWith(".yml") || f.endsWith(".yaml"),
		);
		if (workflows.length > 0 && existsSync(circleciPath)) {
			findings.push({
				category: "ci",
				check: "GitHub Actions workflows",
				severity: "warning",
				message: `${workflows.length} GitHub Actions workflow(s) still present alongside CircleCI`,
				remediation: "Remove after CircleCI validation period",
			});
		} else if (workflows.length > 0) {
			findings.push({
				category: "ci",
				check: "GitHub Actions workflows",
				severity: "ok",
				message: `${workflows.length} GitHub Actions workflow(s) present`,
			});
		}
	}
}

function checkReviewTools(dir: string, findings: AuditFinding[]): void {
	// CodeRabbit
	if (existsSync(join(dir, ".coderabbit.yaml"))) {
		findings.push({
			category: "review",
			check: "CodeRabbit config",
			severity: "ok",
			message: ".coderabbit.yaml present",
		});
	} else {
		findings.push({
			category: "review",
			check: "CodeRabbit config",
			severity: "warning",
			message: "No .coderabbit.yaml found",
			remediation: "Run `harness verify-coderabbit` to configure",
		});
	}

	// Greptile (should be ejected)
	if (existsSync(join(dir, ".greptile"))) {
		findings.push({
			category: "review",
			check: "Greptile remnants",
			severity: "warning",
			message: ".greptile directory still present (should be ejected)",
			remediation: "Run `harness eject` to remove",
		});
	} else {
		findings.push({
			category: "review",
			check: "Greptile remnants",
			severity: "ok",
			message: "No Greptile remnants found",
		});
	}
}

function checkGovernance(dir: string, findings: AuditFinding[]): void {
	// Git hooks
	const hooksDir = join(dir, ".git", "hooks");
	if (existsSync(hooksDir)) {
		const prePush = existsSync(join(hooksDir, "pre-push"));
		const commitMsg = existsSync(join(hooksDir, "commit-msg"));
		if (prePush && commitMsg) {
			findings.push({
				category: "governance",
				check: "Git hooks",
				severity: "ok",
				message: "pre-push and commit-msg hooks installed",
			});
		} else {
			const missing = [];
			if (!prePush) missing.push("pre-push");
			if (!commitMsg) missing.push("commit-msg");
			findings.push({
				category: "governance",
				check: "Git hooks",
				severity: "warning",
				message: `Missing hooks: ${missing.join(", ")}`,
				remediation: "Run `harness init` or setup-git-hooks",
			});
		}
	}

	// CONTRIBUTING.md
	if (existsSync(join(dir, "CONTRIBUTING.md"))) {
		findings.push({
			category: "governance",
			check: "CONTRIBUTING.md",
			severity: "ok",
			message: "Contributing guide present",
		});
	} else {
		findings.push({
			category: "governance",
			check: "CONTRIBUTING.md",
			severity: "warning",
			message: "No CONTRIBUTING.md found",
			remediation: "Run `harness init` to scaffold",
		});
	}
}

function checkProjectBrain(dir: string, findings: AuditFinding[]): void {
	const harnessDir = join(dir, ".harness");
	if (!existsSync(harnessDir)) {
		findings.push({
			category: "brain",
			check: "Project Brain",
			severity: "missing",
			message: "No .harness directory found",
			remediation: "Run `harness init` to bootstrap Project Brain",
		});
		return;
	}

	// Knowledge index
	const indexPath = join(harnessDir, "knowledge", "INDEX.md");
	if (existsSync(indexPath)) {
		findings.push({
			category: "brain",
			check: "Knowledge index",
			severity: "ok",
			message: "Knowledge INDEX.md present",
		});
	} else {
		findings.push({
			category: "brain",
			check: "Knowledge index",
			severity: "warning",
			message: "No knowledge/INDEX.md found",
			remediation: "Run `harness brain status` for details",
		});
	}

	// Quality criteria
	const qualityPath = join(harnessDir, "quality", "criteria.md");
	if (existsSync(qualityPath)) {
		const content = readFileSync(qualityPath, "utf-8");
		const hasCriteria = content.includes("Q-") || content.includes("Gate");
		findings.push({
			category: "brain",
			check: "Quality criteria",
			severity: hasCriteria ? "ok" : "warning",
			message: hasCriteria
				? "Quality criteria present"
				: "Quality criteria file exists but has no entries",
			remediation: hasCriteria
				? undefined
				: "Run `harness brain add --type rule` to add criteria",
		});
	} else {
		findings.push({
			category: "brain",
			check: "Quality criteria",
			severity: "warning",
			message: "No quality/criteria.md found",
		});
	}

	// Review log
	const reviewLogPath = join(harnessDir, "review-log.md");
	if (existsSync(reviewLogPath)) {
		findings.push({
			category: "brain",
			check: "Review log",
			severity: "ok",
			message: "Review log present",
		});
	} else {
		findings.push({
			category: "brain",
			check: "Review log",
			severity: "warning",
			message: "No review-log.md found",
		});
	}
}

// ─── Main audit ──────────────────────────────────────────────────────────────

export function runAudit(dir: string): AuditResult {
	const findings: AuditFinding[] = [];
	const recommendations: string[] = [];

	checkCoreFiles(dir, findings);
	checkCIConfig(dir, findings);
	checkReviewTools(dir, findings);
	checkGovernance(dir, findings);
	checkProjectBrain(dir, findings);

	// Generate recommendations from findings
	for (const f of findings) {
		if (
			f.remediation &&
			(f.severity === "warning" ||
				f.severity === "error" ||
				f.severity === "missing")
		) {
			recommendations.push(f.remediation);
		}
	}

	const summary = {
		ok: findings.filter((f) => f.severity === "ok").length,
		warnings: findings.filter((f) => f.severity === "warning").length,
		errors: findings.filter((f) => f.severity === "error").length,
		missing: findings.filter((f) => f.severity === "missing").length,
		total: findings.length,
	};

	return {
		dir,
		timestamp: new Date().toISOString(),
		version: "unknown",
		findings,
		summary,
		recommendations,
	};
}

// ─── Rendering ───────────────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<AuditSeverity, string> = {
	ok: "✓",
	warning: "⚠️ ",
	error: "✗",
	missing: "✗",
};

function renderAuditHuman(result: AuditResult): string {
	const lines: string[] = [];

	lines.push("");
	lines.push("=== Harness Governance Audit ===");
	lines.push(`  Directory: ${result.dir}`);
	lines.push(`  Checked at ${new Date(result.timestamp).toLocaleString()}`);
	lines.push("");

	// Group by category
	const categories = new Map<string, AuditFinding[]>();
	for (const f of result.findings) {
		const existing = categories.get(f.category);
		if (existing) {
			existing.push(f);
		} else {
			categories.set(f.category, [f]);
		}
	}

	const categoryLabels: Record<string, string> = {
		core: "Core Files",
		ci: "CI/CD",
		review: "Review Tools",
		governance: "Governance",
		brain: "Project Brain",
	};

	for (const [cat, items] of categories) {
		const label = categoryLabels[cat] ?? cat;
		lines.push(`  ## ${label}`);
		for (const f of items) {
			const icon = SEVERITY_ICONS[f.severity];
			lines.push(`  ${icon}  ${f.check}: ${f.message}`);
			if (f.remediation && f.severity !== "ok") {
				lines.push(`       → ${f.remediation}`);
			}
		}
		lines.push("");
	}

	// Summary
	const { ok, warnings, errors, missing, total } = result.summary;
	lines.push(
		`  Summary: ${ok}/${total} ok, ${warnings} warning${warnings !== 1 ? "s" : ""}, ${errors + missing} issue${errors + missing !== 1 ? "s" : ""}`,
	);

	if (result.recommendations.length > 0) {
		lines.push("");
		lines.push("  Recommendations:");
		for (let i = 0; i < result.recommendations.length; i++) {
			lines.push(`    ${i + 1}. ${result.recommendations[i]}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

export function runAuditCLI(args: string[], getVersion: () => string): number {
	const dirArg = args.indexOf("--dir");
	const dir = dirArg >= 0 ? resolve(args[dirArg + 1] ?? ".") : process.cwd();
	const jsonFlag = args.includes("--json");

	if (args.includes("--help") || args.includes("-h")) {
		process.stdout.write(`Usage: harness audit [options]

Options:
  --dir <path>   Target directory (default: current directory)
  --json         Output in JSON format
  --help, -h     Show this help

Examples:
  harness audit
  harness audit --json
  harness audit --dir /path/to/repo
`);
		return EXIT_CODES.SUCCESS;
	}

	const result = runAudit(dir);
	result.version = getVersion();

	if (jsonFlag) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderAuditHuman(result));
	}

	if (result.summary.errors > 0 || result.summary.missing > 0)
		return EXIT_CODES.ERRORS;
	if (result.summary.warnings > 0) return EXIT_CODES.WARNINGS;
	return EXIT_CODES.SUCCESS;
}
