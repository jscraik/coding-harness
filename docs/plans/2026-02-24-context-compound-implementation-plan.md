---
title: Context Compound Implementation
date: 2026-02-24
type: feature
status: draft
origin: docs/brainstorms/2026-02-24-context-compound-ollama-brainstorm.md
brainstormDate: 2026-02-24
decisions:
  - Use local Ollama embeddings (not cloud APIs)
  - Use sqlite-vec for vector storage
  - Start with full-document chunking
  - Auto-detect Ollama, graceful fallback
---

# Plan: Context Compound Implementation

## Overview

Implement a semantic memory system that uses local Ollama embeddings to surface relevant prior brainstorms, plans, and decisions when an agent starts new work.

## Goals

1. Make agent sessions context-aware by retrieving relevant prior work
2. Keep everything local (no code leaves the machine)
3. Zero configuration (auto-detect Ollama, skip if unavailable)
4. Compounding value: more artifacts = smarter retrieval

## Non-Goals

- Cloud-based embeddings (OpenAI, etc.) - out of scope for MVP
- Cross-project memory - phase 2
- Real-time agent prompt injection - phase 2

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLI: harness context "implementing OAuth"                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  ContextCompound                                            │
│  ├── retrieve(query) → ranked results                       │
│  └── index(artifact) → embedding + metadata                 │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐   ┌─────────────────────────────┐
│  Ollama Client  │   │  Vector Store (sqlite-vec)  │
│  - isAvailable()│   │  - embeddings table         │
│  - embed(text)  │   │  - metadata index           │
└─────────────────┘   └─────────────────────────────┘
```

## Implementation Phases

### Phase 1: Foundation (Day 1-2)

**Tasks:**
1. Create `src/lib/context-compound/types.ts`
   - `ContextCompoundConfig` interface
   - `EmbeddingRecord` interface
   - `RetrievalResult` interface
   - `OllamaConfig` interface

2. Create `src/lib/context-compound/ollama.ts`
   - `isOllamaAvailable(): Promise<boolean>` - health check
   - `embed(text: string, model?: string): Promise<number[]>`
   - Default model: `nomic-embed-text`
   - Error handling for connection failures

3. Create `src/lib/context-compound/store.ts`
   - SQLite with `sqlite-vec` extension
   - Schema: `embeddings(path, embedding, type, topic, date, content_hash)`
   - Methods: `init()`, `insert(record)`, `search(queryEmbedding, limit, threshold)`
   - Cosine similarity via sqlite-vec

**Acceptance Criteria:**
- Can detect Ollama availability
- Can generate embeddings for text
- Can store and retrieve embeddings from SQLite

### Phase 2: Indexing Pipeline (Day 3-4)

**Tasks:**
1. Create `src/lib/context-compound/indexer.ts`
   - `indexBrainstorm(filepath: string)` - parse frontmatter + content
   - `indexPlan(filepath: string)` - parse frontmatter + content
   - Content hashing to avoid re-indexing unchanged files
   - Batch indexing for existing artifacts

2. Integrate with existing workflows
   - Hook into `createBrainstorm()` - auto-index after creation
   - Hook into `createPlan()` - auto-index after creation
   - Add `forceReindex` option for updates

3. Create CLI command: `harness index-context`
   - Bulk index all existing brainstorms/plans
   - Progress indicator
   - Report: indexed count, skipped count, errors

**Acceptance Criteria:**
- New brainstorms auto-index after creation
- Bulk indexing works for existing artifacts
- Duplicate detection prevents re-indexing

### Phase 3: Retrieval & CLI (Day 5-6)

**Tasks:**
1. Create `src/lib/context-compound/retriever.ts`
   - `retrieve(query: string, options: RetrieveOptions)`
   - Cosine similarity ranking
   - Threshold filtering (default: 0.70)
   - Metadata enrichment (excerpts, dates, status)

2. Create CLI command: `harness context`
   - `harness context "query string"`
   - Options: `--limit`, `--threshold`, `--json`
   - Pretty-printed table output (default)
   - JSON output for programmatic use

3. Create `src/commands/context.ts`
   - CLI argument parsing
   - Integration with retriever
   - Exit codes: 0=found results, 1=no results, 2=ollama unavailable

**Acceptance Criteria:**
- Can retrieve relevant artifacts by query
- Results ranked by relevance
- Both human and JSON output formats work

### Phase 4: Integration & Polish (Day 7)

**Tasks:**
1. Add to `harness init`
   - Create `.harness/` directory
   - Add `.harness/` to `.gitignore` template
   - Optional: pre-seed with common config

2. Documentation
   - Update `AGENTS.md` with context compound usage
   - Add example to `FORJAMIE.md` template
   - CLI help text for `harness context`

3. Testing
   - Unit tests for ollama client (mock server)
   - Unit tests for store (in-memory SQLite)
   - Integration tests for end-to-end flow
   - Test coverage target: 80%+

**Acceptance Criteria:**
- Init command sets up context compound directory
- Documentation complete
- All tests passing

## Technical Decisions

### Embedding Model: nomic-embed-text

**Rationale:**
- Fast enough for local use (~100ms for 1KB text)
- 768-dimensional embeddings (good quality)
- Apache 2.0 license
- Default in most Ollama installations

**Fallback:** Keyword search if Ollama unavailable

### Storage: sqlite-vec

**Rationale:**
- Single file (`.harness/context-compound.db`)
- No separate server process
- Native vector search with cosine similarity
- Works with existing SQLite tools

### Chunking: Full Document

**Rationale:**
- Brainstorms and plans are typically < 5KB
- Simpler implementation
- Can add section-based chunking later if needed

## File Structure

```
src/lib/context-compound/
├── types.ts          # Type definitions
├── ollama.ts         # Ollama client
├── store.ts          # sqlite-vec storage
├── indexer.ts        # Artifact indexing
├── retriever.ts      # Context retrieval
└── index.ts          # Public API

src/commands/
└── context.ts        # CLI command
```

## Dependencies

**New dev dependencies:**
- `@types/better-sqlite3` (if using better-sqlite3)

**New runtime dependencies:**
- None (use built-in `fetch` for Ollama API)

**Optional system dependency:**
- Ollama (auto-detected, not required)

## Testing Strategy

| Component | Test Approach | Coverage |
|-----------|---------------|----------|
| ollama.ts | Mock HTTP server | Connection, embedding, errors |
| store.ts | In-memory SQLite | CRUD, search, similarity |
| indexer.ts | Mock filesystem | Parsing, hashing, batching |
| retriever.ts | Integration with mock store | Ranking, threshold, filtering |
| context.ts | CLI integration tests | Exit codes, output formats |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Ollama not installed | High | Medium | Graceful fallback to keyword search |
| First query slow (model load) | Medium | Low | Document expected behavior |
| Large artifacts hurt relevance | Low | Medium | Add chunking in phase 2 |
| sqlite-vec compatibility | Low | High | Test on macOS/Linux/Windows |

## Success Metrics

- [ ] Can index 100 brainstorms in < 10 seconds
- [ ] Retrieval query returns in < 500ms
- [ ] Relevance score > 0.70 for obviously related topics
- [ ] Zero errors when Ollama unavailable (fallback works)
- [ ] Test coverage > 80%

## Future Work (Phase 2)

- Section-based chunking for long artifacts
- Auto-context injection in agent prompts
- Cross-project memory linking
- Temporal decay (older = less relevant)
- Hybrid cloud/local embedding option

---

**Decisions carried forward from brainstorm:**
- Use local Ollama embeddings (privacy, cost)
- Use sqlite-vec (simplicity, single file)
- Start with full-document chunking (MVP simplicity)
- Auto-detect Ollama with graceful fallback (zero-config)
