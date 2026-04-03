# Cross-Project Governance for Coding Harness

**Date:** 2026-03-07
**Status:** Brainstorm Complete
**Next:** `/workflows:plan docs/brainstorms/2026-03-07-cross-project-governance-brainstorm.md`

---

## What We're Building

Transform coding-harness from a **single-repo governance tool** into a **cross-project governance platform** where policies are defined once and inherited across all projects.

### Core Capabilities

1. **Policy Inheritance** - Define base policies, inherit/override per project
2. **Org-Wide Visibility** - CLI audit showing governance state across all projects
3. **Zero-Config Adoption** - Smart init + template repos for instant governance

### Target Ecosystems

- TypeScript (pnpm + Vite + React)
- Python (uv + pytest)
- Rust (cargo)
- Swift (xcodebuild)
- Go (standard tooling)

---

## Why This Approach

### Problem Statement

Currently, each project maintains its own `harness.contract.json`. This leads to:
- **Drift** - Policies diverge across projects
- **Duplication** - Same rules copy-pasted everywhere
- **No visibility** - No way to see org-wide governance state
- **Manual setup** - New projects require hand-crafted configuration

### Chosen Approach: Core Inheritance

**Scope:**
- Contract inheritance in `harness.contract.json` (`extends` field)
- Bundled presets (typescript-base, python-base, strict, minimal)
- Remote extends (GitHub raw URLs)
- CLI audit command for multi-repo visibility
- Smart `harness init` with ecosystem detection
- Template repos for one-click setup

**Out of Scope (future phases):**
- Central policy registry server
- Web dashboard
- Real-time policy sync

**Why This Approach:**
- Ships in weeks, not months
- Leverages existing package distribution (npm)
- Works offline (bundled presets)
- CLI-first aligns with developer workflow
- Extensible (can add registry/dashboard later)

---

## Key Decisions

### 1. Consumption Model: Package Dependency

Projects install `@brainwav/coding-harness` as dev dependency.

**Rationale:**
- Works offline
- Version pinning per project
- Familiar pattern (ESLint, Prettier, TypeScript)
- No infrastructure required

### 2. Inheritance Model: Hybrid

```json
{
  "extends": "@brainwav/coding-harness/presets/typescript-base",
  "overrides": {
    "riskTierRules": {
      "src/auth/**": "high"
    }
  }
}
```

**Two sources:**
1. **Bundled presets** - Shipped with package, work offline
2. **Remote extends** - GitHub raw URLs for org-specific bases

**Merge strategy:** Deep merge with overrides winning.

### 3. Visibility: CLI-First

```bash
# Audit all repos in a directory
harness org-audit --path ~/dev --format json

# Audit specific repos
harness org-audit --repos jscraik/coding-harness,jscraik/other-project

# Check for policy drift
harness org-audit --drift --base org/base-contract
```

Output formats: JSON (for tooling), Markdown (for reports), Table (for humans).

### 4. Zero-Config: Smart Init + Templates

**Smart Init:**
```bash
harness init
# Auto-detects: package.json → typescript-base
# Auto-detects: pyproject.toml → python-base
# Auto-detects: Cargo.toml → rust-base
```

**Template Repos:**
- `jscraik/template-typescript-harness`
- `jscraik/template-python-harness`
- `jscraik/template-rust-harness`

---

## Implementation Sketch

### Phase 1: Contract Inheritance (Week 1-2)

1. Add `extends` field to contract schema
2. Implement preset loader (bundled + remote)
3. Deep merge logic for overrides
4. Update `harness init` to use presets

**Commands affected:**
- `harness init` - Add `--preset` flag
- All commands that load contract - Add inheritance resolution

### Phase 2: Bundled Presets (Week 2-3)

1. Create preset files for each ecosystem
2. Map ecosystem profiles (branch-protect) to presets
3. Add `harness preset list` and `harness preset show`

**Preset structure:**
```
src/presets/
├── typescript-base.json
├── python-base.json
├── rust-base.json
├── swift-base.json
├── go-base.json
├── strict.json      # High-security baseline
└── minimal.json     # Just security-scan
```

### Phase 3: Org Audit (Week 3-4)

1. Add `harness org-audit` command
2. Multi-repo contract loading
3. Drift detection against base contract
4. Output formatters (JSON, Markdown, Table)

### Phase 4: Templates (Week 4)

1. Create template repos for each ecosystem
2. Pre-configured with correct preset
3. GitHub "Use this template" flow

---

## Contract Schema Changes

```json
{
  "$schema": "https://unpkg.com/@brainwav/coding-harness/schemas/contract.json",
  "extends": "@brainwav/coding-harness/presets/typescript-base",
  "overrides": {
    "riskTierRules": {
      "src/auth/**": "high",
      "src/mcp/**": "high"
    },
    "branchProtection": {
      "requiredChecks": ["lint", "test", "security-scan", "my-custom-check"]
    }
  }
}
```

**New fields:**
- `extends` - Preset name or URL
- `overrides` - Partial contract to merge

---

## Success Criteria

1. **Inheritance works** - `extends: typescript-base` produces valid merged contract
2. **Drift detected** - `harness org-audit --drift` shows policy divergence
3. **Zero-config init** - `harness init` in empty dir creates valid contract
4. **Templates work** - One-click setup from template produces working repo

---

## Resolved Questions

| Question | Decision |
|----------|----------|
| Consumption model? | Package dependency (not central service) |
| Inheritance model? | Hybrid (bundled + remote) |
| Visibility approach? | CLI-first, dashboard later |
| Zero-config approach? | Smart init + template repos |
| Timeline? | Core Inheritance (weeks, not months) |
| Target ecosystems? | TypeScript, Python, Rust, Swift, Go |

---

## Open Questions

> **None** - All key decisions resolved through dialogue.

---

## References

- [Existing ecosystem profiles](../../src/lib/policy/required-checks.ts)
- [Contract schema](../../src/lib/contract/schema.ts)
- [AGENTS.md governance rules](../../AGENTS.md)
- [AI review governance](../agents/12-ai-review-governance.md)
