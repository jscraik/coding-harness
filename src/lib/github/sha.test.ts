import { describe, expect, it } from "vitest";
import { ShaValidationError, isValidSha, validateSha } from "./sha.js";

describe("validateSha", () => {
	it("accepts valid 40-character lowercase hex SHA", () => {
		expect(() =>
			validateSha("0123456789abcdef0123456789abcdef01234567"),
		).not.toThrow();
		expect(() =>
			validateSha("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"),
		).not.toThrow();
	});

	it("rejects SHA with uppercase letters", () => {
		expect(() =>
			validateSha("A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0"),
		).toThrow(ShaValidationError);
	});

	it("rejects SHA that is too short", () => {
		expect(() => validateSha("abc123")).toThrow(ShaValidationError);
	});

	it("rejects SHA that is too long", () => {
		expect(() =>
			validateSha("0123456789abcdef0123456789abcdef0123456789"),
		).toThrow(ShaValidationError);
	});

	it("rejects SHA with invalid characters", () => {
		expect(() => validateSha("ghijklmnopqrstuvwxyz0123456789abcdef01")).toThrow(
			ShaValidationError,
		);
		expect(() =>
			validateSha("0123456789abcdef0123456789abcdef01234g!"),
		).toThrow(ShaValidationError);
	});

	it("rejects empty string", () => {
		expect(() => validateSha("")).toThrow(ShaValidationError);
	});

	it("throws ShaValidationError with correct message", () => {
		expect(() => validateSha("invalid")).toThrow("Invalid SHA format: invalid");
	});
});

describe("isValidSha", () => {
	it("returns true for valid SHA", () => {
		expect(isValidSha("0123456789abcdef0123456789abcdef01234567")).toBe(true);
		expect(isValidSha("ffffffffffffffffffffffffffffffffffffffff")).toBe(true);
	});

	it("returns false for invalid SHA", () => {
		expect(isValidSha("invalid")).toBe(false);
		expect(isValidSha("")).toBe(false);
		expect(isValidSha("ABC123")).toBe(false);
		expect(isValidSha("0123456789abcdef0123456789abcdef0123456")).toBe(false); // 39 chars
	});

	it("returns false for non-string values", () => {
		expect(isValidSha(null)).toBe(false);
		expect(isValidSha(undefined)).toBe(false);
		expect(isValidSha(123)).toBe(false);
		expect(isValidSha({})).toBe(false);
		expect(isValidSha([])).toBe(false);
	});

	it("acts as type guard", () => {
		const sha: unknown = "0123456789abcdef0123456789abcdef01234567";
		if (isValidSha(sha)) {
			// TypeScript should infer sha as string here
			expect(sha.length).toBe(40);
		}
	});
});
