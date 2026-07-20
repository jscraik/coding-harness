import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateActionReviewReceipt } from "../lib/action-review/index.js";
import { validateArtifactRuntimeSurface } from "../lib/artifact-runtime-surface/index.js";
import { validateHarnessDecision } from "../lib/decision/harness-decision.js";
import { composeDeliveryTruth } from "../lib/delivery-truth/index.js";
import { validateEvidenceReceipt } from "../lib/evidence/evidence-receipt.js";
import { validateExternalStateSnapshot } from "../lib/external-state/index.js";
import { validateIntermediaryReceiptCoverage } from "../lib/intermediary-receipts/index.js";
import { validatePromptContextReceipt } from "../lib/prompt-context/index.js";
import {
	validateReviewLifecyclePacket,
	validateReviewStatePacket,
} from "../lib/review-state/index.js";
import { validateRuntimeCard } from "../lib/runtime/runtime-card.js";
import { validateRuntimeCardHandoff } from "../lib/runtime/runtime-card-handoff.js";
import { validateSteeringApplicationReceipt } from "../lib/steering-queue/index.js";

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

describe("runtime packet checked-in example parity", () => {
	it("passes the checked-in runtime packet schema manifest", () => {
		const result = spawnSync(
			process.execPath,
			["scripts/validate-runtime-packet-schemas.cjs", "--all"],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			schemaVersion: "runtime-packet-schema-validation/v1",
			status: "pass",
			packetCount: 28,
			errors: [],
		});
	});

	it("keeps checked-in examples accepted by existing TypeScript validators", () => {
		const evidenceReceipt = readJson(
			"contracts/examples/evidence-receipt.example.json",
		);
		const runtimeCard = readJson(
			"contracts/examples/runtime-card.example.json",
		);
		const runtimeCardHandoff = readJson(
			"contracts/examples/runtime-card-handoff.example.json",
		);
		const harnessDecision = readJson(
			"contracts/examples/harness-decision.example.json",
		);
		const reviewState = readJson(
			"contracts/examples/review-state.example.json",
		);
		const externalState = readJson(
			"contracts/examples/external-state-snapshot.example.json",
		);
		const promptContextReceipt = readJson(
			"contracts/examples/prompt-context-receipt.example.json",
		);
		const reviewLifecycle = readJson(
			"contracts/examples/review-lifecycle.example.json",
		);
		const intermediaryReceiptCoverage = readJson(
			"contracts/examples/intermediary-receipt-coverage.example.json",
		);
		const steeringApplicationReceipt = readJson(
			"contracts/examples/steering-application-receipt.example.json",
		);
		const actionReviewReceipt = readJson(
			"contracts/examples/action-review-receipt.example.json",
		);
		const artifactRuntimeSurface = readJson(
			"contracts/examples/artifact-runtime-surface.example.json",
		);

		expect(validateEvidenceReceipt(evidenceReceipt)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateRuntimeCard(runtimeCard)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateRuntimeCardHandoff(runtimeCardHandoff)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateHarnessDecision(harnessDecision)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateReviewStatePacket(reviewState)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateExternalStateSnapshot(externalState)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validatePromptContextReceipt(promptContextReceipt)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateReviewLifecyclePacket(reviewLifecycle)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(
			validateIntermediaryReceiptCoverage(intermediaryReceiptCoverage),
		).toMatchObject({ valid: true, errors: [] });
		expect(
			validateSteeringApplicationReceipt(steeringApplicationReceipt),
		).toMatchObject({ valid: true, errors: [] });
		expect(validateActionReviewReceipt(actionReviewReceipt)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(
			validateArtifactRuntimeSurface(artifactRuntimeSurface),
		).toMatchObject({
			valid: true,
			errors: [],
		});
	});

	it("keeps the delivery-truth example aligned to the composer output", () => {
		const example = readJson("contracts/examples/delivery-truth.example.json");
		const verdict = composeDeliveryTruth({
			claim: "remote_checks_current",
			source: "external_state",
			verifiedAt: "2026-05-25T10:15:00Z",
			verdictHeadSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			evidence: [
				{
					source: "external_state",
					externalStateSources: ["github_checks", "circleci"],
					receipt: {
						schemaVersion: "evidence-receipt/v1",
						kind: "external_state",
						ref: "external-state:fixture.json",
						producer: "external-state",
						producedAt: "2026-05-25T10:10:00Z",
						verifiedAt: "2026-05-25T10:15:00Z",
						headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						status: "pass",
						freshness: "current",
						evidenceUse: "claim_support",
						blockerClass: null,
					},
				},
			],
		});

		expect(verdict).toEqual(example);
	});
});
