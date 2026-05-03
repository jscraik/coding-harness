import type { DoctorCheck, DoctorReport } from "./doctor.js";

/**
 * Human-readable recovery guidance for north-star blocker findings.
 *
 * Maps failed doctor checks to spec-aligned failure classes and resume states,
 * surfacing concrete next-step instructions so users know which gate to run
 * after fixing the prerequisite.
 */

export interface RecoveryGuidance {
	/** Spec failure class (e.g. admission_incomplete) */
	failureClass: string;
	/** Resume state label (e.g. A2) */
	resumeState: string;
	/** Human-readable headline */
	headline: string;
	/** Concrete next-step instruction */
	nextStep: string;
	/** Gate command to run after fixing the prerequisite */
	afterFixGate: string;
}

const CHECK_ID_TO_RECOVERY: Record<
	string,
	(check: DoctorCheck) => RecoveryGuidance | undefined
> = {
	"config:north-star-contract": (check) => {
		if (check.message.includes("harness.contract.json is invalid")) {
			return {
				failureClass: "contract_invalid",
				resumeState: "—",
				headline: "Contract is structurally invalid",
				nextStep: "Repair harness.contract.json so it passes schema validation",
				afterFixGate: "harness doctor --json",
			};
		}
		if (check.message.includes("northStar block missing")) {
			return {
				failureClass: "admission_incomplete",
				resumeState: "A2",
				headline: "North-star admission declaration is incomplete",
				nextStep:
					"Add the canonical northStar block (mission, primaryMetric, primaryBottleneck, autonomyBoundary, safetyFloor) to harness.contract.json",
				afterFixGate: "harness preflight-gate --json",
			};
		}
		if (check.message.includes("productSurface registry missing")) {
			return {
				failureClass: "surface_registration_gap",
				resumeState: "A2",
				headline: "Governed surfaces are not registered",
				nextStep:
					"Register canonical command/document/policy surfaces in productSurface.surfaces with ownedPaths",
				afterFixGate: "harness drift-gate --json",
			};
		}
		if (check.message.includes("overrideReviewerRegistry is missing")) {
			return {
				failureClass: "admission_unjustified",
				resumeState: "A2",
				headline: "Override trust cannot be verified",
				nextStep:
					"Declare at least one active trusted reviewer in overrideReviewerRegistry.trustedReviewers",
				afterFixGate: "harness review-gate --json",
			};
		}
		return undefined;
	},
	"file:north-star-doc": (check) => {
		if (check.status === "fail") {
			return {
				failureClass: "drift_blocking",
				resumeState: "A4",
				headline: "Canonical north-star parity file is missing",
				nextStep:
					"Restore docs/roadmap/north-star.md from the canonical north-star contract",
				afterFixGate: "harness drift-gate --json",
			};
		}
		return undefined;
	},
};

/**
 * Build recovery guidance from failed doctor checks.
 *
 * @param checks - All doctor checks from the report
 * @returns Ordered list of recovery guidance entries; empty when no failures map to guidance
 */
export function buildRecoveryGuidance(
	checks: DoctorCheck[],
): RecoveryGuidance[] {
	const guidance: RecoveryGuidance[] = [];
	for (const check of checks) {
		if (check.status !== "fail") continue;
		const mapper = CHECK_ID_TO_RECOVERY[check.id];
		if (!mapper) continue;
		const entry = mapper(check);
		if (entry) {
			guidance.push(entry);
		}
	}
	return guidance;
}

/**
 * Render recovery guidance as human-readable lines for terminal output.
 *
 * @param guidance - Recovery guidance entries from buildRecoveryGuidance
 * @returns Lines to append to the doctor report render
 */
export function renderRecoveryGuidance(guidance: RecoveryGuidance[]): string[] {
	if (guidance.length === 0) return [];

	const lines: string[] = [];
	lines.push("");
	lines.push("  Recovery Guidance");
	lines.push("  ─────────────────");

	for (const entry of guidance) {
		const stateLabel =
			entry.resumeState === "—"
				? "No auto-resume"
				: `Resume from ${entry.resumeState}`;
		lines.push(`    ❌  [${entry.failureClass}] ${stateLabel}`);
		lines.push(`         ${entry.headline}`);
		lines.push(`         Fix:  ${entry.nextStep}`);
		lines.push(`         Then: ${entry.afterFixGate}`);
		lines.push("");
	}

	return lines;
}

/**
 * Augment a DoctorReport with recovery guidance derived from its checks.
 *
 * Mutates the report in place for convenience.
 *
 * @param report - The doctor report to augment
 */
export function attachRecoveryGuidance(report: DoctorReport): void {
	report.recovery_guidance = buildRecoveryGuidance(report.checks);
}
