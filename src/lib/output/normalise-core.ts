import { getVersion } from "../version.js";
import type { GateFinding, GateResult } from "./types.js";

/** Shared parameters for normalised gate result construction. */
export interface BuildGateResultParams {
	gate: string;
	status: GateResult["status"];
	findings: GateFinding[];
	timestamp?: string;
	meta?: Record<string, unknown>;
	decision?: {
		reason?: string;
		actionNow?: string[];
		actionLater?: string[];
		evidenceRef?: string[];
	};
}

/** Return a sorted-stable list of unique, trimmed strings, dropping blank values. */
export function uniqueStrings(values: Array<string | undefined>): string[] {
	const out: string[] = [];
	for (const value of values) {
		if (!value) continue;
		const trimmed = value.trim();
		if (!trimmed || out.includes(trimmed)) continue;
		out.push(trimmed);
	}
	return out;
}

/**
 * Build a canonical {@link GateResult} with consistent summary and evidence defaults.
 */
export function buildGateResult(params: BuildGateResultParams): GateResult {
	const { gate, status, findings, timestamp, meta, decision } = params;
	const errors = findings.filter((f) => f.severity === "error").length;
	const warnings = findings.filter((f) => f.severity === "warning").length;
	const info = findings.filter((f) => f.severity === "info").length;

	const reason =
		decision?.reason ??
		(status === "pass"
			? `${gate} passed with no blocking findings.`
			: status === "warn"
				? `${gate} reported non-blocking warnings (${warnings}).`
				: status === "skipped"
					? `${gate} was skipped.`
					: `${gate} reported blocking findings (${errors}).`);
	const action_now =
		decision?.actionNow ??
		(status === "pass"
			? []
			: findings.length > 0
				? uniqueStrings(
						findings.flatMap((finding) => [
							finding.fix.command,
							finding.fix.manual,
						]),
					)
				: status === "warn"
					? [`Review warnings and rerun harness ${gate}.`]
					: status === "skipped"
						? [`Run harness ${gate} once prerequisites are available.`]
						: [`Resolve blocking findings and rerun harness ${gate}.`]);
	const action_later =
		decision?.actionLater ??
		(status === "pass"
			? [`Re-run harness ${gate} after the next relevant change.`]
			: status === "warn"
				? [`Automate repeated warning remediation for ${gate}.`]
				: status === "skipped"
					? [`Add ${gate} to the regular validation flow.`]
					: [`Add regression coverage to prevent future ${gate} failures.`]);
	const evidence_ref =
		decision?.evidenceRef ??
		(() => {
			const fallback = uniqueStrings(
				findings.flatMap((finding) => [
					finding.path ? `path:${finding.path}` : undefined,
					`finding:${finding.id}`,
				]),
			);
			return fallback.length > 0 ? fallback : [`gate:${gate}`];
		})();

	return {
		gate,
		version: getVersion(),
		timestamp: timestamp ?? new Date().toISOString(),
		status,
		findings,
		summary: {
			errors,
			warnings,
			info,
			total: errors + warnings + info,
		},
		reason,
		action_now,
		action_later,
		evidence_ref,
		...(meta ? { meta } : {}),
	};
}
