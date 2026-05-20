/** Exit code contract for the verify-work command facade and wrapper. */
export const EXIT_CODES = {
	SUCCESS: 0,
	FAILED: 1,
	USAGE_ERROR: 2,
	PRECONDITION_FAILED: 1,
	SIGNAL_TERMINATED: 1,
} as const;

/** CLI options accepted by the verify-work command facade. */
export interface VerifyWorkCliOptions {
	all?: boolean;
	changedOnly?: boolean;
	strict?: boolean;
	fast?: boolean;
	projectGovernance?: boolean;
	workspaceGovernance?: boolean;
	resumeFrom?: string;
	json?: boolean;
	repoRoot?: string;
}
