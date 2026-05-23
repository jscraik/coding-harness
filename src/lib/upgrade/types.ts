/** CLI options accepted by `harness upgrade`. */
export interface HarnessUpgradeOptions {
	force?: boolean | undefined;
	dryRun?: boolean | undefined;
	json?: boolean | undefined;
	provider?: string | undefined;
	skipContractMigration?: boolean | undefined;
}

/** Parsed CLI options forwarded from the upgrade registry adapter. */
export type UpgradeCliOptions = HarnessUpgradeOptions;
