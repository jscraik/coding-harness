import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { loadContract } from "../contract/loader.js";
import { DEFAULT_CONTRACT } from "../contract/types.js";
import { BRANCH_PROTECTION_REQUIRED_CHECKS } from "../policy/required-checks.js";
import type {
	AgentIdentity,
	ArtifactFileRef,
	ClientFamily,
	ControlPlaneArtifactSet,
	ControlPlaneAuditLogEntry,
	ControlPlaneDecision,
	ControlPlaneEnforcementDecision,
	ControlPlaneRun,
	ControlPlaneScorecard,
	ControlPlaneSummary,
	EvaluationMode,
	GovernanceSnapshot,
	InstructionParityResult,
	InstructionSurfaceSummary,
	PilotEvaluateOptions,
	PilotMetrics,
	PilotOutcome,
	ProviderAdapterDescriptor,
	RequiredCheckAlignment,
	RolloutStage,
} from "./types.js";

const DEFAULT_ADAPTER_REGISTRY_PATH = "contracts/agent-adapter-registry.json";
const CONTROL_PLANE_REQUIRED_CHECKS = [
	"pr-template",
	"risk-policy-gate",
	"dependency-review",
	"actions-pinning",
] as const;

interface AdapterRegistryDocument {
	schemaVersion: string;
	adapters: ProviderAdapterDescriptor[];
}

interface ControlPlaneBuildInput {
	artifactsDir: string;
	metrics: PilotMetrics;
	metricsErrors: string[];
	legacyOutcome: PilotOutcome;
	legacyHoldReasons: string[];
	options: PilotEvaluateOptions;
}

interface RepoGitMetadata {
	repoRoot: string;
	branch: string | null;
	headSha: string | null;
}

function sha256(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function readJsonFile<T>(path: string): T | null {
	if (!existsSync(path)) {
		return null;
	}

	try {
		return JSON.parse(readFileSync(path, "utf-8")) as T;
	} catch {
		return null;
	}
}

function writeJsonFile(path: string, value: unknown): void {
	const dir = dirname(path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(path, JSON.stringify(value, null, 2), "utf-8");
}

function buildFileRef(
	path: string,
	options?: { required?: boolean },
): ArtifactFileRef {
	const resolvedPath = resolve(path);
	const exists = existsSync(resolvedPath);

	if (!exists) {
		return {
			path: resolvedPath,
			exists: false,
			required: options?.required ?? false,
		};
	}

	const content = readFileSync(resolvedPath, "utf-8");
	return {
		path: resolvedPath,
		exists: true,
		required: options?.required ?? false,
		sha256: sha256(content),
		sizeBytes: Buffer.byteLength(content, "utf-8"),
	};
}

function readGitMetadata(): RepoGitMetadata {
	const repoRoot = process.cwd();

	try {
		const branch = execFileSync("git", ["branch", "--show-current"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();

		return {
			repoRoot,
			branch: branch.length > 0 ? branch : null,
			headSha: headSha.length > 0 ? headSha : null,
		};
	} catch {
		return {
			repoRoot,
			branch: null,
			headSha: null,
		};
	}
}

function normalizeClientFamily(value: string | undefined): ClientFamily | null {
	if (!value) {
		return null;
	}

	const normalized = value.trim().toLowerCase();
	switch (normalized) {
		case "codex":
		case "claude_family":
		case "gemini_family":
		case "kimi_family":
		case "custom":
			return normalized as ClientFamily;
		case "claude":
			return "claude_family";
		case "gemini":
			return "gemini_family";
		case "kimi":
			return "kimi_family";
		default:
			return null;
	}
}

function loadAdapterRegistry(registryPath?: string): {
	adapters: ProviderAdapterDescriptor[];
	warnings: string[];
} {
	const path = resolve(registryPath ?? DEFAULT_ADAPTER_REGISTRY_PATH);
	const warnings: string[] = [];
	const document = readJsonFile<AdapterRegistryDocument>(path);

	if (!document || document.schemaVersion !== "agent-adapter-registry/v1") {
		warnings.push(
			`Adapter registry missing or invalid at ${path}; provider normalization will remain degraded`,
		);
		return { adapters: [], warnings };
	}

	return { adapters: document.adapters ?? [], warnings };
}

function resolveProviderAdapter(options: PilotEvaluateOptions): {
	adapter: ProviderAdapterDescriptor | null;
	clientFamily: ClientFamily | null;
	warnings: string[];
} {
	const { adapters, warnings } = loadAdapterRegistry(
		options.adapterRegistryPath,
	);
	const clientFamily = normalizeClientFamily(options.clientFamily);

	if (!clientFamily) {
		return { adapter: null, clientFamily: null, warnings };
	}

	const adapter =
		adapters.find((candidate) => candidate.clientFamily === clientFamily) ??
		null;

	if (!adapter) {
		return {
			adapter: null,
			clientFamily,
			warnings: [
				...warnings,
				`No provider adapter registry entry found for client family ${clientFamily}`,
			],
		};
	}

	return { adapter, clientFamily, warnings };
}

function buildAgentIdentity(
	options: PilotEvaluateOptions,
	adapter: ProviderAdapterDescriptor | null,
	clientFamily: ClientFamily | null,
): AgentIdentity {
	const degradedReasons: string[] = [];
	const providerId = options.providerId?.trim() || null;
	const modelDescriptor = options.modelDescriptor?.trim() || null;

	if (!clientFamily) {
		degradedReasons.push("client_family_missing");
	}
	if (!providerId) {
		degradedReasons.push("provider_id_missing");
	}
	if (!modelDescriptor) {
		degradedReasons.push("model_descriptor_missing");
	}
	if (!adapter) {
		degradedReasons.push("adapter_unresolved");
	} else if (adapter.status && adapter.status !== "active") {
		degradedReasons.push(`adapter_${adapter.status}`);
	}

	return {
		actorId:
			options.actorId?.trim() ||
			process.env.USER ||
			process.env.USERNAME ||
			"unknown-operator",
		clientFamily: clientFamily ?? "custom",
		providerId: providerId ?? "unknown-provider",
		modelDescriptor: modelDescriptor ?? "unknown-model",
		executionMode: options.executionMode ?? "interactive",
		operatorType: options.operatorType ?? "human_directed",
		identityStatus:
			degradedReasons.length > 0 ? "identity_degraded" : "verified",
		degradedReasons,
	};
}

function extractWorkflowJobNames(workflowRef: ArtifactFileRef): string[] {
	if (!workflowRef.exists) {
		return [];
	}

	const content = readFileSync(workflowRef.path, "utf-8");
	return Array.from(content.matchAll(/^ {4}name:\s+(.+)$/gm))
		.map((match) => match[1]?.trim() ?? "")
		.filter(Boolean);
}

function compareRequiredChecks(
	contractChecks: string[],
	workflowChecks: string[],
): RequiredCheckAlignment {
	const policyChecks = BRANCH_PROTECTION_REQUIRED_CHECKS.filter((check) =>
		CONTROL_PLANE_REQUIRED_CHECKS.includes(
			check as (typeof CONTROL_PLANE_REQUIRED_CHECKS)[number],
		),
	);
	const policyCheckSet = new Set<string>(policyChecks);
	const relevantContractChecks = contractChecks.filter((check) =>
		policyCheckSet.has(check),
	);
	const relevantWorkflowChecks = workflowChecks.filter((check) =>
		policyCheckSet.has(check),
	);

	return {
		policyChecks: [...policyChecks],
		contractChecks: relevantContractChecks,
		workflowChecks: relevantWorkflowChecks,
		missingFromContract: policyChecks.filter(
			(check) => !relevantContractChecks.includes(check),
		),
		extraInContract: relevantContractChecks.filter(
			(check) => !policyCheckSet.has(check),
		),
		missingFromWorkflow: policyChecks.filter(
			(check) => !relevantWorkflowChecks.includes(check),
		),
		status: policyChecks.every(
			(check) =>
				relevantContractChecks.includes(check) &&
				relevantWorkflowChecks.includes(check),
		)
			? "pass"
			: "fail",
	};
}

function buildGovernanceSnapshot(
	options: PilotEvaluateOptions,
	git: RepoGitMetadata,
): { snapshot: GovernanceSnapshot; warnings: string[] } {
	const warnings: string[] = [];
	const contractPath = resolve(options.contractPath ?? "harness.contract.json");
	const contractRef = buildFileRef(contractPath, { required: true });
	let contractChecks: string[] = [];

	try {
		const contract = contractRef.exists
			? loadContract(contractPath)
			: DEFAULT_CONTRACT;
		contractChecks = [...(contract.branchProtection?.requiredChecks ?? [])];
	} catch (error) {
		warnings.push(
			`Failed to load contract for governance snapshot: ${(error as Error).message}`,
		);
	}

	if (!contractRef.exists) {
		warnings.push(`Contract missing at ${contractPath}`);
	}

	const workflowRef = buildFileRef(".github/workflows/pr-pipeline.yml", {
		required: true,
	});
	if (!workflowRef.exists) {
		warnings.push(
			"Trusted PR workflow missing at .github/workflows/pr-pipeline.yml",
		);
	}

	const prTemplateRef = buildFileRef(".github/PULL_REQUEST_TEMPLATE.md", {
		required: true,
	});
	if (!prTemplateRef.exists) {
		warnings.push(
			"Trusted PR template missing at .github/PULL_REQUEST_TEMPLATE.md",
		);
	}

	const canonicalInstructionRef = buildFileRef("AGENTS.md", { required: true });
	const mirrorInstructionRef = buildFileRef("CLAUDE.md", { required: true });
	const optionalMirrorRef = buildFileRef("GEMINI.md");

	if (!canonicalInstructionRef.exists) {
		warnings.push("Canonical AGENTS.md missing");
	}
	if (!mirrorInstructionRef.exists) {
		warnings.push("Required mirror CLAUDE.md missing");
	}

	const workflowChecks = extractWorkflowJobNames(workflowRef);
	const requiredChecks = compareRequiredChecks(contractChecks, workflowChecks);
	if (requiredChecks.status === "fail") {
		warnings.push(
			"Required-check identity mismatch detected across policy sources",
		);
	}

	return {
		snapshot: {
			schemaVersion: "governance-snapshot/v1",
			snapshotId: randomUUID(),
			capturedAt: new Date().toISOString(),
			contractRef,
			workflowRefs: [workflowRef],
			requiredChecks,
			branchPolicyRef: {
				branch: git.branch,
				headSha: git.headSha,
			},
			instructionPolicyRefs: [
				canonicalInstructionRef,
				mirrorInstructionRef,
				...(optionalMirrorRef.exists ? [optionalMirrorRef] : []),
			],
			prTemplateRef,
			prTemplateValidationStatus: options.prTemplateStatus ?? "missing",
			prTemplateValidationRef: options.prTemplateRef ?? null,
			sourceTrustLevel:
				warnings.length === 0 && requiredChecks.status === "pass"
					? "trusted"
					: "degraded",
			warnings,
		},
		warnings,
	};
}

function buildInstructionSurfaces(
	governanceSnapshot: GovernanceSnapshot,
): InstructionSurfaceSummary[] {
	return governanceSnapshot.instructionPolicyRefs.map((ref) => {
		const fileName = basename(ref.path);
		if (fileName === "AGENTS.md") {
			return {
				surfaceId: "agents-root",
				path: ref.path,
				kind: "canonical",
				clientFamily: "codex",
				requiredMode: "required",
				sourceOfTruth: ref.path,
			};
		}

		if (fileName === "CLAUDE.md") {
			return {
				surfaceId: "claude-root",
				path: ref.path,
				kind: "mirror",
				clientFamily: "claude_family",
				requiredMode: "required",
				sourceOfTruth: resolve("AGENTS.md"),
			};
		}

		return {
			surfaceId: "gemini-root",
			path: ref.path,
			kind: "provider_specific",
			clientFamily: "gemini_family",
			requiredMode: "optional",
			sourceOfTruth: resolve("AGENTS.md"),
		};
	});
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.filter((entry) => typeof entry === "string")
		.map((entry) => String(entry));
}

function extractInstructionParityStatus(
	document: Record<string, unknown>,
): InstructionParityResult["status"] {
	const candidates = [
		document.status,
		(document.parity as Record<string, unknown> | undefined)?.status,
		(document.result as Record<string, unknown> | undefined)?.status,
	]
		.filter((value) => typeof value === "string")
		.map((value) => String(value).trim().toLowerCase());

	for (const candidate of candidates) {
		switch (candidate) {
			case "pass":
			case "success":
				return "pass";
			case "fail":
			case "blocked":
				return "fail";
			case "partial":
				return "not_applicable";
			case "not_applicable":
			case "error":
				return candidate;
		}
	}

	return "error";
}

function buildInstructionParityResult(
	options: PilotEvaluateOptions,
	governanceSnapshot: GovernanceSnapshot,
): InstructionParityResult {
	const evaluatedSurfaces = buildInstructionSurfaces(governanceSnapshot);
	const reportPath = options.docsGateReportPath
		? resolve(options.docsGateReportPath)
		: null;

	if (!reportPath) {
		return {
			schemaVersion: "instruction-parity/v1",
			parityResultId: randomUUID(),
			governanceSnapshotRef: governanceSnapshot.snapshotId,
			evaluatedSurfaces,
			status: "error",
			contradictions: [],
			missingRequiredSurfaces: [],
			staleSurfaceRefs: [],
			normalizationWarnings: [
				"Trusted docs-gate parity artifact not provided to pilot-evaluate",
			],
			sourceReportRef: null,
		};
	}

	const reportRef = buildFileRef(reportPath, { required: true });
	const document = readJsonFile<Record<string, unknown>>(reportPath);
	if (!reportRef.exists || !document) {
		return {
			schemaVersion: "instruction-parity/v1",
			parityResultId: randomUUID(),
			governanceSnapshotRef: governanceSnapshot.snapshotId,
			evaluatedSurfaces,
			status: "error",
			contradictions: [],
			missingRequiredSurfaces: [],
			staleSurfaceRefs: [],
			normalizationWarnings: [
				`Unable to load docs-gate artifact from ${reportPath}`,
			],
			sourceReportRef: reportRef,
		};
	}

	return {
		schemaVersion: "instruction-parity/v1",
		parityResultId: randomUUID(),
		governanceSnapshotRef: governanceSnapshot.snapshotId,
		evaluatedSurfaces,
		status: extractInstructionParityStatus(document),
		contradictions: toStringArray(document.contradictions),
		missingRequiredSurfaces: toStringArray(document.missingRequiredSurfaces),
		staleSurfaceRefs: toStringArray(document.staleSurfaceRefs),
		normalizationWarnings: toStringArray(document.normalizationWarnings),
		sourceReportRef: reportRef,
	};
}

function readAuditLog(artifactsDir: string): {
	entries: ControlPlaneAuditLogEntry[];
	warnings: string[];
	auditPath: string;
} {
	const auditPath = resolve(
		artifactsDir,
		"control-plane",
		"audit",
		"control-plane-audit-log.jsonl",
	);

	if (!existsSync(auditPath)) {
		return { entries: [], warnings: [], auditPath };
	}

	const warnings: string[] = [];
	const entries: ControlPlaneAuditLogEntry[] = [];
	const lines = readFileSync(auditPath, "utf-8").split("\n").filter(Boolean);

	for (const [index, line] of lines.entries()) {
		try {
			entries.push(JSON.parse(line) as ControlPlaneAuditLogEntry);
		} catch {
			warnings.push(`Skipped invalid audit log line ${index + 1}`);
		}
	}

	return { entries, warnings, auditPath };
}

function calculateFalseBlockRate(
	entries: ControlPlaneAuditLogEntry[],
): number | null {
	const adjudicatedByAttempt = new Map<string, ControlPlaneAuditLogEntry>();

	for (const entry of entries) {
		if (entry.auditStatus !== "adjudicated") {
			continue;
		}
		adjudicatedByAttempt.set(entry.evaluationAttemptId, entry);
	}

	const adjudicatedEntries = [...adjudicatedByAttempt.values()];
	if (adjudicatedEntries.length === 0) {
		return null;
	}

	const falseBlocks = adjudicatedEntries.filter(
		(entry) => entry.adjudication === "false_block",
	).length;
	return falseBlocks / adjudicatedEntries.length;
}

function determineEvaluationDecision(input: {
	legacyOutcome: PilotOutcome;
	metricsErrors: string[];
	identity: AgentIdentity;
	adapter: ProviderAdapterDescriptor | null;
	instructionParity: InstructionParityResult;
	governanceSnapshot: GovernanceSnapshot;
	evaluationMode: EvaluationMode;
}): { decision: ControlPlaneDecision; reasons: string[] } {
	const reasons: string[] = [];
	const mergeAuthoritative =
		input.evaluationMode === "pr" || input.evaluationMode === "merge_group";

	if (input.legacyOutcome === "rollback") {
		reasons.push("Legacy pilot thresholds triggered rollback");
		return { decision: "rollback", reasons };
	}

	if (
		input.governanceSnapshot.sourceTrustLevel !== "trusted" ||
		input.governanceSnapshot.requiredChecks.status !== "pass"
	) {
		reasons.push(...input.governanceSnapshot.warnings);
		return { decision: "block_for_evidence", reasons };
	}

	if (
		mergeAuthoritative &&
		input.governanceSnapshot.prTemplateValidationStatus !== "passed"
	) {
		reasons.push(
			"Trusted PR-template validation is required for merge-authoritative evaluation",
		);
		return { decision: "block_for_evidence", reasons };
	}

	if (input.instructionParity.status === "fail") {
		reasons.push("Instruction parity failed in trusted docs-gate evidence");
		return { decision: "block_for_parity", reasons };
	}

	if (
		mergeAuthoritative &&
		input.instructionParity.status !== "pass" &&
		input.instructionParity.status !== "not_applicable"
	) {
		reasons.push(
			"Instruction parity evidence is unavailable for merge-authoritative evaluation",
		);
		return { decision: "block_for_evidence", reasons };
	}

	if (input.metricsErrors.length > 0 && mergeAuthoritative) {
		reasons.push("Metric capture reported validation errors");
		return { decision: "block_for_evidence", reasons };
	}

	if (!input.adapter || input.identity.identityStatus === "identity_degraded") {
		reasons.push(...input.identity.degradedReasons);
		return {
			decision: input.evaluationMode === "local" ? "hold" : "block_for_adapter",
			reasons,
		};
	}

	if (input.legacyOutcome === "hold") {
		reasons.push("Legacy pilot thresholds require operator hold");
		return { decision: "hold", reasons };
	}

	reasons.push(
		"Legacy pilot thresholds and trusted control-plane evidence permit promotion",
	);
	return { decision: "promote", reasons };
}

function determineEnforcementDecision(
	evaluationDecision: ControlPlaneDecision,
	rolloutStage: RolloutStage,
): ControlPlaneEnforcementDecision {
	if (rolloutStage === "shadow") {
		return "non_blocking";
	}

	if (rolloutStage === "advisory") {
		return evaluationDecision === "promote"
			? "non_blocking"
			: "require_human_review";
	}

	if (evaluationDecision === "promote") {
		return "allow";
	}

	if (evaluationDecision === "hold") {
		return "require_human_review";
	}

	return "block";
}

function appendAuditLogEntry(
	auditPath: string,
	entry: ControlPlaneAuditLogEntry,
): void {
	const dir = dirname(auditPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	appendFileSync(auditPath, `${JSON.stringify(entry)}\n`, "utf-8");
}

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

export function buildControlPlaneArtifacts(input: ControlPlaneBuildInput): {
	summary: ControlPlaneSummary;
	warnings: string[];
} {
	const git = readGitMetadata();
	const evaluationAttemptId = randomUUID();
	const artifactRoot = resolve(
		input.artifactsDir,
		"control-plane",
		evaluationAttemptId,
	);
	mkdirSync(artifactRoot, { recursive: true });

	const evaluationMode = input.options.evaluationMode ?? "local";
	const rolloutStage = input.options.rolloutStage ?? "shadow";
	const {
		adapter,
		clientFamily,
		warnings: adapterWarnings,
	} = resolveProviderAdapter(input.options);
	const identity = buildAgentIdentity(input.options, adapter, clientFamily);
	const { snapshot: governanceSnapshot, warnings: governanceWarnings } =
		buildGovernanceSnapshot(input.options, git);
	const instructionParity = buildInstructionParityResult(
		input.options,
		governanceSnapshot,
	);
	const {
		entries: auditEntries,
		warnings: auditWarnings,
		auditPath,
	} = readAuditLog(input.artifactsDir);
	const { decision: evaluationDecision, reasons: decisionReasons } =
		determineEvaluationDecision({
			legacyOutcome: input.legacyOutcome,
			metricsErrors: input.metricsErrors,
			identity,
			adapter,
			instructionParity,
			governanceSnapshot,
			evaluationMode,
		});
	const enforcementDecision = determineEnforcementDecision(
		evaluationDecision,
		rolloutStage,
	);
	const warnings = unique([
		...adapterWarnings,
		...governanceWarnings,
		...instructionParity.normalizationWarnings,
		...auditWarnings,
	]);
	const runId = `pilot-evaluate-${evaluationAttemptId}`;
	const scorecard: ControlPlaneScorecard = {
		schemaVersion: "control-plane-scorecard/v1",
		evaluationAttemptId,
		runId,
		recordedAt: new Date().toISOString(),
		headSha: git.headSha,
		evaluationDecision,
		enforcementDecision,
		identityStatus: identity.identityStatus,
		instructionParityStatus: instructionParity.status,
		governanceTrustLevel: governanceSnapshot.sourceTrustLevel,
		falseBlockRate: calculateFalseBlockRate(auditEntries),
		decisionReasons: unique([
			...decisionReasons,
			...input.legacyHoldReasons,
			...input.metricsErrors,
		]),
		warnings,
	};
	const controlPlaneRun: ControlPlaneRun = {
		schemaVersion: "control-plane-run/v1",
		evaluationAttemptId,
		runId,
		recordedAt: scorecard.recordedAt,
		artifactRoot,
		repoRoot: git.repoRoot,
		branch: git.branch,
		headSha: git.headSha,
		evaluationMode,
		rolloutStage,
		metricsWindow: {
			windowStart: input.metrics.windowStart,
			windowEnd: input.metrics.windowEnd,
		},
		agentIdentity: identity,
		governanceSnapshotRef: governanceSnapshot.snapshotId,
		instructionParityRef: instructionParity.parityResultId,
	};

	writeJsonFile(join(artifactRoot, "control-plane-run.json"), controlPlaneRun);
	writeJsonFile(
		join(artifactRoot, "governance-snapshot.json"),
		governanceSnapshot,
	);
	writeJsonFile(
		join(artifactRoot, "instruction-parity.json"),
		instructionParity,
	);
	writeJsonFile(join(artifactRoot, "control-plane-scorecard.json"), scorecard);

	const auditEntry: ControlPlaneAuditLogEntry = {
		schemaVersion: "control-plane-audit-log-entry/v1",
		evaluationAttemptId,
		runId,
		checkpointId: evaluationAttemptId,
		phase: "pilot-evaluate",
		command: "pilot-evaluate",
		status:
			enforcementDecision === "block"
				? "blocked"
				: evaluationDecision === "rollback"
					? "failed"
					: "completed",
		artifactRefs: [
			join(artifactRoot, "control-plane-run.json"),
			join(artifactRoot, "governance-snapshot.json"),
			join(artifactRoot, "instruction-parity.json"),
			join(artifactRoot, "control-plane-scorecard.json"),
		],
		sourceProvenance: unique([
			governanceSnapshot.contractRef.path,
			...governanceSnapshot.workflowRefs.map((ref) => ref.path),
			...governanceSnapshot.instructionPolicyRefs.map((ref) => ref.path),
			...(instructionParity.sourceReportRef
				? [instructionParity.sourceReportRef.path]
				: []),
		]),
		...(decisionReasons.length > 0 ? { blocker: decisionReasons[0] } : {}),
		followUp:
			evaluationDecision === "promote"
				? "Continue rollout using the current stage posture"
				: "Review control-plane scorecard and trusted evidence before promotion",
		recordedAt: scorecard.recordedAt,
		auditStatus: "recorded",
		adjudication: "none",
	};
	appendAuditLogEntry(auditPath, auditEntry);

	return {
		summary: {
			artifactRoot,
			evaluationAttemptId,
			runId,
			evaluationDecision,
			enforcementDecision,
			identityStatus: identity.identityStatus,
			instructionParityStatus: instructionParity.status,
			governanceTrustLevel: governanceSnapshot.sourceTrustLevel,
			warnings,
		},
		warnings,
	};
}

function loadControlPlaneJson<T>(path: string): T | null {
	return readJsonFile<T>(path);
}

export function loadControlPlaneArtifactSet(artifactRoot: string): {
	artifacts: ControlPlaneArtifactSet | null;
	errors: string[];
} {
	const resolvedRoot = resolve(artifactRoot);
	const controlPlaneRun = loadControlPlaneJson<ControlPlaneRun>(
		join(resolvedRoot, "control-plane-run.json"),
	);
	const governanceSnapshot = loadControlPlaneJson<GovernanceSnapshot>(
		join(resolvedRoot, "governance-snapshot.json"),
	);
	const instructionParity = loadControlPlaneJson<InstructionParityResult>(
		join(resolvedRoot, "instruction-parity.json"),
	);
	const scorecard = loadControlPlaneJson<ControlPlaneScorecard>(
		join(resolvedRoot, "control-plane-scorecard.json"),
	);
	const auditPath = join(
		dirname(resolvedRoot),
		"audit",
		"control-plane-audit-log.jsonl",
	);
	const auditLog = existsSync(auditPath)
		? readFileSync(auditPath, "utf-8")
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line) as ControlPlaneAuditLogEntry)
				.filter(
					(entry) =>
						entry.evaluationAttemptId === controlPlaneRun?.evaluationAttemptId,
				)
		: [];

	const errors: string[] = [];
	if (!controlPlaneRun) {
		errors.push("Missing control-plane-run.json");
	}
	if (!governanceSnapshot) {
		errors.push("Missing governance-snapshot.json");
	}
	if (!instructionParity) {
		errors.push("Missing instruction-parity.json");
	}
	if (!scorecard) {
		errors.push("Missing control-plane-scorecard.json");
	}

	if (
		controlPlaneRun &&
		scorecard &&
		controlPlaneRun.evaluationAttemptId !== scorecard.evaluationAttemptId
	) {
		errors.push(
			"Join integrity failed: evaluationAttemptId mismatch between run and scorecard",
		);
	}
	if (
		controlPlaneRun &&
		scorecard &&
		controlPlaneRun.runId !== scorecard.runId
	) {
		errors.push(
			"Join integrity failed: runId mismatch between run and scorecard",
		);
	}
	if (
		controlPlaneRun &&
		scorecard &&
		controlPlaneRun.headSha !== scorecard.headSha
	) {
		errors.push(
			"Join integrity failed: headSha mismatch between run and scorecard",
		);
	}
	if (
		controlPlaneRun &&
		governanceSnapshot &&
		controlPlaneRun.governanceSnapshotRef !== governanceSnapshot.snapshotId
	) {
		errors.push(
			"Join integrity failed: governance snapshot reference mismatch",
		);
	}
	if (
		controlPlaneRun &&
		instructionParity &&
		controlPlaneRun.instructionParityRef !== instructionParity.parityResultId
	) {
		errors.push("Join integrity failed: instruction parity reference mismatch");
	}

	if (
		errors.length > 0 ||
		!controlPlaneRun ||
		!governanceSnapshot ||
		!instructionParity ||
		!scorecard
	) {
		return {
			artifacts: null,
			errors,
		};
	}

	return {
		artifacts: {
			controlPlaneRun,
			governanceSnapshot,
			instructionParity,
			scorecard,
			auditLog,
		},
		errors,
	};
}
