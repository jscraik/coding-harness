import { describe, expect, it } from "vitest";
import {
	renderBiomeConfigTemplate,
	renderGitleaksConfigTemplate,
	renderMiseConfigTemplate,
} from "./scaffold-config-templates.js";

describe("config scaffold templates", () => {
	it("renders the Biome config with harness lint policy defaults", () => {
		const config = renderBiomeConfigTemplate();
		const parsed = JSON.parse(config) as {
			$schema: string;
			files: { includes: string[] };
			linter: {
				rules: {
					style: { noDefaultExport: string };
					suspicious: {
						noConsole: string;
					};
				};
			};
		};

		expect(parsed.$schema).toBe(
			"https://biomejs.dev/schemas/2.4.14/schema.json",
		);
		expect(parsed.files.includes).toContain("!**/node_modules");
		expect(parsed.linter.rules.style.noDefaultExport).toBe("error");
		expect(parsed.linter.rules.suspicious.noConsole).toBe("off");
		expect(config).toContain('"useImportType": "error"');
		expect(config).not.toContain("noConsoleLog");
	});

	it("renders Gitleaks allowlist defaults for docs and tests", () => {
		const config = renderGitleaksConfigTemplate();

		expect(config).toContain('title = "Project gitleaks config"');
		expect(config).toContain("[allowlist]");
		expect(config).toContain("(^|/)tests?/");
		expect(config).toContain("\\\\[REDACTED\\\\]");
	});

	it("renders the mise config from the required tooling baseline", () => {
		const config = renderMiseConfigTemplate();

		expect(config).toContain("[tools]");
		expect(config).toContain('"node" = ');
		expect(config).toContain('"pnpm" = ');
		expect(config).toContain('CLAUDE_APPROVAL_POSTURE = "require"');
	});
});
