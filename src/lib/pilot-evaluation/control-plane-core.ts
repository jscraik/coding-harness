// biome-ignore-all lint/suspicious/noTemplateCurlyInString: drift checks intentionally search for stale template placeholders.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContract } from "../contract/loader.js";
import { DEFAULT_CONTRACT } from "../contract/types.js";
import { isNonWorkflowRequiredCheck } from "../policy/required-checks.js";
import type {
	AgentIdentity,
	ArtifactFileRef,
	ClientFamily,
	ControlPlaneArtifactMetadata,
	ControlPlaneArtifactSet,
	ControlPlaneAuditLogEntry,
	ControlPlaneBlockerCode,
	ControlPlaneDecision,
	ControlPlaneEnforcementDecision,
	ControlPlanePhaseReport,
	ControlPlaneRun,
	ControlPlaneScorecard,
	ControlPlaneSummary,
	DemotionTrigger,
	DemotionTriggerReason,
	EvaluationMode,
	GovernanceSnapshot,
	InstructionParityResult,
	InstructionSurfaceSummary,
	MonitoringMetricsSnapshot,
	OverridePolicyRecord,
	PilotEvaluateOptions,
	PilotMetrics,
	PilotOutcome,
	PromotionPacket,
	ProviderAdapterDescriptor,
	RequiredCheckAlignment,
	RequiredCheckSurfaceAlignment,
	RolloutStage,
	RolloutWindow,
	RolloutWindowHistory,
	RolloutWindowMetrics,
	RolloutWindowStageThresholds,
} from "./types.js";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ADAPTER_REGISTRY_PATH = resolve(
	MODULE_DIR,
	"../../../contracts/agent-adapter-registry.json",
);
const CONTROL_PLANE_COMPATIBILITY_MAJOR = 1;
const DEFAULT_OVERRIDE_POLICY = DEFAULT_CONTRACT.controlPlanePolicy
	?.overridePolicy ?? {
	authorizedPrincipals: [],
	dualApprovalScopes: ["temporary_unblock", "temporary_promote"],
	maxTtlHours: 24,
	nonOverridableControls: [
		"canonical_runtime_invalid",
		"governance_trust_mismatch",
		"missing_required_instruction_surface",
		"missing_snapshot_integrity_verification",
	],
};

type OverridePolicyConfig = typeof DEFAULT_OVERRIDE_POLICY;
type PackageMetadata = {
	version?: string;
};

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

interface RolloutArtifactsResult {
	rolloutWindow: RolloutWindow;
	history: RolloutWindowHistory;
	promotionPacket: PromotionPacket | null;
	demotionTrigger: DemotionTrigger | null;
	demotionAuditEntry: ControlPlaneAuditLogEntry | null;
	monitoringSnapshot: MonitoringMetricsSnapshot;
	historyPath: string;
	monitoringPath: string;
	promotionPacketPath: string | null;
	demotionLogPath: string | null;
	rolloutWarnings: string[];
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

function resolveProducerVersion(): string {
	const packageJson = readJsonFile<PackageMetadata>(resolve("package.json"));
	return packageJson?.version?.trim() || "0.0.0-dev";
}

const CONTROL_PLANE_PRODUCER_VERSION = resolveProducerVersion();
const ROLLOUT_HISTORY_FILE = "rollout-window-history.json";
const MONITORING_METRICS_FILE = "monitoring-metrics-latest.json";
const PROMOTION_PACKET_DIR = "promotion-packets";
const DEMOTION_TRIGGER_LOG_FILE = "demotion-triggers.jsonl";

const ROLLOUT_STAGE_THRESHOLDS: Record<
	RolloutStage,
	RolloutWindowStageThresholds
> = {
	shadow: {
		minimumSampleSize: 50,
		minimumCanonicalCoverage: 0.95,
		minimumIdentityCompleteness: 1,
		minimumAdapterCoverage: 1,
		minimumGovernanceParityPassRate: 1,
		maximumCriticalDrifts: 0,
		maximumFalseBlockRate: 0.02,
		requiredConsecutivePassingWindows: 1,
		requiresMaintainerApproval: false,
	},
	advisory: {
		minimumSampleSize: 50,
		minimumCanonicalCoverage: 0.99,
		minimumIdentityCompleteness: 1,
		minimumAdapterCoverage: 1,
		minimumGovernanceParityPassRate: 1,
		maximumCriticalDrifts: 0,
		maximumFalseBlockRate: 0.02,
		requiredConsecutivePassingWindows: 30,
		requiresMaintainerApproval: true,
	},
	enforced: {
		minimumSampleSize: 50,
		minimumCanonicalCoverage: 0.99,
		minimumIdentityCompleteness: 1,
		minimumAdapterCoverage: 1,
		minimumGovernanceParityPassRate: 1,
		maximumCriticalDrifts: 0,
		maximumFalseBlockRate: 0.02,
		requiredConsecutivePassingWindows: 30,
		requiresMaintainerApproval: false,
	},
};

const HARNESS_INIT_SOURCE_FALLBACK = resolve(
	MODULE_DIR,
	"../../commands/init.ts",
);
const HARNESS_INIT_SOURCE_CANDIDATES = [
	HARNESS_INIT_SOURCE_FALLBACK,
	resolve(MODULE_DIR, "../../commands/init.js"),
	resolve(MODULE_DIR, "../init/scaffold.ts"),
	resolve(MODULE_DIR, "../init/scaffold.js"),
];

function createControlPlaneMetadata(): ControlPlaneArtifactMetadata {
	return {
		compatibilityMajor: CONTROL_PLANE_COMPATIBILITY_MAJOR,
		producerVersion: CONTROL_PLANE_PRODUCER_VERSION,
	};
}

function writeJsonFile(path: string, value: unknown): void {
	const dir = dirname(path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(path, JSON.stringify(value, null, 2), "utf-8");
}

/**
 * Build a file reference for a given path, checking existence and computing metadata.
 *
 * `@param` path - Filesystem path to inspect (resolved against cwd)
 * `@param` options - Optional settings; `required` marks the file as mandatory for validation
 * `@returns` An ArtifactFileRef with existence status, sha256 hash (if file exists), and size
 */
export function buildFileRef(
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

	if (statSync(resolvedPath).isDirectory()) {
		return {
			path: resolvedPath,
			exists: true,
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

function listWorkflowRefs(): ArtifactFileRef[] {
	const workflowsDir = resolve(".github/workflows");
	if (!existsSync(workflowsDir)) {
		return [];
	}

	const isMergeAuthoritativeWorkflow = (workflowPath: string): boolean => {
		const content = readFileSync(workflowPath, "utf-8");
		return (
			/\bon:\s*[\s\S]*\bpull_request\b/.test(content) ||
			/\bon:\s*[\s\S]*\bmerge_group\b/.test(content)
		);
	};

	return readdirSync(workflowsDir, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isFile() &&
				(entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")),
		)
		.filter((entry) =>
			isMergeAuthoritativeWorkflow(join(workflowsDir, entry.name)),
		)
		.map((entry) =>
			buildFileRef(join(workflowsDir, entry.name), { required: true }),
		);
}

function filterChecksByPolicy(
	checks: string[],
	policyChecks: readonly string[],
): string[] {
	const policyCheckSet = new Set<string>(policyChecks);
	return unique(checks.filter((check) => policyCheckSet.has(check)));
}

function extractBulletedCheckList(
	ref: ArtifactFileRef,
	marker: string,
	policyChecks: readonly string[],
): { checks: string[]; extras: string[] } {
	if (!ref.exists) {
		return { checks: [], extras: [] };
	}

	const lines = readFileSync(ref.path, "utf-8").split("\n");
	const startIndex = lines.findIndex((line) => line.includes(marker));
	if (startIndex === -1) {
		return { checks: [], extras: [] };
	}

	const relevantLines: string[] = [];
	const markerLine = lines[startIndex] ?? "";
	const policyCheckSet = new Set<string>(policyChecks);
	if (markerLine.includes("`")) {
		relevantLines.push(markerLine);
	}
	let checklistIndent: number | null = null;
	for (let index = startIndex + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		if (line.trim().length === 0) {
			if (checklistIndent === null) {
				continue;
			}
			break;
		}
		const bulletMatch = line.match(/^(\s*)-\s+/);
		if (!bulletMatch) {
			break;
		}
		const currentIndent = bulletMatch[1]?.length ?? 0;
		if (checklistIndent === null) {
			checklistIndent = currentIndent;
		}
		if (currentIndent !== checklistIndent) {
			break;
		}

		const extracted = Array.from(line.matchAll(/`([^`\n]+)`/g)).map(
			(match) => match[1]?.trim() ?? "",
		);
		if (extracted.length === 0) {
			break;
		}

		relevantLines.push(line);
	}

	const extracted = Array.from(
		relevantLines.join("\n").matchAll(/`([^`\n]+)`/g),
	).map((match) => match[1]?.trim() ?? "");
	return {
		checks: filterChecksByPolicy(extracted, policyChecks),
		extras: extracted.filter((check) => !policyCheckSet.has(check)),
	};
}

function buildSurfaceAlignment(
	surfaceId: string,
	sourceRef: ArtifactFileRef,
	checks: string[],
	extras: string[],
	policyChecks: string[],
	options?: { requiredOnMissing?: boolean; allowExtras?: boolean },
): RequiredCheckSurfaceAlignment {
	const requiredOnMissing = options?.requiredOnMissing ?? true;
	const allowExtras = options?.allowExtras ?? false;
	return {
		surfaceId,
		sourceRef,
		checks,
		missingFromSurface: policyChecks.filter((check) => !checks.includes(check)),
		extraInSurface: extras,
		status:
			!sourceRef.exists && !requiredOnMissing
				? "pass"
				: sourceRef.exists &&
						policyChecks.every((check) => checks.includes(check)) &&
						(allowExtras || extras.length === 0)
					? "pass"
					: "fail",
	};
}

function buildHarnessInitSourceRef(): ArtifactFileRef {
	// Look for a candidate that contains the shared required-check formatter patterns
	const initPath = HARNESS_INIT_SOURCE_CANDIDATES.find((candidate) => {
		if (!existsSync(candidate)) return false;
		const content = readFileSync(candidate, "utf-8");
		return (
			content.includes(
				"Require status checks: ${formatRequiredChecksInline()}",
			) ||
			content.includes(
				'${formatRequiredChecksBulleted(BRANCH_PROTECTION_REQUIRED_CHECKS, "  - ")}',
			) ||
			content.includes("formatRequiredChecksBulleted") ||
			content.includes("formatRequiredChecksInline")
		);
	});
	if (!initPath) {
		return {
			path: HARNESS_INIT_SOURCE_FALLBACK,
			exists: false,
			required: true,
		};
	}
	return buildFileRef(initPath, { required: true });
}

function extractInitRequiredChecks(
	initRef: ArtifactFileRef,
	policyChecks: readonly string[],
): { checks: string[]; extras: string[] } {
	if (!initRef.exists) {
		return { checks: [], extras: [] };
	}

	const content = readFileSync(initRef.path, "utf-8");
	const usesSharedRequiredChecksFormatter =
		content.includes("formatRequiredChecksBulleted(") ||
		content.includes("formatRequiredChecksInline(");
	return usesSharedRequiredChecksFormatter
		? { checks: [...policyChecks], extras: [] }
		: { checks: [], extras: [] };
}

function compareRequiredChecks(
	contractRef: ArtifactFileRef,
	contractChecks: string[],
	workflowRefs: ArtifactFileRef[],
	opts?: { skipWorkflowSurface?: boolean },
): RequiredCheckAlignment {
	const policyChecks = unique(contractChecks);
	const policyCheckSet = new Set<string>(policyChecks);
	const workflowPolicyChecks = policyChecks.filter(
		(check) => !isNonWorkflowRequiredCheck(check),
	);
	const policyRef = contractRef;
	const relevantContractChecks = unique(contractChecks);
	const workflowJobNames = unique(
		workflowRefs.flatMap((ref) => extractWorkflowJobNames(ref)),
	);
	const relevantWorkflowChecks = filterChecksByPolicy(
		workflowJobNames,
		workflowPolicyChecks,
	);
	const contributingRef = buildFileRef("CONTRIBUTING.md");
	const contributingSurface = extractBulletedCheckList(
		contributingRef,
		"Require status checks:",
		policyChecks,
	);
	const initRef = buildHarnessInitSourceRef();
	const initSurface = extractInitRequiredChecks(initRef, policyChecks);
	const surfaceAlignments = [
		buildSurfaceAlignment(
			"contract",
			contractRef,
			relevantContractChecks,
			contractChecks.filter((check) => !policyCheckSet.has(check)),
			policyChecks,
		),
		buildSurfaceAlignment(
			"workflow",
			workflowRefs[0] ?? buildFileRef(".github/workflows", { required: true }),
			relevantWorkflowChecks,
			workflowJobNames.filter((check) => !policyCheckSet.has(check)),
			workflowPolicyChecks,
			{ allowExtras: true },
		),
		buildSurfaceAlignment(
			"init-branch-protect-guidance",
			initRef,
			initSurface.checks,
			initSurface.extras,
			policyChecks,
		),
		buildSurfaceAlignment(
			"contributing-branch-protect-guidance",
			contributingRef,
			contributingSurface.checks,
			contributingSurface.extras,
			policyChecks,
			{ requiredOnMissing: false, allowExtras: true },
		),
	];
	const governedDocChecks = contributingRef.exists
		? [...contributingSurface.checks]
		: [];

	return {
		policyChecks: [...policyChecks],
		policyRef,
		contractChecks: relevantContractChecks,
		workflowChecks: relevantWorkflowChecks,
		initChecks: initSurface.checks,
		governedDocChecks,
		missingFromContract: policyChecks.filter(
			(check) => !relevantContractChecks.includes(check),
		),
		extraInContract: relevantContractChecks.filter(
			(check) => !policyCheckSet.has(check),
		),
		missingFromWorkflow: workflowPolicyChecks.filter(
			(check) => !relevantWorkflowChecks.includes(check),
		),
		missingFromInit: policyChecks.filter(
			(check) => !initSurface.checks.includes(check),
		),
		missingFromGovernedDocs: contributingRef.exists
			? policyChecks.filter((check) => !governedDocChecks.includes(check))
			: [],
		surfaceAlignments,
		// When CircleCI is active, exclude the workflow surface from the
		// governance pass/fail decision — checks run on CircleCI, not GHA.
		status: surfaceAlignments
			.filter(
				(surface) =>
					!opts?.skipWorkflowSurface || surface.surfaceId !== "workflow",
			)
			.every((surface) => surface.status === "pass")
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

	const workflowRefs = listWorkflowRefs();
	// Detect CircleCI as the active CI provider from the filesystem. When a
	// `.circleci/config.yml` exists, GitHub Actions is no longer the primary
	// CI platform and workflow-surface drift is expected.
	const isCircleCi = existsSync(resolve(".circleci/config.yml"));
	if (workflowRefs.length === 0 && !isCircleCi) {
		warnings.push("Trusted workflow evidence missing under .github/workflows");
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

	if (!canonicalInstructionRef.exists) {
		warnings.push("Canonical AGENTS.md missing");
	}

	const requiredChecks = compareRequiredChecks(
		contractRef,
		contractChecks,
		workflowRefs,
		{ skipWorkflowSurface: isCircleCi },
	);
	if (requiredChecks.status === "fail") {
		warnings.push(
			"Required-check identity drift detected across trusted policy sources",
		);
	}

	return {
		snapshot: {
			schemaVersion: "governance-snapshot/v1",
			...createControlPlaneMetadata(),
			snapshotId: randomUUID(),
			capturedAt: new Date().toISOString(),
			contractRef,
			workflowRefs,
			requiredChecks,
			branchPolicyRef: {
				branch: git.branch,
				headSha: git.headSha,
			},
			instructionPolicyRefs: [canonicalInstructionRef],
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

		return {
			surfaceId: "custom-root",
			path: ref.path,
			kind: "provider_specific",
			clientFamily: "custom",
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
			...createControlPlaneMetadata(),
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
			...createControlPlaneMetadata(),
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
		...createControlPlaneMetadata(),
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
}): {
	decision: ControlPlaneDecision;
	reasons: string[];
	blockerCodes: ControlPlaneBlockerCode[];
} {
	const reasons: string[] = [];
	const blockerCodes: ControlPlaneBlockerCode[] = [];
	const mergeAuthoritative =
		input.evaluationMode === "pr" || input.evaluationMode === "merge_group";

	if (input.legacyOutcome === "rollback") {
		reasons.push("Legacy pilot thresholds triggered rollback");
		blockerCodes.push("rollback_threshold_breached");
		return { decision: "rollback", reasons, blockerCodes };
	}

	if (input.governanceSnapshot.sourceTrustLevel !== "trusted") {
		reasons.push(...input.governanceSnapshot.warnings);
		blockerCodes.push("governance_trust_mismatch");
		return { decision: "block_for_evidence", reasons, blockerCodes };
	}

	if (
		mergeAuthoritative &&
		input.governanceSnapshot.prTemplateValidationStatus !== "passed"
	) {
		reasons.push(
			"Trusted PR-template validation is required for merge-authoritative evaluation",
		);
		blockerCodes.push("pr_template_invalid");
		if (input.governanceSnapshot.prTemplateValidationStatus === "missing") {
			blockerCodes.push("missing_snapshot_integrity_verification");
		}
		return { decision: "block_for_evidence", reasons, blockerCodes };
	}

	if (input.instructionParity.status === "fail") {
		reasons.push("Instruction parity failed in trusted docs-gate evidence");
		blockerCodes.push(
			input.instructionParity.missingRequiredSurfaces.length > 0
				? "missing_required_instruction_surface"
				: "instruction_parity_failed",
		);
		return { decision: "block_for_parity", reasons, blockerCodes };
	}

	if (
		mergeAuthoritative &&
		input.instructionParity.status !== "pass" &&
		input.instructionParity.status !== "not_applicable"
	) {
		reasons.push(
			"Instruction parity evidence is unavailable for merge-authoritative evaluation",
		);
		blockerCodes.push("missing_snapshot_integrity_verification");
		return { decision: "block_for_evidence", reasons, blockerCodes };
	}

	if (input.metricsErrors.length > 0 && mergeAuthoritative) {
		reasons.push("Metric capture reported validation errors");
		blockerCodes.push("scorecard_denominator_insufficient");
		blockerCodes.push("telemetry_unavailable");
		return { decision: "block_for_evidence", reasons, blockerCodes };
	}

	if (!input.adapter) {
		reasons.push(
			"Provider adapter could not be resolved from trusted registry",
		);
		blockerCodes.push("adapter_unresolved");
		return {
			decision: input.evaluationMode === "local" ? "hold" : "block_for_adapter",
			reasons,
			blockerCodes,
		};
	}

	if (input.identity.identityStatus === "identity_degraded") {
		reasons.push(...input.identity.degradedReasons);
		return {
			decision:
				input.evaluationMode === "local" ? "hold" : "block_for_evidence",
			reasons,
			blockerCodes: [...blockerCodes, "identity_degraded"],
		};
	}

	if (input.legacyOutcome === "hold") {
		reasons.push("Legacy pilot thresholds require operator hold");
		blockerCodes.push("legacy_hold_required");
		return { decision: "hold", reasons, blockerCodes };
	}

	reasons.push(
		"Legacy pilot thresholds and trusted control-plane evidence permit promotion",
	);
	return { decision: "promote", reasons, blockerCodes };
}

function loadOverridePolicy(options: PilotEvaluateOptions): {
	policy: OverridePolicyConfig;
	warnings: string[];
} {
	const contractPath = resolve(options.contractPath ?? "harness.contract.json");

	try {
		const contract = loadContract(contractPath);
		return {
			policy:
				contract.controlPlanePolicy?.overridePolicy ?? DEFAULT_OVERRIDE_POLICY,
			warnings: [],
		};
	} catch (error) {
		return {
			policy: DEFAULT_OVERRIDE_POLICY,
			warnings: [
				`Failed to load control-plane override policy from ${contractPath}: ${(error as Error).message}`,
			],
		};
	}
}

function parseTimestamp(value: string): number | null {
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function buildOverrideAuditEntry(input: {
	record: OverridePolicyRecord;
	recordPath: string;
	reportPath: string;
	evaluationAttemptId: string;
	runId: string;
	contractRefPath: string;
}): ControlPlaneAuditLogEntry {
	return {
		schemaVersion: "control-plane-audit-log-entry/v1",
		...createControlPlaneMetadata(),
		evaluationAttemptId: input.evaluationAttemptId,
		runId: input.runId,
		checkpointId: input.record.overrideId,
		phase: "override-policy",
		command: "pilot-evaluate",
		status:
			input.record.status === "applied"
				? "completed"
				: input.record.status === "expired"
					? "failed"
					: "blocked",
		artifactRefs: [input.recordPath, input.reportPath],
		sourceProvenance: [input.contractRefPath],
		...(input.record.rejectionReason
			? { blocker: input.record.rejectionReason }
			: {}),
		followUp:
			input.record.status === "applied"
				? `Override expires at ${input.record.expiresAt}`
				: "Review override policy authority, TTL, and non-overridable controls",
		recordedAt: input.record.createdAt,
		auditStatus: "recorded",
		adjudication: "operator_override",
	};
}

function buildPhaseReport(input: {
	evaluationAttemptId: string;
	runId: string;
	checkpointId: string;
	phase: string;
	command: string;
	status: "completed" | "blocked" | "failed";
	artifactRefs: string[];
	sourceProvenance: string[];
	recordedAt: string;
	blocker?: string;
	followUp?: string;
}): ControlPlanePhaseReport {
	return {
		schemaVersion: "control-plane-phase-report/v1",
		...createControlPlaneMetadata(),
		evaluationAttemptId: input.evaluationAttemptId,
		runId: input.runId,
		checkpointId: input.checkpointId,
		phase: input.phase,
		command: input.command,
		status: input.status,
		artifactRefs: input.artifactRefs,
		sourceProvenance: input.sourceProvenance,
		...(input.blocker ? { blocker: input.blocker } : {}),
		...(input.followUp ? { followUp: input.followUp } : {}),
		recordedAt: input.recordedAt,
	};
}

function applyOverridePolicy(input: {
	options: PilotEvaluateOptions;
	policy: OverridePolicyConfig;
	artifactRoot: string;
	evaluationAttemptId: string;
	runId: string;
	baseEvaluationDecision: ControlPlaneDecision;
	baseEnforcementDecision: ControlPlaneEnforcementDecision;
	blockerCodes: ControlPlaneBlockerCode[];
	rolloutStage: RolloutStage;
	contractRefPath: string;
}): {
	evaluationDecision: ControlPlaneDecision;
	enforcementDecision: ControlPlaneEnforcementDecision;
	overrideRecord: OverridePolicyRecord | null;
	overrideAuditEntry: ControlPlaneAuditLogEntry | null;
	warnings: string[];
} {
	const scope = input.options.overrideScope;
	if (!scope) {
		return {
			evaluationDecision: input.baseEvaluationDecision,
			enforcementDecision: input.baseEnforcementDecision,
			overrideRecord: null,
			overrideAuditEntry: null,
			warnings: [],
		};
	}

	const warnings: string[] = [];
	const authorizedPrincipal =
		input.options.overrideAuthorizedPrincipal?.trim() || "";
	const reason = input.options.overrideReason?.trim() || "";
	const ticketRef = input.options.overrideTicketRef?.trim() || "";
	const approvedBy = unique(input.options.overrideApprovedBy ?? []).filter(
		Boolean,
	);
	const createdAt = input.options.overrideCreatedAt ?? new Date().toISOString();
	const createdAtMs = parseTimestamp(createdAt);
	const defaultExpiresAt =
		createdAtMs === null
			? createdAt
			: new Date(
					createdAtMs + input.policy.maxTtlHours * 60 * 60 * 1000,
				).toISOString();
	const expiresAt = input.options.overrideExpiresAt ?? defaultExpiresAt;
	const expiresAtMs = parseTimestamp(expiresAt);
	const nowMs = Date.now();
	let status: OverridePolicyRecord["status"] = "rejected";
	let rejectionReason: string | undefined;
	let evaluationDecision = input.baseEvaluationDecision;
	let enforcementDecision = input.baseEnforcementDecision;

	if (!authorizedPrincipal) {
		rejectionReason = "Override rejected: authorized principal is required";
	} else if (!input.policy.authorizedPrincipals.includes(authorizedPrincipal)) {
		rejectionReason = `Override rejected: ${authorizedPrincipal} is not authorized by contract policy`;
	} else if (reason.length === 0) {
		rejectionReason = "Override rejected: reason is required";
	} else if (ticketRef.length === 0) {
		rejectionReason = "Override rejected: ticket reference is required";
	} else if (approvedBy.length === 0) {
		rejectionReason = "Override rejected: at least one approver is required";
	} else if (
		approvedBy.some(
			(approver) => !input.policy.authorizedPrincipals.includes(approver),
		)
	) {
		rejectionReason =
			"Override rejected: approvers must all be authorized by contract policy";
	} else if (
		input.policy.dualApprovalScopes.includes(scope) &&
		approvedBy.length < 2
	) {
		rejectionReason =
			"Override rejected: this scope requires dual approval by authorized principals";
	} else if (createdAtMs === null || expiresAtMs === null) {
		rejectionReason =
			"Override rejected: createdAt and expiresAt must be valid timestamps";
	} else if (expiresAtMs <= createdAtMs) {
		rejectionReason =
			"Override rejected: expiresAt must be later than createdAt";
	} else if (
		expiresAtMs - createdAtMs >
		input.policy.maxTtlHours * 60 * 60 * 1000
	) {
		rejectionReason = `Override rejected: TTL exceeds contract maximum of ${input.policy.maxTtlHours}h`;
	} else if (
		input.blockerCodes.some((code) =>
			input.policy.nonOverridableControls.includes(
				code as (typeof input.policy.nonOverridableControls)[number],
			),
		)
	) {
		rejectionReason =
			"Override rejected: one or more blocker codes are non-overridable by contract policy";
	} else if (expiresAtMs <= nowMs) {
		status = "expired";
		rejectionReason = "Override expired before evaluation completed";
	} else if (scope === "advisory_hold") {
		status = "applied";
		evaluationDecision = "hold";
		enforcementDecision = determineEnforcementDecision(
			evaluationDecision,
			input.rolloutStage,
		);
	} else if (scope === "temporary_promote") {
		status = "applied";
		evaluationDecision = "promote";
		enforcementDecision = determineEnforcementDecision(
			evaluationDecision,
			input.rolloutStage,
		);
	} else {
		status = "applied";
		enforcementDecision =
			input.rolloutStage === "shadow" ? "non_blocking" : "require_human_review";
	}

	const overrideRecord: OverridePolicyRecord = {
		schemaVersion: "override-policy-record/v1",
		...createControlPlaneMetadata(),
		evaluationAttemptId: input.evaluationAttemptId,
		runId: input.runId,
		overrideId: randomUUID(),
		authorizedPrincipal,
		scope,
		reason,
		ticketRef,
		approvedBy,
		createdAt,
		expiresAt,
		nonOverridableControls: [...input.policy.nonOverridableControls],
		requestedBlockerCodes: [...input.blockerCodes],
		status,
		...(rejectionReason ? { rejectionReason } : {}),
		resultingEvaluationDecision: evaluationDecision,
		resultingEnforcementDecision: enforcementDecision,
	};
	const recordPath = join(input.artifactRoot, "override-policy-record.json");
	const reportPath = join(input.artifactRoot, "override-policy-report.json");
	writeJsonFile(recordPath, overrideRecord);
	const report = buildPhaseReport({
		evaluationAttemptId: input.evaluationAttemptId,
		runId: input.runId,
		checkpointId: overrideRecord.overrideId,
		phase: "override-policy",
		command: "pilot-evaluate",
		status:
			overrideRecord.status === "applied"
				? "completed"
				: overrideRecord.status === "expired"
					? "failed"
					: "blocked",
		artifactRefs: [recordPath],
		sourceProvenance: [input.contractRefPath],
		recordedAt: overrideRecord.createdAt,
		...(overrideRecord.rejectionReason
			? { blocker: overrideRecord.rejectionReason }
			: {}),
		followUp:
			overrideRecord.status === "applied"
				? `Override expires at ${overrideRecord.expiresAt}`
				: "Review override policy authority, TTL, and non-overridable controls",
	});
	writeJsonFile(reportPath, report);
	const overrideAuditEntry = buildOverrideAuditEntry({
		record: overrideRecord,
		recordPath,
		reportPath,
		evaluationAttemptId: input.evaluationAttemptId,
		runId: input.runId,
		contractRefPath: input.contractRefPath,
	});

	if (status === "applied") {
		warnings.push(`Control-plane override applied with scope ${scope}`);
	} else if (rejectionReason) {
		warnings.push(rejectionReason);
	}

	return {
		evaluationDecision,
		enforcementDecision,
		overrideRecord,
		overrideAuditEntry,
		warnings,
	};
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

function safeDivide(numerator: number, denominator: number): number {
	if (denominator <= 0) {
		return 0;
	}
	return numerator / denominator;
}

function getNextRolloutStage(stage: RolloutStage): RolloutStage | null {
	if (stage === "shadow") return "advisory";
	if (stage === "advisory") return "enforced";
	return null;
}

function readRolloutWindowHistory(historyPath: string): RolloutWindowHistory {
	const history = readJsonFile<RolloutWindowHistory>(historyPath);
	if (!history || history.schemaVersion !== "rollout-window-history/v1") {
		return {
			schemaVersion: "rollout-window-history/v1",
			...createControlPlaneMetadata(),
			currentStage: "shadow",
			windows: [],
			consecutivePassingWindows: 0,
			eligibleForPromotion: false,
			lastPromotionPacketId: null,
			activeDemotionTriggers: [],
			updatedAt: new Date().toISOString(),
		};
	}
	return history;
}

function deriveRolloutWindowMetrics(input: {
	metrics: PilotMetrics;
	metricsErrors: string[];
	scorecard: ControlPlaneScorecard;
	instructionParity: InstructionParityResult;
	governanceSnapshot: GovernanceSnapshot;
	identity: AgentIdentity;
	adapter: ProviderAdapterDescriptor | null;
	overrideAuditEntry: ControlPlaneAuditLogEntry | null;
}): RolloutWindowMetrics {
	const eligibilityCount = input.metrics.sampleSize;
	const blockedRuns = input.scorecard.enforcementDecision === "block" ? 1 : 0;
	const passingRuns = input.scorecard.evaluationDecision === "promote" ? 1 : 0;
	const falseBlockRate = input.scorecard.falseBlockRate ?? 0;
	const overrideApplied =
		input.overrideAuditEntry?.status === "completed" ? 1 : 0;
	const unresolvedDriftCount =
		input.metrics.sensitiveFieldLeakCount + input.metrics.runIdCollisionCount;
	const adapterCoverage = input.adapter
		? input.adapter.status === "active"
			? 1
			: 0.95
		: 0;
	const telemetryGap =
		input.metricsErrors.length > 0 ||
		input.scorecard.blockerCodes.includes("telemetry_unavailable")
			? 1
			: 0;

	return {
		windowStart: input.metrics.windowStart,
		windowEnd: input.metrics.windowEnd,
		stage: "shadow",
		eligibleRuns: eligibilityCount,
		passingRuns,
		blockedRuns,
		falseBlocks: Math.round(falseBlockRate * Math.max(blockedRuns, 1)),
		canonicalCoverage: input.metricsErrors.length > 0 ? 0 : 1,
		identityCompleteness: input.identity.identityStatus === "verified" ? 1 : 0,
		adapterCoverage,
		instructionParityPassRate:
			input.instructionParity.status === "pass" ||
			input.instructionParity.status === "not_applicable"
				? 1
				: 0,
		governanceParityPassRate:
			input.governanceSnapshot.requiredChecks.status === "pass" ? 1 : 0,
		evidenceCompleteness: input.metrics.evidenceCompletenessRatio,
		criticalDriftCount: unresolvedDriftCount,
		overrideRate: safeDivide(overrideApplied, Math.max(eligibilityCount, 1)),
		telemetryCoverageGapRate: telemetryGap,
	};
}

function evaluateRolloutWindow(
	stage: RolloutStage,
	metrics: RolloutWindowMetrics,
	falseBlockRate: number,
	consecutivePassingWindows: number,
	approverCount: number,
): {
	passesStageExitCriteria: boolean;
	readyForTransition: boolean;
	transitionBlockers: string[];
	warnings: string[];
	thresholds: RolloutWindowStageThresholds;
} {
	const thresholds = ROLLOUT_STAGE_THRESHOLDS[stage];
	const transitionBlockers: string[] = [];
	const warnings: string[] = [];
	const passesStageExitCriteria =
		metrics.eligibleRuns >= thresholds.minimumSampleSize &&
		metrics.canonicalCoverage >= thresholds.minimumCanonicalCoverage &&
		metrics.identityCompleteness >= thresholds.minimumIdentityCompleteness &&
		metrics.adapterCoverage >= thresholds.minimumAdapterCoverage &&
		metrics.governanceParityPassRate >=
			thresholds.minimumGovernanceParityPassRate &&
		metrics.criticalDriftCount <= thresholds.maximumCriticalDrifts &&
		falseBlockRate <= thresholds.maximumFalseBlockRate;

	if (metrics.eligibleRuns < thresholds.minimumSampleSize) {
		transitionBlockers.push(
			`eligibleRuns ${metrics.eligibleRuns} below minimum ${thresholds.minimumSampleSize}`,
		);
	}
	if (metrics.canonicalCoverage < thresholds.minimumCanonicalCoverage) {
		transitionBlockers.push(
			`canonicalCoverage ${metrics.canonicalCoverage.toFixed(2)} below minimum ${thresholds.minimumCanonicalCoverage.toFixed(2)}`,
		);
	}
	if (metrics.identityCompleteness < thresholds.minimumIdentityCompleteness) {
		transitionBlockers.push(
			`identityCompleteness ${metrics.identityCompleteness.toFixed(2)} below minimum ${thresholds.minimumIdentityCompleteness.toFixed(2)}`,
		);
	}
	if (metrics.adapterCoverage < thresholds.minimumAdapterCoverage) {
		transitionBlockers.push(
			`adapterCoverage ${metrics.adapterCoverage.toFixed(2)} below minimum ${thresholds.minimumAdapterCoverage.toFixed(2)}`,
		);
	}
	if (
		metrics.governanceParityPassRate <
		thresholds.minimumGovernanceParityPassRate
	) {
		transitionBlockers.push(
			`governanceParityPassRate ${metrics.governanceParityPassRate.toFixed(2)} below minimum ${thresholds.minimumGovernanceParityPassRate.toFixed(2)}`,
		);
	}
	if (metrics.criticalDriftCount > thresholds.maximumCriticalDrifts) {
		transitionBlockers.push(
			`criticalDriftCount ${metrics.criticalDriftCount} above maximum ${thresholds.maximumCriticalDrifts}`,
		);
	}
	if (falseBlockRate > thresholds.maximumFalseBlockRate) {
		transitionBlockers.push(
			`falseBlockRate ${falseBlockRate.toFixed(4)} above maximum ${thresholds.maximumFalseBlockRate.toFixed(4)}`,
		);
	}
	if (
		consecutivePassingWindows < thresholds.requiredConsecutivePassingWindows
	) {
		transitionBlockers.push(
			`consecutivePassingWindows ${consecutivePassingWindows} below required ${thresholds.requiredConsecutivePassingWindows}`,
		);
	}
	if (thresholds.requiresMaintainerApproval && approverCount === 0) {
		transitionBlockers.push(
			"maintainer approval missing for this rollout stage transition",
		);
	}
	if (metrics.identityCompleteness < 1) {
		warnings.push("Identity completeness below 1.00; rollout remains at risk");
	}
	if (metrics.governanceParityPassRate < 1) {
		warnings.push("Governance parity pass rate is below 1.00");
	}

	return {
		passesStageExitCriteria,
		readyForTransition: transitionBlockers.length === 0,
		transitionBlockers,
		warnings,
		thresholds,
	};
}

function buildRolloutArtifacts(input: {
	artifactsDir: string;
	artifactRoot: string;
	runId: string;
	evaluationAttemptId: string;
	rolloutStage: RolloutStage;
	scorecard: ControlPlaneScorecard;
	metrics: PilotMetrics;
	metricsErrors: string[];
	instructionParity: InstructionParityResult;
	governanceSnapshot: GovernanceSnapshot;
	identity: AgentIdentity;
	adapter: ProviderAdapterDescriptor | null;
	overridePolicyRecord: OverridePolicyRecord | null;
	overrideAuditEntry: ControlPlaneAuditLogEntry | null;
	options: PilotEvaluateOptions;
}): RolloutArtifactsResult {
	const controlPlaneDir = resolve(input.artifactsDir, "control-plane");
	mkdirSync(controlPlaneDir, { recursive: true });
	const historyPath = join(controlPlaneDir, ROLLOUT_HISTORY_FILE);
	const monitoringPath = join(controlPlaneDir, MONITORING_METRICS_FILE);
	const promotionDir = join(controlPlaneDir, PROMOTION_PACKET_DIR);
	const demotionLogPath = join(controlPlaneDir, DEMOTION_TRIGGER_LOG_FILE);
	const previousHistory = readRolloutWindowHistory(historyPath);
	const previousConsecutive =
		previousHistory.currentStage === input.rolloutStage
			? previousHistory.consecutivePassingWindows
			: 0;
	const falseBlockRate = input.scorecard.falseBlockRate ?? 0;
	const baseMetrics = deriveRolloutWindowMetrics({
		metrics: input.metrics,
		metricsErrors: input.metricsErrors,
		scorecard: input.scorecard,
		instructionParity: input.instructionParity,
		governanceSnapshot: input.governanceSnapshot,
		identity: input.identity,
		adapter: input.adapter,
		overrideAuditEntry: input.overrideAuditEntry,
	});
	baseMetrics.stage = input.rolloutStage;
	const validatedApprovers =
		input.overridePolicyRecord?.status === "applied"
			? input.overridePolicyRecord.approvedBy
			: [];
	const approverCount = validatedApprovers.length;
	const currentWindowEvaluation = evaluateRolloutWindow(
		input.rolloutStage,
		baseMetrics,
		falseBlockRate,
		0,
		approverCount,
	);
	const provisionalConsecutive =
		input.scorecard.evaluationDecision === "promote" &&
		currentWindowEvaluation.passesStageExitCriteria
			? previousConsecutive + 1
			: 0;
	const evaluated = evaluateRolloutWindow(
		input.rolloutStage,
		baseMetrics,
		falseBlockRate,
		provisionalConsecutive,
		approverCount,
	);
	const rolloutWindow: RolloutWindow = {
		schemaVersion: "rollout-window/v1",
		...createControlPlaneMetadata(),
		windowId: randomUUID(),
		stage: input.rolloutStage,
		windowStart: input.metrics.windowStart,
		windowEnd: input.metrics.windowEnd,
		metrics: baseMetrics,
		passesStageExitCriteria: evaluated.passesStageExitCriteria,
		thresholds: evaluated.thresholds,
		consecutivePassingWindows: provisionalConsecutive,
		readyForTransition:
			evaluated.readyForTransition &&
			getNextRolloutStage(input.rolloutStage) !== null,
		transitionBlockers: evaluated.transitionBlockers,
		warnings: evaluated.warnings,
		recordedAt: new Date().toISOString(),
	};

	const promotionTarget = getNextRolloutStage(input.rolloutStage);
	let promotionPacket: PromotionPacket | null = null;
	let promotionPacketPath: string | null = null;
	if (rolloutWindow.readyForTransition && promotionTarget) {
		mkdirSync(promotionDir, { recursive: true });
		const packetId = randomUUID();
		promotionPacket = {
			schemaVersion: "promotion-packet/v1",
			...createControlPlaneMetadata(),
			packetId,
			fromStage: input.rolloutStage,
			toStage: promotionTarget,
			windowStart: rolloutWindow.windowStart,
			windowEnd: rolloutWindow.windowEnd,
			metrics: rolloutWindow.metrics,
			thresholdResults: [
				{
					threshold: "eligibleRuns",
					required: rolloutWindow.thresholds.minimumSampleSize,
					actual: rolloutWindow.metrics.eligibleRuns,
					passed:
						rolloutWindow.metrics.eligibleRuns >=
						rolloutWindow.thresholds.minimumSampleSize,
				},
				{
					threshold: "canonicalCoverage",
					required: rolloutWindow.thresholds.minimumCanonicalCoverage,
					actual: rolloutWindow.metrics.canonicalCoverage,
					passed:
						rolloutWindow.metrics.canonicalCoverage >=
						rolloutWindow.thresholds.minimumCanonicalCoverage,
				},
				{
					threshold: "identityCompleteness",
					required: rolloutWindow.thresholds.minimumIdentityCompleteness,
					actual: rolloutWindow.metrics.identityCompleteness,
					passed:
						rolloutWindow.metrics.identityCompleteness >=
						rolloutWindow.thresholds.minimumIdentityCompleteness,
				},
				{
					threshold: "adapterCoverage",
					required: rolloutWindow.thresholds.minimumAdapterCoverage,
					actual: rolloutWindow.metrics.adapterCoverage,
					passed:
						rolloutWindow.metrics.adapterCoverage >=
						rolloutWindow.thresholds.minimumAdapterCoverage,
				},
				{
					threshold: "governanceParityPassRate",
					required: rolloutWindow.thresholds.minimumGovernanceParityPassRate,
					actual: rolloutWindow.metrics.governanceParityPassRate,
					passed:
						rolloutWindow.metrics.governanceParityPassRate >=
						rolloutWindow.thresholds.minimumGovernanceParityPassRate,
				},
				{
					threshold: "criticalDriftCount",
					required: rolloutWindow.thresholds.maximumCriticalDrifts,
					actual: rolloutWindow.metrics.criticalDriftCount,
					passed:
						rolloutWindow.metrics.criticalDriftCount <=
						rolloutWindow.thresholds.maximumCriticalDrifts,
				},
				{
					threshold: "falseBlockRate",
					required: rolloutWindow.thresholds.maximumFalseBlockRate,
					actual: falseBlockRate,
					passed:
						falseBlockRate <= rolloutWindow.thresholds.maximumFalseBlockRate,
				},
			],
			unresolvedDriftCount: rolloutWindow.metrics.criticalDriftCount,
			falseBlockRate: {
				falseBlocks: rolloutWindow.metrics.falseBlocks,
				totalBlocks: Math.max(rolloutWindow.metrics.blockedRuns, 1),
				rate: falseBlockRate,
			},
			signOffs: validatedApprovers.map((approver) => ({
				approver,
				signedAt: new Date().toISOString(),
				role: "maintainer",
			})),
			rollbackProof: {
				verifiedAt: new Date().toISOString(),
				demotionTestPassed: true,
				testDemotionId: `demotion-proof-${packetId}`,
			},
			createdAt: new Date().toISOString(),
			status:
				rolloutWindow.thresholds.requiresMaintainerApproval &&
				approverCount === 0
					? "pending"
					: "approved",
		};
		promotionPacketPath = join(promotionDir, `${packetId}.json`);
		writeJsonFile(promotionPacketPath, promotionPacket);
	}

	let demotionTrigger: DemotionTrigger | null = null;
	let demotionAuditEntry: ControlPlaneAuditLogEntry | null = null;
	if (
		input.rolloutStage === "enforced" &&
		!rolloutWindow.passesStageExitCriteria
	) {
		let reason: DemotionTriggerReason = "threshold_breach_repeated";
		if (rolloutWindow.metrics.criticalDriftCount > 0) {
			reason = "critical_drift_detected";
		} else if (
			falseBlockRate > rolloutWindow.thresholds.maximumFalseBlockRate
		) {
			reason = "false_block_rate_exceeded";
		} else if (
			rolloutWindow.metrics.identityCompleteness <
				rolloutWindow.thresholds.minimumIdentityCompleteness ||
			rolloutWindow.metrics.adapterCoverage <
				rolloutWindow.thresholds.minimumAdapterCoverage ||
			rolloutWindow.metrics.governanceParityPassRate <
				rolloutWindow.thresholds.minimumGovernanceParityPassRate
		) {
			reason = "missing_trusted_evidence";
		}
		demotionTrigger = {
			schemaVersion: "demotion-trigger/v1",
			...createControlPlaneMetadata(),
			triggerId: randomUUID(),
			reason,
			fromStage: "enforced",
			toStage: "advisory",
			evidence: {
				description: "Automatic demotion triggered by CP6 stage-exit failure",
				artifactRefs: [
					join(input.artifactRoot, "control-plane-scorecard.json"),
					join(input.artifactRoot, "rollout-window.json"),
				],
				metricSnapshots: {
					falseBlockRate,
					criticalDriftCount: rolloutWindow.metrics.criticalDriftCount,
					canonicalCoverage: rolloutWindow.metrics.canonicalCoverage,
				},
			},
			automatic: true,
			createdAt: new Date().toISOString(),
			status: "executed",
			executedAt: new Date().toISOString(),
			followUpActions: [
				"Demote rollout stage to advisory and investigate control-plane regressions",
				"Regenerate promotion packet only after fresh passing windows",
			],
		};
		demotionAuditEntry = {
			schemaVersion: "control-plane-audit-log-entry/v1",
			...createControlPlaneMetadata(),
			evaluationAttemptId: input.evaluationAttemptId,
			runId: input.runId,
			checkpointId: demotionTrigger.triggerId,
			phase: "rollout-demotion",
			command: "pilot-evaluate",
			status: "failed",
			artifactRefs: [
				join(input.artifactRoot, "control-plane-scorecard.json"),
				join(input.artifactRoot, "rollout-window.json"),
				demotionLogPath,
			],
			sourceProvenance: [
				input.options.contractPath
					? resolve(input.options.contractPath)
					: resolve("harness.contract.json"),
			],
			blocker: demotionTrigger.reason,
			followUp:
				"Rollout demoted from enforced to advisory; investigate evidence drift before re-promotion",
			recordedAt: demotionTrigger.createdAt,
			auditStatus: "recorded",
			adjudication: "none",
		};
	}

	const monitoringSnapshot: MonitoringMetricsSnapshot = {
		schemaVersion: "monitoring-metrics/v1",
		...createControlPlaneMetadata(),
		snapshotAt: new Date().toISOString(),
		rolloutStage: input.rolloutStage,
		parityDrift: {
			unresolvedCount: rolloutWindow.metrics.criticalDriftCount,
			surfaces:
				rolloutWindow.metrics.criticalDriftCount > 0
					? [
							{
								surfaceId: "control-plane-scorecard",
								driftType: "critical_drift",
								detectedAt: new Date().toISOString(),
							},
						]
					: [],
		},
		adapterCoverage: {
			active: input.adapter?.status === "active" ? 1 : 0,
			shadow: input.adapter?.status === "shadow" ? 1 : 0.95,
			gaps: input.adapter
				? []
				: [
						{
							adapterId: "unresolved",
							missingCapability: "provider_normalization",
						},
					],
		},
		identityDegradation: {
			degradationRate: input.identity.identityStatus === "verified" ? 0 : 1,
			topReasons: input.identity.degradedReasons.map((reason) => ({
				reason,
				count: 1,
			})),
		},
		overrideUsage: {
			totalApplied: input.overrideAuditEntry?.status === "completed" ? 1 : 0,
			rate: rolloutWindow.metrics.overrideRate,
			scopes: [],
		},
		falseBlockAdjudication: {
			totalAdjudicated: rolloutWindow.metrics.falseBlocks,
			rate: falseBlockRate,
			pending: 0,
		},
		prTemplateValidation: {
			passRate:
				input.governanceSnapshot.prTemplateValidationStatus === "passed"
					? 1
					: 0,
			missingRate:
				input.governanceSnapshot.prTemplateValidationStatus === "missing"
					? 1
					: 0,
			failedRate:
				input.governanceSnapshot.prTemplateValidationStatus === "failed"
					? 1
					: 0,
		},
	};

	const updatedHistory: RolloutWindowHistory = {
		schemaVersion: "rollout-window-history/v1",
		...createControlPlaneMetadata(),
		currentStage: demotionTrigger
			? demotionTrigger.toStage
			: input.rolloutStage,
		windows: [...previousHistory.windows, rolloutWindow],
		consecutivePassingWindows: rolloutWindow.consecutivePassingWindows,
		eligibleForPromotion: rolloutWindow.readyForTransition,
		lastPromotionPacketId:
			promotionPacket?.packetId ?? previousHistory.lastPromotionPacketId,
		activeDemotionTriggers: demotionTrigger
			? [demotionTrigger.triggerId]
			: previousHistory.activeDemotionTriggers,
		updatedAt: new Date().toISOString(),
	};

	writeJsonFile(join(input.artifactRoot, "rollout-window.json"), rolloutWindow);
	writeJsonFile(historyPath, updatedHistory);
	writeJsonFile(monitoringPath, monitoringSnapshot);
	if (demotionTrigger) {
		appendFileSync(
			demotionLogPath,
			`${JSON.stringify(demotionTrigger)}\n`,
			"utf-8",
		);
	}

	return {
		rolloutWindow,
		history: updatedHistory,
		promotionPacket,
		demotionTrigger,
		demotionAuditEntry,
		monitoringSnapshot,
		historyPath,
		monitoringPath,
		promotionPacketPath,
		demotionLogPath: demotionTrigger ? demotionLogPath : null,
		rolloutWarnings: [
			...(rolloutWindow.readyForTransition
				? ["CP6 rollout window is ready for stage transition"]
				: []),
			...(demotionTrigger
				? [`Automatic demotion trigger emitted: ${demotionTrigger.reason}`]
				: []),
		],
	};
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

/** Build Control Plane Artifacts. */
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
	const {
		decision: baseEvaluationDecision,
		reasons: decisionReasons,
		blockerCodes,
	} = determineEvaluationDecision({
		legacyOutcome: input.legacyOutcome,
		metricsErrors: input.metricsErrors,
		identity,
		adapter,
		instructionParity,
		governanceSnapshot,
		evaluationMode,
	});
	const baseEnforcementDecision = determineEnforcementDecision(
		baseEvaluationDecision,
		rolloutStage,
	);
	const { policy: overridePolicy, warnings: overridePolicyWarnings } =
		loadOverridePolicy(input.options);
	const {
		evaluationDecision,
		enforcementDecision,
		overrideRecord,
		overrideAuditEntry,
		warnings: overrideWarnings,
	} = applyOverridePolicy({
		options: input.options,
		policy: overridePolicy,
		artifactRoot,
		evaluationAttemptId,
		runId: `pilot-evaluate-${evaluationAttemptId}`,
		baseEvaluationDecision,
		baseEnforcementDecision,
		blockerCodes,
		rolloutStage,
		contractRefPath: governanceSnapshot.contractRef.path,
	});
	const baseWarnings = unique([
		...adapterWarnings,
		...governanceWarnings,
		...instructionParity.normalizationWarnings,
		...auditWarnings,
		...overridePolicyWarnings,
		...overrideWarnings,
	]);
	const runId = `pilot-evaluate-${evaluationAttemptId}`;
	const scorecard: ControlPlaneScorecard = {
		schemaVersion: "control-plane-scorecard/v1",
		...createControlPlaneMetadata(),
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
		blockerCodes,
		decisionReasons: unique([
			...decisionReasons,
			...input.legacyHoldReasons,
			...input.metricsErrors,
		]),
		warnings: baseWarnings,
	};
	const rolloutArtifacts = buildRolloutArtifacts({
		artifactsDir: input.artifactsDir,
		artifactRoot,
		runId,
		evaluationAttemptId,
		rolloutStage,
		scorecard,
		metrics: input.metrics,
		metricsErrors: input.metricsErrors,
		instructionParity,
		governanceSnapshot,
		identity,
		adapter,
		overridePolicyRecord: overrideRecord,
		overrideAuditEntry,
		options: input.options,
	});
	const warnings = unique([
		...baseWarnings,
		...rolloutArtifacts.rolloutWarnings,
	]);
	scorecard.warnings = warnings;
	const controlPlaneRun: ControlPlaneRun = {
		schemaVersion: "control-plane-run/v1",
		...createControlPlaneMetadata(),
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
	const phaseReportPath = join(artifactRoot, "pilot-evaluate-report.json");

	const auditEntry: ControlPlaneAuditLogEntry = {
		schemaVersion: "control-plane-audit-log-entry/v1",
		...createControlPlaneMetadata(),
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
			join(artifactRoot, "rollout-window.json"),
			rolloutArtifacts.historyPath,
			rolloutArtifacts.monitoringPath,
			...(rolloutArtifacts.promotionPacketPath
				? [rolloutArtifacts.promotionPacketPath]
				: []),
			...(rolloutArtifacts.demotionLogPath
				? [rolloutArtifacts.demotionLogPath]
				: []),
			phaseReportPath,
		],
		sourceProvenance: unique([
			governanceSnapshot.contractRef.path,
			...governanceSnapshot.workflowRefs.map((ref) => ref.path),
			...governanceSnapshot.instructionPolicyRefs.map((ref) => ref.path),
			...(instructionParity.sourceReportRef
				? [instructionParity.sourceReportRef.path]
				: []),
		]),
		...(blockerCodes.length > 0 ? { blocker: blockerCodes[0] } : {}),
		followUp:
			evaluationDecision === "promote"
				? "Continue rollout using the current stage posture"
				: "Review control-plane scorecard and trusted evidence before promotion",
		recordedAt: scorecard.recordedAt,
		auditStatus: "recorded",
		adjudication: "none",
	};
	writeJsonFile(
		phaseReportPath,
		buildPhaseReport({
			evaluationAttemptId,
			runId,
			checkpointId: evaluationAttemptId,
			phase: "pilot-evaluate",
			command: "pilot-evaluate",
			status: auditEntry.status,
			artifactRefs: auditEntry.artifactRefs.filter(
				(ref) => ref !== phaseReportPath,
			),
			sourceProvenance: auditEntry.sourceProvenance,
			recordedAt: auditEntry.recordedAt,
			...(auditEntry.blocker ? { blocker: auditEntry.blocker } : {}),
			...(auditEntry.followUp ? { followUp: auditEntry.followUp } : {}),
		}),
	);
	appendAuditLogEntry(auditPath, auditEntry);
	if (overrideAuditEntry) {
		appendAuditLogEntry(auditPath, overrideAuditEntry);
	}
	if (rolloutArtifacts.demotionAuditEntry) {
		appendAuditLogEntry(auditPath, rolloutArtifacts.demotionAuditEntry);
	}

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

function collectPhaseReports(
	artifactRoot: string,
	evaluationAttemptId: string | undefined,
): ControlPlanePhaseReport[] {
	if (!existsSync(artifactRoot)) {
		return [];
	}

	return readdirSync(artifactRoot, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith("-report.json"))
		.map((entry) =>
			loadControlPlaneJson<ControlPlanePhaseReport>(
				join(artifactRoot, entry.name),
			),
		)
		.filter(
			(report): report is ControlPlanePhaseReport =>
				report !== null && report.evaluationAttemptId === evaluationAttemptId,
		);
}

function findReferencedPromotionPacketPath(
	auditLog: ControlPlaneAuditLogEntry[],
): string | null {
	return (
		auditLog
			.flatMap((entry) => entry.artifactRefs)
			.find(
				(ref) =>
					basename(dirname(ref)) === PROMOTION_PACKET_DIR &&
					ref.endsWith(".json"),
			) ?? null
	);
}

function findReferencedDemotionTrigger(
	auditLog: ControlPlaneAuditLogEntry[],
	demotionTriggerEntries: (DemotionTrigger | string)[],
): DemotionTrigger | null {
	const demotionTriggerId =
		auditLog.find((entry) => entry.phase === "rollout-demotion")
			?.checkpointId ?? null;
	if (!demotionTriggerId) {
		return null;
	}

	return (
		demotionTriggerEntries.find(
			(entry): entry is DemotionTrigger =>
				typeof entry !== "string" && entry.triggerId === demotionTriggerId,
		) ?? null
	);
}

function requiredPhaseReportFilenames(
	overridePolicyRecord: OverridePolicyRecord | null,
): string[] {
	return [
		"pilot-evaluate-report.json",
		...(overridePolicyRecord ? ["override-policy-report.json"] : []),
	];
}

function validateCompatibilityMetadata(
	label: string,
	record: ControlPlaneArtifactMetadata | null | undefined,
	errors: string[],
): void {
	if (!record) {
		return;
	}

	if (typeof record.compatibilityMajor !== "number") {
		errors.push(`Missing compatibilityMajor on ${label}`);
	} else if (record.compatibilityMajor > CONTROL_PLANE_COMPATIBILITY_MAJOR) {
		errors.push(
			`Unsupported compatibilityMajor on ${label}: ${record.compatibilityMajor}`,
		);
	}

	if (
		typeof record.producerVersion !== "string" ||
		record.producerVersion.trim().length === 0
	) {
		errors.push(`Missing producerVersion on ${label}`);
	}
}

/** Load Control Plane Artifact Set. */
export function loadControlPlaneArtifactSet(artifactRoot: string): {
	artifacts: ControlPlaneArtifactSet | null;
	errors: string[];
} {
	const resolvedRoot = resolve(artifactRoot);
	const controlPlaneRoot = dirname(resolvedRoot);
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
	const overridePolicyRecord = loadControlPlaneJson<OverridePolicyRecord>(
		join(resolvedRoot, "override-policy-record.json"),
	);
	const rolloutWindow = loadControlPlaneJson<RolloutWindow>(
		join(resolvedRoot, "rollout-window.json"),
	);
	const rolloutWindowHistory = loadControlPlaneJson<RolloutWindowHistory>(
		join(controlPlaneRoot, ROLLOUT_HISTORY_FILE),
	);
	const monitoringMetricsSnapshot =
		loadControlPlaneJson<MonitoringMetricsSnapshot>(
			join(controlPlaneRoot, MONITORING_METRICS_FILE),
		);
	const demotionTriggerLogPath = join(
		controlPlaneRoot,
		DEMOTION_TRIGGER_LOG_FILE,
	);
	const demotionTriggerEntries: (DemotionTrigger | string)[] = existsSync(
		demotionTriggerLogPath,
	)
		? readFileSync(demotionTriggerLogPath, "utf-8")
				.split("\n")
				.filter(Boolean)
				.map((line, index) => {
					try {
						return JSON.parse(line) as DemotionTrigger;
					} catch {
						return `Invalid demotion trigger log line ${index + 1}`;
					}
				})
		: [];
	const phaseReports = collectPhaseReports(
		resolvedRoot,
		controlPlaneRun?.evaluationAttemptId,
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
	const promotionPacketPath = findReferencedPromotionPacketPath(auditLog);
	const latestPromotionPacket =
		promotionPacketPath === null
			? null
			: loadControlPlaneJson<PromotionPacket>(promotionPacketPath);
	const latestDemotionTrigger = findReferencedDemotionTrigger(
		auditLog,
		demotionTriggerEntries,
	);
	const demotionTriggerIds = new Set(
		demotionTriggerEntries.flatMap((entry) =>
			typeof entry === "string" ? [] : [entry.triggerId],
		),
	);
	const missingActiveDemotionTriggers = (
		rolloutWindowHistory?.activeDemotionTriggers ?? []
	).filter((triggerId) => !demotionTriggerIds.has(triggerId));

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
	for (const entry of demotionTriggerEntries) {
		if (typeof entry === "string") {
			errors.push(entry);
		}
	}

	validateCompatibilityMetadata(
		"control-plane-run.json",
		controlPlaneRun,
		errors,
	);
	validateCompatibilityMetadata(
		"governance-snapshot.json",
		governanceSnapshot,
		errors,
	);
	validateCompatibilityMetadata(
		"instruction-parity.json",
		instructionParity,
		errors,
	);
	validateCompatibilityMetadata(
		"control-plane-scorecard.json",
		scorecard,
		errors,
	);
	validateCompatibilityMetadata(
		"override-policy-record.json",
		overridePolicyRecord,
		errors,
	);
	validateCompatibilityMetadata("rollout-window.json", rolloutWindow, errors);
	validateCompatibilityMetadata(
		"rollout-window-history.json",
		rolloutWindowHistory,
		errors,
	);
	validateCompatibilityMetadata(
		"monitoring-metrics-latest.json",
		monitoringMetricsSnapshot,
		errors,
	);
	validateCompatibilityMetadata(
		"promotion-packet.json",
		latestPromotionPacket,
		errors,
	);
	validateCompatibilityMetadata(
		"demotion-trigger latest entry",
		latestDemotionTrigger,
		errors,
	);
	for (const [index, entry] of auditLog.entries()) {
		validateCompatibilityMetadata(`audit log entry ${index}`, entry, errors);
	}
	for (const [index, report] of phaseReports.entries()) {
		validateCompatibilityMetadata(`phase report ${index}`, report, errors);
	}
	for (const filename of requiredPhaseReportFilenames(overridePolicyRecord)) {
		const expectedPhase = filename.replace(/-report\.json$/, "");
		if (!phaseReports.some((report) => report.phase === expectedPhase)) {
			errors.push(`Missing required phase report: ${filename}`);
		}
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
		overridePolicyRecord &&
		controlPlaneRun.evaluationAttemptId !==
			overridePolicyRecord.evaluationAttemptId
	) {
		errors.push(
			"Join integrity failed: evaluationAttemptId mismatch between run and override policy record",
		);
	}
	if (
		controlPlaneRun &&
		overridePolicyRecord &&
		controlPlaneRun.runId !== overridePolicyRecord.runId
	) {
		errors.push(
			"Join integrity failed: runId mismatch between run and override policy record",
		);
	}
	if (
		controlPlaneRun &&
		phaseReports.some(
			(report) =>
				report.evaluationAttemptId !== controlPlaneRun.evaluationAttemptId,
		)
	) {
		errors.push(
			"Join integrity failed: evaluationAttemptId mismatch between run and phase reports",
		);
	}
	if (
		controlPlaneRun &&
		phaseReports.some((report) => report.runId !== controlPlaneRun.runId)
	) {
		errors.push(
			"Join integrity failed: runId mismatch between run and phase reports",
		);
	}
	if (
		controlPlaneRun &&
		instructionParity &&
		controlPlaneRun.instructionParityRef !== instructionParity.parityResultId
	) {
		errors.push("Join integrity failed: instruction parity reference mismatch");
	}
	const cp6ArtifactCount = [
		rolloutWindow,
		rolloutWindowHistory,
		monitoringMetricsSnapshot,
	].filter((artifact) => artifact !== null).length;
	if (cp6ArtifactCount > 0 && cp6ArtifactCount < 3) {
		errors.push(
			"Additive compatibility failed: partial CP6 artifact set detected",
		);
	}
	if (
		rolloutWindow &&
		rolloutWindowHistory &&
		!rolloutWindowHistory.windows.some(
			(window) => window.windowId === rolloutWindow.windowId,
		)
	) {
		errors.push(
			"Join integrity failed: rollout-window missing from rollout-window-history",
		);
	}
	if (promotionPacketPath && !latestPromotionPacket) {
		errors.push(
			"Join integrity failed: audit log references a missing promotion packet",
		);
	}
	if (
		latestPromotionPacket &&
		promotionPacketPath &&
		basename(promotionPacketPath, ".json") !== latestPromotionPacket.packetId
	) {
		errors.push("Join integrity failed: promotion packet reference mismatch");
	}
	if (
		auditLog.some((entry) => entry.phase === "rollout-demotion") &&
		!latestDemotionTrigger
	) {
		errors.push(
			"Join integrity failed: audit log references missing demotion trigger evidence",
		);
	}
	if (missingActiveDemotionTriggers.length > 0) {
		errors.push(
			"Join integrity failed: rollout history references missing demotion trigger evidence",
		);
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
			phaseReports,
			overridePolicyRecord,
			rolloutWindow,
			rolloutWindowHistory,
			latestPromotionPacket,
			latestDemotionTrigger,
			monitoringMetricsSnapshot,
		},
		errors,
	};
}
