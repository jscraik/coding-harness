import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(
	process.cwd(),
	"scripts/check-goal-review-backfill.py",
);
const RECEIPTS_REF =
	"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl";
const requiredUnits = Array.from(
	{ length: 16 },
	(_, index) => `PU-${String(index + 1).padStart(3, "0")}`,
);
const requiredSkillLenses = [
	"improve-codebase-architecture",
	"simplify",
	"unslopify",
	"he-code-review",
	"testing",
] as const;
const requiredReviewers = [
	"adversarial-reviewer",
	"agent-native-reviewer",
	"best-practices-researcher",
] as const;
const sourceReceiptIds: Record<string, string[]> = {
	"PU-001": ["R004"],
	"PU-002": ["R005"],
	"PU-003": ["R007"],
	"PU-004": ["R008"],
	"PU-005": ["R009"],
	"PU-006": ["R011", "R012"],
	"PU-007": ["R013", "R014", "R015"],
	"PU-008": ["R016", "R017", "R018"],
	"PU-009": ["R019", "R020", "R021", "R025"],
	"PU-010": ["R026"],
	"PU-011": ["R027", "R035"],
	"PU-012": ["R038", "R042"],
	"PU-013": ["R043", "R045"],
	"PU-014": ["R046", "R047"],
	"PU-015": ["R048", "R051"],
	"PU-016": ["R053", "R061"],
};

const tempRoots: string[] = [];

function createTempRoot(prefix: string) {
	const root = mkdtempSync(join(tmpdir(), prefix));
	tempRoots.push(root);
	return root;
}

function writeReceiptTrail(root: string) {
	const path = join(root, RECEIPTS_REF);
	mkdirSync(join(path, ".."), { recursive: true });
	const receipts = [
		{ id: "R004", summary: "PU-001 source" },
		{ id: "R064", summary: "review contract accepted exception" },
		{
			id: "R200",
			summary: "current testing evidence",
			slice_skill_lens_results: [
				{
					role: "testing",
					status: "pass",
					freshness: "current",
				},
			],
		},
		...Object.values(sourceReceiptIds)
			.flat()
			.filter((id) => id !== "R004")
			.map((id) => ({ id, summary: `${id} source` })),
	];
	writeFileSync(
		path,
		receipts.map((receipt) => JSON.stringify(receipt)).join("\n"),
	);
}

function notApplicableResult(member: string) {
	return {
		status: "not applicable",
		reason: `${member} predates the R064 full review contract`,
		owner: "goal-coordinator",
		acceptedExceptionRef: `${RECEIPTS_REF}#R064`,
	};
}

function passResult(member: string, evidenceRef: string) {
	return {
		status: "pass",
		role: member,
		producer: member,
		freshness: "current",
		evidenceRef,
	};
}

function failResult(
	member: string,
	acceptedExceptionRef = `${RECEIPTS_REF}#R064`,
) {
	return {
		status: "fail",
		reason: `${member} failed with accepted historical exception`,
		owner: "goal-coordinator",
		acceptedExceptionRef,
	};
}

function requiredSourceReceiptIds(unit: string) {
	const receiptIds = sourceReceiptIds[unit];
	if (!receiptIds) {
		throw new Error(`missing source receipt fixture for ${unit}`);
	}
	return receiptIds;
}

function baseEntry(unit: string) {
	const skillResults: Record<string, unknown> = {};
	const reviewerResults: Record<string, unknown> = {};
	for (const member of requiredSkillLenses) {
		skillResults[member] = notApplicableResult(member);
	}
	for (const member of requiredReviewers) {
		reviewerResults[member] = notApplicableResult(member);
	}
	return {
		lifecycleUnit: unit,
		sourceReceiptRefs: requiredSourceReceiptIds(unit).map(
			(receiptId) => `${RECEIPTS_REF}#${receiptId}`,
		),
		sliceSkillLensResults: skillResults,
		independentReviewerResults: reviewerResults,
	};
}

function baseLedger() {
	return {
		schemaVersion: "goal-review-coverage-backfill/v1",
		goalSlug: "codex-runtime-evidence-verifier-cockpit",
		generatedAt: "2026-05-29T06:20:00Z",
		coverageWindow: {
			lifecycleUnits: ["PU-001", "PU-016"],
			effectiveReviewContractReceiptId: "R064",
			rule: "Pre-R064 receipts require explicit ratification before closeout.",
		},
		requiredSkillLenses,
		requiredIndependentReviewers: requiredReviewers,
		acceptedExceptionRefs: {
			preR064ReviewContract: `${RECEIPTS_REF}#R064`,
		},
		lifecycleUnits: requiredUnits.map(baseEntry),
	};
}

function lifecycleEntry(ledger: ReturnType<typeof baseLedger>, index: number) {
	const entry = ledger.lifecycleUnits[index];
	if (!entry) {
		throw new Error(`missing lifecycle entry at index ${index}`);
	}
	return entry;
}

function writeLedger(root: string, ledger: unknown) {
	const path = join(root, "review-coverage-backfill.json");
	writeFileSync(path, JSON.stringify(ledger, null, 2));
	return path;
}

function runValidator(root: string, ledger: unknown) {
	writeReceiptTrail(root);
	const ledgerPath = writeLedger(root, ledger);
	return spawnSync("python3", [SCRIPT_PATH, ledgerPath, "--repo", root], {
		encoding: "utf8",
		env: {
			...process.env,
			PYTHONDONTWRITEBYTECODE: "1",
		},
	});
}

function appendReceipt(root: string, receipt: unknown) {
	const path = join(root, RECEIPTS_REF);
	writeFileSync(path, `\n${JSON.stringify(receipt)}`, { flag: "a" });
}

describe("check-goal-review-backfill.py", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("passes when PU-001 through PU-016 are explicitly ratified", () => {
		const root = createTempRoot("review-backfill-pass-");
		const result = runValidator(root, baseLedger());

		expect(result.status).toBe(0);
		expect(result.stdout).toContain('"lifecycleUnitCount": 16');
	});

	it("fails when a lifecycle unit is missing", () => {
		const root = createTempRoot("review-backfill-missing-unit-");
		const ledger = baseLedger();
		ledger.lifecycleUnits = ledger.lifecycleUnits.filter(
			(entry) => entry.lifecycleUnit !== "PU-016",
		);

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"lifecycleUnits missing required unit(s): PU-016",
		);
	});

	it("fails when a lifecycle unit is duplicated", () => {
		const root = createTempRoot("review-backfill-duplicate-unit-");
		const ledger = baseLedger();
		ledger.lifecycleUnits.push(baseEntry("PU-016"));

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("duplicate lifecycle unit(s): PU-016");
	});

	it("fails when coverage window bounds drift", () => {
		const root = createTempRoot("review-backfill-coverage-window-");
		const ledger = baseLedger();
		ledger.coverageWindow.lifecycleUnits = ["PU-002", "PU-016"];

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("coverageWindow.lifecycleUnits must equal");
	});

	it("fails when a lifecycle unit points at another unit receipt", () => {
		const root = createTempRoot("review-backfill-wrong-source-");
		const ledger = baseLedger();
		lifecycleEntry(ledger, 1).sourceReceiptRefs = [`${RECEIPTS_REF}#R004`];

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("PU-002.sourceReceiptRefs must equal");
	});

	it("fails when a required member is missing", () => {
		const root = createTempRoot("review-backfill-missing-member-");
		const ledger = baseLedger();
		delete lifecycleEntry(ledger, 0).sliceSkillLensResults.testing;

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"PU-001.sliceSkillLensResults missing required member(s): testing",
		);
	});

	it("fails when a receipt fragment cannot be resolved", () => {
		const root = createTempRoot("review-backfill-missing-fragment-");
		const ledger = baseLedger();
		ledger.acceptedExceptionRefs.preR064ReviewContract = `${RECEIPTS_REF}#R999`;

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("references missing receipt fragment");
	});

	it("fails when a receipt trail duplicates a receipt id", () => {
		const root = createTempRoot("review-backfill-duplicate-receipt-");
		writeReceiptTrail(root);
		appendReceipt(root, { id: "R064", summary: "duplicate exception" });
		const ledgerPath = writeLedger(root, baseLedger());

		const result = spawnSync(
			"python3",
			[SCRIPT_PATH, ledgerPath, "--repo", root],
			{
				encoding: "utf8",
				env: {
					...process.env,
					PYTHONDONTWRITEBYTECODE: "1",
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("duplicates receipt id 'R064'");
	});

	it("passes when pass evidence points at a current member receipt", () => {
		const root = createTempRoot("review-backfill-pass-evidence-");
		const ledger = baseLedger();
		lifecycleEntry(ledger, 0).sliceSkillLensResults.testing = passResult(
			"testing",
			`${RECEIPTS_REF}#R200`,
		);

		const result = runValidator(root, ledger);

		expect(result.status).toBe(0);
	});

	it("fails when pass evidence is not receipt-backed", () => {
		const root = createTempRoot("review-backfill-missing-pass-evidence-");
		const ledger = baseLedger();
		lifecycleEntry(ledger, 0).sliceSkillLensResults.testing = passResult(
			"testing",
			"artifacts/reviews/missing.md",
		);

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("evidenceRef must be a receipt fragment");
	});

	it("fails when pass evidence is not current", () => {
		const root = createTempRoot("review-backfill-stale-pass-");
		const evidencePath = join(root, "artifacts/reviews/testing.md");
		mkdirSync(join(evidencePath, ".."), { recursive: true });
		writeFileSync(evidencePath, "evidence");
		const ledger = baseLedger();
		lifecycleEntry(ledger, 0).sliceSkillLensResults.testing = {
			...passResult("testing", "artifacts/reviews/testing.md"),
			freshness: "stale",
		};

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("freshness must be current");
	});

	it("fails when pass evidence receipt lacks the member result", () => {
		const root = createTempRoot("review-backfill-pass-wrong-member-");
		const ledger = baseLedger();
		lifecycleEntry(ledger, 0).sliceSkillLensResults["he-code-review"] =
			passResult("he-code-review", `${RECEIPTS_REF}#R200`);

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"receipt does not contain member result for 'he-code-review'",
		);
	});

	it("passes when fail status carries owner and accepted exception", () => {
		const root = createTempRoot("review-backfill-fail-accepted-");
		const ledger = baseLedger();
		lifecycleEntry(ledger, 0).sliceSkillLensResults.testing =
			failResult("testing");

		const result = runValidator(root, ledger);

		expect(result.status).toBe(0);
	});

	it("fails when fail status lacks an accepted exception", () => {
		const root = createTempRoot("review-backfill-fail-missing-exception-");
		const ledger = baseLedger();
		lifecycleEntry(ledger, 0).sliceSkillLensResults.testing = {
			status: "fail",
			reason: "failed without accepted exception",
			owner: "goal-coordinator",
		};

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"acceptedExceptionRef must be a non-empty string",
		);
	});

	it("fails when a non-pass accepted exception is not receipt-backed", () => {
		const root = createTempRoot("review-backfill-nonpass-file-exception-");
		const exceptionPath = join(root, "artifacts/reviews/exception.md");
		mkdirSync(join(exceptionPath, ".."), { recursive: true });
		writeFileSync(exceptionPath, "manual exception without receipt lineage");
		const ledger = baseLedger();
		lifecycleEntry(ledger, 0).independentReviewerResults[
			"adversarial-reviewer"
		] = {
			status: "not applicable",
			reason: "manual exception must not bypass receipt lineage",
			acceptedExceptionRef: "artifacts/reviews/exception.md",
		};

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"acceptedExceptionRef must be a receipt fragment",
		);
	});

	it("fails when a non-pass member has owner but no accepted exception", () => {
		const root = createTempRoot("review-backfill-nonpass-owner-only-");
		const ledger = baseLedger();
		lifecycleEntry(ledger, 0).sliceSkillLensResults.simplify = {
			status: "not applicable",
			reason: "owner-only assertions are not receipt-backed exceptions",
			owner: "goal-coordinator",
		};

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"acceptedExceptionRef must be a non-empty string",
		);
	});

	it("fails when non-pass members have neither owner nor accepted exception", () => {
		const root = createTempRoot("review-backfill-nonpass-unsupported-");
		const ledger = baseLedger();
		lifecycleEntry(ledger, 0).independentReviewerResults[
			"agent-native-reviewer"
		] = {
			status: "not applicable",
			reason: "not available",
		};

		const result = runValidator(root, ledger);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"acceptedExceptionRef must be a non-empty string",
		);
	});
});
