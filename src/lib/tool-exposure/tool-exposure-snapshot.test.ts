import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	projectToolExposureToRuntimeCard,
	TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT,
	type ToolExposureSnapshot,
	validateToolExposureSnapshot,
} from "./index.js";

function exampleSnapshot(): ToolExposureSnapshot {
	return JSON.parse(
		readFileSync(
			"contracts/examples/tool-exposure-snapshot.example.json",
			"utf8",
		),
	) as ToolExposureSnapshot;
}

describe("ToolExposureSnapshot/v1", () => {
	it("validates the contract example and projects a compact runtime-card summary", () => {
		const snapshot = exampleSnapshot();

		expect(validateToolExposureSnapshot(snapshot)).toEqual({
			valid: true,
			errors: [],
		});
		expect(projectToolExposureToRuntimeCard(snapshot)).toEqual({
			evidenceRef: "tool-exposure://turn-456",
			evidenceUse: "orientation",
			sandboxMode: "workspace-write",
			approvalPolicy: "auto_review",
			networkAccess: "restricted",
			visibleToolCount: 8,
			deferredToolCount: 1,
			hiddenToolCount: 1,
			unavailableToolCount: 1,
			notAttemptedToolCount: 0,
			claimFailedToolCount: 0,
			blockedPermissionAttemptCount: 1,
			writableRootCount: 4,
			keyToolNames: [
				"exec_command",
				"apply_patch",
				"write_stdin",
				"request_permissions",
				"github",
				"linear",
			],
			originalKeyToolNameCount: 6,
			namesTruncated: false,
		});
	});

	it("refuses claim-support promotion for tool exposure evidence", () => {
		const snapshot = {
			...exampleSnapshot(),
			evidenceUse: "claim_support",
		};

		expect(validateToolExposureSnapshot(snapshot)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "evidenceUse" }),
			]),
		});
	});

	it("rejects raw tool payloads, command fragments, and path lists", () => {
		const snapshot = {
			...exampleSnapshot(),
			toolClasses: [
				{
					...exampleSnapshot().toolClasses[0],
					keyToolNames: ["gh pr view --json body"],
					writableRoots: ["/Users/jamiecraik/dev/coding-harness"],
				},
			],
			blockedPermissionAttempts: [
				{
					...exampleSnapshot().blockedPermissionAttempts[0],
					rawToolCall: { arguments: ["--token", "secret=value"] },
				},
			],
			summary: {
				...exampleSnapshot().summary,
				totalToolClassCount: 1,
				visible: 6,
				deferred: 0,
				hidden: 0,
				unavailable: 0,
			},
		};

		expect(validateToolExposureSnapshot(snapshot)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "toolClasses.0.keyToolNames.0" }),
				expect.objectContaining({ path: "toolClasses.0.writableRoots" }),
				expect.objectContaining({
					path: "blockedPermissionAttempts.0.rawToolCall",
				}),
			]),
		});
	});

	it("allows credential classifications without admitting secret assignments", () => {
		const snapshot = {
			...exampleSnapshot(),
			blockedPermissionAttempts: [
				{
					...exampleSnapshot().blockedPermissionAttempts[0],
					reason: "credential_missing",
					failureClass: "credential_missing",
				},
			],
		};

		expect(validateToolExposureSnapshot(snapshot)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("rejects relative filesystem-like strings in compact pointer fields", () => {
		const snapshot = {
			...exampleSnapshot(),
			toolClasses: [
				{
					...exampleSnapshot().toolClasses[0],
					keyToolNames: ["Users/jamie/private.env"],
				},
			],
			summary: {
				...exampleSnapshot().summary,
				totalToolClassCount: 1,
				visible: 6,
				deferred: 0,
				hidden: 0,
				unavailable: 0,
				keyToolNameCount: 1,
				originalKeyToolNameCount: 3,
				namesTruncated: true,
			},
		};

		expect(validateToolExposureSnapshot(snapshot)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "toolClasses.0.keyToolNames.0" }),
			]),
		});
	});

	it("requires closed blocked-permission reasons and failure classes", () => {
		const snapshot = {
			...exampleSnapshot(),
			blockedPermissionAttempts: [
				{
					...exampleSnapshot().blockedPermissionAttempts[0],
					reason: "denied after reading /Users/jamie/private.env",
					failureClass: null,
				},
			],
		};

		expect(validateToolExposureSnapshot(snapshot)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({
					path: "blockedPermissionAttempts.0.reason",
				}),
				expect.objectContaining({
					path: "blockedPermissionAttempts.0.failureClass",
				}),
			]),
		});
	});

	it("requires failure classification for unavailable tool classes", () => {
		const snapshot = {
			...exampleSnapshot(),
			toolClasses: [
				{
					...exampleSnapshot().toolClasses[2],
					failureClass: null,
				},
			],
			summary: {
				...exampleSnapshot().summary,
				totalToolClassCount: 1,
				visible: 2,
				deferred: 0,
				hidden: 1,
				unavailable: 1,
				keyToolNameCount: 2,
				originalKeyToolNameCount: 2,
			},
		};

		expect(validateToolExposureSnapshot(snapshot)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "toolClasses.0.failureClass" }),
			]),
		});
	});

	it("bounds key tool names so compact cards cannot become inventories", () => {
		const snapshot = {
			...exampleSnapshot(),
			toolClasses: [
				{
					...exampleSnapshot().toolClasses[0],
					keyToolNames: Array.from(
						{ length: TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT + 1 },
						(_, index) => `tool-${String(index)}`,
					),
					originalKeyToolNameCount: TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT + 1,
					namesTruncated: false,
				},
			],
			summary: {
				...exampleSnapshot().summary,
				totalToolClassCount: 1,
				visible: 6,
				deferred: 0,
				hidden: 0,
				unavailable: 0,
				blockedPermissionAttemptCount: 1,
				keyToolNameCount: TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT + 1,
				originalKeyToolNameCount: TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT + 1,
			},
		};

		expect(validateToolExposureSnapshot(snapshot)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "toolClasses.0.keyToolNames" }),
				expect.objectContaining({ path: "toolClasses" }),
			]),
		});
	});

	it("rejects contradictory truncation metadata", () => {
		const snapshot = {
			...exampleSnapshot(),
			toolClasses: [
				{
					...exampleSnapshot().toolClasses[0],
					keyToolNames: ["exec_command", "apply_patch"],
					originalKeyToolNameCount: 20,
					namesTruncated: false,
				},
			],
			summary: {
				...exampleSnapshot().summary,
				totalToolClassCount: 1,
				visible: 6,
				deferred: 0,
				hidden: 0,
				unavailable: 0,
				keyToolNameCount: 2,
				originalKeyToolNameCount: 20,
				namesTruncated: false,
			},
		};

		expect(validateToolExposureSnapshot(snapshot)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "toolClasses.0.namesTruncated" }),
				expect.objectContaining({ path: "summary.namesTruncated" }),
			]),
		});
	});
});
