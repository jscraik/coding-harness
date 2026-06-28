import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
	bin?: Record<string, string>;
	devDependencies?: Record<string, string>;
	name?: string;
	private?: boolean;
	type?: string;
};

const sourceBinPackageName = "@brainwav/coding-harness-source-bin";

function readPackageJson(packageDirectory: string): PackageJson {
	return JSON.parse(
		readFileSync(join(process.cwd(), packageDirectory, "package.json"), "utf8"),
	) as PackageJson;
}

describe("source checkout harness binary", () => {
	it("links a repo-local harness binary for pnpm exec", () => {
		const workspaceManifest = readFileSync(
			join(process.cwd(), "pnpm-workspace.yaml"),
			"utf8",
		);
		const rootPackage = readPackageJson(".");
		const sourceBinPackage = readPackageJson("tools/source-harness-bin");

		expect(rootPackage.devDependencies?.[sourceBinPackageName]).toBe(
			"workspace:*",
		);
		expect(sourceBinPackage.name).toBe(sourceBinPackageName);
		expect(sourceBinPackage.private).toBe(true);
		expect(sourceBinPackage.type).toBe("module");
		expect(sourceBinPackage.bin?.harness).toBe("cli.js");
		expect(workspaceManifest).toContain("tools/source-harness-bin");
	});

	it("routes pnpm exec through the built public CLI", () => {
		const shimSource = readFileSync(
			join(process.cwd(), "tools/source-harness-bin/cli.js"),
			"utf8",
		);

		expect(shimSource).toContain(
			'const builtCliPath = resolve(repositoryRoot, "dist/cli.js");',
		);
		expect(shimSource).toContain("dist/cli.js");
	});
});
