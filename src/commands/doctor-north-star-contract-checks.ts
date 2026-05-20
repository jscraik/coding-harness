import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { validateContract } from "../lib/contract/validator.js";
import { readJsonFile } from "./doctor-check-utils.js";
import type { DoctorCheckFn } from "./doctor-checks.js";

const NORTH_STAR_CHECK_ID = "config:north-star-contract";
const NORTH_STAR_CHECK_LABEL =
	"contract: northStar/productSurface/overrideReviewerRegistry";
const CANONICAL_NORTH_STAR_OWNED_PATHS = [
	"README.md",
	"docs/roadmap/north-star.md",
	"docs/roadmap/agent-first-status.md",
] as const;

function northStarContractCheck(
	status: "ok" | "warn" | "fail" | "skip",
	message: string,
	fix?: string,
) {
	return {
		id: NORTH_STAR_CHECK_ID,
		category: "config" as const,
		label: NORTH_STAR_CHECK_LABEL,
		status,
		message,
		...(fix ? { fix } : {}),
	};
}

/**
 * North-star contract readiness checks used by harness doctor.
 *
 * This exported array contains {@link DoctorCheckFn} checks that validate
 * the presence and completeness of the north-star runtime contract, including
 * the `northStar`, `productSurface`, and `overrideReviewerRegistry` blocks
 * in `harness.contract.json`.
 *
 * Each check runs independently and may return `ok`, `warn`, `fail`, or `skip`
 * status values. The checks verify canonical north-star surfaces (README, roadmap)
 * and trust registries required for override approval.
 *
 * @type {DoctorCheckFn[]}
 * @public
 */
export const DOCTOR_NORTH_STAR_CONTRACT_CHECKS: DoctorCheckFn[] = [
	(dir) => {
		const contractPath = resolve(dir, "harness.contract.json");
		if (!existsSync(contractPath)) {
			return northStarContractCheck(
				"skip",
				"skipped — harness.contract.json not found",
			);
		}

		const contract = readJsonFile(contractPath);
		const validation = validateContract(contract);
		if (!validation.success) {
			return northStarContractCheck(
				"fail",
				"harness.contract.json is invalid, so north-star runtime readiness cannot be verified",
				"Run harness contract validate and repair the reported contract errors",
			);
		}

		const contractData = validation.data;
		if (!contractData) {
			throw new Error(
				"Internal validator bug: validateContract returned { success: true } without contract data. " +
					`Validation result: ${JSON.stringify(validation)}`,
			);
		}

		if (!contractData.northStar) {
			return northStarContractCheck(
				"fail",
				"northStar block missing — runtime north-star contract is not load-bearing",
				"Add canonical northStar fields to harness.contract.json",
			);
		}
		if (
			!contractData.productSurface ||
			contractData.productSurface.surfaces.length === 0
		) {
			return northStarContractCheck(
				"fail",
				"productSurface registry missing or empty — governed north-star surfaces are not explicit",
				"Register canonical command/document surfaces in productSurface.surfaces",
			);
		}
		if (
			!contractData.overrideReviewerRegistry ||
			contractData.overrideReviewerRegistry.trustedReviewers.length === 0
		) {
			return northStarContractCheck(
				"fail",
				"overrideReviewerRegistry is missing or empty — north-star override trust cannot be verified",
				"Declare at least one active trusted reviewer in overrideReviewerRegistry",
			);
		}

		const ownedPaths = new Set(
			contractData.productSurface.surfaces.flatMap(
				(surface) => surface.ownedPaths,
			),
		);
		const missingOwnedPaths = CANONICAL_NORTH_STAR_OWNED_PATHS.filter(
			(pathValue) => !ownedPaths.has(pathValue),
		);
		if (missingOwnedPaths.length > 0) {
			return northStarContractCheck(
				"warn",
				`productSurface coverage is missing canonical ownedPaths: ${missingOwnedPaths.join(", ")}`,
				"Add README and roadmap/status files to productSurface.surfaces[].ownedPaths",
			);
		}

		return northStarContractCheck(
			"ok",
			"canonical north-star runtime surfaces are present",
		);
	},
];
