import {
	TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT,
	type RuntimeCardToolExposureProjection,
	type ToolExposureSnapshot,
} from "./types.js";
import { asToolExposureSnapshot } from "./validation.js";

/** Project a standalone ToolExposureSnapshot/v1 packet into runtime-card/v1. */
export function projectToolExposureToRuntimeCard(
	value: ToolExposureSnapshot | unknown,
): RuntimeCardToolExposureProjection {
	const snapshot = asToolExposureSnapshot(value);
	const keyToolNames = snapshot.toolClasses
		.flatMap((entry) => entry.keyToolNames)
		.slice(0, TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT);
	return {
		evidenceRef: snapshot.evidenceRef,
		evidenceUse: snapshot.evidenceUse,
		sandboxMode: snapshot.sandboxMode,
		approvalPolicy: snapshot.approvalPolicy,
		networkAccess: snapshot.networkAccess,
		visibleToolCount: snapshot.summary.visible,
		deferredToolCount: snapshot.summary.deferred,
		hiddenToolCount: snapshot.summary.hidden,
		unavailableToolCount: snapshot.summary.unavailable,
		notAttemptedToolCount: snapshot.summary.notAttempted,
		claimFailedToolCount: snapshot.summary.claimFailed,
		blockedPermissionAttemptCount:
			snapshot.summary.blockedPermissionAttemptCount,
		writableRootCount: snapshot.summary.writableRootCount,
		keyToolNames,
		originalKeyToolNameCount: snapshot.summary.originalKeyToolNameCount,
		namesTruncated: snapshot.summary.namesTruncated,
	};
}
