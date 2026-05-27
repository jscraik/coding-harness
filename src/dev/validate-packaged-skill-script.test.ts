import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(
	new URL("../../scripts/validate-packaged-skill.cjs", import.meta.url),
);

type SkillDensityFinding = {
	code: string;
	severity: string;
	skill: string;
};

type SkillDensityReport = {
	findings: SkillDensityFinding[];
	status: "pass" | "fail";
};

const requireScript = createRequire(import.meta.url);
const { collectSkillDensityReport } = requireScript(SCRIPT_PATH) as {
	collectSkillDensityReport(options: {
		repoRoot: string;
		skillsRoot?: string;
	}): SkillDensityReport;
};

const roots: string[] = [];

function makeRoot() {
	const root = mkdtempSync(join(tmpdir(), "skill-density-"));
	roots.push(root);
	mkdirSync(join(root, ".agents", "skills"), { recursive: true });
	return root;
}

function writeSkill(
	root: string,
	name: string,
	frontmatter: Record<string, string>,
	body: string,
	options: { references?: boolean; script?: boolean } = {},
) {
	const skillRoot = join(root, ".agents", "skills", name);
	mkdirSync(skillRoot, { recursive: true });
	const frontmatterLines = Object.entries(frontmatter).map(
		([key, value]) => `${key}: ${value}`,
	);
	writeFileSync(
		join(skillRoot, "SKILL.md"),
		["---", ...frontmatterLines, "---", "", body].join("\n"),
	);
	if (options.references) {
		mkdirSync(join(skillRoot, "references"), { recursive: true });
		writeFileSync(join(skillRoot, "references", "guide.md"), "# Guide\n");
	}
	if (options.script) {
		mkdirSync(join(skillRoot, "scripts"), { recursive: true });
		writeFileSync(
			join(skillRoot, "scripts", "validate.js"),
			"process.exit(0);\n",
		);
	}
}

function reportFor(root: string) {
	return collectSkillDensityReport({
		repoRoot: root,
		skillsRoot: join(root, ".agents", "skills"),
	});
}

function findingCodes(report: SkillDensityReport) {
	return report.findings.map((finding) => finding.code);
}

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

describe("validate-packaged-skill skill density checks", () => {
	it("fails skills that lack machine-readable classification metadata", () => {
		const root = makeRoot();
		writeSkill(
			root,
			"unclassified",
			{
				name: "unclassified",
				description: "Use when validating an unclassified fixture skill.",
			},
			"# Unclassified\n\nUse this only as a fixture.\n",
		);

		const report = reportFor(root);

		expect(report.status).toBe("fail");
		expect(findingCodes(report)).toEqual(
			expect.arrayContaining([
				"skill_missing_classification",
				"skill_missing_owned_workflow",
				"skill_missing_validation_command",
			]),
		);
	});

	it("fails advisory skills that are only prompt prose without workflow references", () => {
		const root = makeRoot();
		writeSkill(
			root,
			"prose-advisory",
			{
				name: "prose-advisory",
				description: "Use when reviewing prose only.",
				skill_kind: "advisory",
				owned_workflow: "prose-review",
				validation_command: "pnpm skill:validate",
			},
			"# Prose Advisory\n\nThis has no workflow section and no references.\n",
		);

		const report = reportFor(root);

		expect(report.status).toBe("fail");
		expect(findingCodes(report)).toEqual(
			expect.arrayContaining([
				"skill_missing_advisory_references",
				"skill_prompt_only_risk",
				"skill_validation_command_unreferenced",
			]),
		);
	});

	it("fails blocking trigger overlap without an allowlist", () => {
		const root = makeRoot();
		const sharedDescription =
			"Use when repairing runtime evidence verifier cockpit skill density validation routing";
		const body = [
			"# Skill",
			"",
			"## Workflow",
			"",
			"1. Run pnpm skill:validate.",
			"",
		].join("\n");
		for (const name of ["alpha", "beta"]) {
			writeSkill(
				root,
				name,
				{
					name,
					description: sharedDescription,
					skill_kind: "advisory",
					owned_workflow: `${name}-workflow`,
					validation_command: "pnpm skill:validate",
				},
				body,
				{ references: true },
			);
		}

		const report = reportFor(root);

		expect(report.status).toBe("fail");
		expect(findingCodes(report)).toContain("skill_overlap_blocking");
	});

	it("allows low-signal trigger overlap below the blocking threshold", () => {
		const root = makeRoot();
		const body = [
			"# Skill",
			"",
			"## Workflow",
			"",
			"1. Run pnpm skill:validate.",
			"",
		].join("\n");
		writeSkill(
			root,
			"runtime",
			{
				name: "runtime",
				description: "Use when validating runtime packet contracts.",
				skill_kind: "advisory",
				owned_workflow: "runtime-packets",
				validation_command: "pnpm skill:validate",
			},
			body,
			{ references: true },
		);
		writeSkill(
			root,
			"docs",
			{
				name: "docs",
				description: "Use when polishing documentation references.",
				skill_kind: "advisory",
				owned_workflow: "documentation",
				validation_command: "pnpm skill:validate",
			},
			body,
			{ references: true },
		);

		const report = reportFor(root);

		expect(report.status).toBe("pass");
		expect(report.findings).toEqual([]);
	});

	it("fails executable skills whose proof asset is not tied to documented validation", () => {
		const root = makeRoot();
		writeSkill(
			root,
			"inert-executable",
			{
				name: "inert-executable",
				description: "Use when validating executable skill proof assets.",
				skill_kind: "executable",
				owned_workflow: "executable-proof",
				validation_command: "pnpm skill:validate",
			},
			"# Inert Executable\n\nThis has a script but does not name the validation command.\n",
			{ script: true },
		);

		const report = reportFor(root);

		expect(report.status).toBe("fail");
		expect(findingCodes(report)).toContain(
			"skill_validation_command_unreferenced",
		);
	});
});
