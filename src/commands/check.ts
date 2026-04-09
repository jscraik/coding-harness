/**
 * JSC-127: `harness check` — zero-config repo health snapshot.
 *
 * Runs a safe, read-only bundle of validations and returns actionable
 * feedback on any repo, even before full harness setup. Designed as a
 * first-run entrypoint: a new user can run one command and know exactly
 * what to do next.
 *
 * Exit codes:
 *   0 — all checks pass (warnings are advisory)
 *   1 — one or more checks failed
 *
 * Usage:
 *   harness check [path] [--json]
 *   harness check ./my-repo --json
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { SCHEMA_VERSION } from "../lib/contract/json-schema.js";
import { validateContract } from "../lib/contract/validator.js";
import { HARNESS_DIR, MANIFEST_FILE } from "../lib/init/types.js";
import { detectHarnessVersionCoherence } from "../lib/version-coherence.js";
import { getVersion } from "../lib/version.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckStatus = "ok" | "warn" | "fail";

export interface CheckItem {
	id: string;
	label: string;
	status: CheckStatus;
	detail: string;
	/** Command to run to fix this finding. */
	fix?: string;
}

export interface CheckReport {
	version: string;
	dir: string;
	timestamp: string;
	checks: CheckItem[];
	counts: { ok: number; warn: number; fail: number };
	/** true when any check is "fail" */
	hasFailures: boolean;
	/** Ordered list of recommended next commands. */
	nextSteps: string[];
}

export interface CheckOptions {
	json?: boolean;
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkGitRepo(dir: string): CheckItem {
	const hasGit = existsSync(resolve(dir, ".git"));
	if (hasGit) {
		return {
			id: "git",
			label: "Git repository",
			status: "ok",
			detail: "Found .git — version control active",
		};
	}
	return {
		id: "git",
		label: "Git repository",
		status: "warn",
		detail: ".git not found — some harness features require version control",
		fix: "git init",
	};
}

function checkHarnessVersionCoherence(dir: string): CheckItem {
	const coherence = detectHarnessVersionCoherence(dir);
	if (coherence.status === "drift") {
		return {
			id: "harness:version-coherence",
			label: "Harness version coherence",
			status: "fail",
			detail: coherence.message,
			...(coherence.remediation ? { fix: coherence.remediation } : {}),
		};
	}

	if (coherence.status === "error") {
		return {
			id: "harness:version-coherence",
			label: "Harness version coherence",
			status: "warn",
			detail: coherence.message,
			...(coherence.remediation ? { fix: coherence.remediation } : {}),
		};
	}

	return {
		id: "harness:version-coherence",
		label: "Harness version coherence",
		status: "ok",
		detail: coherence.message,
	};
}

function checkContract(dir: string): CheckItem[] {
	const contractPath = resolve(dir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return [
			{
				id: "contract:present",
				label: "harness.contract.json",
				status: "fail",
				detail: "Contract file not found — harness not configured",
				fix: "harness contract init",
			},
		];
	}

	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(contractPath, "utf-8"));
	} catch {
		return [
			{
				id: "contract:present",
				label: "harness.contract.json",
				status: "fail",
				detail: "Contract file is not valid JSON",
				fix: "harness contract validate --json",
			},
		];
	}

	const sectionCount =
		typeof raw === "object" && raw !== null ? Object.keys(raw).length : 0;
	const result = validateContract(raw);

	if (!result.success) {
		const errorCount = result.errors.length;
		return [
			{
				id: "contract:present",
				label: "harness.contract.json",
				status: "ok",
				detail: `Found (${sectionCount} section${sectionCount === 1 ? "" : "s"}, schema v${SCHEMA_VERSION})`,
			},
			{
				id: "contract:valid",
				label: "Contract validity",
				status: "fail",
				detail: `${errorCount} validation error${errorCount === 1 ? "" : "s"} — run validate for details`,
				fix: "harness contract validate",
			},
		];
	}

	return [
		{
			id: "contract:present",
			label: "harness.contract.json",
			status: "ok",
			detail: `Found (${sectionCount} section${sectionCount === 1 ? "" : "s"}, schema v${SCHEMA_VERSION})`,
		},
		{
			id: "contract:valid",
			label: "Contract validity",
			status: "ok",
			detail: "Valid — all fields pass schema checks",
		},
	];
}

function checkManifest(dir: string): CheckItem {
	const manifestPath = resolve(dir, HARNESS_DIR, MANIFEST_FILE);
	if (!existsSync(manifestPath)) {
		return {
			id: "manifest",
			label: "Tracked install",
			status: "warn",
			detail:
				".harness/restore-manifest.json not found — not tracking scaffold",
			fix: "harness init --track",
		};
	}

	try {
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<
			string,
			unknown
		>;
		const version =
			typeof manifest.harnessVersion === "string"
				? manifest.harnessVersion
				: null;
		const currentVersion = getVersion();
		if (version && version !== currentVersion) {
			return {
				id: "manifest",
				label: "Tracked install",
				status: "warn",
				detail: `Installed v${version}, current v${currentVersion} — update available`,
				fix: "harness init --check-updates",
			};
		}
		return {
			id: "manifest",
			label: "Tracked install",
			status: "ok",
			detail: `Tracked at v${version ?? currentVersion}`,
		};
	} catch {
		return {
			id: "manifest",
			label: "Tracked install",
			status: "warn",
			detail:
				"restore-manifest.json is unreadable — re-bootstrap may be needed",
			fix: "harness init --track --force",
		};
	}
}

// ─── Next-step derivation ─────────────────────────────────────────────────────

function deriveNextSteps(checks: CheckItem[]): string[] {
	const failed = checks.filter((c) => c.status === "fail");
	const warned = checks.filter((c) => c.status === "warn");

	// Collect unique fix commands in priority order
	const seen = new Set<string>();
	const steps: string[] = [];
	for (const c of [...failed, ...warned]) {
		if (c.fix && !seen.has(c.fix)) {
			seen.add(c.fix);
			steps.push(c.fix);
		}
	}

	if (steps.length === 0) {
		steps.push("harness health");
	}

	return steps;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

export function runCheck(dir: string): CheckReport {
	const checks: CheckItem[] = [
		checkGitRepo(dir),
		checkHarnessVersionCoherence(dir),
		...checkContract(dir),
		checkManifest(dir),
	];

	const counts = { ok: 0, warn: 0, fail: 0 };
	for (const c of checks) counts[c.status]++;

	return {
		version: getVersion(),
		dir,
		timestamp: new Date().toISOString(),
		checks,
		counts,
		hasFailures: counts.fail > 0,
		nextSteps: deriveNextSteps(checks),
	};
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<CheckStatus, string> = {
	ok: "✓",
	warn: "⚠",
	fail: "✗",
};

export function runCheckCLI(
	targetDir: string | undefined,
	options: CheckOptions,
): number {
	const dir = targetDir ? resolve(targetDir) : cwd();
	const report = runCheck(dir);

	if (options.json) {
		console.info(JSON.stringify(report, null, 2));
		return report.hasFailures ? 1 : 0;
	}

	// Human-readable output
	console.info(`\nharness check — v${report.version}`);
	console.info(`Repo: ${report.dir}\n`);

	for (const check of report.checks) {
		const icon = STATUS_ICON[check.status];
		console.info(`  ${icon} ${check.label}`);
		console.info(`    ${check.detail}`);
		if (check.fix && check.status !== "ok") {
			console.info(`    → ${check.fix}`);
		}
	}

	const { ok, warn, fail } = report.counts;
	console.info(
		`\n  ${ok} passed · ${warn} warning${warn === 1 ? "" : "s"} · ${fail} failed`,
	);

	if (report.nextSteps.length > 0) {
		console.info("\nNext:");
		for (const step of report.nextSteps) {
			console.info(`  ${step}`);
		}
	}
	console.info("");

	return report.hasFailures ? 1 : 0;
}
