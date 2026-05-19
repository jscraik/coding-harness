import { describe, expect, it } from "vitest";
import { classifyMissingContext } from "./classifier.js";

describe("classifyMissingContext", () => {
	it.each([
		[
			"missing verifier",
			{ surface: "checks", problem: "missing", claim: "ci_green" },
			{ class: "missing_verifier", destination: "validator" },
		],
		[
			"unmodeled current state",
			{ surface: "checks", problem: "stale", claim: "required_checks" },
			{
				class: "unmodeled_current_state_dependency",
				destination: "validator",
			},
		],
		[
			"hidden provider behavior",
			{ surface: "review", problem: "unknown", claim: "review_threads" },
			{
				class: "hidden_provider_behavior",
				destination: "cold_research_reference",
			},
		],
		[
			"ambiguous ownership boundary",
			{ surface: "linear", problem: "missing", claim: "tracker_state" },
			{
				class: "ambiguous_ownership_boundary",
				destination: "project_brain_learning",
			},
		],
		[
			"missing recovery handler",
			{ surface: "harness_gates", problem: "missing", claim: "rollback" },
			{ class: "missing_recovery_handler", destination: "roadmap_exception" },
		],
		[
			"missing fixture",
			{ surface: "fixture", problem: "missing", claim: "false_success" },
			{ class: "missing_fixture", destination: "fixture_eval" },
		],
		[
			"missing permission explanation",
			{ surface: "permission", problem: "missing", claim: "github_auth" },
			{
				class: "missing_permission_or_auth_explanation",
				destination: "project_brain_learning",
			},
		],
		[
			"stale docs or command reference",
			{ surface: "review", problem: "stale", claim: "review_threads" },
			{
				class: "stale_docs_or_command_reference",
				destination: "cold_research_reference",
			},
		],
		[
			"missing repo instruction",
			{ surface: "checks", problem: "blocked", claim: "ci_green" },
			{
				class: "missing_repo_instruction",
				destination: "project_brain_learning",
			},
		],
	] as const)("routes %s to one durable destination", (_name, input, expected) => {
		expect(classifyMissingContext(input)).toMatchObject(expected);
	});
});
