import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expectBehavior } from "../testing/expect-behavior.js";
import { discoverPacketCallerInventory } from "./packet-caller-inventory.js";
import { observePacketCandidateIdentity } from "./packet-candidate-identity.js";
import { canonicalizeLegacyPacket } from "./packet-canonicalization.js";
import { measureCurrentPacketConsolidation } from "./packet-consolidation-measurement.js";
import {
	PACKET_FAMILY_REGISTRY,
	RETIREMENT_EVIDENCE_KINDS,
	canRetireLegacyPacket,
	projectLegacyPacket,
	type RetirementEvidenceRef,
	validatePacketSource,
} from "./packet-consolidation.js";
import {
	decideSynaipseTransition,
	validateSynaipseTransition,
} from "./transition.js";

const OBSERVED_AT = "2026-07-15T10:00:00Z";
const FULL_SHA = "eb0e93b2c4803ac4b1a251b284f647f590747b9d";
const BASELINE_SHA = "4b9c2abe870d38bfadd5b8836c73cf7ea8af2abe";
const EXPECTED_CONSUMERS = [
	...new Set(PACKET_FAMILY_REGISTRY.flatMap((family) => family.consumers)),
];
const EXPECTED_PROJECTION_TARGETS = [
	...new Set(PACKET_FAMILY_REGISTRY.map((family) => family.canonicalContract)),
];
function retirementFixture() {
	const repoRoot = mkdtempSync(resolve(tmpdir(), "packet-retirement-repo-"));
	const evidenceRoot = mkdtempSync(
		resolve(tmpdir(), "packet-retirement-evidence-"),
	);
	const familyLiteral = PACKET_FAMILY_REGISTRY.map(
		(family) => family.schemaVersion,
	).join("\n");
	for (const path of EXPECTED_CONSUMERS) {
		const absolutePath = resolve(repoRoot, path);
		mkdirSync(resolve(absolutePath, ".."), { recursive: true });
		writeFileSync(
			absolutePath,
			path === "src/commands/next-agent-native-ratchets.ts"
				? 'import { PACKET_FAMILY_REGISTRY } from "../lib/synaipse/packet-consolidation.js";\nexport const packets = PACKET_FAMILY_REGISTRY.map((family) => family.schemaVersion);\n'
				: familyLiteral,
		);
	}
	execFileSync("git", ["init", "--quiet"], { cwd: repoRoot });
	execFileSync("git", ["config", "user.email", "fixture@example.invalid"], {
		cwd: repoRoot,
	});
	execFileSync("git", ["config", "user.name", "Retirement Fixture"], {
		cwd: repoRoot,
	});
	execFileSync("git", ["add", "."], { cwd: repoRoot });
	execFileSync("git", ["commit", "--quiet", "-m", "fixture"], {
		cwd: repoRoot,
	});
	const candidateSha = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: repoRoot,
		encoding: "utf8",
	}).trim();
	const evidence: RetirementEvidenceRef[] = RETIREMENT_EVIDENCE_KINDS.map(
		(kind) => {
			const artifactPath = `${kind}.json`;
			const bytes = `${JSON.stringify({
				evidenceKind: kind,
				candidateSha,
				outcome: "pass",
				evidenceRefs: [`fixture:${kind}`],
			})}\n`;
			writeFileSync(resolve(evidenceRoot, artifactPath), bytes);
			return {
				kind,
				candidateSha,
				artifactPath,
				ref: `sha256:${createHash("sha256").update(bytes).digest("hex")}#${kind}`,
			};
		},
	);
	const canonicalProjectionTargets: string[] = [...EXPECTED_PROJECTION_TARGETS];
	return {
		repoRoot,
		evidenceRoot,
		candidateSha,
		callerInventory: discoverPacketCallerInventory(
			repoRoot,
			observePacketCandidateIdentity(repoRoot),
		),
		canonicalProjectionTargets,
		evidence,
		cleanup: () => {
			rmSync(repoRoot, { recursive: true, force: true });
			rmSync(evidenceRoot, { recursive: true, force: true });
		},
	};
}

function firstRetirementEvidence(fixture: {
	evidence: RetirementEvidenceRef[];
}): RetirementEvidenceRef {
	const evidence = fixture.evidence[0];
	if (!evidence) throw new TypeError("expected retirement evidence fixture");
	return evidence;
}

function emittedPacket(...args: string[]): unknown {
	return JSON.parse(
		execFileSync(
			process.execPath,
			["scripts/write-agent-native-ratchet-report.cjs", ...args],
			{
				encoding: "utf8",
			},
		),
	);
}

function basePacket(schemaVersion: string) {
	return {
		schemaVersion,
		branch: "codex/jsc-464-synaipse-slice5-packet-consolidation",
		headSha: FULL_SHA,
		generatedAt: OBSERVED_AT,
		mayClaim: ["repo_handoff_orientation", "worktree_changed_files"],
		mustNotClaim: [
			"codex_context_current",
			"codex_session_truth",
			"connector_snapshot_current",
			"sidecar_export_current",
			"ci_passed",
			"review_threads_resolved",
			"tracker_closed",
			"merge_ready",
			"validation_passed",
		],
		evidenceLanes: [
			{ id: "worktree", status: "dirty", evidenceRefs: ["collector:current"] },
		],
		command: "harness reviewer-decision --json",
	};
}

function writeMeasurementBaseline(repoRoot: string): void {
	const baselinePath = resolve(
		repoRoot,
		"evals/scenarios/north-star-agent-delivery/packet-surface-baseline.json",
	);
	mkdirSync(resolve(baselinePath, ".."), { recursive: true });
	writeFileSync(
		baselinePath,
		readFileSync(
			resolve(
				process.cwd(),
				"evals/scenarios/north-star-agent-delivery/packet-surface-baseline.json",
			),
		),
	);
}

function appendRatchetClone(ratchets: unknown[], id?: string): void {
	const first = ratchets[0];
	if (typeof first !== "object" || first === null) {
		throw new TypeError("expected first ratchet row object");
	}
	const clone = { ...first };
	if (id !== undefined) Reflect.set(clone, "id", id);
	ratchets.push(clone);
}

describe("synaipse packet consolidation", () => {
	it.each([
		["agent-native-ratchets/v1", ["--json"], "complete"],
		["session-distill/v1", ["--session-distill", "--json"], "complete"],
		["agent-rework/v1", ["--rework", "--json"], "complete"],
		["reviewer-decision/v1", ["--reviewer-decision", "--json"], "complete"],
		["governance-decision-surface/v1", ["--governance", "--json"], "complete"],
	] as const)("accepts and projects the packet emitted by the %s producer", (schemaVersion, args, expectedStatus) => {
		const packet = emittedPacket(...args);
		const validation = validatePacketSource(schemaVersion, packet);
		const projection = projectLegacyPacket(schemaVersion, packet, OBSERVED_AT);
		const canonical = canonicalizeLegacyPacket(schemaVersion, packet, {
			repoRoot: process.cwd(),
			observedAt: OBSERVED_AT,
		});

		expect(validation).toEqual({ valid: true, errors: [] });
		expect(projection.valid).toBe(true);
		expect(projection.source.schemaVersion).toBe(schemaVersion);
		expect(projection.evidenceRefs.length).toBeGreaterThan(0);
		expect(canonical.status).toBe(expectedStatus);
		if (expectedStatus === "complete") {
			expect(canonical.valid).toBe(true);
			expect(canonical.record?.schemaVersion).toBe(
				PACKET_FAMILY_REGISTRY.find(
					(family) => family.schemaVersion === schemaVersion,
				)?.canonicalContract,
			);
		}
	});

	it("keeps checkout HEAD distinct from an older hosted-main observation", () => {
		const fixture = retirementFixture();
		try {
			execFileSync(
				"git",
				[
					"remote",
					"add",
					"origin",
					"git@github.com:jscraik/coding-harness.git",
				],
				{ cwd: fixture.repoRoot },
			);
			execFileSync(
				"git",
				["update-ref", "refs/remotes/origin/main", fixture.candidateSha],
				{ cwd: fixture.repoRoot },
			);
			writeFileSync(
				resolve(fixture.repoRoot, "feature.txt"),
				"new candidate\n",
			);
			execFileSync("git", ["add", "feature.txt"], { cwd: fixture.repoRoot });
			execFileSync("git", ["commit", "--quiet", "-m", "feature"], {
				cwd: fixture.repoRoot,
			});
			const checkoutHeadSha = execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fixture.repoRoot,
				encoding: "utf8",
			}).trim();
			const packet = emittedPacket("--governance", "--json");

			const canonical = canonicalizeLegacyPacket(
				"governance-decision-surface/v1",
				packet,
				{ repoRoot: fixture.repoRoot, observedAt: OBSERVED_AT },
			);

			expect(checkoutHeadSha).not.toBe(fixture.candidateSha);
			expect(canonical).toMatchObject({
				status: "complete",
				valid: true,
				record: {
					schemaVersion: "synaipse-transition/v1",
					repositorySha: checkoutHeadSha,
					evidence: {
						currentSha: checkoutHeadSha,
						hostedMain: { sha: fixture.candidateSha },
					},
					authority: { owner: "codex", standing: false },
				},
			});
			if (canonical.record?.schemaVersion !== "synaipse-transition/v1")
				throw new TypeError("expected complete canonical transition");
			expect(validateSynaipseTransition(canonical.record)).toEqual({
				valid: true,
				errors: [],
			});
		} finally {
			fixture.cleanup();
		}
	});

	it("rejects a same-path origin hosted outside canonical GitHub", () => {
		const fixture = retirementFixture();
		try {
			execFileSync(
				"git",
				[
					"remote",
					"add",
					"origin",
					"git@example.com:jscraik/coding-harness.git",
				],
				{ cwd: fixture.repoRoot },
			);
			execFileSync(
				"git",
				["update-ref", "refs/remotes/origin/main", fixture.candidateSha],
				{ cwd: fixture.repoRoot },
			);

			const canonical = canonicalizeLegacyPacket(
				"governance-decision-surface/v1",
				emittedPacket("--governance", "--json"),
				{ repoRoot: fixture.repoRoot, observedAt: OBSERVED_AT },
			);

			expect(canonical).toEqual({
				status: "unavailable",
				valid: false,
				errors: ["canonical coding-harness origin is unavailable"],
				sourceSchemaVersion: "governance-decision-surface/v1",
				targetSchemaVersion: "synaipse-transition/v1",
				record: null,
			});
		} finally {
			fixture.cleanup();
		}
	});

	it("ignores caller-scoped git routing when observing transition provenance", () => {
		const target = retirementFixture();
		const contaminant = retirementFixture();
		const previousGitDir = process.env.GIT_DIR;
		const previousGitWorkTree = process.env.GIT_WORK_TREE;
		try {
			for (const fixture of [target, contaminant]) {
				execFileSync(
					"git",
					[
						"remote",
						"add",
						"origin",
						"https://github.com/jscraik/coding-harness.git",
					],
					{ cwd: fixture.repoRoot },
				);
				execFileSync(
					"git",
					["update-ref", "refs/remotes/origin/main", fixture.candidateSha],
					{ cwd: fixture.repoRoot },
				);
			}
			writeFileSync(
				resolve(contaminant.repoRoot, "redirect.txt"),
				"redirect\n",
			);
			execFileSync("git", ["add", "redirect.txt"], {
				cwd: contaminant.repoRoot,
			});
			execFileSync("git", ["commit", "--quiet", "-m", "redirect"], {
				cwd: contaminant.repoRoot,
			});
			process.env.GIT_DIR = resolve(contaminant.repoRoot, ".git");
			process.env.GIT_WORK_TREE = contaminant.repoRoot;

			const canonical = canonicalizeLegacyPacket(
				"governance-decision-surface/v1",
				emittedPacket("--governance", "--json"),
				{ repoRoot: target.repoRoot, observedAt: OBSERVED_AT },
			);

			expect(canonical).toMatchObject({
				status: "complete",
				record: {
					repositorySha: target.candidateSha,
					evidence: {
						currentSha: target.candidateSha,
						hostedMain: { sha: target.candidateSha },
					},
				},
			});
		} finally {
			if (previousGitDir === undefined) delete process.env.GIT_DIR;
			else process.env.GIT_DIR = previousGitDir;
			if (previousGitWorkTree === undefined) delete process.env.GIT_WORK_TREE;
			else process.env.GIT_WORK_TREE = previousGitWorkTree;
			target.cleanup();
			contaminant.cleanup();
		}
	});

	it.each([
		["needs_evidence", "needs_evidence"],
		["blocked", "object"],
		["defer", "defer"],
		["blocked", "blocked_external"],
	] as const)("keeps reviewer %s/%s authority-safe inside a complete canonical transition", (status, decision) => {
		const packet = emittedPacket("--reviewer-decision", "--json");
		if (typeof packet !== "object" || packet === null)
			throw new TypeError("expected reviewer packet object");
		Reflect.set(packet, "status", status);
		Reflect.set(packet, "decision", decision);
		const canonical = canonicalizeLegacyPacket("reviewer-decision/v1", packet, {
			repoRoot: process.cwd(),
			observedAt: OBSERVED_AT,
		});

		expect(canonical).toMatchObject({
			status: "complete",
			valid: true,
			record: {
				schemaVersion: "synaipse-transition/v1",
				authority: { owner: "codex", standing: false },
				vitalDecision: { required: false, question: null },
			},
		});
		if (canonical.record?.schemaVersion !== "synaipse-transition/v1")
			throw new TypeError("expected complete canonical transition");
		expect(validateSynaipseTransition(canonical.record)).toEqual({
			valid: true,
			errors: [],
		});
		expect(
			decideSynaipseTransition(canonical.record, {
				expectedSha: canonical.record.repositorySha,
				now: OBSERVED_AT,
			}),
		).toMatchObject({
			status: "blocked",
			blockers: ["standing_authority_required"],
		});
	});

	it.each([
		"accept",
		"accepted_risk",
	] as const)("rejects reviewer %s as transition authority even with caller-authored receipt evidence", (decision) => {
		const packet = emittedPacket("--reviewer-decision", "--json");
		if (typeof packet !== "object" || packet === null)
			throw new TypeError("expected reviewer packet object");
		Reflect.set(packet, "status", "pass");
		Reflect.set(packet, "decision", decision);
		Reflect.set(packet, "coverageReceipt", {
			schemaVersion: "reviewer-coverage-receipt/v1",
			status: "pass",
			blockerClass: null,
			reason: "fresh reviewer coverage passed",
			requestedRoles: 2,
			completedRoles: 2,
			blockedRoles: 0,
			missingArtifacts: 0,
			synthesisStatus: "pass",
			evidenceRefs: ["review-artifact:qa", "review-artifact:adversarial"],
		});
		const canonical = canonicalizeLegacyPacket("reviewer-decision/v1", packet, {
			repoRoot: process.cwd(),
			observedAt: OBSERVED_AT,
		});

		expect(canonical).toMatchObject({
			status: "complete",
			record: {
				authority: { owner: "codex", standing: false },
				vitalDecision: { required: false, question: null },
			},
		});
		if (canonical.record?.schemaVersion !== "synaipse-transition/v1")
			throw new TypeError("expected complete canonical transition");
		expect(
			decideSynaipseTransition(canonical.record, {
				expectedSha: canonical.record.repositorySha,
				now: OBSERVED_AT,
			}),
		).toMatchObject({
			status: "blocked",
			blockers: ["standing_authority_required"],
		});
	});

	it("maps every legacy packet family to one canonical producer, command, consumer set, and projection contract", () => {
		expect(PACKET_FAMILY_REGISTRY).toEqual([
			expect.objectContaining({
				schemaVersion: "agent-native-ratchets/v1",
				canonicalContract: "synaipse-state/v1",
				command: "harness agent-native-ratchets --json",
			}),
			expect.objectContaining({
				schemaVersion: "session-distill/v1",
				canonicalContract: "synaipse-state/v1",
				command: "harness session-distill --json",
			}),
			expect.objectContaining({
				schemaVersion: "agent-rework/v1",
				canonicalContract: "synaipse-improvement-case/v1",
				command: "harness agent-rework --json",
			}),
			expect.objectContaining({
				schemaVersion: "reviewer-decision/v1",
				canonicalContract: "synaipse-transition/v1",
				command: "harness reviewer-decision --json",
			}),
			expect.objectContaining({
				schemaVersion: "governance-decision-surface/v1",
				canonicalContract: "synaipse-transition/v1",
				command: "harness governance-decision-surface --json",
			}),
		]);
		for (const family of PACKET_FAMILY_REGISTRY) {
			expect(family.producer.startsWith("scripts/")).toBe(true);
			expect(family.consumers.length).toBeGreaterThan(0);
		}
	});

	it("projects a session distill packet into the canonical SynAIpse state contract", () => {
		const projection = projectLegacyPacket(
			"session-distill/v1",
			basePacket("session-distill/v1"),
			OBSERVED_AT,
		);

		expect(projection.valid).toBe(true);
		expect(projection.fragmentKind).toBe("internal_compatibility_fragment");
		expect(projection.targetSchemaVersion).toBe("synaipse-state/v1");
		expect(projection).not.toHaveProperty("schemaVersion");
		expect(projection.source.schemaVersion).toBe("session-distill/v1");
		expect(projection.repository.headSha).toBe(FULL_SHA);
		expect(projection.claims.mayClaim).toContain("repo_handoff_orientation");
		expect(projection.claims.mustNotClaim).toContain("ci_passed");
	});

	it("derives live runtime and generated callers from candidate repository bytes", () => {
		const candidateIdentity = observePacketCandidateIdentity(process.cwd());
		const candidateSha = candidateIdentity.checkoutHeadSha;
		const inventory = discoverPacketCallerInventory(
			process.cwd(),
			candidateIdentity,
		);

		expect(inventory.candidateSha).toBe(candidateSha);
		expect(inventory.candidateDigest).toBe(candidateIdentity.candidateDigest);
		expect(inventory.missingManagedConsumers).toEqual([]);
		expect(inventory.unknownConsumers).toEqual([]);
		expect(inventory.runtimeConsumers).toEqual([
			"src/commands/next-agent-native-ratchets.ts",
			"src/lib/cli/registry/agent-native-packet-command-specs.ts",
			"src/lib/synaipse/packet-canonicalization.ts",
			"src/lib/synaipse/packet-consolidation.ts",
			"src/lib/synaipse/packet-transition-projection.ts",
		]);
		expect(inventory.callers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "scripts/write-agent-native-ratchet-report.cjs",
					kind: "producer",
				}),
				expect.objectContaining({
					path: "contracts/session-distill.schema.json",
					kind: "generated_contract",
				}),
				expect.objectContaining({
					path: "scripts/check_artifact_type_contracts.py",
					kind: "compatibility_validator",
				}),
				expect.objectContaining({
					path: "scripts/run-harness-evals.mjs",
					kind: "outcome_evaluator",
				}),
				expect.objectContaining({
					path: "src/lib/synaipse/packet-consolidation.ts",
					kind: "runtime_consumer",
				}),
				expect.objectContaining({
					path: "src/commands/next-agent-native-ratchets.ts",
					kind: "runtime_consumer",
				}),
			]),
		);
	});

	it("does not count a declared consumer without repository-byte usage proof", () => {
		const fixture = retirementFixture();
		try {
			const unprovedPath = "src/commands/next-agent-native-ratchets.ts";
			writeFileSync(
				resolve(fixture.repoRoot, unprovedPath),
				"export const unrelated = true;\n",
			);

			const inventory = discoverPacketCallerInventory(
				fixture.repoRoot,
				observePacketCandidateIdentity(fixture.repoRoot),
			);

			expect(inventory.missingManagedConsumers).toEqual([unprovedPath]);
			expect(inventory.runtimeConsumers).not.toContain(unprovedPath);
		} finally {
			fixture.cleanup();
		}
	});

	it("discovers aliases, re-exports, constructed commands, and command-only metadata", () => {
		const fixture = retirementFixture();
		try {
			const surfaces = new Map([
				[
					"src/alias-reader.ts",
					'import { PACKET_FAMILY_REGISTRY as families } from "./lib/synaipse/packet-consolidation.js";\nexport const schemas = families.map((family) => family.schemaVersion);\n',
				],
				[
					"src/reexport.ts",
					'export { PACKET_FAMILY_REGISTRY as packetFamilies } from "./lib/synaipse/packet-consolidation.js";\n',
				],
				[
					"src/command-spec-reader.ts",
					'export { agentNativePacketCommandSpecs } from "./lib/cli/registry/agent-native-packet-command-specs.js";\n',
				],
				[
					"src/constructed-command.ts",
					'export const command = "reviewer" + "-decision";\n',
				],
				[
					"src/transition-reader.ts",
					'import { buildPacketTransition } from "./lib/synaipse/packet-transition-projection.js";\nexport { buildPacketTransition };\n',
				],
				[
					"src/lib/cli/registry/command-packet-fixture.ts",
					'export const commandName = "governance-decision-surface";\n',
				],
			]);
			for (const [path, content] of surfaces) {
				const absolute = resolve(fixture.repoRoot, path);
				mkdirSync(resolve(absolute, ".."), { recursive: true });
				writeFileSync(absolute, content);
			}

			const inventory = discoverPacketCallerInventory(
				fixture.repoRoot,
				observePacketCandidateIdentity(fixture.repoRoot),
			);

			expect(inventory.unknownConsumers).toEqual([
				"src/alias-reader.ts",
				"src/command-spec-reader.ts",
				"src/constructed-command.ts",
				"src/reexport.ts",
				"src/transition-reader.ts",
			]);
			expect(inventory.nonRuntimeSurfaces).toContainEqual(
				expect.objectContaining({
					path: "src/lib/cli/registry/command-packet-fixture.ts",
					kind: "command_metadata",
					reason: expect.stringContaining("without reading packet bytes"),
				}),
			);
			expect(inventory.runtimeConsumers).not.toContain(
				"src/lib/cli/registry/command-packet-fixture.ts",
			);
		} finally {
			fixture.cleanup();
		}
	});

	it("measures default-surface reduction while keeping compatibility visible", () => {
		const candidateSha = execFileSync("git", ["rev-parse", "HEAD"], {
			encoding: "utf8",
		}).trim();
		const measurement = measureCurrentPacketConsolidation(process.cwd());

		expect(measurement.schemaVersion).toBe(
			"packet-consolidation-measurement/v1",
		);
		expect(measurement.sources).toMatchObject({
			baselinePath:
				"evals/scenarios/north-star-agent-delivery/packet-surface-baseline.json",
			baselineSourceCommit: BASELINE_SHA,
			baselineSourceCommand: "harness commands --json --for-agent",
			baselineCatalogSchemaVersion: "harness-command-catalog/v4",
			baselineSourceCommandCount: 18,
			baselineCatalogNormalizedBytes: 17_627,
			baselineCatalogSha256:
				"sha256:1cdc209083ef5600c9c41f8757145665122566bd47c02224a131e5c5639730b8",
			baselineExtractionRule:
				"select the five managed packet command names from commands in catalog order and retain exact name, summary, and example fields",
			baselinePayloadSha256:
				"sha256:0eabb6e08bb849254d46c77c4d33e616154e05a009c879f3ecc42f49d450fa7d",
			checkoutHeadSha: candidateSha,
			candidateDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
			candidatePathCount: expect.any(Number),
			inventoryEvidenceRef: expect.stringMatching(
				new RegExp(
					`^git:${candidateSha}:packet-caller-inventory:sha256:[0-9a-f]{64}$`,
				),
			),
		});
		expect(measurement.sources.inventoryEvidenceRef).toContain(
			measurement.sources.candidateDigest,
		);
		expect(measurement.commandVisibility.before).toEqual([
			"harness agent-native-ratchets --json",
			"harness governance-decision-surface --json",
			"harness session-distill --json",
			"harness reviewer-decision --json",
			"harness agent-rework --json",
		]);
		expect(measurement.commandVisibility.afterDefault).toEqual([
			"harness agent-native-ratchets --json",
			"harness session-distill --json",
		]);
		expect(measurement.commandVisibility.compatibilityRetained).toHaveLength(5);
		expect(measurement.packetVisibility).toMatchObject({
			before: [
				"agent-native-ratchets/v1",
				"governance-decision-surface/v1",
				"session-distill/v1",
				"reviewer-decision/v1",
				"agent-rework/v1",
			],
			afterDefault: ["agent-native-ratchets/v1", "session-distill/v1"],
		});
		expect(measurement.migratedConsumerCoverage).toEqual({
			expected: 5,
			observed: 5,
			percent: 100,
			missing: [],
			unclassified: [],
		});
		expect(measurement.packetCatalogContextBytes.deltaBytes).toBeLessThan(0);
		expect(measurement.packetCommandChoice).toEqual({
			before: 5,
			after: 2,
			delta: -3,
		});
	});

	it.each([
		"observed timestamp",
		"source commit",
		"payload digest",
		"source catalog digest",
		"source command count",
		"extraction rule",
		"raw payload with matching self-declared digest",
	] as const)("rejects a baseline with a mismatched %s", (field) => {
		const fixture = retirementFixture();
		try {
			writeMeasurementBaseline(fixture.repoRoot);
			const baselinePath = resolve(
				fixture.repoRoot,
				"evals/scenarios/north-star-agent-delivery/packet-surface-baseline.json",
			);
			const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
			switch (field) {
				case "observed timestamp":
					baseline.observedAt = "2026-07-15T00:00:00Z";
					break;
				case "source commit":
					baseline.sourceCommit = "a".repeat(40);
					break;
				case "payload digest":
					baseline.rawPacketSubsetSha256 = `sha256:${"0".repeat(64)}`;
					break;
				case "source catalog digest":
					baseline.sourceCatalogSha256 = `sha256:${"0".repeat(64)}`;
					break;
				case "source command count":
					baseline.sourceCommandCount = 5;
					break;
				case "extraction rule":
					baseline.extractionRule = "accept caller-authored packet rows";
					break;
				case "raw payload with matching self-declared digest": {
					const rows = JSON.parse(baseline.rawPacketSubset);
					rows[0].summary =
						"Emit a substituted agent-native-ratchets/v1 packet";
					baseline.rawPacketSubset = JSON.stringify(rows);
					baseline.rawPacketSubsetSha256 = `sha256:${createHash("sha256")
						.update(baseline.rawPacketSubset)
						.digest("hex")}`;
					break;
				}
			}
			writeFileSync(baselinePath, `${JSON.stringify(baseline)}\n`);

			expect(() => measureCurrentPacketConsolidation(fixture.repoRoot)).toThrow(
				"packet consolidation baseline does not match its immutable source contract",
			);
		} finally {
			fixture.cleanup();
		}
	});

	it("reduces coverage and names every unclassified packet reference", () => {
		const fixture = retirementFixture();
		try {
			writeMeasurementBaseline(fixture.repoRoot);
			const unknownPath = resolve(
				fixture.repoRoot,
				"src/unclassified-packet-reader.ts",
			);
			mkdirSync(resolve(unknownPath, ".."), { recursive: true });
			writeFileSync(
				unknownPath,
				'export const schema = "session-distill/v1";\n',
			);

			const measurement = measureCurrentPacketConsolidation(fixture.repoRoot);

			expect(measurement.migratedConsumerCoverage).toEqual({
				expected: 6,
				observed: 5,
				percent: 83,
				missing: [],
				unclassified: ["src/unclassified-packet-reader.ts"],
			});
		} finally {
			fixture.cleanup();
		}
	});

	it("derives measurement identity internally instead of accepting a caller SHA", () => {
		const fixture = retirementFixture();
		try {
			writeMeasurementBaseline(fixture.repoRoot);
			const fakeSha = "a".repeat(40);
			const invokeWithIgnoredSha =
				measureCurrentPacketConsolidation as unknown as (
					repoRoot: string,
					ignoredSha: string,
				) => ReturnType<typeof measureCurrentPacketConsolidation>;

			const measurement = invokeWithIgnoredSha(fixture.repoRoot, fakeSha);

			expect(measurement.sources).toMatchObject({
				checkoutHeadSha: fixture.candidateSha,
				candidateDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
				candidatePathCount: 1,
			});
			expect(measurement.sources.checkoutHeadSha).not.toBe(fakeSha);
		} finally {
			fixture.cleanup();
		}
	});

	it("distinguishes deletion, live symlink, broken symlink, and tracked type change", () => {
		const fixture = retirementFixture();
		try {
			const path = resolve(fixture.repoRoot, "identity-target.txt");
			const liveTarget = resolve(fixture.repoRoot, "live-target.txt");
			writeFileSync(path, "tracked file\n");
			writeFileSync(liveTarget, "live target\n");
			execFileSync("git", ["add", "identity-target.txt", "live-target.txt"], {
				cwd: fixture.repoRoot,
			});
			execFileSync("git", ["commit", "--quiet", "-m", "identity fixture"], {
				cwd: fixture.repoRoot,
			});

			unlinkSync(path);
			const deletion = observePacketCandidateIdentity(fixture.repoRoot);
			symlinkSync("missing-target.txt", path);
			const broken = observePacketCandidateIdentity(fixture.repoRoot);
			unlinkSync(path);
			symlinkSync("live-target.txt", path);
			const live = observePacketCandidateIdentity(fixture.repoRoot);

			expect(deletion.candidatePathCount).toBe(1);
			expect(broken.candidatePathCount).toBe(1);
			expect(live.candidatePathCount).toBe(1);
			expect(
				new Set([
					deletion.candidateDigest,
					broken.candidateDigest,
					live.candidateDigest,
				]).size,
			).toBe(3);
		} finally {
			fixture.cleanup();
		}
	});

	it("identifies an unstaged executable-bit change from worktree mode", () => {
		const fixture = retirementFixture();
		try {
			const path = resolve(fixture.repoRoot, "mode-target.sh");
			writeFileSync(path, "#!/bin/sh\nexit 0\n");
			execFileSync("git", ["add", "mode-target.sh"], { cwd: fixture.repoRoot });
			execFileSync("git", ["commit", "--quiet", "-m", "mode fixture"], {
				cwd: fixture.repoRoot,
			});
			const clean = observePacketCandidateIdentity(fixture.repoRoot);
			chmodSync(path, 0o755);
			const executable = observePacketCandidateIdentity(fixture.repoRoot);

			expect(clean.candidatePathCount).toBe(0);
			expect(executable.candidatePathCount).toBe(1);
			expect(executable.candidateDigest).not.toBe(clean.candidateDigest);
		} finally {
			fixture.cleanup();
		}
	});

	it.runIf(process.platform !== "win32")(
		"preserves non-UTF-8 path bytes where supported",
		() => {
			const fixture = retirementFixture();
			try {
				const rawPath = Buffer.concat([
					Buffer.from(fixture.repoRoot),
					Buffer.from("/non-utf8-"),
					Buffer.from([0xff]),
				]);
				try {
					writeFileSync(rawPath, "raw path bytes\n");
				} catch (error) {
					if (
						typeof error === "object" &&
						error !== null &&
						"code" in error &&
						error.code === "EILSEQ"
					) {
						return;
					}
					throw error;
				}

				const identity = observePacketCandidateIdentity(fixture.repoRoot);

				expect(identity.candidatePathCount).toBe(1);
				expect(identity.candidateDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
			} finally {
				fixture.cleanup();
			}
		},
	);

	it("rejects cross-family claims and raw payloads before projection", () => {
		const validation = validatePacketSource("reviewer-decision/v1", {
			...basePacket("reviewer-decision/v1"),
			mayClaim: ["repo_handoff_orientation"],
			rawPayload: { leaked: true },
		});

		expect(validation).toEqual({
			valid: false,
			errors: expect.arrayContaining([
				expect.stringContaining("mayClaim"),
				expect.stringContaining("rawPayload"),
			]),
		});
	});

	it.each([
		["null", null],
		["array", []],
		["string", "review-artifact:qa"],
		["number", 1],
	] as const)("rejects a malformed reviewer coverage receipt encoded as %s", (_, coverageReceipt) => {
		const validation = validatePacketSource("reviewer-decision/v1", {
			...basePacket("reviewer-decision/v1"),
			coverageReceipt,
		});

		expect(validation).toEqual({
			valid: false,
			errors: expect.arrayContaining([
				expect.stringContaining("coverageReceipt must be an object"),
			]),
		});
	});

	it.each([
		["orientation_packet", "review_lane_decision"],
		["session_distillation", "governance_routing"],
		["agent_rework_loop", "repo_orientation"],
		["reviewer_decision_contract", "worktree_changed_files"],
		["governance_decision_surface", "local_recovery_state"],
	] as const)("rejects %s borrowing the %s claim", (id, borrowedClaim) => {
		const packet = emittedPacket("--json");
		if (typeof packet !== "object" || packet === null)
			throw new TypeError("expected ratchet packet object");
		const ratchets = Reflect.get(packet, "ratchets");
		if (!Array.isArray(ratchets)) throw new TypeError("expected ratchet rows");
		const row = ratchets.find((candidate) => candidate.id === id);
		if (!row) throw new TypeError(`missing ratchet row ${id}`);
		row.mayClaim = [borrowedClaim];

		expect(validatePacketSource("agent-native-ratchets/v1", packet)).toEqual({
			valid: false,
			errors: expect.arrayContaining([
				expect.stringContaining("mayClaim has unsupported claim"),
			]),
		});
	});

	it.each([
		[
			"unknown",
			(ratchets: unknown[]) => appendRatchetClone(ratchets, "invented"),
		],
		["duplicate", (ratchets: unknown[]) => appendRatchetClone(ratchets)],
		["missing", (ratchets: unknown[]) => ratchets.pop()],
	] as const)("rejects a %s ratchet row set", (_, mutateRows) => {
		const packet = emittedPacket("--json");
		if (typeof packet !== "object" || packet === null)
			throw new TypeError("expected ratchet packet object");
		const ratchets = Reflect.get(packet, "ratchets");
		if (!Array.isArray(ratchets)) throw new TypeError("expected ratchet rows");
		mutateRows(ratchets);

		expect(validatePacketSource("agent-native-ratchets/v1", packet).valid).toBe(
			false,
		);
	});

	it.each([
		["missing branch", { branch: undefined }, "branch"],
		["blank branch", { branch: "" }, "branch"],
		["missing current SHA", { headSha: undefined }, "headSha"],
		["invalid current SHA", { headSha: "abc123" }, "headSha"],
		["abbreviated current SHA", { headSha: FULL_SHA.slice(0, 7) }, "headSha"],
		[
			"missing evidence references",
			{ evidenceLanes: undefined },
			"evidenceLanes",
		],
		["empty evidence references", { evidenceLanes: [] }, "evidenceLanes"],
		[
			"blank evidence reference",
			{
				evidenceLanes: [
					{
						id: "worktree",
						status: "dirty",
						evidenceRefs: ["collector:current", " "],
					},
				],
			},
			"evidenceRefs",
		],
	] as const)("rejects %s before canonical projection", (_, override, field) => {
		const packet = {
			...basePacket("session-distill/v1"),
			...override,
		};
		const validation = validatePacketSource("session-distill/v1", packet);
		const projection = projectLegacyPacket(
			"session-distill/v1",
			packet,
			OBSERVED_AT,
		);

		expect(validation.valid).toBe(false);
		expect(validation.errors).toEqual([expect.stringContaining(field)]);
		expect(projection.valid).toBe(false);
		expect(projection.errors).toEqual([expect.stringContaining(field)]);
	});

	const legacyRetirementCases = [
		[
			"invented consumer",
			(fixture: ReturnType<typeof retirementFixture>) => {
				fixture.callerInventory.runtimeConsumers = ["not-a-real-consumer"];
			},
			"consumer_inventory_mismatch",
		],
		[
			"missing consumer",
			(fixture: ReturnType<typeof retirementFixture>) => {
				fixture.callerInventory.runtimeConsumers = EXPECTED_CONSUMERS.slice(1);
				fixture.callerInventory.missingManagedConsumers =
					EXPECTED_CONSUMERS.slice(0, 1);
			},
			"consumer_inventory_incomplete",
		],
		[
			"duplicate consumer",
			(fixture: ReturnType<typeof retirementFixture>) => {
				fixture.callerInventory.runtimeConsumers = [
					...EXPECTED_CONSUMERS,
					...EXPECTED_CONSUMERS.slice(0, 1),
				];
			},
			"consumer_inventory_mismatch",
		],
		[
			"unknown consumer",
			(fixture: ReturnType<typeof retirementFixture>) => {
				fixture.callerInventory.unknownConsumers = ["src/unknown-reader.ts"];
			},
			"unknown_consumers_present",
		],
		[
			"invented projection",
			(fixture: ReturnType<typeof retirementFixture>) => {
				fixture.canonicalProjectionTargets = ["not-a-contract"];
			},
			"canonical_projection_mismatch",
		],
		[
			"stale evidence SHA",
			(fixture: ReturnType<typeof retirementFixture>) => {
				firstRetirementEvidence(fixture).candidateSha = "b".repeat(40);
			},
			"retirement_evidence_sha_mismatch",
		],
		[
			"mutable evidence reference",
			(fixture: ReturnType<typeof retirementFixture>) => {
				firstRetirementEvidence(fixture).ref = "artifacts/latest.json";
			},
			"retirement_evidence_ref_not_immutable",
		],
		[
			"missing independent QA evidence",
			(fixture: ReturnType<typeof retirementFixture>) => {
				fixture.evidence = fixture.evidence.filter(
					(evidence) => evidence.kind !== "independent_qa",
				);
			},
			"retirement_evidence_incomplete",
		],
		[
			"caller inventory not reproduced from repository bytes",
			(fixture: ReturnType<typeof retirementFixture>) => {
				fixture.callerInventory.callers = [];
			},
			"caller_inventory_not_mechanical",
		],
		[
			"dirty candidate checkout",
			(fixture: ReturnType<typeof retirementFixture>) => {
				writeFileSync(resolve(fixture.repoRoot, "uncommitted.txt"), "dirty\n");
			},
			"candidate_checkout_dirty",
		],
		[
			"evidence bytes changed after addressing",
			(fixture: ReturnType<typeof retirementFixture>) => {
				const evidence = firstRetirementEvidence(fixture);
				writeFileSync(
					resolve(fixture.evidenceRoot, evidence.artifactPath),
					"changed after digest\n",
				);
			},
			"retirement_evidence_digest_mismatch",
		],
		[
			"symlinked evidence artifact",
			(fixture: ReturnType<typeof retirementFixture>) => {
				const evidence = firstRetirementEvidence(fixture);
				const artifact = resolve(fixture.evidenceRoot, evidence.artifactPath);
				const target = resolve(fixture.evidenceRoot, "symlink-target.json");
				writeFileSync(target, readFileSync(artifact));
				unlinkSync(artifact);
				symlinkSync("symlink-target.json", artifact);
			},
			"retirement_evidence_path_invalid",
		],
		[
			"evidence outcome is not pass",
			(fixture: ReturnType<typeof retirementFixture>) => {
				const evidence = firstRetirementEvidence(fixture);
				const bytes = `${JSON.stringify({
					evidenceKind: evidence.kind,
					candidateSha: evidence.candidateSha,
					outcome: "fail",
					evidenceRefs: ["fixture:failure"],
				})}\n`;
				writeFileSync(
					resolve(fixture.evidenceRoot, evidence.artifactPath),
					bytes,
				);
				evidence.ref = `sha256:${createHash("sha256").update(bytes).digest("hex")}#${evidence.kind}`;
			},
			"retirement_evidence_outcome_not_pass",
		],
	] as const;

	it.each(
		legacyRetirementCases,
	)("rejects %s in legacy-retirement proof", (label, mutate, reason) => {
		const fixture = retirementFixture();
		try {
			mutate(fixture);
			const { cleanup: _cleanup, ...input } = fixture;
			const actual = canRetireLegacyPacket(input);
			expectBehavior({
				given: `retirement proof with ${label}`,
				should: "block deletion with one assertion-shaped diagnostic reason",
				actual: actual,
				expected: { canRetire: false, reason },
			});
		} finally {
			fixture.cleanup();
		}
	});

	it("keeps legacy retirement blocked after generic evidence bytes reconcile", () => {
		const fixture = retirementFixture();
		try {
			const { cleanup: _cleanup, ...input } = fixture;
			expect(canRetireLegacyPacket(input)).toEqual({
				canRetire: false,
				reason: "retirement_evidence_verifier_unavailable",
			});
		} finally {
			fixture.cleanup();
		}
	});
});
