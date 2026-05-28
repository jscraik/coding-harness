import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { composeDeliveryTruth } from "../delivery-truth/index.js";
import type { ActionReviewReceipt } from "./types.js";
import { validateActionReviewReceipt } from "./validation.js";

const EXAMPLE_PATH = "contracts/examples/action-review-receipt.example.json";
const VALIDATOR_PATH = "scripts/validate-action-review-receipt.cjs";

function example(): ActionReviewReceipt {
	return JSON.parse(readFileSync(EXAMPLE_PATH, "utf8")) as ActionReviewReceipt;
}

function validationCodes(packet: unknown): string[] {
	return validateActionReviewReceipt(packet).errors.map((error) => error.code);
}

function cjsValidationCodes(packet: unknown): string[] {
	mkdirSync(join(process.cwd(), ".cache"), { recursive: true });
	const badPath = join(process.cwd(), ".cache", "action-review-cjs-codes.json");
	writeFileSync(badPath, JSON.stringify(packet, null, 2));
	const result = spawnSync(process.execPath, [VALIDATOR_PATH, badPath], {
		cwd: process.cwd(),
		encoding: "utf8",
	});
	const report = JSON.parse(result.stdout) as {
		valid: boolean;
		errors: { code: string }[];
	};
	return report.errors.map((error) => error.code);
}

describe("ActionReviewReceipt/v1", () => {
	it("accepts the checked-in allow example", () => {
		expect(validateActionReviewReceipt(example())).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("keeps the CJS semantic validator aligned with the TypeScript validator", () => {
		const result = spawnSync(process.execPath, [VALIDATOR_PATH, EXAMPLE_PATH], {
			cwd: process.cwd(),
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			valid: true,
			errors: [],
		});
	});

	it("rejects allow when supporting evidence is stale or orientation-only", () => {
		const packet = example();
		const evidence = packet.requiredEvidence[0];
		expect(evidence).toBeDefined();
		packet.requiredEvidence[0] = {
			...evidence!,
			freshness: "stale",
			evidenceUse: "orientation",
		};

		expect(validationCodes(packet)).toEqual(
			expect.arrayContaining([
				"allow_requires_current_evidence",
				"allow_rejects_orientation_evidence",
			]),
		);
	});

	it("rejects allow when evidence head SHA differs from the action head SHA", () => {
		const packet = example();
		const evidence = packet.requiredEvidence[0];
		expect(evidence).toBeDefined();
		packet.requiredEvidence[0] = {
			...evidence!,
			headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		};

		expect(validationCodes(packet)).toContain("allow_head_sha_mismatch");
	});

	it("rejects canonical identity alias self-approval", () => {
		const packet = example();
		packet.reviewer = {
			...packet.reviewer,
			actorId: "github:jscraik-alias",
			identityRef: packet.requestedBy.identityRef,
		};

		expect(validationCodes(packet)).toContain("self_review_identity");
	});

	it("rejects obvious self-approval actor equivalence", () => {
		const packet = example();
		packet.reviewer = {
			...packet.reviewer,
			actorId: packet.requestedBy.actorId,
		};

		expect(validationCodes(packet)).toContain("self_review_actor");
	});

	it("rejects shared producer or source lineage masquerading as independent review", () => {
		const packet = example();
		packet.reviewer = {
			...packet.reviewer,
			actorId: "github:jscraik-alias",
			identityRef: "github-user:jscraik-alias",
			producer: packet.requestedBy.producer,
			sourceRef: packet.requestedBy.sourceRef,
		};

		expect(validationCodes(packet)).toEqual(
			expect.arrayContaining([
				"self_review_producer_lineage",
				"self_review_source",
			]),
		);
	});

	it("rejects allow when the review is already expired", () => {
		const packet = example();
		packet.expiresAt = "2026-05-28T10:29:00Z";

		expect(validationCodes(packet)).toContain("allow_expired");
	});

	it("requires blockers for block and unknown decisions", () => {
		for (const decision of ["block", "unknown"] as const) {
			const packet = { ...example(), decision };

			expect(validationCodes(packet)).toContain("blocked_requires_blocker");
		}
	});

	it("requires expected and actual envelopes for mismatch decisions", () => {
		const packet = { ...example(), decision: "mismatch" as const };

		expect(validationCodes(packet)).toContain("mismatch_requires_envelopes");
	});

	it("rejects not_applicable for high-risk action envelopes", () => {
		const packet = { ...example(), decision: "not_applicable" as const };

		expect(validationCodes(packet)).toContain(
			"not_applicable_rejected_for_high_risk_action",
		);
	});

	it("rejects raw or secret-like nested fields", () => {
		const packet = {
			...example(),
			rawCommandOutput: "gh pr merge 309 --auto",
		};

		expect(validationCodes(packet)).toContain("raw_or_secret_key");
	});

	it("rejects action-kind envelopes missing required target identity", () => {
		const packet = example();
		packet.action = { ...packet.action, prNumber: null };

		expect(validationCodes(packet)).toContain("missing_pr_number");
	});

	it("keeps TypeScript and CJS release repository requirements aligned", () => {
		const packet = example();
		packet.action = {
			...packet.action,
			kind: "release",
			prNumber: null,
			repository: null,
		};

		expect(validationCodes(packet)).toContain("missing_repository");
		expect(cjsValidationCodes(packet)).toContain("missing_repository");
	});

	it("rejects allow evidence with unsupported or mismatched authority refs", () => {
		const packet = example();
		packet.requiredEvidence[0] = {
			...packet.requiredEvidence[0]!,
			ref: "artifact:fake-delivery-truth",
		};

		expect(validationCodes(packet)).toContain(
			"allow_evidence_ref_kind_mismatch",
		);
	});

	it("requires the minimum evidence set for merge allow reviews", () => {
		const packet = example();
		packet.requiredEvidence = packet.requiredEvidence.filter(
			(evidence) => evidence.kind !== "external_state",
		);

		expect(validationCodes(packet)).toContain(
			"allow_missing_required_evidence",
		);
	});

	it("rejects impossible review and evidence timestamp ordering", () => {
		const packet = example();
		packet.reviewer = {
			...packet.reviewer,
			reviewedAt: "2026-05-28T10:19:00Z",
		};
		packet.requiredEvidence[0] = {
			...packet.requiredEvidence[0]!,
			verifiedAt: "2026-05-28T10:31:00Z",
		};

		expect(validationCodes(packet)).toEqual(
			expect.arrayContaining([
				"review_before_request",
				"evidence_after_generation",
			]),
		);
	});

	it("does not let action-review receipts support delivery-truth claims", () => {
		const verdict = composeDeliveryTruth({
			claim: "merge_ready",
			source: "pr_closeout",
			verifiedAt: "2026-05-28T10:31:00Z",
			verdictHeadSha: example().action.headSha,
			evidence: [
				{
					source: "pr_closeout",
					receipt: {
						schemaVersion: "evidence-receipt/v1",
						kind: "artifact",
						ref: "action-review:pr-309-merge-review",
						producer: "harness:action-review-validator",
						producedAt: "2026-05-28T10:30:00Z",
						verifiedAt: "2026-05-28T10:31:00Z",
						headSha: example().action.headSha,
						status: "pass",
						freshness: "current",
						evidenceUse: "claim_support",
						blockerClass: null,
					},
				},
			],
		});

		expect(verdict).toMatchObject({
			status: "blocked",
			blockerCode: "invalid_evidence_ref",
		});
	});

	it("emits machine-classifiable CJS error codes for agents", () => {
		mkdirSync(join(process.cwd(), ".cache"), { recursive: true });
		const badPath = join(
			process.cwd(),
			".cache",
			"action-review-receipt-invalid.json",
		);
		const packet = example();
		packet.decision = "not_applicable";
		writeFileSync(badPath, JSON.stringify(packet, null, 2));

		const result = spawnSync(process.execPath, [VALIDATOR_PATH, badPath], {
			cwd: process.cwd(),
			encoding: "utf8",
		});
		const report = JSON.parse(result.stdout) as {
			valid: boolean;
			errors: { code: string }[];
		};

		expect(result.status).toBe(1);
		expect(report.valid).toBe(false);
		expect(report.errors.map((error) => error.code)).toContain(
			"not_applicable_rejected_for_high_risk_action",
		);
	});
});
