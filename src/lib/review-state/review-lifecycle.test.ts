import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EvidenceReceipt } from "../evidence/evidence-receipt.js";
import {
	validateReviewLifecyclePacket,
	type ReviewLifecyclePacket,
} from "./index.js";

const HEAD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const GENERATED_AT = "2026-05-28T06:45:00Z";
const SEMANTIC_VALIDATOR_PATH = new URL(
	"../../../scripts/validate-review-lifecycle.cjs",
	import.meta.url,
);

describe("review-lifecycle/v1 validation", () => {
	it("accepts a current covered review lifecycle without promoting it to closeout proof", () => {
		const packet = reviewLifecyclePacket();

		const result = validateReviewLifecyclePacket(packet);

		expect(result).toEqual({ valid: true, errors: [] });
		expect(packet.runtimeStatus).toBe("not_yet_emitted");
		expect(packet.evidenceUse).toBe("orientation");
		expect(packet.verdict).toMatchObject({
			status: "pass",
			readyForReviewClaim: true,
		});
	});

	it("rejects pass verdicts with stale review mode", () => {
		const result = validateReviewLifecyclePacket(
			reviewLifecyclePacket({
				mode: {
					...reviewLifecyclePacket().mode,
					status: "stale",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "mode.status" }),
			]),
		);
	});

	it("rejects pass verdicts with unresolved active review threads", () => {
		const result = validateReviewLifecyclePacket(
			reviewLifecyclePacket({
				unresolvedThreads: {
					total: 1,
					needsHuman: 1,
					autofixable: 0,
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "unresolvedThreads.total" }),
			]),
		);
	});

	it("rejects unresolved thread buckets that contradict the total", () => {
		const result = validateReviewLifecyclePacket(
			reviewLifecyclePacket({
				unresolvedThreads: {
					total: 0,
					needsHuman: 0,
					autofixable: 1,
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "unresolvedThreads.total" }),
			]),
		);
	});

	it("rejects missing artifact lineage for covered pass verdicts", () => {
		const result = validateReviewLifecyclePacket(
			reviewLifecyclePacket({
				artifactLineage: [],
				coverage: {
					requiredRoles: ["adversarial-reviewer"],
					coveredRoles: [],
					missingRoles: ["adversarial-reviewer"],
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "artifactLineage" }),
				expect.objectContaining({ path: "coverage.coveredRoles" }),
				expect.objectContaining({ path: "coverage.missingRoles" }),
			]),
		);
	});

	it("rejects zero-byte reviewer artifacts", () => {
		const result = validateReviewLifecyclePacket(
			reviewLifecyclePacket({
				artifactLineage: [
					artifactLineage({
						receipt: reviewArtifactReceipt({ sizeBytes: 0 }),
					}),
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "artifactLineage.0.receipt.sizeBytes",
				}),
			]),
		);
	});

	it.each([
		"orientation",
		"audit_trail",
	] as const)("rejects artifact receipts with evidenceUse %s", (evidenceUse) => {
		const result = validateReviewLifecyclePacket(
			reviewLifecyclePacket({
				artifactLineage: [
					artifactLineage({
						receipt: reviewArtifactReceipt({ evidenceUse }),
					}),
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "artifactLineage.0.receipt.evidenceUse",
				}),
			]),
		);
	});

	it("rejects implementation-produced or self-certified review artifacts", () => {
		const result = validateReviewLifecyclePacket(
			reviewLifecyclePacket({
				artifactLineage: [
					artifactLineage({
						producer: "harness:review-lifecycle",
						receipt: reviewArtifactReceipt({
							producer: "harness:review-lifecycle",
						}),
					}),
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "artifactLineage.0.producer" }),
			]),
		);
	});

	it("rejects artifact lineage bound to a different head SHA", () => {
		const result = validateReviewLifecyclePacket(
			reviewLifecyclePacket({
				artifactLineage: [
					artifactLineage({
						receipt: reviewArtifactReceipt({
							headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
						}),
					}),
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "artifactLineage.0.receipt.headSha",
				}),
			]),
		);
	});

	it("rejects source review-state head mismatch", () => {
		const result = validateReviewLifecyclePacket(
			reviewLifecyclePacket({
				sourceReviewState: {
					...reviewLifecyclePacket().sourceReviewState,
					headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "sourceReviewState.headSha" }),
			]),
		);
	});

	it("requires explicit tool exposure state counts", () => {
		const packet = reviewLifecyclePacket({
			toolExposure: {
				sourceRef: "tool-exposure:pu-033.json",
				classes: [
					{
						className: "agent",
						statusCounts: {
							visible: 1,
							deferred: 1,
							hidden: 0,
							unavailable: 1,
							policyBlocked: 1,
						},
						failureClass: "mixed_agent_runtime",
					},
				],
			},
		});

		const result = validateReviewLifecyclePacket(packet);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects raw comments, transcripts, prompt text, and secret-like fields", () => {
		const packet = {
			...reviewLifecyclePacket(),
			rawCommentBody: "please merge",
		};

		const result = validateReviewLifecyclePacket(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "rawCommentBody" }),
				expect.objectContaining({ path: "packet.rawCommentBody" }),
			]),
		);
	});

	it("rejects unknown top-level fields", () => {
		const result = validateReviewLifecyclePacket({
			...reviewLifecyclePacket(),
			mergeReady: true,
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: "mergeReady" })]),
		);
	});

	it("rejects unknown nested fields", () => {
		const packet = reviewLifecyclePacket() as unknown as Record<
			string,
			unknown
		>;
		packet.reviewer = {
			...(packet.reviewer as Record<string, unknown>),
			extra: "not allowed",
		};

		const result = validateReviewLifecyclePacket(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "reviewer.extra" }),
			]),
		);
	});

	it("binds reviewer identity to covered artifact lineage", () => {
		const result = validateReviewLifecyclePacket(
			reviewLifecyclePacket({
				reviewer: {
					role: "agent-native-reviewer",
					producer: "agent-native-reviewer",
					runManifestRef:
						"artifacts/agent-runs/agent-native-reviewer-example/manifest.json",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "coverage.coveredRoles" }),
				expect.objectContaining({ path: "artifactLineage" }),
			]),
		);
	});

	it.each([
		["unknown top-level fields", { mergeReady: true }],
		[
			"unknown nested fields",
			{
				reviewer: {
					...reviewLifecyclePacket().reviewer,
					extra: "not allowed",
				},
			},
		],
		["missing reviewer", { reviewer: undefined }],
		[
			"invalid mode kind",
			{ mode: { ...reviewLifecyclePacket().mode, kind: "merge_review" } },
		],
		[
			"reviewer identity missing from lineage and coverage",
			{
				reviewer: {
					role: "agent-native-reviewer",
					producer: "agent-native-reviewer",
					runManifestRef:
						"artifacts/agent-runs/agent-native-reviewer-example/manifest.json",
				},
			},
		],
		[
			"contradictory unresolved thread buckets",
			{
				unresolvedThreads: {
					total: 0,
					needsHuman: 0,
					autofixable: 1,
				},
			},
		],
		[
			"covered roles without artifact lineage",
			{
				coverage: {
					requiredRoles: ["agent-native-reviewer"],
					coveredRoles: ["agent-native-reviewer"],
					missingRoles: [],
				},
			},
		],
		[
			"self-certified implementation reviewer",
			{
				reviewer: {
					role: "harness:review-lifecycle-validator",
					producer: "harness:review-lifecycle-validator",
					runManifestRef: "artifacts/agent-runs/harness/manifest.json",
				},
				artifactLineage: [
					artifactLineage({
						role: "harness:review-lifecycle-validator",
						producer: "harness:review-lifecycle-validator",
						path: "artifacts/reviews/harness.md",
						receipt: reviewArtifactReceipt({
							producer: "harness:review-lifecycle-validator",
							ref: "review-lifecycle:artifacts/reviews/harness.md",
						}),
					}),
				],
				coverage: {
					requiredRoles: ["harness:review-lifecycle-validator"],
					coveredRoles: ["harness:review-lifecycle-validator"],
					missingRoles: [],
				},
			},
		],
	])("semantic validator rejects %s", (_label, overrides) => {
		const result = runSemanticValidator(packetWithUndefinedPruned(overrides));

		expect(result.status).not.toBe(0);
		expect(result.stdout).toContain('"status": "fail"');
	});
});

function reviewLifecyclePacket(
	overrides: Partial<ReviewLifecyclePacket> = {},
): ReviewLifecyclePacket {
	return {
		schemaVersion: "review-lifecycle/v1",
		generatedAt: GENERATED_AT,
		producer: "harness:review-lifecycle-validator",
		runtimeStatus: "not_yet_emitted",
		evidenceUse: "orientation",
		sourceReviewStateRef: "review-state:pr-309/fetch.json",
		sourceReviewState: {
			schemaVersion: "review-state/v1",
			ref: "review-state:pr-309/fetch.json",
			generatedAt: GENERATED_AT,
			headSha: HEAD_SHA,
			fetchReceiptRef: "review-state:pr-309/fetch.json",
			reviewerArtifactRefs: [
				"review-lifecycle:artifacts/reviews/adversarial-reviewer.md",
			],
			unresolvedThreadTotal: 0,
		},
		target: {
			repository: "jscraik/coding-harness",
			prNumber: 309,
			url: "https://github.com/jscraik/coding-harness/pull/309",
			baseRef: "main",
			headRef: "codex/jsc-363-runtime-evidence-cockpit-refresh",
			headSha: HEAD_SHA,
			reviewStateHeadSha: HEAD_SHA,
		},
		mode: {
			kind: "pr_review",
			status: "current",
			startedAt: GENERATED_AT,
			completedAt: GENERATED_AT,
		},
		reviewer: {
			role: "adversarial-reviewer",
			producer: "adversarial-reviewer",
			runManifestRef:
				"artifacts/agent-runs/adversarial-reviewer-example/manifest.json",
		},
		toolExposure: {
			sourceRef: "tool-exposure:pu-033.json",
			classes: [
				{
					className: "agent",
					statusCounts: {
						visible: 1,
						deferred: 0,
						hidden: 0,
						unavailable: 0,
						policyBlocked: 0,
					},
					failureClass: null,
				},
			],
		},
		artifactLineage: [artifactLineage()],
		findings: {
			total: 1,
			blocking: 0,
			advisory: 1,
			resolved: 1,
		},
		selectableComments: {
			total: 1,
			selected: 1,
			unselected: 0,
		},
		unresolvedThreads: {
			total: 0,
			needsHuman: 0,
			autofixable: 0,
		},
		coverage: {
			requiredRoles: ["adversarial-reviewer"],
			coveredRoles: ["adversarial-reviewer"],
			missingRoles: [],
		},
		verdict: {
			status: "pass",
			blockerClass: null,
			reason: "review_lifecycle_covered",
			readyForReviewClaim: true,
		},
		...overrides,
	};
}

function artifactLineage(
	overrides: Partial<ReviewLifecyclePacket["artifactLineage"][number]> = {},
): ReviewLifecyclePacket["artifactLineage"][number] {
	const role = overrides.role ?? "adversarial-reviewer";
	const path = overrides.path ?? "artifacts/reviews/adversarial-reviewer.md";
	const producer = overrides.producer ?? role;
	return {
		role,
		path,
		producer,
		runManifestRef:
			overrides.runManifestRef ??
			"artifacts/agent-runs/adversarial-reviewer-example/manifest.json",
		receipt:
			overrides.receipt ??
			reviewArtifactReceipt({
				producer,
				ref: `review-lifecycle:${path}`,
			}),
	};
}

function reviewArtifactReceipt(
	overrides: Partial<EvidenceReceipt> = {},
): EvidenceReceipt {
	return {
		schemaVersion: "evidence-receipt/v1",
		kind: "review_artifact",
		ref: "review-lifecycle:artifacts/reviews/adversarial-reviewer.md",
		producer: "adversarial-reviewer",
		status: "pass",
		freshness: "current",
		evidenceUse: "claim_support",
		blockerClass: null,
		verifiedAt: GENERATED_AT,
		headSha: HEAD_SHA,
		sizeBytes: 2048,
		...overrides,
	};
}

function packetWithUndefinedPruned(
	overrides: Record<string, unknown>,
): Record<string, unknown> {
	return JSON.parse(
		JSON.stringify({ ...reviewLifecyclePacket(), ...overrides }),
	);
}

function runSemanticValidator(packet: Record<string, unknown>): {
	status: number | null;
	stdout: string;
	stderr: string;
} {
	const dir = mkdtempSync(join(tmpdir(), "review-lifecycle-"));
	const packetPath = join(dir, "packet.json");
	writeFileSync(packetPath, JSON.stringify(packet), "utf8");
	return spawnSync(
		process.execPath,
		[SEMANTIC_VALIDATOR_PATH.pathname, packetPath],
		{
			encoding: "utf8",
		},
	);
}
