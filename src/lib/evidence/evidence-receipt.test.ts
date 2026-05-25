import { describe, expect, it } from "vitest";
import {
	EVIDENCE_RECEIPT_FRESHNESS,
	EVIDENCE_RECEIPT_KINDS,
	EVIDENCE_RECEIPT_STATUSES,
	EVIDENCE_RECEIPT_USES,
	validateEvidenceReceipt,
} from "./evidence-receipt.js";

function validReceipt(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		schemaVersion: "evidence-receipt/v1",
		kind: "validation",
		ref: "artifacts/validation/receipt.json",
		producer: "pnpm vitest",
		producedAt: "2026-05-24T23:30:00Z",
		verifiedAt: "2026-05-24T23:30:00Z",
		status: "pass",
		freshness: "current",
		evidenceUse: "claim_support",
		blockerClass: null,
		headSha: "d4433929d5d69c62db16f2ff1a6ad77a12a20853",
		sizeBytes: 1234,
		checksum: "sha256:abc123",
		...overrides,
	};
}

describe("validateEvidenceReceipt", () => {
	it("accepts a complete evidence-receipt/v1", () => {
		expect(validateEvidenceReceipt(validReceipt())).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("accepts every planned receipt kind", () => {
		for (const kind of EVIDENCE_RECEIPT_KINDS) {
			expect(validateEvidenceReceipt(validReceipt({ kind }))).toEqual({
				valid: true,
				errors: [],
			});
		}
	});

	it("accepts every status, freshness, and evidence-use enum", () => {
		for (const status of EVIDENCE_RECEIPT_STATUSES) {
			expect(validateEvidenceReceipt(validReceipt({ status })).valid).toBe(
				true,
			);
		}
		for (const freshness of EVIDENCE_RECEIPT_FRESHNESS) {
			expect(validateEvidenceReceipt(validReceipt({ freshness })).valid).toBe(
				true,
			);
		}
		for (const evidenceUse of EVIDENCE_RECEIPT_USES) {
			expect(validateEvidenceReceipt(validReceipt({ evidenceUse })).valid).toBe(
				true,
			);
		}
	});

	it("allows producedAt-only or verifiedAt-only receipts", () => {
		const producedAtOnly = validReceipt({ verifiedAt: undefined });
		const verifiedAtOnly = validReceipt({ producedAt: undefined });

		expect(validateEvidenceReceipt(producedAtOnly).valid).toBe(true);
		expect(validateEvidenceReceipt(verifiedAtOnly).valid).toBe(true);
	});

	it("accepts valid leap-day timestamps", () => {
		expect(
			validateEvidenceReceipt(
				validReceipt({
					producedAt: "2024-02-29T23:30:00Z",
					verifiedAt: "2024-02-29T23:30:00+00:00",
				}),
			).valid,
		).toBe(true);
	});

	it("rejects missing required fields", () => {
		const receipt = validReceipt();
		delete receipt.ref;
		delete receipt.producer;
		delete receipt.producedAt;
		delete receipt.verifiedAt;

		const result = validateEvidenceReceipt(receipt);

		expect(result.valid).toBe(false);
		expect(result.errors.map(({ path }) => path)).toEqual(
			expect.arrayContaining(["ref", "producer", "producedAt"]),
		);
	});

	it("rejects invalid enum values", () => {
		const result = validateEvidenceReceipt(
			validReceipt({
				kind: "unknown_kind",
				status: "done",
				freshness: "fresh",
				evidenceUse: "proof",
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors.map(({ path }) => path)).toEqual(
			expect.arrayContaining(["kind", "status", "freshness", "evidenceUse"]),
		);
	});

	it("rejects invalid artifact receipt sizes", () => {
		for (const sizeBytes of [-1, 1.5, "123"]) {
			const result = validateEvidenceReceipt(validReceipt({ sizeBytes }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ path: "sizeBytes" }),
			);
		}
	});

	it("rejects empty optional metadata strings when present", () => {
		const result = validateEvidenceReceipt(
			validReceipt({
				blockerClass: "",
				headSha: "   ",
				checksum: "",
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors.map(({ path }) => path)).toEqual(
			expect.arrayContaining(["blockerClass", "headSha", "checksum"]),
		);
	});

	it("rejects malformed timestamps", () => {
		const result = validateEvidenceReceipt(
			validReceipt({
				producedAt: "tomorrow-ish",
				verifiedAt: "2026/05/24 23:30",
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors.map(({ path }) => path)).toEqual(
			expect.arrayContaining(["producedAt", "verifiedAt"]),
		);
	});

	it("rejects impossible ISO-shaped calendar timestamps", () => {
		const result = validateEvidenceReceipt(
			validReceipt({
				producedAt: "2026-02-31T00:00:00Z",
				verifiedAt: "2025-02-29T00:00:00Z",
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors.map(({ path }) => path)).toEqual(
			expect.arrayContaining(["producedAt", "verifiedAt"]),
		);
	});

	it("rejects receipts verified before they are produced", () => {
		const result = validateEvidenceReceipt(
			validReceipt({
				producedAt: "2026-05-24T23:30:00Z",
				verifiedAt: "2026-05-24T22:30:00Z",
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: "verifiedAt must not be earlier than producedAt",
				path: "verifiedAt",
			}),
		);
	});

	it("rejects non-object receipts", () => {
		expect(validateEvidenceReceipt(null)).toEqual({
			valid: false,
			errors: [
				{
					code: "receipt must be an object",
					path: "receipt",
					severity: "error",
				},
			],
		});
	});

	it("rejects array receipts", () => {
		expect(validateEvidenceReceipt([])).toEqual({
			valid: false,
			errors: [
				{
					code: "receipt must be an object",
					path: "receipt",
					severity: "error",
				},
			],
		});
	});
});
