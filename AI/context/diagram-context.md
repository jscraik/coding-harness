# Diagram Context Pack

Generated: 2026-03-12T10:58:25Z

## architecture

```mermaid
graph TD
  subgraph sg_sg_3a52ce78["."]
    node_vitest_config_79ed63ec["vitest.config"]
  end
  subgraph sg_coverage_6dafbcf6["coverage"]
    node_coverage_block_navigation_c70859a9["block-navigation"]
    node_coverage_prettify_7c8a086a["prettify"]
    node_coverage_sorter_f2899884["sorter"]
  end
  subgraph sg_scripts_16728d18["scripts"]
    node_scripts_setup_git_hooks_2ed98c53["setup-git-hooks"]
    node_scripts_validate_commit_msg_c49346f6["validate-commit-msg"]
  end
  subgraph sg_src_f27fede2["src"]
    node_src_cli_50037f41["cli"]
    node_src_cli_dispatch_test_83d1aecc["cli-dispatch.test"]
    node_src_cli_test_c0ddbe99["cli.test"]
  end
  subgraph sg_src_commands_ac7f36e3["src/commands"]
    node_src_commands_agent_first_throughput_integration__4f0ddd7b["agent-first-throughput.integration.test"]
    node_src_commands_automation_run_2d0faa41["automation-run"]
    node_src_commands_automation_run_test_e2f83281["automation-run.test"]
    node_src_commands_blast_radius_bd615614["blast-radius"]
    node_src_commands_blast_radius_test_fb4e7d14["blast-radius.test"]
    node_src_commands_brainstorm_gate_554b176a["brainstorm-gate"]
    node_src_commands_branch_protect_e57bd6e5["branch-protect"]
    node_src_commands_branch_protect_test_d26f0ed4["branch-protect.test"]
    node_src_commands_check_authz_c5a905d9["check-authz"]
    node_src_commands_check_authz_test_f6b000b3["check-authz.test"]
    node_src_commands_check_diagram_freshness_test_5e858bc8["check-diagram-freshness.test"]
    node_src_commands_check_environment_61a1e6d1["check-environment"]
    node_src_commands_check_environment_test_177a8ad6["check-environment.test"]
    node_src_commands_context_a173b3b5["context"]
    node_src_commands_context_health_c8159838["context-health"]
    node_src_commands_context_integrity_acceptance_test_ec3eafae["context-integrity-acceptance.test"]
    node_src_commands_context_test_04afd925["context.test"]
    node_src_commands_diff_budget_b8b3e926["diff-budget"]
    node_src_commands_diff_budget_test_abd7c3ee["diff-budget.test"]
    node_src_commands_docs_gate_a9482c33["docs-gate"]
    node_src_commands_docs_gate_test_bebd4eac["docs-gate.test"]
    node_src_commands_drift_gate_5163a260["drift-gate"]
    node_src_commands_drift_gate_test_46e320e7["drift-gate.test"]
    node_src_commands_evidence_verify_8b283e40["evidence-verify"]
    node_src_commands_evidence_verify_test_d25d21f3["evidence-verify.test"]
    node_src_commands_gap_case_f7fe09bc["gap-case"]
    node_src_commands_gap_case_test_1e9bd913["gap-case.test"]
    node_src_commands_gardener_16ee9f29["gardener"]
    node_src_commands_gardener_test_01d5ad19["gardener.test"]
    node_src_commands_index_context_76d00fdb["index-context"]
    node_src_commands_index_context_test_552c8613["index-context.test"]
    node_src_commands_init_a32504f5["init"]
    node_src_commands_init_test_208f2f42["init.test"]
    node_src_commands_linear_gate_3a2dbdda["linear-gate"]
    node_src_commands_linear_gate_test_d7fab54c["linear-gate.test"]
    node_src_commands_linear_prepare_676859a4["linear-prepare"]
    node_src_commands_linear_prepare_test_e563937e["linear-prepare.test"]
    node_src_commands_linear_workflow_bc2c047f["linear-workflow"]
    node_src_commands_linear_workflow_test_b60c6e12["linear-workflow.test"]
    node_src_commands_memory_gate_851ca244["memory-gate"]
    node_src_commands_observability_gate_4e33a519["observability-gate"]
    node_src_commands_observability_gate_test_72a003c4["observability-gate.test"]
    node_src_commands_org_audit_bd496958["org-audit"]
    node_src_commands_org_audit_test_8f29d4e0["org-audit.test"]
    node_src_commands_pilot_evaluate_83c96a06["pilot-evaluate"]
    node_src_commands_pilot_evaluate_test_983799d7["pilot-evaluate.test"]
    node_src_commands_pilot_rollback_9ad729c0["pilot-rollback"]
    node_src_commands_pilot_rollback_test_635b55ad["pilot-rollback.test"]
    node_src_commands_plan_gate_0a15fb14["plan-gate"]
    node_src_commands_plan_gate_test_d9d60c82["plan-gate.test"]
    node_src_commands_policy_gate_6f39556d["policy-gate"]
    node_src_commands_policy_gate_test_558cba5e["policy-gate.test"]
    node_src_commands_preflight_gate_e934bc38["preflight-gate"]
    node_src_commands_preset_46228187["preset"]
    node_src_commands_preset_test_ad6ae07f["preset.test"]
    node_src_commands_prompt_gate_bda26456["prompt-gate"]
    node_src_commands_prompt_gate_test_8ce58238["prompt-gate.test"]
    node_src_commands_remediate_ae676761["remediate"]
    node_src_commands_remediate_test_b0fcf4ec["remediate.test"]
    node_src_commands_replay_fcae3a4a["replay"]
    node_src_commands_replay_test_1134c260["replay.test"]
    node_src_commands_request_greptile_review_9d6c1e2d["request-greptile-review"]
    node_src_commands_request_greptile_review_test_babe6fa5["request-greptile-review.test"]
    node_src_commands_review_gate_b74630a3["review-gate"]
    node_src_commands_review_gate_test_dea5880b["review-gate.test"]
    node_src_commands_risk_tier_acf26560["risk-tier"]
    node_src_commands_search_8c19fcb1["search"]
    node_src_commands_search_test_ac250e89["search.test"]
    node_src_commands_silent_error_f4595a23["silent-error"]
    node_src_commands_simulate_f06a3ac7["simulate"]
    node_src_commands_simulate_test_17cdb2fd["simulate.test"]
    node_src_commands_tooling_audit_6606d949["tooling-audit"]
    node_src_commands_tooling_audit_test_874a714a["tooling-audit.test"]
    node_src_commands_ui_loop_14f94e39["ui-loop"]
    node_src_commands_ui_loop_test_1c615cb8["ui-loop.test"]
    node_src_commands_verify_greptile_ef23a832["verify-greptile"]
    node_src_commands_verify_greptile_test_6acf41e8["verify-greptile.test"]
  end
  subgraph sg_src_lib_9b0c0e9c["src/lib"]
    node_src_lib_preset_detection_df7bb651["preset-detection"]
    node_src_lib_preset_detection_test_26643c48["preset-detection.test"]
    node_src_lib_version_337bb7ee["version"]
  end
  subgraph sg_src_lib_automation_feabf310["src/lib/automation"]
    node_src_lib_automation_idempotency_38074b26["idempotency"]
  end
  subgraph sg_src_lib_blast_radius_03046b1f["src/lib/blast-radius"]
    node_src_lib_blast_radius_resolver_5f0dc5b6["resolver"]
    node_src_lib_blast_radius_resolver_test_2434a14b["resolver.test"]
  end
  subgraph sg_src_lib_brainstorm_3c8aa833["src/lib/brainstorm"]
    node_src_lib_brainstorm_detector_20d990d6["detector"]
    node_src_lib_brainstorm_detector_test_22068a91["detector.test"]
    node_src_lib_brainstorm_types_1dfefbfb["types"]
  end
  subgraph sg_src_lib_cli_be82f541["src/lib/cli"]
    node_src_lib_cli_command_registry_aa702320["command-registry"]
    node_src_lib_cli_command_registry_test_30bb0a99["command-registry.test"]
    node_src_lib_cli_doc_parity_fffe943f["doc-parity"]
    node_src_lib_cli_doc_parity_test_deda4d95["doc-parity.test"]
    node_src_lib_cli_help_renderer_ea70b199["help-renderer"]
    node_src_lib_cli_help_renderer_test_063a8bbc["help-renderer.test"]
    node_src_lib_cli_legacy_dispatch_guard_test_c6d6c5c7["legacy-dispatch-guard.test"]
    node_src_lib_cli_parse_utils_505d2b9f["parse-utils"]
  end
  subgraph sg_src_lib_context_compound_85349b31["src/lib/context-compound"]
    node_src_lib_context_compound_constants_9e247b81["constants"]
    node_src_lib_context_compound_constants_test_c131a9ba["constants.test"]
    node_src_lib_context_compound_index_65ba65e9["index"]
    node_src_lib_context_compound_indexer_e7ad2047["indexer"]
    node_src_lib_context_compound_indexer_test_473c7216["indexer.test"]
    node_src_lib_context_compound_init_error_8d4fe562["init-error"]
    node_src_lib_context_compound_lexical_fallback_eeb9773b["lexical-fallback"]
    node_src_lib_context_compound_ollama_6ac6599b["ollama"]
    node_src_lib_context_compound_ollama_test_972f3fc8["ollama.test"]
    node_src_lib_context_compound_rollout_0fa807e3["rollout"]
    node_src_lib_context_compound_store_d1f2d9b9["store"]
    node_src_lib_context_compound_types_ab11fede["types"]
  end
  subgraph sg_src_lib_context_integrity_10938c2b["src/lib/context-integrity"]
    node_src_lib_context_integrity_sources_be47229b["sources"]
  end
  subgraph sg_src_lib_contract_8b2646d4["src/lib/contract"]
    node_src_lib_contract_errors_fbb37c9d["errors"]
    node_src_lib_contract_loader_c7304ec8["loader"]
    node_src_lib_contract_loader_test_5aaec341["loader.test"]
    node_src_lib_contract_merger_15f87e65["merger"]
    node_src_lib_contract_merger_test_9319ae2c["merger.test"]
    node_src_lib_contract_preset_resolver_ed8af332["preset-resolver"]
    node_src_lib_contract_preset_resolver_test_d386cdbf["preset-resolver.test"]
    node_src_lib_contract_run_record_emitter_ae66a1ec["run-record-emitter"]
    node_src_lib_contract_run_record_emitter_test_6d46c5c8["run-record-emitter.test"]
    node_src_lib_contract_run_records_836e164b["run-records"]
    node_src_lib_contract_run_records_test_29458901["run-records.test"]
    node_src_lib_contract_types_60c2ea40["types"]
    node_src_lib_contract_validator_585f17f0["validator"]
    node_src_lib_contract_validator_test_be05f8e6["validator.test"]
  end
  subgraph sg_src_lib_deps_ec348b66["src/lib/deps"]
    node_src_lib_deps_ralph_runtime_e8f53b41["ralph-runtime"]
    node_src_lib_deps_ralph_runtime_test_76613c79["ralph-runtime.test"]
  end
  subgraph sg_src_lib_evidence_ce17bc42["src/lib/evidence"]
    node_src_lib_evidence_index_e429c7d7["index"]
    node_src_lib_evidence_loader_05d04a48["loader"]
    node_src_lib_evidence_logger_09f27768["logger"]
    node_src_lib_evidence_policy_c212a2b9["policy"]
    node_src_lib_evidence_policy_test_0fda159e["policy.test"]
    node_src_lib_evidence_types_c304b8db["types"]
    node_src_lib_evidence_validator_4a254158["validator"]
    node_src_lib_evidence_validator_test_9ebe4bd6["validator.test"]
  end
  subgraph sg_src_lib_gap_case_1a2e655a["src/lib/gap-case"]
    node_src_lib_gap_case_types_cf3c9eba["types"]
  end
  subgraph sg_src_lib_gardener_2ee3d9f5["src/lib/gardener"]
    node_src_lib_gardener_link_checker_95a109ed["link-checker"]
    node_src_lib_gardener_pr_creator_f89e512d["pr-creator"]
    node_src_lib_gardener_quality_scorer_8fe3e3db["quality-scorer"]
    node_src_lib_gardener_stale_detector_3ad97daa["stale-detector"]
    node_src_lib_gardener_stale_detector_test_ae0df545["stale-detector.test"]
    node_src_lib_gardener_types_bd794d6b["types"]
  end
  subgraph sg_src_lib_github_b68c7543["src/lib/github"]
    node_src_lib_github_check_run_94cd4597["check-run"]
    node_src_lib_github_client_51b3b29d["client"]
    node_src_lib_github_comments_91a21eb6["comments"]
    node_src_lib_github_comments_test_e411297a["comments.test"]
    node_src_lib_github_errors_36723665["errors"]
    node_src_lib_github_mutation_queue_44c6f93a["mutation-queue"]
    node_src_lib_github_mutation_queue_test_4604276b["mutation-queue.test"]
    node_src_lib_github_sha_16a8af8a["sha"]
    node_src_lib_github_sha_test_f22f6abd["sha.test"]
  end
  subgraph sg_src_lib_governance_f5be96f9["src/lib/governance"]
    node_src_lib_governance_repo_scanner_6df641c5["repo-scanner"]
    node_src_lib_governance_repo_scanner_test_8643e7e8["repo-scanner.test"]
    node_src_lib_governance_scan_cache_e0415545["scan-cache"]
    node_src_lib_governance_scan_cache_test_6c8cf65d["scan-cache.test"]
    node_src_lib_governance_url_validator_c0cec5fa["url-validator"]
    node_src_lib_governance_url_validator_secure_fetch_te_f62ff797["url-validator.secure-fetch.test"]
    node_src_lib_governance_url_validator_test_88688db7["url-validator.test"]
  end
  subgraph sg_src_lib_input_6d2e2e5b["src/lib/input"]
    node_src_lib_input_sanitize_13ffa2ad["sanitize"]
    node_src_lib_input_sanitize_test_1e7f2d95["sanitize.test"]
    node_src_lib_input_validation_eee23fdc["validation"]
    node_src_lib_input_validation_test_edefff50["validation.test"]
    node_src_lib_input_validator_b95e8971["validator"]
    node_src_lib_input_validator_test_4844e0b1["validator.test"]
  end
  subgraph sg_src_lib_linear_306ffaca["src/lib/linear"]
    node_src_lib_linear_automation_b83eb7ee["automation"]
    node_src_lib_linear_automation_test_aac87654["automation.test"]
    node_src_lib_linear_client_a6f832ad["client"]
    node_src_lib_linear_utils_6af4e5df["utils"]
    node_src_lib_linear_utils_test_73543a4a["utils.test"]
  end
  subgraph sg_src_lib_memory_df2051c4["src/lib/memory"]
    node_src_lib_memory_branch_enforcer_f38c3b70["branch-enforcer"]
    node_src_lib_memory_metrics_tracker_8f20bcc7["metrics-tracker"]
    node_src_lib_memory_metrics_tracker_test_2fadfb06["metrics-tracker.test"]
    node_src_lib_memory_types_4683a2d7["types"]
    node_src_lib_memory_validator_dbba8eeb["validator"]
    node_src_lib_memory_validator_test_66feb032["validator.test"]
  end
  subgraph sg_src_lib_observability_f0d7549d["src/lib/observability"]
    node_src_lib_observability_cardinality_8b9f31b6["cardinality"]
    node_src_lib_observability_cardinality_test_d82dcea7["cardinality.test"]
  end
  subgraph sg_src_lib_pilot_evaluation_72792273["src/lib/pilot-evaluation"]
    node_src_lib_pilot_evaluation_control_plane_9fcff894["control-plane"]
    node_src_lib_pilot_evaluation_control_plane_test_6b85b9d4["control-plane.test"]
    node_src_lib_pilot_evaluation_metrics_capture_6a557a25["metrics-capture"]
    node_src_lib_pilot_evaluation_registries_0709e622["registries"]
    node_src_lib_pilot_evaluation_types_8e80f8a7["types"]
  end
  subgraph sg_src_lib_plan_gate_504885f2["src/lib/plan-gate"]
    node_src_lib_plan_gate_detector_a9899778["detector"]
    node_src_lib_plan_gate_types_8b36a45a["types"]
  end
  subgraph sg_src_lib_policy_b3a76617["src/lib/policy"]
    node_src_lib_policy_command_policy_test_f85a3204["command-policy.test"]
    node_src_lib_policy_diff_budget_3f96be28["diff-budget"]
    node_src_lib_policy_required_checks_cc5260df["required-checks"]
    node_src_lib_policy_risk_tier_6393c9ab["risk-tier"]
    node_src_lib_policy_risk_tier_test_60010fdc["risk-tier.test"]
    node_src_lib_policy_tooling_baseline_78829751["tooling-baseline"]
  end
  subgraph sg_src_lib_preflight_a53c17b5["src/lib/preflight"]
    node_src_lib_preflight_types_e1807687["types"]
    node_src_lib_preflight_validator_4657555d["validator"]
    node_src_lib_preflight_validator_test_580e17d6["validator.test"]
  end
  subgraph sg_src_lib_remediation_056b0e90["src/lib/remediation"]
    node_src_lib_remediation_finding_normalizer_deea8cce["finding-normalizer"]
    node_src_lib_remediation_finding_normalizer_test_8082eaaf["finding-normalizer.test"]
    node_src_lib_remediation_orchestrator_e915f272["orchestrator"]
    node_src_lib_remediation_orchestrator_test_e409976c["orchestrator.test"]
    node_src_lib_remediation_types_a70edef6["types"]
  end
  subgraph sg_src_lib_replay_e36f123f["src/lib/replay"]
    node_src_lib_replay_tracer_c6b49784["tracer"]
    node_src_lib_replay_tracer_test_eec65c7d["tracer.test"]
  end
  subgraph sg_src_lib_result_41f6ea66["src/lib/result"]
    node_src_lib_result_types_2af05f87["types"]
  end
  subgraph sg_src_lib_silent_error_2368b365["src/lib/silent-error"]
    node_src_lib_silent_error_detector_06385e9f["detector"]
    node_src_lib_silent_error_detector_test_f1fe45a6["detector.test"]
    node_src_lib_silent_error_types_c3d5f806["types"]
  end
  subgraph sg_src_lib_simulate_1125ef2f["src/lib/simulate"]
    node_src_lib_simulate_types_ea3a077a["types"]
  end
  subgraph sg_src_lib_workflow_bf0d40a1["src/lib/workflow"]
    node_src_lib_workflow_brainstorm_6ca71c32["brainstorm"]
    node_src_lib_workflow_brainstorm_test_6ac1356e["brainstorm.test"]
    node_src_lib_workflow_plan_1246fd80["plan"]
    node_src_lib_workflow_plan_test_09539389["plan.test"]
  end

```

## class

```mermaid
classDiagram
  class review_gate_test_000e2ed6 {
    +src/commands/review-gate.test.ts
  }
  class remediate_test_6f59cafe {
    +src/commands/remediate.test.ts
  }
  class linear_workflow_test_a351dcb0 {
    +src/commands/linear-workflow.test.ts
  }
  class linear_prepare_test_678f11a9 {
    +src/commands/linear-prepare.test.ts
  }
  class docs_gate_c441fbb4 {
    +src/commands/docs-gate.ts
  }
  class branch_protect_test_c8d80aab {
    +src/commands/branch-protect.test.ts
  }
  class client_948fe603 {
    +src/lib/linear/client.ts
  }
  class validator_2_744853f5 {
    +src/lib/input/validator.ts
  }
  class validation_98c41dcd {
    +src/lib/input/validation.ts
  }
  class sha_d600474b {
    +src/lib/github/sha.ts
  }
  class errors_be4bd567 {
    +src/lib/github/errors.ts
  }
  class validator_3_28b6e9f3 {
    +src/lib/evidence/validator.ts
  }
  class run_records_f616aa7c {
    +src/lib/contract/run-records.ts
  }
  class preset_resolver_dc3dd716 {
    +src/lib/contract/preset-resolver.ts
  }
  class loader_1_16749818 {
    +src/lib/contract/loader.ts
  }
  class errors_1_84b56c88 {
    +src/lib/contract/errors.ts
  }

```

## dependency

```mermaid
graph LR
  ext_inquirer_prompts_4d547149["@inquirer/prompts"] --> node_src_commands_init_a32504f5
  ext_octokit_plugin_retry_c9aecc53["@octokit/plugin-retry"] --> node_src_lib_github_client_51b3b29d
  ext_octokit_plugin_throttling_7909ece3["@octokit/plugin-throttling"] --> node_src_lib_github_client_51b3b29d
  ext_octokit_plugin_throttling_7909ece3["@octokit/plugin-throttling"] --> node_src_lib_gardener_pr_creator_f89e512d
  ext_octokit_request_error_98ae13cc["@octokit/request-error"] --> node_src_lib_github_errors_36723665
  ext_octokit_rest_c6e4d192["@octokit/rest"] --> node_src_lib_github_client_51b3b29d
  ext_octokit_rest_c6e4d192["@octokit/rest"] --> node_src_lib_gardener_pr_creator_f89e512d
  ext_better_sqlite3_d7ed8f1a["better-sqlite3"] --> node_src_lib_context_compound_store_d1f2d9b9
  ext_diff_75a0ee1b["diff"] --> node_src_commands_init_a32504f5
  ext_lodash_901466a5["lodash"] --> node_src_lib_contract_merger_15f87e65
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_agent_first_throughput_integration__4f0ddd7b
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_lib_memory_branch_enforcer_f38c3b70
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_check_diagram_freshness_test_5e858bc8
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_check_environment_61a1e6d1
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_check_environment_test_177a8ad6
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_check_environment_test_177a8ad6
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_check_environment_test_177a8ad6
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_check_environment_test_177a8ad6
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_check_environment_test_177a8ad6
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_check_environment_test_177a8ad6
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_lib_pilot_evaluation_control_plane_9fcff894
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_diff_budget_b8b3e926
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_diff_budget_test_abd7c3ee
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_init_a32504f5
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_init_a32504f5
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_linear_gate_3a2dbdda
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_lib_gardener_link_checker_95a109ed
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_remediate_ae676761
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_remediate_test_b0fcf4ec
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_search_8c19fcb1
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_search_test_ac250e89
  ext_node_child_process_f62b7d19["node:child_process"] --> node_scripts_setup_git_hooks_2ed98c53
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_ui_loop_14f94e39
  ext_node_child_process_f62b7d19["node:child_process"] --> node_src_commands_ui_loop_test_1c615cb8
  ext_node_child_process_f62b7d19["node:child_process"] --> node_scripts_validate_commit_msg_c49346f6
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_check_environment_61a1e6d1
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_cli_test_c0ddbe99
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_pilot_evaluation_control_plane_9fcff894
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_docs_gate_a9482c33
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_automation_idempotency_38074b26
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_context_compound_indexer_e7ad2047
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_context_compound_indexer_test_473c7216
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_init_a32504f5
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_init_a32504f5
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_init_test_208f2f42
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_context_compound_lexical_fallback_eeb9773b
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_gardener_link_checker_95a109ed
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_pilot_rollback_9ad729c0
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_plan_gate_test_d9d60c82
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_contract_preset_resolver_ed8af332
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_contract_preset_resolver_test_d386cdbf
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_remediate_ae676761
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_contract_run_record_emitter_ae66a1ec
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_contract_run_records_836e164b
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_governance_scan_cache_e0415545
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_simulate_f06a3ac7
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_context_integrity_sources_be47229b
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_lib_replay_tracer_c6b49784
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_ui_loop_14f94e39
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_verify_greptile_ef23a832
  ext_node_crypto_c7dfc512["node:crypto"] --> node_src_commands_verify_greptile_test_6acf41e8
  ext_node_dns_828a0bbf["node:dns"] --> node_src_lib_governance_url_validator_c0cec5fa
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_agent_first_throughput_integration__4f0ddd7b
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_blast_radius_test_fb4e7d14
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_workflow_brainstorm_test_6ac1356e
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_memory_branch_enforcer_f38c3b70
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_check_authz_c5a905d9
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_check_authz_test_f6b000b3
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_check_environment_61a1e6d1
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_check_environment_61a1e6d1
  ext_node_fs_a15b7d96["node:fs"] --> node_src_cli_50037f41
  ext_node_fs_a15b7d96["node:fs"] --> node_src_cli_test_c0ddbe99
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_policy_command_policy_test_f85a3204
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_cli_command_registry_test_30bb0a99
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_context_health_c8159838
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_context_integrity_acceptance_test_ec3eafae
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_context_test_04afd925
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_silent_error_detector_06385e9f
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_plan_gate_detector_a9899778
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_brainstorm_detector_20d990d6
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_brainstorm_detector_test_22068a91
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_diff_budget_b8b3e926
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_diff_budget_test_abd7c3ee
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_docs_gate_a9482c33
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_docs_gate_test_bebd4eac
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_evidence_verify_8b283e40
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_evidence_verify_test_d25d21f3
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_gap_case_test_1e9bd913
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_gardener_16ee9f29
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_index_context_76d00fdb
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_context_compound_indexer_e7ad2047
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_a32504f5
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_a32504f5
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_a32504f5
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_init_test_208f2f42
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_cli_legacy_dispatch_guard_test_c6d6c5c7
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_linear_gate_3a2dbdda
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_linear_gate_test_d7fab54c
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_gardener_link_checker_95a109ed
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_evidence_loader_05d04a48
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_evidence_loader_05d04a48
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_contract_loader_c7304ec8
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_contract_loader_test_5aaec341
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_pilot_evaluation_metrics_capture_6a557a25
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_memory_metrics_tracker_test_2fadfb06
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_org_audit_bd496958
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_org_audit_test_8f29d4e0
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_pilot_evaluate_83c96a06
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_pilot_evaluate_test_983799d7
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_pilot_rollback_test_635b55ad
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_pilot_rollback_test_635b55ad
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_pilot_rollback_test_635b55ad
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_pilot_rollback_test_635b55ad
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_pilot_rollback_test_635b55ad
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_pilot_rollback_test_635b55ad
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_pilot_rollback_test_635b55ad
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_plan_gate_test_d9d60c82
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_preset_detection_df7bb651
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_contract_preset_resolver_ed8af332
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_prompt_gate_bda26456
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_gardener_quality_scorer_8fe3e3db
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_pilot_evaluation_registries_0709e622
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_remediate_test_b0fcf4ec
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_replay_test_1134c260
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_governance_repo_scanner_6df641c5
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_contract_run_record_emitter_ae66a1ec
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_contract_run_records_test_29458901
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_governance_scan_cache_test_6c8cf65d
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_governance_scan_cache_test_6c8cf65d
  ext_node_fs_a15b7d96["node:fs"] --> node_scripts_setup_git_hooks_2ed98c53
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_simulate_f06a3ac7
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_simulate_test_17cdb2fd
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_gardener_stale_detector_3ad97daa
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_gardener_stale_detector_test_ae0df545
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_context_compound_store_d1f2d9b9
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_context_compound_store_d1f2d9b9
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_tooling_audit_6606d949
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_tooling_audit_test_874a714a
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_replay_tracer_c6b49784
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_replay_tracer_c6b49784
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_replay_tracer_test_eec65c7d
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_replay_tracer_test_eec65c7d
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_ui_loop_14f94e39
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_ui_loop_test_1c615cb8
  ext_node_fs_a15b7d96["node:fs"] --> node_scripts_validate_commit_msg_c49346f6
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_preflight_validator_4657555d
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_memory_validator_dbba8eeb
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_input_validator_b95e8971
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_evidence_validator_4a254158
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_evidence_validator_4a254158
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_preflight_validator_test_580e17d6
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_memory_validator_test_66feb032
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_evidence_validator_test_9ebe4bd6
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_verify_greptile_ef23a832
  ext_node_fs_a15b7d96["node:fs"] --> node_src_commands_verify_greptile_test_6acf41e8
  ext_node_fs_a15b7d96["node:fs"] --> node_src_lib_version_337bb7ee
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_automation_run_test_e2f83281
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_blast_radius_test_fb4e7d14
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_check_diagram_freshness_test_5e858bc8
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_check_environment_test_177a8ad6
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_context_test_04afd925
  ext_node_os_d93fe73a["node:os"] --> node_src_lib_silent_error_detector_test_f1fe45a6
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_evidence_verify_test_d25d21f3
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_index_context_test_552c8613
  ext_node_os_d93fe73a["node:os"] --> node_src_lib_context_compound_indexer_test_473c7216
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_init_test_208f2f42
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_linear_gate_test_d7fab54c
  ext_node_os_d93fe73a["node:os"] --> node_src_lib_gardener_link_checker_95a109ed
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_org_audit_test_8f29d4e0
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_pilot_rollback_test_635b55ad
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_replay_test_1134c260
  ext_node_os_d93fe73a["node:os"] --> node_src_lib_governance_scan_cache_test_6c8cf65d
  ext_node_os_d93fe73a["node:os"] --> node_src_lib_governance_scan_cache_test_6c8cf65d
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_simulate_test_17cdb2fd
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_tooling_audit_test_874a714a
  ext_node_os_d93fe73a["node:os"] --> node_src_lib_preflight_validator_test_580e17d6
  ext_node_os_d93fe73a["node:os"] --> node_src_lib_memory_validator_test_66feb032
  ext_node_os_d93fe73a["node:os"] --> node_src_lib_input_validator_test_4844e0b1
  ext_node_os_d93fe73a["node:os"] --> node_src_lib_evidence_validator_test_9ebe4bd6
  ext_node_os_d93fe73a["node:os"] --> node_src_commands_verify_greptile_test_6acf41e8
  ext_node_path_78811c13["node:path"] --> node_src_commands_agent_first_throughput_integration__4f0ddd7b
  ext_node_path_78811c13["node:path"] --> node_src_commands_automation_run_2d0faa41
  ext_node_path_78811c13["node:path"] --> node_src_commands_automation_run_test_e2f83281
  ext_node_path_78811c13["node:path"] --> node_src_commands_blast_radius_test_fb4e7d14
  ext_node_path_78811c13["node:path"] --> node_src_lib_workflow_brainstorm_6ca71c32
  ext_node_path_78811c13["node:path"] --> node_src_lib_workflow_brainstorm_test_6ac1356e
  ext_node_path_78811c13["node:path"] --> node_src_lib_memory_branch_enforcer_f38c3b70
  ext_node_path_78811c13["node:path"] --> node_src_commands_check_authz_c5a905d9
  ext_node_path_78811c13["node:path"] --> node_src_commands_check_authz_test_f6b000b3
  ext_node_path_78811c13["node:path"] --> node_src_commands_check_diagram_freshness_test_5e858bc8
  ext_node_path_78811c13["node:path"] --> node_src_commands_check_environment_61a1e6d1
  ext_node_path_78811c13["node:path"] --> node_src_commands_check_environment_test_177a8ad6
  ext_node_path_78811c13["node:path"] --> node_src_cli_50037f41
  ext_node_path_78811c13["node:path"] --> node_src_cli_test_c0ddbe99
  ext_node_path_78811c13["node:path"] --> node_src_lib_policy_command_policy_test_f85a3204
  ext_node_path_78811c13["node:path"] --> node_src_lib_cli_command_registry_test_30bb0a99
  ext_node_path_78811c13["node:path"] --> node_src_commands_context_a173b3b5
  ext_node_path_78811c13["node:path"] --> node_src_commands_context_health_c8159838
  ext_node_path_78811c13["node:path"] --> node_src_commands_context_integrity_acceptance_test_ec3eafae
  ext_node_path_78811c13["node:path"] --> node_src_commands_context_test_04afd925
  ext_node_path_78811c13["node:path"] --> node_src_lib_pilot_evaluation_control_plane_9fcff894
  ext_node_path_78811c13["node:path"] --> node_src_lib_pilot_evaluation_control_plane_test_6b85b9d4
  ext_node_path_78811c13["node:path"] --> node_src_lib_silent_error_detector_06385e9f
  ext_node_path_78811c13["node:path"] --> node_src_lib_plan_gate_detector_a9899778
  ext_node_path_78811c13["node:path"] --> node_src_lib_brainstorm_detector_20d990d6
  ext_node_path_78811c13["node:path"] --> node_src_lib_silent_error_detector_test_f1fe45a6
  ext_node_path_78811c13["node:path"] --> node_src_lib_brainstorm_detector_test_22068a91
  ext_node_path_78811c13["node:path"] --> node_src_commands_docs_gate_a9482c33
  ext_node_path_78811c13["node:path"] --> node_src_commands_docs_gate_test_bebd4eac
  ext_node_path_78811c13["node:path"] --> node_src_commands_drift_gate_5163a260
  ext_node_path_78811c13["node:path"] --> node_src_commands_drift_gate_test_46e320e7
  ext_node_path_78811c13["node:path"] --> node_src_commands_evidence_verify_8b283e40
  ext_node_path_78811c13["node:path"] --> node_src_commands_evidence_verify_test_d25d21f3
  ext_node_path_78811c13["node:path"] --> node_src_commands_gap_case_f7fe09bc
  ext_node_path_78811c13["node:path"] --> node_src_commands_gap_case_test_1e9bd913
  ext_node_path_78811c13["node:path"] --> node_src_commands_gardener_16ee9f29
  ext_node_path_78811c13["node:path"] --> node_src_commands_gardener_test_01d5ad19
  ext_node_path_78811c13["node:path"] --> node_src_lib_automation_idempotency_38074b26
  ext_node_path_78811c13["node:path"] --> node_src_commands_index_context_76d00fdb
  ext_node_path_78811c13["node:path"] --> node_src_commands_index_context_test_552c8613
  ext_node_path_78811c13["node:path"] --> node_src_lib_context_compound_indexer_e7ad2047
  ext_node_path_78811c13["node:path"] --> node_src_lib_context_compound_indexer_test_473c7216
  ext_node_path_78811c13["node:path"] --> node_src_commands_init_a32504f5
  ext_node_path_78811c13["node:path"] --> node_src_commands_init_a32504f5
  ext_node_path_78811c13["node:path"] --> node_src_commands_init_a32504f5
  ext_node_path_78811c13["node:path"] --> node_src_commands_init_test_208f2f42
  ext_node_path_78811c13["node:path"] --> node_src_lib_cli_legacy_dispatch_guard_test_c6d6c5c7
  ext_node_path_78811c13["node:path"] --> node_src_lib_context_compound_lexical_fallback_eeb9773b
  ext_node_path_78811c13["node:path"] --> node_src_commands_linear_gate_3a2dbdda
  ext_node_path_78811c13["node:path"] --> node_src_commands_linear_gate_test_d7fab54c
  ext_node_path_78811c13["node:path"] --> node_src_lib_gardener_link_checker_95a109ed
  ext_node_path_78811c13["node:path"] --> node_src_lib_evidence_loader_05d04a48
  ext_node_path_78811c13["node:path"] --> node_src_lib_contract_loader_test_5aaec341
  ext_node_path_78811c13["node:path"] --> node_src_lib_pilot_evaluation_metrics_capture_6a557a25
  ext_node_path_78811c13["node:path"] --> node_src_lib_memory_metrics_tracker_8f20bcc7
  ext_node_path_78811c13["node:path"] --> node_src_lib_memory_metrics_tracker_test_2fadfb06
  ext_node_path_78811c13["node:path"] --> node_src_commands_org_audit_bd496958
  ext_node_path_78811c13["node:path"] --> node_src_commands_org_audit_test_8f29d4e0
  ext_node_path_78811c13["node:path"] --> node_src_commands_pilot_evaluate_83c96a06
  ext_node_path_78811c13["node:path"] --> node_src_commands_pilot_evaluate_test_983799d7
  ext_node_path_78811c13["node:path"] --> node_src_commands_pilot_rollback_9ad729c0
  ext_node_path_78811c13["node:path"] --> node_src_commands_pilot_rollback_test_635b55ad
  ext_node_path_78811c13["node:path"] --> node_src_lib_workflow_plan_1246fd80
  ext_node_path_78811c13["node:path"] --> node_src_commands_plan_gate_test_d9d60c82
  ext_node_path_78811c13["node:path"] --> node_src_lib_workflow_plan_test_09539389
  ext_node_path_78811c13["node:path"] --> node_src_lib_preset_detection_df7bb651
  ext_node_path_78811c13["node:path"] --> node_src_lib_contract_preset_resolver_ed8af332
  ext_node_path_78811c13["node:path"] --> node_src_commands_prompt_gate_bda26456
  ext_node_path_78811c13["node:path"] --> node_src_lib_gardener_quality_scorer_8fe3e3db
  ext_node_path_78811c13["node:path"] --> node_src_lib_pilot_evaluation_registries_0709e622
  ext_node_path_78811c13["node:path"] --> node_src_commands_remediate_ae676761
  ext_node_path_78811c13["node:path"] --> node_src_commands_replay_fcae3a4a
  ext_node_path_78811c13["node:path"] --> node_src_commands_replay_test_1134c260
  ext_node_path_78811c13["node:path"] --> node_src_lib_governance_repo_scanner_6df641c5
  ext_node_path_78811c13["node:path"] --> node_src_lib_governance_repo_scanner_test_8643e7e8
  ext_node_path_78811c13["node:path"] --> node_src_lib_contract_run_record_emitter_ae66a1ec
  ext_node_path_78811c13["node:path"] --> node_src_lib_contract_run_records_836e164b
  ext_node_path_78811c13["node:path"] --> node_src_lib_contract_run_records_test_29458901
  ext_node_path_78811c13["node:path"] --> node_src_lib_governance_scan_cache_e0415545
  ext_node_path_78811c13["node:path"] --> node_src_lib_governance_scan_cache_test_6c8cf65d
  ext_node_path_78811c13["node:path"] --> node_src_lib_governance_scan_cache_test_6c8cf65d
  ext_node_path_78811c13["node:path"] --> node_src_commands_search_8c19fcb1
  ext_node_path_78811c13["node:path"] --> node_scripts_setup_git_hooks_2ed98c53
  ext_node_path_78811c13["node:path"] --> node_src_commands_simulate_f06a3ac7
  ext_node_path_78811c13["node:path"] --> node_src_commands_simulate_test_17cdb2fd
  ext_node_path_78811c13["node:path"] --> node_src_lib_context_integrity_sources_be47229b
  ext_node_path_78811c13["node:path"] --> node_src_lib_gardener_stale_detector_3ad97daa
  ext_node_path_78811c13["node:path"] --> node_src_lib_gardener_stale_detector_test_ae0df545
  ext_node_path_78811c13["node:path"] --> node_src_lib_context_compound_store_d1f2d9b9
  ext_node_path_78811c13["node:path"] --> node_src_commands_tooling_audit_6606d949
  ext_node_path_78811c13["node:path"] --> node_src_commands_tooling_audit_test_874a714a
  ext_node_path_78811c13["node:path"] --> node_src_lib_replay_tracer_c6b49784
  ext_node_path_78811c13["node:path"] --> node_src_commands_ui_loop_14f94e39
  ext_node_path_78811c13["node:path"] --> node_src_lib_preflight_validator_4657555d
  ext_node_path_78811c13["node:path"] --> node_src_lib_memory_validator_dbba8eeb
  ext_node_path_78811c13["node:path"] --> node_src_lib_input_validator_b95e8971
  ext_node_path_78811c13["node:path"] --> node_src_lib_evidence_validator_4a254158
  ext_node_path_78811c13["node:path"] --> node_src_lib_preflight_validator_test_580e17d6
  ext_node_path_78811c13["node:path"] --> node_src_lib_memory_validator_test_66feb032
  ext_node_path_78811c13["node:path"] --> node_src_lib_input_validator_test_4844e0b1
  ext_node_path_78811c13["node:path"] --> node_src_lib_evidence_validator_test_9ebe4bd6
  ext_node_path_78811c13["node:path"] --> node_src_commands_verify_greptile_ef23a832
  ext_node_path_78811c13["node:path"] --> node_src_commands_verify_greptile_test_6acf41e8
  ext_node_path_78811c13["node:path"] --> node_src_lib_version_337bb7ee
  ext_node_process_00cdf119["node:process"] --> node_src_commands_init_a32504f5
  ext_node_url_d0cb3ad7["node:url"] --> node_src_cli_50037f41
  ext_node_url_d0cb3ad7["node:url"] --> node_src_cli_test_c0ddbe99
  ext_node_url_d0cb3ad7["node:url"] --> node_src_lib_pilot_evaluation_control_plane_9fcff894
  ext_node_url_d0cb3ad7["node:url"] --> node_src_lib_contract_preset_resolver_ed8af332
  ext_node_url_d0cb3ad7["node:url"] --> node_src_commands_ui_loop_14f94e39
  ext_node_url_d0cb3ad7["node:url"] --> node_src_lib_version_337bb7ee
  ext_picomatch_2ebdbf14["picomatch"] --> node_src_lib_evidence_policy_c212a2b9
  ext_picomatch_2ebdbf14["picomatch"] --> node_src_lib_blast_radius_resolver_5f0dc5b6
  ext_picomatch_2ebdbf14["picomatch"] --> node_src_lib_policy_risk_tier_6393c9ab
  ext_semver_b4039641["semver"] --> node_src_commands_check_environment_61a1e6d1
  ext_semver_b4039641["semver"] --> node_src_commands_init_a32504f5
  ext_sqlite_vec_bae73cf2["sqlite-vec"] --> node_src_lib_context_compound_store_d1f2d9b9
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_agent_first_throughput_integration__4f0ddd7b
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_automation_run_test_e2f83281
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_linear_automation_test_aac87654
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_blast_radius_test_fb4e7d14
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_workflow_brainstorm_test_6ac1356e
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_branch_protect_test_d26f0ed4
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_observability_cardinality_test_d82dcea7
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_check_authz_test_f6b000b3
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_check_diagram_freshness_test_5e858bc8
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_check_environment_test_177a8ad6
  ext_vitest_4c9cfa13["vitest"] --> node_src_cli_dispatch_test_83d1aecc
  ext_vitest_4c9cfa13["vitest"] --> node_src_cli_test_c0ddbe99
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_policy_command_policy_test_f85a3204
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_cli_command_registry_test_30bb0a99
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_github_comments_test_e411297a
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_context_compound_constants_test_c131a9ba
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_context_integrity_acceptance_test_ec3eafae
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_context_test_04afd925
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_pilot_evaluation_control_plane_test_6b85b9d4
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_silent_error_detector_test_f1fe45a6
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_brainstorm_detector_test_22068a91
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_diff_budget_test_abd7c3ee
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_cli_doc_parity_test_deda4d95
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_docs_gate_test_bebd4eac
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_drift_gate_test_46e320e7
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_evidence_verify_test_d25d21f3
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_remediation_finding_normalizer_test_8082eaaf
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_gap_case_test_1e9bd913
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_gardener_test_01d5ad19
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_cli_help_renderer_test_063a8bbc
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_index_context_test_552c8613
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_context_compound_indexer_test_473c7216
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_init_test_208f2f42
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_cli_legacy_dispatch_guard_test_c6d6c5c7
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_linear_gate_test_d7fab54c
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_linear_prepare_test_e563937e
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_linear_workflow_test_b60c6e12
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_contract_loader_test_5aaec341
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_contract_merger_test_9319ae2c
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_memory_metrics_tracker_test_2fadfb06
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_github_mutation_queue_test_4604276b
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_observability_gate_test_72a003c4
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_context_compound_ollama_test_972f3fc8
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_remediation_orchestrator_test_e409976c
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_org_audit_test_8f29d4e0
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_pilot_evaluate_test_983799d7
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_pilot_rollback_test_635b55ad
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_plan_gate_test_d9d60c82
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_workflow_plan_test_09539389
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_policy_gate_test_558cba5e
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_evidence_policy_test_0fda159e
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_preset_detection_test_26643c48
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_contract_preset_resolver_test_d386cdbf
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_preset_test_ad6ae07f
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_prompt_gate_test_8ce58238
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_deps_ralph_runtime_test_76613c79
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_remediate_test_b0fcf4ec
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_replay_test_1134c260
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_governance_repo_scanner_test_8643e7e8
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_request_greptile_review_test_babe6fa5
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_blast_radius_resolver_test_2434a14b
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_review_gate_test_dea5880b
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_policy_risk_tier_test_60010fdc
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_contract_run_record_emitter_test_6d46c5c8
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_contract_run_records_test_29458901
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_input_sanitize_test_1e7f2d95
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_governance_scan_cache_test_6c8cf65d
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_search_test_ac250e89
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_github_sha_test_f22f6abd
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_simulate_test_17cdb2fd
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_gardener_stale_detector_test_ae0df545
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_tooling_audit_test_874a714a
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_replay_tracer_test_eec65c7d
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_ui_loop_test_1c615cb8
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_governance_url_validator_secure_fetch_te_f62ff797
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_governance_url_validator_test_88688db7
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_linear_utils_test_73543a4a
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_input_validation_test_edefff50
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_preflight_validator_test_580e17d6
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_memory_validator_test_66feb032
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_input_validator_test_4844e0b1
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_evidence_validator_test_9ebe4bd6
  ext_vitest_4c9cfa13["vitest"] --> node_src_lib_contract_validator_test_be05f8e6
  ext_vitest_4c9cfa13["vitest"] --> node_src_commands_verify_greptile_test_6acf41e8
  ext_vitest_4c9cfa13["vitest"] --> node_vitest_config_79ed63ec
  style ext_better_sqlite3_d7ed8f1a fill:#f59e0b,color:#fff
  style ext_diff_75a0ee1b fill:#f59e0b,color:#fff
  style ext_inquirer_prompts_4d547149 fill:#f59e0b,color:#fff
  style ext_lodash_901466a5 fill:#f59e0b,color:#fff
  style ext_node_child_process_f62b7d19 fill:#f59e0b,color:#fff
  style ext_node_crypto_c7dfc512 fill:#f59e0b,color:#fff
  style ext_node_dns_828a0bbf fill:#f59e0b,color:#fff
  style ext_node_fs_a15b7d96 fill:#f59e0b,color:#fff
  style ext_node_os_d93fe73a fill:#f59e0b,color:#fff
  style ext_node_path_78811c13 fill:#f59e0b,color:#fff
  style ext_node_process_00cdf119 fill:#f59e0b,color:#fff
  style ext_node_url_d0cb3ad7 fill:#f59e0b,color:#fff
  style ext_octokit_plugin_retry_c9aecc53 fill:#f59e0b,color:#fff
  style ext_octokit_plugin_throttling_7909ece3 fill:#f59e0b,color:#fff
  style ext_octokit_request_error_98ae13cc fill:#f59e0b,color:#fff
  style ext_octokit_rest_c6e4d192 fill:#f59e0b,color:#fff
  style ext_picomatch_2ebdbf14 fill:#f59e0b,color:#fff
  style ext_semver_b4039641 fill:#f59e0b,color:#fff
  style ext_sqlite_vec_bae73cf2 fill:#f59e0b,color:#fff
  style ext_vitest_4c9cfa13 fill:#f59e0b,color:#fff

```

## flow

```mermaid
flowchart TD
  Start(["Start"])
  vitest_config_a9f1245e["vitest.config"]
  Start --> vitest_config_a9f1245e
  cli_99bb8840["cli"]
  vitest_config_a9f1245e --> cli_99bb8840
  cli_test_4851f28b["cli.test"]
  cli_99bb8840 --> cli_test_4851f28b
  cli_dispatch_test_54c9f17b["cli-dispatch.test"]
  cli_test_4851f28b --> cli_dispatch_test_54c9f17b
  version_5ca4f385["version"]
  cli_dispatch_test_54c9f17b --> version_5ca4f385
  preset_detection_b0f00a17["preset-detection"]
  version_5ca4f385 --> preset_detection_b0f00a17
  preset_detection_test_13b58525["preset-detection.test"]
  preset_detection_b0f00a17 --> preset_detection_test_13b58525
  verify_greptile_227190f7["verify-greptile"]
  preset_detection_test_13b58525 --> verify_greptile_227190f7
  End(["End"])
  verify_greptile_227190f7 --> End

```

## sequence

```mermaid
sequenceDiagram
  participant index_1bc04b52 as index

```

