import { describe, expect, it } from "vitest";
import {
	MIN_SNAPSHOT_SIGNING_KEY_BYTES,
	SNAPSHOT_SIGNING_KEY_ENV,
	hashContent,
	resolveSnapshotSigningKey,
	signContent,
} from "./ci-migrate-signing.js";

describe("ci-migrate-signing", () => {
	it("hashContent returns deterministic sha256 hex", () => {
		expect(hashContent("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("signContent returns deterministic hmac sha256 hex", () => {
		expect(signContent("payload", "secret-key")).toBe(
			"10aa2e1c2538464ff75f0647271e3ba746bca3fcdeaf322c581bf5851e8cddb7",
		);
	});

	it("resolveSnapshotSigningKey rejects missing key", () => {
		const result = resolveSnapshotSigningKey({});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain(SNAPSHOT_SIGNING_KEY_ENV);
			expect(result.error).toContain("required");
		}
	});

	it("resolveSnapshotSigningKey rejects short key", () => {
		const result = resolveSnapshotSigningKey({
			[SNAPSHOT_SIGNING_KEY_ENV]: "short",
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain(`${MIN_SNAPSHOT_SIGNING_KEY_BYTES} bytes`);
		}
	});

	it("resolveSnapshotSigningKey returns trimmed key and stable keyId", () => {
		const result = resolveSnapshotSigningKey({
			[SNAPSHOT_SIGNING_KEY_ENV]: "  1234567890abcdef  ",
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.key).toBe("1234567890abcdef");
			expect(result.keyId).toHaveLength(16);
		}
	});
});
