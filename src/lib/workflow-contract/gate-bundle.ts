/**
 * Gate Bundle Consolidation (Slice 4)
 *
 * Single envelope for all pre-handoff checks, consolidating results from:
 * - Environment / preflight gate
 * - Policy gate
 * - Docs gate
 * - Test gate
 * - Review gate
 *
 * The bundle is idempotent and replay-safe: given the same gate results,
 * it produces the same envelope with the same decision.
 *
 * Usage:
 *   const bundle = createGateBundle({
 *     environment: preflightResult,
 *     policy: policyResult,
 *     docs: docsResult,
 *     tests: testResult,
 *     review: reviewResult,
 *   });
 *   if (bundle.decision === "pass") { // proceed to handoff }
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Gate categories in the bundle. */
export type GateCategory =
	| "environment"
	| "policy"
	| "docs"
	| "tests"
	| "review";

/** Status of an individual gate in the bundle. */
export type GateStatus = "pass" | "fail" | "skip" | "error";

/** Overall bundle decision. */
export type BundleDecision = "pass" | "fail" | "blocked";

/** Severity of a gate finding. */
export type GateFindingSeverity = "error" | "warning" | "info";

/**
 * Individual gate entry in the bundle envelope.
 *
 * Each gate is normalized to this common shape regardless of
 * the gate's native result type.
 */
export interface GateEntry {
	/** Gate category. */
	category: GateCategory;
	/** Gate status. */
	status: GateStatus;
	/** Whether this gate is required for the bundle to pass. */
	required: boolean;
	/** Human-readable summary. */
	summary: string;
	/** Execution time in milliseconds (-1 if unknown). */
	durationMs: number;
	/** Findings from this gate. */
	findings: GateFinding[];
}

/** A single finding from a gate. */
export interface GateFinding {
	/** Gate category this finding belongs to. */
	gate: GateCategory;
	/** Finding code (e.g. "LINT_FAIL", "MISSING_DOC"). */
	code: string;
	/** Severity. */
	severity: GateFindingSeverity;
	/** Message. */
	message: string;
}

/**
 * The complete gate bundle envelope.
 *
 * Idempotent: same inputs always produce the same envelope.
 */
export interface GateBundleEnvelope {
	/** Schema version for forward-compatibility. */
	schemaVersion: "gate-bundle/v1";
	/** Overall decision. */
	decision: BundleDecision;
	/** ISO 8601 timestamp when the bundle was created. */
	createdAt: string;
	/** Idempotency key (hash of input data). */
	idempotencyKey: string;
	/** Individual gate results, ordered by evaluation order. */
	gates: GateEntry[];
	/** Summary statistics. */
	summary: BundleSummary;
}

/** Summary statistics for the bundle. */
export interface BundleSummary {
	/** Total number of gates evaluated. */
	total: number;
	/** Number of gates that passed. */
	passed: number;
	/** Number of gates that failed. */
	failed: number;
	/** Number of gates skipped. */
	skipped: number;
	/** Number of gates with errors. */
	errored: number;
	/** Total findings count. */
	findingCount: number;
	/** Error-level findings count. */
	errorCount: number;
	/** Warning-level findings count. */
	warningCount: number;
	/** Total execution time in milliseconds. */
	totalDurationMs: number;
}

// ─── Input Adapters ─────────────────────────────────────────────────────────────

/**
 * Generic gate input — the adapter accepts various shapes.
 *
 * Each field maps to a gate category and can be:
 * - A `GateInput` with structured data
 * - `undefined` if the gate was not run (treated as skip)
 */
export interface GateBundleInput {
	environment?: GateInput;
	policy?: GateInput;
	docs?: GateInput;
	tests?: GateInput;
	review?: GateInput;
}

/**
 * Generic gate input — a normalized view that any gate result can
 * be adapted into.
 */
export interface GateInput {
	/** Whether the gate passed. */
	passed: boolean;
	/** Whether the gate is required for the bundle to pass. */
	required?: boolean;
	/** Human-readable summary. */
	summary?: string;
	/** Execution time in milliseconds. */
	durationMs?: number;
	/** Findings from this gate. */
	findings?: Array<{
		code: string;
		severity: GateFindingSeverity;
		message: string;
	}>;
}

// ─── Gate Configuration ─────────────────────────────────────────────────────────

/**
 * Configuration for gate bundle creation.
 */
export interface GateBundleConfig {
	/**
	 * Which gates are required (must pass for bundle to pass).
	 * Default: all gates are required.
	 */
	requiredGates?: GateCategory[];
	/**
	 * Override the timestamp (for deterministic testing).
	 */
	timestamp?: string;
}

/** Default required gates for pre-handoff. */
const DEFAULT_REQUIRED_GATES: readonly GateCategory[] = [
	"environment",
	"policy",
	"docs",
	"tests",
	"review",
];

/** Evaluation order for gates. */
const GATE_ORDER: readonly GateCategory[] = [
	"environment",
	"policy",
	"docs",
	"tests",
	"review",
];

// ─── Bundle Creation ────────────────────────────────────────────────────────────

/**
 * Create a gate bundle envelope from individual gate results.
 *
 * The bundle is idempotent: given the same inputs and timestamp,
 * it always produces the same envelope.
 */
export function createGateBundle(
	input: GateBundleInput,
	config?: GateBundleConfig,
): GateBundleEnvelope {
	const requiredGates = new Set(
		config?.requiredGates ?? DEFAULT_REQUIRED_GATES,
	);
	const timestamp = config?.timestamp ?? new Date().toISOString();

	// Build gate entries in evaluation order
	const gates: GateEntry[] = [];
	for (const category of GATE_ORDER) {
		const gateInput = input[category];
		gates.push(buildGateEntry(category, gateInput, requiredGates.has(category)));
	}

	// Compute decision
	const decision = computeDecision(gates);

	// Compute summary
	const summary = computeSummary(gates);

	// Compute idempotency key
	const idempotencyKey = computeIdempotencyKey(gates, timestamp);

	return {
		schemaVersion: "gate-bundle/v1",
		decision,
		createdAt: timestamp,
		idempotencyKey,
		gates,
		summary,
	};
}

/**
 * Create a gate bundle from raw gate results that haven't been normalized.
 *
 * This is a convenience wrapper that adapts common gate result shapes
 * into GateInput.
 */
export function createGateBundleFromResults(
	results: {
		environment?: { passed: boolean; checks?: Array<{ id: string; passed: boolean; message?: string; durationMs?: number }> };
		policy?: { ok: boolean; output?: { passed: boolean; tier?: string; violatingFiles?: string[] }; error?: { code: string; message: string } };
		docs?: { exitCode: number; report?: { summary?: { error_count?: number; warning_count?: number }; findings?: Array<{ rule_id: string; severity: string; message: string }> } };
		tests?: { passed: boolean; total?: number; failed?: number; errors?: string[] };
		review?: { ok: boolean; output?: { verified: boolean; blockers?: string[] }; error?: { code: string; message: string } };
	},
	config?: GateBundleConfig,
): GateBundleEnvelope {
	const input: GateBundleInput = {};

	// Adapt environment/preflight
	if (results.environment) {
		const findings: GateInput["findings"] = [];
		let totalDuration = 0;
		for (const check of results.environment.checks ?? []) {
			if (!check.passed) {
				findings.push({
					code: check.id,
					severity: "error",
					message: check.message ?? `Check ${check.id} failed`,
				});
			}
			totalDuration += check.durationMs ?? 0;
		}
		input.environment = {
			passed: results.environment.passed,
			summary: results.environment.passed
				? "All environment checks passed"
				: "Environment checks failed",
			durationMs: totalDuration,
			findings,
		};
	}

	// Adapt policy gate
	if (results.policy) {
		const findings: GateInput["findings"] = [];
		if (!results.policy.ok && results.policy.error) {
			findings.push({
				code: results.policy.error.code,
				severity: "error",
				message: results.policy.error.message,
			});
		} else if (
			results.policy.ok &&
			results.policy.output &&
			!results.policy.output.passed
		) {
			findings.push({
				code: "POLICY_VIOLATION",
				severity: "error",
				message: `Risk tier ${results.policy.output.tier ?? "unknown"} exceeds maximum allowed`,
			});
		}
		input.policy = {
			passed: results.policy.ok
				? (results.policy.output?.passed ?? true)
				: false,
			summary: results.policy.ok
				? `Policy gate: tier ${results.policy.output?.tier ?? "unknown"}`
				: `Policy gate error: ${results.policy.error?.message ?? "unknown"}`,
			findings,
		};
	}

	// Adapt docs gate
	if (results.docs) {
		const findings: GateInput["findings"] = [];
		for (const f of results.docs.report?.findings ?? []) {
			findings.push({
				code: f.rule_id,
				severity: f.severity as GateFindingSeverity,
				message: f.message,
			});
		}
		input.docs = {
			passed: results.docs.exitCode === 0,
			summary:
				results.docs.exitCode === 0
					? "Docs gate passed"
					: `Docs gate failed (${results.docs.report?.summary?.error_count ?? 0} errors)`,
			findings,
		};
	}

	// Adapt test results
	if (results.tests) {
		const findings: GateInput["findings"] = [];
		for (const err of results.tests.errors ?? []) {
			findings.push({
				code: "TEST_FAILURE",
				severity: "error",
				message: err,
			});
		}
		input.tests = {
			passed: results.tests.passed,
			summary: results.tests.passed
				? `All ${results.tests.total ?? 0} tests passed`
				: `${results.tests.failed ?? 0} of ${results.tests.total ?? 0} tests failed`,
			findings,
		};
	}

	// Adapt review gate
	if (results.review) {
		const findings: GateInput["findings"] = [];
		if (!results.review.ok && results.review.error) {
			findings.push({
				code: results.review.error.code,
				severity: "error",
				message: results.review.error.message,
			});
		} else if (results.review.ok && results.review.output) {
			for (const blocker of results.review.output.blockers ?? []) {
				findings.push({
					code: "REVIEW_BLOCKER",
					severity: "error",
					message: blocker,
				});
			}
		}
		input.review = {
			passed: results.review.ok
				? (results.review.output?.verified ?? false)
				: false,
			summary: results.review.ok
				? results.review.output?.verified
					? "Review gate passed"
					: "Review gate: awaiting verification"
				: `Review gate error: ${results.review.error?.message ?? "unknown"}`,
			findings,
		};
	}

	return createGateBundle(input, config);
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validate that a gate bundle envelope is structurally correct.
 */
export function validateGateBundle(
	envelope: GateBundleEnvelope,
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (envelope.schemaVersion !== "gate-bundle/v1") {
		errors.push(
			`Invalid schema version '${envelope.schemaVersion}', expected 'gate-bundle/v1'`,
		);
	}

	const validDecisions: BundleDecision[] = ["pass", "fail", "blocked"];
	if (!validDecisions.includes(envelope.decision)) {
		errors.push(`Invalid decision '${envelope.decision}'`);
	}

	if (!envelope.createdAt || envelope.createdAt.trim().length === 0) {
		errors.push("Missing createdAt timestamp");
	}

	if (!envelope.idempotencyKey || envelope.idempotencyKey.trim().length === 0) {
		errors.push("Missing idempotency key");
	}

	if (!Array.isArray(envelope.gates)) {
		errors.push("Gates must be an array");
	} else {
		const seenCategories = new Set<GateCategory>();
		for (const gate of envelope.gates) {
			if (seenCategories.has(gate.category)) {
				errors.push(`Duplicate gate category '${gate.category}'`);
			}
			seenCategories.add(gate.category);

			const validStatuses: GateStatus[] = ["pass", "fail", "skip", "error"];
			if (!validStatuses.includes(gate.status)) {
				errors.push(
					`Gate '${gate.category}' has invalid status '${gate.status}'`,
				);
			}
		}
	}

	// Verify summary counts match
	if (envelope.summary) {
		const expectedTotal = envelope.gates.length;
		if (envelope.summary.total !== expectedTotal) {
			errors.push(
				`Summary total (${envelope.summary.total}) doesn't match gate count (${expectedTotal})`,
			);
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Check if a gate bundle is replay-safe (idempotent).
 *
 * Given two bundles that should be equivalent, verifies they have the
 * same idempotency key.
 */
export function isBundleReplaySafe(
	a: GateBundleEnvelope,
	b: GateBundleEnvelope,
): boolean {
	return a.idempotencyKey === b.idempotencyKey;
}

// ─── Internal Helpers ───────────────────────────────────────────────────────────

function buildGateEntry(
	category: GateCategory,
	input: GateInput | undefined,
	required: boolean,
): GateEntry {
	if (!input) {
		return {
			category,
			status: "skip",
			required,
			summary: `${category} gate was not evaluated`,
			durationMs: -1,
			findings: [],
		};
	}

	const findings: GateFinding[] = (input.findings ?? []).map((f) => ({
		gate: category,
		code: f.code,
		severity: f.severity,
		message: f.message,
	}));

	return {
		category,
		status: input.passed ? "pass" : "fail",
		required,
		summary: input.summary ?? `${category} gate ${input.passed ? "passed" : "failed"}`,
		durationMs: input.durationMs ?? -1,
		findings,
	};
}

function computeDecision(gates: GateEntry[]): BundleDecision {
	const hasError = gates.some((g) => g.status === "error");
	if (hasError) {
		return "blocked";
	}

	const requiredFailures = gates.filter(
		(g) => g.required && g.status === "fail",
	);
	if (requiredFailures.length > 0) {
		return "fail";
	}

	// If a required gate was skipped, the bundle is blocked
	const requiredSkips = gates.filter(
		(g) => g.required && g.status === "skip",
	);
	if (requiredSkips.length > 0) {
		return "blocked";
	}

	return "pass";
}

function computeSummary(gates: GateEntry[]): BundleSummary {
	let passed = 0;
	let failed = 0;
	let skipped = 0;
	let errored = 0;
	let findingCount = 0;
	let errorCount = 0;
	let warningCount = 0;
	let totalDurationMs = 0;

	for (const gate of gates) {
		switch (gate.status) {
			case "pass":
				passed++;
				break;
			case "fail":
				failed++;
				break;
			case "skip":
				skipped++;
				break;
			case "error":
				errored++;
				break;
		}

		findingCount += gate.findings.length;
		errorCount += gate.findings.filter(
			(f) => f.severity === "error",
		).length;
		warningCount += gate.findings.filter(
			(f) => f.severity === "warning",
		).length;

		if (gate.durationMs > 0) {
			totalDurationMs += gate.durationMs;
		}
	}

	return {
		total: gates.length,
		passed,
		failed,
		skipped,
		errored,
		findingCount,
		errorCount,
		warningCount,
		totalDurationMs,
	};
}

function computeIdempotencyKey(
	gates: GateEntry[],
	timestamp: string,
): string {
	// Build a deterministic string from the gate results
	const parts: string[] = [timestamp];
	for (const gate of gates) {
		parts.push(`${gate.category}:${gate.status}:${gate.findings.length}`);
		for (const finding of gate.findings) {
			parts.push(`${finding.code}:${finding.severity}`);
		}
	}

	// Simple hash using string combination (no crypto import needed)
	let hash = 0;
	const str = parts.join("|");
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return `gbk-${Math.abs(hash).toString(36)}`;
}
