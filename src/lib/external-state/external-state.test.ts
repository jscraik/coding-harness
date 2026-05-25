import { describe, expect, it } from "vitest";
import {
	evaluateExternalStateClaimSupport,
	validateExternalStateSnapshot,
} from "./index.js";
import type {
	ExternalStateSnapshot,
	ExternalStateSource,
	ExternalStateSourceSnapshot,
} from "./index.js";

const HEAD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_HEAD_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FETCHED_AT = "2026-05-25T12:00:00Z";
const EXPIRED_AT = "2026-05-25T13:00:00Z";

describe("external-state-snapshot/v1 validation", () => {
	it("accepts a current multi-source snapshot for orientation and claim support", () => {
		const snapshot = externalStateSnapshot();
		const validation = validateExternalStateSnapshot(snapshot);
		const claimSupport = evaluateExternalStateClaimSupport(snapshot, HEAD_SHA);

		expect(validation).toEqual({ valid: true, errors: [] });
		expect(claimSupport).toEqual({ canSupportClaim: true, blockers: [] });
	});

	it("rejects snapshots without fetchedAt", () => {
		const snapshot = {
			...externalStateSnapshot(),
			fetchedAt: undefined,
		};

		const result = validateExternalStateSnapshot(snapshot);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: "fetchedAt" })]),
		);
	});

	it("rejects invalid TTL values", () => {
		const snapshot = externalStateSnapshot({ ttlSeconds: 0 });

		const result = validateExternalStateSnapshot(snapshot);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: "ttlSeconds" })]),
		);
	});

	it("rejects PR-head-sensitive sources without headSha", () => {
		const snapshot = externalStateSnapshot({
			sources: replaceSource(
				"github_pr",
				sourceSnapshot({
					source: "github_pr",
					headSha: null,
					prHeadSensitive: true,
				}),
			),
		});

		const result = validateExternalStateSnapshot(snapshot);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "sources.0.headSha" }),
			]),
		);
	});

	it("rejects stale PR head SHA in source snapshots", () => {
		const snapshot = externalStateSnapshot({
			sources: replaceSource(
				"github_checks",
				sourceSnapshot({
					source: "github_checks",
					headSha: OTHER_HEAD_SHA,
				}),
			),
		});

		const result = validateExternalStateSnapshot(snapshot);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "sources.1.headSha" }),
			]),
		);
	});

	it("allows stale Linear state for orientation but not claim support", () => {
		const snapshot = externalStateSnapshot({
			stale: true,
			staleReasons: ["linear_snapshot_ttl_expired"],
			evidenceUse: "orientation",
			sources: replaceSource(
				"linear",
				sourceSnapshot({
					source: "linear",
					status: "stale",
					prHeadSensitive: false,
					headSha: null,
					evidenceUse: "orientation",
					freshness: "stale",
					staleReasons: ["linear_snapshot_ttl_expired"],
				}),
			),
		});

		const validation = validateExternalStateSnapshot(snapshot);
		const claimSupport = evaluateExternalStateClaimSupport(snapshot, HEAD_SHA);

		expect(validation).toEqual({ valid: true, errors: [] });
		expect(claimSupport).toEqual({
			canSupportClaim: false,
			blockers: [
				"snapshot_stale",
				"snapshot_not_claim_support",
				"source_not_claim_support",
				"source_stale",
				"source_not_current",
			],
		});
	});

	it("rejects CodeRabbit unavailable when marked as claim support", () => {
		const snapshot = externalStateSnapshot({
			sources: replaceSource(
				"coderabbit",
				sourceSnapshot({
					source: "coderabbit",
					status: "unavailable",
					evidenceUse: "claim_support",
				}),
			),
		});

		const result = validateExternalStateSnapshot(snapshot);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "sources.3.evidenceUse" }),
			]),
		);
	});

	it("rejects snapshots that omit required source families", () => {
		const snapshot = externalStateSnapshot({
			sources: baseSources().filter(({ source }) => source !== "circleci"),
		});

		const result = validateExternalStateSnapshot(snapshot);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: "sources" })]),
		);
	});

	it("rejects duplicate source families", () => {
		const snapshot = externalStateSnapshot({
			sources: [...baseSources(), sourceSnapshot({ source: "circleci" })],
		});

		const result = validateExternalStateSnapshot(snapshot);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: "sources" })]),
		);
	});

	it("rejects expired snapshots that still claim current state", () => {
		const snapshot = externalStateSnapshot({
			generatedAt: EXPIRED_AT,
		});

		const result = validateExternalStateSnapshot(snapshot);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "stale" }),
				expect.objectContaining({ path: "staleReasons" }),
			]),
		);
	});

	it("rejects stale source freshness hidden behind available status", () => {
		const snapshot = externalStateSnapshot({
			sources: replaceSource(
				"github_checks",
				sourceSnapshot({
					source: "github_checks",
					freshness: "stale",
					staleReasons: ["github_checks_snapshot_ttl_expired"],
				}),
			),
		});

		const result = validateExternalStateSnapshot(snapshot);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "sources.1.status" }),
			]),
		);
	});

	it("rejects missing or unknown freshness as claim support", () => {
		for (const freshness of ["missing", "unknown"] as const) {
			const snapshot = externalStateSnapshot({
				sources: replaceSource(
					"github_checks",
					sourceSnapshot({
						source: "github_checks",
						freshness,
					}),
				),
			});

			const validation = validateExternalStateSnapshot(snapshot);
			const claimSupport = evaluateExternalStateClaimSupport(
				snapshot,
				HEAD_SHA,
			);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ path: "sources.1.freshness" }),
				]),
			);
			expect(claimSupport).toEqual({
				canSupportClaim: false,
				blockers: ["source_not_current"],
			});
		}
	});

	it("rejects non-passing result status as claim support", () => {
		const snapshot = externalStateSnapshot({
			sources: replaceSource(
				"github_checks",
				sourceSnapshot({
					source: "github_checks",
					resultStatus: "blocked",
				}),
			),
		});

		const validation = validateExternalStateSnapshot(snapshot);
		const claimSupport = evaluateExternalStateClaimSupport(snapshot, HEAD_SHA);

		expect(validation.valid).toBe(false);
		expect(validation.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "sources.1.resultStatus" }),
			]),
		);
		expect(claimSupport).toEqual({
			canSupportClaim: false,
			blockers: ["source_not_passing"],
		});
	});

	it("keeps review and external state as separate evidence references", () => {
		const snapshot = externalStateSnapshot({
			sources: replaceSource(
				"github_reviews",
				sourceSnapshot({
					source: "github_reviews",
					evidenceRef: "external-state:github-reviews.json",
				}),
			),
		});

		const validation = validateExternalStateSnapshot(snapshot);

		expect(validation.valid).toBe(true);
		expect(snapshot.sources[2]?.evidenceRef).toBe(
			"external-state:github-reviews.json",
		);
		expect(snapshot.sources[2]?.evidenceRef).not.toMatch(/^review-state:/u);
	});
});

function externalStateSnapshot(
	overrides: Partial<ExternalStateSnapshot> = {},
): ExternalStateSnapshot {
	return {
		schemaVersion: "external-state-snapshot/v1",
		generatedAt: FETCHED_AT,
		fetchedAt: FETCHED_AT,
		ttlSeconds: 300,
		headSha: HEAD_SHA,
		evidenceUse: "claim_support",
		stale: false,
		staleReasons: [],
		sources: baseSources(),
		...overrides,
	};
}

function baseSources(): ExternalStateSourceSnapshot[] {
	return [
		sourceSnapshot({ source: "github_pr" }),
		sourceSnapshot({ source: "github_checks" }),
		sourceSnapshot({ source: "github_reviews" }),
		sourceSnapshot({ source: "coderabbit" }),
		sourceSnapshot({
			source: "linear",
			prHeadSensitive: false,
			headSha: null,
		}),
		sourceSnapshot({ source: "circleci" }),
	];
}

function replaceSource(
	source: ExternalStateSource,
	replacement: ExternalStateSourceSnapshot,
): ExternalStateSourceSnapshot[] {
	return baseSources().map((current) =>
		current.source === source ? replacement : current,
	);
}

function sourceSnapshot(
	overrides: Partial<ExternalStateSourceSnapshot> & {
		source: ExternalStateSource;
	},
): ExternalStateSourceSnapshot {
	return {
		source: overrides.source,
		status: overrides.status ?? "available",
		fetchedAt: overrides.fetchedAt ?? FETCHED_AT,
		ttlSeconds: overrides.ttlSeconds ?? 300,
		headSha: overrides.headSha === undefined ? HEAD_SHA : overrides.headSha,
		prHeadSensitive: overrides.prHeadSensitive ?? true,
		evidenceUse: overrides.evidenceUse ?? "claim_support",
		evidenceRef:
			overrides.evidenceRef ?? `external-state:${overrides.source}.json`,
		freshness: overrides.freshness ?? "current",
		resultStatus: overrides.resultStatus ?? "pass",
		staleReasons: overrides.staleReasons ?? [],
	};
}
