# JSC-283 Packaged Skill Behavior Assurance Spec Technical Review

## Review Target

- Spec:
  `.harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md`
- Linear issue: `JSC-283`
- Review date: 2026-05-08
- Review type: technical spec gate before `he-plan`

## Verdict

Pass after remediation.

The spec is suitable for `he-plan`. It now gives the planner enough constraint
to produce a bounded fixture-matrix plan without inventing package-form policy,
release-gate promotion rules, credential behavior, or closure semantics.

## Findings

### Resolved Blocker - Acceptance closure did not include the new gate

Severity: blocker, resolved.

Evidence:

- The spec added `SA-283-090` to the acceptance matrix and Linear traceability.
- The implementation-complete rule originally referenced only `SA-283-001`
  through `SA-283-080`, which could let release-gate sequencing close out
  without satisfying the new anti-drift acceptance.

Resolution:

- The completion rule now requires all `JSC-283` acceptance IDs in the Linear
  Acceptance Traceability table, rather than a numeric range.

Why it matters:

- Numeric acceptance ranges are fragile once new IDs are inserted.
- The traceability table is the durable source of closure semantics.

### Resolved Blocker - Source-only proof could still be read as enough

Severity: blocker, resolved.

Evidence:

- The package-form acceptance required a proof target but allowed the wording
  `source workspace, packed artifact, or global install target`.
- That left a loophole where a planner could choose source workspace proof and
  accidentally treat JSC-283 as complete, recreating the exact JSC-282/JSC-283
  separation problem.

Resolution:

- `SA-283-012` now requires separate first-proof and closure-proof targets.
- JSC-283 closure requires packed artifact proof or an explicit non-closure
  blocker.

Why it matters:

- JSC-283 exists specifically because JSC-282 source-command proof is not
  packaged downstream proof.

## Material Risks Checked

| Risk | Review result |
| --- | --- |
| Linear traceability drift | Pass. `JSC-283` is the sole implementation scope and acceptance IDs map through the traceability table. |
| Scope creep into JSC-248/JSC-282/governance/CI | Pass. Non-goals and boundary sections explicitly reject these expansions. |
| Fixture bloat | Pass. The fixture matrix caps proof to adoption-critical states. |
| Static validation replacing behavior proof | Pass. Static checks remain blocking but cannot close packaged readiness. |
| Credential masking | Pass. Credential paths must be blocked with exact missing inputs. |
| Release-gate overreach | Pass. Fixture gates start advisory and promote only after deterministic local runs. |
| User-owned config mutation | Pass. Customized environment/action-sync fixture must prove preservation or conflict behavior. |
| Fake command dispatch | Pass. Loophole controls forbid fake dispatch to satisfy stale references. |

## Remaining Non-Blocking Questions

- `he-plan` must choose where the fixture matrix lives: plan artifact, fixture
  README, or eval draft.
- `he-plan` must choose the implementation fixture root.
- `he-plan` must name the first proof package form and the closure proof package
  form separately.

These are planning decisions, not spec blockers.

## Recommended Next Step

Run `he-plan` for `JSC-283` with this first slice:

- Fixture matrix design.
- Package-form decision.
- Static validator preservation.
- Credential-blocked policy.
- Release-gate deferral rule.

Do not begin fixture implementation until those decisions are explicit.
