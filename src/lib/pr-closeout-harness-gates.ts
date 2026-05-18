import {
	HARNESS_CLOSEOUT_GATE_CONTRACTS,
	HARNESS_CLOSEOUT_GATE_IDS,
	type HePhaseExit,
} from "./decision/he-phase-exit.js";
import type {
	PrCloseoutBlocker,
	PrCloseoutHarnessGateEvidenceSource,
	PrCloseoutHarnessGateSummary,
} from "./pr-closeout-types.js";
import { pushBlocker } from "./pr-closeout-blockers.js";

/** Build the normalized PR closeout gate summary from supplied phase-exit evidence. */
export function buildHarnessGateSummary(
	closeoutGates: HePhaseExit | undefined,
	evidenceSource: PrCloseoutHarnessGateEvidenceSource,
): PrCloseoutHarnessGateSummary {
	if (!closeoutGates) {
		return {
			evidenceSource: "missing",
			closeoutGatesPresent: false,
			phaseExitPresent: false,
			recommendation: "missing",
			commitAllowed: false,
			exitAllowed: false,
			gates: HARNESS_CLOSEOUT_GATE_IDS.map((gateId) => ({
				gateId,
				required:
					HARNESS_CLOSEOUT_GATE_CONTRACTS[gateId].applicability === "default",
				status: "missing",
				evidenceRefs: [],
				requiresHuman: false,
				blocker: "Coding Harness closeout-gates evidence was not supplied.",
			})),
		};
	}
	const gatesById = new Map(
		closeoutGates.gates.map((gate) => [gate.gateId, gate]),
	);
	return {
		evidenceSource,
		closeoutGatesPresent: evidenceSource === "closeout_gates",
		phaseExitPresent: evidenceSource === "phase_exit",
		recommendation: closeoutGates.recommendation,
		commitAllowed: closeoutGates.commitAllowed,
		exitAllowed: closeoutGates.exitAllowed,
		gates: HARNESS_CLOSEOUT_GATE_IDS.map((gateId) => {
			const gate = gatesById.get(gateId);
			const required =
				HARNESS_CLOSEOUT_GATE_CONTRACTS[gateId].applicability === "default" ||
				gate?.required === true;
			if (!gate) {
				return {
					gateId,
					required,
					status: "missing",
					evidenceRefs: [],
					requiresHuman: false,
					blocker: required
						? `${gateId} gate is missing from Coding Harness closeout-gates evidence.`
						: null,
				};
			}
			return {
				gateId: gate.gateId,
				required,
				status: gate.status,
				evidenceRefs: gate.evidenceRefs.map((ref) => ref.ref),
				requiresHuman: gate.requiresHuman,
				blocker: gate.blockedReason ?? gate.reason,
			};
		}),
	};
}

/** Collect closeout blockers from missing, failed, blocked, or denying harness gates. */
export function collectHarnessGateBlockers(
	harnessGates: PrCloseoutHarnessGateSummary,
	blockers: PrCloseoutBlocker[],
): void {
	if (harnessGates.evidenceSource === "missing") {
		pushBlocker(blockers, {
			surface: "harness_gates",
			classification: "introduced",
			reason:
				"Coding Harness closeout gates are missing closeout-gates evidence.",
			fixableByCodex: true,
			ref: "schema:coding-harness-closeout-gates/v1",
		});
		return;
	}
	for (const gate of harnessGates.gates) {
		if (
			!gate.required ||
			gate.status === "pass" ||
			gate.status === "not_applicable"
		) {
			continue;
		}
		const requiresJamie =
			gate.requiresHuman ||
			harnessGates.recommendation === "human_review_required";
		pushBlocker(blockers, {
			surface: "harness_gates",
			classification: requiresJamie
				? "needs_jamie_decision"
				: gate.status === "blocked"
					? "unknown"
					: "introduced",
			reason: gate.blocker ?? `${gate.gateId} closeout gate is ${gate.status}.`,
			fixableByCodex: !requiresJamie && gate.status !== "blocked",
			ref: gate.evidenceRefs[0] ?? gate.gateId,
		});
	}
	if (!harnessGates.commitAllowed || !harnessGates.exitAllowed) {
		const requiresJamie =
			harnessGates.recommendation === "human_review_required";
		pushBlocker(blockers, {
			surface: "harness_gates",
			classification: requiresJamie ? "needs_jamie_decision" : "unknown",
			reason: `Coding Harness closeout gates deny closeout (recommendation=${harnessGates.recommendation}, commitAllowed=${String(harnessGates.commitAllowed)}, exitAllowed=${String(harnessGates.exitAllowed)}).`,
			fixableByCodex: false,
			ref: "schema:coding-harness-closeout-gates/v1",
		});
	}
}
