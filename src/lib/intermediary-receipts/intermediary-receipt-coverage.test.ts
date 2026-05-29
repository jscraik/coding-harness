import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	INTERMEDIARY_CLAIM_FAMILIES,
	INTERMEDIARY_SOURCE_KINDS,
	validateIntermediaryReceiptCoverage,
} from "./index.js";
import type { IntermediaryReceiptCoverage } from "./types.js";

const SCRIPT_PATH = join(
	process.cwd(),
	"scripts/validate-intermediary-receipt-coverage.cjs",
);
const tempRoots: string[] = [];

function createTempRoot(prefix: string) {
	const baseRoot = join(
		process.cwd(),
		".cache",
		"intermediary-receipt-coverage-tests",
	);
	mkdirSync(baseRoot, { recursive: true });
	const root = mkdtempSync(join(baseRoot, prefix));
	tempRoots.push(root);
	return root;
}

function basePacket(): IntermediaryReceiptCoverage {
	return JSON.parse(
		readFileSync(
			"contracts/examples/intermediary-receipt-coverage.example.json",
			"utf8",
		),
	) as IntermediaryReceiptCoverage;
}

function expectInvalid(packet: IntermediaryReceiptCoverage, code: string) {
	const result = validateIntermediaryReceiptCoverage(packet);
	expect(result.valid).toBe(false);
	expect(result.errors).toEqual(
		expect.arrayContaining([expect.objectContaining({ code })]),
	);
}

describe("IntermediaryReceiptCoverage/v1", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("accepts the checked-in fixture and covers every intermediary source kind", () => {
		const packet = basePacket();

		expect(validateIntermediaryReceiptCoverage(packet)).toEqual({
			valid: true,
			errors: [],
		});
		expect(new Set(packet.sources.map((source) => source.sourceKind))).toEqual(
			new Set(INTERMEDIARY_SOURCE_KINDS),
		);
		expect(
			new Set(
				packet.claimFamilySummaries.map((summary) => summary.claimFamily),
			),
		).toEqual(new Set(INTERMEDIARY_CLAIM_FAMILIES));
	});

	it("fails closed when the source-kind by claim-family policy matrix has a gap", () => {
		const packet = basePacket();
		packet.claimPolicies = packet.claimPolicies.slice(1);

		expectInvalid(packet, "missing_policy_entry");
	});

	it("rejects claim support denied by the policy matrix", () => {
		const packet = basePacket();
		const source = packet.sources.find(
			(entry) => entry.sourceId === "browser-state",
		);
		expect(source).toBeDefined();
		source!.evidenceUse = "claim_support";
		source!.claimFamilies = ["closeout_ready"];
		source!.sourceHashSha256 = "c".repeat(64);
		source!.receiptRef = "receipt:external-state-current";

		expectInvalid(packet, "policy_matrix_denied");
	});

	it("requires canonical packet routing for protected claim families", () => {
		const packet = basePacket();
		const source = packet.sources.find(
			(entry) => entry.sourceId === "external-check-snapshot",
		);
		expect(source).toBeDefined();
		source!.canonicalPacketRef = null;

		expectInvalid(packet, "canonical_packet_required");
	});

	it("requires current claim-support receipts with matching head SHA", () => {
		const packet = basePacket();
		packet.receipts[0]!.freshness = "stale";

		expectInvalid(packet, "stale_receipt");
	});

	it("requires claim-support sources to have pass status", () => {
		const packet = basePacket();
		const source = packet.sources.find(
			(entry) => entry.sourceId === "external-check-snapshot",
		);
		expect(source).toBeDefined();
		source!.status = "warn";

		expectInvalid(packet, "invalid_source_status");
	});

	it("rejects impossible RFC3339-style timestamps", () => {
		const packet = basePacket();
		packet.generatedAt = "2026-02-31T10:15:00Z";

		expectInvalid(packet, "invalid_timestamp");
	});

	it("keeps unbound orientation sources ineligible for claim support", () => {
		const packet = basePacket();
		const summary = packet.claimFamilySummaries.find(
			(entry) => entry.claimFamily === "closeout_ready",
		);
		expect(summary).toBeDefined();
		summary!.claimSupportEligible = true;
		summary!.evidenceUse = "claim_support";

		expectInvalid(packet, "unsupported_claim_support");
	});

	it("rejects protected claim support from non-claim-support sources", () => {
		const packet = basePacket();
		const source = packet.sources.find(
			(entry) => entry.sourceId === "external-check-snapshot",
		);
		expect(source).toBeDefined();
		source!.evidenceUse = "audit_trail";

		expectInvalid(packet, "unsupported_claim_support");
	});

	it("requires protected claim-support summaries to use policy-declared canonical routes", () => {
		const packet = basePacket();
		const policy = packet.claimPolicies.find(
			(entry) =>
				entry.sourceKind === "external_check_snapshot" &&
				entry.claimFamily === "external_state",
		);
		expect(policy).toBeDefined();
		policy!.requiredCanonicalPacketSchemas = [];

		const result = validateIntermediaryReceiptCoverage(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "canonical_packet_required" }),
				expect.objectContaining({ code: "unsupported_claim_support" }),
			]),
		);
	});

	it("uses most-restrictive-wins aggregation for mixed-source summaries", () => {
		const packet = basePacket();
		const browser = packet.sources.find(
			(entry) => entry.sourceId === "browser-state",
		);
		expect(browser).toBeDefined();
		browser!.status = "blocked";
		browser!.blockers = [
			{
				blockerClass: "missing_receipt",
				reason: "fixture-mixed-source-blocker",
				nextActionClass: "refresh_receipt",
			},
		];
		const summary = packet.claimFamilySummaries.find(
			(entry) => entry.claimFamily === "orientation",
		);
		expect(summary).toBeDefined();
		summary!.status = "pass";

		expectInvalid(packet, "mixed_source_conflict");
	});

	it("rejects blocker next-action drift", () => {
		const packet = basePacket();
		packet.blockers = [
			{
				blockerClass: "head_sha_mismatch",
				reason: "fixture-mismatch",
				nextActionClass: "refresh_receipt",
			},
		];
		packet.overallStatus = "blocked";

		expectInvalid(packet, "invalid_next_action_class");
	});

	it("rejects raw payload or secret-like intermediary content", () => {
		const packet = basePacket() as unknown as Record<string, unknown>;
		packet.rawTranscript = "full transcript";

		const result = validateIntermediaryReceiptCoverage(packet);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "raw_or_secret_content" }),
			]),
		);
	});

	it("standalone validator matches the TypeScript validator", () => {
		const root = createTempRoot("packet-");
		const packetPath = join(root, "packet.json");
		writeFileSync(packetPath, JSON.stringify(basePacket(), null, 2));

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, packetPath, "--repo-root", process.cwd()],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"intermediary-receipt-coverage-validation/v1",
		);
	});

	it("standalone validator resolves packet paths relative to repo root", () => {
		const root = createTempRoot("alternate-cwd-");

		const result = spawnSync(
			process.execPath,
			[
				SCRIPT_PATH,
				"contracts/examples/intermediary-receipt-coverage.example.json",
				"--repo-root",
				process.cwd(),
			],
			{ cwd: root, encoding: "utf8" },
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"intermediary-receipt-coverage-validation/v1",
		);
	});

	it("standalone validator returns structured JSON when runner startup fails", () => {
		const root = createTempRoot("broken-runner-");
		writeFileSync(
			join(root, "packet.json"),
			JSON.stringify(basePacket(), null, 2),
		);

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, "packet.json", "--repo-root", root],
			{ cwd: root, encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors.join("\n")).toContain("runner:");
	});
});
