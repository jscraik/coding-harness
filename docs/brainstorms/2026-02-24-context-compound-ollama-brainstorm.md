---
topic: Context Compound with Ollama Embeddings
date: 2026-02-24
status: draft
decisions: []
---

# Brainstorm: Context Compound with Ollama Embeddings

## Problem Statement

Every agent session starts with a blank slate. Past brainstorms, decisions, and plans exist in `docs/brainstorms/` and `docs/plans/` but are invisible to new sessions unless manually searched. This leads to:

- Re-discovering decisions from last week
- Repeating architectural mistakes  
- Missing critical risk tier rules or evidence requirements
- Wasted time on "what did we decide about...?"

## The Idea: Context Compound

An embedding-powered semantic memory system using **local Ollama models** that automatically surfaces relevant prior work when an agent starts new work.

## Key Principles

1. **Local-First**: Use Ollama (nomic-embed-text, all-minilm) not cloud APIs
2. **Zero-Config**: Auto-detect Ollama, graceful fallback to keyword search
3. **Compounding Value**: More artifacts = better retrieval
4. **Privacy**: Everything stays local (no code leaves the machine)

## Technical Approach

### 1. Embedding Pipeline

```typescript
// Generate embeddings via Ollama HTTP API
const response = await fetch('http://localhost:11434/api/embeddings', {
  method: 'POST',
  body: JSON.stringify({
    model: 'nomic-embed-text',
    prompt: brainstormContent
  })
});
```

### 2. Storage

- SQLite with `sqlite-vec` extension for vector search
- Store in `.harness/context-compound.db` (gitignored)
- Index: path, embedding (768d), metadata (date, type, status)

### 3. Auto-Index on Artifact Creation

```typescript
// In createBrainstorm() / createPlan()
if (await ollama.isAvailable()) {
  await contextCompound.index({
    path: filepath,
    content: fullContent,
    type: 'brainstorm',
    topic: frontmatter.topic
  });
}
```

### 4. Context Retrieval API

```typescript
// Before starting work
const relevant = await contextCompound.retrieve({
  query: "implementing OAuth",
  limit: 5,
  threshold: 0.75
});
// Returns: [{path, relevance, excerpt}, ...]
```

## Open Questions

1. **Which embedding model?**
   - nomic-embed-text (fast, good quality)
   - all-minilm (smaller, faster)
   - mxbai-embed-large (better quality, slower)

2. **Chunking strategy?**
   - Full artifact (simple, but long docs may dilute relevance)
   - Section-based (better precision, more complex)
   - Hybrid (title + summary as primary, sections as secondary)

3. **When to retrieve?**
   - On session start (proactive)
   - On-demand via `/context` command (reactive)
   - Both (configurable)

4. **Relevance threshold?**
   - Fixed 0.75?
   - Adaptive based on result count?
   - User-configurable per project?

## Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| Ollama local | Private, free, fast after load | Requires Ollama installed, first query slow (model load) |
| Cloud (OpenAI) | No local deps, consistent | Costs money, sends code off-device |
| Hybrid (try local → fallback cloud) | Best of both | More complexity |

## MVP Scope

1. Add `harness context` command
2. Auto-detect Ollama, skip if unavailable
3. Index brainstorms/plans on creation
4. Simple cosine similarity search
5. Output: list of relevant artifacts with relevance scores

## Future Extensions

- **Agent Loop Integration**: Auto-inject context into agent prompts
- **Cross-Project Memory**: Link related projects via shared concepts
- **Decision Anchoring**: "This file was created per decision X in brainstorm Y"
- **Temporal Decay**: Older decisions less relevant (unless explicitly "timeless")

## Success Metrics

- Agent can answer: "What did we decide about auth?" without grep
- New feature implementation starts with relevant prior context
- Reduced duplicate brainstorms on same topic

