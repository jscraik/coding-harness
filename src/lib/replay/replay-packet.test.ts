import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateReplayPacket, type ReplayPacket } from "./replay-packet.js";

const EXAMPLE_PATH = join(
	process.cwd(),
	"contracts/examples/replay-packet.example.json",
);

function loadExample(overrides: Partial<ReplayPacket> = {}): ReplayPacket {
	return {
		...(JSON.parse(readFileSync(EXAMPLE_PATH, "utf8")) as ReplayPacket),
		...overrides,
	};
}

function validate(packet: unknown) {
	return validateReplayPacket(packet, {
		now: new Date("2026-05-28T10:31:00Z"),
		repoRoot: process.cwd(),
	});
}

function firstRef(packet: ReplayPacket): ReplayPacket["sourceRefs"][number] {
	const ref = packet.sourceRefs[0];
	if (!ref) throw new Error("replay-packet fixture missing source ref");
	return ref;
}

function firstHook(
	packet: ReplayPacket,
): ReplayPacket["hookProvenance"][number] {
	const hook = packet.hookProvenance[0];
	if (!hook) throw new Error("replay-packet fixture missing hook provenance");
	return hook;
}

describe("ReplayPacket/v1", () => {
	it("accepts the checked-in replay packet example", () => {
		expect(validate(loadExample())).toEqual({
			status: "pass",
			errors: [],
		});
	});

	it("accepts current orientation packets only while their TTL and head snapshot are current", () => {
		const packet = loadExample({ evidenceUse: "orientation" });

		expect(validate(packet)).toEqual({
			status: "pass",
			errors: [],
		});
	});

	it("rejects claim-support use because replay packets are not delivery proof", () => {
		const packet = loadExample({
			evidenceUse: "claim_support" as ReplayPacket["evidenceUse"],
		});

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([expect.stringContaining("evidenceUse")]),
		});
	});

	it("rejects unrecognized replay kinds in semantic validation", () => {
		const packet = loadExample({
			replayKind: "session_replay_seed_typo" as ReplayPacket["replayKind"],
		});

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([expect.stringContaining("replayKind")]),
		});
	});

	it("rejects raw prompt, transcript, command output, or secret-like keys", () => {
		const packet = {
			...loadExample(),
			rawPrompt: "full transcript text",
		};

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining("raw or secret-like keys"),
			]),
		});
	});

	it("rejects unsafe replay references that escape repo-relative paths", () => {
		const packet = loadExample();
		packet.sourceRefs = [
			{
				...firstRef(packet),
				ref: "../outside.md",
			},
		];

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining("sourceRefs[0].ref"),
			]),
		});
	});

	it("rejects filesystem-bound references when the digest does not match", () => {
		const packet = loadExample();
		packet.sourceRefs = [
			{
				...firstRef(packet),
				sha256:
					"0000000000000000000000000000000000000000000000000000000000000000",
			},
		];

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining("does not match referenced file digest"),
			]),
		});
	});

	it("requires hook execution identity to bind hook file and resolved command provenance", () => {
		const packet = loadExample();
		const hook = firstHook(packet);
		packet.hookProvenance = [
			{
				...hook,
				hookExecutionIdentity: {
					...hook.hookExecutionIdentity,
					resolvedCommandRef:
						undefined as unknown as ReplayPacket["hookProvenance"][number]["hookExecutionIdentity"]["resolvedCommandRef"],
				},
			},
		];

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining("resolvedCommandRef"),
			]),
		});
	});

	it("rejects hook execution identity refs with swapped provenance kinds", () => {
		const packet = loadExample();
		const hook = firstHook(packet);
		packet.hookProvenance = [
			{
				...hook,
				hookExecutionIdentity: {
					...hook.hookExecutionIdentity,
					hookFileRef: {
						...hook.hookExecutionIdentity.hookFileRef,
						refKind: "repo_file",
					},
					resolvedCommandRef: {
						...hook.hookExecutionIdentity.resolvedCommandRef,
						refKind: "hook_file",
					},
				},
			},
		];

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining(
					"hookExecutionIdentity.hookFileRef.refKind",
				),
				expect.stringContaining(
					"hookExecutionIdentity.resolvedCommandRef.refKind",
				),
			]),
		});
	});

	it("rejects normalized events that smuggle raw payload fields", () => {
		const packet = loadExample();
		packet.normalizedEvents = [
			{
				...packet.normalizedEvents[0],
				payload: "raw command output",
			} as ReplayPacket["normalizedEvents"][number],
		];

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining("raw or secret-like keys"),
			]),
		});
	});

	it("blocks stale orientation packets from being used as current guidance", () => {
		const packet = loadExample({
			evidenceUse: "orientation",
			freshnessVerdict: "expired",
		});

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining("orientation requires current"),
			]),
		});
	});

	it("rejects orientation packets with contradictory stale freshness state", () => {
		const packet = loadExample({
			evidenceUse: "orientation",
			freshness: "stale",
			staleState: [
				{
					surface: "replay:fixture",
					freshness: "stale",
					reason: "orientation cannot carry stale state",
				},
			],
			blockers: [
				{
					class: "stale_orientation",
					reason: "orientation cannot carry blockers",
					nextAction: "emit audit-trail packet instead",
				},
			],
		});

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining("freshness: orientation requires current"),
				expect.stringContaining(
					"orientation packets must not carry stale state",
				),
				expect.stringContaining("orientation packets must not carry blockers"),
			]),
		});
	});

	it("allows stale audit-trail packets only when they carry stale-state evidence", () => {
		const stalePacket = loadExample({
			freshness: "stale",
			freshnessVerdict: "expired",
			staleState: [
				{
					surface: "replay:fixture",
					freshness: "stale",
					reason: "fixture documents historical replay evidence only",
				},
			],
		});
		const unsupportedStalePacket = loadExample({
			freshness: "stale",
			freshnessVerdict: "expired",
		});

		expect(validate(stalePacket)).toEqual({
			status: "pass",
			errors: [],
		});
		expect(validate(unsupportedStalePacket)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining("stale audit-trail packets"),
			]),
		});
	});

	it("rejects hook provenance observed after packet generation", () => {
		const packet = loadExample();
		packet.hookProvenance = [
			{
				...firstHook(packet),
				checkedAt: "2026-05-28T10:31:00Z",
			},
		];

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([expect.stringContaining("checkedAt")]),
		});
	});

	it("rejects hook provenance blocker classes that are not compact pointers", () => {
		const packet = loadExample();
		packet.hookProvenance = [
			{
				...firstHook(packet),
				blockerClass: "needs manual triage",
			},
		];

		expect(validate(packet)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining("hookProvenance[0].blockerClass"),
			]),
		});
	});
});
