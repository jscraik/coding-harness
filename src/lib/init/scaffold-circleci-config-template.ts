import {
	renderCiTemplate,
	replaceTemplateTokens,
} from "./scaffold-ci-template-utils.js";

/**
 * Package-manager-specific command inputs for the CircleCI PR pipeline renderer.
 */
export interface CircleCIConfigRenderInput {
	packageManager: string;
	installCommand: string;
	lintCommand: string;
	typecheckCommand: string;
	testCommand: string;
	auditCommand: string;
	checkCommand: string;
	dependencyAuditCommand: string;
	memoryValidateCommand: string;
	linearTrackingEnabled: boolean;
}

/**
 * Render the scaffolded CircleCI PR pipeline configuration.
 *
 * @param input - Pre-resolved package-manager commands and issue-tracker mode.
 * @returns The YAML contents for `.circleci/config.yml`.
 */
export function renderCircleCIConfig(input: CircleCIConfigRenderInput): string {
	const gitleaksCommand =
		"if [ -f .gitleaks.toml ]; then gitleaks detect --source . --config .gitleaks.toml --redact --no-banner; else gitleaks detect --source . --redact --no-banner; fi";
	const trivyCommand =
		"trivy fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 .";
	const semgrepCommand = "bash scripts/check-semgrep-full.sh";
	const configureCacheStep =
		input.packageManager === "pnpm"
			? renderCircleCIPnpmConfigureCacheStep()
			: "";
	const saveCacheStep =
		input.packageManager === "pnpm" ? renderCircleCIPnpmSaveCacheStep() : "";
	const linearGateJob = input.linearTrackingEnabled
		? renderCiTemplate("circleci-linear-gate.yml")
		: "";
	const riskPolicyRequires = input.linearTrackingEnabled
		? `          requires:
            - pr-template
            - linear-gate
`
		: `          requires:
            - pr-template
`;

	return replaceTemplateTokens(renderCiTemplate("circleci-config.yml"), {
		auditCommand: input.auditCommand,
		checkCommand: input.checkCommand,
		configureCacheStep,
		dependencyAuditCommand: input.dependencyAuditCommand,
		gitleaksCommand,
		installCommand: input.installCommand,
		linearGateJob,
		lintCommand: input.lintCommand,
		memoryValidateCommand: input.memoryValidateCommand,
		riskPolicyRequires,
		saveCacheStep,
		semgrepCommand,
		testCommand: input.testCommand,
		trivyCommand,
		typecheckCommand: input.typecheckCommand,
	});
}

function renderCircleCIPnpmConfigureCacheStep(): string {
	return `      - run:
          name: Configure pnpm store
          command: |
            mkdir -p "$HOME/.pnpm-store"
            pnpm config set store-dir "$HOME/.pnpm-store"
            pnpm store path
      - restore_cache:
          keys:
            - v2-pnpm-store-{{ arch }}-{{ checksum "pnpm-lock.yaml" }}
            - v2-pnpm-store-{{ arch }}-
`;
}

function renderCircleCIPnpmSaveCacheStep(): string {
	return `      - save_cache:
          key: v2-pnpm-store-{{ arch }}-{{ checksum "pnpm-lock.yaml" }}
          paths:
            - ~/.pnpm-store
`;
}
