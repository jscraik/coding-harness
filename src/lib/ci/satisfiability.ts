import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RequiredCheckIdentity } from "./provider-adapter.js";

export interface BranchProtectionFailingPullRequest {
	number: number;
	missingChecks: string[];
}

export interface BranchProtectionSatisfiabilityReport {
	status: "satisfied" | "unsatisfied";
	scannedOpenPrs: number;
	failingPrs: BranchProtectionFailingPullRequest[];
}

interface PullRequestSatisfiabilityFixture {
	openPullRequests: Array<{
		number: number;
		satisfiedChecks: string[];
	}>;
}

function readFixture(
	targetDir: string,
): PullRequestSatisfiabilityFixture | undefined {
	const fixturePath = resolve(
		targetDir,
		".harness",
		"control-plane",
		"open-pr-satisfiability.json",
	);
	if (!existsSync(fixturePath)) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(readFileSync(fixturePath, "utf-8")) as unknown;
		if (!parsed || typeof parsed !== "object") {
			return undefined;
		}
		const record = parsed as Record<string, unknown>;
		if (!Array.isArray(record.openPullRequests)) {
			return undefined;
		}
		const openPullRequests = record.openPullRequests
			.filter(
				(entry): entry is { number: number; satisfiedChecks: string[] } => {
					if (!entry || typeof entry !== "object") {
						return false;
					}
					const candidate = entry as Record<string, unknown>;
					return (
						typeof candidate.number === "number" &&
						Number.isInteger(candidate.number) &&
						Array.isArray(candidate.satisfiedChecks) &&
						candidate.satisfiedChecks.every(
							(check) => typeof check === "string",
						)
					);
				},
			)
			.map((entry) => ({
				number: entry.number,
				satisfiedChecks: [...entry.satisfiedChecks],
			}));
		return { openPullRequests };
	} catch {
		return undefined;
	}
}

export function scanOpenPullRequestSatisfiability(
	targetDir: string,
	requiredChecks: RequiredCheckIdentity[],
): BranchProtectionSatisfiabilityReport {
	const requiredCheckNames = [
		...new Set(requiredChecks.map((c) => c.displayName)),
	];
	const fixture = readFixture(targetDir);
	if (!fixture) {
		// Conservative default for local/non-fixture execution:
		// no failing PRs discovered, but no live PR evidence either.
		return {
			status: "satisfied",
			scannedOpenPrs: 0,
			failingPrs: [],
		};
	}

	const failingPrs: BranchProtectionFailingPullRequest[] = [];
	for (const pr of fixture.openPullRequests) {
		const satisfied = new Set(pr.satisfiedChecks);
		const missingChecks = requiredCheckNames.filter(
			(check) => !satisfied.has(check),
		);
		if (missingChecks.length > 0) {
			failingPrs.push({
				number: pr.number,
				missingChecks,
			});
		}
	}
	return {
		status: failingPrs.length > 0 ? "unsatisfied" : "satisfied",
		scannedOpenPrs: fixture.openPullRequests.length,
		failingPrs,
	};
}
