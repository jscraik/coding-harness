# Trust artifact reference examples

This directory contains inspectable reference outputs for the main Coding Harness trust surfaces. These examples let users verify what the harness produces without running the full system.

## Artifact catalog

| Artifact | File | Producer command |
| --- | --- | --- |
| Contract | [`contract.example.json`](./contract.example.json) | `harness init` |
| Gate result | [`gate-result.example.json`](./gate-result.example.json) | `harness policy-gate` |
| Risk tier | [`risk-tier.example.json`](./risk-tier.example.json) | `harness risk-tier` |
| Blast radius | [`blast-radius.example.json`](./blast-radius.example.json) | `harness blast-radius` |
| CI migration proof | [`ci-migration-proof.example.json`](./ci-migration-proof.example.json) | `harness ci-migrate verify` |
| Run record | [`run-record.example.json`](./run-record.example.json) | `harness` (any gate run) |

## How these are generated

All examples are real outputs from the harness CLI, lightly redacted to remove repo-specific absolute paths and timestamps. The structural contract is preserved exactly.

## Verification

To verify your local harness produces compatible output:

```bash
harness policy-gate --contract harness.contract.json --json | jq '.result' > my-gate-result.json
diff <(jq 'del(.timestamp)' my-gate-result.json) <(jq 'del(.timestamp)' docs/examples/trust-artifacts/gate-result.example.json)
```

## Updating examples

When contract schemas change, regenerate affected examples and commit alongside the schema change.
