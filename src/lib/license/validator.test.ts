import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LICENSE_FILE_NAMES, validateLicense } from "./validator.js";

describe("validator", () => {
	describe("LICENSE_FILE_NAMES", () => {
		it("should include common license file names", () => {
			expect(LICENSE_FILE_NAMES).toContain("LICENSE");
			expect(LICENSE_FILE_NAMES).toContain("LICENSE.md");
			expect(LICENSE_FILE_NAMES).toContain("LICENSE.txt");
			expect(LICENSE_FILE_NAMES).toContain("COPYING");
		});
	});

	describe("validateLicense", () => {
		it("should detect MIT license from package.json", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "package.json"),
				JSON.stringify({ name: "test", license: "MIT" }),
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["MIT"],
			});

			expect(result.licenseFound).toBe(true);
			expect(result.spdxId).toBe("MIT");
			expect(result.allowed).toBe(true);
			expect(result.osiApproved).toBe(true);
			expect(result.copyleft).toBe(false);
			expect(result.confidence).toBe("high");
			expect(result.errors).toHaveLength(0);
		});

		it("should detect Apache-2.0 license from package.json", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "package.json"),
				JSON.stringify({ name: "test", license: "Apache-2.0" }),
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["MIT", "Apache-2.0"],
			});

			expect(result.licenseFound).toBe(true);
			expect(result.spdxId).toBe("Apache-2.0");
			expect(result.allowed).toBe(true);
		});

		it("should detect license from object format in package.json", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "package.json"),
				JSON.stringify({
					name: "test",
					licenses: [
						{ type: "MIT", url: "https://opensource.org/licenses/MIT" },
					],
				}),
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["MIT"],
			});

			expect(result.licenseFound).toBe(true);
			expect(result.spdxId).toBe("MIT");
		});

		it("should detect license from LICENSE file", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "LICENSE"),
				"MIT License\n\nCopyright (c) 2024\n\nPermission is hereby granted...",
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["MIT"],
			});

			expect(result.licenseFound).toBe(true);
			expect(result.spdxId).toBe("MIT");
			expect(result.licenseFile).toBe("LICENSE");
		});

		it("should detect Apache license from LICENSE file", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "LICENSE.md"),
				"Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/",
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["Apache-2.0"],
			});

			expect(result.licenseFound).toBe(true);
			expect(result.spdxId).toBe("Apache-2.0");
		});

		it("should detect SPDX identifier in LICENSE file", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "LICENSE"),
				"SPDX-License-Identifier: MIT\n\nSome additional text...",
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["MIT"],
			});

			expect(result.licenseFound).toBe(true);
			expect(result.spdxId).toBe("MIT");
		});

		it("should report error for disallowed license", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "package.json"),
				JSON.stringify({ name: "test", license: "GPL-3.0" }),
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["MIT", "Apache-2.0"],
			});

			expect(result.licenseFound).toBe(true);
			expect(result.spdxId).toBe("GPL-3.0");
			expect(result.allowed).toBe(false);
			expect(result.errors).toContain(
				'License "GPL-3.0" is not in the allowed licenses list',
			);
		});

		it("should report error when no license found", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "package.json"),
				JSON.stringify({ name: "test" }),
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["MIT"],
			});

			expect(result.licenseFound).toBe(false);
			expect(result.errors).toContain("No valid open-source license detected");
		});

		it("should enforce OSI approval when required", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "package.json"),
				JSON.stringify({ name: "test", license: "BSD-3-Clause" }),
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["BSD-3-Clause"],
				requireOsiApproved: true,
			});

			expect(result.licenseFound).toBe(true);
			expect(result.osiApproved).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should reject copyleft when not allowed", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "package.json"),
				JSON.stringify({ name: "test", license: "GPL-3.0" }),
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["GPL-3.0"],
				allowCopyleft: false,
			});

			expect(result.licenseFound).toBe(true);
			expect(result.copyleft).toBe(true);
			expect(result.errors).toContain(
				'License "GPL-3.0" is copyleft and copyleft is not allowed',
			);
		});

		it("should allow copyleft by default", () => {
			const tmpDir = mkdtempSync(join(tmpdir(), "license-test-"));
			writeFileSync(
				join(tmpDir, "package.json"),
				JSON.stringify({ name: "test", license: "GPL-3.0" }),
			);

			const result = validateLicense({
				repoRoot: tmpDir,
				allowedLicenses: ["GPL-3.0"],
			});

			expect(result.licenseFound).toBe(true);
			expect(result.copyleft).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});
});
