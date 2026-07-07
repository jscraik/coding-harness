import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { validateContract } from "../lib/contract/validator.js";
import { hasJsonKey, readJsonFile } from "./doctor-check-utils.js";
import type { DoctorCheckFn } from "./doctor-checks.js";
import { DOCTOR_ROADMAP_FILE_CHECKS } from "./doctor-roadmap-file-checks.js";

/** Required file and baseline checks used by harness doctor. */
export const DOCTOR_FILE_CHECKS: DoctorCheckFn[] = [
	// ── File: harness.contract.json ───────────────────────────────────────────
	(dir) => {
		const contractPath = resolve(dir, "harness.contract.json");
		if (!existsSync(contractPath)) {
			return {
				id: "file:harness.contract.json",
				category: "file",
				label: "harness.contract.json",
				status: "fail",
				message:
					"missing — required by drift-gate, context-health, gardener, ci-migrate, docs-gate, plan-gate",
				fix: "harness init --update (or harness init for a new project)",
			};
		}
		const contract = readJsonFile(contractPath);
		if (!contract) {
			return {
				id: "file:harness.contract.json",
				category: "file",
				label: "harness.contract.json",
				status: "fail",
				message: "exists but is not valid JSON",
				fix: "Validate with: node -e \"JSON.parse(require('fs').readFileSync('harness.contract.json','utf8'))\"",
			};
		}
		const validation = validateContract(contract);
		if (!validation.success) {
			return {
				id: "file:harness.contract.json",
				category: "file",
				label: "harness.contract.json",
				status: "fail",
				message: `valid JSON but fails contract validation (${validation.errors.length} error${validation.errors.length === 1 ? "" : "s"})`,
				fix: "harness contract validate --json",
			};
		}
		return {
			id: "file:harness.contract.json",
			category: "file",
			label: "harness.contract.json",
			status: "ok",
			message: "present and valid contract schema",
		};
	},

	// ── File: memory.json ─────────────────────────────────────────────────────
	(dir) => {
		const memPath = resolve(dir, "memory.json");
		if (!existsSync(memPath)) {
			return {
				id: "file:memory.json",
				category: "file",
				label: "memory.json",
				status: "warn",
				message: "missing — required by memory-gate (optional for other gates)",
				fix: "harness init --update  (creates memory.json with initial state)",
			};
		}
		const mem = readJsonFile(memPath);
		if (!mem) {
			return {
				id: "file:memory.json",
				category: "file",
				label: "memory.json",
				status: "fail",
				message: "exists but is not valid JSON",
				fix: "Check memory.json for syntax errors",
			};
		}
		// Check closeout structure — the JSC-65 pain point
		const hasCloseout = hasJsonKey(mem, "closeout");
		const hasForjamieFlag = hasJsonKey(mem, "closeout", "forjamie_updated");
		if (!hasCloseout) {
			return {
				id: "file:memory.json",
				category: "file",
				label: "memory.json",
				status: "warn",
				message: "missing 'closeout' key — memory-gate will fail until set",
				fix: 'Add: {"closeout": {"date": "<iso-date>", "forjamie_updated": true}} to memory.json',
			};
		}
		if (!hasForjamieFlag) {
			return {
				id: "file:memory.json",
				category: "file",
				label: "memory.json",
				status: "warn",
				message:
					"memory.json.closeout.forjamie_updated is missing (memory-gate requires this flag)",
				fix: "Set memory.json → closeout.forjamie_updated to true after each session",
			};
		}
		return {
			id: "file:memory.json",
			category: "file",
			label: "memory.json",
			status: "ok",
			message: "present, valid, closeout structure looks good",
		};
	},

	// ── File: drift-gate baseline ─────────────────────────────────────────────
	(dir) => {
		const baselinePath = resolve(
			dir,
			"artifacts/consistency-gate/consistency-baseline-latest.json",
		);
		if (!existsSync(baselinePath)) {
			return {
				id: "file:consistency-baseline",
				category: "file",
				label: "drift-gate baseline",
				status: "warn",
				message:
					"artifacts/consistency-gate/consistency-baseline-latest.json missing — drift-gate will warn on first run",
				fix: "harness drift-gate --seed-baseline",
			};
		}
		const baseline = readJsonFile(baselinePath);
		if (!baseline) {
			return {
				id: "file:consistency-baseline",
				category: "file",
				label: "drift-gate baseline",
				status: "warn",
				message: "baseline file exists but is not valid JSON",
				fix: "Re-seed: harness drift-gate --seed-baseline",
			};
		}
		// Check the baseline is not empty
		if (
			typeof baseline === "object" &&
			baseline !== null &&
			!Array.isArray(baseline) &&
			Object.keys(baseline).length === 0
		) {
			return {
				id: "file:consistency-baseline",
				category: "file",
				label: "drift-gate baseline",
				status: "warn",
				message: "baseline file is empty — re-seed recommended",
				fix: "harness drift-gate --seed-baseline",
			};
		}
		// Check file is not stale (>30 days)
		try {
			const stat = statSync(baselinePath);
			const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
			if (ageDays > 30) {
				return {
					id: "file:consistency-baseline",
					category: "file",
					label: "drift-gate baseline",
					status: "warn",
					message: `baseline is ${Math.floor(ageDays)} days old — consider refreshing`,
					fix: "harness drift-gate --seed-baseline",
				};
			}
		} catch {
			// ignore stat errors
		}
		return {
			id: "file:consistency-baseline",
			category: "file",
			label: "drift-gate baseline",
			status: "ok",
			message: "present and valid",
		};
	},

	...DOCTOR_ROADMAP_FILE_CHECKS,
];
