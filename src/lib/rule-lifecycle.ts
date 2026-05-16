import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, normalize, relative, resolve } from "node:path";

export const DEFAULT_RULE_LIFECYCLE_MANIFEST =
	".harness/rule-lifecycle-manifest.json";

export const RULE_LIFECYCLE_MANIFEST_SCHEMA_VERSION =
	"rule-lifecycle-manifest/v1";

/** Lifecycle state for a durable governance rule. */
export type RuleLifecycleStatus = "active" | "deprecated" | "superseded";

/** Enforcement destination that keeps a rule from becoming passive prose. */
export type RuleLifecycleEnforcement =
	| "doc"
	| "lint"
	| "test"
	| "ci"
	| "reviewer"
	| "human-escalation";

/** Rule metadata required before guidance can become durable governance. */
export interface RuleLifecycleEntry {
	id: string;
	title: string;
	status: RuleLifecycleStatus;
	owner: string;
	scope: string[];
	evidence: string[];
	enforcement: RuleLifecycleEnforcement[];
	enforcementRefs: string[];
	lastReviewedAt: string;
	reviewCadenceDays: number;
	removalCondition: string;
	supersededBy?: string | undefined;
	notes?: string | undefined;
}

/** Registry of durable governance rules and their lifecycle metadata. */
export interface RuleLifecycleManifest {
	schemaVersion: typeof RULE_LIFECYCLE_MANIFEST_SCHEMA_VERSION;
	rules: RuleLifecycleEntry[];
}

/** Severity for a rule lifecycle gate finding. */
export type RuleLifecycleSeverity = "error" | "warning";

/** Aggregate status for the rule lifecycle gate. */
export type RuleLifecycleStatusResult = "pass" | "warn" | "fail";

/** Machine-readable problem found while validating rule lifecycle metadata. */
export interface RuleLifecycleFinding {
	id: string;
	severity: RuleLifecycleSeverity;
	message: string;
	ruleId?: string | undefined;
	fix?: string | undefined;
}

/** Result envelope emitted by the rule lifecycle gate. */
export interface RuleLifecycleGateResult {
	schemaVersion: "rule-lifecycle-gate/v1";
	status: RuleLifecycleStatusResult;
	manifest: string;
	findings: RuleLifecycleFinding[];
	summary: {
		errors: number;
		warnings: number;
		total: number;
		rules: number;
	};
}

/** Inputs for running the rule lifecycle gate in tests, CLI, or automation. */
export interface RunRuleLifecycleGateOptions {
	repoRoot?: string | undefined;
	manifestPath?: string | undefined;
	now?: Date | undefined;
}

interface LoadRuleLifecycleManifestResult {
	ok: boolean;
	manifest?: RuleLifecycleManifest | undefined;
	finding?: RuleLifecycleFinding | undefined;
}

/** Validate rule lifecycle governance metadata for the repository. */
export function runRuleLifecycleGate(
	options: RunRuleLifecycleGateOptions = {},
): RuleLifecycleGateResult {
	const repoRoot = options.repoRoot ?? process.cwd();
	const manifestPath = options.manifestPath ?? DEFAULT_RULE_LIFECYCLE_MANIFEST;
	const now = options.now ?? new Date();
	const loaded = loadRuleLifecycleManifest(repoRoot, manifestPath);
	const findings: RuleLifecycleFinding[] = [];

	if (!loaded.ok) {
		if (loaded.finding) findings.push(loaded.finding);
		return buildRuleLifecycleGateResult({
			manifest: normalizeRepoRelativePath(manifestPath, repoRoot),
			findings,
			rules: 0,
		});
	}

	findings.push(...validateRuleLifecycleManifestState(loaded.manifest));
	const ruleIds = new Set(
		(loaded.manifest?.rules ?? []).map((rule) => rule.id),
	);
	for (const rule of loaded.manifest?.rules ?? []) {
		findings.push(...validateRuleLifecycleEntry(rule, now));
		if (
			rule.supersededBy !== undefined &&
			rule.supersededBy.trim().length > 0 &&
			!ruleIds.has(rule.supersededBy)
		) {
			findings.push({
				id: "rule-lifecycle.rule.supersession_unknown",
				severity: "error",
				ruleId: rule.id,
				message: `${rule.id} points at unknown replacement rule ${rule.supersededBy}.`,
				fix: "Add the replacement rule to the manifest or remove the stale supersededBy reference.",
			});
		}
	}

	findings.push(...validateSupersessionGraph(loaded.manifest));

	return buildRuleLifecycleGateResult({
		manifest: normalizeRepoRelativePath(manifestPath, repoRoot),
		findings,
		rules: loaded.manifest?.rules.length ?? 0,
	});
}

function loadRuleLifecycleManifest(
	repoRoot: string,
	manifestPath: string,
): LoadRuleLifecycleManifestResult {
	const resolvedPath = resolveManifestPath(repoRoot, manifestPath);
	if (!isPathInsideRepo(repoRoot, resolvedPath)) {
		return {
			ok: false,
			finding: {
				id: "rule-lifecycle.manifest.outside_repo",
				severity: "error",
				message:
					"Rule lifecycle manifest must live inside the repository so CI validates tracked governance.",
				fix: "Move the manifest under the repo root, or run an explicit one-off validation outside CI.",
			},
		};
	}
	if (!existsSync(resolvedPath)) {
		return {
			ok: false,
			finding: {
				id: "rule-lifecycle.manifest.missing",
				severity: "error",
				message:
					"Rule lifecycle manifest is missing; governance rules need ownership, evidence, enforcement, freshness, and retirement metadata.",
				fix: `Create ${normalizeRepoRelativePath(
					manifestPath,
					repoRoot,
				)} with schemaVersion ${RULE_LIFECYCLE_MANIFEST_SCHEMA_VERSION}.`,
			},
		};
	}

	try {
		const realRepoRoot = realpathSync(repoRoot);
		const realManifestPath = realpathSync(resolvedPath);
		if (!isPathInsideRepo(realRepoRoot, realManifestPath)) {
			return {
				ok: false,
				finding: {
					id: "rule-lifecycle.manifest.outside_repo",
					severity: "error",
					message:
						"Rule lifecycle manifest must resolve inside the repository so CI validates tracked governance.",
					fix: "Replace external manifest symlinks with a tracked repo-local manifest.",
				},
			};
		}
		const parsed = JSON.parse(readFileSync(resolvedPath, "utf-8")) as unknown;
		if (!isRuleLifecycleManifest(parsed)) {
			return {
				ok: false,
				finding: {
					id: "rule-lifecycle.manifest.invalid",
					severity: "error",
					message:
						"Rule lifecycle manifest must use schemaVersion rule-lifecycle-manifest/v1 and a rules array with unique ids.",
					fix: "Validate manifest shape before adding new governance rules.",
				},
			};
		}
		return { ok: true, manifest: parsed };
	} catch (error) {
		return {
			ok: false,
			finding: {
				id: "rule-lifecycle.manifest.read_failed",
				severity: "error",
				message: `Could not read rule lifecycle manifest: ${error instanceof Error ? error.message : String(error)}`,
			},
		};
	}
}

function validateRuleLifecycleManifestState(
	manifest: RuleLifecycleManifest | undefined,
): RuleLifecycleFinding[] {
	if (manifest === undefined || manifest.rules.length === 0) {
		return [
			{
				id: "rule-lifecycle.manifest.rules_missing",
				severity: "error",
				message:
					"Rule lifecycle manifest must contain at least one governance rule.",
				fix: "Add an active rule with owner, scope, evidence, enforcement, freshness, and retirement metadata.",
			},
		];
	}
	if (!manifest.rules.some((rule) => rule.status === "active")) {
		return [
			{
				id: "rule-lifecycle.manifest.active_rule_missing",
				severity: "error",
				message:
					"Rule lifecycle manifest must contain at least one active governance rule.",
				fix: "Keep a live replacement before retiring every rule in the manifest.",
			},
		];
	}
	return [];
}

function validateRuleLifecycleEntry(
	rule: RuleLifecycleEntry,
	now: Date,
): RuleLifecycleFinding[] {
	const findings: RuleLifecycleFinding[] = [];
	if (rule.owner.trim().length === 0) {
		findings.push(makeMissingFinding(rule.id, "owner"));
	}
	if (rule.scope.length === 0) {
		findings.push(makeMissingFinding(rule.id, "scope"));
	}
	if (rule.evidence.length === 0 || hasBlankString(rule.evidence)) {
		findings.push(makeMissingFinding(rule.id, "evidence"));
	}
	if (
		rule.enforcement.length === 0 ||
		rule.enforcementRefs.length === 0 ||
		hasBlankString(rule.enforcementRefs)
	) {
		findings.push({
			id: "rule-lifecycle.rule.enforcement_missing",
			severity: "error",
			ruleId: rule.id,
			message: `${rule.id} must declare enforcement destinations and concrete enforcement references.`,
			fix: "Add enforcement types plus command/file/check/reviewer references, or do not promote this rule yet.",
		});
	}
	if (rule.removalCondition.trim().length === 0) {
		findings.push(makeMissingFinding(rule.id, "removalCondition"));
	}
	if (rule.reviewCadenceDays < 1) {
		findings.push({
			id: "rule-lifecycle.rule.review_cadence_invalid",
			severity: "error",
			ruleId: rule.id,
			message: `${rule.id} must set reviewCadenceDays to a positive integer.`,
			fix: "Set a positive review cadence so stale rules get revisited.",
		});
	}
	const staleFinding = validateFreshness(rule, now);
	if (staleFinding) findings.push(staleFinding);
	if (
		(rule.status === "deprecated" || rule.status === "superseded") &&
		(rule.supersededBy === undefined || rule.supersededBy.trim().length === 0)
	) {
		findings.push({
			id: "rule-lifecycle.rule.supersession_missing",
			severity: "error",
			ruleId: rule.id,
			message: `${rule.id} is ${rule.status} but does not declare supersededBy.`,
			fix: "Point retired guidance at the active replacement rule, or remove it from the manifest.",
		});
	}
	return findings;
}

function validateFreshness(
	rule: RuleLifecycleEntry,
	now: Date,
): RuleLifecycleFinding | undefined {
	const reviewedAt = parseIsoDate(rule.lastReviewedAt);
	if (reviewedAt === undefined) {
		return {
			id: "rule-lifecycle.rule.last_reviewed_invalid",
			severity: "error",
			ruleId: rule.id,
			message: `${rule.id} must use an ISO date for lastReviewedAt.`,
			fix: "Use YYYY-MM-DD so agents and CI can evaluate freshness deterministically.",
		};
	}
	const cadenceMs = rule.reviewCadenceDays * 24 * 60 * 60 * 1000;
	if (reviewedAt.getTime() + cadenceMs < startOfUtcDay(now).getTime()) {
		return {
			id: "rule-lifecycle.rule.stale",
			severity: "error",
			ruleId: rule.id,
			message: `${rule.id} is past its review cadence.`,
			fix: "Review whether the rule is still useful, then update lastReviewedAt or retire it.",
		};
	}
	return undefined;
}

function parseIsoDate(value: string): Date | undefined {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (match === null) return undefined;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const parsed = new Date(Date.UTC(year, month - 1, day));
	if (
		parsed.getUTCFullYear() !== year ||
		parsed.getUTCMonth() !== month - 1 ||
		parsed.getUTCDate() !== day
	) {
		return undefined;
	}
	return parsed;
}

function validateSupersessionGraph(
	manifest: RuleLifecycleManifest | undefined,
): RuleLifecycleFinding[] {
	if (manifest === undefined) return [];
	const rulesById = new Map(manifest.rules.map((rule) => [rule.id, rule]));
	const findings: RuleLifecycleFinding[] = [];
	for (const rule of manifest.rules) {
		if (rule.status === "active" || rule.supersededBy === undefined) continue;
		const chain = new Set<string>([rule.id]);
		let current = rulesById.get(rule.supersededBy);
		while (current !== undefined) {
			if (chain.has(current.id)) {
				findings.push({
					id: "rule-lifecycle.rule.supersession_cycle",
					severity: "error",
					ruleId: rule.id,
					message: `${rule.id} has a supersession chain that loops through ${current.id}.`,
					fix: "Point retired rules at a replacement chain that terminates at an active rule.",
				});
				break;
			}
			if (current.status === "active") break;
			if (current.supersededBy === undefined) {
				findings.push({
					id: "rule-lifecycle.rule.supersession_terminal_missing",
					severity: "error",
					ruleId: rule.id,
					message: `${rule.id} does not resolve to an active replacement rule.`,
					fix: "Add a supersededBy chain that terminates at an active rule.",
				});
				break;
			}
			chain.add(current.id);
			current = rulesById.get(current.supersededBy);
		}
	}
	return findings;
}

function makeMissingFinding(
	ruleId: string,
	field: string,
): RuleLifecycleFinding {
	return {
		id: `rule-lifecycle.rule.${field}.missing`,
		severity: "error",
		ruleId,
		message: `${ruleId} must declare ${field}.`,
		fix: `Add ${field} metadata before treating this as durable governance.`,
	};
}

function buildRuleLifecycleGateResult(input: {
	manifest: string;
	findings: RuleLifecycleFinding[];
	rules: number;
}): RuleLifecycleGateResult {
	const errors = input.findings.filter(
		(finding) => finding.severity === "error",
	).length;
	const warnings = input.findings.filter(
		(finding) => finding.severity === "warning",
	).length;
	return {
		schemaVersion: "rule-lifecycle-gate/v1",
		status: errors > 0 ? "fail" : warnings > 0 ? "warn" : "pass",
		manifest: input.manifest,
		findings: input.findings,
		summary: {
			errors,
			warnings,
			total: input.findings.length,
			rules: input.rules,
		},
	};
}

function isRuleLifecycleManifest(
	value: unknown,
): value is RuleLifecycleManifest {
	if (!isRecord(value)) return false;
	if (value.schemaVersion !== RULE_LIFECYCLE_MANIFEST_SCHEMA_VERSION) {
		return false;
	}
	if (!Array.isArray(value.rules)) return false;
	const seenRuleIds = new Set<string>();
	for (const rule of value.rules) {
		if (!isRuleLifecycleEntry(rule)) return false;
		if (seenRuleIds.has(rule.id)) return false;
		seenRuleIds.add(rule.id);
	}
	return true;
}

function isRuleLifecycleEntry(value: unknown): value is RuleLifecycleEntry {
	if (!isRecord(value)) return false;
	if (!isNonEmptyString(value.id)) return false;
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) return false;
	if (!isNonEmptyString(value.title)) return false;
	if (
		value.status !== "active" &&
		value.status !== "deprecated" &&
		value.status !== "superseded"
	) {
		return false;
	}
	if (typeof value.owner !== "string") return false;
	if (!isSafeStringArray(value.scope)) return false;
	if (!isStringArray(value.evidence)) return false;
	if (!isEnforcementArray(value.enforcement)) return false;
	if (!isStringArray(value.enforcementRefs)) return false;
	if (typeof value.lastReviewedAt !== "string") return false;
	if (!Number.isInteger(value.reviewCadenceDays)) return false;
	if (typeof value.removalCondition !== "string") return false;
	if (
		value.supersededBy !== undefined &&
		(typeof value.supersededBy !== "string" ||
			!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.supersededBy))
	) {
		return false;
	}
	if (value.notes !== undefined && typeof value.notes !== "string")
		return false;
	return true;
}

function isEnforcementArray(
	value: unknown,
): value is RuleLifecycleEnforcement[] {
	if (!Array.isArray(value)) return false;
	return value.every(
		(entry) =>
			entry === "doc" ||
			entry === "lint" ||
			entry === "test" ||
			entry === "ci" ||
			entry === "reviewer" ||
			entry === "human-escalation",
	);
}

function isSafeStringArray(value: unknown): value is string[] {
	if (!isStringArray(value)) return false;
	return value.every(isSafeRegistryPath);
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((entry) => typeof entry === "string")
	);
}

function hasBlankString(value: string[]): boolean {
	return value.some((entry) => entry.trim().length === 0);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isSafeRegistryPath(path: string): boolean {
	if (path.trim().length === 0) return false;
	if (isAbsolute(path)) return false;
	if (/^[A-Za-z]:[\\/]/.test(path)) return false;
	const normalizedPath = normalize(path.trim()).replace(/\\/g, "/");
	return (
		normalizedPath.length > 0 &&
		normalizedPath !== "." &&
		!normalizedPath.startsWith("../") &&
		!normalizedPath.includes("/../")
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRepoRelativePath(path: string, repoRoot: string): string {
	const relativePath = isAbsolute(path)
		? relative(repoRoot, path)
		: relative(repoRoot, resolve(repoRoot, path));
	return normalize(relativePath).replace(/\\/g, "/").replace(/^\.\//, "");
}

function resolveManifestPath(repoRoot: string, manifestPath: string): string {
	return isAbsolute(manifestPath)
		? manifestPath
		: resolve(repoRoot, manifestPath);
}

function isPathInsideRepo(repoRoot: string, path: string): boolean {
	const relativePath = relative(repoRoot, path);
	return (
		relativePath.length === 0 ||
		(!relativePath.startsWith("..") && !isAbsolute(relativePath))
	);
}

function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}
