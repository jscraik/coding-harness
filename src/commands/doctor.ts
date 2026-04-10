/**
 * harness doctor — JSC-65
 *
 * Static prerequisite checker. Validates that all files, tools, and
 * configuration the harness gates depend on are present and structurally
 * sound — before running any gate. This surfaces the class of discovery
 * bugs described in JSC-65: requirements that were only found by running
 * a gate, getting a failure, and reverse-engineering the requirement.
 *
 * Exit codes:
 *   0 — all prerequisites satisfied (or only advisory warnings)
 *   1 — one or more prerequisites are missing / misconfigured
 *
 * Usage:
 *   harness doctor [--dir <path>] [--json] [--fix]
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
	findCircleCIJobNamedCheckNames,
	normalizeRequiredChecksManifest,
} from "../lib/policy/required-checks.js";
import { detectHarnessVersionCoherence } from "../lib/version-coherence.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export interface DoctorCheck {
	/** Unique check ID */
	id: string;
	/** Category: 'tool' | 'file' | 'config' | 'ci' */
	category: "tool" | "file" | "config" | "ci";
	/** Human-readable label */
	label: string;
	/** Status after evaluation */
	status: CheckStatus;
	/** Details message explaining the status */
	message: string;
	/**
	 * Actionable fix command or instruction shown when status is fail/warn.
	 * Implements the JSC-68 pattern (fix guidance on findings).
	 */
	fix?: string;
}

export interface DoctorReport {
	version: string;
	dir: string;
	timestamp: string;
	checks: DoctorCheck[];
	counts: { ok: number; warn: number; fail: number; skip: number };
	/** true if any check is 'fail' */
	hasFailures: boolean;
	/** Post-init manual step checklist (shown when installing) */
	postInitChecklist?: string[];
}

export interface DoctorOptions {
	dir?: string;
	json?: boolean;
	/** If true, attempt auto-fix where possible (e.g. seeding files) */
	fix?: boolean;
}

// ─── Tool checks ─────────────────────────────────────────────────────────────

function commandExists(cmd: string): boolean {
	const lookupCommand = process.platform === "win32" ? "where" : "which";
	const result = spawnSync(lookupCommand, [cmd], {
		stdio: "pipe",
		encoding: "utf-8",
	});
	return result.status === 0;
}

function getCommandVersion(
	cmd: string,
	versionArg = "--version",
): string | null {
	const result = spawnSync(cmd, [versionArg], {
		stdio: "pipe",
		encoding: "utf-8",
		timeout: 5000,
	});
	if (result.status !== 0) return null;
	return (result.stdout ?? "").trim().split("\n")[0] ?? null;
}

// ─── File / config checks ─────────────────────────────────────────────────────

function readJsonFile(path: string): unknown | null {
	try {
		const content = readFileSync(path, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}

/**
 * Checks whether a nested path of own properties exists on a value.
 *
 * Traverses `obj` following each `key` in order and returns whether each intermediate
 * value is a non-null object that has the next key as its own property.
 *
 * @param obj - The value to inspect for the key path
 * @param keys - Sequence of property names representing the nested path to check
 * @returns `true` if every property in `keys` exists as an own property along the path, `false` otherwise
 */
function hasJsonKey(obj: unknown, ...keys: string[]): boolean {
	let cursor: unknown = obj;
	for (const key of keys) {
		if (
			typeof cursor !== "object" ||
			cursor === null ||
			!Object.hasOwn(cursor, key)
		) {
			return false;
		}
		cursor = (cursor as Record<string, unknown>)[key];
	}
	return true;
}

// ─── Check catalogue ─────────────────────────────────────────────────────────

type CheckFn = (dir: string) => DoctorCheck;

const CHECKS: CheckFn[] = [
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
				status: "warn",
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
		return {
			id: "tool:pnpm",
			category: "tool",
			label: "pnpm",
			status: "ok",
			message: version ?? "found",
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

	// ── File: harness.contract.json ───────────────────────────────────────────
	(dir) => {
		const contractPath = resolve(dir, "harness.contract.json");
		if (!existsSync(contractPath)) {
			return {
				id: "file:harness.contract.json",
				category: "file",
				label: "harness.contract.json",
				status: "fail",
				message:
					"missing — required by drift-gate, context-health, gardener, ci-migrate, docs-gate, plan-gate",
				fix: "harness init --update (or harness init for a new project)",
			};
		}
		const contract = readJsonFile(contractPath);
		if (!contract) {
			return {
				id: "file:harness.contract.json",
				category: "file",
				label: "harness.contract.json",
				status: "fail",
				message: "exists but is not valid JSON",
				fix: "Validate with: node -e \"JSON.parse(require('fs').readFileSync('harness.contract.json','utf8'))\"",
			};
		}
		return {
			id: "file:harness.contract.json",
			category: "file",
			label: "harness.contract.json",
			status: "ok",
			message: "present and valid JSON",
		};
	},

	// ── File: memory.json ─────────────────────────────────────────────────────
	(dir) => {
		const memPath = resolve(dir, "memory.json");
		if (!existsSync(memPath)) {
			return {
				id: "file:memory.json",
				category: "file",
				label: "memory.json",
				status: "warn",
				message: "missing — required by memory-gate (optional for other gates)",
				fix: "harness init --update  (creates memory.json with initial state)",
			};
		}
		const mem = readJsonFile(memPath);
		if (!mem) {
			return {
				id: "file:memory.json",
				category: "file",
				label: "memory.json",
				status: "fail",
				message: "exists but is not valid JSON",
				fix: "Check memory.json for syntax errors",
			};
		}
		// Check closeout structure — the JSC-65 pain point
		const hasCloseout = hasJsonKey(mem, "closeout");
		const hasForjamieFlag = hasJsonKey(mem, "closeout", "forjamie_updated");
		if (!hasCloseout) {
			return {
				id: "file:memory.json",
				category: "file",
				label: "memory.json",
				status: "warn",
				message: "missing 'closeout' key — memory-gate will fail until set",
				fix: 'Add: {"closeout": {"date": "<iso-date>", "forjamie_updated": true}} to memory.json',
			};
		}
		if (!hasForjamieFlag) {
			return {
				id: "file:memory.json",
				category: "file",
				label: "memory.json",
				status: "warn",
				message:
					"memory.json.closeout.forjamie_updated is missing (memory-gate requires this flag)",
				fix: "Set memory.json → closeout.forjamie_updated to true after each session",
			};
		}
		return {
			id: "file:memory.json",
			category: "file",
			label: "memory.json",
			status: "ok",
			message: "present, valid, closeout structure looks good",
		};
	},

	// ── File: drift-gate baseline ─────────────────────────────────────────────
	(dir) => {
		const baselinePath = resolve(
			dir,
			"artifacts/consistency-gate/consistency-baseline-latest.json",
		);
		if (!existsSync(baselinePath)) {
			return {
				id: "file:consistency-baseline",
				category: "file",
				label: "drift-gate baseline",
				status: "warn",
				message:
					"artifacts/consistency-gate/consistency-baseline-latest.json missing — drift-gate will warn on first run",
				fix: "harness drift-gate --contract harness.contract.json --seed-baseline",
			};
		}
		const baseline = readJsonFile(baselinePath);
		if (!baseline) {
			return {
				id: "file:consistency-baseline",
				category: "file",
				label: "drift-gate baseline",
				status: "warn",
				message: "baseline file exists but is not valid JSON",
				fix: "Re-seed: harness drift-gate --contract harness.contract.json --seed-baseline",
			};
		}
		// Check the baseline is not empty
		if (
			typeof baseline === "object" &&
			baseline !== null &&
			Object.keys(baseline).length === 0
		) {
			return {
				id: "file:consistency-baseline",
				category: "file",
				label: "drift-gate baseline",
				status: "warn",
				message: "baseline file is empty — re-seed recommended",
				fix: "harness drift-gate --contract harness.contract.json --seed-baseline",
			};
		}
		// Check file is not stale (>30 days)
		try {
			const stat = statSync(baselinePath);
			const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
			if (ageDays > 30) {
				return {
					id: "file:consistency-baseline",
					category: "file",
					label: "drift-gate baseline",
					status: "warn",
					message: `baseline is ${Math.floor(ageDays)} days old — consider refreshing`,
					fix: "harness drift-gate --contract harness.contract.json --seed-baseline",
				};
			}
		} catch {
			// ignore stat errors
		}
		return {
			id: "file:consistency-baseline",
			category: "file",
			label: "drift-gate baseline",
			status: "ok",
			message: "present and valid",
		};
	},

	// ── File: agent-first-status.md ───────────────────────────────────────────
	(dir) => {
		const statusPath = resolve(dir, "docs/roadmap/agent-first-status.md");
		if (!existsSync(statusPath)) {
			return {
				id: "file:agent-first-status",
				category: "file",
				label: "docs/roadmap/agent-first-status.md",
				status: "warn",
				message: "missing — drift-gate will warn if this file is absent",
				fix: "harness init --update  (seeds this file with a template)",
			};
		}
		return {
			id: "file:agent-first-status",
			category: "file",
			label: "docs/roadmap/agent-first-status.md",
			status: "ok",
			message: "present",
		};
	},

	// ── Config: contextIntegrityPolicy in contract ────────────────────────────
	(dir) => {
		const contractPath = resolve(dir, "harness.contract.json");
		if (!existsSync(contractPath)) {
			return {
				id: "config:contextIntegrityPolicy",
				category: "config",
				label: "contract: contextIntegrityPolicy",
				status: "skip",
				message: "skipped — harness.contract.json not found",
			};
		}
		const contract = readJsonFile(contractPath);
		if (!hasJsonKey(contract, "contextIntegrityPolicy")) {
			return {
				id: "config:contextIntegrityPolicy",
				category: "config",
				label: "contract: contextIntegrityPolicy",
				status: "warn",
				message:
					"contextIntegrityPolicy missing from harness.contract.json — context-health will fail",
				fix: "Add contextIntegrityPolicy section to harness.contract.json (see docs/agents/00-architecture-bootstrap.md)",
			};
		}
		return {
			id: "config:contextIntegrityPolicy",
			category: "config",
			label: "contract: contextIntegrityPolicy",
			status: "ok",
			message: "present",
		};
	},

	// ── Config: ciProviderPolicy in contract ──────────────────────────────────
	(dir) => {
		const contractPath = resolve(dir, "harness.contract.json");
		if (!existsSync(contractPath)) {
			return {
				id: "config:ciProviderPolicy",
				category: "config",
				label: "contract: ciProviderPolicy",
				status: "skip",
				message: "skipped — harness.contract.json not found",
			};
		}
		const contract = readJsonFile(contractPath);
		if (!hasJsonKey(contract, "ciProviderPolicy")) {
			return {
				id: "config:ciProviderPolicy",
				category: "config",
				label: "contract: ciProviderPolicy",
				status: "warn",
				message: "ciProviderPolicy missing — ci-migrate verify will fail",
				fix: "Run: harness ci-migrate init  to generate the policy block",
			};
		}
		return {
			id: "config:ciProviderPolicy",
			category: "config",
			label: "contract: ciProviderPolicy",
			status: "ok",
			message: "present",
		};
	},

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

// ─── Post-init checklist ──────────────────────────────────────────────────────

const POST_INIT_CHECKLIST = [
	"Set up NPM auth for @brainwav private packages in CI (add NPM_TOKEN to CircleCI env vars)",
	"Add GH_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN to CircleCI project settings",
	"Seed drift-gate baseline: harness drift-gate --contract harness.contract.json --seed-baseline",
	"Update memory.json closeout at the end of each session: set closeout.forjamie_updated = true",
	"Review docs/roadmap/agent-first-status.md and fill in your current agent rollout state",
];

// ─── Reporting ────────────────────────────────────────────────────────────────

const STATUS_ICONS: Record<CheckStatus, string> = {
	ok: "✅",
	warn: "⚠️ ",
	fail: "❌",
	skip: "⏭️ ",
};

function renderReport(report: DoctorReport): string {
	const lines: string[] = [];

	lines.push(`\nHarness Doctor — ${report.dir}`);
	lines.push(`Checked at ${new Date(report.timestamp).toLocaleString()}\n`);

	// Group by category
	const categories: Array<["tool" | "file" | "config" | "ci", string]> = [
		["tool", "Tools"],
		["file", "Required Files"],
		["config", "Contract Configuration"],
		["ci", "CI Setup"],
	];

	for (const [cat, catLabel] of categories) {
		const catChecks = report.checks.filter((c) => c.category === cat);
		if (catChecks.length === 0) continue;

		lines.push(`  ${catLabel}`);
		const labelWidth = Math.max(...catChecks.map((c) => c.label.length)) + 2;
		for (const check of catChecks) {
			const icon = STATUS_ICONS[check.status];
			const label = check.label.padEnd(labelWidth);
			lines.push(`    ${icon}  ${label}${check.message}`);
			if (check.fix && check.status !== "ok" && check.status !== "skip") {
				lines.push(`         Fix: ${check.fix}`);
			}
		}
		lines.push("");
	}

	const { ok, warn, fail, skip } = report.counts;
	const total = ok + warn + fail;
	const skippedNote = skip > 0 ? `, ${skip} skipped` : "";
	lines.push(
		`  Results: ${ok}/${total} ok, ${warn} warning${warn !== 1 ? "s" : ""}, ${fail} failure${fail !== 1 ? "s" : ""}${skippedNote}`,
	);

	if (report.hasFailures) {
		lines.push(
			"  ❌ Prerequisites not satisfied — fix failures above before running gates\n",
		);
	} else if (warn > 0) {
		lines.push(
			"  ⚠️  Some prerequisites need attention — gates may produce warnings\n",
		);
	} else {
		lines.push("  ✅ All prerequisites satisfied\n");
	}

	return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * JSC-65: Check all harness gate prerequisites and return a doctor report.
 */
export function runDoctor(options: DoctorOptions = {}): DoctorReport {
	const dir = resolve(options.dir ?? process.cwd());

	const checks = CHECKS.map((fn) => fn(dir));

	const counts = { ok: 0, warn: 0, fail: 0, skip: 0 };
	for (const check of checks) {
		counts[check.status]++;
	}

	const hasFailures = counts.fail > 0;

	return {
		version: "unknown",
		dir,
		timestamp: new Date().toISOString(),
		checks,
		counts,
		hasFailures,
		postInitChecklist: POST_INIT_CHECKLIST,
	};
}

/**
 * CLI entry point for `harness doctor`.
 * Returns exit code: 0 = all ok/warn, 1 = failures present.
 */
export function runDoctorCLI(args: string[], getVersion: () => string): number {
	if (args.includes("--help") || args.includes("-h")) {
		return 0;
	}

	const jsonFlag = args.includes("--json");
	const checklistFlag = args.includes("--checklist");
	const dirIndex = args.indexOf("--dir");
	const dir = dirIndex >= 0 ? args[dirIndex + 1] : undefined;

	const opts: DoctorOptions = {};
	if (dir) opts.dir = dir;

	const report = runDoctor(opts);
	report.version = getVersion();

	if (checklistFlag) {
		// checklist display removed; future: render POST_INIT_CHECKLIST here
		return 0;
	}

	if (jsonFlag) {
		console.info(JSON.stringify(report));
	} else {
		process.stdout.write(renderReport(report));
	}

	return report.hasFailures ? 1 : 0;
}
