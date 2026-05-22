import type {
	AgentRunEvent,
	AgentRunManifest,
	ExitClassification,
	LoadedRunRecordBundle,
	RunOutcome,
} from "./run-records-core.js";

/** Derived read model that makes canonical run records consumable by agents. */
export const HARNESS_RUN_SCHEMA_VERSION = "harness-run/v1" as const;

/** Canonical lifecycle facets expected in a harness-run/v1 projection. */
export interface HarnessRunLifecycle {
	tools: string[];
	contextRefs: string[];
	guardrailRefs: string[];
	verifierRefs: string[];
	recoveryRefs: string[];
}

/** Machine-readable projection from run-record manifest and event stream. */
export interface HarnessRunContract {
	schemaVersion: typeof HARNESS_RUN_SCHEMA_VERSION;
	runId: string;
	command: string;
	repo: AgentRunManifest["repo"];
	startedAt: string;
	finishedAt: string;
	durationMs: number;
	finalStatus: {
		outcome: RunOutcome;
		exitClassification: ExitClassification;
		exitCode: number;
	};
	lifecycle: HarnessRunLifecycle;
	artifactRefs: AgentRunManifest["artifactRefs"];
	eventCount: number;
	source: LoadedRunRecordBundle["source"];
}

/** Validation finding for a derived harness-run/v1 projection. */
export interface HarnessRunFinding {
	code: string;
	message: string;
	path: string;
}

/** Validation result for a harness-run/v1 projection. */
export interface HarnessRunValidationResult {
	valid: boolean;
	findings: HarnessRunFinding[];
}

/** Build a harness-run/v1 projection from a canonical run-record bundle. */
export function buildHarnessRunContract(
	bundle: LoadedRunRecordBundle,
): HarnessRunContract {
	return {
		schemaVersion: HARNESS_RUN_SCHEMA_VERSION,
		runId: bundle.manifest.runId,
		command: bundle.manifest.command,
		repo: bundle.manifest.repo,
		startedAt: bundle.manifest.startedAt,
		finishedAt: bundle.manifest.finishedAt,
		durationMs: bundle.manifest.durationMs,
		finalStatus: {
			outcome: bundle.manifest.outcome,
			exitClassification: bundle.manifest.exit.classification,
			exitCode: bundle.manifest.exit.code,
		},
		lifecycle: collectLifecycle(bundle.events),
		artifactRefs: bundle.manifest.artifactRefs,
		eventCount: bundle.events.length,
		source: bundle.source,
	};
}

/** Validate that a harness-run/v1 projection has enough lifecycle evidence for closeout. */
export function validateHarnessRunContract(
	contract: HarnessRunContract,
): HarnessRunValidationResult {
	const findings: HarnessRunFinding[] = [];
	const add = (path: string, code: string, message: string): void => {
		findings.push({ path, code, message });
	};
	if (contract.schemaVersion !== HARNESS_RUN_SCHEMA_VERSION) {
		add(
			"schemaVersion",
			"schema_version_invalid",
			"schemaVersion must be harness-run/v1.",
		);
	}
	if (contract.eventCount === 0) {
		add(
			"eventCount",
			"event_stream_empty",
			"harness-run/v1 requires at least one run event.",
		);
	}
	if (contract.lifecycle.contextRefs.length === 0) {
		add(
			"lifecycle.contextRefs",
			"context_refs_missing",
			"run projection must name context evidence.",
		);
	}
	if (contract.lifecycle.verifierRefs.length === 0) {
		add(
			"lifecycle.verifierRefs",
			"verifier_refs_missing",
			"run projection must name verifier evidence.",
		);
	}
	if (
		contract.finalStatus.outcome === "success" &&
		contract.finalStatus.exitClassification !== "ok"
	) {
		add(
			"finalStatus",
			"success_exit_mismatch",
			"successful run outcomes must map to ok exit classification.",
		);
	}
	return { valid: findings.length === 0, findings };
}

function collectLifecycle(
	events: readonly AgentRunEvent[],
): HarnessRunLifecycle {
	return {
		tools: collectPayloadStrings(events, "tool"),
		contextRefs: collectPayloadStrings(events, "contextRef"),
		guardrailRefs: collectPayloadStrings(events, "guardrailRef"),
		verifierRefs: collectPayloadStrings(events, "verifierRef"),
		recoveryRefs: collectPayloadStrings(events, "recoveryRef"),
	};
}

function collectPayloadStrings(
	events: readonly AgentRunEvent[],
	key: string,
): string[] {
	const values = new Set<string>();
	for (const event of events) {
		const value = event.payload[key];
		if (typeof value === "string" && value.trim().length > 0) {
			values.add(value);
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === "string" && item.trim().length > 0) {
					values.add(item);
				}
			}
		}
	}
	return [...values].sort();
}
