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

## Enhancement Summary

**Deepened on:** 2026-02-24
**Sections enhanced:** Technical Decisions, Testing Strategy, Security, Implementation Patterns
**Research agents used:**
- `framework-docs-researcher` - sqlite-vec patterns and best practices
- `best-practices-researcher` - Ollama API patterns
- `kieran-typescript-reviewer` - TypeScript patterns, Result types, testing
- `security-sentinel` - Security assessment and mitigations

### Key Improvements Discovered

1. **sqlite-vec integration**: Concrete setup patterns with WAL mode, schema design with metadata columns, cosine similarity search implementation
2. **Result type pattern**: Use discriminated unions `{ ok: true, value: T } | { ok: false, error: E }` matching codebase conventions
3. **Security hardening**: Path traversal protection using existing `validatePath()` utility, SSRF prevention for Ollama URLs, parameterized SQL queries
4. **Concurrency control**: Semaphore pattern for batch indexing with configurable limits
5. **Testing patterns**: MSW for mocking Ollama, in-memory SQLite with temp directories

### New Considerations Discovered

- **Storage formats**: Binary quantization can reduce storage 32x (96 bytes vs 3072 bytes per vector)
- **Performance tuning**: WAL mode essential for concurrent access, mmap for large datasets
- **Cancellation**: AbortController pattern for timeout handling
- **Graceful degradation**: Fallback to keyword search when Ollama unavailable

---

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

## Testing Strategy

| Component | Test Approach | Coverage |
|-----------|---------------|----------|
| ollama.ts | MSW mock server | Connection, embedding, errors, timeouts |
| store.ts | In-memory SQLite | CRUD, search, similarity, transactions |
| indexer.ts | Mock filesystem | Parsing, hashing, batching, concurrency |
| retriever.ts | Integration with mock store | Ranking, threshold, fallback |
| context.ts | CLI integration tests | Exit codes, output formats |

**Mock Ollama Server (MSW):**
```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const handlers = [
  http.get('http://localhost:11434/api/tags', () => {
    return HttpResponse.json({ models: [{ name: 'nomic-embed-text' }] });
  }),

  http.post('http://localhost:11434/api/embeddings', async ({ request }) => {
    const body = await request.json();
    // Return deterministic embedding based on input
    const embedding = Array(768).fill(0).map((_, i) =>
      Math.sin(body.prompt.length + i) * 0.1
    );
    return HttpResponse.json({ embedding });
  }),
];

const server = setupServer(...handlers);
```

**In-Memory Store Tests:**
```typescript
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('VectorStore', () => {
  let tempDir: string;
  let store: VectorStore;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'context-test-'));
    store = new VectorStore(join(tempDir, 'test.db'));
    store.init();
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true });
  });
});
```

## File Structure

```
src/lib/context-compound/
├── types.ts          # All type definitions (no implementation)
├── errors.ts         # Error classes and error handling utilities
├── config.ts         # Configuration schema and loading
├── ollama.ts         # Ollama client with AbortController/timeout
├── store.ts          # SQLite/vec storage with parameterized queries
├── indexer.ts        # File indexing with concurrency control
├── retriever.ts      # Context retrieval with fallback
├── fallback.ts       # Keyword fallback implementation
├── compound.ts       # Main ContextCompound class
└── index.ts          # Public API exports

src/commands/
└── context.ts        # CLI command implementation

src/lib/context-compound/__tests__/
├── ollama.test.ts
├── store.test.ts
├── indexer.test.ts
├── retriever.test.ts
└── integration.test.ts
```

## Dependencies

**New dependencies:**
```bash
# Runtime dependencies
pnpm add sqlite-vec better-sqlite3

# Dev dependencies
pnpm add -D @types/better-sqlite3 msw
```

**Alternative: Zero-dependency approach (MVP):**
If keeping dependencies minimal is prioritized, use:
- Native `fetch` for Ollama API
- Native `node:sqlite` (Node.js 22+) or `better-sqlite3` if already in project
- Implement basic vector operations without sqlite-vec (slower but no new deps)

**Optional system dependency:**
- Ollama (auto-detected, not required)

**Dependency Justification:**
| Package | Purpose | Alternative |
|---------|---------|-------------|
| `sqlite-vec` | Fast cosine similarity search | Native cosine calculation (slower) |
| `better-sqlite3` | Synchronous SQLite access | `node:sqlite` (Node 22+) |
| `msw` | Mock Service Worker for tests | Manual fetch mocking |

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

## Implementation Example: Complete Flow

**Ollama Client with Error Handling:**
```typescript
// src/lib/context-compound/ollama.ts
export interface EmbeddingError {
  readonly code: 'OLLAMA_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';
  readonly message: string;
  readonly retryable: boolean;
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private abortController: AbortController | null = null;

  constructor(options: { baseUrl?: string; timeoutMs?: number } = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:11434';
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async embed(text: string): Promise<Result<Float32Array, EmbeddingError>> {
    this.abortController?.abort();
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: text.slice(0, 8192),
        }),
        signal: this.abortController.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          ok: false,
          error: {
            code: 'OLLAMA_ERROR',
            message: `HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const data = await response.json() as { embedding: number[] };

      if (!Array.isArray(data.embedding) || data.embedding.length !== 768) {
        return {
          ok: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: `Invalid embedding: expected 768 dimensions, got ${data.embedding?.length}`,
            retryable: false,
          },
        };
      }

      return { ok: true, value: new Float32Array(data.embedding) };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        ok: false,
        error: {
          code: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
    }
  }
}
```

**Store with Parameterized Queries:**
```typescript
// src/lib/context-compound/store.ts
export class VectorStore {
  private db: Database.Database | null = null;

  constructor(private readonly dbPath: string) {}

  init(): Result<void, StoreError> {
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      sqliteVec.load(this.db);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          path TEXT PRIMARY KEY,
          content_hash TEXT NOT NULL,
          type TEXT NOT NULL,
          topic TEXT,
          date TEXT NOT NULL,
          indexed_at TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS vec_documents USING vec0(
          path TEXT PRIMARY KEY,
          embedding float[768] distance_metric=cosine
        );
      `);

      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'DB_ERROR',
          message: `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown'}`,
        },
      };
    }
  }

  insert(record: EmbeddingRecord): Result<void, StoreError> {
    if (!this.db) {
      return { ok: false, error: { code: 'DB_ERROR', message: 'Not initialized' } };
    }

    const insert = this.db.transaction(() => {
      this.db!.prepare(`
        INSERT OR REPLACE INTO documents (path, content_hash, type, topic, date, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        record.path,
        record.contentHash,
        record.metadata.type,
        record.metadata.topic,
        record.metadata.date,
        record.indexedAt.toISOString()
      );

      this.db!.prepare(`
        INSERT OR REPLACE INTO vec_documents (path, embedding)
        VALUES (?, ?)
      `).run(record.path, record.embedding);
    });

    try {
      insert();
      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'DB_ERROR',
          message: `Insert failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        },
      };
    }
  }

  search(
    queryEmbedding: Float32Array,
    options: { limit?: number; threshold?: number } = {}
  ): Result<Array<{ path: string; similarity: number }>, StoreError> {
    if (!this.db) {
      return { ok: false, error: { code: 'DB_ERROR', message: 'Not initialized' } };
    }

    const { limit = 10, threshold = 0.7 } = options;
    const maxDistance = 2 * (1 - threshold); // Convert similarity to distance

    try {
      const stmt = this.db.prepare(`
        SELECT path, distance
        FROM vec_documents
        WHERE embedding MATCH ? AND distance <= ?
        ORDER BY distance
        LIMIT ?
      `);

      const rows = stmt.all(queryEmbedding, maxDistance, limit) as Array<{
        path: string;
        distance: number;
      }>;

      return {
        ok: true,
        value: rows.map((row) => ({
          path: row.path,
          similarity: 1 - row.distance / 2,
        })),
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'DB_ERROR',
          message: `Search failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        },
      };
    }
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}
```

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
