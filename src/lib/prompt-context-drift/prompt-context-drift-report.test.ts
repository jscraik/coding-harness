import { createHash } from "node:crypto";
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
	PromptContextDriftRef,
	PromptContextDriftReport,
	PromptContextDriftSurface,
} from "./prompt-context-drift-report.js";
import { buildPromptContextDriftReport } from "./prompt-context-drift-builder.js";
import { validatePromptContextDriftReport } from "./prompt-context-drift-report.js";

// Expected enum values (independent oracle, not derived from source constants)
const EXPECTED_EVIDENCE_USES = ["orientation", "audit_trail", "claim_support"];
const EXPECTED_OVERALL_STATUSES = ["pass", "warn", "fail", "blocked"];
const EXPECTED_STATUSES = ["pass", "warn", "fail", "blocked"];
const EXPECTED_SURFACES = [
	"prompt_context",
	"active_artifacts",
	"active_route",
	"project_brain_memory",
	"project_brain_knowledge",
	"runtime_card_or_handoff",
	"receipt_head_sha",
];
const EXPECTED_FRESHNESS = [
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
];
const EXPECTED_REF_KINDS = [
	"repo_file",
	"prompt_context_receipt",
	"runtime_card",
	"receipt",
	"external_metadata",
];
const EXPECTED_BLOCKER_CLASSES = [
	"none",
	"stale_prompt_context",
	"stale_active_route",
	"missing_project_brain_ref",
	"stale_project_brain_ref",
	"stale_runtime_card",
	"advisory_runtime_card",
	"head_sha_mismatch",
	"missing_source_hash",
	"digest_mismatch",
	"external_only_required_surface",
	"unsafe_ref",
	"raw_or_secret_content",
	"unknown_schema_field",
];
const EXPECTED_NEXT_ACTION_CLASSES = [
	"none",
	"refresh_prompt_context",
	"refresh_active_artifacts",
	"refresh_project_brain",
	"refresh_runtime_card",
	"refresh_receipts",
	"rerun_validator",
];

type JsonSchemaObject = {
	properties: Record<string, { enum?: unknown[] }>;
	$defs: Record<string, { enum?: unknown[] }>;
};

function exampleReport(): PromptContextDriftReport {
	return JSON.parse(
		readFileSync(
			"contracts/examples/prompt-context-drift-report.example.json",
			"utf8",
		),
	) as PromptContextDriftReport;
}

function surfaceAt(
	report: PromptContextDriftReport,
	index: number,
): PromptContextDriftSurface {
	const surface = report.surfaces[index];
	if (!surface) {
		throw new Error(`Missing prompt-context drift surface at index ${index}`);
	}
	return surface;
}

function sourceRefAt(
	report: PromptContextDriftReport,
	surfaceIndex: number,
	refIndex: number,
): PromptContextDriftRef {
	const sourceRef = surfaceAt(report, surfaceIndex).sourceRefs[refIndex];
	if (!sourceRef) {
		throw new Error(
			"Missing prompt-context drift source ref at surface " +
				surfaceIndex +
				", index " +
				refIndex,
		);
	}
	return sourceRef;
}

function digest(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function tempRoot(): string {
	return mkdtempSync(join(tmpdir(), "prompt-context-drift-"));
}

function schemaEnum(
	container: Record<string, { enum?: unknown[] }>,
	key: string,
): unknown[] {
	const enumValues = container[key]?.enum;
	if (!enumValues) {
		throw new Error(`Missing schema enum for ${key}`);
	}
	return enumValues;
}

describe("validatePromptContextDriftReport", () => {
	it("keeps schema enum vocabulary aligned with runtime validation", () => {
		const schema = JSON.parse(
			readFileSync("contracts/prompt-context-drift-report.schema.json", "utf8"),
		) as JsonSchemaObject;

		expect(schemaEnum(schema.properties, "evidenceUse")).toEqual(
			EXPECTED_EVIDENCE_USES,
		);
		expect(schemaEnum(schema.properties, "overallStatus")).toEqual(
			EXPECTED_OVERALL_STATUSES,
		);
		expect(schemaEnum(schema.$defs, "surfaceId")).toEqual(EXPECTED_SURFACES);
		expect(schemaEnum(schema.$defs, "status")).toEqual(EXPECTED_STATUSES);
		expect(schemaEnum(schema.$defs, "evidenceUse")).toEqual(
			EXPECTED_EVIDENCE_USES,
		);
		expect(schemaEnum(schema.$defs, "freshness")).toEqual(EXPECTED_FRESHNESS);
		expect(schemaEnum(schema.$defs, "refKind")).toEqual(EXPECTED_REF_KINDS);
		expect(schemaEnum(schema.$defs, "blockerClass")).toEqual(
			EXPECTED_BLOCKER_CLASSES,
		);
		expect(schemaEnum(schema.$defs, "nextActionClass")).toEqual(
			EXPECTED_NEXT_ACTION_CLASSES,
		);
	});

	it("accepts the content-bound checked-in example", () => {
		expect(
			validatePromptContextDriftReport(exampleReport(), { repoRoot: "." }),
		).toEqual({ status: "pass", errors: [] });
	});

	it("builds a valid warning report when orientation files are missing", () => {
		const repoRoot = tempRoot();
		const previousCwd = process.cwd();
		try {
			writeFileSync(join(repoRoot, "AGENTS.md"), "# Agents\n");
			process.chdir(repoRoot);
			const report = buildPromptContextDriftReport({
				repoRoot: ".",
				generatedAt: new Date("2026-06-20T00:00:00.000Z"),
			});

			expect(report).toMatchObject({
				schemaVersion: "prompt-context-drift-report/v1",
				evidenceUse: "orientation",
				overallStatus: "warn",
			});
			expect(report.blockers.length).toBeGreaterThan(0);
			expect(validatePromptContextDriftReport(report, { repoRoot })).toEqual({
				status: "pass",
				errors: [],
			});
		} finally {
			process.chdir(previousCwd);
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("blocks stale prompt context from claim support", () => {
		const report = exampleReport();
		report.surfaces[0] = {
			...surfaceAt(report, 0),
			status: "blocked",
			freshness: "stale",
			blockers: [
				{
					blockerClass: "stale_prompt_context",
					reason: "prompt-context-receipt is stale",
					nextActionClass: "refresh_prompt_context",
				},
			],
		};

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("claim support requires pass"),
				expect.stringContaining("claim support requires current"),
			]),
		);
	});

	it("blocks stale active route from claim support", () => {
		const report = exampleReport();
		report.surfaces[2] = {
			...surfaceAt(report, 2),
			status: "blocked",
			freshness: "stale",
		};

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("surfaces[2].status"),
				expect.stringContaining("surfaces[2].freshness"),
			]),
		);
	});

	it("blocks stale Project Brain refs from claim support", () => {
		const report = exampleReport();
		report.surfaces[3] = {
			...surfaceAt(report, 3),
			status: "blocked",
			freshness: "stale",
			blockers: [
				{
					blockerClass: "stale_project_brain_ref",
					reason: "memory ref is stale",
					nextActionClass: "refresh_project_brain",
				},
			],
		};

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("surfaces[3].status"),
				expect.stringContaining("surfaces[3].blockers"),
			]),
		);
	});

	it("blocks stale advisory runtime-card refs from claim support", () => {
		const report = exampleReport();
		report.surfaces[5] = {
			...surfaceAt(report, 5),
			status: "warn",
			freshness: "current",
			blockers: [
				{
					blockerClass: "advisory_runtime_card",
					reason: "runtime card is advisory-only",
					nextActionClass: "refresh_runtime_card",
				},
			],
		};

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("surfaces[5].status"),
				expect.stringContaining("surfaces[5].blockers"),
			]),
		);
	});

	it("blocks mismatched head SHA", () => {
		const report = exampleReport();
		report.surfaces[6] = {
			...surfaceAt(report, 6),
			observedHeadSha: "2222222222222222222222222222222222222222",
		};

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toContain(
			"surfaces[6].observedHeadSha: must match currentHeadSha",
		);
	});

	it("allows non-claim-support reports to classify stale head mismatches", () => {
		const report = exampleReport();
		report.evidenceUse = "orientation";
		report.overallStatus = "blocked";
		report.blockers = [
			{
				blockerClass: "head_sha_mismatch",
				reason: "receipt head differs from current head",
				nextActionClass: "refresh_receipts",
			},
		];
		report.surfaces = report.surfaces.map((surface, index) => ({
			...surface,
			status: index === 6 ? "blocked" : "warn",
			evidenceUse: "orientation",
			freshness: index === 6 ? "stale" : "current",
			requiredForClaimSupport: false,
			sourceRefs: surface.sourceRefs.map((sourceRef) => ({
				...sourceRef,
				evidenceUse: "orientation",
				requiredForClaimSupport: false,
			})),
		}));
		report.surfaces[6] = {
			...surfaceAt(report, 6),
			observedHeadSha: "2222222222222222222222222222222222222222",
			blockers: [
				{
					blockerClass: "head_sha_mismatch",
					reason: "receipt head differs from current head",
					nextActionClass: "refresh_receipts",
				},
			],
		};

		expect(validatePromptContextDriftReport(report, { repoRoot: "." })).toEqual(
			{
				status: "pass",
				errors: [],
			},
		);
	});

	it("blocks missing source hash", () => {
		const report = exampleReport();
		surfaceAt(report, 0).sourceRefs[0] = {
			...sourceRefAt(report, 0, 0),
			hashAlgorithm: null,
			sha256: null,
		};

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("claim support requires sha256"),
				expect.stringContaining("claim support requires sha256 digest"),
			]),
		);
	});

	it("blocks digest mismatch", () => {
		const report = exampleReport();
		surfaceAt(report, 0).sourceRefs[0] = {
			...sourceRefAt(report, 0, 0),
			sha256: "0".repeat(64),
		};

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toContain(
			"surfaces[0].sourceRefs[0].sha256: digest mismatch",
		);
	});

	it("rejects duplicate prompt-context drift surfaces", () => {
		const report = exampleReport();
		report.surfaces = [...report.surfaces, { ...surfaceAt(report, 0) }];

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toContain(
			"surfaces[7].surfaceId: duplicate surface prompt_context",
		);
	});

	it("accepts root-level repo files as claim-support evidence", () => {
		const report = exampleReport();
		surfaceAt(report, 0).sourceRefs[0] = {
			...sourceRefAt(report, 0, 0),
			ref: "AGENTS.md",
			sha256: digest(readFileSync("AGENTS.md", "utf8")),
		};

		expect(validatePromptContextDriftReport(report, { repoRoot: "." })).toEqual(
			{
				status: "pass",
				errors: [],
			},
		);
	});

	it("rejects repo directories as required repo-file evidence", () => {
		const report = exampleReport();
		surfaceAt(report, 0).sourceRefs[0] = {
			...sourceRefAt(report, 0, 0),
			ref: ".",
			sha256: digest(""),
		};

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toContain(
			"surfaces[0].sourceRefs[0].ref: required repo file is not a file",
		);
	});

	it("returns validation errors for inaccessible evidence roots", () => {
		const root = tempRoot();
		rmSync(root, { recursive: true, force: true });
		const result = validatePromptContextDriftReport(exampleReport(), {
			repoRoot: root,
		});

		expect(result.status).toBe("fail");
		expect(result.errors).toContain(
			"surfaces[0].sourceRefs[0].ref: repository root is not accessible",
		);
	});

	it("blocks external-only required local surfaces", () => {
		const report = exampleReport();
		surfaceAt(report, 4).sourceRefs = [
			{
				...sourceRefAt(report, 4, 0),
				refKind: "external_metadata",
				requiresFilesystemExistence: false,
			},
		];

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"claim support requires at least one repo-contained hash-verified ref",
				),
			]),
		);
	});

	it("blocks claim-support reports that mark required surfaces as advisory", () => {
		const report = exampleReport();
		surfaceAt(report, 0).requiredForClaimSupport = false;
		surfaceAt(report, 0).sourceRefs[0] = {
			...sourceRefAt(report, 0, 0),
			requiredForClaimSupport: false,
		};

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toEqual(
			expect.arrayContaining([
				"surfaces: required local surface prompt_context must set requiredForClaimSupport true",
				expect.stringContaining(
					"requires at least one repo-file claim-support ref",
				),
			]),
		);
	});

	it("blocks symlink escapes before digest validation", () => {
		const root = tempRoot();
		const outside = tempRoot();
		try {
			writeFileSync(join(outside, "outside.md"), "outside", "utf8");
			symlinkSync(outside, join(root, "escape"));
			const report = exampleReport();
			surfaceAt(report, 0).sourceRefs[0] = {
				...sourceRefAt(report, 0, 0),
				ref: "escape/outside.md",
				sha256: digest("outside"),
			};

			const result = validatePromptContextDriftReport(report, {
				repoRoot: root,
			});

			expect(result.status).toBe("fail");
			expect(result.errors).toContain(
				"surfaces[0].sourceRefs[0].ref: resolved path escapes repository root",
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
			rmSync(outside, { recursive: true, force: true });
		}
	});

	it("rejects raw content, secret-like values, and unknown enum values", () => {
		const report = {
			...exampleReport(),
			overallStatus: "ready",
			rawTranscript: "raw transcript",
			nextAction: "token=sk-1234567890abcdef1234567890abcdef",
		};

		const result = validatePromptContextDriftReport(report, { repoRoot: "." });

		expect(result.status).toBe("fail");
		expect(result.errors).toEqual(
			expect.arrayContaining([
				"report.rawTranscript: raw or secret-like field is forbidden",
				"report.nextAction: contains raw or secret-like content",
				"report.rawTranscript: unknown field",
				"overallStatus: invalid enum value",
			]),
		);
	});

	it("accepts stale orientation-only evidence as non-claim-support routing", () => {
		const report = exampleReport();
		report.evidenceUse = "orientation";
		report.overallStatus = "blocked";
		report.blockers = [
			{
				blockerClass: "stale_prompt_context",
				reason: "prompt context needs refresh",
				nextActionClass: "refresh_prompt_context",
			},
		];
		report.surfaces = report.surfaces.map((surface, index) => ({
			...surface,
			status: index === 0 ? "blocked" : "warn",
			evidenceUse: "orientation",
			freshness: index === 0 ? "stale" : "current",
			requiredForClaimSupport: false,
			sourceRefs: surface.sourceRefs.map((sourceRef) => ({
				...sourceRef,
				evidenceUse: "orientation",
				requiredForClaimSupport: false,
			})),
		}));

		expect(
			validatePromptContextDriftReport(report, { repoRoot: "." }).status,
		).toBe("pass");
	});
});
