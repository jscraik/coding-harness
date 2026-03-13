import { describe, expect, it } from "vitest";
import {
	ALL_LICENSES,
	COPYLEFT_LICENSES,
	OSI_APPROVED_IDS,
	PERMISSIVE_LICENSES,
	getLicenseBySpdxId,
	isCopyleft,
	isLicenseAllowed,
	isOsiApproved,
} from "./spdx.js";

describe("spdx", () => {
	describe("PERMISSIVE_LICENSES", () => {
		it("should contain MIT license", () => {
			const mit = PERMISSIVE_LICENSES.find((l) => l.spdxId === "MIT");
			expect(mit).toBeDefined();
			expect(mit?.osiApproved).toBe(true);
			expect(mit?.copyleft).toBe(false);
		});

		it("should contain Apache-2.0 license", () => {
			const apache = PERMISSIVE_LICENSES.find((l) => l.spdxId === "Apache-2.0");
			expect(apache).toBeDefined();
			expect(apache?.osiApproved).toBe(true);
			expect(apache?.copyleft).toBe(false);
		});

		it("should contain BSD licenses", () => {
			const bsd2 = PERMISSIVE_LICENSES.find((l) => l.spdxId === "BSD-2-Clause");
			const bsd3 = PERMISSIVE_LICENSES.find((l) => l.spdxId === "BSD-3-Clause");
			expect(bsd2).toBeDefined();
			expect(bsd3).toBeDefined();
		});

		it("should mark all permissive licenses as non-copyleft", () => {
			for (const license of PERMISSIVE_LICENSES) {
				expect(license.copyleft).toBe(false);
			}
		});
	});

	describe("COPYLEFT_LICENSES", () => {
		it("should contain GPL licenses", () => {
			const gpl3 = COPYLEFT_LICENSES.find((l) => l.spdxId === "GPL-3.0");
			const gpl2 = COPYLEFT_LICENSES.find((l) => l.spdxId === "GPL-2.0");
			expect(gpl3).toBeDefined();
			expect(gpl2).toBeDefined();
		});

		it("should contain LGPL licenses", () => {
			const lgpl3 = COPYLEFT_LICENSES.find((l) => l.spdxId === "LGPL-3.0");
			const lgpl2 = COPYLEFT_LICENSES.find((l) => l.spdxId === "LGPL-2.1");
			expect(lgpl3).toBeDefined();
			expect(lgpl2).toBeDefined();
		});

		it("should contain AGPL-3.0 license", () => {
			const agpl = COPYLEFT_LICENSES.find((l) => l.spdxId === "AGPL-3.0");
			expect(agpl).toBeDefined();
		});

		it("should contain MPL-2.0 license", () => {
			const mpl = COPYLEFT_LICENSES.find((l) => l.spdxId === "MPL-2.0");
			expect(mpl).toBeDefined();
		});

		it("should mark all copyleft licenses as copyleft", () => {
			for (const license of COPYLEFT_LICENSES) {
				expect(license.copyleft).toBe(true);
			}
		});
	});

	describe("ALL_LICENSES", () => {
		it("should combine permissive and copyleft licenses", () => {
			expect(ALL_LICENSES.length).toBe(
				PERMISSIVE_LICENSES.length + COPYLEFT_LICENSES.length,
			);
		});

		it("should have unique SPDX IDs", () => {
			const ids = ALL_LICENSES.map((l) => l.spdxId);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(ids.length);
		});
	});

	describe("OSI_APPROVED_IDS", () => {
		it("should include all licenses that are OSI-approved", () => {
			const approvedCount = ALL_LICENSES.filter((l) => l.osiApproved).length;
			expect(OSI_APPROVED_IDS.length).toBe(approvedCount);
		});
	});

	describe("getLicenseBySpdxId", () => {
		it("should find license by exact SPDX ID", () => {
			const mit = getLicenseBySpdxId("MIT");
			expect(mit).toBeDefined();
			expect(mit?.spdxId).toBe("MIT");
		});

		it("should find license by lowercase SPDX ID", () => {
			const mit = getLicenseBySpdxId("mit");
			expect(mit).toBeDefined();
			expect(mit?.spdxId).toBe("MIT");
		});

		it("should find license by alias", () => {
			const mit = getLicenseBySpdxId("MIT License");
			expect(mit).toBeDefined();
			expect(mit?.spdxId).toBe("MIT");
		});

		it("should find Apache-2.0 by various forms", () => {
			expect(getLicenseBySpdxId("Apache-2.0")?.spdxId).toBe("Apache-2.0");
			expect(getLicenseBySpdxId("Apache 2.0")?.spdxId).toBe("Apache-2.0");
			expect(getLicenseBySpdxId("apache-2.0")?.spdxId).toBe("Apache-2.0");
		});

		it("should return undefined for unknown license", () => {
			const result = getLicenseBySpdxId("UNKNOWN-LICENSE");
			expect(result).toBeUndefined();
		});

		it("should handle whitespace in input", () => {
			const mit = getLicenseBySpdxId("  MIT  ");
			expect(mit).toBeDefined();
			expect(mit?.spdxId).toBe("MIT");
		});
	});

	describe("isLicenseAllowed", () => {
		it("should return true for allowed licenses", () => {
			const allowed = ["MIT", "Apache-2.0"];
			expect(isLicenseAllowed("MIT", allowed)).toBe(true);
			expect(isLicenseAllowed("Apache-2.0", allowed)).toBe(true);
		});

		it("should return false for disallowed licenses", () => {
			const allowed = ["MIT"];
			expect(isLicenseAllowed("GPL-3.0", allowed)).toBe(false);
			expect(isLicenseAllowed("Apache-2.0", allowed)).toBe(false);
		});

		it("should be case-insensitive", () => {
			const allowed = ["MIT", "apache-2.0"];
			expect(isLicenseAllowed("mit", allowed)).toBe(true);
			expect(isLicenseAllowed("APACHE-2.0", allowed)).toBe(true);
		});

		it("should handle variations in hyphenation", () => {
			const allowed = ["Apache-2.0"];
			expect(isLicenseAllowed("Apache2.0", allowed)).toBe(true);
		});
	});

	describe("isOsiApproved", () => {
		it("should return true for OSI-approved licenses", () => {
			expect(isOsiApproved("MIT")).toBe(true);
			expect(isOsiApproved("Apache-2.0")).toBe(true);
			expect(isOsiApproved("GPL-3.0")).toBe(true);
		});

		it("should return false for unknown licenses", () => {
			expect(isOsiApproved("UNKNOWN")).toBe(false);
		});
	});

	describe("isCopyleft", () => {
		it("should return true for copyleft licenses", () => {
			expect(isCopyleft("GPL-3.0")).toBe(true);
			expect(isCopyleft("GPL-2.0")).toBe(true);
			expect(isCopyleft("AGPL-3.0")).toBe(true);
			expect(isCopyleft("MPL-2.0")).toBe(true);
		});

		it("should return false for permissive licenses", () => {
			expect(isCopyleft("MIT")).toBe(false);
			expect(isCopyleft("Apache-2.0")).toBe(false);
			expect(isCopyleft("BSD-3-Clause")).toBe(false);
		});

		it("should return false for unknown licenses", () => {
			expect(isCopyleft("UNKNOWN")).toBe(false);
		});
	});
});
