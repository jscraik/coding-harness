/**
 * Remediation Orchestrator
 *
 * Orchestrates the remediation workflow with:
 * - Multiple TOCTOU checkpoints (start, mid-processing, end)
 * - Batch ancestry checks with SHA deduplication
 * - Tier-based action decisions with fail-closed validation
 */

import type { RemediationPolicy } from "../contract/types.js";
import type {
	CanonicalFinding,
	RemediationAction,
	RemediationOutcome,
	RemediationSeverity,
	RemediationTelemetry,
} from "./types.js";
import type { RemediationAutoTier } from "./types.js";

/**
 * Options for creating a RemediationOrchestrator.
 */
export interface OrchestratorOptions {
	/** Remediation policy configuration */
	policy: RemediationPolicy;
	/** Findings to process for remediation */
	findings: CanonicalFinding[];
	/** Whether to run in dry-run mode (no actual changes) */
	dryRun?: boolean;
	/** Initial HEAD SHA (will be verified) */
	headSha: string;
	/** Concurrency limit for batch operations */
	concurrency?: number;
}

/**
 * GitHub client interface for ancestry and HEAD verification.
 */
export interface GitHubClient {
	/** Get the current HEAD SHA of the repository */
	getHeadSha(): Promise<string>;
	/** Check if a commit is an ancestor of another */
	isAncestor(ancestorSha: string, descendantSha: string): Promise<boolean>;
}

/**
 * Severity ranking for tier comparison.
 * Uses Record for O(1) lookup and enables fail-closed validation.
 */
const SEVERITY_RANK: Record<RemediationSeverity, number> = {
	low: 0,
	medium: 1,
	high: 2,
} as const;

/**
 * Check if a severity tier allows automatic remediation.
 *
 * P1 FIX: Fail closed - reject unknown severities.
 * Returns false for any tier not in SEVERITY_RANK.
 */
function tierAllowsAuto(
	tier: RemediationSeverity,
	maxTier: RemediationAutoTier,
): boolean {
	// Fail closed: reject unknown severities
	if (!(tier in SEVERITY_RANK) || !(maxTier in SEVERITY_RANK)) {
		return false;
	}
	return SEVERITY_RANK[tier] <= SEVERITY_RANK[maxTier as RemediationSeverity];
}

/**
 * Orchestrates remediation workflow with TOCTOU protection.
 *
 * Implements 3 TOCTOU checkpoints:
 * 1. Start: Fetch fresh HEAD, don't trust input
 * 2. Mid-processing: Verify HEAD unchanged before action decisions
 * 3. End: Final verification before return
 */
export class RemediationOrchestrator {
	private readonly policy: RemediationPolicy;
	private readonly findings: CanonicalFinding[];
	private readonly dryRun: boolean;
	private readonly headSha: string;
	private readonly concurrency: number;
	private readonly github: GitHubClient | null;

	constructor(options: OrchestratorOptions, github?: GitHubClient | null) {
		this.policy = options.policy;
		this.findings = options.findings;
		this.dryRun = options.dryRun ?? false;
		this.headSha = options.headSha;
		this.concurrency = options.concurrency ?? 5;
		this.github = github ?? null;
	}

	/**
	 * Execute the remediation workflow.
	 *
	 * @returns RemediationOutcome with actions taken or error
	 */
	async remediate(): Promise<RemediationOutcome> {
		const actions: RemediationAction[] = [];
		const skipped: Array<{ findingId: string; reason: string }> = [];
		let apiCalls = 0;
		let cacheHits = 0;

		// P1 FIX: TOCTOU Checkpoint 1 - Fetch fresh HEAD at start, don't trust input
		const initialHead = this.github
			? await this.github.getHeadSha()
			: this.headSha;
		if (this.github) apiCalls++;

		// Step 1: Batch ancestry checks with deduplication
		const ancestryCache = new Map<string, boolean>();

		// Capture github client in local variable for type narrowing in callbacks
		const github = this.github;
		if (github) {
			// Deduplicate SHAs - only check unique values
			const uniqueShas = new Set(
				this.findings
					.map((f) => f.commitSha)
					.filter((sha) => sha !== initialHead), // Skip HEAD SHA
			);

			// Batch checks with concurrency limit
			const shaArray = Array.from(uniqueShas);
			for (let i = 0; i < shaArray.length; i += this.concurrency) {
				const batch = shaArray.slice(i, i + this.concurrency);
				const results = await Promise.all(
					batch.map(async (sha) => ({
						sha,
						isAncestor: await github.isAncestor(sha, initialHead),
					})),
				);
				apiCalls += batch.length;

				for (const { sha, isAncestor } of results) {
					ancestryCache.set(sha, isAncestor);
				}
			}
		}

		// P1 FIX: TOCTOU Checkpoint 2 - Mid-processing check before action decisions
		if (this.github) {
			const midHead = await this.github.getHeadSha();
			apiCalls++;
			if (midHead !== initialHead) {
				return {
					ok: false,
					error: {
						code: "E_RACE_DETECTED",
						message: "HEAD changed mid-processing; aborting for safety",
						context: { initialHead, currentHead: midHead },
					},
				};
			}
		}

		// Step 2: Process findings using cached results
		for (const finding of this.findings) {
			// Check ancestry (use cache or assume true if no GitHub client)
			if (this.github) {
				if (finding.commitSha === initialHead) {
					cacheHits++;
				} else {
					const isAncestor = ancestryCache.get(finding.commitSha);
					if (isAncestor === false) {
						skipped.push({
							findingId: finding.id,
							reason: "Commit not in HEAD ancestry",
						});
						continue;
					}
				}
			}

			// Get provider policy or skip if not configured
			const providerPolicy = this.policy.providerDefaults[finding.provider];
			if (!providerPolicy) {
				skipped.push({
					findingId: finding.id,
					reason: `No policy configured for provider: ${finding.provider}`,
				});
				continue;
			}

			// Determine action based on tier and policy
			const canAutoApply = tierAllowsAuto(
				finding.severity,
				providerPolicy.autoApplyMaxTier,
			);

			if (!canAutoApply) {
				skipped.push({
					findingId: finding.id,
					reason: `Severity '${finding.severity}' exceeds auto-apply max tier '${providerPolicy.autoApplyMaxTier}'`,
				});
				continue;
			}

			// Determine if this should be a dry run
			const isDryRun = this.dryRun || providerPolicy.dryRunOnlyByDefault;

			actions.push({
				type: isDryRun ? "skip" : "commit",
				findingId: finding.id,
				reason: isDryRun
					? "Dry run mode enabled"
					: `Auto-apply approved for ${finding.severity} severity`,
				dryRun: isDryRun,
			});
		}

		// P1 FIX: TOCTOU Checkpoint 3 - Final check before return
		if (this.github) {
			const finalHead = await this.github.getHeadSha();
			apiCalls++;
			if (finalHead !== initialHead) {
				return {
					ok: false,
					error: {
						code: "E_RACE_DETECTED",
						message: "HEAD changed during remediation; aborting for safety",
						context: { initialHead, currentHead: finalHead },
					},
				};
			}
		}

		const telemetry: RemediationTelemetry = {
			apiCalls,
			cacheHits,
		};

		return {
			ok: true,
			output: {
				findingsProcessed: this.findings.length,
				actions,
				skipped,
				telemetry,
			},
		};
	}
}

// Export for testing
export { tierAllowsAuto, SEVERITY_RANK };
