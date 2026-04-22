import { createHash } from "node:crypto";

// CircleCI-based required checks.
// Replaces the former GitHub Actions-specific checks:
//   - "dependency-review" → "dependency-scan"  (Trivy SCA in CircleCI)
//   - "actions-pinning"   → "orb-pinning"      (CircleCI orb version enforcement)

export const REVIEW_POLICY_REQUIRED_CHECKS = [
	"security-scan",
	"dependency-scan",
	"orb-pinning",
] as const;

/**
 * Required checks enforced by branch protection that are not expected to appear
 * as merge-authoritative workflow job names.
 */
export const NON_WORKFLOW_REQUIRED_CHECKS = ["CodeRabbit"] as const;

const NON_WORKFLOW_REQUIRED_CHECK_SET = new Set<string>(
	NON_WORKFLOW_REQUIRED_CHECKS,
);

const CIRCLECI_JOB_NAMES = new Set<string>([
	"lint",
	"typecheck",
	"test",
	"audit",
	"check",
	"build",
	"memory",
	"security-scan",
	"dependency-scan",
	"orb-pinning",
	"docs-gate",
	"linear-gate",
	"risk-policy-gate",
	"consistency-drift-health",
	"pr-template",
]);

const GOVERNANCE_GATE_IDS = new Set<string>([
	"pr-template",
	"linear-gate",
	"risk-policy-gate",
	"docs-gate",
	"consistency-drift-health",
]);

export function isNonWorkflowRequiredCheck(check: string): boolean {
	return NON_WORKFLOW_REQUIRED_CHECK_SET.has(check);
}

export type GateExecutionClass = "read_only_parallel" | "serial_guarded";
export type GateFailureClass =
	| "transient_infra"
	| "contract_policy"
	| "internal_unknown";

interface RequiredChecksManifestEntry {
	policyId?: unknown;
	gateId?: unknown;
	displayName?: unknown;
	sourceAppSlug?: unknown;
	sourceAppId?: unknown;
	externalIdPattern?: unknown;
	requiredOnEvents?: unknown;
	freshnessWindowDays?: unknown;
	class?: unknown;
	githubCheckName?: unknown;
	executionClass?: unknown;
	failureClassDefault?: unknown;
	order?: unknown;
	enabled?: unknown;
}

interface RequiredChecksManifestLike {
	version?: unknown;
	activeProvider?: unknown;
	contractVersion?: unknown;
	requiredChecks?: unknown;
}

export interface GateContractIdentity {
	gateId: string;
	provider: string;
	externalIdPattern: string;
	githubCheckName: string | null;
}

export interface NormalizedGateDefinition extends GateContractIdentity {
	policyId: string;
	displayName: string;
	sourceAppId: string;
	requiredOnEvents: Array<"pull_request" | "merge_group">;
	freshnessWindowDays: number;
	class: "required" | "informational" | "shadow";
	executionClass: GateExecutionClass;
	failureClassDefault: GateFailureClass;
	order: number;
	enabled: boolean;
}

export interface NormalizedRequiredChecksManifest {
	schemaVersion: number;
	contractVersion: string;
	activeProvider: string;
	gates: NormalizedGateDefinition[];
}

export type RequiredChecksParseResult =
	| { ok: true; value: NormalizedRequiredChecksManifest }
	| { ok: false; error: string };

function asNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function asPositiveInteger(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) && value > 0
		? value
		: null;
}

function asEventArray(
	value: unknown,
): Array<"pull_request" | "merge_group"> | null {
	if (!Array.isArray(value)) {
		return null;
	}
	const events = value.filter(
		(item): item is "pull_request" | "merge_group" =>
			item === "pull_request" || item === "merge_group",
	);
	return events.length > 0 ? events : null;
}

function asExecutionClass(value: unknown): GateExecutionClass | null {
	return value === "read_only_parallel" || value === "serial_guarded"
		? value
		: null;
}

function asFailureClass(value: unknown): GateFailureClass | null {
	return value === "transient_infra" ||
		value === "contract_policy" ||
		value === "internal_unknown"
		? value
		: null;
}

function normalizeGate(
	entry: RequiredChecksManifestEntry,
	index: number,
): NormalizedGateDefinition | null {
	const displayName = asNonEmptyString(entry.displayName);
	const sourceAppSlug = asNonEmptyString(entry.sourceAppSlug);
	const sourceAppId = asNonEmptyString(entry.sourceAppId);
	const externalIdPattern = asNonEmptyString(entry.externalIdPattern);
	const policyId =
		asNonEmptyString(entry.policyId) ?? `required-check-${index + 1}`;

	if (!displayName || !sourceAppSlug || !sourceAppId || !externalIdPattern) {
		return null;
	}

	const gateId = asNonEmptyString(entry.gateId) ?? displayName;
	const githubCheckName = asNonEmptyString(entry.githubCheckName);
	const classValue =
		entry.class === "required" ||
		entry.class === "informational" ||
		entry.class === "shadow"
			? entry.class
			: "required";
	const requiredOnEvents = asEventArray(entry.requiredOnEvents) ?? [
		"pull_request",
		"merge_group",
	];
	const freshnessWindowDays = asPositiveInteger(entry.freshnessWindowDays) ?? 7;
	const executionClass =
		asExecutionClass(entry.executionClass) ?? "serial_guarded";
	const failureClassDefault =
		asFailureClass(entry.failureClassDefault) ??
		(GOVERNANCE_GATE_IDS.has(gateId) ? "contract_policy" : "transient_infra");
	const order = asPositiveInteger(entry.order) ?? index + 1;
	const enabled =
		typeof entry.enabled === "boolean"
			? entry.enabled
			: classValue === "required";

	return {
		policyId,
		gateId,
		displayName,
		provider: sourceAppSlug,
		sourceAppId,
		externalIdPattern,
		githubCheckName,
		requiredOnEvents,
		freshnessWindowDays,
		class: classValue,
		executionClass,
		failureClassDefault,
		order,
		enabled,
	};
}

function sortNormalizedGates(
	gates: NormalizedGateDefinition[],
): NormalizedGateDefinition[] {
	return [...gates].sort((left, right) => {
		if (left.order !== right.order) {
			return left.order - right.order;
		}
		return left.gateId.localeCompare(right.gateId);
	});
}

function identityPayload(gates: NormalizedGateDefinition[]): string {
	const tuples = gates.map((gate) => ({
		gateId: gate.gateId,
		provider: gate.provider,
		externalIdPattern: gate.externalIdPattern,
		githubCheckName: gate.githubCheckName ?? "",
	}));
	tuples.sort((a, b) => {
		const ak = `${a.gateId}::${a.provider}::${a.externalIdPattern}::${a.githubCheckName}`;
		const bk = `${b.gateId}::${b.provider}::${b.externalIdPattern}::${b.githubCheckName}`;
		return ak.localeCompare(bk);
	});
	return JSON.stringify(tuples);
}

export function deriveContractVersionFromGates(
	gates: NormalizedGateDefinition[],
): string {
	if (gates.length === 0) {
		return "1";
	}
	const digest = createHash("sha256")
		.update(identityPayload(gates))
		.digest("hex");
	return digest.slice(0, 16);
}

export function normalizeRequiredChecksManifest(
	manifest: unknown,
): RequiredChecksParseResult {
	if (!manifest || typeof manifest !== "object") {
		return { ok: false, error: "required checks manifest must be an object" };
	}

	const typed = manifest as RequiredChecksManifestLike;
	const activeProvider = asNonEmptyString(typed.activeProvider);
	if (!activeProvider) {
		return { ok: false, error: "activeProvider must be a non-empty string" };
	}

	if (!Array.isArray(typed.requiredChecks)) {
		return { ok: false, error: "requiredChecks must be an array" };
	}

	const gates: NormalizedGateDefinition[] = [];
	for (const [index, rawEntry] of typed.requiredChecks.entries()) {
		if (!rawEntry || typeof rawEntry !== "object") {
			return {
				ok: false,
				error: `requiredChecks[${index}] must be an object`,
			};
		}
		const normalized = normalizeGate(
			rawEntry as RequiredChecksManifestEntry,
			index,
		);
		if (!normalized) {
			return {
				ok: false,
				error: `requiredChecks[${index}] is missing required fields (displayName/sourceAppSlug/sourceAppId/externalIdPattern)`,
			};
		}
		gates.push(normalized);
	}

	const explicitContractVersion = asNonEmptyString(typed.contractVersion);
	const sortedGates = sortNormalizedGates(gates);
	const contractVersion =
		explicitContractVersion ?? deriveContractVersionFromGates(sortedGates);
	const schemaVersion = asPositiveInteger(typed.version) ?? 1;

	return {
		ok: true,
		value: {
			schemaVersion,
			contractVersion,
			activeProvider,
			gates: sortedGates,
		},
	};
}

export function findCircleCIJobNamedCheckBindings(
	gates: NormalizedGateDefinition[],
): string[] {
	const checkNames: string[] = [];
	for (const gate of gates) {
		if (gate.provider === "circleci" && gate.githubCheckName) {
			checkNames.push(gate.githubCheckName);
		}
	}
	return findCircleCIJobNamedCheckNames(checkNames);
}

export function findCircleCIJobNamedCheckNames(
	githubCheckNames: string[],
): string[] {
	const suspicious = new Set<string>();
	for (const checkName of githubCheckNames) {
		if (CIRCLECI_JOB_NAMES.has(checkName)) {
			suspicious.add(checkName);
		}
	}
	return [...suspicious].sort();
}

/**
 * Ecosystem profiles for branch protection required checks.
 *
 * These profiles provide sensible defaults for different technology stacks.
 * Use --ecosystem flag with harness branch-protect to select a profile.
 */
export type EcosystemProfile = keyof typeof ECOSYSTEM_PROFILES;

export const ECOSYSTEM_PROFILES = {
	/**
	 * coding-harness itself - full governance suite with all checks.
	 */
	harness: [
		"pr-template",
		"linear-gate",
		"risk-policy-gate",
		"dependency-scan",
		"orb-pinning",
		"consistency-drift-health",
		"docs-gate",
		"lint",
		"typecheck",
		"test",
		"audit",
		"check",
		"memory",
		"security-scan",
		"CodeRabbit",
	] as const,

	/**
	 * TypeScript/Node.js projects using pnpm.
	 */
	typescript: [
		"lint",
		"typecheck",
		"test",
		"audit",
		"dependency-scan",
	] as const,

	/**
	 * Python projects using uv/pytest.
	 */
	python: ["lint", "test", "dependency-scan"] as const,

	/**
	 * Rust projects using cargo.
	 */
	rust: ["lint", "test"] as const,

	/**
	 * Swift/iOS/macOS projects.
	 */
	swift: ["lint", "test"] as const,

	/**
	 * Go projects.
	 */
	go: ["lint", "test"] as const,

	/**
	 * Minimal profile - just security and basic checks.
	 * Use for experiments, docs, or custom setups.
	 */
	minimal: ["lint"] as const,
} as const;

/**
 * Default required checks for backwards compatibility.
 * Maps to the "harness" profile.
 */
export const BRANCH_PROTECTION_REQUIRED_CHECKS = ECOSYSTEM_PROFILES.harness;

export function formatRequiredChecksInline(
	checks: readonly string[] = BRANCH_PROTECTION_REQUIRED_CHECKS,
): string {
	return checks.map((check) => `\`${check}\``).join(", ");
}

export function formatRequiredChecksBulleted(
	checks: readonly string[] = BRANCH_PROTECTION_REQUIRED_CHECKS,
	indent = "  - ",
): string {
	return checks.map((check) => `${indent}\`${check}\``).join("\n");
}

/**
 * Get required checks for an ecosystem profile.
 * Returns undefined if the profile doesn't exist.
 */
export function getEcosystemChecks(
	ecosystem: string,
): readonly string[] | undefined {
	return ECOSYSTEM_PROFILES[ecosystem as EcosystemProfile];
}

/**
 * List available ecosystem profiles.
 */
export function listEcosystemProfiles(): string[] {
	return Object.keys(ECOSYSTEM_PROFILES);
}
