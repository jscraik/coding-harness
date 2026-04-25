import { describe, expect, it } from "vitest";
import { renderWorkflowTemplate } from "./scaffold-workflow-template.js";
import type { TemplateRenderContext } from "./types.js";

const baseContext: TemplateRenderContext = {
	targetDir: "/tmp/project",
	ciProvider: "github-actions",
	packageScripts: [],
	projectName: "demo-repo",
	repoUrl: "https://github.com/jscraik/demo-repo.git",
};

function renderWorkflow(context: TemplateRenderContext = baseContext) {
	return renderWorkflowTemplate({
		checkCommand: "pnpm check",
		context,
		installCommand: "pnpm install --frozen-lockfile",
	});
}

describe("workflow scaffold template", () => {
	it("renders Linear tracker actions from the narrow workflow interface", () => {
		const workflow = renderWorkflow({
			...baseContext,
			issueTracker: "linear",
			linearProjectSlug: "coding-harness-bb735dbbda79",
		});

		expect(workflow).toContain("kind: linear");
		expect(workflow).toContain('project_slug: "coding-harness-bb735dbbda79"');
		expect(workflow).toContain(
			"git clone --depth 1 'https://github.com/jscraik/demo-repo.git' .",
		);
		expect(workflow).toContain("pnpm install --frozen-lockfile");
		expect(workflow).toContain(
			"`harness linear claim --issue <LK> --branch <codex/...>`",
		);
		expect(workflow).toContain("`pnpm check` passes");
	});

	it("renders GitHub tracker actions without Linear commands", () => {
		const workflow = renderWorkflow({
			...baseContext,
			issueTracker: "github",
		});

		expect(workflow).toContain("kind: github");
		expect(workflow).toContain("open PR and attach validation evidence");
		expect(workflow).not.toContain("harness linear");
	});

	it("renders tracker-less workflows and shell-escapes repository URLs", () => {
		const workflow = renderWorkflow({
			...baseContext,
			issueTracker: "none",
			projectName: "",
			repoUrl: "https://github.com/jscraik/owner's-demo.git",
		});

		expect(workflow).toContain("kind: none");
		expect(workflow).toContain("# <project-name> Workflow");
		expect(workflow).toContain(
			"git clone --depth 1 'https://github.com/jscraik/owner'\"'\"'s-demo.git' .",
		);
	});
});
