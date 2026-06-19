import { ContractLoadError, loadContract } from "../lib/contract/loader.js";
import type {
	GateVerdict,
	PolicyAction,
	RiskTier,
} from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import {
	normalisePolicyGateResult,
	renderGateDecision,
} from "../lib/output/normalise.js";
import {
	evaluatePolicyChainDecision,
	resolvePolicyChain,
} from "../lib/policy/policy-chain.js";
import { resolveOverallTier } from "../lib/policy/risk-tier.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	POLICY_VIOLATION: 1,
	VALIDATION_ERROR: 1,
	FILE_NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	SYSTEM_ERROR: 10,
} as const;

// Tier order: index 0 is highest severity
const TIER_ORDER: RiskTier[] = ["high", "medium", "low"];

function isValidTier(value: unknown): value is RiskTier {
	return typeof value === "string" && TIER_ORDER.includes(value as RiskTier);
}

/** Inputs for evaluating changed files against a harness contract policy gate. */
export interface PolicyGateOptions {
	contractPath: string;
	files: string[];
	json?: boolean;
	maxTier?: RiskTier;
}

/** Structured policy-gate decision returned by the library and CLI renderer. */
export interface PolicyGateOutput {
	passed: boolean;
	tier: RiskTier;
	action: PolicyAction;
	verdict: GateVerdict;
	maxAllowed?: RiskTier;
	violatingFiles: string[];
}

/** Sanitized policy-gate validation or system error safe for JSON output. */
export interface PolicyGateErrorOutput {
	code: string;
	message: string;
	details?: unknown;
}

/** Discriminated policy-gate result used by callers before choosing an exit code. */
export type PolicyGateResult =
	| { ok: true; output: PolicyGateOutput }
	| { ok: false; error: PolicyGateErrorOutput };

function buildDecisionOutput(
	tier: RiskTier,
	action: PolicyAction,
	verdict: GateVerdict,
	files: string[],
	maxAllowed?: RiskTier,
): PolicyGateOutput {
	const passed = verdict === "pass";
	return {
		passed,
		tier,
		action,
		verdict,
		...(maxAllowed ? { maxAllowed } : {}),
		violatingFiles: passed ? [] : files,
	};
}

function passForNoChangedFiles(contract: unknown): PolicyGateResult {
	void contract;
	return {
		ok: true,
		output: {
			passed: true,
			tier: "low",
			action: "allow",
			verdict: "pass",
			violatingFiles: [],
		},
	};
}

function violatesMaxTier(tier: RiskTier, maxTier: RiskTier): boolean {
	return TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(maxTier);
}

function decisionForFiles(
	tier: RiskTier,
	decision: ReturnType<typeof evaluatePolicyChainDecision>,
	files: string[],
	maxTier?: RiskTier,
): PolicyGateResult {
	if (maxTier && violatesMaxTier(tier, maxTier)) {
		return {
			ok: true,
			output: buildDecisionOutput(tier, "block", "fail", files, maxTier),
		};
	}
	return {
		ok: true,
		output: buildDecisionOutput(tier, decision.action, decision.verdict, files),
	};
}

function policyGateError(error: unknown): PolicyGateResult {
	if (error instanceof ContractLoadError) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: sanitizeError(error),
				details: error.errors,
			},
		};
	}
	return {
		ok: false,
		error: {
			code: "SYSTEM_ERROR",
			message: sanitizeError(error),
		},
	};
}

/**
 * Run policy gate check and return structured result.
 * This function is usable as a library (does not output to console).
 */
export function runPolicyGate(options: PolicyGateOptions): PolicyGateResult {
	// Validate maxTier if provided
	if (options.maxTier !== undefined && !isValidTier(options.maxTier)) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: `Invalid max-tier: must be one of ${TIER_ORDER.join(", ")}`,
			},
		};
	}

	try {
		const contract = loadContract(options.contractPath, process.cwd(), {
			allowExtends: false,
		});

		// No changed files should always pass the gate.
		if (options.files.length === 0) {
			return passForNoChangedFiles(contract);
		}

		const tier = resolveOverallTier(options.files, contract);
		const policyChain = resolvePolicyChain(contract);
		const decision = evaluatePolicyChainDecision(tier, policyChain);
		return decisionForFiles(tier, decision, options.files, options.maxTier);
	} catch (e) {
		return policyGateError(e);
	}
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export function runPolicyGateCLI(options: PolicyGateOptions): number {
	const result = runPolicyGate(options);
	const gateResult = normalisePolicyGateResult(result);

	if (result.ok) {
		if (options.json) {
			process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
		} else {
			renderGateDecision(gateResult);
		}
		return result.output.passed
			? EXIT_CODES.SUCCESS
			: EXIT_CODES.POLICY_VIOLATION;
	}

	// Error output always to stderr
	console.error(result.error.message);
	if (options.json) {
		process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
	} else {
		console.error(`Reason: ${gateResult.reason}`);
		if (gateResult.action_now.length > 0) {
			console.error("Action now:");
			for (const step of gateResult.action_now) {
				console.error(`- ${step}`);
			}
		}
	}

	// Map error codes to exit codes
	if (result.error.code === "VALIDATION_ERROR") {
		return EXIT_CODES.VALIDATION_ERROR;
	}
	return EXIT_CODES.SYSTEM_ERROR;
}
