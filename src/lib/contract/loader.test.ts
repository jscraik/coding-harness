import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadContract } from "./loader.js";

describe("loadContract", () => {
	const createdFiles: string[] = [];

	afterEach(() => {
		for (const filePath of createdFiles) {
			rmSync(filePath, { force: true });
		}
		createdFiles.length = 0;
	});

	it("loads a valid contract", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-valid.json");
		createdFiles.push(path);

		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				riskTierRules: { "src/**": "medium" },
			}),
			"utf-8",
		);

		const contract = loadContract(path);
		expect(contract.version).toBe("1.0");
		expect(contract.riskTierRules["src/**"]).toBe("medium");
	});

	it("loads valid loopStageContracts semantic parity data", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-loop-stage-contracts.json");
		createdFiles.push(path);

		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				loopStageContracts: {
					"risk-policy-gate": {
						inputs: ["changed_files", "harness.contract.json"],
						outputs: ["risk-policy-gate.result"],
						schema: "loop-stage-contract/v1",
						failPolicy: "fail_closed",
						if: "always()",
						permissions: ["contents:read", "pull-requests:read"],
						timeoutMinutes: 15,
						concurrency: "none",
					},
					"review-gate": {
						inputs: [
							"risk-policy-gate.result",
							"head_sha",
							"harness.contract.json",
						],
						outputs: ["review-gate.result"],
						schema: "loop-stage-contract/v1",
						failPolicy: "fail_closed",
						if: "always()",
						permissions: ["contents:read", "pull-requests:read"],
						timeoutMinutes: 15,
						concurrency: "none",
					},
					"evidence-verify": {
						inputs: [
							"review-gate.result",
							"evidence_files",
							"harness.contract.json",
						],
						outputs: ["evidence-verify.result", "browser-evidence-artifacts"],
						schema: "loop-stage-contract/v1",
						failPolicy: "fail_closed",
						if: "always()",
						permissions: ["contents:read"],
						timeoutMinutes: 15,
						concurrency: "none",
					},
					"remediation-decision": {
						inputs: [
							"evidence-verify.result",
							"findings.json",
							"harness.contract.json",
						],
						outputs: [
							"remediation-decision.result",
							"remediation-decision-artifacts",
						],
						schema: "loop-stage-contract/v1",
						failPolicy: "fail_closed",
						if: "always()",
						permissions: ["contents:read", "pull-requests:write"],
						timeoutMinutes: 15,
						concurrency: "none",
					},
				},
			}),
			"utf-8",
		);

		const contract = loadContract(path);
		expect(contract.loopStageContracts?.["review-gate"]?.schema).toBe(
			"loop-stage-contract/v1",
		);
	});

	it("enforces size limit using UTF-8 bytes, not character count", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-oversize.json");
		createdFiles.push(path);

		const largeEmojiValue = "😀".repeat(400_000);
		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				notes: largeEmojiValue,
			}),
			"utf-8",
		);

		expect(() => loadContract(path)).toThrow(/exceeds maximum size/i);
	});

	it("allows wide but shallow JSON payloads", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-wide.json");
		createdFiles.push(path);

		// Use a valid contract field (riskTierRules) to test wide/shallow JSON
		// Each key-value pair is at depth 1, so this shouldn't trigger depth limit
		const wideRiskTierRules: Record<string, string> = {};
		for (let i = 0; i < 250; i++) {
			wideRiskTierRules[`src/module${i}/**`] = "low";
		}

		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				riskTierRules: wideRiskTierRules,
			}),
			"utf-8",
		);

		const contract = loadContract(path);
		expect(contract.version).toBe("1.0");
		expect(Object.keys(contract.riskTierRules).length).toBe(250);
	});

	it("rejects excessively deep JSON payloads", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-deep.json");
		createdFiles.push(path);

		const deepObject: Record<string, unknown> = {};
		let current: Record<string, unknown> = deepObject;
		for (let i = 0; i < 110; i++) {
			current.next = {};
			current = current.next as Record<string, unknown>;
		}

		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				deepObject,
			}),
			"utf-8",
		);

		expect(() => loadContract(path)).toThrow(/depth exceeds maximum/i);
	});

	it("loads contracts with extends by default for inheritance-aware callers", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-extends.json");
		createdFiles.push(path);

		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				extends: "typescript-base",
				riskTierRules: {
					"src/auth/**": "high",
				},
			}),
			"utf-8",
		);

		const contract = loadContract(path);
		expect(contract.version).toBe("1.0");
		expect(contract.riskTierRules["src/auth/**"]).toBe("high");
	});

	it("rejects contracts with extends when caller disallows inheritance", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-extends-blocked.json");
		createdFiles.push(path);

		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				extends: "typescript-base",
			}),
			"utf-8",
		);

		expect(() =>
			loadContract(path, process.cwd(), { allowExtends: false }),
		).toThrow(/extends/i);
	});

	describe("merge policy dual-shape support", () => {
		it("accepts legacy array-style merge policy", () => {
			const dir = join(process.cwd(), "artifacts");
			mkdirSync(dir, { recursive: true });
			const path = join(dir, "contract-loader-legacy-merge.json");
			createdFiles.push(path);

			writeFileSync(
				path,
				JSON.stringify({
					version: "1.0",
					mergePolicy: {
						high: ["review-gate", "evidence-verify"],
						medium: ["review-gate"],
						low: [],
					},
				}),
				"utf-8",
			);

			const contract = loadContract(path);
			expect(contract.mergePolicy).toEqual({
				high: ["review-gate", "evidence-verify"],
				medium: ["review-gate"],
				low: [],
			});
		});

		it("accepts roadmap object-style merge policy and normalizes to array", () => {
			const dir = join(process.cwd(), "artifacts");
			mkdirSync(dir, { recursive: true });
			const path = join(dir, "contract-loader-roadmap-merge.json");
			createdFiles.push(path);

			writeFileSync(
				path,
				JSON.stringify({
					version: "1.0",
					mergePolicy: {
						high: { requiredChecks: ["review-gate", "evidence-verify"] },
						medium: { requiredChecks: ["review-gate"] },
						low: { requiredChecks: [] },
					},
				}),
				"utf-8",
			);

			const contract = loadContract(path);
			// Should be normalized to array form
			expect(contract.mergePolicy).toEqual({
				high: ["review-gate", "evidence-verify"],
				medium: ["review-gate"],
				low: [],
			});
		});

		it("accepts mixed legacy and roadmap shapes and normalizes", () => {
			const dir = join(process.cwd(), "artifacts");
			mkdirSync(dir, { recursive: true });
			const path = join(dir, "contract-loader-mixed-merge.json");
			createdFiles.push(path);

			writeFileSync(
				path,
				JSON.stringify({
					version: "1.0",
					mergePolicy: {
						high: { requiredChecks: ["review-gate"] }, // roadmap style
						medium: ["review-gate"], // legacy style
						low: [], // legacy style
					},
				}),
				"utf-8",
			);

			const contract = loadContract(path);
			// All should be normalized to array form
			expect(contract.mergePolicy).toEqual({
				high: ["review-gate"],
				medium: ["review-gate"],
				low: [],
			});
		});

		it("rejects invalid roadmap merge policy with missing requiredChecks", () => {
			const dir = join(process.cwd(), "artifacts");
			mkdirSync(dir, { recursive: true });
			const path = join(dir, "contract-loader-invalid-roadmap.json");
			createdFiles.push(path);

			writeFileSync(
				path,
				JSON.stringify({
					version: "1.0",
					mergePolicy: {
						high: { invalidKey: ["review-gate"] }, // missing requiredChecks
					},
				}),
				"utf-8",
			);

			expect(() => loadContract(path)).toThrow(/validation failed/i);
		});
	});
});
