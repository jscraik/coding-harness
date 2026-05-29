export const PACKET_KEYS = [
	"schemaVersion",
	"surfaceId",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"surfaceKind",
	"headSha",
	"currentHeadSha",
	"artifact",
	"lineage",
	"preview",
	"claimSupport",
	"freshness",
	"blockers",
	"nextAction",
] as const;

export const ARTIFACT_KEYS = [
	"path",
	"exists",
	"sizeBytes",
	"sha256",
	"mediaType",
	"frontMatterStatus",
	"producedAt",
] as const;

export const LINEAGE_KEYS = [
	"producer",
	"sourceRefs",
	"runtimeIdentityRefs",
	"verifierRefs",
	"headSha",
] as const;

export const VERIFIER_REF_KEYS = ["ref", "verifiedAt"] as const;
export const PREVIEW_KEYS = ["status", "ref", "checkedAt"] as const;
export const CLAIM_SUPPORT_KEYS = [
	"status",
	"supportedClaimRefs",
	"reason",
] as const;
export const BLOCKER_KEYS = ["class", "reason", "nextAction"] as const;

export const SURFACE_KINDS = [
	"implementation_notes",
	"review_artifact",
	"screenshot",
	"csv",
	"pdf",
	"document",
	"runtime_card",
	"report",
	"lifecycle_artifact",
	"other",
] as const;

export const EVIDENCE_USE = [
	"orientation",
	"audit_trail",
	"claim_support",
] as const;
export const FRESHNESS = [
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
] as const;
export const FRONT_MATTER_STATUS = [
	"current",
	"stale",
	"missing",
	"not_applicable",
] as const;
export const PREVIEW_STATUS = [
	"current",
	"missing",
	"broken",
	"not_applicable",
] as const;
export const CLAIM_SUPPORT_STATUS = [
	"supported",
	"unsupported",
	"blocked",
] as const;
export const PREVIEW_REQUIRED_KINDS = [
	"implementation_notes",
	"review_artifact",
	"screenshot",
	"csv",
	"pdf",
	"document",
	"report",
	"lifecycle_artifact",
] as const;
export const BLOCKER_CLASSES = [
	"missing_path",
	"zero_size",
	"missing_checksum",
	"stale_front_matter",
	"broken_preview",
	"unsupported_claim",
	"mismatched_lineage",
	"stale_surface",
	"unsafe_reference",
] as const;

export const RFC3339_DATE_TIME_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
export const HEAD_SHA_PATTERN = /^[0-9a-f]{40}$/u;
export const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
export const POINTER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._/@#?=&+,-]{1,255}$/u;
export const MEDIA_TYPE_PATTERN =
	/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/u;
export const SAFE_PATH_PATTERN = /^(?:[A-Za-z0-9._@+-]+\/)*[A-Za-z0-9._@+-]+$/u;
export const CLAIM_REF_PATTERN =
	/^claim:(?:delivery-truth|review-state|runtime-card|root-hygiene|external-state|judge-pm)\/[A-Za-z0-9._:@#?=&+,-]{2,200}$/u;
export const PREVIEW_REF_PATTERN =
	/^preview:(?:browser\/[A-Za-z0-9._:@#?=&+,-]{2,200}|artifact\/[A-Za-z0-9._:@#?=&+,-]{2,200}|file\/(?:[A-Za-z0-9._@+-]+\/)*[A-Za-z0-9._@+-]+|not-applicable)$/u;
export const RAW_KEY_PATTERN =
	/(?:^|_)(?:raw|prompt|transcript|secret|token|password|credential|commandOutput|reviewBody|screenshotPixels|contents?)(?:$|_)/iu;
export const SECRET_VALUE_PATTERN =
	/(?:sk-[A-Za-z0-9_-]{20,}|gh[opsru]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._~+/-]{20,}=*|BEGIN PRIVATE KEY|(?:token|secret|password|credential)=)/iu;
export const MAX_TEXT_LENGTH = 512;
