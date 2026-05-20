import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DoctorCheckFn } from "./doctor-checks.js";

/**
 * Roadmap governance document checks used by harness doctor.
 *
 * This exported array contains {@link DoctorCheckFn} checks that verify the
 * presence of required roadmap documentation files under `docs/roadmap/`.
 * These files are load-bearing for drift-gate health mode and north-star
 * contract alignment.
 *
 * Each check function receives a directory path and returns a result object
 * with `id`, `category`, `label`, `status`, and `message` fields. Status may
 * be `ok`, `warn`, or `fail`. When files are missing, the check provides
 * a remediation `fix` message.
 *
 * Typical usage: harness doctor iterates over this array and executes each
 * check function, collecting and reporting all results.
 *
 * @type {DoctorCheckFn[]}
 * @remarks The checks enforce that `docs/roadmap/north-star.md` is present
 * (required for drift-gate health mode) and that `docs/roadmap/agent-first-status.md`
 * exists (warned in advisory mode, blocked in health mode).
 * @public
 */
export const DOCTOR_ROADMAP_FILE_CHECKS: DoctorCheckFn[] = [
	(dir) => {
		const statusPath = resolve(dir, "docs/roadmap/agent-first-status.md");
		if (!existsSync(statusPath)) {
			return {
				id: "file:agent-first-status",
				category: "file",
				label: "docs/roadmap/agent-first-status.md",
				status: "warn",
				message:
					"missing — drift-gate advisory warns; drift-gate health mode blocks",
				fix: "harness init --update  (seeds this file with a template)",
			};
		}
		return {
			id: "file:agent-first-status",
			category: "file",
			label: "docs/roadmap/agent-first-status.md",
			status: "ok",
			message: "present",
		};
	},
	(dir) => {
		const northStarPath = resolve(dir, "docs/roadmap/north-star.md");
		if (!existsSync(northStarPath)) {
			return {
				id: "file:north-star-doc",
				category: "file",
				label: "docs/roadmap/north-star.md",
				status: "fail",
				message:
					"missing — drift-gate health mode cannot verify canonical north-star parity without this file",
				fix: "Restore docs/roadmap/north-star.md from the canonical north-star contract slice",
			};
		}
		return {
			id: "file:north-star-doc",
			category: "file",
			label: "docs/roadmap/north-star.md",
			status: "ok",
			message: "present",
		};
	},
];
