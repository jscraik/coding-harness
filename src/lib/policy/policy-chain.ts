import type {
	GateVerdict,
	HarnessContract,
	PolicyAction,
	PolicyChainPolicy,
	RiskTier,
} from "../contract/types.js";
import { DEFAULT_POLICY_CHAIN } from "../contract/types.js";

export interface PolicyChainDecision {
	tier: RiskTier;
	action: PolicyAction;
	verdict: GateVerdict;
}

export function resolvePolicyChain(
	contract: HarnessContract | undefined,
): PolicyChainPolicy {
	return contract?.policyChain ?? DEFAULT_POLICY_CHAIN;
}

export function resolvePolicyAction(
	tier: RiskTier,
	policyChain: PolicyChainPolicy,
): PolicyAction {
	return policyChain.tierToAction[tier];
}

export function resolveGateVerdict(
	action: PolicyAction,
	policyChain: PolicyChainPolicy,
): GateVerdict {
	return policyChain.actionToVerdict[action];
}

export function evaluatePolicyChainDecision(
	tier: RiskTier,
	policyChain: PolicyChainPolicy,
): PolicyChainDecision {
	const action = resolvePolicyAction(tier, policyChain);
	return {
		tier,
		action,
		verdict: resolveGateVerdict(action, policyChain),
	};
}
