import type { CIProvider } from "../init/types.js";

/**
 * Default provider used when `harness ci-migrate` is invoked without `--provider`.
 */
export const DEFAULT_CI_MIGRATE_PROVIDER = "circleci";

/**
 * Provider identifiers accepted by the `harness ci-migrate` command surface.
 */
export const VALID_CI_MIGRATE_PROVIDERS = [
	"github-actions",
	"circleci",
] as const satisfies readonly CIProvider[];

/**
 * Positional actions accepted by the `harness ci-migrate` command surface.
 */
export const VALID_CI_MIGRATE_ACTIONS = [
	"prepare",
	"commit",
	"abort",
	"verify",
	"bootstrap",
] as const;

/**
 * Supported positional actions for the `harness ci-migrate` command.
 */
export type CIMigrateAction = (typeof VALID_CI_MIGRATE_ACTIONS)[number];
