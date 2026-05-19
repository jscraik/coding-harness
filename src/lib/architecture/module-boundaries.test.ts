import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMMAND_SURFACE_DECOMPOSITION_RATCHETS = [
	{
		path: "src/commands/ci-migrate.ts",
		maxLines: 10_400,
		reason: "CI migration must move toward a control-plane service seam.",
	},
	{
		path: "src/commands/drift-gate.ts",
		maxLines: 1_000,
		reason:
			"Drift gate must move toward evaluator, artifact, and runner seams before it absorbs more policy.",
	},
	{
		path: "src/lib/output/normalise.ts",
		maxLines: 10,
		reason:
			"Output normalisation facade must stay a public export surface, not an implementation sink.",
	},
] as const;

const OUTPUT_NORMALISE_SURFACE_RATCHETS = [
	{
		path: "src/lib/output/normalise-core-v2.ts",
		maxLines: 30,
		reason:
			"Output normalise core must stay a compatibility export surface; gate-specific behavior lives behind focused modules.",
	},
	{
		path: "src/lib/output/normalise-drift-gate.ts",
		maxLines: 100,
		reason:
			"Drift gate normalisation must stay focused on drift findings, artifact evidence, and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-docs-gate.ts",
		maxLines: 80,
		reason:
			"Docs gate normalisation must stay focused on docs findings, metadata, and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-he-phase-exit.ts",
		maxLines: 230,
		reason:
			"HE phase-exit normalisation must stay focused on phase-exit findings, evidence references, and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-linear-gate.ts",
		maxLines: 240,
		reason:
			"Linear gate normalisation must stay focused on Linear gate failure classification and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-renderer.ts",
		maxLines: 70,
		reason:
			"Output rendering must stay focused on terminal presentation for normalized gate results.",
	},
	{
		path: "src/lib/output/normalise-policy-gate.ts",
		maxLines: 130,
		reason:
			"Policy gate normalisation must stay focused on policy tier findings, decision metadata, and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-pr-template-gate.ts",
		maxLines: 100,
		reason:
			"PR template gate normalisation must stay focused on template validation findings and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-plan-gate.ts",
		maxLines: 80,
		reason:
			"Plan gate normalisation must stay focused on plan validation findings, recovery hints, and GateResult projection.",
	},
] as const;

const CLI_REGISTRY_SURFACE_RATCHETS = [
	{
		path: "src/lib/cli/registry/command-specs-core.ts",
		maxLines: 1_794,
		reason:
			"Command specs core must stay a manifest assembler; workflow-specific parsing must move behind focused command spec seams.",
	},
	{
		path: "src/lib/cli/registry/license-gate-command-spec.ts",
		maxLines: 35,
		reason:
			"License gate command spec must stay focused on license option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/local-memory-preflight-command-spec.ts",
		maxLines: 60,
		reason:
			"Local memory preflight command spec must stay focused on local-memory option projection and usage-error handling.",
	},
	{
		path: "src/lib/cli/registry/check-environment-command-spec.ts",
		maxLines: 40,
		reason:
			"Check environment command spec must stay focused on environment option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/check-authz-command-spec.ts",
		maxLines: 35,
		reason:
			"Check authz command spec must stay focused on authorization option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/branch-protect-command-spec.ts",
		maxLines: 70,
		reason:
			"Branch protect command spec must stay focused on branch protection option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/preflight-gate-command-spec.ts",
		maxLines: 100,
		reason:
			"Preflight gate command spec must stay focused on preflight option projection, admission parsing, and command delegation.",
	},
	{
		path: "src/lib/cli/registry/review-gate-command-spec.ts",
		maxLines: 220,
		reason:
			"Review gate command spec must stay focused on review-gate option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/evidence-verify-command-spec.ts",
		maxLines: 45,
		reason:
			"Evidence verify command spec must stay focused on evidence file option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/linear-gate-command-spec.ts",
		maxLines: 70,
		reason:
			"Linear gate command spec must stay focused on Linear gate option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/linear-command-spec.ts",
		maxLines: 30,
		reason:
			"Linear command spec must stay a small public registry seam; parsing and delegation live behind the runner seam.",
	},
	{
		path: "src/lib/cli/registry/linear-command-runner.ts",
		maxLines: 230,
		reason:
			"Linear command runner must stay focused on Linear workflow action parsing and command delegation.",
	},
	{
		path: "src/lib/cli/registry/linear-command-options.ts",
		maxLines: 160,
		reason:
			"Linear command options must stay focused on action and flag projection for the Linear registry seam.",
	},
	{
		path: "src/lib/cli/registry/pr-template-gate-command-spec.ts",
		maxLines: 50,
		reason:
			"PR template gate command spec must stay focused on PR template gate option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/rule-lifecycle-gate-command-spec.ts",
		maxLines: 70,
		reason:
			"Rule lifecycle gate command spec must stay focused on rule lifecycle option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/policy-gate-command-spec.ts",
		maxLines: 90,
		reason:
			"Policy gate command spec must stay focused on policy gate option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/command-capabilities.ts",
		maxLines: 360,
		reason:
			"Command capabilities must stay the public catalog builder; catalog policy tables stay behind command-capability-rules.ts.",
	},
	{
		path: "src/lib/cli/registry/command-capability-rules.ts",
		maxLines: 340,
		reason:
			"Command capability rules must stay focused on static catalog classification tables.",
	},
] as const;

const PR_CLOSEOUT_SURFACE_RATCHETS = [
	{
		path: "src/lib/pr-closeout/evaluator.ts",
		maxLines: 170,
		reason:
			"PR closeout evaluator must stay focused on report assembly; recovery metadata stays behind the recovery seam.",
	},
	{
		path: "src/lib/pr-closeout/recovery.ts",
		maxLines: 170,
		reason:
			"PR closeout recovery seam must stay focused on attempt-ledger and recovery-event construction.",
	},
] as const;

const REVIEW_GATE_DECISION_PACKET_RATCHETS = [
	{
		path: "src/lib/review-gate/decision-packet.ts",
		maxLines: 390,
		reason:
			"Review-gate decision packet must stay an artifact assembly seam; recovery and run-record metadata stay behind focused modules.",
	},
	{
		path: "src/lib/review-gate/recovery.ts",
		maxLines: 170,
		reason:
			"Review-gate recovery seam must stay focused on attempt-ledger and recovery-event construction.",
	},
	{
		path: "src/lib/review-gate/run-record.ts",
		maxLines: 180,
		reason:
			"Review-gate run-record seam must stay focused on terminal run-record emission and classification.",
	},
	{
		path: "src/lib/review-gate/decision-packet-types.ts",
		maxLines: 50,
		reason:
			"Review-gate shared decision-packet types must stay small enough to remain an internal import seam.",
	},
] as const;

const NEXT_SURFACE_RATCHETS = [
	{
		path: "src/commands/next.ts",
		maxLines: 160,
		reason:
			"Harness next must stay a decision producer; keep CLI parsing behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/next-args.ts",
		maxLines: 265,
		reason:
			"Harness next argument parsing must stay focused on CLI token parsing, public parser docs, and usage-error shape.",
	},
	{
		path: "src/commands/next-usage-errors.ts",
		maxLines: 160,
		reason:
			"Harness next usage-error decisions must stay focused on translating parser errors into blocked decisions.",
	},
	{
		path: "src/commands/next-runner.ts",
		maxLines: 250,
		reason:
			"Harness next runner must stay focused on decision production; CLI artifact loading and output stay in the command facade.",
	},
	{
		path: "src/commands/next-decisions.ts",
		maxLines: 80,
		reason:
			"Harness next decisions must stay a public decision seam; blocked, metadata, and recommendation internals stay behind focused modules.",
	},
	{
		path: "src/commands/next-blocked-decisions.ts",
		maxLines: 300,
		reason:
			"Harness next blocked decisions must stay focused on source, git, phase-exit, and runtime-card blockers.",
	},
	{
		path: "src/commands/next-decision-meta.ts",
		maxLines: 120,
		reason:
			"Harness next decision metadata must stay focused on normalized operational evidence.",
	},
	{
		path: "src/commands/next-decision-types.ts",
		maxLines: 40,
		reason:
			"Harness next shared types must stay small enough to remain a stable import seam.",
	},
	{
		path: "src/commands/next-recommendation-decisions.ts",
		maxLines: 260,
		reason:
			"Harness next recommendation decisions must stay focused on changed-file and fleet-matrix recommendations.",
	},
] as const;

const RUNTIME_CARD_SURFACE_RATCHETS = [
	{
		path: "src/commands/runtime-card.ts",
		maxLines: 300,
		reason:
			"Runtime-card command must stay focused on artifact safety, card building, and output rendering; keep CLI parsing behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/runtime-card-args.ts",
		maxLines: 170,
		reason:
			"Runtime-card argument parsing must stay focused on CLI token parsing and runtime-card option shape.",
	},
] as const;

const REPLAY_SURFACE_RATCHETS = [
	{
		path: "src/commands/replay.ts",
		maxLines: 330,
		reason:
			"Replay command must stay a command facade; run-record and recovery metadata stay behind the replay run-record seam.",
	},
	{
		path: "src/commands/replay-run-record.ts",
		maxLines: 235,
		reason:
			"Replay run-record seam must stay focused on canonical run-record emission, public run-record docs, attempt ledger, and recovery event metadata.",
	},
] as const;

const REMEDIATE_SURFACE_RATCHETS = [
	{
		path: "src/commands/remediate.ts",
		maxLines: 360,
		reason:
			"Remediate command must stay a command facade; finding normalization and run-record emission stay behind focused seams.",
	},
	{
		path: "src/commands/remediate-findings.ts",
		maxLines: 210,
		reason:
			"Remediate finding normalization must stay focused on provider detection, JSON parsing, and canonical finding conversion.",
	},
	{
		path: "src/commands/remediate-run-record.ts",
		maxLines: 230,
		reason:
			"Remediate run-record seam must stay focused on canonical terminal run-record emission and classification.",
	},
] as const;

const RUNTIME_CARD_RUNTIME_RATCHETS = [
	{
		path: "src/lib/runtime/runtime-card.ts",
		maxLines: 260,
		reason:
			"Runtime-card contract must stay focused on public types, schema version, blocker predicate, and metadata normalization.",
	},
	{
		path: "src/lib/runtime/runtime-card-validation.ts",
		maxLines: 300,
		reason:
			"Runtime-card validation must stay focused on shape validation orchestration; recovery metadata checks stay behind their own seam.",
	},
	{
		path: "src/lib/runtime/runtime-card-recovery-validation.ts",
		maxLines: 220,
		reason:
			"Runtime-card recovery validation must stay focused on attempt ledger and recovery event checks.",
	},
] as const;

const LOCAL_RUNTIME_CARD_SURFACE_RATCHETS = [
	{
		path: "src/lib/runtime/local-runtime-card.ts",
		maxLines: 180,
		reason:
			"Local runtime-card builder must stay focused on local evidence collection; assembly, live providers, artifact seams, and phase-exit seams should not grow back into the facade.",
	},
	{
		path: "src/lib/runtime/local-runtime-card-assembly.ts",
		maxLines: 175,
		reason:
			"Runtime-card assembly must stay focused on lifecycle, blocker/source merging, fallback tracker state, and schema validation.",
	},
	{
		path: "src/lib/runtime/local-runtime-card-attempts.ts",
		maxLines: 120,
		reason:
			"Runtime-card attempt metadata must stay focused on retry ownership, recovery event shape, and evidence references.",
	},
	{
		path: "src/lib/runtime/local-runtime-card-artifacts.ts",
		maxLines: 160,
		reason:
			"Runtime-card artifact inspection must stay focused on active-artifact index parsing and stale reference classification.",
	},
	{
		path: "src/lib/runtime/local-runtime-card-phase-exit.ts",
		maxLines: 150,
		reason:
			"Runtime-card phase-exit seam must stay focused on HePhaseExit/v1 reading, validation, and status collapse.",
	},
	{
		path: "src/lib/runtime/local-runtime-card-live.ts",
		maxLines: 270,
		reason:
			"Runtime-card live provider seam must stay focused on bounded GitHub and Linear refresh behavior.",
	},
] as const;

const DOCTOR_SURFACE_RATCHETS = [
	{
		path: "src/commands/doctor.ts",
		maxLines: 210,
		reason:
			"Doctor runner must stay thin; keep rendering, prerequisite checks, and artifacts behind focused command seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-renderer.ts",
		maxLines: 90,
		reason:
			"Doctor renderer must stay presentation-only; keep checks and report construction in doctor modules.",
	},
	{
		path: "src/commands/doctor-checks.ts",
		maxLines: 40,
		reason:
			"Doctor check catalogue must stay a thin composition module after check families have been split.",
	},
	{
		path: "src/commands/doctor-check-utils.ts",
		maxLines: 80,
		reason:
			"Doctor check utilities must stay generic; move surface-specific behavior into check-family modules.",
	},
	{
		path: "src/commands/doctor-tool-checks.ts",
		maxLines: 170,
		reason:
			"Doctor tool checks must stay focused; keep provider-specific checks behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-github-tool-checks.ts",
		maxLines: 80,
		reason:
			"Doctor GitHub tool checks must stay focused on gh availability and authentication.",
	},
	{
		path: "src/commands/doctor-file-checks.ts",
		maxLines: 200,
		reason:
			"Doctor file checks must stay focused; keep governance document checks behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-roadmap-file-checks.ts",
		maxLines: 80,
		reason:
			"Doctor roadmap file checks must stay focused on roadmap governance documents.",
	},
	{
		path: "src/commands/doctor-config-checks.ts",
		maxLines: 90,
		reason:
			"Doctor config checks must stay focused; keep north-star contract readiness behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-north-star-contract-checks.ts",
		maxLines: 130,
		reason:
			"Doctor north-star contract checks must stay focused on contract readiness and governed surface ownership.",
	},
	{
		path: "src/commands/doctor-ci-checks.ts",
		maxLines: 80,
		reason:
			"Doctor CI checks must stay focused; keep required-check identity behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-ci-check-alignment.ts",
		maxLines: 130,
		reason:
			"Doctor CI check alignment must stay focused on required-check identity and branch-protection naming.",
	},
] as const;

const SCAFFOLD_SURFACE_RATCHETS = [
	{
		path: "src/lib/init/scaffold.ts",
		maxLines: 450,
		reason:
			"Scaffold entrypoint must stay a thin orchestrator; extract surface-specific rendering modules before raising this limit.",
	},
	{
		path: "src/lib/init/scaffold-template-registry.ts",
		maxLines: 425,
		reason:
			"Scaffold template registry must stay an inventory seam; extract focused template groups before raising this limit.",
	},
	{
		path: "src/lib/init/scaffold-script-template-registry.ts",
		maxLines: 225,
		reason:
			"Scaffold script template registry must stay focused; extract script-family renderers before raising this limit.",
	},
] as const;

const TRANSITIONAL_LIB_TO_COMMAND_IMPORTS = new Set([
	"src/lib/cli/registry/command-specs.ts",
	"src/lib/cli/registry/command-specs-core.ts",
	"src/lib/cli/registry/branch-protect-command-spec.ts",
	"src/lib/cli/registry/check-authz-command-spec.ts",
	"src/lib/cli/registry/check-environment-command-spec.ts",
	"src/lib/cli/registry/evidence-verify-command-spec.ts",
	"src/lib/cli/registry/license-gate-command-spec.ts",
	"src/lib/cli/registry/local-memory-preflight-command-spec.ts",
	"src/lib/cli/registry/preflight-gate-command-spec.ts",
	"src/lib/cli/registry/review-gate-command-spec.ts",
	"src/lib/cli/registry/linear-gate-command-spec.ts",
	"src/lib/cli/registry/linear-command-runner.ts",
	"src/lib/cli/registry/linear-command-spec.ts",
	"src/lib/cli/registry/policy-gate-command-spec.ts",
	"src/lib/cli/registry/pr-template-gate-command-spec.ts",
	"src/lib/cli/registry/rule-lifecycle-gate-command-spec.ts",
	"src/lib/init/index.ts",
	"src/lib/output/normalise.ts",
	"src/lib/output/normalise-core-v2.ts",
	"src/lib/output/normalise-docs-gate.ts",
	"src/lib/output/normalise-drift-gate.ts",
	"src/lib/output/normalise-he-phase-exit.ts",
	"src/lib/output/normalise-linear-gate.ts",
	"src/lib/output/normalise-plan-gate.ts",
	"src/lib/output/normalise-policy-gate.ts",
	"src/lib/output/normalise-pr-template-gate.ts",
]);

const COMMAND_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+commands\//;
const EFFECT_IMPORT_PATTERN = /from\s+["']effect(?:\/[^"']+)?["']/;
const PR_CLOSEOUT_INTERNAL_IMPORT_PATTERN =
	/from\s+["'][^"']*lib\/pr-closeout\/(?:blockers|claim-builders|claim-helpers|claims|evidence|evaluator|recovery|status|types)\.js["']/;
const IMPORT_SPECIFIER_PATTERN =
	/(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["'](?<specifier>[^"']+)["']/g;
const APPROVED_EFFECT_BOUNDARIES = new Set([
	"src/lib/missing-context/classifier.ts",
	"src/lib/pr-closeout/evaluator.ts",
]);
const APPROVED_PR_CLOSEOUT_INTERNAL_IMPORTERS = new Set([
	"src/lib/pr-closeout.ts",
]);
const APPROVED_PR_CLOSEOUT_PARENT_IMPORTS = new Map<string, readonly string[]>([
	[
		"src/lib/pr-closeout/types.ts",
		["../decision/he-phase-exit.js", "../missing-context/classifier.js"],
	],
	["src/lib/pr-closeout/blockers.ts", ["../decision/he-phase-exit.js"]],
	[
		"src/lib/pr-closeout/claim-helpers.ts",
		["../missing-context/classifier.js"],
	],
]);
const PR_CLOSEOUT_COMMAND_SUBMODULES = [
	"./pr-closeout/args.js",
	"./pr-closeout/live.js",
	"./pr-closeout/types.js",
] as const;

const DOCTOR_COMMAND_SUBMODULES = [
	"./doctor-artifacts.js",
	"./doctor-checks.js",
	"./doctor-recovery.js",
	"./doctor-renderer.js",
] as const;

const DOCTOR_TOOL_SUBMODULES = ["./doctor-github-tool-checks.js"] as const;
const DOCTOR_FILE_SUBMODULES = ["./doctor-roadmap-file-checks.js"] as const;
const DOCTOR_CI_SUBMODULES = ["./doctor-ci-check-alignment.js"] as const;
const DOCTOR_CONFIG_SUBMODULES = [
	"./doctor-north-star-contract-checks.js",
] as const;
const CLI_REGISTRY_SPEC_SUBMODULES = [
	"./branch-protect-command-spec.js",
	"./check-authz-command-spec.js",
	"./check-environment-command-spec.js",
	"./evidence-verify-command-spec.js",
	"./license-gate-command-spec.js",
	"./local-memory-preflight-command-spec.js",
	"./preflight-gate-command-spec.js",
	"./review-gate-command-spec.js",
	"./linear-command-spec.js",
	"./linear-gate-command-spec.js",
	"./policy-gate-command-spec.js",
	"./pr-template-gate-command-spec.js",
	"./rule-lifecycle-gate-command-spec.js",
] as const;
const NEXT_COMMAND_SUBMODULES = [
	"./next-args.js",
	"./next-decisions.js",
	"./next-phase-exit.js",
	"./next-runner.js",
	"./next-runtime-card.js",
	"./next-usage-errors.js",
] as const;
const NEXT_DECISION_SUBMODULES = [
	"./next-blocked-decisions.js",
	"./next-recommendation-decisions.js",
] as const;
const REPLAY_COMMAND_SUBMODULES = ["./replay-run-record.js"] as const;
const REMEDIATE_COMMAND_SUBMODULES = [
	"./remediate-findings.js",
	"./remediate-run-record.js",
] as const;
const PR_CLOSEOUT_EVALUATOR_SUBMODULES = ["./recovery.js"] as const;
const REVIEW_GATE_DECISION_PACKET_SUBMODULES = [
	"./recovery.js",
	"./run-record.js",
] as const;
const REVIEW_GATE_DECISION_PACKET_FORBIDDEN_SYMBOLS = [
	"function resolveReviewGateFailureClass",
	"function resolveReviewGateRecoveryOwner",
	"function resolveReviewGateNextAction",
	"function resolveRunRecordOutcome",
	"function resolveRunRecordClassification",
	"function resolveRunRecordEventStatus",
	"function resolveRunRecordEventSeverity",
] as const;
const RUNTIME_CARD_COMMAND_SUBMODULES = ["./runtime-card-args.js"] as const;
const RUNTIME_CARD_CONTRACT_SUBMODULES = [
	"./runtime-card-validation.js",
] as const;
const RUNTIME_CARD_VALIDATION_SUBMODULES = [
	"./runtime-card-recovery-validation.js",
] as const;
const RUNTIME_CARD_INTERNAL_VALIDATION_IMPORTS = new Set([
	"./runtime-card-validation.js",
	"./runtime-card-recovery-validation.js",
]);
const APPROVED_RUNTIME_CARD_INTERNAL_VALIDATION_IMPORTERS = new Map<
	string,
	readonly string[]
>([
	["src/lib/runtime/runtime-card.ts", ["./runtime-card-validation.js"]],
	[
		"src/lib/runtime/runtime-card-validation.ts",
		["./runtime-card-recovery-validation.js"],
	],
]);
const LOCAL_RUNTIME_CARD_SUBMODULES = [
	"./local-runtime-card-assembly.js",
	"./local-runtime-card-artifacts.js",
	"./local-runtime-card-live.js",
	"./local-runtime-card-phase-exit.js",
] as const;
const LOCAL_RUNTIME_CARD_ASSEMBLY_SUBMODULES = [
	"./local-runtime-card-attempts.js",
] as const;
const COMMAND_CAPABILITY_SUBMODULES = [
	"./command-capability-rules.js",
] as const;
const OUTPUT_NORMALISE_SUBMODULES = [
	"./normalise-docs-gate.js",
	"./normalise-drift-gate.js",
	"./normalise-he-phase-exit.js",
	"./normalise-linear-gate.js",
	"./normalise-plan-gate.js",
	"./normalise-policy-gate.js",
	"./normalise-pr-template-gate.js",
	"./normalise-renderer.js",
] as const;

function countFileLines(path: string): number {
	const content = readFileSync(join(process.cwd(), path), "utf-8");
	return content.split("\n").length;
}

function expectRatchetsWithinBudget(
	ratchets: readonly { path: string; maxLines: number; reason: string }[],
): void {
	for (const moduleRatchet of ratchets) {
		const lineCount = countFileLines(moduleRatchet.path);

		expect(
			lineCount,
			`${moduleRatchet.path} has ${lineCount} lines; ${moduleRatchet.reason}`,
		).toBeLessThanOrEqual(moduleRatchet.maxLines);
	}
}

function collectTypeScriptFiles(directory: string): string[] {
	const root = join(process.cwd(), directory);
	const files: string[] = [];

	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const relativePath = join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...collectTypeScriptFiles(relativePath));
			continue;
		}

		if (
			entry.isFile() &&
			relativePath.endsWith(".ts") &&
			!relativePath.endsWith(".test.ts") &&
			!relativePath.endsWith(".spec.ts") &&
			!relativePath.endsWith(".d.ts")
		) {
			files.push(relativePath);
		}
	}

	return files;
}

function importSpecifiers(content: string): string[] {
	return [...content.matchAll(IMPORT_SPECIFIER_PATTERN)].map((match) => {
		const specifier = match.groups?.specifier;
		if (!specifier) {
			throw new Error("Import specifier regex did not capture a specifier.");
		}
		return specifier;
	});
}

describe("module boundaries", () => {
	it("keeps command registry as a thin loader module", () => {
		const registryPath = "src/lib/cli/command-registry.ts";
		const content = readFileSync(join(process.cwd(), registryPath), "utf-8");
		expect(content).toContain("./registry/command-capabilities.js");
		expect(content).toContain("./registry/fuzzy-resolution.js");
		expect(countFileLines(registryPath)).toBeLessThanOrEqual(220);
	});

	it("keeps command capability catalog split from static rules", () => {
		expectRatchetsWithinBudget(CLI_REGISTRY_SURFACE_RATCHETS);

		const capabilitiesContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/command-capabilities.ts"),
			"utf-8",
		);

		for (const submodule of COMMAND_CAPABILITY_SUBMODULES) {
			expect(capabilitiesContent).toContain(submodule);
		}
	});

	it("keeps validator entrypoint below monolith threshold and split by domain", () => {
		const validatorPath = "src/lib/contract/validator.ts";
		const content = readFileSync(join(process.cwd(), validatorPath), "utf-8");
		expect(content).toContain("./policy-validators.js");
		expect(content).toContain("./validator-helpers.js");
		expect(countFileLines(validatorPath)).toBeLessThanOrEqual(2700);
	});

	it("keeps PR closeout evaluator split after decomposition", () => {
		expectRatchetsWithinBudget(PR_CLOSEOUT_SURFACE_RATCHETS);
	});

	it("keeps PR closeout recovery metadata behind the evaluator seam", () => {
		const evaluatorPath = "src/lib/pr-closeout/evaluator.ts";
		const evaluatorContent = readFileSync(
			join(process.cwd(), evaluatorPath),
			"utf-8",
		);

		for (const submodule of PR_CLOSEOUT_EVALUATOR_SUBMODULES) {
			expect(evaluatorContent).toContain(submodule);
		}
	});

	it("keeps review-gate decision packet seams split after decomposition", () => {
		expectRatchetsWithinBudget(REVIEW_GATE_DECISION_PACKET_RATCHETS);
	});

	it("keeps review-gate recovery and run-record metadata behind the decision packet seam", () => {
		const decisionPacketPath = "src/lib/review-gate/decision-packet.ts";
		const decisionPacketContent = readFileSync(
			join(process.cwd(), decisionPacketPath),
			"utf-8",
		);
		const decisionPacketImports = importSpecifiers(decisionPacketContent);

		for (const submodule of REVIEW_GATE_DECISION_PACKET_SUBMODULES) {
			expect(decisionPacketImports).toContain(submodule);
		}

		for (const extractedSymbol of REVIEW_GATE_DECISION_PACKET_FORBIDDEN_SYMBOLS) {
			expect(decisionPacketContent).not.toContain(extractedSymbol);
		}
	});

	it("ratchets seam decomposition while they are extracted", () => {
		expectRatchetsWithinBudget(COMMAND_SURFACE_DECOMPOSITION_RATCHETS);
	});

	it("keeps CLI registry workflow parsing behind focused command spec seams", () => {
		expectRatchetsWithinBudget(CLI_REGISTRY_SURFACE_RATCHETS);

		const commandSpecsCoreContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/command-specs-core.ts"),
			"utf-8",
		);

		for (const submodule of CLI_REGISTRY_SPEC_SUBMODULES) {
			expect(commandSpecsCoreContent).toContain(submodule);
		}
	});

	it("keeps output normalisation split behind focused gate adapter seams", () => {
		expectRatchetsWithinBudget(OUTPUT_NORMALISE_SURFACE_RATCHETS);

		const normaliseCoreContent = readFileSync(
			join(process.cwd(), "src/lib/output/normalise-core-v2.ts"),
			"utf-8",
		);

		for (const submodule of OUTPUT_NORMALISE_SUBMODULES) {
			expect(normaliseCoreContent).toContain(submodule);
		}
	});

	it("keeps harness next surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(NEXT_SURFACE_RATCHETS);
	});

	it("keeps harness next parsing behind the command facade", () => {
		const facadePath = "src/commands/next.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of NEXT_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
	});

	it("keeps harness next decision internals behind the public decision seam", () => {
		const decisionsPath = "src/commands/next-decisions.ts";
		const decisionsContent = readFileSync(
			join(process.cwd(), decisionsPath),
			"utf-8",
		);

		for (const submodule of NEXT_DECISION_SUBMODULES) {
			expect(decisionsContent).toContain(submodule);
		}
	});

	it("keeps runtime-card surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(RUNTIME_CARD_SURFACE_RATCHETS);
	});

	it("keeps replay surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(REPLAY_SURFACE_RATCHETS);
	});

	it("keeps replay run-record emission behind the command facade", () => {
		const facadePath = "src/commands/replay.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of REPLAY_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
	});

	it("keeps remediate surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(REMEDIATE_SURFACE_RATCHETS);
	});

	it("keeps remediate finding normalization and run-record emission behind the command facade", () => {
		const facadePath = "src/commands/remediate.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of REMEDIATE_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
	});

	it("keeps runtime-card contract and validation seams split after decomposition", () => {
		expectRatchetsWithinBudget(RUNTIME_CARD_RUNTIME_RATCHETS);
	});

	it("keeps runtime-card validation behind the public contract seam", () => {
		const contractContent = readFileSync(
			join(process.cwd(), "src/lib/runtime/runtime-card.ts"),
			"utf-8",
		);
		const validationContent = readFileSync(
			join(process.cwd(), "src/lib/runtime/runtime-card-validation.ts"),
			"utf-8",
		);

		for (const submodule of RUNTIME_CARD_CONTRACT_SUBMODULES) {
			expect(contractContent).toContain(submodule);
		}
		for (const submodule of RUNTIME_CARD_VALIDATION_SUBMODULES) {
			expect(validationContent).toContain(submodule);
		}
	});

	it("keeps runtime-card validation internals behind the public contract seam", () => {
		const violations = collectTypeScriptFiles("src").flatMap((path) => {
			const approvedImports =
				APPROVED_RUNTIME_CARD_INTERNAL_VALIDATION_IMPORTERS.get(path) ?? [];
			const content = readFileSync(join(process.cwd(), path), "utf-8");
			return importSpecifiers(content)
				.filter((specifier) =>
					RUNTIME_CARD_INTERNAL_VALIDATION_IMPORTS.has(specifier),
				)
				.filter((specifier) => !approvedImports.includes(specifier))
				.map((specifier) => `${path} -> ${specifier}`);
		});

		expect(violations).toEqual([]);
	});

	it("keeps runtime-card parsing behind the command facade", () => {
		const facadePath = "src/commands/runtime-card.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of RUNTIME_CARD_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
	});

	it("keeps local runtime-card surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(LOCAL_RUNTIME_CARD_SURFACE_RATCHETS);
	});

	it("keeps assembly, attempt, artifact, phase-exit, and live refresh behind the local runtime-card seam", () => {
		const facadePath = "src/lib/runtime/local-runtime-card.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);
		const assemblyContent = readFileSync(
			join(process.cwd(), "src/lib/runtime/local-runtime-card-assembly.ts"),
			"utf-8",
		);

		for (const submodule of LOCAL_RUNTIME_CARD_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
		for (const submodule of LOCAL_RUNTIME_CARD_ASSEMBLY_SUBMODULES) {
			expect(assemblyContent).toContain(submodule);
		}
	});

	it("keeps doctor surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(DOCTOR_SURFACE_RATCHETS);
	});

	it("keeps doctor command seams behind the command facade", () => {
		const facadePath = "src/commands/doctor.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of DOCTOR_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
	});

	it("keeps provider-specific doctor tool checks behind tool seams", () => {
		const toolChecksPath = "src/commands/doctor-tool-checks.ts";
		const toolChecksContent = readFileSync(
			join(process.cwd(), toolChecksPath),
			"utf-8",
		);

		for (const submodule of DOCTOR_TOOL_SUBMODULES) {
			expect(toolChecksContent).toContain(submodule);
		}
	});

	it("keeps roadmap doctor file checks behind file seams", () => {
		const fileChecksPath = "src/commands/doctor-file-checks.ts";
		const fileChecksContent = readFileSync(
			join(process.cwd(), fileChecksPath),
			"utf-8",
		);

		for (const submodule of DOCTOR_FILE_SUBMODULES) {
			expect(fileChecksContent).toContain(submodule);
		}
	});

	it("keeps required-check identity behind CI seams", () => {
		const ciChecksPath = "src/commands/doctor-ci-checks.ts";
		const ciChecksContent = readFileSync(
			join(process.cwd(), ciChecksPath),
			"utf-8",
		);

		for (const submodule of DOCTOR_CI_SUBMODULES) {
			expect(ciChecksContent).toContain(submodule);
		}
	});

	it("keeps north-star contract readiness behind config seams", () => {
		const configChecksPath = "src/commands/doctor-config-checks.ts";
		const configChecksContent = readFileSync(
			join(process.cwd(), configChecksPath),
			"utf-8",
		);

		for (const submodule of DOCTOR_CONFIG_SUBMODULES) {
			expect(configChecksContent).toContain(submodule);
		}
	});

	it("keeps scaffold surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(SCAFFOLD_SURFACE_RATCHETS);
	});

	it("prevents new lib-to-command imports outside transitional adapters", () => {
		const violations = collectTypeScriptFiles("src/lib")
			.filter((path) => !TRANSITIONAL_LIB_TO_COMMAND_IMPORTS.has(path))
			.filter((path) =>
				COMMAND_IMPORT_PATTERN.test(
					readFileSync(join(process.cwd(), path), "utf-8"),
				),
			);

		expect(violations).toEqual([]);
	});

	it("keeps Effect adoption inside approved deep module boundaries", () => {
		const violations = collectTypeScriptFiles("src")
			.filter((path) => !APPROVED_EFFECT_BOUNDARIES.has(path))
			.filter((path) =>
				EFFECT_IMPORT_PATTERN.test(
					readFileSync(join(process.cwd(), path), "utf-8"),
				),
			);

		expect(violations).toEqual([]);
	});

	it("keeps PR closeout callers on the public boundary", () => {
		const violations = collectTypeScriptFiles("src")
			.filter((path) => !path.startsWith("src/lib/pr-closeout/"))
			.filter((path) => !APPROVED_PR_CLOSEOUT_INTERNAL_IMPORTERS.has(path))
			.filter((path) =>
				PR_CLOSEOUT_INTERNAL_IMPORT_PATTERN.test(
					readFileSync(join(process.cwd(), path), "utf-8"),
				),
			);

		expect(violations).toEqual([]);
	});

	it("keeps PR closeout command seams behind the command facade", () => {
		const facadePath = "src/commands/pr-closeout.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of PR_CLOSEOUT_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}

		const liveContent = readFileSync(
			join(process.cwd(), "src/commands/pr-closeout/live.ts"),
			"utf-8",
		);
		expect(liveContent).toContain("./env.js");

		const backImports = collectTypeScriptFiles(
			"src/commands/pr-closeout",
		).flatMap((path) =>
			importSpecifiers(readFileSync(join(process.cwd(), path), "utf-8"))
				.filter((specifier) => specifier === "../pr-closeout.js")
				.map((specifier) => `${path} -> ${specifier}`),
		);

		expect(backImports).toEqual([]);
	});

	it("keeps PR closeout internals inside the declared agent boundary", () => {
		const violations = collectTypeScriptFiles("src/lib/pr-closeout").flatMap(
			(path) => {
				const allowedParentImports =
					APPROVED_PR_CLOSEOUT_PARENT_IMPORTS.get(path) ?? [];
				const content = readFileSync(join(process.cwd(), path), "utf-8");
				return importSpecifiers(content)
					.filter((specifier) => specifier.startsWith(".."))
					.filter((specifier) => !allowedParentImports.includes(specifier))
					.map((specifier) => `${path} -> ${specifier}`);
			},
		);

		expect(violations).toEqual([]);
	});
});
