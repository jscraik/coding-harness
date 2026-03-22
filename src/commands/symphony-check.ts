import { existsSync, lstatSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { sanitizeError } from "../lib/input/sanitize.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	SYSTEM_ERROR: 10,
} as const;

// ---------------------------------------------------------------------------
// 1. Types
// ---------------------------------------------------------------------------

export interface SymphonyCheckOptions {
	/** Path to the project root (defaults to cwd) */
	repoRoot?: string;
	/** Path to WORKFLOW.md (defaults to WORKFLOW.md in repoRoot) */
	workflowPath?: string;
	/** Override for the env-file path (defaults to ~/.codex/.env) */
	envFilePath?: string;
	/** Output JSON */
	json?: boolean;
}

interface Finding {
	severity: "error" | "warning";
	code: string;
	message: string;
}

export interface SymphonyCheckResult {
	pass: boolean;
	findings: Finding[];
	summary: {
		errors: number;
		warnings: number;
		workflowPath: string;
		projectSlug: string | null;
		linearKeyAvailable: boolean;
	};
}

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------

const CODEX_ENV_PATHS = [
	resolve(process.env.HOME ?? "~", ".codex/.env"),
	resolve(process.env.HOME ?? "~", ".codex/env"),
];

const CANONICAL_TRANSITION_TABLE_HEADERS = [
	"S | E | G | A | N",
	"S | E | G | A | P | R | N",
] as const;

function isUsableSecretValue(value: string | undefined): boolean {
	if (!value) {
		return false;
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return false;
	}

	return !(
		/^\$\{[^}]+\}$/.test(trimmed) ||
		/^\$[A-Z0-9_]+$/i.test(trimmed) ||
		/^<[^>]+>$/.test(trimmed)
	);
}

function resolveLinearApiKeyAvailable(envFilePath?: string): boolean {
	// 1. Already in environment
	const envValue = process.env.LINEAR_API_KEY?.trim();
	if (isUsableSecretValue(envValue)) {
		return true;
	}

	// 2. Check specified env-file or default codex env paths
	const candidates = envFilePath ? [envFilePath] : CODEX_ENV_PATHS;
	for (const candidate of candidates) {
		try {
			if (!existsSync(candidate)) {
				continue;
			}

			const stat = lstatSync(candidate);
			if (stat.isFIFO()) {
				// The canonical Codex env source is a 1Password-backed FIFO on many
				// local machines. For readiness purposes, treat that default source as
				// a valid configured secret input without trying to synchronously drain it.
				if (!envFilePath && CODEX_ENV_PATHS.includes(candidate)) {
					return true;
				}
				continue;
			}

			if (!stat.isFile()) {
				continue;
			}

			const content = readFileSync(candidate, "utf-8");
			// Match KEY=value or KEY="value" lines (1Password-style .env)
			for (const line of content.split("\n")) {
				const trimmed = line.trim();
				if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
				const eqIndex = trimmed.indexOf("=");
				const key = trimmed.slice(0, eqIndex).trim();
				if (key === "LINEAR_API_KEY") {
					const value = trimmed
						.slice(eqIndex + 1)
						.trim()
						.replace(/^["']|["']$/g, "");
					if (isUsableSecretValue(value)) {
						return true;
					}
				}
			}
		} catch {
			// Expected: env var lookup failed, which is normal for absent secrets
		}
	}

	return false;
}

function extractYamlFrontMatter(
	content: string,
): { yaml: string; body: string } | null {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
	if (!match) return null;
	return { yaml: match[1] ?? "", body: match[2] ?? "" };
}

function extractYamlValue(yaml: string, key: string): string | null {
	// Simple single-level extraction from YAML text.
	// Handles:  project_slug: "value"  or  project_slug: value
	const pattern = new RegExp(
		`^\\s*${key}:\\s*["']?([^"'\\n]+?)["']?\\s*$`,
		"m",
	);
	const match = yaml.match(pattern);
	return match?.[1]?.trim() ?? null;
}

function extractNestedYamlValue(
	yaml: string,
	parent: string,
	child: string,
): string | null {
	// Find the parent section, then look for the child key indented under it.
	const parentPattern = new RegExp(
		`^${parent}:\\s*\\n((?:[ \\t]+.*\\n)*)`,
		"m",
	);
	const parentMatch = yaml.match(parentPattern);
	if (!parentMatch) return null;
	const block = parentMatch[1] ?? "";
	return extractYamlValue(block, child);
}

// ---------------------------------------------------------------------------
// 3. Core check logic
// ---------------------------------------------------------------------------

export function runSymphonyCheck(
	options: SymphonyCheckOptions,
): SymphonyCheckResult {
	const findings: Finding[] = [];
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const workflowPath = options.workflowPath
		? isAbsolute(options.workflowPath)
			? options.workflowPath
			: resolve(repoRoot, options.workflowPath)
		: resolve(repoRoot, "WORKFLOW.md");

	let projectSlug: string | null = null;
	let body = "";
	let yaml = "";

	// ── Check 1: WORKFLOW.md exists ──────────────────────────────────
	if (!existsSync(workflowPath)) {
		findings.push({
			severity: "error",
			code: "MISSING_WORKFLOW",
			message: `WORKFLOW.md not found at ${workflowPath}. Run \`harness init\` to scaffold it.`,
		});
	} else {
		const content = readFileSync(workflowPath, "utf-8");
		const parsed = extractYamlFrontMatter(content);

		// ── Check 2: YAML front matter exists ──────────────────────────
		if (!parsed) {
			findings.push({
				severity: "error",
				code: "MISSING_FRONTMATTER",
				message:
					"WORKFLOW.md has no YAML front matter. Add a `---` delimited YAML block at the top.",
			});
		} else {
			yaml = parsed.yaml;
			body = parsed.body;

			// ── Check 3: tracker.kind is linear ────────────────────────
			const trackerKind = extractNestedYamlValue(yaml, "tracker", "kind");
			if (!trackerKind) {
				findings.push({
					severity: "error",
					code: "MISSING_TRACKER_KIND",
					message:
						"WORKFLOW.md front matter is missing `tracker.kind`. Set it to `linear`.",
				});
			} else if (trackerKind !== "linear") {
				findings.push({
					severity: "warning",
					code: "NON_LINEAR_TRACKER",
					message: `tracker.kind is "${trackerKind}" (expected "linear"). Symphony currently only supports Linear.`,
				});
			}

			// ── Check 4: project_slug is filled ────────────────────────
			projectSlug = extractNestedYamlValue(yaml, "tracker", "project_slug");
			if (!projectSlug || projectSlug.includes("<")) {
				findings.push({
					severity: "error",
					code: "MISSING_PROJECT_SLUG",
					message:
						"tracker.project_slug is missing or still a placeholder. Set it to your Linear project slug.",
				});
				projectSlug = null;
			}

			// ── Check 5: active_states present ─────────────────────────
			if (!yaml.includes("active_states")) {
				findings.push({
					severity: "warning",
					code: "MISSING_ACTIVE_STATES",
					message:
						"tracker.active_states not found in front matter. Symphony defaults to [Todo, In Progress].",
				});
			}

			// ── Check 6: workspace.root configured ─────────────────────
			const workspaceRoot = extractNestedYamlValue(yaml, "workspace", "root");
			if (!workspaceRoot) {
				findings.push({
					severity: "warning",
					code: "MISSING_WORKSPACE_ROOT",
					message:
						"workspace.root not found in front matter. Symphony needs this to create isolated workspaces.",
				});
			}

			// ── Check 7: hooks.after_create configured ─────────────────
			if (!yaml.includes("after_create")) {
				findings.push({
					severity: "warning",
					code: "MISSING_AFTER_CREATE_HOOK",
					message:
						"hooks.after_create not found. Symphony needs this to bootstrap workspaces (clone + install).",
				});
			}
		}
	}

	// ── Check 8: Transition table references harness linear commands ──
	const requiredCommands = [
		{ cmd: "harness linear claim", code: "MISSING_CLAIM_CMD" },
		{ cmd: "harness linear handoff", code: "MISSING_HANDOFF_CMD" },
		{ cmd: "harness linear close", code: "MISSING_CLOSE_CMD" },
	];
	for (const { cmd, code } of requiredCommands) {
		if (!body.includes(cmd)) {
			findings.push({
				severity: "error",
				code,
				message: `Transition table must reference \`${cmd}\`. This is required for Symphony state transitions.`,
			});
		}
	}

	// ── Check 9: Canonical transition table exists ────────────────────
	if (
		!CANONICAL_TRANSITION_TABLE_HEADERS.some((header) => body.includes(header))
	) {
		findings.push({
			severity: "error",
			code: "MISSING_TRANSITION_TABLE",
			message:
				"Missing canonical transition table (`S | E | G | A | N` or `S | E | G | A | P | R | N`) in WORKFLOW.md body.",
		});
	}

	// ── Check 10: LINEAR_API_KEY available ────────────────────────────
	const linearKeyAvailable = resolveLinearApiKeyAvailable(options.envFilePath);
	if (!linearKeyAvailable) {
		findings.push({
			severity: "error",
			code: "MISSING_LINEAR_API_KEY",
			message:
				"LINEAR_API_KEY not found in environment or ~/.codex/.env. Symphony requires this at runtime.",
		});
	}

	// ── Check 11: harness.contract.json exists ───────────────────────
	const contractPath = resolve(repoRoot, "harness.contract.json");
	if (!existsSync(contractPath)) {
		findings.push({
			severity: "warning",
			code: "MISSING_CONTRACT",
			message:
				"harness.contract.json not found. Run `harness init` to scaffold the full harness.",
		});
	} else {
		try {
			const contract = JSON.parse(readFileSync(contractPath, "utf-8"));
			const policy = contract?.issueTrackingPolicy;
			if (!policy || policy.provider !== "linear") {
				findings.push({
					severity: "warning",
					code: "CONTRACT_NOT_LINEAR",
					message:
						"harness.contract.json issueTrackingPolicy.provider is not set to 'linear'.",
				});
			}
		} catch {
			findings.push({
				severity: "warning",
				code: "CONTRACT_PARSE_ERROR",
				message: "Could not parse harness.contract.json.",
			});
		}
	}

	// ── Check 12: Codex environment template exists ──────────────────
	const codexEnvPath = resolve(
		repoRoot,
		".codex/environments/environment.toml",
	);
	if (!existsSync(codexEnvPath)) {
		findings.push({
			severity: "warning",
			code: "MISSING_CODEX_ENVIRONMENT",
			message:
				".codex/environments/environment.toml not found. Codex agents need this for runtime actions.",
		});
	}

	const errors = findings.filter((f) => f.severity === "error").length;
	const warnings = findings.filter((f) => f.severity === "warning").length;

	return {
		pass: errors === 0,
		findings,
		summary: {
			errors,
			warnings,
			workflowPath,
			projectSlug,
			linearKeyAvailable,
		},
	};
}

// ---------------------------------------------------------------------------
// 4. CLI runner
// ---------------------------------------------------------------------------

export function runSymphonyCheckCLI(options: SymphonyCheckOptions): number {
	try {
		const result = runSymphonyCheck(options);

		if (options.json) {
			console.info(JSON.stringify(result, null, 2));
			return result.pass ? EXIT_CODES.SUCCESS : EXIT_CODES.VALIDATION_ERROR;
		}

		// Human-readable output
		const icon = result.pass ? "✅" : "❌";
		console.info(
			`\n${icon} Symphony readiness check — ${result.summary.errors} error(s), ${result.summary.warnings} warning(s)\n`,
		);

		for (const finding of result.findings) {
			const prefix = finding.severity === "error" ? "  ✗" : "  ⚠";
			console.info(`${prefix} [${finding.code}] ${finding.message}`);
		}

		if (result.pass && result.findings.length === 0) {
			console.info("  All checks passed. Project is Symphony-ready.");
		} else if (result.pass) {
			console.info("\n  No blocking errors. Address warnings when convenient.");
		} else {
			console.info(
				"\n  Fix errors above before running Symphony on this project.",
			);
		}

		console.info("");
		return result.pass ? EXIT_CODES.SUCCESS : EXIT_CODES.VALIDATION_ERROR;
	} catch (error: unknown) {
		const message = sanitizeError(error);
		console.error(`Symphony check failed: ${message}`);
		return EXIT_CODES.SYSTEM_ERROR;
	}
}
