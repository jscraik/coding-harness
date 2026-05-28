import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateArtifactRuntimeSurface } from "./index.js";
import type { ArtifactRuntimeSurface } from "./types.js";

const HEAD_SHA = "45b717bb9f0d57ec865b9806475d252d198e866e";
const SCRIPT_PATH = join(
	process.cwd(),
	"scripts/validate-artifact-runtime-surface.cjs",
);
const CURRENT_HEAD_SHA =
	spawnSync("git", ["rev-parse", "HEAD"], {
		cwd: process.cwd(),
		encoding: "utf8",
	}).stdout.trim() || HEAD_SHA;

const tempRoots: string[] = [];

function createTempRoot(prefix: string) {
	const baseRoot = join(
		process.cwd(),
		".cache",
		"artifact-runtime-surface-tests",
	);
	mkdirSync(baseRoot, { recursive: true });
	const root = mkdtempSync(join(baseRoot, prefix));
	tempRoots.push(root);
	return root;
}

function basePacket(): ArtifactRuntimeSurface {
	return JSON.parse(
		readFileSync(
			"contracts/examples/artifact-runtime-surface.example.json",
			"utf8",
		),
	) as ArtifactRuntimeSurface;
}

function claimSupportPacket(): ArtifactRuntimeSurface {
	const packet = basePacket();
	packet.evidenceUse = "claim_support";
	packet.headSha = CURRENT_HEAD_SHA;
	packet.currentHeadSha = CURRENT_HEAD_SHA;
	packet.lineage.headSha = CURRENT_HEAD_SHA;
	packet.claimSupport = {
		status: "supported",
		supportedClaimRefs: ["claim:delivery-truth/root_surface_tidy"],
		reason: "fixture-reviewable-current-artifact",
	};
	return packet;
}

function expectInvalid(
	packet: ArtifactRuntimeSurface,
	code: string,
	path?: string,
) {
	const result = validateArtifactRuntimeSurface(packet);
	expect(result.valid).toBe(false);
	expect(result.errors).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				code,
				...(path ? { path } : {}),
			}),
		]),
	);
}

describe("ArtifactRuntimeSurface/v1", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("accepts a current reviewable claim-support artifact", () => {
		expect(validateArtifactRuntimeSurface(claimSupportPacket())).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("rejects missing artifact paths for claim support", () => {
		const packet = claimSupportPacket();
		packet.artifact.exists = false;

		expectInvalid(packet, "missing_path", "artifact.exists");
	});

	it("rejects zero-byte artifacts for claim support", () => {
		const packet = claimSupportPacket();
		packet.artifact.sizeBytes = 0;

		expectInvalid(packet, "zero_size", "artifact.sizeBytes");
	});

	it("rejects stale front matter for claim support", () => {
		const packet = claimSupportPacket();
		packet.artifact.frontMatterStatus = "stale";

		expectInvalid(packet, "stale_front_matter", "artifact.frontMatterStatus");
	});

	it("rejects broken previews for claim support", () => {
		const packet = claimSupportPacket();
		packet.preview.status = "broken";

		expectInvalid(packet, "broken_preview", "preview.status");
	});

	it("rejects preview not_applicable for preview-required surfaces", () => {
		const packet = claimSupportPacket();
		packet.preview.status = "not_applicable";
		packet.preview.ref = "preview:not-applicable";
		packet.preview.checkedAt = null;

		expectInvalid(packet, "preview_required", "preview.status");
	});

	it("rejects unsupported or generic claim refs", () => {
		const packet = claimSupportPacket();
		packet.claimSupport.supportedClaimRefs = ["claim:artifact-exists/current"];

		expectInvalid(
			packet,
			"invalid_claim_ref",
			"claimSupport.supportedClaimRefs[0]",
		);
	});

	it("rejects current-head mismatches", () => {
		const packet = claimSupportPacket();
		packet.currentHeadSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

		expectInvalid(packet, "current_head_mismatch", "currentHeadSha");
	});

	it("rejects lineage head mismatches", () => {
		const packet = claimSupportPacket();
		packet.lineage.headSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

		expectInvalid(packet, "mismatched_lineage", "lineage.headSha");
	});

	it("rejects timestamp ordering violations", () => {
		const packet = claimSupportPacket();
		packet.preview.checkedAt = "2026-05-28T13:09:00Z";

		expectInvalid(packet, "timestamp_order", "preview.checkedAt");
	});

	it("rejects absolute, traversal, URL, and home paths", () => {
		for (const unsafePath of [
			"/tmp/artifact.md",
			"../artifact.md",
			"artifacts/../secret.md",
			"~/artifact.md",
			"https://example.com/artifact.md",
		]) {
			const packet = claimSupportPacket();
			packet.artifact.path = unsafePath;

			expectInvalid(packet, "unsafe_path", "artifact.path");
		}
	});

	it("rejects secret-like values in allowed fields", () => {
		const packet = claimSupportPacket();
		packet.nextAction =
			"Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturevalue";

		expectInvalid(packet, "secret_like_value", "packet.nextAction");
	});

	it("standalone semantic validator rejects symlink escapes", () => {
		const root = createTempRoot("repo-");
		const outside = createTempRoot("outside-");
		writeFileSync(join(outside, "artifact.md"), "outside repo\n");
		symlinkSync(join(outside, "artifact.md"), join(root, "artifact.md"));
		const packet = claimSupportPacket();
		packet.artifact.path = "artifact.md";
		packet.artifact.sizeBytes = 13;
		const packetPath = join(root, "packet.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, packetPath, "--repo-root", root],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"realpath or symlink target escapes repo root",
		);
	});

	it("standalone semantic validator rejects live-head mismatches", () => {
		const root = createTempRoot("packet-");
		const packet = claimSupportPacket();
		packet.currentHeadSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
		packet.headSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
		packet.lineage.headSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
		const packetPath = join(root, "packet.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, packetPath, "--repo-root", "."],
			{ cwd: process.cwd(), encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"currentHeadSha: must match live repository HEAD",
		);
	});

	it("standalone semantic validator rejects unknown fields", () => {
		const root = createTempRoot("packet-");
		const packet = {
			...basePacket(),
			unexpectedSurfaceField: "not-allowed",
			artifact: {
				...basePacket().artifact,
				unexpectedArtifactField: "not-allowed",
			},
		};
		const packetPath = join(root, "packet.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));

		const result = spawnSync(
			process.execPath,
			[SCRIPT_PATH, packetPath, "--repo-root", "."],
			{ cwd: process.cwd(), encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"packet.unexpectedSurfaceField: is not allowed",
		);
		expect(result.stdout).toContain(
			"artifact.unexpectedArtifactField: is not allowed",
		);
	});

	it("standalone semantic validator accepts the checked-in example", () => {
		const result = spawnSync(
			process.execPath,
			[
				SCRIPT_PATH,
				"contracts/examples/artifact-runtime-surface.example.json",
				"--repo-root",
				".",
			],
			{ cwd: process.cwd(), encoding: "utf8" },
		);

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			schemaVersion: "artifact-runtime-surface-validation/v1",
			status: "pass",
			errors: [],
		});
	});

	it("keeps the checked-in example orientation-only", () => {
		expect(basePacket()).toMatchObject({
			evidenceUse: "audit_trail",
			headSha: null,
			currentHeadSha: null,
			claimSupport: { status: "unsupported", supportedClaimRefs: [] },
			lineage: { headSha: null },
		});
	});
});
