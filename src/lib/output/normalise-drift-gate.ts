import type {
	DriftFinding,
	DriftGateResult,
} from "../../commands/drift-gate.js";
import { buildGateResult, uniqueStrings } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

function defaultEvidenceRef(gate: string, findings: GateFinding[]): string[] {
	const refs = uniqueStrings(
		findings.flatMap((finding) => [
			finding.path ? `path:${finding.path}` : undefined,
			`finding:${finding.id}`,
		]),
	);
	return refs.length > 0 ? refs : [`gate:${gate}`];
}

function adaptDriftFinding(finding: DriftFinding): GateFinding {
	return {
		id: `drift-gate.${finding.surface}.${finding.rule_id}`,
		severity: finding.severity as GateFinding["severity"],
		gate: "drift-gate",
		message: finding.message,
		...(finding.path !== undefined ? { path: finding.path } : {}),
		baseline: finding.baseline_state === "preexisting",
		...(finding.failureClass !== undefined
			? { failureClass: finding.failureClass }
			: {}),
		fix: {
			...(finding.fix?.command !== undefined
				? { command: finding.fix.command }
				: {}),
			...(finding.fix?.manual !== undefined
				? { manual: finding.fix.manual }
				: {}),
			suppressible: finding.fix?.suppressible ?? false,
		},
	};
}

function driftGateStatus(result: DriftGateResult): GateResult["status"] {
	if (result.report.outcome === "error" || result.report.status === "blocked") {
		return "fail";
	}
	return result.report.status === "partial" ? "warn" : "pass";
}

/**
 * Normalise a DriftGateResult to the canonical GateResult interface.
 *
 * @param result - The raw drift-gate result to project into GateResult
 * @returns A canonical GateResult preserving drift findings and artifact evidence
 */
export function normaliseDriftGateResult(result: DriftGateResult): GateResult {
	const gate = "drift-gate";
	const findings = result.report.findings.map(adaptDriftFinding);
	const artifactRefs = result.report.artifact_refs ?? [];
	const artifactEvidenceRefs = artifactRefs.map(
		(artifact) => `artifact:${artifact.path}`,
	);
	const evidenceRef = uniqueStrings([
		...defaultEvidenceRef(gate, findings),
		...artifactEvidenceRefs,
	]);

	return buildGateResult({
		gate,
		timestamp: result.report.generated_at ?? new Date().toISOString(),
		status: driftGateStatus(result),
		findings,
		decision: { evidenceRef },
		...(artifactRefs.length > 0
			? {
					meta: { artifactRefs },
				}
			: {}),
	});
}
