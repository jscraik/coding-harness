# Diagram Context Pack

Generated: 2026-05-29T09:42:27Z

## Table of Contents

- [How to use this pack](#how-to-use-this-pack)
- [agent](#agent)
- [architecture](#architecture)
- [auth](#auth)
- [c4context](#c4context)
- [class](#class)
- [database](#database)
- [dependency](#dependency)
- [erd](#erd)
- [events](#events)
- [flow](#flow)
- [rag](#rag)
- [security](#security)
- [sequence](#sequence)
- [user](#user)

## How to use this pack

- Start here for compact architecture, dependency, database, and ERD context before opening raw source files.
- Use .diagram/manifest.json to choose a focused Mermaid file when this combined pack is too large.
- For TypeScript implementation detail in this checkout, run `bash scripts/harness-cli.sh source-outline <path> --json` first, then unwrap one symbol with `--symbol <name>`. Downstream repositories can use `harness source-outline <path>`.

## Changed source focus

- These architecture-sensitive paths changed on the current branch and may be compacted out of Mermaid diagrams.
- `src/lib/agent-readiness/context-health.ts`
- `src/lib/agent-readiness/types.ts`
- `src/lib/artifact-runtime-surface/claim-support-semantics.ts`
- `src/lib/artifact-runtime-surface/index.ts`
- `src/lib/artifact-runtime-surface/types.ts`
- `src/lib/artifact-runtime-surface/validation-constants.ts`
- `src/lib/artifact-runtime-surface/validation-helpers.ts`
- `src/lib/artifact-runtime-surface/validation.ts`
- `src/lib/init/README.md`
- `src/lib/intermediary-receipts/constants.ts`
- `src/lib/intermediary-receipts/index.ts`
- `src/lib/intermediary-receipts/types.ts`
- `src/lib/intermediary-receipts/validation-common.ts`
- `src/lib/intermediary-receipts/validation-helpers.ts`
- `src/lib/intermediary-receipts/validation-summaries.ts`
- `src/lib/intermediary-receipts/validation.ts`
- `src/lib/pr-template-validator-rules.ts`
- `src/lib/pr-template-validator.ts`
- `src/lib/prompt-context-drift/index.ts`
- `src/lib/prompt-context-drift/prompt-context-drift-report.ts`
- `src/lib/replay/replay-packet.ts`

## agent

```mermaid
flowchart TD
  subgraph Orchestration["🎯 Orchestration Layer"]
    node_agent_mmd_orchestration_layer_orchestration_chec_7a9f0b64["🤖 check-codex-agent-roles"]
    node_agent_mmd_orchestration_layer_orchestration_chec_7fd47f5c["🤖 check-steering-feedback-contract"]
    node_agent_mmd_orchestration_layer_orchestration_run__18817957["🤖 run-harness-evals"]
    node_agent_mmd_orchestration_layer_orchestration_vali_c01b04be["🤖 validate-packaged-skill"]
    cli_99bb8840["🤖 cli"]
    agent_readiness_c82c68e6["🤖 agent-readiness"]
    brain_core_aa07c380["🤖 brain-core"]
    brain_bbbf7a64["🤖 brain"]
    doctor_north_star_contract_checks_0048124c["🤖 doctor-north-star-contract-checks"]
    doctor_roadmap_file_checks_14447b8e["🤖 doctor-roadmap-file-checks"]
    doctor_72f4be89["🤖 doctor"]
    drift_gate_rules_9685e72d["🤖 drift-gate-rules"]
    next_runner_41643472["🤖 next-runner"]
    next_usage_errors_837a345a["🤖 next-usage-errors"]
    next_c6c1c9a9["🤖 next"]
    remediate_findings_8b09c8c6["🤖 remediate-findings"]
    remediate_git_58c6f6f4["🤖 remediate-git"]
    remediate_run_record_9dfe5dc1["🤖 remediate-run-record"]
    node_agent_mmd_orchestration_layer_orchestration_reme_359fe98f["🤖 remediate-runner-helpers"]
    remediate_06b9c7fc["🤖 remediate"]
    runtime_card_args_2b3d4b28["🤖 runtime-card-args"]
    runtime_card_options_c9156ad5["🤖 runtime-card-options"]
    runtime_card_e06b53e1["🤖 runtime-card"]
    node_agent_mmd_orchestration_layer_orchestration_tool_acfe0c01["🤖 tooling-audit-core"]
    upgrade_7fef9479["🤖 upgrade"]
    node_agent_mmd_orchestration_layer_orchestration_chec_0550c395["🤖 checker"]
    cli_1_084e05fe["🤖 cli"]
    node_agent_mmd_orchestration_layer_orchestration_cont_61b3b9c9["🤖 context-health"]
    package_scripts_3ee6150f["🤖 package-scripts"]
    repo_evidence_38bb1de5["🤖 repo-evidence"]
    status_073c1634["🤖 status"]
    node_agent_mmd_orchestration_layer_orchestration_type_4f906dcc["🤖 types"]
    agent_readiness_command_spec_a30c2c1e["🤖 agent-readiness-command-spec"]
    brain_command_spec_15b122d5["🤖 brain-command-spec"]
    command_agent_catalog_rules_8e06b2af["🤖 command-agent-catalog-rules"]
    node_agent_mmd_orchestration_layer_orchestration_comm_6e41a7f7["🤖 command-capabilities"]
    node_agent_mmd_orchestration_layer_orchestration_comm_1f8cc24c["🤖 command-specs-core"]
    command_specs_69167c63["🤖 command-specs"]
    node_agent_mmd_orchestration_layer_orchestration_line_b67affd5["🤖 linear-command-runner"]
    linear_command_spec_1e12dd44["🤖 linear-command-spec"]
    upgrade_command_spec_03f6c7bd["🤖 upgrade-command-spec"]
    north_star_alignment_00440188["🤖 north-star-alignment"]
    node_agent_mmd_orchestration_layer_orchestration_poli_3270b55d["🤖 policy-validators-core"]
    run_records_core_89286dfa["🤖 run-records-core"]
    node_agent_mmd_orchestration_layer_orchestration_type_7cf81261["🤖 types-core"]
    node_agent_mmd_orchestration_layer_orchestration_vali_d9fe99e6["🤖 validator-core"]
    node_agent_mmd_orchestration_layer_orchestration_he_p_fc778c24["🤖 he-phase-exit-core"]
    node_agent_mmd_orchestration_layer_orchestration_init_2a9c3ecb["🤖 init-modes"]
    node_agent_mmd_orchestration_layer_orchestration_proj_6ab6f60f["🤖 project-brain-templates"]
    node_agent_mmd_orchestration_layer_orchestration_scaf_12cc07db["🤖 scaffold-doc-templates"]
    node_agent_mmd_orchestration_layer_orchestration_scaf_c9a90c2f["🤖 scaffold-environment-templates"]
    node_agent_mmd_orchestration_layer_orchestration_scaf_ff8f92f6["🤖 scaffold-template-registry"]
    types_15_86775c96["🤖 types"]
    node_agent_mmd_orchestration_layer_orchestration_clas_899b821a["🤖 classifier"]
    control_plane_core_db3b4cb2["🤖 control-plane-core"]
    metrics_capture_core_db4bf7cf["🤖 metrics-capture-core"]
    registries_06402afa["🤖 registries"]
    lifecycle_intent_test_fixtures_a53c7ada["🤖 lifecycle-intent-test-fixtures"]
    node_agent_mmd_orchestration_layer_orchestration_tool_cc43149f["🤖 tooling-baseline"]
    add_cli_7614de25["🤖 add-cli"]
    brain_validator_be251832["🤖 brain-validator"]
    cli_args_8_d546936e["🤖 cli-args"]
    cli_types_1686e858["🤖 cli-types"]
    cli_9_b54c1407["🤖 cli"]
    domain_mapper_cd9333d2["🤖 domain-mapper"]
    help_106a5842["🤖 help"]
    lint_attachments_873c0632["🤖 lint-attachments"]
    lint_checks_83522b19["🤖 lint-checks"]
    lint_cli_9ec62ec0["🤖 lint-cli"]
    lint_pages_e33301d0["🤖 lint-pages"]
    lint_types_2862c255["🤖 lint-types"]
    metadata_scanner_6a101b66["🤖 metadata-scanner"]
    preflight_cli_5d148379["🤖 preflight-cli"]
    query_cli_b95be64d["🤖 query-cli"]
    stale_cli_64548720["🤖 stale-cli"]
    status_cli_4c24a0d6["🤖 status-cli"]
    node_agent_mmd_orchestration_layer_orchestration_sugg_85c5ebe3["🤖 suggestion-generator"]
    node_agent_mmd_orchestration_layer_orchestration_prom_d17b4de2["🤖 prompt-context-drift-report"]
    orchestrator_11376b7e["🤖 orchestrator"]
    eval_runner_0966a6b3["🤖 eval-runner"]
    runtime_card_trace_64a5ca95["🤖 runtime-card-trace"]
    runtime_evidence_contract_0f7b15b2["🤖 runtime-evidence-contract"]
    analysis_f44e85c4["🤖 analysis"]
    runner_527aa9f4["🤖 runner"]
    verify_work_1_cd8e7ec3["🤖 verify-work"]
    cli_args_14_3481043e["🤖 cli-args"]
    runner_1_6f281bf8["🤖 runner"]
    orchestrator_core_d0678b53["🤖 orchestrator-core"]
    orchestrator_1_6b7137c5["🤖 orchestrator"]
  end
  subgraph LLMLayer["🧠 LLM / Model Layer"]
    node_agent_mmd_llm_model_layer_llmlayer_check_codex_a_29e7b7fa["💡 check-codex-agent-roles"]
    node_agent_mmd_llm_model_layer_llmlayer_check_steerin_0e1bf90d["💡 check-steering-feedback-contract"]
    node_agent_mmd_llm_model_layer_llmlayer_run_harness_e_603fcfdc["💡 run-harness-evals"]
    validate_decision_request_2e5c325e["💡 validate-decision-request"]
    validate_goal_completion_audit_receipt_100d252c["💡 validate-goal-completion-audit-receipt"]
    node_agent_mmd_llm_model_layer_llmlayer_validate_pack_2a12e1f4["💡 validate-packaged-skill"]
    node_agent_mmd_llm_model_layer_llmlayer_validate_prom_9880f764["💡 validate-prompt-context-drift"]
    validate_reviewer_coverage_251efee3["💡 validate-reviewer-coverage"]
    check_environment_core_2c16213f["💡 check-environment-core"]
    node_agent_mmd_llm_model_layer_llmlayer_context_conte_ad2dfbd9["💡 context"]
    node_agent_mmd_llm_model_layer_llmlayer_index_context_1041bd11["💡 index-context"]
    prompt_gate_c5e9d207["💡 prompt-gate"]
    node_agent_mmd_llm_model_layer_llmlayer_remediate_run_9e3d4585["💡 remediate-runner-helpers"]
    node_agent_mmd_llm_model_layer_llmlayer_search_search_66b9a911["💡 search"]
    node_agent_mmd_llm_model_layer_llmlayer_context_healt_cfc0bfa8["💡 context-health"]
    node_agent_mmd_llm_model_layer_llmlayer_command_specs_782af9fa["💡 command-specs-core"]
    prompt_gate_command_spec_9a941482["💡 prompt-gate-command-spec"]
    node_agent_mmd_llm_model_layer_llmlayer_constants_con_c9bd3f6c["💡 constants"]
    node_agent_mmd_llm_model_layer_llmlayer_index_index_1_02e160ff["💡 index"]
    node_agent_mmd_llm_model_layer_llmlayer_indexer_index_4f4deef5["💡 indexer"]
    node_agent_mmd_llm_model_layer_llmlayer_ollama_ollama_968b23fa["💡 ollama"]
    node_agent_mmd_llm_model_layer_llmlayer_sync_contract_9f3cc8c1["💡 sync-contract"]
    north_star_validators_cfc926ce["💡 north-star-validators"]
    hilt_boundary_9b36fb15["💡 hilt-boundary"]
    types_9_1db4641f["💡 types"]
    goal_completion_audit_receipt_validation_9d0f4891["💡 goal-completion-audit-receipt-validation"]
    goal_completion_audit_receipt_5e4939c3["💡 goal-completion-audit-receipt"]
    index_4_013aa0e3["💡 index"]
    node_agent_mmd_llm_model_layer_llmlayer_constants_con_c9bd3f6c["💡 constants"]
    types_16_0fae1112["💡 types"]
    sensitive_text_7c11f760["💡 sensitive-text"]
    pr_template_validator_rules_20a32d6b["💡 pr-template-validator-rules"]
    node_agent_mmd_llm_model_layer_llmlayer_index_index_1_02e160ff["💡 index"]
    node_agent_mmd_llm_model_layer_llmlayer_prompt_contex_81f9066a["💡 prompt-context-drift-report"]
    node_agent_mmd_llm_model_layer_llmlayer_index_index_1_02e160ff["💡 index"]
    node_agent_mmd_llm_model_layer_llmlayer_prompt_contex_6426acc2["💡 prompt-context-receipt"]
    cli_args_9_9c136878["💡 cli-args"]
    cli_10_35dc8cbd["💡 cli"]
    sections_4697ef32["💡 sections"]
    types_26_a5814179["💡 types"]
    validator_6_3688adbf["💡 validator"]
    cli_args_10_861cdd3f["💡 cli-args"]
  end
  subgraph ToolLayer["🔧 Tool Layer"]
    node_agent_mmd_tool_layer_toollayer_check_codex_agent_4b361d5a["🔧 check-codex-agent-roles"]
    node_agent_mmd_tool_layer_toollayer_check_steering_fe_eafecf3a["🔧 check-steering-feedback-contract"]
    node_agent_mmd_tool_layer_toollayer_run_harness_evals_e2ee24f1["🔧 run-harness-evals"]
    validate_action_review_receipt_fa2f06c3["🔧 validate-action-review-receipt"]
    node_agent_mmd_tool_layer_toollayer_validate_packaged_2855c827["🔧 validate-packaged-skill"]
    validate_replay_packet_f309747e["🔧 validate-replay-packet"]
    node_agent_mmd_tool_layer_toollayer_ci_migrate_core_c_049f8460["🔧 ci-migrate-core"]
    doctor_checks_5a2eb2b9["🔧 doctor-checks"]
    doctor_github_tool_checks_a53b0382["🔧 doctor-github-tool-checks"]
    doctor_tool_checks_4acac51a["🔧 doctor-tool-checks"]
    next_blocked_decisions_4140ad2b["🔧 next-blocked-decisions"]
    policy_gate_213f7313["🔧 policy-gate"]
    remediate_cli_output_cc165396["🔧 remediate-cli-output"]
    node_agent_mmd_tool_layer_toollayer_remediate_runner__c003b871["🔧 remediate-runner-helpers"]
    node_agent_mmd_tool_layer_toollayer_review_gate_core__7704598b["🔧 review-gate-core"]
    index_1bc04b52["🔧 index"]
    types_1_4ecdf56e["🔧 types"]
    validation_constants_e002a0f6["🔧 validation-constants"]
    validation_98c41dcd["🔧 validation"]
    node_agent_mmd_tool_layer_toollayer_checker_checker_2_453d593b["🔧 checker"]
    cli_args_1_6144b055["🔧 cli-args"]
    node_agent_mmd_tool_layer_toollayer_command_capabilit_7fe13db1["🔧 command-capabilities"]
    node_agent_mmd_tool_layer_toollayer_command_capabilit_e97a4615["🔧 command-capability-rules"]
    linear_command_actions_e430f4f4["🔧 linear-command-actions"]
    node_agent_mmd_tool_layer_toollayer_linear_command_ru_d6763748["🔧 linear-command-runner"]
    node_agent_mmd_tool_layer_toollayer_policy_validators_af136abf["🔧 policy-validators-core"]
    node_agent_mmd_tool_layer_toollayer_types_core_types__6c8319b6["🔧 types-core"]
    node_agent_mmd_tool_layer_toollayer_validator_core_va_6ef6131f["🔧 validator-core"]
    validator_helpers_7b927667["🔧 validator-helpers"]
    node_agent_mmd_tool_layer_toollayer_he_phase_exit_cor_af016160["🔧 he-phase-exit-core"]
    ralph_runtime_73d63c0e["🔧 ralph-runtime"]
    observed_skill_usage_ed7d5930["🔧 observed-skill-usage"]
    closure_evidence_aaa31467["🔧 closure-evidence"]
    pr_creator_dc6b1ea4["🔧 pr-creator"]
    client_948fe603["🔧 client"]
    init_output_360dce91["🔧 init-output"]
    scaffold_ci_templates_2afd6392["🔧 scaffold-ci-templates"]
    scaffold_codex_environment_templates_334fbbed["🔧 scaffold-codex-environment-templates"]
    scaffold_config_templates_4b80ce53["🔧 scaffold-config-templates"]
    node_agent_mmd_tool_layer_toollayer_scaffold_environm_c1afc013["🔧 scaffold-environment-templates"]
    scaffold_github_actions_pr_pipeline_renderer_1ee18de5["🔧 scaffold-github-actions-pr-pipeline-renderer"]
    scaffold_github_actions_pr_pipeline_template_e2b85f62["🔧 scaffold-github-actions-pr-pipeline-template"]
    scaffold_release_private_npm_template_075499f8["🔧 scaffold-release-private-npm-template"]
    node_agent_mmd_tool_layer_toollayer_constants_constan_9d71b829["🔧 constants"]
    index_8_6f0f20ec["🔧 index"]
    validation_common_6161e48b["🔧 validation-common"]
    node_agent_mmd_tool_layer_toollayer_cli_cli_2_1_32d9eeaf["🔧 cli"]
    node_agent_mmd_tool_layer_toollayer_metrics_tracker_m_4c9237d8["🔧 metrics-tracker"]
    normalise_renderer_85f2e563["🔧 normalise-renderer"]
    evaluation_engine_core_e054fe49["🔧 evaluation-engine-core"]
    node_agent_mmd_tool_layer_toollayer_tooling_baseline__61e66e9f["🔧 tooling-baseline"]
    node_agent_mmd_tool_layer_toollayer_prompt_context_dr_a2772f2b["🔧 prompt-context-drift-report"]
    replay_packet_a1293f88["🔧 replay-packet"]
    index_13_97df39c8["🔧 index"]
    review_lifecycle_contract_e5447221["🔧 review-lifecycle-contract"]
    review_lifecycle_89afa64c["🔧 review-lifecycle"]
    node_agent_mmd_tool_layer_toollayer_runtime_card_code_3636ceac["🔧 runtime-card-codex-runtime-validation"]
    runtime_card_codex_runtime_0655e230["🔧 runtime-card-codex-runtime"]
    runtime_evidence_bundle_d471a232["🔧 runtime-evidence-bundle"]
    types_35_93e66c64["🔧 types"]
    index_16_373c8a49["🔧 index"]
    projection_1b250ea1["🔧 projection"]
    types_37_32ccf9f9["🔧 types"]
    validation_7_c4e6d8b6["🔧 validation"]
  end
  subgraph MemoryLayer["📚 Memory / Vector Layer"]
    node_agent_mmd_memory_vector_layer_memorylayer_check__64c86928[("📚 check-steering-feedback-contract")]
    normalize_workflow_contracts_8701f1c8[("📚 normalize-workflow-contracts")]
    sync_codex_preflight_7e7a8dc2[("📚 sync-codex-preflight")]
    test_harness_upgrade_matrix_84113c4e[("📚 test-harness-upgrade-matrix")]
    node_agent_mmd_memory_vector_layer_memorylayer_valida_c52c4db8[("📚 validate-prompt-context-drift")]
    validate_runtime_packet_schemas_bc3ba8ec[("📚 validate-runtime-packet-schemas")]
    validate_workflow_contracts_33dc063c[("📚 validate-workflow-contracts")]
    branch_protect_core_a8feb0fd[("📚 branch-protect-core")]
    node_agent_mmd_memory_vector_layer_memorylayer_ci_mig_0cd5b1a4[("📚 ci-migrate-core")]
    context_health_80bb7da9[("📚 context-health")]
    node_agent_mmd_memory_vector_layer_memorylayer_contex_78ceaaa9[("📚 context")]
    docs_gate_core_eb9b6c18[("📚 docs-gate-core")]
    node_agent_mmd_memory_vector_layer_memorylayer_index__6f3402d0[("📚 index-context")]
    local_memory_preflight_dcc36c42[("📚 local-memory-preflight")]
    memory_gate_a577a506[("📚 memory-gate")]
    pattern_scope_siblings_43abe000[("📚 pattern-scope-siblings")]
    review_context_ca6cf81d[("📚 review-context")]
    node_agent_mmd_memory_vector_layer_memorylayer_review_5bee9816[("📚 review-gate-core")]
    node_agent_mmd_memory_vector_layer_memorylayer_search_ac35cb7e[("📚 search")]
    session_context_e5ec72c0[("📚 session-context")]
    node_agent_mmd_memory_vector_layer_memorylayer_toolin_a1185b8f[("📚 tooling-audit-core")]
    run_local_memory_preflight_36e92808[("📚 run-local-memory-preflight")]
    node_agent_mmd_memory_vector_layer_memorylayer_checke_a583eb4f[("📚 checker")]
    node_agent_mmd_memory_vector_layer_memorylayer_contex_3204aa0e[("📚 context-health")]
    node_agent_mmd_memory_vector_layer_memorylayer_types__9ad640a0[("📚 types")]
    branch_protect_sync_570adb18[("📚 branch-protect-sync")]
    node_agent_mmd_memory_vector_layer_memorylayer_comman_c72a5d05[("📚 command-capability-rules")]
    node_agent_mmd_memory_vector_layer_memorylayer_comman_111eb454[("📚 command-specs-core")]
    local_memory_preflight_command_spec_9e23f3ce[("📚 local-memory-preflight-command-spec")]
    memory_gate_command_spec_dc9001a9[("📚 memory-gate-command-spec")]
    review_gate_command_spec_3187376a[("📚 review-gate-command-spec")]
    session_context_command_spec_973afbb1[("📚 session-context-command-spec")]
    node_agent_mmd_memory_vector_layer_memorylayer_consta_702d3f46[("📚 constants")]
    context_compact_policy_3dcaf95d[("📚 context-compact-policy")]
    node_agent_mmd_memory_vector_layer_memorylayer_index__752bc61e[("📚 index")]
    node_agent_mmd_memory_vector_layer_memorylayer_indexe_93e6d86f[("📚 indexer")]
    init_error_5c7dd49f[("📚 init-error")]
    lexical_fallback_723e2b3e[("📚 lexical-fallback")]
    node_agent_mmd_memory_vector_layer_memorylayer_ollama_6d51be16[("📚 ollama")]
    rollout_a4fa034c[("📚 rollout")]
    sources_878a52fc[("📚 sources")]
    store_824d80d7[("📚 store")]
    node_agent_mmd_memory_vector_layer_memorylayer_sync_c_e43418bc[("📚 sync-contract")]
    types_7_2f1ed65e[("📚 types")]
    harness_run_context_ac7c77a9[("📚 harness-run-context")]
    index_3_7e40d474[("📚 index")]
    json_schema_core_96d7e328[("📚 json-schema-core")]
    node_agent_mmd_memory_vector_layer_memorylayer_policy_1944de42[("📚 policy-validators-core")]
    node_agent_mmd_memory_vector_layer_memorylayer_types__83f369fa[("📚 types-core")]
    node_agent_mmd_memory_vector_layer_memorylayer_valida_41034356[("📚 validator-core")]
    node_agent_mmd_memory_vector_layer_memorylayer_init_m_333d02c5[("📚 init-modes")]
    node_agent_mmd_memory_vector_layer_memorylayer_projec_3ae304d9[("📚 project-brain-templates")]
    scaffold_diagram_templates_dd88e83c[("📚 scaffold-diagram-templates")]
    node_agent_mmd_memory_vector_layer_memorylayer_scaffo_5fd73b94[("📚 scaffold-doc-templates")]
    node_agent_mmd_memory_vector_layer_memorylayer_scaffo_12b42341[("📚 scaffold-environment-templates")]
    scaffold_root_command_templates_404fed7f[("📚 scaffold-root-command-templates")]
    scaffold_script_template_registry_69312d4e[("📚 scaffold-script-template-registry")]
    scaffold_shell_templates_0ad0f915[("📚 scaffold-shell-templates")]
    scaffold_surfaces_12d6494e[("📚 scaffold-surfaces")]
    node_agent_mmd_memory_vector_layer_memorylayer_scaffo_a86eece1[("📚 scaffold-template-registry")]
    scaffold_workflow_template_92310587[("📚 scaffold-workflow-template")]
    eval_seed_5699fd3e[("📚 eval-seed")]
    index_9_32dd4d91[("📚 index")]
    review_context_1_e3afed15[("📚 review-context")]
    memory_gate_1_265164ac[("📚 memory-gate")]
    branch_enforcer_acb749cd[("📚 branch-enforcer")]
    cli_args_5_09ea29f0[("📚 cli-args")]
    node_agent_mmd_memory_vector_layer_memorylayer_cli_cl_1f1f89ab[("📚 cli")]
    node_agent_mmd_memory_vector_layer_memorylayer_metric_12562178[("📚 metrics-tracker")]
    types_18_37582e2a[("📚 types")]
    validator_4_5180cf23[("📚 validator")]
    node_agent_mmd_memory_vector_layer_memorylayer_classi_1ebbf5ff[("📚 classifier")]
    node_agent_mmd_memory_vector_layer_memorylayer_toolin_14f86b00[("📚 tooling-baseline")]
    claim_helpers_20dc8387[("📚 claim-helpers")]
    types_23_4352ee2e[("📚 types")]
    local_memory_smoke_1175abfc[("📚 local-memory-smoke")]
    local_memory_0db17ecc[("📚 local-memory")]
    performance_overload_c685bfcf[("📚 performance-overload")]
    node_agent_mmd_memory_vector_layer_memorylayer_sugges_267f408d[("📚 suggestion-generator")]
    node_agent_mmd_memory_vector_layer_memorylayer_index__752bc61e[("📚 index")]
    node_agent_mmd_memory_vector_layer_memorylayer_prompt_ae34fc43[("📚 prompt-context-drift-report")]
    node_agent_mmd_memory_vector_layer_memorylayer_index__752bc61e[("📚 index")]
    node_agent_mmd_memory_vector_layer_memorylayer_prompt_55c0d605[("📚 prompt-context-receipt")]
    types_30_424b976c[("📚 types")]
    policy_1_fc4198db[("📚 policy")]
    node_agent_mmd_memory_vector_layer_memorylayer_runtim_a5d23e7f[("📚 runtime-card-codex-runtime-validation")]
    cli_11_338a8415[("📚 cli")]
    collector_0736fd5b[("📚 collector")]
    types_33_16e22a82[("📚 types")]
    overload_guard_2748c559[("📚 overload-guard")]
  end
  classDef agentNode fill:#555,color:#fff
  class node_agent_mmd_orchestration_layer_orchestration_chec_7a9f0b64,node_agent_mmd_llm_model_layer_llmlayer_check_codex_a_29e7b7fa,node_agent_mmd_tool_layer_toollayer_check_codex_agent_4b361d5a,node_agent_mmd_orchestration_layer_orchestration_chec_7fd47f5c,node_agent_mmd_llm_model_layer_llmlayer_check_steerin_0e1bf90d,node_agent_mmd_tool_layer_toollayer_check_steering_fe_eafecf3a,node_agent_mmd_memory_vector_layer_memorylayer_check__64c86928,node_agent_mmd_orchestration_layer_orchestration_run__18817957,node_agent_mmd_llm_model_layer_llmlayer_run_harness_e_603fcfdc,node_agent_mmd_tool_layer_toollayer_run_harness_evals_e2ee24f1,node_agent_mmd_orchestration_layer_orchestration_vali_c01b04be,node_agent_mmd_llm_model_layer_llmlayer_validate_pack_2a12e1f4,node_agent_mmd_tool_layer_toollayer_validate_packaged_2855c827,cli_99bb8840,agent_readiness_c82c68e6,brain_core_aa07c380,brain_bbbf7a64,doctor_north_star_contract_checks_0048124c,doctor_roadmap_file_checks_14447b8e,doctor_72f4be89,drift_gate_rules_9685e72d,next_runner_41643472,next_usage_errors_837a345a,next_c6c1c9a9,remediate_findings_8b09c8c6,remediate_git_58c6f6f4,remediate_run_record_9dfe5dc1,node_agent_mmd_orchestration_layer_orchestration_reme_359fe98f,node_agent_mmd_llm_model_layer_llmlayer_remediate_run_9e3d4585,node_agent_mmd_tool_layer_toollayer_remediate_runner__c003b871,remediate_06b9c7fc,runtime_card_args_2b3d4b28,runtime_card_options_c9156ad5,runtime_card_e06b53e1,node_agent_mmd_orchestration_layer_orchestration_tool_acfe0c01,node_agent_mmd_memory_vector_layer_memorylayer_toolin_a1185b8f,upgrade_7fef9479,node_agent_mmd_orchestration_layer_orchestration_chec_0550c395,node_agent_mmd_tool_layer_toollayer_checker_checker_2_453d593b,node_agent_mmd_memory_vector_layer_memorylayer_checke_a583eb4f,cli_1_084e05fe,node_agent_mmd_orchestration_layer_orchestration_cont_61b3b9c9,node_agent_mmd_llm_model_layer_llmlayer_context_healt_cfc0bfa8,node_agent_mmd_memory_vector_layer_memorylayer_contex_3204aa0e,package_scripts_3ee6150f,repo_evidence_38bb1de5,status_073c1634,node_agent_mmd_orchestration_layer_orchestration_type_4f906dcc,node_agent_mmd_memory_vector_layer_memorylayer_types__9ad640a0,agent_readiness_command_spec_a30c2c1e,brain_command_spec_15b122d5,command_agent_catalog_rules_8e06b2af,node_agent_mmd_orchestration_layer_orchestration_comm_6e41a7f7,node_agent_mmd_tool_layer_toollayer_command_capabilit_7fe13db1,node_agent_mmd_orchestration_layer_orchestration_comm_1f8cc24c,node_agent_mmd_llm_model_layer_llmlayer_command_specs_782af9fa,node_agent_mmd_memory_vector_layer_memorylayer_comman_111eb454,command_specs_69167c63,node_agent_mmd_orchestration_layer_orchestration_line_b67affd5,node_agent_mmd_tool_layer_toollayer_linear_command_ru_d6763748,linear_command_spec_1e12dd44,upgrade_command_spec_03f6c7bd,north_star_alignment_00440188,node_agent_mmd_orchestration_layer_orchestration_poli_3270b55d,node_agent_mmd_tool_layer_toollayer_policy_validators_af136abf,node_agent_mmd_memory_vector_layer_memorylayer_policy_1944de42,run_records_core_89286dfa,node_agent_mmd_orchestration_layer_orchestration_type_7cf81261,node_agent_mmd_tool_layer_toollayer_types_core_types__6c8319b6,node_agent_mmd_memory_vector_layer_memorylayer_types__83f369fa,node_agent_mmd_orchestration_layer_orchestration_vali_d9fe99e6,node_agent_mmd_tool_layer_toollayer_validator_core_va_6ef6131f,node_agent_mmd_memory_vector_layer_memorylayer_valida_41034356,node_agent_mmd_orchestration_layer_orchestration_he_p_fc778c24,node_agent_mmd_tool_layer_toollayer_he_phase_exit_cor_af016160,node_agent_mmd_orchestration_layer_orchestration_init_2a9c3ecb,node_agent_mmd_memory_vector_layer_memorylayer_init_m_333d02c5,node_agent_mmd_orchestration_layer_orchestration_proj_6ab6f60f,node_agent_mmd_memory_vector_layer_memorylayer_projec_3ae304d9,node_agent_mmd_orchestration_layer_orchestration_scaf_12cc07db,node_agent_mmd_memory_vector_layer_memorylayer_scaffo_5fd73b94,node_agent_mmd_orchestration_layer_orchestration_scaf_c9a90c2f,node_agent_mmd_tool_layer_toollayer_scaffold_environm_c1afc013,node_agent_mmd_memory_vector_layer_memorylayer_scaffo_12b42341,node_agent_mmd_orchestration_layer_orchestration_scaf_ff8f92f6,node_agent_mmd_memory_vector_layer_memorylayer_scaffo_a86eece1,types_15_86775c96,node_agent_mmd_orchestration_layer_orchestration_clas_899b821a,node_agent_mmd_memory_vector_layer_memorylayer_classi_1ebbf5ff,control_plane_core_db3b4cb2,metrics_capture_core_db4bf7cf,registries_06402afa,lifecycle_intent_test_fixtures_a53c7ada,node_agent_mmd_orchestration_layer_orchestration_tool_cc43149f,node_agent_mmd_tool_layer_toollayer_tooling_baseline__61e66e9f,node_agent_mmd_memory_vector_layer_memorylayer_toolin_14f86b00,add_cli_7614de25,brain_validator_be251832,cli_args_8_d546936e,cli_types_1686e858,cli_9_b54c1407,domain_mapper_cd9333d2,help_106a5842,lint_attachments_873c0632,lint_checks_83522b19,lint_cli_9ec62ec0,lint_pages_e33301d0,lint_types_2862c255,metadata_scanner_6a101b66,preflight_cli_5d148379,query_cli_b95be64d,stale_cli_64548720,status_cli_4c24a0d6,node_agent_mmd_orchestration_layer_orchestration_sugg_85c5ebe3,node_agent_mmd_memory_vector_layer_memorylayer_sugges_267f408d,node_agent_mmd_orchestration_layer_orchestration_prom_d17b4de2,node_agent_mmd_llm_model_layer_llmlayer_prompt_contex_81f9066a,node_agent_mmd_tool_layer_toollayer_prompt_context_dr_a2772f2b,node_agent_mmd_memory_vector_layer_memorylayer_prompt_ae34fc43,orchestrator_11376b7e,eval_runner_0966a6b3,runtime_card_trace_64a5ca95,runtime_evidence_contract_0f7b15b2,analysis_f44e85c4,runner_527aa9f4,verify_work_1_cd8e7ec3,cli_args_14_3481043e,runner_1_6f281bf8,orchestrator_core_d0678b53,orchestrator_1_6b7137c5 agentNode
  classDef llmNode fill:#555,color:#fff
  class node_agent_mmd_orchestration_layer_orchestration_chec_7a9f0b64,node_agent_mmd_llm_model_layer_llmlayer_check_codex_a_29e7b7fa,node_agent_mmd_tool_layer_toollayer_check_codex_agent_4b361d5a,node_agent_mmd_orchestration_layer_orchestration_chec_7fd47f5c,node_agent_mmd_llm_model_layer_llmlayer_check_steerin_0e1bf90d,node_agent_mmd_tool_layer_toollayer_check_steering_fe_eafecf3a,node_agent_mmd_memory_vector_layer_memorylayer_check__64c86928,node_agent_mmd_orchestration_layer_orchestration_run__18817957,node_agent_mmd_llm_model_layer_llmlayer_run_harness_e_603fcfdc,node_agent_mmd_tool_layer_toollayer_run_harness_evals_e2ee24f1,validate_decision_request_2e5c325e,validate_goal_completion_audit_receipt_100d252c,node_agent_mmd_orchestration_layer_orchestration_vali_c01b04be,node_agent_mmd_llm_model_layer_llmlayer_validate_pack_2a12e1f4,node_agent_mmd_tool_layer_toollayer_validate_packaged_2855c827,node_agent_mmd_llm_model_layer_llmlayer_validate_prom_9880f764,node_agent_mmd_memory_vector_layer_memorylayer_valida_c52c4db8,validate_reviewer_coverage_251efee3,check_environment_core_2c16213f,node_agent_mmd_llm_model_layer_llmlayer_context_conte_ad2dfbd9,node_agent_mmd_memory_vector_layer_memorylayer_contex_78ceaaa9,node_agent_mmd_llm_model_layer_llmlayer_index_context_1041bd11,node_agent_mmd_memory_vector_layer_memorylayer_index__6f3402d0,prompt_gate_c5e9d207,node_agent_mmd_orchestration_layer_orchestration_reme_359fe98f,node_agent_mmd_llm_model_layer_llmlayer_remediate_run_9e3d4585,node_agent_mmd_tool_layer_toollayer_remediate_runner__c003b871,node_agent_mmd_llm_model_layer_llmlayer_search_search_66b9a911,node_agent_mmd_memory_vector_layer_memorylayer_search_ac35cb7e,node_agent_mmd_orchestration_layer_orchestration_cont_61b3b9c9,node_agent_mmd_llm_model_layer_llmlayer_context_healt_cfc0bfa8,node_agent_mmd_memory_vector_layer_memorylayer_contex_3204aa0e,node_agent_mmd_orchestration_layer_orchestration_comm_1f8cc24c,node_agent_mmd_llm_model_layer_llmlayer_command_specs_782af9fa,node_agent_mmd_memory_vector_layer_memorylayer_comman_111eb454,prompt_gate_command_spec_9a941482,node_agent_mmd_llm_model_layer_llmlayer_constants_con_c9bd3f6c,node_agent_mmd_memory_vector_layer_memorylayer_consta_702d3f46,node_agent_mmd_llm_model_layer_llmlayer_index_index_1_02e160ff,node_agent_mmd_memory_vector_layer_memorylayer_index__752bc61e,node_agent_mmd_llm_model_layer_llmlayer_indexer_index_4f4deef5,node_agent_mmd_memory_vector_layer_memorylayer_indexe_93e6d86f,node_agent_mmd_llm_model_layer_llmlayer_ollama_ollama_968b23fa,node_agent_mmd_memory_vector_layer_memorylayer_ollama_6d51be16,node_agent_mmd_llm_model_layer_llmlayer_sync_contract_9f3cc8c1,node_agent_mmd_memory_vector_layer_memorylayer_sync_c_e43418bc,north_star_validators_cfc926ce,hilt_boundary_9b36fb15,types_9_1db4641f,goal_completion_audit_receipt_validation_9d0f4891,goal_completion_audit_receipt_5e4939c3,index_4_013aa0e3,node_agent_mmd_tool_layer_toollayer_constants_constan_9d71b829,types_16_0fae1112,sensitive_text_7c11f760,pr_template_validator_rules_20a32d6b,node_agent_mmd_orchestration_layer_orchestration_prom_d17b4de2,node_agent_mmd_llm_model_layer_llmlayer_prompt_contex_81f9066a,node_agent_mmd_tool_layer_toollayer_prompt_context_dr_a2772f2b,node_agent_mmd_memory_vector_layer_memorylayer_prompt_ae34fc43,node_agent_mmd_llm_model_layer_llmlayer_prompt_contex_6426acc2,node_agent_mmd_memory_vector_layer_memorylayer_prompt_55c0d605,cli_args_9_9c136878,cli_10_35dc8cbd,sections_4697ef32,types_26_a5814179,validator_6_3688adbf,cli_args_10_861cdd3f llmNode
  classDef toolNode fill:#555,color:#fff
  class node_agent_mmd_orchestration_layer_orchestration_chec_7a9f0b64,node_agent_mmd_llm_model_layer_llmlayer_check_codex_a_29e7b7fa,node_agent_mmd_tool_layer_toollayer_check_codex_agent_4b361d5a,node_agent_mmd_orchestration_layer_orchestration_chec_7fd47f5c,node_agent_mmd_llm_model_layer_llmlayer_check_steerin_0e1bf90d,node_agent_mmd_tool_layer_toollayer_check_steering_fe_eafecf3a,node_agent_mmd_memory_vector_layer_memorylayer_check__64c86928,node_agent_mmd_orchestration_layer_orchestration_run__18817957,node_agent_mmd_llm_model_layer_llmlayer_run_harness_e_603fcfdc,node_agent_mmd_tool_layer_toollayer_run_harness_evals_e2ee24f1,validate_action_review_receipt_fa2f06c3,node_agent_mmd_orchestration_layer_orchestration_vali_c01b04be,node_agent_mmd_llm_model_layer_llmlayer_validate_pack_2a12e1f4,node_agent_mmd_tool_layer_toollayer_validate_packaged_2855c827,validate_replay_packet_f309747e,node_agent_mmd_tool_layer_toollayer_ci_migrate_core_c_049f8460,node_agent_mmd_memory_vector_layer_memorylayer_ci_mig_0cd5b1a4,doctor_checks_5a2eb2b9,doctor_github_tool_checks_a53b0382,doctor_tool_checks_4acac51a,next_blocked_decisions_4140ad2b,policy_gate_213f7313,remediate_cli_output_cc165396,node_agent_mmd_orchestration_layer_orchestration_reme_359fe98f,node_agent_mmd_llm_model_layer_llmlayer_remediate_run_9e3d4585,node_agent_mmd_tool_layer_toollayer_remediate_runner__c003b871,node_agent_mmd_tool_layer_toollayer_review_gate_core__7704598b,node_agent_mmd_memory_vector_layer_memorylayer_review_5bee9816,index_1bc04b52,types_1_4ecdf56e,validation_constants_e002a0f6,validation_98c41dcd,node_agent_mmd_orchestration_layer_orchestration_chec_0550c395,node_agent_mmd_tool_layer_toollayer_checker_checker_2_453d593b,node_agent_mmd_memory_vector_layer_memorylayer_checke_a583eb4f,cli_args_1_6144b055,node_agent_mmd_orchestration_layer_orchestration_comm_6e41a7f7,node_agent_mmd_tool_layer_toollayer_command_capabilit_7fe13db1,node_agent_mmd_tool_layer_toollayer_command_capabilit_e97a4615,node_agent_mmd_memory_vector_layer_memorylayer_comman_c72a5d05,linear_command_actions_e430f4f4,node_agent_mmd_orchestration_layer_orchestration_line_b67affd5,node_agent_mmd_tool_layer_toollayer_linear_command_ru_d6763748,node_agent_mmd_orchestration_layer_orchestration_poli_3270b55d,node_agent_mmd_tool_layer_toollayer_policy_validators_af136abf,node_agent_mmd_memory_vector_layer_memorylayer_policy_1944de42,node_agent_mmd_orchestration_layer_orchestration_type_7cf81261,node_agent_mmd_tool_layer_toollayer_types_core_types__6c8319b6,node_agent_mmd_memory_vector_layer_memorylayer_types__83f369fa,node_agent_mmd_orchestration_layer_orchestration_vali_d9fe99e6,node_agent_mmd_tool_layer_toollayer_validator_core_va_6ef6131f,node_agent_mmd_memory_vector_layer_memorylayer_valida_41034356,validator_helpers_7b927667,node_agent_mmd_orchestration_layer_orchestration_he_p_fc778c24,node_agent_mmd_tool_layer_toollayer_he_phase_exit_cor_af016160,ralph_runtime_73d63c0e,observed_skill_usage_ed7d5930,closure_evidence_aaa31467,pr_creator_dc6b1ea4,client_948fe603,init_output_360dce91,scaffold_ci_templates_2afd6392,scaffold_codex_environment_templates_334fbbed,scaffold_config_templates_4b80ce53,node_agent_mmd_orchestration_layer_orchestration_scaf_c9a90c2f,node_agent_mmd_tool_layer_toollayer_scaffold_environm_c1afc013,node_agent_mmd_memory_vector_layer_memorylayer_scaffo_12b42341,scaffold_github_actions_pr_pipeline_renderer_1ee18de5,scaffold_github_actions_pr_pipeline_template_e2b85f62,scaffold_release_private_npm_template_075499f8,node_agent_mmd_llm_model_layer_llmlayer_constants_con_c9bd3f6c,node_agent_mmd_tool_layer_toollayer_constants_constan_9d71b829,index_8_6f0f20ec,validation_common_6161e48b,node_agent_mmd_tool_layer_toollayer_cli_cli_2_1_32d9eeaf,node_agent_mmd_memory_vector_layer_memorylayer_cli_cl_1f1f89ab,node_agent_mmd_tool_layer_toollayer_metrics_tracker_m_4c9237d8,node_agent_mmd_memory_vector_layer_memorylayer_metric_12562178,normalise_renderer_85f2e563,evaluation_engine_core_e054fe49,node_agent_mmd_orchestration_layer_orchestration_tool_cc43149f,node_agent_mmd_tool_layer_toollayer_tooling_baseline__61e66e9f,node_agent_mmd_memory_vector_layer_memorylayer_toolin_14f86b00,node_agent_mmd_orchestration_layer_orchestration_prom_d17b4de2,node_agent_mmd_llm_model_layer_llmlayer_prompt_contex_81f9066a,node_agent_mmd_tool_layer_toollayer_prompt_context_dr_a2772f2b,node_agent_mmd_memory_vector_layer_memorylayer_prompt_ae34fc43,replay_packet_a1293f88,index_13_97df39c8,review_lifecycle_contract_e5447221,review_lifecycle_89afa64c,node_agent_mmd_tool_layer_toollayer_runtime_card_code_3636ceac,node_agent_mmd_memory_vector_layer_memorylayer_runtim_a5d23e7f,runtime_card_codex_runtime_0655e230,runtime_evidence_bundle_d471a232,types_35_93e66c64,index_16_373c8a49,projection_1b250ea1,types_37_32ccf9f9,validation_7_c4e6d8b6 toolNode
  classDef memNode fill:#555,color:#fff
  class node_agent_mmd_orchestration_layer_orchestration_chec_7fd47f5c,node_agent_mmd_llm_model_layer_llmlayer_check_steerin_0e1bf90d,node_agent_mmd_tool_layer_toollayer_check_steering_fe_eafecf3a,node_agent_mmd_memory_vector_layer_memorylayer_check__64c86928,normalize_workflow_contracts_8701f1c8,sync_codex_preflight_7e7a8dc2,test_harness_upgrade_matrix_84113c4e,node_agent_mmd_llm_model_layer_llmlayer_validate_prom_9880f764,node_agent_mmd_memory_vector_layer_memorylayer_valida_c52c4db8,validate_runtime_packet_schemas_bc3ba8ec,validate_workflow_contracts_33dc063c,branch_protect_core_a8feb0fd,node_agent_mmd_tool_layer_toollayer_ci_migrate_core_c_049f8460,node_agent_mmd_memory_vector_layer_memorylayer_ci_mig_0cd5b1a4,context_health_80bb7da9,node_agent_mmd_llm_model_layer_llmlayer_context_conte_ad2dfbd9,node_agent_mmd_memory_vector_layer_memorylayer_contex_78ceaaa9,docs_gate_core_eb9b6c18,node_agent_mmd_llm_model_layer_llmlayer_index_context_1041bd11,node_agent_mmd_memory_vector_layer_memorylayer_index__6f3402d0,local_memory_preflight_dcc36c42,memory_gate_a577a506,pattern_scope_siblings_43abe000,review_context_ca6cf81d,node_agent_mmd_tool_layer_toollayer_review_gate_core__7704598b,node_agent_mmd_memory_vector_layer_memorylayer_review_5bee9816,node_agent_mmd_llm_model_layer_llmlayer_search_search_66b9a911,node_agent_mmd_memory_vector_layer_memorylayer_search_ac35cb7e,session_context_e5ec72c0,node_agent_mmd_orchestration_layer_orchestration_tool_acfe0c01,node_agent_mmd_memory_vector_layer_memorylayer_toolin_a1185b8f,run_local_memory_preflight_36e92808,node_agent_mmd_orchestration_layer_orchestration_chec_0550c395,node_agent_mmd_tool_layer_toollayer_checker_checker_2_453d593b,node_agent_mmd_memory_vector_layer_memorylayer_checke_a583eb4f,node_agent_mmd_orchestration_layer_orchestration_cont_61b3b9c9,node_agent_mmd_llm_model_layer_llmlayer_context_healt_cfc0bfa8,node_agent_mmd_memory_vector_layer_memorylayer_contex_3204aa0e,node_agent_mmd_orchestration_layer_orchestration_type_4f906dcc,node_agent_mmd_memory_vector_layer_memorylayer_types__9ad640a0,branch_protect_sync_570adb18,node_agent_mmd_tool_layer_toollayer_command_capabilit_e97a4615,node_agent_mmd_memory_vector_layer_memorylayer_comman_c72a5d05,node_agent_mmd_orchestration_layer_orchestration_comm_1f8cc24c,node_agent_mmd_llm_model_layer_llmlayer_command_specs_782af9fa,node_agent_mmd_memory_vector_layer_memorylayer_comman_111eb454,local_memory_preflight_command_spec_9e23f3ce,memory_gate_command_spec_dc9001a9,review_gate_command_spec_3187376a,session_context_command_spec_973afbb1,node_agent_mmd_llm_model_layer_llmlayer_constants_con_c9bd3f6c,node_agent_mmd_memory_vector_layer_memorylayer_consta_702d3f46,context_compact_policy_3dcaf95d,node_agent_mmd_llm_model_layer_llmlayer_index_index_1_02e160ff,node_agent_mmd_memory_vector_layer_memorylayer_index__752bc61e,node_agent_mmd_llm_model_layer_llmlayer_indexer_index_4f4deef5,node_agent_mmd_memory_vector_layer_memorylayer_indexe_93e6d86f,init_error_5c7dd49f,lexical_fallback_723e2b3e,node_agent_mmd_llm_model_layer_llmlayer_ollama_ollama_968b23fa,node_agent_mmd_memory_vector_layer_memorylayer_ollama_6d51be16,rollout_a4fa034c,sources_878a52fc,store_824d80d7,node_agent_mmd_llm_model_layer_llmlayer_sync_contract_9f3cc8c1,node_agent_mmd_memory_vector_layer_memorylayer_sync_c_e43418bc,types_7_2f1ed65e,harness_run_context_ac7c77a9,index_3_7e40d474,json_schema_core_96d7e328,node_agent_mmd_orchestration_layer_orchestration_poli_3270b55d,node_agent_mmd_tool_layer_toollayer_policy_validators_af136abf,node_agent_mmd_memory_vector_layer_memorylayer_policy_1944de42,node_agent_mmd_orchestration_layer_orchestration_type_7cf81261,node_agent_mmd_tool_layer_toollayer_types_core_types__6c8319b6,node_agent_mmd_memory_vector_layer_memorylayer_types__83f369fa,node_agent_mmd_orchestration_layer_orchestration_vali_d9fe99e6,node_agent_mmd_tool_layer_toollayer_validator_core_va_6ef6131f,node_agent_mmd_memory_vector_layer_memorylayer_valida_41034356,node_agent_mmd_orchestration_layer_orchestration_init_2a9c3ecb,node_agent_mmd_memory_vector_layer_memorylayer_init_m_333d02c5,node_agent_mmd_orchestration_layer_orchestration_proj_6ab6f60f,node_agent_mmd_memory_vector_layer_memorylayer_projec_3ae304d9,scaffold_diagram_templates_dd88e83c,node_agent_mmd_orchestration_layer_orchestration_scaf_12cc07db,node_agent_mmd_memory_vector_layer_memorylayer_scaffo_5fd73b94,node_agent_mmd_orchestration_layer_orchestration_scaf_c9a90c2f,node_agent_mmd_tool_layer_toollayer_scaffold_environm_c1afc013,node_agent_mmd_memory_vector_layer_memorylayer_scaffo_12b42341,scaffold_root_command_templates_404fed7f,scaffold_script_template_registry_69312d4e,scaffold_shell_templates_0ad0f915,scaffold_surfaces_12d6494e,node_agent_mmd_orchestration_layer_orchestration_scaf_ff8f92f6,node_agent_mmd_memory_vector_layer_memorylayer_scaffo_a86eece1,scaffold_workflow_template_92310587,eval_seed_5699fd3e,index_9_32dd4d91,review_context_1_e3afed15,memory_gate_1_265164ac,branch_enforcer_acb749cd,cli_args_5_09ea29f0,node_agent_mmd_tool_layer_toollayer_cli_cli_2_1_32d9eeaf,node_agent_mmd_memory_vector_layer_memorylayer_cli_cl_1f1f89ab,node_agent_mmd_tool_layer_toollayer_metrics_tracker_m_4c9237d8,node_agent_mmd_memory_vector_layer_memorylayer_metric_12562178,types_18_37582e2a,validator_4_5180cf23,node_agent_mmd_orchestration_layer_orchestration_clas_899b821a,node_agent_mmd_memory_vector_layer_memorylayer_classi_1ebbf5ff,node_agent_mmd_orchestration_layer_orchestration_tool_cc43149f,node_agent_mmd_tool_layer_toollayer_tooling_baseline__61e66e9f,node_agent_mmd_memory_vector_layer_memorylayer_toolin_14f86b00,claim_helpers_20dc8387,types_23_4352ee2e,local_memory_smoke_1175abfc,local_memory_0db17ecc,performance_overload_c685bfcf,node_agent_mmd_orchestration_layer_orchestration_sugg_85c5ebe3,node_agent_mmd_memory_vector_layer_memorylayer_sugges_267f408d,node_agent_mmd_orchestration_layer_orchestration_prom_d17b4de2,node_agent_mmd_llm_model_layer_llmlayer_prompt_contex_81f9066a,node_agent_mmd_tool_layer_toollayer_prompt_context_dr_a2772f2b,node_agent_mmd_memory_vector_layer_memorylayer_prompt_ae34fc43,node_agent_mmd_llm_model_layer_llmlayer_prompt_contex_6426acc2,node_agent_mmd_memory_vector_layer_memorylayer_prompt_55c0d605,types_30_424b976c,policy_1_fc4198db,node_agent_mmd_tool_layer_toollayer_runtime_card_code_3636ceac,node_agent_mmd_memory_vector_layer_memorylayer_runtim_a5d23e7f,cli_11_338a8415,collector_0736fd5b,types_33_16e22a82,overload_guard_2748c559 memNode

```

## architecture

```mermaid
graph TD

```

## auth

```mermaid
flowchart TD
  Request["Authentication request"]
  Boundary{"Auth Boundary"}
  Request --> Boundary
  session_context_e5ec72c0["session-context"]
  Boundary --> session_context_e5ec72c0
  session_context_command_spec_973afbb1["session-context-command-spec"]
  Boundary --> session_context_command_spec_973afbb1
  scaffold_security_scan_template_55bc7465["scaffold-security-scan-template"]
  Boundary --> scaffold_security_scan_template_55bc7465
  repository_identity_9dc13d37["repository-identity"]
  Boundary --> repository_identity_9dc13d37
  cli_11_338a8415["cli"]
  Boundary --> cli_11_338a8415
  collector_0736fd5b["collector"]
  Boundary --> collector_0736fd5b
  types_33_16e22a82["types"]
  Boundary --> types_33_16e22a82
  session_closeout_f3efb270["session-closeout"]
  Boundary --> session_closeout_f3efb270
  overload_guard_2748c559["overload-guard"]
  Boundary --> overload_guard_2748c559
  ext_node_crypto_879f6cbe[("node:crypto")]
  ext_node_child_process_cb73900b[("node:child_process")]
  ext_node_fs_df6b52af[("node:fs")]
  ext_node_path_0e7d56ab[("node:path")]
  ext_node_os_e9717731[("node:os")]
  repository_identity_9dc13d37 --> ext_node_crypto_879f6cbe
  repository_identity_9dc13d37 --> ext_node_child_process_cb73900b
  repository_identity_9dc13d37 --> ext_node_fs_df6b52af
  cli_11_338a8415 --> ext_node_fs_df6b52af
  collector_0736fd5b --> ext_node_child_process_cb73900b
  collector_0736fd5b --> ext_node_fs_df6b52af
  collector_0736fd5b --> ext_node_path_0e7d56ab
  overload_guard_2748c559 --> ext_node_os_e9717731
  classDef authNode fill:#7c3aed,color:#fff
  class session_context_e5ec72c0,session_context_command_spec_973afbb1,scaffold_security_scan_template_55bc7465,repository_identity_9dc13d37,cli_11_338a8415,collector_0736fd5b,types_33_16e22a82,session_closeout_f3efb270,overload_guard_2748c559 authNode

```

## c4context

```mermaid
C4Context
  title "System Context — coding harness"
  System(mainSystem, "Coding Harness", "Control plane for agentic development")
  Person(developer, "Developer / User", "Uses the system")
  Rel(developer, mainSystem, "Uses")
  System_Ext(ext_0, "External Service", "node:fs, node:os, node:path")
  Rel(mainSystem, ext_0, "uses")
  System_Ext(ext_1, "Database", "better-sqlite3, sqlite-vec")
  Rel(mainSystem, ext_1, "uses")
  System_Ext(ext_2, "Version Control", "@octokit/rest, @octokit/request-error, @octokit/plugin-retry, @octokit/plugin-throttling")
  Rel(mainSystem, ext_2, "uses")

```

## class

```mermaid
classDiagram
  class docs_gate_core_eb9b6c18 {
    +src/commands/docs-gate-core.ts
  }
  class types_1_4ecdf56e {
    +src/lib/action-review/types.ts
  }
  class errors_be4bd567 {
    +src/lib/contract/errors.ts
  }
  class loader_d47712cc {
    +src/lib/contract/loader.ts
  }
  class preset_resolver_dc3dd716 {
    +src/lib/contract/preset-resolver.ts
  }
  class run_records_core_89286dfa {
    +src/lib/contract/run-records-core.ts
  }
  class harness_decision_881bdc15 {
    +src/lib/decision/harness-decision.ts
  }
  class he_phase_exit_core_1148895b {
    +src/lib/decision/he-phase-exit-core.ts
  }
  class validator_1_0c0621d8 {
    +src/lib/evidence/validator.ts
  }
  class errors_1_84b56c88 {
    +src/lib/github/errors.ts
  }
  class sha_d600474b {
    +src/lib/github/sha.ts
  }
  class eject_1_d0ecd4d1 {
    +src/lib/init/eject.ts
  }
  class validation_3_e8272057 {
    +src/lib/input/validation.ts
  }
  class validator_2_744853f5 {
    +src/lib/input/validator.ts
  }
  class eval_seed_5699fd3e {
    +src/lib/learnings/eval-seed.ts
  }
  class client_1_914e1681 {
    +src/lib/linear/client.ts
  }
  class required_checks_46396214 {
    +src/lib/policy/required-checks.ts
  }
  class required_check_manifest_744e3936 {
    +src/lib/review-gate/required-check-manifest.ts
  }
  class codex_runtime_evidence_producer_a9193270 {
    +src/lib/runtime/codex-runtime-evidence-producer.ts
  }
  class session_closeout_f3efb270 {
    +src/lib/session/session-closeout.ts
  }
  class contract_validator_src_lib_contract_validator_ts_3254c053 {
    +src/lib/contract/validator.ts
  }
  loader_d47712cc --> contract_validator_src_lib_contract_validator_ts_3254c053 : validateContract

```

## database

```mermaid
flowchart TD
  UserRequest["User request"]
  Decision{Record exists?}
  fleet_plan_repo_ecdc6499["fleet-plan-repo"]
  UserRequest --> fleet_plan_repo_ecdc6499
  fleet_plan_repo_ecdc6499 --> fleet_plan_repo_ecdc6499_result["result"]
  repo_evidence_38bb1de5["repo-evidence"]
  UserRequest --> repo_evidence_38bb1de5
  repo_evidence_38bb1de5 --> repo_evidence_38bb1de5_result["result"]
  repo_bound_paths_e218b5b3["repo-bound-paths"]
  UserRequest --> repo_bound_paths_e218b5b3
  repo_bound_paths_e218b5b3 --> repo_bound_paths_e218b5b3_result["result"]
  json_schema_core_96d7e328["json-schema-core"]
  UserRequest --> json_schema_core_96d7e328
  json_schema_core_96d7e328 --> json_schema_core_96d7e328_result["result"]
  json_schema_74a768d7["json-schema"]
  UserRequest --> json_schema_74a768d7
  json_schema_74a768d7 --> json_schema_74a768d7_result["result"]
  repo_scanner_core_8e9f7646["repo-scanner-core"]
  UserRequest --> repo_scanner_core_8e9f7646
  repo_scanner_core_8e9f7646 --> repo_scanner_core_8e9f7646_result["result"]
  repo_scanner_a8b2579e["repo-scanner"]
  UserRequest --> repo_scanner_a8b2579e
  repo_scanner_a8b2579e --> repo_scanner_a8b2579e_result["result"]
  migration_8a6cead4["migration"]
  UserRequest --> migration_8a6cead4
  migration_8a6cead4 --> migration_8a6cead4_result["result"]
  schema_migrate_c0646635["schema-migrate"]
  UserRequest --> schema_migrate_c0646635
  schema_migrate_c0646635 --> schema_migrate_c0646635_result["result"]
  query_cli_b95be64d["query-cli"]
  UserRequest --> query_cli_b95be64d
  query_cli_b95be64d --> query_cli_b95be64d_lookup["lookup query"]
  query_cli_b95be64d_lookup --> Decision
  Decision -->|found| query_cli_b95be64d_update["update or modify"]
  Decision -->|not found| query_cli_b95be64d_create["insert/create"]
  query_cli_b95be64d_update --> query_cli_b95be64d_result["result"]
  query_cli_b95be64d_create --> query_cli_b95be64d_result["result"]
  repository_identity_9dc13d37["repository-identity"]
  UserRequest --> repository_identity_9dc13d37
  repository_identity_9dc13d37 --> repository_identity_9dc13d37_result["result"]
  repo_runtime_artifact_139c0fbd["repo-runtime-artifact"]
  UserRequest --> repo_runtime_artifact_139c0fbd
  repo_runtime_artifact_139c0fbd --> repo_runtime_artifact_139c0fbd_result["result"]
  classDef dbNode fill:#0ea5e9,color:#fff
  class fleet_plan_repo_ecdc6499,repo_evidence_38bb1de5,repo_bound_paths_e218b5b3,json_schema_core_96d7e328,json_schema_74a768d7,repo_scanner_core_8e9f7646,repo_scanner_a8b2579e,migration_8a6cead4,schema_migrate_c0646635,query_cli_b95be64d,repository_identity_9dc13d37,repo_runtime_artifact_139c0fbd dbNode
  classDef decisionNode fill:#0284c7,color:#fff
  class Decision decisionNode

```

## dependency

```mermaid
graph LR
  ext_inquirer_prompts_4d547149["@inquirer/prompts"] --> node_init_interactive_28845b2f_39350b46
  ext_octokit_plugin_retry_c9aecc53["@octokit/plugin-retry"] --> node_client_948fe603_907d5144
  ext_octokit_plugin_throttling_7909ece3["@octokit/plugin-throttling"] --> node_client_948fe603_907d5144
  ext_octokit_plugin_throttling_7909ece3["@octokit/plugin-throttling"] --> node_pr_creator_dc6b1ea4_4c333e0f
  ext_octokit_request_error_98ae13cc["@octokit/request-error"] --> node_errors_1_84b56c88_f9e19a8e
  ext_octokit_rest_c6e4d192["@octokit/rest"] --> node_client_948fe603_907d5144
  ext_octokit_rest_c6e4d192["@octokit/rest"] --> node_pr_creator_dc6b1ea4_4c333e0f
  ext_better_sqlite3_d7ed8f1a["better-sqlite3"] --> node_store_824d80d7_69038a3e
  ext_child_process_4845fa97["child_process"] --> node_test_harness_upgrade_matrix_84113c4e_e0838daa
  ext_diff_75a0ee1b["diff"] --> node_interactive_0eb42ac4_3ee6c3c6
  ext_effect_68d1dae1["effect"] --> node_classifier_fe1991a9_34ec128d
  ext_effect_68d1dae1["effect"] --> node_evaluator_27f6343f_e2466dc7
  ext_fs_3f4bb586["fs"] --> node_doctor_file_checks_bc1301dc_74dc1400
  ext_lodash_901466a5["lodash"] --> node_merger_3e167607_07e847e5
  ext_node_child_process_f62b7d19["node:child_process"] --> node_branch_enforcer_acb749cd_10e89517
  ext_node_child_process_f62b7d19["node:child_process"] --> node_changed_files_4c0102f6_bfd165bc
  ext_node_child_process_f62b7d19["node:child_process"] --> node_check_environment_core_2c16213f_a8a456d9
  ext_node_child_process_f62b7d19["node:child_process"] --> node_ci_migrate_core_7005b5af_7e295ae3
  ext_node_child_process_f62b7d19["node:child_process"] --> node_collector_0736fd5b_10bc1882
  ext_node_child_process_f62b7d19["node:child_process"] --> node_control_plane_core_db3b4cb2_27437a14
  ext_node_child_process_f62b7d19["node:child_process"] --> node_diff_budget_9da0268d_71167227
  ext_node_child_process_f62b7d19["node:child_process"] --> node_docs_gate_core_eb9b6c18_f8540503
  ext_node_child_process_f62b7d19["node:child_process"] --> node_doctor_check_utils_d0fc22ea_d74f86eb
  ext_node_child_process_f62b7d19["node:child_process"] --> node_doctor_github_tool_checks_a53b0382_76d832f7
  ext_node_child_process_f62b7d19["node:child_process"] --> node_git_tracked_paths_0d2bb251_a46656b4
  ext_node_child_process_f62b7d19["node:child_process"] --> node_github_e2e_2891a341_af6f1610
  ext_node_child_process_f62b7d19["node:child_process"] --> node_health_core_2b2fdada_341de678
  ext_node_child_process_f62b7d19["node:child_process"] --> node_linear_gate_core_a415ae74_222bd4b9
  ext_node_child_process_f62b7d19["node:child_process"] --> node_link_checker_d0fa555f_abfe9020
  ext_node_child_process_f62b7d19["node:child_process"] --> node_local_memory_0db17ecc_97fe98ce
  ext_node_child_process_f62b7d19["node:child_process"] --> node_local_runtime_card_d7fd59bf_beed7160
  ext_node_child_process_f62b7d19["node:child_process"] --> node_local_runtime_card_live_65f2f7da_7feb6eda
  ext_node_child_process_f62b7d19["node:child_process"] --> node_next_runner_41643472_9b94424f
  ext_node_child_process_f62b7d19["node:child_process"] --> node_pr_closeout_0ac07306_e8d9c77f
  ext_node_child_process_f62b7d19["node:child_process"] --> node_pr_closeout_env_9bfcd9ef_f476024a
  ext_node_child_process_f62b7d19["node:child_process"] --> node_remediate_git_58c6f6f4_3c7e755f
  ext_node_child_process_f62b7d19["node:child_process"] --> node_repository_identity_9dc13d37_eaffcd1e
  ext_node_child_process_f62b7d19["node:child_process"] --> node_run_e2e_39efe696_fb07ee74
  ext_node_child_process_f62b7d19["node:child_process"] --> node_run_harness_evals_77704768_ba42904d
  ext_node_child_process_f62b7d19["node:child_process"] --> node_runner_1_6f281bf8_36f20bbb
  ext_node_child_process_f62b7d19["node:child_process"] --> node_scaffold_hook_templates_8c74ab50_572d99d9
  ext_node_child_process_f62b7d19["node:child_process"] --> node_search_24193290_6a30c5b7
  ext_node_child_process_f62b7d19["node:child_process"] --> node_setup_git_hooks_70750d40_b4ca2cf9
  ext_node_child_process_f62b7d19["node:child_process"] --> node_test_harness_6e520b98_6b3d1d32
  ext_node_child_process_f62b7d19["node:child_process"] --> node_test_harness_upgrade_matrix_84113c4e_e0838daa
  ext_node_child_process_f62b7d19["node:child_process"] --> node_ui_loop_internal_f2eb8892_c4b49e6a
  ext_node_child_process_f62b7d19["node:child_process"] --> node_validate_artifact_runtime_surface_3fb28d25_0a1d91a4
  ext_node_child_process_f62b7d19["node:child_process"] --> node_validate_audit_references_811f872a_0ce355a8
  ext_node_child_process_f62b7d19["node:child_process"] --> node_validate_commit_msg_43b008fe_f9560ef9
  ext_node_child_process_f62b7d19["node:child_process"] --> node_validate_evidence_patterns_cacd9fb4_240eb37f
  ext_node_child_process_f62b7d19["node:child_process"] --> node_validate_intermediary_receipt_coverage_7d63b166_40dcf15d
  ext_node_child_process_f62b7d19["node:child_process"] --> node_validate_packaged_skill_5e32c890_9228ad58
  ext_node_child_process_f62b7d19["node:child_process"] --> node_validate_prompt_context_drift_8c949ef6_d32d5759
  ext_node_child_process_f62b7d19["node:child_process"] --> node_validate_runtime_packet_schemas_bc3ba8ec_ee732335
  ext_node_child_process_f62b7d19["node:child_process"] --> node_version_coherence_69733bcb_00c8d5d9
  ext_node_crypto_c7dfc512["node:crypto"] --> node_analysis_f44e85c4_c68a7cb6
  ext_node_crypto_c7dfc512["node:crypto"] --> node_artifact_io_ba511748_6d1faad8
  ext_node_crypto_c7dfc512["node:crypto"] --> node_check_environment_core_2c16213f_a8a456d9
  ext_node_crypto_c7dfc512["node:crypto"] --> node_ci_migrate_signing_2d82ac3f_9e5e8974
  ext_node_crypto_c7dfc512["node:crypto"] --> node_control_plane_core_db3b4cb2_27437a14
  ext_node_crypto_c7dfc512["node:crypto"] --> node_decision_packet_1_dd443771_92fa570e
  ext_node_crypto_c7dfc512["node:crypto"] --> node_decision_packet_8ee9d119_b89c59dd
  ext_node_crypto_c7dfc512["node:crypto"] --> node_docs_gate_core_eb9b6c18_f8540503
  ext_node_crypto_c7dfc512["node:crypto"] --> node_enforcement_status_92d314f5_7cd48cbe
  ext_node_crypto_c7dfc512["node:crypto"] --> node_env_b77349bf_420e4120
  ext_node_crypto_c7dfc512["node:crypto"] --> node_gate_c974e17b_07549baf
  ext_node_crypto_c7dfc512["node:crypto"] --> node_goal_completion_audit_receipt_5e4939c3_4fb29d00
  ext_node_crypto_c7dfc512["node:crypto"] --> node_hash_d04b98f4_53f96e02
  ext_node_crypto_c7dfc512["node:crypto"] --> node_idempotency_f5d39a07_bce757f2
  ext_node_crypto_c7dfc512["node:crypto"] --> node_indexer_70fa78e5_97c1bb0b
  ext_node_crypto_c7dfc512["node:crypto"] --> node_inventory_b11a85b2_efd25194
  ext_node_crypto_c7dfc512["node:crypto"] --> node_lexical_fallback_723e2b3e_cdb7bd33
  ext_node_crypto_c7dfc512["node:crypto"] --> node_linear_sync_a2fa2bf7_48e6d20b
  ext_node_crypto_c7dfc512["node:crypto"] --> node_link_checker_d0fa555f_abfe9020
  ext_node_crypto_c7dfc512["node:crypto"] --> node_migration_8a6cead4_3c3cc0a4
  ext_node_crypto_c7dfc512["node:crypto"] --> node_normalise_cc83ddc1_b95d4ccf
  ext_node_crypto_c7dfc512["node:crypto"] --> node_normalize_diagram_manifest_259cbddf_3f92b8d6
  ext_node_crypto_c7dfc512["node:crypto"] --> node_north_star_feedback_1_9c32c60d_b0cd38dc
  ext_node_crypto_c7dfc512["node:crypto"] --> node_pilot_rollback_00c1f82c_b744974b
  ext_node_crypto_c7dfc512["node:crypto"] --> node_policy_digest_ca7acf0a_bae99d76
  ext_node_crypto_c7dfc512["node:crypto"] --> node_preset_resolver_dc3dd716_3f747c75
  ext_node_crypto_c7dfc512["node:crypto"] --> node_prompt_context_drift_report_3257a95c_01f8c3e1
  ext_node_crypto_c7dfc512["node:crypto"] --> node_remediate_apply_transactions_0738b122_7ebd0795
  ext_node_crypto_c7dfc512["node:crypto"] --> node_replay_packet_a1293f88_f3b4800a
  ext_node_crypto_c7dfc512["node:crypto"] --> node_repository_identity_9dc13d37_eaffcd1e
  ext_node_crypto_c7dfc512["node:crypto"] --> node_required_checks_46396214_9d882ad3
  ext_node_crypto_c7dfc512["node:crypto"] --> node_rollback_da25480f_48e45364
  ext_node_crypto_c7dfc512["node:crypto"] --> node_run_record_emitter_core_688049d5_2036fd6f
  ext_node_crypto_c7dfc512["node:crypto"] --> node_run_records_core_89286dfa_4ce958f7
  ext_node_crypto_c7dfc512["node:crypto"] --> node_run_state_core_25a955bc_a562e9bf
  ext_node_crypto_c7dfc512["node:crypto"] --> node_runtime_card_handoff_1c8c4766_687facef
  ext_node_crypto_c7dfc512["node:crypto"] --> node_runtime_card_trace_64a5ca95_a26c03d1
  ext_node_crypto_c7dfc512["node:crypto"] --> node_scan_cache_fc02c79c_11793337
  ext_node_crypto_c7dfc512["node:crypto"] --> node_sources_878a52fc_cd312fcd
  ext_node_crypto_c7dfc512["node:crypto"] --> node_test_harness_upgrade_matrix_84113c4e_e0838daa
  ext_node_crypto_c7dfc512["node:crypto"] --> node_tracer_1e6243a2_cb3d802b
  ext_node_crypto_c7dfc512["node:crypto"] --> node_ui_loop_internal_f2eb8892_c4b49e6a
  ext_node_crypto_c7dfc512["node:crypto"] --> node_upgrade_1_b277486e_4a06b7a8
  ext_node_crypto_c7dfc512["node:crypto"] --> node_validate_artifact_runtime_surface_3fb28d25_0a1d91a4
  ext_node_crypto_c7dfc512["node:crypto"] --> node_validate_replay_packet_f309747e_8566b729
  ext_node_dns_828a0bbf["node:dns"] --> node_url_validator_3c5a1568_b9b1dc66
  ext_node_fs_a15b7d96["node:fs"] --> node_add_cli_7614de25_8e3f2fd7
  ext_node_fs_a15b7d96["node:fs"] --> node_analysis_f44e85c4_c68a7cb6
  ext_node_fs_a15b7d96["node:fs"] --> node_artifact_io_ba511748_6d1faad8
  ext_node_fs_a15b7d96["node:fs"] --> node_artifact_provenance_03b81cbf_d3038614
  ext_node_fs_a15b7d96["node:fs"] --> node_audit_b81f37a0_398f4d93
  ext_node_fs_a15b7d96["node:fs"] --> node_authz_core_f714650a_ee0f2e9d
  ext_node_fs_a15b7d96["node:fs"] --> node_brain_validator_be251832_2e2228e2
  ext_node_fs_a15b7d96["node:fs"] --> node_brainstorm_e2e2381d_fea1b255
  ext_node_fs_a15b7d96["node:fs"] --> node_branch_enforcer_acb749cd_10e89517
  ext_node_fs_a15b7d96["node:fs"] --> node_branch_protect_core_a8feb0fd_38c1f12a
  ext_node_fs_a15b7d96["node:fs"] --> node_branch_protect_sync_570adb18_cc4751e4
  ext_node_fs_a15b7d96["node:fs"] --> node_check_20f65c28_48d25399
  ext_node_fs_a15b7d96["node:fs"] --> node_check_architecture_rules_6b7347fd_dc8f2cf3
  ext_node_fs_a15b7d96["node:fs"] --> node_check_code_size_9c5efc3a_154124ae
  ext_node_fs_a15b7d96["node:fs"] --> node_check_codex_agent_roles_5bb2e89b_c1a9a472
  ext_node_fs_a15b7d96["node:fs"] --> node_check_environment_core_2c16213f_a8a456d9
  ext_node_fs_a15b7d96["node:fs"] --> node_check_pr_closeout_truth_contract_f135348c_b39f6edc
  ext_node_fs_a15b7d96["node:fs"] --> node_check_public_api_docs_a9604f1b_f824853c
  ext_node_fs_a15b7d96["node:fs"] --> node_check_root_archive_links_bba945ff_9be55643
  ext_node_fs_a15b7d96["node:fs"] --> node_check_scorecard_regressions_5c7c6445_4b474868
  ext_node_fs_a15b7d96["node:fs"] --> node_check_self_affirming_tests_7638e575_c6155698
  ext_node_fs_a15b7d96["node:fs"] --> node_check_steering_feedback_contract_80134459_abb076fc
  ext_node_fs_a15b7d96["node:fs"] --> node_ci_migrate_core_7005b5af_7e295ae3
  ext_node_fs_a15b7d96["node:fs"] --> node_ci_migrate_merge_queue_window_0070bd6d_03bcdaa9
  ext_node_fs_a15b7d96["node:fs"] --> node_ci_migrate_promotion_evidence_1a2dc527_7ed1a850
  ext_node_fs_a15b7d96["node:fs"] --> node_cli_11_338a8415_7b139087
  ext_node_fs_a15b7d96["node:fs"] --> node_cli_12_01c06c37_fabaa544
  ext_node_fs_a15b7d96["node:fs"] --> node_cli_5_9c446a0f_12d0ff9c
  ext_node_fs_a15b7d96["node:fs"] --> node_cli_99bb8840_659774ba
  ext_node_fs_a15b7d96["node:fs"] --> node_collector_0736fd5b_10bc1882
  ext_node_fs_a15b7d96["node:fs"] --> node_config_validator_669ebc2e_d7ca485d
  ext_node_fs_a15b7d96["node:fs"] --> node_context_health_80bb7da9_169768cb
  ext_node_fs_a15b7d96["node:fs"] --> node_contract_2_79042026_5e38c659
  ext_node_fs_a15b7d96["node:fs"] --> node_contract_cc8321d6_c0e3de0f
  ext_node_fs_a15b7d96["node:fs"] --> node_control_plane_core_db3b4cb2_27437a14
  ext_node_fs_a15b7d96["node:fs"] --> node_decision_packet_1_dd443771_92fa570e
  ext_node_fs_a15b7d96["node:fs"] --> node_decision_packet_8ee9d119_b89c59dd
  ext_node_fs_a15b7d96["node:fs"] --> node_detector_2_b0fc2f46_7ea6b320
  ext_node_fs_a15b7d96["node:fs"] --> node_detector_3_86ca96aa_c95676c3
  ext_node_fs_a15b7d96["node:fs"] --> node_detector_core_cdccee8d_ca107dc8
  ext_node_fs_a15b7d96["node:fs"] --> node_detector_f2b3cbe4_a0d4caae
  ext_node_fs_a15b7d96["node:fs"] --> node_diff_budget_9da0268d_71167227
  ext_node_fs_a15b7d96["node:fs"] --> node_docs_gate_core_eb9b6c18_f8540503
  ext_node_fs_a15b7d96["node:fs"] --> node_doctor_artifacts_1a126caa_fcefdf99
  ext_node_fs_a15b7d96["node:fs"] --> node_doctor_check_utils_d0fc22ea_d74f86eb
  ext_node_fs_a15b7d96["node:fs"] --> node_doctor_ci_check_alignment_d50768bd_e1cc59c2
  ext_node_fs_a15b7d96["node:fs"] --> node_doctor_ci_checks_bd3971a2_aed260d6
  ext_node_fs_a15b7d96["node:fs"] --> node_doctor_config_checks_49c872e0_f42fb5e8
  ext_node_fs_a15b7d96["node:fs"] --> node_doctor_file_checks_bc1301dc_74dc1400
  ext_node_fs_a15b7d96["node:fs"] --> node_doctor_north_star_contract_checks_0048124c_02b00237
  ext_node_fs_a15b7d96["node:fs"] --> node_doctor_roadmap_file_checks_14447b8e_2d1c2d49
  ext_node_fs_a15b7d96["node:fs"] --> node_drift_gate_artifacts_29aeb0cc_86b9c342
  ext_node_fs_a15b7d96["node:fs"] --> node_drift_gate_core_ec6b4881_9500c485
  ext_node_fs_a15b7d96["node:fs"] --> node_drift_gate_rules_9685e72d_95044db0
  ext_node_fs_a15b7d96["node:fs"] --> node_drift_gate_types_3f045f82_a9a3c987
  ext_node_fs_a15b7d96["node:fs"] --> node_eject_1_d0ecd4d1_ba72accc
  ext_node_fs_a15b7d96["node:fs"] --> node_enforcement_status_92d314f5_7cd48cbe
  ext_node_fs_a15b7d96["node:fs"] --> node_env_1_b6f6b232_dda31a93
  ext_node_fs_a15b7d96["node:fs"] --> node_env_b77349bf_420e4120
  ext_node_fs_a15b7d96["node:fs"] --> node_eval_seed_5699fd3e_2a74a5f6
  ext_node_fs_a15b7d96["node:fs"] --> node_evidence_verify_3b73c290_e82131d7
  ext_node_fs_a15b7d96["node:fs"] --> node_fleet_plan_7a1dd79c_1225abdb
  ext_node_fs_a15b7d96["node:fs"] --> node_frontmatter_metadata_gate_6901bbe4_282d02fe
  ext_node_fs_a15b7d96["node:fs"] --> node_gardener_9416a9df_87b06be0
  ext_node_fs_a15b7d96["node:fs"] --> node_gate_c974e17b_07549baf
  ext_node_fs_a15b7d96["node:fs"] --> node_generated_artifact_parent_1f7755de_7894ed12
  ext_node_fs_a15b7d96["node:fs"] --> node_github_e2e_2891a341_af6f1610
  ext_node_fs_a15b7d96["node:fs"] --> node_harness_artifact_routine_17afacff_14dbb24c
  ext_node_fs_a15b7d96["node:fs"] --> node_harness_artifact_routine_utils_5abaac59_ab2e20b3
  ext_node_fs_a15b7d96["node:fs"] --> node_health_core_2b2fdada_341de678
  ext_node_fs_a15b7d96["node:fs"] --> node_idempotency_f5d39a07_bce757f2
  ext_node_fs_a15b7d96["node:fs"] --> node_index_context_de3ed39d_6df7adf5
  ext_node_fs_a15b7d96["node:fs"] --> node_indexer_70fa78e5_97c1bb0b
  ext_node_fs_a15b7d96["node:fs"] --> node_init_ops_e54123f9_3ce18443
  ext_node_fs_a15b7d96["node:fs"] --> node_instruction_compat_06a469fd_3b3e1df0
  ext_node_fs_a15b7d96["node:fs"] --> node_interactive_0eb42ac4_3ee6c3c6
  ext_node_fs_a15b7d96["node:fs"] --> node_learnings_9feb3e1d_4980a445
  ext_node_fs_a15b7d96["node:fs"] --> node_lexical_fallback_723e2b3e_cdb7bd33
  ext_node_fs_a15b7d96["node:fs"] --> node_linear_gate_core_a415ae74_222bd4b9
  ext_node_fs_a15b7d96["node:fs"] --> node_linear_sync_a2fa2bf7_48e6d20b
  ext_node_fs_a15b7d96["node:fs"] --> node_link_checker_d0fa555f_abfe9020
  ext_node_fs_a15b7d96["node:fs"] --> node_lint_checks_83522b19_3fff9a7d
  ext_node_fs_a15b7d96["node:fs"] --> node_lint_cli_9ec62ec0_62537dee
  ext_node_fs_a15b7d96["node:fs"] --> node_lint_pages_e33301d0_51f54ed1
  ext_node_fs_a15b7d96["node:fs"] --> node_loader_1_16749818_9255dc35
  ext_node_fs_a15b7d96["node:fs"] --> node_loader_d47712cc_1c3a0e19
  ext_node_fs_a15b7d96["node:fs"] --> node_local_memory_0db17ecc_97fe98ce
  ext_node_fs_a15b7d96["node:fs"] --> node_local_runtime_card_artifacts_35c25816_0ad02372
  ext_node_fs_a15b7d96["node:fs"] --> node_local_runtime_card_phase_exit_275ffa9a_383aa95e
  ext_node_fs_a15b7d96["node:fs"] --> node_metadata_scanner_6a101b66_5ca79039
  ext_node_fs_a15b7d96["node:fs"] --> node_metrics_capture_core_db4bf7cf_7494304c
  ext_node_fs_a15b7d96["node:fs"] --> node_metrics_tracker_98cec29c_9c4c2266
  ext_node_fs_a15b7d96["node:fs"] --> node_migration_8a6cead4_3c3cc0a4
  ext_node_fs_a15b7d96["node:fs"] --> node_next_runner_41643472_9b94424f
  ext_node_fs_a15b7d96["node:fs"] --> node_normalize_diagram_manifest_259cbddf_3f92b8d6
  ext_node_fs_a15b7d96["node:fs"] --> node_normalize_workflow_contracts_8701f1c8_0fdf7d2f
  ext_node_fs_a15b7d96["node:fs"] --> node_north_star_artifact_io_9f2c34b2_6490caba
  ext_node_fs_a15b7d96["node:fs"] --> node_north_star_feedback_1_9c32c60d_b0cd38dc
  ext_node_fs_a15b7d96["node:fs"] --> node_observed_skill_usage_ed7d5930_7f7edbe6
  ext_node_fs_a15b7d96["node:fs"] --> node_org_audit_d739e44b_e522723c
  ext_node_fs_a15b7d96["node:fs"] --> node_overrides_ab2dd33e_6115e15e
  ext_node_fs_a15b7d96["node:fs"] --> node_ownership_gate_2e194d13_2b02b2e1
  ext_node_fs_a15b7d96["node:fs"] --> node_pattern_scope_61ff946d_a1f21fd8
  ext_node_fs_a15b7d96["node:fs"] --> node_pattern_scope_siblings_43abe000_821756b0
  ext_node_fs_a15b7d96["node:fs"] --> node_pilot_evaluate_core_48a59b4a_deb218dc
  ext_node_fs_a15b7d96["node:fs"] --> node_pilot_rollback_00c1f82c_b744974b
  ext_node_fs_a15b7d96["node:fs"] --> node_plan_64879f7d_9e01597f
  ext_node_fs_a15b7d96["node:fs"] --> node_pr_closeout_0ac07306_e8d9c77f
  ext_node_fs_a15b7d96["node:fs"] --> node_pr_closeout_env_9bfcd9ef_f476024a
  ext_node_fs_a15b7d96["node:fs"] --> node_pr_closeout_input_02319f8e_456ea535
  ext_node_fs_a15b7d96["node:fs"] --> node_pr_template_gate_281778f9_aa0b3f59
  ext_node_fs_a15b7d96["node:fs"] --> node_preflight_cli_5d148379_72bb6ef7
  ext_node_fs_a15b7d96["node:fs"] --> node_preflight_gate_command_spec_c45f57f0_bdeb46cb
  ext_node_fs_a15b7d96["node:fs"] --> node_preset_detection_b0f00a17_4f7c5082
  ext_node_fs_a15b7d96["node:fs"] --> node_preset_resolver_dc3dd716_3f747c75
  ext_node_fs_a15b7d96["node:fs"] --> node_prompt_context_drift_report_3257a95c_01f8c3e1
  ext_node_fs_a15b7d96["node:fs"] --> node_provider_adapter_3bcf82b7_3ce4cf67
  ext_node_fs_a15b7d96["node:fs"] --> node_quality_scorer_362f2a90_2a086a0b
  ext_node_fs_a15b7d96["node:fs"] --> node_query_cli_b95be64d_1ebc13aa
  ext_node_fs_a15b7d96["node:fs"] --> node_registries_06402afa_0868b564
  ext_node_fs_a15b7d96["node:fs"] --> node_registry_core_c9990279_3e2fda38
  ext_node_fs_a15b7d96["node:fs"] --> node_remediate_apply_transactions_0738b122_7ebd0795
  ext_node_fs_a15b7d96["node:fs"] --> node_remediate_runner_helpers_929fedcc_8714d951
  ext_node_fs_a15b7d96["node:fs"] --> node_replay_packet_a1293f88_f3b4800a
  ext_node_fs_a15b7d96["node:fs"] --> node_repo_bound_paths_e218b5b3_216d0eb0
  ext_node_fs_a15b7d96["node:fs"] --> node_repo_evidence_38bb1de5_def15798
  ext_node_fs_a15b7d96["node:fs"] --> node_repo_runtime_artifact_139c0fbd_51129f15
  ext_node_fs_a15b7d96["node:fs"] --> node_repo_scanner_core_8e9f7646_10aca705
  ext_node_fs_a15b7d96["node:fs"] --> node_repositories_a8038884_2c62efe4
  ext_node_fs_a15b7d96["node:fs"] --> node_repository_identity_9dc13d37_eaffcd1e
  ext_node_fs_a15b7d96["node:fs"] --> node_required_check_manifest_744e3936_5a20f8d5
  ext_node_fs_a15b7d96["node:fs"] --> node_resource_tracker_d95b6649_20895bd3
  ext_node_fs_a15b7d96["node:fs"] --> node_resume_admissibility_core_8ab84488_faaf2191
  ext_node_fs_a15b7d96["node:fs"] --> node_review_context_1_e3afed15_9e46568f
  ext_node_fs_a15b7d96["node:fs"] --> node_review_gate_core_4c8001f9_809cf3ee
  ext_node_fs_a15b7d96["node:fs"] --> node_rollback_da25480f_48e45364
  ext_node_fs_a15b7d96["node:fs"] --> node_rollback_manifest_validation_d8f5147c_e2e46585
  ext_node_fs_a15b7d96["node:fs"] --> node_rule_lifecycle_3130e11b_d296efac
  ext_node_fs_a15b7d96["node:fs"] --> node_run_e2e_39efe696_fb07ee74
  ext_node_fs_a15b7d96["node:fs"] --> node_run_harness_evals_77704768_ba42904d
  ext_node_fs_a15b7d96["node:fs"] --> node_run_record_emitter_core_688049d5_2036fd6f
  ext_node_fs_a15b7d96["node:fs"] --> node_run_records_core_89286dfa_4ce958f7
  ext_node_fs_a15b7d96["node:fs"] --> node_run_state_core_25a955bc_a562e9bf
  ext_node_fs_a15b7d96["node:fs"] --> node_runner_1_6f281bf8_36f20bbb
  ext_node_fs_a15b7d96["node:fs"] --> node_runtime_budget_dfce83ae_5cbd79a2
  ext_node_fs_a15b7d96["node:fs"] --> node_runtime_card_handoff_1c8c4766_687facef
  ext_node_fs_a15b7d96["node:fs"] --> node_runtime_card_trace_64a5ca95_a26c03d1
  ext_node_fs_a15b7d96["node:fs"] --> node_satisfiability_6c08de4b_de8c902a
  ext_node_fs_a15b7d96["node:fs"] --> node_scaffold_ci_template_utils_1035b61c_0513532b
  ext_node_fs_a15b7d96["node:fs"] --> node_scaffold_db8a7260_1ca6adc9
  ext_node_fs_a15b7d96["node:fs"] --> node_scaffold_governance_templates_5c949d24_3d624d65
  ext_node_fs_a15b7d96["node:fs"] --> node_scaffold_hook_templates_8c74ab50_572d99d9
  ext_node_fs_a15b7d96["node:fs"] --> node_scaffold_root_templates_61731280_c6c59378
  ext_node_fs_a15b7d96["node:fs"] --> node_scaffold_shell_templates_0ad0f915_ccc86664
  ext_node_fs_a15b7d96["node:fs"] --> node_scaffold_worktree_templates_66a38e9a_ff3c085c
  ext_node_fs_a15b7d96["node:fs"] --> node_scan_cache_fc02c79c_11793337
  ext_node_fs_a15b7d96["node:fs"] --> node_setup_git_hooks_70750d40_b4ca2cf9
  ext_node_fs_a15b7d96["node:fs"] --> node_source_outline_1_54a631fa_8582fb07
  ext_node_fs_a15b7d96["node:fs"] --> node_sources_878a52fc_cd312fcd
  ext_node_fs_a15b7d96["node:fs"] --> node_stale_cli_64548720_6bb67d64
  ext_node_fs_a15b7d96["node:fs"] --> node_stale_detector_a563289e_653281b0
  ext_node_fs_a15b7d96["node:fs"] --> node_status_cli_4c24a0d6_7dbac67a
  ext_node_fs_a15b7d96["node:fs"] --> node_store_1_0ab51284_0ffe807a
  ext_node_fs_a15b7d96["node:fs"] --> node_store_824d80d7_69038a3e
  ext_node_fs_a15b7d96["node:fs"] --> node_suggestion_generator_0956f794_4fce3834
  ext_node_fs_a15b7d96["node:fs"] --> node_symphony_check_e97f2ea0_09eb5bd1
  ext_node_fs_a15b7d96["node:fs"] --> node_sync_codex_preflight_7e7a8dc2_f2ef0386
  ext_node_fs_a15b7d96["node:fs"] --> node_templates_9c6641c1_7da84505
  ext_node_fs_a15b7d96["node:fs"] --> node_test_harness_6e520b98_6b3d1d32
  ext_node_fs_a15b7d96["node:fs"] --> node_test_harness_upgrade_matrix_84113c4e_e0838daa
  ext_node_fs_a15b7d96["node:fs"] --> node_tooling_audit_core_328d6a41_01cbc905
  ext_node_fs_a15b7d96["node:fs"] --> node_tracer_1e6243a2_cb3d802b
  ext_node_fs_a15b7d96["node:fs"] --> node_ui_loop_internal_f2eb8892_c4b49e6a
  ext_node_fs_a15b7d96["node:fs"] --> node_ui_loop_tooling_12b2d2c7_1abedab2
  ext_node_fs_a15b7d96["node:fs"] --> node_update_core_bced358c_b710dd59
  ext_node_fs_a15b7d96["node:fs"] --> node_upgrade_1_b277486e_4a06b7a8
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_action_review_receipt_fa2f06c3_d49ef9bb
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_artifact_runtime_surface_3fb28d25_0a1d91a4
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_audit_references_811f872a_0ce355a8
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_branch_protection_alignment_09b7779a_6f299056
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_commit_msg_43b008fe_f9560ef9
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_decision_request_2e5c325e_579d9d4b
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_evidence_patterns_cacd9fb4_240eb37f
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_goal_completion_audit_receipt_100d252c_2d821c1e
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_intermediary_receipt_coverage_7d63b166_40dcf15d
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_packaged_skill_5e32c890_9228ad58
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_prompt_context_drift_8c949ef6_d32d5759
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_replay_packet_f309747e_8566b729
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_review_lifecycle_0b410d1e_cf9db8cc
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_reviewer_coverage_251efee3_621cd543
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_runtime_packet_schemas_bc3ba8ec_ee732335
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_steering_queue_4bc0cc94_58b6d2b9
  ext_node_fs_a15b7d96["node:fs"] --> node_validate_workflow_contracts_33dc063c_2f80e314
  ext_node_fs_a15b7d96["node:fs"] --> node_validator_1_0c0621d8_0e5afcb6
  ext_node_fs_a15b7d96["node:fs"] --> node_validator_2_744853f5_98bb2caf
  ext_node_fs_a15b7d96["node:fs"] --> node_validator_3_28b6e9f3_2ed5b007
  ext_node_fs_a15b7d96["node:fs"] --> node_validator_4_5180cf23_247c289b
  ext_node_fs_a15b7d96["node:fs"] --> node_validator_6_3688adbf_8ba940df
  ext_node_fs_a15b7d96["node:fs"] --> node_validator_core_1_1518647e_d8d0b249
  ext_node_fs_a15b7d96["node:fs"] --> node_verify_coderabbit_490b4e71_8859655f
  ext_node_fs_a15b7d96["node:fs"] --> node_version_5ca4f385_fd75945b
  ext_node_fs_a15b7d96["node:fs"] --> node_version_coherence_69733bcb_00c8d5d9
  ext_node_fs_a15b7d96["node:fs"] --> node_workflow_generate_2fc0af62_803bbfeb
  ext_node_fs_a15b7d96["node:fs"] --> node_workflow_generate_parser_ad69fefe_62542333
  ext_node_module_ca1b42af["node:module"] --> node_health_core_2b2fdada_341de678
  ext_node_os_d93fe73a["node:os"] --> node_env_1_b6f6b232_dda31a93
  ext_node_os_d93fe73a["node:os"] --> node_github_e2e_2891a341_af6f1610
  ext_node_os_d93fe73a["node:os"] --> node_link_checker_d0fa555f_abfe9020
  ext_node_os_d93fe73a["node:os"] --> node_overload_guard_2748c559_3eff560b
  ext_node_os_d93fe73a["node:os"] --> node_performance_overload_c685bfcf_291ef65a
  ext_node_os_d93fe73a["node:os"] --> node_pr_closeout_env_9bfcd9ef_f476024a
  ext_node_os_d93fe73a["node:os"] --> node_runner_1_6f281bf8_36f20bbb
  ext_node_os_d93fe73a["node:os"] --> node_test_harness_6e520b98_6b3d1d32
  ext_node_os_d93fe73a["node:os"] --> node_test_harness_upgrade_matrix_84113c4e_e0838daa
  ext_node_path_78811c13["node:path"] --> node_add_cli_7614de25_8e3f2fd7
  ext_node_path_78811c13["node:path"] --> node_analysis_f44e85c4_c68a7cb6
  ext_node_path_78811c13["node:path"] --> node_args_090772cf_1bac9202
  ext_node_path_78811c13["node:path"] --> node_args_1_15220d9b_f1d9281c
  ext_node_path_78811c13["node:path"] --> node_artifact_io_ba511748_6d1faad8
  ext_node_path_78811c13["node:path"] --> node_artifact_provenance_03b81cbf_d3038614
  ext_node_path_78811c13["node:path"] --> node_audit_b81f37a0_398f4d93
  ext_node_path_78811c13["node:path"] --> node_authz_core_f714650a_ee0f2e9d
  ext_node_path_78811c13["node:path"] --> node_automation_run_22331800_346133c3
  ext_node_path_78811c13["node:path"] --> node_brain_validator_be251832_2e2228e2
  ext_node_path_78811c13["node:path"] --> node_brainstorm_e2e2381d_fea1b255
  ext_node_path_78811c13["node:path"] --> node_branch_enforcer_acb749cd_10e89517
  ext_node_path_78811c13["node:path"] --> node_branch_protect_core_a8feb0fd_38c1f12a
  ext_node_path_78811c13["node:path"] --> node_branch_protect_sync_570adb18_cc4751e4
  ext_node_path_78811c13["node:path"] --> node_check_20f65c28_48d25399
  ext_node_path_78811c13["node:path"] --> node_check_architecture_rules_6b7347fd_dc8f2cf3
  ext_node_path_78811c13["node:path"] --> node_check_code_size_9c5efc3a_154124ae
  ext_node_path_78811c13["node:path"] --> node_check_codex_agent_roles_5bb2e89b_c1a9a472
  ext_node_path_78811c13["node:path"] --> node_check_environment_core_2c16213f_a8a456d9
  ext_node_path_78811c13["node:path"] --> node_check_pr_closeout_truth_contract_f135348c_b39f6edc
  ext_node_path_78811c13["node:path"] --> node_check_public_api_docs_a9604f1b_f824853c
  ext_node_path_78811c13["node:path"] --> node_check_root_archive_links_bba945ff_9be55643
  ext_node_path_78811c13["node:path"] --> node_check_scorecard_regressions_5c7c6445_4b474868
  ext_node_path_78811c13["node:path"] --> node_check_self_affirming_tests_7638e575_c6155698
  ext_node_path_78811c13["node:path"] --> node_check_steering_feedback_contract_80134459_abb076fc
  ext_node_path_78811c13["node:path"] --> node_checker_d2d2328e_303f205e
  ext_node_path_78811c13["node:path"] --> node_ci_migrate_core_7005b5af_7e295ae3
  ext_node_path_78811c13["node:path"] --> node_ci_migrate_merge_queue_window_0070bd6d_03bcdaa9
  ext_node_path_78811c13["node:path"] --> node_ci_migrate_promotion_evidence_1a2dc527_7ed1a850
  ext_node_path_78811c13["node:path"] --> node_ci_migrate_snapshot_paths_a10de06b_30ae5166
  ext_node_path_78811c13["node:path"] --> node_cli_12_01c06c37_fabaa544
  ext_node_path_78811c13["node:path"] --> node_cli_5_9c446a0f_12d0ff9c
  ext_node_path_78811c13["node:path"] --> node_cli_99bb8840_659774ba
  ext_node_path_78811c13["node:path"] --> node_cli_args_8_d546936e_2dae0fbc
  ext_node_path_78811c13["node:path"] --> node_collector_0736fd5b_10bc1882
  ext_node_path_78811c13["node:path"] --> node_config_validator_669ebc2e_d7ca485d
  ext_node_path_78811c13["node:path"] --> node_context_ea7792a2_08541ab6
  ext_node_path_78811c13["node:path"] --> node_context_health_80bb7da9_169768cb
  ext_node_path_78811c13["node:path"] --> node_contract_2_79042026_5e38c659
  ext_node_path_78811c13["node:path"] --> node_contract_cc8321d6_c0e3de0f
  ext_node_path_78811c13["node:path"] --> node_control_plane_core_db3b4cb2_27437a14
  ext_node_path_78811c13["node:path"] --> node_decision_packet_1_dd443771_92fa570e
  ext_node_path_78811c13["node:path"] --> node_decision_packet_8ee9d119_b89c59dd
  ext_node_path_78811c13["node:path"] --> node_detector_2_b0fc2f46_7ea6b320
  ext_node_path_78811c13["node:path"] --> node_detector_3_86ca96aa_c95676c3
  ext_node_path_78811c13["node:path"] --> node_detector_core_cdccee8d_ca107dc8
  ext_node_path_78811c13["node:path"] --> node_detector_f2b3cbe4_a0d4caae
  ext_node_path_78811c13["node:path"] --> node_docs_gate_core_eb9b6c18_f8540503
  ext_node_path_78811c13["node:path"] --> node_doctor_72f4be89_04fd2f3d
  ext_node_path_78811c13["node:path"] --> node_doctor_artifacts_1a126caa_fcefdf99
  ext_node_path_78811c13["node:path"] --> node_doctor_ci_check_alignment_d50768bd_e1cc59c2
  ext_node_path_78811c13["node:path"] --> node_doctor_ci_checks_bd3971a2_aed260d6
  ext_node_path_78811c13["node:path"] --> node_doctor_config_checks_49c872e0_f42fb5e8
  ext_node_path_78811c13["node:path"] --> node_doctor_file_checks_bc1301dc_74dc1400
  ext_node_path_78811c13["node:path"] --> node_doctor_north_star_contract_checks_0048124c_02b00237
  ext_node_path_78811c13["node:path"] --> node_doctor_roadmap_file_checks_14447b8e_2d1c2d49
  ext_node_path_78811c13["node:path"] --> node_drift_gate_artifacts_29aeb0cc_86b9c342
  ext_node_path_78811c13["node:path"] --> node_drift_gate_command_surface_060f7e67_f8e83146
  ext_node_path_78811c13["node:path"] --> node_drift_gate_core_ec6b4881_9500c485
  ext_node_path_78811c13["node:path"] --> node_drift_gate_rules_9685e72d_95044db0
  ext_node_path_78811c13["node:path"] --> node_drift_gate_types_3f045f82_a9a3c987
  ext_node_path_78811c13["node:path"] --> node_eject_1_d0ecd4d1_ba72accc
  ext_node_path_78811c13["node:path"] --> node_enforcement_status_92d314f5_7cd48cbe
  ext_node_path_78811c13["node:path"] --> node_env_1_b6f6b232_dda31a93
  ext_node_path_78811c13["node:path"] --> node_eval_seed_5699fd3e_2a74a5f6
  ext_node_path_78811c13["node:path"] --> node_evidence_verify_3b73c290_e82131d7
  ext_node_path_78811c13["node:path"] --> node_frontmatter_metadata_gate_6901bbe4_282d02fe
  ext_node_path_78811c13["node:path"] --> node_gardener_9416a9df_87b06be0
  ext_node_path_78811c13["node:path"] --> node_gate_c974e17b_07549baf
  ext_node_path_78811c13["node:path"] --> node_generated_artifact_parent_1f7755de_7894ed12
  ext_node_path_78811c13["node:path"] --> node_github_e2e_2891a341_af6f1610
  ext_node_path_78811c13["node:path"] --> node_harness_artifact_routine_17afacff_14dbb24c
  ext_node_path_78811c13["node:path"] --> node_harness_artifact_routine_utils_5abaac59_ab2e20b3
  ext_node_path_78811c13["node:path"] --> node_health_core_2b2fdada_341de678
  ext_node_path_78811c13["node:path"] --> node_idempotency_f5d39a07_bce757f2
  ext_node_path_78811c13["node:path"] --> node_index_context_de3ed39d_6df7adf5
  ext_node_path_78811c13["node:path"] --> node_indexer_70fa78e5_97c1bb0b
  ext_node_path_78811c13["node:path"] --> node_init_ops_e54123f9_3ce18443
  ext_node_path_78811c13["node:path"] --> node_instruction_compat_06a469fd_3b3e1df0
  ext_node_path_78811c13["node:path"] --> node_interactive_0eb42ac4_3ee6c3c6
  ext_node_path_78811c13["node:path"] --> node_learnings_9feb3e1d_4980a445
  ext_node_path_78811c13["node:path"] --> node_lexical_fallback_723e2b3e_cdb7bd33
  ext_node_path_78811c13["node:path"] --> node_linear_gate_core_a415ae74_222bd4b9
  ext_node_path_78811c13["node:path"] --> node_link_checker_d0fa555f_abfe9020
  ext_node_path_78811c13["node:path"] --> node_lint_attachments_873c0632_8c776b17
  ext_node_path_78811c13["node:path"] --> node_lint_checks_83522b19_3fff9a7d
  ext_node_path_78811c13["node:path"] --> node_lint_pages_e33301d0_51f54ed1
  ext_node_path_78811c13["node:path"] --> node_loader_1_16749818_9255dc35
  ext_node_path_78811c13["node:path"] --> node_loader_d47712cc_1c3a0e19
  ext_node_path_78811c13["node:path"] --> node_local_runtime_card_artifacts_35c25816_0ad02372
  ext_node_path_78811c13["node:path"] --> node_local_runtime_card_phase_exit_275ffa9a_383aa95e
  ext_node_path_78811c13["node:path"] --> node_metadata_scanner_6a101b66_5ca79039
  ext_node_path_78811c13["node:path"] --> node_metrics_capture_core_db4bf7cf_7494304c
  ext_node_path_78811c13["node:path"] --> node_metrics_tracker_98cec29c_9c4c2266
  ext_node_path_78811c13["node:path"] --> node_migration_8a6cead4_3c3cc0a4
  ext_node_path_78811c13["node:path"] --> node_next_runner_41643472_9b94424f
  ext_node_path_78811c13["node:path"] --> node_normalize_diagram_manifest_259cbddf_3f92b8d6
  ext_node_path_78811c13["node:path"] --> node_normalize_workflow_contracts_8701f1c8_0fdf7d2f
  ext_node_path_78811c13["node:path"] --> node_north_star_artifact_io_9f2c34b2_6490caba
  ext_node_path_78811c13["node:path"] --> node_north_star_feedback_1_9c32c60d_b0cd38dc
  ext_node_path_78811c13["node:path"] --> node_observed_skill_usage_ed7d5930_7f7edbe6
  ext_node_path_78811c13["node:path"] --> node_org_audit_d739e44b_e522723c
  ext_node_path_78811c13["node:path"] --> node_overrides_ab2dd33e_6115e15e
  ext_node_path_78811c13["node:path"] --> node_ownership_gate_2e194d13_2b02b2e1
  ext_node_path_78811c13["node:path"] --> node_pattern_scope_61ff946d_a1f21fd8
  ext_node_path_78811c13["node:path"] --> node_pattern_scope_siblings_43abe000_821756b0
  ext_node_path_78811c13["node:path"] --> node_pilot_evaluate_core_48a59b4a_deb218dc
  ext_node_path_78811c13["node:path"] --> node_pilot_rollback_00c1f82c_b744974b
  ext_node_path_78811c13["node:path"] --> node_plan_64879f7d_9e01597f
  ext_node_path_78811c13["node:path"] --> node_pr_closeout_0ac07306_e8d9c77f
  ext_node_path_78811c13["node:path"] --> node_pr_closeout_args_8164b0a8_2240b166
  ext_node_path_78811c13["node:path"] --> node_pr_closeout_env_9bfcd9ef_f476024a
  ext_node_path_78811c13["node:path"] --> node_pr_closeout_input_02319f8e_456ea535
  ext_node_path_78811c13["node:path"] --> node_preflight_cli_5d148379_72bb6ef7
  ext_node_path_78811c13["node:path"] --> node_preset_detection_b0f00a17_4f7c5082
  ext_node_path_78811c13["node:path"] --> node_preset_resolver_dc3dd716_3f747c75
  ext_node_path_78811c13["node:path"] --> node_prompt_context_drift_report_3257a95c_01f8c3e1
  ext_node_path_78811c13["node:path"] --> node_provider_adapter_3bcf82b7_3ce4cf67
  ext_node_path_78811c13["node:path"] --> node_quality_scorer_362f2a90_2a086a0b
  ext_node_path_78811c13["node:path"] --> node_query_cli_b95be64d_1ebc13aa
  ext_node_path_78811c13["node:path"] --> node_registries_06402afa_0868b564
  ext_node_path_78811c13["node:path"] --> node_registry_core_c9990279_3e2fda38
  ext_node_path_78811c13["node:path"] --> node_remediate_apply_transactions_0738b122_7ebd0795
  ext_node_path_78811c13["node:path"] --> node_replay_ac203c98_115ce9a2
  ext_node_path_78811c13["node:path"] --> node_replay_packet_a1293f88_f3b4800a
  ext_node_path_78811c13["node:path"] --> node_repo_bound_paths_e218b5b3_216d0eb0
  ext_node_path_78811c13["node:path"] --> node_repo_evidence_38bb1de5_def15798
  ext_node_path_78811c13["node:path"] --> node_repo_runtime_artifact_139c0fbd_51129f15
  ext_node_path_78811c13["node:path"] --> node_repo_scanner_core_8e9f7646_10aca705
  ext_node_path_78811c13["node:path"] --> node_repositories_a8038884_2c62efe4
  ext_node_path_78811c13["node:path"] --> node_required_check_manifest_744e3936_5a20f8d5
  ext_node_path_78811c13["node:path"] --> node_resource_tracker_d95b6649_20895bd3
  ext_node_path_78811c13["node:path"] --> node_resume_admissibility_core_8ab84488_faaf2191
  ext_node_path_78811c13["node:path"] --> node_review_context_1_e3afed15_9e46568f
  ext_node_path_78811c13["node:path"] --> node_review_gate_core_4c8001f9_809cf3ee
  ext_node_path_78811c13["node:path"] --> node_rollback_da25480f_48e45364
  ext_node_path_78811c13["node:path"] --> node_rollback_manifest_validation_d8f5147c_e2e46585
  ext_node_path_78811c13["node:path"] --> node_rule_lifecycle_3130e11b_d296efac
  ext_node_path_78811c13["node:path"] --> node_run_e2e_39efe696_fb07ee74
  ext_node_path_78811c13["node:path"] --> node_run_harness_evals_77704768_ba42904d
  ext_node_path_78811c13["node:path"] --> node_run_local_memory_preflight_36e92808_9841c57a
  ext_node_path_78811c13["node:path"] --> node_run_record_emitter_core_688049d5_2036fd6f
  ext_node_path_78811c13["node:path"] --> node_run_records_core_89286dfa_4ce958f7
  ext_node_path_78811c13["node:path"] --> node_run_state_core_25a955bc_a562e9bf
  ext_node_path_78811c13["node:path"] --> node_runner_1_6f281bf8_36f20bbb
  ext_node_path_78811c13["node:path"] --> node_runtime_card_args_2b3d4b28_5cfe029c
  ext_node_path_78811c13["node:path"] --> node_runtime_card_trace_64a5ca95_a26c03d1
  ext_node_path_78811c13["node:path"] --> node_satisfiability_6c08de4b_de8c902a
  ext_node_path_78811c13["node:path"] --> node_scaffold_ci_template_utils_1035b61c_0513532b
  ext_node_path_78811c13["node:path"] --> node_scaffold_db8a7260_1ca6adc9
  ext_node_path_78811c13["node:path"] --> node_scaffold_hook_templates_8c74ab50_572d99d9
  ext_node_path_78811c13["node:path"] --> node_scan_cache_fc02c79c_11793337
  ext_node_path_78811c13["node:path"] --> node_search_24193290_6a30c5b7
  ext_node_path_78811c13["node:path"] --> node_setup_git_hooks_70750d40_b4ca2cf9
  ext_node_path_78811c13["node:path"] --> node_source_outline_1_54a631fa_8582fb07
  ext_node_path_78811c13["node:path"] --> node_sources_878a52fc_cd312fcd
  ext_node_path_78811c13["node:path"] --> node_stale_detector_a563289e_653281b0
  ext_node_path_78811c13["node:path"] --> node_store_1_0ab51284_0ffe807a
  ext_node_path_78811c13["node:path"] --> node_store_824d80d7_69038a3e
  ext_node_path_78811c13["node:path"] --> node_suggestion_generator_0956f794_4fce3834
  ext_node_path_78811c13["node:path"] --> node_symphony_check_e97f2ea0_09eb5bd1
  ext_node_path_78811c13["node:path"] --> node_sync_codex_preflight_7e7a8dc2_f2ef0386
  ext_node_path_78811c13["node:path"] --> node_templates_9c6641c1_7da84505
  ext_node_path_78811c13["node:path"] --> node_test_harness_6e520b98_6b3d1d32
  ext_node_path_78811c13["node:path"] --> node_test_harness_upgrade_matrix_84113c4e_e0838daa
  ext_node_path_78811c13["node:path"] --> node_tooling_audit_core_328d6a41_01cbc905
  ext_node_path_78811c13["node:path"] --> node_tracer_1e6243a2_cb3d802b
  ext_node_path_78811c13["node:path"] --> node_ui_loop_internal_f2eb8892_c4b49e6a
  ext_node_path_78811c13["node:path"] --> node_ui_loop_tooling_12b2d2c7_1abedab2
  ext_node_path_78811c13["node:path"] --> node_update_core_bced358c_b710dd59
  ext_node_path_78811c13["node:path"] --> node_upgrade_1_b277486e_4a06b7a8
  ext_node_path_78811c13["node:path"] --> node_validate_artifact_runtime_surface_3fb28d25_0a1d91a4
  ext_node_path_78811c13["node:path"] --> node_validate_audit_references_811f872a_0ce355a8
  ext_node_path_78811c13["node:path"] --> node_validate_branch_protection_alignment_09b7779a_6f299056
  ext_node_path_78811c13["node:path"] --> node_validate_evidence_patterns_cacd9fb4_240eb37f
  ext_node_path_78811c13["node:path"] --> node_validate_intermediary_receipt_coverage_7d63b166_40dcf15d
  ext_node_path_78811c13["node:path"] --> node_validate_packaged_skill_5e32c890_9228ad58
  ext_node_path_78811c13["node:path"] --> node_validate_prompt_context_drift_8c949ef6_d32d5759
  ext_node_path_78811c13["node:path"] --> node_validate_replay_packet_f309747e_8566b729
  ext_node_path_78811c13["node:path"] --> node_validate_reviewer_coverage_251efee3_621cd543
  ext_node_path_78811c13["node:path"] --> node_validate_runtime_packet_schemas_bc3ba8ec_ee732335
  ext_node_path_78811c13["node:path"] --> node_validate_workflow_contracts_33dc063c_2f80e314
  ext_node_path_78811c13["node:path"] --> node_validator_1_0c0621d8_0e5afcb6
  ext_node_path_78811c13["node:path"] --> node_validator_2_744853f5_98bb2caf
  ext_node_path_78811c13["node:path"] --> node_validator_3_28b6e9f3_2ed5b007
  ext_node_path_78811c13["node:path"] --> node_validator_4_5180cf23_247c289b
  ext_node_path_78811c13["node:path"] --> node_validator_6_3688adbf_8ba940df
  ext_node_path_78811c13["node:path"] --> node_validator_core_1_1518647e_d8d0b249
  ext_node_path_78811c13["node:path"] --> node_verify_coderabbit_490b4e71_8859655f
  ext_node_path_78811c13["node:path"] --> node_version_5ca4f385_fd75945b
  ext_node_path_78811c13["node:path"] --> node_version_coherence_69733bcb_00c8d5d9
  ext_node_path_78811c13["node:path"] --> node_workflow_generate_2fc0af62_803bbfeb
  ext_node_perf_hooks_906292ff["node:perf_hooks"] --> node_performance_overload_c685bfcf_291ef65a
  ext_node_process_00cdf119["node:process"] --> node_args_090772cf_1bac9202
  ext_node_process_00cdf119["node:process"] --> node_check_20f65c28_48d25399
  ext_node_process_00cdf119["node:process"] --> node_ci_migrate_core_7005b5af_7e295ae3
  ext_node_process_00cdf119["node:process"] --> node_ci_migrate_signing_2d82ac3f_9e5e8974
  ext_node_process_00cdf119["node:process"] --> node_cli_5_9c446a0f_12d0ff9c
  ext_node_process_00cdf119["node:process"] --> node_contract_cc8321d6_c0e3de0f
  ext_node_process_00cdf119["node:process"] --> node_next_c6c1c9a9_040a8dbb
  ext_node_process_00cdf119["node:process"] --> node_next_runner_41643472_9b94424f
  ext_node_process_00cdf119["node:process"] --> node_performance_overload_c685bfcf_291ef65a
  ext_node_process_00cdf119["node:process"] --> node_pr_closeout_args_8164b0a8_2240b166
  ext_node_process_00cdf119["node:process"] --> node_runner_527aa9f4_40925a5b
  ext_node_process_00cdf119["node:process"] --> node_runtime_card_args_2b3d4b28_5cfe029c
  ext_node_readline_bb6096cc["node:readline"] --> node_eject_1_d0ecd4d1_ba72accc
  ext_node_url_d0cb3ad7["node:url"] --> node_cli_99bb8840_659774ba
  ext_node_url_d0cb3ad7["node:url"] --> node_coderabbit_csv_3ef61ffc_af2b743e
  ext_node_url_d0cb3ad7["node:url"] --> node_control_plane_core_db3b4cb2_27437a14
  ext_node_url_d0cb3ad7["node:url"] --> node_decision_packet_1_dd443771_92fa570e
  ext_node_url_d0cb3ad7["node:url"] --> node_gate_c974e17b_07549baf
  ext_node_url_d0cb3ad7["node:url"] --> node_health_core_2b2fdada_341de678
  ext_node_url_d0cb3ad7["node:url"] --> node_preset_resolver_dc3dd716_3f747c75
  ext_node_url_d0cb3ad7["node:url"] --> node_repo_bound_paths_e218b5b3_216d0eb0
  ext_node_url_d0cb3ad7["node:url"] --> node_run_e2e_39efe696_fb07ee74
  ext_node_url_d0cb3ad7["node:url"] --> node_run_harness_evals_77704768_ba42904d
  ext_node_url_d0cb3ad7["node:url"] --> node_run_local_memory_preflight_36e92808_9841c57a
  ext_node_url_d0cb3ad7["node:url"] --> node_scaffold_ci_template_utils_1035b61c_0513532b
  ext_node_url_d0cb3ad7["node:url"] --> node_scaffold_governance_templates_5c949d24_3d624d65
  ext_node_url_d0cb3ad7["node:url"] --> node_scaffold_root_templates_61731280_c6c59378
  ext_node_url_d0cb3ad7["node:url"] --> node_scaffold_shell_templates_0ad0f915_ccc86664
  ext_node_url_d0cb3ad7["node:url"] --> node_scaffold_worktree_templates_66a38e9a_ff3c085c
  ext_node_url_d0cb3ad7["node:url"] --> node_test_harness_upgrade_matrix_84113c4e_e0838daa
  ext_node_url_d0cb3ad7["node:url"] --> node_ui_loop_internal_f2eb8892_c4b49e6a
  ext_node_url_d0cb3ad7["node:url"] --> node_validate_intermediary_receipt_coverage_7d63b166_40dcf15d
  ext_node_url_d0cb3ad7["node:url"] --> node_validate_prompt_context_drift_8c949ef6_d32d5759
  ext_node_url_d0cb3ad7["node:url"] --> node_version_5ca4f385_fd75945b
  ext_picomatch_2ebdbf14["picomatch"] --> node_detector_2_b0fc2f46_7ea6b320
  ext_picomatch_2ebdbf14["picomatch"] --> node_lifecycle_intent_7b5ab084_dd36f625
  ext_picomatch_2ebdbf14["picomatch"] --> node_policy_823412d1_3bce1002
  ext_picomatch_2ebdbf14["picomatch"] --> node_resolver_439c3635_729842aa
  ext_picomatch_2ebdbf14["picomatch"] --> node_risk_tier_1_96b6ff91_19911c0e
  ext_semver_b4039641["semver"] --> node_check_environment_core_2c16213f_a8a456d9
  ext_semver_b4039641["semver"] --> node_doctor_tool_checks_4acac51a_9e791a28
  ext_semver_b4039641["semver"] --> node_migration_8a6cead4_3c3cc0a4
  ext_semver_b4039641["semver"] --> node_schema_migrate_c0646635_f0e7b25b
  ext_semver_b4039641["semver"] --> node_update_core_bced358c_b710dd59
  ext_semver_b4039641["semver"] --> node_upgrade_1_b277486e_4a06b7a8
  ext_semver_b4039641["semver"] --> node_validator_helpers_7b927667_8b691f8f
  ext_sqlite_vec_bae73cf2["sqlite-vec"] --> node_store_824d80d7_69038a3e
  ext_typescript_fb9da861["typescript"] --> node_check_code_size_9c5efc3a_154124ae
  ext_typescript_fb9da861["typescript"] --> node_check_public_api_docs_a9604f1b_f824853c
  ext_typescript_fb9da861["typescript"] --> node_check_self_affirming_tests_7638e575_c6155698
  ext_typescript_fb9da861["typescript"] --> node_source_outline_1_54a631fa_8582fb07
  ext_vitest_4c9cfa13["vitest"] --> node_vitest_e2e_config_4e2a61bc_3efa3f07
  style ext_better_sqlite3_d7ed8f1a fill:#f59e0b,color:#fff
  style ext_child_process_4845fa97 fill:#f59e0b,color:#fff
  style ext_diff_75a0ee1b fill:#f59e0b,color:#fff
  style ext_effect_68d1dae1 fill:#f59e0b,color:#fff
  style ext_fs_3f4bb586 fill:#f59e0b,color:#fff
  style ext_inquirer_prompts_4d547149 fill:#f59e0b,color:#fff
  style ext_lodash_901466a5 fill:#f59e0b,color:#fff
  style ext_node_child_process_f62b7d19 fill:#f59e0b,color:#fff
  style ext_node_crypto_c7dfc512 fill:#f59e0b,color:#fff
  style ext_node_dns_828a0bbf fill:#f59e0b,color:#fff
  style ext_node_fs_a15b7d96 fill:#f59e0b,color:#fff
  style ext_node_module_ca1b42af fill:#f59e0b,color:#fff
  style ext_node_os_d93fe73a fill:#f59e0b,color:#fff
  style ext_node_path_78811c13 fill:#f59e0b,color:#fff
  style ext_node_perf_hooks_906292ff fill:#f59e0b,color:#fff
  style ext_node_process_00cdf119 fill:#f59e0b,color:#fff
  style ext_node_readline_bb6096cc fill:#f59e0b,color:#fff
  style ext_node_url_d0cb3ad7 fill:#f59e0b,color:#fff
  style ext_octokit_plugin_retry_c9aecc53 fill:#f59e0b,color:#fff
  style ext_octokit_plugin_throttling_7909ece3 fill:#f59e0b,color:#fff
  style ext_octokit_request_error_98ae13cc fill:#f59e0b,color:#fff
  style ext_octokit_rest_c6e4d192 fill:#f59e0b,color:#fff
  style ext_picomatch_2ebdbf14 fill:#f59e0b,color:#fff
  style ext_semver_b4039641 fill:#f59e0b,color:#fff
  style ext_sqlite_vec_bae73cf2 fill:#f59e0b,color:#fff
  style ext_typescript_fb9da861 fill:#f59e0b,color:#fff
  style ext_vitest_4c9cfa13 fill:#f59e0b,color:#fff

```

## erd

```mermaid
erDiagram
  %% erd extraction: failed_no_schema
  %% schema sources: none
  %% no supported schema sources found (expected schema.prisma or .sql files)

```

## events

```mermaid
flowchart TD
  subgraph Channels["Event channels / queues"]
    validate_action_review_receipt_fa2f06c3{{"validate-action-review-receipt"}}
    validate_review_lifecycle_0b410d1e{{"validate-review-lifecycle"}}
    validate_steering_queue_4bc0cc94{{"validate-steering-queue"}}
    ci_migrate_core_7005b5af{{"ci-migrate-core"}}
    context_health_80bb7da9{{"context-health"}}
    pilot_rollback_00c1f82c{{"pilot-rollback"}}
    replay_output_993eda9e{{"replay-output"}}
    replay_run_record_9a08cce2{{"replay-run-record"}}
    runtime_card_args_2b3d4b28{{"runtime-card-args"}}
    runtime_card_artifacts_143b799c{{"runtime-card-artifacts"}}
    runtime_card_options_c9156ad5{{"runtime-card-options"}}
    runtime_card_e06b53e1{{"runtime-card"}}
    validation_98c41dcd{{"validation"}}
    cli_args_1_6144b055{{"cli-args"}}
    ci_migrate_merge_queue_window_0070bd6d{{"ci-migrate-merge-queue-window"}}
    ci_migrate_promotion_evidence_1a2dc527{{"ci-migrate-promotion-evidence"}}
    ownership_gate_2e194d13{{"ownership-gate"}}
    docs_gate_command_spec_16795187{{"docs-gate-command-spec"}}
    harness_run_c0761792{{"harness-run"}}
    json_schema_core_96d7e328{{"json-schema-core"}}
    policy_validators_core_714a3fe7{{"policy-validators-core"}}
    run_record_emitter_core_688049d5{{"run-record-emitter-core"}}
    run_records_core_89286dfa{{"run-records-core"}}
    judge_pm_audit_ccd20b35{{"judge-pm-audit"}}
    types_10_75e5a4a0{{"types"}}
    observed_skill_usage_ed7d5930{{"observed-skill-usage"}}
    outcome_closeout_ba497ec2{{"outcome-closeout"}}
    client_948fe603{{"client"}}
    mutation_queue_ce5a530e{{"mutation-queue"}}
    scaffold_github_actions_pr_pipeline_renderer_1ee18de5{{"scaffold-github-actions-pr-pipeline-renderer"}}
  end
  classDef eventNode fill:#db2777,color:#fff
  class validate_action_review_receipt_fa2f06c3,validate_review_lifecycle_0b410d1e,validate_steering_queue_4bc0cc94,ci_migrate_core_7005b5af,context_health_80bb7da9,pilot_rollback_00c1f82c,replay_output_993eda9e,replay_run_record_9a08cce2,runtime_card_args_2b3d4b28,runtime_card_artifacts_143b799c,runtime_card_options_c9156ad5,runtime_card_e06b53e1,validation_98c41dcd,cli_args_1_6144b055,ci_migrate_merge_queue_window_0070bd6d,ci_migrate_promotion_evidence_1a2dc527,ownership_gate_2e194d13,docs_gate_command_spec_16795187,harness_run_c0761792,json_schema_core_96d7e328,policy_validators_core_714a3fe7,run_record_emitter_core_688049d5,run_records_core_89286dfa,judge_pm_audit_ccd20b35,types_10_75e5a4a0,observed_skill_usage_ed7d5930,outcome_closeout_ba497ec2,client_948fe603,mutation_queue_ce5a530e,scaffold_github_actions_pr_pipeline_renderer_1ee18de5 eventNode

```

## flow

```mermaid
flowchart TD
  Start(["Start"])
  github_e2e_2891a341["github-e2e"]
  Start --> github_e2e_2891a341
  linear_e2e_decf3708["linear-e2e"]
  github_e2e_2891a341 --> linear_e2e_decf3708
  run_e2e_39efe696["run-e2e"]
  linear_e2e_decf3708 --> run_e2e_39efe696
  env_b77349bf["env"]
  run_e2e_39efe696 --> env_b77349bf
  resource_tracker_d95b6649["resource-tracker"]
  env_b77349bf --> resource_tracker_d95b6649
  vitest_e2e_config_4e2a61bc["vitest.e2e.config"]
  resource_tracker_d95b6649 --> vitest_e2e_config_4e2a61bc
  check_architecture_rules_6b7347fd["check-architecture-rules"]
  vitest_e2e_config_4e2a61bc --> check_architecture_rules_6b7347fd
  check_code_size_9c5efc3a["check-code-size"]
  check_architecture_rules_6b7347fd --> check_code_size_9c5efc3a
  End(["End"])
  check_code_size_9c5efc3a --> End

```

## rag

```mermaid
flowchart LR
  UserQ(["👤 User Query"])
  Embed["📐 Embedding Model"]
  VecDB[("📚 Vector Store")]
  Retriever["🔍 Retriever"]
  LLMNode["🧠 LLM / Generator"]
  Output(["✅ Response"])
  UserQ -->|query| Embed
  Embed -->|vector| VecDB
  VecDB -->|top-k chunks| Retriever
  Retriever -->|context + query| LLMNode
  LLMNode -->|generated answer| Output
  subgraph DetectedMemory["Detected memory stores"]
    det_detectedmemory_check_steering_feedback_contract_80134459[("check-steering-feedback-contract")]
    det_detectedmemory_normalize_workflow_contracts_8701f1c8[("normalize-workflow-contracts")]
    det_detectedmemory_sync_codex_preflight_7e7a8dc2[("sync-codex-preflight")]
    det_detectedmemory_test_harness_upgrade_matrix_84113c4e[("test-harness-upgrade-matrix")]
    det_detectedmemory_validate_prompt_context_drift_8c949ef6[("validate-prompt-context-drift")]
    det_detectedmemory_validate_runtime_packet_schemas_bc3ba8ec[("validate-runtime-packet-schemas")]
    det_detectedmemory_validate_workflow_contracts_33dc063c[("validate-workflow-contracts")]
    det_detectedmemory_branch_protect_core_a8feb0fd[("branch-protect-core")]
    det_detectedmemory_ci_migrate_core_7005b5af[("ci-migrate-core")]
    det_detectedmemory_context_health_80bb7da9[("context-health")]
    det_detectedmemory_context_ea7792a2[("context")]
    det_detectedmemory_docs_gate_core_eb9b6c18[("docs-gate-core")]
    det_detectedmemory_index_context_de3ed39d[("index-context")]
    det_detectedmemory_local_memory_preflight_dcc36c42[("local-memory-preflight")]
    det_detectedmemory_memory_gate_a577a506[("memory-gate")]
    det_detectedmemory_pattern_scope_siblings_43abe000[("pattern-scope-siblings")]
    det_detectedmemory_review_context_ca6cf81d[("review-context")]
    det_detectedmemory_review_gate_core_4c8001f9[("review-gate-core")]
    det_detectedmemory_search_24193290[("search")]
    det_detectedmemory_session_context_e5ec72c0[("session-context")]
    det_detectedmemory_tooling_audit_core_328d6a41[("tooling-audit-core")]
    det_detectedmemory_run_local_memory_preflight_36e92808[("run-local-memory-preflight")]
    det_detectedmemory_checker_d2d2328e[("checker")]
    det_detectedmemory_context_health_1_ceb11829[("context-health")]
    det_detectedmemory_types_2_d9bc6e7a[("types")]
    det_detectedmemory_branch_protect_sync_570adb18[("branch-protect-sync")]
    det_detectedmemory_command_capability_rules_ca3f496a[("command-capability-rules")]
    det_detectedmemory_command_specs_core_1c0ffc99[("command-specs-core")]
    det_detectedmemory_local_memory_preflight_command_spec_9e23f3ce[("local-memory-preflight-command-spec")]
    det_detectedmemory_memory_gate_command_spec_dc9001a9[("memory-gate-command-spec")]
    det_detectedmemory_review_gate_command_spec_3187376a[("review-gate-command-spec")]
    det_detectedmemory_session_context_command_spec_973afbb1[("session-context-command-spec")]
    det_detectedmemory_constants_7517017f[("constants")]
    det_detectedmemory_context_compact_policy_3dcaf95d[("context-compact-policy")]
    det_detectedmemory_index_2_10143590[("index")]
    det_detectedmemory_indexer_70fa78e5[("indexer")]
    det_detectedmemory_init_error_5c7dd49f[("init-error")]
    det_detectedmemory_lexical_fallback_723e2b3e[("lexical-fallback")]
    det_detectedmemory_ollama_76e3c7bf[("ollama")]
    det_detectedmemory_rollout_a4fa034c[("rollout")]
    det_detectedmemory_sources_878a52fc[("sources")]
    det_detectedmemory_store_824d80d7[("store")]
    det_detectedmemory_sync_contract_c79fa191[("sync-contract")]
    det_detectedmemory_types_7_2f1ed65e[("types")]
    det_detectedmemory_harness_run_context_ac7c77a9[("harness-run-context")]
    det_detectedmemory_index_3_7e40d474[("index")]
    det_detectedmemory_json_schema_core_96d7e328[("json-schema-core")]
    det_detectedmemory_policy_validators_core_714a3fe7[("policy-validators-core")]
    det_detectedmemory_types_core_e405ddca[("types-core")]
    det_detectedmemory_validator_core_4358f8ba[("validator-core")]
    det_detectedmemory_init_modes_c05ceb07[("init-modes")]
    det_detectedmemory_project_brain_templates_7ef51530[("project-brain-templates")]
    det_detectedmemory_scaffold_diagram_templates_dd88e83c[("scaffold-diagram-templates")]
    det_detectedmemory_scaffold_doc_templates_f6152330[("scaffold-doc-templates")]
    det_detectedmemory_scaffold_environment_templates_c1ceba6a[("scaffold-environment-templates")]
    det_detectedmemory_scaffold_root_command_templates_404fed7f[("scaffold-root-command-templates")]
    det_detectedmemory_scaffold_script_template_registry_69312d4e[("scaffold-script-template-registry")]
    det_detectedmemory_scaffold_shell_templates_0ad0f915[("scaffold-shell-templates")]
    det_detectedmemory_scaffold_surfaces_12d6494e[("scaffold-surfaces")]
    det_detectedmemory_scaffold_template_registry_b1cce2aa[("scaffold-template-registry")]
    det_detectedmemory_scaffold_workflow_template_92310587[("scaffold-workflow-template")]
    det_detectedmemory_eval_seed_5699fd3e[("eval-seed")]
    det_detectedmemory_index_9_32dd4d91[("index")]
    det_detectedmemory_review_context_1_e3afed15[("review-context")]
    det_detectedmemory_memory_gate_1_265164ac[("memory-gate")]
    det_detectedmemory_branch_enforcer_acb749cd[("branch-enforcer")]
    det_detectedmemory_cli_args_5_09ea29f0[("cli-args")]
    det_detectedmemory_cli_6_eac72be2[("cli")]
    det_detectedmemory_metrics_tracker_98cec29c[("metrics-tracker")]
    det_detectedmemory_types_18_37582e2a[("types")]
    det_detectedmemory_validator_4_5180cf23[("validator")]
    det_detectedmemory_classifier_fe1991a9[("classifier")]
    det_detectedmemory_tooling_baseline_50ab2eeb[("tooling-baseline")]
    det_detectedmemory_claim_helpers_20dc8387[("claim-helpers")]
    det_detectedmemory_types_23_4352ee2e[("types")]
    det_detectedmemory_local_memory_smoke_1175abfc[("local-memory-smoke")]
    det_detectedmemory_local_memory_0db17ecc[("local-memory")]
    det_detectedmemory_performance_overload_c685bfcf[("performance-overload")]
    det_detectedmemory_suggestion_generator_0956f794[("suggestion-generator")]
    det_detectedmemory_index_11_ffcd5842[("index")]
    det_detectedmemory_prompt_context_drift_report_3257a95c[("prompt-context-drift-report")]
    det_detectedmemory_index_12_762ec91b[("index")]
    det_detectedmemory_prompt_context_receipt_17b862b2[("prompt-context-receipt")]
    det_detectedmemory_types_30_424b976c[("types")]
    det_detectedmemory_policy_1_fc4198db[("policy")]
    det_detectedmemory_runtime_card_codex_runtime_validation_d8ce9934[("runtime-card-codex-runtime-validation")]
    det_detectedmemory_cli_11_338a8415[("cli")]
    det_detectedmemory_collector_0736fd5b[("collector")]
    det_detectedmemory_types_33_16e22a82[("types")]
    det_detectedmemory_overload_guard_2748c559[("overload-guard")]
  end
  VecDB -. "implemented by" .-> DetectedMemory
  subgraph DetectedLLM["Detected LLM clients"]
    det_detectedllm_check_codex_agent_roles_5bb2e89b["check-codex-agent-roles"]
    det_detectedllm_check_steering_feedback_contract_80134459["check-steering-feedback-contract"]
    det_detectedllm_run_harness_evals_77704768["run-harness-evals"]
    det_detectedllm_validate_decision_request_2e5c325e["validate-decision-request"]
    det_detectedllm_validate_goal_completion_audit_receipt_100d252c["validate-goal-completion-audit-receipt"]
    det_detectedllm_validate_packaged_skill_5e32c890["validate-packaged-skill"]
    det_detectedllm_validate_prompt_context_drift_8c949ef6["validate-prompt-context-drift"]
    det_detectedllm_validate_reviewer_coverage_251efee3["validate-reviewer-coverage"]
    det_detectedllm_check_environment_core_2c16213f["check-environment-core"]
    det_detectedllm_context_ea7792a2["context"]
    det_detectedllm_index_context_de3ed39d["index-context"]
    det_detectedllm_prompt_gate_c5e9d207["prompt-gate"]
    det_detectedllm_remediate_runner_helpers_929fedcc["remediate-runner-helpers"]
    det_detectedllm_search_24193290["search"]
    det_detectedllm_context_health_1_ceb11829["context-health"]
    det_detectedllm_command_specs_core_1c0ffc99["command-specs-core"]
    det_detectedllm_prompt_gate_command_spec_9a941482["prompt-gate-command-spec"]
    det_detectedllm_constants_7517017f["constants"]
    det_detectedllm_index_2_10143590["index"]
    det_detectedllm_indexer_70fa78e5["indexer"]
    det_detectedllm_ollama_76e3c7bf["ollama"]
    det_detectedllm_sync_contract_c79fa191["sync-contract"]
    det_detectedllm_north_star_validators_cfc926ce["north-star-validators"]
    det_detectedllm_hilt_boundary_9b36fb15["hilt-boundary"]
    det_detectedllm_types_9_1db4641f["types"]
    det_detectedllm_goal_completion_audit_receipt_validation_9d0f4891["goal-completion-audit-receipt-validation"]
    det_detectedllm_goal_completion_audit_receipt_5e4939c3["goal-completion-audit-receipt"]
    det_detectedllm_index_4_013aa0e3["index"]
    det_detectedllm_constants_1_a84e15f0["constants"]
    det_detectedllm_types_16_0fae1112["types"]
    det_detectedllm_sensitive_text_7c11f760["sensitive-text"]
    det_detectedllm_pr_template_validator_rules_20a32d6b["pr-template-validator-rules"]
    det_detectedllm_index_11_ffcd5842["index"]
    det_detectedllm_prompt_context_drift_report_3257a95c["prompt-context-drift-report"]
    det_detectedllm_index_12_762ec91b["index"]
    det_detectedllm_prompt_context_receipt_17b862b2["prompt-context-receipt"]
    det_detectedllm_cli_args_9_9c136878["cli-args"]
    det_detectedllm_cli_10_35dc8cbd["cli"]
    det_detectedllm_sections_4697ef32["sections"]
    det_detectedllm_types_26_a5814179["types"]
    det_detectedllm_validator_6_3688adbf["validator"]
    det_detectedllm_cli_args_10_861cdd3f["cli-args"]
  end
  LLMNode -. "implemented by" .-> DetectedLLM
  subgraph DetectedTools["Agentic tool calls"]
    det_detectedtools_check_codex_agent_roles_5bb2e89b["🔧 check-codex-agent-roles"]
    det_detectedtools_check_steering_feedback_contract_80134459["🔧 check-steering-feedback-contract"]
    det_detectedtools_run_harness_evals_77704768["🔧 run-harness-evals"]
    det_detectedtools_validate_action_review_receipt_fa2f06c3["🔧 validate-action-review-receipt"]
    det_detectedtools_validate_packaged_skill_5e32c890["🔧 validate-packaged-skill"]
    det_detectedtools_validate_replay_packet_f309747e["🔧 validate-replay-packet"]
    det_detectedtools_ci_migrate_core_7005b5af["🔧 ci-migrate-core"]
    det_detectedtools_doctor_checks_5a2eb2b9["🔧 doctor-checks"]
    det_detectedtools_doctor_github_tool_checks_a53b0382["🔧 doctor-github-tool-checks"]
    det_detectedtools_doctor_tool_checks_4acac51a["🔧 doctor-tool-checks"]
    det_detectedtools_next_blocked_decisions_4140ad2b["🔧 next-blocked-decisions"]
    det_detectedtools_policy_gate_213f7313["🔧 policy-gate"]
    det_detectedtools_remediate_cli_output_cc165396["🔧 remediate-cli-output"]
    det_detectedtools_remediate_runner_helpers_929fedcc["🔧 remediate-runner-helpers"]
    det_detectedtools_review_gate_core_4c8001f9["🔧 review-gate-core"]
    det_detectedtools_index_1bc04b52["🔧 index"]
    det_detectedtools_types_1_4ecdf56e["🔧 types"]
    det_detectedtools_validation_constants_e002a0f6["🔧 validation-constants"]
    det_detectedtools_validation_98c41dcd["🔧 validation"]
    det_detectedtools_checker_d2d2328e["🔧 checker"]
    det_detectedtools_cli_args_1_6144b055["🔧 cli-args"]
    det_detectedtools_command_capabilities_a4d5c71e["🔧 command-capabilities"]
    det_detectedtools_command_capability_rules_ca3f496a["🔧 command-capability-rules"]
    det_detectedtools_linear_command_actions_e430f4f4["🔧 linear-command-actions"]
    det_detectedtools_linear_command_runner_4a740dfc["🔧 linear-command-runner"]
    det_detectedtools_policy_validators_core_714a3fe7["🔧 policy-validators-core"]
    det_detectedtools_types_core_e405ddca["🔧 types-core"]
    det_detectedtools_validator_core_4358f8ba["🔧 validator-core"]
    det_detectedtools_validator_helpers_7b927667["🔧 validator-helpers"]
    det_detectedtools_he_phase_exit_core_1148895b["🔧 he-phase-exit-core"]
    det_detectedtools_ralph_runtime_73d63c0e["🔧 ralph-runtime"]
    det_detectedtools_observed_skill_usage_ed7d5930["🔧 observed-skill-usage"]
    det_detectedtools_closure_evidence_aaa31467["🔧 closure-evidence"]
    det_detectedtools_pr_creator_dc6b1ea4["🔧 pr-creator"]
    det_detectedtools_client_948fe603["🔧 client"]
    det_detectedtools_init_output_360dce91["🔧 init-output"]
    det_detectedtools_scaffold_ci_templates_2afd6392["🔧 scaffold-ci-templates"]
    det_detectedtools_scaffold_codex_environment_templates_334fbbed["🔧 scaffold-codex-environment-templates"]
    det_detectedtools_scaffold_config_templates_4b80ce53["🔧 scaffold-config-templates"]
    det_detectedtools_scaffold_environment_templates_c1ceba6a["🔧 scaffold-environment-templates"]
    det_detectedtools_scaffold_github_actions_pr_pipeline_renderer_1ee18de5["🔧 scaffold-github-actions-pr-pipeline-renderer"]
    det_detectedtools_scaffold_github_actions_pr_pipeline_template_e2b85f62["🔧 scaffold-github-actions-pr-pipeline-template"]
    det_detectedtools_scaffold_release_private_npm_template_075499f8["🔧 scaffold-release-private-npm-template"]
    det_detectedtools_constants_1_a84e15f0["🔧 constants"]
    det_detectedtools_index_8_6f0f20ec["🔧 index"]
    det_detectedtools_validation_common_6161e48b["🔧 validation-common"]
    det_detectedtools_cli_6_eac72be2["🔧 cli"]
    det_detectedtools_metrics_tracker_98cec29c["🔧 metrics-tracker"]
    det_detectedtools_normalise_renderer_85f2e563["🔧 normalise-renderer"]
    det_detectedtools_evaluation_engine_core_e054fe49["🔧 evaluation-engine-core"]
    det_detectedtools_tooling_baseline_50ab2eeb["🔧 tooling-baseline"]
    det_detectedtools_prompt_context_drift_report_3257a95c["🔧 prompt-context-drift-report"]
    det_detectedtools_replay_packet_a1293f88["🔧 replay-packet"]
    det_detectedtools_index_13_97df39c8["🔧 index"]
    det_detectedtools_review_lifecycle_contract_e5447221["🔧 review-lifecycle-contract"]
    det_detectedtools_review_lifecycle_89afa64c["🔧 review-lifecycle"]
    det_detectedtools_runtime_card_codex_runtime_validation_d8ce9934["🔧 runtime-card-codex-runtime-validation"]
    det_detectedtools_runtime_card_codex_runtime_0655e230["🔧 runtime-card-codex-runtime"]
    det_detectedtools_runtime_evidence_bundle_d471a232["🔧 runtime-evidence-bundle"]
    det_detectedtools_types_35_93e66c64["🔧 types"]
    det_detectedtools_index_16_373c8a49["🔧 index"]
    det_detectedtools_projection_1b250ea1["🔧 projection"]
    det_detectedtools_types_37_32ccf9f9["🔧 types"]
    det_detectedtools_validation_7_c4e6d8b6["🔧 validation"]
  end
  LLMNode -->|tool use| DetectedTools
  DetectedTools -->|result| LLMNode
  classDef memNode fill:#555,color:#fff
  class VecDB,Retriever memNode
  classDef llmNode fill:#555,color:#fff
  class LLMNode,Embed llmNode
  classDef toolNode fill:#555,color:#fff
  class det_detectedtools_check_codex_agent_roles_5bb2e89b,det_detectedtools_check_steering_feedback_contract_80134459,det_detectedtools_run_harness_evals_77704768,det_detectedtools_validate_action_review_receipt_fa2f06c3,det_detectedtools_validate_packaged_skill_5e32c890,det_detectedtools_validate_replay_packet_f309747e,det_detectedtools_ci_migrate_core_7005b5af,det_detectedtools_doctor_checks_5a2eb2b9,det_detectedtools_doctor_github_tool_checks_a53b0382,det_detectedtools_doctor_tool_checks_4acac51a,det_detectedtools_next_blocked_decisions_4140ad2b,det_detectedtools_policy_gate_213f7313,det_detectedtools_remediate_cli_output_cc165396,det_detectedtools_remediate_runner_helpers_929fedcc,det_detectedtools_review_gate_core_4c8001f9,det_detectedtools_index_1bc04b52,det_detectedtools_types_1_4ecdf56e,det_detectedtools_validation_constants_e002a0f6,det_detectedtools_validation_98c41dcd,det_detectedtools_checker_d2d2328e,det_detectedtools_cli_args_1_6144b055,det_detectedtools_command_capabilities_a4d5c71e,det_detectedtools_command_capability_rules_ca3f496a,det_detectedtools_linear_command_actions_e430f4f4,det_detectedtools_linear_command_runner_4a740dfc,det_detectedtools_policy_validators_core_714a3fe7,det_detectedtools_types_core_e405ddca,det_detectedtools_validator_core_4358f8ba,det_detectedtools_validator_helpers_7b927667,det_detectedtools_he_phase_exit_core_1148895b,det_detectedtools_ralph_runtime_73d63c0e,det_detectedtools_observed_skill_usage_ed7d5930,det_detectedtools_closure_evidence_aaa31467,det_detectedtools_pr_creator_dc6b1ea4,det_detectedtools_client_948fe603,det_detectedtools_init_output_360dce91,det_detectedtools_scaffold_ci_templates_2afd6392,det_detectedtools_scaffold_codex_environment_templates_334fbbed,det_detectedtools_scaffold_config_templates_4b80ce53,det_detectedtools_scaffold_environment_templates_c1ceba6a,det_detectedtools_scaffold_github_actions_pr_pipeline_renderer_1ee18de5,det_detectedtools_scaffold_github_actions_pr_pipeline_template_e2b85f62,det_detectedtools_scaffold_release_private_npm_template_075499f8,det_detectedtools_constants_1_a84e15f0,det_detectedtools_index_8_6f0f20ec,det_detectedtools_validation_common_6161e48b,det_detectedtools_cli_6_eac72be2,det_detectedtools_metrics_tracker_98cec29c,det_detectedtools_normalise_renderer_85f2e563,det_detectedtools_evaluation_engine_core_e054fe49,det_detectedtools_tooling_baseline_50ab2eeb,det_detectedtools_prompt_context_drift_report_3257a95c,det_detectedtools_replay_packet_a1293f88,det_detectedtools_index_13_97df39c8,det_detectedtools_review_lifecycle_contract_e5447221,det_detectedtools_review_lifecycle_89afa64c,det_detectedtools_runtime_card_codex_runtime_validation_d8ce9934,det_detectedtools_runtime_card_codex_runtime_0655e230,det_detectedtools_runtime_evidence_bundle_d471a232,det_detectedtools_types_35_93e66c64,det_detectedtools_index_16_373c8a49,det_detectedtools_projection_1b250ea1,det_detectedtools_types_37_32ccf9f9,det_detectedtools_validation_7_c4e6d8b6 toolNode

```

## security

```mermaid
flowchart TD
  Untrusted["Untrusted input"]
  validate_audit_references_811f872a["validate-audit-references"]
  Untrusted --> validate_audit_references_811f872a
  validate_goal_completion_audit_receipt_100d252c["validate-goal-completion-audit-receipt"]
  Untrusted --> validate_goal_completion_audit_receipt_100d252c
  audit_b81f37a0["audit"]
  Untrusted --> audit_b81f37a0
  evidence_verify_3b73c290["evidence-verify"]
  Untrusted --> evidence_verify_3b73c290
  org_audit_d739e44b["org-audit"]
  Untrusted --> org_audit_d739e44b
  policy_gate_213f7313["policy-gate"]
  Untrusted --> policy_gate_213f7313
  tooling_audit_core_328d6a41["tooling-audit-core"]
  Untrusted --> tooling_audit_core_328d6a41
  tooling_audit_8a8239ff["tooling-audit"]
  Untrusted --> tooling_audit_8a8239ff
  verify_coderabbit_490b4e71["verify-coderabbit"]
  Untrusted --> verify_coderabbit_490b4e71
  verify_work_df70ecac["verify-work"]
  Untrusted --> verify_work_df70ecac
  audit_command_spec_5acf0149["audit-command-spec"]
  Untrusted --> audit_command_spec_5acf0149
  evidence_verify_command_spec_e1cbfea2["evidence-verify-command-spec"]
  Untrusted --> evidence_verify_command_spec_e1cbfea2
  org_audit_command_spec_1a570341["org-audit-command-spec"]
  Untrusted --> org_audit_command_spec_1a570341
  policy_gate_command_spec_71e8726a["policy-gate-command-spec"]
  Untrusted --> policy_gate_command_spec_71e8726a
  tooling_audit_command_spec_e0e57863["tooling-audit-command-spec"]
  Untrusted --> tooling_audit_command_spec_e0e57863
  verify_coderabbit_command_spec_68cc9ec5["verify-coderabbit-command-spec"]
  Untrusted --> verify_coderabbit_command_spec_68cc9ec5
  verify_work_command_spec_d6c94ac8["verify-work-command-spec"]
  Untrusted --> verify_work_command_spec_d6c94ac8
  context_compact_policy_3dcaf95d["context-compact-policy"]
  Untrusted --> context_compact_policy_3dcaf95d
  policy_validators_core_714a3fe7["policy-validators-core"]
  Untrusted --> policy_validators_core_714a3fe7
  policy_validators_6682e192["policy-validators"]
  Untrusted --> policy_validators_6682e192
  he_gate_trust_policy_b1126dfd["he-gate-trust-policy"]
  Untrusted --> he_gate_trust_policy_b1126dfd
  goal_completion_audit_receipt_validation_9d0f4891["goal-completion-audit-receipt-validation"]
  Untrusted --> goal_completion_audit_receipt_validation_9d0f4891
  goal_completion_audit_receipt_5e4939c3["goal-completion-audit-receipt"]
  Untrusted --> goal_completion_audit_receipt_5e4939c3
  judge_pm_audit_ccd20b35["judge-pm-audit"]
  Untrusted --> judge_pm_audit_ccd20b35
  policy_823412d1["policy"]
  Untrusted --> policy_823412d1
  scaffold_security_scan_template_55bc7465["scaffold-security-scan-template"]
  Untrusted --> scaffold_security_scan_template_55bc7465
  normalise_policy_gate_90229693["normalise-policy-gate"]
  Untrusted --> normalise_policy_gate_90229693
  cardinality_ebef8aff["cardinality"]
  Untrusted --> cardinality_ebef8aff
  diff_budget_1_9f85eb1c["diff-budget"]
  Untrusted --> diff_budget_1_9f85eb1c
  policy_chain_0c92e343["policy-chain"]
  Untrusted --> policy_chain_0c92e343
  required_checks_46396214["required-checks"]
  Untrusted --> required_checks_46396214
  risk_tier_1_96b6ff91["risk-tier"]
  Untrusted --> risk_tier_1_96b6ff91
  tooling_baseline_50ab2eeb["tooling-baseline"]
  Untrusted --> tooling_baseline_50ab2eeb
  policy_coverage_dab8febe["policy-coverage"]
  Untrusted --> policy_coverage_dab8febe
  policy_digest_ca7acf0a["policy-digest"]
  Untrusted --> policy_digest_ca7acf0a
  policy_1_fc4198db["policy"]
  Untrusted --> policy_1_fc4198db
  issue_key_305bf3db["issue-key"]
  Untrusted --> issue_key_305bf3db
  hash_d04b98f4["hash"]
  Untrusted --> hash_d04b98f4
  verify_work_1_cd8e7ec3["verify-work"]
  Untrusted --> verify_work_1_cd8e7ec3
  args_1_15220d9b["args"]
  Untrusted --> args_1_15220d9b
  classDef securityNode fill:#dc2626,color:#fff
  class validate_audit_references_811f872a,validate_goal_completion_audit_receipt_100d252c,audit_b81f37a0,evidence_verify_3b73c290,org_audit_d739e44b,policy_gate_213f7313,tooling_audit_core_328d6a41,tooling_audit_8a8239ff,verify_coderabbit_490b4e71,verify_work_df70ecac,audit_command_spec_5acf0149,evidence_verify_command_spec_e1cbfea2,org_audit_command_spec_1a570341,policy_gate_command_spec_71e8726a,tooling_audit_command_spec_e0e57863,verify_coderabbit_command_spec_68cc9ec5,verify_work_command_spec_d6c94ac8,context_compact_policy_3dcaf95d,policy_validators_core_714a3fe7,policy_validators_6682e192,he_gate_trust_policy_b1126dfd,goal_completion_audit_receipt_validation_9d0f4891,goal_completion_audit_receipt_5e4939c3,judge_pm_audit_ccd20b35,policy_823412d1,scaffold_security_scan_template_55bc7465,normalise_policy_gate_90229693,cardinality_ebef8aff,diff_budget_1_9f85eb1c,policy_chain_0c92e343,required_checks_46396214,risk_tier_1_96b6ff91,tooling_baseline_50ab2eeb,policy_coverage_dab8febe,policy_digest_ca7acf0a,policy_1_fc4198db,issue_key_305bf3db,hash_d04b98f4,verify_work_1_cd8e7ec3,args_1_15220d9b securityNode

```

## sequence

```mermaid
sequenceDiagram
  participant index_1bc04b52 as index
  participant index_1_faebc14e as index
  database index_2_10143590 as index
  actor index_3_7e40d474 as index
  participant index_4_013aa0e3 as index
  participant index_5_522f772a as index
  participant index_6_fc9e91e2 as index
  participant index_7_b61a3f30 as index
  participant index_8_6f0f20ec as index
  database index_9_32dd4d91 as index
  participant index_10_f6785a46 as index
  database index_11_ffcd5842 as index
  database index_12_762ec91b as index
  participant index_13_97df39c8 as index
  participant index_14_d982116c as index
  participant index_15_99636ec5 as index
  participant index_16_373c8a49 as index
  participant index_17_642943a2 as index

```

## user

```mermaid
flowchart LR
  User(("User"))
  github_e2e_2891a341["github-e2e"]
  User --> github_e2e_2891a341
  linear_e2e_decf3708["linear-e2e"]
  User --> linear_e2e_decf3708
  run_e2e_39efe696["run-e2e"]
  User --> run_e2e_39efe696
  env_b77349bf["env"]
  User --> env_b77349bf
  check_public_api_docs_a9604f1b["check-public-api-docs"]
  User --> check_public_api_docs_a9604f1b
  check_steering_feedback_contract_80134459["check-steering-feedback-contract"]
  User --> check_steering_feedback_contract_80134459
  run_harness_evals_77704768["run-harness-evals"]
  User --> run_harness_evals_77704768
  validate_decision_request_2e5c325e["validate-decision-request"]
  User --> validate_decision_request_2e5c325e
  branch_protect_core_a8feb0fd["branch-protect-core"]
  User --> branch_protect_core_a8feb0fd
  check_environment_core_2c16213f["check-environment-core"]
  User --> check_environment_core_2c16213f
  ci_migrate_core_7005b5af["ci-migrate-core"]
  User --> ci_migrate_core_7005b5af
  decision_request_118a770d["decision-request"]
  User --> decision_request_118a770d
  evidence_verify_3b73c290["evidence-verify"]
  User --> evidence_verify_3b73c290
  linear_prepare_0c613ba6["linear-prepare"]
  User --> linear_prepare_0c613ba6
  linear_sync_a2fa2bf7["linear-sync"]
  User --> linear_sync_a2fa2bf7
  linear_triage_core_7cbca73e["linear-triage-core"]
  User --> linear_triage_core_7cbca73e
  linear_workflow_core_0e19cff4["linear-workflow-core"]
  User --> linear_workflow_core_0e19cff4
  pattern_scope_61ff946d["pattern-scope"]
  User --> pattern_scope_61ff946d
  pr_closeout_env_9bfcd9ef["pr-closeout-env"]
  User --> pr_closeout_env_9bfcd9ef
  review_gate_core_4c8001f9["review-gate-core"]
  User --> review_gate_core_4c8001f9
  symphony_check_e97f2ea0["symphony-check"]
  User --> symphony_check_e97f2ea0
  ui_loop_internal_f2eb8892["ui-loop-internal"]
  User --> ui_loop_internal_f2eb8892
  ui_loop_shared_8c83b841["ui-loop-shared"]
  User --> ui_loop_shared_8c83b841
  ui_loop_tooling_12b2d2c7["ui-loop-tooling"]
  User --> ui_loop_tooling_12b2d2c7
  ui_loop_11660889["ui-loop"]
  User --> ui_loop_11660889
  verify_coderabbit_490b4e71["verify-coderabbit"]
  User --> verify_coderabbit_490b4e71
  context_health_1_ceb11829["context-health"]
  User --> context_health_1_ceb11829
  types_2_d9bc6e7a["types"]
  User --> types_2_d9bc6e7a
  resolver_439c3635["resolver"]
  User --> resolver_439c3635
  ownership_gate_2e194d13["ownership-gate"]
  User --> ownership_gate_2e194d13
  classDef userNode fill:#16a34a,color:#fff
  class github_e2e_2891a341,linear_e2e_decf3708,run_e2e_39efe696,env_b77349bf,check_public_api_docs_a9604f1b,check_steering_feedback_contract_80134459,run_harness_evals_77704768,validate_decision_request_2e5c325e,branch_protect_core_a8feb0fd,check_environment_core_2c16213f,ci_migrate_core_7005b5af,decision_request_118a770d,evidence_verify_3b73c290,linear_prepare_0c613ba6,linear_sync_a2fa2bf7,linear_triage_core_7cbca73e,linear_workflow_core_0e19cff4,pattern_scope_61ff946d,pr_closeout_env_9bfcd9ef,review_gate_core_4c8001f9,symphony_check_e97f2ea0,ui_loop_internal_f2eb8892,ui_loop_shared_8c83b841,ui_loop_tooling_12b2d2c7,ui_loop_11660889,verify_coderabbit_490b4e71,context_health_1_ceb11829,types_2_d9bc6e7a,resolver_439c3635,ownership_gate_2e194d13 userNode

```

