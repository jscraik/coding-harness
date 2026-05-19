import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DoctorCheckFn } from "./doctor-checks.js";

/** Roadmap governance document checks used by harness doctor. */
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
