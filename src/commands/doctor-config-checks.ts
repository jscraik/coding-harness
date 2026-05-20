import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { hasJsonKey, readJsonFile } from "./doctor-check-utils.js";
import type { DoctorCheckFn } from "./doctor-checks.js";
import { DOCTOR_NORTH_STAR_CONTRACT_CHECKS } from "./doctor-north-star-contract-checks.js";

/** Harness contract configuration checks used by harness doctor. */
export const DOCTOR_CONFIG_CHECKS: DoctorCheckFn[] = [
	...DOCTOR_NORTH_STAR_CONTRACT_CHECKS,

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
