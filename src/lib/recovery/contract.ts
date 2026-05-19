/** Stable recovery authority scopes understood by the recovery contract. */
export type RecoveryAuthorityScope =
	| "none"
	| "local_filesystem"
	| "workspace_write"
	| "external_service";

/** Recovery contract authority classification. */
export interface RecoveryAuthority {
	/** The highest boundary the handler may touch. */
	scope: RecoveryAuthorityScope;
	/** Whether the handler mutates state. */
	mutatesState: boolean;
	/** Whether the handler needs a credential or secret. */
	requiresSecret: boolean;
	/** Explicit boundary for secret-dependent recovery. */
	secretBoundary?: string;
	/** Explicit mutation authority reference when state changes are allowed. */
	mutationAuthorityRef?: string;
}

/** Input supplied to a recovery handler. */
export interface RecoveryContext {
	/** Original failure text or machine-readable failure reason. */
	failure: string;
	/** Repository root or target boundary for local recovery. */
	repoRoot: string;
	/** Optional handler-specific details. */
	details?: Record<string, unknown>;
}

/** Result returned by recovery hook phases. */
export interface RecoveryHookResult {
	/** Whether the hook succeeded. */
	ok: boolean;
	/** Evidence references produced or consumed by the hook. */
	evidenceRefs: string[];
	/** Human-readable reason for blocked or failed hooks. */
	reason?: string;
}

/** Result returned when a handler attempts recovery. */
export interface RecoveryResult extends RecoveryHookResult {
	/** Recovery outcome for the handler attempt. */
	status: "recovered" | "stopped" | "denied" | "failed";
}

/** Deterministic recovery handler contract. */
export interface RecoveryHandlerContract {
	/** Stable handler identifier. */
	id: string;
	/** Predicate that decides whether this handler applies to a context. */
	trigger: (context: RecoveryContext) => boolean;
	/** Authority and mutation boundary for this handler. */
	authority: RecoveryAuthority;
	/** Verify the failure shape before recovery mutates or repairs anything. */
	verifyBefore: (context: RecoveryContext) => Promise<RecoveryHookResult>;
	/** Attempt the bounded recovery action. */
	recover: (context: RecoveryContext) => Promise<RecoveryResult>;
	/** Verify the repaired state after recovery. */
	verifyAfter: (context: RecoveryContext) => Promise<RecoveryHookResult>;
	/** Roll back any recovery mutation when recovery fails after mutation. */
	rollback: (context: RecoveryContext) => Promise<RecoveryResult>;
	/** Stop condition that prevents open-ended retries. */
	stopCondition: (context: RecoveryContext) => boolean;
	/** Trace fields emitted for observability and replay. */
	traceFields: readonly string[];
	/** Condition for retiring this handler when the systemic gap is fixed. */
	retirementCondition: string;
}

/** Validation result for a recovery contract. */
export interface RecoveryContractValidation {
	/** Whether the contract is valid enough to register. */
	ok: boolean;
	/** Stable validation errors. */
	errors: string[];
	/** Evidence fields that should be emitted with recovery decisions. */
	traceFields: string[];
}

/** Deny/stopped decision for unsafe recovery attempts. */
export interface RecoverySafetyDecision {
	/** Whether the handler can proceed past contract validation. */
	decision: "allowed" | "denied";
	/** Reasons explaining denied recovery. */
	reasons: string[];
	/** Trace evidence that must be preserved. */
	traceFields: string[];
}

function isFunction(value: unknown): value is (...args: never[]) => unknown {
	return typeof value === "function";
}

function hasText(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function validateAuthority(
	authority: RecoveryAuthority | undefined,
	errors: string[],
): void {
	if (!authority) {
		errors.push("authority is required");
		return;
	}
	if (!hasText(authority.scope)) {
		errors.push("authority.scope is required");
	}
	if (typeof authority.mutatesState !== "boolean") {
		errors.push("authority.mutatesState is required");
	}
	if (typeof authority.requiresSecret !== "boolean") {
		errors.push("authority.requiresSecret is required");
	}
	if (authority.requiresSecret && !hasText(authority.secretBoundary)) {
		errors.push("secret-dependent recovery requires secretBoundary");
	}
	if (authority.mutatesState && !hasText(authority.mutationAuthorityRef)) {
		errors.push("state-mutating recovery requires mutationAuthorityRef");
	}
}

/** Validate that a recovery handler implements the deterministic contract. */
export function validateRecoveryHandlerContract(
	handler: Partial<RecoveryHandlerContract>,
): RecoveryContractValidation {
	const errors: string[] = [];
	if (!hasText(handler.id)) errors.push("id is required");
	if (!isFunction(handler.trigger)) errors.push("trigger is required");
	validateAuthority(handler.authority, errors);
	if (!isFunction(handler.verifyBefore))
		errors.push("verifyBefore is required");
	if (!isFunction(handler.recover)) errors.push("recover is required");
	if (!isFunction(handler.verifyAfter)) errors.push("verifyAfter is required");
	if (!isFunction(handler.rollback)) errors.push("rollback is required");
	if (!isFunction(handler.stopCondition))
		errors.push("stopCondition is required");
	if (!Array.isArray(handler.traceFields) || handler.traceFields.length === 0) {
		errors.push("traceFields are required");
	}
	if (!hasText(handler.retirementCondition)) {
		errors.push("retirementCondition is required");
	}
	return {
		ok: errors.length === 0,
		errors,
		traceFields: [...(handler.traceFields ?? [])],
	};
}

/** Return whether a handler is denied before any recovery hook can mutate state. */
export function assessRecoverySafety(
	handler: Partial<RecoveryHandlerContract>,
): RecoverySafetyDecision {
	const validation = validateRecoveryHandlerContract(handler);
	const reasons = [...validation.errors];
	return {
		decision: reasons.length === 0 ? "allowed" : "denied",
		reasons,
		traceFields: validation.traceFields,
	};
}
