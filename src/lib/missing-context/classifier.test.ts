import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
	classifyMissingContext,
	classifyMissingContextEffect,
} from "./classifier.js";

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

	it.each([
		[
			"unknown surface value",
			{ surface: "unknown_surface", problem: "missing", claim: "ci_green" },
			{ class: "missing_verifier", destination: "validator" },
		],
		[
			"unknown problem value",
			{ surface: "checks", problem: "unknown_problem", claim: "ci_green" },
			{ class: "missing_verifier", destination: "validator" },
		],
		[
			"unknown claim value",
			{ surface: "checks", problem: "missing", claim: "unknown_claim" },
			{ class: "missing_verifier", destination: "validator" },
		],
	] as const)("handles invalid input: %s", (_name, input, expected) => {
		expect(
			classifyMissingContext(
				input as unknown as Parameters<typeof classifyMissingContext>[0],
			),
		).toMatchObject(expected);
	});

	it("keeps the Effect API behind the same module boundary", () => {
		const result = Effect.runSync(
			classifyMissingContextEffect({
				surface: "review",
				problem: "unknown",
				claim: "review_threads",
			}),
		);

		expect(result).toMatchObject({
			class: "hidden_provider_behavior",
			destination: "cold_research_reference",
		});
		expect(
			classifyMissingContext({
				surface: "review",
				problem: "unknown",
				claim: "review_threads",
			}),
		).toEqual(result);
	});
});
