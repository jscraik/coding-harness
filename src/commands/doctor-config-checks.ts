import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateContract } from "../lib/contract/validator.js";
import { hasJsonKey, readJsonFile } from "./doctor-check-utils.js";
import type { DoctorCheckFn } from "./doctor-checks.js";

/** Harness contract configuration checks used by harness doctor. */
export const DOCTOR_CONFIG_CHECKS: DoctorCheckFn[] = [
	// ── Config: north-star contract surfaces ──────────────────────────────────
	(dir) => {
		const contractPath = resolve(dir, "harness.contract.json");
		if (!existsSync(contractPath)) {
			return {
				id: "config:north-star-contract",
				category: "config",
				label: "contract: northStar/productSurface/overrideReviewerRegistry",
				status: "skip",
				message: "skipped — harness.contract.json not found",
			};
		}
		const contract = readJsonFile(contractPath);
		const validation = validateContract(contract);
		if (!validation.success) {
			return {
				id: "config:north-star-contract",
				category: "config",
				label: "contract: northStar/productSurface/overrideReviewerRegistry",
				status: "fail",
				message:
					"harness.contract.json is invalid, so north-star runtime readiness cannot be verified",
				fix: "Run harness contract validate and repair the reported contract errors",
			};
		}
		const contractData = validation.data;
		if (!contractData) {
			return {
				id: "config:north-star-contract",
				category: "config",
				label: "contract: northStar/productSurface/overrideReviewerRegistry",
				status: "fail",
				message:
					"harness.contract.json validated without returning contract data; north-star readiness cannot be verified",
				fix: "Re-run harness contract validate and repair the contract serialization path",
			};
		}

		if (!contractData.northStar) {
			return {
				id: "config:north-star-contract",
				category: "config",
				label: "contract: northStar/productSurface/overrideReviewerRegistry",
				status: "fail",
				message:
					"northStar block missing — runtime north-star contract is not load-bearing",
				fix: "Add canonical northStar fields to harness.contract.json",
			};
		}
		if (
			!contractData.productSurface ||
			contractData.productSurface.surfaces.length === 0
		) {
			return {
				id: "config:north-star-contract",
				category: "config",
				label: "contract: northStar/productSurface/overrideReviewerRegistry",
				status: "fail",
				message:
					"productSurface registry missing or empty — governed north-star surfaces are not explicit",
				fix: "Register canonical command/document surfaces in productSurface.surfaces",
			};
		}
		if (
			!contractData.overrideReviewerRegistry ||
			contractData.overrideReviewerRegistry.trustedReviewers.length === 0
		) {
			return {
				id: "config:north-star-contract",
				category: "config",
				label: "contract: northStar/productSurface/overrideReviewerRegistry",
				status: "fail",
				message:
					"overrideReviewerRegistry is missing or empty — north-star override trust cannot be verified",
				fix: "Declare at least one active trusted reviewer in overrideReviewerRegistry",
			};
		}

		const ownedPaths = new Set(
			contractData.productSurface.surfaces.flatMap(
				(surface) => surface.ownedPaths,
			),
		);
		const missingOwnedPaths = [
			"README.md",
			"docs/roadmap/north-star.md",
			"docs/roadmap/agent-first-status.md",
		].filter((pathValue) => !ownedPaths.has(pathValue));
		if (missingOwnedPaths.length > 0) {
			return {
				id: "config:north-star-contract",
				category: "config",
				label: "contract: northStar/productSurface/overrideReviewerRegistry",
				status: "warn",
				message: `productSurface coverage is missing canonical ownedPaths: ${missingOwnedPaths.join(", ")}`,
				fix: "Add README and roadmap/status files to productSurface.surfaces[].ownedPaths",
			};
		}

		return {
			id: "config:north-star-contract",
			category: "config",
			label: "contract: northStar/productSurface/overrideReviewerRegistry",
			status: "ok",
			message: "canonical north-star runtime surfaces are present",
		};
	},

	// ── Config: contextIntegrityPolicy in contract ────────────────────────────
	(dir) => {
		const contractPath = resolve(dir, "harness.contract.json");
		if (!existsSync(contractPath)) {
			return {
				id: "config:contextIntegrityPolicy",
				category: "config",
				label: "contract: contextIntegrityPolicy",
				status: "skip",
				message: "skipped — harness.contract.json not found",
			};
		}
		const contract = readJsonFile(contractPath);
		if (!hasJsonKey(contract, "contextIntegrityPolicy")) {
			return {
				id: "config:contextIntegrityPolicy",
				category: "config",
				label: "contract: contextIntegrityPolicy",
				status: "warn",
				message:
					"contextIntegrityPolicy missing from harness.contract.json — context-health will fail",
				fix: "Add contextIntegrityPolicy section to harness.contract.json (see docs/agents/00-architecture-bootstrap.md)",
			};
		}
		return {
			id: "config:contextIntegrityPolicy",
			category: "config",
			label: "contract: contextIntegrityPolicy",
			status: "ok",
			message: "present",
		};
	},

	// ── Config: ciProviderPolicy in contract ──────────────────────────────────
	(dir) => {
		const contractPath = resolve(dir, "harness.contract.json");
		if (!existsSync(contractPath)) {
			return {
				id: "config:ciProviderPolicy",
				category: "config",
				label: "contract: ciProviderPolicy",
				status: "skip",
				message: "skipped — harness.contract.json not found",
			};
		}
		const contract = readJsonFile(contractPath);
		if (!hasJsonKey(contract, "ciProviderPolicy")) {
			return {
				id: "config:ciProviderPolicy",
				category: "config",
				label: "contract: ciProviderPolicy",
				status: "warn",
				message: "ciProviderPolicy missing — ci-migrate verify will fail",
				fix: "Run: harness ci-migrate init  to generate the policy block",
			};
		}
		return {
			id: "config:ciProviderPolicy",
			category: "config",
			label: "contract: ciProviderPolicy",
			status: "ok",
			message: "present",
		};
	},
];
