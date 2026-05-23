import { validateHarnessAssuranceEntries } from "../harness-assurance.js";
import { validateRuntimeEvidenceContract } from "../runtime/runtime-evidence-contract.js";
import type {
	RuntimeEvidenceContract,
	RuntimeEvidenceContractValidationResult,
	RuntimeEvidenceVerifierStatus,
} from "../runtime/runtime-evidence-contract.js";
import type {
	PrCloseoutAssuranceSummary,
	PrCloseoutBlocker,
	PrCloseoutInput,
	PrCloseoutRuntimeEvidenceSummary,
} from "./types.js";

function validateRuntimeEvidenceSafely(
	runtimeEvidence: RuntimeEvidenceContract,
): RuntimeEvidenceContractValidationResult {
	try {
		return validateRuntimeEvidenceContract(runtimeEvidence);
	} catch {
		return {
			valid: false,
			findings: [
				{
					path: "runtimeEvidence",
					code: "runtime_evidence_malformed",
					message: "Runtime evidence contract is malformed.",
				},
			],
		};
	}
}

function normalizeVerifierStatus(
	status: unknown,
): RuntimeEvidenceVerifierStatus | null {
	return status === "pass" ||
		status === "fail" ||
		status === "blocked" ||
		status === "unknown"
		? status
		: null;
}

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
	const runtimeEvidence = input.runtimeEvidence;
	const validation = validateRuntimeEvidenceSafely(runtimeEvidence);
	for (const finding of validation.findings) {
		blockers.push({
			surface: "runtime_evidence",
			classification: "introduced",
			reason: finding.message,
			fixableByCodex: true,
			ref: [finding.path, finding.code].join(":"),
		});
	}
	const verifierResult = runtimeEvidence.verifierResult as
		| { evidenceRefs?: unknown; status?: unknown }
		| undefined;
	if (typeof verifierResult?.status !== "string") {
		blockers.push({
			surface: "runtime_evidence",
			classification: "introduced",
			reason: "Runtime evidence is missing verifierResult.status.",
			fixableByCodex: true,
		});
		return;
	}
	const status = verifierResult.status;
	if (status !== "pass") {
		const blocker: PrCloseoutBlocker = {
			surface: "runtime_evidence",
			classification: status === "blocked" ? "unknown" : "introduced",
			reason: `Runtime verifier status is ${status}.`,
			fixableByCodex: status !== "blocked",
		};
		const firstEvidenceRef = Array.isArray(verifierResult.evidenceRefs)
			? verifierResult.evidenceRefs[0]
			: undefined;
		if (typeof firstEvidenceRef === "string") {
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
			: validateRuntimeEvidenceSafely(input.runtimeEvidence);
	const verifierResult = input.runtimeEvidence?.verifierResult as
		| { status?: unknown }
		| undefined;
	const outcomeMapping = input.runtimeEvidence?.outcomeMapping as
		| { exitClassification?: unknown; outcome?: unknown }
		| undefined;
	return {
		present: input.runtimeEvidence !== undefined,
		valid: validation.valid,
		verifierStatus: normalizeVerifierStatus(verifierResult?.status),
		outcome:
			typeof outcomeMapping?.outcome === "string"
				? outcomeMapping.outcome
				: null,
		exitClassification:
			typeof outcomeMapping?.exitClassification === "string"
				? outcomeMapping.exitClassification
				: null,
		findings: validation.findings,
	};
}
