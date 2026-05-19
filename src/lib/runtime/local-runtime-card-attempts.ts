import type { RuntimeCard } from "./runtime-card.js";

function sourceEvidenceRefs(
	sources: readonly RuntimeCard["sources"][number][],
): string[] {
	return [...new Set(sources.map((source) => source.ref))].sort();
}

function sourceFailureClass(
	sources: readonly RuntimeCard["sources"][number][],
): string | null {
	return sources.find((source) => source.failureClass)?.failureClass ?? null;
}

function runtimeRecoveryOwner(
	blockers: readonly string[],
	sources: readonly RuntimeCard["sources"][number][],
): RuntimeCard["attemptLedger"]["owner"] {
	if (blockers.some((blocker) => blocker.includes("LINEAR_API_KEY"))) {
		return "operator";
	}
	if (sources.some((source) => source.status === "blocked")) {
		return "external_service";
	}
	return "codex";
}

function runtimeRetryDecision(
	lifecycle: RuntimeCard["lifecycle"],
	owner: RuntimeCard["attemptLedger"]["owner"],
): RuntimeCard["attemptLedger"]["retryDecision"] {
	if (lifecycle !== "blocked") return "none";
	return owner === "external_service" ? "wait" : "stop";
}

function runtimeFailureClass(
	blockers: readonly string[],
	sources: readonly RuntimeCard["sources"][number][],
): string {
	return (
		sourceFailureClass(sources) ??
		(blockers.length > 0 ? "runtime_card_blocked" : "none")
	);
}

/** Attach deterministic retry and recovery metadata to a runtime-card/v1 artifact. */
export function addRuntimeAttemptMetadata(
	card: Omit<RuntimeCard, "attemptLedger" | "recoveryEvent">,
): RuntimeCard {
	const evidenceRefs = sourceEvidenceRefs(card.sources);
	const stopReason = card.blockers[0] ?? null;
	const owner = runtimeRecoveryOwner(card.blockers, card.sources);
	const retryDecision = runtimeRetryDecision(card.lifecycle, owner);
	const attemptLedger: RuntimeCard["attemptLedger"] = {
		schemaVersion: "attempt-ledger/v1",
		command: "runtime-card",
		attempt: 1,
		maxAttempts: 1,
		firstFailure:
			stopReason === null
				? null
				: {
						attempt: 1,
						lifecycle: card.lifecycle,
						nextSafeAction: card.nextSafeAction,
					},
		retryDecision,
		owner,
		stopReason,
		nextAction: card.nextSafeAction,
		evidenceRefs,
	};
	return {
		...card,
		attemptLedger,
		recoveryEvent:
			stopReason === null
				? null
				: {
						schemaVersion: "recovery-event/v1",
						eventId: `runtime-card:${card.issueKey ?? "unknown"}:${card.generatedAt}`,
						command: "runtime-card",
						attempt: 1,
						owner,
						failureClass: runtimeFailureClass(card.blockers, card.sources),
						stopReason,
						nextAction: card.nextSafeAction,
						retryDecision,
						evidenceRefs,
					},
	};
}
