/** Frontmatter schema identifier required for governed documentation. */
export const DOC_LIFECYCLE_SCHEMA = "coding-harness-doc/v1";

/** Manifest schema identifier for the repository documentation lifecycle map. */
export const DOC_LIFECYCLE_MANIFEST_SCHEMA =
	"coding-harness-doc-lifecycle-manifest/v1";

/** Docs-gate rule emitted for documentation lifecycle metadata failures. */
export const DOC_LIFECYCLE_RULE_ID = "docs.lifecycle.metadata";

/** Required frontmatter fields for governed documentation. */
export const REQUIRED_METADATA_KEYS = [
	"doc_schema",
	"doc_type",
	"authority",
	"canon_class",
	"distribution",
	"audience",
	"lifecycle_state",
	"owner",
	"created",
	"last_reviewed",
	"review_cadence",
	"maintenance_trigger",
	"semver_impact",
	"validated_by",
	"depends_on",
] as const;

/** Allowed documentation type values. */
export const DOC_TYPES = new Set([
	"architecture",
	"contributing",
	"control-plane",
	"docs-index",
	"governance",
	"lifecycle",
	"operator-instructions",
	"product",
	"security",
	"skill",
]);

/** Allowed documentation authority values. */
export const AUTHORITIES = new Set([
	"canon",
	"supporting",
	"generated",
	"historical",
]);

/** Allowed documentation canon class values. */
export const CANON_CLASSES = new Set([
	"canonical",
	"supporting",
	"generated",
	"historical",
]);

/** Allowed documentation distribution values. */
export const DISTRIBUTIONS = new Set([
	"source-only",
	"downstream-template",
	"packaged-skill",
	"generated",
	"example-only",
]);

/** Allowed documentation lifecycle state values. */
export const LIFECYCLE_STATES = new Set([
	"proposed",
	"experimental",
	"active",
	"deprecated",
	"superseded",
	"archived",
]);

/** Allowed documentation semantic-versioning impact values. */
export const SEMVER_IMPACTS = new Set(["none", "patch", "minor", "major"]);

/** Lifecycle schema identifier for .harness cognition artifacts. */
export const HARNESS_DOCUMENT_LIFECYCLE_SCHEMA =
	"harness-document-lifecycle/v1";

/** Required frontmatter fields for governed .harness cognition artifacts. */
export const REQUIRED_HARNESS_LIFECYCLE_KEYS = [
	"source_type",
	"authority",
	"lifecycle_status",
	"canonical_destination",
	"owner",
	"created",
	"last_reviewed",
	"review_cadence",
	"validated_by",
	"depends_on",
] as const;

/** Allowed authority values for tracked .harness artifacts. */
export const HARNESS_AUTHORITIES = new Set([
	"policy",
	"decision",
	"execution-input",
	"secondary-context",
	"generated-runtime",
	"backup-scratch",
]);

/** Allowed lifecycle status values for .harness cognition artifacts. */
export const HARNESS_LIFECYCLE_STATUSES = new Set([
	"raw",
	"reviewed",
	"distilled",
	"promoted",
	"execution-input",
	"superseded",
	"archived",
]);

/** Artifact schemas that already identify Harness Engineering execution input. */
export const HARNESS_EXECUTION_ARTIFACT_SCHEMAS = new Set([
	"harness-plan/v1",
	"harness-document-lifecycle/v1",
]);

/** Required date format for lifecycle metadata date fields. */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Machine-readable lifecycle metadata carried in governed Markdown frontmatter. */
export interface DocLifecycleMetadata {
	doc_schema: string;
	doc_type: string;
	authority: string;
	canon_class: string;
	distribution: string;
	audience: string[];
	lifecycle_state: string;
	owner: string;
	created: string;
	last_reviewed: string;
	review_cadence: string;
	maintenance_trigger: string[];
	semver_impact: string;
	validated_by: string[];
	depends_on: string[];
	superseded_by?: string;
	remove_after?: string;
}

/** Machine-readable lifecycle metadata carried by .harness cognition artifacts. */
export interface HarnessLifecycleMetadata {
	artifact_schema?: string;
	lifecycle_schema?: string;
	schema_version?: string | number;
	artifact_id?: string;
	artifact_type?: string;
	canonical_slug?: string;
	plan_id?: string;
	selected_stage?: string;
	source_type?: string;
	authority?: string;
	lifecycle_status?: string;
	canonical_destination?: string;
	owner?: string;
	created?: string;
	last_reviewed?: string;
	review_cadence?: string;
	validated_by?: string[];
	depends_on?: string[];
	superseded_by?: string;
	archive_decision?: string;
	status?: string;
}

/** Manifest entry describing one governed documentation surface. */
export interface DocLifecycleManifestEntry {
	path: string;
	purpose: string;
	audience: string[];
	lifecycleStage: string;
	knowledgeCategory: string;
	canonicality: "canon" | "supporting" | "generated" | "historical";
	docType: string;
	distribution: string;
	lifecycleState: string;
	owner: string;
	semverDefault: string;
	dependsOn: string[];
}

/** Repository-wide documentation lifecycle manifest. */
export interface DocLifecycleManifest {
	schema: string;
	generatedAt: string;
	documents: DocLifecycleManifestEntry[];
}

/** One lifecycle validation failure. */
export interface DocLifecycleViolation {
	path: string;
	severity: "warning" | "error";
	message: string;
	fix: string;
	classification?: "required" | "advisory";
}

/** Full report emitted by the docs lifecycle validator. */
export interface DocLifecycleReport {
	schema: "doc-lifecycle-report/v1";
	status: "pass" | "fail";
	checkedDocuments: string[];
	checkedHarnessArtifacts: string[];
	requiredFindings: DocLifecycleViolation[];
	advisoryFindings: DocLifecycleViolation[];
	violations: DocLifecycleViolation[];
}
