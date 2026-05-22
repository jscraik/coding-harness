import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMMAND_SURFACE_DECOMPOSITION_RATCHETS = [
	{
		path: "src/commands/ci-migrate-core.ts",
		maxLines: 10_400,
		reason: "CI migration must move toward a control-plane service seam.",
	},
	{
		path: "src/lib/ci/ci-migrate-merge-queue-window.ts",
		maxLines: 380,
		reason:
			"CI migration merge-queue window state must stay focused on signed lifecycle state and replay-safety checks.",
	},
	{
		path: "src/lib/ci/repo-bound-paths.ts",
		maxLines: 220,
		reason:
			"CI migration repository path-safety seam must stay focused on repository-bounded path and file URL validation.",
	},
	{
		path: "src/commands/drift-gate.ts",
		maxLines: 1_000,
		reason:
			"Drift gate must move toward evaluator, artifact, and runner seams before it absorbs more policy.",
	},
	{
		path: "src/commands/prompt-gate.ts",
		maxLines: 25,
		reason:
			"Prompt gate command must stay a compatibility export surface; validation, argv parsing, and presentation live behind the prompt-gate module seam.",
	},
	{
		path: "src/lib/output/normalise.ts",
		maxLines: 10,
		reason:
			"Output normalisation facade must stay a public export surface, not an implementation sink.",
	},
] as const;

const OUTPUT_NORMALISE_SURFACE_RATCHETS = [
	{
		path: "src/lib/output/normalise-core-v2.ts",
		maxLines: 30,
		reason:
			"Output normalise core must stay a compatibility export surface; gate-specific behavior lives behind focused modules.",
	},
	{
		path: "src/lib/output/normalise-drift-gate.ts",
		maxLines: 100,
		reason:
			"Drift gate normalisation must stay focused on drift findings, artifact evidence, and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-docs-gate.ts",
		maxLines: 80,
		reason:
			"Docs gate normalisation must stay focused on docs findings, metadata, and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-he-phase-exit.ts",
		maxLines: 230,
		reason:
			"HE phase-exit normalisation must stay focused on phase-exit findings, evidence references, and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-linear-gate.ts",
		maxLines: 240,
		reason:
			"Linear gate normalisation must stay focused on Linear gate failure classification and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-renderer.ts",
		maxLines: 70,
		reason:
			"Output rendering must stay focused on terminal presentation for normalized gate results.",
	},
	{
		path: "src/lib/output/normalise-policy-gate.ts",
		maxLines: 130,
		reason:
			"Policy gate normalisation must stay focused on policy tier findings, decision metadata, and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-pr-template-gate.ts",
		maxLines: 100,
		reason:
			"PR template gate normalisation must stay focused on template validation findings and GateResult projection.",
	},
	{
		path: "src/lib/output/normalise-plan-gate.ts",
		maxLines: 80,
		reason:
			"Plan gate normalisation must stay focused on plan validation findings, recovery hints, and GateResult projection.",
	},
] as const;

const CLI_REGISTRY_SURFACE_RATCHETS = [
	{
		path: "src/lib/cli/registry/command-specs-core.ts",
		maxLines: 1_300,
		reason:
			"Command specs core must stay a manifest assembler; workflow-specific parsing must move behind focused command spec seams.",
	},
	{
		path: "src/lib/cli/registry/artifact-gate-command-spec.ts",
		maxLines: 20,
		reason:
			"Artifact gate command spec must stay focused on registry metadata and artifact-gate-owned argv delegation.",
	},
	{
		path: "src/lib/cli/registry/plan-gate-command-spec.ts",
		maxLines: 20,
		reason:
			"Plan gate command spec must stay focused on registry metadata and plan-gate-owned argv delegation.",
	},
	{
		path: "src/lib/cli/registry/prompt-gate-command-spec.ts",
		maxLines: 20,
		reason:
			"Prompt gate command spec must stay focused on registry metadata and prompt-gate-owned argv delegation.",
	},
	{
		path: "src/lib/cli/registry/drift-gate-command-spec.ts",
		maxLines: 25,
		reason:
			"Drift gate command spec must stay focused on registry metadata and drift-gate-owned argv delegation.",
	},
	{
		path: "src/lib/cli/registry/observability-gate-command-spec.ts",
		maxLines: 20,
		reason:
			"Observability gate command spec must stay focused on registry metadata and metric-label gate-owned argv delegation.",
	},
	{
		path: "src/lib/cli/registry/brainstorm-gate-command-spec.ts",
		maxLines: 40,
		reason:
			"Brainstorm gate command spec must stay focused on brainstorm option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/silent-error-command-spec.ts",
		maxLines: 35,
		reason:
			"Silent error command spec must stay focused on detector option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/memory-gate-command-spec.ts",
		maxLines: 20,
		reason:
			"Memory gate command spec must stay focused on command metadata and facade delegation.",
	},
	{
		path: "src/lib/cli/registry/gardener-command-spec.ts",
		maxLines: 35,
		reason:
			"Gardener command spec must stay focused on docs freshness option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/replay-command-spec.ts",
		maxLines: 20,
		reason:
			"Replay command spec must stay focused on registry metadata and replay-owned argv delegation.",
	},
	{
		path: "src/lib/cli/registry/remediate-command-spec.ts",
		maxLines: 20,
		reason:
			"Remediate command spec must stay focused on registry metadata and remediate-owned argv delegation.",
	},
	{
		path: "src/lib/cli/registry/fleet-plan-command-spec.ts",
		maxLines: 25,
		reason:
			"Fleet plan command spec must stay focused on fleet-plan command delegation.",
	},
	{
		path: "src/lib/cli/registry/next-command-spec.ts",
		maxLines: 25,
		reason: "Next command spec must stay focused on next command delegation.",
	},
	{
		path: "src/lib/cli/registry/runtime-card-command-spec.ts",
		maxLines: 25,
		reason:
			"Runtime-card command spec must stay focused on runtime-card command delegation.",
	},
	{
		path: "src/lib/cli/registry/runtime-budget-command-spec.ts",
		maxLines: 25,
		reason:
			"Runtime-budget command spec must stay focused on runtime-budget command delegation.",
	},
	{
		path: "src/lib/cli/registry/pr-closeout-command-spec.ts",
		maxLines: 25,
		reason:
			"PR closeout command spec must stay focused on PR closeout command delegation.",
	},
	{
		path: "src/lib/cli/registry/verify-coderabbit-command-spec.ts",
		maxLines: 40,
		reason:
			"CodeRabbit review evidence adapter must keep CLI option mapping and command dispatch local.",
	},
	{
		path: "src/lib/cli/registry/verify-work-command-spec.ts",
		maxLines: 25,
		reason:
			"Verify-work command adapter must stay focused on command dispatch; raw option projection lives behind the verify-work module seam.",
	},
	{
		path: "src/lib/cli/registry/docs-gate-command-spec.ts",
		maxLines: 80,
		reason:
			"Docs gate command spec must stay focused on docs-gate option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/check-command-spec.ts",
		maxLines: 25,
		reason:
			"Check command spec must stay focused on check option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/health-command-spec.ts",
		maxLines: 25,
		reason:
			"Health command spec must stay focused on health command delegation.",
	},
	{
		path: "src/lib/cli/registry/doctor-command-spec.ts",
		maxLines: 25,
		reason:
			"Doctor command spec must stay focused on doctor command delegation.",
	},
	{
		path: "src/lib/cli/registry/audit-command-spec.ts",
		maxLines: 25,
		reason: "Audit command spec must stay focused on audit command delegation.",
	},
	{
		path: "src/lib/cli/registry/org-audit-command-spec.ts",
		maxLines: 25,
		reason:
			"Org audit command spec must stay focused on org-audit command delegation.",
	},
	{
		path: "src/lib/cli/registry/tooling-audit-command-spec.ts",
		maxLines: 25,
		reason:
			"Tooling audit command spec must stay focused on tooling-audit command delegation.",
	},
	{
		path: "src/lib/cli/registry/preset-command-spec.ts",
		maxLines: 25,
		reason:
			"Preset command spec must stay focused on preset command delegation.",
	},
	{
		path: "src/lib/cli/registry/workflow-generate-command-spec.ts",
		maxLines: 40,
		reason:
			"Workflow generate command spec must stay focused on workflow generation option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/risk-tier-command-spec.ts",
		maxLines: 30,
		reason:
			"Risk tier command spec must stay focused on risk-tier option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/symphony-check-command-spec.ts",
		maxLines: 35,
		reason:
			"Symphony check command spec must stay focused on Symphony option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/license-gate-command-spec.ts",
		maxLines: 35,
		reason:
			"License gate command spec must stay focused on license option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/local-memory-preflight-command-spec.ts",
		maxLines: 60,
		reason:
			"Local memory preflight command spec must stay focused on local-memory option projection and usage-error handling.",
	},
	{
		path: "src/lib/cli/registry/check-environment-command-spec.ts",
		maxLines: 40,
		reason:
			"Check environment command spec must stay focused on environment option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/check-authz-command-spec.ts",
		maxLines: 35,
		reason:
			"Check authz command spec must stay focused on authorization option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/branch-protect-command-spec.ts",
		maxLines: 70,
		reason:
			"Branch protect command spec must stay focused on branch protection option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/preflight-gate-command-spec.ts",
		maxLines: 100,
		reason:
			"Preflight gate command spec must stay focused on preflight option projection, admission parsing, and command delegation.",
	},
	{
		path: "src/lib/cli/registry/review-gate-command-spec.ts",
		maxLines: 220,
		reason:
			"Review gate command spec must stay focused on review-gate option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/evidence-verify-command-spec.ts",
		maxLines: 45,
		reason:
			"Evidence verify command spec must stay focused on evidence file option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/linear-gate-command-spec.ts",
		maxLines: 70,
		reason:
			"Linear gate command spec must stay focused on Linear gate option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/linear-command-spec.ts",
		maxLines: 30,
		reason:
			"Linear command spec must stay a small public registry seam; parsing and delegation live behind the runner seam.",
	},
	{
		path: "src/lib/cli/registry/linear-command-runner.ts",
		maxLines: 40,
		reason:
			"Linear command runner must stay focused on Linear workflow action parsing and dispatch; action option builders live behind their own seam.",
	},
	{
		path: "src/lib/cli/registry/linear-command-actions.ts",
		maxLines: 145,
		reason:
			"Linear command actions must stay focused on action-specific option builders and command delegation.",
	},
	{
		path: "src/lib/cli/registry/linear-command-options.ts",
		maxLines: 160,
		reason:
			"Linear command options must stay focused on action and flag projection for the Linear registry seam.",
	},
	{
		path: "src/lib/cli/registry/pr-template-gate-command-spec.ts",
		maxLines: 50,
		reason:
			"PR template gate command spec must stay focused on PR template gate option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/rule-lifecycle-gate-command-spec.ts",
		maxLines: 70,
		reason:
			"Rule lifecycle gate command spec must stay focused on rule lifecycle option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/policy-gate-command-spec.ts",
		maxLines: 90,
		reason:
			"Policy gate command spec must stay focused on policy gate option projection and command delegation.",
	},
	{
		path: "src/lib/cli/registry/command-capabilities.ts",
		maxLines: 360,
		reason:
			"Command capabilities must stay the public catalog builder; catalog policy tables stay behind command-capability-rules.ts.",
	},
	{
		path: "src/lib/cli/registry/command-capability-rules.ts",
		maxLines: 340,
		reason:
			"Command capability rules must stay focused on static catalog classification tables.",
	},
] as const;

const PR_CLOSEOUT_SURFACE_RATCHETS = [
	{
		path: "src/lib/pr-closeout/evaluator.ts",
		maxLines: 170,
		reason:
			"PR closeout evaluator must stay focused on report assembly; recovery metadata stays behind the recovery seam.",
	},
	{
		path: "src/lib/pr-closeout/recovery.ts",
		maxLines: 170,
		reason:
			"PR closeout recovery seam must stay focused on attempt-ledger and recovery-event construction.",
	},
] as const;

const PROMPT_GATE_SURFACE_RATCHETS = [
	{
		path: "src/lib/prompt-gate/types.ts",
		maxLines: 80,
		reason:
			"Prompt gate shared types must stay small enough to remain a stable module contract.",
	},
	{
		path: "src/lib/prompt-gate/validator.ts",
		maxLines: 140,
		reason:
			"Prompt gate validation must stay focused on template section checks and result construction.",
	},
	{
		path: "src/lib/prompt-gate/cli-args.ts",
		maxLines: 55,
		reason:
			"Prompt gate CLI args must stay focused on raw argv projection and usage-error messages.",
	},
	{
		path: "src/lib/prompt-gate/cli.ts",
		maxLines: 90,
		reason:
			"Prompt gate CLI presentation must stay focused on output formatting and exit-code mapping.",
	},
] as const;

const HE_PHASE_EXIT_TRUST_RATCHETS = [
	{
		path: "src/lib/decision/he-phase-exit-core.ts",
		maxLines: 1_750,
		reason:
			"HE phase-exit core must keep moving trust, artifact, and adapter policy behind focused seams.",
	},
	{
		path: "src/lib/decision/he-gate-trust-policy.ts",
		maxLines: 220,
		reason:
			"HE gate trust policy must stay focused on status, execution-mode, finding, and evidence-reference trust rules.",
	},
] as const;

const REVIEW_GATE_DECISION_PACKET_RATCHETS = [
	{
		path: "src/lib/review-gate/required-check-manifest.ts",
		maxLines: 95,
		reason:
			"Review-gate required-check manifest seam must stay focused on manifest path resolution, loading, and normalization errors.",
	},
	{
		path: "src/lib/review-gate/required-checks.ts",
		maxLines: 350,
		reason:
			"Review-gate required-check seam must stay focused on check-name, alias, manifest, and source-authority resolution.",
	},
	{
		path: "src/lib/review-gate/required-check-sources.ts",
		maxLines: 220,
		reason:
			"Review-gate required-check source seam must stay focused on provider identity normalization and source-authority constraint resolution.",
	},
	{
		path: "src/lib/review-gate/decision-packet.ts",
		maxLines: 390,
		reason:
			"Review-gate decision packet must stay an artifact assembly seam; recovery and run-record metadata stay behind focused modules.",
	},
	{
		path: "src/lib/review-gate/recovery.ts",
		maxLines: 170,
		reason:
			"Review-gate recovery seam must stay focused on attempt-ledger and recovery-event construction.",
	},
	{
		path: "src/lib/review-gate/run-record.ts",
		maxLines: 180,
		reason:
			"Review-gate run-record seam must stay focused on terminal run-record emission and classification.",
	},
	{
		path: "src/lib/review-gate/decision-packet-types.ts",
		maxLines: 50,
		reason:
			"Review-gate shared decision-packet types must stay small enough to remain an internal import seam.",
	},
] as const;

const NEXT_SURFACE_RATCHETS = [
	{
		path: "src/commands/next.ts",
		maxLines: 160,
		reason:
			"Harness next must stay a decision producer; keep CLI parsing behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/next-args.ts",
		maxLines: 265,
		reason:
			"Harness next argument parsing must stay focused on CLI token parsing, public parser docs, and usage-error shape.",
	},
	{
		path: "src/commands/next-usage-errors.ts",
		maxLines: 160,
		reason:
			"Harness next usage-error decisions must stay focused on translating parser errors into blocked decisions.",
	},
	{
		path: "src/commands/next-runner.ts",
		maxLines: 250,
		reason:
			"Harness next runner must stay focused on decision production; CLI artifact loading and output stay in the command facade.",
	},
	{
		path: "src/commands/next-decisions.ts",
		maxLines: 80,
		reason:
			"Harness next decisions must stay a public decision seam; blocked, metadata, and recommendation internals stay behind focused modules.",
	},
	{
		path: "src/commands/next-blocked-decisions.ts",
		maxLines: 300,
		reason:
			"Harness next blocked decisions must stay focused on source, git, phase-exit, and runtime-card blockers.",
	},
	{
		path: "src/commands/next-decision-meta.ts",
		maxLines: 120,
		reason:
			"Harness next decision metadata must stay focused on normalized operational evidence.",
	},
	{
		path: "src/commands/next-decision-types.ts",
		maxLines: 40,
		reason:
			"Harness next shared types must stay small enough to remain a stable import seam.",
	},
	{
		path: "src/commands/next-recommendation-decisions.ts",
		maxLines: 260,
		reason:
			"Harness next recommendation decisions must stay focused on changed-file and fleet-matrix recommendations.",
	},
] as const;

const RUNTIME_CARD_SURFACE_RATCHETS = [
	{
		path: "src/commands/runtime-card.ts",
		maxLines: 300,
		reason:
			"Runtime-card command must stay focused on artifact safety, card building, and output rendering; keep CLI parsing behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/runtime-card-args.ts",
		maxLines: 170,
		reason:
			"Runtime-card argument parsing must stay focused on CLI token parsing and runtime-card option shape.",
	},
] as const;

const REPLAY_SURFACE_RATCHETS = [
	{
		path: "src/lib/replay/cli-args.ts",
		maxLines: 60,
		reason:
			"Replay argument parsing must stay focused on raw CLI token projection and replay option shape.",
	},
	{
		path: "src/lib/replay/options.ts",
		maxLines: 60,
		reason:
			"Replay option and trace resolution contracts must stay small enough for registry adapters and command facades to share.",
	},
	{
		path: "src/commands/replay.ts",
		maxLines: 170,
		reason:
			"Replay command must stay a command facade; argv projection, output, resolution, run-record, and recovery metadata stay behind named replay seams.",
	},
	{
		path: "src/commands/replay-run-record.ts",
		maxLines: 235,
		reason:
			"Replay run-record seam must stay focused on canonical run-record emission, public run-record docs, attempt ledger, and recovery event metadata.",
	},
	{
		path: "src/commands/replay-output.ts",
		maxLines: 115,
		reason:
			"Replay output seam must stay focused on terminal and JSON presentation for replay results.",
	},
	{
		path: "src/commands/replay-resolution.ts",
		maxLines: 90,
		reason:
			"Replay resolution seam must stay focused on trace directory validation and trace lookup.",
	},
] as const;

const REMEDIATE_SURFACE_RATCHETS = [
	{
		path: "src/commands/remediate.ts",
		maxLines: 285,
		reason:
			"Remediate command must stay a command facade; finding normalization, git probes, and run-record emission stay behind focused seams.",
	},
	{
		path: "src/commands/remediate-git.ts",
		maxLines: 95,
		reason:
			"Remediate git seam must stay focused on local HEAD, workspace status, and ancestry probes.",
	},
	{
		path: "src/commands/remediate-findings.ts",
		maxLines: 210,
		reason:
			"Remediate finding normalization must stay focused on provider detection, JSON parsing, and canonical finding conversion.",
	},
	{
		path: "src/commands/remediate-run-record.ts",
		maxLines: 230,
		reason:
			"Remediate run-record seam must stay focused on canonical terminal run-record emission and classification.",
	},
] as const;

const VERIFY_WORK_SURFACE_RATCHETS = [
	{
		path: "src/commands/verify-work.ts",
		maxLines: 25,
		reason:
			"Verify-work command must stay a command facade; wrapper execution and argument construction live behind the verify-work module seam.",
	},
	{
		path: "src/lib/verify-work.ts",
		maxLines: 10,
		reason:
			"Verify-work public facade must stay an export surface, not an implementation sink.",
	},
	{
		path: "src/lib/verify-work/cli-args.ts",
		maxLines: 95,
		reason:
			"Verify-work CLI args seam must stay focused on raw flag validation and typed option projection.",
	},
	{
		path: "src/lib/verify-work/args.ts",
		maxLines: 60,
		reason:
			"Verify-work args seam must stay focused on wrapper flag construction.",
	},
	{
		path: "src/lib/verify-work/runner.ts",
		maxLines: 115,
		reason:
			"Verify-work runner seam must stay focused on wrapper execution and exit-code mapping.",
	},
	{
		path: "src/lib/verify-work/types.ts",
		maxLines: 25,
		reason:
			"Verify-work types seam must stay focused on the public command contract.",
	},
] as const;

const MEMORY_GATE_SURFACE_RATCHETS = [
	{
		path: "src/commands/memory-gate.ts",
		maxLines: 25,
		reason:
			"Memory gate command must stay a command facade; Local Memory compliance internals live behind the memory-gate module seam.",
	},
	{
		path: "src/lib/memory-gate.ts",
		maxLines: 15,
		reason:
			"Memory gate public facade must stay a small export surface for command and registry callers.",
	},
	{
		path: "src/lib/cli/registry/memory-gate-command-spec.ts",
		maxLines: 20,
		reason:
			"Memory gate command spec must stay focused on command metadata and facade delegation.",
	},
	{
		path: "src/lib/memory/cli-args.ts",
		maxLines: 50,
		reason:
			"Memory gate CLI argument adapter must stay focused on raw flag projection before command execution.",
	},
	{
		path: "src/lib/memory/validator.ts",
		maxLines: 430,
		reason:
			"Memory validator may stay deep, but CLI presentation and metrics persistence must stay behind their own seam.",
	},
	{
		path: "src/lib/memory/cli.ts",
		maxLines: 130,
		reason:
			"Memory gate CLI seam must stay focused on presentation, metrics persistence, and facade result rendering.",
	},
	{
		path: "src/lib/memory/types.ts",
		maxLines: 305,
		reason:
			"Memory gate types must stay the Local Memory compliance contract behind the public facade.",
	},
] as const;

const DRIFT_GATE_SURFACE_RATCHETS = [
	{
		path: "src/lib/drift-gate.ts",
		maxLines: 25,
		reason:
			"Drift gate public facade must stay a small export surface for registry and output callers.",
	},
	{
		path: "src/lib/cli/registry/drift-gate-command-spec.ts",
		maxLines: 25,
		reason:
			"Drift gate command spec must stay focused on registry metadata and drift-gate-owned argv delegation.",
	},
	{
		path: "src/lib/drift-gate/cli-args.ts",
		maxLines: 120,
		reason:
			"Drift gate CLI argument adapter must stay focused on raw flag projection before command execution.",
	},
	{
		path: "src/lib/output/normalise-drift-gate.ts",
		maxLines: 100,
		reason:
			"Drift gate normalisation must stay focused on drift findings, artifact evidence, and GateResult projection through the facade.",
	},
] as const;

const OBSERVABILITY_GATE_SURFACE_RATCHETS = [
	{
		path: "src/commands/observability-gate.ts",
		maxLines: 15,
		reason:
			"Observability gate command must stay a compatibility facade; metric-label gate internals live behind the observability-gate module seam.",
	},
	{
		path: "src/lib/observability-gate.ts",
		maxLines: 15,
		reason:
			"Observability gate public facade must stay a small export surface for command and registry callers.",
	},
	{
		path: "src/lib/cli/registry/observability-gate-command-spec.ts",
		maxLines: 20,
		reason:
			"Observability gate command spec must stay focused on registry metadata and metric-label gate-owned argv delegation.",
	},
	{
		path: "src/lib/observability-gate/cli-args.ts",
		maxLines: 55,
		reason:
			"Observability gate CLI argument adapter must stay focused on raw flag projection before command execution.",
	},
	{
		path: "src/lib/observability-gate/label-cardinality.ts",
		maxLines: 105,
		reason:
			"Observability gate label-cardinality seam must stay focused on parsing labels, building cardinality policy, and running metric-label validation.",
	},
	{
		path: "src/lib/observability-gate/cli.ts",
		maxLines: 75,
		reason:
			"Observability gate CLI seam must stay focused on result presentation and exit-code mapping.",
	},
	{
		path: "src/lib/observability-gate/types.ts",
		maxLines: 45,
		reason:
			"Observability gate types must describe the metric-label gate contract without absorbing validation behavior.",
	},
] as const;

const ARTIFACT_GATE_SURFACE_RATCHETS = [
	{
		path: "src/commands/artifact-gate.ts",
		maxLines: 10,
		reason:
			"Artifact gate command must stay a compatibility facade; artifact provenance CLI behavior lives behind the artifact-gate module seam.",
	},
	{
		path: "src/lib/artifact-gate.ts",
		maxLines: 30,
		reason:
			"Artifact gate public facade must stay a small export surface for command and registry callers.",
	},
	{
		path: "src/lib/cli/registry/artifact-gate-command-spec.ts",
		maxLines: 20,
		reason:
			"Artifact gate command spec must stay focused on registry metadata and artifact-gate-owned argv delegation.",
	},
	{
		path: "src/lib/artifact-gate/cli-args.ts",
		maxLines: 55,
		reason:
			"Artifact gate CLI argument adapter must stay focused on raw flag projection before command execution.",
	},
	{
		path: "src/lib/artifact-gate/cli.ts",
		maxLines: 85,
		reason:
			"Artifact gate CLI seam must stay focused on usage output, result presentation, and exit-code mapping.",
	},
	{
		path: "src/lib/artifact-gate/types.ts",
		maxLines: 40,
		reason:
			"Artifact gate types must describe the CLI contract without absorbing provenance evaluation behavior.",
	},
] as const;

const PLAN_GATE_SURFACE_RATCHETS = [
	{
		path: "src/commands/plan-gate.ts",
		maxLines: 25,
		reason:
			"Plan gate command must stay a compatibility facade; plan validation CLI behavior lives behind the plan-gate module seam.",
	},
	{
		path: "src/lib/cli/registry/plan-gate-command-spec.ts",
		maxLines: 20,
		reason:
			"Plan gate command spec must stay focused on registry metadata and plan-gate-owned argv delegation.",
	},
	{
		path: "src/lib/plan-gate/cli-args.ts",
		maxLines: 65,
		reason:
			"Plan gate CLI argument adapter must stay focused on raw flag projection before command execution.",
	},
	{
		path: "src/lib/plan-gate/cli.ts",
		maxLines: 155,
		reason:
			"Plan gate CLI seam must stay focused on result presentation, recovery hints, and exit-code mapping.",
	},
] as const;

const RUNTIME_CARD_RUNTIME_RATCHETS = [
	{
		path: "src/lib/runtime/runtime-card.ts",
		maxLines: 260,
		reason:
			"Runtime-card contract must stay focused on public types, schema version, blocker predicate, and metadata normalization.",
	},
	{
		path: "src/lib/runtime/runtime-card-validation.ts",
		maxLines: 300,
		reason:
			"Runtime-card validation must stay focused on shape validation orchestration; recovery metadata checks stay behind their own seam.",
	},
	{
		path: "src/lib/runtime/runtime-card-recovery-validation.ts",
		maxLines: 220,
		reason:
			"Runtime-card recovery validation must stay focused on attempt ledger and recovery event checks.",
	},
] as const;

const LOCAL_RUNTIME_CARD_SURFACE_RATCHETS = [
	{
		path: "src/lib/runtime/local-runtime-card.ts",
		maxLines: 180,
		reason:
			"Local runtime-card builder must stay focused on local evidence collection; assembly, live providers, artifact seams, and phase-exit seams should not grow back into the facade.",
	},
	{
		path: "src/lib/runtime/local-runtime-card-assembly.ts",
		maxLines: 175,
		reason:
			"Runtime-card assembly must stay focused on lifecycle, blocker/source merging, fallback tracker state, and schema validation.",
	},
	{
		path: "src/lib/runtime/local-runtime-card-attempts.ts",
		maxLines: 120,
		reason:
			"Runtime-card attempt metadata must stay focused on retry ownership, recovery event shape, and evidence references.",
	},
	{
		path: "src/lib/runtime/local-runtime-card-artifacts.ts",
		maxLines: 160,
		reason:
			"Runtime-card artifact inspection must stay focused on active-artifact index parsing and stale reference classification.",
	},
	{
		path: "src/lib/runtime/local-runtime-card-phase-exit.ts",
		maxLines: 150,
		reason:
			"Runtime-card phase-exit seam must stay focused on HePhaseExit/v1 reading, validation, and status collapse.",
	},
	{
		path: "src/lib/runtime/local-runtime-card-live.ts",
		maxLines: 270,
		reason:
			"Runtime-card live provider seam must stay focused on bounded GitHub and Linear refresh behavior.",
	},
] as const;

const DOCTOR_SURFACE_RATCHETS = [
	{
		path: "src/commands/doctor.ts",
		maxLines: 210,
		reason:
			"Doctor runner must stay thin; keep rendering, prerequisite checks, and artifacts behind focused command seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-renderer.ts",
		maxLines: 90,
		reason:
			"Doctor renderer must stay presentation-only; keep checks and report construction in doctor modules.",
	},
	{
		path: "src/commands/doctor-checks.ts",
		maxLines: 40,
		reason:
			"Doctor check catalogue must stay a thin composition module after check families have been split.",
	},
	{
		path: "src/commands/doctor-check-utils.ts",
		maxLines: 80,
		reason:
			"Doctor check utilities must stay generic; move surface-specific behavior into check-family modules.",
	},
	{
		path: "src/commands/doctor-tool-checks.ts",
		maxLines: 170,
		reason:
			"Doctor tool checks must stay focused; keep provider-specific checks behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-github-tool-checks.ts",
		maxLines: 80,
		reason:
			"Doctor GitHub tool checks must stay focused on gh availability and authentication.",
	},
	{
		path: "src/commands/doctor-file-checks.ts",
		maxLines: 200,
		reason:
			"Doctor file checks must stay focused; keep governance document checks behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-roadmap-file-checks.ts",
		maxLines: 80,
		reason:
			"Doctor roadmap file checks must stay focused on roadmap governance documents.",
	},
	{
		path: "src/commands/doctor-config-checks.ts",
		maxLines: 90,
		reason:
			"Doctor config checks must stay focused; keep north-star contract readiness behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-north-star-contract-checks.ts",
		maxLines: 130,
		reason:
			"Doctor north-star contract checks must stay focused on contract readiness and governed surface ownership.",
	},
	{
		path: "src/commands/doctor-ci-checks.ts",
		maxLines: 80,
		reason:
			"Doctor CI checks must stay focused; keep required-check identity behind focused seams before raising this limit.",
	},
	{
		path: "src/commands/doctor-ci-check-alignment.ts",
		maxLines: 130,
		reason:
			"Doctor CI check alignment must stay focused on required-check identity and branch-protection naming.",
	},
] as const;

const SCAFFOLD_SURFACE_RATCHETS = [
	{
		path: "src/lib/init/scaffold.ts",
		maxLines: 450,
		reason:
			"Scaffold entrypoint must stay a thin orchestrator; extract surface-specific rendering modules before raising this limit.",
	},
	{
		path: "src/lib/init/scaffold-template-registry.ts",
		maxLines: 425,
		reason:
			"Scaffold template registry must stay an inventory seam; extract focused template groups before raising this limit.",
	},
	{
		path: "src/lib/init/scaffold-script-template-registry.ts",
		maxLines: 225,
		reason:
			"Scaffold script template registry must stay focused; extract script-family renderers before raising this limit.",
	},
] as const;

const TRANSITIONAL_LIB_TO_COMMAND_IMPORTS = new Set([
	"src/lib/cli/registry/command-specs.ts",
	"src/lib/cli/registry/command-specs-core.ts",
	"src/lib/cli/registry/artifact-gate-command-spec.ts",
	"src/lib/cli/registry/audit-command-spec.ts",
	"src/lib/cli/registry/brainstorm-gate-command-spec.ts",
	"src/lib/cli/registry/branch-protect-command-spec.ts",
	"src/lib/cli/registry/check-authz-command-spec.ts",
	"src/lib/cli/registry/check-command-spec.ts",
	"src/lib/cli/registry/check-environment-command-spec.ts",
	"src/lib/cli/registry/docs-gate-command-spec.ts",
	"src/lib/cli/registry/doctor-command-spec.ts",
	"src/lib/cli/registry/evidence-verify-command-spec.ts",
	"src/lib/cli/registry/fleet-plan-command-spec.ts",
	"src/lib/cli/registry/gardener-command-spec.ts",
	"src/lib/cli/registry/health-command-spec.ts",
	"src/lib/cli/registry/license-gate-command-spec.ts",
	"src/lib/cli/registry/local-memory-preflight-command-spec.ts",
	"src/lib/cli/registry/next-command-spec.ts",
	"src/lib/cli/registry/org-audit-command-spec.ts",
	"src/lib/cli/registry/preflight-gate-command-spec.ts",
	"src/lib/cli/registry/replay-command-spec.ts",
	"src/lib/cli/registry/remediate-command-spec.ts",
	"src/lib/cli/registry/review-gate-command-spec.ts",
	"src/lib/cli/registry/risk-tier-command-spec.ts",
	"src/lib/cli/registry/runtime-card-command-spec.ts",
	"src/lib/cli/registry/runtime-budget-command-spec.ts",
	"src/lib/cli/registry/silent-error-command-spec.ts",
	"src/lib/cli/registry/linear-gate-command-spec.ts",
	"src/lib/cli/registry/linear-command-actions.ts",
	"src/lib/cli/registry/linear-command-runner.ts",
	"src/lib/cli/registry/linear-command-spec.ts",
	"src/lib/cli/registry/policy-gate-command-spec.ts",
	"src/lib/cli/registry/plan-gate-command-spec.ts",
	"src/lib/cli/registry/preset-command-spec.ts",
	"src/lib/cli/registry/pr-closeout-command-spec.ts",
	"src/lib/cli/registry/pr-template-gate-command-spec.ts",
	"src/lib/cli/registry/rule-lifecycle-gate-command-spec.ts",
	"src/lib/cli/registry/symphony-check-command-spec.ts",
	"src/lib/cli/registry/tooling-audit-command-spec.ts",
	"src/lib/cli/registry/verify-coderabbit-command-spec.ts",
	"src/lib/cli/registry/verify-work-command-spec.ts",
	"src/lib/cli/registry/workflow-generate-command-spec.ts",
	"src/lib/init/index.ts",
	"src/lib/drift-gate.ts",
	"src/lib/output/normalise.ts",
	"src/lib/output/normalise-core-v2.ts",
	"src/lib/output/normalise-docs-gate.ts",
	"src/lib/output/normalise-he-phase-exit.ts",
	"src/lib/output/normalise-linear-gate.ts",
	"src/lib/output/normalise-plan-gate.ts",
	"src/lib/output/normalise-policy-gate.ts",
	"src/lib/output/normalise-pr-template-gate.ts",
]);

const COMMAND_IMPORT_PATTERN = /^(?:\.\.\/)+commands\//;
const EFFECT_IMPORT_PATTERN = /^effect(?:\/.*)?$/;
const PR_CLOSEOUT_INTERNAL_IMPORT_PATTERN =
	/^.*lib\/pr-closeout\/(?:blockers|claim-builders|claim-helpers|claims|evidence|evidence-summaries|evaluator|recovery|status|types)\.js$/;
const IMPORT_SPECIFIER_PATTERN =
	/(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["'](?<specifier>[^"']+)["']/g;
const APPROVED_EFFECT_BOUNDARIES = new Set([
	"src/lib/missing-context/classifier.ts",
	"src/lib/pr-closeout/evaluator.ts",
]);
const APPROVED_PR_CLOSEOUT_INTERNAL_IMPORTERS = new Set([
	"src/lib/pr-closeout.ts",
]);
const APPROVED_PR_CLOSEOUT_PARENT_IMPORTS = new Map<string, readonly string[]>([
	[
		"src/lib/pr-closeout/types.ts",
		[
			"../decision/he-phase-exit.js",
			"../harness-assurance.js",
			"../missing-context/classifier.js",
			"../runtime/runtime-evidence-contract.js",
		],
	],
	[
		"src/lib/pr-closeout/evidence-summaries.ts",
		["../harness-assurance.js", "../runtime/runtime-evidence-contract.js"],
	],
	["src/lib/pr-closeout/blockers.ts", ["../decision/he-phase-exit.js"]],
	[
		"src/lib/pr-closeout/claim-helpers.ts",
		["../missing-context/classifier.js"],
	],
]);
const PR_CLOSEOUT_COMMAND_SUBMODULES = [
	"./pr-closeout/args.js",
	"./pr-closeout/input-validation.js",
	"./pr-closeout/live.js",
	"./pr-closeout/types.js",
] as const;

const DOCTOR_COMMAND_SUBMODULES = [
	"./doctor-artifacts.js",
	"./doctor-checks.js",
	"./doctor-recovery.js",
	"./doctor-renderer.js",
] as const;

const DOCTOR_TOOL_SUBMODULES = ["./doctor-github-tool-checks.js"] as const;
const DOCTOR_FILE_SUBMODULES = ["./doctor-roadmap-file-checks.js"] as const;
const DOCTOR_CI_SUBMODULES = ["./doctor-ci-check-alignment.js"] as const;
const DOCTOR_CONFIG_SUBMODULES = [
	"./doctor-north-star-contract-checks.js",
] as const;
const CLI_REGISTRY_SPEC_SUBMODULES = [
	"./artifact-gate-command-spec.js",
	"./brainstorm-gate-command-spec.js",
	"./branch-protect-command-spec.js",
	"./audit-command-spec.js",
	"./check-authz-command-spec.js",
	"./check-command-spec.js",
	"./check-environment-command-spec.js",
	"./docs-gate-command-spec.js",
	"./doctor-command-spec.js",
	"./drift-gate-command-spec.js",
	"./evidence-verify-command-spec.js",
	"./fleet-plan-command-spec.js",
	"./gardener-command-spec.js",
	"./health-command-spec.js",
	"./license-gate-command-spec.js",
	"./local-memory-preflight-command-spec.js",
	"./memory-gate-command-spec.js",
	"./next-command-spec.js",
	"./observability-gate-command-spec.js",
	"./org-audit-command-spec.js",
	"./plan-gate-command-spec.js",
	"./prompt-gate-command-spec.js",
	"./preflight-gate-command-spec.js",
	"./replay-command-spec.js",
	"./remediate-command-spec.js",
	"./review-gate-command-spec.js",
	"./risk-tier-command-spec.js",
	"./runtime-budget-command-spec.js",
	"./runtime-card-command-spec.js",
	"./silent-error-command-spec.js",
	"./linear-command-spec.js",
	"./linear-gate-command-spec.js",
	"./policy-gate-command-spec.js",
	"./preset-command-spec.js",
	"./pr-closeout-command-spec.js",
	"./pr-template-gate-command-spec.js",
	"./rule-lifecycle-gate-command-spec.js",
	"./symphony-check-command-spec.js",
	"./tooling-audit-command-spec.js",
	"./verify-coderabbit-command-spec.js",
	"./verify-work-command-spec.js",
	"./workflow-generate-command-spec.js",
] as const;
const LINEAR_COMMAND_RUNNER_SUBMODULES = [
	"./linear-command-actions.js",
] as const;
const NEXT_COMMAND_SUBMODULES = [
	"./next-args.js",
	"./next-decisions.js",
	"./next-phase-exit.js",
	"./next-runner.js",
	"./next-runtime-card.js",
	"./next-usage-errors.js",
] as const;
const NEXT_DECISION_SUBMODULES = [
	"./next-blocked-decisions.js",
	"./next-recommendation-decisions.js",
] as const;
const REPLAY_COMMAND_SUBMODULES = [
	"./replay-output.js",
	"./replay-resolution.js",
	"./replay-run-record.js",
] as const;
const REMEDIATE_COMMAND_SUBMODULES = [
	"./remediate-findings.js",
	"./remediate-git.js",
	"./remediate-run-record.js",
] as const;
const PR_CLOSEOUT_EVALUATOR_SUBMODULES = [
	"./evidence-summaries.js",
	"./recovery.js",
] as const;
const REVIEW_GATE_CORE_SUBMODULES = [
	"../lib/review-gate/required-check-manifest.js",
	"../lib/review-gate/required-checks.js",
] as const;
const REVIEW_GATE_CORE_FORBIDDEN_SYMBOLS = [
	"class RequiredChecksManifestError",
	"function evaluateRequiredChecks",
	"function resolveReviewCheckResult",
	"function resolveRequiredCheckSources",
] as const;
const REVIEW_GATE_DECISION_PACKET_SUBMODULES = [
	"./recovery.js",
	"./run-record.js",
] as const;
const REVIEW_GATE_DECISION_PACKET_FORBIDDEN_SYMBOLS = [
	"function resolveReviewGateFailureClass",
	"function resolveReviewGateRecoveryOwner",
	"function resolveReviewGateNextAction",
	"function resolveRunRecordOutcome",
	"function resolveRunRecordClassification",
	"function resolveRunRecordEventStatus",
	"function resolveRunRecordEventSeverity",
] as const;
const RUNTIME_CARD_COMMAND_SUBMODULES = ["./runtime-card-args.js"] as const;
const RUNTIME_CARD_CONTRACT_SUBMODULES = [
	"./runtime-card-validation.js",
] as const;
const RUNTIME_CARD_VALIDATION_SUBMODULES = [
	"./runtime-card-recovery-validation.js",
] as const;
const RUNTIME_CARD_INTERNAL_VALIDATION_IMPORTS = new Set([
	"./runtime-card-validation.js",
	"./runtime-card-recovery-validation.js",
]);
const APPROVED_RUNTIME_CARD_INTERNAL_VALIDATION_IMPORTERS = new Map<
	string,
	readonly string[]
>([
	["src/lib/runtime/runtime-card.ts", ["./runtime-card-validation.js"]],
	[
		"src/lib/runtime/runtime-card-validation.ts",
		["./runtime-card-recovery-validation.js"],
	],
]);
const LOCAL_RUNTIME_CARD_SUBMODULES = [
	"./local-runtime-card-assembly.js",
	"./local-runtime-card-artifacts.js",
	"./local-runtime-card-live.js",
	"./local-runtime-card-phase-exit.js",
] as const;
const LOCAL_RUNTIME_CARD_ASSEMBLY_SUBMODULES = [
	"./local-runtime-card-attempts.js",
] as const;
const COMMAND_CAPABILITY_SUBMODULES = [
	"./command-capability-rules.js",
] as const;
const OUTPUT_NORMALISE_SUBMODULES = [
	"./normalise-docs-gate.js",
	"./normalise-drift-gate.js",
	"./normalise-he-phase-exit.js",
	"./normalise-linear-gate.js",
	"./normalise-plan-gate.js",
	"./normalise-policy-gate.js",
	"./normalise-pr-template-gate.js",
	"./normalise-renderer.js",
] as const;
const VERIFY_WORK_PUBLIC_FACADE_SUBMODULES = [
	"./verify-work/cli-args.js",
	"./verify-work/runner.js",
	"./verify-work/types.js",
] as const;
const VERIFY_WORK_INTERNAL_IMPORT_PATTERN =
	/^(?:\.\.?\/)*(?:lib\/)?verify-work\/(?:args|cli-args|runner|types)\.js$/;
const APPROVED_VERIFY_WORK_INTERNAL_IMPORTERS = new Set([
	"src/lib/verify-work.ts",
]);
const MEMORY_GATE_PUBLIC_FACADE_SUBMODULES = [
	"./memory/cli-args.js",
	"./memory/cli.js",
	"./memory/validator.js",
	"./memory/types.js",
] as const;
const MEMORY_GATE_INTERNAL_IMPORT_PATTERN =
	/^.*memory\/(?:branch-enforcer|cli|cli-args|metrics-tracker|types|validator)\.js$/;
const APPROVED_MEMORY_GATE_INTERNAL_IMPORTERS = new Set([
	"src/lib/memory-gate.ts",
]);
const DRIFT_GATE_COMMAND_IMPORT_PATTERN = /^.*commands\/drift-gate\.js$/;
const APPROVED_DRIFT_GATE_COMMAND_IMPORTERS = new Set([
	"src/lib/drift-gate.ts",
]);

function countFileLines(path: string): number {
	const content = readFileSync(join(process.cwd(), path), "utf-8");
	return content.split("\n").length;
}

function expectRatchetsWithinBudget(
	ratchets: readonly { path: string; maxLines: number; reason: string }[],
): void {
	for (const moduleRatchet of ratchets) {
		const lineCount = countFileLines(moduleRatchet.path);

		expect(
			lineCount,
			`${moduleRatchet.path} has ${lineCount} lines; ${moduleRatchet.reason}`,
		).toBeLessThanOrEqual(moduleRatchet.maxLines);
	}
}

function collectTypeScriptFiles(directory: string): string[] {
	const root = join(process.cwd(), directory);
	const files: string[] = [];

	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const relativePath = join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...collectTypeScriptFiles(relativePath));
			continue;
		}

		if (
			entry.isFile() &&
			relativePath.endsWith(".ts") &&
			!relativePath.endsWith(".test.ts") &&
			!relativePath.endsWith(".spec.ts") &&
			!relativePath.endsWith(".d.ts")
		) {
			files.push(relativePath);
		}
	}

	return files;
}

function importSpecifiers(content: string): string[] {
	return [...content.matchAll(IMPORT_SPECIFIER_PATTERN)].map((match) => {
		const specifier = match.groups?.specifier;
		if (!specifier) {
			throw new Error("Import specifier regex did not capture a specifier.");
		}
		return specifier;
	});
}

describe("module boundaries", () => {
	it("keeps command registry as a thin loader module", () => {
		const registryPath = "src/lib/cli/command-registry.ts";
		const content = readFileSync(join(process.cwd(), registryPath), "utf-8");
		expect(content).toContain("./registry/command-capabilities.js");
		expect(content).toContain("./registry/fuzzy-resolution.js");
		expect(countFileLines(registryPath)).toBeLessThanOrEqual(220);
	});

	it("keeps command capability catalog split from static rules", () => {
		expectRatchetsWithinBudget(CLI_REGISTRY_SURFACE_RATCHETS);

		const capabilitiesContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/command-capabilities.ts"),
			"utf-8",
		);

		for (const submodule of COMMAND_CAPABILITY_SUBMODULES) {
			expect(capabilitiesContent).toContain(submodule);
		}
	});

	it("keeps validator entrypoint below monolith threshold and split by domain", () => {
		const validatorPath = "src/lib/contract/validator.ts";
		const content = readFileSync(join(process.cwd(), validatorPath), "utf-8");
		expect(content).toContain("./policy-validators.js");
		expect(content).toContain("./validator-helpers.js");
		expect(countFileLines(validatorPath)).toBeLessThanOrEqual(2700);
	});

	it("keeps PR closeout evaluator split after decomposition", () => {
		expectRatchetsWithinBudget(PR_CLOSEOUT_SURFACE_RATCHETS);
	});

	it("keeps PR closeout recovery metadata behind the evaluator seam", () => {
		const evaluatorPath = "src/lib/pr-closeout/evaluator.ts";
		const evaluatorContent = readFileSync(
			join(process.cwd(), evaluatorPath),
			"utf-8",
		);

		for (const submodule of PR_CLOSEOUT_EVALUATOR_SUBMODULES) {
			expect(evaluatorContent).toContain(submodule);
		}
	});

	it("keeps HE phase-exit trust policy split after decomposition", () => {
		expectRatchetsWithinBudget(HE_PHASE_EXIT_TRUST_RATCHETS);

		const coreContent = readFileSync(
			join(process.cwd(), "src/lib/decision/he-phase-exit-core.ts"),
			"utf-8",
		);
		expect(coreContent).toContain("./he-gate-trust-policy.js");
		expect(coreContent).not.toContain("function validateGateConsistency");
	});

	it("keeps review-gate decision packet seams split after decomposition", () => {
		expectRatchetsWithinBudget(REVIEW_GATE_DECISION_PACKET_RATCHETS);
	});

	it("keeps review-gate required-check logic behind the command seam", () => {
		const corePath = "src/commands/review-gate-core.ts";
		const coreContent = readFileSync(join(process.cwd(), corePath), "utf-8");
		const coreImports = importSpecifiers(coreContent);

		for (const submodule of REVIEW_GATE_CORE_SUBMODULES) {
			expect(coreImports).toContain(submodule);
		}

		for (const extractedSymbol of REVIEW_GATE_CORE_FORBIDDEN_SYMBOLS) {
			expect(coreContent).not.toContain(extractedSymbol);
		}
	});

	it("keeps review-gate recovery and run-record metadata behind the decision packet seam", () => {
		const decisionPacketPath = "src/lib/review-gate/decision-packet.ts";
		const decisionPacketContent = readFileSync(
			join(process.cwd(), decisionPacketPath),
			"utf-8",
		);
		const decisionPacketImports = importSpecifiers(decisionPacketContent);

		for (const submodule of REVIEW_GATE_DECISION_PACKET_SUBMODULES) {
			expect(decisionPacketImports).toContain(submodule);
		}

		for (const extractedSymbol of REVIEW_GATE_DECISION_PACKET_FORBIDDEN_SYMBOLS) {
			expect(decisionPacketContent).not.toContain(extractedSymbol);
		}
	});

	it("ratchets seam decomposition while they are extracted", () => {
		expectRatchetsWithinBudget(COMMAND_SURFACE_DECOMPOSITION_RATCHETS);
	});

	it("keeps CLI registry workflow parsing behind focused command spec seams", () => {
		expectRatchetsWithinBudget(CLI_REGISTRY_SURFACE_RATCHETS);

		const commandSpecsCoreContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/command-specs-core.ts"),
			"utf-8",
		);

		for (const submodule of CLI_REGISTRY_SPEC_SUBMODULES) {
			expect(commandSpecsCoreContent).toContain(submodule);
		}
	});

	it("keeps Linear action option builders behind the runner seam", () => {
		const runnerContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/linear-command-runner.ts"),
			"utf-8",
		);

		for (const submodule of LINEAR_COMMAND_RUNNER_SUBMODULES) {
			expect(runnerContent).toContain(submodule);
		}
	});

	it("keeps output normalisation split behind focused gate adapter seams", () => {
		expectRatchetsWithinBudget(OUTPUT_NORMALISE_SURFACE_RATCHETS);

		const normaliseCoreContent = readFileSync(
			join(process.cwd(), "src/lib/output/normalise-core-v2.ts"),
			"utf-8",
		);

		for (const submodule of OUTPUT_NORMALISE_SUBMODULES) {
			expect(normaliseCoreContent).toContain(submodule);
		}
	});

	it("keeps harness next surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(NEXT_SURFACE_RATCHETS);
	});

	it("keeps harness next parsing behind the command facade", () => {
		const facadePath = "src/commands/next.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of NEXT_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
	});

	it("keeps harness next decision internals behind the public decision seam", () => {
		const decisionsPath = "src/commands/next-decisions.ts";
		const decisionsContent = readFileSync(
			join(process.cwd(), decisionsPath),
			"utf-8",
		);

		for (const submodule of NEXT_DECISION_SUBMODULES) {
			expect(decisionsContent).toContain(submodule);
		}
	});

	it("keeps runtime-card surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(RUNTIME_CARD_SURFACE_RATCHETS);
	});

	it("keeps replay surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(REPLAY_SURFACE_RATCHETS);
	});

	it("keeps replay argv parsing and command helpers behind focused seams", () => {
		const facadePath = "src/commands/replay.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);
		const registryAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/replay-command-spec.ts"),
			"utf-8",
		);
		const cliArgsAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/replay/cli-args.ts"),
			"utf-8",
		);

		for (const submodule of REPLAY_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
		expect(registryAdapterContent).toContain("../../replay/cli-args.js");
		expect(registryAdapterContent).not.toContain("getFlagValue");
		expect(registryAdapterContent).not.toContain("args.indexOf");
		expect(cliArgsAdapterContent).toContain("../cli/parse-utils.js");
		expect(cliArgsAdapterContent).toContain("./options.js");
		expect(facadeContent).toContain("../lib/replay/options.js");
	});

	it("keeps plan-gate surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(PLAN_GATE_SURFACE_RATCHETS);
	});

	it("keeps plan-gate argv parsing and presentation behind focused seams", () => {
		const facadeContent = readFileSync(
			join(process.cwd(), "src/commands/plan-gate.ts"),
			"utf-8",
		);
		const registryAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/plan-gate-command-spec.ts"),
			"utf-8",
		);
		const cliArgsAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/plan-gate/cli-args.ts"),
			"utf-8",
		);
		const cliContent = readFileSync(
			join(process.cwd(), "src/lib/plan-gate/cli.ts"),
			"utf-8",
		);
		const commandSpecsCoreContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/command-specs-core.ts"),
			"utf-8",
		);

		expect(facadeContent).toContain("../lib/plan-gate/cli.js");
		expect(facadeContent).not.toContain("function getRecoveryHint");
		expect(facadeContent).not.toContain("normalisePlanGateResult");
		expect(registryAdapterContent).toContain("../../plan-gate/cli.js");
		expect(registryAdapterContent).not.toContain("getFlagValue");
		expect(registryAdapterContent).not.toContain("args.indexOf");
		expect(cliArgsAdapterContent).toContain("../cli/parse-utils.js");
		expect(cliArgsAdapterContent).toContain("buildPlanGateOptionsFromCliArgs");
		expect(cliContent).toContain("normalisePlanGateResult");
		expect(commandSpecsCoreContent).toContain("createPlanGateCommandSpec()");
		expect(commandSpecsCoreContent).not.toContain('name: "plan-gate"');
	});

	it("keeps prompt-gate surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(PROMPT_GATE_SURFACE_RATCHETS);
	});

	it("keeps prompt-gate argv parsing behind focused seams", () => {
		const facadeContent = readFileSync(
			join(process.cwd(), "src/commands/prompt-gate.ts"),
			"utf-8",
		);
		const registryAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/prompt-gate-command-spec.ts"),
			"utf-8",
		);
		const cliArgsAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/prompt-gate/cli-args.ts"),
			"utf-8",
		);
		const commandSpecsCoreContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/command-specs-core.ts"),
			"utf-8",
		);

		expect(facadeContent).toContain("../lib/prompt-gate/cli.js");
		expect(facadeContent).toContain("../lib/prompt-gate/validator.js");
		expect(registryAdapterContent).toContain("../../prompt-gate/cli.js");
		expect(registryAdapterContent).not.toContain("getFlagValue");
		expect(registryAdapterContent).not.toContain("args.indexOf");
		expect(cliArgsAdapterContent).toContain("../cli/parse-utils.js");
		expect(cliArgsAdapterContent).toContain(
			"buildPromptGateOptionsFromCliArgs",
		);
		expect(commandSpecsCoreContent).toContain("createPromptGateCommandSpec()");
		expect(commandSpecsCoreContent).not.toContain('name: "prompt-gate"');
	});

	it("keeps remediate surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(REMEDIATE_SURFACE_RATCHETS);
	});

	it("keeps remediate finding normalization, git probes, and run-record emission behind the command facade", () => {
		const facadePath = "src/commands/remediate.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of REMEDIATE_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
	});

	it("keeps verify-work surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(VERIFY_WORK_SURFACE_RATCHETS);
	});

	it("keeps verify-work internals behind the public facade", () => {
		const publicFacadePath = "src/lib/verify-work.ts";
		const publicFacadeContent = readFileSync(
			join(process.cwd(), publicFacadePath),
			"utf-8",
		);
		const commandFacadeContent = readFileSync(
			join(process.cwd(), "src/commands/verify-work.ts"),
			"utf-8",
		);

		for (const submodule of VERIFY_WORK_PUBLIC_FACADE_SUBMODULES) {
			expect(publicFacadeContent).toContain(submodule);
		}
		expect(commandFacadeContent).toContain("../lib/verify-work.js");
		const commandSpecContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/verify-work-command-spec.ts"),
			"utf-8",
		);
		expect(commandSpecContent).not.toContain("inspectFlagValue");
		expect(commandSpecContent).not.toContain("getValidationGateSpec");
		expect(commandSpecContent).not.toContain("missingValue");
		expect(commandSpecContent).not.toContain("projectGovernanceFlag");

		const violations = collectTypeScriptFiles("src")
			.filter((path) => !path.startsWith("src/lib/verify-work/"))
			.filter((path) => !APPROVED_VERIFY_WORK_INTERNAL_IMPORTERS.has(path))
			.flatMap((path) =>
				importSpecifiers(readFileSync(join(process.cwd(), path), "utf-8"))
					.filter((specifier) =>
						VERIFY_WORK_INTERNAL_IMPORT_PATTERN.test(specifier),
					)
					.map((specifier) => `${path} -> ${specifier}`),
			);

		expect(violations).toEqual([]);
	});

	it("keeps memory-gate surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(MEMORY_GATE_SURFACE_RATCHETS);
	});

	it("keeps memory-gate internals behind the public facade", () => {
		const publicFacadePath = "src/lib/memory-gate.ts";
		const publicFacadeContent = readFileSync(
			join(process.cwd(), publicFacadePath),
			"utf-8",
		);
		const commandFacadeContent = readFileSync(
			join(process.cwd(), "src/commands/memory-gate.ts"),
			"utf-8",
		);
		const registryAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/memory-gate-command-spec.ts"),
			"utf-8",
		);

		for (const submodule of MEMORY_GATE_PUBLIC_FACADE_SUBMODULES) {
			expect(publicFacadeContent).toContain(submodule);
		}
		expect(commandFacadeContent).toContain("../lib/memory-gate.js");
		expect(registryAdapterContent).toContain("../../memory-gate.js");
		expect(registryAdapterContent).not.toContain("getFlagValue");
		expect(registryAdapterContent).not.toContain("args.indexOf");
		expect(registryAdapterContent).not.toContain("MemoryGateOptions");

		const violations = collectTypeScriptFiles("src")
			.filter((path) => !path.startsWith("src/lib/memory/"))
			.filter((path) => !APPROVED_MEMORY_GATE_INTERNAL_IMPORTERS.has(path))
			.flatMap((path) =>
				importSpecifiers(readFileSync(join(process.cwd(), path), "utf-8"))
					.filter((specifier) =>
						MEMORY_GATE_INTERNAL_IMPORT_PATTERN.test(specifier),
					)
					.map((specifier) => `${path} -> ${specifier}`),
			);

		expect(violations).toEqual([]);
	});

	it("keeps drift-gate surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(DRIFT_GATE_SURFACE_RATCHETS);
	});

	it("keeps drift-gate callers behind the public facade", () => {
		const publicFacadeContent = readFileSync(
			join(process.cwd(), "src/lib/drift-gate.ts"),
			"utf-8",
		);
		const registryAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/drift-gate-command-spec.ts"),
			"utf-8",
		);
		const cliArgsAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/drift-gate/cli-args.ts"),
			"utf-8",
		);
		const outputAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/output/normalise-drift-gate.ts"),
			"utf-8",
		);

		expect(publicFacadeContent).toContain("../commands/drift-gate.js");
		expect(registryAdapterContent).toContain("../../drift-gate/cli-args.js");
		expect(cliArgsAdapterContent).toContain("../drift-gate.js");
		expect(outputAdapterContent).toContain("../drift-gate.js");

		const violations = collectTypeScriptFiles("src/lib")
			.filter((path) => !APPROVED_DRIFT_GATE_COMMAND_IMPORTERS.has(path))
			.flatMap((path) =>
				importSpecifiers(readFileSync(join(process.cwd(), path), "utf-8"))
					.filter((specifier) =>
						DRIFT_GATE_COMMAND_IMPORT_PATTERN.test(specifier),
					)
					.map((specifier) => `${path} -> ${specifier}`),
			);

		expect(violations).toEqual([]);
	});

	it("keeps observability-gate surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(OBSERVABILITY_GATE_SURFACE_RATCHETS);
	});

	it("keeps observability-gate parsing behind the module seam", () => {
		const commandFacadeContent = readFileSync(
			join(process.cwd(), "src/commands/observability-gate.ts"),
			"utf-8",
		);
		const publicFacadeContent = readFileSync(
			join(process.cwd(), "src/lib/observability-gate.ts"),
			"utf-8",
		);
		const registryAdapterContent = readFileSync(
			join(
				process.cwd(),
				"src/lib/cli/registry/observability-gate-command-spec.ts",
			),
			"utf-8",
		);
		const cliArgsAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/observability-gate/cli-args.ts"),
			"utf-8",
		);

		expect(commandFacadeContent).toContain("../lib/observability-gate.js");
		expect(publicFacadeContent).toContain("./observability-gate/cli.js");
		expect(registryAdapterContent).toContain("../../observability-gate.js");
		expect(registryAdapterContent).not.toContain("getFlagValue");
		expect(registryAdapterContent).not.toContain("args.indexOf");
		expect(cliArgsAdapterContent).toContain("../cli/parse-utils.js");
	});

	it("keeps artifact-gate surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(ARTIFACT_GATE_SURFACE_RATCHETS);
	});

	it("keeps artifact-gate parsing behind the module seam", () => {
		const commandFacadeContent = readFileSync(
			join(process.cwd(), "src/commands/artifact-gate.ts"),
			"utf-8",
		);
		const publicFacadeContent = readFileSync(
			join(process.cwd(), "src/lib/artifact-gate.ts"),
			"utf-8",
		);
		const registryAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/cli/registry/artifact-gate-command-spec.ts"),
			"utf-8",
		);
		const cliArgsAdapterContent = readFileSync(
			join(process.cwd(), "src/lib/artifact-gate/cli-args.ts"),
			"utf-8",
		);

		expect(commandFacadeContent).toContain("../lib/artifact-gate.js");
		expect(publicFacadeContent).toContain("./artifact-gate/cli.js");
		expect(registryAdapterContent).toContain("../../artifact-gate.js");
		expect(registryAdapterContent).not.toContain("inspectFlagValue");
		expect(registryAdapterContent).not.toContain("parseCsvList");
		expect(cliArgsAdapterContent).toContain("../cli/parse-utils.js");
	});

	it("keeps runtime-card contract and validation seams split after decomposition", () => {
		expectRatchetsWithinBudget(RUNTIME_CARD_RUNTIME_RATCHETS);
	});

	it("keeps runtime-card validation behind the public contract seam", () => {
		const contractContent = readFileSync(
			join(process.cwd(), "src/lib/runtime/runtime-card.ts"),
			"utf-8",
		);
		const validationContent = readFileSync(
			join(process.cwd(), "src/lib/runtime/runtime-card-validation.ts"),
			"utf-8",
		);

		for (const submodule of RUNTIME_CARD_CONTRACT_SUBMODULES) {
			expect(contractContent).toContain(submodule);
		}
		for (const submodule of RUNTIME_CARD_VALIDATION_SUBMODULES) {
			expect(validationContent).toContain(submodule);
		}
	});

	it("keeps runtime-card validation internals behind the public contract seam", () => {
		const violations = collectTypeScriptFiles("src").flatMap((path) => {
			const approvedImports =
				APPROVED_RUNTIME_CARD_INTERNAL_VALIDATION_IMPORTERS.get(path) ?? [];
			const content = readFileSync(join(process.cwd(), path), "utf-8");
			return importSpecifiers(content)
				.filter((specifier) =>
					RUNTIME_CARD_INTERNAL_VALIDATION_IMPORTS.has(specifier),
				)
				.filter((specifier) => !approvedImports.includes(specifier))
				.map((specifier) => `${path} -> ${specifier}`);
		});

		expect(violations).toEqual([]);
	});

	it("keeps runtime-card parsing behind the command facade", () => {
		const facadePath = "src/commands/runtime-card.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of RUNTIME_CARD_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
	});

	it("keeps local runtime-card surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(LOCAL_RUNTIME_CARD_SURFACE_RATCHETS);
	});

	it("keeps assembly, attempt, artifact, phase-exit, and live refresh behind the local runtime-card seam", () => {
		const facadePath = "src/lib/runtime/local-runtime-card.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);
		const assemblyContent = readFileSync(
			join(process.cwd(), "src/lib/runtime/local-runtime-card-assembly.ts"),
			"utf-8",
		);

		for (const submodule of LOCAL_RUNTIME_CARD_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
		for (const submodule of LOCAL_RUNTIME_CARD_ASSEMBLY_SUBMODULES) {
			expect(assemblyContent).toContain(submodule);
		}
	});

	it("keeps doctor surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(DOCTOR_SURFACE_RATCHETS);
	});

	it("keeps doctor command seams behind the command facade", () => {
		const facadePath = "src/commands/doctor.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of DOCTOR_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}
	});

	it("keeps provider-specific doctor tool checks behind tool seams", () => {
		const toolChecksPath = "src/commands/doctor-tool-checks.ts";
		const toolChecksContent = readFileSync(
			join(process.cwd(), toolChecksPath),
			"utf-8",
		);

		for (const submodule of DOCTOR_TOOL_SUBMODULES) {
			expect(toolChecksContent).toContain(submodule);
		}
	});

	it("keeps roadmap doctor file checks behind file seams", () => {
		const fileChecksPath = "src/commands/doctor-file-checks.ts";
		const fileChecksContent = readFileSync(
			join(process.cwd(), fileChecksPath),
			"utf-8",
		);

		for (const submodule of DOCTOR_FILE_SUBMODULES) {
			expect(fileChecksContent).toContain(submodule);
		}
	});

	it("keeps required-check identity behind CI seams", () => {
		const ciChecksPath = "src/commands/doctor-ci-checks.ts";
		const ciChecksContent = readFileSync(
			join(process.cwd(), ciChecksPath),
			"utf-8",
		);

		for (const submodule of DOCTOR_CI_SUBMODULES) {
			expect(ciChecksContent).toContain(submodule);
		}
	});

	it("keeps north-star contract readiness behind config seams", () => {
		const configChecksPath = "src/commands/doctor-config-checks.ts";
		const configChecksContent = readFileSync(
			join(process.cwd(), configChecksPath),
			"utf-8",
		);

		for (const submodule of DOCTOR_CONFIG_SUBMODULES) {
			expect(configChecksContent).toContain(submodule);
		}
	});

	it("keeps scaffold surfaces split after decomposition", () => {
		expectRatchetsWithinBudget(SCAFFOLD_SURFACE_RATCHETS);
	});

	it("prevents new lib-to-command imports outside transitional adapters", () => {
		const violations = collectTypeScriptFiles("src/lib")
			.filter((path) => !TRANSITIONAL_LIB_TO_COMMAND_IMPORTS.has(path))
			.filter((path) =>
				importSpecifiers(readFileSync(join(process.cwd(), path), "utf-8")).some(
					(specifier) => COMMAND_IMPORT_PATTERN.test(specifier),
				),
			);

		expect(violations).toEqual([]);
	});

	it("keeps Effect adoption inside approved deep module boundaries", () => {
		const violations = collectTypeScriptFiles("src")
			.filter((path) => !APPROVED_EFFECT_BOUNDARIES.has(path))
			.filter((path) =>
				importSpecifiers(readFileSync(join(process.cwd(), path), "utf-8")).some(
					(specifier) => EFFECT_IMPORT_PATTERN.test(specifier),
				),
			);

		expect(violations).toEqual([]);
	});

	it("keeps PR closeout callers on the public boundary", () => {
		const violations = collectTypeScriptFiles("src")
			.filter((path) => !path.startsWith("src/lib/pr-closeout/"))
			.filter((path) => !APPROVED_PR_CLOSEOUT_INTERNAL_IMPORTERS.has(path))
			.filter((path) =>
				importSpecifiers(readFileSync(join(process.cwd(), path), "utf-8")).some(
					(specifier) => PR_CLOSEOUT_INTERNAL_IMPORT_PATTERN.test(specifier),
				),
			);

		expect(violations).toEqual([]);
	});

	it("keeps PR closeout command seams behind the command facade", () => {
		const facadePath = "src/commands/pr-closeout.ts";
		const facadeContent = readFileSync(
			join(process.cwd(), facadePath),
			"utf-8",
		);

		for (const submodule of PR_CLOSEOUT_COMMAND_SUBMODULES) {
			expect(facadeContent).toContain(submodule);
		}

		const liveContent = readFileSync(
			join(process.cwd(), "src/commands/pr-closeout/live.ts"),
			"utf-8",
		);
		expect(liveContent).toContain("./env.js");

		const backImports = collectTypeScriptFiles(
			"src/commands/pr-closeout",
		).flatMap((path) =>
			importSpecifiers(readFileSync(join(process.cwd(), path), "utf-8"))
				.filter((specifier) => specifier === "../pr-closeout.js")
				.map((specifier) => `${path} -> ${specifier}`),
		);

		expect(backImports).toEqual([]);
	});

	it("keeps PR closeout internals inside the declared agent boundary", () => {
		const violations = collectTypeScriptFiles("src/lib/pr-closeout").flatMap(
			(path) => {
				const allowedParentImports =
					APPROVED_PR_CLOSEOUT_PARENT_IMPORTS.get(path) ?? [];
				const content = readFileSync(join(process.cwd(), path), "utf-8");
				return importSpecifiers(content)
					.filter((specifier) => specifier.startsWith(".."))
					.filter((specifier) => !allowedParentImports.includes(specifier))
					.map((specifier) => `${path} -> ${specifier}`);
			},
		);

		expect(violations).toEqual([]);
	});
});
