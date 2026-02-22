# Coding Harness - AGENTS.md

This repository is the control plane for agentic development.

## Quick Reference

- `pnpm check` - Run all checks (lint + typecheck + test + audit)
- `pnpm build` - Compile TypeScript
- See `docs/HARNESS_IMPLEMENTATION_PLAN.md` for full architecture

## ESM Import Convention

This project uses ESM. All local imports MUST include `.js` extension:

```typescript
// WRONG
import { foo } from './lib/foo';

// CORRECT
import { foo } from './lib/foo.js';
```

## Imports

@/Users/jamiecraik/.codex/AGENTS.md
