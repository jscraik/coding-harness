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

/**
 * Determine whether the given directory contains a Git repository.
 *
 * @param dir - Path to the directory to inspect
 * @returns A `CheckItem` with `id: "git"` and `label: "Git repository"`. When a `.git` directory is present the item has `status: "ok"` and detail `"Found .git — version control active"`. When missing the item has `status: "warn"`, detail `".git not found — some harness features require version control"`, and a suggested `fix: "git init"`.
 */

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

/**
 * Produces a `CheckItem` describing whether the harness versions in `dir` are coherent.
 *
 * Maps the result of `detectHarnessVersionCoherence(dir)` to a check with id `"harness:version-coherence"` and label `"Harness version coherence"`.
 *
 * - If coherence status is `"drift"`, the check status is `fail`.
 * - If coherence status is `"error"`, the check status is `warn`.
 * - If coherence status is `"skip"`, the check status is `warn`.
 * - Otherwise the check status is `ok`.
 * When `detectHarnessVersionCoherence` provides a remediation string, it is included as the check's `fix`.
 *
 * @param dir - Path to the repository or project directory to inspect.
 * @returns A `CheckItem` whose `detail` contains the coherence message and whose `status` reflects the detected coherence state; includes `fix` when a remediation is available.
 */
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

	if (coherence.status === "skip") {
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

/**
 * Produce findings about the presence and schema validity of `harness.contract.json` in the given directory.
 *
 * @param dir - Directory to inspect for `harness.contract.json`
 * @returns An array of `CheckItem` findings:
 *  - When the contract file is missing: a single `fail` finding recommending `harness contract init`.
 *  - When the file cannot be parsed as JSON: a single `fail` finding recommending `harness contract validate --json`.
 *  - When the file is present: an `ok` finding reporting the detected section count and schema version, plus a second finding that is `ok` if validation passes or `fail` (with a recommendation `harness contract validate`) if validation reports errors.
 */
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

/**
 * Build an ordered, de-duplicated list of recommended fix commands from check results, prioritizing failures first.
 *
 * @param checks - Array of check items to extract fix commands from.
 * @returns An array of fix command strings with fixes for failed checks first followed by fixes for warned checks; returns `["harness health"]` when no fixes are present.
 */

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

/**
 * Produce a snapshot report of repository health by running the module's set of checks against a directory.
 *
 * Runs the configured checks in a stable order (git repo, harness version coherence, contract, manifest), aggregates their results into counts, determines whether any check failed, and derives recommended next-step commands.
 *
 * @param dir - Filesystem path of the target directory to inspect; resolved paths inside checks are relative to this directory.
 * @returns A CheckReport containing the tool version, inspected directory, ISO timestamp, the array of CheckItem results, aggregated counts, a `hasFailures` flag, and an ordered list of recommended next steps.
 */

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