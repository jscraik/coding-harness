import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverPacketCallerInventory } from "./packet-caller-inventory.js";
import { observePacketCandidateIdentity } from "./packet-candidate-identity.js";

function gitFixture() {
	const repoRoot = mkdtempSync(resolve(tmpdir(), "packet-candidate-identity-"));
	execFileSync("git", ["init", "--quiet"], { cwd: repoRoot });
	execFileSync("git", ["config", "user.email", "fixture@example.invalid"], {
		cwd: repoRoot,
	});
	execFileSync("git", ["config", "user.name", "Candidate Fixture"], {
		cwd: repoRoot,
	});
	writeFileSync(resolve(repoRoot, "README.md"), "fixture\n");
	execFileSync("git", ["add", "."], { cwd: repoRoot });
	execFileSync("git", ["commit", "--quiet", "-m", "fixture"], {
		cwd: repoRoot,
	});
	return {
		repoRoot,
		cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
	};
}

describe("packet candidate identity", () => {
	it("binds staged-only index bytes when the worktree matches HEAD", () => {
		const fixture = gitFixture();
		try {
			const path = resolve(fixture.repoRoot, "staged-only.txt");
			writeFileSync(path, "committed bytes\n");
			execFileSync("git", ["add", "staged-only.txt"], {
				cwd: fixture.repoRoot,
			});
			execFileSync("git", ["commit", "--quiet", "-m", "staged fixture"], {
				cwd: fixture.repoRoot,
			});
			const clean = observePacketCandidateIdentity(fixture.repoRoot);

			writeFileSync(path, 'export const schema = "session-distill/v1";\n');
			execFileSync("git", ["add", "staged-only.txt"], {
				cwd: fixture.repoRoot,
			});
			writeFileSync(path, "committed bytes\n");
			const stagedOnly = observePacketCandidateIdentity(fixture.repoRoot);
			const inventory = discoverPacketCallerInventory(
				fixture.repoRoot,
				stagedOnly,
			);

			expect(stagedOnly.candidatePathCount).toBe(1);
			expect(stagedOnly.candidateDigest).not.toBe(clean.candidateDigest);
			expect(inventory.callers).toContainEqual(
				expect.objectContaining({
					path: "staged-only.txt",
					families: expect.arrayContaining(["session-distill/v1"]),
				}),
			);
		} finally {
			fixture.cleanup();
		}
	});

	it.runIf(process.platform === "linux")(
		"fails closed when a repository path cannot be represented as UTF-8",
		() => {
			const fixture = gitFixture();
			try {
				const rawPath = Buffer.concat([
					Buffer.from(fixture.repoRoot),
					Buffer.from("/non-utf8-"),
					Buffer.from([0xff]),
					Buffer.from(".ts"),
				]);
				writeFileSync(rawPath, 'export const schema = "session-distill/v1";\n');
				const identity = observePacketCandidateIdentity(fixture.repoRoot);

				expect(() =>
					discoverPacketCallerInventory(fixture.repoRoot, identity),
				).toThrow("cannot represent a non-UTF-8 repository path");
			} finally {
				fixture.cleanup();
			}
		},
	);

	it("excludes symlinked caller surfaces from external content discovery", () => {
		const fixture = gitFixture();
		const externalRoot = mkdtempSync(
			resolve(tmpdir(), "packet-external-caller-"),
		);
		try {
			const externalTarget = resolve(externalRoot, "caller.ts");
			const linkedCaller = resolve(fixture.repoRoot, "src/linked-caller.ts");
			mkdirSync(resolve(linkedCaller, ".."), { recursive: true });
			writeFileSync(
				externalTarget,
				'export const schema = "session-distill/v1";\n',
			);
			symlinkSync(externalTarget, linkedCaller);

			const firstIdentity = observePacketCandidateIdentity(fixture.repoRoot);
			const firstInventory = discoverPacketCallerInventory(
				fixture.repoRoot,
				firstIdentity,
			);
			writeFileSync(
				externalTarget,
				'export const schema = "reviewer-decision/v1";\n',
			);
			const secondIdentity = observePacketCandidateIdentity(fixture.repoRoot);
			const secondInventory = discoverPacketCallerInventory(
				fixture.repoRoot,
				secondIdentity,
			);

			expect(firstIdentity.candidateDigest).toBe(
				secondIdentity.candidateDigest,
			);
			expect(firstInventory.callers).toEqual(secondInventory.callers);
			expect(firstInventory.callers).not.toContainEqual(
				expect.objectContaining({ path: "src/linked-caller.ts" }),
			);
		} finally {
			fixture.cleanup();
			rmSync(externalRoot, { recursive: true, force: true });
		}
	});
});
