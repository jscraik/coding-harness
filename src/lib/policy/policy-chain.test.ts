import { describe, expect, it } from "vitest";
import type { HarnessContract } from "../contract/types.js";
import {
	evaluatePolicyChainDecision,
	resolveGateVerdict,
	resolvePolicyAction,
	resolvePolicyChain,
} from "./policy-chain.js";

describe("policy-chain", () => {
	it("falls back to default chain when contract does not define one", () => {
		const contract: HarnessContract = {
			version: "1.5.0",
			riskTierRules: {},
		};
		const chain = resolvePolicyChain(contract);
		expect(chain.tierToAction.high).toBe("block");
		expect(chain.actionToVerdict.block).toBe("fail");
		expect(chain.actionToVerdict.warn).toBe("pass");
	});

	it("resolves action and verdict for each tier", () => {
		const chain = resolvePolicyChain(undefined);
		expect(resolvePolicyAction("high", chain)).toBe("block");
		expect(resolvePolicyAction("medium", chain)).toBe("warn");
		expect(resolvePolicyAction("low", chain)).toBe("allow");

		expect(resolveGateVerdict("block", chain)).toBe("fail");
		expect(resolveGateVerdict("warn", chain)).toBe("pass");
		expect(resolveGateVerdict("allow", chain)).toBe("pass");
	});

	it("evaluates decision using a contract override", () => {
		const contract: HarnessContract = {
			version: "1.5.0",
			riskTierRules: {},
			policyChain: {
				tierToAction: {
					high: "warn",
					medium: "warn",
					low: "allow",
				},
				actionToVerdict: {
					allow: "pass",
					warn: "fail",
					block: "fail",
				},
			},
		};
		const chain = resolvePolicyChain(contract);
		expect(evaluatePolicyChainDecision("high", chain)).toEqual({
			tier: "high",
			action: "warn",
			verdict: "fail",
		});
	});
});
