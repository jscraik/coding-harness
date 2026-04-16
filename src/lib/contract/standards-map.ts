/**
 * Standards Control Map for Workflow-Contract Subsystem (JSC-108)
 *
 * Maps workflow-contract constructs to NIST security and AI-risk frameworks.
 * This is a machine-readable control map, not a compliance claim.
 *
 * Referenced standards:
 * - NIST SP 800-218A (Secure Software Development Framework)
 * - NIST AI RMF 1.0 (AI Risk Management Framework)
 * - NIST AI 600-1 (Generative AI Profile)
 *
 * @module lib/contract/standards-map
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type StandardsFramework =
	| "NIST_SP_800_218A"
	| "NIST_AI_RMF_1_0"
	| "NIST_AI_600_1";

export type ControlDomain =
	| "source_integrity"
	| "build_integrity"
	| "policy_enforcement"
	| "trust_boundary"
	| "ai_governance"
	| "evidence_management"
	| "remediation_safety"
	| "access_control";

export interface StandardsControl {
	/** Unique control ID within this map */
	id: string;
	/** Human-readable control name */
	name: string;
	/** Domain this control belongs to */
	domain: ControlDomain;
	/** Description of what this control enforces */
	description: string;
	/** Workflow-contract construct(s) that implement this control */
	contractConstructs: string[];
	/** Standards references */
	references: StandardsReference[];
	/** Whether this control is non-overridable */
	nonOverridable: boolean;
}

export interface StandardsReference {
	/** Standards framework */
	framework: StandardsFramework;
	/** Control or practice identifier within the framework */
	controlId: string;
	/** Human-readable name of the referenced control */
	controlName: string;
}

export interface ControlMapReport {
	/** Total controls mapped */
	totalControls: number;
	/** Controls by domain */
	byDomain: Partial<Record<ControlDomain, number>>;
	/** Controls by framework */
	byFramework: Partial<Record<StandardsFramework, number>>;
	/** Non-overridable controls */
	nonOverridableCount: number;
	/** All controls */
	controls: StandardsControl[];
}

// ─── Control Definitions ─────────────────────────────────────────────────────

const CONTROLS: StandardsControl[] = [
	{
		id: "WC-001",
		name: "Contract integrity verification",
		domain: "source_integrity",
		description:
			"All contract files undergo schema validation, depth limiting, and path-traversal protection before use.",
		contractConstructs: [
			"loadContract()",
			"validateContract()",
			"safeParseJson()",
			"validatePath()",
		],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PO.1",
				controlName: "Define security requirements for software development",
			},
			{
				framework: "NIST_SP_800_218A",
				controlId: "PS.1",
				controlName: "Protect all forms of code from unauthorized access",
			},
		],
		nonOverridable: true,
	},
	{
		id: "WC-002",
		name: "Preset integrity (SRI) verification",
		domain: "source_integrity",
		description:
			"Remote presets require SRI integrity hashes. Integrity mismatches are treated as potential supply-chain attacks.",
		contractConstructs: ["PresetReference.integrity", "IntegrityError"],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PS.2",
				controlName: "Verify third-party component provenance and integrity",
			},
			{
				framework: "NIST_SP_800_218A",
				controlId: "PW.4",
				controlName: "Verify third-party components using automated tools",
			},
		],
		nonOverridable: true,
	},
	{
		id: "WC-003",
		name: "Circular inheritance detection",
		domain: "build_integrity",
		description:
			"Preset inheritance chains are depth-limited and cycle-detected to prevent resource exhaustion and unexpected policy injection.",
		contractConstructs: [
			"MAX_INHERITANCE_DEPTH",
			"CircularInheritanceError",
			"MaxDepthExceededError",
		],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PW.7",
				controlName: "Verify code is not vulnerable before release",
			},
		],
		nonOverridable: true,
	},
	{
		id: "WC-004",
		name: "SSRF protection for remote presets",
		domain: "trust_boundary",
		description:
			"Remote preset URLs are validated against allowlists and private IP ranges to prevent SSRF attacks.",
		contractConstructs: [
			"UrlValidationError",
			"ALLOWED_OLLAMA_HOSTS",
			"validateOllamaUrl()",
		],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PW.5",
				controlName: "Follow secure coding practices",
			},
		],
		nonOverridable: true,
	},
	{
		id: "WC-005",
		name: "Policy chain risk-tier enforcement",
		domain: "policy_enforcement",
		description:
			"Risk tiers (high/medium/low) map to explicit actions (block/warn/allow) and verdicts (pass/fail) through a configurable policy chain.",
		contractConstructs: [
			"PolicyChainPolicy",
			"RiskTier",
			"PolicyAction",
			"GateVerdict",
		],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PO.2",
				controlName: "Implement roles and responsibilities",
			},
			{
				framework: "NIST_AI_RMF_1_0",
				controlId: "GOVERN 1.2",
				controlName:
					"Characteristics of trustworthy AI are integrated into organizational policies",
			},
		],
		nonOverridable: false,
	},
	{
		id: "WC-006",
		name: "Branch protection enforcement",
		domain: "policy_enforcement",
		description:
			"Required checks, linear history, force-push blocks, and conversation resolution are enforced at the branch level via the contract.",
		contractConstructs: [
			"BranchProtectionPolicy",
			"DEFAULT_BRANCH_PROTECTION_POLICY",
		],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PO.2",
				controlName: "Implement roles and responsibilities",
			},
			{
				framework: "NIST_SP_800_218A",
				controlId: "PS.3",
				controlName: "Protect code from tampering",
			},
		],
		nonOverridable: false,
	},
	{
		id: "WC-007",
		name: "Review gate with timeout enforcement",
		domain: "policy_enforcement",
		description:
			"Review policies enforce timeout, required checks, and reviewer independence through the contract.",
		contractConstructs: ["ReviewPolicy", "DEFAULT_REVIEW_POLICY"],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PO.2",
				controlName: "Implement roles and responsibilities",
			},
			{
				framework: "NIST_SP_800_218A",
				controlId: "PW.7",
				controlName: "Verify code is not vulnerable before release",
			},
		],
		nonOverridable: false,
	},
	{
		id: "WC-008",
		name: "AI pilot authorization least-privilege",
		domain: "ai_governance",
		description:
			"Pilot authorization policy enforces GitHub scope allowlists, repo patterns, branch patterns, and a protected-branch denylist.",
		contractConstructs: ["PilotAuthzPolicy", "DEFAULT_PILOT_AUTHZ_POLICY"],
		references: [
			{
				framework: "NIST_AI_RMF_1_0",
				controlId: "GOVERN 2.2",
				controlName: "Accountability structures are in place for AI systems",
			},
			{
				framework: "NIST_AI_600_1",
				controlId: "GOVERN 1.3",
				controlName:
					"Processes for AI system design, development, and deployment are transparent",
			},
		],
		nonOverridable: true,
	},
	{
		id: "WC-009",
		name: "Pilot rollback safety",
		domain: "ai_governance",
		description:
			"Rollback policy controls automatic rollback behavior on high-risk automation incidents, requiring manual release before resuming.",
		contractConstructs: [
			"PilotRollbackPolicy",
			"DEFAULT_PILOT_ROLLBACK_POLICY",
		],
		references: [
			{
				framework: "NIST_AI_RMF_1_0",
				controlId: "MEASURE 2.5",
				controlName:
					"System fallbacks and rollbacks are in place for AI system failures",
			},
			{
				framework: "NIST_AI_600_1",
				controlId: "MEASURE 2.5",
				controlName:
					"Procedures are in place for AI system failures and fallbacks",
			},
		],
		nonOverridable: false,
	},
	{
		id: "WC-010",
		name: "Control plane non-overridable controls",
		domain: "access_control",
		description:
			"Certain controls (runtime validation, governance trust, instruction surfaces, snapshot integrity) cannot be bypassed by any override.",
		contractConstructs: [
			"ControlPlaneOverridePolicy",
			"ControlPlaneNonOverridableControl",
		],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PO.3",
				controlName: "Define security requirements for software development",
			},
			{
				framework: "NIST_AI_RMF_1_0",
				controlId: "GOVERN 1.7",
				controlName:
					"Processes for AI system design include risk-based access controls",
			},
		],
		nonOverridable: true,
	},
	{
		id: "WC-011",
		name: "Evidence requirement enforcement",
		domain: "evidence_management",
		description:
			"Evidence policy requires verification artifacts for specified paths, with type and size constraints.",
		contractConstructs: ["EvidencePolicy", "DEFAULT_EVIDENCE_POLICY"],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PW.7",
				controlName: "Verify code is not vulnerable before release",
			},
			{
				framework: "NIST_AI_RMF_1_0",
				controlId: "MEASURE 2.6",
				controlName:
					"AI system evaluation and monitoring results are documented",
			},
		],
		nonOverridable: false,
	},
	{
		id: "WC-012",
		name: "Remediation safety controls",
		domain: "remediation_safety",
		description:
			"Remediation policy controls auto-apply tiers, dry-run defaults, retry limits, and evidence requirements for automated fixes.",
		contractConstructs: ["RemediationPolicy", "DEFAULT_REMEDIATION_POLICY"],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "RV.1",
				controlName: "Identify and confirm vulnerabilities",
			},
			{
				framework: "NIST_AI_600_1",
				controlId: "MEASURE 2.5",
				controlName:
					"Procedures are in place for AI system failures and fallbacks",
			},
		],
		nonOverridable: false,
	},
	{
		id: "WC-013",
		name: "Context integrity truth-source hierarchy",
		domain: "trust_boundary",
		description:
			"Context-integrity policy defines canonical and governed truth sources, contradiction catalog, and health sampling for retrieval quality.",
		contractConstructs: [
			"ContextIntegrityPolicy",
			"ContextIntegrityTruthSource",
			"ContextContradictionCatalogEntry",
		],
		references: [
			{
				framework: "NIST_AI_RMF_1_0",
				controlId: "MEASURE 2.3",
				controlName:
					"AI system performance is monitored for drift and degradation",
			},
			{
				framework: "NIST_AI_600_1",
				controlId: "MEASURE 2.9",
				controlName: "AI system content provenance is tracked and documented",
			},
		],
		nonOverridable: false,
	},
	{
		id: "WC-014",
		name: "Docs gate governance parity",
		domain: "policy_enforcement",
		description:
			"Docs-gate policy maps implementation changes to required documentation surfaces, ensuring governance documentation stays in sync.",
		contractConstructs: ["DocsGatePolicy", "DocsGateRule", "DocsSurface"],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PO.5",
				controlName:
					"Define and use criteria for security checks throughout the development lifecycle",
			},
			{
				framework: "NIST_AI_600_1",
				controlId: "GOVERN 1.3",
				controlName:
					"Processes for AI system design are transparent and documented",
			},
		],
		nonOverridable: false,
	},
	{
		id: "WC-015",
		name: "CI provider transition safety",
		domain: "build_integrity",
		description:
			"CI provider policy tracks migration stages with trusted policy refs and required-check manifests, preventing silent CI bypass.",
		contractConstructs: ["CIProviderPolicy", "DEFAULT_CI_PROVIDER_POLICY"],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PO.2",
				controlName: "Implement roles and responsibilities",
			},
			{
				framework: "NIST_SP_800_218A",
				controlId: "PW.6",
				controlName: "Build software using secure configurations and practices",
			},
		],
		nonOverridable: false,
	},
	{
		id: "WC-016",
		name: "Loop stage semantic contracts",
		domain: "build_integrity",
		description:
			"Loop stage contracts define inputs, outputs, schemas, fail policies, permissions, timeouts, and concurrency for each CI stage.",
		contractConstructs: ["LoopStageContract", "DEFAULT_LOOP_STAGE_CONTRACTS"],
		references: [
			{
				framework: "NIST_SP_800_218A",
				controlId: "PW.6",
				controlName: "Build software using secure configurations and practices",
			},
			{
				framework: "NIST_AI_RMF_1_0",
				controlId: "GOVERN 2.1",
				controlName:
					"Roles and responsibilities for AI systems are clearly defined",
			},
		],
		nonOverridable: false,
	},
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get all controls in the standards map.
 */
export function getAllControls(): StandardsControl[] {
	return [...CONTROLS];
}

/**
 * Get controls filtered by domain.
 */
export function getControlsByDomain(domain: ControlDomain): StandardsControl[] {
	return CONTROLS.filter((c) => c.domain === domain);
}

/**
 * Get controls filtered by framework.
 */
export function getControlsByFramework(
	framework: StandardsFramework,
): StandardsControl[] {
	return CONTROLS.filter((c) =>
		c.references.some((r) => r.framework === framework),
	);
}

/**
 * Get non-overridable controls.
 */
export function getNonOverridableControls(): StandardsControl[] {
	return CONTROLS.filter((c) => c.nonOverridable);
}

/**
 * Generate a summary report of the standards control map.
 */
export function generateControlMapReport(): ControlMapReport {
	const byDomain: Partial<Record<ControlDomain, number>> = {};
	const byFramework: Partial<Record<StandardsFramework, number>> = {};

	for (const control of CONTROLS) {
		byDomain[control.domain] = (byDomain[control.domain] ?? 0) + 1;
		for (const ref of control.references) {
			byFramework[ref.framework] = (byFramework[ref.framework] ?? 0) + 1;
		}
	}

	return {
		totalControls: CONTROLS.length,
		byDomain,
		byFramework,
		nonOverridableCount: CONTROLS.filter((c) => c.nonOverridable).length,
		controls: [...CONTROLS],
	};
}

/**
 * Look up a control by its ID.
 */
export function getControlById(id: string): StandardsControl | undefined {
	return CONTROLS.find((c) => c.id === id);
}
