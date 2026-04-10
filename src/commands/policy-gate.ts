import { ContractLoadError, loadContract } from "../lib/contract/loader.js";
import type {
	GateVerdict,
	PolicyAction,
	RiskTier,
} from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { normalisePolicyGateResult } from "../lib/output/normalise.js";
import {
	evaluatePolicyChainDecision,
	resolveGateVerdict,
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

export interface PolicyGateOptions {
	contractPath: string;
	files: string[];
	json?: boolean;
	maxTier?: RiskTier;
}

export interface PolicyGateOutput {
	passed: boolean;
	tier: RiskTier;
	action: PolicyAction;
	verdict: GateVerdict;
	maxAllowed?: RiskTier;
	violatingFiles: string[];
}

export interface PolicyGateErrorOutput {
	code: string;
	message: string;
	details?: unknown;
}

export type PolicyGateResult =
	| { ok: true; output: PolicyGateOutput }
	| { ok: false; error: PolicyGateErrorOutput };

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
			const policyChain = resolvePolicyChain(contract);
			const decision = evaluatePolicyChainDecision("low", policyChain);
			return {
				ok: true,
				output: {
					passed: decision.verdict === "pass",
					tier: decision.tier,
					action: decision.action,
					verdict: decision.verdict,
					violatingFiles: [],
				},
			};
		}

		const tier = resolveOverallTier(options.files, contract);
		const policyChain = resolvePolicyChain(contract);
		const decision = evaluatePolicyChainDecision(tier, policyChain);

		// If no max tier specified, all pass
		if (!options.maxTier) {
			return {
				ok: true,
				output: {
					passed: decision.verdict === "pass",
					tier,
					action: decision.action,
					verdict: decision.verdict,
					violatingFiles: [],
				},
			};
		}

		const maxTierIndex = TIER_ORDER.indexOf(options.maxTier);
		const actualTierIndex = TIER_ORDER.indexOf(tier);

		// Lower index = higher severity
		// If actual tier index is lower than max, it's more severe (violation)
		if (actualTierIndex < maxTierIndex) {
			const blockedVerdict = resolveGateVerdict("block", policyChain);
			return {
				ok: true,
				output: {
					passed: blockedVerdict === "pass",
					tier,
					action: "block",
					verdict: blockedVerdict,
					maxAllowed: options.maxTier,
					violatingFiles: options.files,
				},
			};
		}

		return {
			ok: true,
			output: {
				passed: decision.verdict === "pass",
				tier,
				action: decision.action,
				verdict: decision.verdict,
				violatingFiles: [],
			},
		};
	} catch (e) {
		if (e instanceof ContractLoadError) {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: sanitizeError(e),
					details: e.errors,
				},
			};
		}
		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: sanitizeError(e),
			},
		};
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
			const icon =
				gateResult.status === "pass"
					? "✓"
					: gateResult.status === "warn"
						? "⚠"
						: "✗";
			console.info(`${icon} policy-gate ${gateResult.status}`);
			console.info(`Reason: ${gateResult.reason}`);
			if (gateResult.action_now.length > 0) {
				console.info("Action now:");
				for (const step of gateResult.action_now) {
					console.info(`- ${step}`);
				}
			}
			if (gateResult.action_later.length > 0) {
				console.info("Action later:");
				for (const step of gateResult.action_later) {
					console.info(`- ${step}`);
				}
			}
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
