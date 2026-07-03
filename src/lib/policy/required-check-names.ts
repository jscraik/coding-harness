export const SECURITY_SCAN_CHECK_NAME = "security-scan";

/**
 * Legacy external check name retained for parsing historical artifacts and older
 * downstream manifests. It is not part of the canonical required status-check
 * set for new branch-protection policy.
 */
export const SEMGREP_CLOUD_CHECK_NAME = "semgrep-cloud-platform/scan";
