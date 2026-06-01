#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ROOT = path.resolve(__dirname, "..");
const PATTERN_ID = "2026-05-27-codex-system-prompt-operational-analysis";
const SOURCE_PATH =
	".harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md";
const GOAL_PATH = "docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md";
const STATE_PATH =
	"docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml";
const RECEIPTS_PATH =
	"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl";
const PLAN_PATH =
	".harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md";
const SPEC_PATH =
	".harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md";
const EVIDENCE_PATTERNS_PATH = ".harness/research/evidence-patterns.json";
const REQUIRED_TARGETS = new Set([
	GOAL_PATH,
	STATE_PATH,
	RECEIPTS_PATH,
	PLAN_PATH,
	SPEC_PATH,
]);
const REQUIRED_SPG_IDS = Array.from({ length: 12 }, (_, index) => {
	return `SPG-${String(index + 1).padStart(3, "0")}`;
});

function parseArgs(argv) {
	const options = {
		json: false,
		root: DEFAULT_ROOT,
		usageErrors: [],
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--json") {
			options.json = true;
		} else if (arg === "--root") {
			index += 1;
			if (!argv[index] || argv[index].startsWith("-")) {
				options.usageErrors.push({
					code: "usage_missing_value",
					message: "--root requires a path value",
				});
			} else {
				options.root = path.resolve(argv[index]);
			}
		} else {
			options.usageErrors.push({
				code: "usage_unknown_option",
				message: `unknown option: ${arg}`,
			});
		}
	}
	return options;
}

function readText(root, relativePath, errors) {
	const absolutePath = path.resolve(root, relativePath);
	if (!isPathInsideRoot(root, absolutePath)) {
		errors.push({
			code: "path_escapes_root",
			path: relativePath,
			message: "validation path escapes repository root",
		});
		return "";
	}
	try {
		const text = fs.readFileSync(absolutePath, "utf8");
		if (text.trim().length === 0) {
			errors.push({
				code: "required_file_empty",
				path: relativePath,
				message: "required SPG adoption surface must not be empty",
			});
		}
		return text;
	} catch (error) {
		errors.push({
			code: "file_missing_or_unreadable",
			path: relativePath,
			message: String(error),
		});
		return "";
	}
}

function isPathInsideRoot(root, absolutePath) {
	const relativePath = path.relative(root, absolutePath);
	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
	);
}

function readJson(root, relativePath, errors) {
	const text = readText(root, relativePath, errors);
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch (error) {
		errors.push({
			code: "invalid_json",
			path: relativePath,
			message: String(error),
		});
		return null;
	}
}

function includesAllIds(text, label, errors) {
	for (const spgId of REQUIRED_SPG_IDS) {
		if (!text.includes(spgId)) {
			errors.push({
				code: "spg_id_missing",
				path: label,
				spgId,
				message: `${label} must mention ${spgId}`,
			});
		}
	}
}

function validatePattern(manifest, errors) {
	const patterns = Array.isArray(manifest?.patterns) ? manifest.patterns : [];
	const pattern = patterns.find((entry) => entry?.id === PATTERN_ID);
	if (!pattern) {
		errors.push({
			code: "spg_pattern_missing",
			patternId: PATTERN_ID,
			message: "SPG adoption pattern is missing from evidence-patterns.json",
		});
		return;
	}
	if (pattern.source !== SOURCE_PATH) {
		errors.push({
			code: "spg_pattern_source_mismatch",
			patternId: PATTERN_ID,
			expected: SOURCE_PATH,
			actual: pattern.source,
			message:
				"SPG adoption pattern must point at the reviewed source artifact",
		});
	}
	if (pattern.status !== "adopted") {
		errors.push({
			code: "spg_pattern_not_adopted",
			patternId: PATTERN_ID,
			actual: pattern.status,
			message: "SPG pattern must remain explicitly adopted",
		});
	}
	if (
		pattern.validationCommand !==
		"node scripts/validate-system-prompt-gap-adoption.cjs --json"
	) {
		errors.push({
			code: "spg_validation_command_mismatch",
			patternId: PATTERN_ID,
			actual: pattern.validationCommand,
			message: "SPG pattern must use the focused SPG adoption validator",
		});
	}
	const targets = new Set(
		Array.isArray(pattern.targetSurfaces) ? pattern.targetSurfaces : [],
	);
	for (const target of REQUIRED_TARGETS) {
		if (!targets.has(target)) {
			errors.push({
				code: "spg_target_surface_missing",
				patternId: PATTERN_ID,
				path: target,
				message:
					"SPG adoption pattern must keep required target surfaces linked",
			});
		}
	}
}

function validateState(text, errors) {
	if (!text.includes("system_prompt_analysis_adoption:")) {
		errors.push({
			code: "state_spg_section_missing",
			path: STATE_PATH,
			message: "state.yaml must contain system_prompt_analysis_adoption",
		});
	}
	if (
		!text.includes(
			'evidence_registry_id: "2026-05-27-codex-system-prompt-operational-analysis"',
		)
	) {
		errors.push({
			code: "state_spg_registry_id_missing",
			path: STATE_PATH,
			message:
				"state.yaml must bind the SPG adoption to the evidence registry id",
		});
	}
	if (!text.includes("SPG-001 through SPG-012")) {
		errors.push({
			code: "state_spg_completion_blocker_missing",
			path: STATE_PATH,
			message: "state.yaml must keep the SPG completion blocker explicit",
		});
	}
	includesAllIds(text, STATE_PATH, errors);
}

function validateGoal(text, errors) {
	if (!text.includes("2026-05-27 Codex system-prompt operational analysis")) {
		errors.push({
			code: "goal_spg_source_context_missing",
			path: GOAL_PATH,
			message: "goal.md must keep the SPG source context visible",
		});
	}
	if (!text.includes("SPG-001 through SPG-012")) {
		errors.push({
			code: "goal_spg_closeout_rule_missing",
			path: GOAL_PATH,
			message: "goal.md must keep the Judge/PM SPG closeout rule visible",
		});
	}
	includesAllIds(text, GOAL_PATH, errors);
}

function validateReceipts(text, errors) {
	if (!text.includes('"audit_gap_ids":["GAP-002"]')) {
		errors.push({
			code: "receipt_gap_002_evidence_missing",
			path: RECEIPTS_PATH,
			message: "receipts must preserve GAP-002 evidence for this route",
		});
	}
	if (!text.includes(SOURCE_PATH)) {
		errors.push({
			code: "receipt_spg_source_missing",
			path: RECEIPTS_PATH,
			message: "receipts must preserve SPG source references",
		});
	}
}

function validatePlanAndSpec(planText, specText, errors) {
	for (const [label, text] of [
		[PLAN_PATH, planText],
		[SPEC_PATH, specText],
	]) {
		if (
			!text.includes("runtime evidence") &&
			!text.includes("Runtime Evidence")
		) {
			errors.push({
				code: "spg_target_runtime_context_missing",
				path: label,
				message: "SPG target surfaces must keep runtime evidence context",
			});
		}
		if (
			!text.includes("SPG-001 through SPG-012") ||
			!text.includes(SOURCE_PATH)
		) {
			errors.push({
				code: "spg_target_adoption_marker_missing",
				path: label,
				message:
					"SPG target surfaces must keep the adopted SPG-001 through SPG-012 source marker",
			});
		}
	}
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const root = path.resolve(options.root);
	const errors = [...options.usageErrors];
	const manifest = readJson(root, EVIDENCE_PATTERNS_PATH, errors);
	const sourceText = readText(root, SOURCE_PATH, errors);
	const goalText = readText(root, GOAL_PATH, errors);
	const stateText = readText(root, STATE_PATH, errors);
	const receiptsText = readText(root, RECEIPTS_PATH, errors);
	const planText = readText(root, PLAN_PATH, errors);
	const specText = readText(root, SPEC_PATH, errors);

	if (manifest) validatePattern(manifest, errors);
	if (
		sourceText &&
		(!sourceText.includes("System Prompt Operational Findings") ||
			!sourceText.includes(PATTERN_ID))
	) {
		errors.push({
			code: "source_spg_context_missing",
			path: SOURCE_PATH,
			message: "source artifact must retain the adopted analysis context",
		});
	}
	if (goalText) validateGoal(goalText, errors);
	if (stateText) validateState(stateText, errors);
	if (receiptsText) validateReceipts(receiptsText, errors);
	if (planText && specText) validatePlanAndSpec(planText, specText, errors);

	const report = {
		schemaVersion: "system-prompt-gap-adoption-validation/v1",
		status: errors.length === 0 ? "pass" : "fail",
		patternId: PATTERN_ID,
		requiredSpgIds: REQUIRED_SPG_IDS,
		checkedSurfaces: [
			EVIDENCE_PATTERNS_PATH,
			SOURCE_PATH,
			GOAL_PATH,
			STATE_PATH,
			RECEIPTS_PATH,
			PLAN_PATH,
			SPEC_PATH,
		],
		errors,
	};
	if (options.json) {
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	} else if (errors.length === 0) {
		process.stdout.write("PASS: SPG adoption guard is valid\n");
	} else {
		for (const error of errors) {
			process.stderr.write(`fail: ${error.code}: ${error.message}\n`);
		}
	}
	process.exit(errors.length === 0 ? 0 : 1);
}

main();
