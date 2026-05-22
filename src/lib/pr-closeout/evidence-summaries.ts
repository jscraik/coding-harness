import { validateHarnessAssuranceEntries } from "../harness-assurance.js";
import { validateRuntimeEvidenceContract } from "../runtime/runtime-evidence-contract.js";
import type {
	PrCloseoutAssuranceSummary,
	PrCloseoutBlocker,
	PrCloseoutInput,
	PrCloseoutRuntimeEvidenceSummary,
} from "./types.js";

/** Add blockers for missing or invalid seven-layer harness assurance evidence. */
export function collectAssuranceBlockers(
	input: PrCloseoutInput,
	blockers: PrCloseoutBlocker[],
): void {
	if (input.assurance === undefined) {
		blockers.push({
			surface: "assurance",
			classification: "introduced",
			reason:
				"Seven-layer harness assurance evidence is missing from PR closeout.",
			fixableByCodex: true,
		});
		return;
	}
	const result = validateHarnessAssuranceEntries(input.assurance);
	for (const finding of result.findings) {
		blockers.push({
			surface: "assurance",
			classification: "introduced",
			reason: finding.message,
			fixableByCodex: true,
			ref: [finding.layer, finding.blockerClass].join(":"),
		});
	}
}

/** Add blockers when supplied runtime evidence is malformed or verifier-blocked. */
export function collectRuntimeEvidenceBlockers(
	input: PrCloseoutInput,
	blockers: PrCloseoutBlocker[],
): void {
	if (input.runtimeEvidence === undefined) return;
	const validation = validateRuntimeEvidenceContract(input.runtimeEvidence);
	for (const finding of validation.findings) {
		blockers.push({
			surface: "runtime_evidence",
			classification: "introduced",
			reason: finding.message,
			fixableByCodex: true,
			ref: [finding.path, finding.code].join(":"),
		});
	}
	const status = input.runtimeEvidence.verifierResult.status;
	if (status !== "pass") {
		const blocker: PrCloseoutBlocker = {
			surface: "runtime_evidence",
			classification: status === "blocked" ? "unknown" : "introduced",
			reason: `Runtime verifier status is ${status}.`,
			fixableByCodex: status !== "blocked",
		};
		const firstEvidenceRef =
			input.runtimeEvidence.verifierResult.evidenceRefs[0];
		if (firstEvidenceRef !== undefined) {
			blocker.ref = firstEvidenceRef;
		}
		blockers.push(blocker);
	}
}

/** Build PR closeout assurance summary from supplied matrix evidence. */
export function buildAssuranceSummary(
	input: PrCloseoutInput,
): PrCloseoutAssuranceSummary {
	const validation =
		input.assurance === undefined
			? { valid: false, findings: [] }
			: validateHarnessAssuranceEntries(input.assurance);
	return {
		present: input.assurance !== undefined,
		valid: validation.valid,
		entries: input.assurance ?? [],
		findings: validation.findings,
	};
}

/** Build PR closeout runtime evidence summary from supplied contract evidence. */
export function buildRuntimeEvidenceSummary(
	input: PrCloseoutInput,
): PrCloseoutRuntimeEvidenceSummary {
	const validation =
		input.runtimeEvidence === undefined
			? { valid: false, findings: [] }
			: validateRuntimeEvidenceContract(input.runtimeEvidence);
	return {
		present: input.runtimeEvidence !== undefined,
		valid: validation.valid,
		verifierStatus: input.runtimeEvidence?.verifierResult.status ?? null,
		outcome: input.runtimeEvidence?.outcomeMapping.outcome ?? null,
		exitClassification:
			input.runtimeEvidence?.outcomeMapping.exitClassification ?? null,
		findings: validation.findings,
	};
}
