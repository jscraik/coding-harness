# Contracts

## Table of Contents
- [Purpose](#purpose)
- [Authoritative Surfaces](#authoritative-surfaces)
- [Directory Layout](#directory-layout)
- [Change Rules](#change-rules)
- [Validation](#validation)

## Purpose

This directory contains machine-readable contracts used by the harness runtime,
CLI, validation gates, and tests. Treat these files as compatibility surfaces:
they define the shape of evidence, command output, registries, and fixtures that
other code reads.

Prefer extending an existing manifest or schema before adding a parallel
contract surface. Do not move root contract paths unless all package exposure,
runtime consumers, tests, docs, and manifests are migrated together.

## Authoritative Surfaces

- Runtime packet contracts are listed in
  [runtime-packet-schemas.manifest.json](./runtime-packet-schemas.manifest.json).
  The manifest records schema paths, example paths, runtime emission state,
  semantic validators, and blocked producer notes for packet types that are not
  emitted yet.
- CLI JSON output contracts are listed in
  [cli-json-contracts.manifest.json](./cli-json-contracts.manifest.json).
  The manifest records the command, expected schema version, JSON Schema, example
  payload, and live validation policy for each command surface.
- Registry JSON files such as
  [agent-adapter-registry.json](./agent-adapter-registry.json),
  [agent-metric-registry.json](./agent-metric-registry.json), and
  [consistency-baseline-pointer.json](./consistency-baseline-pointer.json) are
  data contracts consumed by runtime or validation code.
- Standalone schemas such as
  [browser-evidence.schema.json](./browser-evidence.schema.json),
  [agent-run-manifest.schema.json](./agent-run-manifest.schema.json),
  [agent-run-event.schema.json](./agent-run-event.schema.json), and
  [consistency-contract.schema.yaml](./consistency-contract.schema.yaml) are
  contract surfaces outside the runtime-packet and CLI-manifest lanes.

## Directory Layout

- Root files hold canonical schemas, manifests, and registry instances.
- [examples/](./examples/) holds valid example payloads used by schema and
  semantic validators.
- [examples/invalid/](./examples/invalid/) holds intentionally invalid examples
  for negative validator coverage.
- [fixtures/](./fixtures/) holds source files and multi-file inputs used by
  validator tests. Fixtures are not canonical examples unless a validator or
  test names them as such.

## Change Rules

- Add runtime-packet schema changes to
  [runtime-packet-schemas.manifest.json](./runtime-packet-schemas.manifest.json)
  with a matching example under [examples/](./examples/).
- Add CLI JSON command-output contracts to
  [cli-json-contracts.manifest.json](./cli-json-contracts.manifest.json) with a
  matching schema and example.
- Keep JSON edits schema-shaped and parseable with `jq`; avoid regex-based JSON
  rewrites.
- Keep examples minimal but behavior-representative. Add invalid examples only
  when they prove a validator boundary that could regress.
- Update TypeScript or Python validators when a schema gains semantics that JSON
  Schema alone cannot prove.

## Validation

Use the narrowest contract gate first, then widen based on the changed surface.

- Runtime packet schemas and examples:
  `pnpm run contracts:runtime-packets`
- CLI JSON contracts, JSON/YAML syntax, and artifact contract typing:
  `pnpm run artifact:types`
- Broad fast repo wrapper after contract or docs changes:
  `bash scripts/validate-codestyle.sh --fast`
