import { describe, expect, it } from "vitest";
import {
	enforceEvidencePolicy,
	getFilesRequiringEvidence,
	isFormatAllowed,
	requiresEvidence,
	summarizePolicy,
} from "./policy.js";
import type { EvidenceFile, ImageFormat } from "./types.js";

describe("requiresEvidence", () => {
	it("returns true when file matches required pattern", () => {
		const result = requiresEvidence("src/ui/components/Button.tsx", [
			"src/ui/**/*.tsx",
		]);
		expect(result).toBe(true);
	});

	it("returns false when file does not match any pattern", () => {
		const result = requiresEvidence("src/lib/utils.ts", ["src/ui/**/*.tsx"]);
		expect(result).toBe(false);
	});

	it("matches multiple patterns", () => {
		const patterns = ["src/auth/**/*.ts", "src/payments/**/*.ts"];
		expect(requiresEvidence("src/auth/login.ts", patterns)).toBe(true);
		expect(requiresEvidence("src/payments/checkout.ts", patterns)).toBe(true);
		expect(requiresEvidence("src/lib/utils.ts", patterns)).toBe(false);
	});

	it("handles empty patterns array", () => {
		expect(requiresEvidence("src/ui/Button.tsx", [])).toBe(false);
	});
});

describe("isFormatAllowed", () => {
	it("returns true for allowed formats", () => {
		expect(isFormatAllowed("png", ["png", "jpeg"])).toBe(true);
		expect(isFormatAllowed("jpeg", ["png", "jpeg"])).toBe(true);
	});

	it("returns false for disallowed formats", () => {
		expect(isFormatAllowed("png", ["jpeg"])).toBe(false);
		expect(isFormatAllowed("jpeg", ["png"])).toBe(false);
	});

	it("handles single format policy", () => {
		expect(isFormatAllowed("png", ["png"])).toBe(true);
		expect(isFormatAllowed("jpeg", ["png"])).toBe(false);
	});
});

describe("enforceEvidencePolicy", () => {
	const mockEvidenceFile = (
		path: string,
		type: "png" | "jpeg",
	): EvidenceFile => ({
		path,
		type,
		sizeBytes: 1000,
	});

	it("passes when no violations exist", () => {
		const verifiedFiles = [mockEvidenceFile("evidence/button.png", "png")];
		const changedFiles = ["src/ui/Button.tsx"];
		const policy = {
			requiredFor: ["src/ui/**/*.tsx"],
			allowedTypes: ["png", "jpeg"] as ImageFormat[],
		};

		const result = enforceEvidencePolicy(verifiedFiles, changedFiles, policy);
		expect(result.passed).toBe(true);
		expect(result.violations).toHaveLength(0);
	});

	it("fails when evidence type is not allowed", () => {
		const verifiedFiles = [mockEvidenceFile("evidence/button.png", "png")];
		const changedFiles = ["src/ui/Button.tsx"];
		const policy = {
			requiredFor: ["src/ui/**/*.tsx"],
			allowedTypes: ["jpeg"] as ImageFormat[],
		};

		const result = enforceEvidencePolicy(verifiedFiles, changedFiles, policy);
		expect(result.passed).toBe(false);
		expect(result.violations).toHaveLength(1);
		expect(result.violations[0]?.code).toBe("INVALID_FORMAT");
	});

	it("fails when required evidence is missing", () => {
		const verifiedFiles: EvidenceFile[] = [];
		const changedFiles = ["src/ui/Button.tsx"];
		const policy = {
			requiredFor: ["src/ui/**/*.tsx"],
			allowedTypes: ["png", "jpeg"] as ImageFormat[],
		};

		const result = enforceEvidencePolicy(verifiedFiles, changedFiles, policy);
		expect(result.passed).toBe(false);
		expect(result.violations).toHaveLength(1);
		expect(result.violations[0]?.code).toBe("FILE_NOT_FOUND");
		expect(result.missingEvidence).toContain("src/ui/Button.tsx");
	});

	it("passes when changed files do not require evidence", () => {
		const verifiedFiles: EvidenceFile[] = [];
		const changedFiles = ["src/lib/utils.ts"];
		const policy = {
			requiredFor: ["src/ui/**/*.tsx"],
			allowedTypes: ["png", "jpeg"] as ImageFormat[],
		};

		const result = enforceEvidencePolicy(verifiedFiles, changedFiles, policy);
		expect(result.passed).toBe(true);
		expect(result.violations).toHaveLength(0);
	});

	it("accepts singular/plural basename matches without requiring exact extension", () => {
		const verifiedFiles = [mockEvidenceFile("evidence/buttons.png", "png")];
		const changedFiles = ["src/ui/Button.tsx"];
		const policy = {
			requiredFor: ["src/ui/**/*.tsx"],
			allowedTypes: ["png", "jpeg"] as ImageFormat[],
		};

		const result = enforceEvidencePolicy(verifiedFiles, changedFiles, policy);
		expect(result.passed).toBe(true);
		expect(result.violations).toHaveLength(0);
	});

	it("does not treat substring basename collisions as valid evidence", () => {
		const verifiedFiles = [
			mockEvidenceFile("evidence/authentication-flow.png", "png"),
		];
		const changedFiles = ["src/ui/auth.tsx"];
		const policy = {
			requiredFor: ["src/ui/**/*.tsx"],
			allowedTypes: ["png", "jpeg"] as ImageFormat[],
		};

		const result = enforceEvidencePolicy(verifiedFiles, changedFiles, policy);
		expect(result.passed).toBe(false);
		expect(
			result.violations.some(
				(violation) => violation.code === "FILE_NOT_FOUND",
			),
		).toBe(true);
		expect(result.missingEvidence).toContain("src/ui/auth.tsx");
	});

	it("does not treat supersets of unrelated basenames as valid evidence", () => {
		const verifiedFiles = [
			mockEvidenceFile("evidence/profile-summary.png", "png"),
		];
		const changedFiles = ["src/ui/file.tsx"];
		const policy = {
			requiredFor: ["src/ui/**/*.tsx"],
			allowedTypes: ["png", "jpeg"] as ImageFormat[],
		};

		const result = enforceEvidencePolicy(verifiedFiles, changedFiles, policy);
		expect(result.passed).toBe(false);
		expect(
			result.violations.some(
				(violation) => violation.code === "FILE_NOT_FOUND",
			),
		).toBe(true);
		expect(result.missingEvidence).toContain("src/ui/file.tsx");
	});

	it("handles multiple violations", () => {
		const verifiedFiles = [
			mockEvidenceFile("evidence/button.png", "png"),
			mockEvidenceFile("evidence/input.png", "png"),
		];
		const changedFiles = ["src/ui/Button.tsx", "src/ui/Input.tsx"];
		const policy = {
			requiredFor: ["src/ui/**/*.tsx"],
			allowedTypes: ["jpeg"] as ImageFormat[],
		};

		const result = enforceEvidencePolicy(verifiedFiles, changedFiles, policy);
		expect(result.passed).toBe(false);
		// 2 format violations + 2 missing evidence violations
		expect(result.violations.length).toBeGreaterThanOrEqual(2);
	});
});

describe("getFilesRequiringEvidence", () => {
	it("filters files matching required patterns", () => {
		const changedFiles = [
			"src/ui/Button.tsx",
			"src/lib/utils.ts",
			"src/ui/Modal.tsx",
		];
		const policy = {
			requiredFor: ["src/ui/**/*.tsx"],
			allowedTypes: ["png"] as ImageFormat[],
		};

		const result = getFilesRequiringEvidence(changedFiles, policy);
		expect(result).toEqual(["src/ui/Button.tsx", "src/ui/Modal.tsx"]);
	});

	it("returns empty array when no files match", () => {
		const changedFiles = ["src/lib/utils.ts", "src/auth/login.ts"];
		const policy = {
			requiredFor: ["src/ui/**/*.tsx"],
			allowedTypes: ["png"] as ImageFormat[],
		};

		const result = getFilesRequiringEvidence(changedFiles, policy);
		expect(result).toHaveLength(0);
	});
});

describe("summarizePolicy", () => {
	it("summarizes policy with required patterns", () => {
		const policy = {
			requiredFor: ["src/ui/**/*.tsx", "src/auth/**/*.ts"],
			allowedTypes: ["png", "jpeg"] as ImageFormat[],
			maxFileSizeBytes: 2 * 1024 * 1024,
		};

		const summary = summarizePolicy(policy);
		expect(summary).toContain("Evidence Policy:");
		expect(summary).toContain("Allowed types: png, jpeg");
		expect(summary).toContain("Max file size: 2MB");
		expect(summary).toContain("src/ui/**/*.tsx");
		expect(summary).toContain("src/auth/**/*.ts");
	});

	it("handles empty requiredFor", () => {
		const policy = {
			requiredFor: [],
			allowedTypes: ["png"] as ImageFormat[],
		};

		const summary = summarizePolicy(policy);
		expect(summary).toContain("No files require evidence");
	});
});
