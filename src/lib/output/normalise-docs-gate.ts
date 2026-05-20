import type { DocsFinding, DocsGateResult } from "../../commands/docs-gate.js";
import { buildGateResult } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

function adaptDocsFinding(finding: DocsFinding): GateFinding {
	return {
		id: `docs-gate.${finding.surface}.${finding.rule_id}`,
		severity: finding.severity as GateFinding["severity"],
		gate: "docs-gate",
		message: finding.message,
		...(finding.path !== undefined ? { path: finding.path } : {}),
		baseline: false,
		fix: { suppressible: false },
	};
}

function docsGateStatus(result: DocsGateResult): GateResult["status"] {
	if (result.report.outcome === "ok") {
		return "pass";
	}
	return result.report.status === "partial" ? "warn" : "fail";
}

/**
 * Normalise a DocsGateResult to the canonical GateResult interface.
 *
 * @param result - The raw docs-gate result to project into GateResult
 * @returns A canonical GateResult preserving docs-gate metadata and findings
 */
export function normaliseDocsGateResult(result: DocsGateResult): GateResult {
	return buildGateResult({
		gate: "docs-gate",
		timestamp: result.report.generated_at ?? new Date().toISOString(),
		status: docsGateStatus(result),
		findings: result.report.findings.map(adaptDocsFinding),
		meta: {
			version: "v1-legacy",
			mode: result.report.mode,
			outcome: result.report.outcome,
			reportStatus: result.report.status,
			error_class: result.report.error_class,
			execution_context: result.report.execution_context,
			changed_files: result.report.changed_files,
			categories: result.report.categories,
			repo_root: result.report.repo_root,
			base_ref: result.report.base_ref,
			summary: result.report.summary,
		},
	});
}
